"""
Five Distinct SMC Bot Trading Styles
Grounded in: Mark Douglas, Wyckoff, Dalton, Damir, Brooks, ICT, Photon, Jeafx

CRITICAL: the opening triple-quote on this module docstring was found
MISSING on main (2026-10-02) -- almost certainly lost in the PR 170
push through the GitHub API workaround used when local git push had
no credentials (see github-create-or-update-file-contents, a tool
with known content-mangling flakiness, independently reproduced and
caught the same day while pushing PR 171). A single dropped line
silently swallowed everything from here down to the next class
docstring into one inert string literal, which is a SyntaxError at
module import -- confirmed directly in Render deploy logs
("SyntaxError: invalid decimal literal", 2026-09-30 23:57:29 UTC): PR
170 and PR 171 both show update_failed deploys, and Render had been
silently serving PR 169 code ever since, through every merge since,
with the site never visibly going down only because the Render
zero-downtime deploy mechanism never cut over to a build that failed
to import. Restoring this one line is the entire fix -- every other
PR 170/171 change underneath was already correct and intact; only
this file ever failed to deploy.
"""

from typing import Dict, List, Optional, Literal, Tuple
from dataclasses import dataclass
from datetime import datetime
import structlog
from app.core.smc_algorithms import (
    MarketStructureDetector, ZoneDetector, FVGDetector,
    LiquidityDetector, EntryExitEngine, RiskManager,
    Candle, SwingPoint, Zone, FairValueGap, LiquidityPool,
    extend_stop_beyond_zone, select_fvg_by_depth, compute_htf_bias
)
from app.core.mtf_engine import MTFAlignmentEngine, AlignmentSignal, TimeframeState, Bias, Timeframe
from app.config import get_settings

logger = structlog.get_logger()


# =============================================================================
# Basic/Intelligent mode — declarative tunable-parameter registry
# =============================================================================
#
# The single source of truth for which structural constants a bot's
# strategy_params can actually move, and how far — these bounds ARE
# the guardrails: a value from BotConfig.strategy_params can NEVER
# reach a bot's detectors outside its declared [min, max], regardless
# of how it got there (a hand-edit, a future auto-tuner, or a bad row
# in the database). Bounds are chosen to comfortably contain each
# bot's own current hardcoded default, so an empty/missing
# strategy_params dict (every real BotConfig row today) produces
# EXACTLY the same behavior as before this existed — nothing about
# any bot's live signal generation changes until someone actually
# sets a value.
#
# Scope, deliberately narrow for this first pass: only the swing-
# detection window (left_bars/right_bars), which every bot's own
# MarketStructureDetector already takes as a constructor argument and
# which was previously 100% hardcoded with zero way to configure it.
# `default_rr` (EntryExitEngine's own constructor arg) is NOT included
# here — it's already effectively superseded by BotConfig.min_rr_ratio,
# which market_scanner.py already threads into every analyze() call
# and which every real bot config row already sets; exposing a second,
# parallel mechanism for the same concept would just be confusing.
# Many other real constants across smc_algorithms.py (the FVG 30-70%
# fill band, premium/discount 0.45/0.55 split, the 10-candle order-
# block lookback, the 0.05%-of-price liquidity tolerance) are shared
# across every bot that uses them, not bot-specific — making them
# tunable would need a different design (per-bot overrides threaded
# through every detector call) and is deliberately out of scope here.
#
# ARCHITECTURAL LIMIT, worth knowing before relying on this: BotOrchestrator
# holds exactly ONE shared instance per strategy FAMILY ("bot_2", not
# one per real BotConfig row) — see its own __init__. So today, a
# tunable value set here applies to every real bot row sharing that
# family at once (e.g. every bot_2_ob_reversal* row), not to one row
# independently. market_scanner.py's config-building step (see
# _build_strategy_configs) detects and safely handles the case where
# sibling rows in the same family disagree — see that function's own
# docstring — but true per-row independent tuning would need the
# orchestrator to move from one shared instance per family to one per
# distinct config, a separate, deliberately out-of-scope change here
# given this is the live signal-generation core every bot's real
# trading already depends on.
TUNABLE_PARAM_BOUNDS: Dict[str, Dict[str, Tuple[float, float, float]]] = {
    # family: {param: (min, max, default)} — default MUST equal this
    # bot's own current hardcoded value (verified against each
    # __init__ below), so config={} is always identical to today.
    "bot_1": {"left_bars": (2, 10, 5), "right_bars": (2, 10, 5)},
    "bot_2": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 3)},
    "bot_3": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 3)},
    "bot_4": {"left_bars": (2, 10, 5), "right_bars": (2, 10, 3)},
    "bot_5": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 2)},
    "bot_6": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 2)},
    "bot_7": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 3)},
    "bot_8": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 2)},
    "bot_9": {"left_bars": (2, 10, 5), "right_bars": (2, 10, 3)},
    "bot_10": {"left_bars": (2, 10, 5), "right_bars": (2, 10, 3)},
    "bot_11": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 3)},
    # bot_13: Bot 3's own left_bars/right_bars (15M structure, since
    # this reuses Bot 3's entry logic byte-for-byte) PLUS a second,
    # separate pair for the new 1D HTF-bias gate's own swing
    # detection — defaulted to Bot 1's own tuned 1D values (5, 5),
    # the only other bot that reads 1D structure at all, rather than
    # reusing Bot 3's 15M-tuned values for a timeframe they were never
    # tuned against.
    "bot_13": {"left_bars": (2, 10, 3), "right_bars": (2, 10, 3), "htf_left_bars": (2, 10, 5), "htf_right_bars": (2, 10, 5)},
}


def resolve_tunable_param(strategy_key: str, param: str, config: Dict) -> float:
    """Reads `param` out of `config` (BotConfig.strategy_params,
    merged over this bot's own declared default), hard-clipped to the
    declared [min, max] bounds — the one and only path a tunable value
    can reach a bot's actual detector construction. Falls back to the
    declared default (never raises) for a missing key or a value that
    doesn't parse as a number, so a malformed strategy_params dict
    degrades safely to today's behavior rather than crashing bot
    construction."""
    bounds = TUNABLE_PARAM_BOUNDS.get(strategy_key, {}).get(param)
    if bounds is None:
        raise KeyError(f"No declared tunable bounds for {strategy_key}.{param}")
    lo, hi, default = bounds
    raw = config.get(param, default)
    try:
        raw = float(raw)
    except (TypeError, ValueError):
        raw = default
    return max(lo, min(hi, raw))


# By direct request ("fix permanently"), after the risk-geometry/
# capital-adequacy safety net (_signal_risk_is_valid's own NOTIONAL
# check, below) caught the SAME repeat failure mode hundreds of times
# without ever being fixed at its source: FVGExpansionBot/
# FVGExpansionV3Bot's stop is set 10% beyond the FVG's own width (see
# their analyze()) — when a real gap happens to be narrow (confirmed
# live: bot_3_fvg_expansion_2 on EURUSDT.P, sl_distance ~0.00024 on a
# ~1.08 entry, notional $46,812.50 against a $50,000 cap), that 10% is
# a tiny dollar distance, and a correct dollar-risk amount divided by a
# tiny distance inflates lot_size — and therefore notional — into
# something no real account can afford. The safety net correctly
# rejects it every time (so no bad order was ever placed), but only
# AFTER a signal was drafted, logged as an ERROR trade, and a scan
# cycle burned on it — 334 times for one bot/pair alone in an earlier
# audit, and still recurring. This widens (only ever away from entry,
# never toward it, so it only ever REDUCES lot_size/notional, never
# increases risk) a computed stop to at least this fraction of
# entry_price before it's ever used to size a position, fixing the
# problem where it originates instead of only catching it downstream.
MIN_STOP_DISTANCE_PCT = 0.0015  # 0.15% of entry price


