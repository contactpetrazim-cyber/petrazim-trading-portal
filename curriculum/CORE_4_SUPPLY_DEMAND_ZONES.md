# CORE 4 — SUPPLY, DEMAND & ZONES

---

## C4-01 — Supply and Demand, Origin of Displacement

**Level:** 2
**Estimated study time:** 15 minutes
**Prerequisites:** C2-08, C3-04
**Learning objectives:** Explain supply and demand imbalance in terms
of the candles immediately preceding a displacement move, and locate
the "origin" of a displaced move on a real chart.

### Why This Matters

Every zone concept from here through the rest of Core 4 (order blocks,
breaker blocks, mitigation blocks) is a specific, named variant of one
underlying idea: marking the ORIGIN of a strong move, not the move
itself. Getting this origin-vs-move distinction solid here is what
keeps the rest of Core 4's vocabulary from blurring together.

### Core Teaching

**Plain-English explanation.** Supply and demand, in this framework's
specific sense, describes an imbalance between aggressive buyers and
sellers concentrated in a small handful of candles, strong enough to
produce a displaced move (C2-08) away from that area. The candles
immediately before the displacement began are the "origin" — the last
area where the OTHER side (sellers, before a bullish displacement; buyers,
before a bearish one) was still meaningfully present before being
overwhelmed. Everything Core 4 builds from here is really just
different, more specific names for zones drawn around this origin
area.

**Technical explanation.** Displacement (C2-08) is the observable
EFFECT — a real, measurable, large-range move with strong close-
location value. The origin is the CAUSE side of that same event: the
specific candle(s) immediately preceding the displacement, where the
imbalance that produced the move actually began. Marking this origin
area as a zone rests on a specific, testable expectation: that a
meaningful imbalance which caused a real displacement once is more
likely than an arbitrary area to produce a reaction again if price
returns to it later — this is the origin-zone hypothesis, and Core 4's
later lessons (freshness, C4-04; quality, C4-06) are all about how
much to actually trust that expectation in a given case.

### Visual Model

See diagram: `visuals/c4-01-origin-of-displacement.svg` — a chart
showing a strong bullish displacement move (several large-range green
candles), with the single small candle immediately before the
displacement began highlighted and labeled "Origin — where the
imbalance began, not the move itself."

### Worked Example

A chart shows three small, unremarkable candles, followed immediately
by four large-range bullish candles closing near their highs (genuine
displacement, per C2-08). The origin of this move is the LAST of the
three small candles before the displacement began — not the first
large green candle, and not the whole three-candle cluster.

### Counterexample

A trader marks the entire multi-candle displacement move itself as
"the zone," rather than the small origin area immediately preceding
it. This conflates the cause (the origin, where the imbalance began)
with the effect (the displacement, the move that resulted) — precisely
the distinction this lesson exists to prevent.

### Good Example / Bad Example

Good: Identifying the specific candle(s) immediately before a
displacement began as the origin, and marking a zone there
specifically. Bad: Marking a broad zone spanning the entire displaced
move, treating the whole thing as one undifferentiated "supply/demand
area."

### What to Look Out For

- The origin is the candle(s) BEFORE the displacement, not the
  displacement itself.
- "Supply/demand imbalance" is a claim about buying/selling pressure
  concentrated in a small area, not a claim about who specifically
  caused it.
- Not every small candle before a move is a meaningful origin — this
  requires genuine displacement (C2-08) to have followed it; a small
  candle before an unremarkable, undisplaced move isn't a supply/
  demand origin in this framework's sense.

### Common Mistakes

Beginners frequently mark large, sprawling zones covering an entire
multi-candle move, rather than the tight origin area immediately
preceding it. A zone that's too wide loses the precision that makes
it useful later for entries (Core 4's later lessons, and Bot 2's own
setup rules, depend on a tightly-drawn origin).

### Key Takeaways

1. The origin is the candle(s) immediately BEFORE a displacement move
   began — the cause, not the effect.
2. Marking the whole displaced move as "the zone" conflates cause and
   effect.
3. A meaningful origin requires genuine displacement (C2-08) to have
   actually followed it.

### Practice Drill

Given eight displaced moves across four charts (provided in
Practise), mark the specific origin candle(s) for each, distinguishing
them from the displacement itself.

### Scenario Challenge

You see a large green displacement move on a chart. A colleague draws
a zone around the entire move and calls it "the demand zone." Using
this lesson's vocabulary, what's the more precise way to identify
where the actual zone should be drawn?

### Mini Quiz

