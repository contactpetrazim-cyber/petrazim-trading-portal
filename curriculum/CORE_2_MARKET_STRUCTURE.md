# CORE 2 — MARKET STRUCTURE

---

## C2-01 — Swing Highs and Swing Lows

**Level:** 1
**Estimated study time:** 14 minutes
**Prerequisites:** C1-02, C1-03, C1-05
**Learning objectives:** Define a swing high and swing low precisely
enough to mark them consistently on a real chart, and explain why a
consistent, rule-based definition matters more than an eyeballed one.

### Why This Matters

Every concept in the rest of Core 2 — trend, BOS, CHoCH, protected
highs and lows — is built directly on top of swing highs and swing
lows. If you can't mark these consistently and the same way every
time, every concept built on top of them inherits that inconsistency.
This is the single most foundational skill in market structure reading.

### Core Teaching

**Plain-English explanation.** A swing high is a local peak — a candle
whose high price is higher than the candles immediately around it, so
price visibly turned down after reaching it. A swing low is the
mirror: a local trough where price visibly turned up. Together, the
sequence of swing highs and swing lows across a chart is what "market
structure" actually refers to — everything else in Core 2 is a
statement about the relationship between these points.

**Technical explanation.** A common, rule-based definition: a candle
at index N is a swing high if its high is greater than the high of the
K candles immediately before it and the K candles immediately after
it (K is often 1 for a simple definition, sometimes larger for a
"stronger" swing point on noisier lower timeframes). A swing low uses
the identical rule on lows, checking for a local minimum instead of a
maximum. The specific value of K matters less than using the same
value consistently — switching K arbitrarily from chart to chart is
exactly what produces inconsistent, unreliable structure reads.
Because a swing point requires candles on both sides to confirm it, a
swing point can only be confirmed in hindsight, after price has moved
away from it — this is a genuine, permanent property of structure
reading, not a flaw in a specific tool.

### Visual Model

See diagram: `visuals/c2-01-swing-points.svg` — a price chart with
clear swing highs marked with a downward-pointing marker at each local
peak and swing lows marked with an upward-pointing marker at each
local trough, with a K=1 confirmation window shaded around one example
of each.

### Worked Example

On a 1-hour chart, price rises for six candles, reaches a peak, then
falls for four candles before rising again. The peak candle's high is
higher than the highs of at least one candle before and one candle
after it — using K=1, this candle is a confirmed swing high. Its
confirmation, however, only became visible once the candle after it
closed lower.

### Counterexample

A trader marks a swing high in real time, on the candle that appears
to be forming a peak, without waiting for the next candle to close
lower. Price then continues higher for several more candles — what
looked like a swing high in the moment was never actually one; it was
premature pattern-completion, not a rule-based read.

### Good Example / Bad Example

Good: Consistently using the same confirmation window (the same K) on
the same timeframe every time you mark structure, and accepting that a
swing point isn't confirmed until the candles on both sides exist.
Bad: Marking a "swing high" the instant a candle looks like a local
peak, before the following candle has actually closed lower.

### What to Look Out For

- A swing point cannot be confirmed until candles exist on both sides
  of it — there is an unavoidable lag between formation and
  confirmation.
- Using different confirmation windows (K values) inconsistently
  produces structure reads that can't be compared chart to chart.
- Lower timeframes produce far more swing points than higher
  timeframes on the same price move — this is expected, not noise to
  be eliminated.

### Common Mistakes

Beginners frequently mark "obvious-looking" peaks and troughs by eye
without a consistent rule, which produces different structure reads
on different days from the same trader looking at the same chart. A
rule-based definition, applied the same way every time, is what makes
structure reading something you can actually get consistently better
at.

### Key Takeaways

1. A swing high is a local peak; a swing low is a local trough — each
   defined by a consistent rule comparing surrounding candle highs or
   lows.
2. Swing points can only be confirmed after candles exist on both
   sides — there is always a hindsight lag.
3. Consistency in the confirmation rule matters more than the exact
   value chosen for it.

### Practice Drill

On fifteen provided 1-hour candles, mark every confirmed swing high and
swing low using a K=1 rule, then check your marks against the answer
key.

### Scenario Challenge

You're watching a candle form in real time that looks like it might be
a swing high. What, specifically, do you need to wait for before you
can actually call it one?

### Mini Quiz

Q1 (True/False): A swing high can be confirmed the moment the peak
candle itself closes.
Answer: False — confirmation requires at least one further candle on
the other side to close lower (using K=1).

Q2 (Multiple choice): What happens to the number of swing points
identified on the same price move if you switch to a lower timeframe?
(a) It stays exactly the same
(b) It generally decreases
(c) It generally increases
(d) Timeframe has no effect on swing point count

Answer: (c). Lower timeframes contain more internal detail and
therefore more local peaks and troughs for the same overall move.

### Flashcards

- Front: What defines a swing high? Back: A candle whose high is
  greater than the highs of a consistent number of candles immediately
  before and after it.
- Front: Why can't a swing point be confirmed in real time, exactly as
  it forms? Back: Confirmation requires candles on both sides — the
  point only becomes identifiable once price has moved away from it.

### Reflection

Have you ever marked structure by eye and gotten a different answer
looking at the same chart on a different day? What would a fixed rule
have prevented?

### Mastery Criteria

Correctly identify all confirmed swing highs and swing lows in the
fifteen-candle practice drill using a consistent K=1 rule.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — every remaining Core 2 lesson depends
directly on this one; retention here is load-bearing for the whole
module.

### Bot Connection

Every bot's structure-reading logic begins with exactly this
swing-point identification step — it's the literal first stage of the
signal-generation pipeline for all five bots, before any BOS, CHoCH, or
zone logic runs.

---

## C2-02 — Higher Highs/Lows, Lower Highs/Lows: Defining Trend

**Level:** 1
**Estimated study time:** 13 minutes
**Prerequisites:** C2-01
**Learning objectives:** Define uptrend and downtrend in terms of
sequences of swing points, and correctly classify a short sequence of
swing highs and lows as trending up, trending down, or neither.

### Why This Matters

"Trend" gets used loosely in casual trading talk — "it looks like it's
going up." This lesson replaces that impression with a specific,
checkable definition built directly from the swing points established
in C2-01, so trend classification becomes something you can verify
rather than something you feel.

### Core Teaching

**Plain-English explanation.** An uptrend, in structural terms, is a
sequence where each new swing high is higher than the previous swing
high, AND each new swing low is higher than the previous swing low —
both conditions together, not just one. A downtrend is the mirror:
each new swing high lower than the last, each new swing low lower than
the last. This is often shortened to "HH/HL" (higher highs, higher
lows) for an uptrend and "LH/LL" (lower highs, lower lows) for a
downtrend.