def apply_min_stop_distance_floor(entry_price: float, sl_price: float, direction: str,
                                   min_pct: float = MIN_STOP_DISTANCE_PCT) -> float:
    """Widens sl_price away from entry_price, if needed, so the
    resulting distance is at least min_pct (default: the platform-wide
    MIN_STOP_DISTANCE_PCT) of entry_price. A no-op for any stop that's
    already wide enough. `min_pct` is overridable per call site —
    see bot_11's own use for a deliberately larger value."""
    min_distance = entry_price * min_pct
    if abs(entry_price - sl_price) >= min_distance:
        return sl_price
    return entry_price - min_distance if direction == "long" else entry_price + min_distance


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
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_1", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_1", "right_bars", config)),
        )
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
                min_rr_ratio: Optional[float] = None,
                # Overrides self.bot_id on the produced signal — lets
                # ONE strategy-family instance (self.bots["bot_N"] in
                # BotOrchestrator) run on behalf of several real
                # BotConfig rows that all share this algorithm. None
                # (every call site before this feature) keeps the
                # original hardcoded self.bot_id, so nothing about the
                # 5 original bots' own behavior changes.
                bot_id: Optional[str] = None) -> Optional[BotSignal]:
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

        # Real crash, confirmed live the moment the market scanner first
        # ran against real production data (this path is never hit by a
        # TradingView webhook alert, which bypasses Python analysis
        # entirely — MARKET_SCANNER_ENABLED had silently been off for
        # the portal's whole history until now): `not highs or not
        # lows` only guards against an EMPTY list, but the very next
        # line indexes highs[-2]/lows[-2], which still raises
        # IndexError on a list of exactly 1 — an easy, common split
        # when `recent_swings` (the last 4 swings total, highs and lows
        # mixed) lands asymmetric, e.g. 3 highs + 1 low. Same len<2
        # guard smc_algorithms.py's own MarketStructureDetector.
        # detect_choch already uses correctly for this identical
        # highs[-1]/highs[-2] need.
        if len(highs) < 2 or len(lows) < 2:
            return None

        bullish_trend = highs[-1].price > highs[-2].price and lows[-1].price > lows[-2].price
        bearish_trend = highs[-1].price < highs[-2].price and lows[-1].price < lows[-2].price

        if not bullish_trend and not bearish_trend:
            return None

        # Step 2: 4H BOS Confirmation — fed through
        # filter_significant_swings (by direct audit request: "consider
        # the swing points low or high in the entire leg for BOS and
        # not just the mini or micro swing high or swing low points")
        # so this reads the leg's own significant pivot, not whichever
        # 5-bar fractal happened to print most recently.
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)
        bos_4h = self.structure_detector.detect_bos(
            candles_4h, self.structure_detector.filter_significant_swings(swings_4h)
        )

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
        zones = zone_detector.detect_order_blocks(candles_4h, swings_4h)

        # This comment used to claim "active zones in discount (long)
        # or premium (short)" but the code below it only ever checked
        # "bull"/"bear" in z.id — the zone's own directional TYPE
        # (bullish vs bearish order block), not where it actually sits
        # in the broader range. A REAL discount/premium check
        # (classify_premium_discount, smc_algorithms.py) existed in
        # the codebase this whole time and was never called by any
        # bot — confirmed by audit, matching the direct report
        # "Ensure that you are entering at Discount for Longs and
        # Premium for shorts of the 4H and 1H trading range." Both
        # checks now apply: the directional-type filter stays (it's
        # not wrong, just insufficient on its own), and discount/
        # premium is enforced for real below, once direction is known.
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

        swing_high_4h = max((s.price for s in swings_4h), default=None)
        swing_low_4h = min((s.price for s in swings_4h), default=None)
        if swing_high_4h is not None and swing_low_4h is not None:
            zone_detector.classify_premium_discount([entry_zone], swing_high_4h, swing_low_4h)
            if (direction == "long" and entry_zone.classification == "premium") or \
               (direction == "short" and entry_zone.classification == "discount"):
                return None

        entry = self.entry_engine.calculate_entry(entry_zone, "mean", direction)

        # Step 5: Stop beyond swing structure, extended to embed the
        # order block itself — by direct, repeated audit observation
        # ("the order block should be embedded within the SL
        # boundaries"): the swing point here is detected independently
        # of entry_zone, so it can land INSIDE the zone rather than
        # beyond its far edge. See extend_stop_beyond_zone's own
        # docstring.
        if direction == "long":
            sl_swing = lows[-1]
        else:
            sl_swing = highs[-1]

        sl = self.entry_engine.calculate_stop_loss(
            entry, entry_zone, sl_swing, "structure_swing"
        )
        sl["stop_loss"] = extend_stop_beyond_zone(sl["stop_loss"], entry_zone, direction)
        sl["sl_distance"] = abs(entry["entry_price"] - sl["stop_loss"])

        # Step 6: Targets (5:1 for swing)
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 5.0, multi_target=True)

        # Step 7: Lot sizing
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.2, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(
            account_balance, risk, sl["sl_distance"]
        )

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"Macro swing {direction}. 1D trend confirmed. 4H BOS at {last_bos['structure_level']}. "
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
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_2", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_2", "right_bars", config)),
        )
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
                min_rr_ratio: Optional[float] = None,
                # Overrides self.bot_id on the produced signal — lets
                # ONE strategy-family instance (self.bots["bot_N"] in
                # BotOrchestrator) run on behalf of several real
                # BotConfig rows that all share this algorithm. None
                # (every call site before this feature) keeps the
                # original hardcoded self.bot_id, so nothing about the
                # 5 original bots' own behavior changes.
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Step 1: Find HTF Order Blocks (4H or 1H). Freshness filter
        # (test_count <= 1) added by direct audit request — Bot 5/6
        # already require this ("zones must be fresh, not tested more
        # than once"); Bot 2 never did, so it could keep re-entering an
        # OB that had already been repeatedly tested and eroded.
        zone_detector = ZoneDetector()
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)

        obs = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_obs = [z for z in obs if z.status.name == "ACTIVE" and z.test_count <= 1]
        zone_swings = swings_4h

        if not active_obs:
            # Try 1H
            swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                        self.structure_detector.detect_swing_lows(candles_1h)
            obs = zone_detector.detect_order_blocks(candles_1h, swings_1h)
            active_obs = [z for z in obs if z.status.name == "ACTIVE" and z.test_count <= 1]
            zone_swings = swings_1h

        if not active_obs:
            return None

        # Step 2: Check which OB price is currently inside
        current_price = candles_15m[-1].close
        inside_obs = [z for z in active_obs if z.bottom <= current_price <= z.top]

        if not inside_obs:
            return None

        target_ob = inside_obs[-1]

        # Step 3: 15M Internal Liquidity Sweep + CHoCH, fed through
        # filter_significant_swings (see that method's own docstring —
        # same "entire leg, not micro swing points" fix applied
        # everywhere a BOS/CHoCH decides direction).
        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)

        choch_15m = self.structure_detector.detect_choch(
            candles_15m, self.structure_detector.filter_significant_swings(swings_15m)
        )

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

        # Discount (long) / premium (short) check — the REAL version of
        # what Step 1's old comment claimed but never did (see Bot 1's
        # own identical fix for the full audit finding).
        zone_swing_high = max((s.price for s in zone_swings), default=None)
        zone_swing_low = min((s.price for s in zone_swings), default=None)
        if zone_swing_high is not None and zone_swing_low is not None:
            zone_detector.classify_premium_discount([target_ob], zone_swing_high, zone_swing_low)
            if (direction == "long" and target_ob.classification == "premium") or \
               (direction == "short" and target_ob.classification == "discount"):
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
            # Real bug, found via direct report on a live JPYUSDT.P
            # trade: risk_amount came out at $143.33 against a $10
            # Sub-Auto target — 14.33x oversized. Root cause: sl_distance
            # here was computed from the RAW sweep price (sl_price),
            # not the actual stop_loss (sl_price ± a buffer right
            # above it) — the only one of this bot family's 4
            # stop-placement branches with that mismatch (bot_3/4/5's
            # own sl dicts all correctly compute sl_distance from the
            # FINAL, buffered price — see their own "sl_price = X -
            # buffer" then "sl_distance = abs(entry - sl_price)" order).
            #
            # The buffer itself was ALSO a fixed, raw price-unit
            # constant (0.0002 here) — the identical bug CLASS later
            # found and permanently fixed in LiquidityDetector's own
            # tolerance (see that class's own docstring, including its
            # SECOND real bug, found via direct audit request "can we
            # have a permanent fix for the tolerance floor for the
            # pairs ... BTC, Gold, Silver, Oil etc" — a prompt that led
            # directly back here too, the same class of fixed-unit
            # constant hiding in a different function). 0.0002 was
            # negligible for BTC/EUR/XAUT-scale prices, but comparable
            # to — and larger than — the real swept-extreme-to-entry
            # distance on JPYUSDT.P's own tiny price level (~0.0063),
            # undersizing sl_distance by ~14x. Scaled to a percentage
            # of the sweep price itself instead, scale-invariant the
            # same way for every instrument from JPY to BTC, with no
            # per-symbol floor to ever reintroduce this.
            buffer = sl_price * 0.0005
            final_stop_loss = sl_price - buffer if direction == "long" else sl_price + buffer
            # Embed the OB itself — by direct, repeated audit
            # observation (see extend_stop_beyond_zone's own docstring):
            # the sweep extreme is detected independently of target_ob
            # and can sit inside it.
            final_stop_loss = extend_stop_beyond_zone(final_stop_loss, target_ob, direction)
            # Real bug, found via direct report on real trades
            # ("tight SL ... can we review how to optimise"): unlike
            # this method's own "structure_swing" branch below (which
            # goes through calculate_stop_loss and gets this floor for
            # free), this branch builds its stop dict by hand and had
            # never been floored at all — on a narrow OB/sweep
            # combination (confirmed live on JPYUSDT.P: a real stop
            # only 0.05% from entry, well under the 0.15% platform
            # floor every other stop-placement path enforces) this
            # produced a genuinely undersized, premature stop. Floor
            # — see apply_min_stop_distance_floor's own docstring.
            final_stop_loss = apply_min_stop_distance_floor(entry["entry_price"], final_stop_loss, direction)
            sl = {
                "stop_loss": final_stop_loss,
                "sl_distance": abs(entry["entry_price"] - final_stop_loss),
                "method": "sweep_extreme"
            }
        else:
            # Found during the same audit as bot_1's own [-2]-on-a-
            # length-1-list crash: swings_15m is never actually checked
            # for emptiness before this indexing — a genuinely quiet
            # 15M window can produce zero detected swing points, same
            # root cause class as that bug (an unguarded index past
            # what a real, sparse detector result can return). Low
            # probability, but exception isolation alone (run_all) only
            # stops it from taking OTHER bots down with it — it would
            # still silently cost this bot every cycle it hit.
            if not swings_15m:
                return None
            sl_swing = swings_15m[-1]
            sl = self.entry_engine.calculate_stop_loss(entry, target_ob, sl_swing, "structure_swing")
            sl["stop_loss"] = extend_stop_beyond_zone(sl["stop_loss"], target_ob, direction)
            sl["sl_distance"] = abs(entry["entry_price"] - sl["stop_loss"])

        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 3.0)
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.1, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl["sl_distance"])

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
                     f"FVG confirmation: {len(active_fvgs)} active. SL beyond sweep/swing, embedded OB. 3R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# Shared direction-detection helpers (used by Bot 6 / SMC v2 below) —
# isolated out of Bot 2's and Bot 3's own direction steps, by direct
# request ("it's a duplicate of the original SMC bot - but ... it uses
# the exact trading direction that the FVG Expansion and HF Order
# Block Reversal bot uses to determine it's trading direction ... the
# current SMC often misses the prices direction but the FVG expansion
# and HF Order block reversal are much better"). New, standalone
# functions rather than SMC v2 calling Bot 2/3's own .analyze() —
# that would compute a full signal (zone, entry, SL, targets, lot
# size) just to read one field off it, and would wrongly make SMC v2
# depend on Bot 2/3 *instances* existing. Bot 2's and Bot 3's own
# inline logic is left exactly as-is for this change (not pointed at
# these yet) to keep this change's blast radius limited to the new
# bot only — a later cleanup could have them call these instead of
# keeping two copies.
# =============================================================================

def _choch_direction_15m(structure_detector: MarketStructureDetector, candles_15m: List[Candle]) -> Optional[Literal["long", "short"]]:
    """Exactly Bot 2's own direction step: a 15M CHoCH (change of
    character). None if no CHoCH, or the latest one isn't a clean
    bullish/bearish call."""
    swings_15m = structure_detector.detect_swing_highs(candles_15m) + structure_detector.detect_swing_lows(candles_15m)
    choch_15m = structure_detector.detect_choch(candles_15m, swings_15m)
    if not choch_15m:
        return None
    last_choch = choch_15m[-1]
    if last_choch["type"] == "bullish_choch":
        return "long"
    if last_choch["type"] == "bearish_choch":
        return "short"
    return None


