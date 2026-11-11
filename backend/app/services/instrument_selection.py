"""Instrument Focus engine — caps how many instruments bots may trade.

By direct request: "provide a guide or toggle whereby only a max of 3
instrument pairs can be traded using bots at any given time ... a
trader chooses what he wants to pursue ... choices for the trader per
session, daily, weekly, monthly or perpetual ... except if a master
switch is switched to custom or to all."

Three pieces:

1. MASTER MODE (platform-wide, Super Admin only) —
   PlatformSetting INSTRUMENT_LIMIT_MODE_KEY, JSON {"mode", "custom_max"}:
     - "limited" (default): bots trade at most DEFAULT_MAX_INSTRUMENTS (3).
     - "custom": bots trade at most `custom_max` instruments.
     - "all": no cap at all — every bot trades every one of its own
       symbols, exactly the behavior before this engine existed.

2. SELECTION (per owner) — PlatformSetting
   f"{INSTRUMENT_SELECTION_KEY_PREFIX}{owner_key}", JSON
   {"symbols", "period", "session", "set_at", "expires_at"}. owner_key
   is the bot owner's user id, or PLATFORM_OWNER_KEY for bots with no
   owner (BotConfig.user_id NULL — staff manage those). A selection
   lapses at the end of its period (session / day / ISO week / calendar
   month, all UTC); "perpetual" never lapses.

3. SUGGESTIONS — a per-period ranking of the owner's instruments from
   their own closed-trade history (see compute_suggestions). When an
   owner has no live selection (never set, or lapsed), the scanner uses
   the top-N suggestions ("auto" source) rather than silently trading
   nothing — so bots keep a sane, capped focus until the trader picks.

Only NEW signals are gated: services/market_scanner.py drops disallowed
(exchange, symbol) groups before fetching candles, which is also the
system-load saving the request asked for. Open trades are managed by
position_monitor.py, which never consults this module, so narrowing
the selection never orphans a live position.
"""

from __future__ import annotations

import json
import math
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Tuple

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import BotConfig, BotStatus
from app.models.platform_setting import PlatformSetting
from app.models.trade import Trade, TradeStatus

logger = structlog.get_logger()

INSTRUMENT_LIMIT_MODE_KEY = "bots.instrument_limit_mode"
INSTRUMENT_SELECTION_KEY_PREFIX = "bots.instrument_selection."
PLATFORM_OWNER_KEY = "platform"

DEFAULT_MAX_INSTRUMENTS = 3
CUSTOM_MAX_CEILING = 50
LIMIT_MODES = ("limited", "custom", "all")
PERIODS = ("session", "daily", "weekly", "monthly", "perpetual")

# UTC trading sessions. Overlaps are real (London/New York overlap is
# the busiest window of the day); current_session() resolves an
# overlap to the LATER-opening session, so a selection made at 13:00
# UTC runs until New York closes rather than London.
SESSIONS: Dict[str, Tuple[int, int]] = {
    "asia": (0, 8),
    "london": (7, 16),
    "new_york": (12, 21),
}
SESSION_LABELS = {"asia": "Asia (00-08 UTC)", "london": "London (07-16 UTC)", "new_york": "New York (12-21 UTC)"}

# How far back the "recent form" half of a suggestion score looks, per
# period. A session/day pick should weight what's working right now; a
# perpetual pick should lean on the whole record.
_RECENT_WINDOW_DAYS = {"session": 14, "daily": 7, "weekly": 14, "monthly": 30, "perpetual": None}
_MIN_TRADES_PER_FAMILY = 3


def owner_key_for(user_id) -> str:
    return str(user_id) if user_id else PLATFORM_OWNER_KEY


# ── master mode ──────────────────────────────────────────────────────

async def get_limit_mode(db: AsyncSession) -> Dict:
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == INSTRUMENT_LIMIT_MODE_KEY))).scalar_one_or_none()
    mode, custom_max = "limited", DEFAULT_MAX_INSTRUMENTS
    if row:
        try:
            data = json.loads(row.value)
            if data.get("mode") in LIMIT_MODES:
                mode = data["mode"]
            custom_max = max(1, min(CUSTOM_MAX_CEILING, int(data.get("custom_max", DEFAULT_MAX_INSTRUMENTS))))
        except (ValueError, TypeError):
            logger.warning("instrument_limit_mode_unparseable", value=row.value)
    return {"mode": mode, "custom_max": custom_max, "effective_max": effective_max(mode, custom_max)}


