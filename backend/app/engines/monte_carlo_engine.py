"""
Monte Carlo Predictive Performance Engine
==========================================

PURPOSE
-------
Given a historical series of CLOSED trades (from paper trading, backtests,
or live results), this engine:

  1. Extracts statistical patterns/metrics from that trade series
     (win rate, R-multiple distribution, expectancy, streak behavior).
  2. Runs a Monte Carlo simulation that resamples those trades thousands
     of times to build many possible FUTURE equity paths.
  3. Reports the DISTRIBUTION of likely outcomes for a future SET of
     trades — percentile equity bands, drawdown ranges, probability of
     ruin, probability of hitting a target.

WHAT THIS IS NOT
----------------
This does NOT predict any individual future trade. It cannot tell you
whether trade #47 wins or loses. It answers a portfolio-level question:
"If my system keeps behaving statistically the way it has, what range
of outcomes should I expect over the next N trades?"

Treat this as a risk-sizing and expectation-management tool, not a
forecasting oracle. Garbage in -> garbage out: a system with only 15
historical trades will produce a wide, low-confidence distribution.

TWO RESAMPLING MODES
---------------------
- "iid"   : simple bootstrap — trades resampled independently.
            Ignores streak/autocorrelation structure.
- "block" : block bootstrap — resamples contiguous chunks of trades,
            preserving win/loss streak clustering that SMC-style
            systems tend to exhibit. Recommended default.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from typing import List, Literal, Optional


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class TradeRecord:
    """One closed trade, expressed in R-multiples (risk-normalized)."""
    trade_id: str
    r_multiple: float          # +2.0 = won 2R, -1.0 = lost full stop, etc.
    bot_id: Optional[str] = None
    symbol: Optional[str] = None
    timestamp: Optional[str] = None


@dataclass
class TradeMetrics:
    n_trades: int
    win_rate: float
    avg_win_r: float
    avg_loss_r: float
    expectancy_r: float
    std_dev_r: float
    max_win_streak: int
    max_loss_streak: int


@dataclass
class EquityCurveData:
    """Per-trade-index view across the whole simulation, for a real
    "equity over trades, band of likely outcomes, ruin line" chart —
    not fabricated, the same trials run_simulation() already computes,
    just retained at every step instead of only at the final one. Only
    populated when run_simulation(track_equity_curve=True)."""
    steps: List[int]                  # 0..trades_per_trial
    band_p5: List[float]              # 5th-percentile equity at each step, across ALL trials
    band_p50: List[float]
    band_p95: List[float]
    sample_paths: List[List[float]]   # a handful of individual trial paths, for the "spaghetti" look under the band
    ruin_threshold_equity: float      # starting_equity * (1 - ruin_threshold_pct/100) — the line "ruin" means crossing


@dataclass
class SimulationResult:
    trials: int
    trades_per_trial: int
    starting_equity: float
    risk_mode: str
    risk_value: float
    final_equity_percentiles: dict            # {5:.., 25:.., 50:.., 75:.., 95:..}
    max_drawdown_percentiles: dict             # same keys, values in %
    probability_of_ruin: float                 # % of trials hitting ruin_threshold
    probability_of_target: Optional[float]     # % of trials reaching target_equity
    expectancy_r_used: float
    notes: List[str] = field(default_factory=list)
    equity_curve: Optional[EquityCurveData] = None


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class MonteCarloEngine:
    """
    Simulates many possible future equity paths by resampling from a
    historical trade series, to forecast the RANGE of outcomes for a
    future set of trades rather than any single trade.
    """

    def __init__(self, trade_history: List[TradeRecord]):
        self.trade_history = trade_history

    # ---------------- Step 1: pattern / metric extraction ----------------

    def compute_metrics(self, bot_id: Optional[str] = None) -> TradeMetrics:
        trades = [t.r_multiple for t in self.trade_history
                  if bot_id is None or t.bot_id == bot_id]
        if not trades:
            raise ValueError("No trades available for the given filter")

        wins = [r for r in trades if r > 0]
        losses = [r for r in trades if r <= 0]

        return TradeMetrics(
            n_trades=len(trades),
            win_rate=round(len(wins) / len(trades), 4),
            avg_win_r=round(statistics.mean(wins), 3) if wins else 0.0,
            avg_loss_r=round(statistics.mean(losses), 3) if losses else 0.0,
            expectancy_r=round(statistics.mean(trades), 3),
            std_dev_r=round(statistics.pstdev(trades), 3) if len(trades) > 1 else 0.0,
            max_win_streak=self._max_streak(trades, lambda r: r > 0),
            max_loss_streak=self._max_streak(trades, lambda r: r <= 0),
        )

    @staticmethod
    def _max_streak(seq: List[float], predicate) -> int:
        best = current = 0
        for v in seq:
            if predicate(v):
                current += 1
                best = max(best, current)
            else:
                current = 0
        return best

    # ---------------- Step 2: resampling ----------------

    @staticmethod
    def _resample_iid(r_multiples: List[float], n: int) -> List[float]:
        return [random.choice(r_multiples) for _ in range(n)]

    @staticmethod
    def _resample_block(r_multiples: List[float], n: int, block_size: int) -> List[float]:
        out: List[float] = []
        max_start = len(r_multiples) - block_size
        if max_start < 0:
            return MonteCarloEngine._resample_iid(r_multiples, n)
        while len(out) < n:
            start = random.randint(0, max_start)
            out.extend(r_multiples[start:start + block_size])
        return out[:n]

    # ---------------- Step 3: simulation ----------------

    def run_simulation(
        self,
        trials: int = 2000,
        trades_per_trial: int = 100,
        starting_equity: float = 10000.0,
        risk_mode: Literal["fixed_fractional", "fixed_dollar"] = "fixed_fractional",
        risk_value: float = 0.01,
        resample_mode: Literal["iid", "block"] = "block",
        block_size: int = 5,
        ruin_threshold_pct: float = 50.0,
        target_equity: Optional[float] = None,
        bot_id: Optional[str] = None,
        seed: Optional[int] = None,
        track_equity_curve: bool = False,
        sample_paths: int = 12,
    ) -> SimulationResult:
        """
        Runs `trials` independent simulated futures, each consisting of
        `trades_per_trial` resampled trades. Returns the DISTRIBUTION of
        outcomes across all trials, not a single predicted result.

        All parameters are adjustable by the caller (trials, trades per
        trial, risk sizing, resample mode/block size, ruin threshold,
        target equity, and which bot's history to draw from).
        """
        if seed is not None:
            random.seed(seed)

        r_multiples = [t.r_multiple for t in self.trade_history
                       if bot_id is None or t.bot_id == bot_id]
        if len(r_multiples) < 5:
            raise ValueError("Need at least 5 historical trades to simulate")

        final_equities: List[float] = []
        max_drawdowns: List[float] = []
        ruin_count = 0
        target_count = 0

        # Per-step equity across every trial, only kept when a chart
        # actually needs it — trials x (trades_per_trial+1) floats is a
        # few MB at the defaults, fine for one request, wasteful to
        # build for every other caller of this shared engine that never
        # renders a curve (weekly review, the main /monte-carlo route).
        step_values: List[List[float]] = [[] for _ in range(trades_per_trial + 1)] if track_equity_curve else []
        sample_curves: List[List[float]] = []

        for trial_idx in range(trials):
            sequence = (
                self._resample_block(r_multiples, trades_per_trial, block_size)
                if resample_mode == "block"
                else self._resample_iid(r_multiples, trades_per_trial)
            )

            equity = starting_equity
            peak = starting_equity
            max_dd = 0.0
            ruined = False
            curve = [equity] if track_equity_curve else None

            if track_equity_curve:
                step_values[0].append(equity)

            for step, r in enumerate(sequence, start=1):
                risk_cash = (equity * risk_value if risk_mode == "fixed_fractional"
                             else risk_value)
                equity = max(equity + risk_cash * r, 0.0)
                peak = max(peak, equity)
                dd = (peak - equity) / peak * 100 if peak > 0 else 0.0
                max_dd = max(max_dd, dd)
                if dd >= ruin_threshold_pct:
                    ruined = True
                if track_equity_curve:
                    step_values[step].append(equity)
                    curve.append(equity)

            if track_equity_curve and trial_idx < sample_paths:
                sample_curves.append([round(v, 2) for v in curve])

            final_equities.append(equity)
            max_drawdowns.append(max_dd)
            if ruined:
                ruin_count += 1
            if target_equity is not None and equity >= target_equity:
                target_count += 1

        equity_curve = None
        if track_equity_curve:
            equity_curve = EquityCurveData(
                steps=list(range(trades_per_trial + 1)),
                band_p5=[round(self._pct(v, 5), 2) for v in step_values],
                band_p50=[round(self._pct(v, 50), 2) for v in step_values],
                band_p95=[round(self._pct(v, 95), 2) for v in step_values],
                sample_paths=sample_curves,
                ruin_threshold_equity=round(starting_equity * (1 - ruin_threshold_pct / 100), 2),
            )

        percentiles = [5, 25, 50, 75, 95]
        notes: List[str] = []

        if len(r_multiples) < 30:
            notes.append(
                f"Only {len(r_multiples)} historical trades available — results "
                "are indicative, not statistically reliable. Treat this as a "
                "rough sanity check until you have 50-100+ closed trades."
            )
        if resample_mode == "iid":
            notes.append(
                "iid mode ignores streak/autocorrelation structure between "
                "trades; 'block' mode is recommended for SMC-style systems "
                "where win/loss streaks tend to cluster."
            )

        return SimulationResult(
            trials=trials,
            trades_per_trial=trades_per_trial,
            starting_equity=starting_equity,
            risk_mode=risk_mode,
            risk_value=risk_value,
            final_equity_percentiles={p: self._pct(final_equities, p) for p in percentiles},
            max_drawdown_percentiles={p: self._pct(max_drawdowns, p) for p in percentiles},
            probability_of_ruin=round(ruin_count / trials * 100, 2),
            probability_of_target=(
                round(target_count / trials * 100, 2) if target_equity is not None else None
            ),
            expectancy_r_used=round(statistics.mean(r_multiples), 3),
            notes=notes,
            equity_curve=equity_curve,
        )

    @staticmethod
    def _pct(data: List[float], p: int) -> float:
        data_sorted = sorted(data)
        k = (len(data_sorted) - 1) * (p / 100)
        f, c = math.floor(k), math.ceil(k)
        if f == c:
            return round(data_sorted[int(k)], 2)
        return round(data_sorted[f] + (data_sorted[c] - data_sorted[f]) * (k - f), 2)

    # ---------------- Step 4: path tracking (for fan-chart UIs) ----------------

    def simulate_equity_paths(
        self,
        trials: int = 500,
        trades_per_trial: int = 100,
        starting_equity: float = 10000.0,
        risk_mode: Literal["fixed_fractional", "fixed_dollar"] = "fixed_fractional",
        risk_value: float = 0.01,
        resample_mode: Literal["iid", "block"] = "block",
        block_size: int = 5,
        bot_id: Optional[str] = None,
        seed: Optional[int] = None,
    ) -> List[List[float]]:
        """
        Same simulation as run_simulation(), but returns the FULL equity
        curve for every trial (trials x (trades_per_trial + 1) values,
        step 0 = starting_equity) instead of only summary statistics.

        Use this when you need to plot a fan chart (percentile bands over
        time) rather than just a single end-of-run distribution. Keep
        `trials` modest (a few hundred) for path tracking — it's O(trials
        x trades_per_trial) in memory, unlike run_simulation() which is
        O(trials) once collapsed to summary stats.
        """
        if seed is not None:
            random.seed(seed)

        r_multiples = [t.r_multiple for t in self.trade_history
                       if bot_id is None or t.bot_id == bot_id]
        if len(r_multiples) < 5:
            raise ValueError("Need at least 5 historical trades to simulate")

        paths: List[List[float]] = []
        for _ in range(trials):
            sequence = (
                self._resample_block(r_multiples, trades_per_trial, block_size)
                if resample_mode == "block"
                else self._resample_iid(r_multiples, trades_per_trial)
            )
            equity = starting_equity
            path = [equity]
            for r in sequence:
                risk_cash = (equity * risk_value if risk_mode == "fixed_fractional"
                             else risk_value)
                equity = max(equity + risk_cash * r, 0.0)
                path.append(equity)
            paths.append(path)

        return paths

    @staticmethod
    def percentile_bands_over_time(
        paths: List[List[float]],
        percentiles: Optional[List[int]] = None,
        max_points: int = 60,
    ) -> List[dict]:
        """
        Collapses a set of equity paths (from simulate_equity_paths) into
        percentile bands at each trade step, downsampled to at most
        `max_points` steps so the payload stays light for a chart.

        Returns a list of dicts, one per (possibly downsampled) step:
            {"step": 0, "p5": .., "p25": .., "p50": .., "p75": .., "p95": ..}
        """
        if percentiles is None:
            percentiles = [5, 25, 50, 75, 95]
        if not paths:
            return []

        n_steps = len(paths[0])
        stride = max(1, n_steps // max_points)
        step_indices = list(range(0, n_steps, stride))
        if step_indices[-1] != n_steps - 1:
            step_indices.append(n_steps - 1)

        bands: List[dict] = []
        for step in step_indices:
            values_at_step = [path[step] for path in paths]
            row = {"step": step}
            for p in percentiles:
                row[f"p{p}"] = MonteCarloEngine._pct(values_at_step, p)
            bands.append(row)
        return bands
