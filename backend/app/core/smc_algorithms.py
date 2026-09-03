
"""
SMC (Smart Money Concepts) Detection Engine
Production-grade algorithms for market structure, zones, FVGs, and liquidity.
"""

from typing import List, Dict, Optional, Tuple, Literal
from dataclasses import dataclass, field
from datetime import datetime
import numpy as np
from enum import Enum

class StructureType(Enum):
    BOS = "break_of_structure"
    CHOCH = "change_of_character"
    SWING_HIGH = "swing_high"
    SWING_LOW = "swing_low"

class ZoneType(Enum):
    SUPPLY = "supply"
    DEMAND = "demand"
    ORDER_BLOCK = "order_block"
    BREAKER_BLOCK = "breaker_block"
    MITIGATION_BLOCK = "mitigation_block"

class MitigationStatus(Enum):
    ACTIVE = "active"
    TESTED = "tested"
    MITIGATED = "mitigated"
    INVALIDATED = "invalidated"

@dataclass
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

@dataclass
class SwingPoint:
    timestamp: datetime
    price: float
    structure_type: StructureType
    left_bars: int = 3
    right_bars: int = 3
    confirmed: bool = False
    source_candle: Optional[Candle] = None

@dataclass
class Zone:
    id: str
    symbol: str
    timeframe: str
    zone_type: ZoneType
    top: float
    bottom: float
    origin_timestamp: datetime
    status: MitigationStatus = MitigationStatus.ACTIVE
    touches: List[Dict] = field(default_factory=list)
    fib_level: Optional[float] = None
    classification: Optional[str] = None  # premium, discount, equilibrium

@dataclass
class FairValueGap:
    id: str
    symbol: str
    timeframe: str
    top: float
    bottom: float
    gap_type: Literal["bullish", "bearish"]
    candle1: Candle
    candle2: Candle
    candle3: Candle
    status: MitigationStatus = MitigationStatus.ACTIVE
    mitigated_percent: float = 0.0

@dataclass
class LiquidityPool:
    id: str
    symbol: str
    timeframe: str
    pool_type: Literal["buy_side", "sell_side"]
    price_level: float
    touches: List[datetime] = field(default_factory=list)
    swept: bool = False
    sweep_timestamp: Optional[datetime] = None

# =============================================================================
# MODULE 1.1: MARKET STRUCTURE DETECTION
# =============================================================================