def effective_max(mode: str, custom_max: int) -> Optional[int]:
    """None means no cap ("all")."""
    if mode == "all":
        return None
    if mode == "custom":
        return custom_max
    return DEFAULT_MAX_INSTRUMENTS


async def set_limit_mode(db: AsyncSession, mode: str, custom_max: int) -> Dict:
    if mode not in LIMIT_MODES:
        raise ValueError(f"mode must be one of {LIMIT_MODES}")
    custom_max = max(1, min(CUSTOM_MAX_CEILING, int(custom_max)))
    await _upsert(db, INSTRUMENT_LIMIT_MODE_KEY, json.dumps({"mode": mode, "custom_max": custom_max}))
    _invalidate_cache()
    return {"mode": mode, "custom_max": custom_max, "effective_max": effective_max(mode, custom_max)}


# ── periods / expiry ─────────────────────────────────────────────────

def current_session(now: datetime) -> Optional[str]:
    """Latest-opening session whose window contains `now`, or None in
    the 21:00-24:00 UTC gap where no major session is open."""
    hour = now.hour
    live = [name for name, (start, end) in SESSIONS.items() if start <= hour < end]
    return max(live, key=lambda n: SESSIONS[n][0]) if live else None


def next_session(now: datetime) -> str:
    """The next session to open after `now` (used when picking a session
    selection during the gap)."""
    upcoming = sorted(SESSIONS.items(), key=lambda kv: kv[1][0])
    for name, (start, _end) in upcoming:
        if start > now.hour:
            return name
    return upcoming[0][0]


def compute_expiry(period: str, session: Optional[str], now: datetime) -> Optional[datetime]:
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "perpetual":
        return None
    if period == "daily":
        return day + timedelta(days=1)
    if period == "weekly":
        return day + timedelta(days=7 - now.weekday())  # next Monday 00:00 UTC
    if period == "monthly":
        return (day.replace(day=1) + timedelta(days=32)).replace(day=1)
    if period == "session":
        name = session or current_session(now) or next_session(now)
        start, end = SESSIONS[name]
        expiry = day + timedelta(hours=end)
        if now.hour >= end:  # that session already closed today -> its next run
            expiry += timedelta(days=1)
        return expiry
    raise ValueError(f"period must be one of {PERIODS}")


# ── selection storage ────────────────────────────────────────────────

async def get_selection(db: AsyncSession, owner_key: str) -> Optional[Dict]:
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == INSTRUMENT_SELECTION_KEY_PREFIX + owner_key)
    )).scalar_one_or_none()
    if not row:
        return None
    try:
        return json.loads(row.value)
    except ValueError:
        logger.warning("instrument_selection_unparseable", owner_key=owner_key)
        return None


def selection_is_live(selection: Optional[Dict], now: datetime) -> bool:
    if not selection or not selection.get("symbols"):
        return False
    expires_at = selection.get("expires_at")
    return expires_at is None or datetime.fromisoformat(expires_at) > now


async def save_selection(db: AsyncSession, owner_key: str, symbols: List[str], period: str,
                         session: Optional[str], set_by: str, now: Optional[datetime] = None) -> Dict:
    now = now or datetime.utcnow()
    if period not in PERIODS:
        raise ValueError(f"period must be one of {PERIODS}")
    if period == "session":
        session = session or current_session(now) or next_session(now)
        if session not in SESSIONS:
            raise ValueError(f"session must be one of {tuple(SESSIONS)}")
    else:
        session = None
    expiry = compute_expiry(period, session, now)
    payload = {
        "symbols": list(dict.fromkeys(symbols)),  # de-dupe, keep order
        "period": period,
        "session": session,
        "set_at": now.isoformat(),
        "expires_at": expiry.isoformat() if expiry else None,
        "set_by": set_by,
    }
    await _upsert(db, INSTRUMENT_SELECTION_KEY_PREFIX + owner_key, json.dumps(payload))
    _invalidate_cache()
    return payload


async def clear_selection(db: AsyncSession, owner_key: str) -> None:
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == INSTRUMENT_SELECTION_KEY_PREFIX + owner_key)
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    _invalidate_cache()


async def _upsert(db: AsyncSession, key: str, value: str) -> None:
    if len(value) > 500:  # PlatformSetting.value is String(500)
        raise ValueError("Selection too large to store")
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=key, value=value))
    await db.commit()


# ── suggestions ──────────────────────────────────────────────────────

def _family(bot_id: str) -> str:
    parts = bot_id.split("_")
    return "_".join(parts[:2]) if len(parts) >= 2 and parts[0] == "bot" else bot_id