Q1 (True/False): The zone should be drawn around the entire displaced
move, not just the candles immediately preceding it.
Answer: False — the origin is specifically the candle(s) before the
displacement began, not the move itself.

Q2 (Multiple choice): What makes a small candle before a move a
meaningful "origin" in this framework's sense?
(a) Its color
(b) Genuine displacement (C2-08) actually following it
(c) Its exact size relative to nearby candles
(d) Nothing — every small candle before any move qualifies

Answer: (b).

### Flashcards

- Front: What is the "origin" of a displaced move? Back: The
  candle(s) immediately BEFORE the displacement began — where the
  imbalance that caused the move actually started, not the move
  itself.
- Front: What does marking the entire displaced move as "the zone"
  get wrong? Back: It conflates the cause (the origin) with the
  effect (the displacement) — the useful zone is the tighter origin
  area, not the whole move.

### Reflection

Have you ever marked a wide zone around an entire strong move, rather
than the tight origin area before it began? What would the tighter
version have looked like?

### Mastery Criteria

Correctly mark the origin candle(s), distinct from the displacement
itself, for all eight practice-drill examples.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — this origin concept is the literal basis
for every zone type defined in the rest of Core 4.

### Bot Connection

Bot 2 (Order Block Reversal) is built entirely around trading
reactions at exactly this kind of origin zone — this lesson is the
conceptual foundation the rest of that bot's mastery track builds on.

---

## C4-02 — Order Blocks: Bullish and Bearish

**Level:** 2
**Estimated study time:** 15 minutes
**Prerequisites:** C4-01
**Learning objectives:** Define a bullish and bearish order block
precisely in terms of C4-01's origin concept, and correctly identify
both types on a real chart.

### Why This Matters

"Order block" is the single most commonly used zone term in SMC
content, and it's simply C4-01's origin concept given a specific,
standard name and a precise candle-color rule. Getting the exact rule
right here prevents the common error of mislabeling ordinary candles
as order blocks.

### Core Teaching

**Plain-English explanation.** A bullish order block is the origin
(C4-01) of a bullish displacement — specifically, the LAST BEARISH
(down-close) candle immediately before a genuine bullish displacement
move begins. A bearish order block is the mirror: the LAST BULLISH
(up-close) candle immediately before a genuine bearish displacement
move begins. The color rule matters precisely because it captures
C4-01's cause-and-effect logic in a checkable way: the last candle
still favoring the OTHER side, right before that side gets
overwhelmed, is exactly where the imbalance is expected to have
originated.

**Technical explanation.** Formally: scanning backward from a
confirmed displacement move (C2-08), a bullish order block is the most
recent candle with a close below its open (a down-close candle)
immediately preceding the first candle of the bullish displacement. A
bearish order block is the most recent up-close candle immediately
preceding a bearish displacement's first candle. This is a strict,
checkable rule — not every small candle before a move qualifies, only
the specific LAST candle of the opposing color. Some frameworks allow
a short run of same-color candles just before the qualifying
opposite-color candle to be included in the zone's range; this course
keeps to the single strict last-opposite-candle definition as the
baseline, since it's the most consistently checkable version across
different sources.

### Visual Model

See diagram: `visuals/c4-02-order-blocks.svg` — two panels. Left: a
red (bearish) candle immediately followed by a strong green
displacement move, the red candle highlighted and labeled "Bullish
Order Block." Right: a green (bullish) candle immediately followed by
a strong red displacement move, the green candle highlighted and
labeled "Bearish Order Block."

### Worked Example

Price shows a red, down-close candle, immediately followed by three
large-range green candles closing near their highs (confirmed bullish
displacement). That single red candle is the bullish order block —
the last candle where sellers were still in control before buyers
overwhelmed them.

### Counterexample

A trader marks a GREEN candle sitting two candles before a bullish
displacement move as "the bullish order block," skipping past a red
candle that sits directly adjacent to the displacement's start. The
rule specifically requires the LAST opposite-color candle immediately
before displacement begins — not just any nearby candle of the
"wrong" expected color.

### Good Example / Bad Example

Good: Scanning backward from a confirmed displacement move and
identifying the single, most recent opposite-color candle as the
order block. Bad: Marking whichever candle "looks like" a good zone
by eye, without applying the specific last-opposite-color-candle rule.

### What to Look Out For

- The rule is about the LAST opposite-color candle, not any nearby
  one — precision here matters for consistency.
- An order block requires genuine displacement (C2-08) to follow it —
  a random down-close candle before an ordinary, undisplaced move is
  not a bullish order block.