class MarketStructureDetector:
    """
    Detects Swing Highs/Lows, BOS, and CHoCH using fractal-based definitions.
    """

    def __init__(self, left_bars: int = 3, right_bars: int = 3):
        self.left_bars = left_bars
        self.right_bars = right_bars

    def detect_swing_highs(self, candles: List[Candle]) -> List[SwingPoint]:
        """
        Fractal Swing High: A candle whose HIGH is >= highs of [left_bars] candles 
        to the left AND >= highs of [right_bars] candles to the right.

        Confirmation requires right_bars to close.
        """
        swings = []
        n = len(candles)

        for i in range(self.left_bars, n - self.right_bars):
            current = candles[i]
            left_slice = candles[i - self.left_bars:i]
            right_slice = candles[i + 1:i + 1 + self.right_bars]

            is_higher_than_left = all(current.high >= c.high for c in left_slice)
            is_higher_than_right = all(current.high >= c.high for c in right_slice)

            if is_higher_than_left and is_higher_than_right:
                swings.append(SwingPoint(
                    timestamp=current.timestamp,
                    price=current.high,
                    structure_type=StructureType.SWING_HIGH,
                    left_bars=self.left_bars,
                    right_bars=self.right_bars,
                    confirmed=True,
                    source_candle=current
                ))
        return swings

    def detect_swing_lows(self, candles: List[Candle]) -> List[SwingPoint]:
        """
        Fractal Swing Low: A candle whose LOW is <= lows of [left_bars] candles 
        to the left AND <= lows of [right_bars] candles to the right.
        """
        swings = []
        n = len(candles)

        for i in range(self.left_bars, n - self.right_bars):
            current = candles[i]
            left_slice = candles[i - self.left_bars:i]
            right_slice = candles[i + 1:i + 1 + self.right_bars]

            is_lower_than_left = all(current.low <= c.low for c in left_slice)
            is_lower_than_right = all(current.low <= c.low for c in right_slice)

            if is_lower_than_left and is_lower_than_right:
                swings.append(SwingPoint(
                    timestamp=current.timestamp,
                    price=current.low,
                    structure_type=StructureType.SWING_LOW,
                    left_bars=self.left_bars,
                    right_bars=self.right_bars,
                    confirmed=True,
                    source_candle=current
                ))
        return swings

    def detect_bos(self, candles: List[Candle], swing_points: List[SwingPoint]) -> List[Dict]:
        """
        Break of Structure (BOS):
        - BULLISH BOS: Price closes above previous SWING HIGH (body close above wick high)
        - BEARISH BOS: Price closes below previous SWING LOW (body close below wick low)

        Confirmation: Body close must exceed the swing point price.
        Wick-only breakouts are NOT valid BOS.
        """
        bos_events = []

        highs = [sp for sp in swing_points if sp.structure_type == StructureType.SWING_HIGH]
        lows = [sp for sp in swing_points if sp.structure_type == StructureType.SWING_LOW]

        for i, candle in enumerate(candles):
            # Bullish BOS: Body close above previous swing high
            for high in highs:
                if high.timestamp < candle.timestamp:
                    if candle.close > high.price and candle.open < high.price:
                        bos_events.append({
                            "timestamp": candle.timestamp,
                            "type": "bullish_bos",
                            "trigger_price": candle.close,
                            "structure_level": high.price,
                            "confirmation": "body_close_above_wick",
                            "candle": candle
                        })

            # Bearish BOS: Body close below previous swing low
            for low in lows:
                if low.timestamp < candle.timestamp:
                    if candle.close < low.price and candle.open > low.price:
                        bos_events.append({
                            "timestamp": candle.timestamp,
                            "type": "bearish_bos",
                            "trigger_price": candle.close,
                            "structure_level": low.price,
                            "confirmation": "body_close_below_wick",
                            "candle": candle
                        })

        return bos_events

    def detect_choch(self, candles: List[Candle], swing_points: List[SwingPoint]) -> List[Dict]:
        """
        Change of Character (CHoCH):
        - BULLISH CHoCH: In a downtrend, price takes out the most recent INTERNAL HIGH
          (not necessarily swing high), indicating potential trend reversal.
        - BEARISH CHoCH: In an uptrend, price takes out the most recent INTERNAL LOW.

        Key distinction from BOS: CHoCH occurs AGAINST the prevailing trend direction
        and typically targets internal structure rather than swing structure.
        """
        choch_events = []

        if len(swing_points) < 3:
            return choch_events

        # Determine trend from recent swing structure
        recent_swings = sorted(swing_points, key=lambda x: x.timestamp)[-6:]

        # Simple trend determination: higher highs + higher lows = uptrend
        highs = [sp for sp in recent_swings if sp.structure_type == StructureType.SWING_HIGH]
        lows = [sp for sp in recent_swings if sp.structure_type == StructureType.SWING_LOW]

        if len(highs) < 2 or len(lows) < 2:
            return choch_events

        uptrend = highs[-1].price > highs[-2].price and lows[-1].price > lows[-2].price
        downtrend = highs[-1].price < highs[-2].price and lows[-1].price < lows[-2].price

        for i, candle in enumerate(candles[-20:]):  # Look at recent candles
            if uptrend:
                # Bearish CHoCH: Close below recent internal low
                recent_low = lows[-1].price
                if candle.close < recent_low and candle.open > recent_low:
                    choch_events.append({
                        "timestamp": candle.timestamp,
                        "type": "bearish_choch",
                        "trigger_price": candle.close,
                        "structure_level": recent_low,
                        "prev_trend": "uptrend",
                        "confirmation": "body_close_below_internal_low",
                        "candle": candle
                    })

            if downtrend:
                # Bullish CHoCH: Close above recent internal high
                recent_high = highs[-1].price
                if candle.close > recent_high and candle.open < recent_high:
                    choch_events.append({
                        "timestamp": candle.timestamp,
                        "type": "bullish_choch",
                        "trigger_price": candle.close,
                        "structure_level": recent_high,
                        "prev_trend": "downtrend",
                        "confirmation": "body_close_above_internal_high",
                        "candle": candle
                    })

        return choch_events


# =============================================================================
# MODULE 1.2: DEMAND & SUPPLY ZONE DETECTION
# =============================================================================

