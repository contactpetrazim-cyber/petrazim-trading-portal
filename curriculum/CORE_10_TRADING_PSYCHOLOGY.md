# CORE 10 — TRADING PSYCHOLOGY

---

## PSY-01 — Emotional Regulation Under Live Risk

**Level:** 4
**Estimated study time:** 14 minutes
**Prerequisites:** C9-03, ORIENT-04
**Learning objectives:** Explain why live risk produces a different
emotional state than analysis or backtesting, and name the specific
regulation habit (pre-committing to the plan before risk is live) that
keeps that state from overriding a sound process.

### Why This Matters

Every lesson from Core 2 through Core 9 was learnable, and testable,
with zero money at risk. The moment real capital is on the line, the
same setup that looked obvious on a backtest chart starts to feel
different — and that felt difference, not a gap in technical
knowledge, is the single most common reason a trader with a genuinely
sound process still fails to execute it. Psychology is not a bonus
module on top of the curriculum; it's the missing piece that makes
everything already learned actually usable under real conditions.

### Core Teaching

**Plain-English explanation.** Emotional regulation under live risk
means noticing that your state has shifted — tighter, faster,
more urgent — without letting that shifted state make the decision.
The plan was built calmly, using the full five-layer analysis (C7-03)
and a defined process (C9-01), before any money was at risk. The job,
once a position is open, is to execute that already-made plan, not to
re-decide the trade from inside the emotional state live risk creates.

**Technical explanation.** The mechanism worth naming explicitly is
timing: a decision made under live risk is being made by a nervous
system in a measurably different state (heightened arousal, narrowed
attention, urgency bias) than the one that built the original plan
calmly beforehand. The fix isn't "feel less" — that's not a reliably
controllable input — the fix is architectural: move every decision
that can be pre-committed (entry criteria, C8-02's stop, C8-03's
partials and targets) to BEFORE risk goes live, so the in-the-moment,
emotionally-loaded self has as little left to decide as possible. This
is exactly why C9-01's lifecycle separates Pre-Trade Analysis from
Management as distinct stages — the separation is a regulation tool,
not just an organizational one.

### Visual Model

See diagram: `visuals/psy-01-decision-timing.svg` — a timeline with a
vertical line marking "risk goes live." Left of the line: a calm-state
icon, labeled "plan built here — stop, targets, invalidation all
defined." Right of the line: a heightened-state icon, labeled
"execute here — the fewer new decisions required in this zone, the
better," with an arrow showing pre-committed decisions crossing the
line unchanged.

### Worked Example

A trader completes full Pre-Trade Analysis, defines a structural stop
and two partial-exit targets (C8-02, C8-03) before entering. Once
filled, price moves against them toward the stop. Because the stop
distance and invalidation level were fixed calmly beforehand, they let
it execute rather than re-deciding whether to widen it in the moment —
the harder, calmer decision was already made in advance.

### Counterexample

A different trader enters with the same setup but no defined stop
distance, planning to "decide based on how it feels." As price moves
against them, live risk produces urgency, and they widen their mental
stop repeatedly, each time telling themselves it's still valid. Every
one of those decisions is being made by the heightened-arousal state
live risk itself created, not the calm state that should be governing
it.

### Good Example / Bad Example

Good: Treating every stop, target, and invalidation level as fixed the
moment risk goes live, with the only real-time job being execution of
an already-made plan. Bad: Leaving key trade decisions open-ended
"to be figured out" once the position is live, effectively handing the
decision to whichever emotional state shows up in the moment.

### What to Look Out For

- Live risk reliably produces a different internal state than
  analysis — this is expected, not a personal failing.
- The fewer decisions left open once risk is live, the less that
  state gets to influence the outcome.
- A stop or target that "needs to be reconsidered" mid-trade is almost
  always a sign the Pre-Trade Analysis stage (C7-03) wasn't actually
  finished before entry.

### Common Mistakes

A common mistake is treating emotional regulation as something to
achieve through willpower in the moment, rather than through
architecture beforehand — pre-committing the decisions that can be
pre-committed so there's less left to regulate live.

### Key Takeaways

1. Live risk produces a measurably different internal state than
   analysis — expect it, don't fight it directly.
2. Pre-committing stop, targets, and invalidation before risk goes
   live moves the hardest decisions into the calmer state that should
   govern them.
3. In-the-moment execution should mean carrying out an already-made
   plan, not re-deciding the trade from inside live risk.

### Practice Drill

Given three trade scenarios (provided in Practise) where price moves
against an open position, identify which decisions were already
pre-committed in the Pre-Trade Analysis stage and which are being
made live — and flag any live decision that should have been fixed
beforehand.

### Scenario Challenge

A trader says "I had a stop planned, but once the trade was live it
felt too tight, so I gave it more room." Using this lesson's
vocabulary, what specifically went wrong, and at which stage should
the fix actually happen?

### Mini Quiz

Q1 (True/False): Feeling urgency or tightness once a trade is live is
a sign something is wrong with the trader.
Answer: False — live risk reliably produces a different internal
state than analysis; the goal is pre-committing decisions, not
eliminating the feeling.

Q2 (Multiple choice): Which decision should be made BEFORE risk goes
live, not during?
(a) Whether to check the news mid-trade
(b) The structural stop and invalidation level
(c) What to have for lunch
(d) Nothing — every decision should be made live for maximum
    flexibility

Answer: (b).

### Flashcards

- Front: Why does live risk change decision quality? Back: It puts a
  heightened-arousal, urgency-biased state in charge of decisions
  that were better made calmly beforehand.
- Front: What's the core regulation strategy this lesson teaches?
  Back: Pre-commit every decision that can be pre-committed (stop,
  targets, invalidation) before risk goes live, minimizing what's
  left to decide under a worse-suited state.

### Reflection

Think of a recent trade where a decision felt different once risk was
live than it had in analysis. Which specific decision was still open
at that point, and how could it have been pre-committed instead?

### Mastery Criteria

Correctly identify pre-committed vs. live-made decisions across all
three practice-drill scenarios, and correctly flag which live
decisions should have been fixed beforehand.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this decision-timing model is
the foundation every later Psychology lesson builds on.

### Bot Connection

The platform's own Weekly Review Engine logs an `EmotionalJournalEntry`
against every trade with a `mood_tag` (e.g. "calm", "anxious",
"confident", "fomo", "revenge", "tilted") captured at trade time — the
same live-vs-calm-state distinction this lesson teaches, made
concrete enough to actually track and review trade by trade.

---

## PSY-02 — Cognitive Errors: Confirmation Bias, Recency, Overconfidence

**Level:** 4
**Estimated study time:** 15 minutes
**Prerequisites:** PSY-01
**Learning objectives:** Name three specific cognitive errors
(confirmation bias, recency bias, overconfidence) and identify how
each one distorts a trade decision by pulling attention or weight away
from what the actual process calls for.

### Why This Matters

PSY-01 covered the emotional-state problem; this lesson covers a
separate, equally real problem — even a perfectly calm decision can
still be wrong because of a predictable, well-documented bias in how
people process information. Naming these errors precisely is what
makes them catchable in the moment, rather than only visible in
hindsight.

### Core Teaching

