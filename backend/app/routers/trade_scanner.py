"""
Trade Scanner Router
=======================

Exposes `app/services/trade_scanner.py`'s momentum/RSI setup screener over
HTTP, for the Explore area's "Trade Scanner" feature. Read-only, stateless --
every request fetches and rescans fresh.

POST /ai-read is a second, separate capability bolted on by direct
request ("be proactive ... we may miss some") -- a short Claude
synthesis over an already-completed scan's results, reusing
day_trader_skill_chat.py's same bounded single-call path and the same
admin/invite gate (require_feature_access), since it's the same real
per-call cost. /scan itself stays open to any active-access user --
only the AI add-on is gated.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.access_gate import require_active_access
from app.core.feature_access import require_feature_access
from app.models.user import User
from app.services.day_trader_skill_chat import DayTraderSkillChatError, summarize_scan
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


class AiReadRequest(BaseModel):
    exchange: str
    timeframe: str
    items: List[Dict[str, Any]] = Field(..., min_length=1, max_length=25)


@router.post("/ai-read")
async def ai_read(req: AiReadRequest, user: User = Depends(require_feature_access("day_trader_skill_chat"))):
    try:
        summary = await summarize_scan(req.items, exchange=req.exchange, timeframe=req.timeframe)
        return {"summary": summary}
    except DayTraderSkillChatError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
