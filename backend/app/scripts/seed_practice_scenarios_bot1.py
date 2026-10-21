"""
Practice Scenario Set Seed Script — Bot 1 Lessons 02 through 10
===================================================================

Phase 3 of the practice-drill-scenario-sets effort: completes Bot 1's
full BOT1-01..10 track (BOT1-01 was seeded in seed_practice_scenarios.py;
the other 7 bots' own -01 "Concept" lessons were seeded in
seed_practice_scenarios_bots.py). This file seeds BOT1-02 through
BOT1-10 — every remaining Practice Drill in BOT_1_MACRO_SWING_STRUCTURE.md.

Every number below is hand-derived from MacroSwingStructureBot.analyze()
itself (bot_strategies.py, ~lines 248-421) and the real helper functions
it calls (smc_algorithms.py: EntryExitEngine.calculate_entry/
calculate_stop_loss/calculate_targets, extend_stop_beyond_zone,
ZoneDetector.classify_premium_discount, MIN_STOP_DISTANCE_PCT from
app/config.py) — re-read in full immediately before writing this, with
every hand-computed value independently cross-checked by running the
exact same formulas in a throwaway Python script (not from memory, not
"plausible-sounding"). Key facts this file's content depends on,
verified directly against current source:

  - MIN_STOP_DISTANCE_PCT = 0.0015 (app/config.py line 232).
  - calculate_entry("mean", ...) = round(zone.mean_threshold, 5), and
    zone.mean_threshold = (zone.top + zone.bottom) / 2 exactly
    (smc_algorithms.py line 411).
  - calculate_stop_loss(method="structure_swing"): buffer =
    max(structure_swing.price * 0.001, entry_price * MIN_STOP_DISTANCE_PCT);
    sl = structure_swing.price -+ buffer; then floored to
    entry_price -+ (entry_price * MIN_STOP_DISTANCE_PCT) if the raw
    distance undercuts that floor; result rounded to 5 decimals.
  - analyze() Step 5 then OVERWRITES that stop with
    extend_stop_beyond_zone(sl, entry_zone, direction) — min() for a
    long, max() for a short, against the zone's own far edge + 10% of
    zone height — so the final reported stop can be wider than the
    swing-based one alone, never tighter.
  - calculate_targets(): tp1 = entry +- sl_distance * 1.0 ALWAYS (fixed
    1:1), regardless of the bot's own default_rr=5.0 or the class
    docstring's "Target 3:1 minimum, often 5:1+" — tp3 is the one that
    actually uses rr_ratio. take_profit on the produced BotSignal is
    tp1, not tp3. This is the single most-tested fact across this
    file's lessons (BOT1-07's own prompt names it explicitly).
  - classify_premium_discount(): fib_level =
    (zone_center - swing_low) / (swing_high - swing_low); <0.45 =
    discount, >0.55 = premium, else equilibrium. A long signal is
    killed only by premium; a short only by discount (equilibrium
    passes for either direction).
  - The five real no-signal gates, in the order analyze() checks them
    (per BOT1-05's own corrected, re-verified count): (1) fewer than 4
    total 1D swings, (2) the last four 1D swings' highs/lows don't
    agree on one trend direction, (3) no 4H BOS at all, or the one
    found doesn't match the 1D trend's direction, (4) no ACTIVE,
    direction-matching 4H order block exists, (5) the most recent such
    block sits on the wrong side of the 4H range (premium for a long,
    discount for a short).

Run after seed_practice_scenarios.py / seed_practice_scenarios_bots.py
(shares their _upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bot1
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# BOT1-02 — "Given six different 1D swing sequences (provided in
# Practise), apply the exact highs[-1]>highs[-2] and lows[-1]>lows[-2]
# test to determine which show a valid bullish trend, valid bearish
# trend, or no valid trend." Reuses the swing_sequence kind already
# built for C2-01 — same shape (points + 3-way classification), just
# testing MacroSwingStructureBot's OWN specific rule (the last FOUR 1D
# swings only, split by type) rather than C2-01's general HH/HL
# definition. Each item's points are exactly what
# `sorted(swings_1d, key=timestamp)[-4:]` would contain.
# ---------------------------------------------------------------------------
BOT1_02_TITLE = "Identification: Reading the 1D Trend Bot 1 Requires"
BOT1_02_OPTIONS = ["Valid bullish trend", "Valid bearish trend", "No valid trend"]
BOT1_02_ITEMS = [
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 95},
            {"type": "high", "price": 108}, {"type": "low", "price": 101},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 0,
        "explanation": "highs=[100,108]: 108>100. lows=[95,101]: 101>95. Both true -> bullish_trend.",
    },
    {
        "points": [
            {"type": "high", "price": 120}, {"type": "low", "price": 110},
            {"type": "high", "price": 112}, {"type": "low", "price": 100},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 1,
        "explanation": "highs=[120,112]: 112<120. lows=[110,100]: 100<110. Both true -> bearish_trend.",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "high", "price": 110},
            {"type": "low", "price": 90}, {"type": "low", "price": 80},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 2,
        "explanation": "highs=[100,110]: 110>100 (rising). lows=[90,80]: 80<90 (falling). bullish_trend needs BOTH > true (lows fail); bearish_trend needs BOTH < true (highs fail). Neither -> no valid trend.",
    },
    {
        "points": [
            {"type": "high", "price": 110}, {"type": "low", "price": 90},
            {"type": "high", "price": 100}, {"type": "low", "price": 95},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 2,
        "explanation": "highs=[110,100]: 100<110 (falling, so highs[-1]>highs[-2] is False). lows=[90,95]: 95>90 (rising, so lows[-1]<lows[-2] is False). Neither bullish_trend nor bearish_trend's AND condition holds -> no valid trend (a contracting/converging range).",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "high", "price": 105},
            {"type": "high", "price": 110}, {"type": "low", "price": 90},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 2,
        "explanation": "3 highs + only 1 low among the last four swings. `len(lows) < 2` is True, so analyze() returns None immediately -- it never even reaches the highs[-1]/highs[-2] comparison. No valid trend (and no signal at all), by the same len<2 guard BOT1-05 names as gate 2.",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 95},
            {"type": "low", "price": 90}, {"type": "low", "price": 85},
        ],
        "options": BOT1_02_OPTIONS, "correct_index": 2,
        "explanation": "1 high + 3 lows among the last four swings. `len(highs) < 2` is True -> analyze() returns None before any highs/lows comparison. No valid trend.",
    },
]

# ---------------------------------------------------------------------------
# BOT1-03 — "Given five 1D-trend + 4H-structural-event pairs (provided
# in Practise), determine which pairs pass Bot 1's alignment test and
# which return None, including at least one CHoCH case." Uses the new
# classify kind (no code snippets needed — plain scenario text). The
# "CHoCH case" is deliberately framed around the real fact that
# MacroSwingStructureBot.analyze() calls detect_bos() ONLY — it never
# calls detect_choch() at all, and detect_bos() itself can only ever
# return "bullish_bos"/"bearish_bos" (smc_algorithms.py lines 241-261),
# never a CHoCH type. So a 4H chart whose only real structural event is
# a CHoCH simply produces an EMPTY bos_4h list, hitting `if not bos_4h:
# return None` before any direction comparison even happens.
# ---------------------------------------------------------------------------
BOT1_03_TITLE = "Context: Why 4H BOS (Not CHoCH) Confirms the Signal"
_PASS_FAIL_OPTIONS = ["Passes alignment -- analyze() continues", "Returns None"]
BOT1_03_ITEMS = [
    {
        "prompt": "1D trend: bullish. 4H structural event: a bullish BOS prints at 1.09500, the most recent 4H BOS. Pass or None?",
        "options": _PASS_FAIL_OPTIONS, "correct_index": 0,
        "explanation": "bullish_trend is True and last_bos['type'] == 'bullish_bos' -- direction matches. Passes gate 3, analyze() continues to zone selection.",
    },
    {
        "prompt": "1D trend: bullish. 4H structural event: the only BOS events on the 4H chart are bearish_bos (price has been breaking down on 4H even though 1D still shows higher highs/higher lows). Pass or None?",
        "options": _PASS_FAIL_OPTIONS, "correct_index": 1,
        "explanation": "last_bos['type'] == 'bearish_bos' != 'bullish_bos' -- `if bullish_trend and last_bos[\"type\"] != \"bullish_bos\": return None` fires. Returns None.",
    },
    {
        "prompt": "1D trend: bearish. 4H structural event: a bearish BOS prints at 1.08200, the most recent 4H BOS. Pass or None?",
        "options": _PASS_FAIL_OPTIONS, "correct_index": 0,
        "explanation": "bearish_trend is True and last_bos['type'] == 'bearish_bos' -- direction matches. Passes gate 3.",
    },
    {
        "prompt": "1D trend: bullish. 4H structural event: price took out the most recent 4H INTERNAL low on a down move against the prevailing 4H range (a textbook bearish CHoCH by definition) -- but no candle's body close ever exceeded a SWING high or closed below a SWING low, so detect_bos() finds nothing. Pass or None?",
        "options": _PASS_FAIL_OPTIONS, "correct_index": 1,
        "explanation": "MacroSwingStructureBot.analyze() never calls detect_choch() at all -- it only ever calls detect_bos(), and a CHoCH-shaped move with no qualifying BOS produces an EMPTY bos_4h list. `if not bos_4h: return None` fires before any direction comparison. The CHoCH itself is simply invisible to this bot's logic.",
    },
    {
        "prompt": "1D trend: bearish. 4H structural event: a bullish BOS prints as the most recent 4H BOS (4H just broke UP against the 1D downtrend). Pass or None?",
        "options": _PASS_FAIL_OPTIONS, "correct_index": 1,
        "explanation": "last_bos['type'] == 'bullish_bos' != 'bearish_bos' -- `if bearish_trend and last_bos[\"type\"] != \"bearish_bos\": return None` fires. Returns None.",
    },
]

# ---------------------------------------------------------------------------
# BOT1-04 — "Given a 4H chart with six order blocks in varying states
# (provided in Practise), correctly filter to eligible zones and
# identify which one Bot 1's logic would select." One item, using the
# classify kind's optional `snippets` field to show the 6-OB table
# (reused here as a plain-text data table, not program code -- the
# renderer just needs a monospace block). Built to demonstrate a real,
# easy-to-miss consequence of the actual code: `entry_zone =
# valid_zones[-1]` picks the MOST RECENT eligible zone with no
# fallback -- if that specific zone fails the later discount/premium
# check, the whole signal is killed even when an EARLIER eligible zone
# would have passed it.
# ---------------------------------------------------------------------------
BOT1_04_TITLE = "Setup: Finding the 4H Entry Zone"
BOT1_04_OB_TABLE = (
    "1D/4H trend direction: BULLISH.  4H swing range for discount/premium: low=1.08100, high=1.09300\n\n"
    "OB #  id          status      center    fib_level   classification\n"
    "1     bull_ob_1   ACTIVE      1.08750   0.25        discount\n"
    "2     bear_ob_1   ACTIVE      1.08820   0.60        premium\n"
    "3     bull_ob_2   MITIGATED   1.08790   0.45        equilibrium\n"
    "4     bear_ob_2   ACTIVE      1.08860   0.80        premium\n"
    "5     bull_ob_3   ACTIVE      1.08780   0.40        discount\n"
    "6     bull_ob_4   ACTIVE      1.08880   0.90        premium\n"
    "(OB #1 is the oldest, OB #6 the most recent, in the order detect_order_blocks() returned them.)"
)
BOT1_04_ITEMS = [{
    "prompt": "Which order block does MacroSwingStructureBot.analyze() actually select and trade here (bullish trend)?",
    "snippets": [{"label": "4H Order Blocks", "code": BOT1_04_OB_TABLE}],
    "options": [
        "OB #1 (bull_ob_1, discount)", "OB #5 (bull_ob_3, discount)",
        "OB #6 (bull_ob_4, premium)", "No signal -- analyze() returns None",
    ],
    "correct_index": 3,
    "explanation": (
        "Filter 1 (status==ACTIVE) + filter 2 (\"bull\" in id, since trend is bullish) leaves valid_zones = "
        "[OB#1, OB#5, OB#6] in that chronological order (OB#2/#4 are bear-type; OB#3 is MITIGATED). "
        "entry_zone = valid_zones[-1] picks OB#6 purely by recency -- it never looks back at OB#1 or OB#5. "
        "OB#6 is in PREMIUM territory, and `if direction == \"long\" and entry_zone.classification == "
        "\"premium\": return None` fires. The signal is killed entirely, even though OB#1 and OB#5 were both "
        "perfectly valid, non-premium bull zones -- Bot 1's real logic has no fallback to an earlier zone."
    ),
}]

# ---------------------------------------------------------------------------
# BOT1-05 — "Given eight scenario summaries (provided in Practise),
# each describing which of the five gates pass or fail, determine at
# which gate (if any) analyze() would return None." Directly implements
# this lesson's own corrected 5-gate list (see its Plain-English
# explanation, re-quoted in this file's module docstring above).
# ---------------------------------------------------------------------------
BOT1_05_TITLE = "Invalidation: The Five Conditions That Return No Signal"
_GATE_OPTIONS = [
    "Gate 1 (fewer than 4 total 1D swings)",
    "Gate 2 (1D highs/lows don't agree on one trend)",
    "Gate 3 (no 4H BOS, or wrong direction)",
    "Gate 4 (no ACTIVE direction-matching 4H zone)",
    "Gate 5 (zone on the wrong side of the 4H range)",
    "Passes all five -- produces a signal",
]
BOT1_05_ITEMS = [
    {"prompt": "A chart has only 3 total 1D swing points.", "options": _GATE_OPTIONS, "correct_index": 0,
     "explanation": "len(swings_1d) < 4 fires immediately. Gate 1."},
    {"prompt": "5 total 1D swings, but the last four are 3 swing highs and only 1 swing low.", "options": _GATE_OPTIONS, "correct_index": 1,
     "explanation": "len(lows) < 2 among the last four swings fires before any trend comparison. Gate 2."},
    {"prompt": "The last four 1D swings have rising swing highs but falling swing lows (an expanding range).", "options": _GATE_OPTIONS, "correct_index": 1,
     "explanation": "Neither bullish_trend (needs both rising) nor bearish_trend (needs both falling) is satisfied. Gate 2."},
    {"prompt": "A clean, confirmed 1D bullish trend, but the 4H chart has no BOS events at all in the lookback window.", "options": _GATE_OPTIONS, "correct_index": 2,
     "explanation": "`if not bos_4h: return None` fires -- Gate 3."},
    {"prompt": "A clean, confirmed 1D bullish trend, and the 4H chart's most recent BOS is a bearish_bos (wrong direction).", "options": _GATE_OPTIONS, "correct_index": 2,
     "explanation": "last_bos['type'] != 'bullish_bos' while bullish_trend is True. Gate 3."},
    {"prompt": "1D bullish trend confirmed, matching bullish 4H BOS confirmed -- but every 4H order block is either MITIGATED or bearish-type; no ACTIVE bullish block exists at all.", "options": _GATE_OPTIONS, "correct_index": 3,
     "explanation": "valid_zones ends up empty after the status+type filter. `if not valid_zones: return None` fires. Gate 4."},
    {"prompt": "1D bullish trend confirmed, matching bullish 4H BOS confirmed, an ACTIVE bullish 4H order block exists and is the most recent one -- but it sits in the PREMIUM half of the 4H range.", "options": _GATE_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Worked Example. valid_zones is non-empty and entry_zone is selected, but classification == 'premium' for a long -- Gate 5 fires even though gates 1-4 all passed."},
    {"prompt": "1D bullish trend confirmed, matching bullish 4H BOS confirmed, an ACTIVE bullish 4H order block exists, is the most recent one, and sits in the DISCOUNT half of the 4H range.", "options": _GATE_OPTIONS, "correct_index": 5,
     "explanation": "All five gates pass -- analyze() proceeds to calculate entry, stop, targets, and lot size, and returns a real BotSignal."},
]

# ---------------------------------------------------------------------------
# BOT1-06 — "Given four zone price ranges (provided in Practise),
# calculate the exact mean entry price Bot 1 would use for each." Uses
# the new multi_calc kind with exactly one field per item (a single
# linked value, same idea as numeric_calc but without that kind's
# ORIENT-02-specific "Trades:" label baked into the renderer). Formula:
# calculate_entry("mean", ...) = round((zone.top + zone.bottom) / 2, 5).
# ---------------------------------------------------------------------------
BOT1_06_TITLE = "Entry: Exact Entry Price Mechanics"
BOT1_06_ITEMS = [
    {"title": "Zone A", "given": "4H order block: bottom = 1.08900, top = 1.09320.",
     "fields": [{"label": "entry", "ask": "Mean entry price", "unit": "", "correct_value": 1.09110, "tolerance": 0.00005}],
     "explanation": "entry = (1.08900 + 1.09320) / 2 = 1.09110."},
    {"title": "Zone B", "given": "4H order block: bottom = 1.25800, top = 1.26500.",
     "fields": [{"label": "entry", "ask": "Mean entry price", "unit": "", "correct_value": 1.26150, "tolerance": 0.00005}],
     "explanation": "entry = (1.25800 + 1.26500) / 2 = 1.26150."},
    {"title": "Zone C", "given": "4H order block: bottom = 0.65200, top = 0.65480.",
     "fields": [{"label": "entry", "ask": "Mean entry price", "unit": "", "correct_value": 0.65340, "tolerance": 0.00005}],
     "explanation": "entry = (0.65200 + 0.65480) / 2 = 0.65340."},
    {"title": "Zone D", "given": "4H order block: bottom = 150.820, top = 151.350.",
     "fields": [{"label": "entry", "ask": "Mean entry price", "unit": "", "correct_value": 151.085, "tolerance": 0.0005}],
     "explanation": "entry = (150.820 + 151.350) / 2 = 151.085."},
]

# ---------------------------------------------------------------------------
# BOT1-07 — "Given three complete entry/1D-swing pairs (provided in
# Practise), calculate the exact stop price and the actual reported
# tp1 target (fixed 1:1) for each, following Bot 1's real rules -- not
# the docstring's 5:1 figure." multi_calc, 2 linked fields per item.
# Item 2 is deliberately built so the swing-based stop lands INSIDE the
# 4H zone, so extend_stop_beyond_zone's own widening actually fires --
# the real "SL embeds the order block" mechanic BOT1-04/BOT1-05 both
# name, not just the swing-based formula alone.
# ---------------------------------------------------------------------------
BOT1_07_TITLE = "Management: Stop Placement, Targets, and Position Size"
BOT1_07_ITEMS = [
    {
        "title": "Trade 1 (long)",
        "given": "Entry (4H zone mean) = 1.08500. Most recent 1D swing low = 1.08200. 4H order block: bottom = 1.08350, top = 1.08550.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08037, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08963, "tolerance": 0.00003},
        ],
        "explanation": (
            "buffer = max(1.08200*0.001, 1.08500*0.0015) = max(0.00108, 0.00163) = 0.00163. "
            "raw sl = 1.08200 - 0.00163 = 1.08037 (already exceeds the 0.00163 floor, no further flooring). "
            "extend_stop_beyond_zone: zone_bound = 1.08350 - 0.1*(1.08550-1.08350) = 1.08330; "
            "min(1.08037, 1.08330) = 1.08037 -- the swing-based stop was already wider, no change. "
            "sl_distance = 1.08500 - 1.08037 = 0.00463. tp1 = entry + sl_distance*1.0 = 1.08963 (fixed 1:1, "
            "NOT the docstring's 5:1 -- that ratio only governs tp3)."
        ),
    },
    {
        "title": "Trade 2 (short, zone-embedding widens the stop)",
        "given": "Entry (4H zone mean) = 1.26500. Most recent 1D swing high = 1.26550. 4H order block: bottom = 1.26600, top = 1.27000.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.27040, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.25960, "tolerance": 0.00003},
        ],
        "explanation": (
            "buffer = max(1.26550*0.001, 1.26500*0.0015) = max(0.0012655, 0.0018975) = 0.0018975. "
            "raw sl = 1.26550 + 0.0018975 = 1.26740 (rounded). extend_stop_beyond_zone: zone_bound = "
            "1.27000 + 0.1*(1.27000-1.26600) = 1.27040; max(1.26740, 1.27040) = 1.27040 -- the zone embedding "
            "genuinely WIDENS the stop here, because the swing itself sits inside the zone's own range. "
            "sl_distance = 1.27040 - 1.26500 = 0.00540. tp1 = entry - sl_distance*1.0 = 1.25960."
        ),
    },
    {
        "title": "Trade 3 (long, BTC-scale)",
        "given": "Entry (4H zone mean) = 43000.00. Most recent 1D swing low = 42600.00. 4H order block: bottom = 42850.00, top = 43100.00.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 42535.50, "tolerance": 0.5},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 43464.50, "tolerance": 0.5},
        ],
        "explanation": (
            "buffer = max(42600*0.001, 43000*0.0015) = max(42.60, 64.50) = 64.50. raw sl = 42600 - 64.50 = "
            "42535.50 (already past the floor). extend_stop_beyond_zone: zone_bound = 42850 - 0.1*(43100-42850) "
            "= 42825.00; min(42535.50, 42825.00) = 42535.50 -- unchanged. sl_distance = 43000 - 42535.50 = "
            "464.50. tp1 = 43000 + 464.50 = 43464.50 (fixed 1:1, not 5x464.50=2322.50 beyond entry)."
        ),
    },
]

# ---------------------------------------------------------------------------
# BOT1-08 — "Given five losing-trade case studies styled after Bot 1
# (provided in Practise), determine which are valid losses (all five
# gates genuinely passed) and which are bad losses (a gate was
# actually skipped)." classify kind, no snippets -- pure scenario text,
# using the exact 5-gate vocabulary BOT1-05 already established.
# ---------------------------------------------------------------------------
BOT1_08_TITLE = "Failure: What a Failed Bot 1 Setup Looks Like"
_LOSS_OPTIONS = [
    "Valid loss -- all five gates genuinely passed, the trade just didn't work out",
    "Bad loss -- a gate was actually skipped or overridden",
]
BOT1_08_ITEMS = [
    {
        "prompt": "A confirmed 1D uptrend, a matching bullish 4H BOS, and an ACTIVE bullish 4H order block in the discount half of the range all lined up. The trade entered at the zone mean, got stopped out below the swing low, and price then resumed higher without the bot in it.",
        "options": _LOSS_OPTIONS, "correct_index": 0,
        "explanation": "Every one of the five gates genuinely passed. A 1:1 fixed tp1 and a real stop mean some real, correctly-taken setups still lose -- that's normal variance, not a process failure.",
    },
    {
        "prompt": "A confirmed 1D uptrend and a matching bullish 4H BOS both held. The only ACTIVE bullish 4H order block sat in the PREMIUM half of the range -- but the trader entered anyway, reasoning the trend was \"too strong to pass up.\" The trade lost.",
        "options": _LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 5 (discount/premium) genuinely failed here -- real analyze() would have returned None. Entering anyway means the loss came from overriding the bot's own logic, not from the bot's real process losing.",
    },
    {
        "prompt": "A confirmed 1D uptrend was visible, but the only 4H BOS on the chart was bearish (4H structure was actually breaking down). The trader took a long anyway \"because the 1D trend was obviously bullish,\" and the trade lost.",
        "options": _LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 3 genuinely failed -- the one real 4H BOS present doesn't match the 1D trend's direction, so analyze() would return None. The 1D trend alone was never sufficient on its own.",
    },
    {
        "prompt": "A confirmed 1D downtrend, a matching bearish 4H BOS, and an ACTIVE bearish 4H order block sitting in the premium half of the range (equilibrium or premium both pass for a short) all lined up correctly. The trade was stopped out above the swing high before price resumed lower.",
        "options": _LOSS_OPTIONS, "correct_index": 0,
        "explanation": "All five gates pass for a short the same way they do for a long (discount is what kills a short, not premium). A genuinely correct setup that still lost.",
    },
    {
        "prompt": "Only 3 total 1D swing points were visible on the chart, but the trader \"eyeballed\" a short-term bullish bias from a smaller lookback and entered a trade styled after a Bot 1 signal anyway. It lost.",
        "options": _LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 1 genuinely fails with fewer than 4 total 1D swings -- the real analyze() would never have produced any signal at all, Bot 1 or otherwise. This was never a real Bot 1 setup to begin with.",
    },
]

# ---------------------------------------------------------------------------
# BOT1-09 — "Given a full chart scenario (provided in Practise) with
# 1D and 4H data, work through all seven real pipeline steps to
# produce the exact entry price, stop price, and real tp1 take-profit
# target Bot 1's code would output." One multi_calc item, all seven
# steps' real formulas chained exactly as analyze() runs them, verified
# end to end in a throwaway Python script before writing this (see
# module docstring).
# ---------------------------------------------------------------------------
BOT1_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT1_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "1D swings (oldest to newest, exactly 4 total): low 1.08000, high 1.08600, low 1.08300, high 1.09200.\n"
        "4H: most recent BOS is bullish_bos.\n"
        "4H order blocks: one ACTIVE bull-type block is the most recent eligible zone -- bottom = 1.08400, top = 1.08600.\n"
        "4H swing range for discount/premium: low = 1.08100, high = 1.09300."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price (4H zone mean)", "unit": "", "correct_value": 1.08500, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08137, "tolerance": 0.00003},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08863, "tolerance": 0.00003},
    ],
    "explanation": (
        "Step 1-2 (1D trend): highs=[1.08600,1.09200] rising, lows=[1.08000,1.08300] rising -> bullish_trend. "
        "Step 2 (4H BOS): bullish_bos matches bullish_trend -- passes. Step 3-4 (zone+entry): the ACTIVE bull "
        "zone (1.08400-1.08600) is selected; its fib_level = (1.08500-1.08100)/(1.09300-1.08100) = 0.333 -> "
        "discount -- NOT premium, so a long passes gate 5. entry = (1.08400+1.08600)/2 = 1.08500. "
        "Step 5 (stop): sl_swing = most recent 1D swing LOW = 1.08300. buffer = max(1.08300*0.001, "
        "1.08500*0.0015) = 0.0016275. raw sl = 1.08300-0.0016275 = 1.08137 (rounded). "
        "extend_stop_beyond_zone bound = 1.08400 - 0.1*(1.08600-1.08400) = 1.08380; min(1.08137, 1.08380) = "
        "1.08137 (unchanged -- swing stop already wider). sl_distance = 1.08500-1.08137 = 0.00363. "
        "Step 6 (targets): tp1 = entry + sl_distance*1.0 = 1.08863 (fixed 1:1 -- the bot's real reported "
        "take_profit field, regardless of its 5.0 default_rr, which only ever reaches tp3)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT1-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one of which should correctly produce None), work
# the complete Bot 1 pipeline for each and produce the correct final
# output." classify kind: each item's options are candidate completed
# outcomes (the real one, a "5:1 tp1" misconception distractor matching
# the docstring BOT1-07/09 already correct, and a "No signal" option).
# Scenario 1 reuses BOT1-09's exact verified numbers; Scenario 3 is a
# fresh, independently-verified short case; Scenario 2 is the required
# None case (gate 3, wrong-direction 4H BOS).
# ---------------------------------------------------------------------------
BOT1_10_TITLE = "Capstone: Full Bot 1 Decision Simulation"
BOT1_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1 (long): 1D swings (oldest->newest) low 1.08000, high 1.08600, low 1.08300, high 1.09200 "
            "-> confirmed bullish. 4H's most recent BOS is bullish_bos (matches). The most recent ACTIVE bull "
            "4H order block is bottom=1.08400/top=1.08600, and it's in the discount half of the 4H range "
            "(low=1.08100, high=1.09300). What does analyze() actually output?"
        ),
        "options": [
            "Long signal -- entry 1.08500, stop 1.08137, tp1 1.08863 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08500, stop 1.08137, tp1 1.09815 (tp1 at the docstring's 5:1 R)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "All five gates pass (see BOT1-09's identical worked numbers). tp1 is always fixed at 1:1 R off the real sl_distance, never the bot's own 5.0 default_rr -- that only reaches tp3.",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): 1D swings confirm a clean bullish trend exactly as in "
            "Scenario 1. But the ONLY 4H BOS event present in this window is bearish_bos -- 4H structure is "
            "actually breaking down even though the 1D trend is still bullish. What does analyze() output?"
        ),
        "options": [
            "Long signal, using the 4H order block's mean entry price anyway",
            "Long signal, but with tp1 at the docstring's 5:1 R instead of the real fixed 1:1",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "`if bullish_trend and last_bos[\"type\"] != \"bullish_bos\": return None` fires -- Gate 3. The 1D trend alone is never sufficient; the 4H BOS has to agree with it.",
    },
    {
        "prompt": (
            "Scenario 3 (short): 1D swings confirm a bearish trend. 4H's most recent BOS is bearish_bos "
            "(matches). The most recent ACTIVE bear 4H order block is bottom=1.26400/top=1.26600, and the 4H "
            "range for discount/premium is low=1.25800, high=1.26700, putting that zone in the PREMIUM half "
            "(fine for a short -- only discount kills a short). The most recent 1D swing high is 1.26800. "
            "What does analyze() output?"
        ),
        "options": [
            "Short signal -- entry 1.26500, stop 1.26990, tp1 1.26010 (tp1 fixed at 1:1 R)",
            "Short signal -- entry 1.26500, stop 1.26990, tp1 1.24050 (tp1 at the docstring's 5:1 R)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": (
            "entry = (1.26400+1.26600)/2 = 1.26500. buffer = max(1.26800*0.001, 1.26500*0.0015) = 0.0018975; "
            "raw sl = 1.26800+0.0018975 = 1.26990 (rounded). Zone-embed bound = 1.26600 + 0.1*(1.26600-1.26400) "
            "= 1.26620; max(1.26990, 1.26620) = 1.26990 -- unchanged. sl_distance = 1.26990-1.26500 = 0.00490. "
            "tp1 = entry - sl_distance*1.0 = 1.26010 (fixed 1:1, not 5x0.00490=0.0245 further out)."
        ),
    },
]


async def seed_bot1_remaining_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT1_02_TITLE, "swing_sequence", BOT1_02_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_03_TITLE, "classify", BOT1_03_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_04_TITLE, "classify", BOT1_04_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_05_TITLE, "classify", BOT1_05_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_06_TITLE, "multi_calc", BOT1_06_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_07_TITLE, "multi_calc", BOT1_07_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_08_TITLE, "classify", BOT1_08_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_09_TITLE, "multi_calc", BOT1_09_ITEMS, bot_id="bot_1")
        count += await _upsert(db, BOT1_10_TITLE, "classify", BOT1_10_ITEMS, bot_id="bot_1")
        await db.commit()
        print(f"\n{count} of 9 Bot 1 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot1_remaining_scenarios())
    sys.exit(0)