**Plain-English explanation.** Confirmation bias is over-weighting
information that supports a trade idea you already like and
under-weighting information against it — for example, noticing every
bullish candle after entering long while dismissing bearish ones as
noise. Recency bias is over-weighting the last few outcomes (a recent
win streak feels like proof the current approach is working; a recent
loss streak feels like proof it's broken) far beyond what a small
sample actually supports (ORIENT-03). Overconfidence is treating a
framework-based read (C7-03's decision tree) as more certain than it
actually is — forgetting that even a good setup is still probabilistic,
not a guaranteed outcome (ORIENT-03, ORIENT-04).

**Technical explanation.** All three errors share the same underlying
mechanism: they substitute a comfortable, easily-available signal
(what you already believe, what happened most recently, how confident
a setup FEELS) for the actual process-defined signal (the five-layer
stack's real conditions, C7-03; a properly-sized sample, ORIENT-03).
This is precisely why C9-03's process/outcome separation matters as a
countermeasure — a trader who judges by explicit, written process
criteria has much less room for confirmation bias to selectively
notice supporting evidence, much less room for a short streak to feel
like proof, and much less room for a framework read to be mistaken for
certainty, because the criteria being checked are fixed and external
rather than felt.

### Visual Model

See diagram: `visuals/psy-02-three-biases.svg` — three labeled panels:
"Confirmation Bias" (a funnel selectively letting supporting evidence
through, blocking contrary evidence), "Recency Bias" (a short
3-trade window shown oversized next to a correctly-sized 30-trade
sample), "Overconfidence" (a probability dial showing a framework's
real ~55-60% edge next to a mistaken "certain" reading).

### Worked Example

A trader takes a long per C7-03's decision tree. After entry, they
actively notice every bullish signal on lower timeframes and mentally
dismiss a bearish CHoCH (C2-07) on the same timeframe as "probably
nothing" — confirmation bias in action. Naming it as such, they force
themselves to weigh the CHoCH by the same C2-07 criteria they'd apply
to any other trade, not by whether it supports the position they're
already in.

### Counterexample

A different trader, after three straight winning trades using a new
variation of their setup, concludes "this variation is clearly
better" and increases size — pure recency bias, treating a 3-trade
sample as proof when ORIENT-03 already established that sample sizes
this small carry almost no statistical weight on their own.

### Good Example / Bad Example

Good: Checking new information against the SAME fixed process
criteria regardless of which position is already open or how recent
results have gone. Bad: Letting an existing position, a recent streak,
or a confident feeling change which evidence gets noticed or how much
weight it's given.

### What to Look Out For

- Confirmation bias shows up as selectively noticing evidence that
  agrees with a position you already hold.
- Recency bias shows up as treating a short streak (win or loss) as
  proof, when ORIENT-03 already established what sample size that
  actually requires.
- Overconfidence shows up as forgetting that even a good C7-03 setup
  is probabilistic, not guaranteed.

### Common Mistakes

The most common version of this mistake is not recognizing any of the
three by name in the moment — they feel like ordinary reasoning
("this makes sense," "this pattern is repeating," "this is clearly a
good trade") rather than identifiable, well-documented distortions,
which is exactly why naming them explicitly is the actual skill this
lesson teaches.

### Key Takeaways

1. Confirmation bias over-weights evidence supporting a position
   already held.
2. Recency bias over-weights a short recent streak far beyond what
   ORIENT-03's sample-size math actually supports.
3. Overconfidence mistakes a probabilistic framework read for
   certainty.

### Practice Drill

Given five short trader statements (provided in Practise), identify
which of the three cognitive errors (if any) each one demonstrates.

### Scenario Challenge

A trader has three winning trades in a row and says "I've clearly
figured this out, time to size up." Using ORIENT-03's sample-size math
and this lesson's vocabulary, what's the actual, honest read on that
statement?

### Mini Quiz

Q1 (True/False): A three-trade winning streak is generally strong
statistical evidence that a change in approach is working.
Answer: False — this is recency bias; ORIENT-03 already established
that a sample this small carries almost no reliable statistical
weight.

Q2 (Multiple choice): What's the core countermeasure this lesson
points back to for all three biases?
(a) Trading purely on gut feeling
(b) Judging against fixed, external, written process criteria rather
    than felt confidence or recent results
(c) Ignoring all new information after entry
(d) Increasing size after any win

Answer: (b).

### Flashcards

- Front: What do confirmation bias, recency bias, and overconfidence
  have in common? Back: All three substitute a comfortable, easily
  available signal (existing belief, recent streak, felt confidence)
  for the actual process-defined signal.
- Front: What's the main countermeasure? Back: Judging against fixed,
  written process criteria (C9-03) rather than what feels true from
  inside the position, the streak, or the confidence level.

### Reflection

Recall a trade where, in hindsight, you noticed only the evidence
that supported a position you already held. Which of the three biases
was that, and what fixed process criterion would have caught it at
the time?

### Mastery Criteria

Correctly classify all five practice-drill statements by which
cognitive error (or none) each one demonstrates.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — these three errors resurface
directly in PSY-07's Detectors lesson as observable, taggable
patterns.

### Bot Connection

The Weekly Review Engine's mood-performance analysis flags exactly
this kind of pattern mechanically: when trades logged under a given
`mood_tag` average meaningfully worse than the account's overall
expectancy across at least 3 trades, it surfaces "worth a hard look at
whether this should be a no-trade condition" — a direct, data-driven
check against the recency- and confidence-driven self-assessment this
lesson warns is unreliable on its own.

---

## PSY-03 — Behavioural Discipline: Following Your Own Rules Under Pressure

**Level:** 4
**Estimated study time:** 14 minutes
**Prerequisites:** PSY-01, PSY-02
**Learning objectives:** Distinguish a rule violation caused by not
having a rule from one caused by having a rule and not following it
under pressure, and explain why the second failure mode requires a
different fix.

### Why This Matters

PSY-01 and PSY-02 explained WHY decisions get distorted under live
risk and by cognitive bias. This lesson addresses a distinct, later
failure point: a trader can know the rule, agree with the rule, and
still not follow it in the moment pressure actually arrives — the gap
between knowing a rule and executing it under real conditions.

### Core Teaching

**Plain-English explanation.** Behavioural discipline means executing
your own already-defined rules (C8-01's sizing, C8-02's stop, C9-01's
lifecycle) at the exact moment pressure makes them hardest to follow —
not just agreeing with them in the abstract, calm moments when no
money is at risk. A rule that only gets followed when it's easy isn't
actually providing risk management; it's providing risk management
only in the scenarios where it was least needed.

**Technical explanation.** The distinction that matters here is
between two different failure modes that look identical from the
outside (a broken rule) but need different fixes: not having a rule
at all (a Core 8 gap — the fix is defining one), versus having a
correct, already-defined rule and abandoning it specifically under
pressure (a PSY-03 gap — the fix is a pre-committed enforcement
mechanism, not a better rule). This second failure mode is why C8-06's
kill switches and circuit breakers exist as automated, non-negotiable
backstops rather than relying on discipline alone — the platform's own
design assumes that even a correct rule will sometimes not be followed
under real pressure, and builds a structural check for exactly that
case rather than treating it as purely a psychology problem to be
willed away.

### Visual Model

See diagram: `visuals/psy-03-two-failure-modes.svg` — two paths both
ending in "rule broken": Path A "No rule existed" (fix: define one,
Core 8) and Path B "Rule existed, correct, not followed under
pressure" (fix: automated backstop, C8-06, since willpower alone
isn't reliable under real pressure) — both paths visually converge to
the same broken-rule outcome, showing why the outside view alone can't
tell them apart.

### Worked Example

A trader has a defined 1% risk-per-trade rule (C8-01). Under the
pressure of a fast-moving setup they're excited about, they size in at
3% "just this once." The rule wasn't missing — it existed and was
correct — it simply wasn't followed under pressure. The fix here isn't
writing a better sizing rule; it's a pre-trade hard check (like this
platform's own manual-trading risk validation) that catches an
oversized order before it's placed, regardless of how confident the
trader feels in the moment.

### Counterexample

A different trader has no defined max-daily-loss rule at all (a Core 8
gap, not a PSY-03 one) and keeps trading through a bad day with
mounting losses. The fix here is genuinely different: define the rule
first (C8-04), since there's no discipline failure to address until a
rule actually exists to be disciplined about.

### Good Example / Bad Example

Good: Treating a rule broken under pressure as evidence the
enforcement needs to be structural (a hard check, an automated limit)
rather than assuming better intentions next time will fix it. Bad:
Responding to a rule broken under pressure with only "I'll try harder
to follow it next time," when the actual fix that matches this
specific failure mode is a pre-committed structural backstop.

### What to Look Out For

- A broken rule from the outside looks identical whether the rule
  never existed or existed and wasn't followed — the fix is different
  in each case.
- Pressure is precisely when a merely-agreed-with rule is least
  likely to be followed — this is expected, not a personal failing.
- Structural, automated backstops (C8-06) exist because discipline
  alone is known to fail under real pressure, not as a replacement for
  discipline.

### Common Mistakes

A common mistake is responding to every rule violation with the same
generic fix ("be more disciplined"), without first diagnosing whether
the actual gap was a missing rule (Core 8) or a correct rule not
enforced under pressure (PSY-03) — these need genuinely different
fixes.

### Key Takeaways

1. A rule broken under pressure may mean no rule existed, or a
   correct rule wasn't followed — diagnose which before fixing it.
2. Willpower-only enforcement is known to be unreliable under real
   pressure — this is why structural backstops exist.
3. The fix for a not-followed rule is a pre-committed structural
   check, not simply resolving to try harder next time.

### Practice Drill

Given four rule-violation scenarios (provided in Practise), classify
each as "no rule existed" or "rule existed, not followed under
pressure," and propose the matching fix for each.

### Scenario Challenge

A trader says "I know my max position size, I just didn't follow it
that one time." A colleague suggests "you clearly need a stricter
written rule." Using this lesson's vocabulary, is a stricter written
rule actually the right fix here? What would be?

### Mini Quiz

Q1 (True/False): A rule that was correctly defined but not followed
under pressure should be fixed by writing a better rule.
Answer: False — the rule was already correct; the fix is a
structural, pre-committed enforcement mechanism, not a better rule.

Q2 (Multiple choice): Why do structural backstops like kill switches
(C8-06) exist alongside discipline, rather than instead of relying on
discipline being taught at all?
(a) Discipline doesn't matter
(b) Even a correct, agreed-with rule is known to sometimes not be
    followed under real pressure, so a structural backstop covers
    that specific failure mode
(c) Automated systems are always superior to human judgment
(d) They exist purely for regulatory reasons

Answer: (b).

### Flashcards

- Front: What are the two different reasons a rule can end up broken?
  Back: The rule never existed (a Core 8 gap), or the rule existed and
  was correct but wasn't followed under pressure (a PSY-03 gap) —
  different fixes for each.
- Front: Why isn't "try harder next time" a sufficient fix for a rule
  broken under pressure? Back: Pressure is precisely the condition
  under which willpower-only enforcement is known to fail; the fix
  needs to be structural, not just better intentions.

### Reflection

Think of a rule you know but have broken under pressure at least
once. Was a structural check available that could have caught it
before it happened? What would that check look like?

### Mastery Criteria

Correctly classify all four practice-drill scenarios by failure mode
and propose the matching fix for each.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this two-failure-mode
distinction underlies PSY-05's checklist discipline and PSY-09's
shutdown protocol.

### Bot Connection

This platform's manual-trading order path runs real, automated
risk-engine checks (daily-trade-count limits, summed-portfolio
exposure) at order time specifically because relying on a trader to
remember and follow their own sizing rule under pressure, alone, isn't
treated as sufficient — exactly the structural-backstop logic this
lesson teaches.

---

## PSY-04 — Process Psychology: Plan, Observe, Decide, Execute, Record, Review, Improve

**Level:** 4
**Estimated study time:** 15 minutes
**Prerequisites:** PSY-03, C9-01
**Learning objectives:** Name all seven steps of the Plan-Observe-
Decide-Execute-Record-Review-Improve loop and map each one onto the
specific earlier curriculum lesson or platform mechanism that governs
it.

### Why This Matters

C9-01 already gave the five-stage trade lifecycle. This lesson widens
that into a seven-step PSYCHOLOGICAL loop that wraps around it —
adding the explicit habits (Observe, Record, Improve) that turn a
one-off good trade into a repeatable, improving process over time,
rather than a lucky instance of good execution that isn't reliably
reproduced.

### Core Teaching

**Plain-English explanation.** The seven steps are: Plan (C7-03's
decision tree, C8-01/02's sizing and stop — built calmly, before risk
is live, per PSY-01), Observe (watching price develop against the plan
without yet acting), Decide (confirming entry conditions are actually
met, not just close), Execute (placing the trade exactly as planned),
Record (logging the outcome honestly, including the emotional state at
the time — PSY-01's mood_tag), Review (C9-02/C9-03's process-vs-outcome
classification, applied to this specific trade), and Improve (only
changing the process in response to an identified, specific process
failure — never in response to a single outcome, per C9-03).

**Technical explanation.** The loop's real value is that it's
circular, not linear — Improve feeds directly back into the next
cycle's Plan, which is exactly what turns individual trades into a
compounding, improving process rather than a series of disconnected
events. This is also why Record and Review are non-negotiable steps
rather than optional add-ons: skipping either one breaks the loop at
exactly the point where the improvement information would have been
generated, which is functionally identical to C9-01's warning about
skipping Post-Trade Review — no data flows back into the next Plan,
so nothing can actually improve regardless of how sound any individual
trade's execution was.

### Visual Model

See diagram: `visuals/psy-04-seven-step-loop.svg` — a closed circular
loop with seven labeled nodes (Plan -> Observe -> Decide -> Execute ->
Record -> Review -> Improve -> back to Plan), each node annotated with
its governing earlier lesson (C7-03/C8-01/C8-02; —; C7-03; —; PSY-01's
mood_tag; C9-02/C9-03; C9-03), with the Improve-to-Plan arrow
highlighted as the step that makes the loop actually compounding
rather than a one-time checklist.

### Worked Example

A trader completes a full cycle: plans a trade via the five-layer
stack, observes price approach the entry zone, confirms entry
conditions are genuinely met, executes at the planned size and stop,
records the outcome along with an honest "confident, not rushed" mood
tag, reviews it as a valid loss (C9-02) since process was sound, and —
finding no actual process failure — carries the exact same process
into their next Plan unchanged. The loop closes with nothing needing
to change, which is itself a correct, informative outcome.

### Counterexample

A different trader executes a trade well but skips Record entirely
("I remember how it went"), then skips Review, moving straight to the
next trade. Even if that one trade was executed perfectly, the loop
never closes — there is no data available six trades later to tell
whether a pattern (a specific mood, a specific setup type) is quietly
underperforming, because nothing was ever recorded to review.

### Good Example / Bad Example

Good: Treating all seven steps as mandatory on every single trade,
including Record and Review even when the outcome seems obvious or
unremarkable. Bad: Treating Plan, Decide, and Execute as the "real"
steps and Record/Review as optional paperwork to skip when busy or
when a trade's outcome feels self-evident.

### What to Look Out For

- The loop is circular — Improve must feed back into the next Plan,
  or nothing actually compounds over time.
- Record and Review are not optional add-ons; skipping either one
  breaks the loop at the exact point improvement data would have been
  generated.
- "The outcome seemed obvious" is not a valid reason to skip Record
  or Review — the value is in the pattern across many trades, not any
  single one.

### Common Mistakes

The most common mistake is running Plan-Observe-Decide-Execute well
and consistently, while treating Record-Review-Improve as optional —
which produces a trader who executes individual trades competently
but never actually improves over time, since no information ever
flows back into the Plan step.

### Key Takeaways

1. The full loop is Plan, Observe, Decide, Execute, Record, Review,
   Improve — seven steps, not five.
2. The loop is circular — Improve feeding back into the next Plan is
   what makes the process compound over time rather than repeat.
3. Record and Review are mandatory on every trade, including ones
   whose outcome seems self-evident — the value is in the pattern
   across many trades.

### Practice Drill

Given a trader's description of how they handled three different
trades (provided in Practise), identify which of the seven steps were
completed and which were skipped for each.

### Scenario Challenge

A trader executes trades well and wins consistently for a month, but
never records or reviews any of them. A colleague says "why fix what
isn't broken?" Using this lesson's vocabulary, what specifically is
missing from their process regardless of the recent outcomes?

### Mini Quiz

Q1 (True/False): If Plan, Observe, Decide, and Execute are all done
well, Record and Review can reasonably be skipped.
Answer: False — skipping Record and Review breaks the loop at the
exact point improvement information is generated, regardless of how
well the earlier steps were executed.

Q2 (Multiple choice): What makes this a "loop" rather than a
one-time checklist?
(a) It repeats identically every time with no connection between
    cycles
(b) The Improve step feeds directly back into the next cycle's Plan
(c) It only applies to the trader's first ten trades
(d) Nothing — it's simply a five-step process renamed

Answer: (b).

### Flashcards

- Front: What are the seven steps of the process psychology loop?
  Back: Plan, Observe, Decide, Execute, Record, Review, Improve.
- Front: Why is this called a loop rather than a checklist? Back:
  Improve feeds back into the next cycle's Plan — that feedback is
  what makes the process compound and actually improve over time.

### Reflection

Which of the seven steps do you currently skip most often, and what
specific information is lost each time you skip it?

### Mastery Criteria

Correctly identify completed vs. skipped steps across all three
practice-drill trader descriptions.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this seven-step loop is the
structural basis for PSY-05 (Plan/Decide) and PSY-06 (Record/Review).

### Bot Connection

The platform's Weekly Review Engine is this loop made mechanical for
every bot-driven trade: it stores the original entry rationale
(Plan), the actual `exit_reason` and `r_multiple` (Record), grades
each trade `planned_win` / `risk_managed_loss` / `needs_manual_review`
(Review), and surfaces specific flagged patterns for the next cycle
(Improve) — the same seven-step shape, running automatically instead
of by memory.

---

## PSY-05 — Pre-Trade Checklist Discipline

**Level:** 4
**Estimated study time:** 13 minutes
**Prerequisites:** PSY-04, C8-02
**Learning objectives:** Explain why a written pre-trade checklist
outperforms a mentally-held one, and construct a checklist that
covers every hard requirement from Core 7 and Core 8.

### Why This Matters

PSY-04 named "Plan" and "Decide" as loop steps; this lesson makes them
concrete and checkable rather than a mental judgment call made fresh
each time. A checklist is the single most direct defense against
PSY-01's live-risk distortion, PSY-02's cognitive errors, and PSY-03's
pressure-driven rule violations, all at once — because it moves the
actual checking to before risk is live, in writing, where none of
those three failure modes can quietly edit it.

### Core Teaching

**Plain-English explanation.** A pre-trade checklist is a written,
fixed list of the hard requirements a setup must meet before entry —
drawn directly from earlier lessons: C7-03's five-layer alignment,
C8-01's position size calculation, C8-02's structural stop placement,
and a stated entry rationale in the trader's own words. Checking each
item explicitly, in writing, before entering is what PSY-05 adds on
top of simply "knowing" the requirements.

**Technical explanation.** The reason a written checklist outperforms
a mentally-held one is specifically because it resists all three
earlier failure modes at once: it can't be selectively skipped by
confirmation bias (PSY-02) since every item must be checked
explicitly regardless of how appealing the setup feels; it can't be
loosened by live-risk urgency (PSY-01) since it's completed before
risk goes live; and it doesn't rely on willpower alone under pressure
(PSY-03) since a written, external artifact is being satisfied rather
than a felt judgment call. This is the exact same rationale behind
this platform's own go-live checklist for bot autonomy (C8-06) — a
formal, written gate is used precisely because "the human felt
confident about it" isn't treated as sufficient on its own.

### Visual Model

See diagram: `visuals/psy-05-checklist-anatomy.svg` — a checklist card
with four checked items (Five-layer alignment confirmed — C7-03; Size
calculated — C8-01; Structural stop placed — C8-02; Entry rationale
stated in writing), captioned "completed before risk goes live — none
of these can be silently skipped or loosened once a position is open."

### Worked Example

Before entering, a trader works through their checklist: confirms
five-layer alignment (C7-03), calculates lot size from account equity
and 1% risk (C8-01), places a structural stop at the C2-09
invalidation level (C8-02), and writes one sentence stating why this
specific setup qualifies. Only once all four items are checked do they
enter — and that written rationale becomes the exact record PSY-04's
"Record" step and PSY-06's later review will use.

### Counterexample

A different trader "knows the requirements" and skips the written
step, entering because the setup "feels right." Without a written
rationale, there's nothing later to review the trade against except
memory — and memory, as PSY-02 already established, is exactly the
kind of felt, unreliable signal a checklist exists to route around.

### Good Example / Bad Example

Good: Completing every checklist item in writing, every single trade,
regardless of how confident or obvious the setup feels. Bad: Treating
the checklist as something only needed for uncertain or marginal
setups, skipping it for trades that feel obviously good — precisely
the trades PSY-02's overconfidence bias is most likely to be distorting.

### What to Look Out For

- A checklist only works if it's written and completed before risk
  goes live — a mental version reintroduces every failure mode it's
  meant to prevent.
- Skipping the checklist "because this one is obvious" is itself a
  warning sign, not a valid exception.
- The written entry rationale isn't paperwork — it's the exact input
  PSY-06's honest post-trade review depends on.

### Common Mistakes

A common mistake is using a checklist inconsistently — applying it
rigorously to uncertain setups but skipping it for ones that feel
obviously good, which defeats its purpose since overconfidence (PSY-02)
is most dangerous on exactly the trades that feel most obvious.

### Key Takeaways

1. A pre-trade checklist should cover, at minimum, C7-03's alignment,
   C8-01's sizing, C8-02's stop, and a written entry rationale.
2. A written checklist resists live-risk distortion, cognitive bias,
   and pressure-driven skipping simultaneously — a mental version
   resists none of them.
3. The checklist must be applied to every trade, including ones that
   feel obviously good — especially those, given PSY-02's warning.

### Practice Drill

Given four proposed checklist items (provided in Practise), determine
which earlier curriculum lesson each one should be drawn from, and
identify one item missing from an incomplete sample checklist.

### Scenario Challenge

A trader says "I only use my checklist for setups I'm unsure about —
the clear ones don't need it." Using PSY-02's vocabulary, what's the
actual risk in that approach?

### Mini Quiz

Q1 (True/False): A checklist that exists only in a trader's memory
provides the same protection as a written one.
Answer: False — a written checklist specifically resists live-risk
distortion, cognitive bias, and pressure-driven skipping in ways a
mental version does not.

Q2 (Multiple choice): Why is skipping the checklist on "obviously
good" setups especially risky?
(a) Obvious setups are always wrong
(b) Overconfidence (PSY-02) is most likely to distort judgment
    exactly on setups that feel most obviously good
(c) It isn't risky — obvious setups don't need checking
(d) Checklists are only useful for beginners

Answer: (b).

### Flashcards

- Front: What four items should a pre-trade checklist cover at
  minimum? Back: C7-03's five-layer alignment, C8-01's sizing, C8-02's
  structural stop, and a written entry rationale.
- Front: Why does a written checklist outperform a mental one? Back:
  It resists live-risk distortion (PSY-01), cognitive bias (PSY-02),
  and pressure-driven skipping (PSY-03) all at once, since it's a
  fixed, external artifact completed before risk goes live.

### Reflection

Do you currently use a written pre-trade checklist for every trade,
or only for ones that feel uncertain? What's the actual risk in that
gap, using this lesson's vocabulary?

### Mastery Criteria

Correctly source all four practice-drill checklist items to their
governing lesson, and correctly identify the missing item in the
sample checklist.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this checklist habit is the
concrete implementation of PSY-04's Plan/Decide steps and directly
feeds PSY-06's review.

### Bot Connection

This platform's own go-live validation gate (`validation_gate.py`)
runs the exact same pattern at the bot level: a fixed, written set of
required manual attestations (paper-trading reconciliation, a tested
kill switch, a tested manual emergency close) has to be checked off
explicitly before autonomous trading is allowed — a formal checklist
used because "the human felt ready" isn't accepted as sufficient on
its own, the same principle this lesson teaches for individual trades.

---

## PSY-06 — Post-Trade Review Without Self-Deception

**Level:** 4
**Estimated study time:** 14 minutes
**Prerequisites:** PSY-05, C9-02
**Learning objectives:** Conduct a post-trade review using only what
the data can actually show, and identify the specific self-deceptive
patterns (outcome bias, hindsight rationalization) that a written,
data-based review is designed to prevent.

### Why This Matters

PSY-04's "Review" step and C9-03's process/outcome separation both
depend on the review itself being honest. This lesson names the exact
ways a review can quietly fail at that — not through laziness, but
through subtle self-deception that feels, from the inside, exactly
like an honest review.

### Core Teaching

**Plain-English explanation.** An honest post-trade review compares
the ACTUAL trade against the WRITTEN pre-trade plan (PSY-05's
checklist and rationale) and the actual data (exit reason, R-multiple)
— not against a reconstructed story of what "must have" happened.
Outcome bias is judging the decision quality by whether it won or lost
(exactly what C9-02 already warned against). Hindsight rationalization
is quietly editing the remembered reasoning after the fact to make a
lucky win look like skill, or a valid loss look like a mistake —
neither of which the trader necessarily notices themselves doing.

**Technical explanation.** The reason a written record (PSY-05's
rationale, logged before the outcome was known) is load-bearing here
is that it's the only defense against hindsight rationalization
specifically — memory alone is reconstructive, not a faithful replay,
and it reliably reconstructs the past in ways flattering to the
reviewer's own competence. This is exactly why this platform's own
Weekly Review Engine grades trades from stored, timestamped data
(`exit_reason`, `r_multiple` against the entry rationale) rather than
asking a trader to self-report how a trade went — a `needs_manual_review`
grade is assigned specifically for trades whose data doesn't cleanly
match the original plan (closed by timeout or manual close rather than
stop or target), precisely so the review doesn't quietly default to a
comfortable retelling.

### Visual Model

See diagram: `visuals/psy-06-review-integrity.svg` — a "written plan"
box and an "actual data" box, both feeding into "review," with a
labeled bypass arrow showing "memory alone" cutting around both boxes
straight into a distorted review — captioned "outcome bias and
hindsight rationalization both take this shortcut."

### Worked Example

A trader reviews a losing trade by pulling up their written pre-trade
rationale and the actual exit data: the checklist was fully completed,
the stop was hit exactly as planned. Comparing plan against data, they
correctly classify it as a valid loss (C9-02) and make no process
change — an honest review, because it was anchored to the written
record rather than how the loss felt afterward.

### Counterexample

A different trader, reviewing the same kind of loss from memory alone
days later, unconsciously reconstructs the story as "I probably
shouldn't have taken that setup" — even though their actual written
checklist (had they checked it) shows every requirement was correctly
met. This is hindsight rationalization: the loss feels like it should
have been avoidable, so memory quietly edits the story to match that
feeling.

### Good Example / Bad Example

Good: Reviewing every trade against the written pre-trade rationale
and the actual exit data, changing the process only when that
comparison reveals a genuine mismatch. Bad: Reviewing trades from
memory alone, days or weeks later, and trusting whatever story feels
right in hindsight.

### What to Look Out For

- Outcome bias judges decision quality by win/loss alone — C9-02
  already named this as the core error process/outcome review exists
  to prevent.
- Hindsight rationalization edits remembered reasoning to match how
  an outcome felt, not what was actually planned.
- A review is only as honest as the written record it's anchored to —
  memory alone is reconstructive, not a faithful replay.

### Common Mistakes

The most common and hardest-to-catch mistake is trusting a review
that feels thorough and honest but was actually done entirely from
memory — hindsight rationalization doesn't feel like distortion from
the inside, which is exactly why the written record from PSY-05 is
the load-bearing safeguard, not personal honesty alone.

### Key Takeaways

1. An honest review compares the actual trade against the WRITTEN
   pre-trade plan and real data — not a memory reconstructed after
   the outcome is known.
2. Outcome bias (C9-02) and hindsight rationalization are the two
   named failure modes a written record specifically defends against.
3. Memory alone is reconstructive and reliably flatters the
   reviewer's own competence — this is a documented pattern, not a
   personal failing to feel guilty about.

### Practice Drill

Given three post-trade review write-ups (provided in Practise, some
anchored to a written plan and some reconstructed from memory),
identify which show signs of outcome bias or hindsight
rationalization.

### Scenario Challenge

A trader reviews a winning trade and concludes "that confirms my
instincts were right" — but their written pre-trade checklist shows
two required items were actually skipped. Using this lesson's
vocabulary, what's happening in that review?

### Mini Quiz

Q1 (True/False): A review conducted purely from memory, days after
the trade, is just as reliable as one anchored to a written pre-trade
record.
Answer: False — memory is reconstructive and prone to hindsight
rationalization; a written record anchored before the outcome was
known is the actual safeguard.

Q2 (Multiple choice): What is hindsight rationalization?
(a) Correctly identifying a genuine process mistake after the fact
(b) Quietly editing remembered reasoning after an outcome is known,
    to make it match how the outcome felt
(c) A synonym for outcome bias
(d) A feature of this platform's risk engine

Answer: (b).

### Flashcards

- Front: What two self-deceptive patterns does this lesson name?
  Back: Outcome bias (judging by win/loss alone) and hindsight
  rationalization (editing remembered reasoning to match how the
  outcome felt).
- Front: Why is a written pre-trade record load-bearing for an honest
  review? Back: It's the only defense against hindsight
  rationalization — memory alone reconstructs the past in ways that
  flatter the reviewer's own competence.

### Reflection

Think of a trade you reviewed purely from memory. Would your
conclusion have been different if you'd compared it against a written
pre-trade rationale instead? What does that tell you?

### Mastery Criteria

Correctly identify outcome bias or hindsight rationalization in all
three practice-drill review write-ups.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this lesson closes the loop from
PSY-05's written checklist back into PSY-04's Review step.

### Bot Connection

The Weekly Review Engine grades every taken trade directly from
stored data — `exit_reason` and `r_multiple` compared against the
entry rationale captured at signal time — assigning `needs_manual_review`
specifically when a trade's data doesn't cleanly match a planned stop
or target exit, so the review is anchored to what actually happened
rather than a reconstructed story of it.

---

## PSY-07 — Detectors: Impulse, Revenge Trading, FOMO

**Level:** 4
**Estimated study time:** 15 minutes
**Prerequisites:** PSY-01, PSY-02
**Learning objectives:** Define impulse trading, revenge trading, and
FOMO as three distinct, nameable patterns, and describe how each one
is detected from trade data rather than only from self-report.

### Why This Matters

PSY-01 through PSY-03 covered the general mechanisms (live-risk
state, cognitive bias, pressure-driven rule breaking); this lesson
names three specific, common patterns those mechanisms produce in
practice, precisely enough that they can be tagged, tracked, and
flagged from real trade data rather than only recognized in hindsight,
if at all.

### Core Teaching

**Plain-English explanation.** Impulse trading is entering a position
that bypassed the pre-trade checklist (PSY-05) entirely — no five-layer
confirmation, no written rationale, driven by the setup simply looking
appealing in the moment. Revenge trading is entering a NEW position
specifically to "win back" a loss just taken, sized or timed by the
emotional need to recover rather than by an independent, checklist-
qualified setup. FOMO (fear of missing out) is entering a move already
well underway, specifically because it's moving and looks like it's
"leaving without you," rather than because a genuine entry condition
was met at the current price.

**Technical explanation.** All three share a diagnostic signature:
each one has an entry that, when checked against the written PSY-05
checklist, fails the same test — there's no independent, checklist-
qualified rationale for THIS specific entry at THIS specific time; the
real driver was a felt state (excitement, loss-recovery urgency,
missing-out anxiety) rather than the five-layer stack. This is exactly
why the platform's own mood-tagging system exists as a detection
mechanism rather than relying on self-recognition alone: a trader mid-
revenge-trade rarely identifies it as such in the moment, but a
"revenge" or "fomo" mood tag attached at entry, correlated against
that tag's actual expectancy across enough trades, surfaces the
pattern from data even when the trader's own in-the-moment judgment
missed it entirely.

### Visual Model

See diagram: `visuals/psy-07-three-patterns.svg` — three trade-entry
icons, each with a red X over a different checklist item: "Impulse"
(X over the entire checklist — none of it was done), "Revenge Trading"
(X over "independent rationale" — driven by the prior loss instead),
"FOMO" (X over "entry condition met at current price" — driven by
the move already happening instead) — all three converging into one
label: "no genuine checklist-qualified rationale for this entry."

### Worked Example

A trader takes a full stop-loss on a well-planned trade. Ten minutes
later they enter a different symbol, sized larger than usual, with no
completed checklist — driven by wanting to make the loss back
immediately. Tagging this entry "revenge" at the time (per PSY-05's
written-record habit) means it's later reviewable as a data point,
not just a vague memory of "a rough day."

### Counterexample

A different trader, after the same stop-loss, sits out and waits for
their next checklist-qualified setup — which happens to appear an hour
later on a different symbol. Even though a new trade follows a loss,
it's not revenge trading, because it has an independent, fully
completed rationale unrelated to recovering the prior loss.

### Good Example / Bad Example

Good: Tagging every entry honestly at the time, including "impulse,"
"revenge," or "fomo" when that's genuinely what drove it — the tag's
value is in being accurate, not flattering. Bad: Only tagging entries
"calm" or "confident" regardless of what actually drove them, which
erases the exact data PSY-07's detection depends on.

### What to Look Out For

- All three patterns share one diagnostic test: no independent,
  checklist-qualified rationale for this specific entry.
- A trade taken after a loss isn't automatically revenge trading — it
  is revenge trading only if the loss itself is what drove the entry,
  not an independent qualified setup.
- Self-recognition in the moment is unreliable — this is precisely
  why honest, timestamped mood tagging matters more than trusting
  memory later (PSY-06).

### Common Mistakes

A common mistake is believing these three patterns are rare or
obviously identifiable when they happen, when in practice they most
often look, from the inside, like an ordinary trade decision — which
is exactly why an external, checklist-based test ("was there an
independent qualified rationale?") is more reliable than trusting the
in-the-moment feeling.

### Key Takeaways

1. Impulse, revenge trading, and FOMO are three distinct, nameable
   patterns, each detectable by the same test: no independent,
   checklist-qualified rationale for the specific entry.
2. A trade after a loss is only revenge trading if the loss itself
   drove the entry — not simply because it happened afterward.
3. Honest, timestamped tagging at entry time is more reliable than
   trusting self-recognition or memory after the fact.

### Practice Drill

Given six trade-entry scenarios (provided in Practise), classify each
as impulse, revenge trading, FOMO, or a genuine checklist-qualified
entry.

### Scenario Challenge

A trader enters a new trade twenty minutes after a stop-loss, on a
different symbol, with a fully completed checklist and written
rationale unrelated to the prior loss. A colleague assumes it's
revenge trading purely because of the timing. Using this lesson's
vocabulary, is that assumption correct?

### Mini Quiz

Q1 (True/False): Any trade entered shortly after a loss is, by
definition, revenge trading.
Answer: False — it's revenge trading only if the prior loss itself is
what drove the entry, not simply because of proximity in time; an
independent, checklist-qualified entry after a loss is not revenge
trading.

Q2 (Multiple choice): What single test do impulse, revenge trading,
and FOMO all fail?
(a) They all lose money
(b) They all lack an independent, checklist-qualified rationale for
    the specific entry
(c) They only happen to new traders
(d) They only happen on small account sizes

Answer: (b).

### Flashcards

- Front: What's the shared diagnostic test for impulse, revenge
  trading, and FOMO? Back: No independent, checklist-qualified
  rationale for that specific entry — the real driver was a felt
  state instead.
- Front: Is any trade taken after a loss automatically revenge
  trading? Back: No — only if the loss itself drove the entry; an
  independent, qualified setup taken afterward is not revenge trading.

### Mastery Criteria

Correctly classify all six practice-drill entry scenarios.

### Reflection

Think of a trade you can now recognize as impulse, revenge, or FOMO-
driven. What would an honest mood tag, logged at the time, have
shown — and would reviewing it later have caught the pattern?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — these three patterns are the
concrete, nameable version of PSY-01 through PSY-03's general
mechanisms.

### Bot Connection

The platform's `EmotionalJournalEntry.mood_tag` field explicitly
supports "fomo," "revenge," and "tilted" as loggable values, and the
Weekly Review Engine's mood-performance analysis automatically
compares each tag's trades against the account's overall expectancy —
flagging a mood as a candidate no-trade condition once at least 3
trades under that tag underperform, turning this lesson's three
patterns into a mechanically detectable, reviewable signal rather than
something that has to be caught by memory alone.

---

## PSY-08 — Confidence Calibration: Matching Certainty to Actual Edge

**Level:** 4
**Estimated study time:** 14 minutes
**Prerequisites:** PSY-07, ORIENT-03
**Learning objectives:** Distinguish felt confidence from
statistically-supported confidence, and state the minimum sample size
this platform treats as meaningful before a read on edge is trusted.

### Why This Matters

PSY-02 already named overconfidence as a cognitive error; this lesson
makes it precise and actionable by giving an actual standard —
matching how certain a trader FEELS to what the actual sample size and
expectancy data SUPPORT, rather than trusting confidence as a signal
on its own.

### Core Teaching

**Plain-English explanation.** Confidence calibration means a
trader's stated or felt certainty about their edge should track the
real statistical support behind it — high confidence only when a large
enough, positive-expectancy sample actually backs it up, and
appropriately lower confidence (not false certainty) when the sample
is small, mixed, or new. A trader who feels equally certain after 5
trades as after 500 is miscalibrated, regardless of which specific
number those trades produced.

**Technical explanation.** ORIENT-03 already established that small
samples carry very little statistical weight; this lesson operationalizes
that into a concrete confidence rule, matching exactly how this
platform's own standalone probability-coach engine treats sample size:
under roughly 30 trades, any read is explicitly flagged as "a rough
read, not a verdict"; at or above that threshold, an expectancy of
+0.3R or better is described as "a real, measurable edge," a smaller
positive expectancy as "an edge, though modest, worth tightening
before scaling," and a non-positive expectancy as "no measurable edge
yet." Calibration means adopting language and position sizing that
tracks these actual thresholds — not defaulting to maximal confidence
simply because a handful of recent trades felt convincing.

### Visual Model

See diagram: `visuals/psy-08-calibration-curve.svg` — an x-axis of
"felt confidence" and a y-axis of "sample size and expectancy
strength," with a diagonal "well-calibrated" line and a shaded region
above it labeled "overconfident — feeling exceeds actual statistical
support," annotated with the ~30-trade threshold and the +0.3R "real
edge" cutoff.

### Worked Example

A trader with 8 trades and a strong recent win rate feels highly
confident and considers increasing size. Applying this lesson's
standard, they recognize 8 trades is well under the ~30-trade
threshold this platform treats as meaningful — so they keep sizing
unchanged and describe their edge, honestly, as "not yet established,"
regardless of how convincing the recent run has felt.

### Counterexample

A different trader with 60 trades and a consistent +0.4R expectancy
describes their edge only tentatively, as "maybe okay, hard to say" —
under-confident relative to what the data genuinely supports. This is
also a calibration failure, just in the opposite direction from
overconfidence: felt certainty should rise to match real statistical
support, not stay artificially low out of general caution.

### Good Example / Bad Example

Good: Stating confidence in direct proportion to actual sample size
and expectancy — explicitly uncertain under ~30 trades, appropriately
confident once a larger sample supports a real, positive expectancy.
Bad: Feeling maximal confidence after any short winning run, or
staying vaguely uncertain even once a large, clearly positive-
expectancy sample has accumulated.

### What to Look Out For

- Felt confidence and statistically-supported confidence are
  different things — calibration means matching the first to the
  second.
- Under roughly 30 trades, no read on edge should be treated as a
  verdict, in either direction.
- Miscalibration runs both ways — overconfidence on a small sample,
  and under-confidence despite a large, genuinely supportive one, are
  both failures of this same skill.

### Common Mistakes

The most common mistake is treating confidence calibration as only
about avoiding overconfidence, when under-confidence despite strong,
large-sample evidence is an equally real failure to match felt
certainty to actual statistical support.

### Key Takeaways

1. Confidence calibration means matching felt certainty to actual
   sample size and expectancy, not trusting the feeling on its own.
2. This platform treats ~30 trades as the threshold before a read on
   edge is meaningful, with +0.3R+ expectancy above that threshold
   read as "a real, measurable edge."
3. Miscalibration runs both directions — overconfidence on a small
   sample and under-confidence despite strong large-sample evidence
   are both failures of the same skill.

### Practice Drill

Given four trader statements paired with their actual sample size and
expectancy (provided in Practise), determine whether the stated
confidence is well-calibrated, overconfident, or under-confident.

### Scenario Challenge

A trader has 45 trades at +0.35R expectancy but says "I still don't
really trust this, could be luck." Using this lesson's standard, is
that appropriately cautious or a calibration failure? Why?

### Mini Quiz

Q1 (True/False): Confidence calibration only concerns overconfidence,
never under-confidence.
Answer: False — under-confidence despite strong, large-sample evidence
is an equally real miscalibration in the opposite direction.

Q2 (Multiple choice): Roughly what sample size does this platform
treat as the threshold before a read on edge is meaningful rather
than "a rough read, not a verdict"?
(a) 3 trades
(b) 30 trades
(c) 3,000 trades
(d) There is no threshold — any sample is equally meaningful

Answer: (b).

### Flashcards

- Front: What does confidence calibration mean? Back: Matching felt
  certainty about an edge to what the actual sample size and
  expectancy data support — not trusting the feeling on its own.
- Front: What expectancy, at a large enough sample, does this
  platform describe as "a real, measurable edge"? Back: +0.3R or
  better, at roughly 30+ trades.

### Reflection

Think of a time you felt highly confident in a setup based on very
few trades. Using this lesson's ~30-trade threshold, was that
confidence actually supported by the data at the time?

### Mastery Criteria

Correctly classify all four practice-drill statements as
well-calibrated, overconfident, or under-confident.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this calibration standard
directly reuses ORIENT-03's sample-size math and feeds PSY-10's
capstone synthesis.

### Bot Connection

The platform's Standalone Coach Engine implements this exact standard
in code: below `MIN_TRADES_FOR_CONFIDENCE` (30), every report carries
an explicit "treat this as a rough read, not a verdict" note, and its
narrative language tiers directly by expectancy — "a real, measurable
edge" at +0.3R or better, "an edge, though modest" below that but
still positive, and "no measurable edge yet" otherwise — the same
calibrated language this lesson asks a trader to use about their own
read.

---

## PSY-09 — Shutdown Protocol: Recognizing When to Stop for the Day

**Level:** 4
**Estimated study time:** 13 minutes
**Prerequisites:** PSY-08, C8-06
**Learning objectives:** Identify the specific conditions that should
trigger stopping for the day, and explain why this decision must be
pre-committed rather than made in the moment it's needed.

### Why This Matters

Every earlier Psychology lesson assumed a trader deciding whether to
take or manage a single trade. This lesson addresses a different,
higher-level decision — whether to keep trading at all today — which
is exactly the decision PSY-01's live-risk distortion and PSY-03's
pressure-driven rule-breaking make hardest to get right precisely when
it matters most: after a bad start to the day.

### Core Teaching

**Plain-English explanation.** A shutdown protocol is a pre-committed,
written set of conditions — reaching the max-daily-loss cap (C8-04),
hitting a defined number of consecutive losses, or noticing a
detector-flagged pattern (PSY-07's revenge or FOMO tags appearing) —
that trigger stopping for the day entirely, decided in advance, before
any of those conditions have actually happened. The decision to stop
is made calmly beforehand; the trigger only has to be recognized and
obeyed in the moment, not re-decided from scratch.

**Technical explanation.** This is PSY-01's core regulation principle
(pre-commit what can be pre-committed, since live risk distorts
in-the-moment decisions) applied at the scale of a full trading day
rather than a single trade — and PSY-03's structural-backstop logic
applies here too: a trader deciding, live, whether "today is bad
enough to stop" is making exactly the kind of pressured judgment call
most likely to be wrong, which is why this platform's own go-live gate
requires a manual attestation that both the kill switch AND the
manual emergency-close path have actually been tested (`kill_switch_test`,
`manual_emergency_close_test`) before autonomous trading is even
allowed — the assumption baked into the platform's own design is that
a human deciding to invoke a stop, live, under pressure, needs that
path to already be proven to work, not discovered to work for the
first time in the moment it's needed most.

### Visual Model

See diagram: `visuals/psy-09-shutdown-triggers.svg` — a flowchart with
three trigger conditions (max daily loss reached — C8-04; N
consecutive losses; a revenge/FOMO mood tag logged — PSY-07), all
feeding into one action: "stop for the day," captioned "each trigger
is defined and agreed to BEFORE the day starts — recognizing it live
is the only decision left to make."

### Worked Example

A trader pre-commits, in writing, that three consecutive losses in a
day triggers an automatic stop regardless of how the next setup looks.
After the third loss, a compelling-looking setup appears. Because the
stop condition was already met and pre-committed, they close the
platform for the day — the hard part (deciding whether stopping was
warranted) was already done calmly that morning, not live in the
moment the tempting setup appeared.

### Counterexample

A different trader has no defined stopping condition and, after three
losses, decides live whether to keep going, reasoning "the next one
will make it back" — precisely the live, pressured judgment call
PSY-01 and PSY-03 already identified as least reliable, made at
exactly the moment it's most likely to be wrong.

### Good Example / Bad Example

Good: Defining stop-for-the-day conditions in writing before the
trading day begins, and treating them as non-negotiable once met,
regardless of how the next opportunity looks. Bad: Leaving the
stop-for-the-day decision open-ended, to be judged live based on how
the day feels once a bad stretch has already started.

### What to Look Out For

- The decision to stop must be pre-committed — deciding live, during
  a bad stretch, is the least reliable moment to make it well.
- A compelling-looking setup appearing right after a stop trigger is
  not an exception — it's the exact scenario the pre-commitment exists
  to protect against.
- A shutdown protocol should reference concrete, checkable conditions
  (C8-04's loss cap, a consecutive-loss count, a PSY-07 detector tag)
  — not a vague "if it feels like a bad day."

### Common Mistakes

A common mistake is defining a shutdown condition but treating it as
a guideline rather than a hard rule — reopening the decision live once
the condition is actually met, which reintroduces exactly the
pressured, unreliable judgment call the protocol was built to avoid.

### Key Takeaways

1. A shutdown protocol pre-commits stop-for-the-day conditions in
   writing, before the trading day begins.
2. The trigger conditions should be concrete and checkable — a loss
   cap, a consecutive-loss count, a detector-flagged mood tag — not a
   felt judgment made live.
3. A compelling setup appearing right after a trigger is met is not a
   valid reason to reopen the decision — it's the exact scenario the
   protocol exists for.

### Practice Drill

Given three end-of-day trader logs (provided in Practise), determine
whether a pre-defined shutdown condition was met, and whether the
trader actually stopped when it was.

### Scenario Challenge

A trader's shutdown rule is "three consecutive losses." After the
third loss, a setup appears that looks unusually strong. Using this
lesson's vocabulary, what should the trader do, and why is "just this
one" not a valid exception?

### Mini Quiz

Q1 (True/False): Once a pre-defined shutdown trigger is met, a
sufficiently compelling next setup is a valid reason to keep trading.
Answer: False — the pre-commitment exists specifically to override
in-the-moment judgment once a trigger is met; treating any setup as an
exception reopens exactly the unreliable live decision it was meant
to prevent.

Q2 (Multiple choice): Why must the shutdown decision be pre-committed
rather than judged live?
(a) It doesn't matter when it's decided
(b) Deciding live, during a bad stretch, is precisely the condition
    under which judgment is least reliable (PSY-01, PSY-03)
(c) Pre-commitment is only a legal requirement
(d) Live decisions are always better than pre-planned ones

Answer: (b).

### Flashcards

- Front: What should trigger a shutdown-for-the-day decision? Back:
  Concrete, pre-defined conditions — max daily loss (C8-04), a
  consecutive-loss count, or a detector-flagged mood tag (PSY-07) —
  decided in advance, not judged live.
- Front: Why isn't a compelling setup right after a trigger a valid
  exception? Back: That's the exact scenario the pre-commitment
  exists to protect against — live judgment during a bad stretch is
  the least reliable moment to reopen the decision.

### Reflection

Do you currently have a written shutdown condition for a bad trading
day? If a compelling setup appeared right after that condition was
met, honestly — would you stop?

### Mastery Criteria

Correctly evaluate all three practice-drill end-of-day logs for
whether a shutdown trigger was met and whether it was honored.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this closes the loop back to
PSY-01's pre-commitment principle, now applied at the scale of a full
trading day.

### Bot Connection

This platform's go-live validation gate requires a manual attestation
that both the kill switch and the manual emergency-close path have
been TESTED (`kill_switch_test`, `manual_emergency_close_test`) before
autonomous trading is permitted — the same principle this lesson
teaches for a human trader: the stop mechanism has to be proven and
ready in advance, not discovered to work for the first time under the
exact pressure it's meant to handle.

---

## PSY-10 — Psychology Capstone

**Level:** 4
**Estimated study time:** 18 minutes
**Prerequisites:** PSY-01 through PSY-09
**Learning objectives:** Apply every Core 10 concept together to a
single realistic trading-day scenario, correctly identifying which
psychological principle governs each decision point in sequence.

### Why This Matters

Every PSY lesson so far has taught one concept in isolation. A real
trading day doesn't separate them — live-risk distortion (PSY-01),
cognitive bias (PSY-02), pressure-driven rule-breaking (PSY-03), the
process loop (PSY-04), checklist discipline (PSY-05), honest review
(PSY-06), named detector patterns (PSY-07), calibrated confidence
(PSY-08), and a shutdown protocol (PSY-09) all show up together,
often within the same hour. This capstone is the first lesson to
require applying all nine at once, exactly as a real session demands.

### Core Teaching

**Plain-English explanation.** This lesson has no new concept of its
own — it's a full worked trading day that touches every PSY-01 through
PSY-09 principle in the order they'd actually arise: a plan built
calmly before the market opens (PSY-01, PSY-05), a first trade
executed per checklist (PSY-04), a loss that gets honestly reviewed
rather than rationalized (PSY-06), a second entry that has to be
checked against the revenge/FOMO detector test (PSY-07), a confidence
read calibrated against real sample size rather than the day's feeling
(PSY-08), and a shutdown trigger that gets honored rather than
argued with (PSY-09).

**Technical explanation.** The reason Core 10 ends on a full-day
synthesis rather than one more isolated concept is the same reason
C9-01 opened Core 9 with a full lifecycle: psychology, like trade
management, only actually functions as one connected system — a
checklist (PSY-05) is only useful if it was pre-committed while calm
(PSY-01); a detector tag (PSY-07) is only catchable if it's logged
honestly (PSY-06) rather than rationalized after the fact; and a
shutdown trigger (PSY-09) is only effective if the trader's confidence
in "just one more trade" is being checked against real calibration
(PSY-08) rather than trusted on feeling alone. Testing each piece in
isolation across nine lessons was necessary to teach it clearly; this
capstone is where the whole curriculum's actual claim gets tested —
that a trader who has internalized all nine pieces handles a real,
messy trading day differently than one who hasn't, at every single
decision point along the way.

### Visual Model

See diagram: `visuals/psy-10-full-day-synthesis.svg` — a full trading-
day timeline (Pre-Market -> Trade 1 -> Loss -> Review -> Trade 2
Decision Point -> Confidence Check -> Shutdown Trigger), each segment
labeled with the specific PSY lesson governing that moment, forming
one continuous decision chain rather than nine separate concepts.

### Worked Example

A trader builds their plan and checklist calmly pre-market (PSY-01,
PSY-05). Their first trade, fully checklist-qualified, hits its stop
for a valid loss (C9-02) — reviewed honestly against the written plan,
with no process change warranted (PSY-06). A second setup appears
quickly afterward; checked against the detector test, it has an
independent, checklist-qualified rationale unrelated to the prior loss
— not revenge trading (PSY-07). It also wins, but with only 12 trades
logged this month, the trader correctly describes their edge as
"not yet established" rather than newly confident (PSY-08). A third
setup appears after two more losses meet their pre-defined shutdown
condition; they close the platform for the day without reopening the
decision (PSY-09).

### Counterexample

A different trader skips the pre-market checklist (PSY-05), takes a
first loss, reviews it only from memory and concludes vaguely "bad
luck" without checking the written plan (PSY-06's hindsight-
rationalization risk), enters a second trade sized larger "to make it
back" (PSY-07's revenge pattern), feels increasingly confident after
one win despite a tiny sample (PSY-08's miscalibration), and keeps
trading well past their informal, never-written stopping point
(PSY-09's structural gap). Every single PSY-01 through PSY-09 failure
mode appears in one day, each compounding the next.

### Good Example / Bad Example

Good: Applying all nine PSY principles as one connected system across
a real trading day — pre-committed plans, honest reviews, checked
detectors, calibrated confidence, and an honored shutdown trigger.
Bad: Knowing each PSY concept individually but applying none of them
consistently once a real, messy day with real pressure actually
unfolds.

### What to Look Out For

- A real trading day tests all nine PSY principles together, often
  within the same hour — not one at a time.
- Each principle depends on the others: a checklist only works if
  pre-committed calmly; a detector tag only works if logged honestly;
  a shutdown trigger only works if confidence is properly calibrated.
- The entire value of Core 10 is tested here — whether the concepts
  actually change behavior on a real, pressured day, not just in
  isolated quiz answers.

### Common Mistakes

The most consequential mistake this capstone exists to catch is
knowing every individual PSY-01 through PSY-09 concept well in
isolation while still failing to apply them together under the actual
pressure of a real trading day — exactly mirroring C9-01's warning
about knowing individual trade-management techniques without ever
assembling them into one lifecycle.

### Key Takeaways

1. A real trading day requires all nine PSY-01 through PSY-09
   principles together, not applied one at a time.
2. Each principle depends on the others — a checklist, a detector tag,
   and a shutdown trigger only work if the earlier principles (calm
   pre-commitment, honest review, calibrated confidence) are also in
   place.
3. Core 10's actual test is whether these concepts change behavior
   under real, pressured conditions — not whether they can be
   recited individually.

### Practice Drill

Given a full trading-day scenario with six decision points (provided
in Practise), identify which specific PSY-01 through PSY-09 principle
governs each decision, and evaluate whether the trader in the scenario
applied it correctly.

### Scenario Challenge

A trader handles the first half of a trading day perfectly (calm
pre-commitment, an honest loss review) but fails the second half
(skips the detector check before a second entry, ignores their
shutdown trigger). Using this lesson's vocabulary, does the first
half's discipline offset the second half's failures? Why or why not?

### Mini Quiz

Q1 (True/False): A trader who applies PSY-01 through PSY-06 well in
the morning but ignores PSY-07 through PSY-09 in the afternoon has
still had a successful psychology day overall.
Answer: False — each principle depends on the others holding across
the whole day; a shutdown trigger ignored late in the day can undo
disciplined decisions made earlier.

Q2 (Multiple choice): Why does Core 10 end with a full-day synthesis
rather than a tenth isolated concept?
(a) To fill out a round number of ten lessons
(b) Because psychology, like trade management (C9-01), only actually
    functions as one connected system tested under real conditions
(c) Because the nine earlier lessons weren't sufficient on their own
(d) There is no particular reason

Answer: (b).

### Flashcards

- Front: What does the Psychology Capstone actually test? Back:
  Whether all nine PSY-01 through PSY-09 principles are applied
  together, consistently, across one real, pressured trading day —
  not whether each is individually understood.
- Front: Why do the nine PSY principles depend on each other? Back:
  A checklist only works if pre-committed calmly; a detector tag only
  works if logged honestly; a shutdown trigger only works if
  confidence is properly calibrated — each later step relies on the
  earlier ones holding.

### Reflection

Walking back through your own most recent full trading day, which of
the nine PSY principles held up, and which broke down first? What
would applying all nine consistently, that same day, have actually
looked like?

### Mastery Criteria

Correctly map all six practice-drill decision points to their
governing PSY principle and correctly evaluate whether each was
applied properly.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone is the direct
foundation for the Bot Specialization tracks' own Failure and Capstone
stages, where the same psychological discipline is applied to
bot-specific setups.

### Bot Connection

The Weekly Review Engine's full weekly report is this same synthesis,
running automatically across every trade in a real week: taken-trade
grades (PSY-06), mood-tag-vs-expectancy flags (PSY-07, PSY-08), and
key-lessons output (PSY-04's Improve step) are all generated together
in one report — the platform's own mechanical version of applying
every Core 10 principle across a real trading period at once, rather
than one at a time.
