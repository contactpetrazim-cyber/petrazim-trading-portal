# CORE 6 — PREMIUM / DISCOUNT

---

## C6-01 — Dealing Range, External Leg, Equilibrium

**Level:** 2
**Estimated study time:** 14 minutes
**Prerequisites:** C2-01, C2-04
**Learning objectives:** Define a dealing range, identify its external
leg on a real chart, and locate its equilibrium (midpoint).

### Why This Matters

Every remaining lesson in Core 6 depends on being able to draw one
specific range on a chart correctly and find its exact midpoint. This
lesson is entirely about getting that one mechanical skill right,
since C6-02's premium/discount classification is meaningless without
it.

### Core Teaching

**Plain-English explanation.** A dealing range is the price range
price is currently "dealing" within — bounded by a recent, significant
swing high and swing low. The external leg is the specific move that
defines this range: the most recent significant structural swing
connecting those two points (using C2-04's external-structure sense of
"significant," not every minor internal wiggle). Equilibrium is simply
the midpoint of that range — the exact price exactly halfway between
the range's high and low.

**Technical explanation.** Equilibrium is calculated arithmetically:
(range high + range low) / 2. Which specific swing high and swing low
define the "current" dealing range is a judgment call anchored in
C2-04's external structure — typically the most recent leg between two
significant (external-scale) swing points, re-anchored as new
structure forms. As with C2-05's "protected point" concept, the
relevant dealing range is not a fixed, permanent range — it updates as
new external swing points confirm, the same way the protected
high/low updates as new structure forms.

### Visual Model

See diagram: `visuals/c6-01-dealing-range.svg` — a chart showing a
clear external leg from a significant swing low to a significant swing
high, the full range shaded, with a dashed horizontal line drawn
exactly at the midpoint labeled "Equilibrium (50%)."

### Worked Example

A significant external leg runs from a swing low at 1.0800 to a swing
high at 1.1000. The dealing range is 1.0800–1.1000, 200 points wide.
Equilibrium is (1.0800 + 1.1000) / 2 = 1.0900 — exactly the midpoint.

### Counterexample

A trader draws a dealing range using two arbitrary, minor internal
swing points (C2-04) rather than a genuinely significant external
leg, producing a range that shifts unstably every time a small new
internal wiggle forms. Anchoring the range to external-scale structure
specifically is what keeps this range meaningful and reasonably
stable.

### Good Example / Bad Example

Good: Anchoring the dealing range to the most recent significant
external leg (C2-04), and recalculating equilibrium precisely as the
arithmetic midpoint. Bad: Eyeballing "roughly the middle" of a chart
without calculating equilibrium precisely, or anchoring the range to
minor internal swings that shift constantly.

### What to Look Out For

- Equilibrium is an exact arithmetic midpoint, not an eyeballed
  approximation.
- The dealing range should be anchored to significant, external-scale
  structure (C2-04) — not every minor internal swing.
- The relevant dealing range updates as new significant structure
  forms, the same way C2-05's protected point does.

### Common Mistakes

A common error is eyeballing "the middle" of a chart by feel rather
than calculating equilibrium precisely from the range's actual high
and low. Even a small error in equilibrium placement can meaningfully
change whether a given price counts as premium or discount (C6-02).

### Key Takeaways

1. A dealing range is bounded by a significant external leg's swing
   high and swing low.
2. Equilibrium is the exact arithmetic midpoint: (high + low) / 2.
3. The relevant dealing range updates as new significant external
   structure forms — it isn't fixed forever.

### Practice Drill

Given six charts with a clearly marked external leg each (provided in
Practise), calculate the exact equilibrium price for each dealing
range.

### Scenario Challenge

A new, more significant external swing high just formed, extending
beyond the previous dealing range's boundary. What should you do to
the dealing range and its equilibrium in response?

### Mini Quiz

Q1 (True/False): Equilibrium can be reasonably estimated by eye rather
than calculated exactly.
Answer: False — it should be calculated precisely as (range high +
range low) / 2.

Q2 (Multiple choice): What anchors a dealing range's boundaries?
(a) Any two nearby candles
(b) A significant, external-scale swing high and swing low (C2-04)
(c) The current time of day
(d) The instrument's average daily range

Answer: (b).

### Flashcards

