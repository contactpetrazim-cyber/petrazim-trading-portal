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
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime

import json

from app.config import get_settings
from app.core.bot_strategies import BotOrchestrator, Candle
from app.database import AsyncSessionLocal
from app.models.bot import BotConfig, BotStatus
from app.models.platform_setting import MARKET_SCANNER_ENABLED_KEY, MASTER_ACCOUNT_BALANCE_KEY, PlatformSetting
from app.services.data_ingestion import shared_ingestion
from app.services.execution_engine import ExecutionEngine

logger = structlog.get_logger()
settings = get_settings()


async def get_market_scanner_runtime_enabled(db: AsyncSession) -> bool:
    """The Admin runtime pause/resume switch — see
    MARKET_SCANNER_ENABLED_KEY's own comment for how this differs from
    the MARKET_SCANNER_ENABLED env var. Defaults to True when never
    explicitly set."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MARKET_SCANNER_ENABLED_KEY)
    )).scalar_one_or_none()
    return row.value.lower() == "true" if row else True


async def get_master_account_balance(db: AsyncSession) -> tuple[bool, float]:
    """The Admin's platform-wide MASTER override — see
    MASTER_ACCOUNT_BALANCE_KEY's own comment. Returns (enabled, value);
    `value` is only meaningful when `enabled` is True. Defaults to
    (False, 0.0) — no override — when never explicitly set, same
    fail-safe-not-fail-open shape every other master switch in this
    app already uses."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MASTER_ACCOUNT_BALANCE_KEY)
    )).scalar_one_or_none()
    if not row:
        return False, 0.0
    try:
        data = json.loads(row.value)
        return bool(data.get("enabled", False)), float(data.get("value", 0.0))
    except (ValueError, TypeError, KeyError):
        return False, 0.0


async def get_effective_account_balance(db: AsyncSession, bot: BotConfig) -> float:
    """The REAL account balance a signal for THIS bot is actually sized
    against — by direct request ("Create a master bot control for bot
    starting reference capital and balance ... put master in Admin
    portal to supersede all"). Precedence: the Admin master override
    (when enabled) ALWAYS wins, regardless of what this bot has set;
    otherwise this bot's own account_balance_usd; otherwise config.py's
    static MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE — the same default
    every bot silently used before this feature existed, so a bot that
    never touches either setting behaves exactly as it always did."""
    master_enabled, master_value = await get_master_account_balance(db)
    if master_enabled:
        return master_value
    if bot.account_balance_usd is not None:
        return bot.account_balance_usd
    return settings.MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE

# BotOrchestrator dispatches by these timeframe keys (bot_strategies.py's
# run_all) — each maps to the ccxt timeframe string data_ingestion.py needs.
_TIMEFRAME_TO_CCXT = {"1D": "1d", "4H": "4h", "1H": "1h", "15M": "15m", "5M": "5m"}


def _effective_bot_settings(bot: BotConfig) -> Dict[str, float]:
    """What risk_per_trade/min_rr_ratio THIS bot should actually trade
    with right now — read fresh every scan cycle so a trader's edit on
    the Bots page takes effect on the very next cycle, same as
    exchange's own "takes effect on the very next signal" comment.

    While Sub-Auto Mode is engaged and the trader set a Sub-Auto-
    specific override, that takes priority over the bot's own base
    settings — by direct request ("provide a Risk Amount input for
    Semi auto mode ... and also a RR input"), so a trader can run a
    Sub-Auto engagement tighter/looser than the bot's normal manual-
    approval settings without having to edit (and remember to revert)
    the bot's base config. sub_auto_risk_amount is a dollar figure
    (matching the Bots page's own "Risk Amount (USD)" field) —
    converted to the risk_per_trade PERCENT this engine's RiskManager
    actually consumes, against the same flat default account balance
    every other risk calculation in this module already uses — Sub-
    Auto's own dollar-to-percent conversion is deliberately still
    against the static default rather than this bot's effective
    balance (get_effective_account_balance), since sub_auto_risk_amount
    is a trader-entered dollar figure meant to read the same regardless
    of whatever the Admin's master override happens to be set to.
    """
    risk_per_trade = bot.risk_per_trade
    min_rr_ratio = bot.min_rr_ratio
    if bot.sub_auto_active:
        if bot.sub_auto_risk_amount:
            risk_per_trade = (bot.sub_auto_risk_amount / settings.MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE) * 100
        if bot.sub_auto_min_rr_ratio:
            min_rr_ratio = bot.sub_auto_min_rr_ratio
    return {"risk_per_trade": risk_per_trade, "min_rr_ratio": min_rr_ratio}


