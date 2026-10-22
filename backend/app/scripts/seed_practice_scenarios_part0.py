"""
Practice Scenario Set Seed Script — PART_0 Orientation Lessons (remainder)
=======================================================================

Final module of the practice-drill-scenario-sets effort's documented
scope, lowest priority, tackled last. Covers the three PART_0_
ORIENTATION.md lessons that still had no PracticeScenarioSet
(ORIENT-01, ORIENT-02, and ORIENT-04 were already seeded in the very
first wave): ORIENT-03 and ORIENT-06 are seeded here; ORIENT-05 is
explicitly SKIPPED (see below).

--- A real content-accuracy finding, in the same spirit as the
seed_practice_scenarios_core2.py docstring's C2-01 note, NOT fixed
here (out of this session's scope to touch an already-merged seed
file without being asked) ---

ORIENT-03's OWN Practice Drill text, verbatim from
PART_0_ORIENTATION.md, is: "Given three hypothetical trade logs
(provided in Practise), calculate win rate, average win, average
loss, and expectancy for each. Rank them by expectancy, not by win
rate..." But the FIRST wave's seed_practice_scenarios.py already
attached a scenario set matching that exact description to the lesson
titled "Trading vs. Gambling, Signal vs. Setup vs. Trade" -- which is
actually ORIENT-02, not ORIENT-03. ORIENT-02's own real Practice Drill
(verbatim) is entirely different: "Take five real signal events
(provided). For each, list exactly which confirmations would need to
be present for it to become a Bot 2 setup..." -- a signal/setup
classification drill, not an expectancy-ranking one. So the live DB
currently has the expectancy-ranking content sitting on the WRONG
lesson (ORIENT-02 instead of ORIENT-03), confirmed by reading both
lessons' own .md text side by side immediately before writing this.
Not fixed here (that would mean editing seed_practice_scenarios.py's
already-merged content, out of this task's scope) -- flagged for the
parent session instead. Because that content already exists (just on
the wrong lesson), ORIENT-03 below gets a FRESH, independently-
verified set of three trade logs (different numbers, same structure
and same win-rate/expectancy-reversal teaching point) rather than a
duplicate of the misattached one.

ORIENT-05 ("How to Use Learn / Practise / Mastery") is explicitly
SKIPPED: its own Practice Drill reads "Open YOUR OWN current track
progress page and identify one stage where you've met the quiz
requirement but not the practice-rep requirement, or vice versa" --
this is inherently about the individual learner's own live, personal
progress data, not a reproducible fact checkable against any fixed
source. No canned scenario can honestly substitute for "go look at
your own account" without inventing fake progress data presented as
real. Skipped rather than faked, per this effort's own standing rule.

ORIENT-06 title-drift note (per this effort's own required reporting):
the .md file's own heading now reads "ORIENT-06 — How the SEVEN Bots
Relate to One Another" (and its body lists Bot 1 through Bot 7), but
the LIVE DB's seeded Lesson row for this same lesson is still titled
"How the FIVE Bots Relate to One Another" -- a real, confirmed title/
content mismatch between the .md file and what's actually seeded
(the exact kind of drift this effort's own instructions warned about).
Per those instructions, the DB's real title is used below so the
_upsert lookup actually finds the lesson; the content itself is drawn
from the .md's current (seven-bot) text since that's this lesson's
real, current source of truth, with the title mismatch reported
rather than silently fixed.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_part0
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# ORIENT-03 -- see module docstring. Fresh trade logs (not a duplicate
# of the misattached ORIENT-02 content), independently computed and
# verified in Python: win-rate ranking and expectancy ranking land in
# OPPOSITE order, the exact point this lesson's own drill asks the
# learner to notice. Expectancy formula matches this lesson's own
# stated Worked Example formula exactly (checked: 40% WR, $150 avg
# win, $60 avg loss -> $24 expectancy, reproduced in Python before
# writing any of the three items below).
# ---------------------------------------------------------------------------
ORIENT_03_TITLE = "Framework vs. Proven Edge — Why Probability Matters"
ORIENT_03_ITEMS = [
    {
        "label": "Log X",
        "trades": [150] * 22 + [-70] * 28,
        "ask": "Expectancy per trade ($)",
        "correct_value": 26.80,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 44% (22/50), avg win $150, avg loss $70. Expectancy = 0.44x150 - 0.56x70 = 66 - 39.2 = $26.80 per trade.",
    },
    {
        "label": "Log Y",
        "trades": [60] * 35 + [-160] * 15,
        "ask": "Expectancy per trade ($)",
        "correct_value": -6.00,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 70% (35/50) -- the HIGHEST win rate of the three -- but avg win $60, avg loss $160. Expectancy = 0.70x60 - 0.30x160 = 42 - 48 = -$6.00 per trade: a NEGATIVE-expectancy system despite winning most of the time.",
    },
    {
        "label": "Log Z",
        "trades": [500] * 12 + [-80] * 38,
        "ask": "Expectancy per trade ($)",
        "correct_value": 59.20,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 24% (12/50) -- the LOWEST win rate of the three -- but avg win $500, avg loss $80. Expectancy = 0.24x500 - 0.76x80 = 120 - 60.8 = $59.20 per trade: by far the best expectancy of the three, despite losing most of the time.",
    },
]
ORIENT_03_SUMMARY = (
    "Ranked by win rate: Y (70%) > X (44%) > Z (24%). Ranked by expectancy -- the number that actually "
    "determines long-run profit -- the order completely reverses: Z ($59.20) > X ($26.80) > Y (-$6.00). "
    "The highest win rate of the three belongs to the only NEGATIVE-expectancy system; the lowest win rate "
    "belongs to the best one. Win rate alone told you nothing reliable about which system was worth trading."
)

# ---------------------------------------------------------------------------
# ORIENT-06 -- "Given five short market-condition descriptions
# (provided in Practise), match each to the bot(s) most likely to be
# active in that condition, and explain your reasoning in one sentence
# per match." classify kind, grounded directly in this lesson's own
# seven-bot specialization list and its own Worked Example/Counter-
# example market-condition reasoning.
# ---------------------------------------------------------------------------
ORIENT_06_TITLE = "How the Five Bots Relate to One Another"  # live DB title (see module docstring: the .md heading has since drifted to "Seven Bots")
_ORIENT_06_OPTIONS = [
    "Bot 1 (Macro Swing Structure) -- trend/structure continuation",
    "Bot 2 (Order Block Reversal) -- reversal confluence at a fresh zone",
    "Bot 3 and/or Bot 7 (Imbalance/FVG Expansion) -- displacement-driven FVG setups",
    "Bot 4 (Volume & Liquidity Sweep) -- volume divergence at a liquidity pool",
    "Bot 5 and/or Bot 6 (Liquidity Purge) -- sweep + displacement + CHoCH",
]
ORIENT_06_ITEMS = [
    {"prompt": "A strong, sustained uptrend with clean higher highs and higher lows, no meaningful pullback into any fresh zone.", "options": _ORIENT_06_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: Bot 1 generates several valid continuation setups in exactly this kind of clean, established trend, while Bot 2 stays quiet since there's no reversal-level confluence to find."},
    {"prompt": "Price has just swept a cluster of resting stop orders below a recent swing low and is showing strong displacement back upward, with a CHoCH confirming on the 4H chart.", "options": _ORIENT_06_OPTIONS, "correct_index": 4,
     "explanation": "Sweep, displacement, and a confirming CHoCH, with the 4H chart setting direction, is exactly Bot 5's core playbook (Bot 6 would read the same pattern but anchor its mandatory direction signal to 1H instead)."},
    {"prompt": "A fresh, high-displacement Fair Value Gap has just formed on strong directional momentum, with a confirming higher-timeframe Break of Structure in the same direction.", "options": _ORIENT_06_OPTIONS, "correct_index": 2,
     "explanation": "Displacement-driven FVG with HTF BOS confirmation is Bot 3's defining setup (Bot 7 runs the identical core logic but selects which FVG to use by depth rather than plain recency when several are available)."},
    {"prompt": "Price approaches a known liquidity pool and candle volume meaningfully diverges from the recent average right at that level.", "options": _ORIENT_06_OPTIONS, "correct_index": 3,
     "explanation": "Volume behavior diverging at a liquidity pool is specifically Bot 4's specialization -- a market condition the other six bots' own rules don't key off of directly."},
    {"prompt": "Price pulls back into a fresh, lightly-mitigated 4H order block after a 1H liquidity sweep, with a 15-minute displacement and micro-CHoCH confirming at the zone.", "options": _ORIENT_06_OPTIONS, "correct_index": 1,
     "explanation": "This is ORIENT-02's own Worked Example setup, verbatim: a fresh order block plus a sweep plus displacement plus micro-CHoCH is precisely Bot 2's multi-timeframe reversal-confluence specialization."},
    {"prompt": "Bot 1 has been quiet for a week while Bot 5 has fired three signals in the same period.", "options": _ORIENT_06_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Scenario Challenge, verbatim: this combination suggests the market has been producing liquidity sweeps and reversals (active ground for Bot 5) rather than a clean, established directional trend (what Bot 1 needs to fire) -- each bot correctly reflecting the conditions actually present, not a malfunction on either side."},
]


async def seed_part0_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, ORIENT_03_TITLE, "numeric_calc", ORIENT_03_ITEMS, ORIENT_03_SUMMARY)
        count += await _upsert(db, ORIENT_06_TITLE, "classify", ORIENT_06_ITEMS)
        await db.commit()
        print(f"\n{count} of 2 PART_0 scenario sets seeded/updated (ORIENT-05 deliberately skipped -- see module docstring).")


if __name__ == "__main__":
    asyncio.run(seed_part0_scenarios())
    sys.exit(0)
