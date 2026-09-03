
"""
Multi-Timeframe Alignment Engine
5-Layer Top-Down Analysis: 1D -> 4H -> 1H -> 15M -> 5M
"""

from typing import Dict, List, Optional, Literal
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

class Timeframe(Enum):
    D1 = "1D"
    H4 = "4H"
    H1 = "1H"
    M15 = "15M"
    M5 = "5M"

class Bias(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    CONFLICTED = "conflicted"

@dataclass
class TimeframeState:
    """State parameters maintained per timeframe"""
    timeframe: Timeframe
    bias: Bias
    trend_direction: str  # uptrend, downtrend, ranging

    # Key levels
    swing_high: Optional[float] = None
    swing_low: Optional[float] = None
    internal_high: Optional[float] = None
    internal_low: Optional[float] = None

    # Active zones
    supply_zones: List[Dict] = field(default_factory=list)
    demand_zones: List[Dict] = field(default_factory=list)

    # Structure events
    last_bos: Optional[Dict] = None
    last_choch: Optional[Dict] = None

    # Liquidity
    buy_side_liquidity: List[float] = field(default_factory=list)
    sell_side_liquidity: List[float] = field(default_factory=list)

    # FVGs
    active_fvgs: List[Dict] = field(default_factory=list)

    timestamp: datetime = field(default_factory=datetime.utcnow)

@dataclass
class AlignmentSignal:
    """Final trading signal after MTF alignment check"""
    symbol: str
    direction: Literal["long", "short"]
    confidence: float  # 0.0 to 1.0

    # Entry details
    entry_price: float
    stop_loss: float
    take_profit: float

    # MTF alignment score
    d1_alignment: bool
    h4_alignment: bool
    h1_alignment: bool
    m15_alignment: bool

    # Context
    entry_trigger: str
    zone_id: Optional[str] = None
    fvg_id: Optional[str] = None
    liquidity_sweep_id: Optional[str] = None

    # Reasoning
    reasoning: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)