class ZoneDetector:
    """
    Identifies institutional Supply/Demand zones, Order Blocks, Breaker Blocks,
    and Mitigation Blocks from price action.
    """

    def __init__(self, min_expansion_pips: float = 5.0, lookback: int = 50):
        self.min_expansion = min_expansion_pips
        self.lookback = lookback

    def detect_order_blocks(self, candles: List[Candle], swing_points: List[SwingPoint]) -> List[Zone]:
        """
        Order Block (OB) Detection:

        BULLISH OB: The last bearish (down) candle before a strong bullish expansion.
        - Identified: Find the most recent swing low, look left for the last down candle
          before the expansion that created the swing low.
        - Zone: Top = OB candle open, Bottom = OB candle low

        BEARISH OB: The last bullish (up) candle before a strong bearish expansion.
        - Identified: Find the most recent swing high, look left for the last up candle
          before the expansion that created the swing high.
        - Zone: Top = OB candle high, Bottom = OB candle close
        """
        zones = []

        for sp in swing_points:
            if sp.structure_type not in [StructureType.SWING_HIGH, StructureType.SWING_LOW]:
                continue

            # Find the expansion origin candle
            origin_candle = self._find_ob_origin(candles, sp)
            if not origin_candle:
                continue

            if sp.structure_type == StructureType.SWING_LOW:
                # Bullish OB
                zone = Zone(
                    id=f"ob_bull_{sp.timestamp.isoformat()}",
                    symbol="SYMBOL",
                    timeframe="TF",
                    zone_type=ZoneType.ORDER_BLOCK,
                    top=origin_candle.open,
                    bottom=origin_candle.low,
                    origin_timestamp=origin_candle.timestamp
                )
            else:
                # Bearish OB
                zone = Zone(
                    id=f"ob_bear_{sp.timestamp.isoformat()}",
                    symbol="SYMBOL",
                    timeframe="TF",
                    zone_type=ZoneType.ORDER_BLOCK,
                    top=origin_candle.high,
                    bottom=origin_candle.close,
                    origin_timestamp=origin_candle.timestamp
                )

            zone.mean_threshold = (zone.top + zone.bottom) / 2
            zones.append(zone)

        return zones

    def _find_ob_origin(self, candles: List[Candle], swing_point: SwingPoint) -> Optional[Candle]:
        """Find the last opposing candle before the expansion that created the swing point."""
        # Find index of swing point candle
        sp_idx = None
        for i, c in enumerate(candles):
            if c.timestamp == swing_point.timestamp:
                sp_idx = i
                break

        if sp_idx is None or sp_idx < 3:
            return None

        if swing_point.structure_type == StructureType.SWING_LOW:
            # Look left for last bearish candle before bullish expansion
            for i in range(sp_idx - 1, max(0, sp_idx - 10), -1):
                if candles[i].close < candles[i].open:  # Bearish candle
                    return candles[i]
        else:
            # Look left for last bullish candle before bearish expansion
            for i in range(sp_idx - 1, max(0, sp_idx - 10), -1):
                if candles[i].close > candles[i].open:  # Bullish candle
                    return candles[i]

        return None

    def detect_breaker_blocks(self, candles: List[Candle], zones: List[Zone]) -> List[Zone]:
        """
        Breaker Block: A former Order Block that has been mitigated (tested) and then
        violated (price closes through it in the opposite direction), causing it to 
        flip polarity and act as a block in the opposite direction.

        Algorithm:
        1. Track existing OBs
        2. When price mitigates an OB (touches but respects)
        3. Then price closes through the OB in the opposite direction
        4. The OB becomes a Breaker Block with inverted polarity
        """
        breaker_blocks = []

        for zone in zones:
            if zone.zone_type != ZoneType.ORDER_BLOCK:
                continue

            # Check if zone was tested then violated
            if zone.status == MitigationStatus.TESTED:
                # Check for violation (close beyond zone in opposite direction)
                for candle in candles:
                    if zone.zone_type == ZoneType.ORDER_BLOCK and "bull" in zone.id:
                        # Bullish OB violated if close below bottom
                        if candle.close < zone.bottom and candle.timestamp > zone.origin_timestamp:
                            bb = Zone(
                                id=f"bb_{zone.id}",
                                symbol=zone.symbol,
                                timeframe=zone.timeframe,
                                zone_type=ZoneType.BREAKER_BLOCK,
                                top=zone.top,
                                bottom=zone.bottom,
                                origin_timestamp=candle.timestamp,
                                status=MitigationStatus.ACTIVE
                            )
                            bb.mean_threshold = (bb.top + bb.bottom) / 2
                            breaker_blocks.append(bb)
                            break

                    elif zone.zone_type == ZoneType.ORDER_BLOCK and "bear" in zone.id:
                        # Bearish OB violated if close above top
                        if candle.close > zone.top and candle.timestamp > zone.origin_timestamp:
                            bb = Zone(
                                id=f"bb_{zone.id}",
                                symbol=zone.symbol,
                                timeframe=zone.timeframe,
                                zone_type=ZoneType.BREAKER_BLOCK,
                                top=zone.top,
                                bottom=zone.bottom,
                                origin_timestamp=candle.timestamp,
                                status=MitigationStatus.ACTIVE
                            )
                            bb.mean_threshold = (bb.top + bb.bottom) / 2
                            breaker_blocks.append(bb)
                            break

        return breaker_blocks

    def classify_premium_discount(self, zones: List[Zone], swing_high: float, swing_low: float) -> List[Zone]:
        """
        Premium/Discount/Equilibrium classification using Fibonacci retracement
        of the most recent swing range.

        - Discount (< 0.5): Below equilibrium - favorable for LONGS
        - Equilibrium (~0.5): Middle of range
        - Premium (> 0.5): Above equilibrium - favorable for SHORTS
        """
        range_size = swing_high - swing_low
        if range_size == 0:
            return zones

        for zone in zones:
            zone_center = (zone.top + zone.bottom) / 2
            zone.fib_level = (zone_center - swing_low) / range_size

            if zone.fib_level < 0.45:
                zone.classification = "discount"
            elif zone.fib_level > 0.55:
                zone.classification = "premium"
            else:
                zone.classification = "equilibrium"

        return zones

    def update_mitigation(self, zones: List[Zone], candles: List[Candle]) -> List[Zone]:
        """
        Mitigation Engine:
        - ACTIVE: Zone not yet tested
        - TESTED: Price touched zone but closed within it (wick test)
        - MITIGATED: Price entered zone and closed beyond mean threshold
        - INVALIDATED: Price closed beyond zone boundary in adverse direction
        """
        for zone in zones:
            if zone.status in [MitigationStatus.INVALIDATED, MitigationStatus.MITIGATED]:
                continue

            for candle in candles:
                if candle.timestamp <= zone.origin_timestamp:
                    continue

                # Check touch
                touched = (candle.low <= zone.top and candle.high >= zone.bottom)

                if touched:
                    zone.test_count += 1
                    zone.last_test_timestamp = candle.timestamp
                    zone.touches.append({
                        "price": candle.close,
                        "timestamp": candle.timestamp.isoformat(),
                        "type": "wick_test" if candle.close > zone.bottom and candle.close < zone.top else "body_test"
                    })

                    # Check mitigation (close beyond 50% threshold)
                    if zone.zone_type in [ZoneType.SUPPLY, ZoneType.ORDER_BLOCK, ZoneType.BREAKER_BLOCK]:
                        if "bull" in zone.id or zone.zone_type == ZoneType.DEMAND:
                            if candle.close > zone.mean_threshold:
                                zone.status = MitigationStatus.MITIGATED
                                zone.mitigated_timestamp = candle.timestamp
                                break
                        else:
                            if candle.close < zone.mean_threshold:
                                zone.status = MitigationStatus.MITIGATED
                                zone.mitigated_timestamp = candle.timestamp
                                break

                    # Check invalidation (close beyond zone in adverse direction)
                    if "bull" in zone.id or zone.zone_type == ZoneType.DEMAND:
                        if candle.close < zone.bottom:
                            zone.status = MitigationStatus.INVALIDATED
                            zone.invalidated_timestamp = candle.timestamp
                            break
                    else:
                        if candle.close > zone.top:
                            zone.status = MitigationStatus.INVALIDATED
                            zone.invalidated_timestamp = candle.timestamp
                            break

                    if zone.status == MitigationStatus.ACTIVE:
                        zone.status = MitigationStatus.TESTED

        return zones


