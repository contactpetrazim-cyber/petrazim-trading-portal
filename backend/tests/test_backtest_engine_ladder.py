from datetime import datetime, timedelta

import pytest

from app.engines.backtest_engine import (
    Bar, BacktestEngine, BacktestSignal, CostModel, LadderLeg,
)


def bar(t, o, h, l, c):
    return Bar(timestamp=t, open=o, high=h, low=l, close=c)


def make_rising_bars(n, start=100.0, step=1.0, t0=None):
    t0 = t0 or datetime(2024, 1, 1)
    bars = []
    price = start
    for i in range(n):
        bars.append(bar(t0 + timedelta(hours=i), price, price + 0.5, price - 0.5, price))
        price += step
    return bars


class OnceLadderStrategy:
    """Fires one long ladder signal on the 2nd bar: entry basis is that
    bar's close; TP1 at entry+10 (level 1, closes 30% of original via
    fraction=0.30 of remaining), TP2 at entry+20 (level 2, fraction=1.0
    of what's left after TP1, i.e. the rest — no separate TP3), SL at
    entry-10. trailing_activation_r=1 means trailing engages right at
    TP1."""
    def __init__(self, entry_hint, trailing_activation_r=None, ladder=None):
        self.fired = False
        self.entry_hint = entry_hint
        self.trailing_activation_r = trailing_activation_r
        self.ladder = ladder

    def evaluate(self, window, context):
        if len(window) == 2 and not self.fired:
            self.fired = True
            entry = self.entry_hint
            ladder = self.ladder if self.ladder is not None else [
                LadderLeg(level=1, price=entry + 10, fraction=0.30),
                LadderLeg(level=2, price=entry + 20, fraction=1.0),
            ]
            return BacktestSignal(
                direction="long", stop_price=entry - 10, target_price=entry + 30,
                bot_id="test_bot", ladder=ladder,
                trailing_activation_r=self.trailing_activation_r,
            )
        return None


class TestLadderBasics:
    def test_no_ladder_behaves_like_original_simple_path(self):
        """signal.ladder=None (the default) must produce byte-identical
        behavior to the pre-ladder engine — same exit_reason vocabulary,
        same r_multiple math."""
        bars = make_rising_bars(20, start=100, step=0.5)

        class PlainStrategy:
            def evaluate(self, window, context):
                if len(window) == 2:
                    return BacktestSignal(direction="long", stop_price=95, target_price=105, bot_id="x")
                return None

        engine = BacktestEngine()
        trades = engine.run(bars, PlainStrategy(), symbol="TEST")
        assert len(trades) == 1
        assert trades[0].legs == []
        assert trades[0].exit_reason in ("target", "timeout")

    def test_ladder_two_legs_blended_r_multiple(self):
        """Entry ~100 (2nd bar close), SL=90 -> risk=10. TP1=110 (1R,
        closes 30%), TP2=120 (2R, closes the remaining 70%). Blended R
        should be 0.3*1 + 0.7*2 = 1.7R, matching
        compute_blended_r_multiple's own capital-weighted-blend math."""
        bars = make_rising_bars(40, start=100, step=1.0)
        strat = OnceLadderStrategy(entry_hint=101)  # 2nd bar (index 1) closes at 101
        engine = BacktestEngine(cost_model=CostModel())
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        t = trades[0]
        assert len(t.legs) == 2
        assert t.legs[0]["level"] == 1
        assert t.legs[1]["level"] == 2  # exhausted remaining_fraction -> finalized at its own real level, not relabeled "final"
        expected_r = 0.30 * 1.0 + 0.70 * 2.0
        assert t.r_multiple == pytest.approx(expected_r, abs=0.05)

    def test_breakeven_ratchet_after_tp1_protects_against_full_reversal(self):
        """After TP1 fires (fraction=0.30, no trailing configured), the
        stop must ratchet to breakeven (entry price) — so even if price
        fully reverses afterward, the remaining 70% closes at ~breakeven,
        not at the original stop. This is the exact bug position_monitor's
        own ratchet was built to fix (TRD_bot_3_fvg_expansion_2 giving
        back a full winner to the original stop)."""
        t0 = datetime(2024, 1, 1)
        bars = [
            bar(t0, 100, 100.5, 99.5, 100),      # bar 0: no signal (len(window)==1)
            bar(t0 + timedelta(hours=1), 101, 101.5, 100.5, 101),  # bar 1: signal fires, entry ~101
            bar(t0 + timedelta(hours=2), 105, 106, 104, 105),
            bar(t0 + timedelta(hours=3), 108, 112, 107, 111),  # TP1 (111) hit here: entry+10=111
            bar(t0 + timedelta(hours=4), 90, 95, 80, 85),       # violent reversal — would hit original SL (91) AND then some
        ]
        strat = OnceLadderStrategy(entry_hint=101, ladder=[
            LadderLeg(level=1, price=111, fraction=0.30),
            LadderLeg(level=2, price=121, fraction=1.0),
        ])
        engine = BacktestEngine(cost_model=CostModel())
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        t = trades[0]
        # Exit must be at/near breakeven (~101), not the original stop (91).
        assert t.exit_price == pytest.approx(101.0, abs=0.01)
        assert t.exit_reason == "stop"
        # Blended R: 0.30 leg at 1R + 0.70 leg at ~0R (breakeven) ~= 0.3R
        assert t.r_multiple == pytest.approx(0.30, abs=0.05)

    def test_trailing_activates_and_lets_winner_run_past_old_static_target(self):
        """trailing_activation_r=1 means trailing engages right at TP1.
        With a strong continued trend, the trailing exit should land
        well past where a static single target (e.g. the old 2R TP2)
        would have closed — the actual 'let winners run' behavior."""
        t0 = datetime(2024, 1, 1)
        bars = [bar(t0, 100, 100.5, 99.5, 100)]
        price = 101
        for i in range(1, 30):
            bars.append(bar(t0 + timedelta(hours=i), price, price + 2, price - 0.5, price))
            price += 3  # strong sustained uptrend
        strat = OnceLadderStrategy(entry_hint=101, trailing_activation_r=1, ladder=[
            LadderLeg(level=1, price=111, fraction=0.30),
            LadderLeg(level=2, price=121, fraction=1.0),
        ])
        engine = BacktestEngine(cost_model=CostModel(), max_hold_bars=100)
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        t = trades[0]
        # Final leg should be a trailing exit, not the old fixed level-2 target (121).
        assert t.legs[-1]["price"] > 121
        assert t.r_multiple > 2.0  # beat the old static 2R TP2 ceiling


class TestLadderNoLookaheadAndTimeout:
    def test_ladder_force_closes_at_max_hold_bars(self):
        bars = make_rising_bars(6, start=100, step=0.001)  # barely moves
        strat = OnceLadderStrategy(entry_hint=100.1, ladder=[
            LadderLeg(level=1, price=200, fraction=0.30),
            LadderLeg(level=2, price=300, fraction=1.0),
        ])
        engine = BacktestEngine(max_hold_bars=3)
        trades = engine.run(bars, strat, symbol="TEST")
        assert len(trades) == 1
        assert trades[0].exit_reason == "timeout"
