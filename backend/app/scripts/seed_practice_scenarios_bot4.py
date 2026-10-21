"""
Practice Scenario Set Seed Script — Bot 4 Lessons 02-04, 06, 08-10
=====================================================================

Phase 6 of the practice-drill-scenario-sets effort. Seeds 7 of Bot
4's remaining 9 lessons (01 was already seeded). BOT4-05 and BOT4-07
are DELIBERATELY SKIPPED — see "SKIPPED LESSONS" below, a real,
significant finding, not an oversight.

VolumeLiquidityBot.analyze() (bot_strategies.py, ~lines 1283-1575) was
re-read in full immediately before writing this. Its own class
docstring states it was REDESIGNED by direct audit request: the
original 4H-POI / FVG-change-of-delivery / 4H-BOS-agreement checks
(three separate MANDATORY hard gates in an old version) are now a
single SCORED confluence list — poi_4h, volume_divergence,
post_choch_fvg, htf_trend_agreement — of which AT LEAST 2 of 4 must be
true (`confluence_count = sum(...); if confluence_count < 2: return
None`), not all 4 as separate hard gates. The docstring also says the
bot's single-flat-target design was separately fixed to use the same
calculate_targets() 1R/2R/rr-R ladder every other bot uses.

SKIPPED LESSONS (both re-verified, not guessed):

  - BOT4-05 ("Invalidation: The Eleven Conditions That Return No
    Signal") authors its own Practice Drill prompt around "eleven
    scenario summaries ... describing which of the eleven gates pass
    or fail" -- a count and gate STRUCTURE (4H POI as a gate BEFORE
    the pattern search; FVG-after-CHoCH as its own hard gate with
    first-match break; 4H BOS existence+agreement as two more hard
    gates) that belonged to a PRE-redesign version of this bot. The
    real current code has a different, shorter hard-gate list (the
    original range/pattern/CHoCH gates, unchanged) plus ONE combined
    `confluence_count < 2` floor at the end -- not four separate new
    hard gates in the positions this lesson's prose describes. Writing
    scenarios against the real current code would contradict this
    lesson's own displayed teaching text; writing them against the
    lesson's stated "eleven gates" would contradict the real code.
    Needs a full lesson-text rewrite (out of this task's scope) before
    a scenario set can be honestly authored here.
  - BOT4-07 ("Management: Stop, Target, and an Unused Variable")
    describes a single flat target (`tp = range_high - range_size*0.05`
    for a long, no calculate_targets call, no tp2/tp3), a fixed
    confidence of 0.78, a fixed setup_quality of 1.0, and a specific
    `rr` variable that's computed and never used ("confirmed dead
    code"). NONE of this matches the current analyze(): it now calls
    `self.entry_engine.calculate_targets(entry, sl, rr_ratio=rr,
    multi_target=True)` for a full tp1/tp2/tp3 ladder (tp1 fixed 1:1,
    same as every other bot), confidence is
    `round(0.55 + 0.075*confluence_count, 2)` (variable, 0.70-0.85),
    and setup_quality is `min(1.0 + 0.1*confluence_count, 1.5)`
    (variable). There is no unused `rr` variable anywhere in the
    current function — the `rr` it computes (from min_rr_ratio or a
    3.0 default) IS passed into calculate_targets. Same root cause as
    BOT4-05: this lesson predates the redesign. Skipped for the same
    reason.

Both are flagged prominently in this file's own commit message and
the task's final report for the parent session — they need dedicated
lesson-content rewrites, not scenario authoring against content that's
currently wrong either way it's read.

Everything below maps to pipeline steps that are genuinely UNCHANGED
by the redesign (range definition, 15% proximity test, Spring/Upthrust
detection incl. volume_divergence recording, entry price/direction from
the confirmed pattern) or to the real CURRENT confluence-scored
pipeline (used for 08/09/10, described functionally — "at least 2 of
4 confluences", never citing a specific total gate count the way
BOT4-05 does) — nothing here depends on the stale eleven-gate or
single-flat-target claims. Every number cross-checked with a
throwaway Python script implementing the exact real formulas
(including extend_stop_beyond_zone and apply_min_stop_distance_floor,
both genuinely present in the current stop-calculation path), then
re-verified by reading the inserted rows back out of the live backend
container's DB.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bot4
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# BOT4-02 — "Given six sets of six-or-more 4H swing points (provided
# in Practise), correctly calculate range_high, range_low, and
# range_size for each using Bot 4's exact test." Rule: highs = last 3
# swing-HIGH prices (filtered by type FIRST, then sliced [-3:] --
# independent of how many swing LOWS exist, unlike Bot 1's single
# mixed last-4 slice). range_high=max(highs), range_low=min(lows). Max
# /min make chronological order within each 3-set irrelevant.
# ---------------------------------------------------------------------------
BOT4_02_TITLE = "Identification: Defining the 4H Range"
BOT4_02_ITEMS = [
    {"title": "Set 1", "given": "Last 3 swing highs: 1.09000, 1.09200, 1.09100. Last 3 swing lows: 1.08500, 1.08400, 1.08550.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 1.09200, "tolerance": 0.00003},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 1.08400, "tolerance": 0.00003},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 0.00800, "tolerance": 0.00003},
     ], "explanation": "range_high=max(1.09000,1.09200,1.09100)=1.09200. range_low=min(1.08500,1.08400,1.08550)=1.08400. range_size=0.00800."},
    {"title": "Set 2", "given": "Last 3 swing highs: 1.26500, 1.26700, 1.26600. Last 3 swing lows: 1.26000, 1.26100, 1.25900.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 1.26700, "tolerance": 0.00003},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 1.25900, "tolerance": 0.00003},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 0.00800, "tolerance": 0.00003},
     ], "explanation": "range_high=max(...)=1.26700. range_low=min(...)=1.25900. range_size=0.00800."},
    {"title": "Set 3", "given": "Last 3 swing highs: 0.65500, 0.65400, 0.65600. Last 3 swing lows: 0.65000, 0.65100, 0.64950.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 0.65600, "tolerance": 0.00003},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 0.64950, "tolerance": 0.00003},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 0.00650, "tolerance": 0.00003},
     ], "explanation": "range_high=0.65600. range_low=0.64950. range_size=0.00650."},
    {"title": "Set 4", "given": "Last 3 swing highs: 43200, 43500, 43350. Last 3 swing lows: 42800, 42900, 42750.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 43500, "tolerance": 0.5},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 42750, "tolerance": 0.5},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 750, "tolerance": 0.5},
     ], "explanation": "range_high=43500. range_low=42750. range_size=750."},
    {"title": "Set 5", "given": "Last 3 swing highs: 1.09800, 1.09700, 1.09900. Last 3 swing lows: 1.09000, 1.09100, 1.08900.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 1.09900, "tolerance": 0.00003},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 1.08900, "tolerance": 0.00003},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 0.01000, "tolerance": 0.00003},
     ], "explanation": "range_high=1.09900. range_low=1.08900. range_size=0.01000."},
    {"title": "Set 6", "given": "Last 3 swing highs: 151.20, 151.50, 151.35. Last 3 swing lows: 150.80, 150.60, 150.90.",
     "fields": [
         {"label": "range_high", "ask": "range_high", "unit": "", "correct_value": 151.50, "tolerance": 0.01},
         {"label": "range_low", "ask": "range_low", "unit": "", "correct_value": 150.60, "tolerance": 0.01},
         {"label": "range_size", "ask": "range_size", "unit": "", "correct_value": 0.90, "tolerance": 0.01},
     ], "explanation": "range_high=151.50. range_low=150.60. range_size=0.90."},
]

# ---------------------------------------------------------------------------
# BOT4-03 — "Given six range/current-price pairs (provided in
# Practise), calculate whether near_high or near_low is true for each
# using the exact 15% test." near_high = abs(price-range_high)/range_size
# < 0.15 (strict); near_low = abs(price-range_low)/range_size < 0.15.
# Both true is mathematically impossible (the two ratios always sum to
# >= 1 for price inside the range, and at least one exceeds 1 for price
# outside it) -- not offered as an option.
# ---------------------------------------------------------------------------
BOT4_03_TITLE = "Context: The 15% Proximity Test and CHoCH Confirmation"
_B4_PROX_OPTIONS = ["near_high is True", "near_low is True", "Neither -- this gate fails"]
BOT4_03_ITEMS = [
    {"prompt": "Range: 1.08500-1.09600 (size 0.01100). Current price: 1.09450.", "options": _B4_PROX_OPTIONS, "correct_index": 0,
     "explanation": "|1.09450-1.09600|/0.01100 = 0.1364 < 0.15 -> near_high True. |1.09450-1.08500|/0.01100 = 0.8636 -> near_low False."},
    {"prompt": "Range: 1.08500-1.09600 (size 0.01100). Current price: 1.08650.", "options": _B4_PROX_OPTIONS, "correct_index": 1,
     "explanation": "|1.08650-1.08500|/0.01100 = 0.1364 < 0.15 -> near_low True. |1.08650-1.09600|/0.01100 = 0.8636 -> near_high False."},
    {"prompt": "Range: 1.08500-1.09600 (size 0.01100). Current price: 1.09000 (the middle).", "options": _B4_PROX_OPTIONS, "correct_index": 2,
     "explanation": "Both ratios land around 0.45-0.55 -- neither clears the 15% test. This gate fails regardless of anything else."},
    {"prompt": "Range: 1.08500-1.09600 (size 0.01100). Current price: exactly 1.09435 (0.00165 below range_high, exactly 15% of range_size).", "options": _B4_PROX_OPTIONS, "correct_index": 2,
     "explanation": "0.00165/0.01100 = 0.15 exactly. The test is strict `< 0.15`, not `<=` -- exactly 15% does NOT qualify. Neither (and it's far from range_low). A real boundary case."},
    {"prompt": "Range: 1.08500-1.09600 (size 0.01100). Current price: 1.09440 (0.00160 below range_high).", "options": _B4_PROX_OPTIONS, "correct_index": 0,
     "explanation": "0.00160/0.01100 = 0.1455 < 0.15 -> near_high True, just inside the strict boundary."},
    {"prompt": "Range: 42800-43500 (size 700). Current price: 42850.", "options": _B4_PROX_OPTIONS, "correct_index": 1,
     "explanation": "|42850-42800|/700 = 0.0714 < 0.15 -> near_low True."},
]

# ---------------------------------------------------------------------------
# BOT4-04 — "Given eight 1H candle scenarios with price and volume
# data (provided in Practise), determine which set spring, which set
# upthrust, and which set neither." Rule, read per the ACTUAL loop
# (two independent `if`s, not if/elif, over the last 10 1H candles --
# a later qualifying candle OVERWRITES the recorded spring/upthrust,
# and a single huge-range candle can satisfy BOTH conditions at once):
#   spring:    candle.low < range_low AND candle.close > range_low
#   upthrust:  candle.high > range_high AND candle.close < range_high
# Pattern detection does NOT depend on volume at all -- volume_divergence
# is recorded per candidate purely as a later scored-confluence input.
# ---------------------------------------------------------------------------
BOT4_04_TITLE = "Setup: Spring and Upthrust Detection With Volume Divergence"
_B4_PATTERN_OPTIONS = ["Sets spring", "Sets upthrust", "Sets BOTH spring and upthrust", "Neither"]
BOT4_04_ITEMS = [
    {"prompt": "Range: 1.08500-1.09600. Candle: low=1.08300, close=1.08580 (volume near average).", "options": _B4_PATTERN_OPTIONS, "correct_index": 0,
     "explanation": "low(1.08300) < range_low(1.08500) and close(1.08580) > range_low -- sets spring."},
    {"prompt": "Range: 1.08500-1.09600. Candle: high=1.09800, close=1.09450 (volume near average).", "options": _B4_PATTERN_OPTIONS, "correct_index": 1,
     "explanation": "high(1.09800) > range_high(1.09600) and close(1.09450) < range_high -- sets upthrust."},
    {"prompt": "Range: 1.08500-1.09600. Candle: low=1.08300, close=1.08400 (closes back BELOW range_low, not above).", "options": _B4_PATTERN_OPTIONS, "correct_index": 3,
     "explanation": "low < range_low is True, but close(1.08400) > range_low(1.08500) is False -- the close-back-inside half of the condition fails. Neither."},
    {"prompt": "Range: 1.08500-1.09600. Candle: high=1.09800, close=1.09650 (closes back ABOVE range_high, not below).", "options": _B4_PATTERN_OPTIONS, "correct_index": 3,
     "explanation": "high > range_high is True, but close(1.09650) < range_high(1.09600) is False. Neither."},
    {"prompt": "Range: 1.08500-1.09600. Candle: low=1.08600, high=1.09100, close=1.08700 (stays entirely inside the range).", "options": _B4_PATTERN_OPTIONS, "correct_index": 3,
     "explanation": "Neither break condition is even triggered -- low never goes below range_low, high never goes above range_high. Neither."},
    {"prompt": "Range: 1.08500-1.09600. Candle: low=1.08200, close=1.08550, volume well below the 20-candle average (volume_divergence=True).", "options": _B4_PATTERN_OPTIONS, "correct_index": 0,
     "explanation": "Still just a spring by the price test -- volume_divergence=True is recorded alongside it, but doesn't change the pattern classification itself."},
    {"prompt": "Range: 1.08500-1.09600. Candle: high=1.09900, close=1.09300, volume ABOVE the 20-candle average (volume_divergence=False -- the break was confirmed by volume, not diverging from it).", "options": _B4_PATTERN_OPTIONS, "correct_index": 1,
     "explanation": "Still an upthrust by the price test alone -- pattern detection never checks volume at all. volume_divergence=False just means this candidate won't contribute to the later confluence score."},
    {"prompt": "Range: 1.08500-1.09600. One huge candle: low=1.08200 (below range_low), high=1.09900 (above range_high), close=1.09000 (back inside the range).", "options": _B4_PATTERN_OPTIONS, "correct_index": 2,
     "explanation": "Both independent `if` checks are satisfied by the SAME candle (low<range_low AND close>range_low is True; high>range_high AND close<range_high is also True) -- the loop isn't if/elif, so both `spring` and `upthrust` get set. Whichever later pairs with the matching CHoCH direction is the one actually used."},
]

# ---------------------------------------------------------------------------
# BOT4-06 — "Given four confirmed pattern scenarios (provided in
# Practise, mixing Springs and Upthrusts with their candle close
# prices), state the exact entry price and direction for each."
# direction: spring+bullish_choch -> long, entry=spring["close"];
# upthrust+bearish_choch -> short, entry=upthrust["close"]. multi_calc,
# direction encoded 1=long/0=short (same convention as BOT2-04/BOT3-06).
# ---------------------------------------------------------------------------
BOT4_06_TITLE = "Entry: Direction and Price From the Confirmed Pattern"
BOT4_06_ITEMS = [
    {"title": "Scenario A", "given": "Pattern: spring. Candle close = 1.08580. Paired CHoCH: bullish_choch.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 1, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08580, "tolerance": 0.00003},
     ], "explanation": "spring + bullish_choch -> long. entry = spring['close'] = 1.08580."},
    {"title": "Scenario B", "given": "Pattern: upthrust. Candle close = 1.26680. Paired CHoCH: bearish_choch.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 0, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.26680, "tolerance": 0.00003},
     ], "explanation": "upthrust + bearish_choch -> short. entry = upthrust['close'] = 1.26680."},
    {"title": "Scenario C", "given": "Pattern: spring. Candle close = 0.65050. Paired CHoCH: bullish_choch.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 1, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 0.65050, "tolerance": 0.00003},
     ], "explanation": "spring + bullish_choch -> long. entry = 0.65050."},
    {"title": "Scenario D", "given": "Pattern: upthrust. Candle close = 43150.00. Paired CHoCH: bearish_choch.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 0, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 43150.00, "tolerance": 0.5},
     ], "explanation": "upthrust + bearish_choch -> short. entry = 43150.00."},
]

# ---------------------------------------------------------------------------
# BOT4-08 — "Given five losing-trade case studies styled after Bot 4
# (provided in Practise), determine which are valid losses and which
# are bad losses, checking both the volume condition and the
# pattern/CHoCH pairing in each case." Scoped to the real, current,
# UNCHANGED mandatory gates (range validity, proximity, pattern found,
# CHoCH found/temporally-coherent/paired) plus the real, current
# confluence floor (>= 2 of 4 scored confluences) -- described
# functionally, never citing a specific total gate count (see this
# file's module docstring on why BOT4-05's "eleven" framing is skipped).
# ---------------------------------------------------------------------------
BOT4_08_TITLE = "Failure: What a Failed Bot 4 Setup Looks Like"
_B4_LOSS_OPTIONS = [
    "Valid loss -- every real gate genuinely passed, the trade just didn't work out",
    "Bad loss -- a real gate was actually skipped or overridden",
]
BOT4_08_ITEMS = [
    {
        "prompt": "A valid range formed, price was near the low, a Spring was confirmed, and a bullish CHoCH formed AFTER the Spring's own candle (correct pairing and timing). Exactly 2 of the 4 scored confluences (poi_4h, volume_divergence, post_choch_fvg, htf_trend_agreement) were present. The trade was taken and stopped out.",
        "options": _B4_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "Every mandatory gate passed, and the confluence floor (>=2 of 4) was met exactly. A real, correctly-taken setup that lost.",
    },
    {
        "prompt": "A Spring was confirmed and a bullish CHoCH existed on the 1H chart -- but that CHoCH had formed BEFORE the Spring's own candle (left over from an earlier, unrelated move). The trader used it as confirmation anyway. The trade lost.",
        "options": _B4_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "The temporal-coherence fix requires the CHoCH to occur AT OR AFTER the sweep's own candle timestamp -- a pre-sweep CHoCH fails `choch_after_sweep` and real analyze() would return None. Not a genuine Bot 4 signal.",
    },
    {
        "prompt": "A Spring was confirmed, and a CHoCH was detected -- but it was BEARISH, not bullish. The trader called it a long anyway, reasoning \"the Spring itself was a clean, textbook pattern.\" The trade lost.",
        "options": _B4_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "spring requires pairing with bullish_choch specifically -- spring+bearish_choch satisfies neither branch of the pairing check, and real analyze() returns None. The pattern alone was never sufficient.",
    },
    {
        "prompt": "A valid range formed, price was near the high, an Upthrust was confirmed, a bearish CHoCH formed after it (correct pairing and timing), and 3 of the 4 scored confluences were present. The trade was taken and stopped out.",
        "options": _B4_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "All mandatory gates passed, well above the 2-of-4 confluence floor. A valid loss.",
    },
    {
        "prompt": "A Spring was confirmed and correctly paired with a bullish CHoCH at the right time -- but only 1 of the 4 scored confluences (poi_4h, volume_divergence, post_choch_fvg, htf_trend_agreement) was actually present. The trader entered anyway, reasoning \"the core pattern and CHoCH are the real signal.\" The trade lost.",
        "options": _B4_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "`confluence_count < 2` fails real analyze() outright, even with a textbook Spring+CHoCH pairing -- this is a genuine, current hard gate (not a soft/advisory check), added specifically because the pattern+CHoCH pair alone was found to be insufficient on its own.",
    },
]

# ---------------------------------------------------------------------------
# BOT4-09 — "Given a full chart scenario (provided in Practise) with
# 4H and 1H data including volume, work through the complete pipeline
# to produce the exact entry, stop, and target Bot 4's code would
# output." One multi_calc item, chaining the real current pipeline
# (range -> proximity -> Spring -> CHoCH pairing -> confluence score
# -> stop with zone-embed+floor -> ladder targets), verified with a
# throwaway Python script implementing the exact formulas.
# ---------------------------------------------------------------------------
BOT4_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT4_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "4H range: low = 1.08500, high = 1.09600 (size 0.01100).\n"
        "Current 1H close = 1.08550 (near_low -- within 15% of range_low).\n"
        "1H Spring confirmed: extreme (low) = 1.08480, close = 1.08550.\n"
        "A bullish 1H CHoCH forms after the Spring's own candle (correct pairing and timing).\n"
        "A real ACTIVE 4H order block sits at 1.08300-1.08700, containing the range-low POI price (1.08500).\n"
        "Scored confluences present: poi_4h=True, volume_divergence=True, post_choch_fvg=True, "
        "htf_trend_agreement=True (4 of 4)."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08550, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08260, "tolerance": 0.0001},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08840, "tolerance": 0.0001},
        {"label": "confidence", "ask": "Reported confidence", "unit": "", "correct_value": 0.85, "tolerance": 0.01},
    ],
    "explanation": (
        "entry = spring['close'] = 1.08550. Raw sl = spring['extreme'] - range_size*0.02 = "
        "1.08480 - 0.01100*0.02 = 1.08480-0.00022 = 1.08458. The range-low POI (1.08500) sits inside the "
        "4H order block (1.08300-1.08700), so extend_stop_beyond_zone applies: zone_bound = "
        "1.08300 - 0.1*(1.08700-1.08300) = 1.08260; min(1.08458, 1.08260) = 1.08260 -- widened. "
        "apply_min_stop_distance_floor (entry*0.0015=0.00163) is already cleared by the 0.00290 distance. "
        "sl_distance = 1.08550-1.08260 = 0.00290. tp1 = entry+sl_distance*1.0 = 1.08840 -- fixed 1:1, the "
        "same ladder every bot uses, NOT a single flat target (that description is stale -- see BOT4-07's "
        "skip note). confluence_count=4 -> confidence = round(0.55+0.075*4, 2) = 0.85."
    ),
}]

# ---------------------------------------------------------------------------
# BOT4-10 — "Given three raw multi-timeframe scenarios with volume
# data (provided in Practise, at least one producing None), work the
# complete Bot 4 pipeline for each." classify kind. Scenario 1 reuses
# BOT4-09's exact verified numbers; Scenario 2 is the required None
# case (the real, current confluence floor, count=1); Scenario 3 is a
# fresh, independently-verified short (Upthrust) case with exactly 2
# of 4 confluences (the floor's own boundary).
# ---------------------------------------------------------------------------
BOT4_10_TITLE = "Capstone: Full Bot 4 Decision Simulation"
BOT4_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1 (long): range 1.08500-1.09600 (size 0.01100); price near the low. Spring confirmed "
            "(extreme=1.08480, close=1.08550); bullish CHoCH forms after it. A real ACTIVE 4H order block "
            "(1.08300-1.08700) contains the range-low POI. All 4 scored confluences are present. What does "
            "analyze() output?"
        ),
        "options": [
            "Long signal -- entry 1.08550, stop 1.08260, tp1 1.08840, confidence 0.85 (tp1 fixed at 1:1 R)",
            "Long signal -- a single flat target at range_high minus a 5% buffer, no tp2/tp3, confidence 0.78",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Every real gate passes, 4/4 confluences clears the >=2 floor comfortably. The current code uses the full tp1/tp2/tp3 ladder (tp1 fixed 1:1) and a confluence-based confidence -- option 2 describes the bot's OLD, now-fixed behavior.",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): range 1.08500-1.09600; price near the low. Spring confirmed "
            "and correctly paired with a bullish CHoCH at the right time. But only 1 of the 4 scored "
            "confluences (poi_4h, volume_divergence, post_choch_fvg, htf_trend_agreement) is actually present. "
            "What does analyze() output?"
        ),
        "options": [
            "Long signal, using whichever single confluence was present to size confidence",
            "Long signal, with confidence floored to its minimum value",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "`confluence_count < 2` fires -- 1 confluence doesn't clear the real, current floor, even with a textbook Spring+CHoCH pairing otherwise intact. None.",
    },
    {
        "prompt": (
            "Scenario 3 (short): range 1.26000-1.26700 (size 0.00700); price near the high (current 1H close "
            "1.26680). Upthrust confirmed (extreme=1.26800, close=1.26680); bearish CHoCH forms after it. A "
            "real ACTIVE 4H order block (1.26600-1.27000) contains the range-high POI. Exactly 2 of the 4 "
            "scored confluences are present (poi_4h=True, htf_trend_agreement=True; the other two are False). "
            "What does analyze() output?"
        ),
        "options": [
            "Short signal -- entry 1.26680, stop 1.27040, tp1 1.26320, confidence 0.70",
            "Short signal -- entry 1.26680, stop 1.26814 (the raw, un-widened 2%-buffer stop), tp1 1.26546",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "2 of 4 confluences exactly clears the floor (>=2) -- a signal is produced, with the lower-end confidence 0.55+0.075*2=0.70. entry=upthrust['close']=1.26680. Raw sl=1.26800+0.00700*0.02=1.26814, but the range-high POI (1.26700) sits inside the 4H order block (1.26600-1.27000), so extend_stop_beyond_zone widens it: zone_bound=1.27000+0.1*(1.27000-1.26600)=1.27040; max(1.26814,1.27040)=1.27040. sl_distance=1.27040-1.26680=0.00360. tp1=1.26680-0.00360=1.26320. Option 2 skips the zone-embedding step.",
    },
]


async def seed_bot4_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT4_02_TITLE, "multi_calc", BOT4_02_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_03_TITLE, "classify", BOT4_03_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_04_TITLE, "classify", BOT4_04_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_06_TITLE, "multi_calc", BOT4_06_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_08_TITLE, "classify", BOT4_08_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_09_TITLE, "multi_calc", BOT4_09_ITEMS, bot_id="bot_4")
        count += await _upsert(db, BOT4_10_TITLE, "classify", BOT4_10_ITEMS, bot_id="bot_4")
        await db.commit()
        print(f"\n{count} of 7 Bot 4 scenario sets seeded/updated (BOT4-05, BOT4-07 deliberately skipped -- see module docstring).")


if __name__ == "__main__":
    asyncio.run(seed_bot4_scenarios())
    sys.exit(0)