**Technical explanation.** Formally, given a sequence of confirmed
swing points H1, L1, H2, L2, H3... an uptrend requires H2 > H1 and L2
> L1 (and so on for each subsequent pair) — both the swing highs AND
swing lows must be progressing in the same direction. A sequence where
swing highs rise but swing lows also fall (an expanding, non-directional
range) does not qualify as a trend under this definition, even though
a higher high occurred — this is exactly why both conditions are
required together, not either one alone. This dual condition is what
separates genuine trend from a widening, directionless range that
merely produced one higher high by coincidence.

### Visual Model

See diagram: `visuals/c2-02-hh-hl-sequence.svg` — a clean uptrend
chart with each swing high and swing low labeled H1/L1, H2/L2, H3/L3
in sequence, arrows confirming H2>H1, L2>L1, H3>H2, L3>L2, alongside a
contrasting "expanding range" example where highs rise but lows also
fall, explicitly labeled "not a trend by this definition."

### Worked Example

A chart shows swing points in this order: L1 at 100, H1 at 110, L2 at
104, H2 at 116, L3 at 109, H3 at 122. Checking the uptrend condition:
H2 (116) > H1 (110), yes. L2 (104) > L1 (100), yes. H3 (122) > H2
(116), yes. L3 (109) > L2 (104), yes. Every pair confirms — this is a
valid, structurally-defined uptrend.

### Counterexample

A chart shows swing highs rising (110, 116, 122) but swing lows falling
(100, 96, 90) at the same time — a widening range, not a trend. A
trader who only checks swing highs would incorrectly call this an
uptrend; checking both conditions together correctly identifies it as
non-trending (an expanding range, covered further in C2-03).

### Good Example / Bad Example

Good: Checking both the swing-high sequence AND the swing-low sequence
before calling a chart trending in either direction. Bad: Calling a
chart "trending up" because the most recent swing high is higher than
the one before it, without checking what the swing lows are doing.

### What to Look Out For

- A single higher high does not confirm an uptrend on its own — the
  swing lows must also be rising.
- Trend classification requires at least two consecutive confirmed
  swing highs and two consecutive confirmed swing lows — a single pair
  isn't enough to establish a sequence.
- Trend can and does change over time; a classification made on
  today's data isn't a permanent label on the instrument.

### Common Mistakes

A very common beginner error is calling a chart trending based on a
single recent swing point breaking a prior extreme, without checking
the full HH/HL or LH/LL sequence. This is precisely the difference
between a genuine trend and a Break of Structure event within a range
(formally distinguished in C2-06) — one higher high, alone, is not yet
a trend.

### Key Takeaways

1. An uptrend requires BOTH rising swing highs AND rising swing lows,
   confirmed together — not either alone.
2. A downtrend is the mirror: both falling swing highs and falling
   swing lows.
3. A chart with rising highs but falling lows is an expanding range,
   not a trend, under this definition.

### Practice Drill

Given four sequences of six swing points each (provided in Practise),
classify each as uptrend, downtrend, or neither, showing the specific
pairwise comparisons that support your classification.

### Scenario Challenge

A chart's most recent swing high is the highest point in three months.
Is this alone enough to call the instrument in an uptrend? What
additional information from this lesson would you need to check first?

### Mini Quiz

Q1 (True/False): A single new swing high that's higher than the
previous one is sufficient, on its own, to confirm an uptrend.
Answer: False — both the swing-high sequence AND the swing-low
sequence must be rising together.

Q2 (Multiple choice): A chart shows swing highs rising and swing lows
also rising, but at a much steeper rate than the highs. What is this?
(a) A downtrend
(b) Not a trend at all
(c) Still a valid uptrend by the HH/HL definition
(d) Undefined — the definition doesn't cover this case

Answer: (c). The definition only requires each new high be higher
than the last and each new low be higher than the last — the relative
steepness between them doesn't disqualify it.

### Flashcards

- Front: What two conditions together define a structural uptrend?
  Back: Each new swing high higher than the previous one, AND each new
  swing low higher than the previous one.
- Front: What does a chart with rising highs but falling lows
  represent? Back: An expanding, non-directional range — not a trend,
  because the swing-low condition fails even though highs are rising.

### Mastery Criteria

Correctly classify all four practice-drill sequences with the specific
pairwise comparisons shown for each.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — this definition is the exact basis for
C2-03's trend/range/transition classification and for BOS's definition
in C2-06.

### Bot Connection

Bot 1 (Macro Swing Structure) requires this exact HH/HL or LH/LL
condition, confirmed on a higher timeframe, as its foundational bias
filter before any lower-timeframe setup is even considered.

---

## C2-03 — Trend vs. Range vs. Transition

**Level:** 1
**Estimated study time:** 14 minutes
**Prerequisites:** C2-02
**Learning objectives:** Classify current market state as trending,
ranging, or transitional, and explain why transition is a distinct,
genuinely ambiguous state rather than a failure to classify correctly.

### Why This Matters

Almost every trading mistake at this stage of learning comes from
treating the market as always being cleanly in one state or another.
Transition is a real, common third state — and correctly recognizing
"this is currently ambiguous" is itself a skill, not a cop-out. Trading
a transitional market as if it were a confirmed trend is one of the
most common ways a structurally sound framework produces a bad trade.

### Core Teaching

**Plain-English explanation.** Trend, as defined in C2-02, is a
sequence of swing points consistently progressing in one direction. A
range is the opposite: swing highs and swing lows oscillating between
roughly the same two levels with no consistent progression — price
keeps returning to a similar ceiling and floor rather than making new
extremes. Transition is the state in between: the prior trend's
sequence has just been broken (a CHoCH, formally defined in C2-07) but
a new trend hasn't yet confirmed itself with its own HH/HL or LH/LL
sequence — the market genuinely hasn't decided yet.

**Technical explanation.** A range is often defined, practically, as a
sequence of swing points where highs and lows stay within a roughly
consistent band — no swing high meaningfully exceeds the prior range
high, no swing low meaningfully exceeds the prior range low, over a
sustained number of swings. Transition begins the moment an
established trend's structural sequence breaks (the first
counter-trend break of a swing point) and ends either when a new
trend's own HH/HL or LH/LL sequence confirms (transition resolved into
a new trend) or when price settles into oscillating between two levels
without further progression (transition resolved into a range).
Because transition is defined by what hasn't happened yet, it cannot
be confirmed as "definitely a reversal" or "definitely just a
pullback" in real time — that ambiguity is a genuine, unavoidable
property of this state, not a gap in the definition.

### Visual Model

