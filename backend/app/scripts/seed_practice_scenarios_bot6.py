"""
Practice Scenario Set Seed Script — Bot 6 Lessons 02 through 10
===================================================================

Phase 8 of the practice-drill-scenario-sets effort. Completes Bot 6's
full BOT6-01..10 track (01 was seeded in seed_practice_scenarios_bots.py).
JeafxSMCv2Bot.analyze() (bot_strategies.py, ~lines 2132-2340) was
re-read in full immediately before writing this.

Several lessons (02, 03, 04, 07, 08) EXPLICITLY tell the learner these
reuse "the same set used in BOT5-0X's drill" and ask them to confirm
the outcome "matches Bot 5's" — a direct instruction to reuse real,
already-verified content, not a shortcut taken here. Confirmed
code-identical before reusing: the zone-freshness filter (status==
ACTIVE, test_count<=1), the 15M sweep detection + first-match zone
alignment, the 5M confirmation-candle first-match loop, the
FVG-or-confirmation-candle entry source, and the full sweep-extreme
stop/fixed-1:1-tp1 math are all BYTE-FOR-BYTE IDENTICAL between
JeafxSMCBot (Bot 5) and JeafxSMCv2Bot (Bot 6) — re-read side by side
to confirm this directly, not assumed from the lessons' own claim.
Only the DIRECTION source differs (Bot 5: 4H BOS, decided early,
before the purge; Bot 6: 1H BOS + Bot 2/3 LTF agreement, decided
late, after the purge and confirmation candle) — see
seed_practice_scenarios_bot5.py for the original BOT5-02/03/04/06/07
items this file imports and reuses directly.

Run after seed_practice_scenarios_bot5.py (imports its item lists):
    python -m app.scripts.seed_practice_scenarios_bot6
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert
from app.scripts.seed_practice_scenarios_bot5 import (
    BOT5_02_ITEMS, BOT5_04_ITEMS, BOT5_06_ITEMS, BOT5_07_ITEMS,
)

# ---------------------------------------------------------------------------
# BOT6-02 — identical freshness filter to BOT5-02. Reused directly, as
# the lesson's own prompt instructs ("the same set used in BOT5-02's
# drill ... confirm the outcome matches Bot 5's").
# ---------------------------------------------------------------------------
BOT6_02_TITLE = "Identification: Refined Zones, Identical to Bot 5"
BOT6_02_ITEMS = BOT5_02_ITEMS

# ---------------------------------------------------------------------------
# BOT6-03 — "Given six 15M sweep/zone-alignment scenarios (provided in
# Practise — the same set used in BOT5-03's drill), determine the gate
# outcome for each, confirming it matches Bot 5's result for the same
# inputs." Re-scoped to JUST the sweep+alignment gate outcome (Bot 6's
# own direction source is entirely different from Bot 5's, so BOT5-03's
# own "which direction/zone" framing doesn't carry over as-is) --
# built fresh around the same zone/sweep numbers BOT5-03 used, since
# the alignment mechanics (first-match `break`) are code-identical.
# ---------------------------------------------------------------------------
BOT6_03_TITLE = "Context: The 15M Liquidity Purge, a Timing Gate Only"
_B6_GATE_OPTIONS = ["Both gates pass -- a zone aligns with the sweep", "Fails -- no sweep detected at all", "Fails -- the sweep doesn't align with any fresh zone"]
BOT6_03_ITEMS = [
    {"prompt": "A 15M sweep is detected at price 1.08300. Fresh zones: Zone A (1.08000-1.08500).", "options": _B6_GATE_OPTIONS, "correct_index": 0,
     "explanation": "Sweep exists, and 1.08300 falls inside Zone A's range -- both gates pass, same as Bot 5's identical mechanics."},
    {"prompt": "No 15M liquidity sweep is detected anywhere in the last 5 candles.", "options": _B6_GATE_OPTIONS, "correct_index": 1,
     "explanation": "sweeps is empty -- fails before alignment is even checked, identically to Bot 5."},
    {"prompt": "A 15M sweep is detected at price 1.26700. Fresh zones: Zone B (1.26400-1.26900).", "options": _B6_GATE_OPTIONS, "correct_index": 0,
     "explanation": "1.26700 is inside Zone B. Both gates pass."},
    {"prompt": "A 15M sweep is detected at price 1.08700. The only fresh zone is 1.09000-1.09200.", "options": _B6_GATE_OPTIONS, "correct_index": 2,
     "explanation": "The sweep exists but its price doesn't fall inside the only fresh zone's range -- aligned_zone stays None."},
    {"prompt": "A 15M sweep is detected at price 1.08450. Fresh zones (in list order, both containing the price): Zone P (1.08000-1.08500) first, Zone Q (1.08400-1.08470) second.", "options": _B6_GATE_OPTIONS, "correct_index": 0,
     "explanation": "Both gates pass -- the sweep aligns with Zone P (first-match `break`, identical selection rule to Bot 5), even though Zone Q is also a match."},
    {"prompt": "A 15M sweep is detected at price 42850. Fresh zones: Zone C (42600-42900).", "options": _B6_GATE_OPTIONS, "correct_index": 0,
     "explanation": "42850 is inside Zone C. Both gates pass, same mechanics at BTC scale."},
]

# ---------------------------------------------------------------------------
# BOT6-04 — identical confirmation-candle test to BOT5-04. Reused
# directly (all 7 of BOT5-04's items, matching its own "the same set
# used in BOT5-04's drill" instruction -- the lesson's own lead-in
# says "five" but then explicitly says "the same set", and the full,
# real set is 7 items; reusing the full real set honors the stronger,
# more specific instruction).
# ---------------------------------------------------------------------------
BOT6_04_TITLE = "Setup: The Momentum Confirmation Candle, Identical to Bot 5"
BOT6_04_ITEMS = BOT5_04_ITEMS

# ---------------------------------------------------------------------------
# BOT6-05 — "Given eight (choch_dir, fvg_bos_dir) value-pair scenarios
# (provided in Practise, covering both-agree, only-one-fires,
# both-disagree, and neither-fires cases), determine Bot 6's exact
# outcome for each." Rule (with direction already locked in as "long"
# from the mandatory 1H BOS, per the class docstring/code's own
# ordering): `if choch_dir != direction and fvg_bos_dir != direction:
# return None` -- fails ONLY when BOTH disagree or BOTH are absent;
# passes whenever at least one agrees, regardless of what the other
# one says or whether it fired at all.
# ---------------------------------------------------------------------------
BOT6_05_TITLE = "Direction: Bot 2's CHoCH OR Bot 3's FVG+BOS, Either Sufficient"
_B6_AGREE_OPTIONS = ["Proceeds (at least one LTF read agrees)", "Fails -- analyze() returns None"]
BOT6_05_ITEMS = [
    {"prompt": "1H BOS bias: long. choch_dir = long, fvg_bos_dir = long (both agree).", "options": _B6_AGREE_OPTIONS, "correct_index": 0,
     "explanation": "Both agree with direction -- trivially proceeds."},
    {"prompt": "1H BOS bias: long. choch_dir = long, fvg_bos_dir = None (Bot 3's FVG+BOS never fired).", "options": _B6_AGREE_OPTIONS, "correct_index": 0,
     "explanation": "choch_dir==direction makes `choch_dir != direction` False -- the AND short-circuits to False regardless of fvg_bos_dir. Proceeds."},
    {"prompt": "1H BOS bias: long. choch_dir = None, fvg_bos_dir = long.", "options": _B6_AGREE_OPTIONS, "correct_index": 0,
     "explanation": "Symmetric to the previous case -- fvg_bos_dir agreeing is sufficient on its own. Proceeds."},
    {"prompt": "1H BOS bias: long. choch_dir = short (disagrees), fvg_bos_dir = long (agrees).", "options": _B6_AGREE_OPTIONS, "correct_index": 0,
     "explanation": "Only ONE needs to agree -- fvg_bos_dir does, so this proceeds even though choch_dir actively disagrees."},
    {"prompt": "1H BOS bias: long. choch_dir = short, fvg_bos_dir = short (both actively disagree).", "options": _B6_AGREE_OPTIONS, "correct_index": 1,
     "explanation": "Both conditions of the AND are True -- a genuine conflict. Fails (this lesson's own Counterexample shape)."},
    {"prompt": "1H BOS bias: long. choch_dir = None, fvg_bos_dir = None (neither LTF signal ever fired).", "options": _B6_AGREE_OPTIONS, "correct_index": 1,
     "explanation": "None != 'long' is True for both -- the AND is True even though NEITHER actively disagrees, just because neither confirms either. A real, easy-to-miss detail: 'no confirmation' fails the same way 'active disagreement' does."},
    {"prompt": "1H BOS bias: long. choch_dir = short (disagrees), fvg_bos_dir = None (never fired).", "options": _B6_AGREE_OPTIONS, "correct_index": 1,
     "explanation": "choch_dir != direction is True, and fvg_bos_dir (None) != direction is also True. Fails."},
    {"prompt": "1H BOS bias: long. choch_dir = None (never fired), fvg_bos_dir = short (disagrees).", "options": _B6_AGREE_OPTIONS, "correct_index": 1,
     "explanation": "Symmetric to the previous case. Fails."},
]

# ---------------------------------------------------------------------------
# BOT6-06 — "Given nine scenario summaries (provided in Practise)
# describing which of the six gates pass or fail — including at least
# one CHoCH/FVG+BOS disagreement — determine the outcome for each."
# Scoped exactly to the six gates this lesson's own prose names (zone,
# sweep, alignment, confirmation candle, CHoCH/FVG+BOS disagreement,
# neither-fires). A REAL, CURRENT discrepancy, flagged here and in
# this file's own commit message, not fixed in the curriculum .md:
# the lesson's list entirely omits Bot 6's own 1H BOS existence/type
# check (`if not bos_1h: return None`, then an `else: return None` for
# an unrecognized type) -- a genuine, current, unconditional
# return-None point that has to pass BEFORE gates 5-6 (the CHoCH/FVG+BOS
# check needs `direction` already set) even runs. Every "passes"
# scenario below keeps a valid 1H BOS as part of its stated setup
# without naming it as a seventh gate.
# ---------------------------------------------------------------------------
BOT6_06_TITLE = "Invalidation: The Six Conditions That Return No Signal"
_B6_GATE6_OPTIONS = [
    "Gate 1 (no refined 1H zone)",
    "Gate 2 (no 15M sweep detected)",
    "Gate 3 (no zone aligns with the sweep)",
    "Gate 4 (no 5M confirmation candle)",
    "Gate 5 (CHoCH and FVG+BOS both fired and disagree)",
    "Gate 6 (neither CHoCH nor FVG+BOS fired)",
    "Passes all six -- produces a signal",
]
BOT6_06_ITEMS = [
    {"prompt": "No 1H order block anywhere is both ACTIVE and test_count<=1.", "options": _B6_GATE6_OPTIONS, "correct_index": 0,
     "explanation": "fresh_zones is empty. Gate 1."},
    {"prompt": "A fresh zone exists, but no 15M liquidity sweep is detected at all.", "options": _B6_GATE6_OPTIONS, "correct_index": 1,
     "explanation": "sweeps is empty. Gate 2."},
    {"prompt": "A fresh zone and a 15M sweep both exist, but the sweep's price doesn't fall inside any fresh zone.", "options": _B6_GATE6_OPTIONS, "correct_index": 2,
     "explanation": "aligned_zone stays None. Gate 3."},
    {"prompt": "A fresh zone, a sweep, and zone alignment all pass (gates 1-3), but no 5M candle in the last 5 has both strong momentum and a close back inside the aligned zone.", "options": _B6_GATE6_OPTIONS, "correct_index": 3,
     "explanation": "confirmation_candle stays None. Gate 4."},
    {"prompt": "Gates 1-4 pass. A valid 1H BOS sets direction=long. Bot 2's CHoCH call returns short; Bot 3's FVG+BOS call also returns short (this lesson's own Counterexample).", "options": _B6_GATE6_OPTIONS, "correct_index": 4,
     "explanation": "Both actively disagree with direction. Gate 5."},
    {"prompt": "Gates 1-4 pass. A valid 1H BOS sets direction=long. Neither Bot 2's CHoCH call nor Bot 3's FVG+BOS call fires at all (both None).", "options": _B6_GATE6_OPTIONS, "correct_index": 5,
     "explanation": "Neither confirms direction, even though neither actively disagrees either. Gate 6."},
    {"prompt": "This lesson's own Worked Example: gates 1-4 pass, a valid 1H BOS sets direction=long, Bot 2's CHoCH call returns long, and Bot 3's FVG+BOS call returns None.", "options": _B6_GATE6_OPTIONS, "correct_index": 6,
     "explanation": "choch_dir==direction -- gate 5 doesn't trigger; gate 6 doesn't trigger either since direction was set. All six pass."},
    {"prompt": "Gates 1-4 pass. A valid 1H BOS sets direction=short. Bot 2's CHoCH call returns short (agrees); Bot 3's FVG+BOS call returns long (disagrees).", "options": _B6_GATE6_OPTIONS, "correct_index": 6,
     "explanation": "Only one needs to agree -- CHoCH does. All six gates pass despite the FVG+BOS disagreement."},
    {"prompt": "A fresh zone exists and a 15M sweep is detected, but the sweep's price doesn't fall inside the zone's range.", "options": _B6_GATE6_OPTIONS, "correct_index": 2,
     "explanation": "Same as item 3 -- aligned_zone is None. Gate 3."},
]

# ---------------------------------------------------------------------------
# BOT6-07 — identical entry-source test to BOT5-06. Reused directly.
# ---------------------------------------------------------------------------
BOT6_07_TITLE = "Entry: FVG-or-Confirmation-Candle, Identical to Bot 5"
BOT6_07_ITEMS = BOT5_06_ITEMS

# ---------------------------------------------------------------------------
# BOT6-08 — identical stop/target math to BOT5-07. Reused directly.
# ---------------------------------------------------------------------------
BOT6_08_TITLE = "Management: Strict SL and the Fixed 1:1 Reported Target"
BOT6_08_ITEMS = BOT5_07_ITEMS

# ---------------------------------------------------------------------------
# BOT6-09 — "Given a full chart scenario (provided in Practise) with
# 1H, 15M, and 5M data, work through the complete pipeline to produce
# the exact entry, stop, and real tp1 take-profit target Bot 6's code
# would output." Reuses BOT5-09's exact, independently-verified stop/
# target numbers (the formulas are code-identical) with Bot 6's own
# direction-determination order and source.
# ---------------------------------------------------------------------------
BOT6_09_TITLE = "Practice: Running the Full Pipeline by Hand"
BOT6_09_ITEMS = [{
    "title": "Full pipeline scenario",
    "given": (
        "1H: one fresh order block (ACTIVE, test_count=1): bottom = 1.08400, top = 1.08550.\n"
        "15M: a buy_side_sweep occurs within the last 5 candles, sweep_price (purge extreme) = 1.08380, "
        "which aligns with the 1H zone above.\n"
        "5M: the first qualifying confirmation candle has open=1.08430, close=1.08500, high=1.08560, "
        "low=1.08400 (strong body, closes inside the 1H zone).\n"
        "1H: the most recent BOS (fed through filter_significant_swings) is bullish_bos -> direction=long.\n"
        "Bot 2's 15M CHoCH call returns long (agrees); Bot 3's 1H-FVG+15M-BOS call returns None.\n"
        "1H swing range for discount/premium: low = 1.08000, high = 1.09000 -- the zone's center (1.08475) "
        "is equilibrium, which passes for a long.\n"
        "The sweep's type (buy_side_sweep) matches direction=long -- the expected-sweep-side check passes.\n"
        "A depth-selected 5M FVG qualifies: bottom = 1.08460, top = 1.08540."
    ),
    "fields": [
        {"label": "entry", "ask": "Entry price", "unit": "", "correct_value": 1.08500, "tolerance": 0.00003},
        {"label": "sl", "ask": "Stop-loss price", "unit": "", "correct_value": 1.08337, "tolerance": 0.0001},
        {"label": "tp1", "ask": "Reported take_profit (tp1)", "unit": "", "correct_value": 1.08663, "tolerance": 0.0001},
    ],
    "explanation": (
        "Gates 1-4 (zone, sweep, alignment, confirmation candle) all pass. Direction comes from the 1H BOS "
        "(long), confirmed by CHoCH agreeing (gate 5-6 pass). entry = FVG midpoint = "
        "(1.08460+1.08540)/2 = 1.08500 (identical formula to Bot 5). buffer = |1.08560-1.08400|*0.2 = 0.00032. "
        "raw sl = 1.08380-0.00032 = 1.08348. extend_stop_beyond_zone bound = 1.08400-0.1*(1.08550-1.08400) = "
        "1.08385; min(1.08348, 1.08385) = 1.08348 (unchanged). Floor: entry*0.0015 = 0.0016275; distance = "
        "0.00152 < floor -- FLOORED to 1.08500-0.0016275 = 1.08337. sl_distance = 0.00163. tp1 = "
        "entry+sl_distance*1.0 = 1.08663 -- fixed 1:1, the same rule and the same numbers BOT5-09's identical "
        "inputs produced, since the stop/target formulas are byte-for-byte shared between Bot 5 and Bot 6."
    ),
}]

# ---------------------------------------------------------------------------
# BOT6-10 — "Given three raw multi-timeframe scenarios (provided in
# Practise, at least one producing None), work the complete Bot 6
# pipeline for each." classify kind. Scenario 1 reuses BOT6-09's exact
# numbers; Scenario 2 is the required None case (neither LTF signal
# fires); Scenario 3 reuses BOT5-07 Trade 2 / BOT6-08's exact verified
# short-case numbers.
# ---------------------------------------------------------------------------
BOT6_10_TITLE = "Capstone: Full Bot 6 Decision Simulation, and the Six-Bot Roster"
BOT6_10_ITEMS = [
    {
        "prompt": (
            "Scenario 1 (long): a fresh 1H zone (1.08400-1.08550), a 15M sweep aligning with it (purge "
            "extreme 1.08380), a qualifying 5M confirmation candle, a bullish 1H BOS, CHoCH agreeing, "
            "favorable discount/premium, correct sweep side, and a qualifying FVG (1.08460-1.08540). What "
            "does analyze() output?"
        ),
        "options": [
            "Long signal -- entry 1.08500, stop 1.08337, tp1 1.08663 (tp1 fixed at 1:1 R)",
            "Long signal -- entry 1.08500, stop 1.08337, tp1 1.08500+5*0.00163=1.09315 (tp1 at the 5.0 rr_ratio fallback)",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "All six gates pass (plus the real, unnamed 1H-BOS-existence check). tp1 is always fixed 1:1 off sl_distance -- the same rule as every other bot, never the 5.0 rr_ratio fallback (that only reaches tp3).",
    },
    {
        "prompt": (
            "Scenario 2 (the required None case): a fresh 1H zone, a 15M sweep aligning with it, and a "
            "qualifying 5M confirmation candle all pass (gates 1-4). A valid bullish 1H BOS sets "
            "direction=long. But neither Bot 2's CHoCH call nor Bot 3's FVG+BOS call fires at all (both "
            "None). What does analyze() output?"
        ),
        "options": [
            "A long signal anyway, since the 1H BOS alone is a strong enough bias",
            "A long signal with reduced confidence, since neither LTF signal confirmed",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 2,
        "explanation": "`choch_dir != direction and fvg_bos_dir != direction` is True when both are None -- gate 6 fires. The 1H BOS alone is the MANDATORY bias, but it still needs at least one LTF signal to agree; neither firing is treated the same as both actively disagreeing.",
    },
    {
        "prompt": (
            "Scenario 3 (short): a fresh 1H zone (1.26550-1.26650), a 15M sweep aligning with it (purge "
            "extreme 1.26800), a qualifying 5M confirmation candle (high=1.26700, low=1.26600), a bearish "
            "1H BOS, Bot 3's FVG+BOS call agreeing (short), favorable discount/premium, and correct sweep "
            "side. No qualifying FVG forms, so entry comes from the confirmation candle: open=1.26700, "
            "close=1.26600. What does analyze() output?"
        ),
        "options": [
            "Short signal -- entry 1.26650, stop 1.26840, tp1 1.26460 (tp1 fixed at 1:1 R)",
            "Short signal -- entry 1.26650, stop 1.26820 (the raw, un-floored buffer stop), tp1 1.26480",
            "No signal -- analyze() returns None",
        ],
        "correct_index": 0,
        "explanation": "Identical math to BOT5-07 Trade 2 / BOT6-08's own verified numbers (the formulas are shared): entry=(1.26700+1.26600)/2=1.26650, buffer=0.00020, raw sl=1.26820, zone-embed unchanged, min-distance floor widens it to 1.26840. sl_distance=0.00190. tp1=1.26650-0.00190=1.26460.",
    },
]


async def seed_bot6_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT6_02_TITLE, "classify", BOT6_02_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_03_TITLE, "classify", BOT6_03_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_04_TITLE, "classify", BOT6_04_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_05_TITLE, "classify", BOT6_05_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_06_TITLE, "classify", BOT6_06_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_07_TITLE, "multi_calc", BOT6_07_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_08_TITLE, "multi_calc", BOT6_08_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_09_TITLE, "multi_calc", BOT6_09_ITEMS, bot_id="bot_6")
        count += await _upsert(db, BOT6_10_TITLE, "classify", BOT6_10_ITEMS, bot_id="bot_6")
        await db.commit()
        print(f"\n{count} of 9 Bot 6 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot6_scenarios())
    sys.exit(0)
