"""
Manual Trading — risk checks + order creation
=================================================

Manual orders go through the exact same risk-cap and execution path
bot trades use, by direct instruction — not a separate, looser set of
rules. The only manual-specific pieces are the three toggles:

  1. Global vs. Manual risk settings (ManualTradingSettings.
     use_global_defaults) — which numbers the checks below are
     measured against, not a different kind of check.
  2. Test vs. Live (ManualTradingSettings.trading_mode) — which
     platform-facing label the trader is in.
  3. Paper Trading (ManualTradingSettings.paper_trading_enabled) — a
     permanent, independent toggle available in BOTH Test and Live
     (by direct request). Whether a given order actually reaches a
     real broker is decided by `trading_mode == TEST or
     paper_trading_enabled` (routers/manual_trading.py's own `paper`
     local), not by trading_mode alone: Test always simulates; Live
     simulates too as long as Paper Trading stays on, and only goes
     real once it's switched off. Either way, a simulated order still
     runs execution_engine.py's real broker-selection + price-
     deviation-guard pipeline (_execute_broker_order(..., paper=True))
     — it's diverted at the very last step, not skipped — so a trader
     can rehearse the full order flow, including its real checks,
     with zero execution risk before ever going properly live.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.platform_setting import PlatformSetting, TRADING_PAPER_ENFORCED_KEY
from app.models.trade import ManualTradingSettings, Trade, TradeDirection, TradeStatus


async def get_master_paper_enforced(db: AsyncSession) -> bool:
    """The Super Admin platform-wide kill-switch — see
    TRADING_PAPER_ENFORCED_KEY's own comment. Defaults to False (no
    override) when never explicitly set, same shape as
    payments.py::get_payments_mode's own default. Moved here (out of
    routers/manual_trading.py, which still owns the GET/PATCH
    /master-mode endpoints and the actual write) so execution_engine.py
    — a service, not a router — can read the same override for BOT
    trades too, by direct request ("do the same ... paper trading for
    bot trading ... with a test/paper trading toggle") without a
    service importing from a router (backwards layering)."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == TRADING_PAPER_ENFORCED_KEY)
    )).scalar_one_or_none()
    return bool(row and row.value == "true")


@dataclass
class EffectiveRiskLimits:
    risk_per_trade: float
    max_daily_trades: int
    max_concurrent_trades: int
    max_portfolio_exposure: float
    min_rr_ratio: float


def effective_limits(settings_row: Optional[ManualTradingSettings]) -> EffectiveRiskLimits:
    """settings_row is None only for a brand-new user with no row yet
    (same as use_global_defaults=True would give)."""
    platform = get_settings()
    if settings_row is None or settings_row.use_global_defaults:
        return EffectiveRiskLimits(
            risk_per_trade=platform.DEFAULT_RISK_PERCENT,
            max_daily_trades=platform.MAX_DAILY_TRADES,
            max_concurrent_trades=5,   # no global equivalent exists in config.py; a sane fixed default
            max_portfolio_exposure=platform.MAX_PORTFOLIO_EXPOSURE,
            min_rr_ratio=platform.DEFAULT_RR_RATIO,
        )
    return EffectiveRiskLimits(
        risk_per_trade=settings_row.risk_per_trade,
        max_daily_trades=settings_row.max_daily_trades,
        max_concurrent_trades=settings_row.max_concurrent_trades,
        max_portfolio_exposure=settings_row.max_portfolio_exposure,
        min_rr_ratio=settings_row.min_rr_ratio,
    )


@dataclass
class RiskCheckResult:
    allowed: bool
    reason: str = ""


