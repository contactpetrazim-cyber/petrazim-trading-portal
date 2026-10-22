"""
Practice Scenario Set Seed Script — CORE_9 Trade Management Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1,
CORE_3 through CORE_8 done; this covers all three CORE_9 lessons,
C9-01 through C9-03 -- completing the top-priority CORE_1-CORE_9 tier
except the already-seeded CORE_2). No bot_strategies.py equivalent
exists for these concept-only lessons; every stage name, quadrant, and
worked scenario below is taken directly from
CORE_9_TRADE_MANAGEMENT.md's own Core Teaching / Worked Example / Key
Takeaways text (re-read in full immediately before writing this).
These three lessons are purely conceptual (no OHLC/pip arithmetic
involved), so no numeric verification script was needed, the same as
CORE_7.

Lesson titles below were checked against the LIVE DB -- all three
matched exactly with no title drift.

C9-01 note: the original drill asks the learner to "identify which
specific earlier lesson governed the decision made at each of the
five lifecycle stages" for a provided trade timeline -- adapted here
into five items, one per stage, each presenting a specific decision
statement and asking which stage/governing lesson it belongs to,
grounded directly in this lesson's own Worked Example.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core9
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C9-01 -- see module docstring. classify kind: given one lifecycle
# decision/statement, identify which stage (and governing lesson) it
# belongs to.
# ---------------------------------------------------------------------------
C9_01_TITLE = "Before Entry Through Exit: the Full Lifecycle"
_C9_01_OPTIONS = [
    "Pre-Trade Analysis (C7-03's five-layer decision tree)",
    "Entry (C8-01 sizing + C8-02 structural stop)",
    "Management (C8-03 partial exits, breakeven, trailing)",
    "Exit (the trade closes -- at target, at stop, or manual decision)",
    "Post-Trade Review (C8-02's R-multiple logging, compared against the original plan)",
]
C9_01_ITEMS = [
    {"prompt": "\"A trader works the five-layer decision tree to a long conclusion.\" Which stage does this describe?", "options": _C9_01_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: working the five-layer tree (C7-03) to a long/short/no-trade conclusion is the Pre-Trade Analysis stage."},
    {"prompt": "\"They calculate lot size from account equity and 1% risk, and place a stop at the structural invalidation level.\" Which stage does this describe?", "options": _C9_01_OPTIONS, "correct_index": 1,
     "explanation": "Sizing per C8-01's formula and placing a structural stop per C8-02 is the Entry stage, per this lesson's own Worked Example."},
    {"prompt": "\"As price moves favorably, they take a partial exit at the first target and move their stop to breakeven.\" Which stage does this describe?", "options": _C9_01_OPTIONS, "correct_index": 2,
     "explanation": "Partial exits and moving to breakeven (C8-03) as the trade develops is the Management stage."},
    {"prompt": "\"The trade eventually closes at the second target.\" Which stage does this describe?", "options": _C9_01_OPTIONS, "correct_index": 3,
     "explanation": "The trade actually closing -- at a target, at the stop, or by manual decision -- is the Exit stage."},
    {"prompt": "\"They log the R-multiple outcome and compare it against their original plan before moving on to analyzing the next opportunity.\" Which stage does this describe?", "options": _C9_01_OPTIONS, "correct_index": 4,
     "explanation": "Recording the outcome in R-multiples (C8-02) and comparing it against the ORIGINAL plan is Post-Trade Review -- the stage that closes the loop back into the next trade's Pre-Trade Analysis."},
    {"prompt": "A trader has excellent Entry-stage discipline (correct sizing, structural stops) but skips this stage entirely every single time, with no record of what actually happened versus what was planned. Which stage are they skipping?", "options": _C9_01_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Scenario Challenge, verbatim: skipping Post-Trade Review breaks the loop back into the next Pre-Trade Analysis -- there's no way to actually improve the process without it, even when every other stage is sound."},
]

# ---------------------------------------------------------------------------
# C9-02 -- "Given twelve completed trades with both their process
# details and their outcomes (provided in Practise), classify each
# into one of the four quadrants (good trade/won, good trade/lost, bad
# trade/won, bad trade/lost)." classify kind. Eight items (not twelve,
# to keep the set reviewable), covering all four quadrants with
# multiple examples each.
# ---------------------------------------------------------------------------
C9_02_TITLE = "Valid Loss vs. Bad Loss, Good Trade That Loses vs. Bad Trade That Wins"
_C9_02_OPTIONS = [
    "Good trade, valid loss -- process followed correctly, lost anyway (normal variance, no change needed)",
    "Good trade, good outcome -- process followed correctly, won",
    "Bad trade, bad loss -- process violated, lost (fix the specific broken step)",
    "Bad trade, lucky win -- process violated, won anyway by chance (the most dangerous quadrant)",
]
C9_02_ITEMS = [
    {"prompt": "A trader completes full Pre-Trade Analysis, sizes correctly, places a structural stop, and the trade hits that stop for a full loss.", "options": _C9_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: the process was sound throughout, and the loss is exactly the percentage of outcomes a genuinely good process is expected to produce. No process change warranted."},
    {"prompt": "A trader skips Pre-Trade Analysis entirely, enters on impulse with an oversized position and no structural stop, and the trade happens to close in profit.", "options": _C9_02_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Counterexample, verbatim: the process was violated at nearly every stage, and the favorable outcome is pure luck -- the most dangerous quadrant, since it reinforces exactly the broken behavior that should have been corrected."},
    {"prompt": "A trader completes full Pre-Trade Analysis, sizes correctly per C8-01, manages the trade per plan with partial exits and breakeven, and the trade reaches its final target.", "options": _C9_02_OPTIONS, "correct_index": 1,
     "explanation": "Full process followed correctly, and the outcome was favorable -- a good trade with a good outcome, the other 'process-sound' quadrant alongside the valid-loss case."},
    {"prompt": "A trader enters on an impulse signal with no five-layer analysis, oversizes the position well beyond C8-01's formula, never places a structural stop, and the trade is eventually stopped out (manually, in a panic) for a large loss.", "options": _C9_02_OPTIONS, "correct_index": 2,
     "explanation": "The process was violated at multiple stages, and it lost -- a bad trade and a bad loss. This one needs the specific broken steps (no analysis, no sizing discipline, no structural stop) identified and fixed."},
    {"prompt": "A trader works the full five-layer decision tree to a long conclusion, sizes correctly, places a structural stop at the protected low -- and price simply reverses through that level on a piece of unexpected news, stopping them out for the full planned risk.", "options": _C9_02_OPTIONS, "correct_index": 0,
     "explanation": "Every stage of the process was sound; the loss happened because that's what a real edge does some percentage of the time, not because anything was done wrong. A valid loss."},
    {"prompt": "A trader skips structural stop placement, instead moving their stop wider mid-trade specifically to avoid being stopped out (the exact mistake flagged back in C2-09), and the trade eventually turns around and closes in profit after that stop-widening.", "options": _C9_02_OPTIONS, "correct_index": 3,
     "explanation": "Moving a stop to avoid a loss is a real process violation (C2-09), and the trade winning anyway doesn't make that decision correct -- a bad trade, lucky win. Taking this as validation would teach exactly the wrong lesson."},
    {"prompt": "A trader completes the full five-layer analysis, sizes correctly, manages per plan with a trail on the stop -- and the trade's trailed stop is hit for a small, planned loss after giving back some open profit.", "options": _C9_02_OPTIONS, "correct_index": 0,
     "explanation": "The process (including the Management-stage trailing decision itself) was followed correctly throughout; the loss is a normal outcome of disciplined trailing, not a mistake. A valid loss."},
    {"prompt": "A trader's last three trades all lost money, but reviewing each one shows full process adherence -- real analysis, correct sizing, structural stops, disciplined management -- across all three. A colleague says 'something must be wrong, change your approach.'", "options": _C9_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Scenario Challenge, verbatim: a losing streak with consistently sound process is not automatically evidence something is broken -- these are three valid losses, exactly the outcome distribution ORIENT-03/04's expectancy math predicts some percentage of the time, not proof the process needs to change."},
]

# ---------------------------------------------------------------------------
# C9-03 -- "Given a ten-trade series with both process scores and
# R-multiple outcomes for each (provided in Practise), separately
# track both lines and identify whether the series shows a genuine
# process problem, normal outcome variance, or both." classify kind,
# adapted into per-series-summary items (since tracking two parallel
# lines across ten trades isn't itself a gradable single answer, the
# CONCLUSION drawn from a given process/outcome pattern is).
# ---------------------------------------------------------------------------
C9_03_TITLE = "Judging Process Separately From Outcome"
_C9_03_OPTIONS = [
    "Normal outcome variance -- process consistently sound; no change needed",
    "Genuine process problem -- process adherence was inconsistent or failing; needs a fix",
    "Both -- some real process failures AND some normal variance mixed together",
]
C9_03_ITEMS = [
    {"prompt": "Ten consecutive trades reviewed for process adherence (did they complete Pre-Trade Analysis, size correctly, manage per plan?) completely separately from outcome. Process score is consistently high across all ten; the R-multiple outcomes vary widely -- some wins, some valid losses.", "options": _C9_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: a consistently high process score with widely varying R-multiple outcomes tells you the process is sound and the outcome variation is expected, normal noise (ORIENT-03) -- not evidence of a problem to fix."},
    {"prompt": "Four losing trades in a row. Reviewing each one shows full process adherence across all four -- real analysis, correct sizing, structural stops, disciplined management every single time.", "options": _C9_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Scenario Challenge, verbatim: a short losing streak with consistently sound process adherence is expected variance (ORIENT-03's sample-size math), not reliable evidence the process needs to change."},
    {"prompt": "Ten consecutive trades reviewed the same way. The process score is inconsistent -- Pre-Trade Analysis was skipped on three of the ten, position sizing was off-formula on two others -- while the R-multiple outcomes happen to average out roughly breakeven over the series.", "options": _C9_03_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample-adjacent case: regardless of what the noisy outcome line shows, the process line itself reveals real, identifiable failures (skipped analysis, off-formula sizing) on five of the ten trades -- a genuine process problem that needs fixing, independent of the roughly neutral outcome."},
    {"prompt": "A trader reviews the same ten-trade series purely by outcome, sees a losing stretch, and concludes 'my approach is broken' -- without separately checking whether the process itself was followed correctly across those trades. On separate review, the process score turns out to have been consistently high throughout.", "options": _C9_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Counterexample, verbatim: concluding 'broken' from outcome alone, while the separately-checked process score was actually consistently sound, conflates a small, noisy outcome sample with a genuine process signal. Once actually checked, this is normal variance, not a process problem."},
    {"prompt": "Ten consecutive trades: the first six show strong, consistent process adherence with normal, varying outcomes (a mix of wins and valid losses). The last four show a clear breakdown -- skipped structural stops and impulsive sizing -- coinciding with four losses in a row.", "options": _C9_03_OPTIONS, "correct_index": 2,
     "explanation": "This series genuinely contains both patterns: the first six trades are sound process with normal outcome variance, while the last four show an actual, identifiable process breakdown. Treating the whole ten-trade series with one single verdict would miss that the back half has a real, fixable problem the front half didn't."},
]


async def seed_core9_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C9_01_TITLE, "classify", C9_01_ITEMS)
        count += await _upsert(db, C9_02_TITLE, "classify", C9_02_ITEMS)
        count += await _upsert(db, C9_03_TITLE, "classify", C9_03_ITEMS)
        await db.commit()
        print(f"\n{count} of 3 CORE_9 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core9_scenarios())
    sys.exit(0)