def _family_score(r_values: List[float]) -> float:
    """Expectancy weighted by evidence: avg R x sqrt(n). Rewards a
    positive edge that has been proven over more trades — the same
    "don't trust tiny samples" principle as the audit engine's
    MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY, but continuous instead of a
    hard cutoff so a ranking still exists while samples are small."""
    if len(r_values) < _MIN_TRADES_PER_FAMILY:
        return 0.0
    avg = sum(r_values) / len(r_values)
    return max(0.0, avg) * math.sqrt(len(r_values))


def _in_session(ts: Optional[datetime], session: str) -> bool:
    if not ts:
        return False
    start, end = SESSIONS[session]
    return start <= ts.hour < end


def _best_two(by_family: Dict[str, List[float]]) -> Tuple[float, List[Tuple[str, float]]]:
    scored = sorted(((fam, _family_score(rs)) for fam, rs in by_family.items()), key=lambda x: -x[1])
    top = [(f, s) for f, s in scored if s > 0][:2]
    return sum(s for _f, s in top), top


async def compute_suggestions(db: AsyncSession, candidate_symbols: Iterable[str], bot_ids: Optional[List[str]],
                              period: str, session: Optional[str], now: Optional[datetime] = None) -> List[Dict]:
    """Rank `candidate_symbols` for `period` from closed-trade history.

    bot_ids scopes the evidence to the owner's own bots (None = every
    bot, for staff/platform) — the same ownership scoping as
    GET /bots/optimization-matrix, so a trader is never ranked off
    another trader's results.

    score = 0.6 x all-time + 0.4 x recent-window, each being the sum of
    the two best bot families' avg-R x sqrt(n) on that instrument. For
    a session pick both halves only count trades entered inside that
    session's UTC hours."""
    now = now or datetime.utcnow()
    candidates = sorted(set(candidate_symbols))
    if not candidates:
        return []
    if period == "session":
        session = session or current_session(now) or next_session(now)

    query = select(Trade.bot_id, Trade.symbol, Trade.r_multiple, Trade.realized_pnl, Trade.entry_timestamp, Trade.created_at).where(
        Trade.status == TradeStatus.CLOSED, Trade.symbol.in_(candidates), Trade.r_multiple.isnot(None),
    )
    if bot_ids is not None:
        if not bot_ids:
            return [_empty_row(s) for s in candidates]
        query = query.where(Trade.bot_id.in_(bot_ids))
    rows = (await db.execute(query)).all()

    window_days = _RECENT_WINDOW_DAYS[period]
    recent_cutoff = now - timedelta(days=window_days) if window_days else None
    all_time: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
    recent: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
    stats: Dict[str, Dict] = defaultdict(lambda: {"n": 0, "wins": 0, "pnl": 0.0, "r_sum": 0.0})
    for bot_id, symbol, r, pnl, entry_ts, created_at in rows:
        ts = entry_ts or created_at
        if period == "session" and not _in_session(ts, session):
            continue
        fam = _family(bot_id or "")
        all_time[symbol][fam].append(r)
        if recent_cutoff is None or (ts and ts >= recent_cutoff):
            recent[symbol][fam].append(r)
        st = stats[symbol]
        st["n"] += 1
        st["wins"] += 1 if (pnl or 0) > 0 else 0
        st["pnl"] += pnl or 0
        st["r_sum"] += r

    out = []
    for symbol in candidates:
        all_score, top = _best_two(all_time.get(symbol, {}))
        recent_score, _ = _best_two(recent.get(symbol, {}))
        score = 0.6 * all_score + 0.4 * recent_score
        st = stats.get(symbol, {"n": 0, "wins": 0, "pnl": 0.0, "r_sum": 0.0})
        n = st["n"]
        row = {
            "symbol": symbol,
            "score": round(score, 3),
            "n": n,
            "win_rate_pct": round(100.0 * st["wins"] / n, 1) if n else None,
            "avg_r": round(st["r_sum"] / n, 3) if n else None,
            "total_pnl": round(st["pnl"], 2),
            "recent_score": round(recent_score, 3),
            "best_bots": [{"family": f, "score": round(s, 3)} for f, s in top],
        }
        row["reason"] = _reason(row, period, session)
        out.append(row)
    out.sort(key=lambda r: (-r["score"], -(r["n"] or 0), r["symbol"]))
    for rank, row in enumerate(out, 1):
        row["rank"] = rank
    return out