See diagram: `visuals/c2-03-three-states.svg` — three side-by-side
chart panels labeled Trend, Range, and Transition. The Transition panel
shows a prior clean uptrend, a single break below the last higher low,
and then a genuinely open question mark over what comes next, with two
faint dotted possible paths (resuming up vs. confirming down).

### Worked Example

A market in a clean uptrend (HH/HL confirmed for four consecutive
swings) breaks below its most recent higher low — the first sign the
trend sequence has failed. At this exact point, the market is in
transition: it is neither still a confirmed uptrend (the sequence just
broke) nor yet a confirmed downtrend (no LH/LL sequence exists yet).
Only after a subsequent lower high and lower low both confirm does the
transition resolve into a genuine downtrend.

### Counterexample

A trader sees the same single break below a higher low and immediately
declares "this is now a downtrend," entering short with full
conviction. Structurally, only a transition has been confirmed at this
point — calling it a full trend reversal skips the genuinely
uncertain, unresolved state this lesson exists to teach you to
recognize and respect.

### Good Example / Bad Example

Good: Explicitly labeling a market "in transition" when a trend
sequence has just broken but no new sequence has confirmed yet, and
sizing or avoiding trades accordingly. Bad: Forcing every chart into
either "trend" or "range" because transition feels like an unsatisfying
answer.

### What to Look Out For

- Transition is genuinely ambiguous by definition — resist the urge to
  prematurely resolve it into a confident trend or range call before
  the structural evidence actually supports one.
- A single counter-trend swing point break signals the START of
  transition, not the confirmation of a new trend.
- Range and transition can look superficially similar on a chart —
  the difference is whether a directional break from a prior trend
  just occurred (transition) or the market has been oscillating for a
  while with no trend to break from (range).

### Common Mistakes

A frequent error is treating every trend-sequence break as an
immediate, confirmed reversal, skipping the transition state entirely.
This produces early entries into what often turns out to be a normal
pullback that resumes the original trend, rather than a genuine
reversal — precisely the failure mode CHoCH (C2-07) and BOS (C2-06)
exist to formally distinguish.

### Key Takeaways

1. Trend, range, and transition are three genuinely distinct market
   states, not two states plus an error case.
2. Transition begins when a trend's structural sequence first breaks
   and resolves only once a new sequence confirms in one direction or
   the other.
3. Transition's ambiguity is real and unavoidable — respecting it,
   rather than forcing an early call, is a real skill.

### Practice Drill

Given six chart segments (provided in Practise), classify each as
trend, range, or transition, and for any marked transition, state what
specific structural confirmation would resolve it into a trend or a
range.

### Scenario Challenge

A market you've been calling a clean uptrend just broke its most
recent higher low. What is the most structurally honest label for its
current state, and what specific event would you need to see next to
upgrade that label to a confirmed downtrend?

### Mini Quiz

Q1 (True/False): The moment a trend's swing-point sequence breaks, a
new trend in the opposite direction is confirmed.
Answer: False — this only confirms the start of transition; a new
trend requires its own HH/HL or LH/LL sequence to confirm.

Q2 (Multiple choice): What resolves a transition into a confirmed
range rather than a new trend?
(a) A single new swing high
(b) Price oscillating between roughly the same two levels without
    further directional progression
(c) A CHoCH
(d) Transitions cannot resolve into ranges

Answer: (b).

### Flashcards

- Front: What are the three market structure states this lesson
  defines? Back: Trend, Range, and Transition — three genuinely
  distinct states, with Transition being the real, ambiguous state
  between a broken trend and a confirmed new direction.
- Front: When does transition begin? Back: The moment an established
  trend's structural swing-point sequence first breaks.

### Reflection

Think of a time you called a market's direction with full confidence
right after a single structural break, before a new sequence had
actually confirmed. Using this lesson's vocabulary, what state was the
market actually in?

### Mastery Criteria

Correctly classify all six practice-drill segments, with a valid
specific resolution condition stated for each one marked transition.

### Spaced Review

Day 1, Day 3, Day 7, Day 21 — this three-state model is referenced
directly in Core 7's no-trade-condition decision trees.

### Bot Connection

Every bot's risk engine treats a symbol currently in transition as a
distinct, generally lower-confidence condition — several bots'
strategy_params explicitly reduce position size or skip signals
entirely while a symbol is in unresolved transition, rather than
guessing at a direction the structure hasn't confirmed yet.

---

## C2-04 — Internal vs. External Structure

**Level:** 1
**Estimated study time:** 14 minutes
**Prerequisites:** C2-01, C2-02
**Learning objectives:** Distinguish internal structure from external
structure on a single chart, and explain why this distinction matters
for reading BOS and CHoCH correctly at different scales.

### Why This Matters

A single chart contains swing points at more than one meaningful scale
at once — the major swings that define the overall trend, and smaller
swings nested inside each leg between those major points. Without
separating these two scales explicitly, a minor internal pullback and
a genuine major structural break can look confusingly similar, and
BOS/CHoCH calls (C2-06, C2-07) become unreliable.

### Core Teaching

**Plain-English explanation.** External structure refers to the major
swing highs and swing lows that define the overall trend or range on
a given timeframe — the "big picture" points. Internal structure
refers to the smaller swing highs and swing lows that form inside a
single leg between two external structure points — the finer detail
visible once you zoom into that leg. The same price data contains
both; which points count as "internal" versus "external" depends on
the scale of swing point you're deliberately tracking, not on the
timeframe of the chart alone.

**Technical explanation. **External structure points are typically
identified using a larger confirmation window (a bigger K, in C2-01's
terms, or equivalently, only tracking swing points that are
themselves higher/lower than several neighboring swings, not just
their immediate neighbors) — this filters out minor noise and leaves
only the swings that define the overall trend or range. Internal
structure points use a smaller confirmation window and capture every
local peak and trough within a single leg, including ones that don't
survive as external structure once the leg completes. A break of
internal structure (a minor internal CHoCH within an ongoing external
uptrend leg) is a much lower-significance event than a break of
external structure (a CHoCH against the major trend itself) — treating
them as equally significant is a common source of over-trading on
noise.

### Visual Model

See diagram: `visuals/c2-04-internal-external.svg` — a chart showing a
major external uptrend leg from swing low to swing high, with the
external points marked in bold, and several smaller internal swing
highs/lows visible as finer zigzags inside that same leg, marked in a
lighter color, explicitly labeled "internal — inside one external
leg."

### Worked Example

On a 4H chart, price makes a major swing low, then a major swing high
three days later — this is one external leg. Zooming into the
15-minute chart covering those same three days reveals a dozen smaller
internal swing highs and lows as price zigzagged its way up. A minor
internal CHoCH partway through that leg (price briefly pulling back
against the internal micro-structure) does not contradict the external
uptrend at all — it's normal internal noise within a still-intact
external leg.

