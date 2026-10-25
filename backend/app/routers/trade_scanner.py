"""
Trade Scanner Router
=======================

Exposes `app/services/trade_scanner.py`'s momentum/RSI setup screener over
HTTP, for the Explore area's "Trade Scanner" feature. Read-only, stateless --
every request fetches and rescans fresh.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.trade_scanner import TradeScannerError, scan_symbols

router = APIRouter(prefix="/trade-scanner", tags=["trade-scanner"])


class TradeScannerRequest(BaseModel):
    exchange: str = "okx"
    symbols: List[str] = Field(..., min_length=1, max_length=25)
    timeframe: str = "1h"
    limit: int = Field(60, ge=31, le=300)
    min_price: float = Field(0.0, ge=0)
    min_volume: float = Field(0.0, ge=0)


@router.post("/scan")
async def scan(req: TradeScannerRequest, user: User = Depends(require_active_access)):
    try:
        return await scan_symbols(
            exchange=req.exchange, symbols=req.symbols, timeframe=req.timeframe,
            limit=req.limit, min_price=req.min_price, min_volume=req.min_volume,
        )
    except TradeScannerError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
