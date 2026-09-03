import random

import pytest

from app.engines.monte_carlo_engine import TradeRecord
from app.engines.validation_gate import ValidationGate, REQUIRED_MANUAL_ATTESTATIONS


def make_trades(n, win_rate, seed):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        won = rnd.random() < win_rate
        r = rnd.uniform(1.0, 3.0) if won else -rnd.uniform(0.7, 1.0)
        out.append(TradeRecord(trade_id=f"t{i}", r_multiple=round(r, 3), bot_id="bot_2"))
    return out


FULL_ATTESTATIONS = {k: True for k in REQUIRED_MANUAL_ATTESTATIONS}


class TestValidationGate:
    def test_blocks_without_manual_attestations_even_with_great_stats(self):
        gate = ValidationGate(min_trade_count=50)
        trades = make_trades(200, win_rate=0.6, seed=1)
        report = gate.evaluate(trades)
        assert report.overall_pass is False
        for key in REQUIRED_MANUAL_ATTESTATIONS:
            assert key in report.blocking_failures

    def test_passes_with_good_stats_and_full_attestations(self):
        gate = ValidationGate(min_trade_count=50)
        trades = make_trades(200, win_rate=0.55, seed=1)
        stressed = make_trades(200, win_rate=0.5, seed=1)
        variants = [make_trades(200, win_rate=0.53, seed=2),
                    make_trades(200, win_rate=0.56, seed=3)]
        report = gate.evaluate(
            trades,
            cost_stressed_trades=stressed,
            parameter_variant_trade_sets=variants,
            manual_attestations=FULL_ATTESTATIONS,
        )
        assert report.overall_pass is True
        assert report.blocking_failures == []

    def test_single_failed_attestation_blocks_everything(self):
        gate = ValidationGate(min_trade_count=50)
        trades = make_trades(200, win_rate=0.6, seed=1)
        attestations = dict(FULL_ATTESTATIONS)
        attestations["kill_switch_test"] = False
        report = gate.evaluate(trades, manual_attestations=attestations)
        assert report.overall_pass is False
        assert "kill_switch_test" in report.blocking_failures

    def test_insufficient_trade_count_blocks(self):
        gate = ValidationGate(min_trade_count=100)
        trades = make_trades(20, win_rate=0.6, seed=1)
        report = gate.evaluate(trades, manual_attestations=FULL_ATTESTATIONS)
        assert report.overall_pass is False
        assert "min_trade_count" in report.blocking_failures

    def test_negative_expectancy_blocks_oos_check(self):
        gate = ValidationGate(min_trade_count=20)
        trades = make_trades(100, win_rate=0.2, seed=1)  # bad strategy
        report = gate.evaluate(trades, manual_attestations=FULL_ATTESTATIONS)
        assert report.overall_pass is False
        assert "out_of_sample_expectancy" in report.blocking_failures

    def test_cost_stress_missing_by_default(self):
        gate = ValidationGate(min_trade_count=20)
        trades = make_trades(50, win_rate=0.6, seed=1)
        report = gate.evaluate(trades, manual_attestations=FULL_ATTESTATIONS)
        cost_check = next(c for c in report.checks if c.name == "cost_stress_test")
        assert cost_check.passed is None

    def test_severe_cost_stress_degradation_blocks(self):
        gate = ValidationGate(min_trade_count=20, cost_stress_max_expectancy_drop_pct=20)
        trades = make_trades(100, win_rate=0.6, seed=1)
        stressed = make_trades(100, win_rate=0.1, seed=1)  # costs destroy the edge
        report = gate.evaluate(
            trades, cost_stressed_trades=stressed, manual_attestations=FULL_ATTESTATIONS
        )
        assert "cost_stress_test" in report.blocking_failures
