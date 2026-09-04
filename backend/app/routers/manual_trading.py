"""
Manual Trading Router
========================

The "send to exchange" button's real backend. Reuses
execution_engine.py's own _execute_broker_order — the exact same
broker-routing, per-bot-credential-fallback, and price-deviation-guard
logic a bot's own trades go through — rather than a second, parallel
execution path. Test mode never calls it at all; Live mode does.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.database import get_db
from app.models.trade import ManualTradingSettings, Trade, TradeDirection, TradeStatus, TradingMode
from app.models.user import User
from app.services.execution_engine import ExecutionEngine
from app.services.manual_trading import check_manual_trade_risk, compute_lot_size, effective_limits

router = APIRouter(prefix="/manual-trading", tags=["manual-trading"])
_engine = ExecutionEngine()


async def _get_or_create_settings(db: AsyncSession, user_id) -> ManualTradingSettings:
    row = (await db.execute(
        select(ManualTradingSettings).where(ManualTradingSettings.user_id == user_id)
    )).scalar_one_or_none()
    if row is None:
        row = ManualTradingSettings(user_id=user_id)   # every column defaults safe (test mode, global caps)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


class SettingsResponse(BaseModel):
    use_global_defaults: bool
    trading_mode: str
    risk_per_trade: float
    max_daily_trades: int
    max_concurrent_trades: int
    max_portfolio_exposure: float
    min_rr_ratio: float
    effective_risk_per_trade: float
    effective_max_daily_trades: int
    effective_max_concurrent_trades: int
    effective_max_portfolio_exposure: float
    effective_min_rr_ratio: float


def _to_response(row: ManualTradingSettings) -> SettingsResponse:
    eff = effective_limits(row)
    return SettingsResponse(
        use_global_defaults=row.use_global_defaults, trading_mode=row.trading_mode.value,
        risk_per_trade=row.risk_per_trade, max_daily_trades=row.max_daily_trades,
        max_concurrent_trades=row.max_concurrent_trades, max_portfolio_exposure=row.max_portfolio_exposure,
        min_rr_ratio=row.min_rr_ratio,
        effective_risk_per_trade=eff.risk_per_trade, effective_max_daily_trades=eff.max_daily_trades,
        effective_max_concurrent_trades=eff.max_concurrent_trades,
        effective_max_portfolio_exposure=eff.max_portfolio_exposure, effective_min_rr_ratio=eff.min_rr_ratio,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings_route(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    return _to_response(await _get_or_create_settings(db, user.id))


class SettingsUpdateRequest(BaseModel):
    use_global_defaults: Optional[bool] = None
    trading_mode: Optional[Literal["test", "live"]] = None
    risk_per_trade: Optional[float] = Field(default=None, gt=0, le=100)
    max_daily_trades: Optional[int] = Field(default=None, ge=1)
    max_concurrent_trades: Optional[int] = Field(default=None, ge=1)
    max_portfolio_exposure: Optional[float] = Field(default=None, gt=0, le=100)
    min_rr_ratio: Optional[float] = Field(default=None, ge=0)


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    req: SettingsUpdateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    row = await _get_or_create_settings(db, user.id)
    data = req.model_dump(exclude_unset=True)
    if "trading_mode" in data:
        data["trading_mode"] = TradingMode(data["trading_mode"])
    for field, value in data.items():
        setattr(row, field, value)
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _to_response(row)


class ManualOrderRequest(BaseModel):
    symbol: str
    direction: Literal["long", "short"]
    entry_price: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: Optional[float] = None
    account_equity: float = Field(gt=0, description="Used with risk_percent to size the position.")
    risk_percent: float = Field(gt=0, le=100)
    preferred_broker: Optional[str] = None


class ManualOrderResponse(BaseModel):
    trade_id: str
    status: str
    is_test: bool
    lot_size: float
    message: str


@router.post("/order", response_model=ManualOrderResponse)
async def place_manual_order(
    req: ManualOrderRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    settings_row = await _get_or_create_settings(db, user.id)
    limits = effective_limits(settings_row)

    reward = abs((req.take_profit - req.entry_price)) if req.take_profit is not None else None
    risk_dist = abs(req.entry_price - req.stop_loss)
    rr_ratio = (reward / risk_dist) if (reward is not None and risk_dist > 0) else limits.min_rr_ratio

    risk_check = await check_manual_trade_risk(db, user.id, limits, req.risk_percent, rr_ratio)
    if not risk_check.allowed:
        raise HTTPException(status_code=409, detail=risk_check.reason)

    try:
        lot_size = compute_lot_size(req.account_equity, req.risk_percent, req.entry_price, req.stop_loss)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    trade_id = f"MANUAL_{user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    is_test = settings_row.trading_mode == TradingMode.TEST

    trade = Trade(
        trade_id=trade_id, user_id=user.id, bot_id=f"manual_{user.id}", bot_name="Manual Trade",
        strategy_type="manual", symbol=req.symbol.upper(),
        direction=TradeDirection.LONG if req.direction == "long" else TradeDirection.SHORT,
        entry_price=req.entry_price, stop_loss=req.stop_loss, take_profit_1=req.take_profit,
        lot_size=lot_size, risk_percent=req.risk_percent,
        risk_amount=lot_size * risk_dist, requires_approval=False, is_test=is_test,
        broker_name=req.preferred_broker, status=TradeStatus.PENDING,
    )
    db.add(trade)
    await db.commit()

    if is_test:
        trade.status = TradeStatus.ACTIVE
        trade.entry_timestamp = datetime.now(timezone.utc)
        trade.broker_order_id = f"TEST-{uuid.uuid4().hex[:10]}"
        trade.broker_name = "test"
        await db.commit()
        return ManualOrderResponse(
            trade_id=trade_id, status="active", is_test=True, lot_size=lot_size,
            message="Simulated fill — Test mode, nothing was sent to a real exchange.",
        )

    result = await _engine._execute_broker_order({
        "trade_id": trade_id, "symbol": trade.symbol, "direction": req.direction,
        "entry_price": req.entry_price, "stop_loss": req.stop_loss, "take_profit": req.take_profit,
        "lot_size": lot_size, "preferred_broker": req.preferred_broker, "bot_id": trade.bot_id,
    }, db)

    if result.get("success"):
        trade.status = TradeStatus.ACTIVE
        trade.entry_timestamp = datetime.now(timezone.utc)
        trade.broker_order_id = str(result.get("order_id", ""))
        trade.broker_name = result.get("broker", trade.broker_name)
        await db.commit()
        return ManualOrderResponse(
            trade_id=trade_id, status="active", is_test=False, lot_size=lot_size,
            message=result.get("message", "Order sent."),
        )

    trade.status = TradeStatus.ERROR
    await db.commit()
    raise HTTPException(status_code=502, detail=result.get("message") or result.get("error") or "Order failed at the broker.")
