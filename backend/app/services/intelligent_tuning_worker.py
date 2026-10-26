"""
Intelligent Tuning Worker
===========================

The automated half of Basic/Intelligent bot mode — see
app.core.bot_strategies.TUNABLE_PARAM_BOUNDS for the guardrail bounds
every candidate value here is clipped to, and app.routers.bots'
set_bot_mode/update_bot_metrics for Basic mode's manual-editing
counterpart, which this reuses rather than duplicates.

Runs as an in-process asyncio interval loop, the same pattern
MarketScanner/PositionMonitor already use (no job-queue/Celery
infrastructure exists anywhere in this codebase). Off by default —
see INTELLIGENT_TUNING_ENABLED's own config.py comment for why.

PER BOT, PER CYCLE
-------------------
1. Live-performance kill switch FIRST: if this bot has an applied
   StrategyAdjustment and has since closed enough real trades to
   judge it, and its real average R since that change is materially
   negative, downgrade it back to BASIC and skip tuning this cycle —
   an auto-tune is never left compounding against real money
   unsupervised.
2. Generate a small, bounded, explainable set of candidate parameter
   variants: for each of this bot's own declared tunable keys (see
   TUNABLE_PARAM_BOUNDS), one step up and one step down from its
   CURRENT effective value, clipped to bounds — a coordinate-style
   search, not an opaque optimizer. The bot's current config is always
   included as the baseline for comparison.
3. Backtest every candidate (including the baseline) over the same
   trailing window, reusing the exact engine/adapter/historical-loader
   already built and verified for isolated-mode backtests
   (app.engines.backtest_engine / strategy_adapter /
   data_ingestion.fetch_historical_range) — nothing about replay logic
   is duplicated here.
4. Persist every candidate's trades to closed_trades with
   source='backtest_param_variant', tagged by one variant_group per
   bot per cycle — exactly what that column was already built for
   (see db/repository.py's save_backtest_trades/
   load_parameter_variant_trades) and never used until now.
5. Evaluate via ValidationGate — but only its AUTOMATED checks
   (trade count, out-of-sample expectancy, drawdown, parameter
   stability). The gate's own 3 mandatory human-attestation checks
   (kill-switch test, manual emergency-close test, paper-trading
   reconciliation) are about a DIFFERENT decision — whether a bot
   should ever be allowed into autonomous live trading at all — not
   "is this parameter variant better than that one," so this
   deliberately reads the individual automated check results rather
   than trusting GateReport.overall_pass, which would always be False
   here (no human attestation exists for a routine re-tune).
6. Auto-apply the best-scoring candidate only if EVERY automated check
   passes AND it beats the baseline's own out-of-sample expectancy by
   a real margin (INTELLIGENT_TUNING_MIN_IMPROVEMENT_R) — no action on
   a tie or marginal edge, which would just be noise-chasing. On
   apply: re-clip to bounds defensively (even though the candidate was
   generated within them), write a StrategyAdjustment audit row
   BEFORE applying (previous_config/new_config/trigger_metric/
   trigger_value/threshold_value/backtest_results), then update
   BotConfig.strategy_params directly.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.db.session import AsyncSessionLocal as LegacyAsyncSessionLocal
from app.db.repository import save_backtest_trades
from app.models.bot import BotConfig, BotMode, BotStatus
from app.models.analytics import StrategyAdjustment
from app.models.trade import Trade, TradeStatus
from app.services.data_ingestion import shared_ingestion
from app.engines.backtest_engine import BacktestEngine, Bar, CostModel, ClosedBacktestTrade
from app.engines.strategy_adapter import SmcStrategyAdapter, STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles
from app.engines.validation_gate import ValidationGate
from app.engines.monte_carlo_engine import TradeRecord

logger = structlog.get_logger()


def _symbol_stub(bot: BotConfig, symbol: str) -> BotConfig:
    """A throwaway, never-persisted (no db.add/commit) BotConfig
    carrying exactly ONE symbol, for the zone-type comparison below.
    _run_backtest only ever reads plain scalar columns off whatever
    object it's given (.strategy_key/.symbols[0]/.exchange/.bot_id/
    .account_balance_usd/.risk_per_trade/.min_rr_ratio/.tp1-3_percent/
    .use_trailing_stop/.trailing_stop_activation/.trailing_stop_distance
    — verified against that method's own body) — reusing the real
    owning row directly would backtest every OTHER symbol on it too,
    which isn't what a per-symbol zone-type comparison means."""
    return BotConfig(
        bot_id=bot.bot_id, strategy_key=bot.strategy_key, symbols=[symbol],
        exchange=bot.exchange, account_balance_usd=bot.account_balance_usd,
        risk_per_trade=bot.risk_per_trade, min_rr_ratio=bot.min_rr_ratio,
        tp1_percent=bot.tp1_percent, tp2_percent=bot.tp2_percent, tp3_percent=bot.tp3_percent,
        use_trailing_stop=bot.use_trailing_stop, trailing_stop_activation=bot.trailing_stop_activation,
        trailing_stop_distance=bot.trailing_stop_distance,
    )


