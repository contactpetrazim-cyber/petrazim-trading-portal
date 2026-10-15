"""
Monthly Trading Audit Worker
=================================

Runs engines/trading_audit_engine.py's run_audit() on a real monthly
cadence — the automated counterpart to the manual forensic audit
performed this session. Same in-process asyncio interval-loop shape as
IntelligentTuningWorker/MarketScanner/PositionMonitor (no job-queue/
Celery infrastructure exists anywhere in this codebase). Off by
default — see TRADING_AUDIT_ENABLED's own config.py comment.

run_once() is also called directly by routers/trading_audit.py's
manual "Run Now" endpoint, so a scheduled run and an admin-triggered
run share the exact same code path.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Optional

import structlog

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.engines.trading_audit_engine import run_audit

logger = structlog.get_logger()


class TradingAuditWorker:
    def __init__(self):
        self.settings = get_settings()
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self.settings.TRADING_AUDIT_ENABLED:
            logger.info("trading_audit_worker_disabled")
            return
        self._task = asyncio.create_task(self._run_forever())

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_forever(self):
        while True:
            try:
                await self.run_once(triggered_by="scheduled")
            except Exception as e:
                logger.error("trading_audit_cycle_failed", error=str(e))
            await asyncio.sleep(self.settings.TRADING_AUDIT_INTERVAL_SECONDS)

    async def run_once(self, triggered_by: str = "scheduled"):
        period_end = datetime.utcnow()
        period_start = period_end - timedelta(days=self.settings.TRADING_AUDIT_LOOKBACK_DAYS)
        async with AsyncSessionLocal() as db:
            run = await run_audit(db, period_start, period_end, triggered_by=triggered_by)
            logger.info("trading_audit_run_completed", run_id=str(run.id), status=run.status.value)
            return run
