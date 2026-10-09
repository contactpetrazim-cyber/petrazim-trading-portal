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
  - LOSS_GUARD_STREAK_COUNT consecutive losses (no win/breakeven
    breaking the streak), counted back from the most recent closed
    trade, OR
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
# Enough rows to detect a 3-streak and compute a stable recent-average
# risk — not tied to LOSS_GUARD_STREAK_COUNT so the two can be tuned
# independently without this silently running out of rows to look at.
_LOOKBACK_TRADES = 8


@dataclass
class LossGuardResult:
    tripped: bool
    reason: Optional[str] = None


def _evaluate(rows: list[Trade]) -> LossGuardResult:
    if not rows:
        return LossGuardResult(False)

    # Condition 1 — consecutive losses, counted back from the most
    # recent closed trade (rows are already ordered newest-first); a
    # win or breakeven breaks the streak immediately.
    streak = 0
    for t in rows:
        if (t.realized_pnl or 0) < 0:
            streak += 1
        else:
            break
    if streak >= LOSS_GUARD_STREAK_COUNT:
        return LossGuardResult(True, f"{streak} consecutive losses")

    # Condition 2 — cumulative loss within the trailing window, judged
    # against this bot/pair's own recent average risk (self-scaling —
    # see this module's own docstring for why that beats one fixed
    # dollar figure).
    cutoff = datetime.utcnow() - timedelta(hours=LOSS_GUARD_WINDOW_HOURS)
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
