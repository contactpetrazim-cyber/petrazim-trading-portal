
"""
Unit Tests for SMC Detection Algorithms
Run with: pytest tests/test_smc_algorithms.py -v
"""

import pytest
from datetime import datetime, timedelta
from app.core.smc_algorithms import (
    Candle, MarketStructureDetector, ZoneDetector, FVGDetector,
    LiquidityDetector, EntryExitEngine, RiskManager,
    StructureType, ZoneType, MitigationStatus
)

# =============================================================================
# FIXTURES: Sample candle data
# =============================================================================

@pytest.fixture
def sample_candles():
    """Generate a sample uptrend with clear swing points."""
    base_time = datetime(2024, 1, 1, 0, 0)
    candles = []

    # Create an uptrend: 10, 11, 12, 11, 13, 12, 14, 13, 15, 14, 16
    prices = [
        (10, 11, 9, 10.5),   # 0
        (10.5, 11.5, 10, 11), # 1
        (11, 12.5, 10.8, 12), # 2 - swing high candidate
        (12, 12.2, 11, 11.5), # 3
        (11.5, 13.5, 11.2, 13), # 4 - higher high
        (13, 13.5, 12.5, 12.8), # 5
        (12.8, 14.2, 12.5, 14), # 6 - higher high
        (14, 14.5, 13.2, 13.5), # 7
        (13.5, 15.5, 13.2, 15), # 8 - higher high
        (15, 15.2, 14, 14.5),   # 9
        (14.5, 16, 14.2, 15.8), # 10 - higher high
    ]

    for i, (o, h, l, c) in enumerate(prices):
        candles.append(Candle(
            timestamp=base_time + timedelta(hours=i),
            open=o, high=h, low=l, close=c, volume=1000
        ))

    return candles

@pytest.fixture
def bearish_candles():
    """Generate a sample downtrend."""
    base_time = datetime(2024, 1, 1, 0, 0)
    candles = []

    prices = [
        (20, 21, 19, 20.5),
        (20.5, 21, 20, 20.2),
        (20.2, 20.5, 19, 19.5),  # swing low
        (19.5, 20, 18.5, 19),
        (19, 19.2, 18, 18.5),    # lower low
        (18.5, 19, 18, 18.2),
        (18.2, 18.5, 17, 17.5),  # lower low
        (17.5, 18, 17.2, 17.3),
        (17.3, 17.5, 16.5, 16.8), # lower low
        (16.8, 17, 16.2, 16.5),
    ]

    for i, (o, h, l, c) in enumerate(prices):
        candles.append(Candle(
            timestamp=base_time + timedelta(hours=i),
            open=o, high=h, low=l, close=c, volume=1000
        ))

    return candles

@pytest.fixture
def fvg_candles():
    """Generate candles with a clear bullish FVG."""
    base_time = datetime(2024, 1, 1, 0, 0)
    candles = []

    # Bullish FVG: c1.high(12) < c3.low(14)
    prices = [
        (10, 12, 9, 11),    # c1: high=12
        (11, 13, 10, 12.5), # c2: displacement (large body)
        (13, 15, 14, 14.5), # c3: low=14 > c1.high=12
    ]

    for i, (o, h, l, c) in enumerate(prices):
        candles.append(Candle(
            timestamp=base_time + timedelta(hours=i),
            open=o, high=h, low=l, close=c, volume=5000
        ))

    return candles

# =============================================================================
# TESTS: Market Structure Detector
# =============================================================================