### Counterexample

A trader sees a CHoCH on a lower timeframe and treats it as
significant as a major CHoCH on the higher timeframe, exiting a
position based on internal structure alone while the external trend
remains fully intact. The internal break wasn't wrong to notice — it
was wrongly weighted as if it were external-level significant.

### Good Example / Bad Example

Good: Explicitly identifying which timeframe/scale you're tracking
external structure on, and treating internal structure breaks within
that leg as lower-significance context rather than trend-level signals.
Bad: Reacting to every minor internal swing-point break as if it
carries the same weight as a major external structural shift.

### What to Look Out For

- The same swing point can be "external" on one scale of analysis and
  irrelevant internal noise on a broader one — always be clear which
  scale you're tracking.
- A minor internal CHoCH inside an intact external trend leg is
  normal and expected, not necessarily a warning sign.
- Confusing internal and external significance is a common source of
  premature exits from otherwise valid trend-following positions.

### Common Mistakes

New learners often try to track every visible swing point at once
without separating scale, producing a structure read that reacts to
every minor wiggle. Deliberately choosing which scale (external, for
overall bias; internal, for entry timing) you're reading at any given
moment is what keeps structure reading useful rather than noisy.

### Key Takeaways

1. External structure defines the overall trend or range; internal
   structure is the finer detail nested inside a single external leg.
2. The same price data contains both scales simultaneously — the
   distinction is about which swing points you're deliberately
   tracking.
3. A break of internal structure is normal, lower-significance noise
   within an intact external trend; a break of external structure is
   a major event.

### Practice Drill

Given a 4H chart with one clearly marked external leg (provided in
Practise), zoom into the corresponding 15-minute view and mark at
least four internal swing points within that same leg.

### Scenario Challenge

You're holding a position based on a confirmed external 4H uptrend. A
15-minute internal CHoCH just occurred. Using this lesson's
vocabulary, is this alone a reason to exit? What would you need to see
to upgrade your concern to external-level significance?

### Mini Quiz

Q1 (True/False): Internal and external structure are two entirely
different, unrelated sets of price data.
Answer: False — they're the same price data, viewed at two different
deliberate scales; internal structure sits nested inside a single
external leg.

Q2 (Multiple choice): What does a minor internal CHoCH within an
intact external uptrend leg most likely represent?
(a) Definitive proof the uptrend has reversed
(b) Normal, lower-significance internal noise
(c) An error in the swing-point calculation
(d) Something that only matters on the Daily timeframe

Answer: (b).

### Flashcards

- Front: What is external structure? Back: The major swing highs and
  lows that define the overall trend or range at the scale you're
  deliberately tracking.
- Front: What is internal structure? Back: The smaller swing highs and
  lows nested inside a single external leg, visible at a finer scale.

### Reflection

Have you ever exited a position because of a small pullback that, in
hindsight, was just normal internal noise within an intact larger
trend? What would explicitly separating the two scales have told you
at the time?

### Mastery Criteria

Correctly mark at least four valid internal swing points within the
practice drill's external leg, distinct from the leg's own external
endpoints.

### Spaced Review

Day 1, Day 7, Day 21 — this distinction is required, explicitly, to
correctly read C2-06 (BOS) and C2-07 (CHoCH) at the right scale.

### Bot Connection

Bot 2 (Order Block Reversal) explicitly separates its higher-timeframe
external zone identification from its lower-timeframe internal
displacement/CHoCH entry trigger — this lesson's distinction is the
literal basis for that bot's multi-scale signal rules.

---

## C2-05 — Protected Highs and Lows

**Level:** 1
**Estimated study time:** 12 minutes
**Prerequisites:** C2-01, C2-02
**Learning objectives:** Define a protected high/low, explain what it
means for one to be "broken," and explain why this concept is the
direct basis for BOS and CHoCH.

### Why This Matters

BOS and CHoCH (C2-06, C2-07) are both defined in terms of a specific
swing point being broken. "Protected high" and "protected low" are the
vocabulary for exactly which swing point currently matters for that
purpose — the most recent one that the current structural read
depends on. Without this concept clearly defined first, BOS and CHoCH
definitions in the next two lessons will feel arbitrary.

### Core Teaching

**Plain-English explanation.** A protected high is the most recent
confirmed swing high that hasn't yet been broken — it's currently
"protecting" the structural read that depends on it (for example, an
uptrend's current classification depends on the most recent higher low
staying unbroken). A protected low is the mirror: the most recent
confirmed swing low that hasn't yet been broken. Once a protected
point IS broken, it stops being the relevant "protected" point — the
next swing point in the sequence takes over that role.

**Technical explanation.** In an uptrend, the relevant protected point
is generally the most recent confirmed swing low, because a close
below it is what would break the HH/HL sequence that defines the
uptrend in the first place (per C2-02). In a downtrend, the relevant
protected point is the most recent confirmed swing high, for the
mirror reason. The term "protected" specifically communicates that
this point currently protects the existing structural classification
— its status (broken or not) is precisely the trigger condition BOS
and CHoCH definitions are built around. A protected point is only ever
protected until the next relevant break; the concept is inherently
about the current, most recent point, not a permanent label on any
specific price level.

### Visual Model

See diagram: `visuals/c2-05-protected-low.svg` — an uptrend chart with
the most recent confirmed swing low highlighted with a shield icon and
labeled "protected low — breaking this changes the structural read,"
with prior, older swing lows shown unshielded and labeled "no longer
the relevant protected point."

### Worked Example

A market is in a confirmed uptrend with its most recent higher low at
1.0850. That level is the current protected low — as long as price
stays above it, the uptrend classification (per C2-02) remains
intact. Price later makes a new higher high, then pulls back and forms
a new higher low at 1.0910. The protected low is now 1.0910, not
1.0850 — the older level is no longer the one the current read
depends on.

### Counterexample

A trader continues referencing an old, since-superseded swing low as
"the level that matters" long after a newer, higher low has formed
and become the actual protected point. Structure reads made against
the wrong (outdated) protected point produce BOS/CHoCH calls that
don't match what the current structural sequence actually depends on.

### Good Example / Bad Example

Good: Updating which specific swing point is "protected" every time a
new one confirms, so the reference point used for BOS/CHoCH is always
current. Bad: Anchoring to whichever swing point looked most dramatic
or memorable, rather than the most recent one that actually protects
the current structural classification.

### What to Look Out For

- "Protected" always refers to the MOST RECENT relevant swing point —
  it updates every time a new one confirms.
- In an uptrend, the protected point is a low; in a downtrend, it's a
  high — check which state you're in before identifying it.
- Once a protected point breaks, the structural classification it
  protected changes immediately (this is precisely what BOS and CHoCH
  formalize in the next two lessons).

