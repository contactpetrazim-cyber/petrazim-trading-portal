"""
OANDA Router — "Chart O" data source
==================================================================

By direct request: OANDA was identified as a genuinely free (zero
hosting/deploy billing, unlike MetaApi) source of real forex + NAS100
candle data ("OANDA is great news ... I get to use their data for
free ... Make sure there is a button for oanda charts just like
tradingview ... Call the Oanda charts 'Chart O'"). This is the free
alternative order_flow.py's own docstring flagged as out of scope
("Forex, indices, and commodities are a separate, larger scope ...
there is no free/no-key public REST source for those") — OANDA closes
exactly that gap, for forex/indices specifically (crypto stays on
order_flow.py's existing Binance-backed path, which is already free
and already broader for crypto than OANDA offers).

Uses the PLATFORM's own OANDA account (config.py's OANDA_API_TOKEN/
OANDA_ACCOUNT_ID — a single practice account the user registers once),
not a per-trader credential — exactly like nobody needs their own
TradingView account to view a TradingView chart. A trader who wants
OANDA to actually EXECUTE their own trades connects their own account
separately via Settings → Add Exchange (TraderBrokerConnection),
unrelated to this file.

Auth: get_current_user only (logged in, not paid-gated) — same "Free"
framing as order_flow.py's own endpoints, not a paywalled tool.
"""

from __future__ import annotations

from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.core.auth import get_current_user
from app.models.user import User
from app.services.broker_integrations import OandaBroker

router = APIRouter(prefix="/oanda", tags=["oanda"])
logger = structlog.get_logger()
settings = get_settings()


def _platform_client() -> OandaBroker:
    if not settings.OANDA_API_TOKEN or not settings.OANDA_ACCOUNT_ID:
        raise HTTPException(
            status_code=503,
            detail="OANDA isn't configured on this platform yet — an Admin needs to set OANDA_API_TOKEN and OANDA_ACCOUNT_ID.",
        )
    return OandaBroker(settings.OANDA_API_TOKEN, settings.OANDA_ACCOUNT_ID)


class OandaInstrument(BaseModel):
    name: str
    display_name: str
    type: str


@router.get("/instruments", response_model=List[OandaInstrument])
async def list_instruments(_user: User = Depends(get_current_user)):
    """Every instrument this platform's OANDA account can chart — the
    real tradeable list (forex majors/minors, NAS100_USD and other
    indices, commodities), not a hand-picked allow-list, since OANDA's
    own account-scoped instruments endpoint already is the authoritative
    "what can I actually chart/trade here" answer."""
    client = _platform_client()
    result = await client.get_instruments()
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error") or "Could not load OANDA instruments.")
    return [
        OandaInstrument(name=i["name"], display_name=i.get("displayName", i["name"]), type=i.get("type", ""))
        for i in result["instruments"]
    ]


class OandaCandle(BaseModel):
    time_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: int


GRANULARITIES = {"1m": "M1", "5m": "M5", "15m": "M15", "30m": "M30", "1h": "H1", "4h": "H4", "1d": "D", "1w": "W"}


@router.get("/candles", response_model=List[OandaCandle])
async def get_candles(
    symbol: str, interval: str = "1h", count: int = 200, _user: User = Depends(get_current_user),
):
    """Chart O's own candle feed — `interval` uses the same short codes
    every other chart tool in this app already uses (1m/5m/15m/.../1w),
    translated to OANDA's own granularity codes here so the frontend
    doesn't need to know OANDA's naming."""
    granularity = GRANULARITIES.get(interval)
    if not granularity:
        raise HTTPException(status_code=400, detail=f"Unsupported interval '{interval}'. Use one of: {', '.join(GRANULARITIES)}.")
    if count < 1 or count > 5000:
        raise HTTPException(status_code=400, detail="count must be between 1 and 5000.")

    client = _platform_client()
    result = await client.get_candles(symbol.upper(), granularity=granularity, count=count)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error") or f"Could not load OANDA candles for {symbol}.")
    return [OandaCandle(**c) for c in result["candles"]]
