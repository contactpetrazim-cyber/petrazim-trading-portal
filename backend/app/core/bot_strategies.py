"""
Five Distinct SMC Bot Trading Styles
Grounded in: Mark Douglas, Wyckoff, Dalton, Damir, Brooks, ICT, Photon, Jeafx

CRITICAL: this module's own opening triple-quote was found MISSING on
`main` (2026-10-02) — almost certainly lost in PR #170's push through the
GitHub API workaround used when local `git push` had no credentials
(see github-create-or-update-file-contents's own known flakiness,
independently reproduced and caught the same day pushing PR #171). A
single dropped line silently swallowed everything from here down to
this class's own docstring into one inert string literal, which is a
SyntaxError at module import — confirmed directly in Render's own
deploy logs ("SyntaxError: invalid decimal literal", 2026-09-30
23:57:29 UTC): PR #170 and PR #171 both show `update_failed` deploys
and Render had been silently serving PR #169's code ever since,
through every merge since, with the site never visibly going down
only because Render's zero-downtime deploy never cut over a build
that failed to import. Restoring this one line is the entire fix —
every other PR #170/#171 change underneath was already correct and
intact; only this file ever failed to deploy.
"""

from typing import Dict, List, Optional, Literal
from dataclasses import dataclass
from datetime import datetime
import structlog
from app.core.smc_algorithms import (
    MarketStructureDetector, ZoneDetector, FVGDetector, 
    LiquidityDetector, EntryExitEngine, RiskManager,
    Candle, SwingPoint, Zone, FairValueGap, LiquidityPool
)
from app.core.mtf_engine import MTFAlignmentEngine, AlignmentSignal, TimeframeState, Bias, Timeframe

logger = structlog.get_logger()

@dataclass
class BotSignal:
    bot_id: str
    bot_name: str
    symbol: str
    direction: Literal["long", "short"]
    confidence: float
    entry_price: float
    stop_loss: float
    # take_profit is TP1 (1R) — take_profit_2/3 carry the rest of the
    # 1R/2R/rr_ratio-R ladder calculate_targets() already computes for
    # every bot that uses it. Previously every bot collapsed the whole
    # ladder down to a single value (targets["tp2"], a flat 2R) because
    # BotSignal had nowhere to put TP2/TP3 — so no bot-placed trade
    # could ever realize more than ~2R even when its own signal had
    # qualified at a genuine 3R-5R reward:risk (confirmed in production:
    # every TP1 close across every bot landed at r_multiple≈2.0,
    # never higher, by direct bug report "TP is always lower than 3R
    # always"). Optional so a single-target strategy (Bot 4, whose
    # target is a structural range level, not an R-multiple ladder)
    # keeps working unchanged.
    take_profit: float
    lot_size: float
    risk_percent: float
    reasoning: str
    timestamp: datetime
    # Which exchange to execute this signal on — see BotConfig.exchange
    # and execution_engine.py\'s _check_price_deviation. Optional so the
    # five bot classes above (which don\'t set it) keep working; None
    # falls back to execution_engine\'s symbol-based guess.
    preferred_broker: Optional[str] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None

# =============================================================================
# BOT 1: Pure Macro Swing Structure Bot (Damir/Brooks Style)
# =============================================================================

