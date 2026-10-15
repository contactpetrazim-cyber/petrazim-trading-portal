# BOT 7 — FVG EXPANSION V3 MASTERY

Ten-lesson specialization track for Bot 7 (FVG Expansion v3, "Bot 3
Update") — verified line-by-line against `backend/app/core/
bot_strategies.py`'s `FVGExpansionV3Bot`. Bot 7 is deliberately a
SEPARATE bot built on Bot 3's exact same setup, with two specific
audit fixes applied (direction-first BOS, depth-based FVG selection)
— so this track is written throughout as a direct, explicit
comparison against Bot 3 (BOT3-01 through BOT3-10), not a standalone
rebuild of that content.

---

## BOT7-01 — Concept: FVG Expansion v3 (Bot 3, with Two Fixes Applied)

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT3-01, C5-01, C5-03
**Learning objectives:** State Bot 7's real relationship to Bot 3 —
same setup, same timeframe pair, two specific, isolated changes — and
name what those two changes are at a conceptual level.

### Why This Matters

Bot 7 is not a new strategy idea. It exists because Bot 3
(`FVGExpansionBot`) had a genuinely strong live track record, and
rather than risk that record by editing Bot 3 directly, this
platform's own audit fixes were applied to a SEPARATE bot instead —
so the two can run side by side on real trades and the question "do
these two fixes actually help?" gets a real, data-backed answer
instead of a guess. Understanding this relationship correctly is the
foundation every later BOT7 lesson builds on.

### Core Teaching

**Plain-English explanation.** Bot 7 (FVG Expansion v3) runs the
exact same 1H-unmitigated-FVG-plus-15M-confirmation setup as Bot 3.
Two things, and only two things, are genuinely different: (1) Bot 7
decides its trade DIRECTION first, from a stricter 15M structural
read, and only then looks for a matching FVG — Bot 3 does this in the
opposite order (BOT7-03); (2) when more than one FVG qualifies, Bot 7
picks the one with the most room to react from (deepest for a long,
highest for a short) — Bot 3 just takes whichever one it detected
most recently (BOT7-04). Everything else — the FVG eligibility
window, the entry price formula, the stop formula, the target
ladder, the risk sizing — is identical, line-for-line, to Bot 3.

**Technical explanation.** `FVGExpansionV3Bot.analyze()` takes the
same two candle series as `FVGExpansionBot.analyze()` — `candles_1h`
and `candles_15m` — and its `__init__` sets identical engine
defaults: `EntryExitEngine(default_rr=4.0)`,
`RiskManager(base_risk_percent=1.0)`. Its own class docstring states
this relationship explicitly: "Bot 3's own setup, with the audit's
direction/selection fixes applied... Deliberately NOT added here, to
isolate what's actually being tested: no order-block/zone reference,
no discount/premium check." Bot 3 itself is explicitly unchanged —
this is an A/B comparison bot, the same pattern Bot 11 (vs. Bot 2)
and Bot 12 (vs. Bot 2) already use elsewhere on this platform.

### Visual Model

See diagram: `visuals/bot7-01-bot3-vs-bot7.svg` — two near-identical
pipelines side by side, Bot 3 on the left and Bot 7 on the right,
with exactly two steps highlighted in a different color (FVG
selection order, FVG selection criterion) and every other step shown
in matching gray to emphasize how much is actually shared.

### Worked Example

A trader sees a Bot 7 signal and assumes it must use a genuinely
different detection mechanism from Bot 3, since it's a separate bot
with a separate `bot_id`. In reality, Step 1 (finding eligible 1H
FVGs) is byte-for-byte identical code to Bot 3's own Step 1 — the
difference only begins at Step 2.

### Counterexample

A trader assumes Bot 7 must have order-block or premium/discount
checks added, since those are common audit-recommended SMC
confirmations seen elsewhere on this platform. Bot 7's own class
docstring explicitly rules this out — adding either would make it
impossible to isolate whether the two actual changes (direction-
first, depth-based selection) are what's driving any performance
difference from Bot 3.

### Good Example / Bad Example

Good: Treating Bot 7 as "Bot 3 plus exactly two named fixes," and
learning those two fixes precisely rather than re-deriving the whole
pipeline from scratch. Bad: Assuming a separate bot_id implies a
substantially different strategy, or that extra confirmations must
have been added somewhere.

### What to Look Out For

- Bot 7 and Bot 3 share the same timeframe pair (1H + 15M), the same
  `default_rr=4.0`, and the same `base_risk_percent=1.0`.
- Exactly two real differences exist: direction-determination order
  (BOT7-03) and FVG-selection criterion (BOT7-04) — nothing else.
- Bot 3 itself is untouched by this bot's existence — this is a
  side-by-side A/B test, not a replacement.

### Common Mistakes

Assuming a new bot_id means a substantially new strategy, rather than
checking (as this lesson does) exactly how much of the real code is
shared versus changed, is the most common mistake when learning any
of this platform's A/B-test bots (Bot 7, Bot 11, Bot 12, Bot 13).

### Key Takeaways

1. Bot 7 reuses Bot 3's exact setup — same timeframe pair, same
   `default_rr`, same `base_risk_percent` — with exactly two real
   changes applied.
2. The two changes are: direction-first BOS (BOT7-03) and depth-based
   FVG selection (BOT7-04) — nothing else differs.
3. Bot 3 remains completely unchanged; Bot 7 exists specifically to
   test these two fixes against Bot 3's own real track record.

### Practice Drill

Given five paired code snippets (provided in Practise) — one from
`FVGExpansionBot`, one from `FVGExpansionV3Bot` — for each pair,
state whether the snippet represents shared (identical) logic or one
of the two real differences.

### Scenario Challenge

A trader wants to know whether Bot 7's win rate difference from Bot
3, if any, could be explained by anything other than the two named
changes. Using this lesson's scope statement, explain why the
class docstring's "deliberately NOT added" list matters for
answering that question honestly.

### Mini Quiz

Q1 (True/False): Bot 7 adds order-block and premium/discount checks
on top of Bot 3's setup.
Answer: False — the class docstring explicitly states these are
deliberately NOT added, specifically to isolate what's actually being
tested.

Q2 (Multiple choice): How many real differences exist between Bot 3
and Bot 7's logic?
(a) None — they are identical
(b) Exactly two — direction-determination order and FVG-selection
    criterion
(c) Every step is different
(d) Only the stop-loss calculation differs

Answer: (b).

### Flashcards

- Front: What two things are genuinely different between Bot 3 and
  Bot 7? Back: Direction is determined BEFORE FVG selection (not
  after), and the FVG is chosen by depth (not recency).
- Front: Does Bot 7 add any new SMC confirmations Bot 3 doesn't have?
  Back: No — deliberately not, to isolate what's actually being
  tested.

### Reflection

Why might isolating exactly two changes, rather than redesigning the
whole strategy at once, produce a more trustworthy real-world answer
about whether those changes actually help?

### Mastery Criteria

Correctly classify all five practice-drill code-snippet pairs as
shared or one of the two real differences.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT7 lesson.

### Bot Connection

Verified against `FVGExpansionV3Bot`'s own class docstring and
`__init__` in `bot_strategies.py`, cross-checked against
`FVGExpansionBot`'s matching values.

---

## BOT7-02 — Identification: The Same 30-70% Mitigation Window

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT7-01, BOT3-02
**Learning objectives:** Confirm that Bot 7's 1H FVG eligibility test
is byte-for-byte identical to Bot 3's, and state why this stage is
NOT one of the two real differences.

### Why This Matters

BOT7-01 named the two real differences. Before studying them in
detail, it's worth confirming precisely what did NOT change — this
stage is one of the largest pieces of shared logic between the two
bots, and knowing it's identical (not "similar") avoids re-deriving
something already covered in BOT3-02.

### Core Teaching

**Plain-English explanation.** Exactly like Bot 3, Bot 7 only
considers a 1H Fair Value Gap genuinely tradable when it's been
retraced into by between 30% and 70% — not fresh and untouched, not
nearly fully filled — and is still `ACTIVE` (not already inverted).

**Technical explanation.** `FVGExpansionV3Bot.analyze()` Step 1:
`fvgs = fvg_detector.detect_fvg(candles_1h)`; `fvgs =
fvg_detector.track_mitigation(fvgs, candles_1h)`; `partial_fvgs = [f
for f in fvgs if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name
== "ACTIVE"]`. This is the exact same three-line sequence as
`FVGExpansionBot.analyze()` Step 1 — same detector class, same
mitigation function, same numeric bounds, same status check. If
`partial_fvgs` is empty, `analyze()` returns `None`, exactly as in
Bot 3.

### Visual Model

Reuses `visuals/bot3-02-mitigation-window.svg` directly — the same
0%-100% mitigation bar with the 30%-70% eligible window shaded,
since this is literally the same real test Bot 3 uses.

### Worked Example

A 1H bearish FVG has been retraced into by 38% and is `ACTIVE`. It
qualifies for `partial_fvgs` under Bot 7's test — identically to how
it would qualify under Bot 3's.

### Counterexample

A trader assumes Bot 7 might use a wider or narrower mitigation
window than Bot 3's, since it's described as an "updated" bot. The
real code shows the exact same `0.3 <= f.mitigated_percent <= 0.7`
bounds — this specific test was never touched.

### Good Example / Bad Example

Good: Recognizing this stage as fully shared with Bot 3, and
referring back to BOT3-02's detail rather than treating it as new
material. Bad: Assuming every stage of an "updated" bot must contain
some change.

### What to Look Out For

- This is identical code to Bot 3's own Step 1 — same bounds, same
  status check, same detector/tracker calls.
- An empty `partial_fvgs` list returns `None` immediately, exactly
  as in Bot 3 — this gate is unchanged.
- This is NOT one of the two real differences named in BOT7-01.

### Common Mistakes

Assuming an "updated" or "v3" bot must change every stage is the
specific mistake this lesson exists to correct — most of Bot 7's
pipeline, including this entire stage, is unchanged from Bot 3.

### Key Takeaways

1. Bot 7's FVG eligibility test is byte-for-byte identical to Bot
   3's — same 30-70% mitigation window, same `ACTIVE` status
   requirement.
2. An empty `partial_fvgs` list still returns `None` immediately.
3. This stage is explicitly NOT one of the two real Bot 3 vs Bot 7
   differences.

### Practice Drill

Given six 1H FVGs with varying mitigation percentages and statuses
(provided in Practise — the same scenario set as BOT3-02), determine
eligibility under Bot 7's test and confirm the answer matches Bot
3's.

### Scenario Challenge

A trader claims Bot 7 must be "more selective" about FVG mitigation
than Bot 3 since it's a newer bot. Using the real code quoted in this
lesson, explain why that claim is false.

### Mini Quiz

Q1 (True/False): Bot 7 uses a different mitigation-percentage window
than Bot 3.
Answer: False — both use exactly `0.3 <= mitigated_percent <= 0.7`,
unchanged code.

Q2 (Multiple choice): What happens if no 1H FVG satisfies Bot 7's
eligibility test?
(a) It falls back to a looser window
(b) `analyze()` returns `None` immediately
(c) It checks the 4H timeframe instead
(d) It waits one candle and retries

Answer: (b).

### Flashcards

- Front: Is Bot 7's 1H FVG eligibility window different from Bot 3's?
  Back: No — identical code, identical 30-70% bounds.
- Front: What does Bot 7 do if no eligible FVG exists? Back: Returns
  `None` immediately — same as Bot 3.

### Reflection

Why is it useful, when learning an "updated" version of an existing
bot, to explicitly confirm which parts are unchanged rather than
assuming everything is new?

### Mastery Criteria

Correctly classify all six practice-drill FVGs, matching BOT3-02's
own answers exactly.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this shared eligibility check
feeds into BOT7-03's direction-first logic, the first real point of
difference.

### Bot Connection

Verified against `FVGExpansionV3Bot.analyze()` Step 1 in
`bot_strategies.py`, confirmed identical to
`FVGExpansionBot.analyze()` Step 1 line-for-line.

---

## BOT7-03 — Context: Direction-First, Not FVG-First (Real Difference #1)

**Level:** 3
**Estimated study time:** 16 minutes
**Prerequisites:** BOT7-02, BOT3-03
**Learning objectives:** State Bot 7's real direction-determination
order and contrast it precisely with Bot 3's — the first of the two
genuine differences between these bots.

### Why This Matters

This is the first of exactly two real differences named in BOT7-01.
Getting the ORDER of operations right here matters: it changes which
FVGs are even considered, not just which one eventually gets picked.

### Core Teaching

**Plain-English explanation.** Bot 3 picks its FVG first — the most
RECENT eligible one — then checks whether the 15M timeframe happens
to agree with that specific gap's own direction, failing if it
doesn't. Bot 7 reverses this order: it reads the 15M timeframe FIRST
to decide direction, using a stricter swing filter than Bot 3's raw
swings, and only AFTER a direction is confirmed does it go looking
for a matching FVG. This isn't a cosmetic reordering — it means Bot 7
never even considers an FVG whose direction disagrees with the
confirmed 15M read, while Bot 3 can pick a "wrong-direction" FVG
first and only discover the mismatch afterward.

**Technical explanation.** `FVGExpansionBot.analyze()` Step 2: takes
`target_fvg = partial_fvgs[-1]` (most recent) FIRST, then computes
`swings_15m = detect_swing_highs(...) + detect_swing_lows(...)` (raw,
unfiltered) and `bos_15m = detect_bos(candles_15m, swings_15m)`,
finally checking `if target_fvg.gap_type == "bullish" and
last_bos["type"] != "bullish_bos": return None` (and the bearish
mirror). `FVGExpansionV3Bot.analyze()` Step 2 instead computes
`swings_15m` the SAME way, but feeds it through
`self.structure_detector.filter_significant_swings(swings_15m)` — the
same "entire leg, not micro swing points" filter covered in C2's own
lesson on significant swings — BEFORE calling `detect_bos`. Direction
is then read directly: `if last_bos["type"] == "bullish_bos":
direction = "long"` / `elif last_bos["type"] == "bearish_bos":
direction = "short"` / `else: return None`. No FVG has been selected
yet at this point — `partial_fvgs` from BOT7-02 is only filtered by
direction in the NEXT step (BOT7-04).

### Visual Model

See diagram: `visuals/bot7-03-direction-order.svg` — two flowcharts
side by side: Bot 3's "pick FVG -> check BOS agrees" vs. Bot 7's
"confirm direction via significant-swing BOS -> THEN filter FVGs by
that direction" — arrows reversed between the two.

### Worked Example

Three eligible 1H FVGs exist: one bullish (most recent), one bearish,
one bullish (older). Bot 3 immediately takes the most recent
(bullish) as `target_fvg`, then checks whether 15M BOS agrees with
bullish — if the real 15M structure is actually bearish, Bot 3 fails
here and returns `None`, having "wasted" its pick on the wrong-
direction FVG. Bot 7 instead reads the 15M significant-swing BOS
first; if it's bearish, direction is immediately set to "short," and
only the bearish FVG among the three even becomes a candidate in the
next step — the two bullish FVGs are never considered at all.

### Counterexample

A trader assumes Bot 7, since it checks BOS "first," must be checking
a DIFFERENT condition than Bot 3 — e.g., a different swing filter
entirely. The swing-DETECTION call itself (`detect_swing_highs` +
`detect_swing_lows`) is identical; the only change is that Bot 7 runs
the result through `filter_significant_swings` before calling
`detect_bos`, where Bot 3 feeds `detect_bos` the raw, unfiltered
swings directly.

### Good Example / Bad Example

Good: Understanding that Bot 7's real change is a REORDERING plus a
STRICTER swing filter — not an entirely new confirmation mechanism.
Bad: Assuming Bot 7 must use some additional indicator or timeframe
beyond what Bot 3 already reads.

### What to Look Out For

- Bot 3: FVG selected first (by recency), then BOS checked for
  agreement with that specific FVG's `gap_type`.
- Bot 7: direction confirmed first (via `filter_significant_swings` +
  `detect_bos`), FVG filtering happens afterward (BOT7-04).
- Bot 7's swing filter is STRICTER (significant legs only) than Bot
  3's raw swing-fractal input to `detect_bos` — this is a second,
  smaller real difference bundled into the same step.
- The unreachable branch: `detect_bos` only ever returns
  `"bullish_bos"` or `"bearish_bos"` types (confirmed by tracing its
  own source) — Bot 7's `else: return None` branch for a third,
  unrecognized type is real code but never actually reachable given
  `bos_15m` is already confirmed non-empty beforehand.

### Common Mistakes

Assuming "direction-first" means Bot 7 ignores the FVG's own
direction entirely is a misread — the FVG's `gap_type` still matters,
just one step later (BOT7-04), as the filter for WHICH eligible FVGs
can even be considered, not whether direction exists at all.

### Key Takeaways

1. Bot 3 picks an FVG first, then checks if 15M BOS agrees; Bot 7
   reads 15M BOS first (via the stricter significant-swing filter),
   and only then filters FVGs by that confirmed direction.
2. Bot 7's swing input to `detect_bos` is filtered through
   `filter_significant_swings` — Bot 3's is raw/unfiltered.
3. Bot 7's third `else: return None` branch (for a BOS type that's
   neither bullish nor bearish) is real code but unreachable in
   practice, since `detect_bos` never produces a third type.

### Practice Drill

Given five scenarios (provided in Practise) each listing several
eligible 1H FVGs plus a real 15M swing sequence, work out what Bot 3
would pick (most-recent-FVG-first) versus what Bot 7 would pick
(direction-first), and identify any case where they'd disagree.

### Scenario Challenge

Construct a scenario (or use one provided in Practise) where Bot 3
returns `None` at its BOS-agreement check, but Bot 7 — given the
exact same raw 1H/15M data — produces a real signal. Explain exactly
why the reordering makes the difference.

### Mini Quiz

Q1 (True/False): Bot 7 selects its FVG before checking the 15M
structural read, the same order as Bot 3.
Answer: False — Bot 7 confirms direction from 15M BOS FIRST; FVG
selection (filtered by that direction) happens afterward. Bot 3 does
the opposite.

Q2 (Multiple choice): What real swing-filtering difference exists
between Bot 3 and Bot 7's 15M BOS check?
(a) Bot 7 uses a longer timeframe
(b) Bot 7 feeds swings through `filter_significant_swings` before
    `detect_bos`; Bot 3 feeds `detect_bos` raw, unfiltered swings
(c) Bot 3 uses a stricter filter
(d) There is no difference

Answer: (b).

### Flashcards

- Front: Which bot picks its FVG first, Bot 3 or Bot 7? Back: Bot 3 —
  it takes the most recent eligible FVG, THEN checks BOS agreement.
  Bot 7 reverses this.
- Front: What swing filter does Bot 7 apply before `detect_bos` that
  Bot 3 doesn't? Back: `filter_significant_swings` — collapses raw
  fractal swings down to one per genuine leg.

### Reflection

Why might confirming direction BEFORE selecting a candidate (Bot 7's
order) produce a more reliable outcome than selecting a candidate and
hoping confirmation agrees (Bot 3's order) — and why might that still
not be strictly "better" in every real market condition?

### Mastery Criteria

Correctly resolve all five practice-drill scenarios for both bots,
and correctly construct (or identify) a disagreement case.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the first of the two
real Bot 3 vs Bot 7 differences; BOT7-04 covers the second.

### Bot Connection

Verified against `FVGExpansionV3Bot.analyze()` Step 2 in
`bot_strategies.py`, directly contrasted against
`FVGExpansionBot.analyze()` Steps 1-2, and against
`MarketStructureDetector.filter_significant_swings`'s own docstring
and `detect_bos`'s own return-type source.

---

## BOT7-04 — Setup: Depth-Based FVG Selection (Real Difference #2)

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT7-03
**Learning objectives:** State Bot 7's exact FVG-selection rule
(`select_fvg_by_depth`) and explain precisely how it differs from Bot
3's recency-based pick — the second of the two genuine differences.

### Why This Matters

BOT7-03 covered WHEN direction gets determined. This lesson covers
WHICH FVG gets picked once direction is known — a separate, real
selection criterion shared with no other bot on this platform except
through this exact helper function.

### Core Teaching

**Plain-English explanation.** Once Bot 7 knows its direction
(BOT7-03), it narrows `partial_fvgs` down to only the ones whose
`gap_type` agrees with that direction (bullish FVGs for a long,
bearish for a short). If more than one still qualifies, Bot 7 doesn't
just take the most recent — it picks by DEPTH: for a long, the
qualifying FVG with the LOWEST bottom (the deepest gap, furthest
below current price); for a short, the one with the HIGHEST top. The
idea is that the deepest/highest gap gives price the most room to
react from before resuming the primary direction.

**Technical explanation.** `candidate_fvgs = [f for f in partial_fvgs
if (f.gap_type == "bullish" and direction == "long") or
(f.gap_type == "bearish" and direction == "short")]`; `target_fvg =
select_fvg_by_depth(candidate_fvgs, direction)`. `select_fvg_by_depth`
(`smc_algorithms.py`) is a small, shared, pure function: `if direction
== "long": return min(fvgs, key=lambda f: f.bottom)` / `return
max(fvgs, key=lambda f: f.top)` for a short. If `candidate_fvgs` is
empty (no eligible FVG matches the confirmed direction at all),
`select_fvg_by_depth` returns `None`, and `analyze()` returns `None`
immediately after. Bot 3, by contrast, never filters by direction or
compares depth at all — `target_fvg = partial_fvgs[-1]`, unconditional
on direction, picked BEFORE any structural confirmation exists.

### Visual Model

See diagram: `visuals/bot7-04-depth-selection.svg` — three candidate
bullish FVGs at different depths below current price, with the
deepest one highlighted and labeled "Bot 7 picks this one — most room
to react from," contrasted with a separate panel showing Bot 3 simply
taking whichever FVG is most recent regardless of depth.

### Worked Example

Direction is confirmed "long" (BOT7-03). Two bullish FVGs qualify:
one with `bottom=1.0850`, one with `bottom=1.0820`. Bot 7 picks the
second (`min` by `bottom` — the lower, deeper one) as `target_fvg`,
since it offers more room for price to react from before resuming
upward. Bot 3, facing the same two gaps but with no direction
pre-filter, would simply take whichever was detected most recently,
regardless of which one is actually deeper.

### Counterexample

A trader assumes "depth-based" means Bot 7 always picks the gap
closest to current price (the shallowest), reasoning that's the
"easiest" one to reach. The real formula does the opposite — it picks
the FURTHEST (deepest for a long, highest for a short), explicitly
for the extra room-to-react reasoning stated in `select_fvg_by_depth`'s
own docstring.

### Good Example / Bad Example

Good: Correctly identifying that "depth" means furthest in the
favorable direction (deepest below for a long, highest above for a
short), not closest to current price. Bad: Assuming depth-based
selection favors proximity to current price.

### What to Look Out For

- `candidate_fvgs` is ALREADY filtered by direction before depth
  comparison even happens — this step never compares a bullish and a
  bearish FVG against each other.
- "Deepest" for a long means the LOWEST `bottom` — furthest below
  current price, not closest.
- An empty `candidate_fvgs` list (no eligible FVG matches the
  confirmed direction) returns `None` — this is a real, distinct gate
  from BOT7-02's own eligibility check.

### Common Mistakes

Confusing "deepest" with "closest to current price" is the most
common misread of this specific rule — `select_fvg_by_depth`'s own
docstring states the opposite reasoning explicitly.

### Key Takeaways

1. Bot 7 filters `partial_fvgs` by the CONFIRMED direction (BOT7-03)
   before ever comparing depth — Bot 3 never filters by direction at
   this stage at all.
2. Among direction-matching candidates, Bot 7 picks the deepest
   (lowest `bottom`) for a long, or the highest (`top`) for a short —
   via the shared `select_fvg_by_depth` function.
3. An empty `candidate_fvgs` list is a real, distinct `None`-return
   gate, separate from BOT7-02's own mitigation-window eligibility
   check.

### Practice Drill

Given four scenarios (provided in Practise), each with a confirmed
direction and several direction-matching FVGs at different
top/bottom prices, identify which one Bot 7 would select.

### Scenario Challenge

A direction is confirmed "short," and two bearish FVGs qualify: one
with `top=1.0950`, one with `top=1.0980`. Which one does Bot 7
select, and why — in terms of the real `max(fvgs, key=lambda f:
f.top)` logic, not just the stated "highest" rule?

### Mini Quiz

Q1 (True/False): For a long trade, Bot 7 selects the FVG closest to
the current price among its candidates.
Answer: False — it selects the DEEPEST (lowest `bottom`) — furthest
below, not closest.

Q2 (Multiple choice): What does `select_fvg_by_depth` return if
`candidate_fvgs` is empty?
(a) The most recent FVG from `partial_fvgs` instead
(b) `None`
(c) A zero-width synthetic FVG at current price
(d) It raises an exception

Answer: (b).

### Flashcards

- Front: What does "depth-based" selection mean for a Bot 7 long?
  Back: The qualifying FVG with the LOWEST `bottom` — furthest below
  current price, giving the most room to react from.
- Front: Does Bot 7 ever compare a bullish and bearish FVG's depth
  against each other? Back: No — `candidate_fvgs` is already
  filtered to the confirmed direction before depth comparison.

### Reflection

Having now seen both real differences (BOT7-03's direction-first
order, this lesson's depth-based selection), which one do you think
has a bigger practical effect on which trades Bot 7 actually takes
compared to Bot 3 — and why?

### Mastery Criteria

Correctly identify the selected FVG in all four practice-drill
scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the second and final
real Bot 3 vs Bot 7 difference; every remaining BOT7 stage is shared
logic with Bot 3.

### Bot Connection

Verified against `FVGExpansionV3Bot.analyze()` Step 3 and
`select_fvg_by_depth` in `smc_algorithms.py` (quoted directly), and
`FVGExpansionBot.analyze()`'s own unconditional `partial_fvgs[-1]`
pick for direct contrast.

---

## BOT7-05 — Invalidation: The Four Gates

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT7-02, BOT7-03, BOT7-04
**Learning objectives:** List all real points in Bot 7's pipeline
that return no signal, and contrast the count with Bot 3's two gates.

### Why This Matters

BOT3-05 established Bot 3 has exactly two gates. Bot 7's reordering
(BOT7-03) and added selection step (BOT7-04) genuinely change this
count — worth stating precisely rather than assuming it's the same.

### Core Teaching

**Plain-English explanation.** Reading `FVGExpansionV3Bot.analyze()`
in order, there are four real points where it stops and returns no
signal: (1) no eligible 1H FVG exists in the 30-70% ACTIVE window
(BOT7-02); (2) no 15M BOS exists at all, after significant-swing
filtering (BOT7-03); (3) the confirming BOS is neither bullish nor
bearish — real code, but unreachable in practice (BOT7-03); (4) no
eligible FVG matches the confirmed direction, so `candidate_fvgs` is
empty (BOT7-04).

**Technical explanation.** This is two MORE gates than Bot 3's two
(BOT3-05) — not because Bot 7 is "stricter" in the sense of harder
numeric thresholds (the 30-70% window, the stop/target formulas are
identical), but because reordering direction-before-selection
(BOT7-03) splits what was one combined check in Bot 3 (FVG picked,
THEN BOS-agreement checked) into two separate real gates in Bot 7
(BOS exists at all, THEN a matching FVG exists). Gate 3 (unreachable
BOS type) is included for completeness since it IS a real `return
None` line in the source, even though `detect_bos`'s own return
values make it dead code in practice (BOT7-03).

### Visual Model

See diagram: `visuals/bot7-05-four-gates.svg` — a four-step sequence
(eligible FVG exists? -> 15M BOS exists? -> BOS type recognized? ->
direction-matching FVG exists?) contrasted directly against BOT3-05's
two-step sequence, with a note on gate 3's practical unreachability.

### Worked Example

An eligible 1H FVG exists (gate 1 passes). A 15M significant-swing
BOS exists and is bullish (gates 2 and 3 pass). Among `partial_fvgs`,
no bullish gap happens to qualify — only bearish ones remain (gate 4
fails). `analyze()` returns `None`, even though gates 1-3 all passed.

### Counterexample

A trader assumes that once a 15M BOS is found (gate 2), a signal is
nearly guaranteed, since "the hard part" (finding BOS at all) is
done. Gate 4 — a direction-matching FVG actually existing among the
eligible candidates — is a separate, real condition that can still
fail independently.

### Good Example / Bad Example

Good: Treating gates 1, 2, and 4 as the three practically meaningful
checks, while knowing gate 3 is real code but never actually
triggers. Bad: Assuming Bot 7 has the same two gates as Bot 3 just
because the underlying FVG/BOS concepts are shared.

### What to Look Out For

- Bot 7 has four real `return None` points — two more than Bot 3's
  two, because direction-first ordering splits one combined Bot-3
  check into two separate Bot-7 gates.
- Gate 3 (unrecognized BOS type) is real code but practically
  unreachable, given `detect_bos`'s own confirmed return values.
- Passing gates 1-3 does NOT guarantee gate 4 passes — a confirmed
  direction with no matching eligible FVG is a real, separate failure
  mode.

### Common Mistakes

Assuming Bot 7 must have the same gate count as Bot 3, since the
underlying concepts (FVG, BOS) are shared, is a natural but incorrect
assumption — the reordering itself changes the real gate structure.

### Key Takeaways

1. Bot 7 has four real `return None` points, versus Bot 3's two — a
   direct consequence of the BOT7-03 reordering.
2. Gate 3 (an unrecognized BOS type) is real but practically
   unreachable code.
3. Passing the direction-confirmation gates does not guarantee a
   matching FVG exists — gate 4 is a separate, real failure mode.

### Practice Drill

Given six scenario summaries (provided in Practise) describing FVG
eligibility, 15M BOS status, and direction-matching, determine at
which gate (if any) `analyze()` would return `None`.

### Scenario Challenge

A trader assumes a confirmed 15M BOS (gates 2-3 passed) is "most of
the work" and expects a signal to follow in most cases. Using this
lesson's gate 4, explain a realistic real-market scenario where this
expectation would be wrong.

### Mini Quiz

Q1 (True/False): Bot 7 has the same number of real gates as Bot 3.
Answer: False — Bot 7 has four; Bot 3 has two.

Q2 (Multiple choice): Why does Bot 7 have more gates than Bot 3, even
though they share the same underlying FVG and BOS concepts?
(a) Bot 7 checks an extra timeframe
(b) The direction-first reordering (BOT7-03) splits one combined Bot-3
    check into two separate Bot-7 gates
(c) Bot 7 requires an order block
(d) Bot 3's code is simply incomplete

Answer: (b).

### Flashcards

- Front: How many real gates does Bot 7's pipeline have? Back: Four —
  eligible FVG, 15M BOS exists, BOS type recognized (unreachable in
  practice), direction-matching FVG exists.
- Front: Why does Bot 7 have more gates than Bot 3? Back: The
  direction-first reordering splits Bot 3's one combined
  FVG-then-BOS-agreement check into two separate gates.

### Reflection

Does a higher gate count necessarily mean Bot 7 fires less often than
Bot 3 in practice? What would you need to measure (not assume) to
answer that question for real?

### Mastery Criteria

Correctly identify the failing gate (or confirm all pass) in all six
practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the assembly point for
BOT7-02 through BOT7-04.

### Bot Connection

Every gate here is a direct `return None` line inside
`FVGExpansionV3Bot.analyze()`, traced completely against
`bot_strategies.py`, cross-checked against `detect_bos`'s own return
values in `smc_algorithms.py` for gate 3's practical reachability.

---

## BOT7-06 — Entry: Direction, Selection, and Price Assembled

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT7-03, BOT7-04, BOT7-05
**Learning objectives:** Assemble Bot 7's direction, FVG selection,
and entry price into one complete entry decision.

### Why This Matters

BOT7-03 and BOT7-04 each covered one real difference in isolation.
This lesson is the short assembly step showing how both combine with
the (unchanged, Bot-3-identical) entry price formula into Bot 7's
actual entry decision.

### Core Teaching

**Plain-English explanation.** Once all four gates (BOT7-05) pass,
Bot 7's direction is already fixed (from BOT7-03's 15M BOS read), its
FVG is already selected (from BOT7-04's depth comparison), and the
entry price is simply that selected FVG's midpoint — identical
arithmetic to Bot 3's own entry formula (BOT3-04).

**Technical explanation.** `entry_price = (target_fvg.top +
target_fvg.bottom) / 2` — same plain, hand-written local calculation
as `FVGExpansionBot.analyze()`, no call to
`EntryExitEngine.calculate_entry` in either bot. The only thing that
changed to get to this point is WHICH `target_fvg` and `direction`
feed into this formula — the formula itself is unchanged.

### Visual Model

See diagram: `visuals/bot7-06-assembly.svg` — BOT7-03's direction
output and BOT7-04's FVG-selection output both flowing into the same
unchanged `(top + bottom) / 2` entry formula from BOT3-04.

### Worked Example

Direction is confirmed "short" (BOT7-03: bearish 15M BOS). Among
qualifying bearish FVGs, the one with `top=1.0980` is selected
(BOT7-04: highest top). Entry price is `(1.0980 + 1.0955) / 2 =
1.09675` (assuming `bottom=1.0955`) — the same midpoint formula Bot 3
would apply to whichever FVG IT had selected.

### Counterexample

A trader assumes Bot 7 must also use a different entry-price formula,
since the FVG-selection and direction logic both changed. The entry
formula itself — `(top + bottom) / 2` — is completely unchanged from
Bot 3.

### Good Example / Bad Example

Good: Recognizing that Bot 7's two real differences are fully
upstream of the entry-price calculation, which itself is unchanged.
Bad: Assuming every downstream step must also differ just because
upstream steps changed.

### What to Look Out For

- The entry-price FORMULA is unchanged from Bot 3 — only the inputs
  (which FVG, which direction) differ, due to BOT7-03 and BOT7-04.
- All four gates (BOT7-05) must pass before this assembly happens.
- This mirrors BOT3-06's own assembly lesson, with different upstream
  logic feeding the same downstream formula.

### Common Mistakes

Assuming a changed upstream step (direction order, selection
criterion) must also change a downstream formula (entry price) is a
common but incorrect inference — verify each step independently
against the real code, the same discipline this whole curriculum
applies throughout.

### Key Takeaways

1. Bot 7's entry price formula — `(top + bottom) / 2` — is unchanged
   from Bot 3.
2. Only the INPUTS to that formula (which FVG, which direction)
   differ, as a result of BOT7-03 and BOT7-04.
3. This is the assembly point for both of Bot 7's real differences
   into one entry decision.

### Practice Drill

Given four direction-plus-selected-FVG scenarios (provided in
Practise), calculate the exact entry price Bot 7 would produce for
each.

### Scenario Challenge

A developer extending this codebase wants to add a THIRD difference
to Bot 8 (a future bot), changing the entry-price formula itself.
Using this lesson's scope, explain why that would be a different KIND
of change from Bot 7's own two differences.

### Mini Quiz

Q1 (True/False): Bot 7's entry price formula differs from Bot 3's.
Answer: False — both use the identical `(target_fvg.top +
target_fvg.bottom) / 2` calculation.

Q2 (Multiple choice): What determines Bot 7's final entry price?
(a) A separately-computed 1H trend
(b) The midpoint of whichever FVG BOT7-04's depth-based selection
    picked
(c) The current market price at signal time
(d) The 15M BOS's own structure level

Answer: (b).

### Flashcards

- Front: Is Bot 7's entry price formula different from Bot 3's? Back:
  No — identical `(top + bottom) / 2` midpoint calculation.
- Front: What two upstream outputs feed into Bot 7's entry decision?
  Back: BOT7-03's confirmed direction and BOT7-04's depth-selected
  FVG.

### Reflection

Why might it be a useful discipline, when auditing a strategy change,
to verify explicitly which formulas stayed the same — not just which
ones changed?

### Mastery Criteria

Correctly calculate entry price for all four practice-drill
scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this assembled entry decision
feeds directly into BOT7-07's stop and target calculation.

### Bot Connection

Verified against `FVGExpansionV3Bot.analyze()` Step 4 in
`bot_strategies.py`, confirmed identical to
`FVGExpansionBot.analyze()` Step 3.

---

## BOT7-07 — Management: Stop, Target, and the Real Reported Take-Profit

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT7-06, C8-01, C8-02
**Learning objectives:** State Bot 7's exact stop and target
calculation, and correctly identify which take-profit level
`analyze()` actually reports — verified directly against current
source, not assumed from any other bot's lesson.

### Why This Matters

This lesson is deliberately precise about which field `BotSignal`
actually reports as `take_profit`, verified fresh against the real,
current code — the same "verify, don't assume" discipline this whole
curriculum is built on, applied here with extra care since it is
easy to get wrong by analogy to a similar bot.

### Core Teaching

**Plain-English explanation.** Bot 7's stop sits just beyond the
selected FVG's far extreme, with a buffer equal to 10% of the gap's
own size — identical formula to Bot 3's. Targets are calculated as a
three-level ladder (1R, 2R, and a runner level sized by `rr_ratio`,
default 4.0), and the field `analyze()` actually places into
`BotSignal.take_profit` — the value every other part of this platform
treats as "the" take-profit — is the FIRST level of that ladder
(1R), not the second. Position sizing uses a 1.15 setup-quality
multiplier, the same as Bot 3.

**Technical explanation.** For a long: `sl_price = target_fvg.bottom -
(target_fvg.top - target_fvg.bottom) * 0.1`; for a short:
`sl_price = target_fvg.top + (...) * 0.1` — a 10%-of-FVG-size buffer,
local arithmetic, matching BOT7-06's entry pattern (no shared-engine
call). `sl_price = apply_min_stop_distance_floor(entry_price,
sl_price, direction)` widens this if needed to at least 0.15% of
entry price. `targets = self.entry_engine.calculate_targets(...,
rr_ratio=min_rr_ratio if min_rr_ratio is not None else 4.0)` produces
`tp1` (1R), `tp2` (2R), `tp3` (`rr_ratio` R — 4R by default).
`BotSignal(... take_profit=targets["tp1"], take_profit_2=
targets["tp2"], take_profit_3=targets["tp3"], ...)` — the REPORTED
`take_profit` field is `tp1`, a fixed 1:1, regardless of the
`rr_ratio` passed in. This is the same assignment every bot on this
platform uses (confirmed by checking every `take_profit=targets[...]`
line in `bot_strategies.py` — all eleven read `targets["tp1"]`, with
no exceptions). `calculate_position_risk(setup_quality=1.15)`, then
`calculate_lot_size` — identical to Bot 3.

### Visual Model

See diagram: `visuals/bot7-07-stop-and-reported-tp.svg` — the 1R/2R/4R
ladder with `tp1` highlighted as the actual `take_profit` field,
labeled "this is what BotSignal.take_profit actually reports —
verified against current source across every bot on this platform,
not assumed by analogy."

### Worked Example

The selected FVG spans 1.0900 (bottom) to 1.0920 (top) for a long —
a 20-pip gap. The stop sits at `1.0900 - (0.0020 * 0.1) = 1.0898`,
2 pips of buffer beyond the gap's bottom. Entry at the midpoint
(1.0910), stop distance 12 pips. Reported `take_profit` (`tp1`) sits
12 pips above entry, at 1.0922 — a 1:1 move, not the 48 pips (4:1) a
reader might assume from the `rr_ratio=4.0` default alone.

### Counterexample

A trader familiar with an older description of a similar bot assumes
Bot 7's reported take-profit must be `tp2` (a fixed 2:1), by analogy.
Checking the current, real `bot_strategies.py` source directly —
not relying on memory of a similar bot's prior description — confirms
`take_profit=targets["tp1"]` for Bot 7, same as every other bot on
this platform.

### Good Example / Bad Example

Good: Verifying the exact reported take-profit field against the
CURRENT source code directly, every time, rather than assuming it
matches a similar bot's past description. Bad: Assuming any bot's
`take_profit` field by analogy without checking the live
`bot_strategies.py` source.

### What to Look Out For

- The stop buffer is 10% of the selected FVG's own size — identical
  formula to Bot 3's, proportional to that specific gap.
- `BotSignal.take_profit` is `targets["tp1"]` — a fixed 1:1 — for
  Bot 7, and for every bot on this platform, confirmed by checking
  every `take_profit=targets[...]` assignment in `bot_strategies.py`
  directly.
- The `rr_ratio` parameter only ever sizes `tp3` (the runner level,
  reported separately as `take_profit_3`) — it never changes the
  reported `take_profit` field itself.
- Position sizing uses the same 1.15 setup-quality multiplier as Bot
  3.

### Common Mistakes

Assuming a take-profit field's identity by analogy to a similar bot's
past description, rather than checking the live source directly, is
exactly the mistake this lesson's Core Teaching was written to avoid
— always re-verify against current code, even for something that
looks "obviously the same."

### Key Takeaways

1. Bot 7's stop buffer is 10% of the selected FVG's own size,
   identical to Bot 3's formula.
2. `BotSignal.take_profit` is `targets["tp1"]` — a fixed 1:1 reward-
   to-risk — confirmed directly against current source, consistent
   with every other bot on this platform.
3. The `rr_ratio` parameter (4.0 default) only sizes `tp3`, the
   runner level reported as `take_profit_3`, never the primary
   reported `take_profit` field.

### Practice Drill

Given three FVG top/bottom pairs with confirmed directions (provided
in Practise), calculate the exact stop price, stop distance, and the
real `tp1` take-profit for each.

### Scenario Challenge

A trader reviewing a Bot 7 trade card sees `take_profit_3` listed at
4R and assumes that's the level the bot is "aiming for" as its
primary target. Using this lesson's exact field-by-field finding,
explain which field is actually reported as `take_profit`, and what
`take_profit_3` represents instead.

### Mini Quiz

Q1 (True/False): Bot 7's stop buffer is a fixed pip distance,
regardless of the selected FVG's size.
Answer: False — it's exactly 10% of that specific FVG's own
top-to-bottom size, proportional, not fixed.

Q2 (Multiple choice): Which target level does `BotSignal.take_profit`
actually report for Bot 7?
(a) `tp3`, the runner level
(b) `tp2`, a fixed 2:1
(c) `tp1`, a fixed 1:1
(d) Whichever level the `rr_ratio` parameter specifies

Answer: (c).

Q3 (True/False): The `rr_ratio=4.0` parameter changes what
`BotSignal.take_profit` reports.
Answer: False — `rr_ratio` only sizes `tp3` (`take_profit_3`); the
reported `take_profit` field is always `tp1`, a fixed 1:1, regardless
of `rr_ratio`.

### Flashcards

- Front: What's Bot 7's exact stop buffer? Back: 10% of the selected
  FVG's own size, beyond its far extreme — identical to Bot 3.
- Front: Which target level does Bot 7's `BotSignal.take_profit`
  field actually report? Back: `tp1` — a fixed 1:1 — confirmed
  directly against current source, same as every bot on this
  platform.

### Reflection

This lesson explicitly re-verified a fact (which field is "the"
take-profit) against live code rather than assuming it from a similar
bot's description. Why does that extra verification step matter for
a curriculum that's meant to stay trustworthy as the underlying code
keeps changing?

### Mastery Criteria

Correctly calculate stop, distance, and the real `tp1` target for all
three practice-drill scenarios, and correctly state that `take_profit`
reports `tp1`, not `tp2` or `tp3`.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds BOT7-08's
failure-mode analysis.

### Bot Connection

Verified against `FVGExpansionV3Bot.analyze()` Steps 5-6 in
`bot_strategies.py`, AND against every single `take_profit=
targets[...]` assignment across all eleven bot classes in the same
file (all read `targets["tp1"]`, confirmed by direct grep of the
source, not sampled) — current as of this lesson's own authoring
date.

---

## BOT7-08 — Failure: What a Failed Bot 7 Setup Looks Like

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT7-05, BOT7-07, C9-02
**Learning objectives:** Distinguish a valid Bot 7 loss from a bad
one, including the Bot-7-specific pattern of ignoring the
direction-first/depth-based selection order.

### Why This Matters

Same discipline as BOT3-08, applied to Bot 7's own four-gate
pipeline — this bot's characteristic bad-loss pattern is different
from Bot 3's, tied specifically to its two real differences.

### Core Teaching

**Plain-English explanation.** A valid Bot 7 loss looks like this:
all four real gates (BOT7-05) genuinely passed — an eligible 1H FVG,
a confirmed 15M significant-swing BOS, a direction-matching FVG
selected by depth — and the trade still hit its stop. A bad Bot 7
loss most often comes from a trader manually replicating this setup
but reverting to Bot 3's own order (picking an FVG by recency first,
then checking BOS agreement) instead of Bot 7's direction-first,
depth-based process — or from reading the wrong target as "the"
take-profit (BOT7-07).

**Technical explanation.** Because `FVGExpansionV3Bot.analyze()` only
ever returns a complete signal or `None`, a genuine bot-generated Bot
7 signal that loses is a valid loss by the same construction argument
as every other bot's own failure-mode lesson on this platform. The
Bot-7-specific bad-loss pattern traces most often to a trader
manually applying Bot 3's recency-first selection order, or picking
the shallowest (rather than deepest) qualifying FVG, in a market
where that would have produced a genuinely different trade than Bot
7's real, verified logic.

### Visual Model

See diagram: `visuals/bot7-08-valid-vs-bad-loss.svg` — Bot 7's real
four-gate sequence with a checkmark path leading to "valid loss (stop
hit)," alongside a separate "bad loss" branch where a trader
substituted Bot 3's recency-first order or picked the wrong-depth
FVG.

### Worked Example

A genuine Bot 7 signal fires: eligible FVG, confirmed significant-
swing 15M BOS, deepest direction-matching FVG selected. The trade
hits its stop. Since all four real gates genuinely passed, this is a
valid loss (C9-02) — no process change is warranted.

### Counterexample

A trader manually builds a "Bot 7 style" setup but, out of habit,
picks the most RECENT direction-matching FVG rather than the deepest
one (reverting to Bot 3's own selection style). The trade loses. This
is a bad loss — BOT7-04's real depth-based selection gate was never
actually applied; a human traded a setup Bot 7's real pipeline would
not have produced.

### Good Example / Bad Example

Good: Verifying both real differences (direction-first order,
depth-based selection) were genuinely applied before trusting a
Bot-7-style setup, and treating a genuine bot-generated loss as
valid. Bad: Reverting to Bot 3's own selection habits while believing
the setup is "Bot 7 style."

### What to Look Out For

- The most common Bot-7-specific bad-loss pattern is reverting to Bot
  3's own selection order or criterion (recency-first, or shallowest-
  not-deepest) without realizing it.
- A genuine, bot-generated Bot 7 signal that loses is a valid loss by
  construction, same as every other bot on this platform.
- Misreading `take_profit_3` (the 4R runner) as the bot's primary
  target (BOT7-07) can also lead to a trader second-guessing a
  genuinely correct `tp1` exit as premature.

### Common Mistakes

Unconsciously reverting to a similar, better-known bot's habits (Bot
3's recency-first FVG pick) while believing a setup is genuinely
"Bot 7 style" is the single most consequential mistake for this bot
specifically.

### Key Takeaways

1. A genuine, bot-generated Bot 7 signal that loses is a valid loss by
   construction — all four real gates were already enforced.
2. The most common Bot-7-specific bad loss comes from reverting to
   Bot 3's own recency-first selection habits instead of Bot 7's
   direction-first, depth-based process.
3. Misreading which target field is the real `take_profit` (BOT7-07)
   is a separate, real source of confusion worth ruling out too.

### Practice Drill

Given five losing-trade case studies styled after Bot 7 (provided in
Practise), determine which are valid losses and which are bad losses,
checking whether the real direction-first/depth-based process was
actually followed in each.

### Scenario Challenge

A trader's manually-placed "Bot 7 style" trade loses. On review, they
had picked the shallowest qualifying FVG, not the deepest. Using this
lesson's vocabulary, classify this loss and explain the specific gate
that was never actually satisfied.

### Mini Quiz

Q1 (True/False): Any FVG matching the confirmed direction is an
equally valid Bot 7 candidate, regardless of depth.
Answer: False — Bot 7 specifically selects the deepest (or highest,
for a short) among direction-matching candidates; picking a shallower
one isn't genuine Bot 7 logic.

Q2 (Multiple choice): What's the most common Bot-7-specific pattern
behind a bad loss?
(a) Using too wide a stop
(b) Reverting to Bot 3's own recency-first selection order or
    criterion without realizing it
(c) Ignoring the 30-70% mitigation window
(d) Using the wrong timeframe pair

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 7 signal a valid or
  bad loss? Back: Valid — all four real gates (BOT7-05) were already
  enforced by construction.
- Front: What's the most common Bot-7-specific bad-loss pattern?
  Back: Reverting to Bot 3's own recency-first FVG selection instead
  of Bot 7's real direction-first, depth-based process.

### Reflection

Across Bot 3 and Bot 7, both share most of their logic but differ in
exactly two places. What does the existence of a Bot-7-specific
bad-loss pattern (reverting to Bot 3's habits) suggest about how
easy it is to blur two closely-related strategies together in
practice, even when their code is precisely documented?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — applies C9-02's model with full
Bot 7-specific precision.

### Bot Connection

Grounded in the fact that `FVGExpansionV3Bot.analyze()` only ever
returns a complete signal or `None`, with both real differences
(BOT7-03, BOT7-04) verified directly against `bot_strategies.py`.

---

## BOT7-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 16 minutes
**Prerequisites:** BOT7-01 through BOT7-08
**Learning objectives:** Apply every real stage of Bot 7's pipeline,
in order, to one continuous scenario — producing a result that
differs from what Bot 3 would produce on the same raw data.

### Why This Matters

Same discipline as BOT3-09, applied to Bot 7's genuinely reordered,
four-gate pipeline — including a direct side-by-side comparison
against what Bot 3 would do with the identical raw data, to make the
practical effect of the two real differences concrete.

### Core Teaching

**Plain-English explanation.** Given a full 1H+15M scenario, work
through Bot 7's pipeline in order: find eligible 1H FVGs within the
30-70% mitigation window (BOT7-02), confirm direction from a
significant-swing-filtered 15M BOS FIRST (BOT7-03), filter eligible
FVGs to that direction and select by depth (BOT7-04), calculate the
midpoint entry (BOT7-06), and calculate the proportional 10%-of-gap
stop and the real, fixed-1:1 `take_profit` (BOT7-07) — then compare
the result against what Bot 3's own recency-first process would have
produced on the exact same raw data.

**Technical explanation.** This exercise mirrors
`FVGExpansionV3Bot.analyze()`'s real, four-gate control flow,
deliberately run alongside `FVGExpansionBot.analyze()`'s own
two-gate flow on identical input data — since the two bots' real
divergence only shows up when you can see both outputs side by side
for the same raw candles.

### Visual Model

See diagram: `visuals/bot7-09-side-by-side-worksheet.svg` — a
six-row worksheet (eligible FVGs -> direction from BOS -> candidate
filter -> depth selection -> entry -> stop/tp1) with a parallel
column showing Bot 3's own shorter process on the identical raw data.

### Worked Example

A full worked scenario (provided in Practise) walks a 1H chart with
two eligible FVGs (one bullish at 45% mitigation, one bearish at
60%) and a 15M chart whose significant-swing BOS is bearish. Working
Bot 7's process: direction = short (from the bearish BOS); among
candidates, only the bearish FVG qualifies; it's selected; entry at
its midpoint; stop 10% beyond its top; real `tp1` target at a fixed
1:1. Working Bot 3's process on the SAME data: it would have taken
whichever FVG was detected most recently (potentially the bullish
one), then failed at the BOS-agreement check if that one disagreed
with the bearish 15M read — a genuinely different outcome.

### Counterexample

A trader completes the exercise but applies Bot 3's recency-first FVG
pick instead of Bot 7's direction-first, depth-based process — their
final answer doesn't match what `FVGExpansionV3Bot.analyze()` would
actually compute for the given data.

### Good Example / Bad Example

Good: Explicitly running BOTH bots' real processes on the same raw
data and comparing the two outputs directly. Bad: Only working Bot
7's process in isolation, missing the chance to see concretely where
and why the two bots' real outputs diverge.

### What to Look Out For

- The practical divergence between Bot 3 and Bot 7 only becomes
  visible when both processes are run on the SAME raw data — working
  Bot 7 alone doesn't show this.
- Bot 7's real `take_profit` is a fixed 1:1 (`tp1`) — not 4:1, even
  though `rr_ratio=4.0` is the default passed into `calculate_targets`.
- Every number produced should trace back to a specific real value
  from the given FVG top/bottom prices and the 15M swing data.

### Common Mistakes

Working only Bot 7's process without also working Bot 3's on the same
data — and so never actually seeing the two real differences produce
a genuinely different outcome — undersells the point of this
exercise.

### Key Takeaways

1. Bot 7's full pipeline has four real gates and two genuine process
   differences from Bot 3's own two-gate pipeline.
2. Running both bots' real processes on identical raw data is the
   only way to see their divergence concretely, not just abstractly.
3. The real reported `take_profit` for Bot 7 is a fixed 1:1 (`tp1`),
   confirmed in BOT7-07.

### Practice Drill

Given a full chart scenario (provided in Practise) with 1H and 15M
data, work through BOTH Bot 3's and Bot 7's complete pipelines,
producing each bot's own exact entry, stop, and `take_profit` (or
`None`, with the specific failing gate).

### Scenario Challenge

Given two scenarios (provided in Practise), one where the pipelines
should agree and one where they should genuinely diverge, correctly
work through both for each bot and explain WHY they agree or diverge
in each case.

### Mini Quiz

Q1 (True/False): Bot 3 and Bot 7 will always produce the same trade
given the same raw 1H and 15M data.
Answer: False — the direction-first reordering (BOT7-03) and
depth-based selection (BOT7-04) can genuinely produce a different FVG
pick, a different outcome, or a signal where the other bot returns
`None`.

Q2 (Multiple choice): What real take-profit ratio does Bot 7 report,
regardless of its `rr_ratio=4.0` default?
(a) 4:1
(b) 2:1
(c) 1:1
(d) It varies by trade

Answer: (c).

### Flashcards

- Front: How many real gates does Bot 7's pipeline have, versus Bot
  3's? Back: Four, versus Bot 3's two — a result of the direction-
  first reordering.
- Front: Can Bot 3 and Bot 7 produce different outcomes on identical
  raw data? Back: Yes — genuinely, due to the direction-first order
  and depth-based FVG selection.

### Mastery Criteria

Correctly produce both bots' exact outputs for the practice-drill
scenario, and correctly explain the divergence (or agreement) in the
scenario challenge.

### Reflection

Having worked both bots' pipelines side by side on the same data,
which of the two real differences (direction-first order, depth-based
selection) do you think would matter more in a genuinely choppy,
multi-FVG market — and why?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT7-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`FVGExpansionV3Bot.analyze()`'s real control flow, run alongside
`FVGExpansionBot.analyze()`'s own — no step here exists that isn't a
real line of code in `bot_strategies.py`.

---

## BOT7-10 — Capstone: Full Bot 7 Decision Simulation

**Level:** 4
**Estimated study time:** 18 minutes
**Prerequisites:** BOT7-01 through BOT7-09
**Learning objectives:** Given raw multi-timeframe chart data,
produce the complete Bot 7 decision — full signal or correctly-
identified `None` with the specific failing gate — including the
correct, verified `take_profit` field.

### Why This Matters

This capstone is the practical payoff of the entire BOT7 track —
producing Bot 7's complete, real decision from raw data, correctly
applying both of its real differences from Bot 3 and correctly
identifying the real `take_profit` field, not an assumed one.

### Core Teaching

**Plain-English explanation.** Given raw 1H and 15M candle data, work
the entire pipeline from scratch: detect 1H FVGs and their
mitigation percentages, find the eligible ones (30-70%, ACTIVE),
confirm direction from a significant-swing-filtered 15M BOS, filter
eligible FVGs to that direction and select by depth, calculate the
midpoint entry and the 10%-of-gap stop, and produce the final, real
fixed-1:1 `take_profit` and 0.82 confidence — or correctly stop at
whichever of the four BOT7-05 gates fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of
`FVGExpansionV3Bot.analyze()` — called only when `market_data`
contains both `"1H"` and `"15M"`. A correct capstone answer matches
every field of the real `BotSignal` (confidence is a FIXED `0.82`,
identical to Bot 3) or a precise `None` with the specific failing
gate, correctly distinguishing `candidate_fvgs` being empty (gate 4)
from `partial_fvgs` being empty (gate 1) — two genuinely different
failure points that can look superficially similar.

### Visual Model

See diagram: `visuals/bot7-10-capstone-flow.svg` — the complete,
unbroken pipeline from raw 1H/15M candle data through every BOT7-01
through BOT7-09 stage to a final signal-or-None outcome, with the
four real gates marked explicitly.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 1H and
15M data. Working the complete pipeline: two 1H FVGs exist, one at
55% mitigation (bullish, ACTIVE) and one at 80% (bearish, too
heavily filled); the 15M significant-swing BOS is bullish — so
direction is "long," the 80%-mitigated bearish FVG was never eligible
to begin with (gate 1), and the 55%-mitigated bullish FVG becomes the
sole direction-matching candidate (trivially "selected by depth"
since only one candidate exists). This produces a long entry at that
FVG's midpoint, a stop 10% beyond its bottom, and a real fixed-1:1
`take_profit`, at 0.82 confidence — matching what
`FVGExpansionV3Bot.analyze()` would output for this exact data.

### Counterexample

A different capstone scenario supplies raw data where two bullish
FVGs exist, both eligible and both direction-matching after a
confirmed long bias — but a trader forgets to apply the depth
comparison (BOT7-04) and picks the wrong one, producing an entry
price that doesn't match what `select_fvg_by_depth`'s real `min(fvgs,
key=lambda f: f.bottom)` logic would select.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, correctly applying
BOTH real differences (direction-first order, depth-based selection)
in the right order, and reporting the real `tp1` take-profit. Bad:
Reverting to Bot 3's recency-first habit at the selection step, or
reporting `tp2`/`tp3` as "the" take-profit.

### What to Look Out For

- A correct `None` answer, with the specific one of four gates
  identified, is just as complete a capstone answer as a full signal.
- Confidence for Bot 7 is a FIXED 0.82 — identical to Bot 3, unlike
  Bot 2's conditional value.
- The reported `take_profit` is ALWAYS `tp1` (fixed 1:1) — never
  `tp2` or `tp3`, regardless of the `rr_ratio` passed in.
- When only one FVG qualifies as a direction-matching candidate, the
  depth comparison is trivial (nothing to compare against) but is
  still conceptually the same step.

### Common Mistakes

At this capstone level, reverting to Bot 3's own recency-first
selection habit, or reporting `tp2`/`tp3` as the primary take-profit,
are the two most consequential mistakes — both directly contradicted
by BOT7-04 and BOT7-07's own confirmed findings.

### Key Takeaways

1. The capstone works Bot 7's complete pipeline from raw candle data
   — nothing pre-identified — applying both real differences from Bot
   3 in the correct order.
2. A correctly-identified `None`, with the specific one of four
   failing gates, is just as valid a capstone answer as a complete
   signal.
3. Confidence is fixed at 0.82, and the reported `take_profit` is
   always `tp1` (fixed 1:1) for every real, firing Bot 7 signal.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one producing `None`), work the complete Bot 7 pipeline for
each.

### Scenario Challenge

Given a raw scenario where two eligible, direction-matching FVGs
exist at different depths, produce the complete, correct pipeline
output, explicitly stating which one `select_fvg_by_depth` selects
and why.

### Mini Quiz

Q1 (True/False): A correct capstone answer for Bot 7 should select
the most recently detected eligible FVG, the way Bot 3 does.
Answer: False — Bot 7 selects by DEPTH (deepest for a long, highest
for a short) among direction-matching candidates, not recency
(BOT7-04).

Q2 (Multiple choice): What take-profit value does a real, firing Bot
7 signal always report?
(a) A value that varies with the `rr_ratio` parameter
(b) A fixed 1:1 (`tp1`)
(c) A fixed 2:1 (`tp2`)
(d) The 4R runner level (`tp3`)

Answer: (b).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 1H
  and 15M candle data — no FVGs, mitigation percentages, or BOS
  events pre-identified.
- Front: What two things must a correct capstone answer get right
  that Bot 3's own capstone (BOT3-10) wouldn't test? Back:
  Direction-first BOS ordering (not FVG-first), and depth-based FVG
  selection (not recency-based).

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios, correctly applying both real differences
and correctly reporting `tp1` as the take-profit.

### Reflection

Having now worked through Bot 3's full pipeline (BOT3-09/10) and Bot
7's (BOT7-09/10), what does this A/B-test pair teach about how a
small, precisely-scoped set of changes to a proven strategy can be
tested honestly — without redesigning everything at once?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone completes the
Bot 3 vs Bot 7 comparison begun in BOT7-01.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 7:
Needs 1H + 15M" invocation of `FVGExpansionV3Bot.analyze()` in full —
every real step, gate, and output, verified directly against
`bot_strategies.py`, including a fresh, direct check (not an
assumption carried over from any other bot's lesson) of which field
`BotSignal.take_profit` actually reports.
