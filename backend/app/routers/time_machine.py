"""
Time Machine Router
=====================

Exposes app/services/time_machine.py's pre-trade replay engine over HTTP,
for the Explore area's "Time Machine" feature. Read-only (no DB writes) --
every request re-fetches and re-simulates fresh.
"""

from __future__ import annotations

from typing import Literal, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.time_machine import TimeMachineError, run_time_machine

logger = structlog.get_logger()

router = APIRouter(prefix="/time-machine", tags=["time-machine"])


class TimeMachineRequest(BaseModel):
    exchange: str = "okx"
    symbol: str
    timeframe: str = "5m"
    entry: float
    stop: float
    target: float
    direction: Literal["long", "short"] = "long"
    horizon_bars: int = Field(48, ge=10, le=288)
    replays: int = Field(10_000, ge=1_000, le=20_000)
    lookback_days: int = Field(60, ge=7, le=180)
    seed: int = 19


@router.post("/run")
async def run(req: TimeMachineRequest, user: User = Depends(require_active_access)):
    try:
        return await run_time_machine(
            exchange=req.exchange, symbol=req.symbol, timeframe=req.timeframe,
            entry=req.entry, stop=req.stop, target=req.target, direction=req.direction,
            horizon_bars=req.horizon_bars, replays=req.replays, lookback_days=req.lookback_days,
            seed=req.seed,
        )
    except TimeMachineError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        # Any other failure (a bad symbol/exchange combo, a transient
        # candle-fetch error, ...) used to fall through uncaught --
        # FastAPI's default 500 handler returns a bare "Internal Server
        # Error" with no JSON `detail`, so the frontend's error box
        # always showed the same generic fallback text regardless of
        # the real cause, and the real exception only ever reached a
        # container log. Logged + surfaced with an actual message so a
        # genuine failure is at least diagnosable from the UI, not just
        # from a log line that scrolls away.
        logger.warning("time_machine_run_failed", exchange=req.exchange, symbol=req.symbol, error=str(exc))
        raise HTTPException(status_code=502, detail=f"Could not fetch/replay {req.symbol} on {req.exchange}: {exc}")
