"""
News Monitor Router
=====================

Exposes `app/services/news_monitor.py`'s per-symbol headline/SEC-filing
fetcher over HTTP, for the Explore area's "News Monitor" feature. Read-only,
stateless -- every request fetches fresh (no dedup/seen-tracking; this is an
on-demand lookup, not a long-running watcher).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.news_monitor import NewsMonitorError, get_symbol_news

router = APIRouter(prefix="/news-monitor", tags=["news-monitor"])


@router.get("/{symbol}")
async def get_news_for_symbol(
    symbol: str,
    include_sec: bool = Query(True, description="Also fetch SEC EDGAR 8-K filings"),
    user: User = Depends(require_active_access),
):
    try:
        return await get_symbol_news(symbol, include_sec=include_sec)
    except NewsMonitorError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