async def check_manual_trade_risk(
    db: AsyncSession, user_id, limits: EffectiveRiskLimits,
    risk_percent: float, reward_risk_ratio: float,
) -> RiskCheckResult:
    """Same shape of check bots.py/RiskPage.tsx already display (daily
    cap, concurrent cap) plus the two a manual order can violate that a
    pre-configured bot signal never would: risking more than the
    trader's own per-trade cap, and a reward:risk ratio worse than
    their minimum."""
    if risk_percent > limits.risk_per_trade:
        return RiskCheckResult(False, f"Risking {risk_percent:.2f}% exceeds your {limits.risk_per_trade:.2f}% per-trade cap.")
    if reward_risk_ratio < limits.min_rr_ratio:
        return RiskCheckResult(False, f"Reward:risk of {reward_risk_ratio:.2f} is below your {limits.min_rr_ratio:.2f} minimum.")

    # Naive UTC, not datetime.now(timezone.utc) — Trade.created_at is a
    # plain DateTime column (no timezone=True), storing naive UTC via
    # its own default=datetime.utcnow. Comparing it against a
    # timezone-aware value here made asyncpg reject the query outright
    # ("can't subtract offset-naive and offset-aware datetimes") —
    # confirmed directly against production logs and a live synthetic
    # order, not just by inspection: every manual order past the R:R
    # check 500'd on this exact line.
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    # CANCELLED/ERROR excluded — a more serious sibling of the same bug
    # reported against the dashboard's own "Today's Trades" count ("if
    # a trade order is cancelled - why is it still showing up ... as a
    # pending or executed order"): counting them here didn't just
    # mis-display a number, it could genuinely lock a trader out of
    # placing any more REAL trades for the rest of the day after
    # cancelling a few orders earlier — a cancelled/errored order was
    # never an actual trade taken, so it shouldn't count against this
    # cap any more than it should count toward the dashboard's total.
    today_count = (await db.execute(
        select(func.count(Trade.id)).where(
            Trade.user_id == user_id, Trade.strategy_type == "manual", Trade.created_at >= today_start,
            Trade.status.notin_([TradeStatus.CANCELLED, TradeStatus.ERROR]),
        )
    )).scalar() or 0
    if today_count >= limits.max_daily_trades:
        return RiskCheckResult(False, f"Daily manual-trade cap reached ({limits.max_daily_trades}).")

    concurrent_count = (await db.execute(
        select(func.count(Trade.id)).where(
            Trade.user_id == user_id, Trade.strategy_type == "manual",
            Trade.status.in_([TradeStatus.PENDING, TradeStatus.ACTIVE]),
        )
    )).scalar() or 0
    if concurrent_count >= limits.max_concurrent_trades:
        return RiskCheckResult(False, f"Concurrent manual-trade cap reached ({limits.max_concurrent_trades}).")

    open_exposure = (await db.execute(
        select(func.sum(Trade.risk_percent)).where(
            Trade.user_id == user_id, Trade.status.in_([TradeStatus.PENDING, TradeStatus.ACTIVE]),
        )
    )).scalar() or 0.0
    if open_exposure + risk_percent > limits.max_portfolio_exposure:
        return RiskCheckResult(
            False,
            f"This trade would bring open risk to {open_exposure + risk_percent:.2f}%, "
            f"over your {limits.max_portfolio_exposure:.2f}% portfolio cap.",
        )

    return RiskCheckResult(True)


def compute_lot_size(account_equity: float, risk_percent: float, entry_price: float, stop_loss: float) -> float:
    """Position size that risks exactly risk_percent of equity between
    entry and stop — the same fixed-fractional sizing the rest of this
    codebase uses (Monte Carlo, risk-of-ruin), not a novel formula."""
    risk_amount = account_equity * (risk_percent / 100)
    per_unit_risk = abs(entry_price - stop_loss)
    if per_unit_risk <= 0:
        raise ValueError("stop_loss must differ from entry_price")
    return round(risk_amount / per_unit_risk, 6)


def compute_r_multiple(
    entry_price: float, exit_price: float, stop_loss: float, direction: TradeDirection,
) -> Optional[float]:
    """How many multiples of the ORIGINAL risk (entry-to-stop distance)
    this trade's exit represents — the standard R-multiple, same sign
    convention journal_reviewer.py's own _r_multiple already uses for a
    manually-logged trade. Found missing during a critical review of
    trading calculations: Trade.r_multiple was NEVER assigned anywhere
    in the backend (confirmed via a full-codebase search for
    `.r_multiple =`) despite being read in bots.py's /performance
    (average_r) and dashboard.py's /performance (average_r_multiple) —
    both of those numbers were silently 0.0 for every bot/trader,
    always, regardless of real trade history, since the
    `r_multiple is not None` filter they apply excluded every row.
    Wired into every real close site (manual_trading.py's partial_close
    100%-case and cancel_order's ACTIVE fallback-to-close, plus
    position_monitor.py's own SL/TP auto-close) so this is finally a
    real number. Returns None (not 0.0) when risk_per_unit is 0 —
    entry_price == stop_loss should never happen for a trade actually
    opened through this app (compute_lot_size itself refuses that
    combination), but an older or manually-edited row could still hit
    it, and a genuine 0R (breakeven) exit is a real, different value
    that shouldn't be conflated with "couldn't compute"."""
    risk_per_unit = abs(entry_price - stop_loss)
    if risk_per_unit == 0:
        return None
    sign = 1 if direction == TradeDirection.LONG else -1
    return sign * (exit_price - entry_price) / risk_per_unit
