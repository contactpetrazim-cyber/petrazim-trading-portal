"""
Practice Scenario Set Seed Script — CORE_2 Market Structure Lessons
=======================================================================

Phase 10 of the practice-drill-scenario-sets effort, and the first
non-bot module: starts the priority-2 tier ("Core SMC concept
modules") named explicitly in this effort's scope. Covers C2-02
through C2-09 (C2-01 already has a scenario set from the very first
wave; C2-04 is DELIBERATELY SKIPPED — see below). Unlike the bot
lessons, there is no bot_strategies.py to trace here — every rule
below is taken directly from CORE_2_MARKET_STRUCTURE.md's own Core
Teaching sections (re-read in full immediately before writing this),
which is this module's own authoritative source, the same way
bot_strategies.py is authoritative for the bot lessons.

A real content-accuracy note, found while reading C2-01 for
consistency before writing C2-02 (not fixed here — a pre-existing
file from the very first wave of this effort, out of this session's
scope to rewrite without being asked): C2-01's OWN seeded scenario
set (seed_practice_scenarios.py, kind="swing_sequence", items
classifying 6-point sequences into Uptrend/Downtrend/Neither) does
NOT match C2-01's own curriculum prompt at all — C2-01's real
Practice Drill asks the learner to "mark every confirmed swing high
and swing low" on fifteen raw 1H candles using a K=1 rule, a
candle-marking exercise, not a trend-classification one. The existing
content is a much better fit for THIS lesson, C2-02 ("Higher
Highs/Lows, Lower Highs/Lows: Defining Trend") — which is exactly
what C2-02's own items below build fresh, using different numbers so
there's no duplicate/confusing overlap with the mismatched C2-01 set.
Flagged for the parent session as a content-accuracy finding on the
pre-existing seed, not a bug introduced here.

SKIPPED: C2-04 ("Internal vs. External Structure") asks the learner
to "zoom into" a 15-minute view of a marked 4H leg and locate internal
swing points within it — a real chart-correspondence task that needs
actual chart imagery to be honest; the numeric/textual abstractions
used everywhere else in this session (swing-point price lists, OHLC
candle data) can't faithfully represent "zoom into this specific
region of a real chart" without inventing a chart that doesn't exist.
Skipped rather than faked.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core2
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C2-02 — "Given four sequences of six swing points each (provided in
# Practise), classify each as uptrend, downtrend, or neither, showing
# the specific pairwise comparisons that support your classification."
# swing_sequence kind (reused directly, per this effort's own
# guidance to prefer existing kinds for CORE lessons). Rule (C2-02's
# own Core Teaching): uptrend requires EVERY consecutive high to
# exceed the one before it AND every consecutive low to exceed the
# one before it (HH AND HL, checked pairwise across the whole
# sequence) — the mirror for a downtrend (LH AND LL). Anything else
# (rising highs with falling lows, or falling highs with rising lows)
# is neither a confirmed uptrend nor downtrend.
# ---------------------------------------------------------------------------
C2_02_TITLE = "Higher Highs/Lows, Lower Highs/Lows: Defining Trend"
_C2_02_OPTIONS = ["Uptrend", "Downtrend", "Neither"]
C2_02_ITEMS = [
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 90},
            {"type": "high", "price": 110}, {"type": "low", "price": 95},
            {"type": "high", "price": 120}, {"type": "low", "price": 105},
        ],
        "options": _C2_02_OPTIONS, "correct_index": 0,
        "explanation": "Highs: 100 < 110 < 120 (every pairwise comparison rising). Lows: 90 < 95 < 105 (every pairwise comparison rising too). Both HH and HL hold at every step -- a clean uptrend.",
    },
    {
        "points": [
            {"type": "high", "price": 120}, {"type": "low", "price": 110},
            {"type": "high", "price": 112}, {"type": "low", "price": 95},
            {"type": "high", "price": 108}, {"type": "low", "price": 85},
        ],
        "options": _C2_02_OPTIONS, "correct_index": 1,
        "explanation": "Highs: 120 > 112 > 108 (falling at every step). Lows: 110 > 95 > 85 (falling at every step). Both LH and LL hold throughout -- a downtrend.",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 90},
            {"type": "high", "price": 115}, {"type": "low", "price": 80},
            {"type": "high", "price": 130}, {"type": "low", "price": 70},
        ],
        "options": _C2_02_OPTIONS, "correct_index": 2,
        "explanation": "Highs rise at every step (100<115<130) but lows FALL at every step (90>80>70) at the same time -- rising highs with falling lows is an expanding range, not a trend under this lesson's own definition. Neither.",
    },
    {
        "points": [
            {"type": "high", "price": 110}, {"type": "low", "price": 90},
            {"type": "high", "price": 105}, {"type": "low", "price": 93},
            {"type": "high", "price": 100}, {"type": "low", "price": 96},
        ],
        "options": _C2_02_OPTIONS, "correct_index": 2,
        "explanation": "Highs fall at every step (110>105>100) while lows RISE at every step (90<93<96) -- a contracting range (converging highs and lows), neither a confirmed uptrend nor downtrend.",
    },
]

# ---------------------------------------------------------------------------
# C2-03 — "Given six chart segments (provided in Practise), classify
# each as trend, range, or transition, and for any marked transition,
# state what specific structural confirmation would resolve it into a
# trend or a range." classify kind.
# ---------------------------------------------------------------------------
C2_03_TITLE = "Trend vs. Range vs. Transition"
_C2_03_OPTIONS = ["Trend", "Range", "Transition"]
C2_03_ITEMS = [
    {"prompt": "Four consecutive swings show a clean HH/HL sequence: highs 100, 108, 115; lows 90, 95, 102.", "options": _C2_03_OPTIONS, "correct_index": 0,
     "explanation": "A consistent HH/HL progression at every step is, by C2-02's own definition, a confirmed trend."},
    {"prompt": "Six consecutive swings oscillate between roughly 100-102 (highs) and 90-92 (lows), with no swing meaningfully exceeding the prior range's high or low.", "options": _C2_03_OPTIONS, "correct_index": 1,
     "explanation": "Swing highs and lows staying within a consistent band, with no new extremes, is this lesson's own definition of a range."},
    {"prompt": "A confirmed 4-swing uptrend (highs 100,108,115; lows 90,95,102) breaks below its most recent higher low (102) with a close-confirmed candle. No subsequent swing point has formed yet.", "options": _C2_03_OPTIONS, "correct_index": 2,
     "explanation": "The prior trend's sequence just broke (a CHoCH, per C2-07), but no new trend's own HH/HL or LH/LL sequence has confirmed yet -- this lesson's own definition of transition: genuinely undecided, not yet resolved either way."},
    {"prompt": "Continuing from the transition above: price goes on to form a confirmed lower high AND a confirmed lower low, both close-confirmed.", "options": _C2_03_OPTIONS, "correct_index": 0,
     "explanation": "A fresh LH/LL sequence has now confirmed -- the transition has resolved into a genuine new (down)trend."},
    {"prompt": "Continuing from the same transition instead: price settles into oscillating between two new levels with no further progression in either direction.", "options": _C2_03_OPTIONS, "correct_index": 1,
     "explanation": "No new trend sequence ever confirmed -- the transition resolved into a range instead."},
    {"prompt": "A trend's most recent protected point has not broken at all -- the HH/HL sequence is still extending normally, most recently to a new high of 122.", "options": _C2_03_OPTIONS, "correct_index": 0,
     "explanation": "No break of the protected point has occurred -- this is simply a trend continuing, not a transition."},
]

# ---------------------------------------------------------------------------
# C2-05 — "Given a ten-swing-point sequence (provided in Practise),
# identify the currently protected point at each stage as new swing
# points form, and note the two occasions where the protected point
# changes." Built as a classify-kind sequence of per-stage questions.
# Honest note: this specific ten-point sequence (5 highs, 5 lows, a
# continuous uptrend throughout) produces FOUR changes to the
# protected low (one at each of the 2nd through 5th swing lows), not
# the lesson's own lead-in count of "two" -- every new swing low in a
# continuing uptrend updates the protected low, by C2-05's own rule,
# so a strict 10-point alternating zigzag can't land on exactly two
# without breaking that rule or inventing an unconfirmed point. The
# real, verified mechanic (WHEN and WHY it changes) is what's tested
# here; the exact count is reported accurately rather than forced to
# match the lesson's own descriptive lead-in.
# ---------------------------------------------------------------------------
C2_05_TITLE = "Protected Highs and Lows"
_C2_05_SEQ = [
    ("H0", 1.0800), ("L1", 1.0750), ("H1", 1.0850), ("L2", 1.0800),
    ("H2", 1.0900), ("L3", 1.0850), ("H3", 1.0950), ("L4", 1.0880),
    ("H4", 1.0990), ("L5", 1.0920),
]
C2_05_ITEMS = [
    {
        "prompt": f"Sequence so far (chronological, uptrend throughout): {_C2_05_SEQ[:3]}. What is the current protected low?",
        "options": ["No protected low established yet", "1.0750 (L1)", "1.0800 (H0)"],
        "correct_index": 1,
        "explanation": "L1 (1.0750) is the first confirmed swing low -- it becomes the initial protected low once the uptrend read begins.",
    },
    {
        "prompt": f"Sequence so far: {_C2_05_SEQ[:5]}. What is the current protected low?",
        "options": ["Still 1.0750 (L1)", "1.0800 (L2) -- CHANGE #1", "1.0850 (H1)"],
        "correct_index": 1,
        "explanation": "L2 (1.0800) is a new, higher confirmed swing low -- it supersedes L1 as the protected low. First change.",
    },
    {
        "prompt": f"Sequence so far: {_C2_05_SEQ[:7]}. What is the current protected low?",
        "options": ["Still 1.0800 (L2)", "1.0850 (L3) -- CHANGE #2", "1.0900 (H2)"],
        "correct_index": 1,
        "explanation": "L3 (1.0850) supersedes L2. Second change.",
    },
    {
        "prompt": f"Full sequence: {_C2_05_SEQ}. How many times did the protected low change across all ten points, and what is it now?",
        "options": ["Twice total; currently 1.0880", "Four times total; currently 1.0920 (L5)", "Never changed; still 1.0750"],
        "correct_index": 1,
        "explanation": "Every one of the four later swing lows (L2, L3, L4, L5) is higher than the one before it, so each one updates the protected low in turn -- four real changes across this ten-point sequence, ending at L5 (1.0920), the most recent confirmed swing low.",
    },
]

# ---------------------------------------------------------------------------
# C2-06 — "Given eight chart segments each showing a level break
# (provided in Practise), identify which are valid BOS events
# (close-confirmed, same direction as trend) and which fail one or
# both conditions." classify kind.
# ---------------------------------------------------------------------------
C2_06_TITLE = "BOS: Break of Structure"
_C2_06_OPTIONS = [
    "Valid BOS -- close-confirmed, same direction as trend",
    "Not a BOS -- wick-only (no candle close beyond the level)",
    "Not a BOS -- wrong direction (this would be a CHoCH, not a BOS)",
]
C2_06_ITEMS = [
    {"prompt": "Uptrend, most recent swing high at 1.0950. A candle wicks to 1.0965 but closes back down at 1.0940.", "options": _C2_06_OPTIONS, "correct_index": 1,
     "explanation": "The high exceeds 1.0950, but the CLOSE (1.0940) stays below it -- no candle close beyond the level. Wick-only."},
    {"prompt": "Uptrend, most recent swing high at 1.0950. A candle closes at 1.0975.", "options": _C2_06_OPTIONS, "correct_index": 0,
     "explanation": "Close (1.0975) is beyond the swing high (1.0950), in the same direction as the existing uptrend. Valid BOS -- this lesson's own Worked Example."},
    {"prompt": "Uptrend, protected low at 1.0850. A candle closes at 1.0830.", "options": _C2_06_OPTIONS, "correct_index": 2,
     "explanation": "This breaks the protected point in the OPPOSITE direction from the trend -- by definition, that's a CHoCH (C2-07), not a BOS."},
    {"prompt": "Downtrend, most recent swing low at 1.2600. A candle closes at 1.2580.", "options": _C2_06_OPTIONS, "correct_index": 0,
     "explanation": "Close beyond the swing low, same direction as the downtrend. Valid BOS."},
    {"prompt": "Downtrend, most recent swing low at 1.2600. A candle's low reaches 1.2590 but closes back up at 1.2615.", "options": _C2_06_OPTIONS, "correct_index": 1,
     "explanation": "The low pokes below 1.2600, but the close (1.2615) snaps back above it. Wick-only, not confirmed."},
    {"prompt": "Downtrend, protected high at 1.2700. A candle closes at 1.2720.", "options": _C2_06_OPTIONS, "correct_index": 2,
     "explanation": "Breaking the protected high against the downtrend's own direction is a CHoCH, not a BOS."},
    {"prompt": "Uptrend, most recent swing high at 43500. A candle closes at 43620.", "options": _C2_06_OPTIONS, "correct_index": 0,
     "explanation": "Close beyond the prior swing high, same direction. Valid BOS, same rule at BTC scale."},
    {"prompt": "Uptrend, most recent swing high at 43500. A candle's high reaches 43700 but closes at 43400.", "options": _C2_06_OPTIONS, "correct_index": 1,
     "explanation": "High exceeds the level, but the close falls back below it. Wick-only."},
]

# ---------------------------------------------------------------------------
# C2-07 — "Given eight chart segments (provided in Practise,
# overlapping with C2-06's set), identify which show a valid CHoCH,
# and for each, state whether a subsequent HH/HL or LH/LL sequence
# went on to confirm a full new trend or whether the original trend
# resumed instead." classify kind.
# ---------------------------------------------------------------------------
C2_07_TITLE = "CHoCH: Change of Character"
_C2_07_OPTIONS = [
    "Not a valid CHoCH (wick-only, or same direction as trend -- that would be a BOS)",
    "Valid CHoCH; a subsequent HH/HL or LH/LL sequence confirmed a full NEW trend",
    "Valid CHoCH; the original trend went on to resume instead (a failed CHoCH)",
]
C2_07_ITEMS = [
    {"prompt": "Uptrend, protected low at 1.0850. A candle closes at 1.0830 (opposite direction from the trend). Afterward, a confirmed lower high and lower low both form.", "options": _C2_07_OPTIONS, "correct_index": 1,
     "explanation": "Close beyond the protected point, against the trend -- a valid CHoCH. The subsequent LH/LL sequence confirms a genuine new downtrend."},
    {"prompt": "Uptrend, protected low at 1.0850. A candle's low reaches 1.0840 but closes back up at 1.0870.", "options": _C2_07_OPTIONS, "correct_index": 0,
     "explanation": "The close never actually goes beyond the protected low -- wick-only, not a valid CHoCH at all."},
    {"prompt": "Uptrend, protected low at 1.0850. A candle closes at 1.0830. Price then reverses back up, makes a new higher high above the pre-CHoCH high, and the original uptrend's sequence effectively resumes.", "options": _C2_07_OPTIONS, "correct_index": 2,
     "explanation": "The CHoCH itself was valid (a genuine close beyond the protected low, against the trend) -- but no new LH/LL sequence ever confirmed; the original uptrend resumed instead. A textbook failed CHoCH, exactly this lesson's own point that a CHoCH alone never guarantees a reversal."},
    {"prompt": "Uptrend, most recent swing high at 1.0950 (NOT the protected low). A candle closes at 1.0975 -- same direction as the trend.", "options": _C2_07_OPTIONS, "correct_index": 0,
     "explanation": "This is the SAME direction as the trend -- by definition that's a BOS (C2-06), not a CHoCH."},
    {"prompt": "Downtrend, protected high at 1.2700. A candle closes at 1.2720. A confirmed higher high and higher low both form afterward.", "options": _C2_07_OPTIONS, "correct_index": 1,
     "explanation": "Close beyond the protected high, against the downtrend -- valid CHoCH. The subsequent HH/HL sequence confirms a genuine new uptrend."},
    {"prompt": "Downtrend, protected high at 1.2700. A candle's high reaches 1.2710 but closes at 1.2680.", "options": _C2_07_OPTIONS, "correct_index": 0,
     "explanation": "No close beyond the protected high -- wick-only, not a valid CHoCH."},
    {"prompt": "Downtrend, protected high at 1.2700. A candle closes at 1.2720. Price then reverses back down through the pre-CHoCH low, and the original downtrend's LL sequence resumes.", "options": _C2_07_OPTIONS, "correct_index": 2,
     "explanation": "Valid CHoCH, but no new uptrend sequence ever confirmed -- the original downtrend resumed. A failed CHoCH."},
    {"prompt": "Uptrend, protected low at 43200. A candle closes at 43050 (against the trend). A confirmed lower high and lower low both form afterward.", "options": _C2_07_OPTIONS, "correct_index": 1,
     "explanation": "Valid CHoCH at BTC scale, confirmed into a genuine new downtrend by the subsequent LH/LL sequence."},
]

# ---------------------------------------------------------------------------
# C2-08 — "Given ten level-break examples (provided in Practise),
# classify each as wick-only, body break without displacement, or
# body break with displacement, using close-location value and
# relative candle range as your evidence." classify kind.
# Close-location value (CLV, from C1-03): for a break UP through a
# level, CLV = (close-low)/(high-low), strong when >= 0.7 ("top 30%
# of the candle's range"); for a break DOWN, CLV = (high-close)/
# (high-low), strong when >= 0.7. Displacement (C1-03's own
# platform-detection definition) additionally requires a body size
# meaningfully larger than the recent average range.
# ---------------------------------------------------------------------------
C2_08_TITLE = "Wick vs. Body Break, Displacement, False Break"
_C2_08_OPTIONS = ["Wick-only break", "Body break, no displacement", "Body break WITH displacement"]
C2_08_ITEMS = [
    {"prompt": "Level 1.0950 (breaking up). Candle: open=1.0945, high=1.0965, low=1.0935, close=1.0940. Recent avg range = 0.0025.", "options": _C2_08_OPTIONS, "correct_index": 0,
     "explanation": "High (1.0965) exceeds the level, but close (1.0940) is back BELOW it -- the break never confirmed by the close. Wick-only, this lesson's own Worked Example."},
    {"prompt": "Level 1.0950 (breaking up). Candle: open=1.0955, high=1.0990, low=1.0950, close=1.0990. Recent avg range = 0.0020.", "options": _C2_08_OPTIONS, "correct_index": 2,
     "explanation": "Close (1.0990) is well beyond the level. CLV=(1.0990-1.0950)/(1.0990-1.0950)=1.0 -- at the very top of its range. Range=0.0040, roughly 2x the 0.0020 average. Both displacement conditions (strong CLV + outsized range) hold -- genuine displacement, this lesson's own Worked Example."},
    {"prompt": "Level 1.0950 (breaking up). Candle: open=1.0945, high=1.0965, low=1.0940, close=1.0958. Recent avg range = 0.0024.", "options": _C2_08_OPTIONS, "correct_index": 1,
     "explanation": "Close (1.0958) is beyond the level -- a real body break. CLV=(1.0958-1.0940)/(1.0965-1.0940)=0.72 -- borderline-strong, but the candle's range (0.0025) is roughly in line with the 0.0024 average, not meaningfully larger. Body break, but not displacement."},
    {"prompt": "Level 1.2600 (breaking down). Candle: open=1.2605, high=1.2610, low=1.2560, close=1.2565. Recent avg range = 0.0030.", "options": _C2_08_OPTIONS, "correct_index": 2,
     "explanation": "Close (1.2565) is well beyond the level. CLV=(1.2610-1.2565)/(1.2610-1.2560)=0.90 -- very strong (close near the bottom of its range, consistent with a bearish break). Range=0.0050, well above the 0.0030 average. Genuine displacement."},
    {"prompt": "Level 1.2600 (breaking down). Candle: open=1.2605, low=1.2575, high=1.2615, close=1.2608.", "options": _C2_08_OPTIONS, "correct_index": 0,
     "explanation": "Low (1.2575) breaks below the level, but close (1.2608) is back above it. Wick-only."},
    {"prompt": "Level 1.2600 (breaking down). Candle: open=1.2608, high=1.2612, low=1.2585, close=1.2590. Recent avg range = 0.0028.", "options": _C2_08_OPTIONS, "correct_index": 1,
     "explanation": "Close (1.2590) is beyond the level -- a body break. CLV=(1.2612-1.2590)/(1.2612-1.2585)=0.81 -- strong, but range (0.0027) is close to the 0.0028 average, not meaningfully outsized. Body break without displacement."},
    {"prompt": "Level 43500 (breaking up). Candle: open=43520, high=43650, low=43500, close=43640. Recent avg range = 250.", "options": _C2_08_OPTIONS, "correct_index": 1,
     "explanation": "Close (43640) is well beyond the level -- a real body break. CLV=(43640-43500)/(43650-43500)=0.93 -- very strong. But range=high-low=43650-43500=150, actually BELOW the 250 average -- this candle is not outsized, so despite the strong CLV it fails the range half of the displacement test. Body break, no displacement (a deliberate reminder that CLV alone isn't sufficient)."},
    {"prompt": "Level 43500 (breaking up). Candle: open=43400, high=43900, low=43380, close=43850. Recent avg range = 260.", "options": _C2_08_OPTIONS, "correct_index": 2,
     "explanation": "Close (43850) is well beyond the level. CLV=(43850-43380)/(43900-43380)=0.90. Range=520, exactly 2x the 260 average. Genuine displacement."},
    {"prompt": "Level 0.6500 (breaking down). Candle: open=0.6505, high=0.6512, low=0.6470, close=0.6508.", "options": _C2_08_OPTIONS, "correct_index": 0,
     "explanation": "Low (0.6470) breaks well below the level, but close (0.6508) ends up ABOVE it, back inside the prior range entirely. A textbook false break (wick-only, and a particularly deep one)."},
    {"prompt": "Level 0.6500 (breaking down). Candle: open=0.6502, high=0.6505, low=0.6460, close=0.6465. Recent avg range = 0.0045.", "options": _C2_08_OPTIONS, "correct_index": 1,
     "explanation": "Close (0.6465) well beyond the level -- a real body break. CLV=(0.6505-0.6465)/(0.6505-0.6460)=0.89 -- strong. But range=high-low=0.0045, exactly in line with the 0.0045 average, not meaningfully larger -- the same strict standard as item 7's BTC example. Strong CLV alone, without an outsized range, is a body break without displacement, not with it."},
]

# ---------------------------------------------------------------------------
# C2-09 — "Given five trade setups with stated structural premises
# (provided in Practise), identify the specific invalidation level for
# each based on this module's concepts (protected point, CHoCH), and
# state it as a precise price or condition." classify kind (options
# are the candidate invalidation levels/conditions).
# ---------------------------------------------------------------------------
C2_09_TITLE = "Structural Invalidation"
C2_09_ITEMS = [
    {
        "prompt": "Trade premise: \"Long, because the market is in a confirmed uptrend.\" Current protected low = 1.0850. Current swing high = 1.0950.",
        "options": ["A close below 1.0850 (the protected low)", "A close above 1.0950 (the swing high)", "Any wick below 1.0850"],
        "correct_index": 0,
        "explanation": "For a trend-following read, invalidation is a close-confirmed CHoCH through the current protected point -- 1.0850. A mere wick doesn't invalidate it (C2-08's own wick-vs-close distinction).",
    },
    {
        "prompt": "Trade premise: \"Long, because price is reacting from a 4H demand zone at 1.0800-1.0830.\" (Core 4's zone-based invalidation rule: a close beyond the zone's far boundary.)",
        "options": ["A close below 1.0800 (the zone's far/bottom boundary)", "A close above 1.0830 (the zone's near/top boundary)", "Price merely touching 1.0815 (the zone's midpoint)"],
        "correct_index": 0,
        "explanation": "For a zone-based setup, invalidation is a close beyond the zone's FAR boundary (the side furthest from where price is coming from) -- here, a close below 1.0800 suggests the zone failed to hold rather than merely being tested.",
    },
    {
        "prompt": "Trade premise: \"Short, because the market is in a confirmed downtrend.\" Current protected high = 1.2700.",
        "options": ["A close above 1.2700 (the protected high)", "A close below the most recent swing low", "Any wick above 1.2700"],
        "correct_index": 0,
        "explanation": "Mirror of the long case -- invalidation is a close-confirmed CHoCH through the protected high, 1.2700.",
    },
    {
        "prompt": "Trade premise: \"Short, reacting from a 1H supply zone at 1.2650-1.2680.\"",
        "options": ["A close above 1.2680 (the zone's far/top boundary)", "A close below 1.2650 (the zone's near/bottom boundary)", "Price touching the zone's midpoint"],
        "correct_index": 0,
        "explanation": "For a short from a supply zone, the far boundary (furthest from where price approached) is the top, 1.2680 -- a close above it suggests the zone failed.",
    },
    {
        "prompt": "Trade premise: \"Long, because the market is in a confirmed uptrend AND reacting from a 4H demand zone at 42600-42900.\" Current protected low (trend) = 42500.",
        "options": [
            "Whichever level is reached FIRST: a close below 42600 (zone far boundary) or 42500 (protected low) -- the premise fails the moment either condition is actually met",
            "Only the protected low (42500) matters; the zone is irrelevant once a trend exists",
            "Only the zone's far boundary (42600) matters; the trend read is irrelevant once price is inside a zone",
        ],
        "correct_index": 0,
        "explanation": "This trade's premise rests on BOTH conditions holding (trend intact AND zone holding) -- the honest invalidation level is whichever one actually gets closed through first, since either one failing undermines part of the stated premise. Deciding this in advance, as this lesson's own discipline requires, means naming both levels, not picking just one.",
    },
]


async def seed_core2_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C2_02_TITLE, "swing_sequence", C2_02_ITEMS)
        count += await _upsert(db, C2_03_TITLE, "classify", C2_03_ITEMS)
        count += await _upsert(db, C2_05_TITLE, "classify", C2_05_ITEMS)
        count += await _upsert(db, C2_06_TITLE, "classify", C2_06_ITEMS)
        count += await _upsert(db, C2_07_TITLE, "classify", C2_07_ITEMS)
        count += await _upsert(db, C2_08_TITLE, "classify", C2_08_ITEMS)
        count += await _upsert(db, C2_09_TITLE, "classify", C2_09_ITEMS)
        await db.commit()
        print(f"\n{count} of 7 CORE_2 scenario sets seeded/updated (C2-04 deliberately skipped -- see module docstring).")


if __name__ == "__main__":
    asyncio.run(seed_core2_scenarios())
    sys.exit(0)