class MTFAlignmentEngine:
    """
    5-Layer Multi-Timeframe Engine

    LAYER 1 - 1D (Market Bias):
    - Establishes macro trend using swing structures
    - Identifies major BOS/CHoCH for directional bias
    - Locates major supply/demand zones

    LAYER 2 - 4H (Price Direction):
    - Isolates immediate directional flow
    - Locates primary institutional zones
    - Confirms alignment with 1D bias or identifies divergence

    LAYER 3 - 1H (Opportunity Confirmation):
    - Detects price entering 4H zones
    - Identifies preliminary structural shifts or liquidity sweeps
    - Validates that price action supports the higher timeframe narrative

    LAYER 4 - 15M (Entry Trigger):
    - Operational execution level
    - Detects micro-CHoCH, micro-FVG, micro-OB mitigation
    - Triggers market orders or resting limits

    LAYER 5 - 5M (Precision Refinement):
    - Fine-tunes entry timing
    - Minimizes slippage
    - Confirms micro-structure before execution
    """

    def __init__(self):
        self.states: Dict[Timeframe, TimeframeState] = {}
        self.alignment_matrix = {
            Timeframe.D1: {"weight": 0.35, "required": True},
            Timeframe.H4: {"weight": 0.25, "required": True},
            Timeframe.H1: {"weight": 0.20, "required": False},
            Timeframe.M15: {"weight": 0.15, "required": True},
            Timeframe.M5: {"weight": 0.05, "required": False}
        }

    def update_state(self, timeframe: Timeframe, state: TimeframeState):
        """Update state for a specific timeframe."""
        self.states[timeframe] = state

    def check_alignment(self, 
                       symbol: str,
                       proposed_direction: Literal["long", "short"],
                       entry_tf: Timeframe = Timeframe.M15) -> AlignmentSignal:
        """
        Check if proposed trade aligns across all timeframes.

        Alignment Rules:
        - LONG: D1 bullish or neutral, 4H bullish, 1H not bearish, 15M bullish trigger
        - SHORT: D1 bearish or neutral, 4H bearish, 1H not bullish, 15M bearish trigger

        Scoring:
        - Each aligned timeframe contributes its weight
        - Required timeframes must align or signal is rejected
        - Minimum 60% alignment score for valid signal
        """

        if Timeframe.D1 not in self.states or Timeframe.H4 not in self.states:
            return None

        d1 = self.states[Timeframe.D1]
        h4 = self.states[Timeframe.H4]
        h1 = self.states.get(Timeframe.H1)
        m15 = self.states.get(Timeframe.M15)
        m5 = self.states.get(Timeframe.M5)

        score = 0.0
        reasons = []

        # LAYER 1: 1D Bias Check
        d1_aligned = False
        if proposed_direction == "long":
            d1_aligned = d1.bias in [Bias.BULLISH, Bias.NEUTRAL]
            if d1.bias == Bias.BULLISH:
                reasons.append("1D: Strong bullish bias - aligned with long")
            elif d1.bias == Bias.NEUTRAL:
                reasons.append("1D: Neutral bias - allowing counter-trend long")
        else:
            d1_aligned = d1.bias in [Bias.BEARISH, Bias.NEUTRAL]
            if d1.bias == Bias.BEARISH:
                reasons.append("1D: Strong bearish bias - aligned with short")
            elif d1.bias == Bias.NEUTRAL:
                reasons.append("1D: Neutral bias - allowing counter-trend short")

        if d1_aligned:
            score += self.alignment_matrix[Timeframe.D1]["weight"]

        # LAYER 2: 4H Direction Check
        h4_aligned = False
        if proposed_direction == "long":
            h4_aligned = h4.bias in [Bias.BULLISH, Bias.NEUTRAL]
            if h4.bias == Bias.BULLISH:
                reasons.append("4H: Bullish directional flow - HTF zone support")
        else:
            h4_aligned = h4.bias in [Bias.BEARISH, Bias.NEUTRAL]
            if h4.bias == Bias.BEARISH:
                reasons.append("4H: Bearish directional flow - HTF zone resistance")

        if h4_aligned:
            score += self.alignment_matrix[Timeframe.H4]["weight"]

        # LAYER 3: 1H Confirmation
        h1_aligned = True  # Default if not available
        if h1:
            if proposed_direction == "long":
                h1_aligned = h1.bias != Bias.BEARISH
                if h1.bias == Bias.BULLISH:
                    reasons.append("1H: Bullish confirmation - price entering demand")
            else:
                h1_aligned = h1.bias != Bias.BULLISH
                if h1.bias == Bias.BEARISH:
                    reasons.append("1H: Bearish confirmation - price entering supply")

        if h1_aligned:
            score += self.alignment_matrix[Timeframe.H1]["weight"]

        # LAYER 4: 15M Entry Trigger
        m15_aligned = False
        if m15:
            if proposed_direction == "long":
                m15_aligned = m15.bias == Bias.BULLISH
                if m15_aligned:
                    reasons.append("15M: Micro-CHoCH/FVG confirms long entry")
            else:
                m15_aligned = m15.bias == Bias.BEARISH
                if m15_aligned:
                    reasons.append("15M: Micro-CHoCH/FVG confirms short entry")

        if m15_aligned:
            score += self.alignment_matrix[Timeframe.M15]["weight"]

        # LAYER 5: 5M Precision
        m5_aligned = True
        if m5:
            m5_aligned = m5.bias == d1.bias or m5.bias == Bias.NEUTRAL
            if m5_aligned:
                score += self.alignment_matrix[Timeframe.M5]["weight"]

        # Validation
        required_aligned = all([
            d1_aligned if self.alignment_matrix[Timeframe.D1]["required"] else True,
            h4_aligned if self.alignment_matrix[Timeframe.H4]["required"] else True,
            m15_aligned if self.alignment_matrix[Timeframe.M15]["required"] else True
        ])

        min_score = 0.60

        if not required_aligned or score < min_score:
            return None

        # Build signal
        signal = AlignmentSignal(
            symbol=symbol,
            direction=proposed_direction,
            confidence=round(score, 2),
            entry_price=0.0,  # To be filled by entry engine
            stop_loss=0.0,
            take_profit=0.0,
            d1_alignment=d1_aligned,
            h4_alignment=h4_aligned,
            h1_alignment=h1_aligned if h1 else True,
            m15_alignment=m15_aligned if m15 else False,
            entry_trigger="mtf_aligned",
            reasoning=" | ".join(reasons)
        )

        return signal

    def map_zones_down(self, htf_zones: List[Dict], ltf_candles: List) -> List[Dict]:
        """
        Map higher timeframe zones to lower timeframe for precise entry.
        When 4H zone is identified, mark the corresponding price levels
        on 1H and 15M for monitoring.
        """
        mapped = []
        for zone in htf_zones:
            mapped.append({
                "htf_zone_id": zone.get("id"),
                "htf_timeframe": zone.get("timeframe"),
                "price_top": zone.get("top"),
                "price_bottom": zone.get("bottom"),
                "mean_threshold": zone.get("mean_threshold"),
                "mapped_to": ["1H", "15M", "5M"],
                "status": "monitoring"
            })
        return mapped

    def get_confluence_zones(self) -> List[Dict]:
        """
        Find zones that align across multiple timeframes.
        High-probability setups occur when HTF and LTF zones overlap.
        """
        confluence = []

        d1_zones = self.states.get(Timeframe.D1, TimeframeState(Timeframe.D1, Bias.NEUTRAL, "")).supply_zones + \
                   self.states.get(Timeframe.D1, TimeframeState(Timeframe.D1, Bias.NEUTRAL, "")).demand_zones

        h4_zones = self.states.get(Timeframe.H4, TimeframeState(Timeframe.H4, Bias.NEUTRAL, "")).supply_zones + \
                   self.states.get(Timeframe.H4, TimeframeState(Timeframe.H4, Bias.NEUTRAL, "")).demand_zones

        for d1_zone in d1_zones:
            for h4_zone in h4_zones:
                # Check overlap
                overlap = (
                    d1_zone.get("bottom", 0) <= h4_zone.get("top", 0) and
                    d1_zone.get("top", 0) >= h4_zone.get("bottom", 0)
                )
                if overlap:
                    confluence.append({
                        "type": "htf_confluence",
                        "timeframes": ["1D", "4H"],
                        "price_range": {
                            "top": min(d1_zone.get("top", 0), h4_zone.get("top", 0)),
                            "bottom": max(d1_zone.get("bottom", 0), h4_zone.get("bottom", 0))
                        },
                        "strength": "high"
                    })

        return confluence