- "Bullish" and "bearish" describe the direction of the displacement
  that follows, not the color of the order-block candle itself (which
  is always the OPPOSITE color).

### Common Mistakes

A very common beginner mix-up is calling the wrong-colored candle the
order block — for instance, marking a green candle as a "bullish
order block." The naming refers to the direction of the move that
FOLLOWS, while the candle itself is always the opposite color of that
direction — this inversion is one of the most common vocabulary
errors in this entire curriculum.

### Key Takeaways

1. A bullish order block is the last BEARISH candle before a
   confirmed bullish displacement; a bearish order block is the last
   BULLISH candle before a confirmed bearish displacement.
2. The naming describes the direction of the displacement that
   follows, not the candle's own color.
3. Genuine displacement (C2-08) confirming afterward is required —
   not every opposite-color candle before an ordinary move qualifies.

### Practice Drill

Given ten displacement moves across five charts (provided in
Practise), identify and correctly label the order block (bullish or
bearish) for each.

### Scenario Challenge

You see a green candle immediately followed by a strong bearish
displacement move. Using this lesson's rule, is that green candle the
order block? What would you call it, and why?

### Mini Quiz

Q1 (True/False): A bullish order block candle is itself a bullish
(green, up-close) candle.
Answer: False — a bullish order block is the last BEARISH (down-
close) candle before the bullish displacement; the naming describes
the move that follows, not the candle's own color.

Q2 (Multiple choice): What's required, beyond finding an opposite-
color candle, for it to qualify as a valid order block?
(a) Nothing else is required
(b) Genuine displacement (C2-08) must follow it
(c) It must be at least three days old
(d) It must occur during the London session

Answer: (b).

### Flashcards

- Front: What defines a bullish order block? Back: The last bearish
  (down-close) candle immediately before a confirmed bullish
  displacement move begins.
- Front: What defines a bearish order block? Back: The last bullish
  (up-close) candle immediately before a confirmed bearish
  displacement move begins.

### Reflection

Before this lesson, would you have correctly named the candle color
for a "bullish order block"? Write one sentence explaining the naming
logic in your own words.

### Mastery Criteria

Correctly identify and label all ten practice-drill order blocks
(bullish or bearish) using the exact last-opposite-candle rule.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — order blocks are Bot 2's central
setup concept; this vocabulary needs strong long-term retention.

### Bot Connection

Bot 2 (Order Block Reversal) requires a fresh or lightly-mitigated
order block, using exactly this last-opposite-candle definition, as
the anchor zone its entire setup logic is built around.

---

## C4-03 — Breaker Blocks and Mitigation Blocks

**Level:** 2
**Estimated study time:** 15 minutes
**Prerequisites:** C4-02, C2-06, C2-07
**Learning objectives:** Define a breaker block and a mitigation
block, distinguish them from an ordinary order block and from each
other, and explain the structural event that turns an order block into
a breaker.

### Why This Matters

Order blocks (C4-02) don't always hold — sometimes price closes
straight through one, invalidating it in its original role. What
happens to that broken zone afterward has its own name and its own
logic, and confusing "the zone failed, so it's worthless" with "the
zone failed, so it may now work in the OPPOSITE direction" is exactly
the gap this lesson closes.

### Core Teaching

**Plain-English explanation.** A breaker block is what a broken order
block can become: when price closes fully through an order block
(invalidating it in its original role, per C2-09's invalidation
concept), that same zone sometimes gets respected again later — but
now acting as support/resistance in the OPPOSITE direction from its
original role. A mitigation block is a related but distinct idea: a
zone price returns to specifically to "mitigate" — fill or rebalance —
unfilled orders left behind at the origin candle, without necessarily
implying the same directional flip a breaker does.

**Technical explanation.** The breaker sequence specifically requires:
(1) a valid order block forms (C4-02), (2) price later closes fully
through it (a confirmed break per C2-06/C2-08's close-based standard,
not just a wick), invalidating its original role, and (3) price
returns to that same zone later and reacts in the OPPOSITE direction
from the block's original bias — a former bullish order block, once
broken, can become a bearish breaker (resistance instead of support).
Mitigation is a softer, more general concept: any return to an origin
zone to fill resting orders left over from its formation, which can
happen to a zone that's still intact in its ORIGINAL role (a partial
mitigation, covered formally as a zone STATE in C4-04) as well as to a
zone that's already broken. Practically: every breaker is (in a loose
sense) mitigating leftover orders from the original zone, but not
every mitigation event is a full directional-flip breaker.

### Visual Model