# =============================================================================
# MODULE 2: FAIR VALUE GAP (FVG) DETECTION
# =============================================================================

class FVGDetector:
    """
    Detects Fair Value Gaps / Imbalances using precise 3-candle mapping rules.
    """

    def detect_fvg(self, candles: List[Candle]) -> List[FairValueGap]:
        """
        FVG Detection Rules (3-Candle Pattern):

        BULLISH FVG:
        - Candle 1 HIGH < Candle 3 LOW
        - Gap = [Candle1.High, Candle3.Low]
        - Candle 2 is the displacement candle (typically large body)

        BEARISH FVG:
        - Candle 1 LOW > Candle 3 HIGH
        - Gap = [Candle3.High, Candle1.Low]
        - Candle 2 is the displacement candle

        Mitigation Tracking:
        - Partial: Price enters gap but doesn't close beyond
        - Full: Price closes through the gap (creates Inversion FVG)
        """
        fvgs = []

        for i in range(len(candles) - 2):
            c1 = candles[i]
            c2 = candles[i + 1]
            c3 = candles[i + 2]

            # Bullish FVG
            if c1.high < c3.low:
                # Validate: c2 should show displacement (large body in direction of gap)
                c2_body = abs(c2.close - c2.open)
                avg_body = np.mean([abs(c.close - c.open) for c in candles[max(0,i-5):i+3]])

                if c2_body > avg_body * 0.5:  # Displacement validation
                    fvg = FairValueGap(
                        id=f"fvg_bull_{c1.timestamp.isoformat()}",
                        symbol="SYMBOL",
                        timeframe="TF",
                        top=c3.low,
                        bottom=c1.high,
                        gap_type="bullish",
                        candle1=c1,
                        candle2=c2,
                        candle3=c3
                    )
                    fvgs.append(fvg)

            # Bearish FVG
            if c1.low > c3.high:
                c2_body = abs(c2.close - c2.open)
                avg_body = np.mean([abs(c.close - c.open) for c in candles[max(0,i-5):i+3]])

                if c2_body > avg_body * 0.5:
                    fvg = FairValueGap(
                        id=f"fvg_bear_{c1.timestamp.isoformat()}",
                        symbol="SYMBOL",
                        timeframe="TF",
                        top=c1.low,
                        bottom=c3.high,
                        gap_type="bearish",
                        candle1=c1,
                        candle2=c2,
                        candle3=c3
                    )
                    fvgs.append(fvg)

        return fvgs

    def track_mitigation(self, fvgs: List[FairValueGap], candles: List[Candle]) -> List[FairValueGap]:
        """
        Track FVG mitigation state:
        - Price entering the gap = partial mitigation
        - Price closing through the gap = full mitigation (potential inversion)
        """
        for fvg in fvgs:
            if fvg.status != MitigationStatus.ACTIVE:
                continue

            gap_size = fvg.top - fvg.bottom
            if gap_size <= 0:
                continue

            for candle in candles:
                if candle.timestamp <= fvg.candle3.timestamp:
                    continue

                # Check if price entered gap
                entered_gap = (candle.low <= fvg.top and candle.high >= fvg.bottom)

                if entered_gap:
                    # Calculate mitigated percentage
                    if fvg.gap_type == "bullish":
                        # For bullish FVG: mitigation is price moving down into gap
                        if candle.close <= fvg.top:
                            mitigated = (fvg.top - max(candle.close, fvg.bottom)) / gap_size
                            fvg.mitigated_percent = min(1.0, mitigated)

                        # Full mitigation: close below bottom (creates inversion)
                        if candle.close < fvg.bottom:
                            fvg.status = MitigationStatus.MITIGATED
                            fvg.mitigated_percent = 1.0
                            break

                    elif fvg.gap_type == "bearish":
                        # For bearish FVG: mitigation is price moving up into gap
                        if candle.close >= fvg.bottom:
                            mitigated = (min(candle.close, fvg.top) - fvg.bottom) / gap_size
                            fvg.mitigated_percent = min(1.0, mitigated)

                        # Full mitigation: close above top
                        if candle.close > fvg.top:
                            fvg.status = MitigationStatus.MITIGATED
                            fvg.mitigated_percent = 1.0
                            break

        return fvgs


