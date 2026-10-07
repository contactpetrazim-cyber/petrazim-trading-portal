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


def _effective_bot_settings(bot: BotConfig, effective_balance: float) -> Dict[str, float]:
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
    actually consumes.

    CRITICAL FIX, found via direct report ("Why is the risk amount so
    low ...I should be close to the set amount ~$10 and not ~0.91"):
    this conversion used to divide by config.py's static
    MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE ($10,000) unconditionally,
    while calculate_lot_size downstream sizes the position against
    `effective_balance` — THIS bot's own actual balance (its own
    account_balance_usd, or the Admin's master override, resolved by
    the caller via get_effective_account_balance; see scan_once). The
    two used to disagree the moment a bot's effective balance wasn't
    exactly $10,000 — which, in production, it never is: every bot
    here has its own account_balance_usd set to $1,000. A $10
    Sub-Auto risk converted to 0.1% against the ASSUMED $10,000
    ("$10 would be 0.1% of a $10k account"), then applied against the
    REAL $1,000 balance, sized to 0.1% x $1,000 = $1 — roughly 10x
    under the stated $10, matching the real trades audited live
    (risk_amount ~$0.91-$0.95 against a $10 target). The old
    docstring's own reasoning for using the static default ("meant to
    read the same regardless of whatever the Admin's master override
    happens to be set to") was backwards: using effective_balance for
    BOTH the %-conversion AND the sizing is what keeps the real dollar
    risk correct and constant across a master-override change —
    mismatching them is exactly what broke it. Passed in by the caller
    (not re-resolved here) so a single DB round trip
    (get_effective_account_balance) serves both this conversion and
    calculate_lot_size's own sizing call, with no risk of the two ever
    disagreeing on which balance "effective" means.
    """
    risk_per_trade = bot.risk_per_trade
    min_rr_ratio = bot.min_rr_ratio
    if bot.sub_auto_active:
        if bot.sub_auto_risk_amount:
            risk_per_trade = (bot.sub_auto_risk_amount / effective_balance) * 100
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
                #
                # bot_settings (risk_per_trade/min_rr_ratio, including
                # any Sub-Auto override) is now built in THIS same loop,
                # using each bot's own just-resolved effective_balance —
                # real bug fix, found via direct report ("Why is the
                # risk amount so low ... ~0.91" against a $10 target).
                # See _effective_bot_settings' own docstring for the
                # full mismatch this closes: that conversion used to
                # run against the static platform default regardless of
                # what balance a bot would actually be sized against,
                # silently under-sizing every bot whose effective
                # balance differs from that default (every bot here,
                # in production — each has its own $1,000
                # account_balance_usd). One run_all call per distinct
                # balance, same as before; bot_settings is no longer a
                # single dict shared unconditionally across every
                # balance subgroup, since the risk-percent conversion
                # now genuinely depends on which subgroup a bot is in.
                #
                # Grouped by strategy_key (which of the 5 fixed
                # algorithms this bot runs — see BotConfig.strategy_key's
                # own comment), not re-derived from the bot_id string —
                # by direct request ("I don't mind repeating the bot
                # strategy ... we should always be able to update or add
                # bots ... from now for the future"). A LIST per
                # strategy_key, not a single dict, so run_all can run
                # the same algorithm for every real bot that uses it,
                # each tagged with its own real bot_id — see
                # BotOrchestrator.run_all's own docstring for the other
                # half of this. Falls back to the bot_id-prefix
                # convention only for a pre-migration row that somehow
                # still has no strategy_key (shouldn't happen after
                # migration 021's backfill, but a bot missing from this
                # grouping would silently never trade, so this stays
                # defensive rather than assuming the backfill always
                # ran).
                balance_groups: Dict[float, List[BotConfig]] = {}
                bot_settings_by_balance: Dict[float, Dict[str, List[Dict[str, float]]]] = {}
                for bot in bots_here:
                    balance = await get_effective_account_balance(db, bot)
                    balance_groups.setdefault(balance, []).append(bot)
                    strategy_key = bot.strategy_key or "_".join(bot.bot_id.split("_")[:2])
                    bot_settings_by_balance.setdefault(balance, {}).setdefault(strategy_key, []).append(
                        {"bot_id": bot.bot_id, **_effective_bot_settings(bot, balance)}
                    )

                for balance, bots_at_balance in balance_groups.items():
                    signals = self.orchestrator.run_all(market_data, balance, bot_settings_by_balance[balance])
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
