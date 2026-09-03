
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.trade import Trade, TradeLog, TradeStatus, TradeDirection
from app.schemas import TradeCreate, TradeResponse, TradeApproval
from app.services.execution_engine import ExecutionEngine
import structlog

router = APIRouter(prefix="/trades", tags=["trades"])
logger = structlog.get_logger()
engine = ExecutionEngine()

@router.get("/", response_model=List[TradeResponse])
async def list_trades(
    status: Optional[str] = Query(None, description="Filter by status"),
    bot_id: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List all trades with filtering."""
    query = select(Trade)

    if status:
        query = query.where(Trade.status == status)
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if symbol:
        query = query.where(Trade.symbol == symbol)
    if direction:
        query = query.where(Trade.direction == direction)

    query = query.order_by(Trade.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()

    return trades

@router.get("/pending-approvals", response_model=List[TradeResponse])
async def pending_approvals(db: AsyncSession = Depends(get_db)):
    """Get all trades awaiting manual approval (Human-in-the-Loop)."""
    query = select(Trade).where(
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
    db: AsyncSession = Depends(get_db)
):
    """Approve or reject a pending trade."""
    result = await engine.approve_trade(
        approval.trade_id,
        approval.approved,
        approval.notes or "",
        db
    )
    return result

@router.get("/active", response_model=List[TradeResponse])
async def active_trades(db: AsyncSession = Depends(get_db)):
    """Get currently active (open) trades."""
    query = select(Trade).where(Trade.status == TradeStatus.ACTIVE).order_by(Trade.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/stats/today")
async def today_stats(db: AsyncSession = Depends(get_db)):
    """Get today's trading statistics."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    query = select(Trade).where(Trade.created_at >= today_start)
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

@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(trade_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed trade information."""
    query = select(Trade).where(Trade.trade_id == trade_id)
    result = await db.execute(query)
    trade = result.scalar_one_or_none()

    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    return trade

@router.get("/{trade_id}/logs")
async def get_trade_logs(trade_id: str, db: AsyncSession = Depends(get_db)):
    """Get execution logs for a trade."""
    query = select(TradeLog).where(TradeLog.trade_id == trade_id).order_by(TradeLog.timestamp.desc())
    result = await db.execute(query)
    return result.scalars().all()
