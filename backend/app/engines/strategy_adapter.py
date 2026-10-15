"""
SmcStrategyAdapter — the missing bridge between BacktestEngine's
no-lookahead bar replay and the real 7 bot classes in
app.core.bot_strategies / app.core.smc_algorithms.

Both of those modules are already pure functions of plain candle
lists (confirmed: no DB session parameter, no network call, no
`await` anywhere in any bot's own .analyze() body) — this file does
NOT reimplement any detection/entry/stop/target logic. It only:

  1. Dispatches to the correct bot CLASS by strategy family
     ("bot_1".."bot_7", BotConfig.strategy_key), since one real BotConfig
     row's bot_id (e.g. "bot_2_ob_reversal_3") can share a strategy
     family with several other rows — exactly how BotOrchestrator.bots
     is itself keyed, by family, not by real row.
  2. Assembles each bot's own required multi-timeframe candle kwargs
     (bot_strategies.py's own `.analyze(candles_1d=..., candles_4h=...,
     ...)` signatures, verified directly against the real source, not
     guessed) from a pre-fetched, full-window candle set per timeframe,
     truncated EVERY timeframe (not just the base one BarWindow itself
     protects) to "most recently closed bar at or before the base
     timeframe's current bar timestamp" — this is the actual
     no-lookahead guarantee for the multi-timeframe case; BarWindow
     alone only protects the single base-timeframe stream the engine
     iterates on.
  3. Converts the resulting BotSignal (TP1/TP2/TP3, stop, entry) into
     BacktestEngine's BacktestSignal + LadderLeg list, using the exact
     same fraction math position_monitor.py's own _target_fraction
     uses live (ported here as a pure function, no DB) — so a backtest
     replays the same partial-exit ladder a live/paper trade would
     actually get, not a simplified single-target approximation.
"""

from __future__ import annotations

import bisect
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from app.core.bot_strategies import BOT_REGISTRY, BotSignal, _signal_risk_is_valid
from app.core.smc_algorithms import Candle
from app.engines.backtest_engine import BacktestSignal, BarWindow, LadderLeg

# strategy_key ("bot_1".."bot_11", BotConfig.strategy_key) -> (bot
# class, ordered [(analyze() kwarg name, timeframe label as used in
# market_scanner.py / Candle fetches, e.g. "1D"/"4H"/"1H"/"15M"/"5M")]).
#
# Just an alias for BOT_REGISTRY now — by direct request, after a real
# bug: this used to be its OWN hand-maintained copy of
# BotOrchestrator's bot roster, which silently went stale the moment
# Bots 8-11 were added there and not here (every one of them was
# unbacktestable, "Unknown strategy_key", from the moment it was
# built). See BOT_REGISTRY's own comment (bot_strategies.py) for the
# permanent fix: one registry, not two, so this file can never drift
# from the live bot roster again.
STRATEGY_FAMILY: Dict[str, tuple] = BOT_REGISTRY


def ladder_fraction(idx: int, configured_levels: List[int], tp1_percent: Optional[float], tp2_percent: Optional[float], tp3_percent: Optional[float]) -> float:
    """Pure port of position_monitor.py's _target_fraction — "what
    fraction of the CURRENT remaining size to close at
    configured_levels[idx]" — minus the DB lookup (the caller already
    knows which BotConfig this backtest run is for) and the
    manual-trade fallback (a backtest is always for one specific bot).
    Defaults to an even split across whatever levels remain when the
    configured percents are missing/zero, exactly like the live
    version's own fallback."""
    remaining = len(configured_levels) - idx
    even = 1.0 / remaining
    percents = [tp1_percent or 0, tp2_percent or 0, tp3_percent or 0]
    remaining_levels = configured_levels[idx:]
    remaining_percents = [percents[level - 1] for level in remaining_levels]
    total = sum(remaining_percents)
    if total <= 0:
        return even
    return remaining_percents[0] / total