def _fvg_bos_direction_1h_15m(candles_1h: List[Candle], candles_15m: List[Candle]) -> Optional[Literal["long", "short"]]:
    """Exactly Bot 3's own direction step: an unmitigated 1H FVG's own
    gap_type, confirmed by a same-direction 15M BOS (break of
    structure). None if no qualifying FVG, no BOS, or they disagree —
    same gates Bot 3's own analyze() applies before it ever considers
    a direction confirmed."""
    fvg_detector = FVGDetector()
    fvgs = fvg_detector.track_mitigation(fvg_detector.detect_fvg(candles_1h), candles_1h)
    partial_fvgs = [f for f in fvgs if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"]
    if not partial_fvgs:
        return None
    target_fvg = partial_fvgs[-1]

    structure_detector = MarketStructureDetector()
    swings_15m = structure_detector.detect_swing_highs(candles_15m) + structure_detector.detect_swing_lows(candles_15m)
    bos_15m = structure_detector.detect_bos(candles_15m, swings_15m)
    if not bos_15m:
        return None
    last_bos = bos_15m[-1]

    if target_fvg.gap_type == "bullish" and last_bos["type"] == "bullish_bos":
        return "long"
    if target_fvg.gap_type == "bearish" and last_bos["type"] == "bearish_bos":
        return "short"
    return None


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
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_3", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_3", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                # Overrides self.bot_id on the produced signal — lets
                # ONE strategy-family instance (self.bots["bot_N"] in
                # BotOrchestrator) run on behalf of several real
                # BotConfig rows that all share this algorithm. None
                # (every call site before this feature) keeps the
                # original hardcoded self.bot_id, so nothing about the
                # 5 original bots' own behavior changes.
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

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

        # Floor — a narrow FVG on a low-volatility pair can make the
        # above distance pathologically tiny, inflating lot_size/
        # notional past what any account can afford. See
        # apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
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
            bot_id=bot_id or self.bot_id,
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
# BOT 7: FVG Expansion v3 — Bot 3's own setup, with the audit's direction/
# selection fixes applied. Bot 3 itself is intentionally left untouched.
# =============================================================================

class FVGExpansionV3Bot:
    """
    Bot 7: FVG Expansion v3 ("Bot 3 Update")

    By direct request: Bot 3 (FVGExpansionBot) has been genuinely
    successful in live trading WITHOUT any of the discount/premium or
    order-block checks the rest of the audit found missing elsewhere —
    a real, worth-noting result in its own right (see this bot's own
    class docstring... Bot 3's, that is — unchanged). Rather than risk
    that live track record, Bot 3 stays exactly as it was. This is a
    SEPARATE bot, same family of idea, with the audit's fixes applied,
    so the two can run side by side on real trades and actually settle
    which approach performs better instead of guessing.

    Differences from Bot 3, applied here only:
    1. Direction comes from the 15M BOS FIRST (fed through
       filter_significant_swings — the "entire leg, not micro swing
       points" fix), THEN the FVG is selected among whichever
       candidates already match that confirmed direction — instead of
       picking an FVG first and checking BOS agreement after the fact.
    2. Among qualifying FVGs, picks by DEPTH: deepest for a long,
       highest for a short (select_fvg_by_depth) — instead of just the
       last one in whatever order detect_fvg returned them.

    Deliberately NOT added here, to isolate what's actually being
    tested: no order-block/zone reference, no discount/premium check —
    Bot 3's own setup never used either, and introducing them in the
    same change as the direction/selection fixes above would make it
    impossible to tell which change (if any) moved the result.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_7_fvg_expansion_v3"
        self.bot_name = "FVG Expansion v3"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_7", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_7", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Step 1: Find unmitigated FVGs on 1H — identical to Bot 3.
        fvg_detector = FVGDetector()
        fvgs = fvg_detector.detect_fvg(candles_1h)
        fvgs = fvg_detector.track_mitigation(fvgs, candles_1h)

        partial_fvgs = [
            f for f in fvgs
            if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"
        ]
        if not partial_fvgs:
            return None

        # Step 2: 15M BOS decides direction FIRST, fed through
        # filter_significant_swings.
        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)
        bos_15m = self.structure_detector.detect_bos(
            candles_15m, self.structure_detector.filter_significant_swings(swings_15m)
        )
        if not bos_15m:
            return None
        last_bos = bos_15m[-1]

        if last_bos["type"] == "bullish_bos":
            direction = "long"
        elif last_bos["type"] == "bearish_bos":
            direction = "short"
        else:
            return None

        # Step 3: among FVGs matching that confirmed direction, pick by
        # depth — deepest for a long, highest for a short.
        candidate_fvgs = [
            f for f in partial_fvgs
            if (f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short")
        ]
        target_fvg = select_fvg_by_depth(candidate_fvgs, direction)
        if target_fvg is None:
            return None

        # Step 4: Entry at FVG mean or 50% — identical to Bot 3.
        entry_price = (target_fvg.top + target_fvg.bottom) / 2

        # Step 5: Stop beyond FVG extreme — identical to Bot 3.
        if direction == "long":
            sl_price = target_fvg.bottom - (target_fvg.top - target_fvg.bottom) * 0.1
        else:
            sl_price = target_fvg.top + (target_fvg.top - target_fvg.bottom) * 0.1

        # Floor — see apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "fvg_extreme"}

        targets = self.entry_engine.calculate_targets(
            {"entry_price": entry_price, "direction": direction},
            sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 4.0
        )

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.15, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"FVG Expansion v3 {direction}. 15M BOS (significant swings) sets direction. "
                     f"1H FVG {target_fvg.gap_type} {target_fvg.mitigated_percent:.0%} mitigated, depth-selected. "
                     f"Entry at FVG 50%. SL beyond FVG extreme. 4R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 13: FVG Expansion, HTF-Gated (Bot 3 Update) — real finding, A/B test
# =============================================================================

class FVGExpansionHTFGatedBot:
    """
    Bot 13: FVG Expansion, HTF-Gated

    Bot 3's exact own setup (FVGExpansionBot — FVG eligibility, 15M
    BOS direction, entry/stop/target formulas, all byte-for-byte
    identical), with exactly ONE change: a real 1D HTF-alignment gate
    added before the signal is returned.

    Built from a real finding, not a hunch: a direct audit question —
    "when the higher time frame is unclear, is there a higher chance
    the trade results in a loss?" — was tested against 153 of 158 real
    closed bot trades, re-analyzed through the real forensic
    reconstruction engine (engines/trade_forensics.py) for their real
    1D HTF bias at entry. The honest answer was more precise than the
    question: trades whose own direction ALIGNED with a clear 1D bias
    did meaningfully better (n=51, 33.3% loss rate, +2.38R avg) than
    BOTH unclear-bias trades (n=79, 41.8% loss rate, +1.20R avg) AND
    counter-trend trades fighting a clear bias (n=23, 43.5% loss rate,
    +1.92R avg) — but this pattern was NOT uniform across bots. It
    held clearly for continuation-style bots (Bot 3: 8% loss rate
    clear vs. 28% unclear; Bot 5: 40% vs. 62%) but REVERSED for
    reversal-style bots (Bot 2: 62% vs. 29%; Bot 6: 72% vs. 60%) —
    sensible, not noise: a reversal thesis is fighting a clear trend
    by construction, so an ambiguous daily chart is exactly where it
    has room to work. A blanket gate across every bot would have
    helped Bot 3/5 and actively hurt Bot 2/6. This bot deliberately
    tests the gate on ONLY Bot 3's own setup — the largest, cleanest
    sample in the finding — as a real, isolated A/B test, not a
    platform-wide behavior change.

    Deliberately NOT added here, same reasoning as Bot 7/Bot 11/Bot
    12's own A/B scope: no order-block/zone reference, no discount/
    premium check, no change to the FVG-selection or entry/stop/
    target math at all — isolating the ONE new variable (the HTF
    gate) is the entire point.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_13_fvg_expansion_htf_gated"
        self.bot_name = "FVG Expansion HTF-Gated"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_13", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_13", "right_bars", config)),
        )
        self.htf_left_bars = int(resolve_tunable_param("bot_13", "htf_left_bars", config))
        self.htf_right_bars = int(resolve_tunable_param("bot_13", "htf_right_bars", config))
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1d: List[Candle],
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Steps 1-2: identical to Bot 3 — unmitigated 1H FVGs (30-70%
        # mitigated, ACTIVE), most recent one, confirmed by a matching
        # 15M BOS.
        fvg_detector = FVGDetector()
        fvgs = fvg_detector.detect_fvg(candles_1h)
        fvgs = fvg_detector.track_mitigation(fvgs, candles_1h)
        partial_fvgs = [
            f for f in fvgs
            if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"
        ]
        if not partial_fvgs:
            return None
        target_fvg = partial_fvgs[-1]

        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)
        bos_15m = self.structure_detector.detect_bos(candles_15m, swings_15m)
        if not bos_15m:
            return None
        last_bos = bos_15m[-1]
        if target_fvg.gap_type == "bullish" and last_bos["type"] != "bullish_bos":
            return None
        if target_fvg.gap_type == "bearish" and last_bos["type"] != "bearish_bos":
            return None
        direction = "long" if target_fvg.gap_type == "bullish" else "short"

        # Step 3 (THE new gate, everything else below is Bot 3's own
        # unchanged pipeline): require the real 1D HTF bias to be
        # CLEAR and to AGREE with this trade's own direction — the
        # "aligned" bucket from the real finding above, the one that
        # actually outperformed, not just "any clear bias at all"
        # (counter-trend was the worst bucket, not a middle ground).
        htf_bias = compute_htf_bias(candles_1d, self.htf_left_bars, self.htf_right_bars)
        if htf_bias == "unclear":
            return None
        if direction == "long" and htf_bias != "bullish":
            return None
        if direction == "short" and htf_bias != "bearish":
            return None

        # Step 4: Entry at FVG mean or 50% — identical to Bot 3.
        entry_price = (target_fvg.top + target_fvg.bottom) / 2

        # Step 5: Stop beyond FVG extreme — identical to Bot 3.
        if direction == "long":
            sl_price = target_fvg.bottom - (target_fvg.top - target_fvg.bottom) * 0.1
        else:
            sl_price = target_fvg.top + (target_fvg.top - target_fvg.bottom) * 0.1
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "fvg_extreme"}

        targets = self.entry_engine.calculate_targets(
            {"entry_price": entry_price, "direction": direction},
            sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 4.0
        )

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.15, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"FVG Expansion HTF-Gated {direction}. 1H FVG {target_fvg.gap_type} "
                     f"{target_fvg.mitigated_percent:.0%} mitigated. 15M BOS confirms. "
                     f"1D HTF bias ({htf_bias}) aligned with direction — gate passed. "
                     f"Entry at FVG 50%. SL beyond FVG extreme. 4R target.",
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

    Rules (original 6, still the entry trigger/geometry — unchanged):
    1. Identify accumulation (lows) or distribution (highs) structure
    2. Wait for Spring (buy) or Upthrust (sell) - false break with volume
    3. Volume must show divergence (less volume on break than expected)
    4. Enter on close back inside range + CHoCH
    5. Stop beyond the spring/upthrust extreme
    6. Target opposite side of range or 3:1

    REDESIGNED by direct audit request ("no trades — is the strategy
    or logic correct and consistent with SMC best practice ... be
    creative and innovative, find a better solution ... work on a
    winning strategy for this bot"). Confirmed root cause of the
    silence: a prior revision stacked SEVEN independent, strict gates
    in series on every single scan — range (last 3 swings only), price
    within 15% of the range extreme, that extreme inside a real 4H OB,
    a volume-divergent spring/upthrust in the last 10 1H candles, a 1H
    CHoCH, a FVG strictly AFTER that CHoCH's timestamp, AND a 4H BOS
    independently agreeing — all required to fire AT ONCE. Each gate
    individually might pass 20-40% of the time; multiplying seven of
    them together is why bot_4_volume_liq_2 went 5+ days without a
    single trade. This wasn't one bug, it was confluence-stacking
    added incrementally (one direct request at a time, per the git
    history) without ever checking the compounding effect — SMC-
    consistent in isolation, practically unfireable in combination.

    Two genuine fixes, not just a relaxation:

    1. TEMPORAL COHERENCE — the old code treated CHoCH/FVG/BOS as
       independent snapshot checks with no requirement that they
       happen in the right ORDER relative to the sweep itself (e.g. it
       would accept whatever CHoCH was "last ever computed," even one
       from a completely different, unrelated market phase days
       earlier). Real Wyckoff is a SEQUENCE — Spring/Upthrust -> Sign
       of Strength (CHoCH) -> Back-up/LPS -> Markup — not simultaneous
       snapshots. The CHoCH used here must now occur AT OR AFTER the
       sweep's own candle.

    2. GRADED CONFLUENCE, not a rigid AND-chain — the two primitives
       that actually DEFINE a Wyckoff Spring/Upthrust reversal stay
       mandatory: the false-break sweep itself, and a temporally-
       coherent CHoCH confirming the reversal. The other four checks
       (4H POI, volume divergence, post-CHoCH FVG "change in delivery
       state", 4H BOS trend agreement) become a SCORED confluence
       list instead of hard gates — at least 2 of those 4 must be
       present, each also lifting confidence/position quality, rather
       than requiring literally all 4 simultaneously. Volume data on
       crypto perpetuals is also a known ICT/SMC-critiqued signal
       (not genuine "smart money" tape) — demoting it from mandatory
       gate to scored confluence reflects that it's suggestive, not
       definitive.

    Also fixed: this was the only bot whose signal carried a single
    flat target instead of the platform's normal 1R/2R/rr-R partial-
    exit ladder (BotSignal's own comment used to call this out by
    name as the one intentional exception) — meaning it never
    participated in partial take-profits or the trailing-stop engine.
    It now uses the same ladder as every other bot, with TP3 capped at
    the opposite side of the range when that's the tighter of the two
    (so it still respects the structural range this setup is actually
    based on).
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_4_volume_liq"
        self.bot_name = "Volume & Liquidity Sweep"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_4", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_4", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=3.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                # Overrides self.bot_id on the produced signal — lets
                # ONE strategy-family instance (self.bots["bot_N"] in
                # BotOrchestrator) run on behalf of several real
                # BotConfig rows that all share this algorithm. None
                # (every call site before this feature) keeps the
                # original hardcoded self.bot_id, so nothing about the
                # 5 original bots' own behavior changes.
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

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

        # Step 2: Detect Spring or Upthrust on 1H — the one truly
        # MANDATORY primitive (this IS the liquidity sweep Wyckoff
        # terms describe). Volume divergence is no longer a hard gate
        # here (see class docstring) — recorded per-candidate instead,
        # feeding the scored confluence list below.
        # Spring: Price breaks below range low, then closes back above
        # Upthrust: Price breaks above range high, then closes back below
        recent_candles = candles_1h[-10:]
        avg_vol_1h = sum(c.volume for c in candles_1h[-20:]) / 20

        spring = None
        upthrust = None

        for candle in recent_candles:
            if candle.low < range_low and candle.close > range_low:
                spring = {
                    "candle": candle, "type": "spring", "extreme": candle.low, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }
            if candle.high > range_high and candle.close < range_high:
                upthrust = {
                    "candle": candle, "type": "upthrust", "extreme": candle.high, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }

        if not spring and not upthrust:
            return None

        # Step 3: CHoCH confirmation — the second MANDATORY primitive,
        # now required to occur AT OR AFTER the sweep's own candle
        # (temporal coherence fix — see class docstring). Fed through
        # filter_significant_swings, same as every other direction-
        # deciding BOS/CHoCH call across the bot suite.
        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)

        choch_1h = self.structure_detector.detect_choch(
            candles_1h, self.structure_detector.filter_significant_swings(swings_1h)
        )
        if not choch_1h:
            return None

        sweep_event = spring or upthrust
        sweep_timestamp = sweep_event["candle"].timestamp
        choch_after_sweep = [c for c in choch_1h if c["timestamp"] >= sweep_timestamp]
        if not choch_after_sweep:
            return None
        last_choch = choch_after_sweep[-1]

        # Align pattern with CHoCH
        if spring and last_choch["type"] == "bullish_choch":
            direction = "long"
            entry_price = spring["close"]
            sl_price = spring["extreme"] - range_size * 0.02
            pattern = "spring"
            volume_divergence = spring["volume_divergence"]
        elif upthrust and last_choch["type"] == "bearish_choch":
            direction = "short"
            entry_price = upthrust["close"]
            sl_price = upthrust["extreme"] + range_size * 0.02
            pattern = "upthrust"
            volume_divergence = upthrust["volume_divergence"]
        else:
            return None

        # Step 4: scored confluences — at least 2 of these 4 must be
        # present (see class docstring for why these 4, specifically,
        # became scored rather than mandatory).
        zone_detector = ZoneDetector()
        zones_4h = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_zones_4h = [z for z in zones_4h if z.status.name == "ACTIVE"]
        poi_price = range_high if near_high else range_low
        poi_zone = next((z for z in active_zones_4h if z.bottom <= poi_price <= z.top), None)

        fvg_detector = FVGDetector()
        fvgs_1h = fvg_detector.detect_fvg(candles_1h)
        choch_timestamp = last_choch["timestamp"]
        direction_fvgs = [
            f for f in fvgs_1h
            if f.candle1.timestamp >= choch_timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(direction_fvgs, direction)

        bos_4h = self.structure_detector.detect_bos(
            candles_4h, self.structure_detector.filter_significant_swings(swings_4h)
        )
        trend_4h = None
        if bos_4h:
            last_bos_4h = bos_4h[-1]
            trend_4h = "long" if last_bos_4h["type"] == "bullish_bos" else "short" if last_bos_4h["type"] == "bearish_bos" else None

        confluences = {
            "poi_4h": poi_zone is not None,
            "volume_divergence": volume_divergence,
            "post_choch_fvg": valid_fvg is not None,
            "htf_trend_agreement": trend_4h == direction,
        }
        confluence_count = sum(1 for v in confluences.values() if v)
        if confluence_count < 2:
            return None

        # Step 5: SL — embed the POI zone when one was found (see
        # extend_stop_beyond_zone's own docstring for why).
        if poi_zone is not None:
            sl_price = extend_stop_beyond_zone(sl_price, poi_zone, direction)

        # Floor — same gap found and fixed across this bot family's
        # other raw sweep/swing-extreme SL branches (see Bot 2's own
        # fix comment for the full root cause); this path built its
        # stop from range_size * 0.02 with no floor at all, so a tight
        # range could produce an undersized stop. See
        # apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {
            "stop_loss": sl_price,
            "sl_distance": sl_distance,
            "method": "spring_upthrust_extreme"
        }

        # Step 6: the normal 1R/2R/rr-R partial-exit ladder (see class
        # docstring — this bot used to be the one hardcoded exception
        # to it), with TP3 capped at the opposite side of the range
        # when that's the tighter of the two, so it still respects the
        # structural range this setup is actually based on.
        entry = {"entry_price": entry_price, "direction": direction}
        rr = min_rr_ratio if min_rr_ratio is not None else 3.0
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=rr, multi_target=True)
        if direction == "long":
            structural_cap = range_high - range_size * 0.05
            if structural_cap > entry_price:
                targets["tp3"] = round(min(targets["tp3"], structural_cap), 5)
        else:
            structural_cap = range_low + range_size * 0.05
            if structural_cap < entry_price:
                targets["tp3"] = round(max(targets["tp3"], structural_cap), 5)

        confidence = round(0.55 + 0.075 * confluence_count, 2)  # 2/4 -> 0.70, 4/4 -> 0.85
        risk = self.risk_manager.calculate_position_risk(
            setup_quality=min(1.0 + 0.1 * confluence_count, 1.5), base_risk_override=risk_per_trade
        )
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=confidence,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"Wyckoff {pattern} {direction}. Range {range_low:.5f}-{range_high:.5f}. CHoCH confirms, "
                     f"at/after the sweep. Confluences ({confluence_count}/4): POI={confluences['poi_4h']}, "
                     f"vol divergence={confluences['volume_divergence']}, post-CHoCH FVG={confluences['post_choch_fvg']}, "
                     f"4H trend agrees={confluences['htf_trend_agreement']}. SL beyond {pattern} extreme"
                     + (" + embedded POI zone" if poi_zone is not None else "") + f". {rr:g}R ladder, TP3 capped at range.",
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
    2. Direction follows the last 4H BOS (the higher-timeframe trend) —
       see the direction-step comment below for why this replaced the
       original liquidity-sweep-side logic.
    3. Wait for LTF (15M/5M) liquidity purge of retail trendlines/patterns
    4. Confirmation candle: strong close back inside zone with momentum
    5. FVG must form on confirmation candle (not just exist)
    6. Entry at 50% of confirmation candle or FVG 50%
    7. Strict SL: beyond purge extreme + buffer
    8. Target 4:1 to 6:1 (Jeafx emphasizes high R:R)
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_5_jeafx"
        self.bot_name = "SMC BOT"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_5", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_5", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                candles_5m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                # Overrides self.bot_id on the produced signal — lets
                # ONE strategy-family instance (self.bots["bot_N"] in
                # BotOrchestrator) run on behalf of several real
                # BotConfig rows that all share this algorithm. None
                # (every call site before this feature) keeps the
                # original hardcoded self.bot_id, so nothing about the
                # 5 original bots' own behavior changes.
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

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

        # Step 2: Direction from the last 4H BOS — real strategy change,
        # by direct request ("get direction from the direction of the
        # last 4H BOS - so it should follow the 4H TREND ONLY"),
        # replacing the ORIGINAL liquidity-sweep-side logic this method
        # used to have here (buy_side_sweep -> long, sell_side_sweep ->
        # short) — the step the user reported as the bot "often
        # miss[ing] the price[']s direction."
        #
        # Separately researched and CONFIRMED by direct request
        # ("I expect that a sweep of sellside liquidity should move
        # long and a sweep of buyside should make price move short
        # direction ... confirm from research and the web"): standard
        # ICT/SMC convention (the "Turtle Soup" liquidity-sweep-reversal
        # setup, and independently corroborated by Smart Money Concepts
        # material) has this the OPPOSITE way from what the OLD code
        # here did — buy-side liquidity (resting above swing highs)
        # swept -> BEARISH reversal (short); sell-side liquidity
        # (resting below swing lows) swept -> BULLISH reversal (long).
        # The old mapping was backwards by the standard convention, on
        # top of being the less-reliable signal overall per the user's
        # own observation — which is exactly why this step now uses 4H
        # BOS instead of either sweep-direction reading. The sweep
        # itself is NOT removed — see Step 3 below — it's just no
        # longer what decides long vs. short.
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)
        bos_4h = self.structure_detector.detect_bos(
            candles_4h, self.structure_detector.filter_significant_swings(swings_4h)
        )
        if not bos_4h:
            return None
        last_bos_4h = bos_4h[-1]
        if last_bos_4h["type"] == "bullish_bos":
            direction = "long"
        elif last_bos_4h["type"] == "bearish_bos":
            direction = "short"
        else:
            return None

        # Step 2b: LTF conflict check — by direct audit request ("based
        # on SMC best practice, what would be the best option for Bot 5
        # and 6 to get the best winning direction bias"). Standard
        # ICT/SMC practice: a higher timeframe sets the BIAS, lower-
        # timeframe events only CONFIRM it — never override it, but a
        # live, active LTF reversal AGAINST the HTF bias is still a
        # real warning worth skipping. Neither of these is required to
        # fire (that would just reintroduce Bot 6's old "either is
        # enough" design here); this only rejects when one of them
        # fires with a CLEAR, opposite reading.
        choch_dir = _choch_direction_15m(self.structure_detector, candles_15m)
        fvg_bos_dir = _fvg_bos_direction_1h_15m(candles_1h, candles_15m)
        if (choch_dir and choch_dir != direction) or (fvg_bos_dir and fvg_bos_dir != direction):
            return None

        # Step 3: Check 15M for liquidity purge — still required as the
        # ENTRY-TIMING/zone-alignment gate (a zone with no purge yet
        # isn't ready to trade), same role this already played before
        # Step 2's change; it no longer decides direction (see above).
        liq_detector = LiquidityDetector(tolerance_pips=1.0)
        pools = liq_detector.detect_equal_highs_lows(candles_15m, lookback=30)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])

        if not sweeps:
            return None

        last_sweep = sweeps[-1]

        # Step 4: Find zone aligned with sweep
        sweep_price = last_sweep["sweep_price"]
        aligned_zone = None

        for z in fresh_zones:
            if z.bottom <= sweep_price <= z.top:
                aligned_zone = z
                break

        if not aligned_zone:
            return None

        # Discount (long) / premium (short) check — by direct audit
        # request ("ensure that you are entering at Discount for Longs
        # and Premium for shorts of the 4H and 1H trading range");
        # classify_premium_discount existed in the codebase this whole
        # time and was never called by any bot.
        swing_high_1h = max((s.price for s in swings_1h), default=None)
        swing_low_1h = min((s.price for s in swings_1h), default=None)
        if swing_high_1h is not None and swing_low_1h is not None:
            zone_detector.classify_premium_discount([aligned_zone], swing_high_1h, swing_low_1h)
            if (direction == "long" and aligned_zone.classification == "premium") or \
               (direction == "short" and aligned_zone.classification == "discount"):
                return None

        # Step 5: Confirmation candle on 5M
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

        # Step 6: FVG must form on or after confirmation, in the 4H-BOS
        # direction (was: cross-checked against the sweep's own side —
        # now cross-checked against `direction` from Step 2, so this
        # stays internally consistent with what's actually driving the
        # trade).
        fvg_detector = FVGDetector()
        recent_fvgs = fvg_detector.detect_fvg(candles_5m[-10:])

        # Depth-based selection among qualifying FVGs — by direct audit
        # request ("if there's another FVG either shallower or deeper
        # ... for shorts use the highest FVG ... for longs use the
        # deepest FVG"); previously just took the first match.
        candidate_fvgs = [
            f for f in recent_fvgs
            if f.candle1.timestamp >= confirmation_candle.timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(candidate_fvgs, direction)

        # Step 7: Entry at 50% of confirmation candle or FVG
        if valid_fvg:
            entry_price = (valid_fvg.top + valid_fvg.bottom) / 2
        else:
            entry_price = (confirmation_candle.open + confirmation_candle.close) / 2

        # Real bug, found live (bot_signal_invalid_risk_geometry:
        # "stop_loss is on the wrong side of entry_price for this
        # direction", recurring for this exact bot): Step 3's sweep
        # selection (last_sweep = sweeps[-1]) picks whichever sweep is
        # most recent in the 15M window with no regard for which SIDE
        # it swept — direction comes from 4H BOS now, entirely
        # decoupled from the sweep (see Step 2's own comment on why).
        # A "buy_side_sweep" is a swept LOW (bullish continuation —
        # should only ever anchor a LONG's stop); a "sell_side_sweep"
        # is a swept HIGH (bearish continuation — should only ever
        # anchor a SHORT's stop) — see LiquidityDetector.
        # detect_liquidity_sweeps' own real behavior (buy_side_sweep:
        # candle.low, wick-below-close-above a swept LOW; sell_side_
        # sweep: candle.high, wick-above-close-below a swept HIGH).
        # Using a sweep of the WRONG side here let a short's stop get
        # anchored to a recently-swept LOW — often itself below the
        # (independently computed) entry price — producing exactly the
        # "stop on the wrong side of entry" signals rejected live.
        # Fails closed (no signal) rather than risk computing a bad
        # stop, same discipline as every other hard gate in this bot.
        expected_sweep_type = "buy_side_sweep" if direction == "long" else "sell_side_sweep"
        if last_sweep["type"] != expected_sweep_type:
            return None

        # Step 8: Strict SL beyond purge extreme, extended to embed the
        # aligned zone itself — by direct, repeated audit observation
        # ("the order block should be embedded within the SL
        # boundaries ... price retraces back to the order block ...
        # before going in preferred direction"). See
        # extend_stop_beyond_zone's own docstring.
        purge_extreme = last_sweep["sweep_price"]
        buffer = abs(confirmation_candle.high - confirmation_candle.low) * 0.2

        if direction == "long":
            sl_price = purge_extreme - buffer
        else:
            sl_price = purge_extreme + buffer

        sl_price = extend_stop_beyond_zone(sl_price, aligned_zone, direction)
        # Floor — same gap found and fixed across this bot family's
        # other raw sweep-extreme SL branches (see Bot 2's own fix
        # comment for the full root cause). See
        # apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
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
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"SMC BOT {direction}. 4H BOS confirms trend. 1H fresh zone. 15M {last_sweep['type']} (timing gate). "
                     f"5M confirmation candle + FVG: {valid_fvg is not None}. "
                     f"Entry at 50%. Strict SL beyond purge. 5R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT 6: SMC v2 — Bot 5's own zone/purge/confirmation setup, direction
# from its own 1H BOS bias confirmed by Bot 2/Bot 3's LTF signals
# =============================================================================

class JeafxSMCv2Bot:
    """
    Bot 6: SMC v2

    A duplicate of Bot 5 (JeafxSMCBot) — same refined zone, same 15M
    liquidity-purge gate, same 5M momentum confirmation candle, same
    strict SL beyond the purge extreme, same high-R:R target ladder —
    by direct request ("it's a duplicate of the original SMC bot").

    Direction logic REVISED AGAIN by direct audit request ("based on
    SMC best practice, what would be the best option for Bot 5 and 6
    to get the best winning direction bias"). History: it originally
    came from which side the 15M liquidity sweep hit, which the user
    observed "often misses the price[']s direction"; that was replaced
    with "either Bot 2's 15M CHoCH or Bot 3's 1H-FVG+15M-BOS, whichever
    fires" — but that design has the same underlying flaw by a
    different route: standard ICT/SMC practice treats CHoCH and a
    single FVG+BOS read as LOWER-timeframe, REACTIVE confirmation
    signals, not bias-setters in their own right. Letting either one
    alone dictate direction meant Bot 6 could trade straight against
    the prevailing higher-timeframe structure whenever only the
    weaker LTF signal happened to fire.

    Now: Bot 6 gets its own HTF anchor — 1H BOS (deliberately
    DIFFERENT from Bot 5's 4H anchor, so the two bots stay a genuine
    comparison of HTF-anchor speed rather than becoming duplicates of
    each other) — as the MANDATORY bias, with Bot 2's CHoCH and Bot
    3's FVG+BOS now required to AGREE with it (at least one of the
    two) rather than stand in for it. Still no trade if the two LTF
    reads actively contradict each other.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_6_smc_v2"
        self.bot_name = "SMC v2"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_6", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_6", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                candles_5m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Step 1: Find refined supply/demand zones on 1H — identical to Bot 5.
        zone_detector = ZoneDetector()
        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)

        zones = zone_detector.detect_order_blocks(candles_1h, swings_1h)
        fresh_zones = [z for z in zones
                      if z.status.name == "ACTIVE" and z.test_count <= 1]

        if not fresh_zones:
            return None

        # Step 2: 15M liquidity purge — identical to Bot 5. Still required
        # as the ENTRY-TIMING gate (a zone with no purge yet isn't ready
        # to trade) even though the purge's own side no longer decides
        # direction below.
        liq_detector = LiquidityDetector(tolerance_pips=1.0)
        pools = liq_detector.detect_equal_highs_lows(candles_15m, lookback=30)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])

        if not sweeps:
            return None

        last_sweep = sweeps[-1]

        # Step 3: Zone aligned with the purge — identical to Bot 5.
        sweep_price = last_sweep["sweep_price"]
        aligned_zone = None
        for z in fresh_zones:
            if z.bottom <= sweep_price <= z.top:
                aligned_zone = z
                break

        if not aligned_zone:
            return None

        # Step 4: 5M momentum confirmation candle — identical to Bot 5.
        recent_5m = candles_5m[-5:]
        confirmation_candle = None
        for c in recent_5m:
            body_size = abs(c.close - c.open)
            avg_body = sum(abs(x.close - x.open) for x in candles_5m[-20:]) / 20
            if body_size > avg_body * 1.5:
                if aligned_zone.bottom <= c.close <= aligned_zone.top:
                    confirmation_candle = c
                    break

        if not confirmation_candle:
            return None

        # Step 5: Direction — REVISED (see class docstring): 1H BOS is
        # now the MANDATORY HTF bias (Bot 6's own anchor, distinct from
        # Bot 5's 4H one), fed through filter_significant_swings like
        # every other direction-deciding BOS/CHoCH call. Bot 2's 15M
        # CHoCH and Bot 3's 1H-FVG+15M-BOS no longer stand in for
        # direction on their own — at least one of them must now AGREE
        # with the 1H bias, or this is dropped.
        bos_1h = self.structure_detector.detect_bos(
            candles_1h, self.structure_detector.filter_significant_swings(swings_1h)
        )
        if not bos_1h:
            return None
        last_bos_1h = bos_1h[-1]
        if last_bos_1h["type"] == "bullish_bos":
            direction = "long"
        elif last_bos_1h["type"] == "bearish_bos":
            direction = "short"
        else:
            return None

        choch_dir = _choch_direction_15m(self.structure_detector, candles_15m)
        fvg_bos_dir = _fvg_bos_direction_1h_15m(candles_1h, candles_15m)
        if choch_dir != direction and fvg_bos_dir != direction:
            return None

        # Discount (long) / premium (short) check — by direct audit
        # request ("ensure that you are entering at Discount for Longs
        # and Premium for shorts of the 4H and 1H trading range").
        swing_high_1h = max((s.price for s in swings_1h), default=None)
        swing_low_1h = min((s.price for s in swings_1h), default=None)
        if swing_high_1h is not None and swing_low_1h is not None:
            zone_detector.classify_premium_discount([aligned_zone], swing_high_1h, swing_low_1h)
            if (direction == "long" and aligned_zone.classification == "premium") or \
               (direction == "short" and aligned_zone.classification == "discount"):
                return None

        # Step 6: FVG must form on or after confirmation, in the
        # consensus direction — depth-based selection among qualifying
        # candidates (deepest for a long, highest for a short), same
        # fix as Bot 5's identical step.
        fvg_detector = FVGDetector()
        recent_fvgs = fvg_detector.detect_fvg(candles_5m[-10:])

        candidate_fvgs = [
            f for f in recent_fvgs
            if f.candle1.timestamp >= confirmation_candle.timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(candidate_fvgs, direction)

        # Step 7: Entry at 50% of confirmation candle or FVG — identical to Bot 5.
        if valid_fvg:
            entry_price = (valid_fvg.top + valid_fvg.bottom) / 2
        else:
            entry_price = (confirmation_candle.open + confirmation_candle.close) / 2

        # Real bug, same fix as Bot 5's identical step (see that one's
        # own comment for the full root-cause explanation): Step 2's
        # sweep selection has no direction to filter by yet here
        # (direction isn't decided until Step 5), so this validates the
        # sweep's side against direction right before trusting it as a
        # stop-loss anchor instead — fails closed rather than risk a
        # stop on the wrong side of entry.
        expected_sweep_type = "buy_side_sweep" if direction == "long" else "sell_side_sweep"
        if last_sweep["type"] != expected_sweep_type:
            return None

        # Step 8: Strict SL beyond purge extreme, extended to embed the
        # aligned zone itself — same fix, and same user observation, as
        # Bot 5's identical step.
        purge_extreme = last_sweep["sweep_price"]
        buffer = abs(confirmation_candle.high - confirmation_candle.low) * 0.2

        if direction == "long":
            sl_price = purge_extreme - buffer
        else:
            sl_price = purge_extreme + buffer

        sl_price = extend_stop_beyond_zone(sl_price, aligned_zone, direction)
        # Floor — see Bot 2/Bot 5's own fix comment for the full root
        # cause; same gap, same fix, everywhere this pattern recurs.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "jeafx_purge_extreme"}

        # Step 9: High R:R target (4-6R) — identical to Bot 5.
        entry = {"entry_price": entry_price, "direction": direction}
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 5.0)

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.3, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"SMC v2 {direction}. 1H BOS bias confirmed by: Bot2 CHoCH={choch_dir or '—'}, "
                     f"Bot3 FVG/BOS={fvg_bos_dir or '—'} (at least one agrees). 1H fresh zone, discount/premium checked. "
                     f"15M purge (timing/zone gate). 5M confirmation candle + depth-selected FVG: {valid_fvg is not None}. "
                     f"Entry at 50%. Strict SL beyond purge, embedded zone. 5R target.",
            timestamp=datetime.utcnow()
        )


class JeafxSMCv2SingleAnchorBot:
    """
    Bot 8: SMC v2 — Single-Anchor A/B Variant

    By direct request: "critically review this strategy using SMC best
    practise and find a way to loosen and still make a winning
    strategy ... If you find we can create a totally new bot with your
    new guidance and then use it as a A to B testing over the long run
    ... original versus modified."

    IMPORTANT CONTEXT, checked before building this: Bot 6's direction
    logic was ALREADY revised (commit 90eadaf, 2026-10-14) from "Bot2
    CHoCH or Bot3 FVG/BOS, whichever fires" to today's mandatory-1H-BOS
    design. Live-verified: 23 of Bot 6's 24 real trades (96%) predate
    that revision — the "negative expectancy" audit finding is almost
    entirely measuring the OLD, already-superseded logic, not evidence
    against the current one, which has only 2 real trades so far. So
    this is NOT a revert to the old flawed logic, and NOT a blind
    "loosening" — it targets one specific, real asymmetry found by
    reading Bot 6's own current code against Bot 5's.

    Bot 6's own class docstring states its purpose: "the two bots stay
    a genuine comparison of HTF-anchor speed [4H vs 1H] rather than
    becoming duplicates of each other." But unlike Bot 5 (which decides
    direction from its HTF BOS alone), Bot 6 ALSO requires Bot 2's 15M
    CHoCH or Bot 3's 1H-FVG+15M-BOS to independently agree with the 1H
    bias — a second constraint Bot 5 doesn't have. That confounds the
    very comparison Bot 6 was designed to be: a loss (or a miss) could
    be caused by the faster 1H anchor itself, or by this extra
    agreement gate, with no way to tell which from Bot 6's trades
    alone.

    This bot is Bot 6's CURRENT logic with ONLY that one gate removed —
    direction decided by 1H BOS alone, exactly mirroring Bot 5's own
    single-anchor architecture. Every other step (fresh 1H zone, 15M
    purge timing gate, premium/discount check, 5M confirmation +
    depth-selected FVG, strict SL beyond the purge extreme, 5R target)
    is identical to Bot 6, unchanged. A genuine, single-variable A/B
    test: if this variant's real results end up closer to Bot 5's than
    Bot 6's own do, the LTF-agreement gate (not the 1H anchor) is the
    thing actually costing Bot 6 performance — real, future evidence
    neither bot's own trade history can currently answer alone.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_8_smc_v2_single_anchor"
        self.bot_name = "SMC v2 — Single-Anchor (A/B)"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_8", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_8", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=4.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_1h: List[Candle],
                candles_15m: List[Candle],
                candles_5m: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Steps 1-4: identical to Bot 6 (fresh 1H zone, 15M purge
        # timing gate, zone/purge alignment, 5M momentum confirmation).
        zone_detector = ZoneDetector()
        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)

        zones = zone_detector.detect_order_blocks(candles_1h, swings_1h)
        fresh_zones = [z for z in zones if z.status.name == "ACTIVE" and z.test_count <= 1]
        if not fresh_zones:
            return None

        liq_detector = LiquidityDetector(tolerance_pips=1.0)
        pools = liq_detector.detect_equal_highs_lows(candles_15m, lookback=30)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])
        if not sweeps:
            return None
        last_sweep = sweeps[-1]

        sweep_price = last_sweep["sweep_price"]
        aligned_zone = None
        for z in fresh_zones:
            if z.bottom <= sweep_price <= z.top:
                aligned_zone = z
                break
        if not aligned_zone:
            return None

        recent_5m = candles_5m[-5:]
        confirmation_candle = None
        for c in recent_5m:
            body_size = abs(c.close - c.open)
            avg_body = sum(abs(x.close - x.open) for x in candles_5m[-20:]) / 20
            if body_size > avg_body * 1.5:
                if aligned_zone.bottom <= c.close <= aligned_zone.top:
                    confirmation_candle = c
                    break
        if not confirmation_candle:
            return None

        # Step 5: Direction — the ONE real change from Bot 6. 1H BOS
        # alone, mirroring Bot 5's own single-anchor design — Bot 2's
        # CHoCH / Bot 3's FVG+BOS are NOT consulted at all here (see
        # this class's own docstring for exactly why).
        bos_1h = self.structure_detector.detect_bos(
            candles_1h, self.structure_detector.filter_significant_swings(swings_1h)
        )
        if not bos_1h:
            return None
        last_bos_1h = bos_1h[-1]
        if last_bos_1h["type"] == "bullish_bos":
            direction = "long"
        elif last_bos_1h["type"] == "bearish_bos":
            direction = "short"
        else:
            return None

        # Premium/discount check — kept identical to Bot 6 (not the
        # variable under test here).
        swing_high_1h = max((s.price for s in swings_1h), default=None)
        swing_low_1h = min((s.price for s in swings_1h), default=None)
        if swing_high_1h is not None and swing_low_1h is not None:
            zone_detector.classify_premium_discount([aligned_zone], swing_high_1h, swing_low_1h)
            if (direction == "long" and aligned_zone.classification == "premium") or \
               (direction == "short" and aligned_zone.classification == "discount"):
                return None

        # Steps 6-9: identical to Bot 6 (depth-selected FVG entry,
        # sweep-direction validation, strict SL beyond the purge
        # extreme embedding the zone, 5R target ladder).
        fvg_detector = FVGDetector()
        recent_fvgs = fvg_detector.detect_fvg(candles_5m[-10:])
        candidate_fvgs = [
            f for f in recent_fvgs
            if f.candle1.timestamp >= confirmation_candle.timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(candidate_fvgs, direction)

        if valid_fvg:
            entry_price = (valid_fvg.top + valid_fvg.bottom) / 2
        else:
            entry_price = (confirmation_candle.open + confirmation_candle.close) / 2

        expected_sweep_type = "buy_side_sweep" if direction == "long" else "sell_side_sweep"
        if last_sweep["type"] != expected_sweep_type:
            return None

        purge_extreme = last_sweep["sweep_price"]
        buffer = abs(confirmation_candle.high - confirmation_candle.low) * 0.2
        if direction == "long":
            sl_price = purge_extreme - buffer
        else:
            sl_price = purge_extreme + buffer
        sl_price = extend_stop_beyond_zone(sl_price, aligned_zone, direction)
        # Floor — see Bot 2/Bot 5's own fix comment for the full root
        # cause; same gap, same fix, everywhere this pattern recurs.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "jeafx_purge_extreme"}

        entry = {"entry_price": entry_price, "direction": direction}
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 5.0)

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.3, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"SMC v2 single-anchor (A/B) {direction}. 1H BOS bias ONLY — no LTF agreement required "
                     f"(the one variable this variant isolates vs Bot 6). 1H fresh zone, discount/premium checked. "
                     f"15M purge (timing/zone gate). 5M confirmation candle + depth-selected FVG: {valid_fvg is not None}. "
                     f"Entry at 50%. Strict SL beyond purge, embedded zone. 5R target.",
            timestamp=datetime.utcnow()
        )


