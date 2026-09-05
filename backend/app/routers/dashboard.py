
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import Dict, List
from app.database import get_db
from app.models.trade import Trade, TradeStatus
from app.models.bot import BotConfig, BotStatus
from app.models.user import User, UserRole
from app.core.access_gate import require_active_access
from app.schemas import DashboardStats, PerformanceSummary
import structlog

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = structlog.get_logger()

# Same principle as trades.py/bots.py: Admin/Super Admin see the whole
# platform's numbers, everyone else only their own.
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


def _scope_trades(query, user: User):
    if user.role not in STAFF_ROLES:
        query = query.where(Trade.user_id == user.id)
    return query


def _scope_bots(query, user: User):
    if user.role not in STAFF_ROLES:
        query = query.where(BotConfig.user_id == user.id)
    return query


@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get real-time dashboard statistics for the caller (Admin/Super Admin see the whole platform)."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's trades
    trades_query = _scope_trades(select(Trade), user).where(Trade.created_at >= today_start)
    result = await db.execute(trades_query)
    today_trades = result.scalars().all()

    total = len(today_trades)
    wins = len([t for t in today_trades if t.realized_pnl and t.realized_pnl > 0])
    pnl = sum(t.realized_pnl or 0 for t in today_trades)

    # Intraday drawdown — real, computed from today's own closed trades'
    # running P&L, not the "0.0, calculate from equity tracking" stub
    # this used to be. No account-equity baseline exists on User to
    # express this as a %, so it's the $ decline from today's own
    # running-P&L high point, in chronological (exit) order — the same
    # peak-to-current-trough definition max_drawdown_pct already uses
    # elsewhere in this app, just in dollars instead of percent since
    # that's the honest unit available here.
    closed_today = sorted(
        (t for t in today_trades if t.status == TradeStatus.CLOSED),
        key=lambda t: t.exit_timestamp or t.created_at,
    )
    running, peak, drawdown = 0.0, 0.0, 0.0
    for t in closed_today:
        running += t.realized_pnl or 0.0
        peak = max(peak, running)
        drawdown = max(drawdown, peak - running)

    # Active trades
    active_query = _scope_trades(select(Trade), user).where(Trade.status == TradeStatus.ACTIVE)
    result = await db.execute(active_query)
    active = len(result.scalars().all())

    # Pending approvals
    pending_query = _scope_trades(select(Trade), user).where(
        and_(Trade.status == TradeStatus.PENDING, Trade.requires_approval == True)
    )
    result = await db.execute(pending_query)
    pending = len(result.scalars().all())

    # Active bots
    bots_query = _scope_bots(select(BotConfig), user).where(BotConfig.status == BotStatus.ACTIVE)
    result = await db.execute(bots_query)
    active_bots = len(result.scalars().all())

    return DashboardStats(
        total_trades_today=total,
        active_trades=active,
        pending_approvals=pending,
        daily_pnl=round(pnl, 2),
        win_rate_today=round(wins / total * 100, 2) if total > 0 else 0.0,
        current_drawdown=round(drawdown, 2),
        active_bots=active_bots
    )

@router.get("/performance")
async def performance_summary(
    period: str = "7d",  # 1d, 7d, 30d, 90d
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
) -> List[PerformanceSummary]:
    """Get performance summary for specified period."""
    # Map period to timedelta
    period_map = {
        "1d": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90)
    }

    delta = period_map.get(period, timedelta(days=7))
    start_date = datetime.utcnow() - delta

    query = _scope_trades(select(Trade), user).where(
        and_(
            Trade.created_at >= start_date,
            Trade.status == TradeStatus.CLOSED
        )
    )
    result = await db.execute(query)
    trades = result.scalars().all()

    if not trades:
        return []

    total = len(trades)
    wins = [t for t in trades if t.realized_pnl > 0]
    losses = [t for t in trades if t.realized_pnl < 0]

    gross_profit = sum(t.realized_pnl for t in wins)
    gross_loss = abs(sum(t.realized_pnl for t in losses))

    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    r_multiples = [t.r_multiple for t in trades if t.r_multiple is not None]
    avg_r = sum(r_multiples) / len(r_multiples) if r_multiples else 0

    # Max drawdown — was hardcoded 0.0 ("Calculate properly"), a real,
    # confirmed gap (Analytics/Trader-analytics fix, by direct report).
    # Same peak-to-trough-of-running-equity definition as dashboard_stats'
    # own intraday $ drawdown above, walked in chronological (exit) order
    # over this period's own closed trades, expressed as a % against the
    # same 10000.0 starting-equity placeholder equity_curve() already
    # uses — so this number is consistent with what the equity curve
    # chart actually plots, not a second invented baseline.
    STARTING_EQUITY = 10000.0
    chronological = sorted(trades, key=lambda t: t.exit_timestamp or t.created_at)
    equity = STARTING_EQUITY
    peak = STARTING_EQUITY
    max_dd_pct = 0.0
    for t in chronological:
        equity += t.realized_pnl or 0.0
        peak = max(peak, equity)
        if peak > 0:
            max_dd_pct = max(max_dd_pct, (peak - equity) / peak * 100)

    return [PerformanceSummary(
        period=period,
        total_trades=total,
        win_rate=round(len(wins) / total * 100, 2),
        profit_factor=round(profit_factor, 2),
        average_r_multiple=round(avg_r, 2),
        max_drawdown_pct=round(max_dd_pct, 2),
        net_pnl=round(sum(t.realized_pnl for t in trades), 2)
    )]

@router.get("/signals/preview")
async def signal_preview(user: User = Depends(require_active_access)) -> List[Dict]:
    """Get current signal previews from all active bots."""
    # In production: run bot analysis on current market data
    # Return preview signals for dashboard display
    return []

@router.get("/equity-curve")
async def equity_curve(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Get equity curve data for charting."""
    start_date = datetime.utcnow() - timedelta(days=days)

    query = _scope_trades(select(Trade), user).where(
        and_(
            Trade.created_at >= start_date,
            Trade.status.in_([TradeStatus.CLOSED, TradeStatus.ACTIVE])
        )
    ).order_by(Trade.created_at)

    result = await db.execute(query)
    trades = result.scalars().all()

    # Build equity curve points
    equity = 10000.0  # Starting equity placeholder
    curve = []

    for trade in trades:
        if trade.status == TradeStatus.CLOSED and trade.realized_pnl:
            equity += trade.realized_pnl
            curve.append({
                "timestamp": trade.exit_timestamp.isoformat() if trade.exit_timestamp else trade.created_at.isoformat(),
                "equity": round(equity, 2),
                "trade_id": trade.trade_id,
                "pnl": trade.realized_pnl
            })

    return curve
