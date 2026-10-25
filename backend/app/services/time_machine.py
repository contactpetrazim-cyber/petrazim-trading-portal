"""
Time Machine — pre-trade odds via resampled real price history
===================================================================

Answers a different question than app/engines/monte_carlo_engine.py:
that engine bootstrap-resamples a SEQUENCE OF PAST TRADE OUTCOMES (R-
multiples) to project a future equity curve's distribution. This instead
takes a SINGLE proposed trade (entry/stop/target, not yet taken) and asks:
given how this exact symbol actually moves bar-to-bar, what are the real
odds this specific plan hits its target before its stop?

Algorithm (ported in spirit from the MIT-licensed trader-timemachine skill,
github.com/Jakeschincariol/day-trader-skill -- same core idea, rebuilt here
for a 24/7 crypto perpetual market instead of a single NYSE equity session,
sourced from this app's own real candle history via shared_ingestion instead
of Yahoo Finance, and fully numpy-vectorized rather than a per-replay Python
loop):

1. Fetch `lookback_days` of real `timeframe` candles for the symbol (the
   same proxy-failover `shared_ingestion.fetch_historical_range` the
   backtest engine's own StrategyAdapter already uses).
2. Slice history into non-overlapping `horizon_bars`-long "sessions". Each
   bar becomes 4 ratios to the PREVIOUS bar's close: open/high/low/close
   over prev_close -- a session's own shape, independent of its price level,
   so it can be rescaled onto any current price.
3. One replay: start at `entry`. For each of `horizon_bars` steps, pick a
   random past session and a random offset within `window` bars of the
   current step (same mechanic as the source skill -- samples from roughly
   the same relative position in the horizon, not a uniformly random bar),
   scale that bar's ratios onto the running price. Stop is checked before
   target every bar (a bar touching both counts as the stop -- the
   pessimistic convention app/engines/backtest_engine.py's own CostModel/
   stop-target resolution already uses, kept consistent here).
4. `replays` of these run simultaneously as numpy arrays (one Python loop
   over `horizon_bars` steps, not over replays) -- fast enough to run
   thousands of replays in well under a second, and specifically run in a
   thread via run_in_executor by the router so this CPU-bound work never
   blocks the event loop (see app/services/market_scanner.py's own
   blocking-call bug, which this is deliberately built to NOT repeat).
5. "History": the exact same rule applied to every REAL past session
   (offset 0, no randomness) instead of a resampled one -- what actually
   happened, not a simulation.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

import numpy as np

from app.core.smc_algorithms import Candle
from app.services.data_ingestion import shared_ingestion

DEFAULT_REPLAYS = 10_000
DEFAULT_WINDOW = 2
DEFAULT_LOOKBACK_DAYS = 60
MIN_SESSIONS = 20


class TimeMachineError(Exception):
    pass


@dataclass
class _Pool:
    # ratios[session, bar, 0..3] = open/high/low/close / prev_close
    ratios: np.ndarray  # shape (n_sessions, horizon_bars, 4)
    n_sessions: int
    horizon_bars: int


def _build_pool(candles: List[Candle], horizon_bars: int) -> _Pool:
    closes = np.array([c.close for c in candles])
    opens = np.array([c.open for c in candles])
    highs = np.array([c.high for c in candles])
    lows = np.array([c.low for c in candles])
    prev_close = np.roll(closes, 1)
    prev_close[0] = closes[0]  # first bar has no predecessor -- ratio ~1, discarded below anyway

    n_bars = len(candles)
    n_sessions = n_bars // horizon_bars
    if n_sessions < MIN_SESSIONS:
        raise TimeMachineError(
            f"Only {n_sessions} full {horizon_bars}-bar sessions in {n_bars} candles -- "
            f"need at least {MIN_SESSIONS}. Try a shorter horizon or a longer lookback."
        )
    usable = n_sessions * horizon_bars
    # Drop bar 0 of the whole series (no real prev_close) by starting the
    # windowing one bar in -- negligible (one bar out of thousands) and
    # keeps every session's own internal ratios genuinely bar-to-bar.
    o = opens[1 : usable + 1].reshape(n_sessions, horizon_bars)
    h = highs[1 : usable + 1].reshape(n_sessions, horizon_bars)
    l = lows[1 : usable + 1].reshape(n_sessions, horizon_bars)
    cl = closes[1 : usable + 1].reshape(n_sessions, horizon_bars)
    pc = prev_close[1 : usable + 1].reshape(n_sessions, horizon_bars)
    pc[pc == 0] = 1e-9  # guard against a zero prev_close on bad data
    ratios = np.stack([o / pc, h / pc, l / pc, cl / pc], axis=-1)
    return _Pool(ratios=ratios, n_sessions=n_sessions, horizon_bars=horizon_bars)


def _simulate(
    pool: _Pool, *, entry: float, stop: float, target: float, direction: Literal["long", "short"],
    n_paths: int, window: int, rng: np.random.Generator, session_indices: Optional[np.ndarray] = None,
) -> Dict[str, np.ndarray]:
    """Runs n_paths simultaneously. If session_indices is given (shape
    (n_paths,), one entry per path, offset always 0), this is a
    deterministic "history" run instead of a random resample."""
    price = np.full(n_paths, entry, dtype=float)
    resolved = np.zeros(n_paths, dtype=bool)
    outcome = np.full(n_paths, "neither", dtype=object)
    resolved_step = np.full(n_paths, -1, dtype=int)
    path_high = np.full((n_paths, pool.horizon_bars + 1), entry, dtype=float)  # for the fan chart
    path_high[:, 0] = entry

    is_long = direction == "long"
    for step in range(pool.horizon_bars):
        if session_indices is None:
            sess = rng.integers(0, pool.n_sessions, size=n_paths)
            offset = rng.integers(-window, window + 1, size=n_paths)
            slot = np.clip(step + offset, 0, pool.horizon_bars - 1)
        else:
            sess = session_indices
            slot = np.full(n_paths, step)

        bar_ratios = pool.ratios[sess, slot]  # (n_paths, 4): open,high,low,close
        o, h, l, c = bar_ratios[:, 0] * price, bar_ratios[:, 1] * price, bar_ratios[:, 2] * price, bar_ratios[:, 3] * price

        if is_long:
            hit_stop = l <= stop
            hit_target = h >= target
        else:
            hit_stop = h >= stop
            hit_target = l <= target
        # Stop checked first every bar -- a bar touching both is a stop.
        new_stop = hit_stop & ~resolved
        new_target = hit_target & ~hit_stop & ~resolved
        outcome[new_stop] = "stop"
        outcome[new_target] = "target"
        resolved_step[new_stop | new_target] = step
        resolved = resolved | new_stop | new_target

        price = c  # unresolved AND resolved paths keep evolving (for the fan chart's own full-horizon shape)
        path_high[:, step + 1] = price

    r_risk = abs(entry - stop)
    if r_risk <= 0:
        raise TimeMachineError("Stop must be a nonzero distance from entry.")
    target_r = abs(target - entry) / r_risk
    final_price = path_high[:, -1]
    r_multiple = np.where(
        outcome == "target", target_r,
        np.where(outcome == "stop", -1.0, (final_price - entry) / r_risk * (1 if is_long else -1)),
    )
    is_green = (outcome == "target") | ((outcome == "neither") & (
        final_price > entry if is_long else final_price < entry
    ))
    return {
        "outcome": outcome, "r_multiple": r_multiple, "is_green": is_green,
        "resolved_step": resolved_step, "paths": path_high,
    }


def _percentile_bands(paths: np.ndarray) -> List[Dict[str, float]]:
    qs = [5, 25, 50, 75, 95]
    pct = np.percentile(paths, qs, axis=0)  # (5, horizon_bars+1)
    return [
        {"step": i, "p5": float(pct[0, i]), "p25": float(pct[1, i]), "p50": float(pct[2, i]),
         "p75": float(pct[3, i]), "p95": float(pct[4, i])}
        for i in range(paths.shape[1])
    ]


def _verdict(target_pct: float, stop_pct: float, target_r: float) -> str:
    resolved_total = target_pct + stop_pct
    if resolved_total <= 0:
        return "Not enough replays resolved to call this one way or the other."
    target_share = target_pct / resolved_total * 100
    breakeven = 100 / (1 + target_r)
    gap = target_share - breakeven
    label = "Close to a coin flip" if abs(target_r - 1) < 1e-6 else "Close to break-even"
    if gap >= 15:
        return f"Strongly toward the target ({target_share:.0f}% of resolved replays hit target first vs. {breakeven:.0f}% needed to break even at {target_r:.1f}R)."
    if gap >= 5:
        return f"Leans toward the target ({target_share:.0f}% vs. {breakeven:.0f}% break-even)."
    if gap <= -15:
        return f"Strongly toward the stop ({target_share:.0f}% vs. {breakeven:.0f}% break-even)."
    if gap <= -5:
        return f"Leans toward the stop ({target_share:.0f}% vs. {breakeven:.0f}% break-even)."
    return f"{label} ({target_share:.0f}% vs. {breakeven:.0f}% break-even)."


def run_time_machine_sync(
    candles: List[Candle], *, entry: float, stop: float, target: float, direction: Literal["long", "short"] = "long",
    horizon_bars: int = 48, replays: int = DEFAULT_REPLAYS, window: int = DEFAULT_WINDOW, seed: int = 19,
) -> Dict[str, Any]:
    """The CPU-bound core -- call via run_in_executor, never directly from
    an async route (see this module's own docstring)."""
    pool = _build_pool(candles, horizon_bars)
    rng = np.random.default_rng(seed)

    sim = _simulate(pool, entry=entry, stop=stop, target=target, direction=direction,
                     n_paths=replays, window=window, rng=rng)
    outcomes, counts = np.unique(sim["outcome"], return_counts=True)
    count_map = dict(zip(outcomes.tolist(), counts.tolist()))
    target_n, stop_n, neither_n = count_map.get("target", 0), count_map.get("stop", 0), count_map.get("neither", 0)
    target_r = abs(target - entry) / abs(entry - stop)

    history = _simulate(pool, entry=entry, stop=stop, target=target, direction=direction,
                         n_paths=pool.n_sessions, window=window, rng=rng,
                         session_indices=np.arange(pool.n_sessions))
    h_outcomes, h_counts = np.unique(history["outcome"], return_counts=True)
    h_count_map = dict(zip(h_outcomes.tolist(), h_counts.tolist()))

    r_pcts = np.percentile(sim["r_multiple"], [5, 25, 50, 75, 95])

    return {
        "sessions_used": pool.n_sessions,
        "horizon_bars": horizon_bars,
        "replays": replays,
        "target_r": round(target_r, 2),
        "odds": {
            "target_first_pct": round(target_n / replays * 100, 1),
            "stop_first_pct": round(stop_n / replays * 100, 1),
            "neither_pct": round(neither_n / replays * 100, 1),
            "green_pct": round(float(np.mean(sim["is_green"])) * 100, 1),
        },
        "r_multiple": {
            "mean": round(float(np.mean(sim["r_multiple"])), 2),
            "p5": round(float(r_pcts[0]), 2), "p25": round(float(r_pcts[1]), 2),
            "p50": round(float(r_pcts[2]), 2), "p75": round(float(r_pcts[3]), 2), "p95": round(float(r_pcts[4]), 2),
        },
        "verdict": _verdict(target_n, stop_n, target_r),
        "fan_chart": _percentile_bands(sim["paths"]),
        "history": {
            "sessions": pool.n_sessions,
            "target_first": h_count_map.get("target", 0),
            "stop_first": h_count_map.get("stop", 0),
            "neither": h_count_map.get("neither", 0),
            "mean_r": round(float(np.mean(history["r_multiple"])), 2),
        },
    }


async def run_time_machine(
    *, exchange: str, symbol: str, timeframe: str, entry: float, stop: float, target: float,
    direction: Literal["long", "short"] = "long", horizon_bars: int = 48,
    replays: int = DEFAULT_REPLAYS, window: int = DEFAULT_WINDOW, seed: int = 19,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
) -> Dict[str, Any]:
    import asyncio

    if stop == entry:
        raise TimeMachineError("Stop can't equal entry.")
    if direction == "long" and not (stop < entry < target):
        raise TimeMachineError("For a long: stop < entry < target.")
    if direction == "short" and not (target < entry < stop):
        raise TimeMachineError("For a short: target < entry < stop.")

    end = _dt.datetime.now(_dt.timezone.utc)
    start = end - _dt.timedelta(days=lookback_days)
    candles = await shared_ingestion.fetch_historical_range(exchange, symbol, timeframe, start, end)
    if len(candles) < (horizon_bars * MIN_SESSIONS):
        raise TimeMachineError(
            f"Only {len(candles)} {timeframe} candles available for {symbol} on {exchange} in the last "
            f"{lookback_days} days -- not enough for {MIN_SESSIONS} full {horizon_bars}-bar sessions."
        )

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_time_machine_sync(
            candles, entry=entry, stop=stop, target=target, direction=direction,
            horizon_bars=horizon_bars, replays=replays, window=window, seed=seed,
        ),
    )
    result["exchange"] = exchange
    result["symbol"] = symbol
    result["timeframe"] = timeframe
    result["entry"], result["stop"], result["target"] = entry, stop, target
    result["direction"] = direction
    return result
