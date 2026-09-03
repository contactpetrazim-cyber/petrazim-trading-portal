"""
Autonomous market scanner — the loop that lets bots read the market
themselves instead of only reacting to a manual TradingView Pine
alert. Fetches real candles directly from each active bot's own
configured exchange (data_ingestion.py, now genuinely non-blocking —
see the fix there), runs them through BotOrchestrator (bot_strategies.py,
already built and tested, just never scheduled anywhere before this),
and routes any resulting signal through the same ExecutionEngine the
webhook path uses — same price-deviation guard, same per-bot broker
credentials, same Trade persistence.

Off by default (MARKET_SCANNER_ENABLED=false) — enable it once you've
reviewed what it does, since every cycle makes real API calls to real
exchanges for every symbol every active bot is configured for.

Runs as a single in-process asyncio task (see main.py's lifespan), not
a separate worker — the simplest thing that actually works for one web
instance. If this ever needs to run across multiple instances/workers
without every one of them scanning redundantly, that's the point to
introduce Celery beat (already a dependency) or a dedicated worker
service instead of this loop.
"""

from __future__ import annotations

import asyncio
from typing import Dict, List

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.core.bot_strategies import BotOrchestrator, Candle
from app.database import AsyncSessionLocal
from app.models.bot import BotConfig, BotStatus
from app.services.data_ingestion import MarketDataIngestion
from app.services.execution_engine import ExecutionEngine

logger = structlog.get_logger()
settings = get_settings()

# BotOrchestrator dispatches by these timeframe keys (bot_strategies.py's
# run_all) — each maps to the ccxt timeframe string data_ingestion.py needs.
_TIMEFRAME_TO_CCXT = {"1D": "1d", "4H": "4h", "1H": "1h", "15M": "15m", "5M": "5m"}


class MarketScanner:
    def __init__(self, execution_engine: ExecutionEngine):
        self.execution_engine = execution_engine
        self.ingestion = MarketDataIngestion()
        self.orchestrator = BotOrchestrator({})
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info("market_scanner_started", interval_seconds=settings.MARKET_SCANNER_INTERVAL_SECONDS)

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
                await self.scan_once()
            except Exception as e:
                # A bad cycle (an exchange hiccup, a malformed
                # BotConfig row) should never kill the loop — log and
                # try again next interval.
                logger.error("market_scan_cycle_failed", error=str(e))
            await asyncio.sleep(settings.MARKET_SCANNER_INTERVAL_SECONDS)

    async def scan_once(self) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(BotConfig).where(BotConfig.status == BotStatus.ACTIVE))
            active_bots = result.scalars().all()
            if not active_bots:
                return

            # Group by (exchange, symbol) so bots sharing a symbol on
            # the same exchange don't each trigger their own redundant
            # candle fetch.
            groups: Dict[tuple, List[BotConfig]] = {}
            for bot in active_bots:
                exchange = bot.exchange or settings.MARKET_SCANNER_DEFAULT_EXCHANGE
                for symbol in (bot.symbols or []):
                    groups.setdefault((exchange, symbol), []).append(bot)

            for (exchange, symbol), bots_here in groups.items():
                try:
                    market_data = await self._fetch_market_data(exchange, symbol)
                except Exception as e:
                    logger.error("market_scan_fetch_failed", exchange=exchange, symbol=symbol, error=str(e))
                    continue

                if len(market_data) <= 1:  # only "symbol" key, no candles at all
                    continue

                signals = self.orchestrator.run_all(market_data, settings.MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE)
                if not signals:
                    continue

                bot_by_id = {b.bot_id: b for b in bots_here}
                for signal in signals:
                    bot = bot_by_id.get(signal.bot_id)
                    if not bot:
                        # This orchestrator dispatch matched a bot_id
                        # that isn't one of the BotConfig rows actually
                        # scanning this (exchange, symbol) group right
                        # now — skip rather than execute for a bot that
                        # wasn't part of this cycle's intent.
                        continue

                    signal.preferred_broker = bot.exchange
                    mode = bot.execution_mode.value
                    exec_result = await self.execution_engine.process_signal(signal, mode, db)
                    logger.info(
                        "market_scan_signal",
                        bot_id=signal.bot_id, symbol=symbol, exchange=exchange,
                        mode=mode, result=exec_result.get("status", exec_result.get("success")),
                    )

    async def _fetch_market_data(self, exchange: str, symbol: str) -> Dict[str, List[Candle] | str]:
        market_data: Dict = {"symbol": symbol}
        for tf_key, ccxt_tf in _TIMEFRAME_TO_CCXT.items():
            try:
                candles = await self.ingestion.fetch_historical_ccxt(
                    exchange=exchange, symbol=symbol, timeframe=ccxt_tf, limit=200
                )
                if candles:
                    market_data[tf_key] = candles
            except Exception as e:
                # One timeframe failing (e.g. this exchange doesn't
                # support 5m candles) shouldn't block the others —
                # BotOrchestrator.run_all only dispatches to bots whose
                # required timeframes are actually present.
                logger.warning("market_scan_timeframe_fetch_failed", exchange=exchange, symbol=symbol, timeframe=ccxt_tf, error=str(e))
        return market_data
