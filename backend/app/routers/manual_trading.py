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
import structlog

from app.core.access_gate import _raise_if_access_expired
from app.core.auth import get_current_user
from app.database import get_db
from app.models.trade import EntryType, ExitType, ManualTradingSettings, Trade, TradeDirection, TradeStatus, TradingMode
from app.models.user import User
from app.services.execution_engine import ExecutionEngine
from app.services.manual_trading import check_manual_trade_risk, compute_lot_size, effective_limits

router = APIRouter(prefix="/manual-trading", tags=["manual-trading"])
logger = structlog.get_logger()
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


# Both settings routes below were on require_active_access — real bug,
# found from a live 402 in production logs: viewing/toggling your own
# Test-vs-Live preference is exactly the "account settings" case
# require_active_access's own docstring already says should stay on
# plain get_current_user (same asymmetry already applied in
# facilitator.py), not something a lapsed subscription should hide.
# With settings 402ing, ManualTradingPage's loadSettings() silently
# failed (its own .catch swallows the error) and the whole Test/Live
# toggle never rendered at all — reading as "there's no toggle," not
# as an error.
@router.get("/settings", response_model=SettingsResponse)
async def get_settings_route(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
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
    req: SettingsUpdateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
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
    order_type: Literal["market", "limit"] = "market"
    entry_price: float = Field(gt=0, description="Market price reference for market orders; the trigger price for limit orders.")
    stop_loss: float = Field(gt=0)
    take_profit: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    account_equity: float = Field(gt=0, description="Used with risk_percent/risk_amount to size the position.")
    risk_mode: Literal["dollar", "percent"] = "dollar"
    risk_amount: Optional[float] = Field(default=None, gt=0, description="Absolute risk in account currency — the default sizing mode, matching a real exchange's own order ticket.")
    risk_percent: Optional[float] = Field(default=None, gt=0, le=100)
    preferred_broker: Optional[str] = None


class ManualOrderResponse(BaseModel):
    trade_id: str
    status: str
    is_test: bool
    lot_size: float
    risk_percent: float
    message: str


@router.post("/order", response_model=ManualOrderResponse)
async def place_manual_order(
    req: ManualOrderRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    settings_row = await _get_or_create_settings(db, user.id)
    limits = effective_limits(settings_row)

    # Gated here, not at the dependency level (require_active_access),
    # because whether this needs an active subscription genuinely
    # depends on trading_mode: a Test order is a risk-free rehearsal
    # that never reaches a real broker — no different from any other
    # free practice feature — so it stays open regardless of access
    # status. Only a real LIVE order (money actually at risk) is
    # gated, and only now that trading_mode is known. By direct
    # request: "at least let's see it work in test mode."
    if settings_row.trading_mode != TradingMode.TEST:
        await _raise_if_access_expired(db, user)

    risk_dist = abs(req.entry_price - req.stop_loss)
    if risk_dist <= 0:
        raise HTTPException(status_code=400, detail="stop_loss must differ from entry_price")

    # Risk-$ is the default sizing mode (matches a real exchange's own
    # order ticket — "Risk, USD" driving position size) — risk_percent
    # is derived from it either way, since every risk cap in this app
    # (and the bot side of the platform) is expressed as a percentage.
    if req.risk_mode == "dollar":
        if req.risk_amount is None:
            raise HTTPException(status_code=400, detail="risk_amount is required when risk_mode is 'dollar'")
        risk_percent = (req.risk_amount / req.account_equity) * 100
    else:
        if req.risk_percent is None:
            raise HTTPException(status_code=400, detail="risk_percent is required when risk_mode is 'percent'")
        risk_percent = req.risk_percent

    final_target = req.take_profit_3 or req.take_profit_2 or req.take_profit
    reward = abs(final_target - req.entry_price) if final_target is not None else None
    rr_ratio = (reward / risk_dist) if reward is not None else limits.min_rr_ratio

    risk_check = await check_manual_trade_risk(db, user.id, limits, risk_percent, rr_ratio)
    if not risk_check.allowed:
        raise HTTPException(status_code=409, detail=risk_check.reason)

    try:
        lot_size = compute_lot_size(req.account_equity, risk_percent, req.entry_price, req.stop_loss)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    trade_id = f"MANUAL_{user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    is_test = settings_row.trading_mode == TradingMode.TEST

    trade = Trade(
        trade_id=trade_id, user_id=user.id, bot_id=f"manual_{user.id}", bot_name="Manual Trade",
        strategy_type="manual", symbol=req.symbol.upper(),
        direction=TradeDirection.LONG if req.direction == "long" else TradeDirection.SHORT,
        entry_price=req.entry_price, stop_loss=req.stop_loss,
        take_profit_1=req.take_profit, take_profit_2=req.take_profit_2, take_profit_3=req.take_profit_3,
        lot_size=lot_size, risk_percent=risk_percent,
        risk_amount=lot_size * risk_dist, requires_approval=False, is_test=is_test,
        broker_name=req.preferred_broker,
        status=TradeStatus.PENDING,
        entry_type=EntryType.LIMIT if req.order_type == "limit" else EntryType.MARKET,
    )
    db.add(trade)
    await db.commit()

    if is_test:
        # Test mode always simulates an instant fill regardless of
        # order_type — it's a rehearsal of the risk/execution flow, not
        # a simulation of a resting limit order waiting to be touched
        # (no price feed exists in this app to know when that would
        # happen for a paper order).
        trade.status = TradeStatus.ACTIVE
        trade.entry_timestamp = datetime.now(timezone.utc)
        trade.broker_order_id = f"TEST-{uuid.uuid4().hex[:10]}"
        trade.broker_name = "test"
        await db.commit()
        return ManualOrderResponse(
            trade_id=trade_id, status="active", is_test=True, lot_size=lot_size, risk_percent=risk_percent,
            message="Simulated fill — Test mode, nothing was sent to a real exchange.",
        )

    result = await _engine._execute_broker_order({
        "trade_id": trade_id, "symbol": trade.symbol, "direction": req.direction,
        "entry_price": req.entry_price, "stop_loss": req.stop_loss, "take_profit": req.take_profit,
        "lot_size": lot_size, "preferred_broker": req.preferred_broker, "bot_id": trade.bot_id,
        "entry_type": req.order_type,
    }, db)

    if result.get("success"):
        # A real limit order sits on the exchange's own book until
        # triggered — ACTIVE here means "the order is live," not
        # necessarily "filled," same distinction a real exchange's own
        # order history draws between "working" and "filled."
        trade.status = TradeStatus.ACTIVE
        trade.entry_timestamp = datetime.now(timezone.utc)
        trade.broker_order_id = str(result.get("order_id", ""))
        trade.broker_name = result.get("broker", trade.broker_name)
        await db.commit()
        return ManualOrderResponse(
            trade_id=trade_id, status="active", is_test=False, lot_size=lot_size, risk_percent=risk_percent,
            message=result.get("message", "Order sent."),
        )

    trade.status = TradeStatus.ERROR
    await db.commit()
    raise HTTPException(status_code=502, detail=result.get("message") or result.get("error") or "Order failed at the broker.")


class PartialCloseRequest(BaseModel):
    percent: float = Field(gt=0, le=100, description="What portion of the CURRENT remaining size to close now.")
    exit_price: float = Field(gt=0)


class PartialCloseResponse(BaseModel):
    trade_id: str
    status: str
    closed_lot_size: float
    remaining_lot_size: float
    realized_pnl_this_close: float


@router.post("/{trade_id}/partial-close", response_model=PartialCloseResponse)
async def partial_close(
    trade_id: str, req: PartialCloseRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Manual, trader-triggered partial exit — for multiple targets
    (take_profit_1/2/3), the trader decides when price has reached
    each one and closes that portion themselves; this app has no
    price-feed/worker process to detect a target being hit and fire
    automatically. `lot_size` on the Trade row is treated as the
    CURRENT remaining size (mutated down on each partial close, not
    the original) — closing 100% at any point fully closes the trade."""
    row = (await db.execute(
        select(Trade).where(Trade.trade_id == trade_id, Trade.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    if row.status != TradeStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Trade is {row.status.value}, not active — nothing to close.")
    # Same test/live split as placing the order — closing a real
    # position only makes sense to gate the same way opening one is.
    if not row.is_test:
        await _raise_if_access_expired(db, user)

    closed_size = row.lot_size * (req.percent / 100)
    direction_sign = 1 if row.direction == TradeDirection.LONG else -1
    pnl_this_close = direction_sign * (req.exit_price - row.entry_price) * closed_size

    row.lot_size = round(row.lot_size - closed_size, 8)
    row.realized_pnl = (row.realized_pnl or 0.0) + pnl_this_close
    if row.lot_size <= 1e-8 or req.percent >= 100:
        row.status = TradeStatus.CLOSED
        row.exit_price = req.exit_price
        row.exit_timestamp = datetime.now(timezone.utc)
        row.exit_type = ExitType.MANUAL
        row.lot_size = 0.0
    await db.commit()

    return PartialCloseResponse(
        trade_id=trade_id, status=row.status.value, closed_lot_size=round(closed_size, 8),
        remaining_lot_size=row.lot_size, realized_pnl_this_close=round(pnl_this_close, 2),
    )


class ModifyTargetsRequest(BaseModel):
    stop_loss: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)
    take_profit_2: Optional[float] = Field(default=None, gt=0)
    take_profit_3: Optional[float] = Field(default=None, gt=0)


class ModifyTargetsResponse(BaseModel):
    trade_id: str
    stop_loss: float
    take_profit: Optional[float]
    take_profit_2: Optional[float]
    take_profit_3: Optional[float]


@router.patch("/{trade_id}/modify-targets", response_model=ModifyTargetsResponse)
async def modify_targets(
    trade_id: str, req: ModifyTargetsRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Move/edit SL and TP1/2/3 on an open position — the real backend
    for the Trade Specs panel's "Modify" action, by direct request
    ("fix or move or edit all SL and TP ... from the charts"). Works on
    ANY of the caller's own active trades, bot-placed or manual — not
    manual-only — since a trader manages both the same way once a
    position is open.

    Honest scope: this updates OUR OWN record of the trade's targets,
    the same thing partial-close already treats as trader-managed
    rather than broker-enforced (see that endpoint's own docstring —
    there's no price-feed worker in this app that watches for a target
    being hit). For a LIVE trade at a real broker, that broker's own
    resting stop/limit order is not modified by this call; the trader
    still needs to adjust it at the broker directly if one was placed
    there. Fixing that fully means adding a modify-order call to every
    broker integration this app has — a separate, larger piece of
    work, not something to silently pretend already happens here.
    """
    row = (await db.execute(
        select(Trade).where(Trade.trade_id == trade_id, Trade.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    if row.status != TradeStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Trade is {row.status.value}, not active.")
    if not row.is_test:
        await _raise_if_access_expired(db, user)

    if req.stop_loss is not None:
        row.stop_loss = req.stop_loss
    if req.take_profit is not None:
        row.take_profit_1 = req.take_profit
    if req.take_profit_2 is not None:
        row.take_profit_2 = req.take_profit_2
    if req.take_profit_3 is not None:
        row.take_profit_3 = req.take_profit_3
    await db.commit()

    return ModifyTargetsResponse(
        trade_id=trade_id, stop_loss=row.stop_loss, take_profit=row.take_profit_1,
        take_profit_2=row.take_profit_2, take_profit_3=row.take_profit_3,
    )


# CoinGecko's fallback — used only when Binance's own response isn't
# a clean 200. Binance's public endpoints are known to block requests
# from data-center/cloud IP ranges outright (a real, observed failure
# once this endpoint was actually deployed on Render — confirmed by a
# 404 on a perfectly valid symbol, BTCUSDT, in production logs), so
# Binance alone isn't reliable enough to be the only source. CoinGecko
# doesn't apply that kind of IP blocking, but needs its own coin id
# rather than a trading-pair symbol, hence the small map — only covers
# the crypto pairs this app actually offers, not a general symbol
# translator.
_COINGECKO_IDS = {"BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "BNBUSDT": "binancecoin", "SOLUSDT": "solana"}


@router.get("/quick-price/{symbol}")
async def quick_price(symbol: str):
    """A free, no-credential "what's it trading at right now" lookup
    for the order form's "Use current price" quick-fill button — by
    direct request ("ensure quick fill works"). Real data, not
    invented — tries Binance's public ticker first, CoinGecko second.
    Scoped honestly to crypto pairs — this app has no free,
    credential-less price source for forex/metals (EURUSD, XAUUSD,
    ...); those need the trader's own connected broker, which is a
    per-user credential this endpoint deliberately doesn't require.
    """
    import httpx
    clean = symbol.upper().replace("BINANCE:", "").replace("/", "")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/ticker/price", params={"symbol": clean})
        if resp.status_code == 200:
            return {"symbol": clean, "price": float(resp.json()["price"]), "source": "binance"}
        logger.warning("quick_price_binance_non_200", symbol=clean, status=resp.status_code, body=resp.text[:200])
    except httpx.HTTPError as e:
        logger.warning("quick_price_binance_failed", symbol=clean, error=str(e))

    coingecko_id = _COINGECKO_IDS.get(clean)
    if coingecko_id:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": coingecko_id, "vs_currencies": "usd"},
                )
            if resp.status_code == 200:
                price = resp.json().get(coingecko_id, {}).get("usd")
                if price is not None:
                    return {"symbol": clean, "price": float(price), "source": "coingecko"}
        except httpx.HTTPError as e:
            logger.warning("quick_price_coingecko_failed", symbol=clean, error=str(e))

    raise HTTPException(status_code=404, detail=f"No live crypto price for {clean} — enter your price manually.")
