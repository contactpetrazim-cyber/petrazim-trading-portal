"""
MetaApi Idle-Undeploy Sweep — "an auto engine that auto-undeploys when
not in use," by direct request: "$9/month is high and a waste of not
used and it's unlikely to be used ... maybe a max of 4 trades of 2
hours a day."

MetaApi bills a MT4/MT5 connection for the time it stays DEPLOYED
(roughly $0.0126/account/hour on the plan actually being used, per the
trader's own live pricing screen), not for how much the API is called
while deployed. A connection deployed 24/7 to cover a real usage
pattern of a few hours a day burns most of that cost doing nothing —
this loop is the automatic half of "run it for the 2-4 hours you
actually need, undeploy the rest of the time" so nobody has to
remember to click Undeploy by hand every night.

Runs as a single in-process asyncio task (see main.py's lifespan),
same convention as MarketScanner/PositionMonitor — the simplest thing
that actually works for one web instance.

SAFETY: never undeploys a connection with an ACTIVE trade on it,
regardless of how long it's been idle. Undeploying doesn't touch
anything at the broker — an already-open position with a broker-side
stop-loss/take-profit keeps closing normally server-side even while
MetaApi's own hosted terminal is stopped — but OUR ability to query or
manage that position through MetaApi pauses until it's redeployed, so
this loop deliberately leaves a connection with real open exposure
alone rather than assume that's fine.

Calling undeploy on an already-undeployed account is a documented
no-op on MetaApi's side (its own docs: "ignores requests if the
account is already undeployed"), so this sweep doesn't need to track
which connections it already undeployed — re-checking a genuinely idle
one every cycle is harmless.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Optional

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.trade import Trade, TradeStatus
from app.models.trader_broker_connection import TraderBrokerConnection
from app.services.trader_broker_connections import undeploy_metatrader_connection

logger = structlog.get_logger()
settings = get_settings()


class MetaApiIdleUndeployer:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info("metaapi_idle_undeployer_started", interval_seconds=settings.METAAPI_IDLE_UNDEPLOY_INTERVAL_SECONDS)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_forever(self) -> None:
        while True:
            try:
                await self.sweep_once()
            except Exception as e:
                # One bad cycle (a MetaApi hiccup, an unexpected row
                # shape) should never kill the loop, and should never
                # risk undeploying something it wasn't sure about.
                logger.error("metaapi_idle_undeploy_cycle_failed", error=str(e))
            await asyncio.sleep(settings.METAAPI_IDLE_UNDEPLOY_INTERVAL_SECONDS)

    async def sweep_once(self) -> None:
        async with AsyncSessionLocal() as db:
            candidates = (await db.execute(
                select(TraderBrokerConnection).where(
                    TraderBrokerConnection.exchange == "metatrader",
                    TraderBrokerConnection.is_active == True,  # noqa: E712
                    TraderBrokerConnection.auto_undeploy_minutes.isnot(None),
                )
            )).scalars().all()
            if not candidates:
                return

            now = datetime.utcnow()
            for connection in candidates:
                idle_since = connection.last_activity_at or connection.updated_at or connection.created_at
                if now - idle_since < timedelta(minutes=connection.auto_undeploy_minutes):
                    continue

                has_open_trade = (await db.execute(
                    select(Trade.id).where(
                        Trade.user_id == connection.user_id,
                        Trade.broker_name == "metatrader",
                        Trade.status == TradeStatus.ACTIVE,
                    ).limit(1)
                )).first()
                if has_open_trade:
                    logger.info("metaapi_idle_undeploy_skipped_open_trade", connection_id=str(connection.id))
                    continue

                result = await undeploy_metatrader_connection(connection)
                if result.get("success"):
                    logger.info(
                        "metaapi_idle_undeploy_succeeded", connection_id=str(connection.id),
                        idle_minutes=int((now - idle_since).total_seconds() // 60),
                    )
                else:
                    logger.error("metaapi_idle_undeploy_failed", connection_id=str(connection.id), error=result.get("error"))