### Common Mistakes

A common error is treating every past swing point as equally
important, rather than recognizing that only the most recent relevant
one is actually "live" for determining the current structural state.
This produces confusion when price breaks an old, already-superseded
level — that break isn't structurally meaningful in the way breaking
the actual current protected point is.

### Key Takeaways

1. A protected high/low is the most recent confirmed swing point that
   the current structural classification depends on.
2. In an uptrend the relevant protected point is a swing low; in a
   downtrend it's a swing high.
3. The protected point updates every time a new relevant swing point
   confirms — it's always the most recent one, never a fixed level.

### Practice Drill

Given a ten-swing-point sequence (provided in Practise), identify the
currently protected point at each stage as new swing points form, and
note the two occasions where the protected point changes.

### Scenario Challenge

A market has been in an uptrend for weeks with several higher lows
along the way. Which specific one of those higher lows is the
currently protected low, and why isn't it the very first one from
weeks ago?

### Mini Quiz

Q1 (True/False): The protected low in an uptrend is always the very
first swing low that started the trend.
Answer: False — it's always the most recent confirmed swing low, which
updates as new higher lows form.

Q2 (Multiple choice): In a downtrend, which type of swing point is
currently "protected"?
(a) The most recent swing low
(b) The most recent swing high
(c) Both equally
(d) Neither — protection only applies to uptrends

Answer: (b). In a downtrend, a close above the most recent swing high
is what would break the LH/LL sequence.

### Flashcards

- Front: What does "protected" mean for a swing point? Back: It's the
  most recent confirmed swing point that the current structural
  classification (trend/range read) depends on — breaking it changes
  that classification.
- Front: Does the protected point stay fixed once identified? Back:
  No — it updates to the newest relevant swing point every time one
  confirms.

### Mastery Criteria

Correctly identify the currently protected point at every stage of the
ten-point practice-drill sequence, including both points where it
changes.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — this concept is the direct trigger
condition definition used in both C2-06 (BOS) and C2-07 (CHoCH),
immediately following.

### Bot Connection

Every bot's structure-tracking logic maintains a live "currently
protected" reference point per symbol per timeframe — this is exactly
what a bot's BOS/CHoCH detection checks against on every new candle.

---

## C2-06 — BOS: Break of Structure

**Level:** 1
**Estimated study time:** 13 minutes
**Prerequisites:** C2-02, C2-05
**Learning objectives:** Define Break of Structure precisely, correctly
identify a valid BOS on a real chart, and explain why BOS confirms
trend continuation rather than reversal.

### Why This Matters

BOS is one of the two core structural events (alongside CHoCH) that
every bot's signal logic checks for. Confusing BOS with CHoCH — reading
a continuation signal as a reversal signal, or vice versa — is one of
the most consequential mistakes possible in this framework, since it
inverts the intended direction of a trade.

### Core Teaching

**Plain-English explanation.** A Break of Structure (BOS) happens when
price breaks the current protected point (C2-05) in the SAME direction
as the existing trend — confirming the trend is continuing, not
reversing. In an uptrend, a BOS is a close above the most recent swing
high, extending the HH sequence. In a downtrend, a BOS is a close
below the most recent swing low, extending the LL sequence.

**Technical explanation.** Formally: given an established uptrend
(confirmed HH/HL sequence per C2-02) with protected low L_n, a BOS
occurs when price makes a new swing high H_(n+1) > H_n — this is simply
the trend's own defining sequence extending by one more step, using
the vocabulary introduced in this lesson to name that specific event.
Most frameworks require a candle CLOSE beyond the relevant prior swing
high or low, not merely a wick touching or exceeding it, for a BOS to
be considered valid — this close-vs-wick distinction is covered fully
in C2-08, since a wick-only break carries meaningfully different
implications than a confirmed close beyond the level.

### Visual Model

See diagram: `visuals/c2-06-bos.svg` — an uptrend chart with a
protected low marked, price pulling back to test it and holding, then
breaking clean above the prior swing high with a full candle close,
labeled "BOS — trend continuation confirmed."

### Worked Example

A confirmed uptrend has its most recent swing high at 1.0950. Price
pulls back, holds above the protected low, then rallies and closes a
candle at 1.0975 — clearly above 1.0950. This is a valid BOS: the
uptrend's HH sequence has extended, confirming continuation.

### Counterexample

A trader labels a downward move that merely wicks below a prior swing
low, without a candle closing below it, as a confirmed BOS. Because
the close never actually broke the level, this doesn't meet the
close-based confirmation standard most frameworks (and this course)
require — treating a wick-only touch as a confirmed BOS overstates
what actually happened.

### Good Example / Bad Example

Good: Waiting for a full candle close beyond the relevant protected
point before labeling a BOS, and checking that the break is in the
SAME direction as the existing trend. Bad: Labeling any break of any
swing point a "BOS" regardless of whether it's in the trend's existing
direction or against it (that would instead be a CHoCH, C2-07).

### What to Look Out For

- BOS confirms continuation — it always breaks in the SAME direction
  as the existing trend, never the opposite.
- A wick beyond a level, without a close beyond it, is not (in most
  frameworks, including this one) a confirmed BOS.
- BOS is a description of what already happened structurally — it is
  a confirmation signal, not by itself a complete trade setup (recall
  ORIENT-02's signal/setup/trade distinction).

### Common Mistakes

A very common beginner error is using "BOS" and "CHoCH" interchangeably
to mean "a level got broken," without checking direction relative to
the existing trend. These terms are deliberately distinct precisely
because one confirms continuation and the other signals a potential
reversal — conflating them inverts the meaning of the signal.

### Key Takeaways

1. BOS is a break of the current protected point in the SAME direction
   as the existing trend — it confirms continuation.
2. Most frameworks require a candle close beyond the level, not just a
   wick, for a valid BOS.
3. BOS is a signal in ORIENT-02's vocabulary — an input to a setup, not
   a complete trade on its own.

### Practice Drill

Given eight chart segments each showing a level break (provided in
Practise), identify which are valid BOS events (close-confirmed, same
direction as trend) and which fail one or both conditions.

### Scenario Challenge

Price is in a confirmed downtrend and just closed a candle below the
most recent swing low. What is this event called, and what should you
NOT conclude from it alone (recall ORIENT-02)?

### Mini Quiz

Q1 (True/False): A BOS breaks in the opposite direction from the
existing trend.
Answer: False — BOS breaks in the SAME direction as the existing
trend, confirming continuation. A break in the opposite direction is a
CHoCH.

Q2 (Multiple choice): Which of these is generally required for a valid
BOS in most frameworks, including this one?
(a) A wick touching the level
(b) A full candle close beyond the level
(c) Three consecutive wicks beyond the level
(d) No specific confirmation is required

Answer: (b).

### Flashcards

- Front: What does BOS stand for and confirm? Back: Break of Structure
  — a break of the current protected point in the same direction as
  the existing trend, confirming continuation.
- Front: Is a wick beyond a swing point enough to confirm a BOS? Back:
  Generally no — most frameworks (including this one) require a full
  candle close beyond the level.

### Reflection

Have you ever used "BOS" and "CHoCH" interchangeably before this
lesson? Write one sentence distinguishing them in your own words.

### Mastery Criteria

Correctly classify all eight practice-drill level breaks as valid BOS,
invalid (wick-only), or not a BOS at all (wrong direction).

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — BOS is an explicit, named
requirement in multiple bots' signal rules (Bot 1 and Bot 3
particularly); this concept needs strong long-term retention.

