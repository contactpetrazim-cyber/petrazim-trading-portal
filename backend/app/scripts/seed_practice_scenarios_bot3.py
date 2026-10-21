"""
Practice Scenario Set Seed Script — Bot 3 Lessons 02 through 10
===================================================================

Phase 5 of the practice-drill-scenario-sets effort. Completes Bot 3's
full BOT3-01..10 track (01 was seeded in seed_practice_scenarios_bots.py).
Every number is hand-derived from FVGExpansionBot.analyze() itself
(bot_strategies.py, ~lines 719-849 — re-read in full immediately
before writing this, the same reading used to build BOT7-01's
paired-snippet comparison), cross-checked with a throwaway Python
script, then re-verified by reading the inserted rows back out of the
live backend container's DB.

Key real facts:

  - Step 1 (FVG eligibility): partial_fvgs = 1H FVGs with
    0.3 <= mitigated_percent <= 0.7 AND status.name == "ACTIVE".
    Empty -> None. target_fvg = partial_fvgs[-1] (the LAST one in
    whatever order detect_fvg() returned them -- recency, NOT depth;
    depth-selection is Bot 7's own difference, not Bot 3's).
  - Step 2 (direction/confirmation): bos_15m =
    self.structure_detector.detect_bos(candles_15m, swings_15m) using
    the RAW swings_15m list -- NOT fed through
    filter_significant_swings (unlike Bot 1 and unlike Bot 7's own
    fix to this exact step). Bot 3 never calls detect_choch() at all.
    Empty bos_15m -> None. direction is decided from target_fvg's own
    gap_type FIRST, then checked against last_bos's type (this is
    exactly the "FVG-first, not direction-first" ordering BOT7-01's
    own classify items already contrast against Bot 7's fix) -- if
    they disagree, None.
  - Step 3 (entry): entry_price = (target_fvg.top + target_fvg.bottom) / 2.
  - Step 4 (stop): sl_price = target_fvg.bottom - (top-bottom)*0.1 for a
    long, target_fvg.top + (top-bottom)*0.1 for a short -- 10% of the
    FVG's OWN size, hand-computed locally, then
    apply_min_stop_distance_floor(entry_price, sl_price, direction,
    MIN_STOP_DISTANCE_PCT=0.0015).
  - IMPORTANT, independently re-verified discrepancy: BOT3-07's own
    authored Worked Example (FVG 1.0900-1.0920, entry 1.0910, stop
    1.0898, 12-pip distance, tp1 1.0922) PREDATES
    apply_min_stop_distance_floor being added to this code path --
    running the real current formula on that exact FVG gives a FLOORED
    stop of 1.08936 (16.4-pip distance, the 0.15%-of-entry floor),
    not 1.0898/12-pip. Confirmed by hand-running the exact floor
    formula against MIN_STOP_DISTANCE_PCT=0.0015 (app/config.py line
    232) in a throwaway script before writing this file. This file's
    own BOT3-07 item 2 uses the CURRENT, floor-corrected number (not
    the lesson's stale worked example value) and says so explicitly in
    its explanation -- flagged for the parent session as a likely
    third "re-verify against current source" gap, alongside BOT1-05's
    already-fixed four-vs-five gates and BOT2-05's uncounted
    discount/premium return point. Not fixed in the curriculum .md
    itself here (out of this task's scope).
  - Targets: tp1 = entry +- sl_distance*1.0, ALWAYS fixed 1:1 (never
    the bot's own rr_ratio=4.0 default, which only reaches tp3).
    confidence = 0.82, fixed (not sweep/confluence-dependent like Bots
    2/4/5).

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bot3
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# BOT3-02 — "Given six 1H FVGs with varying mitigation percentages and
# statuses (provided in Practise), determine which are eligible under
# Bot 3's exact test."
# ---------------------------------------------------------------------------
BOT3_02_TITLE = "Identification: The Partial-Mitigation Window"
_B3_ELIGIBLE_OPTIONS = ["Eligible (a valid partial_fvg)", "Not eligible"]
BOT3_02_ITEMS = [
    {"prompt": "1H FVG: mitigated_percent = 0.25, status = ACTIVE.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "0.25 < 0.3 -- below the window. Not eligible."},
    {"prompt": "1H FVG: mitigated_percent = 0.30, status = ACTIVE.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "0.3 <= 0.30 <= 0.7 -- the lower boundary is inclusive. Eligible."},
    {"prompt": "1H FVG: mitigated_percent = 0.50, status = ACTIVE.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "Squarely inside the 0.3-0.7 window and ACTIVE. Eligible."},
    {"prompt": "1H FVG: mitigated_percent = 0.70, status = ACTIVE.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "0.3 <= 0.70 <= 0.7 -- the upper boundary is inclusive too. Eligible."},
    {"prompt": "1H FVG: mitigated_percent = 0.75, status = ACTIVE.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "0.75 > 0.7 -- above the window (too fully mitigated already). Not eligible."},
    {"prompt": "1H FVG: mitigated_percent = 0.50, status = MITIGATED.", "options": _B3_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "The percentage alone is in-window, but the status check (status.name == \"ACTIVE\") also fails -- `MITIGATED` means it's already been fully closed out. Not eligible, regardless of the percentage."},
]

# ---------------------------------------------------------------------------
# BOT3-03 — "Given five FVG-gap-type + 15M-structural-event pairs
# (provided in Practise, mixing BOS and CHoCH events), determine which
# satisfy Bot 3's alignment test."
# ---------------------------------------------------------------------------
BOT3_03_TITLE = "Context: Why 15M BOS Confirms (a Third Pattern)"
_B3_ALIGN_OPTIONS = ["Passes -- produces a signal", "Fails -- analyze() returns None"]
BOT3_03_ITEMS = [
    {"prompt": "Selected FVG gap_type: bullish. 15M's most recent BOS: bullish_bos.", "options": _B3_ALIGN_OPTIONS, "correct_index": 0,
     "explanation": "target_fvg.gap_type=='bullish' and last_bos['type']=='bullish_bos' -- they agree. Passes."},
    {"prompt": "Selected FVG gap_type: bullish. 15M's most recent BOS: bearish_bos.", "options": _B3_ALIGN_OPTIONS, "correct_index": 1,
     "explanation": "`if target_fvg.gap_type == \"bullish\" and last_bos[\"type\"] != \"bullish_bos\": return None` fires. Fails."},
    {"prompt": "Selected FVG gap_type: bearish. 15M's most recent BOS: bearish_bos.", "options": _B3_ALIGN_OPTIONS, "correct_index": 0,
     "explanation": "Both bearish -- agree. Passes."},
    {"prompt": "Selected FVG gap_type: bullish. 15M's ONLY structural event is a bullish CHoCH (no BOS at all).", "options": _B3_ALIGN_OPTIONS, "correct_index": 1,
     "explanation": "FVGExpansionBot.analyze() never calls detect_choch() -- only detect_bos(). A CHoCH-only window produces an empty bos_15m list, and `if not bos_15m: return None` fires before any gap_type comparison. The CHoCH is invisible to this bot."},
    {"prompt": "Selected FVG gap_type: bearish. 15M has an earlier bullish_bos, then a more recent bearish_bos.", "options": _B3_ALIGN_OPTIONS, "correct_index": 0,
     "explanation": "last_bos = bos_15m[-1] -- only the most recent BOS matters. The later bearish_bos agrees with the bearish FVG. Passes."},
]

# ---------------------------------------------------------------------------
# BOT3-04 — "Given four FVG top/bottom price pairs (provided in
# Practise), calculate the exact entry price Bot 3 would use for
# each." multi_calc, one field per item -- entry_price = (top+bottom)/2,
# rounded to 5 decimals on the final BotSignal.
# ---------------------------------------------------------------------------
BOT3_04_TITLE = "Setup: The Hand-Calculated Midpoint Entry"
BOT3_04_ITEMS = [
    {"title": "FVG A", "given": "bottom = 1.09000, top = 1.09200.",
     "fields": [{"label": "entry", "ask": "Entry price (FVG midpoint)", "unit": "", "correct_value": 1.09100, "tolerance": 0.00003}],
     "explanation": "(1.09000 + 1.09200) / 2 = 1.09100."},
    {"title": "FVG B", "given": "bottom = 1.26200, top = 1.26460.",
     "fields": [{"label": "entry", "ask": "Entry price (FVG midpoint)", "unit": "", "correct_value": 1.26330, "tolerance": 0.00003}],
     "explanation": "(1.26200 + 1.26460) / 2 = 1.26330."},
    {"title": "FVG C", "given": "bottom = 0.65100, top = 0.65280.",
     "fields": [{"label": "entry", "ask": "Entry price (FVG midpoint)", "unit": "", "correct_value": 0.65190, "tolerance": 0.00003}],
     "explanation": "(0.65100 + 0.65280) / 2 = 0.65190."},
    {"title": "FVG D", "given": "bottom = 42700.00, top = 43100.00.",
     "fields": [{"label": "entry", "ask": "Entry price (FVG midpoint)", "unit": "", "correct_value": 42900.00, "tolerance": 0.5}],
     "explanation": "(42700.00 + 43100.00) / 2 = 42900.00."},
]

# ---------------------------------------------------------------------------
# BOT3-05 — "Given six scenario summaries (provided in Practise)
# describing FVG eligibility and BOS status, determine at which gate
# (if any) analyze() would return None."
# ---------------------------------------------------------------------------
BOT3_05_TITLE = "Invalidation: The Two Conditions That Return No Signal"
_B3_GATE_OPTIONS = [
    "Gate 1 (no eligible partial_fvg)",
    "Gate 2 (no 15M BOS, or it doesn't match the FVG's gap_type)",
    "Passes both -- produces a signal",
]
BOT3_05_ITEMS = [
    {"prompt": "No 1H FVG anywhere has mitigated_percent between 0.3 and 0.7 while ACTIVE.", "options": _B3_GATE_OPTIONS, "correct_index": 0,
     "explanation": "partial_fvgs is empty. Gate 1."},
    {"prompt": "An eligible bullish FVG exists (gate 1 passes), but the 15M chart has no BOS events at all in the window.", "options": _B3_GATE_OPTIONS, "correct_index": 1,
     "explanation": "bos_15m is empty. Gate 2."},
    {"prompt": "An eligible bullish FVG exists, and the 15M chart's most recent BOS is bearish_bos (wrong direction).", "options": _B3_GATE_OPTIONS, "correct_index": 1,
     "explanation": "last_bos['type'] != 'bullish_bos' while the FVG is bullish. Gate 2."},
    {"prompt": "An eligible bearish FVG exists, and the 15M chart's most recent BOS is bearish_bos (matches).", "options": _B3_GATE_OPTIONS, "correct_index": 2,
     "explanation": "Both gates pass -- analyze() proceeds to compute entry, stop, targets, and lot size."},
    {"prompt": "Two 1H FVGs exist: one at mitigated_percent=0.2 (ACTIVE), one at mitigated_percent=0.85 (ACTIVE). Neither is in the eligible window.", "options": _B3_GATE_OPTIONS, "correct_index": 0,
     "explanation": "Neither FVG's mitigated_percent falls in [0.3, 0.7] -- partial_fvgs is empty regardless of how many total FVGs exist. Gate 1."},
    {"prompt": "An eligible bullish FVG exists, and the 15M chart's most recent BOS is bullish_bos (matches), with an EARLIER bearish_bos also present further back.", "options": _B3_GATE_OPTIONS, "correct_index": 2,
     "explanation": "Only the most recent BOS (bos_15m[-1]) is checked -- it agrees with the bullish FVG. Both gates pass."},
]

# ---------------------------------------------------------------------------
# BOT3-06 — "Given four selected-FVG scenarios (provided in Practise,
# with gap type and top/bottom prices), state the exact direction and
# entry price Bot 3 would produce for each." multi_calc, with direction
# encoded as 1=long/0=short (same convention BOT2-04 uses for
# has_sweep) alongside the real entry price.
# ---------------------------------------------------------------------------
BOT3_06_TITLE = "Entry: Direction and Price, Assembled"
BOT3_06_ITEMS = [
    {"title": "FVG A (bullish)", "given": "gap_type = bullish. bottom = 1.08700, top = 1.08900.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 1, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08800, "tolerance": 0.00003},
     ], "explanation": "bullish -> direction=long (1). entry = (1.08700+1.08900)/2 = 1.08800."},
    {"title": "FVG B (bearish)", "given": "gap_type = bearish. bottom = 1.26100, top = 1.26300.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 0, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.26200, "tolerance": 0.00003},
     ], "explanation": "bearish -> direction=short (0). entry = (1.26100+1.26300)/2 = 1.26200."},
    {"title": "FVG C (bullish)", "given": "gap_type = bullish. bottom = 0.64900, top = 0.65060.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 1, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 0.64980, "tolerance": 0.00003},
     ], "explanation": "bullish -> long (1). entry = (0.64900+0.65060)/2 = 0.64980."},
    {"title": "FVG D (bearish)", "given": "gap_type = bearish. bottom = 42500.00, top = 42900.00.",
     "fields": [
         {"label": "direction", "ask": "Direction (1=long, 0=short)", "unit": "", "correct_value": 0, "tolerance": 0.1},
         {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 42700.00, "tolerance": 0.5},
     ], "explanation": "bearish -> short (0). entry = (42500.00+42900.00)/2 = 42700.00."},
]

# ---------------------------------------------------------------------------
# BOT3-07 — "Given three FVG top/bottom pairs with entry prices
# (provided in Practise), calculate the exact stop price, stop
# distance, and the actual (fixed 1:1) take_profit target for each --
# not the docstring's 4:1 figure, and not tp2/tp3." multi_calc, 3
# fields. Item 2 deliberately uses the lesson's own Worked Example FVG
# but with the CURRENT, floor-corrected numbers (see module docstring).
# ---------------------------------------------------------------------------
BOT3_07_TITLE = "Management: Stop, Target, Sizing — and What's NOT Implemented"
BOT3_07_ITEMS = [
    {
        "title": "Trade 1 (long, wide FVG -- floor not triggered)",
        "given": "FVG: bottom = 1.08500, top = 1.09200. Entry (midpoint) = 1.08850.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08430, "tolerance": 0.00003},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00420, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.09270, "tolerance": 0.00003},
        ],
        "explanation": "buffer = (1.09200-1.08500)*0.1 = 0.00070. sl = 1.08500-0.00070 = 1.08430. distance = 1.08850-1.08430 = 0.00420, already well past the min-distance floor (1.08850*0.0015=0.00163), so no flooring. tp1 = entry+distance*1.0 = 1.09270.",
    },
    {
        "title": "Trade 2 (long, this lesson's own Worked Example FVG -- re-verified with the real min-stop-distance floor)",
        "given": "FVG: bottom = 1.09000, top = 1.09200. Entry (midpoint) = 1.09100.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08936, "tolerance": 0.00003},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00164, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.09264, "tolerance": 0.00003},
        ],
        "explanation": (
            "buffer = (1.09200-1.09000)*0.1 = 0.00020. RAW sl = 1.09000-0.00020 = 1.08980, a 0.00120 (12-pip) "
            "distance -- this lesson's own authored Worked Example stops here and reports sl=1.0898, tp1=1.0922. "
            "But apply_min_stop_distance_floor(MIN_STOP_DISTANCE_PCT=0.0015) requires at least "
            "1.09100*0.0015=0.00164 of distance; 0.00120 is below that floor, so the REAL current code widens "
            "the stop to 1.09100-0.00164=1.08936. sl_distance becomes 0.00164, and tp1 = entry+0.00164 = "
            "1.09264 -- not the lesson's own 1.0898/1.0922. This floor was added to the codebase after that "
            "Worked Example was written; the lesson's own text is now stale on this one specific number."
        ),
    },
    {
        "title": "Trade 3 (short)",
        "given": "FVG: bottom = 1.26400, top = 1.26500. Entry (midpoint) = 1.26450.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.26640, "tolerance": 0.00003},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00190, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.26260, "tolerance": 0.00003},
        ],
        "explanation": "buffer = (1.26500-1.26400)*0.1 = 0.00010. RAW sl = 1.26500+0.00010 = 1.26510, a 0.00060 distance -- below the floor (1.26450*0.0015=0.00190). Floored sl = 1.26450+0.00190 = 1.26640. tp1 = entry-0.00190 = 1.26260.",
    },
]

# ---------------------------------------------------------------------------
# BOT3-08 — "Given five losing-trade case studies styled after Bot 3
# (provided in Practise), determine which are valid losses and which
# are bad losses, checking the actual mitigation percentage in each
# case."
# ---------------------------------------------------------------------------
BOT3_08_TITLE = "Failure: What a Failed Bot 3 Setup Looks Like"
_B3_LOSS_OPTIONS = [
    "Valid loss -- both gates genuinely passed, the trade just didn't work out",
    "Bad loss -- a gate was actually skipped or overridden",
]
BOT3_08_ITEMS = [
    {
        "prompt": "A 1H FVG at 55% mitigated, ACTIVE, matched by a confirming 15M BOS in the same direction. The trade entered at the FVG midpoint and was stopped out before resuming in the expected direction.",
        "options": _B3_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "55% is squarely inside [30%, 70%], and the BOS matches. Both gates genuinely passed -- a real, correctly-taken setup that lost.",
    },
    {
        "prompt": "A 1H FVG was at 78% mitigated (already mostly filled), but the trader entered anyway \"since the direction still looked right.\" No matching 15M BOS was ever checked. The trade lost.",
        "options": _B3_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "78% > 70% -- Gate 1 genuinely fails; this FVG was never eligible. Real analyze() would have returned None before ever reaching the BOS check.",
    },
    {
        "prompt": "A 1H FVG at 45% mitigated, ACTIVE, bullish. The only 15M BOS in the window was bearish (wrong direction). The trader entered long anyway \"because the FVG itself was clearly bullish.\" The trade lost.",
        "options": _B3_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 2 genuinely fails -- the FVG's own gap_type being bullish is not sufficient on its own; the 15M BOS has to agree, and it didn't. Real analyze() would return None.",
    },
    {
        "prompt": "A 1H FVG at exactly 30% mitigated (the lower boundary), ACTIVE, bearish, matched by a confirming bearish 15M BOS. The trade was taken and stopped out.",
        "options": _B3_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "30% is the inclusive lower boundary of [0.3, 0.7] -- genuinely eligible. Both gates pass. A valid loss.",
    },
    {
        "prompt": "A 1H FVG was already fully mitigated (status=MITIGATED) at a mitigated_percent reading of 60% from earlier in its life. The trader entered anyway, reasoning \"60% is in the window.\" The trade lost.",
        "options": _B3_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "The percentage alone being in-window doesn't matter -- Gate 1 also requires status.name=='ACTIVE', and a MITIGATED FVG fails that outright. This was never a real Bot 3 signal.",
    },
]

# ---------------------------------------------------------------------------
# BOT3-09 — "Given a full chart scenario (provided in Practise) with
# 1H and 15M data, work through the complete pipeline to produce the
# exact entry price, stop price, and real tp1 take-profit target Bot
# 3's code would output." One multi_calc item, reusing BOT3-07 Trade
# 1's independently-verified (non-floored) numbers with full upstream
# context.
# ---------------------------------------------------------------------------
BOT3_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT3_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "1H: one eligible FVG -- bottom = 1.08500, top = 1.09200, mitigated_percent = 0.50, status = ACTIVE, "
        "gap_type = bullish.\n"
        "15M: the most recent BOS is bullish_bos."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08850, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08430, "tolerance": 0.00003},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.09270, "tolerance": 0.00003},
    ],
    "explanation": (
        "Step 1: mitigated_percent=0.50 is in [0.3,0.7] and status=ACTIVE -- eligible; it's the only candidate "
        "so target_fvg is this FVG. Step 2: gap_type=bullish, last_bos='bullish_bos' -- agree -> direction=long. "
        "Step 3: entry=(1.08500+1.09200)/2=1.08850. Step 4: buffer=(1.09200-1.08500)*0.1=0.00070; "
        "sl=1.08500-0.00070=1.08430; distance=0.00420, already past the 0.00163 floor, unchanged. "
        "tp1 = entry+distance*1.0 = 1.09270 -- fixed 1:1, not the bot's own rr_ratio=4.0 default (that only "
        "reaches tp3, reported separately as take_profit_3, never as take_profit)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT3-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one producing None), work the complete Bot 3
# pipeline for each." classify kind. Scenario 1 reuses BOT3-09's exact
# numbers; Scenario 2 is the required None case (gate 1, over-mitigated
# FVG); Scenario 3 reuses BOT3-07 Trade 3's exact verified short-case
# numbers (including the real min-stop-distance floor).
# ---------------------------------------------------------------------------
BOT3_10_TITLE = "Capstone: Full Bot 3 Decision Simulation"
BOT3_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1: 1H has one eligible bullish FVG (bottom=1.08500, top=1.09200, 50% mitigated, ACTIVE). "
            "15M's most recent BOS is bullish_bos. What does analyze() output?"
        ),
        "options": [
            "Long signal -- entry 1.08850, stop 1.08430, tp1 1.09270 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08850, stop 1.08430, tp1 1.08850+4*0.00420=1.10530 (tp1 at the bot's 4:1 default_rr)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Both gates pass. tp1 is always fixed at 1:1 R off sl_distance -- the bot's own default rr_ratio=4.0 only ever reaches tp3 (take_profit_3), never the reported take_profit field.",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): 1H has one FVG, bullish, status ACTIVE, but mitigated_percent "
            "= 0.82 -- well outside the [0.3, 0.7] eligibility window. No other 1H FVGs exist. What does "
            "analyze() output?"
        ),
        "options": [
            "A long signal anyway, since the FVG's own direction is still clearly bullish",
            "A long signal with reduced confidence, since the FVG is over-mitigated",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "partial_fvgs filters strictly to [0.3, 0.7] -- 0.82 fails that test regardless of status or direction. partial_fvgs ends up empty. Gate 1 fails. None.",
    },
    {
        "prompt": (
            "Scenario 3 (short): 1H has one eligible bearish FVG (bottom=1.26400, top=1.26500, 55% mitigated, "
            "ACTIVE). 15M's most recent BOS is bearish_bos. What does analyze() output?"
        ),
        "options": [
            "Short signal -- entry 1.26450, stop 1.26640, tp1 1.26260 (tp1 fixed at 1:1 R, min-stop-distance floor applied)",
            "Short signal -- entry 1.26450, stop 1.26510, tp1 1.26390 (the raw 10%-buffer stop, no floor)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Both gates pass (55% is in-window, BOS matches). entry=(1.26400+1.26500)/2=1.26450. Raw buffer-only sl=1.26510 is only a 0.00060 distance -- below the 1.26450*0.0015=0.00190 floor, so the real code widens it to 1.26640. tp1=entry-0.00190=1.26260. Option 2 is the common mistake of skipping the min-stop-distance floor entirely.",
    },
]


async def seed_bot3_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT3_02_TITLE, "classify", BOT3_02_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_03_TITLE, "classify", BOT3_03_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_04_TITLE, "multi_calc", BOT3_04_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_05_TITLE, "classify", BOT3_05_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_06_TITLE, "multi_calc", BOT3_06_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_07_TITLE, "multi_calc", BOT3_07_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_08_TITLE, "classify", BOT3_08_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_09_TITLE, "multi_calc", BOT3_09_ITEMS, bot_id="bot_3")
        count += await _upsert(db, BOT3_10_TITLE, "classify", BOT3_10_ITEMS, bot_id="bot_3")
        await db.commit()
        print(f"\n{count} of 9 Bot 3 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot3_scenarios())
    sys.exit(0)
