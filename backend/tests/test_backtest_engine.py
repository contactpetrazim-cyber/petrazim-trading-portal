from datetime import datetime, timedelta

import pytest

from app.engines.backtest_engine import (
    Bar, BarWindow, BacktestEngine, BacktestSignal, CostModel,
)


def make_bars(n=20, start_price=100.0, step=1.0):
    bars = []
    t0 = datetime(2024, 1, 1)
    price = start_price
    for i in range(n):
        bars.append(Bar(
            timestamp=t0 + timedelta(hours=i),
            open=price, high=price + 1, low=price - 1, close=price,
        ))
        price += step
    return bars


class TestBarWindow:
    def test_current_and_length(self):
        bars = make_bars(10)
        w = BarWindow(bars, 4)
        assert len(w) == 5
        assert w.current == bars[4]

    def test_negative_lookback(self):
        bars = make_bars(10)
        w = BarWindow(bars, 5)
        assert w[-1] == bars[4]
        assert w[0] == bars[5]

    def test_blocks_future_access(self):
        bars = make_bars(10)
        w = BarWindow(bars, 5)
        with pytest.raises(IndexError):
            _ = w[1]

    def test_lookback_helper_respects_start_of_history(self):
        bars = make_bars(10)
        w = BarWindow(bars, 2)
        result = w.lookback(10)  # ask for more than available
        assert result == bars[0:3]


class FixedSignalOnceStrategy:
    """Fires exactly one long signal on the 3rd bar, then never again."""
    def __init__(self, stop, target):
        self.fired = False
        self.stop = stop
        self.target = target

    def evaluate(self, window, context):
        if len(window) == 3 and not self.fired:
            self.fired = True
            return BacktestSignal(direction="long", stop_price=self.stop,
                                   target_price=self.target, bot_id="test_bot")
        return None


class TestBacktestEngine:
    def test_hits_target(self):
        bars = make_bars(20, start_price=100, step=0.5)  # trending up -> should hit target
        engine = BacktestEngine(cost_model=CostModel())
        strat = FixedSignalOnceStrategy(stop=95, target=105)
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        assert trades[0].exit_reason in ("target", "timeout")

    def test_hits_stop(self):
        bars = make_bars(20, start_price=100, step=-0.5)  # trending down -> should hit stop
        engine = BacktestEngine(cost_model=CostModel())
        strat = FixedSignalOnceStrategy(stop=95, target=110)
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        assert trades[0].exit_reason in ("stop", "timeout")

    def test_no_lookahead_in_run_loop(self):
        """A strategy that tries to read a future bar via raw indexing must fail,
        proving evaluate() never receives anything but a bounded window."""
        bars = make_bars(10)

        class NosyStrategy:
            def evaluate(self, window, context):
                with pytest.raises(IndexError):
                    _ = window[1]
                return None

        engine = BacktestEngine()
        trades = engine.run(bars, NosyStrategy(), symbol="TEST")
        assert trades == []

    def test_forces_close_at_end_of_data(self):
        bars = make_bars(6, start_price=100, step=0.01)  # barely moves, won't hit stop/target
        engine = BacktestEngine()
        strat = FixedSignalOnceStrategy(stop=50, target=500)
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        assert trades[0].exit_reason == "timeout"

    def test_only_one_open_position_at_a_time(self):
        bars = make_bars(50, start_price=100, step=0.01)

        class AlwaysSignal:
            def evaluate(self, window, context):
                return BacktestSignal(direction="long", stop_price=50, target_price=500, bot_id="x")

        engine = BacktestEngine(max_hold_bars=1000)
        trades = engine.run(bars, AlwaysSignal(), symbol="TEST")
        # Only ever one trade since it never closes before data runs out
        assert len(trades) == 1

    def test_to_trade_record_conversion(self):
        bars = make_bars(20, start_price=100, step=0.5)
        engine = BacktestEngine()
        strat = FixedSignalOnceStrategy(stop=95, target=105)
        trades = engine.run(bars, strat, symbol="TEST")
        record = trades[0].to_trade_record()
        assert record.r_multiple == trades[0].r_multiple
        assert record.bot_id == "test_bot"
