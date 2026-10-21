"""
Practice Scenario Set Seed Script — Bot 2 Lessons 02 through 10
===================================================================

Phase 4 of the practice-drill-scenario-sets effort. Completes Bot 2's
full BOT2-01..10 track (01 was seeded in seed_practice_scenarios_bots.py).
Every number is hand-derived from OrderBlockReversalBot.analyze()
itself (bot_strategies.py, ~lines 428-651) and the real helpers it
calls, re-read in full immediately before writing this, with every
hand-computed value cross-checked by running the exact same formulas
in a throwaway Python script, then re-verified by reading the inserted
rows back out of the live backend container's DB.

Key real facts this file's content depends on:

  - Step 1 (zone availability): 4H order blocks filtered to
    status==ACTIVE AND test_count<=1. If that list is EMPTY, falls
    back to the IDENTICAL filter on 1H. There is no "prefer 1H if its
    zone contains price" logic — the 4H-vs-1H choice is made purely on
    whether ANY active_obs exist on 4H, before price-inside is ever
    checked. If 4H has active_obs but NONE contain the current 15M
    price, there is no fallback to 1H at all — straight to gate 2.
  - Step 2 (inside-zone test): inside_obs = zones (from whichever TF
    Step 1 selected) where bottom<=current_price<=top. Empty -> None.
    target_ob = inside_obs[-1] (most recent).
  - Step 3 (direction): calls detect_choch() ONLY — never detect_bos()
    at all. An empty choch_15m (even if a real BOS fired) -> None.
    bullish_choch->long, bearish_choch->short.
  - Step 3b (discount/premium): classify_premium_discount against the
    SAME zone_swings list Step 1 used (4H swings if the 4H branch was
    used, 1H swings if the fallback fired). long+premium or
    short+discount -> None. NOT named among BOT2-05's own "three hard
    gates" in the lesson's prose (a real discrepancy with the code,
    flagged in this file's own commit message — not fixed here, out
    of this task's scope, and no scenario below is built to depend on
    it, so nothing authored here contradicts the lesson's own claim).
  - Step 4 (sweep, SOFT signal): has_sweep = bool(detect_liquidity_sweeps
    over ONLY candles_15m[-5:] — the last 5 15M candles).
  - Step 5 (FVG, SOFT signal): active_fvgs = FVGs from
    detect_fvg(candles_15m[-10:]) (last 10 15M candles only) with
    status==ACTIVE and gap_type==direction.
  - Step 6 (entry): "mean" (zone.mean_threshold) if has_sweep, else
    "aggressive" (zone.bottom for long, zone.top for short).
  - Step 7 (stop): TWO distinct methods depending on has_sweep:
      sweep: buffer = sweep_price*0.0005; sl = sweep_price -+ buffer;
             extend_stop_beyond_zone widen; apply_min_stop_distance_floor
             (MIN_STOP_DISTANCE_PCT=0.0015) -- this whole branch is
             built BY HAND and is NEVER rounded anywhere.
      no sweep: calculate_stop_loss(method="structure_swing") using
             swings_15m[-1] -- the single most recent 15M swing point
             of EITHER type (high or low; Bot 2, unlike Bot 1, does
             NOT filter by type here) -- then extend_stop_beyond_zone.
             This path's own calculate_stop_loss call DOES round to 5
             decimals internally.
  - Targets: calculate_targets() -- tp1 = entry +- sl_distance*1.0,
    ALWAYS fixed 1:1, exactly like Bot 1 -- never the bot's own
    default_rr=3.0 (that only reaches tp3). confidence = 0.80 if
    has_sweep else 0.70.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bot2
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# BOT2-02 — "Given six 4H/1H zone-availability scenarios paired with a
# current 15M price (provided in Practise), determine which zone (if
# any) Bot 2's logic would select, applying the fallback and
# inside-range test exactly." classify kind, one option set reused
# across all six prompts (zone labels + None).
# ---------------------------------------------------------------------------
BOT2_02_TITLE = "Identification: The 4H-Then-1H Order Block Fallback"
_B2_ZONE_OPTIONS = [
    "The 4H zone", "The 1H zone", "No zone -- analyze() returns None",
]
BOT2_02_ITEMS = [
    {
        "prompt": "4H has one ACTIVE, fresh (test_count<=1) order block: 1.08400-1.08600. Current 15M close = 1.08500 (inside it).",
        "options": _B2_ZONE_OPTIONS, "correct_index": 0,
        "explanation": "4H active_obs is non-empty, so Step 1 uses 4H exclusively (no 1H check at all). Price 1.08500 is inside the 4H zone -- that zone is selected.",
    },
    {
        "prompt": "4H has one ACTIVE, fresh order block: 1.08400-1.08600. Current 15M close = 1.09200 (outside it). 1H separately has an ACTIVE, fresh order block at 1.09100-1.09300, which DOES contain 1.09200.",
        "options": _B2_ZONE_OPTIONS, "correct_index": 2,
        "explanation": "4H active_obs is non-empty, so the 1H branch is never even reached -- the fallback only fires when 4H has ZERO active_obs, not when 4H's zone merely fails the inside-price test. inside_obs ends up empty on the 4H-only list, and analyze() returns None, even though a perfectly good 1H zone existed.",
    },
    {
        "prompt": "4H has no ACTIVE order blocks at all (every 4H block is either MITIGATED or has test_count>1). 1H has one ACTIVE, fresh order block: 1.08350-1.08550. Current 15M close = 1.08450 (inside it).",
        "options": _B2_ZONE_OPTIONS, "correct_index": 1,
        "explanation": "4H active_obs is empty, so Step 1 falls back to 1H. The 1H zone is ACTIVE, fresh, and contains current price -- selected.",
    },
    {
        "prompt": "4H has no ACTIVE order blocks at all. 1H also has no ACTIVE, fresh order blocks (the only 1H block has test_count=3).",
        "options": _B2_ZONE_OPTIONS, "correct_index": 2,
        "explanation": "Both the 4H list and the 1H fallback list are empty after the status+freshness filter. `if not active_obs: return None` fires on the 1H attempt. No zone at all.",
    },
    {
        "prompt": "4H has one block that LOOKS active but has test_count=2 (it's been tested twice already). No other 4H blocks exist. 1H has an ACTIVE, fresh order block at 1.26400-1.26600, containing the current 15M close of 1.26500.",
        "options": _B2_ZONE_OPTIONS, "correct_index": 1,
        "explanation": "The freshness filter is `status.name == \"ACTIVE\" and test_count <= 1` -- a test_count=2 block fails this and is excluded, leaving 4H's active_obs empty exactly as if no 4H block existed at all. Falls back to 1H, which qualifies.",
    },
    {
        "prompt": "4H has TWO ACTIVE, fresh order blocks that both happen to contain the current 15M price: an older one at 1.08300-1.08500, and a more recent one at 1.08450-1.08650. Current 15M close = 1.08480.",
        "options": _B2_ZONE_OPTIONS, "correct_index": 0,
        "explanation": "Both qualify as inside_obs, but target_ob = inside_obs[-1] picks the MOST RECENT one (the 1.08450-1.08650 zone) -- still \"the 4H zone\" for this question's purposes, just specifically the newer of the two.",
    },
]

# ---------------------------------------------------------------------------
# BOT2-03 — "Given five 15M structural-event scenarios (provided in
# Practise, a mix of BOS and CHoCH events, both directions), determine
# which ones Bot 2's logic would act on and what direction each would
# produce."
# ---------------------------------------------------------------------------
BOT2_03_TITLE = "Context: Why 15M CHoCH (Not BOS) Confirms This Reversal"
_B2_DIR_OPTIONS = [
    "Acts -- direction long", "Acts -- direction short",
    "Ignored entirely -- analyze() returns None (no CHoCH present)",
]
BOT2_03_ITEMS = [
    {"prompt": "The only 15M structural event present is a bullish CHoCH.", "options": _B2_DIR_OPTIONS, "correct_index": 0,
     "explanation": "choch_15m is non-empty; last_choch['type']=='bullish_choch' -> direction='long'."},
    {"prompt": "The only 15M structural event present is a bearish CHoCH.", "options": _B2_DIR_OPTIONS, "correct_index": 1,
     "explanation": "last_choch['type']=='bearish_choch' -> direction='short'."},
    {"prompt": "The only 15M structural event present is a bullish BOS (no CHoCH anywhere in the window).", "options": _B2_DIR_OPTIONS, "correct_index": 2,
     "explanation": "OrderBlockReversalBot.analyze() never calls detect_bos() at all -- it only ever calls detect_choch(). A BOS with no CHoCH produces an empty choch_15m list, and `if not choch_15m: return None` fires. The BOS is simply invisible to this bot's direction logic."},
    {"prompt": "Earlier in the window, a bullish BOS fires. Later (more recently), a bearish CHoCH fires.", "options": _B2_DIR_OPTIONS, "correct_index": 1,
     "explanation": "The BOS is irrelevant -- analyze() only ever looks at choch_15m. last_choch (the most recent CHoCH) is the bearish one -> direction='short', regardless of the earlier BOS."},
    {"prompt": "Two CHoCH events fire in the window: an earlier bearish CHoCH, then a more recent bullish CHoCH.", "options": _B2_DIR_OPTIONS, "correct_index": 0,
     "explanation": "last_choch = choch_15m[-1] -- only the MOST RECENT CHoCH matters. The later bullish one wins -> direction='long'."},
]

# ---------------------------------------------------------------------------
# BOT2-04 — "Given four 15M scenarios with varying sweep/FVG presence
# (provided in Practise), correctly determine has_sweep and the count
# of matching active FVGs for each, using the real 5-candle/10-candle
# windows." multi_calc, 2 numeric fields (has_sweep as 0/1, fvg_count).
# ---------------------------------------------------------------------------
BOT2_04_TITLE = "Setup: Liquidity Sweep and FVG Confirmation"
BOT2_04_ITEMS = [
    {
        "title": "Scenario 1 (direction: long)",
        "given": "A liquidity sweep occurred 2 candles ago. Active, direction-matching FVGs formed 3, 6, and 12 candles ago.",
        "fields": [
            {"label": "has_sweep", "ask": "has_sweep (1=True, 0=False)", "unit": "", "correct_value": 1, "tolerance": 0.1},
            {"label": "fvg_count", "ask": "Count of matching active FVGs", "unit": "", "correct_value": 2, "tolerance": 0.1},
        ],
        "explanation": "detect_liquidity_sweeps only scans candles_15m[-5:] -- a sweep 2 candles ago is inside that window -> has_sweep=True (1). detect_fvg only scans candles_15m[-10:] -- the FVGs 3 and 6 candles ago qualify, but the one 12 candles ago is outside the 10-candle window -> fvg_count=2.",
    },
    {
        "title": "Scenario 2 (direction: short)",
        "given": "A liquidity sweep occurred 8 candles ago (nothing more recent). One active, direction-matching FVG formed 4 candles ago.",
        "fields": [
            {"label": "has_sweep", "ask": "has_sweep (1=True, 0=False)", "unit": "", "correct_value": 0, "tolerance": 0.1},
            {"label": "fvg_count", "ask": "Count of matching active FVGs", "unit": "", "correct_value": 1, "tolerance": 0.1},
        ],
        "explanation": "A sweep 8 candles ago falls OUTSIDE the last-5-candle window detect_liquidity_sweeps actually scans -> has_sweep=False (0), even though a sweep genuinely happened earlier. The FVG at 4 candles ago is inside the 10-candle FVG window -> fvg_count=1.",
    },
    {
        "title": "Scenario 3 (direction: long)",
        "given": "No liquidity sweep anywhere in the window. Two FVGs exist within the last 10 candles: one is bearish (wrong direction for this long setup), one is bullish but already MITIGATED (not ACTIVE).",
        "fields": [
            {"label": "has_sweep", "ask": "has_sweep (1=True, 0=False)", "unit": "", "correct_value": 0, "tolerance": 0.1},
            {"label": "fvg_count", "ask": "Count of matching active FVGs", "unit": "", "correct_value": 0, "tolerance": 0.1},
        ],
        "explanation": "No sweep at all -> has_sweep=False. Neither FVG qualifies: the bearish one fails the gap_type==direction check, and the mitigated one fails the status==ACTIVE check -> fvg_count=0.",
    },
    {
        "title": "Scenario 4 (direction: short)",
        "given": "A liquidity sweep occurred 4 candles ago. Four FVGs match direction and are within the last 10 candles; three are ACTIVE, one is already MITIGATED.",
        "fields": [
            {"label": "has_sweep", "ask": "has_sweep (1=True, 0=False)", "unit": "", "correct_value": 1, "tolerance": 0.1},
            {"label": "fvg_count", "ask": "Count of matching active FVGs", "unit": "", "correct_value": 3, "tolerance": 0.1},
        ],
        "explanation": "4 candles ago is inside the 5-candle sweep window -> has_sweep=True. Of the 4 direction-matching FVGs inside the 10-candle window, only the 3 still ACTIVE ones count -> fvg_count=3.",
    },
]

# ---------------------------------------------------------------------------
# BOT2-05 — "Given seven scenario summaries (provided in Practise)
# describing which of the three hard gates pass or fail, plus
# sweep/FVG presence, determine whether analyze() returns a signal or
# None for each." Scoped exactly to the three hard gates this lesson's
# own prose names (zone availability, inside-zone test, 15M CHoCH) --
# see this file's module docstring for the real discount/premium
# return point the lesson's prose doesn't count among them; nothing
# below depends on that uncounted gate.
# ---------------------------------------------------------------------------
BOT2_05_TITLE = "Invalidation: The Three Points That Return No Signal"
_B2_SIGNAL_OPTIONS = ["Produces a signal", "Returns None"]
BOT2_05_ITEMS = [
    {"prompt": "No ACTIVE order block exists on either 4H or the 1H fallback.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 1,
     "explanation": "Gate 1 (zone availability) fails on both timeframes. None."},
    {"prompt": "An active 1H order block exists (gate 1 passes), but the current 15M price is not inside it, and no other active zone is.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 1,
     "explanation": "Gate 2 (inside-zone test) fails. None."},
    {"prompt": "An active 1H order block exists and price is inside it (gates 1-2 pass), but no 15M CHoCH forms at all -- even though a clean liquidity sweep and a matching FVG are both present.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample. Gate 3 (CHoCH detection) fails -- the soft sweep/FVG signals never override it. None."},
    {"prompt": "All three hard gates pass (active zone, price inside, CHoCH confirms direction). No sweep, no matching FVG.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 0,
     "explanation": "Sweep and FVG are soft signals -- their absence shapes the resulting signal's entry type (aggressive) and confidence (0.70), but never blocks it. A signal is produced."},
    {"prompt": "All three hard gates pass. A liquidity sweep and a matching active FVG are both present too (this lesson's own Worked Example).", "options": _B2_SIGNAL_OPTIONS, "correct_index": 0,
     "explanation": "All hard gates pass -- signal produced, this time with entry type mean and confidence 0.80."},
    {"prompt": "All three hard gates pass. A liquidity sweep is present, but zero matching active FVGs.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 0,
     "explanation": "FVG presence is purely a soft signal reflected in the reasoning text's \"FVG confirmation: 0 active\" -- it never gates the signal. Produced."},
    {"prompt": "4H has zero active order blocks, but the 1H fallback has an active, fresh one with price inside it, and a 15M CHoCH confirms direction.", "options": _B2_SIGNAL_OPTIONS, "correct_index": 0,
     "explanation": "The 1H fallback firing is itself a PASS of gate 1, not a failure -- it's the normal fallback path, not an exception. With gates 2-3 also passing, a signal is produced."},
]

# ---------------------------------------------------------------------------
# BOT2-06 — "Given four zone/sweep-status pairs (provided in
# Practise), determine which entry type Bot 2's logic would use for
# each and explain why."
# ---------------------------------------------------------------------------
BOT2_06_TITLE = "Entry: The Conditional Mean-or-Aggressive Entry"
_B2_ENTRY_OPTIONS = [
    "mean (zone.mean_threshold)",
    "aggressive (zone.bottom for a long / zone.top for a short)",
]
BOT2_06_ITEMS = [
    {"prompt": "Direction: long. has_sweep: True.", "options": _B2_ENTRY_OPTIONS, "correct_index": 0,
     "explanation": "entry_type = \"mean\" if has_sweep else \"aggressive\" -- has_sweep is True, so mean."},
    {"prompt": "Direction: long. has_sweep: False.", "options": _B2_ENTRY_OPTIONS, "correct_index": 1,
     "explanation": "No sweep -> aggressive. For a long, aggressive = zone.bottom (the deepest, most favorable discount price in the zone)."},
    {"prompt": "Direction: short. has_sweep: True.", "options": _B2_ENTRY_OPTIONS, "correct_index": 0,
     "explanation": "has_sweep is True -> mean, regardless of direction."},
    {"prompt": "Direction: short. has_sweep: False.", "options": _B2_ENTRY_OPTIONS, "correct_index": 1,
     "explanation": "No sweep -> aggressive. For a short, aggressive = zone.top (the highest, most favorable premium price in the zone)."},
]

# ---------------------------------------------------------------------------
# BOT2-07 — "Given three complete sweep/no-sweep scenarios (provided
# in Practise), calculate the exact stop price, stop distance, real
# tp1 take-profit target, and reported confidence for each." multi_calc,
# 4 linked fields. Item 2 (short, sweep) is built so
# extend_stop_beyond_zone's widening actually fires. All three
# hand-computed via a throwaway Python script that implements the real
# sweep_extreme / structure_swing branches exactly.
# ---------------------------------------------------------------------------
BOT2_07_TITLE = "Management: Sweep-Based vs. Structure-Based Stops"
BOT2_07_ITEMS = [
    {
        "title": "Trade 1 (long, sweep)",
        "given": "Entry (zone mean, has_sweep=True) = 1.08500. Swept 15M low (sweep_price) = 1.08300. Order block: bottom = 1.08400, top = 1.08600.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08246, "tolerance": 0.0001},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00254, "tolerance": 0.0001},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08754, "tolerance": 0.0001},
            {"label": "confidence", "ask": "Reported confidence", "unit": "", "correct_value": 0.80, "tolerance": 0.01},
        ],
        "explanation": (
            "buffer = sweep_price*0.0005 = 1.08300*0.0005 = 0.00054. raw sl = 1.08300-0.00054 = 1.082459. "
            "extend_stop_beyond_zone bound = 1.08400 - 0.1*(1.08600-1.08400) = 1.08380; already wider, unchanged. "
            "min-distance floor (1.08500*0.0015=0.00163) already cleared. This branch is NEVER rounded in the "
            "real code -- sl=1.082459 (~1.08246), sl_distance=0.002541 (~0.00254), tp1 = entry+sl_distance*1.0 "
            "= 1.087541 (~1.08754). confidence=0.80 because has_sweep=True."
        ),
    },
    {
        "title": "Trade 2 (short, sweep, zone-embedding widens the stop)",
        "given": "Entry (zone mean, has_sweep=True) = 1.26500. Swept 15M high (sweep_price) = 1.26550. Order block: bottom = 1.26600, top = 1.27000.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.27040, "tolerance": 0.0001},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00540, "tolerance": 0.0001},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.25960, "tolerance": 0.0001},
            {"label": "confidence", "ask": "Reported confidence", "unit": "", "correct_value": 0.80, "tolerance": 0.01},
        ],
        "explanation": (
            "buffer = 1.26550*0.0005 = 0.00063. raw sl = 1.26550+0.00063 = 1.266133. extend_stop_beyond_zone "
            "bound = 1.27000 + 0.1*(1.27000-1.26600) = 1.27040; max(1.266133, 1.27040) = 1.27040 -- genuinely "
            "WIDENED here, since the swept extreme sat inside the order block. sl_distance = 1.27040-1.26500 "
            "= 0.00540. tp1 = entry - sl_distance*1.0 = 1.25960. confidence=0.80 (has_sweep=True)."
        ),
    },
    {
        "title": "Trade 3 (long, no sweep)",
        "given": "Entry (zone.bottom, aggressive, has_sweep=False) = 1.08400. Most recent 15M swing point (either type) = 1.08200. Order block: bottom = 1.08400, top = 1.08600.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08037, "tolerance": 0.00003},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00363, "tolerance": 0.00003},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08763, "tolerance": 0.00003},
            {"label": "confidence", "ask": "Reported confidence", "unit": "", "correct_value": 0.70, "tolerance": 0.01},
        ],
        "explanation": (
            "No sweep -> structure_swing branch via calculate_stop_loss (identical formula to Bot 1): "
            "buffer = max(1.08200*0.001, 1.08400*0.0015) = max(0.00108, 0.001626) = 0.001626. raw sl = "
            "1.08200-0.001626 = 1.080374, rounded = 1.08037 (this branch DOES round, unlike the sweep branch). "
            "extend_stop_beyond_zone bound = 1.08400-0.1*(1.08600-1.08400) = 1.08380; min(1.08037,1.08380) = "
            "1.08037, unchanged. sl_distance = 1.08400-1.08037 = 0.00363. tp1 = 1.08400+0.00363 = 1.08763. "
            "confidence=0.70 (has_sweep=False)."
        ),
    },
]

# ---------------------------------------------------------------------------
# BOT2-08 — "Given five losing-trade case studies styled after Bot 2
# (provided in Practise), determine which are valid losses and which
# are bad losses, identifying the specific missing hard gate where
# relevant."
# ---------------------------------------------------------------------------
BOT2_08_TITLE = "Failure: What a Failed Bot 2 Setup Looks Like"
_B2_LOSS_OPTIONS = [
    "Valid loss -- all three hard gates genuinely passed, the trade just didn't work out",
    "Bad loss -- a hard gate was actually skipped or overridden",
]
BOT2_08_ITEMS = [
    {
        "prompt": "An active 1H order block existed, 15M price was inside it, and a 15M CHoCH confirmed direction. No liquidity sweep was present. The trade was taken at the zone's aggressive price and stopped out.",
        "options": _B2_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "All three hard gates passed; the missing sweep only affected entry type (aggressive) and confidence (0.70), never whether the trade could fire. A real, correctly-taken setup that lost.",
    },
    {
        "prompt": "An active 1H order block existed and 15M price was inside it, but no 15M CHoCH ever formed. The trader entered anyway, reasoning a clean liquidity sweep and matching FVG were \"confirmation enough.\" The trade lost.",
        "options": _B2_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 3 genuinely failed -- real analyze() returns None with no CHoCH, regardless of sweep/FVG. Those are soft signals that never substitute for a missing hard gate (this lesson's own Common Mistake).",
    },
    {
        "prompt": "An active 4H order block existed, but the current 15M price was well outside its range. The trader entered anyway because \"the zone was close enough.\" The trade lost.",
        "options": _B2_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 2 (inside-zone test) genuinely failed -- real analyze() would have returned None here with no fallback to 1H (4H's active_obs was non-empty). This was never a real Bot 2 setup.",
    },
    {
        "prompt": "4H had no active order blocks, so the 1H fallback was used correctly; the 1H zone was active, price was inside it, and a CHoCH confirmed direction, with a sweep and matching FVG both present. The trade was stopped out.",
        "options": _B2_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "The 1H fallback firing is itself a legitimate pass of gate 1 (BOT2-02), not a shortcut. All three gates genuinely passed. A valid loss.",
    },
    {
        "prompt": "The only nearby order block had already been tested twice (test_count=2) and was no longer eligible under the freshness filter, on either 4H or 1H. The trader entered a reversal at that same stale block anyway \"because it still looked like a real zone.\" The trade lost.",
        "options": _B2_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Gate 1 genuinely failed -- a block with test_count>1 is excluded by `status.name == \"ACTIVE\" and z.test_count <= 1`, so active_obs would have been empty on both timeframes. No real Bot 2 signal was ever possible here.",
    },
]

# ---------------------------------------------------------------------------
# BOT2-09 — "Given a full chart scenario (provided in Practise), work
# through all seven real steps to produce the exact entry price, stop
# price, real tp1 take-profit target, and confidence Bot 2's code
# would output." One multi_calc item, chaining all seven real steps,
# reusing BOT2-07 Trade 1's independently-verified sweep-branch numbers
# with the full upstream context (zone availability, inside-test,
# CHoCH direction, discount/premium check) added.
# ---------------------------------------------------------------------------
BOT2_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT2_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "4H has one ACTIVE, fresh (test_count<=1) bull-type order block: bottom = 1.08400, top = 1.08600.\n"
        "Current 15M close = 1.08500 (inside the zone).\n"
        "15M: the most recent CHoCH is bullish_choch.\n"
        "4H swing range for discount/premium: low = 1.08000, high = 1.09000.\n"
        "A liquidity sweep occurred 2 candles ago (inside the last-5-candle window), at sweep_price = 1.08300."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08500, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08246, "tolerance": 0.0001},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08754, "tolerance": 0.0001},
        {"label": "confidence", "ask": "Reported confidence", "unit": "", "correct_value": 0.80, "tolerance": 0.01},
    ],
    "explanation": (
        "Step 1: 4H active_obs is non-empty (one fresh ACTIVE block) -- used directly, no 1H fallback needed. "
        "Step 2: current price 1.08500 is inside 1.08400-1.08600 -- target_ob selected. Step 3: bullish_choch "
        "-> direction=long. Discount/premium: zone_center=1.08500, fib=(1.08500-1.08000)/(1.09000-1.08000)=0.50 "
        "-> equilibrium -- passes (only premium kills a long). Step 4: sweep 2 candles ago is inside the "
        "last-5 window -> has_sweep=True. Step 6: entry_type=mean -> entry=(1.08400+1.08600)/2=1.08500. "
        "Step 7 (sweep branch): buffer=1.08300*0.0005=0.00054; raw sl=1.08300-0.00054=1.082459, "
        "already past the zone-embed bound (1.08380) and the min-distance floor (0.00163). sl_distance = "
        "1.08500-1.082459 = 0.002541. tp1 = entry+sl_distance*1.0 = 1.087541. confidence=0.80 (has_sweep=True)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT2-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one producing None), work the complete Bot 2
# pipeline for each." classify kind, multiple-choice over candidate
# completed outcomes. Scenario 1 reuses BOT2-09's exact verified
# numbers; Scenario 2 is the required None case (gate 2); Scenario 3
# reuses BOT2-07 Trade 3's exact verified no-sweep numbers.
# ---------------------------------------------------------------------------
BOT2_10_TITLE = "Capstone: Full Bot 2 Decision Simulation"
BOT2_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1: 4H has one ACTIVE, fresh bull order block (1.08400-1.08600); current 15M price "
            "1.08500 is inside it. 15M's most recent CHoCH is bullish. The 4H discount/premium range "
            "(low=1.08000, high=1.09000) puts the zone at equilibrium. A sweep occurred 2 candles ago at "
            "sweep_price=1.08300. What does analyze() output?"
        ),
        "options": [
            "Long signal -- entry 1.08500, stop ~1.08246, tp1 ~1.08754, confidence 0.80 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08500, stop ~1.08246, tp1 ~1.09263, confidence 0.80 (tp1 at the bot's 3:1 default_rr)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "All three hard gates pass (zone available, price inside, CHoCH confirms, discount/premium clears). tp1 is always fixed at 1:1 R off sl_distance -- the bot's own default_rr=3.0 only ever reaches tp3, matching Bot 1's identical tp1 rule.",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): 4H has one ACTIVE, fresh order block at 1.09100-1.09300. "
            "Current 15M close is 1.08200 -- well outside that zone. No other 4H or 1H order blocks are "
            "ACTIVE and fresh. What does analyze() output?"
        ),
        "options": [
            "Long or short signal using the nearest order block's mean entry price",
            "A signal with reduced confidence, since price isn't cleanly inside the zone",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "4H's active_obs is non-empty (one fresh block), so the 1H fallback is never even attempted. inside_obs ends up empty because price sits outside the only available zone -- Gate 2 fails. None.",
    },
    {
        "prompt": (
            "Scenario 3 (long, no sweep): 4H has one ACTIVE, fresh order block (1.08400-1.08600). Current 15M "
            "price is inside it. 15M's most recent CHoCH is bullish. No liquidity sweep is present anywhere "
            "in the last 5 candles. The most recent 15M swing point (either type) is at 1.08200. What does "
            "analyze() output?"
        ),
        "options": [
            "Long signal -- entry 1.08400, stop 1.08037, tp1 1.08763, confidence 0.70 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08400, stop 1.08037, tp1 1.08400+3*0.00363=1.09489, confidence 0.70",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "No sweep -> entry_type=aggressive -> entry=zone.bottom=1.08400. structure_swing stop (identical formula to Trade 3 in BOT2-07) gives sl=1.08037, sl_distance=0.00363. tp1 = entry+sl_distance*1.0 = 1.08763 -- fixed 1:1, not the bot's 3.0 default_rr. confidence=0.70 since has_sweep=False.",
    },
]


async def seed_bot2_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT2_02_TITLE, "classify", BOT2_02_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_03_TITLE, "classify", BOT2_03_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_04_TITLE, "multi_calc", BOT2_04_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_05_TITLE, "classify", BOT2_05_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_06_TITLE, "classify", BOT2_06_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_07_TITLE, "multi_calc", BOT2_07_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_08_TITLE, "classify", BOT2_08_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_09_TITLE, "multi_calc", BOT2_09_ITEMS, bot_id="bot_2")
        count += await _upsert(db, BOT2_10_TITLE, "classify", BOT2_10_ITEMS, bot_id="bot_2")
        await db.commit()
        print(f"\n{count} of 9 Bot 2 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot2_scenarios())
    sys.exit(0)
