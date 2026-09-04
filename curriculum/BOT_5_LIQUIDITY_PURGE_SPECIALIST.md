# BOT 5 — LIQUIDITY PURGE SPECIALIST MASTERY

Ten-lesson specialization track for Bot 5 (Jeafx SMC Style Specialist,
renamed "Liquidity Purge Specialist" per the Phase 1 rebrand, content
preserved) — verified line-by-line against
`backend/app/core/bot_strategies.py`'s `JeafxSMCBot`. This is the bot
whose code contained a genuine, confirmed crash bug (fixed while
authoring this track — see BOT5-07) and the fastest, most mechanically
strict pipeline of the five.

---

## BOT5-01 — Concept: The Jeafx Liquidity Purge Specialist

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT2-01, BOT4-01
**Learning objectives:** Explain Bot 5's philosophy — mechanical
zone refinement plus a strict liquidity-purge-then-confirmation
sequence — and name its real three-timeframe scope, the fastest of
any bot in this platform.

### Why This Matters

Bot 5 closes out the five-bot roster as the fastest and most
mechanically strict of all of them — a genuinely different balance
of speed and precision from Bots 1 through 4, worth understanding
precisely before diving into its exact rules.

### Core Teaching

**Plain-English explanation.** Bot 5 (Jeafx style) is built around
highly mechanical supply/demand zone refinement: it only trades
zones that are still genuinely "fresh" (barely tested), waits for a
rapid liquidity purge of retail stop-clusters on a fast timeframe, and
requires a specific, strong-momentum confirmation candle closing back
inside the zone before entering — an explosive structural move
expected to follow the purge.

**Technical explanation.** `JeafxSMCBot.analyze()` takes THREE candle
series — `candles_1h`, `candles_15m`, `candles_5m` — the same COUNT as
Bot 2, but a genuinely different, and faster, combination: Bot 5 is
the only bot in this platform whose pipeline reads 5-minute candle
data at all. Its `EntryExitEngine` defaults to `rr=4.0` and its
`RiskManager` uses `base_risk_percent=1.0`. Its `setup_quality=1.3`
(used in `calculate_position_risk`) and its `confidence=0.88` are both
the HIGHEST fixed values of any bot in this curriculum — reflecting
this bot's design intent of trading fewer, more mechanically strict
setups with higher conviction per trade.

### Visual Model

See diagram: `visuals/bot5-01-fastest-timeframe.svg` — all five bots'
timeframe sets shown together, with Bot 5's `candles_5m` input
highlighted as the single fastest timeframe read anywhere across the
entire platform.

### Worked Example

A trader used to Bot 1's multi-day hold or Bot 4's range-bound
patience finds Bot 5 signals firing on a much faster internal clock —
5-minute confirmation candles inside a 15-minute purge inside a 1-hour
zone — a genuinely faster rhythm than any of the other four bots.

### Counterexample

A trader assumes Bot 5, because it shares SMC vocabulary (zones, FVGs)
with Bot 1 and Bot 2, must share their risk profile too. Its 1.3
setup-quality multiplier and 0.88 fixed confidence are both real,
distinct, HIGHER values than any other bot — treating it as
"just another SMC bot" misses this deliberate design difference.

### Good Example / Bad Example

Good: Recognizing Bot 5 as the fastest, highest-conviction, most
mechanically strict bot of the five. Bad: Assuming any bot sharing
SMC vocabulary with another must also share its risk parameters or
timing.

### What to Look Out For

- Bot 5 is the only bot whose pipeline reads 5-minute candle data —
  the fastest timeframe used anywhere in this platform.
- Its `setup_quality` (1.3) and fixed `confidence` (0.88) are both the
  highest of any bot covered in this curriculum.
- "Liquidity Purge Specialist" is this bot's Phase 1 rebrand name —
  its underlying class is still `JeafxSMCBot` in the actual code.

### Common Mistakes

Assuming Bot 5's rebrand ("Liquidity Purge Specialist") reflects
different underlying logic from its original "Jeafx SMC Specialist"
description is a common mistake — the rebrand changed the name only;
the real `JeafxSMCBot` class and its logic are unchanged.

### Key Takeaways

1. Bot 5 reads 1H, 15M, and 5M data — the only bot whose pipeline
   touches 5-minute candles at all.
2. Its `setup_quality` (1.3) and fixed confidence (0.88) are both the
   highest of any bot in this curriculum.
3. "Liquidity Purge Specialist" is a rebrand of the same underlying
   `JeafxSMCBot` class — content preserved, name changed.

### Practice Drill

Given five real bot signal cards (provided in Practise), identify the
Bot 5 signal using only its timeframe inputs and its confidence/
setup-quality values.

### Scenario Challenge

A trader assumes Bot 5 and Bot 2 (both three-timeframe SMC bots) share
the same risk parameters. Using this lesson's specific values, explain
why that assumption is wrong.

### Mini Quiz

Q1 (True/False): Bot 5 is the only bot in this platform whose pipeline
reads 5-minute candle data.
Answer: True — `candles_5m` appears only in `JeafxSMCBot.analyze()`'s
signature among all five bots.

Q2 (Multiple choice): What is Bot 5's fixed reported confidence value?
(a) 0.70
(b) 0.78
(c) 0.82
(d) 0.88

Answer: (d) — the highest fixed confidence of any bot in this
curriculum.

### Flashcards

- Front: What three timeframes does Bot 5 use? Back: 1H, 15M, and 5M
  — the only bot whose pipeline reads 5-minute candle data.
- Front: What are Bot 5's setup-quality and confidence values, and how
  do they compare to the other bots? Back: 1.3 and 0.88 respectively
  — both the highest fixed values of any bot in this curriculum.

### Reflection

Now having seen all five bots' concepts, where would you place Bot 5
on a speed/conviction spectrum relative to the other four? What does
its combination of "fastest timeframe" and "highest confidence"
suggest about its design intent?

### Mastery Criteria

Correctly identify the Bot 5 signal card among the five in the
practice drill.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT5 lesson.

### Bot Connection

Verified against `JeafxSMCBot.__init__` and `analyze()`'s real
signature in `bot_strategies.py`.

---

## BOT5-02 — Identification: Refined Zones — Fresh, Not Just Active

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT5-01, C4-04, BOT1-04
**Learning objectives:** State Bot 5's zone-refinement test — ACTIVE
status AND a low test count — the strictest zone qualification of any
bot covered.

### Why This Matters

Bot 1 required ACTIVE + direction-matching zones (BOT1-04); Bot 2
added a 4H-then-1H fallback (BOT2-02). Bot 5 adds a THIRD, genuinely
stricter qualification: not just active, but barely tested at all —
worth knowing precisely, since it's the tightest zone filter in this
curriculum.

### Core Teaching

**Plain-English explanation.** Bot 5 doesn't just require a 1H order
block to be ACTIVE (C4-04) — it also requires the zone to have been
tested at most ONCE. A zone that price has already returned to and
reacted from multiple times is, by this bot's logic, no longer
"fresh" enough to trade, even if it's technically still active and
unmitigated. This is the "mechanical supply/demand refinement" its
docstring describes.

**Technical explanation.** `zones = detect_order_blocks(candles_1h,
swings_1h)`; `fresh_zones = [z for z in zones if z.status.name ==
"ACTIVE" and z.test_count <= 1]` — BOTH conditions required together.
If `fresh_zones` is empty, `analyze()` returns `None`. This is a
strictly narrower test than Bot 1's (ACTIVE + direction only, no test-
count check) or Bot 2's (ACTIVE, with a 4H-then-1H fallback, also no
test-count check) — Bot 5 is the only bot in this curriculum that
reads a zone's `test_count` field at all.

