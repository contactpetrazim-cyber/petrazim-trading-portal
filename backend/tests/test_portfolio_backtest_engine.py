from datetime import datetime, timedelta

import pytest

from app.engines.backtest_engine import Bar, BacktestSignal, CostModel
from app.engines.portfolio_backtest_engine import PortfolioBacktestEngine, PortfolioParticipant


def make_bars(n=30, start=100.0, step=1.0, t0=None):
    t0 = t0 or datetime(2024, 1, 1)
    bars, price = [], start
    for i in range(n):
        bars.append(Bar(timestamp=t0 + timedelta(hours=i), open=price, high=price + 1, low=price - 1, close=price))
        price += step
    return bars


class FixedSignalOnceAdapter:
    """Fake adapter (duck-typed like SmcStrategyAdapter) firing exactly
    one long signal on the 2nd bar it sees, sized against whatever
    account_balance it's actually given via context — matching the
    real SmcStrategyAdapter's own context["account_balance"] hook."""
    def __init__(self, stop_distance=10.0, target_distance=20.0, risk_percent=1.0, bot_id="test_bot"):
        self.fired = False
        self.stop_distance = stop_distance
        self.target_distance = target_distance
        self.risk_percent = risk_percent
        self.bot_id = bot_id

    def evaluate(self, window, context):
        if len(window) == 2 and not self.fired:
            self.fired = True
            entry = window.current.close
            balance = context["account_balance"]
            risk_amount = balance * (self.risk_percent / 100)
            lot_size = risk_amount / self.stop_distance
            return BacktestSignal(
                direction="long", stop_price=entry - self.stop_distance, target_price=entry + self.target_distance,
                bot_id=self.bot_id, lot_size=lot_size,
            )
        return None


class TestPortfolioBacktestEngine:
    def test_single_participant_balance_compounds_correctly(self):
        bars = make_bars(30, start=100, step=2.0)  # trending up -> should hit target
        adapter = FixedSignalOnceAdapter(stop_distance=10, target_distance=20, risk_percent=1.0)
        participant = PortfolioParticipant(bot_id="bot_x", symbol="TEST", adapter=adapter, bars=bars)

        engine = PortfolioBacktestEngine(cost_model=CostModel(), starting_balance=10000.0, leverage=50.0)
        result = engine.run([participant])

        assert len(result.trades) == 1
        t = result.trades[0]
        # 1% risk on $10,000 = $100 risk_amount; lot_size = 100/10 = 10.
        # Target hit (r_multiple should be positive) -> balance increases by r_multiple * lot_size * stop_distance.
        expected_pnl = t.r_multiple * 10.0 * 10.0
        assert result.ending_balance == pytest.approx(10000.0 + expected_pnl, abs=0.01)
        assert result.equity_curve[-1]["balance"] == pytest.approx(result.ending_balance, abs=0.01)

    def test_two_pairs_trade_independently_when_capital_allows(self):
        bars_a = make_bars(30, start=100, step=2.0, t0=datetime(2024, 1, 1))
        bars_b = make_bars(30, start=50, step=1.0, t0=datetime(2024, 1, 1, 0, 30))  # offset so events interleave
        p1 = PortfolioParticipant(bot_id="bot_a", symbol="SYM_A", adapter=FixedSignalOnceAdapter(risk_percent=0.5, bot_id="bot_a"), bars=bars_a)
        p2 = PortfolioParticipant(bot_id="bot_b", symbol="SYM_B", adapter=FixedSignalOnceAdapter(risk_percent=0.5, bot_id="bot_b"), bars=bars_b)

        engine = PortfolioBacktestEngine(cost_model=CostModel(), starting_balance=10000.0, leverage=50.0)
        result = engine.run([p1, p2])

        bot_ids_traded = {t.bot_id for t in result.trades}
        assert bot_ids_traded == {"bot_a", "bot_b"}
        assert result.rejected_by_capital_adequacy == 0

    def test_capital_adequacy_rejects_when_shared_leverage_is_exhausted(self):
        """Two pairs both want to open near-simultaneously; with a tiny
        leverage cap, only the first (by the engine's own deterministic
        tie-break) can be sized — the second must be rejected, not
        silently granted extra capital that doesn't exist."""
        bars_a = make_bars(10, start=100, step=0.01, t0=datetime(2024, 1, 1))
        bars_b = make_bars(10, start=100, step=0.01, t0=datetime(2024, 1, 1))  # identical timestamps -> deterministic tie-break
        p1 = PortfolioParticipant(bot_id="bot_a", symbol="SYM_A", adapter=FixedSignalOnceAdapter(risk_percent=50.0, bot_id="bot_a"), bars=bars_a)
        p2 = PortfolioParticipant(bot_id="bot_b", symbol="SYM_B", adapter=FixedSignalOnceAdapter(risk_percent=50.0, bot_id="bot_b"), bars=bars_b)

        # leverage=1x on a $10,000 balance -> only $10,000 of notional
        # available total; each signal alone (50% risk / $10 stop ->
        # huge lot_size) wildly exceeds that on its own.
        engine = PortfolioBacktestEngine(cost_model=CostModel(), starting_balance=10000.0, leverage=1.0)
        result = engine.run([p1, p2])

        assert result.rejected_by_capital_adequacy >= 1, "expected at least one signal to be rejected for insufficient shared capital"

    def test_no_lookahead_per_pair(self):
        """A strategy that tries to read a future bar via raw indexing
        must fail, even inside the portfolio engine's own event loop —
        proving BarWindow's guarantee survives being driven by this
        engine instead of BacktestEngine.run()."""
        bars = make_bars(10)

        class NosyAdapter:
            def evaluate(self, window, context):
                with pytest.raises(IndexError):
                    _ = window[1]
                return None

        p = PortfolioParticipant(bot_id="bot_x", symbol="TEST", adapter=NosyAdapter(), bars=bars)
        engine = PortfolioBacktestEngine()
        result = engine.run([p])
        assert result.trades == []

    def test_force_closes_anything_still_open_at_end_of_data(self):
        bars = make_bars(6, start=100, step=0.001)  # barely moves, won't hit stop/target
        adapter = FixedSignalOnceAdapter(stop_distance=50, target_distance=500, risk_percent=1.0)
        p = PortfolioParticipant(bot_id="bot_x", symbol="TEST", adapter=adapter, bars=bars)
        engine = PortfolioBacktestEngine(max_hold_bars=1000)
        result = engine.run([p])
        assert len(result.trades) == 1
        assert result.trades[0].exit_reason == "timeout"
