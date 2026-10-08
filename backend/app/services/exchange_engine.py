"""
Exchange Engine — the "optimal preferred exchange" picker.

By direct request ("Develop an optimal prefered exchange engine
that's easy to use ... and reliable ... also integrate the auto
switch to available margin capital").

Before this, a bot had exactly one way to pick an exchange:
BotConfig.exchange, a static string set once (only at bot creation —
there was no UI to change it afterward) and never reconsidered. A
SEPARATE setting, margin_mode, could react to a margin SHORTFALL at
the exact moment an order was about to be placed (margin_switch_
engine.py) — but that only ever moved the EXECUTION venue, never the
exchange candles were fetched from, so a "switched" trade's entry
price and its actual fill venue could still disagree (see market_
scanner.py's own history with this exact class of bug, fixed by
PR #243 for the static case).

This module is the single place that picks ONE exchange for BOTH the
candle fetch AND signal.preferred_broker, so they can never disagree
by construction — not by convention. Only engages for a bot explicitly
opted into BotConfig.exchange_mode == "auto"; every "fixed"-mode bot's
behavior is completely unchanged (BotConfig.exchange, read as before).

Ranking (from direct clarifying intent — "optimal" and "reliable"):
  1. Eligible at all: this bot's (or its parent strategy's — see
     broker_credentials.STRATEGY_CREDENTIAL_OWNER) own dedicated
     BotBrokerCredential exists for that exchange, AND the bot's
     symbol is a real, active market there (data_ingestion.py's own
     symbol_is_tradeable).
  2. Funded: a live (or short-TTL cached) balance call reports either
     a positive balance, or is genuinely unreadable (fails OPEN —
     never excludes a candidate just because one balance call had a
     hiccup; the exact same philosophy margin_switch_engine.py's own
     _live_or_cached_balance already uses).
  3. Ranked by this module's own rolling RELIABILITY score (recent
     candle-fetch/order-placement success rate, see record_result)
     first, then by known balance (higher wins) as the tie-break.
  4. Sticky: once picked, a bot STAYS on that exchange for
     STICKY_COOLDOWN before being reconsidered, as long as it's still
     eligible+funded — a strategy's own zone/sweep/FVG detection
     depends on a consistent candle source; re-picking every scan
     cycle would feed it a different exchange's slightly different
     price action trade to trade, which is a cost "optimal" is not
     worth paying for a marginal reliability/balance difference.
     Persisted on BotConfig (active_exchange/active_exchange_reason/
     active_exchange_picked_at), not just in-memory, so the choice
     survives a restart and is visible to a trader, not a black box.

The margin_auto_switch_enabled master switch (Admin portal) gates
Auto mode's margin/reliability-aware ranking exactly like it already
gates margin_switch_engine.py's own fallback — turning it off makes
every "auto" bot behave exactly like "fixed" (BotConfig.exchange),
by direct request ("integrate the auto switch to available margin
capital") rather than introducing a second, redundant master toggle.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.bot import BotConfig
from app.services.broker_credentials import (
    STRATEGY_CREDENTIAL_OWNER,
    build_broker_client,
    list_credentials_for_bot,
)
from app.services.data_ingestion import shared_ingestion
from app.services.margin_switch_engine import get_margin_auto_switch_enabled, _live_or_cached_balance

logger = structlog.get_logger()
settings = get_settings()

# How long a bot stays on its current Auto pick before being
# reconsidered — see this module's own docstring, point 4.
STICKY_COOLDOWN = timedelta(hours=6)

# Rolling per-exchange health — recent candle-fetch/order-placement
# outcomes, most-recent-`_HEALTH_WINDOW` only. In-memory/per-process,
# same deliberate choice as margin_switch_engine.py's own
# _BALANCE_CACHE: this exists to avoid an exchange that's CURRENTLY
# misbehaving, not to be a permanent uptime ledger — resetting on
# restart is fine, since a restart is itself a reasonable moment to
# give every exchange a clean slate.
_HEALTH_WINDOW = 20
_EXCHANGE_HEALTH: Dict[str, "deque[bool]"] = {}


def record_result(exchange: str, success: bool) -> None:
    """Call after every real candle-fetch or order-placement attempt
    against `exchange`, success or failure — feeds get_reliability.
    Safe to call for an exchange this engine never ends up ranking
    (e.g. a "fixed"-mode bot's own fetch/execution) — the data is
    harmless and only ever read back by THIS module's own ranking."""
    window = _EXCHANGE_HEALTH.setdefault(exchange, deque(maxlen=_HEALTH_WINDOW))
    window.append(success)


def get_reliability(exchange: str) -> float:
    """Recent success rate for `exchange`, 0.0-1.0. An exchange with no
    recorded attempts yet defaults to 1.0 (optimistic) — a brand-new
    or rarely-used credential shouldn't be penalized for having no
    track record, the same "don't guess insufficiency" principle
    margin_switch_engine.py's own balance check already follows."""
    window = _EXCHANGE_HEALTH.get(exchange)
    if not window:
        return 1.0
    return sum(window) / len(window)


class _Candidate:
    __slots__ = ("exchange", "balance", "reliability")

    def __init__(self, exchange: str, balance: Optional[float], reliability: float):
        self.exchange = exchange
        self.balance = balance
        self.reliability = reliability

    def sort_key(self):
        # Higher reliability first; among ties, higher KNOWN balance
        # first (an unreadable balance sorts last within its
        # reliability tier — it's still eligible, per point 2 of this
        # module's docstring, just not preferred over a candidate
        # whose funding is actually confirmed).
        return (-self.reliability, -(self.balance if self.balance is not None else -1.0))


async def _gather_candidates(db: AsyncSession, credential_bot_id: str, symbol: str) -> List[_Candidate]:
    out: List[_Candidate] = []
    for credential in await list_credentials_for_bot(db, credential_bot_id):
        exchange = credential.exchange
        try:
            if not await shared_ingestion.symbol_is_tradeable(exchange, symbol):
                continue
        except Exception as e:
            logger.warning("exchange_engine_tradeable_check_failed", exchange=exchange, symbol=symbol, error=str(e))
            continue
        try:
            client = await build_broker_client(db, credential_bot_id, exchange)
        except Exception as e:
            logger.error("exchange_engine_candidate_build_failed", bot_id=credential_bot_id, exchange=exchange, error=str(e))
            continue
        if client is None:
            continue
        balance = await _live_or_cached_balance(f"auto:{credential_bot_id}:{exchange}", client)
        if balance is not None and balance <= 0:
            continue  # genuinely known to be empty — not a candidate
        out.append(_Candidate(exchange, balance, get_reliability(exchange)))
    out.sort(key=lambda c: c.sort_key())
    return out


def _credential_bot_id(bot_cfg: BotConfig) -> str:
    strategy_key = bot_cfg.strategy_key or "_".join(bot_cfg.bot_id.split("_")[:2])
    return STRATEGY_CREDENTIAL_OWNER.get(strategy_key, bot_cfg.bot_id)


async def resolve_exchange(db: AsyncSession, bot_cfg: BotConfig, symbol: str, default_exchange: str) -> Tuple[str, str]:
    """Returns (exchange, reason). `default_exchange` is the caller's
    own already-resolved fallback (market_scanner.py's `bot.exchange
    or MARKET_SCANNER_DEFAULT_EXCHANGE`) — returned unchanged, with a
    "fixed" reason, whenever Auto mode doesn't apply or can't decide
    anything better. Commits any new/updated pick directly (same
    self-contained write+commit pattern market_scanner.py's own
    _record_scan_result already uses) — callers don't need to."""
    if bot_cfg.exchange_mode != "auto":
        return default_exchange, "fixed"

    if not await get_margin_auto_switch_enabled(db):
        return default_exchange, "fixed (Auto master switch is off in Admin)"

    # Sticky: keep the current pick if it's still fresh and still a
    # real candidate — see this module's own docstring, point 4.
    if bot_cfg.active_exchange and bot_cfg.active_exchange_picked_at:
        age = datetime.utcnow() - bot_cfg.active_exchange_picked_at
        if age < STICKY_COOLDOWN:
            candidates = await _gather_candidates(db, _credential_bot_id(bot_cfg), symbol)
            if any(c.exchange == bot_cfg.active_exchange for c in candidates):
                return bot_cfg.active_exchange, bot_cfg.active_exchange_reason or "auto (sticky)"
            logger.info("exchange_engine_sticky_pick_no_longer_eligible", bot_id=bot_cfg.bot_id, exchange=bot_cfg.active_exchange)
    else:
        candidates = await _gather_candidates(db, _credential_bot_id(bot_cfg), symbol)

    if not candidates:
        return default_exchange, "auto: no eligible/funded credentialed exchange found — fell back to fixed exchange"

    best = candidates[0]
    reason = (
        f"auto: picked {best.exchange} — reliability {best.reliability:.0%}, "
        f"balance {'$%.2f' % best.balance if best.balance is not None else 'unknown (assumed OK)'}"
    )
    bot_cfg.active_exchange = best.exchange
    bot_cfg.active_exchange_reason = reason
    bot_cfg.active_exchange_picked_at = datetime.utcnow()
    await db.commit()
    logger.info("exchange_engine_picked", bot_id=bot_cfg.bot_id, exchange=best.exchange, reason=reason)
    return best.exchange, reason