### Visual Model

See diagram: `visuals/bot5-02-test-count-filter.svg` — three 1H order
blocks, all ACTIVE: one untested (test_count=0), one tested once
(test_count=1), one tested three times (test_count=3) — only the
first two pass Bot 5's real filter; the third is excluded despite
still being technically ACTIVE.

### Worked Example

A 1H bullish order block is ACTIVE and has been tested exactly once
(`test_count = 1`) — it passes Bot 5's refinement filter and enters
`fresh_zones`.

### Counterexample

A different 1H bullish order block is also ACTIVE, but price has
reacted from it three separate times (`test_count = 3`). Even though
it's technically still ACTIVE by C4-04's status definition, it fails
Bot 5's stricter `test_count <= 1` requirement and is excluded from
`fresh_zones` entirely.

### Good Example / Bad Example

Good: Checking BOTH ACTIVE status AND `test_count <= 1` before
treating a zone as eligible for a Bot 5 setup. Bad: Treating any
ACTIVE zone as eligible, the way Bot 1 or Bot 2's simpler filters
would.

### What to Look Out For

- Bot 5 is the only bot in this curriculum that reads a zone's
  `test_count` field — none of the other four check it at all.
- BOTH conditions (ACTIVE AND `test_count <= 1`) are required
  together — an ACTIVE-but-well-tested zone still fails.
- This is a strictly narrower filter than either Bot 1's or Bot 2's
  zone-eligibility tests.

### Common Mistakes

Assuming any technically-ACTIVE zone is eligible for Bot 5, the way it
would be for Bot 1 or Bot 2, is the most common cross-bot misread —
Bot 5's real filter is meaningfully stricter.

### Key Takeaways

1. Bot 5 requires a zone to be BOTH ACTIVE and tested at most once
   (`test_count <= 1`) — the strictest zone filter of any bot covered.
2. Bot 5 is the only bot that reads a zone's `test_count` field at
   all.
3. An ACTIVE zone that's been tested multiple times is excluded
   entirely, even though it would still qualify for Bot 1 or Bot 2.

### Practice Drill

Given six 1H order blocks with varying status and test counts
(provided in Practise), determine which are eligible under Bot 5's
exact refinement test.

### Scenario Challenge

A trader sees an ACTIVE 1H order block that's been tested twice and
assumes it would qualify for a Bot 5 setup, since it worked for a Bot
1 or Bot 2 signal earlier. Using this lesson's exact test, explain why
it doesn't qualify for Bot 5.

### Mini Quiz

Q1 (True/False): Any ACTIVE 1H order block is eligible for a Bot 5
setup, the same as for Bot 1.
Answer: False — Bot 5 additionally requires `test_count <= 1`; an
ACTIVE zone tested more than once is excluded.

Q2 (Multiple choice): What field does Bot 5 check that none of the
other four bots check at all?
(a) `mitigated_percent`
(b) `test_count`
(c) `volume`
(d) `structure_type`

Answer: (b).

### Flashcards

- Front: What's Bot 5's exact zone-eligibility test? Back: ACTIVE
  status AND `test_count <= 1` — both required together.
- Front: What zone field is unique to Bot 5's logic among all five
  bots? Back: `test_count` — no other bot's `analyze()` reads it.

### Reflection

Why might a bot specifically designed around "explosive breaks after
a purge" (BOT5-01) want to avoid a well-tested, heavily-reacted-to
zone, even one that's technically still active?

### Mastery Criteria

Correctly classify all six practice-drill zones by Bot 5's exact
refinement test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this refined zone selection is
the foundation BOT5-03's alignment check builds on.

### Bot Connection

Verified against `JeafxSMCBot.analyze()` Step 1 in
`bot_strategies.py` — the `z.status.name == "ACTIVE" and
z.test_count <= 1` condition quoted directly from source.

---

## BOT5-03 — Context: The Tight-Tolerance Purge and First-Match Alignment

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT5-02, C3-04
**Learning objectives:** State Bot 5's tighter liquidity-sweep
tolerance, and explain its "first match wins" zone-alignment loop —
the opposite loop behavior from Bot 4's.

### Why This Matters

Bot 5's liquidity-purge detection uses a real, tighter tolerance
setting than the default — worth knowing precisely — and its
zone-alignment logic makes a real implementation choice (stopping at
the FIRST match) that directly contrasts with Bot 4's "last match
wins" behavior (BOT4-04).

### Core Teaching

**Plain-English explanation.** On the 15M timeframe, Bot 5 looks for a
liquidity sweep (C3-04) of equal highs/lows — but using a TIGHTER
price tolerance than the platform default, meaning it's more precise
about what counts as "equal" highs/lows in the first place. Once a
sweep is found, Bot 5 looks through its refined zones (BOT5-02) for
the FIRST one whose range contains the sweep's price — and stops
looking as soon as it finds one, unlike Bot 4's pattern-detection loop
(BOT4-04), which checks every candle in its window and lets a later
match overwrite an earlier one.