class SmcStrategyAdapter:
    """One instance per (real bot_id, symbol) backtest run — implements
    BacktestEngine's StrategyAdapter protocol."""

    def __init__(
        self,
        real_bot_id: str,
        strategy_key: str,
        symbol: str,
        timeframe_candles: Dict[str, List[Candle]],
        account_balance: float,
        risk_per_trade: Optional[float] = None,
        min_rr_ratio: Optional[float] = None,
        tp1_percent: Optional[float] = None,
        tp2_percent: Optional[float] = None,
        tp3_percent: Optional[float] = None,
        trailing_activation_r: Optional[float] = None,
    ):
        if strategy_key not in STRATEGY_FAMILY:
            raise ValueError(f"Unknown strategy_key {strategy_key!r} — expected one of {sorted(STRATEGY_FAMILY)}")
        bot_class, self._required_tfs = STRATEGY_FAMILY[strategy_key]
        self._bot = bot_class({})
        self._real_bot_id = real_bot_id
        self._symbol = symbol
        self._timeframe_candles = timeframe_candles
        self._account_balance = account_balance
        self._risk_per_trade = risk_per_trade
        self._min_rr_ratio = min_rr_ratio
        self._tp1_percent = tp1_percent
        self._tp2_percent = tp2_percent
        self._tp3_percent = tp3_percent
        self._trailing_activation_r = trailing_activation_r
        # Precomputed once so the per-bar truncation below is a bisect
        # (O(log n)) rather than an O(n) scan repeated for every one of
        # potentially thousands of base-timeframe bars in a multi-month
        # backtest (O(n^2) total otherwise).
        self._tf_timestamps = {tf: [c.timestamp for c in candles] for tf, candles in timeframe_candles.items()}

    def evaluate(self, window: BarWindow, context: Dict) -> Optional[BacktestSignal]:
        now_ts = window.current.timestamp
        kwargs = {}
        for kwarg_name, tf_label in self._required_tfs:
            candles = self._timeframe_candles.get(tf_label, [])
            timestamps = self._tf_timestamps.get(tf_label, [])
            # Most recently CLOSED bar at or before now_ts: bisect_right
            # finds the insertion point just after an exact timestamp
            # match too, so candles[:idx] never includes a bar whose
            # timestamp is strictly after now_ts.
            idx = bisect.bisect_right(timestamps, now_ts)
            kwargs[kwarg_name] = candles[:idx]

        # Isolated-mode callers never set this, so they keep using the
        # fixed balance given at construction time (this bot's own
        # static reference balance, matching live sizing exactly, per
        # the approved plan). Portfolio mode is the one caller that
        # DOES set it, per-call — every bot in a portfolio run draws
        # against the SAME compounding shared ledger balance, which
        # only the orchestrator (not this adapter, constructed once
        # up front) knows the current value of.
        account_balance = context.get("account_balance", self._account_balance)

        signal: Optional[BotSignal] = self._bot.analyze(
            **kwargs,
            account_balance=account_balance,
            symbol=self._symbol,
            risk_per_trade=self._risk_per_trade,
            min_rr_ratio=self._min_rr_ratio,
            bot_id=self._real_bot_id,
        )
        if signal is None:
            return None

        # Same centralized risk-geometry gate every live/paper signal
        # passes through in BotOrchestrator._collect — a backtest must
        # reject exactly what live trading would reject, not trust
        # every raw signal a bot class produces. Same account_balance
        # basis as the sizing call above (dynamic for portfolio mode).
        ok, _reason = _signal_risk_is_valid(signal, account_balance)
        if not ok:
            return None

        return self._to_backtest_signal(signal)

    def _to_backtest_signal(self, signal: BotSignal) -> BacktestSignal:
        configured = [(1, signal.take_profit), (2, signal.take_profit_2), (3, signal.take_profit_3)]
        configured = [(lvl, price) for lvl, price in configured if price is not None]
        if not configured:
            # Shouldn't happen — every bot sets at least TP1 — but
            # defensive rather than crashing a whole backtest run on
            # one malformed signal.
            return BacktestSignal(direction=signal.direction, stop_price=signal.stop_loss, target_price=signal.stop_loss, bot_id=signal.bot_id, reason="no_take_profit_on_signal")

        levels_only = [lvl for lvl, _ in configured]
        _last_level, last_price = configured[-1]
        ladder_legs: List[LadderLeg] = [
            LadderLeg(level=lvl, price=price, fraction=ladder_fraction(idx, levels_only, self._tp1_percent, self._tp2_percent, self._tp3_percent))
            for idx, (lvl, price) in enumerate(configured[:-1])
        ]

        return BacktestSignal(
            direction=signal.direction,
            stop_price=signal.stop_loss,
            target_price=last_price,
            bot_id=signal.bot_id,
            reason=signal.reasoning,
            ladder=ladder_legs or None,
            trailing_activation_r=self._trailing_activation_r,
            initial_stop_price=signal.stop_loss,
            lot_size=signal.lot_size,
        )