### Bot Connection

Bot 3 (Imbalance Expansion) requires a higher-timeframe BOS confirming
direction as its very first signal condition — nothing else in that
bot's logic is even checked until this exact event is confirmed.

---

## C2-07 — CHoCH: Change of Character

**Level:** 1
**Estimated study time:** 14 minutes
**Prerequisites:** C2-05, C2-06
**Learning objectives:** Define Change of Character precisely,
distinguish it clearly from BOS, and explain why a single CHoCH does
not, by itself, confirm a full trend reversal.

### Why This Matters

CHoCH is the formal structural definition behind the "transition"
state introduced in C2-03 — it's the specific, checkable event that
begins transition. Getting CHoCH right, and understanding what it does
NOT yet prove, is essential to avoiding the exact premature-reversal
mistake C2-03 warned about.

### Core Teaching

**Plain-English explanation.** A Change of Character (CHoCH) happens
when price breaks the current protected point in the OPPOSITE
direction from the existing trend — the first structural sign the
trend's sequence may be failing. In an uptrend, a CHoCH is a close
below the protected low. In a downtrend, a CHoCH is a close above the
protected high. Unlike BOS, which confirms continuation, CHoCH signals
a potential change — but only a potential one, not a confirmed new
trend.

**Technical explanation.** Formally, given an uptrend with protected
low L_n, a CHoCH occurs when a candle closes below L_n — this breaks
the HH/HL sequence that defined the uptrend (per C2-02), which is
exactly why C2-03 defines this event as the start of transition, not
yet a confirmed downtrend. A single CHoCH only confirms that the PRIOR
trend's sequence has failed; it does not, by itself, confirm a NEW
trend in the opposite direction, because that requires its own
subsequent HH/HL or LH/LL sequence (per C2-02) to form and confirm.
This is precisely the distinction C2-03 draws between "transition
begins" and "new trend confirmed" — CHoCH marks the former, not the
latter.

### Visual Model

See diagram: `visuals/c2-07-choch.svg` — an uptrend chart breaking
cleanly below its protected low with a full candle close, labeled
"CHoCH — prior uptrend sequence broken," with a dotted, explicitly
uncertain continuation showing two possible paths forward (a genuine
reversal beginning, vs. a failed CHoCH that resumes the original
uptrend), captioned "Transition — not yet a confirmed new trend."

### Worked Example

An uptrend's protected low sits at 1.0850. Price closes a candle at
1.0830 — a valid CHoCH, confirming the prior uptrend's HH/HL sequence
has broken. At this point, per C2-03, the market is in transition, not
yet a confirmed downtrend. Several candles later, price makes a lower
high and then a lower low, confirming the LH/LL sequence — only now,
with that additional confirmation, has the CHoCH actually resolved
into a confirmed new downtrend.

### Counterexample

A trader sees the CHoCH candle close below 1.0850 and immediately
declares "the trend has reversed," entering a large short position
with full conviction, treating the CHoCH alone as equivalent to a
confirmed new downtrend. This skips exactly the additional
confirmation (a subsequent LH/LL sequence) this lesson and C2-03 both
require before that conclusion is actually structurally supported.

### Good Example / Bad Example

Good: Treating a CHoCH as "the prior trend's sequence has broken, the
market is now in transition" and waiting for a subsequent HH/HL or
LH/LL sequence before concluding a new trend is confirmed. Bad:
Treating a single CHoCH as proof of a completed trend reversal.

### What to Look Out For

- A CHoCH breaks in the OPPOSITE direction from the existing trend —
  this is the defining difference from BOS.
- A single CHoCH confirms only that the PRIOR trend's sequence has
  failed — it does not by itself confirm a new trend in the other
  direction.
- CHoCH events sometimes fail to lead anywhere — price can CHoCH, then
  resume the original trend without ever confirming a new opposite
  sequence. This is a normal, expected outcome, not a broken signal.

### Common Mistakes

The single most consequential beginner mistake in this entire module
is treating a CHoCH as equivalent to a confirmed trend reversal. This
directly contradicts C2-03's transition state and leads to acting on
what is, structurally, still an open question — exactly the premature
resolution C2-03 warned against.

### Key Takeaways

1. CHoCH is a break of the protected point in the OPPOSITE direction
   from the existing trend — the mirror of BOS.
2. A single CHoCH confirms only that the prior trend's sequence has
   failed, not that a new opposite trend is confirmed.
3. A CHoCH can fail to lead to a new trend — the original trend can
   resume. This is a normal outcome, not evidence the concept doesn't
   work.

### Practice Drill

