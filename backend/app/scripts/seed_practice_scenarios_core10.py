"""
Practice Scenario Set Seed Script — CORE_10 Trading Psychology Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort, now in the
lowest-priority tier per this effort's own scope ordering. Covers all
ten CORE_10 lessons (PSY-01 through PSY-10). No bot_strategies.py
equivalent exists for these concept-only lessons; every rule, named
pattern, and worked scenario below is taken directly from
CORE_10_TRADING_PSYCHOLOGY.md's own Core Teaching / Worked Example /
Key Takeaways text for each lesson (re-read in full immediately before
writing this). PSY-08 is the one lesson in this module with real
numbers (the ~30-trade sample threshold and the +0.3R "real edge"
cutoff) -- both are this lesson's own explicitly stated platform
constants (matching the Standalone Coach Engine's documented
MIN_TRADES_FOR_CONFIDENCE and expectancy tiers), not invented
thresholds, so every item here was checked against those two exact,
stated numbers rather than a guessed cutoff.

Lesson titles below were checked against the LIVE DB -- all ten
matched exactly with no title drift.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core10
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# PSY-01 -- "Given three trade scenarios (provided in Practise) where
# price moves against an open position, identify which decisions were
# already pre-committed in the Pre-Trade Analysis stage and which are
# being made live -- and flag any live decision that should have been
# fixed beforehand." classify kind.
# ---------------------------------------------------------------------------
PSY_01_TITLE = "Emotional Regulation Under Live Risk"
_PSY_01_OPTIONS = [
    "Correctly pre-committed before risk went live -- executing the plan as designed",
    "A live decision that SHOULD have been pre-committed -- a regulation failure",
    "A live decision that is appropriately made live (pure execution, nothing to pre-commit)",
]
PSY_01_ITEMS = [
    {"prompt": "A trader defines a structural stop and two partial-exit targets before entering. Price moves against them toward the stop, and they let it execute rather than re-deciding whether to widen it.", "options": _PSY_01_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: the stop distance and invalidation were fixed calmly beforehand, and the trader simply executed that already-made plan."},
    {"prompt": "A trader enters with no defined stop distance, planning to 'decide based on how it feels.' As price moves against them, they widen their mental stop repeatedly, each time telling themselves it's still valid.", "options": _PSY_01_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample, verbatim: every one of those stop-widening decisions is being made by the heightened-arousal state live risk itself created -- a decision (the stop level) that should have been pre-committed before entry."},
    {"prompt": "Once price reaches the pre-committed first take-profit level, the trader places the order to close that portion of the position at the exact pre-planned price.", "options": _PSY_01_OPTIONS, "correct_index": 0,
     "explanation": "The decision of WHERE to exit was already made in Pre-Trade Analysis -- what's happening live is pure, mechanical execution of that plan, exactly as this lesson describes the job once a position is open."},
    {"prompt": "A trader says 'I had a stop planned, but once the trade was live it felt too tight, so I gave it more room.'", "options": _PSY_01_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the stop should have remained fixed once risk went live; 'it felt too tight' is exactly the heightened, in-the-moment state overriding a decision that was already correctly made calmly beforehand."},
]

# ---------------------------------------------------------------------------
# PSY-02 -- "Given five short trader statements (provided in
# Practise), identify which of the three cognitive errors (if any)
# each one demonstrates." classify kind.
# ---------------------------------------------------------------------------
PSY_02_TITLE = "Cognitive Errors: Confirmation Bias, Recency, Overconfidence"
_PSY_02_OPTIONS = ["Confirmation bias", "Recency bias", "Overconfidence", "None of these -- a well-calibrated statement"]
PSY_02_ITEMS = [
    {"prompt": "A trader, after entering long, actively notices every bullish lower-timeframe signal and mentally dismisses a bearish CHoCH on the same timeframe as 'probably nothing.'", "options": _PSY_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: selectively noticing evidence that supports a position already held, while dismissing contrary evidence -- confirmation bias."},
    {"prompt": "After three straight winning trades using a new variation of their setup, a trader concludes 'this variation is clearly better' and increases size.", "options": _PSY_02_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample, verbatim: treating a 3-trade sample as proof, when ORIENT-03 already established that sample sizes this small carry almost no statistical weight on their own -- recency bias."},
    {"prompt": "A trader has three winning trades in a row and says 'I've clearly figured this out, time to size up.'", "options": _PSY_02_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the same recency-bias pattern -- a short streak treated as proof far beyond what the sample size actually supports."},
    {"prompt": "A trader treats a C7-03 five-layer setup as a guaranteed winner, forgetting that even a good setup remains probabilistic rather than certain.", "options": _PSY_02_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own definition: treating a framework-based read as more certain than it actually is -- overconfidence, forgetting ORIENT-03/04's probabilistic framing."},
    {"prompt": "A trader checks a new piece of information against the same fixed, written process criteria they'd apply to any other trade, regardless of which position they currently hold or how recent results have gone.", "options": _PSY_02_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Good Example, verbatim: judging by fixed, external, written process criteria rather than existing position, streak, or felt confidence -- none of the three biases, a well-calibrated approach."},
]

# ---------------------------------------------------------------------------
# PSY-03 -- "Given four rule-violation scenarios (provided in
# Practise), classify each as 'no rule existed' or 'rule existed, not
# followed under pressure,' and propose the matching fix for each."
# classify kind.
# ---------------------------------------------------------------------------
PSY_03_TITLE = "Behavioural Discipline: Following Your Own Rules Under Pressure"
_PSY_03_OPTIONS = [
    "No rule existed -- the fix is defining one (a Core 8 gap)",
    "Rule existed and was correct, but wasn't followed under pressure -- the fix is a structural, pre-committed backstop (a PSY-03 gap)",
]
PSY_03_ITEMS = [
    {"prompt": "A trader has a defined 1% risk-per-trade rule. Under the pressure of an exciting, fast-moving setup, they size in at 3% 'just this once.'", "options": _PSY_03_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: the rule wasn't missing -- it existed and was correct -- it simply wasn't followed under pressure. The fix is a pre-trade hard check, not a better rule."},
    {"prompt": "A trader has no defined max-daily-loss rule at all, and keeps trading through a bad day with mounting losses.", "options": _PSY_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Counterexample, verbatim: there's no discipline failure to address until a rule actually exists -- the fix here is genuinely different: define the rule first (C8-04)."},
    {"prompt": "A trader says 'I know my max position size, I just didn't follow it that one time.' A colleague suggests 'you clearly need a stricter written rule.'", "options": _PSY_03_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the colleague's suggested fix is wrong -- the rule was already correct and known; what's missing is a structural, pre-committed enforcement mechanism, not a stricter written rule."},
    {"prompt": "A trader never set any rule at all about correlated exposure across open positions, and ends up with five USD-correlated longs open simultaneously without ever having decided on a limit.", "options": _PSY_03_OPTIONS, "correct_index": 0,
     "explanation": "No rule existed in the first place (this is the C8-04 correlated-exposure gap) -- the fix is to define the limit, not to add a structural enforcement mechanism for a rule that was never written."},
]

# ---------------------------------------------------------------------------
# PSY-04 -- "Given a trader's description of how they handled three
# different trades (provided in Practise), identify which of the
# seven steps were completed and which were skipped for each."
# classify kind, adapted into per-scenario "which step was skipped"
# items.
# ---------------------------------------------------------------------------
PSY_04_TITLE = "Process Psychology: Plan, Observe, Decide, Execute, Record, Review, Improve"
_PSY_04_OPTIONS = ["Plan", "Observe", "Decide", "Execute", "Record", "Review", "Improve", "None -- all seven steps were completed"]
PSY_04_ITEMS = [
    {"prompt": "A trader plans a trade via the five-layer stack, observes price approach the entry zone, confirms entry conditions are genuinely met, executes at the planned size and stop, records the outcome with an honest mood tag, reviews it as a valid loss since process was sound, and carries the same process into their next plan unchanged.", "options": _PSY_04_OPTIONS, "correct_index": 7,
     "explanation": "This lesson's own Worked Example, verbatim: all seven steps -- Plan, Observe, Decide, Execute, Record, Review, and Improve (here, correctly concluding nothing needs to change) -- were completed."},
    {"prompt": "A trader executes a trade well but skips logging the outcome entirely ('I remember how it went'), then moves straight to the next trade with no review.", "options": _PSY_04_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Counterexample, verbatim: skipping Record (and, as a direct consequence, Review) breaks the loop at exactly the point improvement information would have been generated, even though the trade itself was executed perfectly."},
    {"prompt": "A trader executes trades well and wins consistently for a month, but never records or reviews any of them, reasoning 'why fix what isn't broken?'", "options": _PSY_04_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Scenario Challenge, verbatim: regardless of the recent winning outcomes, Record and Review are both missing -- the loop never closes, so there's no data available to tell whether a pattern is quietly underperforming."},
]

# ---------------------------------------------------------------------------
# PSY-05 -- "Given four proposed checklist items (provided in
# Practise), determine which earlier curriculum lesson each one should
# be drawn from, and identify one item missing from an incomplete
# sample checklist." classify kind.
# ---------------------------------------------------------------------------
PSY_05_TITLE = "Pre-Trade Checklist Discipline"
_PSY_05_OPTIONS = ["C7-03 (five-layer alignment)", "C8-01 (position size calculation)", "C8-02 (structural stop placement)", "A written entry rationale (not drawn from a numbered lesson)"]
PSY_05_ITEMS = [
    {"prompt": "Checklist item: \"Macro, Direction, and Opportunity all confirmed, Trigger has fired.\" Which earlier lesson does this item come from?", "options": _PSY_05_OPTIONS, "correct_index": 0,
     "explanation": "This is C7-03's five-layer decision-tree alignment check, named explicitly in this lesson's own minimum checklist contents."},
    {"prompt": "Checklist item: \"Lot size calculated from current account equity and 1% risk.\" Which earlier lesson does this item come from?", "options": _PSY_05_OPTIONS, "correct_index": 1,
     "explanation": "This is C8-01's fixed-fractional sizing formula, named explicitly in this lesson's own minimum checklist contents."},
    {"prompt": "Checklist item: \"Stop placed at the C2-09 structural invalidation level, not an arbitrary fixed distance.\" Which earlier lesson does this item come from?", "options": _PSY_05_OPTIONS, "correct_index": 2,
     "explanation": "This is C8-02's structural stop placement rule, named explicitly in this lesson's own minimum checklist contents."},
    {"prompt": "A trader's checklist has three items checked (five-layer alignment, size calculated, structural stop placed) but entered anyway with no fourth item. What's the one item missing from this lesson's own stated minimum checklist?", "options": _PSY_05_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Worked Example lists a fourth required item beyond the three Core 7/8 checks: a written entry rationale in the trader's own words -- the exact record PSY-04's Record step and PSY-06's later review depend on."},
]

# ---------------------------------------------------------------------------
# PSY-06 -- "Given three post-trade review write-ups (provided in
# Practise, some anchored to a written plan and some reconstructed
# from memory), identify which show signs of outcome bias or
# hindsight rationalization." classify kind.
# ---------------------------------------------------------------------------
PSY_06_TITLE = "Post-Trade Review Without Self-Deception"
_PSY_06_OPTIONS = ["Honest review -- anchored to the written plan and actual data", "Outcome bias -- judging decision quality purely by win/loss", "Hindsight rationalization -- remembered reasoning quietly edited to match how the outcome felt"]
PSY_06_ITEMS = [
    {"prompt": "A trader pulls up their written pre-trade rationale and the actual exit data: the checklist was fully completed, the stop was hit exactly as planned. They classify it as a valid loss and make no process change.", "options": _PSY_06_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: anchored to the written record rather than how the loss felt afterward -- an honest review."},
    {"prompt": "Reviewing the same kind of loss from memory alone days later, a trader unconsciously reconstructs the story as 'I probably shouldn't have taken that setup' -- even though their actual written checklist shows every requirement was correctly met.", "options": _PSY_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: the loss feels like it should have been avoidable, so memory quietly edits the story to match that feeling -- hindsight rationalization."},
    {"prompt": "A trader reviews a winning trade and concludes 'that confirms my instincts were right' -- but their written pre-trade checklist shows two required items were actually skipped.", "options": _PSY_06_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: judging the decision as good purely because it won, while the actual written record shows the process was incomplete -- outcome bias."},
]

# ---------------------------------------------------------------------------
# PSY-07 -- "Given six trade-entry scenarios (provided in Practise),
# classify each as impulse, revenge trading, FOMO, or a genuine
# checklist-qualified entry." classify kind.
# ---------------------------------------------------------------------------
PSY_07_TITLE = "Detectors: Impulse, Revenge Trading, FOMO"
_PSY_07_OPTIONS = ["Impulse trading", "Revenge trading", "FOMO", "Genuine checklist-qualified entry -- none of these"]
PSY_07_ITEMS = [
    {"prompt": "A trader takes a full stop-loss on a well-planned trade. Ten minutes later they enter a different symbol, sized larger than usual, with no completed checklist, driven by wanting to make the loss back immediately.", "options": _PSY_07_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: a new position driven specifically by the need to recover the prior loss, with no independent qualified setup -- revenge trading."},
    {"prompt": "After the same stop-loss, a different trader sits out and waits for their next checklist-qualified setup, which happens to appear an hour later on a different symbol.", "options": _PSY_07_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Counterexample, verbatim: even though a new trade follows a loss, it has an independent, fully completed rationale unrelated to recovering the prior loss -- not revenge trading."},
    {"prompt": "A trader enters a move already well underway, specifically because it's moving fast and looks like it's 'leaving without them,' with no entry condition actually met at the current price.", "options": _PSY_07_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own definition, verbatim: entering because a move is already happening rather than because a genuine entry condition was met at the current price -- FOMO."},
    {"prompt": "A trader enters a position because the setup simply looked appealing in the moment, with no five-layer confirmation and no written rationale at all.", "options": _PSY_07_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own definition, verbatim: bypassing the pre-trade checklist entirely, driven by how appealing the setup looks in the moment -- impulse trading."},
    {"prompt": "A trader enters a new trade twenty minutes after a stop-loss, on a different symbol, with a fully completed checklist and written rationale entirely unrelated to the prior loss. A colleague assumes it's revenge trading purely because of the timing.", "options": _PSY_07_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the colleague's assumption is wrong -- proximity in time alone doesn't make it revenge trading; the independent, checklist-qualified rationale means it isn't."},
    {"prompt": "A trader sees a rapid breakout candle and enters mid-move without checking any of the five layers, purely because the candle looks dramatic and they don't want to miss the continuation.", "options": _PSY_07_OPTIONS, "correct_index": 2,
     "explanation": "Entering because the move is already happening and looks like it's leaving without them, with no genuine entry condition checked -- FOMO."},
]

# ---------------------------------------------------------------------------
# PSY-08 -- "Given four trader statements paired with their actual
# sample size and expectancy (provided in Practise), determine whether
# the stated confidence is well-calibrated, overconfident, or
# under-confident." classify kind. Uses this lesson's own exact,
# stated platform constants (~30-trade threshold, +0.3R "real edge"
# cutoff) -- not invented numbers.
# ---------------------------------------------------------------------------
PSY_08_TITLE = "Confidence Calibration: Matching Certainty to Actual Edge"
_PSY_08_OPTIONS = ["Well-calibrated", "Overconfident -- feeling exceeds what the sample size/expectancy actually supports", "Under-confident -- feeling falls short of what a large, genuinely positive sample supports"]
PSY_08_ITEMS = [
    {"prompt": "A trader with 8 trades and a strong recent win rate feels highly confident and considers increasing size.", "options": _PSY_08_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: 8 trades is well under the ~30-trade threshold this platform treats as meaningful -- feeling highly confident here is overconfidence relative to what the sample actually supports."},
    {"prompt": "A trader with 60 trades and a consistent +0.4R expectancy describes their edge only tentatively, as 'maybe okay, hard to say.'", "options": _PSY_08_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: 60 trades clears the ~30-trade threshold, and +0.4R clears the +0.3R 'real, measurable edge' cutoff -- staying vaguely uncertain here is under-confidence, a miscalibration in the opposite direction."},
    {"prompt": "A trader has 45 trades at +0.35R expectancy and says 'I still don't really trust this, could be luck.'", "options": _PSY_08_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Scenario Challenge, verbatim: 45 trades clears the ~30-trade threshold and +0.35R clears the +0.3R cutoff -- this is a real, measurable edge by this platform's own standard, so staying this doubtful is a calibration failure, not appropriate caution."},
    {"prompt": "A trader with 35 trades and a +0.05R expectancy (barely positive, well under +0.3R) describes their edge honestly as 'not yet a real edge, modest at best, not ready to scale.'", "options": _PSY_08_OPTIONS, "correct_index": 0,
     "explanation": "35 trades clears the ~30-trade sample threshold, and a +0.05R expectancy is correctly described per this lesson's own tiering as modest/not-yet-a-real-edge rather than either overstated or needlessly dismissed. Well-calibrated."},
]

# ---------------------------------------------------------------------------
# PSY-09 -- "Given three end-of-day trader logs (provided in
# Practise), determine whether a pre-defined shutdown condition was
# met, and whether the trader actually stopped when it was." classify
# kind.
# ---------------------------------------------------------------------------
PSY_09_TITLE = "Shutdown Protocol: Recognizing When to Stop for the Day"
_PSY_09_OPTIONS = ["Trigger met, and honored -- trader stopped as pre-committed", "Trigger met, but NOT honored -- trader kept trading anyway", "Trigger not met -- no shutdown decision was required"]
PSY_09_ITEMS = [
    {"prompt": "A trader pre-commits that three consecutive losses triggers an automatic stop. After the third loss, a compelling-looking setup appears, but they close the platform for the day anyway.", "options": _PSY_09_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: the pre-committed trigger was met (three consecutive losses) and honored exactly as planned, despite the tempting setup."},
    {"prompt": "A trader has no defined stopping condition and, after three losses, decides live whether to keep going, reasoning 'the next one will make it back.'", "options": _PSY_09_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: with no pre-defined trigger at all, there's no trigger to have been met or honored -- this is the structural gap PSY-09 exists to close, not a case of a met trigger being ignored."},
    {"prompt": "A trader's shutdown rule is 'three consecutive losses.' After the third loss, a setup appears that looks unusually strong, and they take it anyway, reasoning 'just this one.'", "options": _PSY_09_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the pre-defined trigger (three consecutive losses) was met, but the trader reopened the decision live and kept trading -- met but not honored, reintroducing exactly the unreliable live judgment the protocol exists to prevent."},
]

# ---------------------------------------------------------------------------
# PSY-10 -- Capstone. "Given a full trading-day scenario with six
# decision points (provided in Practise), identify which specific
# PSY-01 through PSY-09 principle governs each decision, and evaluate
# whether the trader in the scenario applied it correctly." classify
# kind, grounded in this lesson's own Worked Example and Counterexample
# full-day narratives.
# ---------------------------------------------------------------------------
PSY_10_TITLE = "Psychology Capstone"
_PSY_10_OPTIONS = [
    "PSY-01/PSY-05 (pre-committed, calm planning) -- applied correctly",
    "PSY-06 (honest post-trade review) -- applied correctly",
    "PSY-06 (honest post-trade review) -- FAILED (hindsight rationalization from memory alone)",
    "PSY-07 (detector test for revenge/FOMO) -- applied correctly (independent, qualified entry)",
    "PSY-07 (detector test) -- FAILED (revenge trading, sized up to recover a loss)",
    "PSY-08 (calibrated confidence) -- applied correctly (edge correctly described as not yet established)",
    "PSY-09 (shutdown protocol) -- applied correctly (trigger honored)",
    "PSY-09 (shutdown protocol) -- FAILED (trigger ignored, kept trading past the pre-committed point)",
]
PSY_10_ITEMS = [
    {"prompt": "Decision point: A trader builds their plan and checklist calmly before the market opens, with every entry criterion, size, and stop defined in advance.", "options": _PSY_10_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: calm, pre-market planning per PSY-01's pre-commitment principle and PSY-05's written checklist -- applied correctly."},
    {"prompt": "Decision point: After a stop-loss, the trader reviews it against their written pre-trade plan and actual exit data, correctly classifying it as a valid loss with no process change warranted.", "options": _PSY_10_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: an honest review anchored to the written record -- PSY-06 applied correctly."},
    {"prompt": "Decision point (the Counterexample trader): After the first loss, they review it only from memory and conclude vaguely 'bad luck,' without checking the written plan that would have shown every requirement was actually met.", "options": _PSY_10_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: a memory-only review carries hindsight-rationalization risk (PSY-06) -- a failed application of honest review."},
    {"prompt": "Decision point: A second setup appears quickly after the loss. Checked against the detector test, it has an independent, checklist-qualified rationale unrelated to the prior loss.", "options": _PSY_10_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Worked Example, verbatim: an independent, qualified entry, correctly identified as NOT revenge trading -- PSY-07's detector test applied correctly."},
    {"prompt": "Decision point (the Counterexample trader): They enter a second trade sized larger than usual, specifically 'to make it back' after the first loss, with no independent checklist-qualified rationale.", "options": _PSY_10_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Counterexample, verbatim: sized up specifically to recover a loss, with no independent rationale -- revenge trading, a failed PSY-07 application."},
    {"prompt": "Decision point: The second trade wins, but with only 12 trades logged this month, the trader correctly describes their edge as 'not yet established' rather than newly confident.", "options": _PSY_10_OPTIONS, "correct_index": 5,
     "explanation": "This lesson's own Worked Example, verbatim: 12 trades is well under the ~30-trade threshold (PSY-08) -- correctly resisting the urge to feel newly confident off one win."},
    {"prompt": "Decision point: After two more losses meet the trader's pre-defined shutdown condition, they close the platform for the day without reopening the decision.", "options": _PSY_10_OPTIONS, "correct_index": 6,
     "explanation": "This lesson's own Worked Example, verbatim: the pre-committed shutdown trigger (PSY-09) was met and honored without renegotiation."},
    {"prompt": "Decision point (the Counterexample trader): They keep trading well past their informal, never-written stopping point, with no pre-defined trigger ever actually honored.", "options": _PSY_10_OPTIONS, "correct_index": 7,
     "explanation": "This lesson's own Counterexample, verbatim: PSY-09's structural gap -- no shutdown trigger was ever actually pre-committed and honored, so trading continued well past where it should have stopped."},
]


async def seed_core10_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, PSY_01_TITLE, "classify", PSY_01_ITEMS)
        count += await _upsert(db, PSY_02_TITLE, "classify", PSY_02_ITEMS)
        count += await _upsert(db, PSY_03_TITLE, "classify", PSY_03_ITEMS)
        count += await _upsert(db, PSY_04_TITLE, "classify", PSY_04_ITEMS)
        count += await _upsert(db, PSY_05_TITLE, "classify", PSY_05_ITEMS)
        count += await _upsert(db, PSY_06_TITLE, "classify", PSY_06_ITEMS)
        count += await _upsert(db, PSY_07_TITLE, "classify", PSY_07_ITEMS)
        count += await _upsert(db, PSY_08_TITLE, "classify", PSY_08_ITEMS)
        count += await _upsert(db, PSY_09_TITLE, "classify", PSY_09_ITEMS)
        count += await _upsert(db, PSY_10_TITLE, "classify", PSY_10_ITEMS)
        await db.commit()
        print(f"\n{count} of 10 CORE_10 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core10_scenarios())
    sys.exit(0)