**Technical explanation.** `liq_detector = LiquidityDetector
(tolerance_pips=1.0)` — an explicit, tighter tolerance passed at
construction, contrasted with Bot 2's `LiquidityDetector()` default
(no explicit tolerance argument). `pools = detect_equal_highs_lows
(candles_15m, lookback=30)` — an explicit 30-candle lookback, also
distinct from Bot 2's. `sweeps = detect_liquidity_sweeps(pools,
candles_15m[-5:])`; if empty, return `None`. Then: `for z in
fresh_zones: if z.bottom <= sweep_price <= z.top: aligned_zone = z;
break` — the loop explicitly `break`s on the FIRST match, meaning if
multiple refined zones happen to contain the sweep price, the
EARLIEST one in `fresh_zones`'s order wins — the exact opposite
behavior from Bot 4's non-breaking Spring/Upthrust loop (BOT4-04),
where the LAST match wins.

### Visual Model

See diagram: `visuals/bot5-03-first-match-loop.svg` — two zones both
containing the same sweep price, with an arrow showing Bot 5's loop
stopping at the FIRST (earliest-listed) one — captioned "opposite of
Bot 4's non-breaking loop, where the LAST match wins."

### Worked Example

A confirmed 15M sweep's price falls inside TWO refined zones from
`fresh_zones` — an earlier one and a later one in the list. Bot 5's
loop checks them in order and `break`s at the first match — the
EARLIER zone becomes `aligned_zone`, and the later one is never
checked at all.

### Counterexample

A trader familiar with Bot 4's loop behavior (BOT4-04, last match
wins) assumes Bot 5 would also keep the later of two matching zones.
Bot 5's loop explicitly `break`s on the first match — the earlier zone
wins here, the opposite of Bot 4's real behavior.

### Good Example / Bad Example

Good: Checking `fresh_zones` in order and stopping at the first zone
whose range contains the sweep price, exactly matching the real
`break` behavior. Bad: Assuming the same "last match wins" rule
applies here that governs Bot 4's pattern-detection loop.

### What to Look Out For

- Bot 5's liquidity detector uses a tighter tolerance (`1.0` pip) and
  an explicit 30-candle lookback — both distinct, real parameters.
- The zone-alignment loop explicitly `break`s on the first match — the
  OPPOSITE of Bot 4's non-breaking loop (BOT4-04).
- No aligned zone found among all of `fresh_zones` returns `None`.

### Common Mistakes

Assuming every loop in this codebase behaves the same way (either all
"first match wins" or all "last match wins") is a common cross-bot
mistake — Bot 4 and Bot 5 have genuinely opposite loop behaviors for
their respective pattern/zone searches.

### Key Takeaways

1. Bot 5's liquidity detector uses a tighter, explicit tolerance
   (1.0 pip) and a 30-candle lookback — distinct real parameters.
2. The zone-alignment loop `break`s on the FIRST matching zone — the
   opposite of Bot 4's non-breaking, last-match-wins loop.
3. No zone aligning with the sweep price, among any of `fresh_zones`,
   returns `None`.

### Practice Drill

Given five sweep-price/zone-list scenarios (provided in Practise, at
least one with multiple matching zones), determine which zone Bot 5's
real loop would select.

### Scenario Challenge

A trader assumes Bot 5 and Bot 4 use the same "which match wins" rule
since both involve searching through a list for a condition. Using
this lesson's exact contrast, explain why they don't.

### Mini Quiz

Q1 (True/False): If two refined zones both contain the sweep price,
Bot 5 selects the LAST (most recently listed) one, the same as Bot
4's pattern-detection loop.
Answer: False — Bot 5's loop `break`s on the FIRST match; Bot 4's
loop never breaks, so the LAST match wins there instead — opposite
behaviors.

Q2 (Multiple choice): What liquidity-detector tolerance does Bot 5
use?
(a) The platform default, same as Bot 2
(b) A tighter, explicit 1.0 pip tolerance
(c) A looser 5.0 pip tolerance
(d) No tolerance check at all

Answer: (b).

### Flashcards

- Front: What tolerance does Bot 5's `LiquidityDetector` use? Back: A
  tighter, explicit `tolerance_pips=1.0` — distinct from Bot 2's
  default.
- Front: Does Bot 5's zone-alignment loop keep the first or last
  matching zone? Back: The FIRST — it `break`s immediately on a
  match, the opposite of Bot 4's non-breaking, last-match-wins loop.

### Reflection

Why might tightening the liquidity-sweep tolerance make sense for a
bot specifically designed around PRECISE, mechanical zone refinement
(BOT5-01, BOT5-02)?

### Mastery Criteria

Correctly determine the selected zone for all five practice-drill
scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this alignment feeds directly
into BOT5-04's confirmation-candle search.

### Bot Connection

Verified against `JeafxSMCBot.analyze()` Step 2-3 in
`bot_strategies.py` — the `tolerance_pips=1.0`, `lookback=30`, and the
`break`-on-first-match loop, all quoted directly from source and
confirmed as the exact opposite loop behavior from Bot 4's.

---

## BOT5-04 — Setup: The Momentum Confirmation Candle

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT5-03
**Learning objectives:** Reproduce Bot 5's exact 5M confirmation-
candle test — momentum plus zone re-entry — and confirm it uses the
same first-match loop behavior as BOT5-03.

### Why This Matters

An aligned zone (BOT5-03) alone isn't enough — Bot 5 needs the
FASTEST timeframe in this platform (5M) to confirm a genuine,
high-momentum reaction back inside that zone before considering the
setup real.

### Core Teaching

**Plain-English explanation.** Over the last five 5-minute candles,
Bot 5 looks for one with real momentum — a candle body meaningfully
larger than recent average — that ALSO closes back inside the aligned
zone's range. This is the "specific confirmation candle" its docstring
describes: not just any candle touching the zone, but one showing
genuine conviction.

**Technical explanation.** `recent_5m = candles_5m[-5:]`; for each
`c` in this window: `body_size = abs(c.close - c.open)`; `avg_body =
mean(candles_5m[-20:] body sizes)`; if `body_size > avg_body * 1.5`
(momentum) AND `aligned_zone.bottom <= c.close <= aligned_zone.top`
(re-entry), set `confirmation_candle = c` and `break` — the SAME
first-match loop behavior as BOT5-03's zone alignment, contrasted
with Bot 4's non-breaking pattern loop (BOT4-04). If no candle in the
5-candle window satisfies both conditions, return `None`.

### Visual Model

See diagram: `visuals/bot5-04-confirmation-candle.svg` — five 5M
candles with body sizes compared against a 20-candle average, one
candle highlighted as both high-momentum (>1.5x average) AND closing
back inside the aligned zone — the first such candle in the window,
per the `break` behavior.

### Worked Example

Within the last 5 5-minute candles, the third one has a body 1.8x the
20-candle average AND closes at a price inside the aligned zone's
range — both conditions satisfied. `confirmation_candle` is set to
this candle, and the loop `break`s without checking the remaining two
candles.

### Counterexample

A candle in the same window has a large body (2.0x average) but
closes OUTSIDE the aligned zone's range — momentum without the
required re-entry. This candle does NOT set `confirmation_candle`,
since both conditions are required together, not either alone.

### Good Example / Bad Example

Good: Checking both the momentum threshold (>1.5x the 20-candle
average body) AND the zone re-entry condition together, stopping at
the first candle that satisfies both. Bad: Treating a large-bodied
candle as sufficient confirmation on its own, without checking it
actually closed back inside the aligned zone.

### What to Look Out For

- BOTH momentum (body >1.5x average) AND zone re-entry (close inside
  the aligned zone) are required together for a candle to qualify.
- This loop `break`s on the FIRST qualifying candle — the same
  first-match behavior as BOT5-03's zone alignment.
- No qualifying candle in the 5-candle window returns `None`.

### Common Mistakes

Treating a strong-momentum candle as sufficient on its own, without
checking it also closed back inside the aligned zone, is the most
common gap between intuition and Bot 5's actual, combined test.

### Key Takeaways

1. A confirmation candle requires BOTH momentum (body >1.5x the
   20-candle average) AND closing back inside the aligned zone.
2. This search `break`s on the first qualifying candle — matching
   BOT5-03's zone-alignment loop, not Bot 4's non-breaking one.
3. No qualifying candle in the 5-candle window returns `None`.

### Practice Drill

Given seven 5M candle scenarios with body-size and closing-price data
(provided in Practise), determine which set `confirmation_candle`.

### Scenario Challenge

A trader sees a large-bodied 5M candle that closes just outside the
aligned zone's range and assumes it's still "close enough" to confirm.
Using this lesson's exact combined test, explain why it doesn't
qualify.

### Mini Quiz

Q1 (True/False): A large-bodied candle that closes outside the
aligned zone's range still counts as a valid confirmation candle.
Answer: False — both momentum AND zone re-entry (closing inside the
aligned zone) are required together.

Q2 (Multiple choice): What momentum threshold must a confirmation
candle's body exceed?
(a) 1.0x the 20-candle average
(b) 1.5x the 20-candle average
(c) 2.5x the 20-candle average
(d) There's no momentum threshold

Answer: (b).

### Flashcards

- Front: What two conditions must a confirmation candle satisfy
  together? Back: Body size >1.5x the 20-candle average (momentum)
  AND closing inside the aligned zone's range (re-entry).
- Front: Does this search keep the first or last qualifying candle?
  Back: The first — it `break`s immediately on a match, the same
  behavior as BOT5-03's zone-alignment loop.

### Reflection

Why does requiring BOTH momentum and re-entry, rather than either
alone, produce a more reliable confirmation signal? What kind of
candle would fool a momentum-only or re-entry-only test?

### Mastery Criteria

Correctly classify all seven practice-drill candle scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this confirmation candle is the
anchor BOT5-06's entry calculation references.

### Bot Connection

Verified against `JeafxSMCBot.analyze()` Step 4 in `bot_strategies.py`
— the `candles_5m[-5:]` window, `> avg_body * 1.5` momentum threshold,
and the `break`-on-first-match loop quoted directly from source.

---

## BOT5-05 — Invalidation: The Five Conditions That Return No Signal

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT5-02 through BOT5-04, C2-09
**Learning objectives:** List, in order, all five points in Bot 5's
pipeline where it returns no signal, and place Bot 5's gate count in
the complete five-bot comparison.

### Why This Matters

This closes out the gate-count comparison across all five bots in this
curriculum: Bot 1 (four), Bot 2 (three), Bot 3 (two), Bot 4 (seven),
and now Bot 5 (five) — a complete, verified picture of how differently
each bot's real mechanics are structured.

### Core Teaching

**Plain-English explanation.** Reading through `JeafxSMCBot.analyze()`
in order, there are exactly five points where it stops and returns no
signal: (1) no refined (ACTIVE + `test_count <= 1`) 1H zone exists
(BOT5-02); (2) no 15M liquidity sweep is detected at all (BOT5-03);
(3) none of the refined zones align with the sweep's price (BOT5-03);
(4) no 5M confirmation candle satisfies both momentum and re-entry
(BOT5-04); (5) the confirmed sweep's type is neither buy-side nor
sell-side — a defensive final branch, same shape as Bot 4's final
pairing gate (BOT4-05).

**Technical explanation.** Unlike Bot 4's pairing gate (a genuine,
reachable mismatch between two independent signals), Bot 5's final
gate is more of a defensive catch-all — `last_sweep["type"]` should
always be one of the two recognized values if `detect_liquidity_sweeps`
returned anything at all, making this fifth gate rarely, if ever,
actually reached in practice, though it's still real code worth
knowing about. Note that the FVG check (a later step) is NOT among
these five gates — like Bot 2's sweep/FVG checks (BOT2-04/05), it's a
soft signal that changes HOW the entry is calculated (BOT5-06), never
whether a signal fires at all.

### Visual Model

See diagram: `visuals/bot5-05-five-gates-final-tally.svg` — Bot 5's
five sequential gates, shown alongside a final summary table of all
five bots' gate counts (Bot 1: 4, Bot 2: 3, Bot 3: 2, Bot 4: 7, Bot 5:
5) — completing the cross-bot comparison begun in BOT1-05.

### Worked Example

A setup passes gates 1 through 4: a refined zone, a detected sweep, an
aligned zone, and a qualifying confirmation candle. If the sweep's
type is genuinely `"buy_side_sweep"` or `"sell_side_sweep"` (the
expected case), gate 5 also passes, and the pipeline proceeds to
BOT5-06's entry calculation.

### Counterexample

A setup passes gates 1 through 4 identically, but no 15M sweep was
ever actually detected at gate 2 (no equal highs/lows pool existed to
sweep) — `analyze()` returns `None` at gate 2, well before gates 3
and 4 are ever reached.

### Good Example / Bad Example

Good: Checking each of the five gates in the pipeline's real order,
recognizing that the FVG check is a soft signal outside this gate
sequence entirely. Bad: Treating the FVG check as a sixth hard gate,
or assuming any single strong signal (a big sweep, a clean confirmation
candle) can substitute for a different failed gate.

### What to Look Out For

- Bot 5 has five real gates — placing it between Bot 2/Bot 3 (fewer)
  and Bot 1/Bot 4 (Bot 1 has four, close; Bot 4 has seven, the most).
- The FVG check (BOT5-06) is a soft signal, NOT a sixth gate — it
  changes the entry-price SOURCE, never whether a signal fires.
- Gate 5 (sweep type recognized) is a defensive catch-all, rarely
  actually triggered in practice, but still real code.

### Common Mistakes

Treating the FVG check as an additional hard gate, the way the actual
five gates work, is the most common structural misread of this bot's
pipeline — it's a soft signal affecting entry calculation only.

### Key Takeaways

1. Bot 5 has five real gates: refined-zone availability, sweep
   detection, zone-sweep alignment, confirmation-candle detection, and
   a defensive sweep-type check.
2. Across all five bots, gate counts range from two (Bot 3) to seven
   (Bot 4) — each bot's own mechanics determine its count, not a
   shared template.
3. Bot 5's FVG check is a soft signal outside the five-gate sequence
   — it shapes entry calculation, never gates the signal itself.

### Practice Drill

Given eight scenario summaries (provided in Practise) describing which
of the five gates pass or fail, determine the outcome for each.

### Scenario Challenge

A trader sees a confirmed sweep, an aligned zone, and a qualifying
confirmation candle, but no FVG forms afterward. Using this lesson's
vocabulary, does the missing FVG block the signal?

### Mini Quiz

Q1 (True/False): A missing FVG after the confirmation candle blocks a
Bot 5 signal from firing.
Answer: False — the FVG check is a soft signal (BOT5-06) that changes
HOW the entry is calculated, not one of the five hard gates.

Q2 (Multiple choice): How many real hard gates does Bot 5's pipeline
have?
(a) Three
(b) Four
(c) Five
(d) Seven

Answer: (c).

### Flashcards

- Front: How many real hard gates does Bot 5's pipeline have? Back:
  Five — refined-zone availability, sweep detection, zone-sweep
  alignment, confirmation-candle detection, and a defensive sweep-type
  check.
- Front: Across all five bots, what's the full range of gate counts?
  Back: Two (Bot 3) to seven (Bot 4) — Bot 1 has four, Bot 2 has
  three, Bot 5 has five.

### Mastery Criteria

Correctly determine the outcome for all eight practice-drill
scenarios.

### Reflection

Having now seen the real gate count for all five bots, what does the
range (two to seven) suggest about the danger of assuming any single
"typical" number of confirmation checks applies across a whole
platform's worth of genuinely different strategies?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this completes the five-bot gate-
count comparison begun in BOT1-05.

### Bot Connection

Every gate here is a direct `return None` line inside
`JeafxSMCBot.analyze()` — confirmed as five by tracing the function's
complete control flow in `bot_strategies.py`.

---

## BOT5-06 — Entry: FVG-or-Confirmation-Candle, a Soft Source Choice

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT5-05, BOT2-06
**Learning objectives:** State Bot 5's conditional entry-price SOURCE
rule, and contrast it with Bot 2's conditional entry-TYPE rule.

### Why This Matters

BOT2-06 showed Bot 2's entry TYPE (mean vs. aggressive) branching on a
soft signal (`has_sweep`). Bot 5 has its own, structurally similar but
distinct conditional pattern — its entry price SOURCE (which object's
prices to average) branches on whether a matching FVG formed.

### Core Teaching

**Plain-English explanation.** After the confirmation candle confirms
(BOT5-04), Bot 5 checks whether a Fair Value Gap formed on or after
that candle, matching the sweep's direction. If one did, the entry
price is calculated from that FVG's own midpoint — a more precise
reference. If no matching FVG formed, the entry price falls back to
the confirmation candle's own midpoint (average of its open and
close) instead.

**Technical explanation.** `valid_fvg` is searched for among 5M FVGs
formed on or after the confirmation candle's timestamp, matching the
sweep's direction (`gap_type == "bullish"` with a `buy_side_sweep`, or
`"bearish"` with a `sell_side_sweep`); the loop `break`s on the first
match. Then: `if valid_fvg: entry_price = (valid_fvg.top +
valid_fvg.bottom) / 2` — a hand-computed midpoint, same style as Bot
3's entry (BOT3-04). `else: entry_price = (confirmation_candle.open +
confirmation_candle.close) / 2` — a different hand-computed average,
from the confirmation candle itself. Direction is set separately, from
`last_sweep["type"]` (`buy_side_sweep` → long, `sell_side_sweep` →
short), unrelated to which entry-price branch fires.

### Visual Model

See diagram: `visuals/bot5-06-entry-source-branch.svg` — a decision
diamond ("valid_fvg found?") branching to two different midpoint
calculations: the FVG's own top/bottom average, or the confirmation
candle's own open/close average — both hand-computed, neither via the
shared entry engine.

### Worked Example

A confirmation candle fires, and a matching bullish FVG forms on the
very next 5M candle. `valid_fvg` is set; entry price is calculated as
that FVG's own midpoint — a reference point one candle removed from
the confirmation candle itself.

### Counterexample

The same confirmation candle fires, but no matching FVG ever forms
afterward. `valid_fvg` stays `None`; entry price falls back to the
confirmation candle's OWN open/close average instead — a different
reference point, calculated from a different object entirely.

### Good Example / Bad Example

Good: Checking for a matching FVG first, then using the correct
entry-price source (FVG midpoint or confirmation-candle midpoint)
depending on whether one was found. Bad: Always using the confirmation
candle's midpoint regardless of FVG presence, or assuming Bot 5's
entry logic works like Bot 2's has_sweep-conditional TYPE choice
rather than this bot's conditional SOURCE choice.

### What to Look Out For

- The FVG presence changes which OBJECT's prices are averaged for
  entry — not an entry "type" string the way Bot 1 and Bot 2's logic
  works.
- Both branches are hand-computed midpoints — neither calls the
  shared `EntryExitEngine.calculate_entry` helper.
- Direction (from `last_sweep["type"]`) is set independently of this
  branch — the FVG check never affects direction, only entry price.

### Common Mistakes

Confusing this conditional SOURCE choice with Bot 2's conditional TYPE
choice (BOT2-06) is a common cross-bot mix-up — both branch on a soft
signal, but Bot 2 picks between two entry-engine call styles, while
Bot 5 picks between two entirely different local objects to average.

### Key Takeaways

1. Bot 5's entry price comes from the matching FVG's midpoint if one
   formed, or the confirmation candle's own midpoint if not.
2. Both branches are hand-computed, local calculations — neither uses
   the shared entry engine.
3. This is a genuinely different conditional pattern from Bot 2's
   (entry-price SOURCE here, vs. entry TYPE there).

### Practice Drill

Given four confirmation-candle/FVG-presence scenarios (provided in
Practise), calculate the exact entry price Bot 5 would use for each.

### Scenario Challenge

A trader assumes Bot 5's FVG check works exactly like Bot 2's sweep
check — changing an entry TYPE string. Using this lesson's exact
mechanics, explain the real difference.

### Mini Quiz

Q1 (True/False): Bot 5's entry price is always calculated from the
confirmation candle's own open and close.
Answer: False — it uses the matching FVG's midpoint if one formed;
the confirmation candle's midpoint is only the fallback.

Q2 (Multiple choice): What does Bot 5's FVG presence actually change?
(a) The trade direction
(b) Which object's prices are averaged for the entry price
(c) The stop-loss method
(d) The reported confidence value

Answer: (b).

### Flashcards

- Front: What determines Bot 5's entry-price source? Back: Whether a
  matching FVG formed on or after the confirmation candle — its
  midpoint if so, the confirmation candle's own midpoint if not.
- Front: How does Bot 5's conditional entry logic differ from Bot 2's?
  Back: Bot 2 branches on entry TYPE (mean vs. aggressive, via the
  shared engine); Bot 5 branches on entry-price SOURCE (which local
  object's prices to average) — a structurally different choice.

### Reflection

Now having seen Bot 2's has_sweep-conditional entry type and Bot 5's
FVG-conditional entry source, what's the common design pattern across
both, despite their different specifics?

### Mastery Criteria

Correctly calculate entry price for all four practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this entry price is the anchor
BOT5-07's stop and target calculations are measured from.

### Bot Connection

Verified against `JeafxSMCBot.analyze()` Steps 5-7 in
`bot_strategies.py` — the `valid_fvg` search loop and the conditional
`entry_price` assignment quoted directly from source.

---

## BOT5-07 — Management: A Real Crash Bug, Fixed

**Level:** 3
**Estimated study time:** 15 minutes
**Prerequisites:** BOT5-06, BOT1-07, C8-02
**Learning objectives:** State Bot 5's strict-stop formula, and
explain a real, confirmed crash bug found and fixed in this bot's
code while this lesson was being authored.

### Why This Matters

This lesson documents the most significant finding in this entire
BOT-track curriculum: a genuine `NameError` crash, confirmed by
reading the real code, meaning Bot 5 could never successfully produce
a signal until it was fixed. Every earlier "verify against real code"
lesson (BOT3-07, BOT4-07) found a gap between stated intent and
behavior; this one is a bug that would stop the function from running
at all.

### Core Teaching

**Plain-English explanation.** Bot 5's stop is placed just beyond the
confirmed sweep's own extreme price, with a buffer sized as 20% of the
confirmation candle's own high-to-low range — a strict, tight stop
matching this bot's "Jeafx" precision philosophy. Its REPORTED
take-profit is TP2 of a multi-target split — and, as BOT1-07 and
BOT3-07 both found, TP2 is always a fixed 2:1, regardless of the
`rr_ratio=5.0` this bot passes in. Before a real fix, though,
`analyze()` would never have reached that calculation at all.

**Technical explanation.** `purge_extreme = last_sweep["sweep_price"]`;
`buffer = abs(confirmation_candle.high - confirmation_candle.low) *
0.2`; `sl_price = purge_extreme - buffer` (long) or `+ buffer`
(short) — `method: "jeafx_purge_extreme"`. The REAL BUG: the next
line originally read `targets = self.entry_engine.calculate_targets
(entry, sl, rr_ratio=5.0)` — referencing a bare name `entry` that was
NEVER assigned anywhere in this function; only `entry_price` (a plain
float) was ever computed. `EntryExitEngine.calculate_targets` requires
a dict with an `"entry_price"` key (`smc_algorithms.py`), so this line
raised `NameError: name 'entry' is not defined` every single time
execution reached it — meaning every time all five real gates (BOT5-05)
actually passed. Bot 5 could never successfully return a `BotSignal`.
The fix, applied directly to `bot_strategies.py`: construct
`entry = {"entry_price": entry_price, "direction": direction}`
immediately before the `calculate_targets` call — the same dict shape
`FVGExpansionBot` (Bot 3) already builds by hand for its own
non-engine entry. With that fix in place, `targets["tp2"]` (used as
`take_profit`) is, like every other bot's, a fixed 2:1 regardless of
the `rr_ratio=5.0` passed in. `calculate_position_risk
(setup_quality=1.3)` — the highest of any bot — then
`calculate_lot_size`. Confidence is a fixed `0.88` — also the highest
of any bot.

### Visual Model

See diagram: `visuals/bot5-07-bug-fix-timeline.svg` — a before/after
comparison: "before" shows the pipeline reaching the target-calculation
line and crashing with `NameError`; "after" shows the same line now
constructing a proper `entry` dict first and completing successfully,
captioned "found and fixed by reading the real code, not assumed from
the docstring."

### Worked Example

A confirmed sweep's extreme price is 1.0838, and the confirmation
candle's high-to-low range is 8 pips. The buffer is `8 * 0.2 = 1.6`
pips; the stop sits at roughly 1.0837.4 (a long). With entry at, say,
1.0855 (BOT5-06), stop distance is about 17.6 pips, and — after the
fix — the reported TP2 sits about 35.2 pips above entry (a fixed 2:1),
not the 88 pips a naive 5:1 read of the docstring would suggest.

### Counterexample

Before the fix described in this lesson, this exact worked example
would never have reached a reported take-profit at all — the function
would have raised `NameError` at the `calculate_targets` line and
crashed, regardless of how well every earlier gate (BOT5-02 through
BOT5-05) had been satisfied.

### Good Example / Bad Example

Good: Verifying that every referenced variable in a function is
actually assigned somewhere in its own scope before trusting that a
signal would ever be produced — exactly the discipline that surfaced
this bug. Bad: Assuming a function that reads correctly at a glance,
or matches its own docstring's described behavior, must actually run
without errors.

### What to Look Out For

- Bot 5's stop buffer is 20% of the confirmation candle's own
  high-to-low range — proportional to that specific candle, not a
  fixed distance.
- The REPORTED take-profit (`tp2`) is a fixed 2:1, exactly like Bot 1,
  Bot 2, and Bot 3 — the `rr_ratio=5.0` passed in only ever reaches
  `tp3`, never reported.
- The `NameError` bug this lesson documents is FIXED in the current
  code (verify against the live `bot_strategies.py`, not an assumption
  that it's still broken).

### Common Mistakes

Assuming a function must run correctly simply because its logic reads
sensibly line by line is exactly the assumption this bug disproves —
a single undefined variable reference, easy to miss on a casual read,
was enough to make Bot 5's signal generation crash every single time.

### Key Takeaways

1. Bot 5's stop buffer is 20% of the confirmation candle's own
   high-to-low range — a proportional, hand-calculated distance.
2. Its REPORTED take-profit (`tp2`) is a fixed 2:1, the same finding
   as Bot 1, Bot 2, and Bot 3 — the passed `rr_ratio=5.0` only reaches
   `tp3`, never reported.
3. A real `NameError` bug — a referenced `entry` variable that was
   never assigned — meant Bot 5 could never successfully produce a
   signal before this was found and fixed.

### Practice Drill

Given three confirmed sweep/confirmation-candle scenarios (provided in
Practise), calculate the exact stop price, stop distance, and the
actual (fixed 2:1) TP2 target for each.

### Scenario Challenge

Before this lesson's fix, a developer reports that Bot 5 "never seems
to generate any signals in production, even when the setup looks
textbook." Using this lesson's exact finding, what was actually
happening, and at which specific line?

### Mini Quiz

Q1 (True/False): Before the fix described in this lesson, Bot 5 could
successfully produce a `BotSignal` whenever all five real gates
(BOT5-05) passed.
Answer: False — a `NameError` crash at the target-calculation line
meant it could never successfully complete, regardless of how well
every gate was satisfied.

Q2 (Multiple choice): What was the actual bug?
(a) An incorrect stop-buffer percentage
(b) A reference to a variable named `entry` that was never assigned
    anywhere in the function — only `entry_price` was
(c) A missing liquidity-sweep check
(d) An incorrect confidence value

Answer: (b).

### Flashcards

- Front: What was the real bug found in Bot 5's code? Back:
  `calculate_targets(entry, sl, ...)` referenced a bare `entry` name
  that was never assigned — only `entry_price` (a float) was —
  causing a `NameError` every time execution reached that line.
- Front: What confirms Bot 5's reported take-profit is a fixed 2:1,
  not the 5:1 `rr_ratio` it passes in? Back: `tp2`'s multiplier is
  hardcoded in `EntryExitEngine.calculate_targets`, the same finding
  already confirmed for Bot 1, Bot 2, and Bot 3.

### Reflection

What habit — reading a function's full variable scope, or tracing
every value actually used in a return statement — would have caught
this bug before it reached production? Where else in this curriculum
has a similar "verify, don't assume" habit paid off?

### Mastery Criteria

Correctly calculate stop, distance, and the actual TP2 target for all
three practice-drill scenarios, and correctly describe the fixed bug.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds BOT5-08's
failure-mode analysis.

### Bot Connection

Verified against `JeafxSMCBot.analyze()` Steps 8-9 in
`bot_strategies.py` (post-fix) AND `EntryExitEngine.calculate_targets`
in `smc_algorithms.py` — the `* 0.2` buffer, the fixed `entry` dict
construction, `setup_quality=1.3`, and the hardcoded `tp2` multiplier
all quoted directly from source.

---

## BOT5-08 — Failure: What a Failed Bot 5 Setup Looks Like

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT5-05, BOT5-07, C9-02
**Learning objectives:** Distinguish a valid Bot 5 loss from a bad
one, with this bot's own characteristic failure pattern.

### Why This Matters

Same discipline as the four earlier failure lessons, applied to Bot
5's own refined-zone pipeline — with a real, additional consideration
this lesson introduces: a signal generated before the BOT5-07 bug fix
was never a valid trade at all, since it would never have completed.

### Core Teaching

**Plain-English explanation.** A valid Bot 5 loss looks like this: all
five real gates (BOT5-05) genuinely passed — a genuinely refined zone
(tested at most once), a real 15M sweep with the correct tight
tolerance, an aligned zone, a genuine momentum-plus-re-entry
confirmation candle — and the trade still hit its stop. A bad Bot 5
loss most often comes from a trader treating a WELL-TESTED zone
(`test_count > 1`) as if it were still "fresh," since the refinement
concept (BOT5-02) is unique to this bot among the five and easy to
overlook if a trader is used to Bot 1 or Bot 2's simpler zone checks.

**Technical explanation.** Because `JeafxSMCBot.analyze()` (post-fix)
only ever returns a complete signal or `None`, a genuine bot-generated
Bot 5 signal that loses is a valid loss by the same construction
argument as every other bot in this curriculum. The Bot-5-specific
bad-loss pattern most often traces to the refinement test (BOT5-02) —
trading a zone that's technically ACTIVE but has already been tested
multiple times, which none of Bot 1's, Bot 2's, Bot 3's, or Bot 4's
zone/pattern checks would have flagged, since `test_count` is unique
to this bot's logic.

### Visual Model

See diagram: `visuals/bot5-08-valid-vs-bad-loss.svg` — two ACTIVE 1H
zones, one with `test_count=0` (labeled "genuinely fresh — valid Bot 5
candidate") and one with `test_count=4` (labeled "still ACTIVE, but
NOT fresh by Bot 5's real test — a bad loss if traded manually as
this bot").

### Worked Example

A genuine Bot 5 signal fires: a refined zone (`test_count=1`), a real
15M sweep, an aligned zone, and a qualifying 5M confirmation candle.
The trade hits its stop. Since all five gates genuinely passed, this
is a valid loss (C9-02) — no process change is warranted.

### Counterexample

A trader sees a liquidity sweep and a strong 5M confirmation candle
inside a 1H zone that's technically ACTIVE but has already been tested
four separate times. They trade it as a "Bot 5 style" setup anyway.
The trade loses. This is a bad loss — the refinement gate (BOT5-02)
was never actually satisfied; a human traded a setup the real pipeline
would have declined.

### Good Example / Bad Example

Good: Checking a zone's actual `test_count`, not just its ACTIVE
status, before trusting any Bot-5-style setup. Bad: Applying Bot 1's
or Bot 2's simpler ACTIVE-only zone check to what's meant to be a
Bot 5 setup, missing the refinement requirement entirely.

### What to Look Out For

- The most common Bot-5-specific bad-loss pattern is trading a
  well-tested (not fresh) zone, missing the `test_count` refinement
  check unique to this bot.
- A genuine, bot-generated Bot 5 signal that loses is a valid loss by
  construction, same as every other bot — but only once the BOT5-07
  bug fix is in place; a pre-fix "signal" was never a real trade at
  all, since the function would have crashed before completing.
- Each of the five bots now has its own distinct, documented
  characteristic bad-loss pattern (BOT1-08 through BOT5-08).

### Common Mistakes

Applying a simpler, other-bot zone check (ACTIVE status alone) to a
Bot 5 setup, without checking the refinement-specific `test_count`
field, is the single most consequential mistake for this bot.

### Key Takeaways

1. A genuine, bot-generated Bot 5 signal that loses is a valid loss by
   construction — all five real gates were already enforced.
2. The most common Bot-5-specific bad loss comes from trading a
   well-tested zone, missing this bot's unique refinement check.
3. This completes a full five-bot set of distinct, documented
   characteristic bad-loss patterns — one for each bot's own real
   mechanics.

### Practice Drill

Given five losing-trade case studies styled after Bot 5 (provided in
Practise), determine which are valid losses and which are bad losses,
checking the actual `test_count` in each case.

### Scenario Challenge

A trader's manually-placed "Bot 5 style" trade loses. On review, the
zone traded had `test_count = 3`. Using this lesson's vocabulary,
classify this loss and name the specific gate that was never satisfied.

### Mini Quiz

Q1 (True/False): Any ACTIVE 1H zone with a confirmed sweep and
confirmation candle qualifies as a valid Bot 5 setup.
Answer: False — the zone must also pass the refinement test
(`test_count <= 1`); a well-tested ACTIVE zone still fails.

Q2 (Multiple choice): What's the most common Bot-5-specific pattern
behind a bad loss?
(a) Using too tight a stop
(b) Trading a well-tested (not fresh) zone, missing the test_count
    refinement check
(c) Ignoring the confirmation candle
(d) Targeting too high an R:R

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 5 signal a valid or
  bad loss? Back: Valid — all five BOT5-05 gates were already enforced
  by construction (once the BOT5-07 bug fix is in place).
- Front: What's the most common Bot-5-specific bad-loss pattern? Back:
  Trading a well-tested (not fresh) zone — missing the `test_count`
  refinement check that's unique to this bot.

### Reflection

Having now studied all five bots' characteristic bad-loss patterns
(BOT1-08 through BOT5-08), which one do you think would be easiest to
accidentally commit yourself, based on habits built from a different
bot's simpler rules?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — applies C9-02's model with full
Bot 5-specific precision, completing the five-bot comparison begun in
BOT1-08.

### Bot Connection

Grounded in the fact that `JeafxSMCBot.analyze()` only ever returns a
complete signal or `None` (post-fix), with the refinement test
verified directly against `bot_strategies.py`.

---

## BOT5-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 17 minutes
**Prerequisites:** BOT5-01 through BOT5-08
**Learning objectives:** Apply every real stage of Bot 5's five-gate
pipeline, in order, to one continuous scenario, using the CORRECTED
(post-fix) target calculation.

### Why This Matters

Same discipline as the four earlier Practice lessons, now applied to
Bot 5's fastest, most mechanically strict pipeline — and the first
exercise in this curriculum built around a bot whose code needed a
real fix before it could ever complete successfully.

### Core Teaching

**Plain-English explanation.** Given a full 1H+15M+5M scenario, work
through Bot 5's pipeline in order: find a refined zone (ACTIVE,
`test_count <= 1`, BOT5-02), detect a tight-tolerance 15M sweep and
align it with the first matching refined zone (BOT5-03), find the
first qualifying 5M confirmation candle (BOT5-04), determine entry
price from the matching FVG or the confirmation candle itself
(BOT5-06), and calculate the strict, proportional stop and the actual
fixed-2:1 TP2 target (BOT5-07).

**Technical explanation.** This exercise mirrors `JeafxSMCBot.analyze()`'s
real, POST-FIX control flow — five gates, two first-match-wins loops
(zone alignment, confirmation candle), and a conditional entry-price
SOURCE choice, ending in the corrected target calculation that
properly constructs an `entry` dict before calling
`calculate_targets`.

### Visual Model

See diagram: `visuals/bot5-09-full-pipeline-worksheet.svg` — a
five-row worksheet mirroring `analyze()`'s real, corrected control
flow, explicitly marking the entry-dict-construction step that didn't
exist before the BOT5-07 fix.

### Worked Example

A full worked scenario (provided in Practise) walks a 1H/15M/5M chart
set through the whole pipeline — a refined zone with `test_count=0`,
a tight-tolerance 15M sweep aligning with it, a qualifying 5M
confirmation candle, a matching FVG setting the entry price, and the
corrected stop/target calculation — ending with the exact same signal
the FIXED `JeafxSMCBot.analyze()` would now compute for that data.

### Counterexample

A trader completes the exercise using a well-tested zone
(`test_count=3`) because it was the only ACTIVE one available in the
scenario, rather than correctly determining that no refined zone
exists and the pipeline should return `None` at gate 1.

### Good Example / Bad Example

Good: Checking a zone's actual `test_count` before treating it as
eligible, and correctly constructing the entry dict before the target
calculation, exactly as the corrected real code does. Bad: Using any
ACTIVE zone regardless of test count, or skipping the entry-dict
construction step this exercise specifically rehearses.

### What to Look Out For

- The refinement test (`test_count <= 1`) must be checked before
  anything else — an ACTIVE-but-tested zone doesn't qualify.
- Both search loops (zone alignment, confirmation candle) `break` on
  the FIRST match — don't apply Bot 4's last-match-wins rule here.
- The target calculation now correctly builds an `entry` dict first —
  this exercise explicitly rehearses the corrected version.

### Common Mistakes

Forgetting to check the refinement (`test_count`) condition, or
applying Bot 4's last-match-wins loop rule to Bot 5's first-match
loops, are the two most common cross-bot mix-ups this exercise exists
to catch.

### Key Takeaways

1. Bot 5's full pipeline has five real gates and two first-match-wins
   loops — genuinely distinct from every other bot's pipeline shape.
2. The refinement test (`test_count <= 1`) must be checked as part of
   zone eligibility, not just ACTIVE status.
3. This exercise uses the CORRECTED target calculation, post-BOT5-07
   fix — the same real code now running in `bot_strategies.py`.

### Practice Drill

Given a full chart scenario (provided in Practise) with 1H, 15M, and
5M data, work through the complete pipeline to produce the exact
entry, stop, and TP2 target Bot 5's (corrected) code would output.

### Scenario Challenge

Given two scenarios (provided in Practise) that differ only in a
zone's `test_count` (0 vs. 3), work both through completely and show
how that single difference changes the outcome (signal vs. `None`).

### Mini Quiz

Q1 (True/False): Any ACTIVE 1H zone is eligible for this exercise's
Bot 5 pipeline, the same as it would be for Bot 1.
Answer: False — Bot 5 additionally requires `test_count <= 1`; this
exercise's zone-selection step must check that specifically.

Q2 (Multiple choice): What must happen immediately before the target
calculation in this exercise, matching the real BOT5-07 fix?
(a) Nothing — targets can be calculated directly from entry_price
(b) An `entry` dict with "entry_price" and "direction" keys must be
    constructed first
(c) The confirmation candle must be re-checked
(d) The stop must be recalculated

Answer: (b).

### Flashcards

- Front: What must be checked before treating a zone as eligible for
  Bot 5? Back: Both ACTIVE status AND `test_count <= 1` — the
  refinement test unique to this bot.
- Front: What must happen immediately before Bot 5's target
  calculation, per the real BOT5-07 fix? Back: An `entry` dict
  (`{"entry_price": ..., "direction": ...}`) must be constructed —
  the bug fix this exercise explicitly rehearses.

### Mastery Criteria

Correctly produce the exact entry, stop, and TP2 target for the
practice-drill scenario, and correctly show the outcome change in the
test_count comparison exercise.

### Reflection

Having now worked through all five bots' full pipelines by hand
(BOT1-09 through BOT5-09), which bot's real logic differed most from
what its name or docstring alone would have suggested?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT5-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`JeafxSMCBot.analyze()`'s real, POST-FIX control flow — no step here
exists that isn't a real line of code in `bot_strategies.py` as it
now stands.

---

## BOT5-10 — Capstone: Full Bot 5 Decision Simulation, and the Five-Bot Roster

**Level:** 4
**Estimated study time:** 20 minutes
**Prerequisites:** BOT5-01 through BOT5-09, BOT1-10, BOT2-10, BOT3-10,
BOT4-10
**Learning objectives:** Given raw multi-timeframe chart data, produce
the complete Bot 5 decision, and correctly place Bot 5 within a
complete, accurate comparison across all five of this platform's bots.

### Why This Matters

This capstone closes out the entire Bot Specializations track. Beyond
producing Bot 5's own complete decision, it requires holding an
accurate, verified picture of all five bots together — their real
timeframes, gate counts, risk parameters, and each one's own
characteristic failure pattern — rather than treating any one of them
as a template for the rest.

### Core Teaching

**Plain-English explanation.** Given raw 1H, 15M, and 5M candle data,
work the entire Bot 5 pipeline from scratch: find a refined zone,
detect a tight-tolerance sweep and align it with the first matching
zone, find the first qualifying confirmation candle, determine entry
price from the FVG-or-candle source rule, and calculate the strict
stop and the actual fixed-2:1 target — or correctly stop at whichever
of the five BOT5-05 gates fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of `JeafxSMCBot.analyze()`
— called only when `market_data` contains `"1H"`, `"15M"`, and `"5M"`
all together. A correct capstone answer matches every field of the
real, POST-FIX `BotSignal` (confidence fixed at `0.88`, `setup_quality`
1.3, reported take-profit a fixed 2:1) or a precise `None` with the
specific failing gate, out of five possible.

### Visual Model

See diagram: `visuals/bot5-10-five-bot-summary.svg` — a single summary
table across all five bots: timeframes, real gate count, setup-quality
multiplier, fixed/conditional confidence, and each bot's own
characteristic bad-loss pattern (BOT1-08 through BOT5-08) — the
complete, verified picture this whole track has been building toward.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 1H, 15M,
and 5M data. Working the complete pipeline: a refined zone
(`test_count=0`), a tight-tolerance 15M sweep aligning with it, a
qualifying 5M confirmation candle, a matching FVG setting a long entry,
a stop 20% of the confirmation candle's range beyond the sweep's
extreme, and the actual fixed-2:1 TP2 target at 0.88 confidence —
matching what the corrected `JeafxSMCBot.analyze()` would output.

### Counterexample

A different capstone scenario supplies raw data where every condition
looks favorable except the only ACTIVE 1H zone has `test_count = 2` —
above the refinement threshold. The correct capstone answer is an
explicit `None` at the refinement gate (BOT5-05, gate 1), regardless
of how clean the sweep and confirmation candle otherwise look.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, correctly applying
both first-match-wins loops, and correctly stating the fixed-2:1
target rather than the docstring's higher figure. Bad: Applying any
other bot's zone check, loop-match rule, or target assumption to what
is specifically a Bot 5 scenario.

### What to Look Out For

- A correct `None` answer, with the specific gate identified out of
  five, is just as complete a capstone answer as a full signal.
- Both search loops (zone alignment, confirmation candle) use
  first-match-wins — the opposite of Bot 4's rule.
- The reported take-profit is a fixed 2:1, exactly like Bot 1, Bot 2,
  and Bot 3 — not the 5:1 the docstring's language might suggest.

### Common Mistakes

At this final capstone level, blending rules from different bots
(Bot 4's last-match-wins loop, Bot 1's assumed 5:1 target, Bot 2's
zone-fallback pattern) into a Bot 5 scenario is the most consequential
mistake — each bot's mechanics are genuinely its own, verified
individually, never a shared template.

### Key Takeaways

1. The capstone works Bot 5's complete, five-gate, POST-FIX pipeline
   from raw candle data — nothing pre-identified.
2. A correctly-identified `None`, with the specific failing gate out
   of five, is just as valid a capstone answer as a complete signal.
3. Across the full five-bot roster, gate counts range from two to
   seven, confidence is fixed for four bots and conditional for one
   (Bot 2), and every reported take-profit that goes through
   `calculate_targets` is a fixed 2:1 — verified facts, not
   assumptions carried over from any single bot's docstring.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one producing `None`), work the complete Bot 5 pipeline for each.

### Scenario Challenge

Given a raw scenario where a confirmed sweep and confirmation candle
both check out, but the only aligning zone has `test_count = 5`,
produce the complete, correct pipeline output, including exactly which
gate this fails at.

### Mini Quiz

Q1 (True/False): Bot 5's reported take-profit reflects the 5.0
`rr_ratio` it passes into `calculate_targets`, the same way a naive
read of its docstring might suggest.
Answer: False — `tp2` is hardcoded to a fixed 2:1, exactly the same
verified finding as Bot 1, Bot 2, and Bot 3.

Q2 (Multiple choice): Across all five bots in this curriculum, which
has the most real hard gates?
(a) Bot 1 (four)
(b) Bot 2 (three)
(c) Bot 4 (seven)
(d) Bot 5 (five)

Answer: (c).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 1H,
  15M, and 5M candle data — no zones, sweeps, confirmation candles, or
  FVGs pre-identified.
- Front: Across the full five-bot roster, what's the one shared,
  verified fact about every bot that calls `calculate_targets`? Back:
  Its reported take-profit (`tp2`) is always a fixed 2:1, regardless
  of the `rr_ratio` parameter passed in — true for Bot 1, Bot 2, Bot
  3, and Bot 5 (Bot 4 never calls it at all).

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios, and correctly complete the five-bot summary
comparison.

### Reflection

Having completed all five Bot Specialization tracks, which single
finding — a hidden condition, an unused variable, a genuine crash bug,
or a systemic docstring-vs-code gap — most changed how you'd approach
reading any new part of this codebase going forward?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone completes the
entire five-bot Specialization track begun in BOT1-01, and is the
direct foundation for any later capstone spanning all 5 bots together
(per the master content map's own CAPSTONES section).

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 5:
Needs 1H + 15M + 5M" invocation of `JeafxSMCBot.analyze()` in full —
every real step, gate, and output, verified directly against the
corrected `bot_strategies.py`, completing a verified, line-by-line
account of all five of this platform's real bot pipelines.