# ccxt timeframe strings + lookback padding — by direct request
# ("FIX PORTAL WIDE permanently"), consolidated here after the same
# constants (and the same silent-failure bug) were found independently
# duplicated in both backtest_runner.py and intelligent_tuning_worker.py:
# a single flat 30-day padding, applied uniformly to every required
# timeframe including 5M, routinely requests 5M candles from past an
# exchange's real retention window (confirmed empirically on bingx:
# 5m candles available ~44 days back, empty at ~46+) — and because the
# BASE replay timeframe for bot_5/6/8 is 4H/1H (not 5M, which they only
# use secondarily for FVG confirmation), the existing "no base candles"
# guard never caught it: the backtest just silently produced "0
# trades" that looked exactly like a real null result. Caught live:
# Bot 5/6/8 all "backtested" to 0 signals on a real 60-day BTC window
# despite having real live trades inside that same window.
TF_TO_CCXT = {"1D": "1d", "4H": "4h", "1H": "1h", "15M": "15m", "5M": "5m"}
TF_ORDER = ["1D", "4H", "1H", "15M", "5M"]
# Roughly 200-300 bars of real wall-clock context per timeframe,
# rounded up for safety — NOT one flat value sized for the coarsest
# timeframe and misapplied to the finest one.
LOOKBACK_PADDING_DAYS_BY_TF = {"1D": 220, "4H": 40, "1H": 10, "15M": 3, "5M": 1}


async def fetch_required_timeframe_candles(
    shared_ingestion, exchange: str, symbol: str, required_tf_labels: List[str],
    start_date: datetime, end_date: datetime,
) -> Tuple[Dict[str, List[Candle]], Optional[str]]:
    """Fetches every timeframe a strategy family needs, with real
    per-timeframe lookback padding, then verifies EVERY one of them
    (not just the base/replay timeframe — see this function's own
    module docstring) actually has candles inside [start_date,
    end_date] before the caller trusts any of it. Returns
    (timeframe_candles, error_message) — error_message is None on
    success, otherwise names exactly which timeframe/window had no
    real data, so a genuine data-availability gap is never mistaken
    for a legitimate zero-signal backtest result again."""
    timeframe_candles: Dict[str, List[Candle]] = {}
    for label in required_tf_labels:
        fetch_start = start_date - timedelta(days=LOOKBACK_PADDING_DAYS_BY_TF.get(label, 30))
        timeframe_candles[label] = await shared_ingestion.fetch_historical_range(
            exchange, symbol, TF_TO_CCXT[label], start=fetch_start, end=end_date,
        )

    for label in required_tf_labels:
        in_window = [c for c in timeframe_candles[label] if c.timestamp >= start_date]
        if not in_window:
            return timeframe_candles, (
                f"No {label} candles returned for {symbol} on {exchange} in the requested window "
                f"({start_date.date()} to {end_date.date()}) — likely past this exchange's real "
                f"retention for that timeframe, not a genuine zero-signal result."
            )
    return timeframe_candles, None
