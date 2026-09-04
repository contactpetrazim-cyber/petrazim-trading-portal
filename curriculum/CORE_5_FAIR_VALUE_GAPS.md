# CORE 5 — FAIR VALUE GAPS & IMBALANCE

---

## C5-01 — What Imbalance Means, FVG Formation

**Level:** 2
**Estimated study time:** 15 minutes
**Prerequisites:** C1-06, C2-08
**Learning objectives:** Define a Fair Value Gap (FVG) using the exact
three-candle rule, and explain how it differs from the session gap
concept already taught in C1-06.

### Why This Matters

C1-06 flagged, in advance, that a session gap and a Fair Value Gap can
look superficially similar but have different causes — this lesson is
where that promise gets kept, giving the FVG its own precise,
checkable definition rather than leaving it as a vague "gap-shaped
thing on a chart."

### Core Teaching

**Plain-English explanation.** An FVG is a specific three-candle
pattern that forms during a strong, displaced move (C2-08): the
MIDDLE candle moves so fast and so far in one direction that the first
and third candles' ranges don't overlap at all, leaving a genuine gap
in the middle candle's range that price never traded through in either
direction. This represents "imbalance" in a precise sense — a stretch
of price where buying and selling pressure was so one-sided that no
real two-way trading (no genuine agreement between buyers and sellers)
occurred at those specific prices.

**Technical explanation.** Formally, given three consecutive candles
1, 2, and 3: a bullish FVG exists when candle 1's high is below candle
3's low — the gap is the price range between them (candle 1's high
and candle 3's low), which candle 2's move jumped clean over without
either the high of candle 1 or the low of candle 3 being touched. A
bearish FVG is the mirror: candle 1's low sits above candle 3's high.
Because an FVG requires only three consecutive candles with no gap in
time between them, it can form during completely normal, continuous
intra-session trading — no market closure is required. This is the
exact distinction C1-06 promised: a session gap (C1-06) requires a
market closing and reopening at a different price; an FVG requires
only a sufficiently fast three-candle move, with no closure involved
at all.

### Visual Model

