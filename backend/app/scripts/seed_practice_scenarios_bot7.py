"""
Practice Scenario Set Seed Script — Bot 7 Lessons 02 through 10
===================================================================

Phase 9 of the practice-drill-scenario-sets effort. Completes Bot 7's
full BOT7-01..10 track (01 was seeded in seed_practice_scenarios_bots.py).
FVGExpansionV3Bot.analyze() (bot_strategies.py, ~lines 898-986) was
re-read in full immediately before writing this, directly alongside
FVGExpansionBot's (Bot 3's) own analyze() — the same reading already
used for BOT7-01's paired-snippet comparison and BOT3-0X's own files.
Unlike Bots 4/5/6, no curriculum/code drift was found in Bot 7's own
BOT7-05 gate-count lesson — it was independently re-verified against
current source and matches exactly (four real `return None` points,
confirmed by direct line-by-line reading).

One real exception, consistent with (not separate from) BOT3-07's
already-documented drift: BOT7-07's own authored Worked Example reuses
the IDENTICAL stale FVG (1.0900-1.0920, stop 1.0898, 12-pip distance)
BOT3-07's pre-correction text used, before
apply_min_stop_distance_floor was added to this shared formula. This
file's BOT7-07 items reuse BOT3-07's own already-corrected,
floor-adjusted numbers directly (confirmed identical formula: Bot 7's
stop path calls `apply_min_stop_distance_floor(entry_price, sl_price,
direction)` with NO `min_pct` override, i.e. the same default 0.0015
Bot 3 uses — unlike Bot 5/6's per-symbol `resolve_min_stop_pct`).

Key real facts, re-confirmed directly against current source:

  - Step 1 (FVG eligibility): IDENTICAL to Bot 3 -- partial_fvgs =
    1H FVGs with 0.3<=mitigated_percent<=0.7 and status==ACTIVE.
  - Step 2 (direction, Real Difference #1): 15M BOS is read FIRST,
    fed through filter_significant_swings (Bot 3's own BOS read is
    NOT filtered this way) -- bullish_bos->long, bearish_bos->short,
    direction decided BEFORE any FVG is chosen (the reverse of Bot
    3's FVG-first order).
  - Step 3 (selection, Real Difference #2): among partial_fvgs
    matching the already-confirmed direction, select_fvg_by_depth
    picks the LOWEST bottom for a long, the HIGHEST top for a short
    (smc_algorithms.py lines 666-683 -- re-read directly: `min(fvgs,
    key=lambda f: f.bottom)` / `max(fvgs, key=lambda f: f.top)`, NOT
    a comparison of each gap's own span/width).
  - Step 4 (entry): (top+bottom)/2, identical to Bot 3.
  - Step 5 (stop): 10%-of-FVG-size buffer + the DEFAULT
    apply_min_stop_distance_floor (0.0015, no per-symbol override).
  - Targets: tp1 fixed 1:1 (never the bot's own rr_ratio=4.0 default,
    which only reaches tp3). confidence=0.82, setup_quality=1.15 --
    identical to Bot 3.

Every number cross-checked with a throwaway Python script
implementing the exact real formulas, then re-verified by reading the
inserted rows back out of the live backend container's DB.

Run after seed_practice_scenarios_bot3.py (imports its item lists):
    python -m app.scripts.seed_practice_scenarios_bot7
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert
from app.scripts.seed_practice_scenarios_bot3 import BOT3_02_ITEMS, BOT3_07_ITEMS

# ---------------------------------------------------------------------------
# BOT7-02 — identical eligibility test to BOT3-02. Reused directly, as
# the lesson's own prompt instructs ("the same scenario set as
# BOT3-02 ... confirm the answer matches Bot 3's").
# ---------------------------------------------------------------------------
BOT7_02_TITLE = "Identification: The Same 30-70% Mitigation Window"
BOT7_02_ITEMS = BOT3_02_ITEMS

# ---------------------------------------------------------------------------
# BOT7-03 — "Given five scenarios (provided in Practise) each listing
# several eligible 1H FVGs plus a real 15M swing sequence, work out
# what Bot 3 would pick (most-recent-FVG-first) versus what Bot 7
# would pick (direction-first), and identify any case where they'd
# disagree."
# ---------------------------------------------------------------------------
BOT7_03_TITLE = "Context: Direction-First, Not FVG-First (Real Difference #1)"
BOT7_03_ITEMS = [
    {
        "prompt": (
            "Eligible 1H FVGs (list order): FVG A (bullish, 1.08000-1.08200), FVG B (bearish, 1.09000-1.09500, "
            "listed LAST/most recent). 15M BOS (significant-swing-filtered): bullish_bos."
        ),
        "options": [
            "Agree -- both produce the same signal",
            "Disagree -- Bot 3 returns None, Bot 7 produces a long signal using FVG A",
            "Disagree -- Bot 3 produces a signal, Bot 7 returns None",
        ],
        "correct_index": 1,
        "explanation": "Bot 3 picks partial_fvgs[-1]=FVG B first, THEN checks agreement: FVG B is bearish but last_bos is bullish_bos -- mismatch, None. Bot 7 decides direction=long FIRST from the bullish_bos, then looks among ALL eligible FVGs for a bullish match -- FVG A qualifies, producing a real signal Bot 3 never finds.",
    },
    {
        "prompt": "Eligible 1H FVGs: just FVG C (bullish, 1.08000-1.08200), the only one. 15M BOS: bullish_bos.",
        "options": [
            "Agree -- both use FVG C, same signal",
            "Disagree -- different FVGs selected",
            "Disagree -- one returns None, the other doesn't",
        ],
        "correct_index": 0,
        "explanation": "With only one eligible FVG, Bot 3's recency pick and Bot 7's direction-first-then-depth pick land on the same candidate either way. Agree.",
    },
    {
        "prompt": (
            "Eligible 1H FVGs (list order): FVG D (bullish, bottom=1.08100, top=1.08300) listed first, FVG E "
            "(bullish, bottom=1.08500, top=1.08600) listed LAST/most recent. 15M BOS: bullish_bos."
        ),
        "options": [
            "Agree -- both use FVG E",
            "Disagree -- Bot 3 uses FVG E, Bot 7 uses FVG D",
            "Disagree -- Bot 3 returns None, Bot 7 uses FVG D",
        ],
        "correct_index": 1,
        "explanation": "Bot 3 picks partial_fvgs[-1]=FVG E (most recent) -- it matches the bullish_bos, so Bot 3 signals using FVG E (entry 1.08550). Bot 7 decides direction=long, then applies select_fvg_by_depth over BOTH candidates: min(bottom) between 1.08100 and 1.08500 is FVG D's 1.08100 -- Bot 7 signals using FVG D (entry 1.08200) instead. Same direction, genuinely DIFFERENT FVG and entry price.",
    },
    {
        "prompt": "Eligible 1H FVGs: just FVG F (bearish, 1.26400-1.26600). The 15M chart has no BOS at all (even after significant-swing filtering).",
        "options": [
            "Agree -- both return None",
            "Disagree -- Bot 3 signals, Bot 7 returns None",
            "Disagree -- Bot 7 signals, Bot 3 returns None",
        ],
        "correct_index": 0,
        "explanation": "Both bots require a 15M BOS to exist at all -- Bot 3's `if not bos_15m: return None` and Bot 7's identical check both fire. Same outcome (None), even though Bot 3 reaches it via a different internal order (FVG picked first, then BOS checked) than Bot 7 (BOS checked first).",
    },
    {
        "prompt": "No 1H FVG anywhere is eligible (none fall in the 30-70% ACTIVE window). A clean bullish 15M BOS exists.",
        "options": [
            "Agree -- both return None",
            "Disagree -- Bot 3 signals, Bot 7 returns None",
            "Disagree -- Bot 7 signals, Bot 3 returns None",
        ],
        "correct_index": 0,
        "explanation": "Gate 1 (FVG eligibility) is identical and shared between both bots -- an empty partial_fvgs list returns None for both, before either bot's own direction logic even runs.",
    },
]

# ---------------------------------------------------------------------------
# BOT7-04 — "Given four scenarios (provided in Practise), each with a
# confirmed direction and several direction-matching FVGs at
# different top/bottom prices, identify which one Bot 7 would
# select." select_fvg_by_depth: min(bottom) for a long, max(top) for
# a short -- NOT a comparison of each gap's own span/width.
# ---------------------------------------------------------------------------
BOT7_04_TITLE = "Setup: Depth-Based FVG Selection (Real Difference #2)"
BOT7_04_ITEMS = [
    {
        "prompt": "Direction: long. Candidates: F1 (1.08500-1.08700), F2 (1.08000-1.08200), F3 (1.09000-1.09100). Which does select_fvg_by_depth pick?",
        "options": ["F1", "F2", "F3"], "correct_index": 1,
        "explanation": "For a long, select_fvg_by_depth picks min(fvgs, key=bottom) -- F2's bottom (1.08000) is the lowest of the three. F2.",
    },
    {
        "prompt": "Direction: short. Candidates: G1 (1.26000-1.26200), G2 (1.26500-1.26700), G3 (1.25800-1.25900). Which does select_fvg_by_depth pick?",
        "options": ["G1", "G2", "G3"], "correct_index": 1,
        "explanation": "For a short, select_fvg_by_depth picks max(fvgs, key=top) -- G2's top (1.26700) is the highest. G2.",
    },
    {
        "prompt": "Direction: long. Candidates: H1 (0.65000-0.65200), H2 (0.64800-0.64900). Which does select_fvg_by_depth pick?",
        "options": ["H1", "H2"], "correct_index": 1,
        "explanation": "H2's bottom (0.64800) is lower than H1's (0.65000) -- min(bottom) picks H2, even though H1's own gap is wider (0.00200 vs H2's 0.00100). Depth is about the absolute bottom price level, not the gap's own size.",
    },
    {
        "prompt": "Direction: short. Candidates: I1 (42700-42900), I2 (42750-43000). Which does select_fvg_by_depth pick?",
        "options": ["I1", "I2"], "correct_index": 1,
        "explanation": "I2's top (43000) is higher than I1's (42900) -- max(top) picks I2.",
    },
]

# ---------------------------------------------------------------------------
# BOT7-05 — "Given six scenario summaries (provided in Practise)
# describing FVG eligibility, 15M BOS status, and direction-matching,
# determine at which gate (if any) analyze() would return None."
# Independently re-verified against current source -- no drift found,
# matches the lesson's own four-gate list exactly.
# ---------------------------------------------------------------------------
BOT7_05_TITLE = "Invalidation: The Four Gates"
_B7_GATE_OPTIONS = [
    "Gate 1 (no eligible 1H FVG)",
    "Gate 2 (no 15M BOS after significant-swing filtering)",
    "Gate 3 (BOS type unrecognized)",
    "Gate 4 (no direction-matching FVG among the eligible ones)",
    "Passes all four -- produces a signal",
]
BOT7_05_ITEMS = [
    {"prompt": "No 1H FVG anywhere has mitigated_percent in [0.3, 0.7] while ACTIVE.", "options": _B7_GATE_OPTIONS, "correct_index": 0,
     "explanation": "partial_fvgs is empty. Gate 1."},
    {"prompt": "An eligible FVG exists (gate 1 passes), but the 15M chart has no BOS at all, even after filter_significant_swings.", "options": _B7_GATE_OPTIONS, "correct_index": 1,
     "explanation": "bos_15m is empty. Gate 2."},
    {"prompt": "This lesson's own Worked Example: an eligible FVG exists, a significant-swing 15M BOS exists and is bullish (gates 1-3 pass) -- but among partial_fvgs, only bearish gaps qualify; no bullish one exists.", "options": _B7_GATE_OPTIONS, "correct_index": 3,
     "explanation": "candidate_fvgs ends up empty -- select_fvg_by_depth returns None. Gate 4, even though gates 1-3 all passed."},
    {"prompt": "An eligible bullish FVG exists, a significant-swing 15M BOS exists and is bullish, and that eligible FVG matches the direction.", "options": _B7_GATE_OPTIONS, "correct_index": 4,
     "explanation": "All four gates pass -- analyze() proceeds to entry/stop/target calculation."},
    {"prompt": "An eligible bearish FVG exists, a significant-swing 15M BOS exists and is bearish, and that eligible FVG matches the direction.", "options": _B7_GATE_OPTIONS, "correct_index": 4,
     "explanation": "All four gates pass for a short the same way. Produces a signal."},
    {"prompt": "An eligible bullish FVG sits at exactly mitigated_percent=0.70 (the inclusive upper boundary), ACTIVE. A significant-swing 15M BOS exists and is bullish.", "options": _B7_GATE_OPTIONS, "correct_index": 4,
     "explanation": "0.70 is inclusive -- the FVG is eligible, and it matches the bullish direction. All four gates pass."},
]

# ---------------------------------------------------------------------------
# BOT7-06 — "Given four direction-plus-selected-FVG scenarios
# (provided in Practise), calculate the exact entry price Bot 7 would
# produce for each." multi_calc, identical midpoint formula to Bot 3.
# ---------------------------------------------------------------------------
BOT7_06_TITLE = "Entry: Direction, Selection, and Price Assembled"
BOT7_06_ITEMS = [
    {"title": "Scenario A (long, selected FVG F2)", "given": "Direction: long. Selected FVG: bottom = 1.08000, top = 1.08200.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08100, "tolerance": 0.00003}],
     "explanation": "(1.08000+1.08200)/2 = 1.08100."},
    {"title": "Scenario B (short, selected FVG G2)", "given": "Direction: short. Selected FVG: bottom = 1.26500, top = 1.26700.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.26600, "tolerance": 0.00003}],
     "explanation": "(1.26500+1.26700)/2 = 1.26600."},
    {"title": "Scenario C (long, selected FVG H2)", "given": "Direction: long. Selected FVG: bottom = 0.64800, top = 0.64900.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 0.64850, "tolerance": 0.00003}],
     "explanation": "(0.64800+0.64900)/2 = 0.64850."},
    {"title": "Scenario D (short, selected FVG I2)", "given": "Direction: short. Selected FVG: bottom = 42750.00, top = 43000.00.",
     "fields": [{"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 42875.00, "tolerance": 0.5}],
     "explanation": "(42750.00+43000.00)/2 = 42875.00."},
]

# ---------------------------------------------------------------------------
# BOT7-07 — "Given three FVG top/bottom pairs with confirmed
# directions (provided in Practise), calculate the exact stop price,
# stop distance, and the real tp1 take-profit for each." Reuses
# BOT3-07's own three items directly -- the formula (10%-of-FVG-size
# buffer + the DEFAULT apply_min_stop_distance_floor) is byte-for-byte
# identical between Bot 3 and Bot 7, confirmed by reading both stop
# branches side by side. Item 2 is the one where BOT7-07's own Worked
# Example reuses the exact same now-corrected FVG as BOT3-07's.
# ---------------------------------------------------------------------------
BOT7_07_TITLE = "Management: Stop, Target, and the Real Reported Take-Profit"
BOT7_07_ITEMS = BOT3_07_ITEMS

# ---------------------------------------------------------------------------
# BOT7-08 — "Given five losing-trade case studies styled after Bot 7
# (provided in Practise), determine which are valid losses and which
# are bad losses, checking whether the real direction-first/
# depth-based process was actually followed in each."
# ---------------------------------------------------------------------------
BOT7_08_TITLE = "Failure: What a Failed Bot 7 Setup Looks Like"
_B7_LOSS_OPTIONS = [
    "Valid loss -- the real direction-first, depth-based process was genuinely followed",
    "Bad loss -- the process was actually Bot 3's (FVG-first / recency-based), not Bot 7's",
]
BOT7_08_ITEMS = [
    {
        "prompt": "A 15M BOS was read first and confirmed bullish; among eligible FVGs matching that direction, the one with the lowest bottom (deepest) was selected. The trade was taken and stopped out.",
        "options": _B7_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "Direction-first, then depth-based selection -- exactly Bot 7's real process. A valid loss.",
    },
    {
        "prompt": "The trader picked the MOST RECENT eligible FVG first (ignoring two older, deeper-bottomed bullish candidates), then checked whether a 15M BOS agreed with that FVG's own gap_type. The trade lost.",
        "options": _B7_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "Picking the most-recent FVG first and checking BOS agreement afterward is Bot 3's process, not Bot 7's. Bot 7 would have decided direction first and then selected by depth among ALL eligible candidates -- potentially a different FVG entirely.",
    },
    {
        "prompt": "A 15M BOS was read first and confirmed bearish; among eligible bearish FVGs, the one with the HIGHEST top was selected (the real short-side depth rule). The trade lost.",
        "options": _B7_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "Direction-first, then max(top) for the short side -- exactly right. A valid loss.",
    },
    {
        "prompt": "A 15M BOS was read first and confirmed bullish. Two eligible bullish FVGs existed; the trader picked the one with the WIDEST gap (top-minus-bottom), reasoning \"depth means the biggest gap.\" The trade lost.",
        "options": _B7_LOSS_OPTIONS, "correct_index": 1,
        "explanation": "select_fvg_by_depth compares absolute bottom price (for a long), not each gap's own width -- \"depth\" means the lowest bottom, not the widest span. Picking by gap width is a real misread of the actual selection rule, not Bot 7's real process.",
    },
    {
        "prompt": "A 15M BOS was read first and confirmed bullish; the only eligible FVG matching that direction was selected (no depth comparison was even needed, since there was just one candidate). The trade lost.",
        "options": _B7_LOSS_OPTIONS, "correct_index": 0,
        "explanation": "With only one qualifying candidate, there's nothing to compare -- the process (direction-first, then whichever matches) was still genuinely Bot 7's own. A valid loss.",
    },
]

# ---------------------------------------------------------------------------
# BOT7-09 — "Given a full chart scenario (provided in Practise) with
# 1H and 15M data, work through BOTH Bot 3's and Bot 7's complete
# pipelines, producing each bot's own exact entry, stop, and
# take_profit (or None, with the specific failing gate)." classify
# kind (the two bots' outcomes genuinely differ here, matching this
# lesson's own comparative framing), reusing BOT7-03 item 1's exact
# verified divergence scenario and numbers.
# ---------------------------------------------------------------------------
BOT7_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT7_09_ITEMS = [{
    "prompt": (
        "Eligible 1H FVGs (list order): FVG A (bullish, bottom=1.08000, top=1.08200), FVG B (bearish, "
        "bottom=1.09000, top=1.09500, listed LAST/most recent). 15M BOS (significant-swing-filtered): "
        "bullish_bos. What does each bot's analyze() output?"
    ),
    "options": [
        "Bot 3: None (gate: direction mismatch on FVG B). Bot 7: long signal, entry 1.08100, stop 1.07938, tp1 1.08262.",
        "Bot 3: long signal using FVG A. Bot 7: None.",
        "Both: None.",
        "Both: the same long signal, using FVG A.",
    ],
    "correct_index": 0,
    "explanation": (
        "Bot 3 picks partial_fvgs[-1]=FVG B first (recency), THEN checks agreement: FVG B is bearish but "
        "last_bos is bullish_bos -- mismatch, None. Bot 7 decides direction=long FIRST from the bullish_bos, "
        "then finds FVG A is the only bullish-matching candidate: entry=(1.08000+1.08200)/2=1.08100. "
        "buffer=(1.08200-1.08000)*0.1=0.00020; raw sl=1.08000-0.00020=1.07980; floor=1.08100*0.0015=0.00162, "
        "distance=0.00120 < floor -- FLOORED to 1.08100-0.00162=1.07938. sl_distance=0.00162. "
        "tp1=1.08100+0.00162=1.08262. A real, direct consequence of BOT7-03's direction-first reordering: "
        "Bot 7 finds a signal Bot 3's identical inputs never would."
    ),
}]

# ---------------------------------------------------------------------------
# BOT7-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one producing None), work the complete Bot 7
# pipeline for each." classify kind. Scenario 1 reuses BOT7-09's exact
# verified numbers; Scenario 2 is the required None case (gate 1, no
# eligible FVG at all); Scenario 3 reuses BOT3-07 Trade 3's exact
# verified short-case numbers (identical formula).
# ---------------------------------------------------------------------------
BOT7_10_TITLE = "Capstone: Full Bot 7 Decision Simulation"
BOT7_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1 (long): eligible FVGs are FVG A (bullish, 1.08000-1.08200) and FVG B (bearish, "
            "1.09000-1.09500). 15M BOS (significant-swing-filtered) is bullish. What does Bot 7's analyze() "
            "output?"
        ),
        "options": [
            "Long signal -- entry 1.08100, stop 1.07938, tp1 1.08262 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08100, stop 1.07938, tp1 1.08100+4*0.00162=1.08748 (tp1 at the bot's 4:1 default_rr)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Direction=long from the BOS; FVG A is the only bullish-matching candidate. tp1 is always fixed 1:1 off sl_distance -- the 4.0 default_rr only ever reaches tp3.",
    },
    {
        "prompt": "Scenario 2 (the required None case): no 1H FVG anywhere has mitigated_percent in [0.3, 0.7] while ACTIVE. A clean bullish 15M BOS exists. What does Bot 7's analyze() output?",
        "options": [
            "A long signal using whichever FVG is closest to eligible",
            "A long signal with reduced confidence",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "partial_fvgs is empty -- Gate 1 fails before the 15M BOS is even read.",
    },
    {
        "prompt": "Scenario 3 (short): the only eligible FVG is bearish, bottom=1.26400, top=1.26500. 15M BOS (significant-swing-filtered) is bearish. What does Bot 7's analyze() output?",
        "options": [
            "Short signal -- entry 1.26450, stop 1.26640, tp1 1.26260 (tp1 fixed at 1:1 R, min-stop-distance floor applied)",
            "Short signal -- entry 1.26450, stop 1.26510 (the raw, un-floored 10%-buffer stop), tp1 1.26390",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Identical math to BOT3-07 Trade 3 (the formula is shared): entry=(1.26400+1.26500)/2=1.26450. buffer=(1.26500-1.26400)*0.1=0.00010; raw sl=1.26500+0.00010=1.26510, a 0.00060 distance -- below the 1.26450*0.0015=0.00190 floor, so the real code widens it to 1.26640. sl_distance=0.00190. tp1=1.26450-0.00190=1.26260.",
    },
]


async def seed_bot7_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT7_02_TITLE, "classify", BOT7_02_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_03_TITLE, "classify", BOT7_03_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_04_TITLE, "classify", BOT7_04_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_05_TITLE, "classify", BOT7_05_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_06_TITLE, "multi_calc", BOT7_06_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_07_TITLE, "multi_calc", BOT7_07_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_08_TITLE, "classify", BOT7_08_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_09_TITLE, "classify", BOT7_09_ITEMS, bot_id="bot_7")
        count += await _upsert(db, BOT7_10_TITLE, "classify", BOT7_10_ITEMS, bot_id="bot_7")
        await db.commit()
        print(f"\n{count} of 9 Bot 7 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot7_scenarios())
    sys.exit(0)