class VolumeLiquidityWideRangeBot:
    """
    Bot 9: Volume & Liquidity Sweep — Wide-Range A/B Variant

    By direct request: "Do same for bots that have not been taking
    trades or have been rejecting trades ... critically review and make
    another bot v2 or v3 that can be used to compare in them long run."

    Bot 4 (VolumeLiquidityBot) was found live to be genuinely silent:
    bot_4_volume_liq_2 has zero trades ever; bot_4_volume_liq has had 1
    in 30 days. Investigated by replaying Bot 4's exact gating logic
    bar-by-bar against 910 real 1H BTCUSDT.P candles (the real last 30
    days), with a counter on every gate to find the EXACT rejection
    stage rather than guessing:

        not_enough_swings:    225 (24.7%)
        no_3_highs_3_lows:    129 (14.2%)
        not_near_extreme:     465 (51.1%)  <- by far the largest single filter
        no_spring_or_upthrust: 54 ( 5.9% of what's left)
        no_choch:              37 ( 4.1% of what's left — every genuine
                                     Spring/Upthrust found still needed
                                     a confirming CHoCH, and none got one
                                     in this window)

    "not near a range extreme" (price within 15% of the computed
    4H range's own high/low) is the single largest, most load-bearing
    filter — more than double the next biggest. This variant's ONE
    change: widens that band from 15% to 25%, still a real "near the
    edge of the range" definition, not arbitrary slack. Every other
    step (range/swing detection, the Spring/Upthrust false-break
    itself, the mandatory CHoCH confirmation, the 2-of-4 scored
    confluence requirement, SL/TP methodology) is identical to Bot 4,
    unchanged — isolating this one measured bottleneck as the real
    variable under test, not stacking multiple unproven changes at
    once.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_9_volume_liq_wide_range"
        self.bot_name = "Volume & Liquidity Sweep — Wide Range (A/B)"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_9", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_9", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=3.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)
        if len(swings_4h) < 6:
            return None

        highs = [s.price for s in swings_4h if s.structure_type.name == "SWING_HIGH"][-3:]
        lows = [s.price for s in swings_4h if s.structure_type.name == "SWING_LOW"][-3:]
        if len(highs) < 3 or len(lows) < 3:
            return None

        range_high = max(highs)
        range_low = min(lows)
        range_size = range_high - range_low
        if range_size == 0:
            return None

        # The ONE change vs Bot 4: 0.25 instead of 0.15 — see this
        # class's own docstring for the real, measured evidence behind
        # widening specifically this gate.
        current_price = candles_1h[-1].close
        near_high = abs(current_price - range_high) / range_size < 0.25
        near_low = abs(current_price - range_low) / range_size < 0.25
        if not near_high and not near_low:
            return None

        recent_candles = candles_1h[-10:]
        avg_vol_1h = sum(c.volume for c in candles_1h[-20:]) / 20

        spring = None
        upthrust = None
        for candle in recent_candles:
            if candle.low < range_low and candle.close > range_low:
                spring = {
                    "candle": candle, "type": "spring", "extreme": candle.low, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }
            if candle.high > range_high and candle.close < range_high:
                upthrust = {
                    "candle": candle, "type": "upthrust", "extreme": candle.high, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }
        if not spring and not upthrust:
            return None

        swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                    self.structure_detector.detect_swing_lows(candles_1h)
        choch_1h = self.structure_detector.detect_choch(
            candles_1h, self.structure_detector.filter_significant_swings(swings_1h)
        )
        if not choch_1h:
            return None

        sweep_event = spring or upthrust
        sweep_timestamp = sweep_event["candle"].timestamp
        choch_after_sweep = [c for c in choch_1h if c["timestamp"] >= sweep_timestamp]
        if not choch_after_sweep:
            return None
        last_choch = choch_after_sweep[-1]

        if spring and last_choch["type"] == "bullish_choch":
            direction = "long"
            entry_price = spring["close"]
            sl_price = spring["extreme"] - range_size * 0.02
            volume_divergence = spring["volume_divergence"]
        elif upthrust and last_choch["type"] == "bearish_choch":
            direction = "short"
            entry_price = upthrust["close"]
            sl_price = upthrust["extreme"] + range_size * 0.02
            volume_divergence = upthrust["volume_divergence"]
        else:
            return None

        zone_detector = ZoneDetector()
        zones_4h = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_zones_4h = [z for z in zones_4h if z.status.name == "ACTIVE"]
        poi_price = range_high if near_high else range_low
        poi_zone = next((z for z in active_zones_4h if z.bottom <= poi_price <= z.top), None)

        fvg_detector = FVGDetector()
        fvgs_1h = fvg_detector.detect_fvg(candles_1h)
        choch_timestamp = last_choch["timestamp"]
        direction_fvgs = [
            f for f in fvgs_1h
            if f.candle1.timestamp >= choch_timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(direction_fvgs, direction)

        bos_4h = self.structure_detector.detect_bos(
            candles_4h, self.structure_detector.filter_significant_swings(swings_4h)
        )
        trend_4h = None
        if bos_4h:
            last_bos_4h = bos_4h[-1]
            trend_4h = "long" if last_bos_4h["type"] == "bullish_bos" else "short" if last_bos_4h["type"] == "bearish_bos" else None

        confluences = {
            "poi_4h": poi_zone is not None,
            "volume_divergence": volume_divergence,
            "post_choch_fvg": valid_fvg is not None,
            "htf_trend_agreement": trend_4h == direction,
        }
        confluence_count = sum(1 for v in confluences.values() if v)
        if confluence_count < 2:
            return None

        if poi_zone is not None:
            sl_price = extend_stop_beyond_zone(sl_price, poi_zone, direction)

        # Floor — same gap found and fixed across this bot family's
        # other raw sweep/swing-extreme SL branches (see Bot 2's own
        # fix comment for the full root cause). See
        # apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "spring_upthrust_extreme"}

        entry = {"entry_price": entry_price, "direction": direction}
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 3.0)

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.0, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.80,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"Wyckoff spring/upthrust (A/B, wide-range) {direction}. Range {range_low:.5f}-{range_high:.5f}, "
                     f"near extreme within 25% (vs Bot 4's 15% — the one variable this variant isolates). "
                     f"Volume divergence: {volume_divergence}. CHoCH on 1H. Confluence: {confluence_count}/4. "
                     f"SL beyond spring/upthrust extreme. Target range opposite.",
            timestamp=datetime.utcnow()
        )


class VolumeLiquidityHeldReclaimBot:
    """
    Bot 10: Volume & Liquidity Sweep — Held-Reclaim A/B Variant

    By direct request, after Bot 9's own real result came back a null:
    "Can we create a bot 10 to test the CHOCH issue — 0 of 37 genuine
    sweeps got a confirming CHoCH ... find ways to optimise and
    deliver value."

    Traced the real cause with a live, no-lookahead replay against the
    real production candle window (200 candles, matching
    market_scanner.py's own fetch limit — the earlier 37-event number
    used an artificially truncated 60-candle replay; corrected before
    drawing any conclusion). With the real window: 47 genuine Spring/
    Upthrust events, 43 of them (91.5%) rejected specifically because
    detect_choch's own trend-classification prerequisite (the last 6
    significant swings must show a CLEAN uptrend OR downtrend) never
    holds — which makes structural sense: Bot 4's own Step 1 requires
    a RANGING market as a precondition, and a genuinely ranging market
    rarely produces the clean directional swing sequence CHoCH's own
    trend gate demands. These two requirements are close to mutually
    exclusive by construction, not a calibration issue.

    Tested two alternative confirmations against the same real 47
    events before choosing one:
      - Swap CHoCH for a local, trend-gate-free BOS (detect_bos) of
        the nearest prior swing in the reversal direction: confirmed
        only 1 of 47 — barely different, not a real fix.
      - Classic Wyckoff "held the test": the spring/upthrust's OWN
        reclaim (closing back inside the range) is already the real
        sign-of-strength/weakness event in Wyckoff's own methodology —
        requiring a SEPARATE structural break on top of it is the
        redundant, over-engineered step actually suppressing signals.
        Confirmation becomes: did price avoid re-breaking the sweep's
        own extreme for the 3 candles immediately after it (a minimal
        "it held," not a fresh break elsewhere)? Confirmed 16 of 47
        (34%) — a real, substantial, data-validated improvement.

    This bot implements that second design. Steps 1-2 (range-bound
    4H structure, near-extreme check at Bot 4's own 15% band — NOT
    Bot 9's 25%, kept identical to Bot 4 so this isolates only the
    confirmation-method variable, not two changes at once) and the
    Spring/Upthrust detection itself are unchanged from Bot 4.
    Direction comes directly from which pattern fired (spring=long,
    upthrust=short) — CHoCH is no longer consulted for direction
    either, since it's not computed at all in this design. The scored
    confluence step's "post-reclaim FVG" check now looks for an FVG
    after the SWEEP (not a CHoCH that no longer exists), everything
    else in that step unchanged.
    """

    def __init__(self, config: Dict):
        self.bot_id = "bot_10_volume_liq_held_reclaim"
        self.bot_name = "Volume & Liquidity Sweep — Held Reclaim (A/B)"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_10", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_10", "right_bars", config)),
        )
        self.entry_engine = EntryExitEngine(default_rr=3.0)
        self.risk_manager = RiskManager(base_risk_percent=1.0)

    def analyze(self,
                candles_4h: List[Candle],
                candles_1h: List[Candle],
                account_balance: float,
                symbol: str,
                risk_per_trade: Optional[float] = None,
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        # Steps 1-2: identical to Bot 4 (range-bound 4H structure,
        # price near a range extreme within the SAME 15% band Bot 4
        # uses — not Bot 9's 25%, so this variant isolates only the
        # confirmation-method change).
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)
        if len(swings_4h) < 6:
            return None

        highs = [s.price for s in swings_4h if s.structure_type.name == "SWING_HIGH"][-3:]
        lows = [s.price for s in swings_4h if s.structure_type.name == "SWING_LOW"][-3:]
        if len(highs) < 3 or len(lows) < 3:
            return None

        range_high = max(highs)
        range_low = min(lows)
        range_size = range_high - range_low
        if range_size == 0:
            return None

        current_price = candles_1h[-1].close
        near_high = abs(current_price - range_high) / range_size < 0.15
        near_low = abs(current_price - range_low) / range_size < 0.15
        if not near_high and not near_low:
            return None

        # Step 3: Spring/Upthrust — identical detection to Bot 4.
        recent_candles = candles_1h[-10:]
        avg_vol_1h = sum(c.volume for c in candles_1h[-20:]) / 20

        spring = None
        upthrust = None
        for candle in recent_candles:
            if candle.low < range_low and candle.close > range_low:
                spring = {
                    "candle": candle, "type": "spring", "extreme": candle.low, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }
            if candle.high > range_high and candle.close < range_high:
                upthrust = {
                    "candle": candle, "type": "upthrust", "extreme": candle.high, "close": candle.close,
                    "volume_divergence": candle.volume < avg_vol_1h * 0.8,
                }
        if not spring and not upthrust:
            return None

        # Step 4: THE ONE REAL CHANGE — "held the test" instead of a
        # mandatory CHoCH. Direction comes directly from which pattern
        # fired (see class docstring for why this is the real,
        # data-validated Wyckoff-consistent confirmation, not a
        # looser version of the old one). Needs at least 1 full
        # candle since the sweep (can't confirm on the sweep's own
        # candle) and up to 3 checked — using only candles that have
        # ALREADY closed as of this call, so later scan cycles
        # naturally extend the held window with no lookahead.
        sweep_event = spring or upthrust
        try:
            sweep_idx = candles_1h.index(sweep_event["candle"])
        except ValueError:
            return None
        followthrough = candles_1h[sweep_idx + 1: sweep_idx + 4]
        if not followthrough:
            return None  # sweep candle is the most recent close - not enough time to confirm yet

        if spring:
            held = all(c.low > sweep_event["extreme"] for c in followthrough)
            direction = "long"
        else:
            held = all(c.high < sweep_event["extreme"] for c in followthrough)
            direction = "short"
        if not held:
            return None

        entry_price = sweep_event["close"]
        sl_price = sweep_event["extreme"] - range_size * 0.02 if direction == "long" else sweep_event["extreme"] + range_size * 0.02
        volume_divergence = sweep_event["volume_divergence"]

        # Step 5: scored confluences — same 2-of-4 requirement as
        # Bot 4, "post-reclaim FVG" now scoped to the sweep's own
        # timestamp (CHoCH no longer exists in this design to scope it
        # to instead).
        zone_detector = ZoneDetector()
        zones_4h = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_zones_4h = [z for z in zones_4h if z.status.name == "ACTIVE"]
        poi_price = range_high if near_high else range_low
        poi_zone = next((z for z in active_zones_4h if z.bottom <= poi_price <= z.top), None)

        fvg_detector = FVGDetector()
        fvgs_1h = fvg_detector.detect_fvg(candles_1h)
        sweep_timestamp = sweep_event["candle"].timestamp
        direction_fvgs = [
            f for f in fvgs_1h
            if f.candle1.timestamp >= sweep_timestamp and
            ((f.gap_type == "bullish" and direction == "long") or (f.gap_type == "bearish" and direction == "short"))
        ]
        valid_fvg = select_fvg_by_depth(direction_fvgs, direction)

        bos_4h = self.structure_detector.detect_bos(
            candles_4h, self.structure_detector.filter_significant_swings(swings_4h)
        )
        trend_4h = None
        if bos_4h:
            last_bos_4h = bos_4h[-1]
            trend_4h = "long" if last_bos_4h["type"] == "bullish_bos" else "short" if last_bos_4h["type"] == "bearish_bos" else None

        confluences = {
            "poi_4h": poi_zone is not None,
            "volume_divergence": volume_divergence,
            "post_reclaim_fvg": valid_fvg is not None,
            "htf_trend_agreement": trend_4h == direction,
        }
        confluence_count = sum(1 for v in confluences.values() if v)
        if confluence_count < 2:
            return None

        if poi_zone is not None:
            sl_price = extend_stop_beyond_zone(sl_price, poi_zone, direction)

        # Floor — same gap found and fixed across this bot family's
        # other raw sweep/swing-extreme SL branches (see Bot 2's own
        # fix comment for the full root cause). See
        # apply_min_stop_distance_floor's own docstring.
        sl_price = apply_min_stop_distance_floor(entry_price, sl_price, direction)
        sl_distance = abs(entry_price - sl_price)
        sl = {"stop_loss": sl_price, "sl_distance": sl_distance, "method": "spring_upthrust_extreme"}

        entry = {"entry_price": entry_price, "direction": direction}
        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 3.0)

        risk = self.risk_manager.calculate_position_risk(setup_quality=1.0, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl_distance)

        return BotSignal(
            bot_id=bot_id or self.bot_id,
            bot_name=self.bot_name,
            symbol=symbol,
            direction=direction,
            confidence=0.80,
            entry_price=round(entry_price, 5),
            stop_loss=round(sl_price, 5),
            take_profit=targets["tp1"],
            take_profit_2=targets["tp2"],
            take_profit_3=targets["tp3"],
            lot_size=lots["lot_size"],
            risk_percent=risk,
            reasoning=f"Wyckoff spring/upthrust (A/B, held-reclaim) {direction}. Range {range_low:.5f}-{range_high:.5f}, "
                     f"near extreme within 15% (same as Bot 4 — isolates only the confirmation method). "
                     f"Held the sweep extreme for 3 candles (replaces the mandatory CHoCH — see class docstring: "
                     f"0/47 real events confirmed via CHoCH, 16/47 confirmed this way). "
                     f"Volume divergence: {volume_divergence}. Confluence: {confluence_count}/4. "
                     f"SL beyond spring/upthrust extreme. Target range opposite.",
            timestamp=datetime.utcnow()
        )


class OrderBlockReversalWiderStopBot:
    """
    Bot 11: HF Order Block Reversal — Wider-Stop A/B Variant

    By direct request, after real screenshots of Bot 2 ("HF Order
    Block Reversal") trades were shared showing SHORT (NCCO1OILBRENT2
    USDUSDT.P) and LONG (JPYUSDT.P) setups both stopped out, both with
    Bot 2's own reasoning text literally saying "Tight SL": "I am
    wondering whether the SL is too tight for some of the bots ...
    can we test a variant that has the SL embed the range Order
    block ... how to optimise the tight SL - expand the SL. Do both
    versions with relaxed or larger SL that is well positioned and
    embeds the Order block - level of invalidation."

    Investigated before building anything. Reading Bot 2's real code
    (both its sweep-based and structure-swing-based stop branches)
    showed it was ALREADY calling extend_stop_beyond_zone on every
    path — the OB was already embedded within the stop in both
    branches; "Tight SL" in the reasoning text was stale/inaccurate
    copy, not a description of a missing step. Live-replaying Bot 2's
    real code against the real candles behind the exact two screenshot
    trades (matching market_scanner.py's own 200-candle production
    window, not an arbitrarily wider one) found the REAL bug instead:
    the real JPYUSDT.P trade's own sweep-based branch produced a stop
    only ~0.05% from entry — well under this platform's own 0.15%
    MIN_STOP_DISTANCE_PCT floor that every OTHER stop-placement path
    already enforces — because that one branch builds its stop dict by
    hand and had never been floored. That gap (confirmed to recur
    identically across Bots 2/4/5/6/8/9/10, not just Bot 2) is fixed at
    its source in each bot directly, not here — a genuine correctness
    bug belongs in the bot it was found in, not quarantined to an A/B
    variant.

    This bot is the SEPARATE thing actually being requested: a
    deliberately, legitimately WIDER stop than Bot 2's own (now
    correctly floored) baseline, kept as its own bot for a genuine A/B
    comparison — Bot 2 unmodified in every other respect vs this one
    variable change — rather than silently making Bot 2 itself more
    conservative and losing the ability to ever measure whether the
    extra room helps or just bleeds more on normal invalidations.
    Isolates exactly one variable: both the OB-embed buffer
    (extend_stop_beyond_zone's buffer_pct: 30% of the zone's own
    height here, vs Bot 2's 10%) and the hard floor (0.35% of entry,
    vs Bot 2's platform-wide 0.15%) are widened — two knobs that both
    exist for the identical purpose (making sure the stop sits a real,
    defensible distance beyond the level that actually invalidates the
    setup), so treating them as one combined "how wide is the
    invalidation buffer" variable, not two separate tests, matches how
    a trader would actually reason about "the stop is too tight": not
    one specific formula being wrong, but the overall margin being
    thin. Everything else — OB selection, CHoCH direction, premium/
    discount check, liquidity sweep, FVG confirmation, entry price,
    target ladder — is byte-for-byte identical to Bot 2.
    """

    _EMBED_BUFFER_PCT = 0.3  # vs Bot 2's extend_stop_beyond_zone default of 0.1
    _FLOOR_PCT = 0.0035      # vs Bot 2's platform-wide MIN_STOP_DISTANCE_PCT of 0.0015

    def __init__(self, config: Dict):
        self.bot_id = "bot_11_ob_reversal_wider_stop"
        self.bot_name = "HF Order Block Reversal (Wider-Stop A/B)"
        self.config = config
        self.structure_detector = MarketStructureDetector(
            left_bars=int(resolve_tunable_param("bot_11", "left_bars", config)),
            right_bars=int(resolve_tunable_param("bot_11", "right_bars", config)),
        )
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
                min_rr_ratio: Optional[float] = None,
                bot_id: Optional[str] = None) -> Optional[BotSignal]:

        zone_detector = ZoneDetector()
        swings_4h = self.structure_detector.detect_swing_highs(candles_4h) + \
                    self.structure_detector.detect_swing_lows(candles_4h)

        obs = zone_detector.detect_order_blocks(candles_4h, swings_4h)
        active_obs = [z for z in obs if z.status.name == "ACTIVE" and z.test_count <= 1]
        zone_swings = swings_4h

        if not active_obs:
            swings_1h = self.structure_detector.detect_swing_highs(candles_1h) + \
                        self.structure_detector.detect_swing_lows(candles_1h)
            obs = zone_detector.detect_order_blocks(candles_1h, swings_1h)
            active_obs = [z for z in obs if z.status.name == "ACTIVE" and z.test_count <= 1]
            zone_swings = swings_1h

        if not active_obs:
            return None

        current_price = candles_15m[-1].close
        inside_obs = [z for z in active_obs if z.bottom <= current_price <= z.top]

        if not inside_obs:
            return None

        target_ob = inside_obs[-1]

        swings_15m = self.structure_detector.detect_swing_highs(candles_15m) + \
                     self.structure_detector.detect_swing_lows(candles_15m)

        choch_15m = self.structure_detector.detect_choch(
            candles_15m, self.structure_detector.filter_significant_swings(swings_15m)
        )

        if not choch_15m:
            return None

        last_choch = choch_15m[-1]

        if last_choch["type"] == "bullish_choch":
            direction = "long"
        elif last_choch["type"] == "bearish_choch":
            direction = "short"
        else:
            return None

        zone_swing_high = max((s.price for s in zone_swings), default=None)
        zone_swing_low = min((s.price for s in zone_swings), default=None)
        if zone_swing_high is not None and zone_swing_low is not None:
            zone_detector.classify_premium_discount([target_ob], zone_swing_high, zone_swing_low)
            if (direction == "long" and target_ob.classification == "premium") or \
               (direction == "short" and target_ob.classification == "discount"):
                return None

        liq_detector = LiquidityDetector()
        pools = liq_detector.detect_equal_highs_lows(candles_15m)
        sweeps = liq_detector.detect_liquidity_sweeps(pools, candles_15m[-5:])

        has_sweep = len(sweeps) > 0

        fvg_detector = FVGDetector()
        fvgs = fvg_detector.detect_fvg(candles_15m[-10:])
        active_fvgs = [f for f in fvgs if f.status.name == "ACTIVE" and f.gap_type == direction]

        entry_type = "mean" if has_sweep else "aggressive"
        entry = self.entry_engine.calculate_entry(target_ob, entry_type, direction)

        if has_sweep:
            sl_price = sweeps[-1]["sweep_price"]
            buffer = sl_price * 0.0005
            final_stop_loss = sl_price - buffer if direction == "long" else sl_price + buffer
            final_stop_loss = extend_stop_beyond_zone(
                final_stop_loss, target_ob, direction, buffer_pct=self._EMBED_BUFFER_PCT
            )
            final_stop_loss = apply_min_stop_distance_floor(
                entry["entry_price"], final_stop_loss, direction, min_pct=self._FLOOR_PCT
            )
            sl = {
                "stop_loss": final_stop_loss,
                "sl_distance": abs(entry["entry_price"] - final_stop_loss),
                "method": "sweep_extreme_wide"
            }
        else:
            if not swings_15m:
                return None
            sl_swing = swings_15m[-1]
            sl = self.entry_engine.calculate_stop_loss(entry, target_ob, sl_swing, "structure_swing")
            sl["stop_loss"] = extend_stop_beyond_zone(
                sl["stop_loss"], target_ob, direction, buffer_pct=self._EMBED_BUFFER_PCT
            )
            sl["stop_loss"] = apply_min_stop_distance_floor(
                entry["entry_price"], sl["stop_loss"], direction, min_pct=self._FLOOR_PCT
            )
            sl["sl_distance"] = abs(entry["entry_price"] - sl["stop_loss"])

        targets = self.entry_engine.calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is not None else 3.0)
        risk = self.risk_manager.calculate_position_risk(setup_quality=1.1, base_risk_override=risk_per_trade)
        lots = self.entry_engine.calculate_lot_size(account_balance, risk, sl["sl_distance"])

        return BotSignal(
            bot_id=bot_id or self.bot_id,
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
            reasoning=f"ICT OB Reversal {direction} (A/B, wider-stop). HTF OB active. 15M CHoCH + {'sweep' if has_sweep else 'no sweep'}. "
                     f"FVG confirmation: {len(active_fvgs)} active. SL beyond sweep/swing, embedded OB with a "
                     f"{self._EMBED_BUFFER_PCT:g}x buffer + {self._FLOOR_PCT*100:g}% floor "
                     f"(vs Bot 2's 0.1x/{MIN_STOP_DISTANCE_PCT*100:g}% — the one variable this variant isolates). "
                     f"3R target.",
            timestamp=datetime.utcnow()
        )


# =============================================================================
# BOT ORCHESTRATOR
# =============================================================================

def _signal_risk_is_valid(signal: "BotSignal", account_balance: float) -> tuple[bool, Optional[str]]:
    """Two independent checks every signal from every bot must pass
    before being trusted, regardless of which strategy or symbol
    produced it. Returns (ok, reason) — reason is only meaningful when
    ok is False, for the warning log at the call site.

    1. GEOMETRY — a stop_loss must sit on the PROTECTIVE side of
    entry_price for this signal\'s own direction — a long\'s stop must
    be BELOW entry (it loses money as price falls further), a short\'s
    stop must be ABOVE entry (it loses money as price rises further).
    Anything else isn\'t a real risk-managed trade, whatever produced
    it.

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

    2. SIZING CONSISTENCY — the REAL dollar risk this exact (entry,
    stop_loss, lot_size) implies must roughly match what risk_percent
    says it should be. By direct request, permanent and bot/pair-
    agnostic, after a live report: a JPYUSDT.P trade from
    OrderBlockReversalBot risked $143.33 against a $10 Sub-Auto target
    — 14.33x oversized. Root cause there (now fixed in that bot\'s own
    has_sweep branch) was sl_distance used to SIZE lot_size
    disagreeing with the FINAL entry/stop_loss actually stored on the
    signal — a one-line mismatch that any future strategy, or any
    future pair with an unusual price scale, could reintroduce the
    exact same way. This check doesn\'t care WHERE the mismatch comes
    from; it just recomputes the real implied risk from the signal\'s
    own final numbers and rejects anything far above the stated
    target, the same "reject rather than silently execute" principle
    every other defense-in-depth guard in this codebase already uses.
    A generous 1.5x tolerance, not 1.0x: calculate_lot_size\'s own
    lot-step flooring is designed to land AT OR UNDER the target,
    never over, so a correct signal should already sit at or below
    intended_risk — 1.5x leaves slack for floating-point/step-rounding
    noise without masking a real order-of-magnitude bug like the one
    that triggered this.

    OrderBlockReversalBot (Bot 2) computes entry (from an Order Block)
    and its own sweep-extreme stop_loss the same independent way as
    the geometry bug above — no production trade had hit either issue
    before the two real reports that found them, but nothing ruled
    either out for a future strategy. Checked centrally here, in
    run_all, rather than patched into one bot\'s own analyze() — every
    bot\'s signal is protected by both guards, including any future
    strategy or pair that reproduces either failure mode."""
    geometry_ok = signal.stop_loss < signal.entry_price if signal.direction == "long" else signal.stop_loss > signal.entry_price
    if not geometry_ok:
        return False, "stop_loss is on the wrong side of entry_price for this direction"

    implied_risk = signal.lot_size * abs(signal.entry_price - signal.stop_loss)
    intended_risk = account_balance * (signal.risk_percent / 100)
    if intended_risk > 0 and implied_risk > intended_risk * 1.5:
        return False, f"implied risk ${implied_risk:.2f} is far above the ${intended_risk:.2f} target ({signal.risk_percent}% of ${account_balance}) — sl_distance used for sizing likely doesn't match entry_price/stop_loss"

    # 3. NOTIONAL vs ACCOUNT CAPACITY — dollar risk being correct
    # (check 2, above) does NOT mean the position is affordable: a
    # correct risk_amount divided by a tiny sl_distance still produces
    # a huge lot_size, and lot_size x entry_price (the actual capital
    # needed to open the position) can dwarf anything the account can
    # margin even at full platform leverage.
    #
    # Real, found-via-audit production example: bot_3_fvg_expansion_2
    # on XAUTUSDT.P repeated this same pattern 334 times over 4 days.
    # FVGExpansionBot's stop_loss is set 10% beyond the FVG's own
    # width (see its analyze()) — when a real 1H gap happens to be
    # narrow, that 10% is a tiny dollar distance, so risk_amount /
    # sl_distance inflates lot_size enormously. The dollar risk stays
    # correct (passes check 2), but notional (lot_size x entry_price)
    # came out between $46,812 and $93,383 against a $50,000 cap —
    # correctly rejected by execution_engine's own capital_adequacy
    # gate every single time, but only AFTER a signal was drafted and
    # a scan cycle burned on it, 334 times for one bot/pair alone.
    #
    # This is a cheap, approximate pre-check using the platform's
    # static MAX_NOTIONAL_LEVERAGE default (no DB access here, so no
    # per-bot/Admin-master leverage override — that happens
    # authoritatively, with the real resolved leverage, in
    # capital_adequacy.check_capital_adequacy right before execution).
    # The point isn't to be the final word on affordability; it's to
    # reject a signal that's already off by an order of magnitude
    # before it's drafted at all, for ANY bot/instrument combination,
    # not just this one.
    notional = signal.lot_size * signal.entry_price
    max_notional = account_balance * get_settings().MAX_NOTIONAL_LEVERAGE
    if max_notional > 0 and notional > max_notional:
        return False, (
            f"notional value ${notional:,.2f} (lot_size {signal.lot_size:g} x entry ${signal.entry_price:,.2f}) "
            f"exceeds this account's maximum leverageable notional of ${max_notional:,.2f} "
            f"(${account_balance:,.2f} x {get_settings().MAX_NOTIONAL_LEVERAGE:g}x platform default) — "
            "likely a sl_distance disconnected from the actual position size (e.g. an unusually narrow FVG/zone)"
        )

    return True, None


# Single source of truth for "what bots exist and what candle data
# each one needs" — by direct request, after discovering that
# strategy_adapter.py's OWN hand-maintained copy of this exact mapping
# (STRATEGY_FAMILY, used to backtest a bot) had silently gone stale:
# Bots 8-11 were added to BotOrchestrator below when they were built,
# but nobody updated strategy_adapter.py's separate copy, so every one
# of those 4 bots was quietly unbacktestable ("Unknown strategy_key")
# from the moment it existed until the gap was found while trying to
# run Stage 9's real backtests. Two hand-maintained registries of the
# same fact WILL drift — this is that exact failure, caught once. The
# permanent fix is structural, not another manual addition: there is
# now exactly ONE place a bot is registered (here), both
# BotOrchestrator (below) and strategy_adapter.STRATEGY_FAMILY (which
# now just imports this dict) read from it, and adding bot_12 in the
# future means adding ONE entry here — nowhere else to remember.
#
# Each entry: bot class, ordered [(analyze() kwarg name, timeframe
# label as used in market_scanner.py / Candle fetches, e.g.
# "1D"/"4H"/"1H"/"15M"/"5M")] — verified directly against every
# analyze() signature in this file, not inferred from bot names.
BOT_REGISTRY: Dict[str, tuple] = {
    "bot_1": (MacroSwingStructureBot, [("candles_1d", "1D"), ("candles_4h", "4H")]),
    "bot_2": (OrderBlockReversalBot, [("candles_4h", "4H"), ("candles_1h", "1H"), ("candles_15m", "15M")]),
    "bot_3": (FVGExpansionBot, [("candles_1h", "1H"), ("candles_15m", "15M")]),
    "bot_4": (VolumeLiquidityBot, [("candles_4h", "4H"), ("candles_1h", "1H")]),
    "bot_5": (JeafxSMCBot, [("candles_4h", "4H"), ("candles_1h", "1H"), ("candles_15m", "15M"), ("candles_5m", "5M")]),
    "bot_6": (JeafxSMCv2Bot, [("candles_1h", "1H"), ("candles_15m", "15M"), ("candles_5m", "5M")]),
    "bot_7": (FVGExpansionV3Bot, [("candles_1h", "1H"), ("candles_15m", "15M")]),
    "bot_8": (JeafxSMCv2SingleAnchorBot, [("candles_1h", "1H"), ("candles_15m", "15M"), ("candles_5m", "5M")]),
    "bot_9": (VolumeLiquidityWideRangeBot, [("candles_4h", "4H"), ("candles_1h", "1H")]),
    "bot_10": (VolumeLiquidityHeldReclaimBot, [("candles_4h", "4H"), ("candles_1h", "1H")]),
    "bot_11": (OrderBlockReversalWiderStopBot, [("candles_4h", "4H"), ("candles_1h", "1H"), ("candles_15m", "15M")]),
    "bot_13": (FVGExpansionHTFGatedBot, [("candles_1d", "1D"), ("candles_1h", "1H"), ("candles_15m", "15M")]),
}


class BotOrchestrator:
    """Manages all 12 dispatched bots (7 original + 5 A/B test variants
    with their own strategy class: Bot 8 vs Bot 6, Bot 9 and Bot 10 vs
    Bot 4, Bot 11 vs Bot 2, Bot 13 vs Bot 3) and routes signals to
    execution. Bot roster and candle requirements come from
    BOT_REGISTRY above — the single place a new bot needs to be added.
    Bot 12 is a real, live bot but deliberately NOT in this registry
    — it reuses Bot 2's own strategy class/dispatch entirely (see its
    own seeding comment in seed_ab_test_bots.py), testing a trade-
    management change rather than a signal-generation one, so it needs
    no entry of its own here.

    A DIFFERENT, now-removed "bot_13" (OrderBlockReversalExtremeEntryBot
    — always entering at the order block's own extreme, instead of Bot
    2's mean-if-swept branch) was built and real-backtested against all
    7 of Bot 2's own symbols, then REMOVED after the data refuted the
    hypothesis decisively: worse win rate on every single symbol (e.g.
    26% vs 45% on BTC), pooled average R flipping from +0.08 to -0.12
    across 100+ trades — never registered here, because being in
    BOT_REGISTRY at all makes a strategy live and tradeable by default
    (see run_all's own data-driven dispatch loop below), and a
    confirmed-negative variant has no reason to keep that door open.
    The bot_13 slot was later reused for a genuinely different, real
    finding — FVGExpansionHTFGatedBot's own real 1D HTF-alignment
    gate on Bot 3 — see that class's own docstring for the data behind
    it."""

    def __init__(self, configs: Dict[str, Dict]):
        self.bots = {
            bot_key: bot_cls(configs.get(bot_key, {}))
            for bot_key, (bot_cls, _required_tfs) in BOT_REGISTRY.items()
        }
        self.active_signals: List[BotSignal] = []

    def _collect(self, signals: List[BotSignal], sig: Optional[BotSignal], account_balance: float) -> None:
        """Every signal any bot produces passes through here before
        being trusted — see _signal_risk_is_valid\'s own comment for
        what this actually guards against and why it\'s centralized."""
        if not sig:
            return
        ok, reason = _signal_risk_is_valid(sig, account_balance)
        if not ok:
            logger.warning(
                "bot_signal_invalid_risk_geometry", bot_id=sig.bot_id, symbol=sig.symbol,
                direction=sig.direction, entry_price=sig.entry_price, stop_loss=sig.stop_loss,
                lot_size=sig.lot_size, risk_percent=sig.risk_percent, reason=reason,
            )
            return
        signals.append(sig)

    def run_all(self, market_data: Dict, account_balance: float, bot_settings: Optional[Dict[str, List[Dict]]] = None) -> List[BotSignal]:
        """Run all active bots against current market data.

        bot_settings — {"bot_1": [{"bot_id": ..., "risk_per_trade": ...,
        "min_rr_ratio": ...}, ...], ...}: a LIST per strategy family,
        not a single dict — by direct request ("I don't mind repeating
        the bot strategy ... we should always be able to update or add
        bots to the portal from now for the future"). Each entry is one
        real BotConfig row that runs this family's algorithm; a family
        with no entries (or omitted entirely) runs the original
        self.bots["bot_N"] instance's own hardcoded bot_id exactly once
        — the same shape/behavior every call site before this feature
        relied on (read fresh from each bot's own BotConfig, and any
        Sub-Auto-specific override, by market_scanner.py's scan_once
        every cycle).

        Running the SAME algorithm for N real bots costs N real
        .analyze() calls against the SAME already-fetched market_data —
        cheap (pure computation over already-fetched candles, no extra
        network/exchange calls), and keeps each bot's own entry/SL/TP
        genuinely independent (computed fresh per call, not copied).
        """
        signals = []
        families = bot_settings or {}

        def _entries(bot_key: str) -> List[Dict]:
            # No entry for this family at all -> run the original
            # single hardcoded instance, unchanged from before this
            # feature (bot_id=None keeps each .analyze()'s own
            # self.bot_id default).
            return families.get(bot_key) or [{"bot_id": None, "risk_per_trade": None, "min_rr_ratio": None}]

        def _run_family(bot_key: str, *candle_args: List[Candle]) -> None:
            for entry in _entries(bot_key):
                # Real bug, found live the first time the market
                # scanner ever actually ran in production (confirmed by
                # a "list index out of range" crash in bot_1's own
                # analyze() — see its own fix comment): this call had
                # NO exception isolation at all, so one strategy's edge
                # case (an unlucky swing-structure split, a symbol with
                # too little history, anything) propagated straight up
                # through run_all -> market_scanner.scan_once, aborting
                # that ENTIRE cycle — not just this one bot, but every
                # OTHER bot in this same (exchange, symbol, balance)
                # group, AND every other (exchange, symbol) group still
                # left in that cycle's own loop, silently, with nothing
                # distinguishing "this bot found no setup" from "this
                # bot crashed and took the rest of the portal's
                # scanning down with it" in the logs. Isolated per-bot
                # here so a single strategy's bug degrades to "this one
                # bot skips this one cycle" — exactly what every other
                # failure mode in this codebase already does (a bad
                # candle fetch, a broker error, ...) — instead of a
                # blast radius covering bots that have nothing to do
                # with whatever broke.
                try:
                    sig = self.bots[bot_key].analyze(
                        *candle_args,
                        account_balance, market_data.get("symbol", "UNKNOWN"),
                        risk_per_trade=entry.get("risk_per_trade"), min_rr_ratio=entry.get("min_rr_ratio"),
                        bot_id=entry.get("bot_id"),
                    )
                except Exception as e:
                    logger.error(
                        "bot_analyze_failed", bot_key=bot_key, bot_id=entry.get("bot_id"),
                        symbol=market_data.get("symbol", "UNKNOWN"), error=str(e),
                    )
                    continue
                self._collect(signals, sig, account_balance)

        # Data-driven over BOT_REGISTRY (see its own comment) instead
        # of one hardcoded if-block per bot — this is the actual fix:
        # a bot now only needs to exist in ONE place to be both live-
        # tradeable and backtestable, so this loop can never again
        # silently omit a bot the way the old per-bot blocks did for
        # Bots 8-11 here (they WERE added correctly) vs
        # strategy_adapter.py's separate copy (which wasn't).
        for bot_key, (_bot_cls, required_tfs) in BOT_REGISTRY.items():
            labels = [label for _, label in required_tfs]
            if all(label in market_data for label in labels):
                _run_family(bot_key, *[market_data[label] for label in labels])

        self.active_signals = signals
        return signals