See diagram: `visuals/c4-03-breaker-block.svg` — a three-stage
sequence: (1) a bullish order block forms and initially holds as
support; (2) price later closes fully through it (invalidated, per
C2-09); (3) price returns to the same zone and gets rejected DOWNWARD
this time — labeled "Breaker Block — same zone, opposite role now."

### Worked Example

A bullish order block forms and holds as support on its first retest.
Weeks later, price closes decisively below it — the order block is
now invalidated in its original bullish role. Price later rallies back
up into that same zone and is rejected downward — the zone has become
a bearish breaker block, now acting as resistance instead of the
support it once was.

### Counterexample

A trader sees an order block get closed through and immediately
discards it from their analysis entirely, missing that the same zone
later caused a clean reaction in the opposite direction. Treating a
broken order block as simply "gone" skips the specific, testable
breaker-block hypothesis this lesson describes.

### Good Example / Bad Example

Good: Tracking a broken order block's zone as a potential breaker in
the opposite direction, rather than discarding it once broken. Bad:
Assuming a broken zone has no further relevance to price at all once
its original role has failed.

### What to Look Out For

- A breaker requires the ORIGINAL zone to have been genuinely
  invalidated first (a real close-through, per C2-09) — not just a
  wick poking through it.
- The directional flip is the defining feature: a breaker acts
  opposite to the original order block's role, not the same way.
- Not every broken zone becomes a clean breaker — this is a real,
  testable pattern, not a guarantee that every failed zone will react
  again.

### Common Mistakes

A common error is treating "mitigation" and "breaker" as interchangeable
terms. Mitigation is the more general concept (filling leftover
resting orders from an origin zone); a breaker specifically requires
the zone to have been invalidated first AND to then react in the
opposite direction — a meaningfully narrower, more specific claim.

### Key Takeaways

1. A breaker block is a broken order block that later reacts in the
   OPPOSITE direction from its original role.
2. Mitigation is the broader concept of price returning to fill
   leftover orders at an origin zone — it doesn't require the
   directional flip a breaker does.
3. A breaker requires genuine invalidation (a real close-through)
   first — not a wick.

### Practice Drill

Given six broken-zone examples across three charts (provided in
Practise), identify which show a clean breaker-block reaction and
which show the zone simply being invalidated with no further reaction.

### Scenario Challenge

An order block gets closed through and price later returns to that
same zone. Using this lesson's vocabulary, what specific outcome would
confirm this is a genuine breaker rather than just an irrelevant,
already-broken zone?

### Mini Quiz

Q1 (True/False): A breaker block acts the same direction as the
original order block did.
Answer: False — a breaker specifically acts in the OPPOSITE direction
from the original zone's role.

Q2 (Multiple choice): What's required before a broken order block can
be considered a breaker?
(a) Nothing — any broken order block is automatically a breaker
(b) A genuine, close-confirmed invalidation of the original zone
    first
(c) The zone must be at least a month old
(d) The zone must be on a Daily chart

Answer: (b).

### Flashcards

- Front: What is a breaker block? Back: A broken order block that
  later reacts in the opposite direction from its original role —
  support-turned-resistance or resistance-turned-support.
- Front: How does mitigation differ from a breaker? Back: Mitigation
  is the broader concept of price filling leftover orders at an
  origin zone; a breaker specifically requires the zone to have been
  invalidated first and then flip direction.

### Reflection

Have you ever discarded a broken zone from your analysis entirely,
only to see price react there again later? What would tracking it as
a potential breaker have told you?

### Mastery Criteria

Correctly classify all six practice-drill examples as genuine breaker
reactions versus zones that were simply invalidated with no further
reaction.

### Spaced Review

Day 1, Day 7, Day 14, Day 30 — this concept directly feeds C4-04's
zone-state vocabulary (mitigated vs. invalid) immediately next.

### Bot Connection

Bot 2 (Order Block Reversal) explicitly checks whether a candidate
zone is a fresh order block or a breaker, since the setup confidence
and expected reaction direction differ between the two.

---

## C4-04 — Fresh / Tested / Mitigated / Invalid Zones

**Level:** 2
**Estimated study time:** 14 minutes
**Prerequisites:** C4-02, C4-03
**Learning objectives:** Define the four zone-lifecycle states
precisely and correctly classify a given zone's current state from
its price-interaction history.

### Why This Matters

Every zone this course has covered so far exists somewhere along a
lifecycle — from never-touched to fully invalidated — and treating a
zone in one state with the same confidence as a zone in another is a
direct, avoidable source of low-quality setups. This lesson gives you
the four-state vocabulary to track that lifecycle explicitly.

### Core Teaching