- Front: What is equilibrium? Back: The exact arithmetic midpoint of
  a dealing range: (range high + range low) / 2.
- Front: What defines a dealing range's boundaries? Back: A
  significant external-scale leg (C2-04) connecting a swing high and
  swing low.

### Mastery Criteria

Correctly calculate equilibrium for all six practice-drill dealing
ranges.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — this exact calculation is the direct
prerequisite for C6-02's premium/discount classification, immediately
next.

### Bot Connection

Every bot's location-filtering logic (preferring long entries in
discount, short entries in premium — formalized in C6-02) depends on
this lesson's exact equilibrium calculation being correct first.

---

## C6-02 — Premium and Discount, Long/Short Location

**Level:** 2
**Estimated study time:** 14 minutes
**Prerequisites:** C6-01
**Learning objectives:** Classify a given price as premium or discount
relative to a dealing range, and explain why location within the
range affects preferred trade direction.

### Why This Matters

Premium and discount give you a specific, checkable answer to a
question traders ask constantly and usually answer only by feel: "is
this price expensive or cheap right now, relative to what it's been
doing?" This lesson turns that vague feeling into an exact calculation
built directly on C6-01's equilibrium.

### Core Teaching

**Plain-English explanation.** Premium is the upper half of the
dealing range — above equilibrium. Discount is the lower half — below
equilibrium. The general expectation this framework uses: look for
LONG entries when price is in discount (buying at a relatively "cheap"
price within the current range) and look for SHORT entries when price
is in premium (selling at a relatively "expensive" price within the
current range). This doesn't mean every discount price is automatically
a buy or every premium price automatically a sell — it's a location
filter, meant to be combined with the actual setup evidence (structure,
liquidity, zones) taught in Core 2–5, not a standalone signal.