def _empty_row(symbol: str) -> Dict:
    return {"symbol": symbol, "score": 0.0, "n": 0, "win_rate_pct": None, "avg_r": None, "total_pnl": 0.0,
            "recent_score": 0.0, "best_bots": [], "reason": "No closed trades yet", "rank": None}


def _reason(row: Dict, period: str, session: Optional[str]) -> str:
    if not row["n"]:
        scope = f" in the {SESSION_LABELS[session]} session" if period == "session" else ""
        return f"No closed trades{scope} yet — no evidence either way."
    if row["score"] <= 0:
        return f"No bot family has a positive edge here yet (n={row['n']}, avg {row['avg_r']}R)."
    best = ", ".join(b["family"] for b in row["best_bots"])
    form = "strong recent form" if row["recent_score"] >= row["score"] else "recent form cooler than its record"
    return f"Best: {best}. {row['win_rate_pct']}% win, avg {row['avg_r']}R over n={row['n']}; {form}."


# ── resolution (used by the scanner) ─────────────────────────────────

_CACHE: Dict[str, Tuple[float, Dict]] = {}
_CACHE_TTL_SECONDS = 300


def _invalidate_cache() -> None:
    _CACHE.clear()


async def resolve_allowed_symbols(db: AsyncSession, owner_key: str, owner_bots: List[BotConfig],
                                  now: Optional[datetime] = None) -> Dict:
    """What this owner's bots may open NEW trades on right now.

    Returns {"symbols": set | None, "source": "all" | "selection" | "auto",
    "max": int | None}. symbols=None means unrestricted. Cached for a
    few minutes per owner (any save/clear/mode change invalidates), so
    a scan cycle doesn't re-rank trade history every interval."""
    now = now or datetime.utcnow()
    cached = _CACHE.get(owner_key)
    if cached and cached[0] > time.monotonic():
        result = cached[1]
        # A live selection can lapse inside the TTL — re-check expiry.
        if result["source"] != "selection" or (result.get("expires_at") is None or datetime.fromisoformat(result["expires_at"]) > now):
            return result

    mode = await get_limit_mode(db)
    cap = mode["effective_max"]
    if cap is None:
        result = {"symbols": None, "source": "all", "max": None, "expires_at": None}
    else:
        selection = await get_selection(db, owner_key)
        if selection_is_live(selection, now):
            result = {"symbols": set(selection["symbols"][:cap]), "source": "selection", "max": cap,
                      "expires_at": selection.get("expires_at")}
        else:
            candidate_symbols = {s for b in owner_bots for s in (b.symbols or [])}
            bot_ids = await evidence_bot_ids(db, owner_key)
            ranked = await compute_suggestions(db, candidate_symbols, bot_ids, "daily", None, now)
            result = {"symbols": {r["symbol"] for r in ranked[:cap]}, "source": "auto", "max": cap, "expires_at": None}
    _CACHE[owner_key] = (time.monotonic() + _CACHE_TTL_SECONDS, result)
    return result


async def candidate_symbols_for_owner(db: AsyncSession, owner_key: str) -> Tuple[List[str], List[BotConfig]]:
    """Symbols the owner's bots can trade — ACTIVE bots first; falls back
    to every owned bot so a trader with everything paused can still
    plan a selection before resuming."""
    query = select(BotConfig)
    if owner_key == PLATFORM_OWNER_KEY:
        query = query.where(BotConfig.user_id.is_(None))
    else:
        query = query.where(BotConfig.user_id == uuid.UUID(owner_key))
    bots = (await db.execute(query)).scalars().all()
    active = [b for b in bots if b.status == BotStatus.ACTIVE]
    source = active or bots
    return sorted({s for b in source for s in (b.symbols or [])}), list(source)


async def evidence_bot_ids(db: AsyncSession, owner_key: str) -> Optional[List[str]]:
    """Whose closed trades rank this owner's instruments.

    None (= all trades) for the platform and for staff owners — staff
    already see every bot's results on the Optimization Matrix. A
    trader gets every bot they have EVER owned, paused/retired ones
    included: ranking off ACTIVE bots only would score a freshly
    created bot roster (zero trades) as no-evidence everywhere and
    fall back to alphabetical order, throwing away the very history
    that justified creating those bots."""
    if owner_key == PLATFORM_OWNER_KEY:
        return None
    from app.models.user import User, UserRole
    owner_id = uuid.UUID(owner_key)
    role = (await db.execute(select(User.role).where(User.id == owner_id))).scalar_one_or_none()
    if role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return None
    return list((await db.execute(select(BotConfig.bot_id).where(BotConfig.user_id == owner_id))).scalars().all())
