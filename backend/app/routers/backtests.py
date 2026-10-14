"""
Backtests Router
==================

Mount in main.py:
    from app.routers import backtests as backtests_router
    app.include_router(backtests_router.router, prefix="/api/backtests", tags=["backtests"])

POST /api/backtests kicks off an isolated-mode backtest (one bot,
one symbol) as an in-process asyncio task — the same pattern every
other background worker in this codebase uses (MarketScanner,
PositionMonitor, ...), since no Celery/job-queue infrastructure exists
here. GET /api/backtests/{id} polls the resulting BacktestRunORM row;
GET /api/backtests lists past runs, optionally filtered by bot_id.

Portfolio-mode scope (all active bots, shared simulated ledger) is a
separate, later phase of the same approved plan — not exposed here.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.models.user import User
from app.database import get_db as get_primary_db
from app.models.bot import BotConfig
from app.db.session import get_db as get_legacy_db
from app.db.models import BacktestRunORM
from app.services.backtest_runner import start_backtest_run, run_backtest

router = APIRouter()


class BacktestRunRequest(BaseModel):
    bot_id: str
    start_date: datetime
    end_date: datetime
    symbol: Optional[str] = None  # defaults to the bot's own first configured symbol


class BacktestRunResponse(BaseModel):
    id: str
    bot_id: str
    scope: str
    symbol: Optional[str]
    base_timeframe: Optional[str]
    start_date: datetime
    end_date: datetime
    status: str
    progress_pct: float
    error_message: Optional[str]
    total_trades: Optional[int]
    win_rate: Optional[float]
    expectancy_r: Optional[float]
    max_drawdown_pct: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]

    @classmethod
    def from_orm_row(cls, row: BacktestRunORM) -> "BacktestRunResponse":
        return cls(
            id=str(row.id), bot_id=row.bot_id, scope=row.scope, symbol=row.symbol,
            base_timeframe=row.base_timeframe, start_date=row.start_date, end_date=row.end_date,
            status=row.status.value if hasattr(row.status, "value") else row.status,
            progress_pct=row.progress_pct, error_message=row.error_message,
            total_trades=row.total_trades, win_rate=row.win_rate,
            expectancy_r=row.expectancy_r, max_drawdown_pct=row.max_drawdown_pct,
            created_at=row.created_at, completed_at=row.completed_at,
        )


@router.post("", response_model=BacktestRunResponse)
async def create_backtest_run(
    req: BacktestRunRequest,
    user: User = Depends(require_active_access),
    primary_db: AsyncSession = Depends(get_primary_db),
    legacy_db: AsyncSession = Depends(get_legacy_db),
):
    if req.end_date <= req.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    bot = (await primary_db.execute(select(BotConfig).where(BotConfig.bot_id == req.bot_id))).scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=404, detail=f"No bot found with bot_id={req.bot_id!r}")

    run_id = await start_backtest_run(
        bot_id=req.bot_id, start_date=req.start_date, end_date=req.end_date,
        created_by=str(user.id), symbol=req.symbol,
    )
    asyncio.create_task(run_backtest(run_id))

    row = (await legacy_db.execute(select(BacktestRunORM).where(BacktestRunORM.id == run_id))).scalar_one()
    return BacktestRunResponse.from_orm_row(row)


@router.get("/{run_id}", response_model=BacktestRunResponse)
async def get_backtest_run(
    run_id: str,
    user: User = Depends(require_active_access),
    legacy_db: AsyncSession = Depends(get_legacy_db),
):
    row = (await legacy_db.execute(select(BacktestRunORM).where(BacktestRunORM.id == run_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No backtest run found with that id")
    return BacktestRunResponse.from_orm_row(row)


@router.get("", response_model=List[BacktestRunResponse])
async def list_backtest_runs(
    bot_id: Optional[str] = None,
    limit: int = 20,
    user: User = Depends(require_active_access),
    legacy_db: AsyncSession = Depends(get_legacy_db),
):
    stmt = select(BacktestRunORM).order_by(BacktestRunORM.created_at.desc()).limit(min(limit, 100))
    if bot_id:
        stmt = stmt.where(BacktestRunORM.bot_id == bot_id)
    rows = (await legacy_db.execute(stmt)).scalars().all()
    return [BacktestRunResponse.from_orm_row(r) for r in rows]