# =============================================================================
# MODULE 2: LIQUIDITY STRUCTURES
# =============================================================================

class LiquidityDetector:
    """
    Detects Equal Highs/Lows (EQH/EQL), Trendline Liquidity (TLQ),
    and Buy-Side/Sell-Side Liquidity pools.
    """

    def __init__(self, tolerance_pips: float = 2.0):
        self.tolerance = tolerance_pips

    def detect_equal_highs_lows(self, candles: List[Candle], lookback: int = 20) -> List[LiquidityPool]:
        """
        Equal Highs (EQH) / Equal Lows (EQL):
        - Two or more swing highs within tolerance of each other
        - Two or more swing lows within tolerance of each other
        - These levels attract price due to stop-loss clusters
        """
        pools = []

        # Find local highs and lows
        highs = []
        lows = []

        for i in range(2, len(candles) - 2):
            if candles[i].high >= candles[i-1].high and candles[i].high >= candles[i-2].high and \
               candles[i].high >= candles[i+1].high and candles[i].high >= candles[i+2].high:
                highs.append((candles[i].timestamp, candles[i].high))

            if candles[i].low <= candles[i-1].low and candles[i].low <= candles[i-2].low and \
               candles[i].low <= candles[i+1].low and candles[i].low <= candles[i+2].low:
                lows.append((candles[i].timestamp, candles[i].low))

        # Cluster highs
        eqh_clusters = self._cluster_levels([h[1] for h in highs], self.tolerance)
        for cluster in eqh_clusters:
            if len(cluster) >= 2:
                avg_price = np.mean(cluster)
                touches = [h[0] for h in highs if abs(h[1] - avg_price) <= self.tolerance]
                pools.append(LiquidityPool(
                    id=f"eqh_{touches[0].isoformat()}",
                    symbol="SYMBOL",
                    timeframe="TF",
                    pool_type="sell_side",
                    price_level=avg_price,
                    touches=touches
                ))

        # Cluster lows
        eql_clusters = self._cluster_levels([l[1] for l in lows], self.tolerance)
        for cluster in eql_clusters:
            if len(cluster) >= 2:
                avg_price = np.mean(cluster)
                touches = [l[0] for l in lows if abs(l[1] - avg_price) <= self.tolerance]
                pools.append(LiquidityPool(
                    id=f"eql_{touches[0].isoformat()}",
                    symbol="SYMBOL",
                    timeframe="TF",
                    pool_type="buy_side",
                    price_level=avg_price,
                    touches=touches
                ))

        return pools

    def detect_trendline_liquidity(self, swing_points: List[SwingPoint]) -> List[LiquidityPool]:
        """
        Trendline Liquidity (TLQ):
        - Trendlines drawn through 2+ swing highs or swing lows
        - Liquidity builds above/below these trendlines as retail traders place stops
        - Algorithm: Fit trendlines to consecutive swing points, project forward
        """
        pools = []

        highs = [sp for sp in swing_points if sp.structure_type == StructureType.SWING_HIGH]
        lows = [sp for sp in swing_points if sp.structure_type == StructureType.SWING_LOW]

        # Fit trendlines to highs (resistance trendline = sell-side liquidity)
        if len(highs) >= 2:
            for i in range(len(highs) - 1):
                h1, h2 = highs[i], highs[i + 1]
                # Descending trendline = sell-side liquidity building below
                if h2.price < h1.price:
                    projected = self._project_trendline(h1, h2, "high")
                    pools.append(LiquidityPool(
                        id=f"tlq_high_{h1.timestamp.isoformat()}",
                        symbol="SYMBOL",
                        timeframe="TF",
                        pool_type="sell_side",
                        price_level=projected["current_level"],
                        touches=[h1.timestamp, h2.timestamp]
                    ))

        # Fit trendlines to lows (support trendline = buy-side liquidity)
        if len(lows) >= 2:
            for i in range(len(lows) - 1):
                l1, l2 = lows[i], lows[i + 1]
                # Ascending trendline = buy-side liquidity building above
                if l2.price > l1.price:
                    projected = self._project_trendline(l1, l2, "low")
                    pools.append(LiquidityPool(
                        id=f"tlq_low_{l1.timestamp.isoformat()}",
                        symbol="SYMBOL",
                        timeframe="TF",
                        pool_type="buy_side",
                        price_level=projected["current_level"],
                        touches=[l1.timestamp, l2.timestamp]
                    ))

        return pools

    def detect_liquidity_sweeps(self, pools: List[LiquidityPool], candles: List[Candle]) -> List[Dict]:
        """
        Liquidity Sweep: Price briefly exceeds a liquidity pool level (taking out stops)
        then reverses sharply. Confirmed by:
        1. Wick beyond pool level
        2. Body close back inside structure
        3. Often followed by CHoCH or BOS
        """
        sweeps = []

        for pool in pools:
            if pool.swept:
                continue

            for candle in candles:
                if candle.timestamp <= pool.touches[-1]:
                    continue

                if pool.pool_type == "buy_side":
                    # Buy-side sweep: Wick below EQL, close back above
                    if candle.low < pool.price_level and candle.close > pool.price_level:
                        pool.swept = True
                        pool.sweep_timestamp = candle.timestamp
                        sweeps.append({
                            "pool_id": pool.id,
                            "type": "buy_side_sweep",
                            "sweep_price": candle.low,
                            "pool_level": pool.price_level,
                            "close_price": candle.close,
                            "timestamp": candle.timestamp,
                            "confirmation": "wick_below_close_above"
                        })
                        break

                elif pool.pool_type == "sell_side":
                    # Sell-side sweep: Wick above EQH, close back below
                    if candle.high > pool.price_level and candle.close < pool.price_level:
                        pool.swept = True
                        pool.sweep_timestamp = candle.timestamp
                        sweeps.append({
                            "pool_id": pool.id,
                            "type": "sell_side_sweep",
                            "sweep_price": candle.high,
                            "pool_level": pool.price_level,
                            "close_price": candle.close,
                            "timestamp": candle.timestamp,
                            "confirmation": "wick_above_close_below"
                        })
                        break

        return sweeps

    def _cluster_levels(self, levels: List[float], tolerance: float) -> List[List[float]]:
        """Cluster price levels within tolerance."""
        if not levels:
            return []

        sorted_levels = sorted(levels)
        clusters = [[sorted_levels[0]]]

        for level in sorted_levels[1:]:
            if abs(level - clusters[-1][-1]) <= tolerance:
                clusters[-1].append(level)
            else:
                clusters.append([level])

        return [c for c in clusters if len(c) >= 2]

    def _project_trendline(self, p1: SwingPoint, p2: SwingPoint, point_type: str) -> Dict:
        """Project a trendline forward from two swing points."""
        # Simple linear projection
        time_diff = (p2.timestamp - p1.timestamp).total_seconds()
        price_diff = p2.price - p1.price

        if time_diff == 0:
            slope = 0
        else:
            slope = price_diff / time_diff

        return {
            "slope": slope,
            "current_level": p2.price,
            "projected_next": p2.price + slope * time_diff
        }


