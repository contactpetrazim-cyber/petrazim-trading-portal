"""
Congress Trades Router
=======================

Exposes `app/services/congress_trades.py`'s House STOCK Act PTR fetcher over
HTTP, for the Explore area's "Congressional Trades" feature. Read-only, no DB
writes -- every request fetches fresh from the House Clerk's own public
index (no local caching/state tracking in v1; the source data only updates
a handful of times a day at most, so a user manually refreshing the page is
an acceptable cost for keeping this simple).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.congress_trades import CongressTradesError, get_recent_ptrs

router = APIRouter(prefix="/congress-trades", tags=["congress-trades"])


@router.get("")
async def list_congress_trades(
    ticker: Optional[str] = Query(None, description="Filter to filings that mention this ticker"),
    member: Optional[str] = Query(None, description="Filter to one member, e.g. 'Pelosi' or 'Pelosi, Nancy'"),
    limit: int = Query(15, ge=1, le=50),
    user: User = Depends(require_active_access),
):
    try:
        return await get_recent_ptrs(ticker=ticker, member=member, limit=limit)
    except CongressTradesError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach the House disclosures site: {exc}")
