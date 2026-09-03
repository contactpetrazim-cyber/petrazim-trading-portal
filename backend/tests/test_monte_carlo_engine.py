import random
import pytest

from app.engines.monte_carlo_engine import MonteCarloEngine, TradeRecord


def make_history(n=60, seed=1):
    """Synthetic trade history: ~55% win rate, wins avg 2R, losses avg -1R."""
    rnd = random.Random(seed)
    trades = []
    for i in range(n):
        won = rnd.random() < 0.55
        r = rnd.uniform(1.0, 3.0) if won else -rnd.uniform(0.7, 1.0)
        trades.append(TradeRecord(trade_id=f"t{i}", r_multiple=round(r, 2), bot_id="bot_2"))
    return trades


class TestMetrics:
    def test_compute_metrics_basic(self):
        engine = MonteCarloEngine(make_history())
        m = engine.compute_metrics()
        assert m.n_trades == 60
        assert 0 < m.win_rate < 1
        assert m.avg_win_r > 0
        assert m.avg_loss_r < 0

    def test_filter_by_bot(self):
        history = make_history() + [
            TradeRecord(trade_id="x1", r_multiple=1.0, bot_id="bot_5"),
        ]
        engine = MonteCarloEngine(history)
        m = engine.compute_metrics(bot_id="bot_5")
        assert m.n_trades == 1

    def test_raises_on_empty_filter(self):
        engine = MonteCarloEngine(make_history())
        with pytest.raises(ValueError):
            engine.compute_metrics(bot_id="nonexistent_bot")


class TestSimulation:
    def test_basic_simulation_shape(self):
        engine = MonteCarloEngine(make_history())
        result = engine.run_simulation(trials=200, trades_per_trial=50, seed=42)
        assert result.trials == 200
        assert set(result.final_equity_percentiles.keys()) == {5, 25, 50, 75, 95}
        # percentiles should be non-decreasing
        vals = [result.final_equity_percentiles[p] for p in (5, 25, 50, 75, 95)]
        assert vals == sorted(vals)

    def test_deterministic_with_seed(self):
        engine = MonteCarloEngine(make_history())
        r1 = engine.run_simulation(trials=100, trades_per_trial=30, seed=7)
        r2 = engine.run_simulation(trials=100, trades_per_trial=30, seed=7)
        assert r1.final_equity_percentiles == r2.final_equity_percentiles

    def test_probability_of_ruin_bounds(self):
        engine = MonteCarloEngine(make_history())
        result = engine.run_simulation(trials=300, trades_per_trial=100, seed=1)
        assert 0.0 <= result.probability_of_ruin <= 100.0

    def test_target_probability_only_when_requested(self):
        engine = MonteCarloEngine(make_history())
        no_target = engine.run_simulation(trials=50, trades_per_trial=20, seed=3)
        assert no_target.probability_of_target is None

        with_target = engine.run_simulation(
            trials=50, trades_per_trial=20, seed=3, target_equity=15000
        )
        assert with_target.probability_of_target is not None

    def test_block_vs_iid_both_run(self):
        engine = MonteCarloEngine(make_history())
        block = engine.run_simulation(trials=100, trades_per_trial=40,
                                       resample_mode="block", block_size=5, seed=9)
        iid = engine.run_simulation(trials=100, trades_per_trial=40,
                                     resample_mode="iid", seed=9)
        assert block.trials == iid.trials == 100

    def test_raises_with_too_little_history(self):
        engine = MonteCarloEngine(make_history(n=3))
        with pytest.raises(ValueError):
            engine.run_simulation(trials=10, trades_per_trial=10)

    def test_low_sample_note_present(self):
        engine = MonteCarloEngine(make_history(n=10))
        result = engine.run_simulation(trials=50, trades_per_trial=20, seed=5)
        assert any("indicative" in note for note in result.notes)