# =============================================================================
# MODULE 1.3: ENTRY & EXIT HEURISTICS
# =============================================================================

class EntryExitEngine:
    """
    Entry and Exit heuristic engine implementing:
    - Liquidity sweep entries
    - Mitigation entry types (Open, Mean Threshold, 50% Equilibrium)
    - Multi-target exits with trailing stops
    """

    def __init__(self, default_rr: float = 3.0):
        self.default_rr = default_rr

    def calculate_entry(self, 
                       zone: Zone, 
                       entry_type: Literal["open", "mean", "equilibrium", "aggressive"],
                       direction: Literal["long", "short"]) -> Dict:
        """
        Calculate precise entry price based on zone and entry type.

        Entry Types:
        - OPEN: Entry at zone origin candle open
        - MEAN: Entry at mean threshold (top+bottom)/2
        - EQUILIBRIUM: Entry at 50% of zone (same as mean)
        - AGGRESSIVE: Entry at zone extreme (top for long, bottom for short)
        """
        if entry_type == "open":
            entry_price = zone.origin_candle_open if hasattr(zone, 'origin_candle_open') else zone.mean_threshold
        elif entry_type == "mean" or entry_type == "equilibrium":
            entry_price = zone.mean_threshold
        elif entry_type == "aggressive":
            entry_price = zone.bottom if direction == "long" else zone.top
        else:
            entry_price = zone.mean_threshold

        return {
            "entry_price": round(entry_price, 5),
            "zone_top": zone.top,
            "zone_bottom": zone.bottom,
            "entry_type": entry_type,
            "direction": direction
        }

    def calculate_stop_loss(self,
                           entry: Dict,
                           zone: Zone,
                           structure_swing: SwingPoint,
                           method: Literal["zone_extreme", "structure_swing", "atr", "fixed"],
                           atr_value: float = None,
                           fixed_pips: float = 10.0) -> Dict:
        """
        Stop Loss Calculation:
        - ZONE_EXTREME: Beyond opposite side of zone + buffer
        - STRUCTURE_SWING: Beyond recent swing high/low
        - ATR: Entry +/- (1.5 * ATR)
        - FIXED: Fixed pip distance
        """
        direction = entry["direction"]
        entry_price = entry["entry_price"]

        if method == "zone_extreme":
            if direction == "long":
                sl = zone.bottom - (zone.top - zone.bottom) * 0.1  # 10% buffer below zone
            else:
                sl = zone.top + (zone.top - zone.bottom) * 0.1

        elif method == "structure_swing":
            if direction == "long":
                sl = structure_swing.price - (entry_price - structure_swing.price) * 0.05
            else:
                sl = structure_swing.price + (structure_swing.price - entry_price) * 0.05

        elif method == "atr" and atr_value:
            buffer = 1.5 * atr_value
            if direction == "long":
                sl = entry_price - buffer
            else:
                sl = entry_price + buffer

        elif method == "fixed":
            pip_size = 0.0001  # Adjust for asset
            buffer = fixed_pips * pip_size
            if direction == "long":
                sl = entry_price - buffer
            else:
                sl = entry_price + buffer

        else:
            sl = zone.bottom if direction == "long" else zone.top

        sl_distance = abs(entry_price - sl)

        return {
            "stop_loss": round(sl, 5),
            "sl_distance": round(sl_distance, 5),
            "sl_distance_pips": round(sl_distance / 0.0001, 1),
            "method": method
        }

    def calculate_targets(self,
                         entry: Dict,
                         stop_loss: Dict,
                         rr_ratio: float = None,
                         multi_target: bool = True) -> Dict:
        """
        Multi-target exit mechanics:
        - TP1: 1:1 R (breakeven move)
        - TP2: 2:1 R (primary target)
        - TP3: 3:1 R or higher (runner)

        Trailing stop activates after TP1 hit.
        """
        rr = rr_ratio or self.default_rr
        entry_price = entry["entry_price"]
        sl = stop_loss["stop_loss"]
        sl_distance = stop_loss["sl_distance"]
        direction = entry["direction"]

        if direction == "long":
            tp1 = entry_price + sl_distance * 1.0
            tp2 = entry_price + sl_distance * 2.0
            tp3 = entry_price + sl_distance * rr
        else:
            tp1 = entry_price - sl_distance * 1.0
            tp2 = entry_price - sl_distance * 2.0
            tp3 = entry_price - sl_distance * rr

        result = {
            "tp1": round(tp1, 5),
            "tp2": round(tp2, 5),
            "tp3": round(tp3, 5),
            "rr_ratio": rr,
            "trailing_activation": "tp1",  # Activate trailing after TP1
            "trailing_stop_distance": "structure"  # Trail by recent structure
        }

        if multi_target:
            result["allocation"] = {
                "tp1": 0.30,  # 30% at 1R
                "tp2": 0.40,  # 40% at 2R
                "tp3": 0.30   # 30% runner
            }

        return result

    def calculate_lot_size(self,
                          account_balance: float,
                          risk_percent: float,
                          stop_loss_distance: float,
                          pip_value: float = 10.0,
                          contract_size: float = 100000.0) -> Dict:
        """
        Position Sizing Formula:
        Lot Size = (Account Balance * Risk%) / Stop Loss Distance (in price units)

        For FX: Adjust for pip value and contract size
        For Crypto: Direct calculation
        """
        risk_amount = account_balance * (risk_percent / 100)

        if stop_loss_distance <= 0:
            return {"lot_size": 0, "risk_amount": 0, "error": "Invalid stop loss distance"}

        # Raw lot size in units
        raw_lots = risk_amount / stop_loss_distance

        # For standard FX lot sizing
        lots = raw_lots / (contract_size * pip_value)

        # Normalize to standard lot sizes (0.01 increments)
        normalized_lots = round(lots / 0.01) * 0.01

        return {
            "lot_size": normalized_lots,
            "raw_lot_size": round(lots, 4),
            "risk_amount": round(risk_amount, 2),
            "risk_percent": risk_percent,
            "stop_loss_distance": stop_loss_distance,
            "pip_value": pip_value,
            "contract_size": contract_size
        }