**Plain-English explanation.** A zone moves through up to four
states over its lifetime: Fresh (never touched by price since it
formed — the highest-confidence state, since none of its original
resting liquidity has been used up), Tested (price has returned once
and reacted, holding the zone's role — still valid, but no longer
untouched), Mitigated (price has returned and traded well INTO the
zone, using up a meaningful portion of it, without fully closing
through — weaker than tested, since much of the original imbalance
has likely already been absorbed), and Invalid (price has closed
fully through the zone, per C2-09's invalidation standard — the zone
no longer functions in its original role, though C4-03's breaker
concept means it may still matter in the opposite direction).

**Technical explanation.** These four states form a rough, generally
one-directional lifecycle (a zone doesn't typically move backward from
Mitigated to Fresh), though a zone can occasionally skip states — a
sufficiently violent single return can move a zone straight from Fresh
to Invalid without a clean Tested phase in between. The practical
reason this matters: expected reaction strength and reliability
generally decrease as a zone moves along this lifecycle, since each
touch draws down some of the original resting-order imbalance that
made the zone meaningful in the first place (the same underlying logic
as C3-06's pool-freshness factor, applied here to zones instead of
liquidity pools).

### Visual Model

See diagram: `visuals/c4-04-zone-lifecycle.svg` — a horizontal
lifecycle bar with four labeled stages (Fresh -> Tested -> Mitigated
-> Invalid), each with a small chart thumbnail showing what that
state looks like, and an arrow showing confidence/expected-reaction
strength decreasing left to right.

### Worked Example

A bullish order block forms and has never been touched since — it's
currently Fresh. Price later returns, holds right at the top of the
zone, and reverses back up — the zone is now Tested, having survived
its first real interaction. Weeks later, price returns again and trades
deep into the zone before finally reversing — the zone is now
Mitigated, having used up much of its original imbalance even though
it technically still held.

### Counterexample

A trader treats a zone that's already been deeply mitigated with the
same confidence as a completely fresh, untouched zone, because both
technically "still count" as valid order blocks. This ignores the real
difference in expected reaction strength this lesson's lifecycle
describes.

### Good Example / Bad Example

Good: Explicitly tracking and stating a zone's current lifecycle state
before weighting how much confidence to place in a reaction there.
Bad: Treating every zone that hasn't been fully invalidated as
equally strong, regardless of how many times it's already been
touched or how deep price has already traded into it.

### What to Look Out For

- Fresh zones generally carry more confidence than tested ones; tested
  more than mitigated; mitigated zones still function but more weakly
  than either.
- A single violent return can sometimes skip straight from Fresh to
  Invalid — the lifecycle is generally one-directional, but not
  strictly step-by-step every time.
- Invalid doesn't necessarily mean irrelevant — recall C4-03's breaker
  concept, where an invalidated zone can still matter in the opposite
  direction.

### Common Mistakes

A common beginner mistake is binary thinking — treating every zone as
either simply "valid" or "invalid," collapsing the real, meaningful
difference between fresh, tested, and mitigated into one undifferentiated
"still valid" bucket. This lesson's whole point is that those three
states carry genuinely different confidence levels.

### Key Takeaways

1. Zones move through four lifecycle states: Fresh, Tested, Mitigated,
   Invalid — each carrying different confidence.
2. Expected reaction strength generally decreases as a zone moves
   through this lifecycle, since each touch uses up original resting
   liquidity.
3. Invalid doesn't mean irrelevant — an invalidated zone may still
   matter as a breaker (C4-03) in the opposite direction.

### Practice Drill

Given a zone's full price-interaction history across eight examples
(provided in Practise), classify each zone's CURRENT lifecycle state
(Fresh, Tested, Mitigated, or Invalid).

### Scenario Challenge

A zone has been touched twice already, each time with price trading
moderately into it before reversing. Using this lesson's vocabulary,
what state is it in now, and how should your confidence in a third
reaction compare to your confidence in the first?

### Mini Quiz

Q1 (True/False): A zone that has been touched and held once carries
the same confidence as a completely untouched, fresh zone.
Answer: False — a Tested zone has used up some of its original
resting liquidity and generally carries somewhat less confidence than
a Fresh one, though it remains meaningfully valid.

Q2 (Multiple choice): What generally happens to expected reaction
strength as a zone moves from Fresh toward Mitigated?
(a) It generally increases
(b) It generally decreases, as original resting liquidity gets used up
(c) It stays exactly the same
(d) The lifecycle has no relationship to reaction strength

Answer: (b).

### Flashcards

