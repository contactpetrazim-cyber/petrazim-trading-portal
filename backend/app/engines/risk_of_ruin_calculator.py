"""
Risk-of-Ruin Calculator — Explore Concept #2 (free lead magnet)
====================================================================

No login, no trade history upload required — just win rate, average
win/loss size, and risk per trade. Rather than reaching for a
closed-form risk-of-ruin formula (most published versions assume equal
win/loss size, which real trading almost never has, and a wrong
formula would be worse than no formula), this builds a synthetic trade
pool matching the given stats and reuses the SAME validated Monte Carlo
engine that powers the rest of the platform.

Meant to be genuinely useful standalone, and a natural funnel into
Concept #1 (upload your REAL trades for a proper read instead of
these estimated stats).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from app.engines.monte_carlo_engine import MonteCarloEngine, TradeRecord


@dataclass
class RiskOfRuinInput:
    win_rate: float             # 0-1, e.g. 0.55
    avg_win_r: float            # positive, e.g. 2.0
    avg_loss_r: float           # positive magnitude, e.g. 1.0 (not -1.0)
    risk_per_trade_pct: float   # e.g. 0.01 for 1% risk per trade
    num_trades: int = 100
    ruin_threshold_pct: float = 50.0
    trials: int = 5000


@dataclass
class RiskOfRuinResult:
    probability_of_ruin: float
    expectancy_r: float
    median_outcome_multiple: float
    p5_outcome_multiple: float
    p95_outcome_multiple: float
    verdict: str


class RiskOfRuinCalculator:
    def _build_synthetic_pool(self, inp: RiskOfRuinInput, pool_size: int = 200) -> List[TradeRecord]:
        n_wins = round(pool_size * inp.win_rate)
        n_losses = pool_size - n_wins
        trades = [TradeRecord(trade_id=f"w{i}", r_multiple=inp.avg_win_r) for i in range(n_wins)]
        trades += [TradeRecord(trade_id=f"l{i}", r_multiple=-abs(inp.avg_loss_r)) for i in range(n_losses)]
        return trades

    def calculate(self, inp: RiskOfRuinInput) -> RiskOfRuinResult:
        if not (0 < inp.win_rate < 1):
            raise ValueError("win_rate must be between 0 and 1")
        if inp.avg_win_r <= 0 or inp.avg_loss_r <= 0:
            raise ValueError("avg_win_r and avg_loss_r must both be positive numbers")

        pool = self._build_synthetic_pool(inp)
        engine = MonteCarloEngine(pool)
        metrics = engine.compute_metrics()
        result = engine.run_simulation(
            trials=inp.trials, trades_per_trial=inp.num_trades,
            starting_equity=10000.0, risk_mode="fixed_fractional",
            risk_value=inp.risk_per_trade_pct, resample_mode="iid",
            ruin_threshold_pct=inp.ruin_threshold_pct,
        )

        median = result.final_equity_percentiles.get(50, 10000) / 10000
        p5 = result.final_equity_percentiles.get(5, 10000) / 10000
        p95 = result.final_equity_percentiles.get(95, 10000) / 10000

        if result.probability_of_ruin > 20:
            verdict = "High risk of ruin at this position size — consider reducing risk per trade."
        elif result.probability_of_ruin > 5:
            verdict = "Moderate risk of ruin — plausible but worth tightening before scaling up."
        else:
            verdict = "Low risk of ruin at this position size, assuming these stats hold up in practice."

        return RiskOfRuinResult(
            probability_of_ruin=result.probability_of_ruin,
            expectancy_r=metrics.expectancy_r,
            median_outcome_multiple=round(median, 3),
            p5_outcome_multiple=round(p5, 3),
            p95_outcome_multiple=round(p95, 3),
            verdict=verdict,
        )
