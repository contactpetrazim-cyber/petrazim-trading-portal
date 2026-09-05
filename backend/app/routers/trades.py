
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.trade import Trade, TradeLog, TradeStatus, TradeDirection
from app.models.user import User, UserRole
from app.core.access_gate import require_active_access
from app.schemas import TradeCreate, TradeResponse, TradeApproval
from app.services.execution_engine import ExecutionEngine
from app.services.live_price import get_crypto_price
import structlog

router = APIRouter(prefix="/trades", tags=["trades"])
logger = structlog.get_logger()
engine = ExecutionEngine()

# Same principle as bots.py/roster.py: Admin/Super Admin see every
# trade, everyone else only their own (a trade's owner is the Trader
# who owns the bot that placed it — set once, at creation time, in
# execution_engine.py::_persist_trade).
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


def _scope_to_owner(query, user: User):
    if user.role not in STAFF_ROLES:
        query = query.where(Trade.user_id == user.id)
    return query


# A manual-trading order's bot_id is always "manual_{user_id}" (set in
# routers/manual_trading.py::place_order) — every other bot_id belongs
# to a real trading bot. This is the one place that distinction is
# turned into a query filter, shared by list_trades and
# analytics_summary, so "bots vs Manual" reads the same way everywhere
# — by direct request ("all visuals or analytics should be
# differentiated by a toggle bots vs Manual trades").
def _apply_source_filter(query, source: Optional[str]):
    if not source or source.lower() == "all":
        return query
    src = source.lower()
    if src == "manual":
        return query.where(Trade.bot_id.like("manual\\_%", escape="\\"))
    if src == "bots":
        return query.where(~Trade.bot_id.like("manual\\_%", escape="\\"))
    raise HTTPException(status_code=400, detail="Invalid source — expected one of 'all', 'bots', 'manual'")


async def _enrich_live_pnl(trades: List[Trade]) -> None:
    """Mutates each ACTIVE trade's unrealized_pnl in place with a REAL
    live-computed value (never committed — this is a read-time
    enrichment, not a write) — by direct bug report ("the order should
    show as an existing trade with live PnL that can be seen or
    tracked ... I can't currently do that"). The stored column
    defaults to 0.0 and nothing was ever writing to it; scoped
    honestly to crypto symbols get_crypto_price can actually resolve
    (same free-tier limitation as the quick-price lookup) — a forex/
    metals trade's unrealized_pnl stays whatever was last stored
    rather than a fabricated number."""
    active = [t for t in trades if t.status == TradeStatus.ACTIVE and t.entry_price]
    if not active:
        return
    symbols = list({t.symbol for t in active})
    prices = await asyncio.gather(*(get_crypto_price(s) for s in symbols))
    price_by_symbol = dict(zip(symbols, prices))
    for t in active:
        price = price_by_symbol.get(t.symbol)
        if price is None:
            continue
        sign = 1 if t.direction == TradeDirection.LONG else -1
        t.unrealized_pnl = round(t.lot_size * (price - t.entry_price) * sign, 2)


async def _get_owned_trade(trade_id: str, user: User, db: AsyncSession) -> Trade:
    query = select(Trade).where(Trade.trade_id == trade_id)
    result = await db.execute(query)
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if trade.user_id != user.id and user.role not in STAFF_ROLES:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade


