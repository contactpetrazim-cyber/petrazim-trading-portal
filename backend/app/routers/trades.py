
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.config import get_settings
from app.database import get_db
from app.models.trade import Trade, TradeLog, TradeStatus, TradeDirection
from app.models.user import User, UserRole
from app.core.auth import get_current_user
from app.core.access_gate import require_active_access, has_active_access, _raise_if_access_expired
from app.schemas import TradeCreate, TradeResponse, TradeApproval, TradeArchiveUpdate, TradeDeleteUpdate
from app.services.execution_engine import ExecutionEngine
from app.services.live_price import get_crypto_price
import structlog

router = APIRouter(prefix="/trades", tags=["trades"])
logger = structlog.get_logger()
engine = ExecutionEngine()
settings_module = get_settings()

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


async def _visible_trades(trades: List[Trade], db: AsyncSession, user: User) -> List[Trade]:
    """Paper/Test trades (is_test=True) stay visible regardless of
    access status — placing one already works this way
    (manual_trading.py's own `paper` gate: "a simulated order never
    reaches a real broker ... stays open regardless of access status"),
    so watching one afterward has to as well, by direct bug report
    ("place a paper order using the order form ... I would like to
    execute trades on paper and watch dynamically the outcome" — every
    read endpoint below was unconditionally gating on active access
    first, so a trader with no active pass could place a free paper
    trade and then immediately hit a 402 trying to see it). Only a
    real trade's history is hidden once access has actually lapsed."""
    if await has_active_access(db, user):
        return trades
    return [t for t in trades if t.is_test]


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
    # Test/Paper vs Live — by direct request ("add trade info from
    # recent trade active or closed (live Vs test) mode which is live
    # Vs paper trading mode"), the same filter now on both analytics
    # endpoints. None (default) = both.
    is_test: Optional[bool] = Query(None, description="None (default) = both; True = Test/Paper only; False = Live only"),
    # Trades page date filter — calendar + quick options (Today,
    # Previous 1D/3D/5D/7D/14D/28D), by direct request. Both ends of
    # Trade.created_at, inclusive — `date_to` is treated as the END of
    # that day (23:59:59.999999), not midnight, so picking a single
    # day in the calendar actually includes every trade placed on it
    # rather than silently excluding all but the first instant.
    date_from: Optional[datetime] = Query(None, description="Only trades created on/after this instant"),
    date_to: Optional[datetime] = Query(None, description="Only trades created on/before this instant"),
    # Powers the "Recent Trades" / "Archive Trades" card split on
    # TradesPage — by direct request ("create an option to move
    # individual trades to a new archive trades card"). Defaults to
    # False (archived trades hidden) so every existing caller of this
    # endpoint keeps seeing exactly what it saw before archiving
    # existed; the Archive Trades card is the one place that passes
    # archived=true explicitly.
    archived: bool = Query(False, description="False (default) hides archived trades, True shows only archived trades"),
    # Powers the new "Deleted Trades" card — same on/off shape as
    # `archived` above, by direct request ("a Delete card where all the
    # deleted trades are stored for future reference"). When True this
    # ignores `archived` entirely and returns is_deleted rows
    # regardless of their archived state (a trade can be deleted
    # straight from either Recent or Archive).
    deleted: bool = Query(False, description="False (default) hides deleted trades, True shows only deleted trades (ignores `archived`)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the caller's own trades with filtering (Admin/Super Admin see all).
    Not gated on active access at the dependency level any more — see
    _visible_trades above for why (a Paper Trading trader must be able
    to list their own free practice trades regardless)."""
    query = _scope_to_owner(select(Trade), user)
    if deleted:
        query = query.where(Trade.is_deleted == True)  # noqa: E712
    else:
        query = query.where(Trade.is_deleted == False, Trade.is_archived == archived)  # noqa: E712
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
    if is_test is not None:
        query = query.where(Trade.is_test == is_test)
    # Trade.created_at is a naive-UTC column (no timezone=True) — the
    # frontend sends a real ISO instant with a trailing "Z"
    # (timezone-aware), which FastAPI parses into a tz-aware datetime.
    # Comparing that directly against a naive column is exactly the
    # "can't subtract offset-naive and offset-aware datetimes" class of
    # bug already documented elsewhere in this codebase (position_monitor.py,
    # pending_order_monitor.py) — confirmed live here too, by a real 500
    # the instant this filter shipped. Strip tzinfo (the value is
    # already UTC either way) before comparing.
    if date_from:
        query = query.where(Trade.created_at >= date_from.replace(tzinfo=None))
    if date_to:
        query = query.where(Trade.created_at <= date_to.replace(tzinfo=None))

    query = query.order_by(Trade.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()
    await _enrich_live_pnl(trades)

    return await _visible_trades(trades, db, user)

@router.get("/pending-approvals", response_model=List[TradeResponse])
async def pending_approvals(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get all trades awaiting manual approval (Human-in-the-Loop)."""
    query = _scope_to_owner(select(Trade), user).where(
        and_(
            Trade.status == TradeStatus.PENDING,
            Trade.requires_approval == True,
            Trade.is_deleted == False,
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
async def active_trades(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get currently active (open) trades. Same access-gate exception
    as list_trades above — a Paper Trading position must stay visible
    regardless of access status."""
    query = _scope_to_owner(select(Trade), user).where(
        Trade.status == TradeStatus.ACTIVE, Trade.is_deleted == False,  # noqa: E712
    ).order_by(Trade.created_at.desc())
    result = await db.execute(query)
    trades = result.scalars().all()
    await _enrich_live_pnl(trades)
    return await _visible_trades(trades, db, user)

@router.get("/stats/today")
async def today_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get today's trading statistics."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # CANCELLED/ERROR excluded — same fix as dashboard.py's own
    # /dashboard/stats, by the same direct bug report ("if a trade
    # order is cancelled - why is it still showing up on the traders
    # dashboard as a pending or executed order"): an order that was
    # withdrawn before it ever became a real position was never
    # actually "a trade taken today".
    query = _scope_to_owner(select(Trade), user).where(
        Trade.created_at >= today_start,
        Trade.status.notin_([TradeStatus.CANCELLED, TradeStatus.ERROR]),
        Trade.is_deleted == False,  # noqa: E712
    )
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
    # Test/Paper vs Live filter — by direct request ("Include a toggle
    # for the trade analytics section that filters test Vs live mode
    # that is paper trading mode Vs live mode"). None (default) = both;
    # True = only Test/Paper trades; False = only real Live trades.
    is_test: Optional[bool] = Query(None),
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
    query = _scope_to_owner(select(Trade), user).where(
        Trade.status == TradeStatus.CLOSED, Trade.is_deleted == False,  # noqa: E712
    )
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if is_test is not None:
        query = query.where(Trade.is_test == is_test)
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
    is_test: Optional[bool] = Query(None, description="None (default) = both; True = Test/Paper only; False = Live only"),
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
    query = _scope_to_owner(select(Trade), user).where(
        Trade.status == TradeStatus.CLOSED, Trade.is_deleted == False,  # noqa: E712
    )
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if is_test is not None:
        query = query.where(Trade.is_test == is_test)
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


class EncroachmentRow(BaseModel):
    trade_id: str
    symbol: str
    direction: str
    outcome: str  # "win" | "loss" | "breakeven"
    realized_pnl: float
    # How far price moved AGAINST the position, as a % of the ORIGINAL
    # stop distance, before the trade closed — the core ask ("how much
    # of my SL area is used or encroached into during each trade").
    # 100% would mean price actually touched the stop; a winning trade
    # showing e.g. 25% here means it survived a real pullback to a
    # quarter of its stop distance before turning around.
    sl_encroachment_pct: float
    # The mirror question for TP: how far price moved IN FAVOR of the
    # position, as a % of the distance to TP1, before the trade
    # closed. A losing or breakeven trade with a HIGH number here came
    # close to target before reversing — a different lesson (exits/
    # trailing) than one that never got anywhere near it (entries/
    # timing).
    tp_encroachment_pct: Optional[float] = None


class WhatIfRow(BaseModel):
    tighten_pct: int  # 10, 25, 50, 75
    # Of the trades that actually WON, how many (and what %) had SL
    # encroachment at or past this tightened threshold — i.e. would
    # have been stopped out early instead of winning, had the stop
    # been this much tighter. Directly answers "can I afford to reduce
    # my usual SL by 25% or 50%."
    winners_would_be_stopped: int
    winners_total: int
    winners_would_be_stopped_pct: float


class EncroachmentResponse(BaseModel):
    rows: List[EncroachmentRow]
    avg_sl_encroachment_pct: float
    avg_tp_encroachment_pct: float
    what_if_tighter_sl: List[WhatIfRow]
    # Trades requested vs. ones actually analyzed — a forex/MT4 trade
    # or one with no candle data available is skipped, not silently
    # dropped without explanation.
    trades_requested: int
    trades_analyzed: int


_ENCROACHMENT_EXCHANGES = {"binance", "bybit", "bingx", "mexc", "okx", "kucoin"}


@router.get("/analytics/encroachment", response_model=EncroachmentResponse)
async def analytics_encroachment(
    bot_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="'all' (default), 'bots', or 'manual'"),
    is_test: Optional[bool] = Query(None, description="None (default) = both; True = Test/Paper only; False = Live only"),
    limit: int = Query(20, ge=1, le=30, description="Most recent closed trades to analyze (capped — each one is a real exchange API call)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Drawdown Encroachment — by direct request ("a metric that can
    help monitor specific trades drawdown encroachment ... how much of
    my SL area is used or encroached into during each trade ... can I
    afford to reduce my usual SL by 25% or 50% ... since from data
    compiled, price always seems to encroach up to 25%"). Computed
    from REAL 15M candles between each trade's own entry and exit —
    the same live-refetch approach as the Trade Snapshot endpoint
    above, not a stored/approximated figure.

    Capped at `limit` (max 30) most-recent closed trades and processed
    SEQUENTIALLY (not concurrently), both deliberately: each trade
    needs its own real exchange API call, and this session already hit
    a real Binance IP ban today from exactly this kind of request
    volume — see MarketDataIngestion's own comment and
    _snapshot_ingestion above, which this reuses for the same reason
    (one shared rate-limited ccxt client, not a fresh one per call).
    """
    query = _scope_to_owner(select(Trade), user).where(
        Trade.status == TradeStatus.CLOSED, Trade.is_deleted == False,  # noqa: E712
        Trade.entry_timestamp.isnot(None), Trade.exit_timestamp.isnot(None),
    )
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if is_test is not None:
        query = query.where(Trade.is_test == is_test)
    query = _apply_source_filter(query, source)
    query = query.order_by(Trade.exit_timestamp.desc()).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()

    rows: List[EncroachmentRow] = []
    for t in trades:
        exchange = (t.broker_name or "binance").lower()
        if exchange not in _ENCROACHMENT_EXCHANGES:
            continue
        if t.entry_price is None or t.stop_loss is None:
            continue
        sl_distance = abs(t.entry_price - t.stop_loss)
        if sl_distance <= 0:
            continue
        try:
            candles = await _snapshot_ingestion.fetch_historical_ccxt(
                exchange, t.symbol, "15m", limit=500, since=t.entry_timestamp,
            )
        except Exception as e:
            logger.warning("encroachment_fetch_failed", trade_id=t.trade_id, exchange=exchange, symbol=t.symbol, error=str(e))
            continue
        window = [c for c in candles if t.entry_timestamp <= c.timestamp <= t.exit_timestamp]
        if not window:
            continue

        is_long = t.direction.value == "long"
        worst_price = min(c.low for c in window) if is_long else max(c.high for c in window)
        best_price = max(c.high for c in window) if is_long else min(c.low for c in window)
        adverse = (t.entry_price - worst_price) if is_long else (worst_price - t.entry_price)
        favorable = (best_price - t.entry_price) if is_long else (t.entry_price - best_price)

        sl_pct = round(min(100.0, max(0.0, (adverse / sl_distance) * 100)), 1)
        tp_pct = None
        if t.take_profit_1 is not None:
            tp_distance = abs(t.take_profit_1 - t.entry_price)
            if tp_distance > 0:
                tp_pct = round(min(100.0, max(0.0, (favorable / tp_distance) * 100)), 1)

        pnl = t.realized_pnl or 0.0
        outcome = "win" if pnl > 0 else "loss" if pnl < 0 else "breakeven"
        rows.append(EncroachmentRow(
            trade_id=t.trade_id, symbol=t.symbol, direction=t.direction.value, outcome=outcome,
            realized_pnl=round(pnl, 2), sl_encroachment_pct=sl_pct, tp_encroachment_pct=tp_pct,
        ))

    avg_sl = round(sum(r.sl_encroachment_pct for r in rows) / len(rows), 1) if rows else 0.0
    tp_vals = [r.tp_encroachment_pct for r in rows if r.tp_encroachment_pct is not None]
    avg_tp = round(sum(tp_vals) / len(tp_vals), 1) if tp_vals else 0.0

    winners = [r for r in rows if r.outcome == "win"]
    what_if: List[WhatIfRow] = []
    for tighten in (10, 25, 50, 75):
        threshold = 100 - tighten  # a 25%-tighter stop is crossed once encroachment reaches 75% of the ORIGINAL distance
        stopped = sum(1 for r in winners if r.sl_encroachment_pct >= threshold)
        what_if.append(WhatIfRow(
            tighten_pct=tighten, winners_would_be_stopped=stopped, winners_total=len(winners),
            winners_would_be_stopped_pct=round((stopped / len(winners) * 100) if winners else 0.0, 1),
        ))

    return EncroachmentResponse(
        rows=rows, avg_sl_encroachment_pct=avg_sl, avg_tp_encroachment_pct=avg_tp,
        what_if_tighter_sl=what_if, trades_requested=len(trades), trades_analyzed=len(rows),
    )


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(trade_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get detailed trade information — this is what a Manual Trading
    order form polls to show a placed order's live outcome, so it must
    keep working for a Paper Trading trade regardless of access status
    (see _visible_trades' own comment); only a real trade is gated."""
    trade = await _get_owned_trade(trade_id, user, db)
    if not trade.is_test:
        await _raise_if_access_expired(db, user)
    await _enrich_live_pnl([trade])
    return trade

@router.patch("/{trade_id}/archive", response_model=TradeResponse)
async def set_trade_archived(
    trade_id: str,
    update: TradeArchiveUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Move a trade into/out of the folded "Archive Trades" card — by
    direct request ("create an option to move individual trades to a
    new archive trades card"). Any status can be archived (a trader
    may want pending/cancelled clutter out of Recent Trades just as
    much as old closed ones); this never touches PnL, status, or
    analytics — see Trade.is_archived's own comment."""
    trade = await _get_owned_trade(trade_id, user, db)
    trade.is_archived = update.archived
    await db.commit()
    await db.refresh(trade)
    return trade

@router.patch("/{trade_id}/delete", response_model=TradeResponse)
async def set_trade_deleted(
    trade_id: str,
    update: TradeDeleteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Move a trade into/out of the "Deleted" card — by direct request
    ("include a delete option ... a Delete card where all the deleted
    trades are stored for future reference"). Same reversible-flag
    shape as set_trade_archived above (deleted=false restores it), so
    nothing is ever actually lost — see Trade.is_deleted's own comment
    for why this stays a soft delete."""
    trade = await _get_owned_trade(trade_id, user, db)
    trade.is_deleted = update.deleted
    await db.commit()
    await db.refresh(trade)
    return trade

@router.post("/{trade_id}/reanalyze", response_model=TradeResponse)
async def reanalyze_trade(trade_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Re-run this trade's own bot strategy against CURRENT market data
    — by direct request ("for each recommendation trader position of a
    time window has past ... there should be a 'Revisit' or
    'Re-Analyse' ... to propose new Entry, SL, TP ... solve the time
    lapse of approval problem and the vintage issue"). Surfaced on the
    Approval Chart's own "Re-Analyse" button.

    Only a still-PENDING trade can be re-analysed — an ACTIVE/CLOSED
    trade has already been decided on, and re-analysing it would be
    meaningless. Reuses the EXACT same dispatch market_scanner.py's own
    scan_once uses (BotOrchestrator.run_all against freshly-fetched
    candles for every timeframe any of the 5 bot strategies needs),
    filtered down to just this trade's own bot_id — so "re-analyse" is
    never anything other than "what would this bot actually signal on
    this symbol right now," the same logic that drafted the original
    recommendation.

    Either updates entry/SL/TP in place with a fresh signal — status
    stays PENDING, so the SAME Approve/Reject/Defer decision on the
    Approval Chart applies to it again — or marks it CANCELLED with a
    clear note if the bot's own strategy no longer produces a signal
    for this symbol at all (the setup is no longer valid)."""
    trade = await _get_owned_trade(trade_id, user, db)
    if trade.status != TradeStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only a still-pending trade can be re-analysed.")

    from app.models.bot import BotConfig
    from app.models.trade import TradeDirection
    from app.services.data_ingestion import MarketDataIngestion
    from app.core.bot_strategies import BotOrchestrator

    bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == trade.bot_id))).scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=404, detail="This trade's bot no longer exists.")

    # Same 5-timeframe fetch as market_scanner.py's own _fetch_market_data
    # — kept as its own short-lived MarketDataIngestion instance (one
    # re-analysis is a single manual, human-triggered action, not a
    # recurring background loop, so this doesn't reintroduce the
    # per-call-client rate-limit risk PR #161 fixed for the scanner).
    ingestion = MarketDataIngestion()
    exchange = bot.exchange or settings_module.MARKET_SCANNER_DEFAULT_EXCHANGE
    market_data: Dict = {"symbol": trade.symbol}
    for tf_key, ccxt_tf in {"1D": "1d", "4H": "4h", "1H": "1h", "15M": "15m", "5M": "5m"}.items():
        try:
            candles = await ingestion.fetch_historical_ccxt(exchange=exchange, symbol=trade.symbol, timeframe=ccxt_tf, limit=200)
            if candles:
                market_data[tf_key] = candles
        except Exception:
            continue  # one timeframe failing shouldn't block the others — same tolerance as the scanner

    signals = BotOrchestrator({}).run_all(market_data, settings_module.MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE)
    fresh = next((s for s in signals if s.bot_id == trade.bot_id), None)

    # Original reasoning is ALWAYS kept — by direct request ("the
    # reasoning and context for the bot recommendations disappear
    # after the Re-Analyse - it shouldn't ... original reasoning
    # should always stay"). Every branch below PREPENDS prior_log,
    # never replaces reasoning_log outright.
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    prior_log = (trade.reasoning_log + "\n\n") if trade.reasoning_log else ""
    old_direction = trade.direction  # captured before any overwrite below
    if fresh is None:
        trade.status = TradeStatus.CANCELLED
        trade.reasoning_log = prior_log + (
            f"[Re-Analysed {stamp}] NOT VALID — {bot.bot_name}'s own strategy no longer confirms this setup "
            f"for {trade.symbol} against current market data. Lower chance of success at current conditions; "
            f"recommend Not Approve or Defer."
        )
    else:
        new_direction = TradeDirection.LONG if fresh.direction == "long" else TradeDirection.SHORT
        # Real, grounded context — never fabricated: a direction flip
        # between the ORIGINAL signal and this re-analysis is the one
        # honest signal available for "who's in control now" (Trade
        # never persisted the original signal's confidence score to
        # compare against — see BotSignal.confidence's own gap), by
        # direct request ("Buyers now active or sellers now active ...
        # something that explains current context").
        if new_direction != old_direction:
            context_note = (
                f"Context has SHIFTED — {'buyers' if new_direction == TradeDirection.LONG else 'sellers'} now active, "
                f"opposite of the original {old_direction.value.upper()} thesis. This is now a {new_direction.value.upper()} setup instead."
            )
        else:
            context_note = f"Still {old_direction.value.upper()} — same directional thesis holds at current market conditions."
        trade.direction = new_direction
        trade.entry_price = fresh.entry_price
        trade.stop_loss = fresh.stop_loss
        trade.take_profit_1 = fresh.take_profit
        trade.reasoning_log = prior_log + f"[Re-Analysed {stamp}] VALID — {context_note} {fresh.reasoning}"
    await db.commit()
    await db.refresh(trade)
    return trade

@router.get("/{trade_id}/logs")
async def get_trade_logs(trade_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get execution logs for a trade. Same real-vs-paper access
    exception as get_trade above."""
    trade = await _get_owned_trade(trade_id, user, db)
    if not trade.is_test:
        await _raise_if_access_expired(db, user)
    query = select(TradeLog).where(TradeLog.trade_id == trade_id).order_by(TradeLog.timestamp.desc())
    result = await db.execute(query)
    return result.scalars().all()
