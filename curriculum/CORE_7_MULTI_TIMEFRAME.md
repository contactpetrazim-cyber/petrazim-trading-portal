# CORE 7 — MULTI-TIMEFRAME ANALYSIS

---

## C7-01 — The Five-Layer Stack: Macro/Direction/Opportunity/Trigger/Execution

**Level:** 3
**Estimated study time:** 16 minutes
**Prerequisites:** C1-05, C2-04
**Learning objectives:** Name and define the five layers of this
framework's multi-timeframe stack, and explain the specific job each
layer does that the others don't.

### Why This Matters

C1-05 promised that different timeframes are used for different jobs,
and this promise has been referenced repeatedly since (C2-04's
internal/external structure, C6-03's nested dealing ranges) without
ever being formalized into one complete system. This lesson is where
that promise gets fully kept — it's the single framework every earlier
multi-scale concept in this curriculum has been building toward.

### Core Teaching

**Plain-English explanation.** Rather than picking one arbitrary
timeframe and reading everything off it, this framework assigns five
distinct JOBS to five different timeframe layers, each answering a
different question: Macro (the highest timeframe used, e.g. Weekly or
Daily) asks "what's the overall market regime and long-term bias?"
Direction (an intermediate timeframe, e.g. 4H) asks "what's the
current intermediate-term trend direction, within that macro
context?" Opportunity (e.g. 1H) asks "where, specifically, is there a
zone or liquidity pool worth watching, given that direction?"
Trigger (e.g. 15-minute) asks "has price actually given a concrete
structural signal — a CHoCH, a sweep — confirming this opportunity is
live right now?" Execution (e.g. 5-minute or 1-minute) asks "exactly
where, at the finest resolution, should the actual entry be placed?"

**Technical explanation.** Each layer's specific timeframe is a
convention, not a fixed law — different bots and different instruments
may assign slightly different specific timeframes to each layer, but
the FIVE DISTINCT JOBS stay constant across all of them. This is the
direct, formal generalization of C1-05's nesting principle (a higher-
timeframe candle is built from many lower-timeframe candles) and
C2-04's internal/external structure distinction: rather than two
scales (internal/external), this is five, each with an explicitly
named responsibility. Skipping a layer — for instance, jumping
straight from a Weekly macro read to a 5-minute execution entry with
no Direction, Opportunity, or Trigger layer in between — is precisely
what produces trades with no coherent multi-scale reasoning behind
them, even when each individual observation was technically correct.

### Visual Model

See diagram: `visuals/c7-01-five-layer-stack.svg` — five stacked
horizontal bands, top to bottom: Macro (Weekly/Daily), Direction (4H),
Opportunity (1H), Trigger (15m), Execution (5m/1m) — each band
labeled with its one-sentence job description and a small icon (a
compass for Macro, an arrow for Direction, a magnifying glass for
Opportunity, a bell for Trigger, a crosshair for Execution).

### Worked Example