@router.get("/", response_model=List[TradeResponse])
async def list_trades(
    status: Optional[str] = Query(None, description="Filter by status"),
    bot_id: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="'all' (default), 'bots', or 'manual'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """List the caller's own trades with filtering (Admin/Super Admin see all)."""
    query = _scope_to_owner(select(Trade), user)
    query = _apply_source_filter(query, source)

    # Real bug, found while wiring TradeSpecsPanel's "?status=active"
    # call: comparing an Enum column directly to a raw query-param
    # string (Trade.status == "active") binds the literal string
    # 'active', but this column's Enum type persists by member NAME
    # ("ACTIVE"), not value — so the old code silently matched zero
    # rows instead of erroring, for every status/direction filter ever
    # passed here. Converting to the actual enum member first (case-
    # insensitively) is what every other status comparison in this
    # router already does correctly (see active_trades() below).
    if status:
        try:
            query = query.where(Trade.status == TradeStatus(status.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status '{status}' — expected one of {[s.value for s in TradeStatus]}")
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if symbol:
        query = query.where(Trade.symbol == symbol)
    if direction:
        try:
            query = query.where(Trade.direction == TradeDirection(direction.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid direction '{direction}' — expected one of {[d.value for d in TradeDirection]}")

    query = query.order_by(Trade.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()
    await _enrich_live_pnl(trades)

    return trades

@router.get("/pending-approvals", response_model=List[TradeResponse])
async def pending_approvals(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get all trades awaiting manual approval (Human-in-the-Loop)."""
    query = _scope_to_owner(select(Trade), user).where(
        and_(
            Trade.status == TradeStatus.PENDING,
            Trade.requires_approval == True
        )
    ).order_by(Trade.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()

@router.post("/approve", response_model=Dict)
async def approve_trade(
    approval: TradeApproval,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Approve or reject a pending trade — must be the caller's own trade (or Admin/Super Admin)."""
    await _get_owned_trade(approval.trade_id, user, db)
    result = await engine.approve_trade(
        approval.trade_id,
        approval.approved,
        approval.notes or "",
        db
    )
    return result

@router.get("/active", response_model=List[TradeResponse])
async def active_trades(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get currently active (open) trades."""
    query = _scope_to_owner(select(Trade), user).where(
        Trade.status == TradeStatus.ACTIVE
    ).order_by(Trade.created_at.desc())
    result = await db.execute(query)
    trades = result.scalars().all()
    await _enrich_live_pnl(trades)
    return trades

@router.get("/stats/today")
async def today_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get today's trading statistics."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    query = _scope_to_owner(select(Trade), user).where(Trade.created_at >= today_start)
    result = await db.execute(query)
    trades = result.scalars().all()

    total = len(trades)
    wins = len([t for t in trades if t.realized_pnl and t.realized_pnl > 0])
    losses = len([t for t in trades if t.realized_pnl and t.realized_pnl < 0])
    pnl = sum(t.realized_pnl or 0 for t in trades)

    return {
        "total_trades": total,
        "winning_trades": wins,
        "losing_trades": losses,
        "win_rate": round(wins / total * 100, 2) if total > 0 else 0,
        "net_pnl": round(pnl, 2),
        "active_trades": len([t for t in trades if t.status == TradeStatus.ACTIVE])
    }

@router.get("/analytics/summary")
async def analytics_summary(
    bot_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="'all' (default), 'bots', or 'manual'"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """
    Real aggregates over the caller's own CLOSED trades — daily and
    monthly realized PnL, performance by symbol, and the standard
    trade-analysis figures (avg win/loss, best/worst, win rate, profit
    factor). Feeds InsightsPage's analytics section.

    Deliberately does NOT include a running account balance/equity
    column the way a real broker statement would: this app has no
    persisted account-balance concept (account_equity on a manual
    order is a per-trade sizing input, not a tracked running balance),
    so showing one would mean fabricating a number this app can't
    actually back. Daily Summary reports realized PnL per day instead
    — real, not invented.
    """
    query = _scope_to_owner(select(Trade), user).where(Trade.status == TradeStatus.CLOSED)
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    query = _apply_source_filter(query, source)
    result = await db.execute(query)
    trades = result.scalars().all()

    daily: Dict[str, Dict] = {}
    monthly: Dict[str, float] = {}
    by_symbol: Dict[str, Dict] = {}
    wins: List[float] = []
    losses: List[float] = []

    for t in trades:
        pnl = t.realized_pnl or 0.0
        ts = t.exit_timestamp or t.created_at
        if ts is None:
            continue
        day_key = ts.strftime("%Y-%m-%d")
        month_key = ts.strftime("%Y-%m")

        d = daily.setdefault(day_key, {"date": day_key, "trades": 0, "realized_pnl": 0.0})
        d["trades"] += 1
        d["realized_pnl"] += pnl

        monthly[month_key] = monthly.get(month_key, 0.0) + pnl

        s = by_symbol.setdefault(t.symbol, {"symbol": t.symbol, "trades": 0, "realized_pnl": 0.0})
        s["trades"] += 1
        s["realized_pnl"] += pnl

        if pnl > 0:
            wins.append(pnl)
        elif pnl < 0:
            losses.append(pnl)

    total = len(trades)
    gross_loss = abs(sum(losses))

    for d in daily.values():
        d["realized_pnl"] = round(d["realized_pnl"], 2)
    for s in by_symbol.values():
        s["realized_pnl"] = round(s["realized_pnl"], 2)

    return {
        "total_closed_trades": total,
        "daily_summary": sorted(daily.values(), key=lambda r: r["date"], reverse=True),
        "monthly_pnl": [
            {"month": k, "realized_pnl": round(v, 2)}
            for k, v in sorted(monthly.items(), reverse=True)
        ],
        "by_symbol": sorted(by_symbol.values(), key=lambda r: r["realized_pnl"], reverse=True),
        "trade_analysis": {
            "win_rate": round(len(wins) / total * 100, 2) if total else 0.0,
            "avg_win": round(sum(wins) / len(wins), 2) if wins else 0.0,
            "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0.0,
            "best_trade": round(max(wins), 2) if wins else 0.0,
            "worst_trade": round(min(losses), 2) if losses else 0.0,
            # None (not Infinity — invalid JSON) when there are no
            # losses yet to divide by; the frontend shows "—" for that.
            "profit_factor": round(sum(wins) / gross_loss, 2) if gross_loss > 0 else None,
        },
    }


class TradeDetailRow(BaseModel):
    trade_id: str
    symbol: str
    bot_id: str
    bot_name: Optional[str] = None
    strategy_type: str
    direction: str
    entry_timestamp: Optional[datetime] = None
    exit_timestamp: Optional[datetime] = None
    entry_price: Optional[float] = None
    initial_stop_loss: Optional[float] = None
    stop_loss: float
    initial_take_profit_1: Optional[float] = None
    take_profit_1: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    realized_pnl: float
    risk_amount: float
    lot_size: float
    exit_type: Optional[str] = None
    # How many SL/TP edits (routers/manual_trading.py::modify_targets)
    # this specific trade has real TradeLog rows for.
    modification_count: int
    # True only when initial_stop_loss is known AND differs from the
    # current stop_loss — i.e. the trader actually moved it after
    # opening, not just that a modify call happened to set it back to
    # the same value.
    sl_shifted: bool
    # How many of TP1/2/3 are CURRENTLY set — an approximation of "how
    # many targets this trade used," since only TP1 has an immutable
    # initial_* snapshot (see Trade.initial_take_profit_1's own
    # comment); a target added or removed after open would shift this,
    # same honest limitation sl_shifted's own initial_stop_loss avoids
    # only for the one field that got a snapshot column.
    tp_count: int


@router.get("/analytics/detail", response_model=List[TradeDetailRow])
async def analytics_detail(
    bot_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="'all' (default), 'bots', or 'manual'"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """
    One enriched row per CLOSED trade — the real dataset behind the
    advanced analytics suite (net P&L by session/hour/day-calendar/
    strategy, a risk:reward map, an SL map, drawdown-over-time, trade-
    by-trade equity, multi-TP vs single-TP, SL-shifted vs not), by
    direct request ("develop useful metrics that will help understand
    the trading edge ... TP or SL changes per trade over time ...
    effects of multiple TP trades vs single TP ... dynamic SL
    management shift vs trades without shifting SL"). Deliberately one
    endpoint, not one per chart: every one of those views is a
    different slice of the SAME real closed-trade rows, computed
    client-side from real timestamps/prices/PnL rather than fabricated
    per chart.
    """
    query = _scope_to_owner(select(Trade), user).where(Trade.status == TradeStatus.CLOSED)
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    query = _apply_source_filter(query, source)
    result = await db.execute(query)
    trades = result.scalars().all()
    if not trades:
        return []

    trade_ids = [t.trade_id for t in trades]
    mod_result = await db.execute(
        select(TradeLog.trade_id, func.count(TradeLog.id))
        .where(TradeLog.trade_id.in_(trade_ids), TradeLog.event_type.in_(["sl_update", "tp_update"]))
        .group_by(TradeLog.trade_id)
    )
    mod_counts: Dict[str, int] = dict(mod_result.all())

    rows = []
    for t in trades:
        tp_count = sum(1 for tp in (t.take_profit_1, t.take_profit_2, t.take_profit_3) if tp is not None)
        sl_shifted = t.initial_stop_loss is not None and t.stop_loss != t.initial_stop_loss
        rows.append(TradeDetailRow(
            trade_id=t.trade_id, symbol=t.symbol, bot_id=t.bot_id, bot_name=t.bot_name,
            strategy_type=t.strategy_type, direction=t.direction.value,
            entry_timestamp=t.entry_timestamp, exit_timestamp=t.exit_timestamp,
            entry_price=t.entry_price, initial_stop_loss=t.initial_stop_loss, stop_loss=t.stop_loss,
            initial_take_profit_1=t.initial_take_profit_1, take_profit_1=t.take_profit_1,
            take_profit_2=t.take_profit_2, take_profit_3=t.take_profit_3,
            realized_pnl=round(t.realized_pnl or 0.0, 2), risk_amount=t.risk_amount, lot_size=t.lot_size,
            exit_type=t.exit_type.value if t.exit_type else None,
            modification_count=mod_counts.get(t.trade_id, 0),
            sl_shifted=sl_shifted, tp_count=max(tp_count, 1),
        ))
    rows.sort(key=lambda r: r.exit_timestamp or r.entry_timestamp or datetime.min)
    return rows


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(trade_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get detailed trade information."""
    trade = await _get_owned_trade(trade_id, user, db)
    await _enrich_live_pnl([trade])
    return trade

@router.get("/{trade_id}/logs")
async def get_trade_logs(trade_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get execution logs for a trade."""
    await _get_owned_trade(trade_id, user, db)
    query = select(TradeLog).where(TradeLog.trade_id == trade_id).order_by(TradeLog.timestamp.desc())
    result = await db.execute(query)
    return result.scalars().all()
