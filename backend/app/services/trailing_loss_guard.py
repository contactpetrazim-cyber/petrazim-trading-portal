"""
Trailing Loss Guard — a rolling-window loss-streak/cumulative-loss
circuit breaker, bot-wide AND pair-wide, by direct request ("is there
a trailing loss rule that's bot wide or pair wide? Develop something
that is innovative"). Named "trailing" by analogy to a trailing STOP:
the window of "recent trades" continuously slides forward as new
trades close, rather than a fixed, one-time-tripped kill switch — no
persisted cooldown state at all, fully re-derived live from real trade
history every time a signal comes through, so it naturally clears the
moment the real picture improves (a win inside the window breaks a
streak; an old loss ages out of the cumulative window) with zero
separate bookkeeping to reset or expire.

Complements, doesn't replace, execution_engine.py's own process_signal
"don't repeat a setup that JUST lost" guard — that one is scoped to
ONE bot + ONE matching entry/SL (within tolerance). This one catches a
bot (or a PAIR, across every bot trading it) that's cold right now,
regardless of whether any individual setup repeats. The pair-wide half
is the genuinely new capability: different bots hitting the same
adverse real-world condition (illiquidity, a news spike, a stale feed)
on the same instrument, each with a technically different setup the
per-bot/per-setup guard structurally cannot see.

Trips on EITHER condition, whichever happens first (by direct answer):
  - LOSS_GUARD_STREAK_COUNT consecutive loss EVENTS (no win/breakeven
    breaking the streak), counted back from the most recent closed
    trade, all within the last 48h; simultaneous stop-outs (within
    15 min) are one event and -0.1R..0 scratches are neutral, OR
  - cumulative realized_pnl across trades closed within the last
    LOSS_GUARD_WINDOW_HOURS is worse than -LOSS_GUARD_CUMULATIVE_MULTIPLE
    times this bot/pair's own recent average risk_amount — scales
    automatically per bot/pair (a $10-risk bot and a $100-risk bot get
    proportionally the same protection) rather than one fixed dollar
    figure that wouldn't generalize across very different position
    sizes.
Cooldown is implicit, by design: once the window's own real trades age
out or a win breaks the streak, the guard clears itself on the very
next check — there is nothing to separately reset, unlike BotConfig.
sleep_until's own explicit "Reset" action.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trade import Trade, TradeStatus

LOSS_GUARD_STREAK_COUNT = 3
LOSS_GUARD_WINDOW_HOURS = 4
LOSS_GUARD_CUMULATIVE_MULTIPLE = 3.0
# Every loss counted toward a streak must itself have closed within this
# window — not just the most recent one. History: originally the streak
# had no time bound at all, which deadlocked bot_5_jeafx for 15+ days
# (clearing needs a win, but the guard blocked every new trade); the
# first fix bounded only the MOST RECENT trade, so three losses spread
# over five days still counted as a live "cold streak" — found live on
# BTCUSDT.P right after the Recommended Bots rollout (4 losses from
# paused bots across Nov 6-11 blocking the brand-new roster). 48h is the
# directly-requested maximum rest before a reset.
LOSS_GUARD_STREAK_STALENESS_HOURS = 48
# Losses closing within this gap of each other are ONE loss event: the
# same price move stopping out several bots at once (found live: EUR -
# five different bots stopped out inside 3 seconds; NAS100 - four in the
# same second) is one adverse market event, not five independent
# losses. Counting each separately tripped the pair guard off a single
# candle whenever several bots shared a pair.
LOSS_GUARD_EVENT_CLUSTER_MINUTES = 15
# A result between this and 0R is a scratch (e.g. a breakeven trail
# exiting a few ticks under entry after fees): neutral — it neither
# counts as a loss nor breaks a streak.
LOSS_GUARD_SCRATCH_R = -0.1
# Enough rows to see 3 distinct loss events even when each event is
# several simultaneous stop-outs, and to compute a stable recent-average
# risk for the cumulative check.
_LOOKBACK_TRADES = 30


@dataclass
class LossGuardResult:
    tripped: bool
    reason: Optional[str] = None


def _is_scratch(t: Trade) -> bool:
    return t.r_multiple is not None and LOSS_GUARD_SCRATCH_R < t.r_multiple < 0


def _evaluate(rows: list[Trade], now: Optional[datetime] = None) -> LossGuardResult:
    now = now or datetime.utcnow()
    if not rows:
        return LossGuardResult(False)

    # Condition 1 — LOSS_GUARD_STREAK_COUNT distinct loss EVENTS in a row,
    # newest first, every one inside the staleness window. A win (or
    # breakeven) breaks the streak; a scratch is skipped; simultaneous
    # losses collapse into one event.
    streak_cutoff = now - timedelta(hours=LOSS_GUARD_STREAK_STALENESS_HOURS)
    cluster_gap = timedelta(minutes=LOSS_GUARD_EVENT_CLUSTER_MINUTES)
    events = 0
    last_loss_at: Optional[datetime] = None
    for t in rows:
        if t.exit_timestamp is None or t.exit_timestamp < streak_cutoff:
            break
        if (t.realized_pnl or 0) >= 0:
            break
        if _is_scratch(t):
            continue
        if last_loss_at is None or last_loss_at - t.exit_timestamp > cluster_gap:
            events += 1
        last_loss_at = t.exit_timestamp
    if events >= LOSS_GUARD_STREAK_COUNT:
        return LossGuardResult(True, f"{events} consecutive losses within {LOSS_GUARD_STREAK_STALENESS_HOURS}h")

    # Condition 2 — cumulative loss within the trailing window, judged
    # against this bot/pair's own recent average risk (self-scaling —
    # see this module's own docstring for why that beats one fixed
    # dollar figure). Unchanged: a real multi-R hit inside 4h still
    # earns a short cooldown even when it was one simultaneous event.
    cutoff = now - timedelta(hours=LOSS_GUARD_WINDOW_HOURS)
    recent = [t for t in rows if t.exit_timestamp and t.exit_timestamp >= cutoff]
    if recent:
        cumulative = sum(t.realized_pnl or 0 for t in recent)
        avg_risk = sum(t.risk_amount or 0 for t in rows) / len(rows)
        if avg_risk > 0 and cumulative <= -LOSS_GUARD_CUMULATIVE_MULTIPLE * avg_risk:
            return LossGuardResult(
                True, f"${cumulative:.2f} cumulative loss in the last {LOSS_GUARD_WINDOW_HOURS}h"
            )

    return LossGuardResult(False)


async def check_bot(db: AsyncSession, bot_id: str) -> LossGuardResult:
    """Bot-wide: this bot's own last few closed trades, regardless of
    symbol — a bot that's cold on ONE pair it trades is still the same
    strategy/logic potentially misreading current conditions on all of
    them."""
    rows = (await db.execute(
        select(Trade)
        .where(Trade.bot_id == bot_id, Trade.status == TradeStatus.CLOSED, Trade.is_deleted.isnot(True))
        .order_by(Trade.exit_timestamp.desc())
        .limit(_LOOKBACK_TRADES)
    )).scalars().all()
    return _evaluate(rows)


async def check_pair(db: AsyncSession, symbol: str) -> LossGuardResult:
    """Pair-wide: this SYMBOL's last few closed trades, ACROSS EVERY
    bot trading it — no bot_id filter at all. The genuinely new
    capability this module adds over the existing per-bot guards."""
    rows = (await db.execute(
        select(Trade)
        .where(Trade.symbol == symbol, Trade.status == TradeStatus.CLOSED, Trade.is_deleted.isnot(True))
        .order_by(Trade.exit_timestamp.desc())
        .limit(_LOOKBACK_TRADES)
    )).scalars().all()
    return _evaluate(rows)