- Front: What are the four zone lifecycle states, in order? Back:
  Fresh (untouched), Tested (touched once, held), Mitigated (traded
  deep into, still held), Invalid (closed fully through).
- Front: Why does expected reaction strength generally decrease along
  this lifecycle? Back: Each touch uses up some of the zone's
  original resting-order imbalance that made it meaningful in the
  first place.

### Reflection

Have you ever treated a heavily-mitigated zone with the same
confidence as a fresh one? What would explicitly tracking its
lifecycle state have told you?

### Mastery Criteria

Correctly classify all eight practice-drill zones into their current
lifecycle state, with the specific price interaction supporting each
classification.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this lifecycle vocabulary is
used explicitly and by name in Bot 2's own setup confidence scoring.

### Bot Connection

Bot 2 (Order Block Reversal) requires a "fresh or lightly-mitigated"
zone as an explicit setup condition — this lesson's exact vocabulary
is what that requirement is written in.

---

## C4-05 — Zone Boundaries: Body vs. Full-Range vs. Wick-Inclusive

**Level:** 2
**Estimated study time:** 13 minutes
**Prerequisites:** C4-02
**Learning objectives:** Compare the three common conventions for
drawing a zone's price boundaries, and explain the tradeoff each one
makes.

### Why This Matters

Two traders can agree completely on WHICH candle is the order block
and still draw meaningfully different zone boundaries, because there's
more than one accepted convention for exactly where a zone's edges
sit. Knowing these conventions exist — and picking one deliberately —
prevents the confusion of comparing your own zone marks against
someone else's without realizing you're using different rules.

### Core Teaching

**Plain-English explanation.** Once you've identified an order
block's candle (C4-02), you still need to decide exactly where its
top and bottom edges sit. Three common conventions: Body-only draws
the zone from the candle's open to its close (ignoring the wicks
entirely) — the tightest, most conservative boundary. Full-range draws
the zone from the candle's high to its low (wick-to-wick) — the
widest, most inclusive boundary. Wick-inclusive is a middle ground
some frameworks use, extending slightly beyond the body but not all
the way to the full wick extreme.

