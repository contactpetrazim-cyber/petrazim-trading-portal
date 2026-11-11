"""Recommended Bots dashboard — live forward performance vs. the evidence
that put each bot on the roster.

By direct request: "Include the basis of the new recommendations in a
new Bot dashboard on the bot page ... a dynamic dashboard with charts
and diagrams on the performance of the recommended bots going forward
... a review of key insights and recommendations summary section."

Everything here is computed from real trades on each request — nothing
is a stored snapshot:

- BASELINE (the basis): for each recommended bot, the closed trades of
  its own strategy family on its own instrument, from every OTHER bot,
  created before the roster went live. Frozen by construction (nothing
  can be added before a past date), so it reproduces the evidence the
  selection was made on — and its evidence score (avg R x sqrt(n)) is
  the same ranking rule migration 030 used.
- LIVE: the recommended bot's own closed trades since it was created.
- Insights and recommendations are rule-based reads of those two, with
  explicit sample-size guards so a 2-trade streak is never presented as
  a verdict.

Recommended bots are identified by the "_rec_" bot_id convention (see
migration 030 and frontend lib/botGrading.ts isRecommendedBot).
"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import BotConfig, BotStatus
from app.models.trade import Trade, TradeStatus

REC_PATTERN = re.compile(r"^(bot_\d+)_rec_")
MIN_TRADES_FOR_VERDICT = 5       # below this, no performance verdict at all
TRADES_FOR_CONFIDENCE = 21       # by direct request ("use 21 trades"): the Basic-mode baseline each bot must reach before its record is judged or Intelligent mode is considered
R_BINS = [(-math.inf, -0.75, "≤ -0.75R"), (-0.75, -0.25, "-0.75 to -0.25R"), (-0.25, 0.25, "≈ 0R"),
          (0.25, 1.0, "0.25 to 1R"), (1.0, 2.0, "1 to 2R"), (2.0, 3.0, "2 to 3R"), (3.0, math.inf, "≥ 3R")]


def is_recommended(bot_id: str) -> bool:
    return bool(REC_PATTERN.match(bot_id or ""))


def family_of(bot_id: str) -> str:
    m = re.match(r"^(bot_\d+)(?:_|$)", bot_id or "")
    return m.group(1) if m else bot_id


def _stats(trades: List[Trade]) -> Dict:
    n = len(trades)
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    pnl = [t.realized_pnl or 0.0 for t in trades]
    gains = sum(p for p in pnl if p > 0)
    losses = -sum(p for p in pnl if p < 0)
    wins = sum(1 for p in pnl if p > 0)
    avg_r = sum(rs) / len(rs) if rs else None
    # Max drawdown on the cumulative-R path (in R), chronological.
    peak = cum = mdd = 0.0
    for t in sorted(trades, key=lambda t: t.exit_timestamp or t.created_at or datetime.min):
        cum += t.r_multiple or 0.0
        peak = max(peak, cum)
        mdd = max(mdd, peak - cum)
    return {
        "n": n,
        "wins": wins,
        "win_rate_pct": round(100.0 * wins / n, 1) if n else None,
        "avg_r": round(avg_r, 3) if avg_r is not None else None,
        "total_r": round(sum(rs), 2) if rs else 0.0,
        "total_pnl": round(sum(pnl), 2),
        "profit_factor": round(gains / losses, 2) if losses > 0 else (None if gains == 0 else "∞"),
        "max_drawdown_r": round(mdd, 2),
        "evidence_score": round(max(0.0, avg_r) * math.sqrt(len(rs)), 2) if avg_r is not None else 0.0,
    }


def _verdict(live: Dict, base: Dict) -> Dict:
    n, r, br = live["n"], live["avg_r"], base["avg_r"]
    if n < MIN_TRADES_FOR_VERDICT:
        return {"key": "early", "label": f"Too early ({n}/{MIN_TRADES_FOR_VERDICT} trades)", "level": "info"}
    if r is None:
        return {"key": "early", "label": "No R data yet", "level": "info"}
    if n >= 10 and r <= -0.3:
        return {"key": "review", "label": "Review — losing steadily", "level": "critical"}
    if r < 0:
        return {"key": "losing", "label": "Behind — negative so far", "level": "serious"}
    if br is None or br <= 0 or r >= br:
        return {"key": "ahead", "label": "At or above its evidence", "level": "good"}
    if r >= 0.5 * br:
        return {"key": "on_track", "label": "On track (≥ half its evidence)", "level": "good"}
    return {"key": "behind", "label": "Positive, below its evidence", "level": "warning"}


async def build_dashboard(db: AsyncSession, owner_ids: Optional[List] = None, now: Optional[datetime] = None) -> Dict:
    """owner_ids=None -> every recommended bot (staff); otherwise only
    recommended bots owned by those user ids."""
    now = now or datetime.utcnow()
    query = select(BotConfig)
    if owner_ids is not None:
        query = query.where(BotConfig.user_id.in_(owner_ids))
    rec_bots = [b for b in (await db.execute(query)).scalars().all() if is_recommended(b.bot_id)]
    if not rec_bots:
        return {"generated_at": now.isoformat(), "rollout_at": None, "bots": [], "instruments": [], "equity": [],
                "r_distribution": [], "daily": [], "exits": [], "totals": None, "baseline_totals": None,
                "insights": [], "recommendations": [], "selection_rule": _selection_rule()}

    rollout_at = min(b.created_at for b in rec_bots if b.created_at) if any(b.created_at for b in rec_bots) else now
    rec_ids = {b.bot_id for b in rec_bots}
    symbols = {s for b in rec_bots for s in (b.symbols or [])}
    families = {family_of(b.bot_id) for b in rec_bots}

    closed = (await db.execute(select(Trade).where(Trade.status == TradeStatus.CLOSED, Trade.symbol.in_(symbols)))).scalars().all()
    open_rows = (await db.execute(select(Trade.bot_id).where(Trade.status == TradeStatus.ACTIVE, Trade.bot_id.in_(rec_ids)))).scalars().all()
    open_by_bot: Dict[str, int] = defaultdict(int)
    for bid in open_rows:
        open_by_bot[bid] += 1

    live_by_bot: Dict[str, List[Trade]] = defaultdict(list)
    base_by_key: Dict[tuple, List[Trade]] = defaultdict(list)
    for t in closed:
        if t.bot_id in rec_ids:
            live_by_bot[t.bot_id].append(t)
        elif family_of(t.bot_id) in families and t.created_at and t.created_at < rollout_at and not is_recommended(t.bot_id):
            base_by_key[(family_of(t.bot_id), t.symbol)].append(t)

    bots_out = []
    for b in sorted(rec_bots, key=lambda b: ((b.symbols or [""])[0], b.bot_id)):
        fam, sym = family_of(b.bot_id), (b.symbols or [""])[0]
        live_trades = live_by_bot.get(b.bot_id, [])
        live = _stats(live_trades)
        base = _stats(base_by_key.get((fam, sym), []))
        tp1_hits = sum(1 for t in live_trades if t.tp1_triggered)
        bots_out.append({
            "bot_id": b.bot_id, "bot_name": b.bot_name, "family": fam, "symbol": sym,
            "status": b.status.value if isinstance(b.status, BotStatus) else str(b.status),
            "open_trades": open_by_bot.get(b.bot_id, 0),
            "live": live, "baseline": base,
            "tp1_hit_rate_pct": round(100.0 * tp1_hits / len(live_trades), 1) if live_trades else None,
            "confidence_pct": round(min(1.0, live["n"] / TRADES_FOR_CONFIDENCE) * 100),
            "verdict": _verdict(live, base),
            "last_trade_at": max((t.exit_timestamp or t.created_at for t in live_trades), default=None),
        })
    for row in bots_out:
        if row["last_trade_at"]:
            row["last_trade_at"] = row["last_trade_at"].isoformat()

    all_live = [t for ts in live_by_bot.values() for t in ts]
    all_base = [t for ts in base_by_key.values() for t in ts]

    instruments = []
    for sym in sorted(symbols):
        sym_bots = [r for r in bots_out if r["symbol"] == sym]
        live_t = [t for t in all_live if t.symbol == sym]
        base_t = [t for t in all_base if t.symbol == sym and (family_of(t.bot_id), sym) in {(r["family"], sym) for r in sym_bots}]
        instruments.append({"symbol": sym, "bots": [r["bot_id"] for r in sym_bots], "live": _stats(live_t), "baseline": _stats(base_t)})

    ordered = sorted(all_live, key=lambda t: t.exit_timestamp or t.created_at or datetime.min)
    cum = 0.0
    equity = []
    for t in ordered:
        cum += t.r_multiple or 0.0
        equity.append({"t": (t.exit_timestamp or t.created_at).isoformat(), "bot_id": t.bot_id, "symbol": t.symbol,
                       "r": round(t.r_multiple or 0.0, 2), "cum_r": round(cum, 2)})

    r_distribution = []
    for lo, hi, label in R_BINS:
        r_distribution.append({"bin": label, "count": sum(1 for t in all_live if t.r_multiple is not None and lo < t.r_multiple <= hi)
                               if hi != math.inf else sum(1 for t in all_live if t.r_multiple is not None and t.r_multiple > lo)})

    daily_map: Dict[str, Dict] = defaultdict(lambda: {"pnl": 0.0, "r": 0.0, "n": 0})
    for t in ordered:
        day = (t.exit_timestamp or t.created_at).date().isoformat()
        daily_map[day]["pnl"] += t.realized_pnl or 0.0
        daily_map[day]["r"] += t.r_multiple or 0.0
        daily_map[day]["n"] += 1
    daily = [{"day": d, "pnl": round(v["pnl"], 2), "r": round(v["r"], 2), "n": v["n"]} for d, v in sorted(daily_map.items())]

    exit_counts: Dict[str, int] = defaultdict(int)
    for t in all_live:
        exit_counts[t.exit_type.value if t.exit_type else "unknown"] += 1
    exits = [{"exit_type": k, "count": v} for k, v in sorted(exit_counts.items(), key=lambda kv: -kv[1])]

    totals = _stats(all_live)
    baseline_totals = _stats(all_base)
    insights = _insights(bots_out, instruments, totals, baseline_totals, rollout_at, now)
    return {
        "generated_at": now.isoformat(),
        "rollout_at": rollout_at.isoformat(),
        "days_live": max(0, (now - rollout_at).days),
        "bots": bots_out, "instruments": instruments, "equity": equity,
        "r_distribution": r_distribution, "daily": daily, "exits": exits,
        "totals": {**totals, "open_trades": sum(open_by_bot.values()), "bot_count": len(bots_out),
                   "active_bot_count": sum(1 for r in bots_out if r["status"] == "active")},
        "baseline_totals": baseline_totals,
        "insights": insights["insights"],
        "recommendations": insights["recommendations"],
        "selection_rule": _selection_rule(),
        "confidence_target": TRADES_FOR_CONFIDENCE,
    }


def _selection_rule() -> Dict:
    return {
        "score": "evidence score = average R x sqrt(closed trades)",
        "eligibility": "at least 5 closed trades, positive total P&L, profit factor above 1",
        "pick": "top two bot families per instrument; an instrument with only one eligible family gets one bot",
        "source": "each recommended bot is a clone of the instance that produced the evidence, narrowed to one instrument",
        "confidence_floor": f"{TRADES_FOR_CONFIDENCE} live trades before a bot's live record is treated as reliable",
    }


def _insights(bots: List[Dict], instruments: List[Dict], totals: Dict, base_totals: Dict,
              rollout_at: datetime, now: datetime) -> Dict:
    insights: List[Dict] = []
    recs: List[Dict] = []
    n = totals["n"]

    if n == 0:
        insights.append({"level": "info", "title": "No closed trades yet",
                         "detail": f"The roster went live {max(0, (now - rollout_at).days)} day(s) ago. Charts fill in as trades close — "
                                   f"the evidence column already shows what each bot is expected to do."})
    elif n < MIN_TRADES_FOR_VERDICT * 2:
        insights.append({"level": "info", "title": f"Early days — {n} closed trade{'s' if n != 1 else ''}",
                         "detail": "Too few to judge the roster; individual results are mostly noise at this size."})
    else:
        br, lr = base_totals["avg_r"], totals["avg_r"]
        if lr is not None and br is not None:
            level = "good" if lr >= 0.5 * br and lr > 0 else ("warning" if lr > 0 else "serious")
            insights.append({"level": level, "title": f"Roster averaging {lr}R vs {br}R evidence",
                             "detail": f"{n} live trades, {totals['win_rate_pct']}% win rate, {totals['total_r']}R net. "
                                       f"Live results usually run below a selection's evidence (selection picks the luckiest past); "
                                       f"holding at least half the evidence edge is a healthy forward result."})

    early = [b for b in bots if b["verdict"]["key"] == "early"]
    if early and n:
        insights.append({"level": "info", "title": f"{len(early)} of {len(bots)} bots still below {MIN_TRADES_FOR_VERDICT} trades",
                         "detail": "Their verdicts are withheld on purpose: " + ", ".join(b["bot_name"].split(" · ")[-1] + f" ({b['family']})" for b in early[:6]) + "."})

    for b in bots:
        v = b["verdict"]["key"]
        name = f"{b['family']} on {b['symbol']}"
        if v == "review":
            insights.append({"level": "critical", "title": f"{name} is losing steadily",
                             "detail": f"{b['live']['n']} trades at {b['live']['avg_r']}R vs {b['baseline']['avg_r']}R evidence."})
            recs.append({"priority": 1, "action": f"Pause {b['bot_name']} and re-run its backtest on current data",
                         "why": f"{b['live']['n']} live trades averaging {b['live']['avg_r']}R — the evidence edge has not carried forward."})
        elif v == "ahead" and b["live"]["n"] >= TRADES_FOR_CONFIDENCE:
            insights.append({"level": "good", "title": f"{name} confirmed",
                             "detail": f"{b['live']['n']} trades at {b['live']['avg_r']}R — at or above its {b['baseline']['avg_r']}R evidence."})
        if b["live"]["max_drawdown_r"] >= 5:
            insights.append({"level": "serious", "title": f"{name} drawdown {b['live']['max_drawdown_r']}R",
                             "detail": "A drawdown of 5R+ is large for a single bot at 1% risk; check whether losses cluster in one session."})

    # Instrument-level: where the edge is concentrated.
    traded = [i for i in instruments if i["live"]["n"] >= MIN_TRADES_FOR_VERDICT and i["live"]["avg_r"] is not None]
    if len(traded) >= 2:
        best = max(traded, key=lambda i: i["live"]["avg_r"])
        worst = min(traded, key=lambda i: i["live"]["avg_r"])
        if best["symbol"] != worst["symbol"]:
            insights.append({"level": "info", "title": f"Best instrument so far: {best['symbol']} ({best['live']['avg_r']}R)",
                             "detail": f"Weakest: {worst['symbol']} ({worst['live']['avg_r']}R). Use this to steer your 3-instrument focus."})

    thin = [i["symbol"] for i in instruments if i["baseline"]["n"] < MIN_TRADES_FOR_VERDICT]
    if thin:
        recs.append({"priority": 3, "action": f"Treat {', '.join(thin)} as probationary",
                     "why": "Its selection evidence is under 5 trades — the recommendation is a best guess, not a proven edge."})

    weak_base = [i["symbol"] for i in instruments if i["baseline"]["avg_r"] is not None and 0 < i["baseline"]["avg_r"] < 0.2 and i["baseline"]["n"] >= MIN_TRADES_FOR_VERDICT]
    if weak_base:
        recs.append({"priority": 2, "action": f"Keep {', '.join(weak_base)} out of your 3-instrument focus for now",
                     "why": "Their evidence edge is under 0.2R per trade — costs and slippage can erase it."})

    strong = sorted((i for i in instruments if (i["baseline"]["evidence_score"] or 0) > 0), key=lambda i: -i["baseline"]["evidence_score"])[:3]
    if strong:
        recs.append({"priority": 2, "action": "Focus instruments by evidence: " + ", ".join(i["symbol"] for i in strong),
                     "why": f"Highest evidence scores (avg R x sqrt(n)) going in; revisit once each has {TRADES_FOR_CONFIDENCE} live trades."})

    shared = defaultdict(list)
    for b in bots:
        shared[b["symbol"]].append(b["family"])
    near_twins = [s for s, fams in shared.items() if {"bot_3", "bot_7"} <= set(fams)]
    if near_twins:
        recs.append({"priority": 2, "action": f"Watch for doubled entries on {', '.join(near_twins)} (Bot 3 + Bot 7)",
                     "why": "They share the FVG-expansion setup and can enter the same move together, doubling exposure."})

    recs.append({"priority": 4, "action": f"Formal review when each bot reaches {TRADES_FOR_CONFIDENCE} live trades",
                 "why": "Below that, live win rate and R swing too much to separate skill from luck."})
    recs.sort(key=lambda r: r["priority"])
    order = {"critical": 0, "serious": 1, "warning": 2, "good": 3, "info": 4}
    insights.sort(key=lambda i: order.get(i["level"], 5))
    return {"insights": insights, "recommendations": recs}