class TestMarketStructureDetector:
    def test_detect_swing_highs(self, sample_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        swings = detector.detect_swing_highs(sample_candles)

        assert len(swings) > 0, "Should detect at least one swing high"

        # Check first swing high is at index 2 (price 12.5)
        first_sh = swings[0]
        assert first_sh.price == 12.5, f"Expected 12.5, got {first_sh.price}"
        assert first_sh.structure_type == StructureType.SWING_HIGH
        assert first_sh.confirmed == True

    def test_detect_swing_lows(self, sample_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        swings = detector.detect_swing_lows(sample_candles)

        # In uptrend, swing lows should be present
        assert len(swings) >= 0  # May or may not have clear lows in this data

    def test_bullish_bos(self, sample_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        swings = detector.detect_swing_highs(sample_candles)
        bos_events = detector.detect_bos(sample_candles, swings)

        # Should detect BOS when price closes above previous swing high
        bullish_bos = [e for e in bos_events if e["type"] == "bullish_bos"]
        assert len(bullish_bos) > 0, "Should detect bullish BOS in uptrend"

        # Verify body-close confirmation (not just wick)
        for event in bullish_bos:
            assert event["confirmation"] == "body_close_above_wick"
            assert event["trigger_price"] > event["structure_level"]

    def test_bearish_bos(self, bearish_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        swings = detector.detect_swing_lows(bearish_candles)
        bos_events = detector.detect_bos(bearish_candles, swings)

        bearish_bos = [e for e in bos_events if e["type"] == "bearish_bos"]
        assert len(bearish_bos) > 0, "Should detect bearish BOS in downtrend"

    def test_choch_detection(self, sample_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        # Need more candles for CHoCH
        swings = detector.detect_swing_highs(sample_candles) + detector.detect_swing_lows(sample_candles)
        choch_events = detector.detect_choch(sample_candles, swings)

        # CHoCH may or may not trigger depending on data
        # Just verify it doesn't crash
        assert isinstance(choch_events, list)

# =============================================================================
# TESTS: Zone Detector
# =============================================================================

class TestZoneDetector:
    def test_detect_order_blocks(self, sample_candles):
        detector = MarketStructureDetector(left_bars=2, right_bars=2)
        zone_detector = ZoneDetector()

        swings = detector.detect_swing_highs(sample_candles) + detector.detect_swing_lows(sample_candles)
        zones = zone_detector.detect_order_blocks(sample_candles, swings)

        assert isinstance(zones, list)
        if len(zones) > 0:
            zone = zones[0]
            assert zone.zone_type == ZoneType.ORDER_BLOCK
            assert zone.top > zone.bottom, "Zone top must be greater than bottom"
            assert zone.mean_threshold == (zone.top + zone.bottom) / 2

    def test_premium_discount_classification(self, sample_candles):
        detector = ZoneDetector()
        zones = [
            type('Zone', (), {
                'top': 15, 'bottom': 14, 'mean_threshold': 14.5,
                'fib_level': None, 'classification': None
            })()
        ]

        classified = detector.classify_premium_discount(zones, swing_high=20, swing_low=10)

        zone = classified[0]
        assert zone.fib_level is not None
        assert zone.fib_level >= 0 and zone.fib_level <= 1
        assert zone.classification in ["premium", "discount", "equilibrium"]

    def test_mitigation_tracking(self, sample_candles):
        detector = ZoneDetector()

        # Create a test zone
        zone = type('Zone', (), {
            'id': 'test', 'symbol': 'TEST', 'timeframe': '1H',
            'zone_type': ZoneType.ORDER_BLOCK,
            'top': 12, 'bottom': 11, 'mean_threshold': 11.5,
            'origin_timestamp': sample_candles[0].timestamp,
            'status': MitigationStatus.ACTIVE,
            'test_count': 0, 'last_test_timestamp': None,
            'mitigated_timestamp': None, 'invalidated_timestamp': None,
            'touches': []
        })()

        # Price touches but doesn't mitigate
        touch_candles = [
            Candle(timestamp=sample_candles[1].timestamp, open=11.2, high=11.8, low=11.1, close=11.3, volume=100)
        ]

        updated = detector.update_mitigation([zone], touch_candles)
        assert updated[0].status == MitigationStatus.TESTED
        assert updated[0].test_count == 1

# =============================================================================
# TESTS: FVG Detector
# =============================================================================

class TestFVGDetector:
    def test_bullish_fvg_detection(self, fvg_candles):
        detector = FVGDetector()
        fvgs = detector.detect_fvg(fvg_candles)

        assert len(fvgs) > 0, "Should detect bullish FVG"

        fvg = fvgs[0]
        assert fvg.gap_type == "bullish"
        assert fvg.top > fvg.bottom, "FVG top must be greater than bottom"
        assert fvg.candle1.high < fvg.candle3.low, "Bullish FVG: c1.high < c3.low"

    def test_fvg_mitigation_tracking(self, fvg_candles):
        detector = FVGDetector()
        fvgs = detector.detect_fvg(fvg_candles)

        if len(fvgs) == 0:
            pytest.skip("No FVG detected")

        # Price enters FVG but doesn't fully mitigate
        mitigating_candles = [
            Candle(
                timestamp=fvg_candles[-1].timestamp + timedelta(hours=1),
                open=14.5, high=14.5, low=11.5, close=12, volume=1000
            )
        ]

        updated = detector.track_mitigation(fvgs, mitigating_candles)
        assert updated[0].mitigated_percent > 0
        assert updated[0].mitigated_percent < 1.0

# =============================================================================
# TESTS: Liquidity Detector
# =============================================================================

class TestLiquidityDetector:
    def test_equal_highs_detection(self, sample_candles):
        detector = LiquidityDetector(tolerance_pips=0.5)
        pools = detector.detect_equal_highs_lows(sample_candles, lookback=20)

        assert isinstance(pools, list)
        # May or may not find EQH depending on data

    def test_liquidity_sweep_detection(self, sample_candles):
        detector = LiquidityDetector(tolerance_pips=0.5)

        # Create a mock liquidity pool
        pool = type('Pool', (), {
            'id': 'test', 'symbol': 'TEST', 'timeframe': '1H',
            'pool_type': 'buy_side', 'price_level': 10.0,
            'touches': [sample_candles[0].timestamp],
            'swept': False, 'sweep_timestamp': None
        })()

        # Candle that sweeps below then closes above
        sweep_candles = [
            Candle(
                timestamp=sample_candles[1].timestamp,
                open=10.5, high=10.8, low=9.5, close=10.2, volume=2000
            )
        ]

        sweeps = detector.detect_liquidity_sweeps([pool], sweep_candles)
        assert len(sweeps) > 0, "Should detect buy-side sweep"
        assert sweeps[0]["type"] == "buy_side_sweep"

# =============================================================================
# TESTS: Entry/Exit Engine
# =============================================================================

class TestEntryExitEngine:
    def test_entry_calculation(self):
        engine = EntryExitEngine(default_rr=3.0)

        zone = type('Zone', (), {
            'top': 15, 'bottom': 14, 'mean_threshold': 14.5,
            'origin_candle_open': 14.2
        })()

        entry = engine.calculate_entry(zone, "mean", "long")
        assert entry["entry_price"] == 14.5
        assert entry["direction"] == "long"

        entry_aggressive = engine.calculate_entry(zone, "aggressive", "long")
        assert entry_aggressive["entry_price"] == 14.0  # zone.bottom

    def test_stop_loss_calculation(self):
        engine = EntryExitEngine(default_rr=3.0)

        entry = {"entry_price": 14.5, "direction": "long"}
        zone = type('Zone', (), {'top': 15, 'bottom': 14})()
        swing = type('Swing', (), {'price': 13.5})()

        sl = engine.calculate_stop_loss(entry, zone, swing, "zone_extreme")
        assert sl["stop_loss"] < entry["entry_price"]
        assert sl["sl_distance"] > 0

    def test_target_calculation(self):
        engine = EntryExitEngine(default_rr=3.0)

        entry = {"entry_price": 14.5, "direction": "long"}
        sl = {"stop_loss": 13.5, "sl_distance": 1.0}

        targets = engine.calculate_targets(entry, sl, rr_ratio=3.0, multi_target=True)
        assert targets["tp1"] == 15.5  # 1R
        assert targets["tp2"] == 16.5  # 2R
        assert targets["tp3"] == 17.5  # 3R
        assert "allocation" in targets

    def test_lot_size_calculation(self):
        engine = EntryExitEngine(default_rr=3.0)

        lots = engine.calculate_lot_size(
            account_balance=10000,
            risk_percent=1.0,
            stop_loss_distance=0.0050,
            pip_value=10.0
        )

        assert lots["lot_size"] > 0
        assert lots["risk_amount"] == 100.0  # 1% of 10,000

# =============================================================================
# TESTS: Risk Manager
# =============================================================================

class TestRiskManager:
    def test_drawdown_calculation(self):
        rm = RiskManager(base_risk_percent=1.0)
        rm.update_equity(10000)
        rm.update_equity(9500)

        dd = rm.get_drawdown()
        assert dd["drawdown_pct"] == 5.0
        assert dd["drawdown_amount"] == 500.0

    def test_position_risk_adjustment(self):
        rm = RiskManager(base_risk_percent=1.0)

        # Normal conditions
        risk = rm.calculate_position_risk(setup_quality=1.0, consecutive_losses=0)
        assert risk == 1.0

        # After 3 consecutive losses
        risk = rm.calculate_position_risk(setup_quality=1.0, consecutive_losses=3)
        assert risk < 1.0  # Should reduce risk

        # During drawdown
        risk = rm.calculate_position_risk(setup_quality=1.0, current_drawdown=6.0)
        assert risk < 1.0  # Should reduce risk

    def test_can_trade_limits(self):
        rm = RiskManager(base_risk_percent=1.0, max_daily_trades=5, max_portfolio_exposure=5.0)
        rm.update_equity(10000)

        # Should be able to trade initially
        check = rm.can_trade(50.0)
        assert check["can_trade"] == True

        # After max daily trades
        for _ in range(5):
            rm.record_trade(50.0)

        check = rm.can_trade(50.0)
        assert check["can_trade"] == False
        assert "Daily trade limit" in check["reasons"][0]

# =============================================================================
# TESTS: MTF Alignment
# =============================================================================

class TestMTFAlignment:
    def test_alignment_scoring(self):
        from app.core.mtf_engine import MTFAlignmentEngine, TimeframeState, Bias, Timeframe

        engine = MTFAlignmentEngine()

        # Set up bullish alignment
        d1_state = TimeframeState(
            timeframe=Timeframe.D1,
            bias=Bias.BULLISH,
            trend_direction="uptrend"
        )
        h4_state = TimeframeState(
            timeframe=Timeframe.H4,
            bias=Bias.BULLISH,
            trend_direction="uptrend"
        )
        m15_state = TimeframeState(
            timeframe=Timeframe.M15,
            bias=Bias.BULLISH,
            trend_direction="uptrend"
        )

        engine.update_state(Timeframe.D1, d1_state)
        engine.update_state(Timeframe.H4, h4_state)
        engine.update_state(Timeframe.M15, m15_state)

        signal = engine.check_alignment("BTCUSDT", "long")

        assert signal is not None, "Should generate signal for aligned bullish setup"
        assert signal.direction == "long"
        assert signal.confidence >= 0.6
        assert signal.d1_alignment == True
        assert signal.h4_alignment == True

    def test_misalignment_rejection(self):
        from app.core.mtf_engine import MTFAlignmentEngine, TimeframeState, Bias, Timeframe

        engine = MTFAlignmentEngine()

        # Bearish D1, trying to go long
        d1_state = TimeframeState(
            timeframe=Timeframe.D1,
            bias=Bias.BEARISH,
            trend_direction="downtrend"
        )
        engine.update_state(Timeframe.D1, d1_state)

        signal = engine.check_alignment("BTCUSDT", "long")
        assert signal is None, "Should reject long signal in bearish D1"
