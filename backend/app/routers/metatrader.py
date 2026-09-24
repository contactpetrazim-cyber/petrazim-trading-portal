"""
MetaTrader (MT5) Router — the "MT5" chart data source
==================================================================

By direct request: "add the quick trade tool to Oanda and MT5 ...
For MT5 create it's own MT5 chart like Oanda - name it MT5."

Unlike OANDA (routers/oanda.py), MT5 has no free/public data source at
all — MetaApi bills for a deployed connection, and every account is a
real broker login, not a shared demo anyone can view. So this can't
use a single platform-level account the way Chart O/Oanda does; it
genuinely has to be the CURRENT trader's own connected MetaApi account
(Settings → Add Exchange), the same one execution_engine.py's own
_execute_metatrader already routes real orders through. A trader with
no MT5 connection gets a clear "connect your MT5 account first" error,
not a silent failure.

No /instruments endpoint here (unlike oanda.py) — MetaApi's own
symbols-list endpoint wasn't verified against live docs in this pass,
so rather than guess its shape, the MT5 chart page takes a typed
symbol directly (standard MT5 naming, e.g. EURUSD, XAUUSD — no
underscore, unlike OANDA).

Auth: get_current_user + the caller's own connection — never another
trader's.
"""

from __future__ import annotations

from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.trader_broker_connections import build_client_from_connection, get_connection

router = APIRouter(prefix="/metatrader", tags=["metatrader"])
logger = structlog.get_logger()


async def _my_client(db: AsyncSession, user: User):
    connection = await get_connection(db, user.id, "metatrader")
    if connection is None:
        raise HTTPException(
            status_code=503,
            detail="Connect your MT4/MT5 account first — Settings → Add Exchange → MT4/MT5 (via MetaApi.cloud).",
        )
    return build_client_from_connection(connection)


class MetatraderCandle(BaseModel):
    time_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: int


TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]


@router.get("/candles", response_model=List[MetatraderCandle])
async def get_candles(
    symbol: str, interval: str = "1h", count: int = 200,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """The MT5 chart's own candle feed — your own connected account's
    real broker data. `interval` uses the same short codes as every
    other chart tool in this app, and MetaApi's own timeframe codes
    already match them (see MetaApiBroker.get_candles), so no
    translation table is needed here the way oanda.py's own
    GRANULARITIES is."""
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unsupported interval '{interval}'. Use one of: {', '.join(TIMEFRAMES)}.")
    if count < 1 or count > 5000:
        raise HTTPException(status_code=400, detail="count must be between 1 and 5000.")

    client = await _my_client(db, user)
    result = await client.get_candles(symbol.upper(), timeframe=interval, limit=count)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error") or f"Could not load MT5 candles for {symbol}.")
    return [MetatraderCandle(**c) for c in result["candles"]]


class MetatraderPriceResponse(BaseModel):
    symbol: str
    price: float


@router.get("/price/{symbol}", response_model=MetatraderPriceResponse)
async def get_price(symbol: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Live price for the MT5 chart's own "Price" display, via your
    own connected account."""
    client = await _my_client(db, user)
    result = await client.get_ticker_price(symbol.upper())
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error") or f"Could not load MT5 price for {symbol}.")
    return MetatraderPriceResponse(symbol=symbol.upper(), price=result["price"])