# =============================================================================
# MODULE 1.4: RISK & PORTFOLIO MANAGEMENT
# =============================================================================

class RiskManager:
    """
    Portfolio-level risk management with compounding safeguards.
    """

    def __init__(self, 
                 base_risk_percent: float = 1.0,
                 max_portfolio_exposure: float = 5.0,
                 max_daily_trades: int = 10,
                 compounding: bool = True):
        self.base_risk = base_risk_percent
        self.max_exposure = max_portfolio_exposure
        self.max_daily = max_daily_trades
        self.compounding = compounding
        self.daily_trade_count = 0
        self.current_exposure = 0.0
        self.equity_peak = 0.0
        self.current_equity = 0.0

    def update_equity(self, current_equity: float):
        """Update current equity and track peak for drawdown calculation."""
        self.current_equity = current_equity
        if current_equity > self.equity_peak:
            self.equity_peak = current_equity

    def get_drawdown(self) -> Dict:
        """Calculate current drawdown from equity peak."""
        if self.equity_peak <= 0:
            return {"drawdown_pct": 0.0, "drawdown_amount": 0.0}

        dd_amount = self.equity_peak - self.current_equity
        dd_pct = (dd_amount / self.equity_peak) * 100

        return {
            "drawdown_pct": round(dd_pct, 2),
            "drawdown_amount": round(dd_amount, 2),
            "equity_peak": self.equity_peak,
            "current_equity": self.current_equity
        }

    def calculate_position_risk(self,
                               setup_quality: float = 1.0,  # 0.5 to 1.5
                               consecutive_losses: int = 0,
                               current_drawdown: float = 0.0) -> float:
        """
        Dynamic risk adjustment:
        - Reduce risk after consecutive losses (fixed fractional)
        - Reduce risk during drawdown
        - Increase risk for high-probability setups (capped)
        """
        risk = self.base_risk

        # Fixed fractional: reduce by 20% per consecutive loss
        if consecutive_losses > 0:
            risk *= (0.8 ** min(consecutive_losses, 5))

        # Drawdown protection: reduce risk proportionally
        if current_drawdown > 5.0:
            risk *= 0.5
        elif current_drawdown > 3.0:
            risk *= 0.75

        # Setup quality adjustment (capped at 1.5x)
        risk *= min(setup_quality, 1.5)

        # Hard limits
        risk = min(risk, 3.0)  # Max 3% per trade
        risk = max(risk, 0.25)  # Min 0.25% per trade

        return round(risk, 2)

    def can_trade(self, new_risk_amount: float) -> Dict:
        """
        Portfolio exposure safeguard.
        Check if new trade would exceed daily/max limits.
        """
        checks = {
            "can_trade": True,
            "reasons": []
        }

        if self.daily_trade_count >= self.max_daily:
            checks["can_trade"] = False
            checks["reasons"].append(f"Daily trade limit reached ({self.max_daily})")

        new_exposure = self.current_exposure + new_risk_amount
        if new_exposure > (self.current_equity * self.max_exposure / 100):
            checks["can_trade"] = False
            checks["reasons"].append(f"Max portfolio exposure would exceed {self.max_exposure}%")

        drawdown = self.get_drawdown()
        if drawdown["drawdown_pct"] > 10.0:
            checks["can_trade"] = False
            checks["reasons"].append("Drawdown exceeds 10% - trading halted")

        return checks

    def record_trade(self, risk_amount: float):
        """Record a new trade in portfolio tracking."""
        self.daily_trade_count += 1
        self.current_exposure += risk_amount

    def reset_daily(self):
        """Reset daily counters."""
        self.daily_trade_count = 0
