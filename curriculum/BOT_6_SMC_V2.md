# BOT 6 — SMC V2 MASTERY

Ten-lesson specialization track for Bot 6 (SMC v2) — verified
line-by-line against `backend/app/core/bot_strategies.py`'s
`JeafxSMCv2Bot`. This bot is, by its own code's docstring, "a
duplicate of Bot 5 (`JeafxSMCBot`)" — same refined-zone, purge, and
confirmation-candle pipeline, same strict stop and 4-6R target ladder
— with exactly one real mechanical difference: WHERE direction comes
from. New to this curriculum; added after Bots 1 through 5's own
tracks were first authored.

---

## BOT6-01 — Concept: SMC v2 — Bot 5's Pipeline, a New Direction Source

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT5-01, BOT5-03, BOT2-01, BOT3-01
**Learning objectives:** Explain why Bot 6 exists — a second, direct
fix for the same "often misses the price's direction" complaint Bot
5's own BOT5-03 fix addressed — and name its real three-timeframe
scope.

### Why This Matters

Bot 6 is not a new trading philosophy. It's the SAME Jeafx-style
zone/purge/confirmation pipeline as Bot 5, built by direct request
("it's a duplicate of the original SMC bot") specifically to test a
second, different fix for Bot 5's weakest link — where trade direction
comes from — rather than relying on BOT5-03's 4H-BOS fix alone.

### Core Teaching

**Plain-English explanation.** Bot 6 (SMC v2) requires the exact same
refined 1H zone, 15M liquidity purge, and 5M momentum confirmation
candle as Bot 5. What's different: instead of reading the last 4H
break of structure (BOT5-03) to decide long vs. short, Bot 6 asks TWO
other bots' own direction logic directly — Bot 2's 15M CHoCH call, and
Bot 3's 1H-FVG-plus-15M-BOS call — and trades if EITHER one gives a
clean answer, as long as they don't actively disagree.