class MacroSwingStructureBot:
    """
    Bot 1: The Pure Macro Swing Structure Bot

    Philosophy (Damir/Brooks):
    - Trade major structural transitions, not noise
    - Wait for confirmed trend breaks on higher timeframes
    - Enter on pullbacks to structural levels
    - Hold for multi-day/week moves

    Rules:
    1. Only trade 1D and 4H confirmed structures
    2. Wait for BOS (not CHoCH) - confirmed trend continuation
    3. Entry on retracement to 50% of expansion or previous structure
    4. Stop beyond the swing point that defined the structure
    5. Target 3:1 minimum, often 5:1+ for swing trades
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_1_macro_swing"
        self.bot_name = "Pure Macro Swing Structure"
        self.config = config
        self.structure_detector = MarketStructureDetector(left_bars=5, right_bars=5)
        self.entry_engine = EntryExitEngine(default_rr=5.0)
        self.risk_manager = RiskManager(
            base_risk_percent=config.get("risk_per_trade", 1.5),
            max_portfolio_exposure=config.get("max_exposure", 5.0)
        )
        self.mtf = MTFAlignmentEngine()

    def analyze(self,
                candles_1d: List[Candle],
                candles_4h: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None) -> Optional[BotSignal]:
        """
        Macro Swing Analysis Pipeline:
        1. Detect 1D swing structure
        2. Confirm with 4H BOS (not CHoCH)
        3. Identify demand/supply at 50% retracement
        4. Calculate entry on 4H pullback
        5. Set wide stops for swing holding
        """

        # Step 1: 1D Structure
        swings_1d = self.structure_detector.detect_swing_highs(candles_1d) + \
                    self.structure_detector.detect_swing_lows(candles_1d)

        if len(swings_1d) < 4:
            return None

        # Determine macro trend
        recent_swings = sorted(swings_1d, key=lambda x: x.timestamp)[-4:]
        # (the `s.structure_type == SwingPoint.structure_type` clause this
        # line used to also check was comparing an instance\'s field
        # against the same name looked up on the class itself, which
        # doesn\'t exist as a class attribute — SwingPoint.structure_type
        # is a per-instance dataclass field, not a class-level default.
        # AttributeError, every single call, confirmed live via the
        # market scanner — the real filter was always just this half.)
        highs = [s for s in recent_swings if s.structure_type.name == "SWING_HIGH"]
        lows = [s for s in recent_swings if s.structure_type.name == "SWING_LOW"]

        if not highs or not lows:
            return None

        bullish_trend = highs[-1].price > highs[-2].price and lows[-1].price > lows[-2].price
        bearish_trend = highs[-1].price < highs[-2].price and lows[-1].price < lows[-2].price

        if not bullish_trend and not bearish_trend:
            return None

        # Step 2: 4H BOS Confirmation
        bos_4h = self.structure_detector.detect_bos(candles_4h, 
            self.structure_detector.detect_swing_highs(candles_4h) + 
            self.structure_detector.detect_swing_lows(candles_4h))

        if not bos_4h:
            return None

        last_bos = bos_4h[-1]

        # Direction alignment
        if bullish_trend and last_bos["type"] != "bullish_bos":
            return None
        if bearish_trend and last_bos["type"] != "bearish_bos":
            return None

        # Step 3: Find 4H zone for entry
        zone_detector = ZoneDetector()
        zones = zone_detector.detect_order_blocks(candles_4h, 
            self.structure_detector.detect_swing_highs(candles_4h) + 
            self.structure_detector.detect_swing_lows(candles_4h))

        # Filter for active zones in discount (long) or premium (short)
        valid_zones = [z for z in zones if z.status.name == "ACTIVE"]

        if bullish_trend:
            valid_zones = [z for z in valid_zones if "bull" in z.id]
        else:
            valid_zones = [z for z in valid_zones if "bear" in z.id]

        if not valid_zones:
            return None

        entry_zone = valid_zones[-1]  # Most recent

        # Step 4: Calculate entry
        direction = "long" if bullish_trend else "short"
        entry = self.entry_engine.calculate_entry(entry_zone, "mean", direction)

        # Step 5: Stop beyond swing structure
        if direction == "long":
            sl_swing = lows[-1]
        else:
            sl_swing = highs[-1]

        sl = self.entry_engine.calculate_stop_loss(
            entry, entry_zone, sl_swing, "structure_swing"
        )

        # Step 6: Targets (5:1 for swing)
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 5.0, multi_target=True)

        # Step 7: Lot sizing
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.2, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(
            account_balance, risk, sl["sl_distance"]
        )

        return BotSignal(
            bot_id=self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.85,
            entry_price=entry["entry_price"],
            stop_loss=sl["stop_loss"],
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"Macro swing {direction}. 1D trend confirmed. 4H BOS at {last_bos["structure_level"]}. "
                     f"Entry at 4H OB mean. SL beyond swing {sl_swing.price}. Target 5R.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 2: High-Frequency Order Block Reversal Bot (ICT Core Style)
# =============================================================================

class OrderBlockReversalBot:
    """
    Bot 2: High-Frequency Order Block Reversal

    Philosophy (ICT Core Mentorship):
    - Trade inside HTF blocks on LTF reversals
    - Internal liquidity sweeps before true moves
    - Rapid premium/discount adjustments
    - Early CHoCH entries inside HTF blocks

    Rules:
    1. Identify 4H or 1H Order Block
    2. Wait for price to return to OB (discount for long, premium for short)
    3. On 15M: Look for liquidity sweep of internal structure
    4. Enter on 15M CHoCH + FVG in direction of HTF bias
    5. Tight stop beyond the sweep low/high
    6. Target 3:1, often scale out at 2R
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_2_ob_reversal"
        self.bot_name = "HF Order Block Reversal"
        self.config = config
        self.structure_detector = MarketStructureDetector(left_bars=3, right_bars=3)
        self.entry_engine = EntryExitEngine(default_rr=3.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)
        self.mtf = MTFAlignmentEngine()

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None) -> Optional[BotSignal]:

        # Step 1: Find HTF Order Blocks (4H or 1H)
        zone_detector = ZoneDetector()
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)

        obs = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_obs = [z for z in obs if z.status.name == "ACTIVE"]

        if not active_obs:
            # Try 1H
            swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                        self.structure_detector.detect_swing_lows(candles_1h)
            obs = zone_detector.detect_order_blocks(candles_1h, swings_1h)
            active_obs = [z for z in obs if z.status.name == "ACTIVE"]

        if not active_obs:
            return None

        # Step 2: Check which OB price is currently inside
        current_price = candles_15m[-1].close
        inside_obs = [z for z in active_obs if z.bottom <= current_price <= z.top]

        if not inside_obs:
            return None

        target_ob = inside_obs[-1]

        # Step 3: 15M Internal Liquidity Sweep + CHoCH
        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)

        choch_15m = self.structure_detector.detect_choch(candles_15m, swings_15m)

        if not choch_15m:
            return None

        last_choch = choch_15m[-1]

        # Determine direction from CHoCH
        if last_choch["type"] == "bullish_choch":
            direction = "long"
        elif last_choch["type"] == "bearish_choch":
            direction = "short"
        else:
            return None

        # Step 4: Check for liquidity sweep before CHoCH
        liq_detector = LiquidityDetector()
        pools = liq_detector.detect_equal_highs_lows(candles_15m)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])

        has_sweep = len(sweeps) > 0

        # Step 5: FVG confirmation on 15M
        fvg_detector = FVGDetector()
        fvgs = fvg_detector.detect_fvg(candles_15m[-10:])
        active_fvgs = [f for f in fvgs if f.status.name == "ACTIVE" and f.gap_type == direction]

        # Step 6: Entry at OB mean or aggressive
        entry_type = "mean" if has_sweep else "aggressive"
        entry = self.entry_engine.calculate_entry(target_ob, entry_type, direction)

        # Step 7: Stop beyond sweep or structure
        if has_sweep:
            sl_price = sweeps[-1]["sweep_price"]
            sl = {
                "stop_loss": sl_price - 0.0002 if direction == "long" else sl_price + 0.0002,
                "sl_distance": abs(entry["entry_price"] - sl_price),
                "method": "sweep_extreme"
            }
        else:
            sl_swing = swings_15m[-1]
            sl = self.entry_engine.calculate_stop_loss(entry, target_ob, sl_swing, "structure_swing")

        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 3.0)
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.1, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl["sl_distance"])

        return BotSignal(
            bot_id=self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.80 if has_sweep else 0.70,
            entry_price=entry["entry_price"],
            stop_loss=sl["stop_loss"],
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"ICT OB Reversal {direction}. HTF OB active. 15M CHoCH + {'sweep' if has_sweep else 'no sweep'}. "
                     f"FVG confirmation: {len(active_fvgs)} active. Tight SL. 3R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 3: Imbalance Expansion & FVG Fill Bot (Photon/Phantom Style)
# =============================================================================

class FVGExpansionBot:
    """
    Bot 3: Imbalance Expansion & FVG Fill

    Philosophy (Photon/Phantom):
    - Trade unmitigated institutional imbalances
    - High-momentum plays with rigid BOS trailing
    - Enter on FVG retest after expansion
    - Trail stop by BOS for runner positions

    Rules:
    1. Identify unmitigated FVG on 1H or 4H
    2. Wait for price to return and partially mitigate (30-70%)
    3. Enter on LTF confirmation (15M BOS in direction of FVG)
    4. Stop beyond FVG extreme or recent structure
    5. Trail stop by new BOS formations
    6. Target next liquidity pool or 4R+
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_3_fvg_expansion"
        self.bot_name = "FVG Expansion & Fill"
        self.config = config
        self.structure_detector = MarketStructureDetector()
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None) -> Optional[BotSignal]:

        # Step 1: Find unmitigated FVGs on 1H
        fvg_detector = FVGDetector()
        fvgs = fvg_detector.detect_fvg(candles_1h)

        # Track mitigation
        fvgs = fvg_detector.track_mitigation(fvgs, candles_1h)

        # Find partially mitigated FVGs (30-70%)
        partial_fvgs = [
            f for f in fvgs 
            if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"
        ]

        if not partial_fvgs:
            return None

        target_fvg = partial_fvgs[-1]

        # Step 2: 15M BOS in direction of FVG
        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)

        bos_15m = self.structure_detector.detect_bos(candles_15m, swings_15m)

        if not bos_15m:
            return None

        last_bos = bos_15m[-1]

        # Align with FVG direction
        if target_fvg.gap_type == "bullish" and last_bos["type"] != "bullish_bos":
            return None
        if target_fvg.gap_type == "bearish" and last_bos["type"] != "bearish_bos":
            return None

        direction = "long" if target_fvg.gap_type == "bullish" else "short"

        # Step 3: Entry at FVG mean or 50%
        entry_price = (target_fvg.top + target_fvg.bottom) / 2

        # Step 4: Stop beyond FVG extreme
        if direction == "long":
            sl_price = target_fvg.bottom - (target_fvg.top - target_fvg.bottom) * 0.1
        else:
            sl_price = target_fvg.top + (target_fvg.top - target_fvg.bottom) * 0.1

        sl_distance = abs(entry_price - sl_price)

        sl = {
            "stop_loss": sl_price,
            "sl_distance": sl_distance,
            "method": "fvg_extreme"
        }

        targets = self.entry_engine.calculate_targets(
            {"entry_price": entry_price, "direction": direction},
            sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 4.0
        )

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.15, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.82,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"FVG Expansion {direction}. 1H FVG {target_fvg.gap_type} {target_fvg.mitigated_percent:.0%} mitigated. "
                     f"15M BOS confirms. Entry at FVG 50%. SL beyond FVG extreme. 4R target with BOS trailing.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 4: Volume & Liquidity Sweep Specialist (Dalton/Weis/Wyckoff Style)
# =============================================================================

class VolumeLiquidityBot:
    """
    Bot 4: Volume & Liquidity Sweep Specialist

    Philosophy (Dalton/Weis/Wyckoff):
    - Auction Market Theory: price searches for value/liquidity
    - Accumulation/Distribution phases
    - Spring (false breakdown) and Upthrust (false breakout) patterns
    - Volume divergence confirmations

    Rules:
    1. Identify accumulation (lows) or distribution (highs) structure
    2. Wait for Spring (buy) or Upthrust (sell) - false break with volume
    3. Volume must show divergence (less volume on break than expected)
    4. Enter on close back inside range + CHoCH
    5. Stop beyond the spring/upthrust extreme
    6. Target opposite side of range or 3:1
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_4_volume_liq"
        self.bot_name = "Volume & Liquidity Sweep"
        self.config = config
        self.structure_detector = MarketStructureDetector(left_bars=5, right_bars=3)
        self.entry_engine = EntryExitEngine(default_rr=3.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None) -> Optional[BotSignal]:

        # Step 1: Identify ranging/accumulation structure on 4H
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)

        if len(swings_4h) < 6:
            return None

        # Check for range-bound structure (equal highs/lows or slight progression)
        highs = [s.price for s in swings_4h if s.structure_type.name == "SWING_HIGH"][-3:]
        lows = [s.price for s in swings_4h if s.structure_type.name == "SWING_LOW"][-3:]

        if len(highs) < 3 or len(lows) < 3:
            return None

        range_high = max(highs)
        range_low = min(lows)
        range_size = range_high - range_low

        if range_size == 0:
            return None

        # Check if price is near range extremes
        current_price = candles_1h[-1].close
        near_high = abs(current_price - range_high) / range_size < 0.15
        near_low = abs(current_price - range_low) / range_size < 0.15

        if not near_high and not near_low:
            return None

        # Step 2: Detect Spring or Upthrust on 1H
        # Spring: Price breaks below range low, then closes back above
        # Upthrust: Price breaks above range high, then closes back below

        recent_candles = candles_1h[-10:]

        spring = None
        upthrust = None

        for i, candle in enumerate(recent_candles):
            # Spring detection
            if candle.low < range_low and candle.close > range_low:
                # Volume check: spring should have lower volume than average
                avg_vol = sum(c.volume for c in candles_1h[-20:]) / 20
                if candle.volume < avg_vol * 0.8:
                    spring = {
                        "candle": candle,
                        "type": "spring",
                        "extreme": candle.low,
                        "close": candle.close
                    }

            # Upthrust detection
            if candle.high > range_high and candle.close < range_high:
                avg_vol = sum(c.volume for c in candles_1h[-20:]) / 20
                if candle.volume < avg_vol * 0.8:
                    upthrust = {
                        "candle": candle,
                        "type": "upthrust",
                        "extreme": candle.high,
                        "close": candle.close
                    }

        if not spring and not upthrust:
            return None

        # Step 3: CHoCH confirmation after spring/upthrust
        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)

        choch_1h = self.structure_detector.detect_choch(candles_1h, swings_1h)

        if not choch_1h:
            return None

        last_choch = choch_1h[-1]

        # Align pattern with CHoCH
        if spring and last_choch["type"] == "bullish_choch":
            direction = "long"
            entry_price = spring["close"]
            sl_price = spring["extreme"] - range_size * 0.02
            pattern = "spring"
        elif upthrust and last_choch["type"] == "bearish_choch":
            direction = "short"
            entry_price = upthrust["close"]
            sl_price = upthrust["extreme"] + range_size * 0.02
            pattern = "upthrust"
        else:
            return None

        sl_distance = abs(entry_price - sl_price)

        sl = {
            "stop_loss": sl_price,
            "sl_distance": sl_distance,
            "method": "spring_upthrust_extreme"
        }

        # Target opposite side of range
        if direction == "long":
            tp = range_high - range_size * 0.05
        else:
            tp = range_low + range_size * 0.05

        rr = abs(tp - entry_price) / sl_distance if sl_distance > 0 else 0

        # min_rr_ratio has no effect here — this bot's target is the
        # OPPOSITE side of the detected range (a structural level), not
        # an R-multiple off entry/stop, so there's no ratio input to
        # override; `rr` just above is a derived/reported number, same
        # as before.
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.0, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.78,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=round(tp, 5),
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"Wyckoff {pattern} {direction}. Range {range_low:.5f}-{range_high:.5f}. "
                     f"Volume divergence confirmed. CHoCH on 1H. SL beyond {pattern} extreme. Target range opposite.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 5: Jeafx SMC Style Specialist