A trader checks the Daily chart (Macro): the overall regime is a
broad uptrend. They check the 4H chart (Direction): the intermediate
trend also confirms bullish, agreeing with Macro. They check the 1H
chart (Opportunity): a fresh demand zone sits in discount (Core 6),
with sell-side liquidity nearby (Core 3). They check the 15-minute
chart (Trigger): price sweeps that liquidity and produces a CHoCH
(C3-05's full sequence). They check the 1-minute chart (Execution): a
precise entry point within the trigger's confirmation candle. All five
layers were checked, each answering its own specific question.

### Counterexample

A trader glances at a 5-minute chart, sees a pattern that looks
appealing, and enters immediately — with no Macro, Direction,
Opportunity, or Trigger-layer analysis behind it at all. Even if the
5-minute pattern itself is read correctly, this is precisely the
signal-as-trade shortcut ORIENT-02 warned about, now shown in its
specific multi-timeframe form.

### Good Example / Bad Example

Good: Explicitly working through all five layers in order before
executing, each answering its own specific question. Bad: Reading
only one or two timeframes and treating that as a complete multi-
timeframe analysis.

### What to Look Out For

- Each layer answers a DIFFERENT question — Macro's job is not
  Trigger's job, and using one layer's evidence to answer a different
  layer's question defeats the purpose of separating them.
- The specific timeframe assigned to each layer is a convention that
  can vary by bot/instrument — the five distinct JOBS are what stays
  constant.
- Skipping layers (jumping straight from Macro to Execution) is the
  most common way this framework gets used incompletely.

### Common Mistakes

A frequent beginner error is treating "I checked a higher timeframe"
as equivalent to "I did full multi-timeframe analysis," when in
practice only one or two of the five layers were actually checked.
Genuinely working through all five distinct questions is a
meaningfully higher bar than glancing at one extra chart.

### Key Takeaways

1. The five layers — Macro, Direction, Opportunity, Trigger,
   Execution — each answer a different, specific question.
2. The exact timeframe assigned to each layer is a convention; the
   five distinct jobs are the constant, load-bearing structure.
3. Skipping layers is the most common way this framework gets applied
   incompletely, even when each individual layer's read is technically
   correct.

### Practice Drill

Given a five-timeframe chart set for one instrument at one moment
(provided in Practise), write one sentence answering each layer's
specific question, using only that layer's own timeframe.

### Scenario Challenge

A trader has checked Macro, Direction, and Trigger, but skipped
Opportunity entirely, jumping straight to a 15-minute signal without
ever identifying a specific zone or liquidity pool on the 1H chart.
What's missing from their analysis, and why does it matter?

### Mini Quiz

Q1 (True/False): Checking any two timeframes, regardless of which
ones, counts as complete multi-timeframe analysis in this framework.
Answer: False — each of the five distinct layers answers its own
specific question; checking only some of them is incomplete analysis.

Q2 (Multiple choice): What is the Trigger layer's specific job?
(a) Setting the overall long-term bias
(b) Confirming a concrete structural signal (CHoCH, sweep) showing
    the opportunity is live right now
(c) Identifying which zone to watch
(d) Placing the precise entry price

Answer: (b).

### Flashcards

- Front: What are the five layers of this framework's multi-timeframe
  stack? Back: Macro, Direction, Opportunity, Trigger, Execution —
  each answering a different specific question.
- Front: What's the Opportunity layer's job? Back: Identifying WHERE,
  specifically, a zone or liquidity pool worth watching exists, given
  the Direction layer's trend read.

### Reflection

Before this lesson, how many of these five layers would you honestly
say you were checking before a typical trade? Which one would add the
most to your current process?

### Mastery Criteria

Correctly answer each of the five layers' specific questions for the
practice-drill chart set, using only the appropriate timeframe for
each answer.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this framework is the
organizing structure for C7-02's alignment/conflict lesson and
C7-03's decision trees, both immediately following.

### Bot Connection

Every bot's documented setup rules are written explicitly in this
five-layer structure — a bot's own rule sheet names which specific
timeframe it assigns to each layer and what condition each layer must
satisfy before a signal fires.

---

## C7-02 — MTF Alignment vs. Conflict, Transition States

**Level:** 3
**Estimated study time:** 15 minutes
**Prerequisites:** C7-01, C2-03
**Learning objectives:** Classify a multi-layer read as aligned or in
conflict, and explain how a layer in transition (C2-03) affects
overall confidence differently than either a fully aligned or fully
conflicting read.

### Why This Matters

Checking all five layers (C7-01) is only half the job — you also need
a way to combine what they say into one overall confidence judgment.
This lesson gives you that combination logic, including the
genuinely common case where the layers don't cleanly agree.

### Core Teaching

**Plain-English explanation.** Alignment is when the Macro, Direction,
and Opportunity layers all agree on the same overall bias — for
example, Macro bullish, Direction bullish, Opportunity showing a
demand zone in discount. This is the highest-confidence configuration.
Conflict is when layers disagree — for example, Macro bullish but
Direction currently bearish. A transition state (recall C2-03's
three-state model) adds a third, distinct possibility: one or more
layers isn't cleanly in EITHER a confirmed trend or a confirmed
conflicting trend, but in the genuinely ambiguous transition state
C2-03 defined — which calls for a different response than either
alignment or outright conflict.

**Technical explanation.** Practically, each of the top three layers
(Macro, Direction, Opportunity) can independently be classified as
trending up, trending down, ranging, or in transition (per C2-03).
Full alignment (all three agreeing on direction) generally supports
the highest confidence. Outright conflict (a clean disagreement, e.g.
Macro up but Direction confirmed down) generally argues for reduced
size or no trade at all, since acting against a higher layer's
confirmed bias is a materially different bet than acting with it. A
layer in transition is neither of these — it's not confirming your
bias, but it's not confirming the OPPOSITE bias either; it's honestly
unresolved (C2-03), which generally argues for caution and reduced
confidence rather than either the full conviction of alignment or the
outright rejection of confirmed conflict.

### Visual Model

See diagram: `visuals/c7-02-alignment-conflict-transition.svg` — three
side-by-side scorecards for the same trade idea: "Aligned" (Macro,
Direction, Opportunity all green/agreeing), "Conflict" (Macro green,
Direction red — disagreeing), "Transition" (Macro green, Direction
shown as a question-mark/dotted state per C2-03) — each with a
corresponding confidence verdict (High / Low-or-skip / Reduced-
caution).

### Worked Example

Macro (Daily) shows a clear uptrend. Direction (4H) also shows a clear
uptrend, agreeing. Opportunity (1H) shows a demand zone in discount,
consistent with both. This is full alignment — the highest-confidence
configuration this lesson describes. In a different scenario, Macro
shows a clear uptrend but Direction (4H) has just produced a CHoCH and
is now in transition (C2-03) rather than a confirmed trend either way
— this is neither alignment nor outright conflict, and calls for
reduced confidence and caution until Direction resolves one way or the
other.

### Counterexample

A trader sees Macro and Opportunity agreeing but ignores that
Direction is currently in outright conflict (confirmed trending the
opposite way), treating two-out-of-three agreement as "good enough"
without weighing how serious a confirmed conflicting Direction layer
actually is. Not all disagreements are equally costly to ignore — a
confirmed conflict in an intermediate layer is a stronger warning
than this trader is giving it credit for.

### Good Example / Bad Example

Good: Explicitly classifying each of the top three layers as aligned,
conflicting, or in transition, and adjusting confidence accordingly —
full conviction only when genuinely aligned. Bad: Treating "most
layers roughly agree" as equivalent to full alignment, without
distinguishing a layer in honest transition from one in outright,
confirmed conflict.

### What to Look Out For

- Full alignment is the highest-confidence case — reduce confidence
  for anything less than that.
- Outright conflict (a confirmed opposing trend on a higher layer) is
  more serious than an unresolved transition state on that same
  layer.
- A layer in transition isn't automatically bad news for your bias —
  it's genuinely unresolved, per C2-03, and deserves caution rather
  than either full confidence or outright rejection.

### Common Mistakes

A common error is collapsing "aligned," "in transition," and "in
conflict" into a simplified binary of "good enough" versus "bad,"
losing the real, meaningfully different confidence levels this
lesson's three-way classification is built to capture.

### Key Takeaways

1. Alignment (all layers agreeing) supports the highest confidence.
2. Outright conflict (a confirmed opposing trend on a higher layer)
   generally argues for reduced size or no trade.
3. A layer in transition (C2-03) is a distinct third case — neither
   confirming nor confirming the opposite — deserving caution rather
   than either extreme.

### Practice Drill

Given six three-layer read combinations (provided in Practise),
classify each as aligned, conflicting, or containing a transition-
state layer, and state the appropriate confidence adjustment for
each.

### Scenario Challenge

Macro and Opportunity both support a long. Direction has just broken
its prior trend's structure (a CHoCH, per C2-07) and hasn't confirmed
a new direction yet. Using this lesson's vocabulary, how would you
classify this read, and what would you do differently than if
Direction had fully confirmed a bearish trend instead?

### Mini Quiz

Q1 (True/False): A layer in transition should be treated with the
same caution as a layer in outright, confirmed conflict.
Answer: False — transition is a distinct, unresolved state (C2-03),
generally less severe than a confirmed opposing trend, though it still
warrants caution rather than full confidence.

Q2 (Multiple choice): What generally supports the highest-confidence
trade configuration in this framework?
(a) Any two layers roughly agreeing
(b) Full alignment across Macro, Direction, and Opportunity
(c) A single layer showing a clean pattern
(d) Ignoring higher layers entirely and trading off Execution alone

Answer: (b).

### Flashcards

- Front: What is "alignment" in this lesson's sense? Back: The Macro,
  Direction, and Opportunity layers all agreeing on the same overall
  bias — the highest-confidence configuration.
- Front: How does a transition-state layer differ from an outright
  conflicting layer? Back: Transition (C2-03) is genuinely unresolved
  — neither confirming your bias nor confirming the opposite; outright
  conflict is a confirmed opposing trend, generally a stronger warning.

### Reflection

Have you ever traded through a layer that was in outright conflict,
rationalizing it as "close enough" to alignment? What would this
lesson's three-way classification have told you at the time?

### Mastery Criteria

Correctly classify all six practice-drill combinations as aligned,
conflicting, or transition-affected, with the appropriate confidence
adjustment named for each.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this classification feeds
directly into C7-03's decision trees and no-trade conditions,
immediately next.

### Bot Connection

Every bot's confidence-scoring logic explicitly reduces position size
or skips a signal entirely when its own Direction or Opportunity layer
is in outright conflict with Macro — precisely this lesson's
distinction, applied mechanically.

---

## C7-03 — Long/Short Decision Trees, No-Trade Conditions

**Level:** 3
**Estimated study time:** 15 minutes
**Prerequisites:** C7-01, C7-02
**Learning objectives:** Walk a complete five-layer decision tree to a
long, short, or no-trade conclusion, and name the specific conditions
under which "no trade" is the correct, disciplined answer.

### Why This Matters

This lesson closes Core 7 by assembling everything from C7-01 and
C7-02 into one usable decision process — and, just as importantly,
gives explicit permission and a specific vocabulary for concluding "no
trade," which is a genuinely correct and common outcome, not a failure
to find something.

### Core Teaching

**Plain-English explanation.** A decision tree, in this lesson's
sense, is simply working through the five layers (C7-01) in order,
using C7-02's alignment/conflict/transition classification at each
step, until you reach one of three conclusions: a long setup, a short
setup, or no trade. "No trade" is not a failure state — it's the
correct output whenever the layers don't support a clear, aligned
case in either direction, and this framework treats reaching that
conclusion honestly as a real skill, not an absence of one.

**Technical explanation.** A representative decision tree: (1) Check
Macro — is there a clear regime? If Macro itself is unclear or in
transition, that alone is often sufficient for a no-trade conclusion,
since nothing below it has a stable foundation to align with. (2)
Check Direction against Macro — aligned, conflicting, or transition
(C7-02)? Outright conflict here is a strong no-trade signal. (3) Check
Opportunity — is there an actual zone or liquidity pool (Core 3–4)
consistent with the Macro/Direction bias, in a favorable premium/
discount location (Core 6)? No opportunity present means no trade,
regardless of how clean the higher layers look. (4) Check Trigger —
has a concrete structural signal (a full sweep + displacement + CHoCH
sequence, C3-05, or a clean BOS) actually confirmed? No trigger means
waiting, not forcing an early entry. (5) Only once all four prior
layers support the same direction does Execution (the fifth layer)
become a live question of entry precision — not before.

### Visual Model

See diagram: `visuals/c7-03-decision-tree.svg` — a flowchart starting
at "Check Macro," branching at each of the five layers with a
"clear/supports?" yes/no decision point, most "no" branches leading to
a "NO TRADE" terminal node, and only the path where every layer says
"yes" leading to a "LONG" or "SHORT" terminal node.

### Worked Example

Macro is a clear uptrend. Direction aligns (also uptrend). Opportunity
shows a fresh demand zone in discount with nearby sell-side liquidity.
Trigger confirms — a full sweep + displacement + CHoCH sequence
completes at that zone. Every layer supports the same direction: the
decision tree reaches a LONG conclusion, and only now does Execution
become the live question of exactly where to enter.

### Counterexample

A trader reaches the Opportunity layer, finds no clear zone or
liquidity pool consistent with their Macro/Direction bias, but forces
a trade anyway using a weak, low-confluence area because "the higher
timeframes look good." This skips the tree's own conclusion — no valid
Opportunity layer, no trade — in favor of forcing an entry that the
process itself never actually supported.

### Good Example / Bad Example

Good: Walking the tree in order, and accepting "no trade" as a
genuine, correct conclusion whenever any required layer fails to
support it. Bad: Forcing an entry once the higher layers look
appealing, even when a lower layer (Opportunity or Trigger) never
actually confirmed.

### What to Look Out For

- "No trade" is a correct, disciplined conclusion — not a failure to
  find a setup.
- A failure at ANY required layer is generally sufficient for a
  no-trade conclusion — later layers don't compensate for an earlier
  one failing.
- Execution (entry precision) is only a live question once every
  higher layer has already confirmed — never before.

### Common Mistakes

The most consequential mistake at this stage is treating a
appealing-looking Macro or Direction read as sufficient justification
to force a trade, even when Opportunity or Trigger never actually
confirmed. This is precisely the discipline ORIENT-02's signal-setup-
trade pipeline was built to protect from the very start of this
course.

### Key Takeaways

1. A decision tree works through all five layers in order, reaching
   long, short, or no-trade as its conclusion.
2. "No trade" is a genuinely correct, disciplined outcome whenever any
   required layer fails to support the case — not a failure.
3. Execution only becomes a live question once every higher layer has
   already confirmed the same direction.

### Practice Drill

Given eight complete five-layer scenarios (provided in Practise), walk
each through the decision tree and reach a long, short, or no-trade
conclusion, citing which specific layer (if any) caused a no-trade
result.

### Scenario Challenge

Every layer supports a long except Trigger, which hasn't confirmed
yet — price is still approaching the zone with no sweep or CHoCH
completed. Using this lesson's vocabulary, what's the correct
conclusion right now, and what specifically would change it?

### Mini Quiz

Q1 (True/False): "No trade" represents a failure to properly analyze
the chart.
Answer: False — it's a genuinely correct, disciplined conclusion
whenever the decision tree's required layers don't all support a
clear case.

Q2 (Multiple choice): When does Execution (entry precision) become a
live question in this framework's decision tree?
(a) At the very start, before checking any other layer
(b) Only once every higher layer (Macro, Direction, Opportunity,
    Trigger) has already confirmed the same direction
(c) It's not part of the decision tree at all
(d) Whenever the trader feels confident

Answer: (b).

### Flashcards

- Front: Is "no trade" a failure outcome in this framework? Back: No
  — it's a genuinely correct, disciplined conclusion whenever the
  decision tree's required layers don't all support a clear case.
- Front: What order does the five-layer decision tree work through?
  Back: Macro, then Direction, then Opportunity, then Trigger, and
  only then Execution — each required to support the case before
  moving to the next.

### Reflection

Think of a trade where the higher timeframes "looked good" but a
lower layer (Opportunity or Trigger) never actually confirmed. What
would this lesson's decision tree have concluded, and did you follow
that conclusion at the time?

### Mastery Criteria

Correctly walk all eight practice-drill scenarios to the right
conclusion (long, short, or no-trade), correctly naming which specific
layer caused any no-trade result.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this closes Core 7 and is the
exact decision structure Core 8's risk-management lessons assume is
already in place before position sizing even becomes relevant.

### Bot Connection

Every bot's signal-generation logic is, structurally, exactly this
decision tree implemented in code — a bot produces no signal at all
whenever any required layer (its own Macro/Direction/Opportunity/
Trigger conditions) fails to confirm, precisely mirroring this
lesson's no-trade discipline rather than forcing output on incomplete
evidence.