**Technical explanation.** `JeafxSMCv2Bot.analyze()` takes THREE
candle series — `candles_1h`, `candles_15m`, `candles_5m` — the exact
same three-timeframe input as Bot 5 (BOT5-01), and notably NO
`candles_4h` parameter at all, unlike Bot 5. Its `EntryExitEngine`
defaults to `rr=4.0` and its `RiskManager` uses `base_risk_percent=
1.0` — both identical to Bot 5. Its `setup_quality=1.3` and
`confidence=0.88` are also identical to Bot 5 — tied for the highest
fixed values of any bot in this curriculum, not higher. Direction
comes from two new, standalone module-level helper functions —
`_choch_direction_15m` (exactly Bot 2's own direction step) and
`_fvg_bos_direction_1h_15m` (exactly Bot 3's own direction step) —
rather than from any 4H data at all.

### Visual Model

See diagram: `visuals/bot6-01-direction-source-swap.svg` — Bot 5's
pipeline and Bot 6's pipeline shown side by side, identical at every
stage except one box: "Direction" — labeled "last 4H BOS" for Bot 5,
"Bot 2's 15M CHoCH OR Bot 3's 1H-FVG+15M-BOS, either sufficient" for
Bot 6.

### Worked Example

A trader familiar with Bot 5 reviews a Bot 6 signal and looks for a
4H BOS reference in its reasoning text. There isn't one —
`JeafxSMCv2Bot.analyze()` never reads `candles_4h` at all; its
reasoning field instead names Bot 2's CHoCH result and Bot 3's
FVG/BOS result explicitly.

### Counterexample

A trader assumes Bot 6, sharing "SMC" in its bot name with Bot 5,
must also share Bot 5's exact direction logic. The zone, purge, and
confirmation-candle steps ARE identical — but the direction step is
a genuinely different mechanism, reading two OTHER bots' own direction
helpers instead of a 4H BOS.

### Good Example / Bad Example

Good: Recognizing Bot 6 as Bot 5's same pipeline with one mechanism
swapped — the direction source — built as a second, independent fix
for the same real complaint BOT5-03 already addressed once. Bad:
Assuming Bot 6's zone, purge, or confirmation-candle logic differs
from Bot 5's just because its direction step does.

### What to Look Out For

- Bot 6 reads NO 4H data at all — its direction never depends on
  `candles_4h`, unlike Bot 5's BOT5-03 fix.
- Bot 6's zone refinement, purge, and confirmation-candle steps are
  IDENTICAL to Bot 5's — verified directly from source, not assumed
  from the class docstring's "duplicate" description.
- Its `setup_quality` (1.3) and `confidence` (0.88) tie Bot 5's for
  the highest fixed values in this curriculum.

### Common Mistakes

Assuming Bot 6 is simply "Bot 5 with a better direction fix" and
therefore replaces it, rather than a genuinely separate, parallel bot
built to TEST a second approach to the same problem, is the most
common misread of why this bot exists at all.

### Key Takeaways

1. Bot 6 shares Bot 5's exact zone/purge/confirmation-candle pipeline
   — verified identical in source, not merely similar.
2. Bot 6's one real difference is its direction source: Bot 2's 15M
   CHoCH OR Bot 3's 1H-FVG+15M-BOS, instead of Bot 5's 4H BOS.
3. Bot 6 reads no 4H candle data at all — a genuinely different input
   shape from Bot 5's four-timeframe `analyze()` signature.

### Practice Drill

Given six real bot signal cards (provided in Practise, one per bot in
this curriculum), identify the Bot 6 signal using only its reasoning
text's reference to Bot 2's CHoCH and Bot 3's FVG/BOS results.

### Scenario Challenge

A trader manually replicating a Bot 6 signal starts by computing a 4H
BOS, the way they would for Bot 5. Using this lesson's exact
mechanics, explain why that input is never used anywhere in Bot 6's
real pipeline.

### Mini Quiz

Q1 (True/False): Bot 6's `analyze()` reads `candles_4h`, the same as
Bot 5's.
Answer: False — Bot 6's signature has no `candles_4h` parameter at
all; only `candles_1h`, `candles_15m`, and `candles_5m`.

Q2 (Multiple choice): What is Bot 6's one genuine mechanical
difference from Bot 5?
(a) A different zone-refinement test
(b) A different confirmation-candle window
(c) A different direction source
(d) A different stop-loss formula

Answer: (c).

### Flashcards

- Front: What three timeframes does Bot 6 use? Back: 1H, 15M, and 5M
  — identical to Bot 5, with no 4H input anywhere.
- Front: What's Bot 6's one real mechanical difference from Bot 5?
  Back: Direction comes from Bot 2's 15M CHoCH OR Bot 3's
  1H-FVG+15M-BOS (either sufficient), not a 4H BOS.

### Reflection

Why might building a SECOND, parallel bot to test a different
direction-source fix be a safer approach than simply replacing Bot
5's BOT5-03 fix in place? What does running both side by side in
production let you learn that changing one bot's code alone wouldn't?

### Mastery Criteria

Correctly identify the Bot 6 signal card among the six in the
practice drill.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT6 lesson, and is the direct point of comparison against
BOT5-01.

### Bot Connection

Verified against `JeafxSMCv2Bot.__init__` and `analyze()`'s real
signature in `bot_strategies.py`, and its class docstring's own
"duplicate of Bot 5" framing.

---

## BOT6-02 — Identification: Refined Zones, Identical to Bot 5

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT6-01, BOT5-02
**Learning objectives:** Confirm Bot 6's zone-refinement test is
byte-for-byte identical to Bot 5's — ACTIVE status AND a low test
count — and explain why this step is NOT where Bot 6 and Bot 5 differ.

### Why This Matters

Before studying Bot 6's one real difference (direction, BOT6-05), it's
worth confirming precisely what did NOT change — starting with the
very first gate in the pipeline.

### Core Teaching

**Plain-English explanation.** Exactly like Bot 5, Bot 6 only trades
1H order blocks that are both ACTIVE and genuinely "fresh" — tested at
most once. A zone that's been reacted to multiple times, even if still
technically active, is excluded from `fresh_zones` entirely, the same
way it would be for Bot 5.

**Technical explanation.** `zones = zone_detector.detect_order_blocks
(candles_1h, swings_1h)`; `fresh_zones = [z for z in zones if
z.status.name == "ACTIVE" and z.test_count <= 1]`; `if not
fresh_zones: return None` — this is the FIRST gate in Bot 6's
pipeline, and it is identical, line for line, to Bot 5's own Step 1
(BOT5-02). Bot 6's own code comment confirms this explicitly:
"identical to Bot 5."

### Visual Model

See diagram: `visuals/bot6-02-identical-refinement.svg` — Bot 5's and
Bot 6's zone-refinement code shown side by side, with every line
highlighted as identical.

### Worked Example

A 1H bullish order block is ACTIVE and has been tested exactly once
(`test_count = 1`). It passes Bot 6's refinement filter and enters
`fresh_zones` — the exact same outcome Bot 5 would produce for the
identical zone.

### Counterexample

A trader assumes Bot 6, being "v2," must have a LOOSER or stricter
zone-refinement test than Bot 5's v1. The real code shows no such
change — the test is identical.

### Good Example / Bad Example

Good: Treating Bot 6's zone-refinement step as a direct copy of Bot
5's, requiring no separate study. Bad: Assuming "v2" implies every
step changed, rather than verifying which ones actually did.

### What to Look Out For

- This gate is IDENTICAL to Bot 5's BOT5-02 — same `ACTIVE` status
  check, same `test_count <= 1` threshold.
- Bot 6's own code comment states this explicitly: "identical to Bot
  5" — not an inference, a direct statement in the source.
- This is the FIRST of Bot 6's real gates, same position as in Bot 5's
  pipeline.

### Common Mistakes

Assuming every step of a "v2" bot must differ from its "v1"
counterpart, rather than verifying which specific steps actually
changed, is the most consequential mistake when first approaching Bot
6.

### Key Takeaways

1. Bot 6's zone-refinement test (ACTIVE + `test_count <= 1`) is
   identical to Bot 5's — confirmed directly from source, not assumed.
2. This is the first gate in both bots' pipelines.
3. "v2" in Bot 6's name refers specifically to its direction source
   (BOT6-05), not to this zone-refinement step.

### Practice Drill

Given six 1H order blocks with varying status and test counts
(provided in Practise — the same set used in BOT5-02's drill),
determine which are eligible under Bot 6's exact refinement test, and
confirm the outcome matches Bot 5's for each.

### Scenario Challenge

A trader claims Bot 6 must have a different zone-refinement threshold
from Bot 5 because it's a newer bot. Using this lesson's exact source
comparison, show why that claim is false.

### Mini Quiz

Q1 (True/False): Bot 6's zone-refinement test differs from Bot 5's.
Answer: False — it's identical: ACTIVE status AND `test_count <= 1`,
confirmed by Bot 6's own code comment.

Q2 (Multiple choice): What does Bot 6's code comment say about this
step?
(a) "A stricter version of Bot 5's test"
(b) "Identical to Bot 5"
(c) "No longer checks test_count"
(d) "Uses a 4H zone instead"

Answer: (b).

### Flashcards

- Front: Is Bot 6's zone-refinement test different from Bot 5's? Back:
  No — identical: ACTIVE status AND `test_count <= 1`.
- Front: What does Bot 6's own source comment say about this step?
  Back: "identical to Bot 5" — stated directly in the code.

### Mastery Criteria

Correctly classify all six practice-drill zones, confirming each
matches Bot 5's outcome for the same zone.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this refined zone selection is
the foundation BOT6-03's purge/alignment check builds on.

### Bot Connection

Verified against `JeafxSMCv2Bot.analyze()` Step 1 in
`bot_strategies.py` — quoted directly from source, alongside its own
"identical to Bot 5" code comment.

---

## BOT6-03 — Context: The 15M Liquidity Purge, a Timing Gate Only

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT6-02, BOT5-03
**Learning objectives:** State Bot 6's exact purge-and-alignment test,
and explain precisely why the purge still matters even though its
SIDE no longer decides direction.

### Why This Matters

This is the step that most invites confusion once BOT6-05's direction
change is known: the 15M liquidity purge is STILL required, STILL
checked the exact same way as Bot 5 — it just no longer decides
long/short on its own.

### Core Teaching

**Plain-English explanation.** After a refined zone is found
(BOT6-02), Bot 6 requires a genuine 15M liquidity sweep of resting
stop-orders, the exact same detection Bot 5 uses. That sweep's price
must then align with (fall inside) one of the refined zones. Both
checks are IDENTICAL to Bot 5 — what's different (BOT6-05) is only
that the sweep's TYPE (buy-side vs. sell-side) is never read to decide
direction here.

**Technical explanation.** `pools = liq_detector.detect_equal_highs_
lows(candles_15m, lookback=30)`; `sweeps = liq_detector.
detect_liquidity_sweeps(pools, candles_15m[-5:])`; `if not sweeps:
return None` (gate 2). `last_sweep = sweeps[-1]`; then `for z in
fresh_zones: if z.bottom <= sweep_price <= z.top: aligned_zone = z;
break`; `if not aligned_zone: return None` (gate 3) — both lines
identical to Bot 5's own Steps 2-3 (BOT5-03). Bot 6's own code
comment makes the reasoning explicit: the purge "is still required as
the ENTRY-TIMING gate (a zone with no purge yet isn't ready to trade)
even though the purge's own side no longer decides direction below."

### Visual Model

See diagram: `visuals/bot6-03-purge-still-required.svg` — the same
15M sweep-and-alignment diagram as Bot 5's, with an added caption:
"still a REQUIRED gate — only the sweep's TYPE field is now unused."

### Worked Example

A 15M sell-side liquidity sweep occurs, and its price aligns with a
refined 1H zone. Both gates pass — exactly as they would for Bot 5.
Whether this ends up a long or a short, though, is NOT decided here
(BOT6-05) — unlike Bot 5, where the OLD (pre-BOT5-03) logic would have
read this sweep's type directly.

### Counterexample

A trader assumes that because Bot 6 no longer uses the sweep's type to
decide direction, the sweep check itself must have been removed or
weakened. The real code requires exactly the same sweep detection and
zone-alignment gates as Bot 5 — only the DOWNSTREAM use of the sweep's
type changed, not whether a sweep is required at all.

### Good Example / Bad Example

Good: Treating the purge-and-alignment gates as fully required, exact
copies of Bot 5's own Steps 2-3, while remembering the sweep's TYPE
field plays no role in direction here. Bad: Assuming the purge step
was removed or weakened because direction now comes from elsewhere.

### What to Look Out For

- The purge (sweep detection) and zone-alignment gates are IDENTICAL
  to Bot 5's — not removed, not weakened.
- The sweep's own TYPE (buy-side/sell-side) is detected but NEVER read
  for direction in Bot 6 — a genuinely unused field for this purpose,
  unlike Bot 5's OLD (pre-fix) logic.
- `last_sweep["sweep_price"]` IS still used later, for the stop-loss
  calculation (BOT6-08) — it isn't entirely unused, just not for
  direction.

### Common Mistakes

Assuming the purge step lost importance once it stopped deciding
direction is the most common misread of this stage — it remains a
hard, required gate, just no longer the direction source.

### Key Takeaways

1. Bot 6's purge-detection and zone-alignment gates are identical to
   Bot 5's — both still hard, required `return None` points.
2. The purge's own TYPE is detected but never read for direction in
   Bot 6 — a genuinely unused field for that specific purpose.
3. The purge's PRICE is still used later, for the stop-loss
   calculation (BOT6-08) — the purge itself still matters.

### Practice Drill

Given six 15M sweep/zone-alignment scenarios (provided in Practise —
the same set used in BOT5-03's drill), determine the gate outcome for
each, confirming it matches Bot 5's result for the same inputs.

### Scenario Challenge

A trader argues that since Bot 6 doesn't use the sweep's type for
direction, the purge step must be optional. Using this lesson's exact
gate list, explain why that's wrong.

### Mini Quiz

Q1 (True/False): Bot 6 no longer requires a 15M liquidity sweep at
all, since direction comes from elsewhere now.
Answer: False — the sweep and zone-alignment gates are still fully
required, identical to Bot 5's; only the sweep's TYPE is unused for
direction.

Q2 (Multiple choice): What does Bot 6 still use the sweep's PRICE for?
(a) Deciding direction
(b) The stop-loss calculation (BOT6-08)
(c) The entry-price calculation
(d) Nothing — it's entirely unused

Answer: (b).

### Flashcards

- Front: Is the 15M purge step still required in Bot 6? Back: Yes —
  identical gates to Bot 5's (sweep detected, zone aligned); only the
  sweep's TYPE is no longer read for direction.
- Front: What is the purge's PRICE still used for in Bot 6? Back: The
  stop-loss calculation (BOT6-08) — `last_sweep["sweep_price"]` is the
  purge extreme the stop sits beyond.

### Reflection

Why might keeping the purge as a pure timing/zone-alignment gate,
while sourcing direction elsewhere, preserve more of what worked about
Bot 5's original design than removing the purge step entirely would?

### Mastery Criteria

Correctly determine the gate outcome for all six practice-drill
scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this purge/alignment gate
directly precedes BOT6-04's confirmation-candle search.

### Bot Connection

Verified against `JeafxSMCv2Bot.analyze()` Steps 2-3 in
`bot_strategies.py` — identical to Bot 5's own Steps 2-3, including
the explicit code comment explaining why the purge remains required.

---

## BOT6-04 — Setup: The Momentum Confirmation Candle, Identical to Bot 5

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT6-03, BOT5-04
**Learning objectives:** Confirm Bot 6's 5M confirmation-candle test
is identical to Bot 5's — momentum threshold, re-entry requirement,
and first-match-wins loop behavior all included.

### Why This Matters

Like BOT6-02, this stage exists to confirm precisely what did NOT
change between Bot 5 and Bot 6, before BOT6-05 covers what did.

### Core Teaching

**Plain-English explanation.** Over the last five 5-minute candles,
Bot 6 looks for one with a strong body (meaningfully larger than
recent average) that closes back inside the aligned zone — the exact
same test Bot 5 uses. The first candle in the window satisfying both
conditions wins; the loop stops there.

**Technical explanation.** `recent_5m = candles_5m[-5:]`; for each `c`
in this window: `body_size = abs(c.close - c.open)`; `avg_body =
mean(candles_5m[-20:] body sizes)`; `if body_size > avg_body * 1.5:
if aligned_zone.bottom <= c.close <= aligned_zone.top:
confirmation_candle = c; break`. `if not confirmation_candle: return
None` (gate 4). Every detail here — the `1.5` threshold, the `break`
on first match, the re-entry check against `aligned_zone` — is
identical to Bot 5's own Step 4 (BOT5-04).

### Visual Model

See diagram: `visuals/bot6-04-identical-confirmation.svg` — Bot 5's
and Bot 6's confirmation-candle code shown side by side, every line
highlighted as identical, including the `break`-on-first-match
behavior (contrasted with Bot 4's last-match-wins loop, BOT4-04).

### Worked Example

Within the last five 5M candles, the second candle has a body 1.8x
the 20-candle average and closes inside the aligned zone — it's
accepted as `confirmation_candle`, and the loop stops there without
checking the remaining three candles, exactly as it would for Bot 5.

### Counterexample

A trader assumes Bot 6, being "v2," might use a LAST-match-wins loop
instead of Bot 5's first-match-wins one (the way Bot 4's pattern
search does). The real code shows no such change — Bot 6's loop
`break`s on the first qualifying candle, identical to Bot 5.

### Good Example / Bad Example

Good: Applying Bot 5's exact confirmation-candle test and first-
match-wins loop behavior directly to Bot 6, since both are identical.
Bad: Assuming Bot 6's "v2" status implies a different momentum
threshold or loop-match rule without verifying against source.

### What to Look Out For

- The momentum threshold (`> avg_body * 1.5`) and re-entry check are
  IDENTICAL to Bot 5's.
- The loop `break`s on the FIRST qualifying candle — same as Bot 5,
  the opposite of Bot 4's last-match-wins rule.
- This is gate 4 in both Bot 5's and Bot 6's pipelines — same position.

### Common Mistakes

Assuming any "v2" bot must differ from its predecessor at every step,
rather than verifying precisely which steps changed, remains the most
consequential mistake pattern across this bot's whole track.

### Key Takeaways

1. Bot 6's confirmation-candle test (momentum threshold, re-entry
   check, first-match-wins loop) is identical to Bot 5's.
2. This is gate 4 in both bots' pipelines.
3. Only BOT6-05's direction step is where Bot 5 and Bot 6 genuinely
   diverge — every step before it is a verified, identical copy.

### Practice Drill

Given five 5M candle scenarios with body-size and closing-price data
(provided in Practise — the same set used in BOT5-04's drill),
classify which set `confirmation_candle` for Bot 6, confirming each
outcome matches Bot 5's for the same inputs.

### Scenario Challenge

A trader assumes Bot 6's confirmation-candle loop keeps the LAST
qualifying candle, the way Bot 4's pattern search does. Using this
lesson's exact loop behavior, explain why that's wrong.

### Mini Quiz

Q1 (True/False): Bot 6's confirmation-candle loop keeps the LAST
qualifying candle in the 5-candle window.
Answer: False — it `break`s on the FIRST qualifying candle, identical
to Bot 5's first-match-wins behavior.

Q2 (Multiple choice): What momentum threshold must a candle's body
exceed to qualify?
(a) 1.0x the 20-candle average
(b) 1.2x the 20-candle average
(c) 1.5x the 20-candle average
(d) 2.0x the 20-candle average

Answer: (c).

### Flashcards

- Front: Is Bot 6's confirmation-candle test different from Bot 5's?
  Back: No — identical momentum threshold (1.5x), re-entry check, and
  first-match-wins loop behavior.
- Front: Which bot's pattern-search loop behaves OPPOSITE to Bot 6's
  (last-match instead of first-match)? Back: Bot 4 (BOT4-04) — Bot 6
  matches Bot 5's first-match-wins rule instead.

### Reflection

Having now confirmed three consecutive BOT6 stages (zone, purge,
confirmation) are identical to Bot 5's, what does that tell you about
how narrowly scoped Bot 6's real design change actually is?

### Mastery Criteria

Correctly classify all five practice-drill candle scenarios, confirming
each matches Bot 5's outcome for the same inputs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this confirmation candle is the
anchor BOT6-07's entry calculation references, and directly precedes
BOT6-05's direction step.

### Bot Connection

Verified against `JeafxSMCv2Bot.analyze()` Step 4 in
`bot_strategies.py` — identical to Bot 5's own Step 4, confirmed line
for line.

---

## BOT6-05 — Direction: Bot 2's CHoCH OR Bot 3's FVG+BOS, Either Sufficient

**Level:** 3
**Estimated study time:** 16 minutes
**Prerequisites:** BOT6-04, BOT2-04, BOT3-04, BOT5-03
**Learning objectives:** State Bot 6's real direction logic precisely
— two independent helper functions, either one sufficient, a genuine
conflict blocking the trade — and contrast it with Bot 5's single-
source 4H BOS.

### Why This Matters

This is Bot 6's one genuine mechanical difference from Bot 5, and the
entire reason this bot exists: a second, independent attempt to fix
Bot 5's own "often misses the price's direction" complaint, this time
by cross-checking TWO other bots' own direction calls instead of
reading a single higher-timeframe BOS.

### Core Teaching

**Plain-English explanation.** After the confirmation candle confirms
(BOT6-04), Bot 6 asks two questions: what does Bot 2's own 15M CHoCH
logic say the direction is, and what does Bot 3's own 1H-FVG-plus-
15M-BOS logic say? Either answer, by itself, is enough to trade on. If
only one of the two gives a clean answer, that one wins. If BOTH give
an answer and they genuinely DISAGREE (one says long, the other
short), that's treated as a real conflict — the trade is blocked
entirely, rather than guessing which of the two to trust. If NEITHER
gives an answer, there's no direction at all, and the trade is also
blocked.

**Technical explanation.** `choch_dir = _choch_direction_15m
(self.structure_detector, candles_15m)` — a new, standalone function
that reproduces Bot 2's own direction step exactly: a 15M CHoCH
(`bullish_choch`→`"long"`, `bearish_choch`→`"short"`, none or
unrecognized→`None`). `fvg_bos_dir = _fvg_bos_direction_1h_15m
(candles_1h, candles_15m)` — a second new, standalone function
reproducing Bot 3's own direction step exactly: an unmitigated 1H FVG
(`0.3 <= mitigated_percent <= 0.7`, status `ACTIVE`) whose `gap_type`
is confirmed by a same-direction 15M BOS. Then: `if choch_dir and
fvg_bos_dir and choch_dir != fvg_bos_dir: return None` (gate 5 — the
genuine-conflict case); `direction = choch_dir or fvg_bos_dir` (either
one, or both if they agree, is sufficient); `if not direction: return
None` (gate 6 — neither fired). Both helper functions are new,
STANDALONE module-level functions, deliberately NOT implemented by
calling `OrderBlockReversalBot.analyze()` or `FVGExpansionBot.
analyze()` directly — doing that would compute a full signal (zone,
entry, SL, targets, lot size) just to read one field off it, and would
wrongly make Bot 6 depend on Bot 2/3 *instances* existing. Bot 2's and
Bot 3's own inline `analyze()` logic is untouched by this change.

### Visual Model

See diagram: `visuals/bot6-05-either-sufficient-direction.svg` — two
independent direction checks (Bot 2's CHoCH, Bot 3's FVG+BOS) feeding
into a decision: both agree or only one fires → trade that direction;
both fire and disagree → blocked; neither fires → blocked.

### Worked Example

Bot 2's CHoCH logic returns `"long"`; Bot 3's FVG+BOS logic returns
`None` (no qualifying partially-mitigated FVG exists). Since only one
of the two fired, `direction = "long"` — Bot 6 proceeds using Bot 2's
call alone, with no conflict to check.

### Counterexample

Bot 2's CHoCH logic returns `"long"`; Bot 3's FVG+BOS logic
independently returns `"short"`. Both fired, and they genuinely
disagree — gate 5 triggers, and `analyze()` returns `None`, even
though every other gate (zone, purge, confirmation candle) had already
passed.

### Good Example / Bad Example

Good: Checking BOTH direction sources, using whichever one(s) fire,
and specifically checking for disagreement before accepting a single
fired source as reliable. Bad: Assuming any one fired direction source
is automatically safe to use without checking whether the OTHER
source, if it also fired, actively disagrees.

### What to Look Out For

- EITHER source firing is sufficient — this is NOT an AND requirement
  (an earlier version of this bot's design required both to fire
  independently, which proved too rare in live testing and was
  changed by direct follow-up correction).
- A genuine disagreement between the two sources (both fire, with
  different directions) is a hard block — treated as a real conflict,
  not "two votes" to weigh against each other.
- Neither source firing is also a hard block — there's no fallback
  direction logic beyond these two sources.
- Both helper functions are NEW, standalone functions — they do NOT
  call Bot 2's or Bot 3's own `analyze()` methods.

### Common Mistakes

Assuming Bot 6 requires BOTH Bot 2's CHoCH and Bot 3's FVG+BOS to
agree (an AND requirement) is the single most common misread of this
bot's real logic — the actual rule is EITHER sufficient, with
disagreement (not mere non-agreement) as the only block.

### Key Takeaways

1. Bot 6's direction comes from two independent helper functions —
   `_choch_direction_15m` (Bot 2's own logic) and
   `_fvg_bos_direction_1h_15m` (Bot 3's own logic) — not from a 4H BOS.
2. EITHER source firing is sufficient; a genuine disagreement between
   both (not mere silence from one) is the only direction-related
   block.
3. Both helper functions are new, standalone module-level functions —
   they do not invoke Bot 2's or Bot 3's own `analyze()` methods.

### Practice Drill

Given eight (choch_dir, fvg_bos_dir) value-pair scenarios (provided in
Practise, covering both-agree, only-one-fires, both-disagree, and
neither-fires cases), determine Bot 6's exact outcome for each.

### Scenario Challenge

A trader reviews a Bot 6 signal where the reasoning text shows
`Bot2 CHoCH=long, Bot3 FVG/BOS=—`. Using this lesson's exact rule,
explain why this is a valid long signal rather than an incomplete one.

### Mini Quiz

Q1 (True/False): Bot 6 requires BOTH Bot 2's CHoCH call and Bot 3's
FVG+BOS call to independently agree before producing a signal.
Answer: False — EITHER one firing is sufficient; only a genuine
disagreement between both (not simple non-agreement) blocks the
trade.

Q2 (Multiple choice): What happens when Bot 2's CHoCH call returns
`"long"` and Bot 3's FVG+BOS call returns `"short"`?
(a) Bot 6 trades long, since CHoCH is checked first
(b) Bot 6 trades short, since FVG+BOS is more precise
(c) Bot 6 returns `None` — a genuine conflict blocks the trade
(d) Bot 6 averages the two into a neutral signal

Answer: (c).

### Flashcards

- Front: What are Bot 6's two direction sources? Back:
  `_choch_direction_15m` (Bot 2's own 15M CHoCH logic) and
  `_fvg_bos_direction_1h_15m` (Bot 3's own 1H-FVG+15M-BOS logic) —
  either sufficient alone.
- Front: What blocks a Bot 6 signal on direction grounds? Back: Either
  BOTH sources firing with genuinely different directions, or NEITHER
  source firing at all — simple silence from one source, with the
  other firing, does NOT block it.

### Reflection

Why might requiring EITHER of two independent direction sources
(rather than BOTH) produce more live signals, while still blocking
trades on a genuine disagreement rather than ever guessing between two
contradicting reads? What does the "too rare in live testing" history
behind this exact design suggest about over-requiring confirmation?

### Mastery Criteria

Correctly determine Bot 6's outcome for all eight practice-drill
(choch_dir, fvg_bos_dir) scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the direct point of
contrast against BOT5-03's single-source 4H BOS direction logic.

### Bot Connection

Verified against `_choch_direction_15m`, `_fvg_bos_direction_1h_15m`,
and `JeafxSMCv2Bot.analyze()` Step 5 in `bot_strategies.py` — the
conflict check, the `or` fallback, and both helper functions' own
docstrings (explicitly naming them as reproductions of Bot 2's and Bot
3's own direction steps) quoted directly from source.

---

## BOT6-06 — Invalidation: The Six Conditions That Return No Signal

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT6-02 through BOT6-05, C2-09
**Learning objectives:** List, in order, all six points in Bot 6's
pipeline where it returns no signal, and place Bot 6's gate count in
the complete six-bot comparison.

### Why This Matters

Bot 6 ties Bot 5's gate count at six — but the SHAPE of that count is
genuinely different: Bot 5's two direction-related gates sit EARLY
(right after zone refinement, before the purge); Bot 6's two
direction-related gates sit LATE (after the purge AND the confirmation
candle). Knowing the count alone isn't enough — the ORDER matters too.

### Core Teaching

**Plain-English explanation.** Reading through
`JeafxSMCv2Bot.analyze()` in order, there are exactly six points where
it stops and returns no signal: (1) no refined (ACTIVE + `test_count
<= 1`) 1H zone exists (BOT6-02); (2) no 15M liquidity sweep is
detected at all (BOT6-03); (3) none of the refined zones align with
the sweep's price (BOT6-03); (4) no 5M confirmation candle satisfies
both momentum and re-entry (BOT6-04); (5) Bot 2's CHoCH call and Bot
3's FVG+BOS call both fired and genuinely disagree (BOT6-05); (6)
neither call fired at all (BOT6-05).

**Technical explanation.** This ties Bot 5's six-gate count exactly,
but in a different shape: Bot 5's gates 2-3 (4H BOS existence, BOS
type recognition) sit between zone refinement and the purge; Bot 6's
corresponding direction gates (5-6) sit AFTER the purge, zone
alignment, AND confirmation candle — the full six-bot comparison now
reads: Bot 1 (four), Bot 2 (three), Bot 3 (two), Bot 4 (eleven), Bot 5
(six, direction gates early), Bot 6 (six, direction gates late). Gates
1-4 here are identical in position and mechanics to Bot 5's own gates
1 and 4-6 (BOT6-02 through BOT6-04) — Bot 5's old gates 2-3 are simply
absent from Bot 6 entirely, replaced by gates 5-6 appearing much later
in the function.

### Visual Model

See diagram: `visuals/bot6-06-six-gates-late-direction.svg` — Bot 5's
and Bot 6's six-gate sequences shown side by side at true relative
position: Bot 5's direction gates highlighted near the START, Bot 6's
direction gates highlighted near the END — same total count, visibly
different shape.

### Worked Example

A setup passes gate 1 (refined zone exists), gate 2 (sweep detected),
gate 3 (zone aligned), and gate 4 (confirmation candle found). Bot 2's
CHoCH call returns `"long"`; Bot 3's FVG+BOS call returns `None`. Gate
5 doesn't trigger (no disagreement, since only one source fired); gate
6 doesn't trigger (`direction = "long"` is set) — the pipeline
proceeds to BOT6-07's entry calculation.

### Counterexample

The same setup passes gates 1-4 identically, but Bot 2's CHoCH call
returns `"long"` while Bot 3's FVG+BOS call independently returns
`"short"`. Gate 5 fires — a genuine conflict — and `analyze()` returns
`None`, even though the zone, purge, and confirmation candle were all
already confirmed.

### Good Example / Bad Example

Good: Checking gates 1-4 first (identical to most of Bot 5's own
pipeline), then specifically checking for a genuine CHoCH/FVG+BOS
disagreement (gate 5) before accepting a lone fired source. Bad:
Assuming Bot 6's gate list matches Bot 5's gate ORDER just because the
total COUNT matches.

### What to Look Out For

- Bot 6 has SIX real gates — tied with Bot 5 for second-most in this
  curriculum, behind only Bot 4's eleven.
- The two direction-related gates (5-6) sit LATE in Bot 6's pipeline —
  after the purge and confirmation candle — unlike Bot 5's
  corresponding gates, which sit early.
- Gates 1-4 are otherwise identical in mechanics AND position to Bot
  5's own gates 1 and 4-6.

### Common Mistakes

Assuming Bot 6's gate list mirrors Bot 5's gate ORDER, simply because
both total six, is the most consequential mistake specific to this
bot — the count matches, but the direction-related gates have moved
from early to late in the sequence.

### Key Takeaways

1. Bot 6 has SIX real gates — tied with Bot 5, both behind only Bot
   4's eleven.
2. Unlike Bot 5 (direction gates early, right after zone refinement),
   Bot 6's direction gates (5-6) sit LATE — after the purge, zone
   alignment, AND confirmation candle.
3. Gates 1-4 are otherwise identical in both mechanics and position
   to Bot 5's own gates 1 and 4-6.

### Practice Drill

Given nine scenario summaries (provided in Practise) describing which
of the six gates pass or fail — including at least one CHoCH/FVG+BOS
disagreement — determine the outcome for each.

### Scenario Challenge

A trader familiar with Bot 5's gate order assumes Bot 6's gate 2 must
also be a direction check. Using this lesson's exact gate list, explain
what Bot 6's actual gate 2 checks instead, and where its direction
gates really sit.

### Mini Quiz

Q1 (True/False): Bot 6's and Bot 5's direction-related gates occupy
the same position in each bot's respective pipeline.
Answer: False — Bot 5's direction gates sit early (right after zone
refinement); Bot 6's sit late (after the purge and confirmation
candle) — the total count ties at six, but the shape differs.

Q2 (Multiple choice): How many real gates does Bot 6's pipeline have?
(a) Four
(b) Five
(c) Six
(d) Eleven

Answer: (c).

### Flashcards

- Front: How many real gates does Bot 6's pipeline have, and how does
  that compare to the other bots? Back: Six — tied with Bot 5, both
  behind only Bot 4's eleven (Bot 1: four, Bot 2: three, Bot 3: two).
- Front: How does Bot 6's gate ORDER differ from Bot 5's, despite the
  same total count? Back: Bot 5's direction gates sit early (right
  after zone refinement); Bot 6's sit late (after the purge AND
  confirmation candle).

### Mastery Criteria

Correctly determine the outcome for all nine practice-drill scenarios.

### Reflection

Why might moving the direction check to the END of the pipeline
(after the purge and confirmation candle already fired) change how
often a fully-formed-looking setup gets blocked, compared to Bot 5's
early direction check? Which design would you expect to "waste" more
computation on setups that get blocked on direction alone?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the assembly point for
BOT6-02 through BOT6-05, and completes the six-bot gate-count
comparison begun in BOT1-05.

### Bot Connection

Every gate here is a direct `return None` line inside
`JeafxSMCv2Bot.analyze()` — confirmed as six by tracing the function's
complete control flow in `bot_strategies.py`, and contrasted directly
against Bot 5's own six-gate list (BOT5-05) to confirm the ordering
difference.

---

## BOT6-07 — Entry: FVG-or-Confirmation-Candle, Identical to Bot 5

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT6-06, BOT5-06
**Learning objectives:** Confirm Bot 6's entry-price SOURCE rule is
identical to Bot 5's, cross-checked against Bot 6's own `direction`
value (BOT6-05) instead of a 4H BOS.

### Why This Matters

This is the LAST stage before BOT6-08's stop/target calculations, and
it's another "confirm what stayed the same" stage — the entry logic
itself is unchanged from Bot 5's; only the `direction` variable it
cross-checks against comes from a different place.

### Core Teaching

**Plain-English explanation.** After direction is decided (BOT6-05),
Bot 6 checks whether a Fair Value Gap formed on or after the
confirmation candle, matching that direction. If one did, entry price
is the FVG's own midpoint. If not, entry price falls back to the
confirmation candle's own midpoint (average of its open and close) —
exactly the same conditional source choice Bot 5 uses.

**Technical explanation.** `recent_fvgs = fvg_detector.detect_fvg
(candles_5m[-10:])`; for each `f`: `if f.candle1.timestamp >=
confirmation_candle.timestamp: if f.gap_type == "bullish" and
direction == "long": valid_fvg = f; break; elif f.gap_type ==
"bearish" and direction == "short": valid_fvg = f; break`. This is
line-for-line identical to Bot 5's own Step 6 (BOT5-06) — the only
difference is that `direction` here comes from BOT6-05's
CHoCH-or-FVG+BOS consensus, not Bot 5's 4H BOS. Then: `if valid_fvg:
entry_price = (valid_fvg.top + valid_fvg.bottom) / 2; else:
entry_price = (confirmation_candle.open + confirmation_candle.close) /
2` — identical to Bot 5. Bot 6's own code comment confirms this
directly: "identical structure to Bot 5, just cross-checked against
`direction`."

### Visual Model

See diagram: `visuals/bot6-07-entry-source-identical.svg` — the same
decision-diamond diagram as BOT5-06's, relabeled to show the
`direction` input now comes from BOT6-05's consensus rather than a 4H
BOS, with every downstream calculation otherwise identical.

### Worked Example

A confirmation candle fires, `direction = "long"` (from BOT6-05), and
a matching bullish FVG forms on the next 5M candle. `valid_fvg` is
set; entry price is that FVG's own midpoint — exactly the calculation
Bot 5 would perform for the same inputs.

### Counterexample

A trader assumes that because Bot 6's direction source changed
(BOT6-05), its entry-price calculation must also have changed. The
real code shows the entry logic itself — the FVG search, the
midpoint formulas — is completely unchanged; only the `direction`
value being cross-checked against comes from a different source.

### Good Example / Bad Example

Good: Applying Bot 5's exact entry-price logic directly to Bot 6,
substituting only the `direction` value's source (BOT6-05 instead of
BOT5-03). Bad: Assuming Bot 6's FVG search window, midpoint formulas,
or loop-match behavior differ from Bot 5's without verifying against
source.

### What to Look Out For

- The FVG search and both midpoint formulas are IDENTICAL to Bot 5's.
- The loop `break`s on the FIRST matching FVG — same as Bot 5.
- The `direction` value cross-checked here comes from BOT6-05, not a
  4H BOS — the only genuine difference from Bot 5's equivalent step.

### Common Mistakes

Assuming Bot 6's entry-price calculation changed just because its
direction SOURCE changed is the most common mistake at this stage —
the entry logic itself is a verified, unchanged copy of Bot 5's.

### Key Takeaways

1. Bot 6's entry-price logic (FVG search, both midpoint formulas,
   first-match-wins loop) is identical to Bot 5's.
2. The only difference is which variable's value is being
   cross-checked — Bot 6 uses BOT6-05's consensus `direction`, not a
   4H BOS.
3. Bot 6's own code comment confirms this explicitly: "identical
   structure to Bot 5."

### Practice Drill

Given four confirmation-candle/FVG-presence scenarios (provided in
Practise — the same set used in BOT5-06's drill), calculate the exact
entry price Bot 6 would use for each, confirming each matches Bot 5's
result for the same inputs.

### Scenario Challenge

A trader assumes Bot 6's FVG search window is wider than Bot 5's,
since it's a newer bot. Using this lesson's exact source comparison,
show why the window (`candles_5m[-10:]`) is identical.

### Mini Quiz

Q1 (True/False): Bot 6's entry-price calculation differs from Bot 5's.
Answer: False — the FVG search and both midpoint formulas are
identical; only the `direction` value's source differs.

Q2 (Multiple choice): What does Bot 6 cross-check a candidate FVG's
`gap_type` against?
(a) The 15M sweep's own type
(b) A 4H BOS reading
(c) BOT6-05's consensus `direction` value
(d) Bot 4's pairing rule

Answer: (c).

### Flashcards

- Front: Is Bot 6's entry-price logic different from Bot 5's? Back:
  No — identical FVG search and midpoint formulas; only the
  `direction` value's source (BOT6-05, not a 4H BOS) differs.
- Front: What confirms Bot 6's entry logic is an unchanged copy of Bot
  5's? Back: Bot 6's own code comment states it directly: "identical
  structure to Bot 5, just cross-checked against `direction`."

### Reflection

Having now confirmed that Bot 6's zone, purge, confirmation-candle,
AND entry-price logic are all unchanged copies of Bot 5's, what does
that suggest about how much of a real trading-logic change BOT6-05's
direction swap actually represents, relative to the size of this
bot's entire pipeline?

### Mastery Criteria

Correctly calculate entry price for all four practice-drill scenarios,
confirming each matches Bot 5's result for the same inputs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this entry price is the anchor
BOT6-08's stop and target calculations are measured from.

### Bot Connection

Verified against `JeafxSMCv2Bot.analyze()` Steps 6-7 in
`bot_strategies.py` — identical to Bot 5's own Steps 6-7, including
the explicit "identical structure to Bot 5" code comment.

---

## BOT6-08 — Management: Strict SL and the Fixed 2:1 Reported Target

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT6-07, BOT5-07, C8-02
**Learning objectives:** State Bot 6's stop and target formulas —
identical to Bot 5's, post-fix — and confirm Bot 6 never had Bot 5's
`NameError` crash bug to begin with.

### Why This Matters

BOT5-07 documented a genuine crash bug in Bot 5's code, fixed while
this curriculum was being authored. Bot 6 shares the exact same
target-calculation structure — worth explicitly confirming Bot 6 was
built CORRECTLY from the start, never carrying that bug at all.

### Core Teaching

**Plain-English explanation.** Bot 6's stop sits just beyond the
purge's own extreme price, with a buffer sized as 20% of the
confirmation candle's own high-to-low range — identical to Bot 5's
formula. Its REPORTED take-profit is TP2 of a multi-target split, a
fixed 2:1 regardless of the `rr_ratio=5.0` passed in — the same
finding already confirmed for Bots 1, 2, 3, and 5.

**Technical explanation.** `purge_extreme = last_sweep["sweep_price"]`;
`buffer = abs(confirmation_candle.high - confirmation_candle.low) *
0.2`; `sl_price = purge_extreme - buffer` (long) or `+ buffer` (short)
— identical to Bot 5's formula (BOT5-07), using the SAME
`last_sweep["sweep_price"]` this lesson's BOT6-03 companion already
confirmed is still computed, just not read for direction. Unlike Bot
5's ORIGINAL code, Bot 6's target-calculation step correctly builds
`entry = {"entry_price": entry_price, "direction": direction}` BEFORE
calling `calculate_targets` — `targets = self.entry_engine.
calculate_targets(entry, sl, rr_ratio=min_rr_ratio if min_rr_ratio is
not None else 5.0)` — Bot 6 was authored AFTER Bot 5's crash bug was
found and fixed, so it never carried that mistake. `calculate_position_
risk(setup_quality=1.3)` and `confidence=0.88` are both identical to
Bot 5 — tied for the highest values of any bot in this curriculum.
`take_profit=targets["tp1"]`, `take_profit_2=targets["tp2"]`,
`take_profit_3=targets["tp3"]` — the SAME three-way split as Bot 5,
with `tp2`'s 2:1 multiplier hardcoded in `EntryExitEngine.
calculate_targets`, independent of the `rr_ratio=5.0` passed in.

### Visual Model

See diagram: `visuals/bot6-08-no-crash-bug.svg` — Bot 5's
before/after bug-fix timeline (BOT5-07) shown alongside Bot 6's
timeline, which has only one state: "correct from the start — authored
after the fix was already known."

### Worked Example

A confirmed purge's extreme price is 1.0838, and the confirmation
candle's high-to-low range is 8 pips. The buffer is `8 * 0.2 = 1.6`
pips; the stop sits at roughly 1.0837.4 (a long) — the identical
calculation Bot 5 would perform for the same inputs. With entry at
1.0855 (BOT6-07), the reported TP2 sits at a fixed 2:1 — about 35.2
pips above entry, not the 88 pips a naive 5:1 read of the "4-6R
target" framing might suggest.

### Counterexample

A trader assumes Bot 6, being authored after Bot 5's crash bug was
found, must contain some OTHER, different bug of its own. Direct
inspection of `JeafxSMCv2Bot.analyze()` shows the `entry` dict is
correctly constructed from the very first version of this bot's
code — there is no equivalent crash bug anywhere in Bot 6.

### Good Example / Bad Example

Good: Verifying Bot 6's `entry` dict construction directly against
source, rather than assuming either "it must be fine since it's
newer" or "it must share Bot 5's exact bug since the logic is
otherwise identical." Bad: Assuming Bot 6 is bug-for-bug identical to
Bot 5's pre-fix state without checking.

### What to Look Out For

- Bot 6's stop buffer (20% of the confirmation candle's range) is
  identical to Bot 5's POST-FIX formula.
- Bot 6 never had Bot 5's `NameError` crash bug — its `entry` dict is
  correctly constructed from this bot's very first version.
- The REPORTED take-profit (`tp2`) is a fixed 2:1, exactly like Bots
  1, 2, 3, and 5 — the `rr_ratio=5.0` passed in only ever reaches
  `tp3`, never reported.

### Common Mistakes

Assuming Bot 6 must share Bot 5's exact crash bug, simply because so
much of its other logic is a verified identical copy, is the most
consequential mistake at this stage — the bug was specific to Bot 5's
ORIGINAL authoring, fixed before Bot 6 was ever written.

### Key Takeaways

1. Bot 6's stop buffer (20% of the confirmation candle's range) is
   identical to Bot 5's post-fix formula.
2. Bot 6 never carried Bot 5's `NameError` crash bug — verified
   directly from its own, correctly-constructed `entry` dict.
3. Its REPORTED take-profit (`tp2`) is a fixed 2:1, the same finding
   as Bots 1, 2, 3, and 5 — the passed `rr_ratio=5.0` only reaches
   `tp3`, never reported.

### Practice Drill

Given three confirmed purge/confirmation-candle scenarios (provided in
Practise — the same set used in BOT5-07's drill), calculate the exact
stop price, stop distance, and the actual (fixed 2:1) TP2 target for
each, confirming each matches Bot 5's result for the same inputs.

### Scenario Challenge

A developer reports that Bot 6 "probably has the same crash bug Bot 5
had, since the logic looks identical." Using this lesson's exact
source verification, explain why that assumption is wrong.

### Mini Quiz

Q1 (True/False): Bot 6 contains the same `NameError` crash bug that
Bot 5 originally had.
Answer: False — Bot 6's `entry` dict is correctly constructed from its
very first version; it was authored after Bot 5's bug was already
found and fixed.

Q2 (Multiple choice): What is Bot 6's actual reported take-profit
multiplier?
(a) A fixed 1:1
(b) A fixed 2:1
(c) The passed `rr_ratio` (5:1 by default)
(d) A fixed 3:1

Answer: (b).

### Flashcards

- Front: Does Bot 6 share Bot 5's original crash bug? Back: No — its
  `entry` dict is correctly constructed from the start; the bug was
  specific to Bot 5's original authoring, already fixed before Bot 6
  was written.
- Front: What is Bot 6's REPORTED take-profit multiplier? Back: A
  fixed 2:1 (`tp2`) — the same finding as Bots 1, 2, 3, and 5; the
  passed `rr_ratio=5.0` only ever reaches `tp3`, never reported.

### Reflection

What does it tell you about reading real code carefully that a bot
built AFTER a known crash bug, sharing almost all of the buggy bot's
own logic, still needed its own independent verification rather than
being assumed safe by association?

### Mastery Criteria

Correctly calculate stop, distance, and the actual TP2 target for all
three practice-drill scenarios, confirming each matches Bot 5's
result for the same inputs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds BOT6-09's full
pipeline walkthrough.

### Bot Connection

Verified against `JeafxSMCv2Bot.analyze()` Steps 8-9 in
`bot_strategies.py` — the `* 0.2` buffer, the correctly-constructed
`entry` dict, `setup_quality=1.3`, and the hardcoded `tp2` multiplier
all quoted directly from source, confirmed absent of any `NameError`-
style defect.

---

## BOT6-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 17 minutes
**Prerequisites:** BOT6-01 through BOT6-08
**Learning objectives:** Apply every real stage of Bot 6's six-gate
pipeline, in order, to one continuous scenario, correctly sourcing
direction from Bot 2's CHoCH or Bot 3's FVG+BOS rather than a 4H BOS.

### Why This Matters

Same discipline as the five earlier Practice lessons, now applied to
Bot 6's pipeline — identical in structure to Bot 5's own practice
exercise (BOT5-09), but with direction sourced from two OTHER bots'
own logic instead of a single 4H BOS reading.

### Core Teaching

**Plain-English explanation.** Given a full 1H+15M+5M scenario (no 4H
data at all), work through Bot 6's pipeline in order: find a refined
zone (ACTIVE, `test_count <= 1`, BOT6-02), detect a 15M sweep and
align it with the first matching refined zone (BOT6-03), find the
first qualifying 5M confirmation candle (BOT6-04), determine direction
from Bot 2's CHoCH call or Bot 3's FVG+BOS call — either sufficient,
disagreement blocks (BOT6-05), determine entry price from the matching
FVG or the confirmation candle itself (BOT6-07), and calculate the
strict stop and the actual fixed-2:1 TP2 target (BOT6-08).

**Technical explanation.** This exercise mirrors
`JeafxSMCv2Bot.analyze()`'s real control flow — six gates, two
first-match-wins loops (zone alignment, confirmation candle), a
two-source direction consensus check, and a conditional entry-price
SOURCE choice, ending in the same target-calculation structure Bot 5
uses (correctly, with no crash-bug history of its own).

### Visual Model

See diagram: `visuals/bot6-09-full-pipeline-worksheet.svg` — a
six-row worksheet mirroring `analyze()`'s real control flow, with the
direction row split into two sub-columns (Bot 2's CHoCH, Bot 3's
FVG+BOS) and a note on how they combine.

### Worked Example

A full worked scenario (provided in Practise) walks a 1H/15M/5M chart
set through the whole pipeline — a refined zone with `test_count=0`,
a 15M sweep aligning with it, a qualifying 5M confirmation candle,
Bot 2's CHoCH call returning `"long"` (Bot 3's FVG+BOS call returning
`None`), a matching FVG setting the entry price, and the stop/target
calculation — ending with the exact same signal the real
`JeafxSMCv2Bot.analyze()` would now compute for that data.

### Counterexample

A trader completes the exercise but computes a 4H BOS for direction,
the way they would for Bot 5. Since `JeafxSMCv2Bot.analyze()` never
reads `candles_4h` at all, this input is simply irrelevant — their
answer must instead come from Bot 2's and Bot 3's own direction
helpers, applied to the 15M and 1H data already provided.

### Good Example / Bad Example

Good: Checking a zone's actual `test_count` before treating it as
eligible, correctly evaluating BOTH direction sources before combining
them, and checking specifically for disagreement rather than requiring
both to agree. Bad: Computing a 4H BOS that this bot never uses, or
requiring both direction sources to agree when either alone is
sufficient.

### What to Look Out For

- The refinement test (`test_count <= 1`) must be checked before
  anything else — identical to Bot 5's requirement.
- Both search loops (zone alignment, confirmation candle) `break` on
  the FIRST match — don't apply Bot 4's last-match-wins rule here.
- Direction requires evaluating BOTH `_choch_direction_15m` and
  `_fvg_bos_direction_1h_15m` — not just one — to correctly determine
  whether they agree, disagree, or only one fired.
- There is no `candles_4h` input anywhere in this exercise.

### Common Mistakes

Computing a 4H BOS for direction (an input this bot never reads at
all), or requiring both direction sources to independently agree
rather than checking only for disagreement, are the two most common
cross-bot mix-ups this exercise exists to catch.

### Key Takeaways

1. Bot 6's full pipeline has six real gates and two first-match-wins
   loops — the same total gate count as Bot 5, with a different shape
   (BOT6-06).
2. Direction requires evaluating BOTH `_choch_direction_15m` and
   `_fvg_bos_direction_1h_15m`, using EITHER one that fires and
   checking only for genuine disagreement.
3. This exercise uses the correctly-constructed target calculation
   Bot 6 has always had — no bug-fix history, unlike Bot 5's.

### Practice Drill

Given a full chart scenario (provided in Practise) with 1H, 15M, and
5M data, work through the complete pipeline to produce the exact
entry, stop, and TP2 target Bot 6's code would output.

### Scenario Challenge

Given two scenarios (provided in Practise) that differ only in
whether Bot 3's FVG+BOS call agrees or disagrees with Bot 2's CHoCH
call, work both through completely and show how that single difference
changes the outcome (signal vs. `None`).

### Mini Quiz

Q1 (True/False): This exercise requires computing a 4H BOS to
determine direction, the same as Bot 5's exercise (BOT5-09).
Answer: False — Bot 6 never reads `candles_4h`; direction comes
entirely from Bot 2's and Bot 3's own 15M/1H-based direction helpers.

Q2 (Multiple choice): What must be true for this exercise's direction
step to produce `None`?
(a) Only one of the two sources fires
(b) Both sources fire and agree
(c) Both sources fire and disagree, OR neither fires at all
(d) Bot 2's source fires but Bot 3's does not

Answer: (c).

### Flashcards

- Front: How many real gates does Bot 6's pipeline have, and how does
  the shape compare to Bot 5's? Back: Six — tied with Bot 5's count,
  but Bot 6's two direction gates sit LATE (after the purge and
  confirmation candle), not early.
- Front: What two functions does this exercise's direction step
  require evaluating? Back: `_choch_direction_15m` (Bot 2's own logic)
  and `_fvg_bos_direction_1h_15m` (Bot 3's own logic) — either
  sufficient, disagreement blocks.

### Mastery Criteria

Correctly produce the exact entry, stop, and TP2 target for the
practice-drill scenario, and correctly show the outcome change in the
direction-agreement comparison exercise.

### Reflection

Having now worked through both Bot 5's and Bot 6's full pipelines by
hand, which bot's direction logic would you trust more in a live
market, and why — a single higher-timeframe BOS, or a consensus of two
other bots' own independently-computed calls?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT6-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`JeafxSMCv2Bot.analyze()`'s real control flow — no step here exists
that isn't a real line of code in `bot_strategies.py`.

---

## BOT6-10 — Capstone: Full Bot 6 Decision Simulation, and the Six-Bot Roster

**Level:** 4
**Estimated study time:** 20 minutes
**Prerequisites:** BOT6-01 through BOT6-09, BOT1-10 through BOT5-10
**Learning objectives:** Given raw multi-timeframe chart data, produce
the complete Bot 6 decision, and correctly place Bot 6 within a
complete, accurate comparison across all six of this platform's bots.

### Why This Matters

This capstone closes out the entire Bot Specializations track,
platform-wide. Beyond producing Bot 6's own complete decision, it
requires holding an accurate, verified picture of all SIX bots
together — including the genuinely different shape of Bot 6's
gate list relative to Bot 5's, despite their matching count.

### Core Teaching

**Plain-English explanation.** Given raw 1H, 15M, and 5M candle data
(no 4H at all), work the entire Bot 6 pipeline from scratch: find a
refined zone, detect a 15M sweep and align it with the first matching
zone, find the first qualifying confirmation candle, determine
direction from Bot 2's CHoCH call or Bot 3's FVG+BOS call (either
sufficient, disagreement blocks), determine entry price from the
FVG-or-candle source rule, and calculate the strict stop and the
actual fixed-2:1 target — or correctly stop at whichever of the six
BOT6-06 gates fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of
`JeafxSMCv2Bot.analyze()` — called only when `market_data` contains
`"1H"`, `"15M"`, and `"5M"` together (no `"4H"` requirement, unlike
Bot 5's invocation). A correct capstone answer matches every field of
the real `BotSignal` (confidence fixed at `0.88`, `setup_quality` 1.3,
reported take-profit a fixed 2:1 — all tied with Bot 5, not exceeding
it) or a precise `None` with the specific failing gate, out of six
possible.

### Visual Model

See diagram: `visuals/bot6-10-six-bot-summary.svg` — a single summary
table across all six bots: timeframes, real gate count AND gate
shape (early-direction vs. late-direction vs. no-direction-gate),
setup-quality multiplier, fixed/conditional confidence, and each bot's
own characteristic bad-loss pattern — the complete, verified picture
this whole platform-wide track has been building toward.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 1H, 15M,
and 5M data. Working the complete pipeline: a refined zone
(`test_count=0`), a 15M sweep aligning with it, a qualifying 5M
confirmation candle, Bot 2's CHoCH call returning `"long"` with Bot
3's FVG+BOS call agreeing, a matching FVG setting a long entry, a stop
20% of the confirmation candle's range beyond the sweep's extreme, and
the actual fixed-2:1 TP2 target at 0.88 confidence — matching what the
real `JeafxSMCv2Bot.analyze()` would output.

### Counterexample

A different capstone scenario supplies raw data where every condition
looks favorable except Bot 2's CHoCH call returns `"short"` while Bot
3's FVG+BOS call independently returns `"long"` — a genuine
disagreement. The correct capstone answer is an explicit `None` at the
direction-conflict gate (BOT6-06, gate 5), regardless of how clean the
zone, purge, and confirmation candle otherwise look.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, correctly applying
both first-match-wins loops, correctly evaluating BOTH direction
sources before combining them, and correctly stating the fixed-2:1
target rather than a naive 5:1 read. Bad: Applying any other bot's
zone check, loop-match rule, direction-source count (4H BOS, or
requiring both sources to agree), or target assumption to what is
specifically a Bot 6 scenario.

### What to Look Out For

- A correct `None` answer, with the specific gate identified out of
  six, is just as complete a capstone answer as a full signal.
- Both search loops (zone alignment, confirmation candle) use
  first-match-wins — the opposite of Bot 4's rule.
- Direction requires checking BOTH sources, with EITHER sufficient and
  only genuine disagreement blocking — not a 4H BOS, and not an AND
  requirement.
- The reported take-profit is a fixed 2:1, exactly like Bots 1, 2, 3,
  and 5 — not the 5:1 the "4-6R target" framing might suggest.

### Common Mistakes

At this final capstone level, blending rules from different bots
(Bot 4's last-match-wins loop, Bot 5's 4H-BOS direction source, an
AND requirement between Bot 6's two direction sources) into a Bot 6
scenario is the most consequential mistake — each bot's mechanics are
genuinely its own, verified individually, never a shared template.

### Key Takeaways

1. The capstone works Bot 6's complete, six-gate pipeline from raw
   candle data — nothing pre-identified, and no 4H input anywhere.
2. A correctly-identified `None`, with the specific failing gate out
   of six, is just as valid a capstone answer as a complete signal.
3. Across the full six-bot roster, gate counts range from two (Bot 3)
   to eleven (Bot 4), confidence is fixed for five bots and
   conditional for one (Bot 2), and every reported take-profit that
   goes through `calculate_targets` is a fixed 2:1 — verified facts,
   not assumptions carried over from any single bot's docstring.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one producing `None`), work the complete Bot 6 pipeline for each.

### Scenario Challenge

Given a raw scenario where a confirmed sweep and confirmation candle
both check out, but Bot 2's CHoCH call and Bot 3's FVG+BOS call
independently disagree, produce the complete, correct pipeline output,
including exactly which gate this fails at.

### Mini Quiz

Q1 (True/False): Bot 6's reported take-profit reflects the 5.0
`rr_ratio` it passes into `calculate_targets`, the same way a naive
read of its "4-6R target" framing might suggest.
Answer: False — `tp2` is hardcoded to a fixed 2:1, exactly the same
verified finding as Bots 1, 2, 3, and 5.

Q2 (Multiple choice): Across all six bots in this curriculum, which
two are tied for the second-most real gates?
(a) Bot 1 and Bot 2
(b) Bot 2 and Bot 3
(c) Bot 5 and Bot 6
(d) Bot 4 and Bot 5

Answer: (c) — both have six, behind only Bot 4's eleven.

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 1H,
  15M, and 5M candle data — no zones, sweeps, confirmation candles,
  FVGs, or direction calls pre-identified, and no 4H data at all.
- Front: Across the full six-bot roster, what's the one shared,
  verified fact about every bot that calls `calculate_targets`? Back:
  Its reported take-profit (`tp2`) is always a fixed 2:1, regardless
  of the `rr_ratio` parameter passed in — true for Bots 1, 2, 3, 5,
  and 6 (Bot 4 never calls it at all).

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios, and correctly complete the six-bot summary
comparison.

### Reflection

Having completed all six Bot Specialization tracks, which single
finding — a hidden condition, an unused variable, a genuine crash bug,
a direction-source redesign, or a systemic docstring-vs-code gap —
most changed how you'd approach reading any new part of this codebase
going forward?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone completes the
entire six-bot Specialization track, and is the direct foundation for
any later capstone spanning all 6 bots together.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 6"
invocation of `JeafxSMCv2Bot.analyze()` in full — every real step,
gate, and output, verified directly against `bot_strategies.py`,
completing a verified, line-by-line account of all six of this
platform's real bot pipelines.