Given eight chart segments (provided in Practise, overlapping with
C2-06's set), identify which show a valid CHoCH, and for each, state
whether a subsequent HH/HL or LH/LL sequence went on to confirm a full
new trend or whether the original trend resumed instead.

### Scenario Challenge

A confirmed uptrend just produced a valid CHoCH. A colleague says "the
trend has officially reversed, go short." Using this lesson and
C2-03's vocabulary, what specifically is still missing before that
claim is fully supported?

### Mini Quiz

Q1 (True/False): CHoCH and BOS both break in the same direction as
the existing trend.
Answer: False — BOS breaks in the same direction (continuation); CHoCH
breaks in the opposite direction (the first sign of potential
reversal).

Q2 (Multiple choice): What does a single confirmed CHoCH prove, by
itself?
(a) A full trend reversal has occurred
(b) Nothing structurally meaningful
(c) The prior trend's swing-point sequence has broken
(d) The next trade is guaranteed profitable

Answer: (c).

### Flashcards

- Front: What does CHoCH stand for and signal? Back: Change of
  Character — a break of the protected point in the opposite direction
  from the existing trend, marking the start of transition.
- Front: Does a single CHoCH confirm a new trend has begun? Back: No —
  it only confirms the prior trend's sequence has broken; a new HH/HL
  or LH/LL sequence must still form to confirm an actual new trend.

### Reflection

Recall a time (in this course or elsewhere) you treated an early
warning sign as if it were already a confirmed conclusion. What
additional confirmation, in hindsight, would have been the honest
next step?

### Mastery Criteria

Correctly classify all eight practice-drill segments as valid/invalid
CHoCH, and correctly report the eventual outcome (new trend confirmed
vs. original trend resumed) for each valid one.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — CHoCH is the named trigger
condition in Bot 5's core setup logic; this concept needs strong
long-term retention specifically because misreading it inverts trade
direction.

### Bot Connection

Bot 5 (Liquidity Purge Specialist) is built specifically around the
sequence of a liquidity sweep followed by displacement and a CHoCH —
this lesson's precise definition is the exact structural trigger that
bot's setup logic checks for, distinct from a mere BOS.

---

## C2-08 — Wick vs. Body Break, Displacement, False Break

**Level:** 1
**Estimated study time:** 14 minutes
**Prerequisites:** C1-03, C2-06, C2-07
**Learning objectives:** Distinguish a wick-only break from a
body-confirmed break, define displacement in the context of a
structural break, and explain what makes a break "false."

### Why This Matters

C2-06 and C2-07 both mentioned, briefly, that most frameworks require
a candle close (not just a wick) beyond a level for a valid BOS or
CHoCH. This lesson makes that distinction rigorous, and adds two more
related ideas — displacement and false breaks — that together
determine how much confidence to place in any given structural break.

### Core Teaching

**Plain-English explanation.** When price crosses a level, it can do
so two different ways: the candle's wick briefly pokes beyond the
level before closing back on the other side (a wick-only break), or
the candle's body actually closes beyond the level (a body, or
close-confirmed, break). A body break is generally treated as stronger
evidence that the level has genuinely been overcome, because the
candle's close represents where value actually settled for that
period, not just a brief excursion. Displacement refers to a strong,
often fast, large-range move through a level — the kind of decisive
move that leaves little doubt real conviction was behind the break, as
opposed to a slow, grinding creep across it. A false break is when
price crosses a level (often just with a wick) and then reverses back
without any real follow-through — the apparent break turns out to have
been a trap, not genuine continuation.

