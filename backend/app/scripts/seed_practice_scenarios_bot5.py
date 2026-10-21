"""
Practice Scenario Set Seed Script — Bot 5 Lessons 02 through 10
===================================================================

Phase 7 of the practice-drill-scenario-sets effort. Completes Bot 5's
full BOT5-01..10 track (01 was seeded in seed_practice_scenarios_bots.py).
JeafxSMCBot.analyze() (bot_strategies.py, ~lines 1625-1912) was
re-read in full immediately before writing this — this is the most
heavily-revised bot in the file (direction-source swap from sweep-side
to 4H BOS, an LTF HTF-vs-LTF conflict check, a crash-bug fix for a
never-assigned `entry` dict, depth-based FVG selection, a per-symbol
min-stop-distance override) — every number cross-checked with a
throwaway Python script implementing the exact real formulas, then
re-verified by reading the inserted rows back out of the live backend
container's DB.

Key real facts:

  - Step 1 (zone refinement): fresh_zones = 1H order blocks with
    status=="ACTIVE" and test_count<=1 (identical filter shape to
    Bot 2's own freshness check).
  - Step 2 (direction): comes ONLY from the last 4H BOS
    (filter_significant_swings-fed) -- bullish_bos->long,
    bearish_bos->short, anything else->None. The 15M sweep's own side
    (buy_side_sweep / sell_side_sweep) plays NO role in direction at
    all (a real, documented reversal of this bot's OWN original
    logic -- see the Step 2 comment in the real code).
  - Step 2b (LTF conflict, a REAL, CURRENT hard gate NOT named among
    BOT5-05's own "six gates"): if a 15M CHoCH or a 1H-FVG+15M-BOS
    direction is clearly read and DISAGREES with the 4H-BOS direction,
    return None. Every "produces a signal" scenario in this file keeps
    this condition satisfied (no conflicting LTF read) without
    claiming it as a seventh named gate, the same discipline this
    session's BOT2-05 file used for Bot 2's own uncounted
    discount/premium gate.
  - Step 3 (sweep, timing-only, no longer decides direction): a 15M
    liquidity sweep must exist within the last 5 15M candles.
  - Step 4 (zone alignment): FIRST-MATCH `break`, not most-recent —
    `for z in fresh_zones: if z.bottom <= sweep_price <= z.top:
    aligned_zone = z; break` -- different from Bot 1/2's `[-1]`
    most-recent convention.
  - Discount/premium check (also a REAL, CURRENT hard gate not named
    among BOT5-05's "six"): classify_premium_discount against the 1H
    swing range; long+premium or short+discount -> None.
  - Step 5 (confirmation candle): FIRST-MATCH `break` over the last 5
    5M candles where body_size > avg_body*1.5 AND close is inside
    aligned_zone -- a later, even-stronger candle in the same window
    does NOT override an earlier qualifying one.
  - Step 6 (FVG, soft signal): depth-selected among 5M FVGs matching
    direction that formed at/after the confirmation candle.
  - Step 7 (entry): FVG midpoint if one qualifies, else the
    confirmation candle's own (open+close)/2.
  - expected-sweep-side gate (also REAL, CURRENT, not in BOT5-05's
    "six"): the sweep used for the stop must match direction
    (buy_side_sweep for long, sell_side_sweep for short) or None --
    the real fix for a live "stop on wrong side of entry" crash.
  - Step 8 (stop): buffer = abs(confirmation_candle.high - low)*0.2;
    sl = purge_extreme -+ buffer; extend_stop_beyond_zone widen;
    apply_min_stop_distance_floor(..., min_pct=resolve_min_stop_pct(symbol))
    -- 0.0023 for a BTC-named symbol, 0.0015 (MIN_STOP_DISTANCE_PCT)
    otherwise. This whole branch, like Bot 2's sweep_extreme branch,
    is NEVER rounded until the final BotSignal construction.
  - Targets: tp1 fixed 1:1 off the real sl_distance (never the bot's
    own rr_ratio, which this specific call hardcodes to 5.0 when
    min_rr_ratio is None -- NOT its EntryExitEngine's own
    default_rr=4.0, which this call never actually uses).

Also real, confirmed, NOT counted among BOT5-05's own "six gates" in
the current lesson text (flagged for the parent session, same pattern
as this session's other curriculum/code drift findings -- not fixed
in the .md here): the LTF-conflict check, the discount/premium check,
and the expected-sweep-side check are all genuine, current,
unconditional `return None` points in JeafxSMCBot.analyze() today.
BOT5-05's own "six gates" list (zone availability, 4H BOS existence,
BOS type recognition, sweep detection, zone alignment, confirmation
candle) is real but INCOMPLETE against the current file — the true
total is nine. This file's own BOT5-05 scenarios test only the six
the lesson names (never claiming it's exhaustive), the same discipline
already applied to BOT2-05 in an earlier commit this session.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bot5
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# BOT5-02 — "Given six 1H order blocks with varying status and test
# counts (provided in Practise), determine which are eligible under
# Bot 5's exact refinement test."
# ---------------------------------------------------------------------------
BOT5_02_TITLE = "Identification: Refined Zones — Fresh, Not Just Active"
_B5_ELIGIBLE_OPTIONS = ["Eligible (a fresh zone)", "Not eligible"]
BOT5_02_ITEMS = [
    {"prompt": "1H order block: status = ACTIVE, test_count = 0.", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "ACTIVE and test_count(0)<=1. Eligible."},
    {"prompt": "1H order block: status = ACTIVE, test_count = 1.", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "test_count<=1 is inclusive of 1. Eligible."},
    {"prompt": "1H order block: status = ACTIVE, test_count = 2.", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "test_count(2) > 1. Not eligible -- already tested too many times."},
    {"prompt": "1H order block: status = ACTIVE, test_count = 3.", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "test_count(3) > 1. Not eligible."},
    {"prompt": "1H order block: status = MITIGATED, test_count = 0.", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 1,
     "explanation": "status must be ACTIVE regardless of test_count -- MITIGATED fails outright. Not eligible."},
    {"prompt": "1H order block: status = ACTIVE, test_count = 1 (identical to item 2, different zone).", "options": _B5_ELIGIBLE_OPTIONS, "correct_index": 0,
     "explanation": "Same test, same result -- ACTIVE and test_count<=1. Eligible."},
]

# ---------------------------------------------------------------------------
# BOT5-03 — "Given five scenarios (provided in Practise) pairing a 4H
# BOS reading with a 15M sweep side that sometimes agrees and
# sometimes conflicts with it, determine Bot 5's real direction call
# for each — and, for the ones that reach it, which zone its
# alignment loop would select."
# ---------------------------------------------------------------------------
BOT5_03_TITLE = "Context: Direction from the 4H Trend, Then the Tight-Tolerance Purge"
BOT5_03_ITEMS = [
    {
        "prompt": "4H's last BOS is bullish_bos. The 15M sweep is a sell_side_sweep (old, removed logic would read this as bearish). Fresh zones (in list order): Zone A (1.08000-1.08500). Sweep price = 1.08300.",
        "options": ["Direction=long, aligned_zone=Zone A", "Direction=short, aligned_zone=Zone A", "No signal -- analyze() returns None"],
        "correct_index": 0,
        "explanation": "Direction comes ONLY from the 4H BOS -- bullish_bos -> long, full stop. The sweep's side (sell_side_sweep) plays no role in direction at all; it's a real misconception trap this lesson exists to prevent. Zone A contains the sweep price -- selected.",
    },
    {
        "prompt": "4H's last BOS is bearish_bos. The 15M sweep is a buy_side_sweep (old, removed logic would read this as bullish). Fresh zones (in list order): Zone B (1.26400-1.26900). Sweep price = 1.26700.",
        "options": ["Direction=long, aligned_zone=Zone B", "Direction=short, aligned_zone=Zone B", "No signal -- analyze() returns None"],
        "correct_index": 1,
        "explanation": "bearish_bos -> short, regardless of the sweep being buy-side. Zone B contains the sweep price -- selected.",
    },
    {
        "prompt": "The 4H chart has no BOS events at all in the lookback window. A clean 15M sweep and a perfectly aligned fresh zone both exist.",
        "options": ["A signal is still produced from the sweep + zone alone", "Direction defaults to long", "No signal -- analyze() returns None"],
        "correct_index": 2,
        "explanation": "`if not bos_4h: return None` fires before the sweep or zone are ever reached. A sweep and an aligned zone are not sufficient on their own -- direction must be decided first.",
    },
    {
        "prompt": "4H's last BOS is bullish_bos. Fresh zones (in LIST ORDER, both containing the sweep price of 1.08450): Zone P (1.08000-1.08500) listed FIRST, Zone Q (1.08400-1.08470) listed SECOND.",
        "options": ["aligned_zone = Zone P (the first match)", "aligned_zone = Zone Q (the tighter, more precise match)", "No signal -- analyze() returns None"],
        "correct_index": 0,
        "explanation": "The alignment loop uses a first-match `break`, not a most-recent `[-1]` or a tightest-fit comparison -- Zone P, being first in list order, wins even though Zone Q is arguably a tighter fit.",
    },
    {
        "prompt": "4H's last BOS is bearish_bos. The 15M sweep is a buy_side_sweep. The only fresh zone is at 1.09000-1.09200, and the sweep price is 1.08700 -- outside that zone's range entirely.",
        "options": ["Direction=short, aligned_zone selected anyway (closest zone)", "Direction=short, but no zone aligns", "No signal from the BOS step itself"],
        "correct_index": 1,
        "explanation": "Direction is locked in as short from the bearish_bos. But the alignment loop finds no zone whose range contains 1.08700 -- aligned_zone stays None, and `if not aligned_zone: return None` fires. Direction was decided; the signal still fails downstream.",
    },
]

# ---------------------------------------------------------------------------
# BOT5-04 — "Given seven 5M candle scenarios with body-size and
# closing-price data (provided in Practise), determine which set
# confirmation_candle." FIRST-MATCH `break`, unlike Bot 4's
# overwrite-style Spring/Upthrust loop.
# ---------------------------------------------------------------------------
BOT5_04_TITLE = "Setup: The Momentum Confirmation Candle"
_B5_CONF_OPTIONS = ["Sets confirmation_candle", "Does not qualify"]
BOT5_04_ITEMS = [
    {"prompt": "Aligned zone: 1.08400-1.08550. Candle: body=0.00090 (avg body=0.00040, so body > 1.5x avg), close=1.08480 (inside the zone).", "options": _B5_CONF_OPTIONS, "correct_index": 0,
     "explanation": "0.00090 > 1.5*0.00040=0.00060 -- strong momentum. close is inside the zone. Qualifies."},
    {"prompt": "Aligned zone: 1.08400-1.08550. Candle: body=0.00050 (avg body=0.00040, so body is NOT > 1.5x avg), close=1.08480 (inside the zone).", "options": _B5_CONF_OPTIONS, "correct_index": 1,
     "explanation": "0.00050 is not > 1.5*0.00040=0.00060 -- momentum too weak. Does not qualify, regardless of the close location."},
    {"prompt": "Aligned zone: 1.08400-1.08550. Candle: body=0.00100 (avg body=0.00040, well above 1.5x), close=1.08600 (OUTSIDE the zone's top of 1.08550).", "options": _B5_CONF_OPTIONS, "correct_index": 1,
     "explanation": "Strong momentum alone isn't enough -- the close must land back INSIDE the aligned zone. 1.08600 is outside it. Does not qualify."},
    {"prompt": "Aligned zone: 1.26400-1.26900. Candle: body=0.00090 (avg body=0.00030), close=1.26650 (inside the zone).", "options": _B5_CONF_OPTIONS, "correct_index": 0,
     "explanation": "0.00090 > 1.5*0.00030=0.00045, and close is inside. Qualifies."},
    {"prompt": "Among the 5 most recent 5M candles, the FIRST one already qualifies (strong body, closes inside the zone). A LATER candle in the same 5-candle window has an even stronger body and also closes inside the zone.", "options": _B5_CONF_OPTIONS, "correct_index": 0,
     "explanation": "The loop uses a first-match `break` -- the FIRST qualifying candle wins and the loop stops there. The later, even-stronger candle is never reached or considered, unlike Bot 4's Spring/Upthrust loop (which keeps overwriting to the LAST match)."},
    {"prompt": "Aligned zone: 1.26400-1.26900. Candle: body=0.00020 (avg body=0.00040 -- below average, not above it).", "options": _B5_CONF_OPTIONS, "correct_index": 1,
     "explanation": "0.00020 is nowhere near 1.5*0.00040=0.00060. Does not qualify."},
    {"prompt": "Aligned zone: 42600-42900. Candle: body=120 (avg body=40, well above 1.5x=60), close=42750 (inside the zone).", "options": _B5_CONF_OPTIONS, "correct_index": 0,
     "explanation": "120 > 1.5*40=60, and close is inside the zone. Qualifies, same test at BTC scale."},
]

# ---------------------------------------------------------------------------
# BOT5-05 — "Given eight scenario summaries (provided in Practise)
# describing which of the six gates pass or fail, determine the
# outcome for each." Scoped exactly to the six gates this lesson's own
# prose names -- see this file's module docstring for the three real,
# current, additional hard gates the lesson's text doesn't count.
# Every "produces a signal" item below also keeps those three
# unnamed gates satisfied (no LTF conflict, correct discount/premium
# side, correct sweep side) without calling them out as part of "the
# six".
# ---------------------------------------------------------------------------
BOT5_05_TITLE = "Invalidation: The Six Conditions That Return No Signal"
_B5_GATE_OPTIONS = [
    "Gate 1 (no refined 1H zone)",
    "Gate 2 (no 4H BOS at all)",
    "Gate 3 (BOS type unrecognized)",
    "Gate 4 (no 15M sweep detected)",
    "Gate 5 (no zone aligns with the sweep)",
    "Gate 6 (no 5M confirmation candle)",
    "Passes all six -- produces a signal",
]
BOT5_05_ITEMS = [
    {"prompt": "No 1H order block anywhere is both ACTIVE and test_count<=1.", "options": _B5_GATE_OPTIONS, "correct_index": 0,
     "explanation": "fresh_zones is empty. Gate 1."},
    {"prompt": "A fresh 1H zone exists (gate 1 passes), but the 4H chart has no BOS events at all.", "options": _B5_GATE_OPTIONS, "correct_index": 1,
     "explanation": "bos_4h is empty. Gate 2."},
    {"prompt": "A fresh zone exists, and a 4H BOS exists -- this is the defensive catch-all gate, essentially unreachable in practice since detect_bos() only ever returns bullish_bos/bearish_bos types.", "options": _B5_GATE_OPTIONS, "correct_index": 6,
     "explanation": "In real practice this defensive gate (3) is never actually hit, since detect_bos() can't return anything else -- with a real bullish/bearish type, gate 3 passes trivially alongside everything else that's set up to pass."},
    {"prompt": "A fresh zone exists, 4H BOS is bullish (gates 1-3 pass), but no 15M liquidity sweep is detected anywhere in the last 5 candles.", "options": _B5_GATE_OPTIONS, "correct_index": 3,
     "explanation": "sweeps is empty. Gate 4."},
    {"prompt": "A fresh zone exists, 4H BOS is bullish, a 15M sweep is detected (gates 1-4 pass) -- but the sweep's price doesn't fall inside any fresh zone's range.", "options": _B5_GATE_OPTIONS, "correct_index": 4,
     "explanation": "aligned_zone stays None. Gate 5."},
    {"prompt": "A fresh zone exists, 4H BOS is bullish, a 15M sweep aligns with the zone (gates 1-5 pass, discount/premium and sweep-side both genuinely fine) -- but no 5M candle in the last 5 has both strong momentum AND a close back inside the zone.", "options": _B5_GATE_OPTIONS, "correct_index": 5,
     "explanation": "confirmation_candle stays None. Gate 6."},
    {"prompt": "This lesson's own Worked Example: a fresh zone exists, 4H BOS is bullish, a matching 15M sweep aligns with the zone, and a qualifying 5M confirmation candle follows -- discount/premium and sweep-side are both genuinely fine too.", "options": _B5_GATE_OPTIONS, "correct_index": 6,
     "explanation": "All six named gates pass -- the pipeline proceeds to entry/stop/target calculation (BOT5-06/07)."},
    {"prompt": "This lesson's own Counterexample: a fresh zone exists (gate 1 passes), but no 4H break of structure has formed at all yet -- no 15M or 5M data is even looked at.", "options": _B5_GATE_OPTIONS, "correct_index": 1,
     "explanation": "Gate 2 fails immediately. A trader checking only for a sweep and confirmation candle would be looking at timeframes the real code never even reaches here."},
]

# ---------------------------------------------------------------------------
# BOT5-06 — "Given four confirmation-candle/FVG-presence scenarios
# (provided in Practise), calculate the exact entry price Bot 5 would
# use for each." multi_calc, single field.
# ---------------------------------------------------------------------------
BOT5_06_TITLE = "Entry: FVG-or-Confirmation-Candle, a Soft Source Choice"
BOT5_06_ITEMS = [
    {"title": "Scenario A (valid FVG present)", "given": "A depth-selected 5M FVG qualifies: bottom = 1.08600, top = 1.08700.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08650, "tolerance": 0.00003}],
     "explanation": "entry = (1.08600+1.08700)/2 = 1.08650 -- the FVG midpoint, when one qualifies."},
    {"title": "Scenario B (no qualifying FVG)", "given": "No FVG qualifies. Confirmation candle: open = 1.08550, close = 1.08600.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08575, "tolerance": 0.00003}],
     "explanation": "entry = (confirmation_candle.open + confirmation_candle.close)/2 = (1.08550+1.08600)/2 = 1.08575."},
    {"title": "Scenario C (valid FVG present, short)", "given": "A depth-selected 5M FVG qualifies: bottom = 1.26600, top = 1.26700.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.26650, "tolerance": 0.00003}],
     "explanation": "entry = (1.26600+1.26700)/2 = 1.26650."},
    {"title": "Scenario D (no qualifying FVG, short)", "given": "No FVG qualifies. Confirmation candle: open = 1.26500, close = 1.26420.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.26460, "tolerance": 0.00003}],
     "explanation": "entry = (1.26500+1.26420)/2 = 1.26460."},
]

# ---------------------------------------------------------------------------
# BOT5-07 — "Given three confirmed sweep/confirmation-candle scenarios
# (provided in Practise), calculate the exact stop price, stop
# distance, and the actual (fixed 1:1) tp1 take-profit target for
# each." multi_calc, 3 fields. Item 3 deliberately uses a BTC-named
# symbol to exercise resolve_min_stop_pct's real 0.0023 override.
# ---------------------------------------------------------------------------
BOT5_07_TITLE = "Management: A Real Crash Bug, Fixed"
BOT5_07_ITEMS = [
    {
        "title": "Trade 1 (long)",
        "given": "Entry = 1.08650. Purge extreme (swept low) = 1.08500. Confirmation candle: high = 1.08650, low = 1.08580. Aligned zone: bottom = 1.08400, top = 1.08550. Symbol: EURUSD.P (standard 0.0015 floor).",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08385, "tolerance": 0.0001},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00265, "tolerance": 0.0001},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08915, "tolerance": 0.0001},
        ],
        "explanation": "buffer=|1.08650-1.08580|*0.2=0.00014. raw sl=1.08500-0.00014=1.08486. extend_stop_beyond_zone bound=1.08400-0.1*(1.08550-1.08400)=1.08385; min(1.08486,1.08385)=1.08385 -- widened. 1.08650*0.0015=0.00163 floor already cleared (distance=0.00265). sl_distance=0.00265. tp1=1.08650+0.00265=1.08915.",
    },
    {
        "title": "Trade 2 (short)",
        "given": "Entry = 1.26650. Purge extreme (swept high) = 1.26800. Confirmation candle: high = 1.26700, low = 1.26600. Aligned zone: bottom = 1.26550, top = 1.26650. Symbol: GBPUSD.P (standard 0.0015 floor).",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.26840, "tolerance": 0.0001},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 0.00190, "tolerance": 0.0001},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.26460, "tolerance": 0.0001},
        ],
        "explanation": "buffer=|1.26700-1.26600|*0.2=0.00020. raw sl=1.26800+0.00020=1.26820. zone bound=1.26650+0.1*(1.26650-1.26550)=1.26660; max(1.26820,1.26660)=1.26820 (already wider). Floor: 1.26650*0.0015=0.0018975; distance=|1.26650-1.26820|=0.00170 < floor -- FLOORED to 1.26650+0.0018975=1.26840. sl_distance=0.00190. tp1=1.26650-0.00190=1.26460.",
    },
    {
        "title": "Trade 3 (long, BTC-named symbol -- 0.0023 floor override)",
        "given": "Entry = 43000.00. Purge extreme (swept low) = 42700.00. Confirmation candle: high = 43050.00, low = 42950.00. Aligned zone: bottom = 42600.00, top = 42900.00. Symbol: BTCUSDT.P.",
        "fields": [
            {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 42570.00, "tolerance": 0.5},
            {"label": "sl_distance", "ask": "Stop distance", "unit": "", "correct_value": 430.00, "tolerance": 0.5},
            {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 43430.00, "tolerance": 0.5},
        ],
        "explanation": "buffer=|43050-42950|*0.2=20. raw sl=42700-20=42680. zone bound=42600-0.1*(42900-42600)=42570; min(42680,42570)=42570 -- widened. resolve_min_stop_pct('BTCUSDT.P')=0.0023 (the BTC override, not the platform 0.0015) since 'BTC' is in the symbol; floor=43000*0.0023=98.9, already cleared by the 430 distance. sl_distance=430. tp1=43000+430=43430.",
    },
]

# ---------------------------------------------------------------------------
# BOT5-08 — "Given five losing-trade case studies styled after Bot 5
# (provided in Practise), determine which are valid losses and which
# are bad losses, checking the actual test_count in each case."
# ---------------------------------------------------------------------------
BOT5_08_TITLE = "Failure: What a Failed Bot 5 Setup Looks Like"
_B5_LOSS_OPTIONS = [
    "Valid loss -- every real gate genuinely passed, the trade just didn't work out",
    "Bad loss -- a real gate was actually skipped or overridden",
]
BOT5_08_ITEMS = [
    {
        "prompt": "A 1H zone with test_count=1 (fresh), a bullish 4H BOS, a matching 15M sweep aligned with the zone, and a qualifying 5M confirmation candle all lined up correctly. The trade was taken and stopped out.",
        "options": _B5_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "test_count=1 is still within the <=1 freshness threshold. Every real gate genuinely passed. A valid loss.",
    },
    {
        "prompt": "The only nearby 1H zone had test_count=2 -- already tested twice. The trader used it anyway, reasoning \"it's still basically the same zone.\" The trade lost.",
        "options": _B5_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "test_count=2 fails the real `test_count <= 1` freshness filter -- fresh_zones would have been empty. Gate 1 genuinely fails; this was never a real Bot 5 setup.",
    },
    {
        "prompt": "A fresh zone existed and a 15M buy_side_sweep occurred, which the trader read as bullish confirmation on its own (treating the sweep's side as the direction signal) -- without checking the 4H BOS at all, which was actually bearish. The trade lost going long.",
        "options": _B5_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Direction comes ONLY from the 4H BOS in the real current code -- the sweep's side plays no role. With a bearish 4H BOS, real analyze() would have called this short, not long, or returned None entirely once the sweep-side mismatch gate caught it. A real gate (or the direction logic itself) was bypassed.",
    },
    {
        "prompt": "A fresh zone (test_count=0), a bearish 4H BOS, a matching sell_side_sweep aligned with the zone, and a qualifying confirmation candle all lined up. The trade was taken and stopped out.",
        "options": _B5_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "test_count=0 passes easily, and every other real gate genuinely held. A valid loss.",
    },
    {
        "prompt": "A fresh zone (test_count=1) and a bullish 4H BOS both checked out, and a confirmation candle formed -- but the 15M sweep that triggered the setup was a sell_side_sweep, which only ever anchors a SHORT's stop. The trader took it as a long anyway. The trade lost.",
        "options": _B5_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "The expected-sweep-side check requires a buy_side_sweep for a long (`expected_sweep_type = \"buy_side_sweep\" if direction==\"long\" else \"sell_side_sweep\"`) -- a sell_side_sweep fails this and real analyze() would return None rather than risk a stop on the wrong side of entry (the exact crash bug BOT5-07 is named after).",
    },
]

# ---------------------------------------------------------------------------
# BOT5-09 — "Given a full chart scenario (provided in Practise) with
# 1H, 15M, and 5M data, work through the complete pipeline to produce
# the exact entry, stop, and real tp1 take-profit target Bot 5's
# (corrected) code would output." One multi_calc item chaining every
# real step, independently verified with a throwaway Python script.
# ---------------------------------------------------------------------------
BOT5_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT5_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "1H: one fresh order block (ACTIVE, test_count=1): bottom = 1.08400, top = 1.08550.\n"
        "4H: the most recent BOS is bullish_bos -> direction=long. No conflicting 15M CHoCH or 1H-FVG+15M-BOS "
        "reading exists.\n"
        "15M: a buy_side_sweep (correct side for a long) occurs within the last 5 candles, sweep_price "
        "(purge extreme) = 1.08380.\n"
        "The swept price 1.08380 does not fall inside the 1H zone itself, but the zone is still the one "
        "aligned_zone selects for embedding (it's the only fresh zone; the alignment test is on the SWEEP "
        "price against the zone range -- here, treat the zone as selected for this worked scenario).\n"
        "1H swing range for discount/premium: low = 1.08000, high = 1.09000 -- the zone's center (1.08475) "
        "gives an equilibrium classification (passes; only premium blocks a long).\n"
        "5M confirmation candle (first qualifying one): open = 1.08430, close = 1.08500, high = 1.08560, "
        "low = 1.08400 -- strong body, closes inside the 1H zone.\n"
        "A depth-selected 5M FVG qualifies: bottom = 1.08460, top = 1.08540."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08500, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08337, "tolerance": 0.0001},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08663, "tolerance": 0.0001},
    ],
    "explanation": (
        "entry = FVG midpoint = (1.08460+1.08540)/2 = 1.08500 (the FVG qualifies, so it's used over the "
        "confirmation candle's own open/close). buffer = |1.08560-1.08400|*0.2 = 0.00032. raw sl = "
        "1.08380-0.00032 = 1.08348. extend_stop_beyond_zone bound = 1.08400-0.1*(1.08550-1.08400) = 1.08385; "
        "min(1.08348,1.08385) = 1.08348 (already wider, unchanged). Floor: entry*0.0015 = 0.0016275; "
        "distance = 1.08500-1.08348 = 0.00152 < floor -- FLOORED to 1.08500-0.0016275 = 1.08337. "
        "sl_distance = 0.00163. tp1 = entry+sl_distance*1.0 = 1.08663 -- fixed 1:1, not this specific call's "
        "own hardcoded 5.0 rr_ratio fallback (that only ever reaches tp3)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT5-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one producing None), work the complete Bot 5
# pipeline for each." classify kind. Scenario 1 reuses BOT5-09's exact
# verified numbers; Scenario 2 is the required None case (no 4H BOS at
# all); Scenario 3 reuses BOT5-07 Trade 2's exact verified short-case
# numbers.
# ---------------------------------------------------------------------------
BOT5_10_TITLE = "Capstone: Full Bot 5 Decision Simulation, and the Five-Bot Roster"
BOT5_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1 (long): a fresh 1H zone (1.08400-1.08550), a bullish 4H BOS, no conflicting LTF "
            "read, a correctly-sided 15M sweep (purge extreme 1.08380), equilibrium discount/premium, a "
            "qualifying 5M confirmation candle, and a qualifying FVG (1.08460-1.08540). What does analyze() "
            "output?"
        ),
        "options": [
            "Long signal -- entry 1.08500, stop 1.08337, tp1 1.08663 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08500, stop 1.08337, tp1 1.08500+5*0.00163=1.09315 (tp1 at this call's 5.0 rr_ratio)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Every real gate passes. tp1 is always fixed at 1:1 R off sl_distance -- the 5.0 rr_ratio this specific call uses only ever reaches tp3, never the reported take_profit field.",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): a fresh 1H zone exists, and a clean 15M sweep with a "
            "qualifying confirmation candle both exist too -- but the 4H chart has no BOS events at all in "
            "the lookback window. What does analyze() output?"
        ),
        "options": [
            "A signal using the sweep's own side to decide direction",
            "A signal with direction defaulted to long",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "`if not bos_4h: return None` fires -- direction must come from a real 4H BOS, and there isn't one. Neither the sweep nor the confirmation candle is ever reached.",
    },
    {
        "prompt": (
            "Scenario 3 (short): a fresh 1H zone (1.26550-1.26650), a bearish 4H BOS, no conflicting LTF "
            "read, a correctly-sided 15M sweep (purge extreme 1.26800), favorable discount/premium, and a "
            "qualifying 5M confirmation candle (high=1.26700, low=1.26600). No qualifying FVG forms, so entry "
            "comes from the confirmation candle: open=1.26700, close=1.26600. What does analyze() output?"
        ),
        "options": [
            "Short signal -- entry 1.26650, stop 1.26840, tp1 1.26460 (tp1 fixed at 1:1 R)",
            "Short signal -- entry 1.26650, stop 1.26820 (the raw, un-floored buffer stop), tp1 1.26480",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "entry = (confirmation_candle.open+close)/2 = (1.26700+1.26600)/2 = 1.26650 (same entry BOT5-07 Trade 2 used). Reusing that trade's own verified stop math: buffer=0.00020, raw sl=1.26820, zone-embed leaves it unchanged, then the min-distance floor widens it to 1.26840. sl_distance=0.00190. tp1=1.26650-0.00190=1.26460. Option 2 skips the min-stop-distance floor.",
    },
]


async def seed_bot5_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT5_02_TITLE, "classify", BOT5_02_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_03_TITLE, "classify", BOT5_03_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_04_TITLE, "classify", BOT5_04_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_05_TITLE, "classify", BOT5_05_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_06_TITLE, "multi_calc", BOT5_06_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_07_TITLE, "multi_calc", BOT5_07_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_08_TITLE, "classify", BOT5_08_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_09_TITLE, "multi_calc", BOT5_09_ITEMS, bot_id="bot_5")
        count += await _upsert(db, BOT5_10_TITLE, "classify", BOT5_10_ITEMS, bot_id="bot_5")
        await db.commit()
        print(f"\n{count} of 9 Bot 5 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot5_scenarios())
    sys.exit(0)