# =============================================================================

class JeafxSMCBot:
    """
    Bot 5: Jeafx SMC Style Specialist

    Philosophy (Jeafx):
    - Highly mechanical supply/demand refinement
    - Rapid liquidity purges of retail patterns on LTF
    - Explosive structural breaks after purges
    - Strict FVG mitigation criteria
    - Specific confirmation candles

    Rules:
    1. Identify 1H or 4H supply/demand zone (refined, not just any OB)
    2. Wait for LTF (15M/5M) liquidity purge of retail trendlines/patterns
    3. Confirmation candle: strong close back inside zone with momentum
    4. FVG must form on confirmation candle (not just exist)
    5. Entry at 50% of confirmation candle or FVG 50%
    6. Strict SL: beyond purge extreme + buffer
    7. Target 4:1 to 6:1 (Jeafx emphasizes high R:R)
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_5_jeafx"
        self.bot_name = "SMC BOT"
        self.config = config
        self.structure_detector = MarketStructureDetector(left_bars=3, right_bars=2)
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                candles_5m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None) -> Optional[BotSignal]:

        # Step 1: Find refined supply/demand zones on 1H
        zone_detector = ZoneDetector()
        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)

        zones = zone_detector.detect_order_blocks(candles_1h, swings_1h)

        # Jeafx refinement: zones must be fresh (not tested more than once)
        fresh_zones = [z for z in zones 
                      if z.status.name == "ACTIVE" and z.test_count <= 1]

        if not fresh_zones:
            return None

        # Step 2: Check 15M for liquidity purge
        liq_detector = LiquidityDetector(tolerance_pips=1.0)
        pools = liq_detector.detect_equal_highs_lows(candles_15m, lookback=30)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])

        if not sweeps:
            return None

        last_sweep = sweeps[-1]

        # Step 3: Find zone aligned with sweep
        sweep_price = last_sweep["sweep_price"]
        aligned_zone = None

        for z in fresh_zones:
            if z.bottom <= sweep_price <= z.top:
                aligned_zone = z
                break

        if not aligned_zone:
            return None

        # Step 4: Confirmation candle on 5M
        # Jeafx confirmation: strong momentum candle closing back inside zone
        recent_5m = candles_5m[-5:]
        confirmation_candle = None

        for c in recent_5m:
            body_size = abs(c.close - c.open)
            avg_body = sum(abs(x.close - x.open) for x in candles_5m[-20:]) / 20

            if body_size > avg_body * 1.5:  # Strong momentum
                if aligned_zone.bottom <= c.close <= aligned_zone.top:
                    confirmation_candle = c
                    break

        if not confirmation_candle:
            return None

        # Step 5: FVG must form on or after confirmation
        fvg_detector = FVGDetector()
        recent_fvgs = fvg_detector.detect_fvg(candles_5m[-10:])

        valid_fvg = None
        for f in recent_fvgs:
            if f.candle1.timestamp >= confirmation_candle.timestamp:
                if f.gap_type == "bullish" and last_sweep["type"] == "buy_side_sweep":
                    valid_fvg = f
                    break
                elif f.gap_type == "bearish" and last_sweep["type"] == "sell_side_sweep":
                    valid_fvg = f
                    break

        # Step 6: Determine direction
        if last_sweep["type"] == "buy_side_sweep":
            direction = "long"
        elif last_sweep["type"] == "sell_side_sweep":
            direction = "short"
        else:
            return None

        # Step 7: Entry at 50% of confirmation candle or FVG
        if valid_fvg:
            entry_price = (valid_fvg.top + valid_fvg.bottom) / 2
        else:
            entry_price = (confirmation_candle.open + confirmation_candle.close) / 2

        # Step 8: Strict SL beyond purge extreme
        purge_extreme = last_sweep["sweep_price"]
        buffer = abs(confirmation_candle.high - confirmation_candle.low) * 0.2

        if direction == "long":
            sl_price = purge_extreme - buffer
        else:
            sl_price = purge_extreme + buffer

        sl_distance = abs(entry_price - sl_price)

        sl = {
            "stop_loss": sl_price,
            "sl_distance": sl_distance,
            "method": "jeafx_purge_extreme"
        }

        # Step 9: High R:R target (4-6R)
        # Real bug, found while authoring this bot\'s curriculum: `entry`
        # was never assigned anywhere in this function (only entry_price,
        # a bare float) — calculate_targets() requires a dict with an
        # "entry_price" key (see EntryExitEngine.calculate_targets in
        # smc_algorithms.py), so this raised NameError every single time
        # a Bot 5 signal reached this line, i.e. every time all five real
        # gates above actually passed. Bot 5 could never successfully
        # produce a signal. Constructing the same {"entry_price",
        # "direction"} dict FVGExpansionBot already builds by hand for
        # its own non-engine entry (bot_strategies.py, Bot 3) fixes it.
        entry = {"entry_price": entry_price, "direction": direction}
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 5.0)

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.3, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.88,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"SMC BOT {direction}. 1H fresh zone. 15M {last_sweep["type"]}. "
                     f"5M confirmation candle + FVG: {valid_fvg is not None}. "
                     f"Entry at 50%. Strict SL beyond purge. 5R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT ORCHESTRATOR
# =============================================================================

def _signal_risk_is_valid(signal: "BotSignal") -> bool:
    """A stop_loss must sit on the PROTECTIVE side of entry_price for
    this signal\'s own direction — a long\'s stop must be BELOW entry
    (it loses money as price falls further), a short\'s stop must be
    ABOVE entry (it loses money as price rises further). Anything else
    isn\'t a real risk-managed trade, whatever produced it.

    Real bug, found via direct report ("some of those trades got
    closed and labeled \'STOP_LOSS\' at the exact moment price was
    actually moving in their favor — that\'s a separate bug worth
    investigating"). Confirmed directly from production data: several
    of JeafxSMCBot\'s (Bot 5) own SHORT trades had stop_loss BELOW
    entry_price. Root cause: entry_price (from an FVG/confirmation-
    candle midpoint) and stop_loss (from an independently-detected
    liquidity-sweep extreme, offset by a buffer) come from two
    completely unrelated calculations with nothing ever checking they
    land on the correct relative sides. When entry happened to fall
    past where the stop would be, the result was a "stop" already on
    the PROFITABLE side of entry — pending_order_monitor.py\'s own
    SL-hit check is a pure price-level comparison with no awareness
    that a stop could be geometrically backwards, so it fired the
    moment price moved favorably, closing what should have kept
    running as a winning position and mislabeling it "STOP_LOSS".

    OrderBlockReversalBot (Bot 2) computes entry (from an Order Block)
    and its own sweep-extreme stop_loss the same independent way — no
    production trade has hit it yet, but nothing rules it out. Checked
    centrally here, in run_all, rather than patched into one bot\'s own
    analyze() — every bot\'s signal is protected by the same guard,
    including any future strategy that computes entry/stop from
    independent sources this same way."""
    if signal.direction == "long":
        return signal.stop_loss < signal.entry_price
    return signal.stop_loss > signal.entry_price  # "short"


class BotOrchestrator:
    """Manages all 5 bots and routes signals to execution."""

    def __init__(self, configs: Dict[str, Dict]):
        self.bots = {
            "bot_1": MacroSwingStructureBot(configs.get("bot_1", {})),
            "bot_2": OrderBlockReversalBot(configs.get("bot_2", {})),
            "bot_3": FVGExpansionBot(configs.get("bot_3", {})),
            "bot_4": VolumeLiquidityBot(configs.get("bot_4", {})),
            "bot_5": JeafxSMCBot(configs.get("bot_5", {}))
        }
        self.active_signals: List[BotSignal] = []

    def _collect(self, signals: List[BotSignal], sig: Optional[BotSignal]) -> None:
        """Every signal any bot produces passes through here before
        being trusted — see _signal_risk_is_valid\'s own comment for
        what this actually guards against and why it\'s centralized."""
        if not sig:
            return
        if not _signal_risk_is_valid(sig):
            logger.warning(
                "bot_signal_invalid_risk_geometry", bot_id=sig.bot_id, symbol=sig.symbol,
                direction=sig.direction, entry_price=sig.entry_price, stop_loss=sig.stop_loss,
            )
            return
        signals.append(sig)

    def run_all(self, market_data: Dict, account_balance: float, bot_settings: Optional[Dict[str, Dict]] = None) -> List[BotSignal]:
        """Run all active bots against current market data.

        bot_settings — {"bot_1": {"risk_per_trade": ..., "min_rr_ratio":
        ...}, ...}, read fresh from each bot's own BotConfig (and any
        Sub-Auto-specific override) by market_scanner.py's scan_once
        every cycle, same live-per-call shape account_balance already
        used. Optional/omitted keeps every bot on its own prior
        hardcoded default — found, alongside the TP-always-~2R bug,
        that BotConfig.risk_per_trade/min_rr_ratio were NEVER actually
        read anywhere in signal generation (this orchestrator is built
        once with an empty config dict — see __init__ above), so a
        trader editing either field on the Bots page had silently had
        zero effect until this was wired through.
        """
        signals = []
        settings = bot_settings or {}

        def _risk(bot_key: str) -> Optional[float]:
            return settings.get(bot_key, {}).get("risk_per_trade")

        def _rr(bot_key: str) -> Optional[float]:
            return settings.get(bot_key, {}).get("min_rr_ratio")

        # Bot 1: Needs 1D + 4H
        if "1D" in market_data and "4H" in market_data:
            sig = self.bots["bot_1"].analyze(
                market_data["1D"], market_data["4H"],
                account_balance, market_data.get("symbol", "UNKNOWN"),
                risk_per_trade=_risk("bot_1"), min_rr_ratio=_rr("bot_1"),
            )
            self._collect(signals, sig)

        # Bot 2: Needs 4H + 1H + 15M
        if all(k in market_data for k in ["4H", "1H", "15M"]):
            sig = self.bots["bot_2"].analyze(
                market_data["4H"], market_data["1H"], market_data["15M"],
                account_balance, market_data.get("symbol", "UNKNOWN"),
                risk_per_trade=_risk("bot_2"), min_rr_ratio=_rr("bot_2"),
            )
            self._collect(signals, sig)

        # Bot 3: Needs 1H + 15M
        if "1H" in market_data and "15M" in market_data:
            sig = self.bots["bot_3"].analyze(
                market_data["1H"], market_data["15M"],
                account_balance, market_data.get("symbol", "UNKNOWN"),
                risk_per_trade=_risk("bot_3"), min_rr_ratio=_rr("bot_3"),
            )
            self._collect(signals, sig)

        # Bot 4: Needs 4H + 1H
        if "4H" in market_data and "1H" in market_data:
            sig = self.bots["bot_4"].analyze(
                market_data["4H"], market_data["1H"],
                account_balance, market_data.get("symbol", "UNKNOWN"),
                risk_per_trade=_risk("bot_4"), min_rr_ratio=_rr("bot_4"),
            )
            self._collect(signals, sig)

        # Bot 5: Needs 1H + 15M + 5M
        if all(k in market_data for k in ["1H", "15M", "5M"]):
            sig = self.bots["bot_5"].analyze(
                market_data["1H"], market_data["15M"], market_data["5M"],
                account_balance, market_data.get("symbol", "UNKNOWN"),
                risk_per_trade=_risk("bot_5"), min_rr_ratio=_rr("bot_5"),
            )
            self._collect(signals, sig)

        self.active_signals = signals
        return signals
