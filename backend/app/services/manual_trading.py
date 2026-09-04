"""
Manual Trading — risk checks + order creation
=================================================

Manual orders go through the exact same risk-cap and execution path
bot trades use, by direct instruction — not a separate, looser set of
rules. The only manual-specific pieces are the two toggles:

  1. Global vs. Manual risk settings (ManualTradingSettings.
     use_global_defaults) — which numbers the checks below are
     measured against, not a different kind of check.
  2. Test vs. Live (ManualTradingSettings.trading_mode) — Test never
     calls execution_engine.py's real broker path; it simulates an
     immediate fill and tags the Trade row is_test=True, so a trader
     can rehearse the full order flow with zero execution risk before
     ever flipping to Live.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.trade import ManualTradingSettings, Trade, TradeStatus


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

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = (await db.execute(
        select(func.count(Trade.id)).where(
            Trade.user_id == user_id, Trade.strategy_type == "manual", Trade.created_at >= today_start,
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