class MarketScanner:
    def __init__(self, execution_engine: ExecutionEngine):
        self.execution_engine = execution_engine
        # Shared app-wide singleton, not a fresh instance — see
        # shared_ingestion's own comment in data_ingestion.py for why
        # (duplicate ccxt market caches across this and the Trade
        # Snapshot endpoint were a direct, measured contributor to the
        # Render free-tier backend's OOM-crash-loop).
        self.ingestion = shared_ingestion
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
            if not await get_market_scanner_runtime_enabled(db):
                # Admin paused it — skip this cycle only, not the loop
                # itself, so flipping the switch back on resumes within
                # one interval with no restart needed.
                return

            result = await db.execute(select(BotConfig).where(BotConfig.status == BotStatus.ACTIVE))
            active_bots = result.scalars().all()
            # Sleeping bots are skipped here (not just in
            # execution_engine.process_signal) purely as an
            # optimization — no point spending a candle-fetch/rate-limit
            # budget on a bot that's about to get skipped anyway. See
            # BotConfig.sleep_until's own comment.
            now = datetime.utcnow()
            active_bots = [b for b in active_bots if not (b.sleep_until and b.sleep_until > now)]
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
                    await self._record_scan_result(db, bots_here, error=str(e))
                    continue

                if len(market_data) <= 1:  # only "symbol" key, no candles at all
                    await self._record_scan_result(db, bots_here, error="No candle data returned for any timeframe — see recent market_scan_timeframe_fetch_failed logs.")
                    continue

                await self._record_scan_result(db, bots_here, error=None)

                # bot_settings (risk_per_trade/min_rr_ratio, including
                # any Sub-Auto override) is read once for the WHOLE
                # group — run_all only looks up entries matching the
                # bot_ids it actually dispatches to in a given call, so
                # handing it the full dict to every balance-subgroup
                # call below is harmless (same shape as bot_by_id.get
                # already tolerating a bot_id that isn't in this
                # subgroup).
                bot_settings = {
                    "_".join(bot.bot_id.split("_")[:2]): _effective_bot_settings(bot)
                    for bot in bots_here
                }

                # Sub-grouped by each bot's own EFFECTIVE account
                # balance (master override, else its own
                # account_balance_usd, else the static default — see
                # get_effective_account_balance) rather than one flat
                # constant for the whole group, by direct request
                # ("Create a master bot control for bot starting
                # reference capital and balance"). BotOrchestrator.
                # run_all already computes every one of the 5 fixed
                # strategies unconditionally and discards whichever
                # bot_id isn't wanted (the `bot_by_id.get` check right
                # below) — calling it once per distinct balance in this
                # group reuses that exact same discard mechanism rather
                # than needing any change to the strategies themselves.
                # The common case (no bot here has its own override, or
                # the master override is on) collapses back to exactly
                # one run_all call, identical to before this feature.
                balance_groups: Dict[float, List[BotConfig]] = {}
                for bot in bots_here:
                    balance = await get_effective_account_balance(db, bot)
                    balance_groups.setdefault(balance, []).append(bot)

                for balance, bots_at_balance in balance_groups.items():
                    signals = self.orchestrator.run_all(market_data, balance, bot_settings)
                    if not signals:
                        continue

                    bot_by_id = {b.bot_id: b for b in bots_at_balance}
                    for signal in signals:
                        bot = bot_by_id.get(signal.bot_id)
                        if not bot:
                            # This orchestrator dispatch matched a bot_id
                            # that isn't one of the BotConfig rows actually
                            # scanning this (exchange, symbol, balance)
                            # group right now — skip rather than execute
                            # for a bot that wasn't part of this cycle's
                            # intent.
                            continue

                        signal.preferred_broker = bot.exchange
                        mode = bot.execution_mode.value
                        exec_result = await self.execution_engine.process_signal(signal, mode, db)
                        logger.info(
                            "market_scan_signal",
                            bot_id=signal.bot_id, symbol=symbol, exchange=exchange,
                            mode=mode, result=exec_result.get("status", exec_result.get("success")),
                        )

    async def _record_scan_result(self, db: AsyncSession, bots: List[BotConfig], error: str | None) -> None:
        """Writes BotConfig.last_run/last_scan_error for every bot in
        this scan group — by direct report ("confirm my five bots are
        active and are looking for trade opportunities ... I have
        received no recommendation ... fix"). Before this, last_run/
        last_scan_error existed as columns but nothing ever wrote to
        them, so there was no way to tell "is the scanner even running
        for my bots" from "it's running but every fetch keeps failing"
        without reading raw logs — this is that visibility, and the
        Bots page's own botHealth() already reads these two fields.
        Called after EVERY fetch attempt for this (exchange, symbol)
        group, success or failure, so last_run always reflects the most
        recent attempt regardless of outcome."""
        now = datetime.utcnow()
        for bot in bots:
            bot.last_run = now
            bot.last_scan_error = error
        await db.commit()

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