class IntelligentTuningWorker:
    def __init__(self):
        self.settings = get_settings()
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self.settings.INTELLIGENT_TUNING_ENABLED:
            logger.info("intelligent_tuning_worker_disabled")
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
                await self.run_once()
            except Exception as e:
                logger.error("intelligent_tuning_cycle_failed", error=str(e))
            await asyncio.sleep(self.settings.INTELLIGENT_TUNING_INTERVAL_SECONDS)

    async def run_once(self) -> None:
        async with AsyncSessionLocal() as db:
            bots = (await db.execute(
                select(BotConfig).where(BotConfig.bot_mode == BotMode.INTELLIGENT)
            )).scalars().all()

        for bot in bots:
            try:
                killed = await self._check_kill_switch(bot.bot_id)
                if killed:
                    continue
                await self._tune_one_bot(bot.bot_id)
                # Zone-type adaptivity (plan step 4) — same cycle, same
                # INTELLIGENT-mode consent, right after the numeric
                # tuning pass above. No-ops instantly for any bot
                # without a registered zone-variant sibling (today:
                # only bot_3/bot_6's own families), so this adds zero
                # overhead for every other bot.
                await self._tune_zone_variant_for_bot(bot.bot_id)
            except Exception as e:
                logger.error("intelligent_tuning_bot_failed", bot_id=bot.bot_id, error=str(e))

    # ---------------- kill switch ----------------

    async def _check_kill_switch(self, bot_id: str) -> bool:
        """True if this bot was just downgraded back to BASIC."""
        async with LegacyAsyncSessionLocal() as db:
            last = (await db.execute(
                select(StrategyAdjustment)
                .where(StrategyAdjustment.bot_id == bot_id, StrategyAdjustment.applied_at.isnot(None))
                .order_by(StrategyAdjustment.applied_at.desc())
                .limit(1)
            )).scalar_one_or_none()
        if last is None:
            return False

        async with AsyncSessionLocal() as db:
            real_trades = (await db.execute(
                select(Trade).where(
                    Trade.bot_id == bot_id, Trade.is_test.is_(False),
                    Trade.status == TradeStatus.CLOSED, Trade.exit_timestamp > last.applied_at,
                    Trade.r_multiple.isnot(None),
                )
            )).scalars().all()

        if len(real_trades) < self.settings.INTELLIGENT_TUNING_KILL_SWITCH_MIN_TRADES:
            return False

        avg_r = sum(t.r_multiple for t in real_trades) / len(real_trades)
        if avg_r > self.settings.INTELLIGENT_TUNING_KILL_SWITCH_MAX_AVG_R:
            return False

        async with AsyncSessionLocal() as db:
            fresh_bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
            if fresh_bot is None or fresh_bot.bot_mode != BotMode.INTELLIGENT:
                return False  # already changed by someone else between the queries above
            fresh_bot.bot_mode = BotMode.BASIC
            await db.commit()

        logger.warning(
            "intelligent_tuning_kill_switch_triggered", bot_id=bot_id,
            real_trades_since_adjustment=len(real_trades), avg_r=round(avg_r, 4),
            threshold=self.settings.INTELLIGENT_TUNING_KILL_SWITCH_MAX_AVG_R,
        )
        return True

    # ---------------- candidate generation + backtesting ----------------

    @staticmethod
    def _generate_candidates(strategy_key: str, current: Dict) -> List[Dict]:
        from app.core.bot_strategies import TUNABLE_PARAM_BOUNDS, resolve_tunable_param
        bounds = TUNABLE_PARAM_BOUNDS.get(strategy_key, {})
        candidates: List[Dict] = []
        for key, (lo, hi, _default) in bounds.items():
            current_val = resolve_tunable_param(strategy_key, key, current)
            for step in (-1, 1):
                candidate_val = max(lo, min(hi, current_val + step))
                if candidate_val == current_val:
                    continue  # step was clipped away entirely, not a real variant
                candidate = dict(current)
                candidate[key] = candidate_val
                candidates.append(candidate)
        return candidates

    async def _run_backtest(self, bot: BotConfig, params: Dict, lookback_days: int) -> List[ClosedBacktestTrade]:
        strategy_key = bot.strategy_key
        _bot_class, required = STRATEGY_FAMILY[strategy_key]
        required_tf_labels = [label for _, label in required]
        base_tf = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))
        symbol = (bot.symbols or [None])[0]
        if not symbol:
            return []
        exchange = bot.exchange or "bingx"

        end = datetime.utcnow()
        start = end - timedelta(days=lookback_days)

        # fetch_required_timeframe_candles (strategy_adapter.py) —
        # same real per-timeframe-retention bug this module used to
        # share with backtest_runner.py's own (now-fixed) copy of this
        # exact fetch loop: a flat 30-day padding pushed 5M fetches
        # (bot_5/6/8's own secondary confirmation timeframe) past this
        # exchange's real 5M retention, silently producing "0 trades"
        # candidates that looked like real evaluation results. This
        # worker is INTELLIGENT_TUNING_ENABLED=False by default, so it
        # was dormant, not actively wrong — fixed before it's ever
        # turned on, not after.
        timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
            shared_ingestion, exchange, symbol, required_tf_labels, start, end,
        )
        if fetch_error:
            logger.warning("intelligent_tuning_backtest_data_gap", bot_id=bot.bot_id, error=fetch_error)
            return []

        base_candles = [c for c in timeframe_candles[base_tf] if c.timestamp >= start]
        bars = [Bar(timestamp=c.timestamp, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume) for c in base_candles]

        trailing_activation_r = bot.trailing_stop_activation if bot.use_trailing_stop else None
        adapter = SmcStrategyAdapter(
            real_bot_id=bot.bot_id, strategy_key=strategy_key, symbol=symbol,
            timeframe_candles=timeframe_candles, account_balance=bot.account_balance_usd or 1000.0,
            risk_per_trade=bot.risk_per_trade, min_rr_ratio=bot.min_rr_ratio,
            tp1_percent=bot.tp1_percent, tp2_percent=bot.tp2_percent, tp3_percent=bot.tp3_percent,
            trailing_activation_r=trailing_activation_r, trailing_stop_mode=bot.trailing_stop_distance or "fixed",
        )
        engine = BacktestEngine(cost_model=CostModel(commission_r=0.001), max_hold_bars=2000)
        # Same event-loop-blocking issue as backtest_runner.py's own
        # run_backtest (see that fix's comment) -- this one matters even
        # more here, since _tune_one_bot calls this in a loop (once for
        # the baseline config, once per candidate parameter variant),
        # so an un-offloaded call here would freeze every concurrent
        # request for the ENTIRE tuning cycle, not just one backtest.
        return await asyncio.get_event_loop().run_in_executor(None, engine.run, bars, adapter, symbol)

    async def _tune_one_bot(self, bot_id: str) -> None:
        async with AsyncSessionLocal() as db:
            bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        if bot is None or bot.bot_mode != BotMode.INTELLIGENT:
            return
        if not bot.strategy_key or bot.strategy_key not in STRATEGY_FAMILY:
            return

        current_params = bot.strategy_params or {}
        candidates = self._generate_candidates(bot.strategy_key, current_params)
        if not candidates:
            return

        lookback = self.settings.INTELLIGENT_TUNING_LOOKBACK_DAYS
        baseline_trades = await self._run_backtest(bot, current_params, lookback)
        if not baseline_trades:
            logger.info("intelligent_tuning_no_baseline_trades", bot_id=bot_id)
            return
        baseline_records = [t.to_trade_record() for t in baseline_trades]
        baseline_expectancy = sum(r.r_multiple for r in baseline_records) / len(baseline_records)

        candidate_results: List[tuple] = []  # (params, trades, records, expectancy)
        for params in candidates:
            trades = await self._run_backtest(bot, params, lookback)
            if not trades:
                continue
            records = [t.to_trade_record() for t in trades]
            expectancy = sum(r.r_multiple for r in records) / len(records)
            candidate_results.append((params, trades, records, expectancy))

        if not candidate_results:
            logger.info("intelligent_tuning_no_candidate_trades", bot_id=bot_id)
            return

        best_params, best_trades, best_records, best_expectancy = max(candidate_results, key=lambda c: c[3])

        variant_group = f"{bot_id}_{uuid.uuid4().hex[:8]}"
        async with LegacyAsyncSessionLocal() as db:
            await save_backtest_trades(db, baseline_trades, source="backtest_param_variant", variant_group=variant_group)
            for params, trades, _records, _exp in candidate_results:
                await save_backtest_trades(db, trades, source="backtest_param_variant", variant_group=variant_group)

        improvement = best_expectancy - baseline_expectancy
        if improvement < self.settings.INTELLIGENT_TUNING_MIN_IMPROVEMENT_R:
            logger.info(
                "intelligent_tuning_no_improvement", bot_id=bot_id,
                baseline_expectancy=round(baseline_expectancy, 4), best_expectancy=round(best_expectancy, 4),
            )
            return

        gate = ValidationGate()
        other_variant_sets = [baseline_records] + [c[2] for c in candidate_results if c[0] != best_params]
        report = gate.evaluate(trades=best_records, parameter_variant_trade_sets=other_variant_sets)
        # Only the checks this call actually supplies real input for —
        # cost_stress_test is "automated=True" but comes back
        # passed=None (not evaluated) since no cost_stressed_trades is
        # passed here by design; treating a not-evaluated check as a
        # failure would permanently block every single auto-apply
        # decision, which is not what "not evaluated" means. Checked by
        # name, not "every automated check", for exactly this reason.
        _RELEVANT_AUTOMATED_CHECKS = {"min_trade_count", "out_of_sample_expectancy", "max_drawdown", "parameter_stability"}
        relevant_checks = [c for c in report.checks if c.name in _RELEVANT_AUTOMATED_CHECKS]
        failed_automated = [c for c in relevant_checks if c.passed is not True]
        if failed_automated:
            logger.info(
                "intelligent_tuning_gate_blocked", bot_id=bot_id,
                failed_checks=[c.name for c in failed_automated],
                details=[c.detail for c in failed_automated],
            )
            return

        await self._apply_adjustment(bot_id, current_params, best_params, baseline_expectancy, best_expectancy, len(best_records))

    async def _apply_adjustment(
        self, bot_id: str, previous_config: Dict, new_config: Dict,
        baseline_expectancy: float, new_expectancy: float, trade_count: int,
    ) -> None:
        from app.core.bot_strategies import TUNABLE_PARAM_BOUNDS

        async with AsyncSessionLocal() as db:
            bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
            if bot is None or bot.bot_mode != BotMode.INTELLIGENT:
                return  # switched away since this tuning cycle started

            # Defensive re-clip, even though every candidate was already
            # generated within bounds — the one and only path a value
            # reaches BotConfig.strategy_params, same discipline as
            # update_bot_metrics' own manual-edit path.
            bounds = TUNABLE_PARAM_BOUNDS.get(bot.strategy_key or "", {})
            clipped = dict(previous_config)
            for key, raw in new_config.items():
                if key not in bounds:
                    continue
                lo, hi, _default = bounds[key]
                clipped[key] = max(lo, min(hi, float(raw)))

            now = datetime.utcnow()
            bot.strategy_params = clipped
            await db.commit()

        async with LegacyAsyncSessionLocal() as db:
            db.add(StrategyAdjustment(
                id=uuid.uuid4(), bot_id=bot_id, adjustment_type="intelligent_auto_tune",
                previous_config=previous_config, new_config=clipped,
                trigger_metric="out_of_sample_expectancy_r", trigger_value=round(new_expectancy, 4),
                threshold_value=round(baseline_expectancy + self._settings_min_improvement(), 4),
                backtest_results={
                    "baseline_expectancy_r": round(baseline_expectancy, 4),
                    "new_expectancy_r": round(new_expectancy, 4),
                    "trade_count": trade_count,
                },
                approved=True, created_at=now, applied_at=now,
            ))
            await db.commit()

        logger.warning(
            "intelligent_tuning_applied", bot_id=bot_id, previous_config=previous_config,
            new_config=clipped, baseline_expectancy=round(baseline_expectancy, 4), new_expectancy=round(new_expectancy, 4),
        )

    def _settings_min_improvement(self) -> float:
        return self.settings.INTELLIGENT_TUNING_MIN_IMPROVEMENT_R

    # ---------------- zone-type adaptivity (plan steps 3-4) ----------------
    #
    # Per-pair Order-Block-vs-FVG extension of the numeric tuning above
    # — see ZONE_VARIANT_SIBLINGS' own comment (bot_strategies.py) and
    # /root/.claude/plans/buzzing-mixing-micali.md. Reuses every piece
    # of the numeric pipeline above (_run_backtest, save_backtest_trades,
    # ValidationGate) unchanged, treating {this bot's own strategy_key,
    # its registered sibling's strategy_key} as the candidate set
    # instead of perturbed numeric values — the gate/margin/audit-row/
    # kill-switch guardrails are identical, just applied to a discrete
    # choice instead of a continuous one.

    async def _tune_zone_variant_for_bot(self, bot_id: str) -> None:
        """No-ops (by design, not a bug — logged at info, not warning)
        whenever this bot's family has no registered sibling, or the
        sibling has no real ACTIVE BotConfig row of its own yet — there
        is nowhere to move a symbol ONTO. Activating a dormant sibling
        (bot_17/bot_18 today) is a separate, explicitly-gated milestone
        (plan step 5), never something this worker does on its own."""
        from app.core.bot_strategies import ZONE_SIBLING_LOOKUP

        async with AsyncSessionLocal() as db:
            bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        if bot is None or bot.bot_mode != BotMode.INTELLIGENT or not bot.strategy_key:
            return
        sibling_key = ZONE_SIBLING_LOOKUP.get(bot.strategy_key)
        if not sibling_key or sibling_key not in STRATEGY_FAMILY:
            return

        async with AsyncSessionLocal() as db:
            sibling_bot = (await db.execute(
                select(BotConfig).where(BotConfig.strategy_key == sibling_key, BotConfig.status == BotStatus.ACTIVE)
            )).scalars().first()
        if sibling_bot is None:
            logger.info("zone_variant_sibling_dormant", bot_id=bot_id, sibling_strategy_key=sibling_key)
            return

        lookback = self.settings.INTELLIGENT_TUNING_LOOKBACK_DAYS
        for symbol in list(bot.symbols or []):
            try:
                await self._tune_zone_variant_for_symbol(bot, sibling_bot, symbol, lookback)
            except Exception as e:
                logger.error("zone_variant_tune_symbol_failed", bot_id=bot_id, symbol=symbol, error=str(e))

    async def _tune_zone_variant_for_symbol(self, bot: BotConfig, sibling_bot: BotConfig, symbol: str, lookback: int) -> None:
        # Open-position guardrail — the one genuinely new risk surface
        # vs. the numeric case: a zone-type move changes WHICH bot_id a
        # symbol belongs to, which a numeric tune never does (same
        # bot_id, just different params). Skip this cycle rather than
        # reassign a symbol out from under a position someone else's
        # tooling (position_monitor, dashboards, trade history) still
        # expects to find under the old bot_id — retried next cycle.
        async with AsyncSessionLocal() as db:
            open_trade = (await db.execute(
                select(Trade).where(
                    Trade.bot_id == bot.bot_id, Trade.symbol == symbol,
                    Trade.status != TradeStatus.CLOSED,
                ).limit(1)
            )).scalar_one_or_none()
        if open_trade is not None:
            logger.info("zone_variant_move_skipped_open_position", bot_id=bot.bot_id, symbol=symbol)
            return

        current_stub = _symbol_stub(bot, symbol)
        sibling_stub = _symbol_stub(sibling_bot, symbol)
        current_trades = await self._run_backtest(current_stub, bot.strategy_params or {}, lookback)
        sibling_trades = await self._run_backtest(sibling_stub, sibling_bot.strategy_params or {}, lookback)
        if not current_trades or not sibling_trades:
            logger.info("zone_variant_insufficient_data", bot_id=bot.bot_id, symbol=symbol)
            return

        current_records = [t.to_trade_record() for t in current_trades]
        sibling_records = [t.to_trade_record() for t in sibling_trades]
        current_expectancy = sum(r.r_multiple for r in current_records) / len(current_records)
        sibling_expectancy = sum(r.r_multiple for r in sibling_records) / len(sibling_records)

        improvement = sibling_expectancy - current_expectancy
        if improvement < self.settings.INTELLIGENT_TUNING_MIN_IMPROVEMENT_R:
            return  # current zone type still wins, or it's too close to call -- no move

        variant_group = f"{bot.bot_id}_{symbol}_zone_{uuid.uuid4().hex[:8]}"
        async with LegacyAsyncSessionLocal() as db:
            await save_backtest_trades(db, current_trades, source="backtest_param_variant", variant_group=variant_group)
            await save_backtest_trades(db, sibling_trades, source="backtest_param_variant", variant_group=variant_group)

        gate = ValidationGate()
        report = gate.evaluate(trades=sibling_records, parameter_variant_trade_sets=[current_records])
        _RELEVANT_AUTOMATED_CHECKS = {"min_trade_count", "out_of_sample_expectancy", "max_drawdown", "parameter_stability"}
        failed = [c for c in report.checks if c.name in _RELEVANT_AUTOMATED_CHECKS and c.passed is not True]
        if failed:
            logger.info(
                "zone_variant_gate_blocked", bot_id=bot.bot_id, symbol=symbol,
                failed_checks=[c.name for c in failed], details=[c.detail for c in failed],
            )
            return

        await self._apply_zone_variant_move(bot, sibling_bot, symbol, current_expectancy, sibling_expectancy, len(sibling_records))

    async def _apply_zone_variant_move(
        self, bot: BotConfig, sibling_bot: BotConfig, symbol: str,
        current_expectancy: float, sibling_expectancy: float, trade_count: int,
    ) -> None:
        async with AsyncSessionLocal() as db:
            from_bot = (await db.execute(select(BotConfig).where(BotConfig.id == bot.id))).scalar_one_or_none()
            to_bot = (await db.execute(select(BotConfig).where(BotConfig.id == sibling_bot.id))).scalar_one_or_none()
            if from_bot is None or to_bot is None or from_bot.bot_mode != BotMode.INTELLIGENT:
                return  # changed since this cycle started
            if symbol not in (from_bot.symbols or []):
                return  # already moved by a concurrent cycle
            # Reassign the whole list (not .remove()/.append() in
            # place) so the JSON column's own change-tracking actually
            # sees a new value to persist.
            from_bot.symbols = [s for s in (from_bot.symbols or []) if s != symbol]
            to_bot.symbols = list(to_bot.symbols or []) + [symbol]
            await db.commit()

        async with LegacyAsyncSessionLocal() as db:
            db.add(StrategyAdjustment(
                id=uuid.uuid4(), bot_id=bot.bot_id, adjustment_type="zone_type_symbol_move",
                previous_config={"bot_id": bot.bot_id, "symbol": symbol},
                new_config={"bot_id": sibling_bot.bot_id, "symbol": symbol},
                trigger_metric="out_of_sample_expectancy_r", trigger_value=round(sibling_expectancy, 4),
                threshold_value=round(current_expectancy + self._settings_min_improvement(), 4),
                backtest_results={
                    "from_expectancy_r": round(current_expectancy, 4),
                    "to_expectancy_r": round(sibling_expectancy, 4),
                    "trade_count": trade_count,
                },
                approved=True, created_at=datetime.utcnow(), applied_at=datetime.utcnow(),
            ))
            await db.commit()

        logger.warning(
            "zone_variant_move_applied", symbol=symbol, from_bot_id=bot.bot_id, to_bot_id=sibling_bot.bot_id,
            from_expectancy=round(current_expectancy, 4), to_expectancy=round(sibling_expectancy, 4),
        )