**Technical explanation.** Close-location value (introduced in C1-03)
is directly useful here: a body break with a high close-location value
in the direction of the break (the close sitting near the extreme of
that candle's range, in the direction of the move) is stronger evidence
of genuine follow-through than a break where the close sits back near
the middle or opposite end of its range. Displacement is often
quantified using average true range (C1-04): a break candle with a
range meaningfully larger than the recent average, combined with a
strong close-location value, is a reasonable working definition of
"displacement" for this course. A false break commonly shows the
opposite signature: a long wick beyond the level with a close that
snaps back well inside the prior range — low close-location value in
the direction of the apparent break, and often, no meaningful
displacement at all.

### Visual Model

See diagram: `visuals/c2-08-wick-body-displacement.svg` — three
side-by-side candle examples over the same level: (1) a wick-only
break with the close snapping back inside — labeled "false break"; (2)
a modest body close just beyond the level with average range — labeled
"body break, weak displacement"; (3) a large-range candle closing well
beyond the level near its own extreme — labeled "body break with
displacement — strongest evidence."

### Worked Example

Price approaches a key swing high at 1.0950. One candle wicks up to
1.0965 but closes back down at 1.0940 — a wick-only break with a close
back inside the prior range: a likely false break, not genuine
continuation. Two candles later, a large-range candle closes at
1.0990, well above 1.0950, with a close-location value near the top of
its own range and a range roughly twice the recent average — this is
a body break with genuine displacement, much stronger evidence of a
real BOS.

### Counterexample

A trader treats the first wick-only excursion to 1.0965 as a confirmed
BOS the moment it happens intraday, without waiting for the candle to
close. When the candle then closes back inside the prior range, the
trader is left holding a position based on a break that never actually
confirmed by the close-based standard this course uses.

### Good Example / Bad Example

Good: Waiting for the candle close, checking close-location value, and
comparing the candle's range to recent average range before treating a
level break as strong, displacement-confirmed evidence. Bad: Reacting
to any wick beyond a level as if it were already a confirmed,
high-conviction break.

### What to Look Out For

- A wick beyond a level, on its own, is weak evidence — always wait
  for the close.
- Not every body-close break shows displacement — a break can close
  just barely beyond a level with an unremarkable range, which is
  real but weaker evidence than a displaced break.
- A false break is often exactly what a liquidity sweep looks like
  from a pure price-action view (Core 3 formalizes the liquidity side
  of this same event) — the two concepts describe overlapping
  observations from different angles.

### Common Mistakes

Beginners frequently treat every level break identically, without
distinguishing wick-only from body-confirmed, or checking for
displacement. This produces false confidence in weak breaks and can
lead to entering directly into what turns out to be a trap — a false
break that reverses immediately after triggering early entries.

### Key Takeaways

1. A body (close-confirmed) break is stronger evidence than a
   wick-only break, which frequently reverses.
2. Displacement — a large-range, decisive move through a level — adds
   further confidence beyond a plain body close.
3. A false break typically shows a wick-only excursion with the close
   snapping back inside the prior range and little to no displacement.

### Practice Drill

Given ten level-break examples (provided in Practise), classify each
as wick-only, body break without displacement, or body break with
displacement, using close-location value and relative candle range as
your evidence.

### Scenario Challenge

Price wicks above a key resistance level intraday but the candle
hasn't closed yet. Using this lesson's vocabulary, what should you
wait for before treating this as a confirmed break, and what two
things would make you MORE confident once it does close?

### Mini Quiz

Q1 (True/False): A wick beyond a level is generally treated as
stronger evidence of a break than a candle body closing beyond it.
Answer: False — a body (close-confirmed) break is generally treated as
stronger evidence; a wick-only break is weaker and often reverses.

Q2 (Multiple choice): Which combination best describes genuine
displacement through a level?
(a) A small-range candle barely closing beyond the level
(b) A large-range candle, well above recent average range, closing
    near its own extreme beyond the level
(c) Any wick beyond the level, regardless of the close
(d) Three small candles slowly grinding across the level

Answer: (b).

### Flashcards

- Front: What's the difference between a wick break and a body break?
  Back: A wick break only briefly pokes beyond a level before closing
  back inside; a body break has the candle's close itself beyond the
  level — generally stronger evidence.
- Front: What is displacement, in the context of a structural break?
  Back: A strong, large-range, high-close-location-value move through
  a level — decisive evidence of real follow-through, not just a
  narrow break.

### Reflection

Have you ever entered a trade on a wick-only break, before the candle
closed, and watched it reverse? What would waiting for close-based
confirmation with displacement have changed?

### Mastery Criteria

Correctly classify all ten practice-drill examples using
close-location value and relative range as evidence for each
classification.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this distinction is required
reading for Core 3's liquidity-sweep lessons and is an explicit
confirmation requirement in Bot 3 and Bot 5's signal rules.

### Bot Connection

Bot 3 (Imbalance Expansion) explicitly requires displacement (not just
any body break) as part of its second signal condition — a
close-confirmed but non-displaced break does not satisfy that bot's
rules, precisely because of the strength difference this lesson
establishes.

---

## C2-09 — Structural Invalidation

**Level:** 1
**Estimated study time:** 12 minutes
**Prerequisites:** C2-05, C2-06, C2-07
**Learning objectives:** Define structural invalidation, identify the
specific invalidation level for a given structural read, and explain
why every trading plan needs an explicit invalidation condition stated
in advance.

### Why This Matters

Every concept in Core 2 so far has been about reading structure
correctly. This lesson closes the module by asking the necessary
follow-up question: at what specific point does your current
structural read become wrong? Having an explicit answer to that
question, decided in advance, is what turns "I think this is an
uptrend" into a plan you can actually execute and exit correctly when
proven wrong.

### Core Teaching

**Plain-English explanation.** Structural invalidation is the specific
price level or event that, if it occurs, proves your current
structural read (trend direction, a specific zone's relevance, a
setup's premise) is no longer valid. It's the honest answer to "what
would tell me I'm wrong here?" — decided before you act, not
rationalized after the fact. Every one of the structural events this
module defined (a protected point breaking, a CHoCH occurring) is a
form of invalidation for whatever structural claim depended on that
point staying intact.

**Technical explanation.** For a trend-following read, the natural
invalidation level is the current protected point (C2-05) — a
close-confirmed CHoCH (C2-07) through it invalidates the "we are in an
uptrend" (or downtrend) premise the trade was based on. For a
zone-based setup (covered fully in Core 4), invalidation is typically a
close beyond the far boundary of the zone, since a body close through
the entire zone suggests the zone has failed to hold rather than
merely being tested. The key discipline this lesson teaches is
deciding the specific invalidation condition BEFORE entering a trade,
as part of the setup itself (recall ORIENT-02's signal-setup-trade
pipeline) — not searching for a reason to stay in a position after
price has already moved against the original premise.

### Visual Model

See diagram: `visuals/c2-09-invalidation-level.svg` — a trade entry
marked on a chart with three explicit levels labeled: Entry, Target,
and Invalidation (drawn at the protected point the trend read depends
on), with an annotation reading "decided BEFORE entry — not moved
after the fact."

### Worked Example

A trader enters long based on a confirmed uptrend, with the current
protected low at 1.0850 as the stated invalidation level — the trade's
entire premise (uptrend intact) depends on staying above it. Price
later closes at 1.0830, a confirmed CHoCH through the invalidation
level. The trader exits immediately, exactly as planned — the
structural premise for the trade is gone, regardless of how the
position currently feels.

### Counterexample

A different trader, using an identical setup and identical
invalidation level, sees price close below 1.0850 and instead moves
their mental invalidation level lower, reasoning "it's probably just a
deeper pullback." This is not disciplined structure reading — it's
rationalizing away the exact condition that was supposed to prove the
read wrong, decided in advance specifically to prevent this kind of
after-the-fact reasoning.

### Good Example / Bad Example

Good: Writing down the specific invalidation level as part of the
trade plan before entry, and treating a close beyond it as a hard exit
signal regardless of how confident you feel in the moment. Bad: Moving
the invalidation level after price approaches it, to avoid admitting
the original read was wrong.

### What to Look Out For

- Invalidation must be decided BEFORE entry — deciding it after price
  has already moved against you defeats its entire purpose.
- Moving an invalidation level after the fact, to avoid taking a loss,
  is one of the clearest markers of the psychological failure modes
  covered later in the Psychology module.
- Structural invalidation and the stop-loss placement taught in Core 8
  are closely related but not automatically identical — Core 8 covers
  exactly how they interact.

### Common Mistakes

The single most damaging version of this mistake is moving an
invalidation level (or a stop-loss) further away after price
approaches it, specifically to avoid realizing a loss. This converts a
planned, survivable loss into an unplanned, larger one, and is
precisely the failure mode a stated-in-advance invalidation level
exists to prevent.

### Key Takeaways

1. Structural invalidation is the specific, predetermined level or
   event that proves your current structural read wrong.
2. It must be decided BEFORE entry, as part of the setup itself — not
   after price has already moved against the position.
3. Moving an invalidation level after the fact to avoid a loss defeats
   its entire purpose and is a serious psychological failure mode.

### Practice Drill

Given five trade setups with stated structural premises (provided in
Practise), identify the specific invalidation level for each based on
this module's concepts (protected point, CHoCH), and state it as a
precise price or condition.

### Scenario Challenge

You entered a trade with a stated invalidation level. Price is now
approaching that level and the position feels uncomfortable to exit.
What does this lesson say you should do, and why was the discomfort
itself already anticipated by deciding the level in advance?

### Mini Quiz

Q1 (True/False): It's acceptable to move an invalidation level further
away if price is approaching it and the original read still "feels"
correct.
Answer: False — this is exactly the rationalization this lesson exists
to prevent; invalidation must be honored once decided in advance.

Q2 (Multiple choice): For a simple trend-following read, what is the
natural structural invalidation level?
(a) An arbitrary round number
(b) The current protected point, per C2-05
(c) Yesterday's closing price
(d) There is no meaningful invalidation level for trend trades

Answer: (b).

### Flashcards

- Front: What is structural invalidation? Back: The specific,
  predetermined price level or event that proves your current
  structural read is wrong — decided before entry, not after.
- Front: Why must invalidation be decided before entry rather than
  after? Back: Deciding it after price has moved against you invites
  rationalizing it away exactly when it matters most — the entire
  point is to remove that after-the-fact judgment call.

### Reflection

Think of a trade (real or hypothetical) where you moved your exit
point after price moved against you. What would stating the
invalidation level explicitly, before entry, have changed?

### Mastery Criteria

Correctly state a precise invalidation level or condition for all five
practice-drill setups, grounded in this module's protected-point and
CHoCH concepts.

### Spaced Review

Day 1, Day 7, Day 14, Day 30 — this concept is the direct structural
basis for Core 8's stop-loss and invalidation lesson (C8-02), and
resurfaces explicitly in Core 9's trade-lifecycle module.

### Bot Connection

Every bot's trade record stores an explicit invalidation condition
alongside its stop-loss at the moment a trade is opened — this is
exactly what lets the Weekly Review Engine later distinguish a
disciplined, planned loss from a loss where the exit was moved after
the fact.
