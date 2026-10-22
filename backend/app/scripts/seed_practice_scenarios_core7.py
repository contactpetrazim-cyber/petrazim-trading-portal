"""
Practice Scenario Set Seed Script — CORE_7 Multi-Timeframe Analysis Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1,
CORE_3 through CORE_6 done; this covers all three CORE_7 lessons,
C7-01 through C7-03). No bot_strategies.py equivalent exists for these
concept-only lessons; every rule, layer name, and worked scenario
below is taken directly from CORE_7_MULTI_TIMEFRAME.md's own Core
Teaching / Worked Example / Key Takeaways text (re-read in full
immediately before writing this). These three lessons are purely
conceptual (no OHLC arithmetic involved), so no numeric verification
script was needed here, unlike the earlier CORE_1/3/4/5/6 modules.

Lesson titles below were checked against the LIVE DB -- all three
matched exactly with no title drift.

C7-01 note: the original drill asks the learner to "write one sentence
answering each layer's specific question" for a provided five-chart
set -- an open-ended writing exercise, not a shape any existing kind
grades. Adapted into the inverse, checkable direction: given a
specific analytical statement, identify which of the five layers it
belongs to -- testing the same "each layer answers a different
question" knowledge the original drill targets, grounded directly in
this lesson's own Worked Example statements.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core7
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C7-01 -- see module docstring. classify kind: given one analytical
# statement, identify which of the five layers it answers.
# ---------------------------------------------------------------------------
C7_01_TITLE = "The Five-Layer Stack: Macro/Direction/Opportunity/Trigger/Execution"
_C7_01_OPTIONS = ["Macro", "Direction", "Opportunity", "Trigger", "Execution"]
C7_01_ITEMS = [
    {"prompt": "\"The Daily chart shows the overall regime is a broad uptrend.\" Which layer does this statement answer?", "options": _C7_01_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: reading the overall long-term regime/bias on the highest timeframe is Macro's specific job."},
    {"prompt": "\"The 4H chart confirms the intermediate-term trend is also bullish, agreeing with the higher timeframe.\" Which layer does this statement answer?", "options": _C7_01_OPTIONS, "correct_index": 1,
     "explanation": "Reading the current intermediate-term trend WITHIN the macro context is Direction's job, per this lesson's own Worked Example."},
    {"prompt": "\"On the 1H chart, a fresh demand zone sits in discount, with sell-side liquidity resting nearby.\" Which layer does this statement answer?", "options": _C7_01_OPTIONS, "correct_index": 2,
     "explanation": "Identifying WHERE, specifically, a zone or liquidity pool worth watching exists is Opportunity's job -- this lesson's own Worked Example."},
    {"prompt": "\"On the 15-minute chart, price just swept that liquidity and produced a confirming CHoCH.\" Which layer does this statement answer?", "options": _C7_01_OPTIONS, "correct_index": 3,
     "explanation": "Confirming a concrete structural signal showing the opportunity is live RIGHT NOW is Trigger's specific job -- this lesson's own Worked Example and Mini Quiz answer."},
    {"prompt": "\"On the 1-minute chart, here is the precise entry point within the trigger candle's confirmation.\" Which layer does this statement answer?", "options": _C7_01_OPTIONS, "correct_index": 4,
     "explanation": "Deciding exactly where, at the finest resolution, to place the actual entry is Execution's job -- the last of the five layers in this lesson's Worked Example."},
    {"prompt": "A trader has checked Macro, Direction, and Trigger, but never identified a specific zone or liquidity pool on the 1H chart before jumping to a 15-minute signal. Which layer did they skip entirely?", "options": _C7_01_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Scenario Challenge, verbatim: identifying a specific zone or liquidity pool consistent with the Direction read is Opportunity's job -- skipping straight from Direction to Trigger leaves this layer's question never actually answered."},
]

# ---------------------------------------------------------------------------
# C7-02 -- "Given six three-layer read combinations (provided in
# Practise), classify each as aligned, conflicting, or containing a
# transition-state layer, and state the appropriate confidence
# adjustment for each." classify kind.
# ---------------------------------------------------------------------------
C7_02_TITLE = "MTF Alignment vs. Conflict, Transition States"
_C7_02_OPTIONS = [
    "Full alignment -- highest confidence",
    "Outright conflict -- a confirmed opposing trend on a higher layer; reduced size or no trade",
    "Transition-affected -- one layer honestly unresolved (C2-03); caution, reduced confidence (not full rejection)",
]
C7_02_ITEMS = [
    {"prompt": "Macro (Daily): clear uptrend. Direction (4H): clear uptrend, agreeing. Opportunity (1H): demand zone in discount, consistent with both.", "options": _C7_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: all three layers agree on the same bullish bias -- full alignment, the highest-confidence configuration."},
    {"prompt": "Macro (Daily): clear uptrend. Direction (4H): has just produced a CHoCH and is now in transition (C2-03), not a confirmed trend either way. Opportunity: not yet assessed.", "options": _C7_02_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Worked Example's second scenario, verbatim: Direction is neither confirming nor confirming the opposite of Macro's bias -- an honestly unresolved transition state, calling for reduced confidence and caution, not outright rejection."},
    {"prompt": "Macro (Daily): clear uptrend. Direction (4H): confirmed, clean downtrend -- a direct, confirmed disagreement with Macro.", "options": _C7_02_OPTIONS, "correct_index": 1,
     "explanation": "A clean, CONFIRMED disagreement between Macro and Direction -- outright conflict, generally arguing for reduced size or no trade at all, since acting against a higher layer's confirmed bias is a materially different bet."},
    {"prompt": "Macro and Opportunity both support a long. Direction has just broken its prior trend's structure (a CHoCH) and hasn't confirmed a new direction yet.", "options": _C7_02_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Scenario Challenge, verbatim: Direction is in transition, not confirmed either way -- distinct from (and generally less severe than) a confirmed opposing trend, but still not full alignment."},
    {"prompt": "Macro and Opportunity agree on a bullish bias. Direction is CONFIRMED trending bearish -- a trader notices two of three layers agree and treats this as 'good enough.'", "options": _C7_02_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample, verbatim: two-out-of-three agreement does not override a CONFIRMED conflicting Direction layer -- this is outright conflict, a stronger warning than 'close enough to alignment' treats it as."},
    {"prompt": "Macro (Weekly): confirmed downtrend. Direction (4H): confirmed downtrend, agreeing. Opportunity (1H): a supply zone in premium, consistent with both.", "options": _C7_02_OPTIONS, "correct_index": 0,
     "explanation": "All three layers agree on the same bearish bias -- full alignment, the mirrored highest-confidence bearish case."},
]

# ---------------------------------------------------------------------------
# C7-03 -- "Given eight complete five-layer scenarios (provided in
# Practise), walk each through the decision tree and reach a long,
# short, or no-trade conclusion, citing which specific layer (if any)
# caused a no-trade result." classify kind.
# ---------------------------------------------------------------------------
C7_03_TITLE = "Long/Short Decision Trees, No-Trade Conditions"
_C7_03_OPTIONS = [
    "LONG -- every layer supports it",
    "SHORT -- every layer supports it",
    "NO TRADE -- Macro itself is unclear/in transition",
    "NO TRADE -- Direction is in outright conflict with Macro",
    "NO TRADE -- no valid Opportunity (zone/liquidity) present",
    "NO TRADE -- Opportunity exists but Trigger hasn't confirmed yet",
]
C7_03_ITEMS = [
    {"prompt": "Macro: clear uptrend. Direction: aligns (also uptrend). Opportunity: fresh demand zone in discount with nearby sell-side liquidity. Trigger: a full sweep + displacement + CHoCH sequence completes at that zone.", "options": _C7_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: every layer supports the same direction -- LONG, with Execution now the live question of entry precision."},
    {"prompt": "Macro: clear downtrend. Direction: aligns (also downtrend). Opportunity: fresh supply zone in premium with nearby buy-side liquidity. Trigger: a full sweep + displacement + CHoCH sequence completes at that zone.", "options": _C7_03_OPTIONS, "correct_index": 1,
     "explanation": "The mirrored case: every layer supports the same bearish direction -- SHORT."},
    {"prompt": "Macro itself shows no clear regime -- price is ranging with no confirmed trend, and Macro is itself in a C2-03 transition state.", "options": _C7_03_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own rule: if Macro itself is unclear or in transition, that alone is often sufficient for a no-trade conclusion, since nothing below it has a stable foundation to align with."},
    {"prompt": "Macro: clear uptrend. Direction: CONFIRMED downtrend -- a direct, confirmed disagreement with Macro.", "options": _C7_03_OPTIONS, "correct_index": 3,
     "explanation": "Outright conflict at the Direction layer is named in this lesson as a strong no-trade signal on its own, regardless of what lower layers might show."},
    {"prompt": "Macro: clear uptrend. Direction: aligns (also uptrend). Opportunity: no clear zone or liquidity pool exists anywhere consistent with this bias -- a trader considers forcing a trade on a weak, low-confluence area anyway.", "options": _C7_03_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Counterexample, verbatim: no valid Opportunity layer present means no trade, regardless of how clean the higher layers look -- forcing one on a weak area skips the tree's own honest conclusion."},
    {"prompt": "Macro: clear uptrend. Direction: aligns. Opportunity: fresh demand zone in discount with nearby liquidity -- but price is still approaching the zone, with no sweep or CHoCH completed yet.", "options": _C7_03_OPTIONS, "correct_index": 5,
     "explanation": "This lesson's own Scenario Challenge, verbatim: every layer up through Opportunity supports a long, but Trigger hasn't confirmed yet -- the correct conclusion right now is no trade (specifically, waiting), not forcing an early entry."},
    {"prompt": "Macro: clear downtrend. Direction: aligns (also downtrend). Opportunity: fresh supply zone in premium with nearby liquidity. Trigger: a clean BOS confirms continuation in the same direction.", "options": _C7_03_OPTIONS, "correct_index": 1,
     "explanation": "All four required layers support the same bearish direction, with Trigger confirmed via a clean BOS (an acceptable Trigger form per this lesson's own technical explanation, alongside the full sweep+displacement+CHoCH sequence) -- SHORT."},
    {"prompt": "Macro: unclear, ranging with no confirmed regime at all. A trader nonetheless finds an appealing-looking 15-minute pattern and wants to trade it immediately.", "options": _C7_03_OPTIONS, "correct_index": 2,
     "explanation": "Macro itself provides no stable foundation -- per this lesson's rule, an unclear Macro read alone is often sufficient for no trade, regardless of how appealing a lower-timeframe pattern looks on its own (this lesson's own echo of ORIENT-02's signal-vs-trade discipline)."},
]


async def seed_core7_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C7_01_TITLE, "classify", C7_01_ITEMS)
        count += await _upsert(db, C7_02_TITLE, "classify", C7_02_ITEMS)
        count += await _upsert(db, C7_03_TITLE, "classify", C7_03_ITEMS)
        await db.commit()
        print(f"\n{count} of 3 CORE_7 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core7_scenarios())
    sys.exit(0)