**Technical explanation.** Each convention makes a real, opposite
tradeoff. Body-only zones are tighter, giving cleaner, more precise
entries when price reacts, but can cause a genuine reaction that only
reached into the wick portion (not the body) to be scored as a
"miss" — the zone appeared to fail when, under a wider convention, it
would have held. Full-range zones catch more genuine reactions
(nothing that touched anywhere in the candle's range is missed), but
are more prone to false positives — treating a reaction that barely
grazed the outer wick with the same significance as one that reacted
firmly inside the body. There is no single objectively correct
convention; this course uses body-only as the default teaching
convention (for its precision and consistency with C2-08's own close-
location-value emphasis), while flagging clearly that other legitimate
frameworks use full-range or wick-inclusive definitions, and that
comparing zone marks across sources requires knowing which convention
each is using.

### Visual Model

See diagram: `visuals/c4-05-zone-boundary-conventions.svg` — one
order-block candle shown three times side by side, each with a
different boundary convention overlaid: Body-only (tight box around
open/close), Full-range (wide box from high to low), Wick-inclusive
(a boundary partway between the two) — captioned with each
convention's tradeoff.

### Worked Example

An order block candle has a body from 1.0900 to 1.0920, with wicks
extending to 1.0895 (low) and 1.0928 (high). Under body-only, the zone
is 1.0900–1.0920. Under full-range, it's 1.0895–1.0928. A later
reaction that touches 1.0898 and reverses would count as a hold under
full-range, but as a "miss" (price never actually reached the zone)
under body-only — the same price action, two different verdicts,
purely from the boundary convention chosen.

### Counterexample

A trader compares their own body-only zone marks against another
trader's full-range marks on the same chart and concludes one of them
must be making an error, without realizing they're simply using
different, both-legitimate conventions. The disagreement isn't a
mistake by either party — it's an unstated difference in method.

### Good Example / Bad Example

Good: Picking one convention deliberately, stating it explicitly when
comparing notes with others, and applying it consistently. Bad:
Switching conventions inconsistently from chart to chart, or assuming
everyone else is using the same convention without checking.

### What to Look Out For

- There is no single "correct" convention — the tradeoff is real and
  goes both ways (precision vs. inclusiveness).
- Consistency matters more than which specific convention you pick —
  switching arbitrarily between charts breaks comparability.
- When reading outside content (a book, a video, another trader's
  marks), check which convention they're using before assuming your
  zone marks would match theirs.

### Common Mistakes

Beginners often don't realize a convention choice is even being made,
treating "the zone" as if it had one universally agreed-upon
boundary. Recognizing that this is a genuine methodological choice —
not a fact to look up — is the point of this lesson.

### Key Takeaways

1. Body-only, full-range, and wick-inclusive are three legitimate,
   different conventions for drawing a zone's boundaries.
2. Body-only trades precision for potentially missing reactions in the
   wick; full-range trades inclusiveness for more false positives.
3. This course defaults to body-only, but consistency and explicit
   awareness of the convention in use matters more than which one you
   pick.

### Practice Drill

Given five order-block candles (provided in Practise), draw all three
boundary conventions for each and note where a later price reaction
would be scored differently depending on which convention was used.

### Scenario Challenge

A reaction touches partway into an order block's wick but never
reaches the body. Using body-only versus full-range conventions, how
would each score this reaction, and which would you personally trust
more for a precise entry?

### Mini Quiz

Q1 (True/False): There is one single, universally agreed-upon
convention for drawing a zone's boundaries.
Answer: False — body-only, full-range, and wick-inclusive are all
legitimate, different conventions with real tradeoffs.

Q2 (Multiple choice): What's the main tradeoff of a body-only zone
convention versus full-range?
(a) Body-only is always wrong
(b) Body-only is tighter/more precise but can miss reactions that
    only reached the wick; full-range is more inclusive but more
    prone to false positives
(c) There is no real difference between them
(d) Full-range is only used for bearish zones

Answer: (b).

### Flashcards

- Front: What are the three common zone-boundary conventions? Back:
  Body-only (open to close), Full-range (high to low), and Wick-
  inclusive (a middle ground).
- Front: What tradeoff does a body-only convention make? Back:
  Tighter, more precise boundaries, at the cost of potentially scoring
  a wick-only reaction as a miss.

### Reflection

Have you ever compared your own chart marks to someone else's and
assumed a disagreement meant one of you was wrong? Could a different
boundary convention explain it instead?

### Mastery Criteria

Correctly draw all three boundary conventions for all five practice-
drill candles, and correctly identify at least two cases where a real
reaction would be scored differently across conventions.

### Spaced Review

Day 1, Day 7, Day 21 — this convention choice resurfaces directly in
Bot 2's own documented zone-boundary rule, which the mastery track
names explicitly.

### Bot Connection

Bot 2 (Order Block Reversal) documents, as part of its own published
setup rules, exactly which boundary convention (body-only, by default
in this platform's bots) its signal logic uses — this lesson is what
makes that documentation legible rather than an arbitrary technical
detail.

---

## C4-06 — Zone Age, Zone Quality, Confluence

**Level:** 2
**Estimated study time:** 14 minutes
**Prerequisites:** C4-01 through C4-05, C3-06
**Learning objectives:** Explain how a zone's age affects its expected
reliability, and identify the confluence factors that separate a
high-quality zone from a low-quality one.

### Why This Matters

This lesson closes Core 4 the same way C3-06 closed Core 3: a zone
being technically real (correctly identified per C4-02's rule) is
necessary but not sufficient for it to be a good trading candidate.
Age and confluence are the specific factors that separate a strong
zone from a technically-valid-but-weak one.

### Core Teaching

**Plain-English explanation.** Older zones generally carry less
confidence than recently-formed ones, all else equal — the market
context that produced the original imbalance is more likely to have
changed the longer ago it happened, and a zone sitting untouched for a
very long time has often simply become less relevant to current price
behavior. Quality and confluence describe how much OTHER supporting
evidence exists around a given zone: does it align with a liquidity
pool (Core 3), a clean structural level (Core 2), the right higher-
timeframe bias, and reasonable freshness (C4-04)? A zone with several
of these factors stacked together is meaningfully higher-quality than
an isolated zone with none of them.

**Technical explanation.** "Age" here isn't a fixed universal cutoff —
what counts as "old" varies by timeframe and instrument (a 15-minute
order block from a week ago behaves differently than a Weekly order
block from a year ago), but the general principle holds across
timeframes: all else equal, a more recently-formed zone is weighted
more heavily than an older one. Confluence specifically means multiple
INDEPENDENT pieces of evidence pointing at the same zone — a liquidity
pool sitting right at the zone's edge (Core 3), the zone aligning with
a clean structural level (Core 2), and higher-timeframe bias agreeing
with the zone's expected direction, all stacking together. This is the
same "not every technically-valid thing is a good trading target"
principle from C3-06, applied here specifically to zones rather than
liquidity pools — and it's the last piece needed before Core 4's
concepts feed directly into Bot 2's full setup logic.

### Visual Model

See diagram: `visuals/c4-06-zone-confluence-stack.svg` — a single
zone shown with four overlapping supporting-evidence layers labeled
around it: "Nearby liquidity pool," "Aligns with clean structure,"
"Higher-timeframe bias agrees," "Reasonably fresh" — captioned "more
layers stacking together = higher-quality zone, not any one layer
alone."

### Worked Example

A 4H bullish order block formed three days ago, sits directly beneath
a cluster of equal lows (sell-side liquidity, Core 3), aligns with a
clean higher-timeframe protected low (Core 2), and the overall 4H
trend is bullish. This zone stacks four independent pieces of evidence
and is a high-quality, high-confluence candidate. A different order
block from six months ago, sitting with no nearby liquidity, no
structural alignment, and against the current higher-timeframe bias,
is technically still "a valid order block" per C4-02's rule but a
much weaker trading candidate.

### Counterexample

A trader treats every technically-valid order block with equal weight
regardless of age or how much supporting evidence surrounds it,
producing a large number of low-quality setups alongside the genuinely
strong ones. This is the same overtrading failure mode C3-06 warned
about, now showing up specifically in zone selection.

### Good Example / Bad Example

Good: Explicitly checking a zone's age and counting how many
independent confluence factors support it before weighting how much
confidence to place in a reaction there. Bad: Treating every
technically-correct order block as an equally strong setup regardless
of its age or surrounding context.

### What to Look Out For

- "Old" is relative to the timeframe in question, not a fixed
  universal number of days.
- Confluence means INDEPENDENT supporting factors stacking together —
  not the same underlying evidence counted multiple times under
  different names.
- A technically-correct zone with zero supporting confluence is still
  worth noting, but should be weighted as a weaker candidate than one
  with several factors stacked.

### Common Mistakes

A common late-stage mistake, once a learner has mastered identifying
zones correctly, is treating correct identification as the whole job
— trading every valid zone found, rather than ranking them by age and
confluence and being selective about which ones to actually act on.

### Key Takeaways

1. Older zones generally carry less confidence than recently-formed
   ones, all else equal, though "old" is relative to the timeframe.
2. Confluence means multiple independent pieces of supporting
   evidence (liquidity, structure, higher-timeframe bias) stacking
   together at the same zone.
3. Correct zone identification (C4-02) is necessary but not
   sufficient — age and confluence determine whether it's actually a
   strong candidate to act on.

### Practice Drill

Given six zones with full context provided (age, nearby liquidity,
structural alignment, higher-timeframe bias — in Practise), score each
on confluence and rank them from strongest to weakest candidate.

### Scenario Challenge

You've correctly identified a technically valid order block, but it's
old for its timeframe and has no nearby liquidity or structural
alignment. Using this lesson's vocabulary, how would you honestly
describe this zone's quality, even though your identification was
technically correct?

### Mini Quiz

Q1 (True/False): A correctly-identified order block is automatically
a high-quality trading candidate.
Answer: False — correct identification (C4-02) is necessary but not
sufficient; age and confluence determine actual quality.

Q2 (Multiple choice): What does "confluence" mean in this lesson's
sense?
(a) A single very strong piece of evidence
(b) Multiple independent pieces of supporting evidence stacking
    together at the same zone
(c) How many candles make up the zone
(d) The zone's exact boundary convention

Answer: (b).

### Flashcards

- Front: How does zone age generally affect confidence? Back: All
  else equal, more recently-formed zones are weighted more heavily
  than older ones — though "old" is relative to the timeframe.
- Front: What does confluence mean for a zone? Back: Multiple
  independent supporting factors (nearby liquidity, structural
  alignment, higher-timeframe bias, freshness) stacking together at
  the same zone, rather than any one factor alone.

### Reflection

Think of a technically-correct zone you (or a hypothetical trader)
might have traded without checking its age or confluence. What would
scoring it against this lesson's factors have told you?

### Mastery Criteria

Correctly score and rank all six practice-drill zones by confluence,
with valid reasoning tied to each supporting factor counted.

### Spaced Review

Day 1, Day 7, Day 21, Day 30 — this closes Core 4 and is directly
echoed in Core 5's FVG-quality lesson and Core 7's multi-timeframe
confluence framework.

### Bot Connection

Bot 2 (Order Block Reversal)'s full, documented setup logic is
essentially this lesson's confluence checklist made explicit and
mechanical — a fresh/lightly-mitigated zone (C4-04), a nearby
liquidity sweep (Core 3), and multi-timeframe structural alignment,
all required together before a signal fires.