See diagram: `visuals/c5-01-fvg-formation.svg` — three consecutive
candles shown mid-displacement: candle 1 (its high marked with a
dotted line), candle 2 (a large-range middle candle), candle 3 (its
low marked with a dotted line, clearly above candle 1's high) — the
shaded gap between the two dotted lines labeled "Fair Value Gap — no
trading occurred in this price range."

### Worked Example

Candle 1 has a high of 1.0900. Candle 2 is a large, fast bullish
candle. Candle 3 has a low of 1.0915 — above candle 1's high. The
price range from 1.0900 to 1.0915 was never touched by either candle 1
or candle 3; only candle 2 passed through it in one direction. This
range is a genuine bullish FVG.

### Counterexample

A trader sees a session-open gap on a Monday morning candle (price
opening well away from Friday's close, per C1-06) and calls it an
FVG, checking only two candles rather than the required three with
non-overlapping ranges. A session gap and an FVG can coexist or look
similar, but they're identified by different rules — this lesson's
three-candle, no-closure-required rule is specifically what defines an
FVG.

### Good Example / Bad Example

Good: Checking all three candles' exact highs and lows before
confirming an FVG, and confirming genuine displacement (C2-08) drove
the middle candle. Bad: Labeling any visually gappy-looking area on a
chart an FVG without verifying the specific three-candle non-overlap
rule.

### What to Look Out For

- An FVG requires THREE consecutive candles with a specific non-
  overlap condition — not just "candles that look spaced apart."
- No market closure is required — an FVG can and often does form
  during continuous, intra-session trading.
- The middle candle needs genuine displacement (C2-08) behind it —
  a slow, three-candle drift with a technical non-overlap but no real
  momentum is a much weaker signal than a genuinely displaced one.

### Common Mistakes

A frequent beginner error is conflating every visible "gap-like" area
on a chart with a genuine FVG, without checking the specific three-
candle rule. Precision here matters because Core 5's later lessons
(fill states, tradability) all assume the FVG was correctly identified
in the first place.

### Key Takeaways

1. An FVG is a specific three-candle pattern: candle 1 and candle 3's
   ranges don't overlap, leaving a genuine untraded gap from candle
   2's fast move.
2. Unlike a session gap (C1-06), an FVG requires no market closure —
   it can form during continuous trading.
3. Genuine displacement (C2-08) behind the middle candle matters —
   not just the technical non-overlap condition alone.

### Practice Drill

Given fifteen three-candle sequences (provided in Practise), identify
which show a valid bullish FVG, which show a valid bearish FVG, and
which show no FVG at all.

### Scenario Challenge

You see three consecutive candles where candle 1's high is 1.0910 and
candle 3's low is 1.0908 — very close, but not quite non-overlapping.
Using this lesson's exact rule, does this qualify as an FVG? Why does
precision matter here?

### Mini Quiz

Q1 (True/False): An FVG requires the market to have closed and
reopened, the same way a session gap does.
Answer: False — an FVG can form during continuous, intra-session
trading with no market closure required.

Q2 (Multiple choice): What exactly defines a bullish FVG?
(a) Any three candles that are all bullish
(b) Candle 1's high sitting below candle 3's low, leaving an
    untraded gap
(c) A gap between Friday's close and Monday's open
(d) Any large green candle

Answer: (b).

### Flashcards

- Front: What is the exact three-candle rule for a bullish FVG? Back:
  Candle 1's high sits below candle 3's low — the untraded range
  between them is the gap.
- Front: How does an FVG differ from a session gap (C1-06)? Back: An
  FVG needs only a fast three-candle move with no market closure
  required; a session gap specifically requires the market to close
  and reopen at a different price.

### Reflection

Before this lesson, would you have distinguished an FVG from a
session-open gap? Write one sentence on the specific rule that
separates them.

### Mastery Criteria

Correctly classify all fifteen practice-drill sequences as bullish
FVG, bearish FVG, or no FVG, using the exact non-overlap rule.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — this exact rule is the direct
prerequisite for every remaining Core 5 lesson.

### Bot Connection

Bot 3 (Imbalance Expansion) requires displacement to create an FVG
above a minimum size (C5-02) as an explicit, named signal condition —
this lesson's precise three-candle rule is exactly what that
condition checks.

---

## C5-02 — Bullish/Bearish FVG, Minimum Gap

**Level:** 2
**Estimated study time:** 13 minutes
**Prerequisites:** C5-01
**Learning objectives:** Correctly label a bullish vs. bearish FVG,
and explain why a minimum size threshold is used to filter which FVGs
are worth tracking.

### Why This Matters

C5-01 established the mechanics of how an FVG forms; this lesson adds
the practical filtering step every real framework applies before
treating an FVG as meaningful — without a minimum size standard, tiny,
insignificant gaps get treated with the same weight as genuinely
important ones.

### Core Teaching

**Plain-English explanation.** A bullish FVG forms during an upward
displacement (candle 1's high below candle 3's low, per C5-01) and is
generally expected to act as support if price returns to it later. A
bearish FVG forms during a downward displacement (candle 1's low above
candle 3's high) and is generally expected to act as resistance. Not
every technically-valid FVG is worth tracking, though — a gap that's
tiny relative to the instrument's normal volatility carries much less
significance than a gap that represents a genuinely large, unusual
imbalance, which is why a minimum size filter is standard practice.

**Technical explanation.** A common, practical minimum-gap standard
compares the FVG's size to the instrument's Average True Range (ATR,
introduced in C1-04) — for example, requiring the gap to be at least
some fraction of the current ATR before it's considered significant
enough to track. This filters out FVGs that technically meet C5-01's
three-candle rule but are so small relative to normal price movement
that they carry little real informational content — the equivalent,
in FVG terms, of the "random wick" category from C3-04: technically
present, but not meaningfully significant. The specific threshold
varies across frameworks and instruments; the important habit this
lesson teaches is applying SOME consistent minimum-size filter, not
treating every technically-valid gap as equally worth tracking.

### Visual Model

See diagram: `visuals/c5-02-minimum-gap-filter.svg` — two FVGs shown
side by side on the same chart, one clearly large relative to recent
candle ranges (labeled "Significant — above the ATR threshold") and
one visibly tiny (labeled "Below threshold — technically an FVG, but
not tracked").

### Worked Example

An instrument's recent ATR is roughly 50 points. One FVG measures 80
points wide — well above threshold, worth tracking. A different,
technically-valid FVG on the same chart measures only 8 points wide —
tiny relative to the 50-point ATR, and reasonably filtered out as
insignificant noise despite meeting C5-01's formation rule.

### Counterexample

A trader tracks every technically-valid FVG on a chart with equal
attention, including several that are a small fraction of the
instrument's normal candle range. This produces a cluttered chart full
of low-significance zones, diluting attention away from the genuinely
large, meaningful gaps.

### Good Example / Bad Example

Good: Comparing a candidate FVG's size against a consistent reference
(such as ATR) before deciding whether to track it. Bad: Marking every
technically-valid three-candle gap on a chart regardless of how small
it is relative to normal price movement.

### What to Look Out For

- "Technically valid" (per C5-01) and "significant enough to track"
  are different claims — this lesson adds the second filter.
- The exact minimum-size threshold is a judgment call, not a fixed
  universal number — consistency in applying SOME threshold matters
  more than the precise cutoff chosen.
- A minimum-size filter should be applied consistently across an
  entire analysis session, not selectively to make a preferred setup
  look more significant.

### Common Mistakes

A common beginner mistake is marking every technically-valid FVG on a
chart without any size filter at all, producing a chart so cluttered
with insignificant gaps that the genuinely important ones become hard
to distinguish from noise.

### Key Takeaways

1. Bullish FVGs generally act as expected support on retest; bearish
   FVGs generally act as expected resistance.
2. A minimum size filter (commonly relative to ATR) separates
   significant FVGs from technically-valid but insignificant ones.
3. Applying SOME consistent threshold matters more than the exact
   cutoff chosen.

### Practice Drill

Given ten FVGs with their sizes and the instrument's current ATR
provided (in Practise), determine which meet a reasonable minimum-size
threshold and which don't.

### Scenario Challenge

You find a technically-valid FVG that's a small fraction of the
instrument's ATR. A colleague wants to trade it with full confidence
anyway. Using this lesson's vocabulary, what would you tell them about
this gap's likely significance?

### Mini Quiz

Q1 (True/False): Every FVG that meets C5-01's three-candle formation
rule is automatically significant enough to trade.
Answer: False — a minimum size filter (commonly relative to ATR)
is needed to separate significant gaps from insignificant ones.

Q2 (Multiple choice): What's a common reference for setting a minimum
FVG size threshold?
(a) The instrument's Average True Range (ATR)
(b) The time of day
(c) The candle's exact color
(d) The number of candles since market open

Answer: (a).

### Flashcards

- Front: What does a bullish FVG generally act as on a later retest?
  Back: Support — price returning to fill part of the gap is
  generally expected to find buying interest there.
- Front: Why use a minimum-size filter for FVGs? Back: To separate
  genuinely significant gaps from technically-valid but insignificant
  ones that carry little real informational content.

### Mastery Criteria

Correctly filter all ten practice-drill FVGs against a reasonable ATR-
based threshold, with valid reasoning for each inclusion/exclusion.

### Spaced Review

Day 1, Day 7, Day 21 — this minimum-size filtering habit resurfaces
directly in C5-04's broader noise-filtering lesson.

### Bot Connection

Bot 3 (Imbalance Expansion) explicitly requires an FVG above a
minimum ATR-based size as a named signal condition — this lesson's
filter is not just good practice, it's a hard requirement in that
bot's actual rule set.

---

## C5-03 — FVG Fill: Partial, Full, Inversion, Retracement

**Level:** 2
**Estimated study time:** 14 minutes
**Prerequisites:** C5-01, C4-04
**Learning objectives:** Define partial fill, full fill, inversion,
and retracement as they apply to an FVG's lifecycle, and correctly
classify a given FVG's current fill state.

### Why This Matters

An FVG doesn't simply exist or not exist — like the zone lifecycle
taught in C4-04, it moves through states as price interacts with it
over time, and each state carries a different expectation for how the
FVG is likely to behave going forward.

### Core Teaching

**Plain-English explanation.** Retracement is the general term for
price returning back into an FVG at all, regardless of how much of it
gets covered. A partial fill is when price trades into the gap but
doesn't cover the entire range before reversing — some of the original
untraded price range remains untouched. A full fill is when price
trades all the way through the entire gap, closing it completely.
Inversion is what can happen after a full fill: much like a breaker
block (C4-03), a fully-filled FVG can flip and start acting in the
OPPOSITE direction from its original bias — an "inverse FVG."

**Technical explanation.** These states form a rough lifecycle similar
to C4-04's zone states: an FVG starts fully open (0% filled), may
undergo one or more partial retracements into it (each one
using up some of the original imbalance, similar to zone mitigation),
and may eventually be fully filled. A full fill technically removes the
original imbalance entirely — there's no longer any untraded price
range left. Whether the FVG then acts as a genuine inversion (flipping
to the opposite bias) depends on the same kind of confirming evidence
C4-03 required for a breaker block: a close through the entire gap,
followed by price returning and reacting in the opposite direction,
not merely the technical fact of having been filled once.

### Visual Model

See diagram: `visuals/c5-03-fvg-fill-states.svg` — a single bullish
FVG shown across four stages: (1) freshly formed, fully open; (2)
partially filled — price dipped into the lower portion and reversed;
(3) fully filled — price traded clean through the entire range; (4)
inverted — price later returns to the same (now fully-filled) zone and
gets rejected DOWNWARD, the opposite of its original bullish bias.

### Worked Example

A bullish FVG spans 1.0900 to 1.0915. Price later dips to 1.0910
(covering roughly a third of the gap) and reverses back up — a partial
fill, with two-thirds of the original gap still untraded. Weeks later,
price returns and trades cleanly through the entire 1.0900–1.0915
range, continuing lower — a full fill, and if price later returns to
that same zone and is rejected upward from beneath it, that would
confirm an inversion (now acting as resistance, opposite its original
bullish bias).

### Counterexample

A trader sees an FVG get fully filled once and immediately assumes it
must now be a bearish inversion zone, without waiting for any actual
confirming reaction in the opposite direction. A full fill alone
doesn't automatically confirm an inversion — it only removes the
gap's original untraded status; the opposite-direction reaction still
needs to actually happen and be observed.

### Good Example / Bad Example

Good: Tracking whether an FVG is unfilled, partially filled, or fully
filled, and waiting for an actual confirming reaction before calling a
full fill an inversion. Bad: Assuming a fully-filled FVG automatically
becomes a reliable inversion zone without any confirming price
reaction there.

### What to Look Out For

- Partial fill still leaves real, untraded imbalance remaining — the
  FVG isn't "used up" yet.
- A full fill removes the original imbalance entirely — the zone's
  original bias should no longer be trusted the same way.
- Inversion is a confirmed, observed reaction in the opposite
  direction — not an automatic consequence of a full fill.

### Common Mistakes

A common error is treating a partially-filled FVG as if it were fully
used up, or conversely treating a fully-filled FVG as though its
original bias were somehow still trustworthy. Both mistakes come from
not tracking the fill state explicitly.

### Key Takeaways

1. Retracement is any return into an FVG; partial fill leaves
   untraded range remaining; full fill closes the gap entirely.
2. A full fill removes the FVG's original imbalance — its original
   directional bias should no longer be trusted.
3. Inversion requires an actual confirmed reaction in the opposite
   direction — not just the fact of having been fully filled.

### Practice Drill

Given eight FVGs with their full price-interaction history (provided
in Practise), classify each as unfilled, partially filled, fully
filled, or (fully filled AND) inverted.

### Scenario Challenge

An FVG has just been fully filled by a single strong candle closing
straight through it. Using this lesson's vocabulary, can you already
call this an inversion? What specifically would you need to see next?

### Mini Quiz

Q1 (True/False): A fully-filled FVG automatically becomes a reliable
inversion zone.
Answer: False — inversion requires an actual observed reaction in the
opposite direction, not just the fact of a full fill.

Q2 (Multiple choice): What does a partial fill leave behind?
(a) Nothing — the FVG is fully used up
(b) Some of the original untraded price range, still unfilled
(c) A guaranteed reversal
(d) A new order block

Answer: (b).

### Flashcards

- Front: What's the difference between a partial and a full FVG fill?
  Back: A partial fill leaves some of the original untraded range
  remaining; a full fill trades through the entire gap, removing the
  original imbalance entirely.
- Front: What does "inversion" require, beyond a full fill? Back: An
  actual confirmed price reaction in the OPPOSITE direction from the
  FVG's original bias — not just the technical fact of having been
  filled.

### Mastery Criteria

Correctly classify all eight practice-drill FVGs by fill state, with
valid supporting evidence for any marked as inverted.

### Spaced Review

Day 1, Day 7, Day 21, Day 30 — this fill-state lifecycle parallels
C4-04's zone lifecycle directly and is tested again together with it
in later confluence lessons.

### Bot Connection

Bot 3 (Imbalance Expansion) tracks each FVG's fill state explicitly
and adjusts its own setup confidence as a tracked gap moves from
unfilled toward partially or fully filled, rather than treating an
FVG's status as fixed once formed.

---

## C5-04 — FVG vs. Ordinary Price Noise: When Not to Trade It

**Level:** 2
**Estimated study time:** 13 minutes
**Prerequisites:** C5-01 through C5-03, C3-06, C4-06
**Learning objectives:** Identify the conditions under which a
technically-valid FVG is not worth trading, applying the same
filtering discipline taught for liquidity pools (C3-06) and zones
(C4-06) specifically to Fair Value Gaps.

### Why This Matters

This lesson closes Core 5 the same way C3-06 and C4-06 closed their
own modules: correct identification is necessary but not sufficient.
Without this filtering discipline, every technically-valid FVG on a
chart looks equally compelling, which is exactly how overtrading on
noise happens.

### Core Teaching

**Plain-English explanation.** An FVG can meet every technical rule
from C5-01 and C5-02 and still be a poor trading candidate. The same
kinds of factors that determine whether a liquidity pool (C3-06) or a
zone (C4-06) is worth trading apply here too: was the displacement
genuinely strong, or just barely large enough to qualify? Does the
FVG have any confluence with other concepts (a nearby order block, a
liquidity pool, favorable higher-timeframe bias)? Has it already been
partially or fully filled, reducing how much genuine imbalance
remains? An isolated, borderline-sized FVG with no supporting evidence
is ordinary noise wearing a technically-correct label, not a genuinely
strong setup.

**Technical explanation.** Practically, this means checking, before
acting on any candidate FVG: (1) Displacement quality — was the middle
candle genuinely displaced (C2-08), well above minimum size (C5-02),
or just barely qualifying? (2) Confluence — does the FVG align with a
nearby order block (Core 4), a liquidity pool (Core 3), or favorable
higher-timeframe bias, or does it stand alone with no supporting
evidence? (3) Fill state (C5-03) — is the FVG still substantially
unfilled, or has most of its original imbalance already been used up?
An FVG that scores poorly across these checks — weak displacement, no
confluence, mostly filled — is exactly the kind of technically-labeled
but low-quality setup this entire curriculum has repeatedly warned
against treating with full confidence (C3-06, C4-06), now applied to
the last major zone-type Core 5 introduces.

### Visual Model

See diagram: `visuals/c5-04-fvg-quality-checklist.svg` — a checklist
card beside two example FVGs: one scoring well across displacement
quality, confluence, and fill state (labeled "Worth tracking"), and
one scoring poorly across all three (labeled "Technically an FVG —
not worth acting on").

### Worked Example

A large, genuinely displaced FVG forms well above the minimum size
threshold, sits directly beneath a fresh order block, aligns with a
nearby liquidity pool, and remains fully unfilled. This gap scores
well across every factor and is a strong candidate. A different,
technically-valid FVG on the same chart barely meets the minimum size
threshold, has no nearby confluence, and has already been mostly
filled once — a weak candidate despite meeting every formal rule from
C5-01–C5-03.

### Counterexample

A trader tracks every technically-valid FVG on a chart with equal
confidence, including ones that barely meet minimum size, have no
supporting confluence, and are already mostly filled. This produces
the same overtrading-on-noise outcome C3-06 and C4-06 both warned
about, applied here to Fair Value Gaps specifically.

### Good Example / Bad Example

Good: Running a candidate FVG through displacement quality,
confluence, and fill-state checks before deciding it's worth tracking
as an active setup. Bad: Treating every technically-correct FVG as an
equally strong trading candidate regardless of these factors.

### What to Look Out For

- Barely meeting the minimum size threshold (C5-02) is weaker evidence
  than substantially exceeding it.
- An isolated FVG with no confluence (no nearby zone or liquidity
  pool) is weaker than one that stacks multiple pieces of supporting
  evidence.
- A mostly-filled FVG has less remaining genuine imbalance than a
  substantially unfilled one — treat it accordingly.

### Common Mistakes

The recurring mistake this entire "not everything is tradable" thread
(C3-06, C4-06, and now this lesson) exists to prevent is the same one
each time: correct technical identification gets mistaken for trading
quality. They are related but genuinely different judgments, and
conflating them is one of the most common ways a structurally sound
framework produces a low win-rate in practice.

### Key Takeaways

1. A technically-valid FVG can still be a poor trading candidate —
   correct identification and trading quality are different
   judgments.
2. Displacement quality, confluence with other concepts, and current
   fill state are the concrete factors that separate a strong FVG
   from a weak one.
3. This is the same filtering discipline as C3-06 (liquidity pools)
   and C4-06 (zones), now applied to Fair Value Gaps.

### Practice Drill

Given eight FVGs with full context (displacement strength, nearby
confluence, current fill state — provided in Practise), score and
rank each from strongest to weakest candidate.

### Scenario Challenge

You've found a technically-valid FVG that barely meets minimum size,
has no nearby confluence, and is already half-filled. A colleague
wants to trade it with full confidence because "it's a real FVG."
Using this lesson's vocabulary, how would you explain the gap between
"real" and "worth trading"?

### Mini Quiz

Q1 (True/False): Meeting every formal rule from C5-01–C5-03 is
sufficient on its own to make an FVG a strong trading candidate.
Answer: False — displacement quality, confluence, and fill state
still need to be checked; formal validity alone isn't sufficient.

Q2 (Multiple choice): Which factor does NOT belong in this lesson's
FVG-quality checklist?
(a) Displacement quality behind the middle candle
(b) Confluence with nearby zones or liquidity pools
(c) Current fill state
(d) The specific broker used to view the chart

Answer: (d).

### Flashcards

- Front: What three factors determine whether a technically-valid
  FVG is actually worth trading? Back: Displacement quality (how
  strong the middle candle's move was), confluence with other
  concepts, and current fill state.
- Front: What's the recurring mistake this lesson, C3-06, and C4-06
  all warn against? Back: Mistaking correct technical identification
  of a pattern for evidence that it's a high-quality trading
  candidate — they are different, both-necessary judgments.

### Reflection

Across Core 3, 4, and 5, this same "real but not necessarily
tradable" lesson has now appeared three times, for liquidity pools,
zones, and FVGs. Why do you think this curriculum repeats the same
underlying judgment for each new pattern type, rather than teaching it
once?

### Mastery Criteria

Correctly score and rank all eight practice-drill FVGs by quality,
with valid reasoning tied to displacement, confluence, and fill state
for each.

### Spaced Review

Day 1, Day 7, Day 21, Day 30 — this closes Core 5 and is directly
echoed in Core 7's multi-timeframe confluence framework, which
combines this same filtering logic across every zone type taught so
far.

### Bot Connection

Bot 3 (Imbalance Expansion) requires displacement above minimum ATR
size (C5-02) AND a confirming higher-timeframe BOS as combined
conditions before it will fire a signal — precisely this lesson's
"technically valid is not the same as worth trading" principle, made
mechanical in that bot's actual rule set.