**Technical explanation.** Classification is a direct comparison: any
price above equilibrium (C6-01's midpoint) is in premium; any price
below it is in discount. The reasoning behind preferring longs in
discount and shorts in premium is about reward-to-risk geometry within
the current range: a long entered in discount has more of the range's
own width available as potential upside room before hitting the range
high, and a tighter, more localized area behind it for a stop; the
mirror applies to a short entered in premium. This is a LOCATION
filter — it says nothing on its own about whether a genuine setup
(a valid zone, liquidity sweep, or structural signal from Core 2–5) is
actually present at that price; it's meant to be combined with those,
not substituted for them.

### Visual Model

See diagram: `visuals/c6-02-premium-discount.svg` — a dealing range
shaded in two halves: the upper half labeled "Premium — look for
shorts here" and the lower half labeled "Discount — look for longs
here," with equilibrium marked as the dividing line between them.

### Worked Example

A dealing range runs from 1.0800 to 1.1000, with equilibrium at
1.0900 (from C6-01's worked example). Price is currently trading at
1.0850 — below equilibrium, in discount. Per this lesson's location
preference, a long setup at this price would have more favorable
range-based reward-to-risk geometry than the same setup taken at
1.0980 (deep in premium).

### Counterexample

A trader sees price in discount and enters long purely on that basis,
with no actual structural setup (no valid zone, no confirmed sweep, no
supporting evidence from Core 2–5) — treating premium/discount as a
standalone signal rather than a location filter layered on top of a
real setup. Being in discount doesn't manufacture a valid trade out of
nothing.

### Good Example / Bad Example

Good: Using premium/discount as one additional filter alongside an
actual setup (a valid zone, a confirmed sweep, aligned structure) —
preferring the setup when its direction agrees with the location. Bad:
Treating "price is in discount" or "price is in premium" as a
sufficient reason to enter a trade on its own.

### What to Look Out For

- Discount favors longs, premium favors shorts — as a LOCATION
  preference, not a standalone entry signal.
- A price exactly AT equilibrium is a boundary case with no strong
  location preference either way.
- This filter should combine with, not replace, the actual setup
  evidence taught throughout Core 2–5.

### Common Mistakes

A frequent, costly beginner mistake is entering trades based solely on
"price is in discount, so I'll buy" or "price is in premium, so I'll
sell," without any other confirming evidence. Premium/discount is
explicitly a filter to be combined with real setups — treating it as
a standalone trigger is a direct path to low-quality, unconfirmed
entries.

### Key Takeaways

1. Premium is the upper half of the dealing range (above equilibrium);
   discount is the lower half (below it).
2. The general preference is longs in discount, shorts in premium —
   for range-based reward-to-risk reasons.
3. Premium/discount is a location filter, meant to combine with real
   setup evidence (Core 2–5) — not a standalone trading signal.

### Practice Drill

Given ten price points across five dealing ranges (provided in
Practise), classify each as premium or discount, and state the
preferred direction bias for each.

### Scenario Challenge

Price is currently deep in premium, and a colleague wants to buy
purely because "the trend is up." Using this lesson's vocabulary, what
would you point out about entering a long from this specific location?

### Mini Quiz

Q1 (True/False): Being in discount is, by itself, a sufficient reason
to enter a long trade.
Answer: False — it's a location filter meant to combine with actual
setup evidence, not a standalone signal.

Q2 (Multiple choice): What does "discount" mean in this framework?
(a) A discount code for a broker
(b) The lower half of the current dealing range, below equilibrium
(c) Any price below the instrument's all-time low
(d) A specific candlestick pattern

Answer: (b).

### Flashcards

- Front: What's the general location preference for longs vs.
  shorts? Back: Longs are generally preferred in discount (below
  equilibrium); shorts in premium (above equilibrium).
- Front: Is premium/discount a standalone trading signal? Back: No —
  it's a location filter meant to combine with real setup evidence
  from Core 2–5, not replace it.

### Reflection

Have you ever entered a trade mainly because a price "felt cheap" or
"felt expensive," without other confirming evidence? How does this
lesson's exact equilibrium-based definition compare to that feeling?

### Mastery Criteria

Correctly classify all ten practice-drill price points as premium or
discount, with the correct location bias stated for each.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this location filter is combined
explicitly with structure, liquidity, and zone confluence in Core 7's
multi-timeframe framework.

### Bot Connection

Multiple bots weight a candidate setup's confidence higher when its
direction agrees with the current premium/discount location — a long
setup found in discount scores higher than the identical setup found
in premium, all else equal.

---

## C6-03 — Multiple Dealing Ranges, Interaction With Liquidity/Zones

**Level:** 2
**Estimated study time:** 13 minutes
**Prerequisites:** C6-01, C6-02, C2-04
**Learning objectives:** Explain how dealing ranges exist at multiple
scales simultaneously, and combine premium/discount location with
liquidity and zone confluence from Core 3–4.

### Why This Matters

C2-04 already established that structure exists at multiple nested
scales (internal vs. external); dealing ranges work the same way, and
missing this means confidently classifying a price as "discount"
using one scale while a different, equally valid scale would classify
the exact same price as "premium." This lesson also connects
premium/discount back to the liquidity and zone concepts from Core 3–4,
which is where its practical trading power actually comes from.

### Core Teaching

**Plain-English explanation.** Just as Core 2 has internal and
external structure at different scales, dealing ranges exist at
multiple scales simultaneously — a 4H dealing range and a 15-minute
dealing range covering the same period will generally have different
boundaries and different equilibriums, since each is anchored to
significant structure AT ITS OWN SCALE. A single price can be in
discount relative to the larger 4H range while simultaneously being in
premium relative to a smaller, more recent 15-minute range nested
inside it. This lesson's second half connects location back to Core
3–4: the strongest setups combine favorable premium/discount location
WITH a genuine liquidity pool or zone at that same price — location
alone, or a zone alone, is weaker evidence than the two lining up
together.

**Technical explanation.** Because each scale's dealing range is
anchored to that scale's own significant structure (C2-04), there's no
contradiction in a price being discount on one scale and premium on
another — these are simply two different, both-valid measurements
using different reference ranges, the same way C2-04 resolved the
apparent tension between internal and external structure readings.
Practically, the highest-confidence setups (echoing C4-06's confluence
principle) combine THREE things at the same price: favorable
premium/discount location (this lesson), a genuine liquidity pool
nearby (Core 3), and a valid, reasonably fresh zone (Core 4) — three
independent lines of evidence agreeing, rather than any single one
alone.

### Visual Model

See diagram: `visuals/c6-03-nested-ranges-confluence.svg` — two
overlapping dealing ranges (a wide 4H range and a narrower nested
15-minute range) shown on the same chart, with a single price point
marked as "Discount on 4H, Premium on 15m — check which scale your
setup is actually built on," alongside a second panel showing a price
where discount location, a liquidity pool, and a valid zone all align
at once, labeled "High-confluence setup — three independent factors
agreeing."

### Worked Example

A 4H dealing range puts current price in discount, favoring longs on
that scale. The same price, measured against a smaller, more recent
15-minute dealing range, sits in premium on that scale. Neither
measurement is wrong — they're two different, both-valid readings at
different scales, the same way C2-04 resolved internal vs. external
structure. The trader needs to be explicit about which scale their
actual setup is built on before acting on either reading.

### Counterexample

A trader checks only a 15-minute dealing range, ignoring that the
higher-timeframe 4H range would classify the same price completely
differently, and acts as though only one dealing range exists at any
given moment. This misses exactly the kind of multi-scale conflict
Core 7's multi-timeframe framework will formalize.

### Good Example / Bad Example

Good: Explicitly checking premium/discount at the scale relevant to
the setup being considered, and looking for confluence with a
liquidity pool and a valid zone at that same price. Bad: Checking only
one arbitrary scale's dealing range and ignoring that other valid
scales might classify the same price differently.

### What to Look Out For

- Dealing ranges exist at multiple scales simultaneously — there's no
  single "correct" one, the same way Core 2's structure exists at
  multiple scales.
- Being explicit about WHICH scale's dealing range a given
  premium/discount read is based on prevents genuine confusion.
- The strongest setups combine favorable location with a real
  liquidity pool AND a valid zone at the same price — not any one
  factor alone.

### Common Mistakes

A common error is treating premium/discount as if only one dealing
range could exist on a chart at a time, then being confused when a
different timeframe's range gives an apparently contradictory
classification. Both readings are correct at their own scale — the
mistake is not tracking which scale is actually relevant to the setup.

### Key Takeaways

1. Dealing ranges, like structure itself (C2-04), exist at multiple
   scales simultaneously — the same price can be discount on one
   scale and premium on another.
2. Being explicit about which scale's range a given classification is
   based on prevents genuine confusion, not contradiction.
3. The strongest setups combine favorable location, a genuine
   liquidity pool, and a valid zone at the same price — three
   independent factors, not any one alone.

### Practice Drill

Given four charts each showing two nested dealing ranges (provided in
Practise), classify a marked price against both ranges and note where
the readings agree versus conflict.

### Scenario Challenge

A price sits in discount on the 4H dealing range, near a fresh order
block (Core 4), with sell-side liquidity resting just below it (Core
3). Using this lesson's vocabulary, how would you describe the
strength of this setup compared to a discount-location price with
neither the zone nor the liquidity present?

### Mini Quiz

Q1 (True/False): A price can only be classified relative to one
"correct" dealing range at a time.
Answer: False — dealing ranges exist at multiple scales
simultaneously, the same way structure does (C2-04); a price can be
discount on one scale and premium on another, both validly.

Q2 (Multiple choice): What makes the strongest Core 6 setups, per this
lesson?
(a) Premium/discount location alone
(b) Favorable location combined with a genuine liquidity pool and a
    valid zone at the same price
(c) Any dealing range, regardless of scale
(d) A single candle's color

Answer: (b).

### Flashcards

- Front: Can a single price be in discount on one dealing range and
  premium on another? Back: Yes — dealing ranges exist at multiple
  scales simultaneously, the same way Core 2's structure does; both
  readings can be valid at their own scale.
- Front: What makes the highest-confidence Core 6 setup? Back:
  Favorable premium/discount location combined with a genuine
  liquidity pool (Core 3) and a valid zone (Core 4) all agreeing at
  the same price.

### Mastery Criteria

Correctly classify the marked price against both nested ranges in all
four practice-drill charts, and correctly identify where the two
scales' readings agree versus conflict.

### Spaced Review

Day 1, Day 7, Day 21, Day 30 — this multi-scale principle is
formalized fully in Core 7's five-layer timeframe stack, immediately
next.

### Bot Connection

Every bot's confluence scoring combines premium/discount location
with liquidity and zone evidence at the specific timeframe that bot's
own setup rules are defined on — this lesson is the conceptual basis
for why that combination, not any single factor, drives each bot's
signal confidence.
