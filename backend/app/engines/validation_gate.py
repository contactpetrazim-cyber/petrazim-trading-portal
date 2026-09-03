"""
Go-Live Validation Gate
=========================

PURPOSE
-------
A bot should never move from human-approval mode to autonomous mode
just because someone feels good about its backtest. This module is a
formal checklist that has to pass before that switch is allowed to
flip — combining automated statistical checks with mandatory human
sign-offs for the things that genuinely can't be verified by code.

IMPORTANT — WHAT THIS DOES NOT DO
-----------------------------------
Three checks in this gate (paper-trading reconciliation, kill-switch
test, manual emergency-close test) are SAFETY-CRITICAL and are
deliberately NOT automated. They require a human to actually run the
test against the live system and attest, explicitly and by name, that
it passed. This module will never auto-pass them — if you don't supply
an attestation, the gate blocks. That's intentional: a bug in this
file should never be the reason a kill switch didn't get tested.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.engines.monte_carlo_engine import MonteCarloEngine, TradeRecord

REQUIRED_MANUAL_ATTESTATIONS = [
    "paper_trading_reconciliation",
    "kill_switch_test",
    "manual_emergency_close_test",
]


@dataclass
class GateCheckResult:
    name: str
    passed: Optional[bool]   # None = not evaluated (missing required input)
    automated: bool
    detail: str


@dataclass
class GateReport:
    checks: List[GateCheckResult] = field(default_factory=list)
    overall_pass: bool = False
    blocking_failures: List[str] = field(default_factory=list)

    def summary(self) -> str:
        lines = [f"{'PASS' if c.passed else 'FAIL' if c.passed is False else 'MISSING'}"
                 f" — {c.name}: {c.detail}" for c in self.checks]
        lines.append(f"\nOVERALL: {'GO-LIVE APPROVED' if self.overall_pass else 'BLOCKED'}")
        if self.blocking_failures:
            lines.append("Blocking: " + ", ".join(self.blocking_failures))
        return "\n".join(lines)


class ValidationGate:
    """
    Configure thresholds once, then call evaluate() for each bot before
    it's allowed into autonomous mode. Re-run whenever the strategy
    logic, symbol, or timeframe changes materially.
    """

    def __init__(
        self,
        min_trade_count: int = 50,
        min_expectancy_r: float = 0.05,
        max_acceptable_drawdown_pct: float = 30.0,
        oos_split: float = 0.3,             # fraction of trades held out as out-of-sample
        cost_stress_max_expectancy_drop_pct: float = 50.0,
        parameter_stability_max_variance_r: float = 0.25,
    ):
        self.min_trade_count = min_trade_count
        self.min_expectancy_r = min_expectancy_r
        self.max_acceptable_drawdown_pct = max_acceptable_drawdown_pct
        self.oos_split = oos_split
        self.cost_stress_max_expectancy_drop_pct = cost_stress_max_expectancy_drop_pct
        self.parameter_stability_max_variance_r = parameter_stability_max_variance_r

    def evaluate(
        self,
        trades: List[TradeRecord],
        cost_stressed_trades: Optional[List[TradeRecord]] = None,
        parameter_variant_trade_sets: Optional[List[List[TradeRecord]]] = None,
        manual_attestations: Optional[Dict[str, bool]] = None,
    ) -> GateReport:
        """
        trades: the primary backtest result for this bot (chronological order).
        cost_stressed_trades: same backtest re-run with elevated spread/
            slippage/commission — omit to leave that check unevaluated.
        parameter_variant_trade_sets: backtest re-run several times with
            small parameter perturbations (e.g. zone tolerance +/-10%) —
            omit to leave that check unevaluated.
        manual_attestations: dict with True for each of
            REQUIRED_MANUAL_ATTESTATIONS the human has actually performed
            and confirmed. Missing or False entries block go-live.
        """
        manual_attestations = manual_attestations or {}
        checks: List[GateCheckResult] = []

        checks.append(self._check_trade_count(trades))
        checks.append(self._check_out_of_sample_expectancy(trades))
        checks.append(self._check_max_drawdown(trades))

        if cost_stressed_trades is not None:
            checks.append(self._check_cost_stress(trades, cost_stressed_trades))
        else:
            checks.append(GateCheckResult(
                "cost_stress_test", None, automated=True,
                detail="Not evaluated — re-run the backtest with elevated "
                       "spread/slippage/commission and pass the result in."
            ))

        if parameter_variant_trade_sets:
            checks.append(self._check_parameter_stability(trades, parameter_variant_trade_sets))
        else:
            checks.append(GateCheckResult(
                "parameter_stability", None, automated=True,
                detail="Not evaluated — re-run the backtest with small "
                       "parameter perturbations and pass the results in."
            ))

        for key in REQUIRED_MANUAL_ATTESTATIONS:
            attested = manual_attestations.get(key)
            checks.append(GateCheckResult(
                name=key,
                passed=(True if attested is True else (False if attested is False else None)),
                automated=False,
                detail=(
                    "Confirmed by human sign-off." if attested is True else
                    "Explicitly marked failed by human sign-off." if attested is False else
                    "REQUIRED — no attestation on file. This cannot be satisfied by code; "
                    "a person must run this test against the live system and confirm."
                ),
            ))

        blocking = [c.name for c in checks if c.passed is not True]
        overall_pass = len(blocking) == 0

        return GateReport(checks=checks, overall_pass=overall_pass, blocking_failures=blocking)

    # ---------------- individual checks ----------------

    def _check_trade_count(self, trades: List[TradeRecord]) -> GateCheckResult:
        n = len(trades)
        passed = n >= self.min_trade_count
        return GateCheckResult(
            "min_trade_count", passed, automated=True,
            detail=f"{n} trades (need >= {self.min_trade_count}). "
                   f"{'Sufficient sample.' if passed else 'Too few trades to trust the stats.'}"
        )

    def _check_out_of_sample_expectancy(self, trades: List[TradeRecord]) -> GateCheckResult:
        if len(trades) < 10:
            return GateCheckResult(
                "out_of_sample_expectancy", False, automated=True,
                detail="Not enough trades to hold out an out-of-sample slice."
            )
        split_idx = int(len(trades) * (1 - self.oos_split))
        in_sample, out_sample = trades[:split_idx], trades[split_idx:]
        if not out_sample:
            return GateCheckResult(
                "out_of_sample_expectancy", False, automated=True,
                detail="Out-of-sample slice is empty — increase oos_split or trade count."
            )
        oos_expectancy = statistics.mean(t.r_multiple for t in out_sample)
        passed = oos_expectancy >= self.min_expectancy_r
        return GateCheckResult(
            "out_of_sample_expectancy", passed, automated=True,
            detail=(f"Held-out last {len(out_sample)} trades (of {len(trades)}): "
                    f"expectancy {oos_expectancy:.3f}R (need >= {self.min_expectancy_r}R). "
                    f"In-sample expectancy was {statistics.mean(t.r_multiple for t in in_sample):.3f}R "
                    "— a large gap between the two suggests overfitting.")
        )

    def _check_max_drawdown(self, trades: List[TradeRecord]) -> GateCheckResult:
        engine = MonteCarloEngine(trades)
        try:
            result = engine.run_simulation(
                trials=1000, trades_per_trial=len(trades),
                resample_mode="block", block_size=5, seed=0,
            )
        except ValueError as e:
            return GateCheckResult("max_drawdown", False, automated=True, detail=str(e))

        median_dd = result.max_drawdown_percentiles.get(50, 0)
        p95_dd = result.max_drawdown_percentiles.get(95, 0)
        passed = p95_dd <= self.max_acceptable_drawdown_pct
        return GateCheckResult(
            "max_drawdown", passed, automated=True,
            detail=(f"Simulated median drawdown {median_dd}%, 95th percentile "
                    f"{p95_dd}% (limit {self.max_acceptable_drawdown_pct}%). "
                    "Based on Monte Carlo resampling of this trade history, not "
                    "just the single historical drawdown.")
        )

    def _check_cost_stress(
        self, base_trades: List[TradeRecord], stressed_trades: List[TradeRecord]
    ) -> GateCheckResult:
        base_exp = statistics.mean(t.r_multiple for t in base_trades) if base_trades else 0
        stressed_exp = statistics.mean(t.r_multiple for t in stressed_trades) if stressed_trades else 0

        if base_exp <= 0:
            return GateCheckResult(
                "cost_stress_test", False, automated=True,
                detail="Base expectancy is already <= 0 — cost stress test is moot."
            )
        drop_pct = (base_exp - stressed_exp) / base_exp * 100
        passed = drop_pct <= self.cost_stress_max_expectancy_drop_pct and stressed_exp > 0
        return GateCheckResult(
            "cost_stress_test", passed, automated=True,
            detail=(f"Expectancy {base_exp:.3f}R -> {stressed_exp:.3f}R under elevated costs "
                    f"({drop_pct:.1f}% drop, limit {self.cost_stress_max_expectancy_drop_pct}%). "
                    "Confirms the edge survives worse-than-expected spread/slippage/fees.")
        )

    def _check_parameter_stability(
        self, base_trades: List[TradeRecord], variant_sets: List[List[TradeRecord]]
    ) -> GateCheckResult:
        expectancies = [statistics.mean(t.r_multiple for t in s) for s in variant_sets if s]
        expectancies.append(statistics.mean(t.r_multiple for t in base_trades))
        if len(expectancies) < 2:
            return GateCheckResult(
                "parameter_stability", False, automated=True,
                detail="Not enough parameter variants supplied."
            )
        spread = max(expectancies) - min(expectancies)
        passed = spread <= self.parameter_stability_max_variance_r
        return GateCheckResult(
            "parameter_stability", passed, automated=True,
            detail=(f"Expectancy range across {len(expectancies)} parameter variants: "
                    f"{spread:.3f}R (limit {self.parameter_stability_max_variance_r}R). "
                    "A strategy whose performance swings wildly with small parameter "
                    "tweaks is likely curve-fit, not robust.")
        )
