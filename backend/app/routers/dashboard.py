
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
from app.schemas import DashboardStats, PerformanceSummary, TodayTradeBreakdown, TradeBreakdown
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


# "week"/"month" are rolling 7d/30d windows ending now, matching the
# same convention /performance already uses for its own 1d/7d/30d/90d
# period param — not calendar week/month, so the toggle always shows a
# consistent trailing window rather than resetting mid-week.
def _period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _breakdown_counts(all_trades: list) -> dict:
    """Shared Pending/Executed/Cancelled/Won/Loss/Break-even bucket
    counts, used by both dashboard_stats' own today_breakdown and the
    Today/Week/Month-toggle-able trade_breakdown endpoint below, so the
    bucket definitions can't drift between the two."""
    closed = [t for t in all_trades if t.status == TradeStatus.CLOSED]
    return dict(
        pending=len([t for t in all_trades if t.status == TradeStatus.PENDING]),
        executed=len([t for t in all_trades if t.status == TradeStatus.ACTIVE]),
        cancelled=len([t for t in all_trades if t.status == TradeStatus.CANCELLED]),
        won=len([t for t in closed if (t.realized_pnl or 0) > 0]),
        loss=len([t for t in closed if (t.realized_pnl or 0) < 0]),
        breakeven=len([t for t in closed if (t.realized_pnl or 0) == 0]),
    )


@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get real-time dashboard statistics for the caller (Admin/Super Admin see the whole platform)."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # ALL of today's trades, every status — the breakdown below needs
    # cancelled/errored ones too (shown as their own bucket), while
    # total_trades_today/win_rate_today still only ever reflect REAL
    # trades (see the exclusion right after this query) — by direct
    # bug report ("if a trade order is cancelled - why is it still
    # showing up on the traders dashboard as a pending or executed
    # order") and its direct follow-up request ("can you provide more
    # clarity / Pending trades Vs Executed Trades Vs Canceled Vs Loss
    # Vs Won Vs BreakEven"). PR #55 filtered CANCELLED/ERROR out at
    # this same query directly, before this breakdown existed — that
    # would have hidden them from the `cancelled` bucket below too, so
    # this stays unfiltered here and the exclusion is applied in
    # Python instead, right below, for just the headline pair.
    trades_query = _scope_trades(select(Trade), user).where(Trade.created_at >= today_start)
    result = await db.execute(trades_query)
    all_today_trades = result.scalars().all()

    # The headline total/win-rate: cancelled/errored orders were never
    # actually a trade taken, so they're excluded here exactly as
    # before — only the breakdown below surfaces them, as their own
    # separate bucket rather than polluting this pair.
    today_trades = [t for t in all_today_trades if t.status not in (TradeStatus.CANCELLED, TradeStatus.ERROR)]
    total = len(today_trades)
    wins = len([t for t in today_trades if t.realized_pnl and t.realized_pnl > 0])
    pnl = sum(t.realized_pnl or 0 for t in today_trades)

    closed_trades_today = [t for t in all_today_trades if t.status == TradeStatus.CLOSED]
    today_breakdown = TodayTradeBreakdown(**_breakdown_counts(all_today_trades))

    # Intraday drawdown — real, computed from today's own closed trades'
    # running P&L, not the "0.0, calculate from equity tracking" stub
    # this used to be. No account-equity baseline exists on User to
    # express this as a %, so it's the $ decline from today's own
    # running-P&L high point, in chronological (exit) order — the same
    # peak-to-current-trough definition max_drawdown_pct already uses
    # elsewhere in this app, just in dollars instead of percent since
    # that's the honest unit available here.
    closed_today = sorted(closed_trades_today, key=lambda t: t.exit_timestamp or t.created_at)
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
        active_bots=active_bots,
        today_breakdown=today_breakdown,
    )

@router.get("/trade-breakdown", response_model=TradeBreakdown)
async def trade_breakdown(
    period: str = "today",  # "today" | "week" | "month"
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """The Today's Trades breakdown card's Pending/Executed/Cancelled/
    Won/Loss/Break-even pills, widened to a Today/Week/Month toggle —
    by direct request ("can we include Today, Week, Month toggle in the
    dashboard ... instead of just Today"). A separate endpoint from
    /stats (whose own today_breakdown stays exactly as before, always
    "today") so nothing about the existing headline stat card changes
    — the frontend toggle calls this one for "week"/"month" and can
    keep reusing /stats' own today_breakdown for "today" without an
    extra round trip.
    """
    if period not in ("today", "week", "month"):
        period = "today"
    start = _period_start(period)

    # Same "all statuses, exclude cancelled/errored only for the
    # headline total/win-rate pair, not from the breakdown itself" split
    # as dashboard_stats above.
    trades_query = _scope_trades(select(Trade), user).where(Trade.created_at >= start)
    result = await db.execute(trades_query)
    all_trades = result.scalars().all()
    real_trades = [t for t in all_trades if t.status not in (TradeStatus.CANCELLED, TradeStatus.ERROR)]
    total = len(real_trades)
    wins = len([t for t in real_trades if t.realized_pnl and t.realized_pnl > 0])
    pnl = sum(t.realized_pnl or 0 for t in real_trades)

    return TradeBreakdown(
        period=period,
        total=total,
        win_rate=round(wins / total * 100, 2) if total > 0 else 0.0,
        pnl=round(pnl, 2),
        **_breakdown_counts(all_trades),
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

    # Filter by when a trade CLOSED, not when it was opened — a trade
    # opened 40 days ago but closed yesterday belongs in "1D"/"7D", not
    # excluded from every window shorter than its own lifetime. This was
    # the actual cause of "performance metrics not working" (1D/7D/30D/90D
    # all showing empty/wrong): every other closed-trades read here
    # (max-drawdown's chronological sort just below, equity_curve()) uses
    # exit_timestamp for exactly this reason. Falls back to created_at
    # only for the rare pre-migration row with no exit_timestamp set.
    close_time = func.coalesce(Trade.exit_timestamp, Trade.created_at)
    query = _scope_trades(select(Trade), user).where(
        and_(
            close_time >= start_date,
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

    # Same close-time fix as /performance above: a still-open trade has
    # no exit_timestamp yet, so coalesce correctly falls back to
    # created_at for it while using the real close time for closed ones.
    close_time = func.coalesce(Trade.exit_timestamp, Trade.created_at)
    query = _scope_trades(select(Trade), user).where(
        and_(
            close_time >= start_date,
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
