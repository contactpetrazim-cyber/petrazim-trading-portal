# BOT 4 — VOLUME & LIQUIDITY SWEEP MASTERY

Ten-lesson specialization track for Bot 4 (Volume & Liquidity Sweep
Specialist, Dalton/Weis/Wyckoff style) — verified line-by-line against
`backend/app/core/bot_strategies.py`'s `VolumeLiquidityBot`. Contrasted
explicitly against BOT_1, BOT_2, and BOT_3 wherever the real logic
differs.

---

## BOT4-01 — Concept: Volume & Liquidity Sweep Specialist

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT3-01, C1-04
**Learning objectives:** Explain Bot 4's Auction Market Theory
philosophy — accumulation/distribution, Spring and Upthrust patterns
— and name its real two-timeframe scope.

### Why This Matters

Bot 4 is the first bot in this track grounded explicitly in Dalton's
Auction Market Theory and Wyckoff/Weis volume reading, rather than
pure SMC structure — a genuinely different analytical lens applied to
the same kind of price data the other bots use.

### Core Teaching

**Plain-English explanation.** Bot 4 (Dalton/Weis/Wyckoff style)
treats price as searching for value inside a defined range —
accumulation at the lows, distribution at the highs. It specifically
hunts for a Spring (a false breakdown below range support that
quickly reclaims it) or an Upthrust (a false breakout above range
resistance that quickly fails) — both classic Wyckoff patterns — and
requires volume evidence (a real divergence, not just the price
pattern alone) that the "breakout" was actually a liquidity grab, not
genuine new demand or supply.

**Technical explanation.** `VolumeLiquidityBot.analyze()` takes two
candle series — `candles_4h` and `candles_1h` — the same PAIR as Bot 1
(1D+4H is Bot 1's actual pair; Bot 4's is 4H+1H, one step faster on
both ends). Its `EntryExitEngine` defaults to `rr=3.0` (matching Bot
2) and `RiskManager` uses `base_risk_percent=1.0` (matching Bot 2 and
Bot 3). Unlike every bot covered so far, Bot 4's own `Candle` objects
must carry real `volume` data — every other bot's logic never reads
that field.

### Visual Model

See diagram: `visuals/bot4-01-spring-upthrust.svg` — a trading range
with a Spring marked at the bottom (a wick below range low, closing
back inside) and an Upthrust marked at the top (a wick above range
high, closing back inside), both annotated "volume must show
divergence here."

### Worked Example

A trader used to Bot 3's FVG-based entries looks for an FVG on a Bot 4
signal and finds none — because Bot 4's entire logic is built around
range structure and volume-confirmed false breaks, concepts that
never appear anywhere in `VolumeLiquidityBot`'s code.

### Counterexample

A trader assumes any false-breakout candle qualifies as a valid Bot 4
setup. Without the specific volume-divergence check (BOT4-04), a
false breakout on HIGH volume is not a Spring or Upthrust by this
bot's real definition — it's exactly the situation Bot 4 is built to
avoid trading.

### Good Example / Bad Example

Good: Recognizing Bot 4 as a range/volume specialist, requiring both a
false-break price pattern AND genuine volume divergence together. Bad:
Treating any range-extreme wick as a tradable Spring or Upthrust
without checking the volume condition this bot's logic actually
requires.

### What to Look Out For

- Bot 4 is the only bot covered so far whose logic reads candle
  `volume` data at all.
- It requires BOTH a price pattern (Spring/Upthrust) AND a volume
  divergence — neither alone is sufficient.
- Its timeframe pair (4H+1H) is faster than Bot 1's (1D+4H) but uses
  the same two-timeframe count.

### Common Mistakes

Looking for FVGs, order blocks, or CHoCH-only confirmation on a Bot 4
setup — concepts central to the other bots — misses that this bot's
real logic is built around a genuinely different framework (range
structure + volume), even though it does also use CHoCH (see BOT4-03).

### Key Takeaways

1. Bot 4 is grounded in Auction Market Theory — accumulation/
   distribution ranges, not SMC zone/gap concepts.
2. It's the only bot covered so far that reads candle volume data.
3. It requires BOTH a Spring/Upthrust price pattern AND a genuine
   volume divergence — neither alone is sufficient.

### Practice Drill

Given five real bot signal cards (provided in Practise), identify the
Bot 4 signal using only its reference to volume divergence and
range structure.

### Scenario Challenge

A trader sees a clean false breakout below a range's low but doesn't
check the volume on that candle. Using this lesson's concept, what's
missing from their read?

### Mini Quiz

Q1 (True/False): Bot 4 is the only bot in this curriculum whose logic
reads candle volume data.
Answer: True — none of Bot 1, Bot 2, or Bot 3's `analyze()` functions
reference candle volume anywhere.

Q2 (Multiple choice): What two Wyckoff patterns does Bot 4 specifically
look for?
(a) BOS and CHoCH
(b) Spring and Upthrust
(c) FVG fill and inversion
(d) Order block mitigation

Answer: (b).

### Flashcards

- Front: What theoretical framework grounds Bot 4? Back: Dalton's
  Auction Market Theory and Wyckoff/Weis volume reading —
  accumulation/distribution, Spring and Upthrust patterns.
- Front: What makes Bot 4 unique among the bots covered so far? Back:
  It's the only one whose real logic reads candle volume data at all.

### Reflection

Why might combining a price pattern (Spring/Upthrust) with a volume
check produce a more reliable signal than either alone? What real-
world market behavior is the volume-divergence check meant to catch?

### Mastery Criteria

Correctly identify the Bot 4 signal card among the five in the
practice drill.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT4 lesson.

### Bot Connection

Verified against `VolumeLiquidityBot.__init__` and `analyze()`'s real
signature in `bot_strategies.py`.

---

## BOT4-02 — Identification: Defining the 4H Range

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT4-01, C2-01
**Learning objectives:** Reproduce Bot 4's exact range-definition test
— minimum swing count, and how range high/low are derived.

### Why This Matters

Every later BOT4 stage depends on a correctly-identified range —
getting this exact test right, not an approximation of it, is the
foundation the rest of the pipeline builds on.

### Core Teaching

**Plain-English explanation.** Bot 4 requires at least 6 total swing
points on the 4H timeframe before it will even attempt a range read —
more than Bot 1's 4-swing minimum. From the most recent swings, it
takes the last 3 swing highs and the last 3 swing lows; the range's
top is the MAXIMUM of those 3 highs, and the range's bottom is the
MINIMUM of those 3 lows — not simply the most recent high and low.

**Technical explanation.** `swings_4h = detect_swing_highs +
detect_swing_lows`; if `len(swings_4h) < 6`, return `None`
immediately. `highs = [s.price for s in swings_4h if
s.structure_type.name == "SWING_HIGH"][-3:]`; `lows = [...][-3:]` —
the last 3 of EACH type. If `len(highs) < 3 or len(lows) < 3`
(possible even with 6+ total swings, if they're unevenly split between
highs and lows), return `None`. `range_high = max(highs)`;
`range_low = min(lows)`; `range_size = range_high - range_low`; if
`range_size == 0` (a genuinely degenerate case), return `None`.

### Visual Model

See diagram: `visuals/bot4-02-range-from-three-swings.svg` — three
recent swing highs at different price levels with the highest one
circled as `range_high`, and three recent swing lows with the lowest
circled as `range_low` — the range boundary is the EXTREME of the
three, not the most recent one.

### Worked Example

The last 3 4H swing highs are at 1.0950, 1.0920, and 1.0965 —
`range_high = 1.0965` (the maximum, not the most recent). The last 3
swing lows are at 1.0870, 1.0855, and 1.0880 — `range_low = 1.0855`
(the minimum). `range_size = 1.0965 - 1.0855 = 0.0110`.

### Counterexample

A trader assumes the range boundary is simply the MOST RECENT swing
high and low, rather than the max/min of the last three of each.
Using only the most recent swing high (1.0920 in the worked example,
not the actual maximum 1.0965) would produce a materially different,
incorrect range.

### Good Example / Bad Example

Good: Taking the maximum of the last 3 swing highs and the minimum of
the last 3 swing lows to define the range. Bad: Using only the single
most recent swing high/low as the range boundary.

### What to Look Out For

- The minimum swing count (6 total) is higher than Bot 1's (4) — a
  stricter data requirement before any read is attempted.
- The range boundary is the MAX of the last 3 highs and MIN of the
  last 3 lows — not simply the most recent of each.
- A `range_size` of exactly zero (a genuinely degenerate, flat
  structure) also returns `None`.

### Common Mistakes

Using only the single most recent swing high and low, rather than the
extreme of the last three of each, is the most common gap between an
intuitive range read and Bot 4's actual, more careful test.

### Key Takeaways

1. Bot 4 requires at least 6 total 4H swing points before attempting
   any range read.
2. The range boundary is the max of the last 3 swing highs and the
   min of the last 3 swing lows — not simply the most recent of each.
3. A degenerate zero-size range also returns `None`.

### Practice Drill

Given six sets of six-or-more 4H swing points (provided in Practise),
correctly calculate `range_high`, `range_low`, and `range_size` for
each using Bot 4's exact test.

### Scenario Challenge

A trader calculates a range using only the single most recent swing
high and low, getting a different result from Bot 4's actual
max-of-3/min-of-3 test. Using this lesson's vocabulary, explain the
discrepancy.

### Mini Quiz

Q1 (True/False): Bot 4's range boundary is the single most recent
swing high and low.
Answer: False — it's the maximum of the last 3 swing highs and the
minimum of the last 3 swing lows.

Q2 (Multiple choice): What's the minimum total 4H swing count Bot 4
requires before attempting a range read?
(a) 4
(b) 5
(c) 6
(d) 10

Answer: (c).

### Flashcards

- Front: How does Bot 4 define its 4H range boundaries? Back:
  `range_high` = max of the last 3 swing highs; `range_low` = min of
  the last 3 swing lows.
- Front: What's Bot 4's minimum total swing requirement? Back: 6 —
  higher than Bot 1's 4-swing minimum.

### Reflection

Why might taking the extreme of the last three swings (rather than
just the most recent one) produce a more reliable range boundary?
What kind of chart structure would make these two approaches disagree
most?

### Mastery Criteria

Correctly calculate `range_high`, `range_low`, and `range_size` for
all six practice-drill swing sets.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this range definition is the
foundation every later BOT4 stage depends on.

### Bot Connection

Verified against `VolumeLiquidityBot.analyze()` Step 1 in
`bot_strategies.py` — the `len(swings_4h) < 6`, `highs[-3:]`/`lows[-3:]`,
and `max(highs)`/`min(lows)` logic quoted directly from source.

---

## BOT4-03 — Context: The 15% Proximity Test and CHoCH Confirmation

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT4-02, C2-07
**Learning objectives:** State the exact proximity test that gates a
Spring/Upthrust search, and confirm Bot 4 checks CHoCH (matching Bot
2's pattern), not BOS.

### Why This Matters

A defined range (BOT4-02) alone isn't enough — Bot 4 only bothers
searching for a Spring or Upthrust when price is ACTUALLY near one of
the range's extremes, and only confirms a real signal with a CHoCH,
the same mechanism Bot 2 uses (but Bot 1 and Bot 3 don't).

### Core Teaching

**Plain-English explanation.** Before looking for a Spring or
Upthrust, Bot 4 checks that the current 1H price is genuinely close to
either the range's top or bottom — not the middle of the range, where
a false-break pattern wouldn't make sense anyway. "Close" is defined
as within 15% of the total range's size from either extreme. Only
then does it search for the actual false-break pattern (BOT4-04), and
only confirms a resulting signal with a genuine CHoCH on the 1H
timeframe (C2-07) — matching Bot 2's CHoCH-based pattern, not Bot 1
or Bot 3's BOS-based one.

**Technical explanation.** `current_price = candles_1h[-1].close`;
`near_high = abs(current_price - range_high) / range_size < 0.15`;
`near_low = abs(current_price - range_low) / range_size < 0.15`. If
NEITHER is true, return `None` — this is checked BEFORE the
Spring/Upthrust search even runs, saving that search for genuinely
relevant price locations. Later: `choch_1h = detect_choch(candles_1h,
swings_1h)`; if empty, return `None`. Like Bot 2, and unlike Bot 1 and
Bot 3, `detect_bos` is never called anywhere in `VolumeLiquidityBot`.

### Visual Model

See diagram: `visuals/bot4-03-proximity-and-choch.svg` — the defined
range with a shaded 15%-of-range band at both the top and bottom
extremes (the "near" zone), and a separate CHoCH confirmation icon
placed after the pattern search — a two-part gate (proximity, then
CHoCH), bracketing the Spring/Upthrust search in between.

### Worked Example

Price sits at 1.0870, with `range_low = 1.0855` and `range_size =
0.0110`. Distance from `range_low` is `0.0015`, and `0.0015/0.0110 ≈
0.136` — under 0.15, so `near_low = True`. The Spring/Upthrust search
(BOT4-04) proceeds.

### Counterexample

Price sits exactly at the range's midpoint — roughly `1.0910` in the
same example. Distance from EITHER extreme is well over 15% of the
range's size; neither `near_high` nor `near_low` is true, and
`analyze()` returns `None` before ever running the Spring/Upthrust
search — there's no meaningful false-break pattern to look for in the
middle of a range.

### Good Example / Bad Example

Good: Checking proximity to a range extreme FIRST, only searching for
a Spring/Upthrust when that proximity test passes, and requiring a
real CHoCH afterward to confirm. Bad: Searching for a Spring/Upthrust
pattern regardless of where price currently sits within the range, or
accepting a BOS instead of a CHoCH as confirmation.

### What to Look Out For

- The 15%-of-range proximity test runs BEFORE the pattern search — a
  real efficiency and precision gate, not just documentation.
- Bot 4 checks CHoCH, matching Bot 2's mechanism — `detect_bos` is
  never called anywhere in this bot's class.
- Both `near_high` and `near_low` being false is a hard `None` —
  there's no fallback search elsewhere in the range.

### Common Mistakes

Searching for a Spring or Upthrust pattern anywhere on the chart,
rather than specifically near a range extreme within the 15% band, is
a common misread of what the actual code checks first.

### Key Takeaways

1. Bot 4 only searches for a Spring/Upthrust when price is within 15%
   of the range's size from either extreme.
2. Bot 4 checks CHoCH for confirmation — matching Bot 2's mechanism,
   not Bot 1 or Bot 3's BOS.
3. Failing the proximity test returns `None` before the pattern search
   even runs.

### Practice Drill

Given six range/current-price pairs (provided in Practise), calculate
whether `near_high` or `near_low` is true for each using the exact
15% test.

### Scenario Challenge

A trader spots what looks like a false-break pattern in the middle of
a defined range, far from either extreme. Using this lesson's exact
proximity test, would Bot 4's real logic ever search for a pattern
there?

### Mini Quiz

Q1 (True/False): Bot 4 searches the entire range for a Spring or
Upthrust, regardless of current price location.
Answer: False — it only searches when the 15%-of-range proximity test
to either extreme passes first.

Q2 (Multiple choice): What confirms a Bot 4 signal after a Spring or
Upthrust pattern is found?
(a) A matching BOS
(b) A matching CHoCH
(c) An FVG fill
(d) A volume spike on the confirmation candle

Answer: (b).

### Flashcards

- Front: What's Bot 4's exact proximity test? Back:
  `abs(current_price - extreme) / range_size < 0.15` for either the
  range high or range low — checked before the pattern search runs.
- Front: Does Bot 4 use BOS or CHoCH for confirmation? Back: CHoCH —
  matching Bot 2's mechanism; `detect_bos` is never called anywhere in
  this bot's class.

### Reflection

Why does it make sense for Bot 4 to check proximity to a range extreme
BEFORE searching for a false-break pattern, rather than searching the
whole chart and filtering afterward?

### Mastery Criteria

Correctly determine `near_high`/`near_low` for all six practice-drill
pairs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this proximity gate directly
precedes BOT4-04's pattern search.

### Bot Connection

Verified against `VolumeLiquidityBot.analyze()` Steps 1-3 in
`bot_strategies.py` — the `< 0.15` proximity test and `detect_choch`
call (with confirmed absence of any `detect_bos` call) quoted directly
from source.

---

## BOT4-04 — Setup: Spring and Upthrust Detection With Volume Divergence

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT4-03
**Learning objectives:** Reproduce Bot 4's exact Spring/Upthrust test,
including its volume-divergence threshold and the "last match wins"
loop behavior.

### Why This Matters

This is the heart of Bot 4's real methodology — the exact price-plus-
volume test that separates a genuine Wyckoff Spring/Upthrust from an
ordinary wick, and a real implementation detail (which candle "wins"
when multiple match) worth knowing precisely.

### Core Teaching

**Plain-English explanation.** Over the last 10 1H candles, Bot 4
checks each one for a Spring pattern: the candle's LOW breaks below
the range low, but its CLOSE comes back above the range low — a false
breakdown that reclaimed the range. It ALSO requires that candle's
volume to be meaningfully below average (less than 80% of the 20-candle
average) — genuine volume divergence, evidence the breakdown lacked
real conviction. Upthrust is the exact mirror at the range high.

**Technical explanation.** `recent_candles = candles_1h[-10:]`; for
each `candle` in this window: Spring check —
`candle.low < range_low and candle.close > range_low`; if true, ALSO
check `avg_vol = mean(candles_1h[-20:].volume)` and
`candle.volume < avg_vol * 0.8` before setting `spring = {...}`.
Upthrust is the mirror. Both checks run in the SAME loop over the same
10 candles — a candle could theoretically satisfy both (unlikely in
practice, but the code doesn't prevent it). Crucially: the loop does
NOT `break` on a match — it keeps iterating, so if MULTIPLE candles in
the 10-candle window satisfy the Spring condition, the LAST one
(most recent) is what `spring` ends up holding, since each match
overwrites the variable. If neither `spring` nor `upthrust` is set
after the full loop, return `None`.

### Visual Model

See diagram: `visuals/bot4-04-spring-detection.svg` — a 10-candle
window with two candles both satisfying the Spring price condition,
volume bars shown beneath each, and an arrow showing the LATER
(more recent) of the two is what the code actually keeps as `spring`.

### Worked Example

Within the last 10 1H candles, candle #3 (of 10) breaks below range
low and closes back above it, with volume at 65% of the 20-candle
average (passes the <80% threshold) — `spring` is set. Candle #7 later
in the same window ALSO satisfies the same Spring condition with
qualifying volume — `spring` is OVERWRITTEN to reference candle #7
instead, since the loop never breaks early.

### Counterexample

A candle breaks below range low and closes back above it, but its
volume is 95% of the 20-candle average — ABOVE the 80% threshold. This
candle does NOT set `spring`, even though the price pattern alone
looks like a textbook false breakdown — the volume-divergence
requirement is a hard, additional condition, not a bonus.

### Good Example / Bad Example

Good: Checking both the price condition AND the volume condition
together for every candle in the 10-candle window, and understanding
that a LATER qualifying candle overwrites an earlier one. Bad:
Treating the price pattern alone as sufficient, or assuming the FIRST
matching candle in the window is what the code keeps.

### What to Look Out For

- BOTH the price condition (low below range, close back above) AND
  the volume condition (<80% of 20-candle average) are required
  together for a candle to count.
- The loop checks all 10 candles and does NOT stop at the first
  match — if multiple candles qualify, the LAST (most recent) one is
  what the variable ends up holding.
- Spring and Upthrust are checked independently in the same loop —
  it's theoretically possible (if unlikely) for both to be set.

### Common Mistakes

Assuming the volume check is a secondary confirmation rather than a
hard, equally-required condition is the most common misread — a
candle with the right price shape but the wrong volume simply does
not set `spring` or `upthrust` at all.

### Key Takeaways

1. A Spring requires BOTH price (low below range, close back above)
   AND volume (below 80% of the 20-candle average) together.
2. If multiple candles in the 10-candle window qualify, the code keeps
   the LAST (most recent) one — the loop never breaks early.
3. Neither pattern found after the full 10-candle loop returns `None`.

### Practice Drill

Given eight 1H candle scenarios with price and volume data (provided
in Practise), determine which set `spring`, which set `upthrust`, and
which set neither.

### Scenario Challenge

Two candles in the same 10-candle window both satisfy the Spring price
condition with qualifying volume — one earlier, one later. A trader
assumes the bot uses the FIRST (earlier) one. Using this lesson's
exact loop behavior, which one does the real code actually keep?

### Mini Quiz

Q1 (True/False): A candle with the correct Spring price pattern but
volume above 80% of the 20-candle average still sets `spring`.
Answer: False — both the price AND volume conditions are required
together; failing the volume check means the candle doesn't qualify.

Q2 (Multiple choice): If two candles in the 10-candle window both
satisfy the Spring conditions, which one does the code end up using?
(a) The first (earliest) one
(b) The last (most recent) one, since the loop never breaks early
(c) Whichever has higher volume
(d) An average of both

Answer: (b).

### Flashcards

- Front: What two conditions must a candle satisfy together to count
  as a Spring? Back: Low breaks below range low AND close comes back
  above range low, AND volume is below 80% of the 20-candle average.
- Front: If multiple candles qualify in the 10-candle window, which
  one wins? Back: The last (most recent) one — the loop checks all 10
  candles without breaking early, so later matches overwrite earlier
  ones.

### Reflection

Why does requiring genuine volume divergence, not just the price
shape, make a Spring or Upthrust a more reliable signal? What kind of
false breakdown would fool a price-only test but fail this bot's real,
combined test?

### Mastery Criteria

Correctly classify all eight practice-drill candle scenarios by Bot
4's exact combined price+volume test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this pattern detection is the
foundation BOT4-06's entry price and BOT4-07's stop both reference.

### Bot Connection

Verified against `VolumeLiquidityBot.analyze()` Step 2 in
`bot_strategies.py` — the `candles_1h[-10:]` loop, the `< avg_vol *
0.8` volume threshold, and the non-breaking loop behavior (confirmed
by tracing the absence of any `break` statement) quoted directly from
source.

---

## BOT4-05 — Invalidation: The Seven Conditions That Return No Signal

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT4-02 through BOT4-04, C2-09
**Learning objectives:** List, in order, all seven points in Bot 4's
pipeline where it returns no signal — the longest gate list of any bot
covered so far.

### Why This Matters

Bot 1 had four gates, Bot 2 had three, Bot 3 had two. Bot 4 has SEVEN
— the longest list by a wide margin — worth understanding as a real,
counted fact about this bot's specific mechanics, not an
approximation.

### Core Teaching

**Plain-English explanation.** Reading through
`VolumeLiquidityBot.analyze()` in order, there are seven distinct
points where it stops and returns no signal: (1) fewer than 6 total 4H
swing points (BOT4-02); (2) fewer than 3 recent swing highs OR fewer
than 3 recent swing lows (BOT4-02); (3) a degenerate zero-size range
(BOT4-02); (4) current price isn't within 15% of either range extreme
(BOT4-03); (5) neither a Spring nor an Upthrust pattern is found
(BOT4-04); (6) no CHoCH is detected on the 1H timeframe at all
(BOT4-03); (7) the found pattern (Spring/Upthrust) and the CHoCH type
don't actually agree — e.g., a Spring found alongside a BEARISH CHoCH,
which satisfies neither the Spring-needs-bullish-CHoCH branch nor the
Upthrust-needs-bearish-CHoCH branch.

**Technical explanation.** This is the longest verified gate list in
this curriculum's cross-bot comparison — seven, versus Bot 1's four,
Bot 2's three, and Bot 3's two. The final gate (7) is worth special
attention: it's not a single `if` check but an `if/elif/else`
structure — `if spring and last_choch["type"] == "bullish_choch":
... elif upthrust and last_choch["type"] == "bearish_choch": ... else:
return None` — meaning a Spring paired with a bearish CHoCH, or an
Upthrust paired with a bullish CHoCH (both real, if less common,
combinations), fall through to this final `None`, exactly as much as
having no CHoCH at all.

### Visual Model

See diagram: `visuals/bot4-05-seven-gates.svg` — a seven-step
sequential gate list, shown at true relative length next to Bot 1's
four, Bot 2's three, and Bot 3's two gate sequences from earlier
lessons, visually emphasizing Bot 4 as the longest.

### Worked Example

A setup passes gates 1 through 6: 8 total swings, 3+ of each type, a
real range, price near the low, a confirmed Spring with qualifying
volume, and a detected CHoCH. If that CHoCH is BULLISH (matching the
Spring's required pairing), gate 7 also passes and a long signal is
produced.

### Counterexample

The same setup passes gates 1 through 6 identically — Spring
confirmed, CHoCH detected — but the detected CHoCH is BEARISH, not
bullish. Gate 7 fails (the Spring-needs-bullish-CHoCH branch doesn't
match, and there's no Upthrust to check against the bearish CHoCH
either), and `analyze()` returns `None` even though six of seven gates
looked fully satisfied.

### Good Example / Bad Example

Good: Checking that the found pattern TYPE (Spring/Upthrust) and the
CHoCH TYPE (bullish/bearish) actually pair correctly, not just that
both exist independently. Bad: Assuming any Spring plus any CHoCH is
sufficient, regardless of whether their directions actually agree.

### What to Look Out For

- Bot 4 has SEVEN real gates — the longest of any bot covered so far.
- The final gate is a pairing check, not just an existence check — a
  Spring needs specifically a BULLISH CHoCH; an Upthrust needs
  specifically a BEARISH one.
- Gates 1-3 are all part of the initial range-definition stage
  (BOT4-02) — three of the seven gates happen before the range is
  even confirmed usable.

### Common Mistakes

Confirming a Spring exists and a CHoCH exists separately, without
checking that their TYPES actually agree with each other, is the most
consequential Bot-4-specific gate-checking mistake.

### Key Takeaways

1. Bot 4 has seven real gates — the longest list of any bot covered
   in this curriculum.
2. The final gate is a pairing check: Spring requires a bullish CHoCH;
   Upthrust requires a bearish CHoCH — not just any CHoCH's existence.
3. Three of the seven gates (swing count, high/low count, zero-size
   range) occur before the range is even confirmed usable.

### Practice Drill

Given nine scenario summaries (provided in Practise) describing which
of the seven gates pass or fail — including at least one mismatched
pattern/CHoCH pairing — determine the outcome for each.

### Scenario Challenge

A trader confirms a clean Upthrust with qualifying volume, and a
CHoCH is also detected — but it's bullish, not bearish. They assume
this should still count as a valid signal since "both conditions are
present." Using this lesson's exact pairing rule, explain why it
doesn't.

### Mini Quiz

Q1 (True/False): Any CHoCH, regardless of its type, satisfies Bot 4's
final confirmation gate once a Spring or Upthrust is found.
Answer: False — the CHoCH type must specifically match the pattern
type: bullish CHoCH for a Spring, bearish CHoCH for an Upthrust.

Q2 (Multiple choice): How many real gates does Bot 4's pipeline have?
(a) Two
(b) Four
(c) Five
(d) Seven

Answer: (d).

### Flashcards

- Front: How many real gates does Bot 4's pipeline have, and how does
  that compare to the other bots? Back: Seven — the most of any bot
  covered (Bot 1: four, Bot 2: three, Bot 3: two).
- Front: What's Bot 4's final gate, precisely? Back: A pairing check —
  a Spring requires specifically a bullish CHoCH; an Upthrust requires
  specifically a bearish CHoCH; any mismatch (or no CHoCH) returns
  `None`.

### Mastery Criteria

Correctly determine the outcome for all nine practice-drill scenarios.

### Reflection

Why might a bot built around a more nuanced, two-signal confirmation
(a specific pattern paired with a specific CHoCH type) need more real
gates than a bot relying on a single confirming event? What does the
gate-count comparison across all four bots covered so far suggest
about each one's relative complexity?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the assembly point for
BOT4-02 through BOT4-04.

### Bot Connection

Every gate here is a direct `return None` line (or the terminal `else`
branch) inside `VolumeLiquidityBot.analyze()` — confirmed as seven by
tracing the function's complete control flow in `bot_strategies.py`.

---

## BOT4-06 — Entry: Direction and Price From the Confirmed Pattern

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT4-05
**Learning objectives:** State Bot 4's entry price rule — the
confirmed pattern candle's own close — with no shared entry-engine
call.

### Why This Matters

Like Bot 3, Bot 4's entry logic is entirely hand-computed rather than
routed through the shared entry engine — worth confirming precisely,
since it's now the SECOND of the four bots covered to skip that shared
helper entirely.

### Core Teaching

**Plain-English explanation.** Once a Spring/Upthrust and its matching
CHoCH both confirm (BOT4-05), Bot 4's entry price is simply the
confirmed pattern candle's own CLOSE price — the price at which that
candle actually closed back inside the range, no separate midpoint or
zone calculation involved. Direction comes directly from which pattern
was confirmed: Spring → long, Upthrust → short.

**Technical explanation.** `if spring and last_choch["type"] ==
"bullish_choch": direction = "long"; entry_price = spring["close"];
... pattern = "spring"`. The mirror for Upthrust:
`entry_price = upthrust["close"]`. Neither branch calls
`EntryExitEngine.calculate_entry` at all — matching Bot 3's pattern of
hand-computed entry logic (BOT3-04), though the actual formula is
different (a candle's close, not an average of two prices).

### Visual Model

See diagram: `visuals/bot4-06-entry-from-close.svg` — the confirmed
Spring candle with its close price marked directly as the entry
point — no zone, no midpoint calculation, just that one candle's own
close value.

### Worked Example

The confirmed Spring candle closed at 1.0862 (back above the
range low of 1.0855, after wicking down to 1.0848). `entry_price =
1.0862` — directly the candle's own close, and `direction = "long"`.

### Counterexample

A trader assumes Bot 4's entry, like Bot 1's or Bot 2's, is calculated
via `calculate_entry` against some zone. There's no zone-mean
calculation anywhere in `VolumeLiquidityBot` — the entry is simply the
confirmed pattern candle's own recorded close price.

### Good Example / Bad Example

Good: Using the confirmed pattern candle's own close price directly as
the entry, with direction set by which pattern (Spring/Upthrust) was
confirmed. Bad: Calculating a separate zone midpoint or applying an
entry-engine call that doesn't exist anywhere in this bot's real logic.

### What to Look Out For

- Entry price is the confirmed candle's own CLOSE — not a midpoint,
  not a zone calculation.
- Direction is set directly by which pattern was confirmed — Spring
  is always long, Upthrust is always short, with no separate check.
- This is now the SECOND bot (after Bot 3) whose entry skips the
  shared `EntryExitEngine.calculate_entry` helper entirely.

### Common Mistakes

Looking for a zone-based entry calculation (the way Bot 1 or Bot 2
would compute one) is a common misread — Bot 4's entry is simply the
confirmed candle's own close.

### Key Takeaways

1. Bot 4's entry price is the confirmed Spring/Upthrust candle's own
   close price — no zone or midpoint calculation involved.
2. Direction is set directly by which pattern was confirmed: Spring
   is long, Upthrust is short.
3. This is the second bot (after Bot 3) whose entry never calls the
   shared `EntryExitEngine.calculate_entry` helper.

### Practice Drill

Given four confirmed pattern scenarios (provided in Practise, mixing
Springs and Upthrusts with their candle close prices), state the exact
entry price and direction for each.

### Scenario Challenge

A trader manually replicating a Bot 4 signal calculates a zone midpoint
instead of using the confirmed candle's own close. Using this lesson's
vocabulary, what's the actual, correct entry price rule they should
have used instead?

### Mini Quiz

Q1 (True/False): Bot 4's entry price is calculated via
`EntryExitEngine.calculate_entry`, the same as Bot 1 and Bot 2.
Answer: False — it's the confirmed pattern candle's own close price,
with no entry-engine call anywhere in this bot's logic.

Q2 (Multiple choice): What determines Bot 4's trade direction?
(a) A separately-computed 4H trend
(b) Which pattern (Spring or Upthrust) was confirmed
(c) The CHoCH type alone, independent of the pattern
(d) Account balance

Answer: (b).

### Flashcards

- Front: What's Bot 4's exact entry price? Back: The confirmed
  Spring/Upthrust candle's own close price — no zone or midpoint
  calculation.
- Front: Which bots' entry logic skips the shared
  `EntryExitEngine.calculate_entry` helper? Back: Bot 3 and Bot 4 —
  both use hand-computed, local entry logic instead.

### Reflection

Now having seen four bots' entry logic, which pattern (shared engine
call vs. hand-computed) do you find easier to reason about when
manually replicating a signal? Why might a codebase mix both
approaches rather than standardizing on one?

### Mastery Criteria

Correctly state entry price and direction for all four practice-drill
scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this entry price is the anchor
BOT4-07's stop calculation is measured from.

### Bot Connection

Verified against `VolumeLiquidityBot.analyze()` Step 3 in
`bot_strategies.py` — the `entry_price = spring["close"]` /
`upthrust["close"]` assignments quoted directly from source, with the
confirmed absence of any `calculate_entry` call anywhere in this
bot's class.

---

## BOT4-07 — Management: Stop, Target, and an Unused Variable

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT4-06, C8-01, C8-02
**Learning objectives:** State Bot 4's exact stop and target formulas
— both hand-computed, unlike any earlier bot — and identify a real,
confirmed piece of dead code in this bot's logic.

### Why This Matters

This lesson includes a second honesty check in this curriculum (after
BOT3-07's docstring-vs-code gap): Bot 4's real code computes a reward-
to-risk value that is NEVER actually used anywhere — not in the
signal's output, not in the reasoning text. Calling this out precisely
is what separates reading real code carefully from assuming every
computed value must matter.

### Core Teaching

**Plain-English explanation.** Bot 4's stop is placed just beyond the
confirmed pattern's own extreme price (the Spring's low, or the
Upthrust's high), with a small buffer equal to 2% of the range's own
size. Its target is the OPPOSITE side of the range, pulled in slightly
(a 5% buffer) rather than the exact range edge — and unlike every
other bot covered so far, there's no TP2/multi-target split here at
all; this is a single, flat target.

**Technical explanation.** For a Spring (long): `sl_price =
spring["extreme"] - range_size * 0.02`. For an Upthrust (short):
`sl_price = upthrust["extreme"] + range_size * 0.02`. Both the stop
and entry are hand-computed, matching BOT4-06's pattern — no
`calculate_stop_loss` call anywhere. Target: `tp = range_high -
range_size * 0.05` (long) or `range_low + range_size * 0.05` (short)
— also hand-computed, with NO call to `calculate_targets` at all,
unlike Bots 1-3, which all use that shared method (even Bot 3, despite
hand-computing its stop, still called `calculate_targets` for its
4:1 target). Position risk uses `setup_quality=1.0` — the LOWEST
multiplier of any bot so far. Confidence is a fixed `0.78`. And: the
code computes `rr = abs(tp - entry_price) / sl_distance if
sl_distance > 0 else 0` — but this `rr` variable is NEVER referenced
again anywhere in the function, not in the returned `BotSignal`, not
in the `reasoning` string. It is genuinely dead code — computed, then
discarded.

### Visual Model

See diagram: `visuals/bot4-07-stop-target-deadcode.svg` — the stop
(pattern extreme +/- 2% of range) and target (opposite range side,
pulled in 5%) shown on the range, with a small side note: "an `rr`
variable is computed here but never used anywhere downstream — a
real, confirmed piece of dead code."

### Worked Example

A confirmed Spring's extreme (low) is 1.0848, in a range with
`range_size = 0.0110`. Stop: `1.0848 - (0.0110 * 0.02) = 1.0846`.
Target: `range_high (1.0965) - (0.0110 * 0.05) = 1.0959`. Both are
single, flat values — no second or third target level exists anywhere
in this bot's output.

### Counterexample

A trader looks for a "tp2" field the way they would on a Bot 1, Bot
2, or Bot 3 signal, expecting a multi-target structure. Bot 4's
signal carries only a single `take_profit` value — there is no
multi-target split anywhere in `VolumeLiquidityBot`.

### Good Example / Bad Example

Good: Using Bot 4's exact hand-computed stop and target formulas, and
recognizing its `rr` variable as real but unused dead code rather than
assuming it must feed something. Bad: Assuming Bot 4 has a TP2-style
multi-target structure like the other bots, or assuming the computed
`rr` value must appear somewhere in the final signal.

### What to Look Out For

- Bot 4's stop buffer is 2% of the range's size beyond the pattern's
  own extreme — a different proportional calculation from Bot 3's
  10%-of-FVG-size buffer.
- Bot 4's target is a SINGLE flat value — no TP2/multi-target
  structure exists anywhere in this bot, unlike Bots 1-3.
- The `rr` variable IS computed but is confirmed, real dead code —
  never referenced again anywhere in the function.

### Common Mistakes

Assuming every computed variable in a real codebase must be used
somewhere downstream is a common, generally reasonable assumption that
this specific line of Bot 4's code disproves — always trace a
variable's actual usage, don't just assume it matters because it was
calculated.

### Key Takeaways

1. Bot 4's stop is the pattern's own extreme, buffered by 2% of the
   range's size — hand-computed, no shared engine call.
2. Its target is a single flat value (opposite range side, minus a 5%
   buffer) — no TP2/multi-target structure, unlike every other bot
   covered so far.
3. Bot 4's code computes an `rr` (reward-to-risk) value that is never
   actually used anywhere — confirmed, genuine dead code.

### Practice Drill

Given three confirmed pattern/range scenarios (provided in Practise),
calculate the exact stop price, target price, and stop distance for
each using Bot 4's real formulas.

### Scenario Challenge

A developer reviewing this codebase wants to log or display Bot 4's
computed reward-to-risk ratio to users. Using this lesson's finding,
what would they need to actually change in the code to make that
value visible anywhere?

### Mini Quiz

Q1 (True/False): Bot 4's signal includes a TP2 field, the same as
Bot 1, Bot 2, and Bot 3.
Answer: False — Bot 4 produces a single flat target with no
multi-target structure at all.

Q2 (Multiple choice): What happens to the `rr` value Bot 4's code
computes?
(a) It's included in the reasoning string
(b) It's used to adjust position size
(c) It's computed but never referenced again anywhere in the function
    — genuine dead code
(d) It overrides the fixed 0.78 confidence value

Answer: (c).

### Flashcards

- Front: What's Bot 4's exact stop buffer? Back: 2% of the range's own
  size, beyond the confirmed pattern's extreme price.
- Front: Is Bot 4's computed `rr` value used anywhere? Back: No — it's
  calculated but never referenced again anywhere in the function,
  confirmed dead code.

### Reflection

Why is it valuable, when learning to read a real codebase, to notice
when a computed value is never actually used — rather than assuming
every line of code must matter downstream? Where might this habit
help you debug or extend a system later?

### Mastery Criteria

Correctly calculate stop, target, and stop distance for all three
practice-drill scenarios, and correctly state that `rr` is unused.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds BOT4-08's
failure-mode analysis.

### Bot Connection

Verified against `VolumeLiquidityBot.analyze()` Steps 4-6 in
`bot_strategies.py` — the `* 0.02` stop buffer, `* 0.05` target
buffer, `setup_quality=1.0`, and `0.78` confidence quoted directly
from source, alongside a confirmed trace showing the `rr` variable is
computed and never used again anywhere in the function.

---

## BOT4-08 — Failure: What a Failed Bot 4 Setup Looks Like

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT4-05, BOT4-07, C9-02
**Learning objectives:** Distinguish a valid Bot 4 loss from a bad
one, with this bot's own characteristic failure pattern.

### Why This Matters

Same discipline as the three earlier failure lessons, applied to
Bot 4's own seven-gate pipeline — the longest and most nuanced of any
bot, which produces its own distinct characteristic bad-loss pattern.

### Core Teaching

**Plain-English explanation.** A valid Bot 4 loss looks like this: all
seven real gates (BOT4-05) genuinely passed — a real range, price
genuinely near an extreme, a genuine volume-confirmed Spring or
Upthrust, and a CHoCH whose type actually matched the pattern — and
the trade still hit its stop. A bad Bot 4 loss most often comes from a
trader treating an ordinary false-break WICK as a Spring or Upthrust
without actually checking the volume-divergence condition (BOT4-04) —
the single most Bot-4-specific mistake, since none of the other three
bots have any volume requirement at all.

**Technical explanation.** Because `VolumeLiquidityBot.analyze()` only
ever returns a complete signal or `None`, a genuine bot-generated Bot
4 signal that loses is a valid loss by the same construction argument
as the other three bots. The Bot-4-specific bad-loss pattern most
often traces to skipping the volume check (BOT4-04) — a human
recognizing the PRICE shape of a Spring or Upthrust but not verifying
the confirming candle's volume was genuinely below 80% of the recent
average, effectively trading a normal-volume false break as if it
were a genuine liquidity-driven one.

### Visual Model

See diagram: `visuals/bot4-08-valid-vs-bad-loss.svg` — two false-break
candles at a range extreme, one with genuinely low volume (labeled
"valid Spring — real bot signal") and one with average/high volume
(labeled "not a real Spring by this bot's test — a bad loss if traded
manually").

### Worked Example

A genuine Bot 4 signal fires: a real 6+-swing range, price near the
low, a confirmed Spring with volume at 60% of average, and a matching
bullish CHoCH. The trade hits its stop. Since all seven gates
genuinely passed, this is a valid loss (C9-02) — no process change is
warranted.

### Counterexample

A trader sees a candle wick below a range low and closing back inside
— the right PRICE shape for a Spring — but doesn't check its volume,
which was actually 110% of the recent average (well above the 80%
threshold). They enter anyway. The trade loses. This is a bad loss —
the volume-divergence gate (BOT4-04) was never actually satisfied.

### Good Example / Bad Example

Good: Always checking the confirming candle's actual volume against
the 20-candle average before trusting a Spring or Upthrust pattern.
Bad: Trading any false-break-shaped candle at a range extreme without
verifying the volume condition this bot's real logic actually requires.

### What to Look Out For

- The most common Bot-4-specific bad-loss pattern is skipping the
  volume-divergence check — trading the price shape alone.
- A genuine, bot-generated Bot 4 signal that loses is a valid loss by
  construction, same as the other three bots.
- Bot 4's seven-gate pipeline also means a second, subtler bad-loss
  source: ignoring the pattern-type/CHoCH-type pairing rule
  (BOT4-05's gate 7).

### Common Mistakes

Treating price shape alone as sufficient evidence of a Spring or
Upthrust, without checking the actual volume data, is the single most
consequential mistake for this bot specifically — and the one none of
the other three bots' failure lessons would have prepared a trader for.

### Key Takeaways

1. A genuine, bot-generated Bot 4 signal that loses is a valid loss by
   construction — all seven real gates were already enforced.
2. The most common Bot-4-specific bad loss comes from skipping the
   volume-divergence check and trading price shape alone.
3. A second, subtler Bot-4-specific bad-loss source is ignoring the
   pattern-type/CHoCH-type pairing rule (BOT4-05's final gate).

### Practice Drill

Given five losing-trade case studies styled after Bot 4 (provided in
Practise), determine which are valid losses and which are bad losses,
checking both the volume condition and the pattern/CHoCH pairing in
each case.

### Scenario Challenge

A trader's manually-placed "Bot 4 style" trade loses. On review, the
confirming candle's volume was 92% of the 20-candle average — above
the 80% threshold. Using this lesson's vocabulary, classify this loss.

### Mini Quiz

Q1 (True/False): A false-break candle with volume above the 80%
threshold can still be a valid Spring by Bot 4's real test.
Answer: False — the volume-divergence condition (below 80% of the
20-candle average) is required together with the price pattern; above
that threshold, it doesn't qualify.

Q2 (Multiple choice): What's the most common Bot-4-specific pattern
behind a bad loss?
(a) Using too wide a stop
(b) Trading a false-break candle's price shape without checking its
    actual volume against the 80% threshold
(c) Targeting too high an R:R
(d) Ignoring the range's size

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 4 signal a valid or
  bad loss? Back: Valid — all seven BOT4-05 gates were already
  enforced by construction.
- Front: What's the most common Bot-4-specific bad-loss pattern? Back:
  Trading a false-break candle's price shape without checking that its
  volume was genuinely below 80% of the 20-candle average.

### Reflection

Across all four bots covered so far, each has its own distinct
characteristic bad-loss pattern. What does Bot 4's volume-specific
mistake add to that list that none of the other three bots' failure
lessons could have taught?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — applies C9-02's model with full
Bot 4-specific precision, completing the four-bot comparison started
in BOT1-08.

### Bot Connection

Grounded in the fact that `VolumeLiquidityBot.analyze()` only ever
returns a complete signal or `None`, with the volume-divergence
condition and pattern/CHoCH pairing rule both verified directly
against `bot_strategies.py`.

---

## BOT4-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 17 minutes
**Prerequisites:** BOT4-01 through BOT4-08
**Learning objectives:** Apply every real stage of Bot 4's longest-yet
pipeline, in order, to one continuous scenario.

### Why This Matters

Same discipline as the three earlier Practice lessons, now applied to
Bot 4's seven-gate pipeline — the most steps of any bot covered, and
the first to require checking volume data as part of the exercise.

### Core Teaching

**Plain-English explanation.** Given a full 4H+1H scenario with volume
data included, work through Bot 4's pipeline in order: define the
range from at least 6 swings (BOT4-02), confirm price is within 15% of
an extreme (BOT4-03), search the last 10 1H candles for a volume-
confirmed Spring or Upthrust (BOT4-04), confirm a matching-type CHoCH
(BOT4-05), set entry from the pattern candle's close and direction
from the pattern type (BOT4-06), and calculate the 2%-of-range stop
and 5%-of-range-buffered target (BOT4-07).

**Technical explanation.** This exercise mirrors
`VolumeLiquidityBot.analyze()`'s real, longest control flow — seven
gates, two hand-computed values (entry, stop AND target — three
hand-computed values total, more than any other bot), and a volume
condition none of the other bots' exercises required checking.

### Visual Model

See diagram: `visuals/bot4-09-full-pipeline-worksheet.svg` — a
seven-row worksheet mirroring `analyze()`'s real, longest step
sequence, with an explicit volume-data column for the pattern-search
row.

### Worked Example

A full worked scenario (provided in Practise) walks a 4H chart with 7
swings defining a range, a 1H chart with price near the range low, a
confirmed Spring at 58% of average volume, and a matching bullish
CHoCH — producing the exact entry, stop, and target Bot 4's real code
would compute for that data.

### Counterexample

A trader completes the exercise but skips checking the pattern
candle's volume entirely, assuming the price shape alone was
sufficient — their answer doesn't match what the real, volume-gated
code would actually produce for a scenario where that volume happens
to fail the 80% threshold.

### Good Example / Bad Example

Good: Checking every one of the seven real gates in order, including
the volume condition, before producing a final signal. Bad: Skipping
the volume check because "the price pattern looked right," or
assuming a TP2-style multi-target exists the way it does for the
other three bots.

### What to Look Out For

- This exercise has the most real gates (seven) and hand-computed
  values (three: entry, stop, target) of any BOT-track Practice lesson
  so far.
- The volume condition must actually be checked numerically (below
  80% of the 20-candle average) — not assumed from the price shape
  alone.
- There is no TP2 field to compute — Bot 4 produces a single flat
  target only.

### Common Mistakes

Skipping the volume check, or inventing a TP2-style second target that
doesn't exist in this bot's real output, are the two most common
shortcuts this exercise exists to catch.

### Key Takeaways

1. Bot 4's full pipeline has the most real gates (seven) of any bot
   covered, and requires checking actual volume data.
2. Three values are hand-computed (entry, stop, target) — more than
   any other bot's pipeline.
3. There is no multi-target/TP2 structure — a single flat target only.

### Practice Drill

Given a full chart scenario (provided in Practise) with 4H and 1H
data including volume, work through the complete pipeline to produce
the exact entry, stop, and target Bot 4's code would output.

### Scenario Challenge

Given two scenarios (provided in Practise) that differ only in whether
the confirming candle's volume passes the 80% threshold, work both
through completely and show how that single difference changes the
final outcome (signal vs. `None`).

### Mini Quiz

Q1 (True/False): This exercise requires computing a TP2-style second
target, the same as Bot 1, Bot 2, and Bot 3's exercises.
Answer: False — Bot 4 produces a single flat target only; there's no
multi-target structure anywhere in this bot's real output.

Q2 (Multiple choice): How many real gates does this exercise need to
check, at most?
(a) Two
(b) Four
(c) Five
(d) Seven

Answer: (d).

### Flashcards

- Front: How many hand-computed values does Bot 4's pipeline produce?
  Back: Three — entry price, stop price, and target price — more than
  any other bot covered.
- Front: How many real gates does this exercise need to check? Back:
  Up to seven — the most of any BOT-track Practice lesson so far.

### Mastery Criteria

Correctly produce the exact entry, stop, and target for the
practice-drill scenario, and correctly show the outcome change in the
volume-threshold comparison exercise.

### Reflection

Having now worked through all four bots' full pipelines by hand, which
single real detail (a hidden condition, an unused variable, a hand-
computed formula) most changed how you'd read one of these bots'
signals going forward?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT4-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`VolumeLiquidityBot.analyze()`'s real control flow — no step here
exists that isn't a real line of code in `bot_strategies.py`.

---

## BOT4-10 — Capstone: Full Bot 4 Decision Simulation

**Level:** 4
**Estimated study time:** 18 minutes
**Prerequisites:** BOT4-01 through BOT4-09
**Learning objectives:** Given raw multi-timeframe chart data
(including volume), produce the complete Bot 4 decision — full signal
or correctly-identified `None` with the specific failing gate.

### Why This Matters

This capstone is the practical payoff of the entire BOT4 track — the
most demanding of the four bots' capstones so far, given seven real
gates and a genuine volume-data requirement, none of which the earlier
three bots' capstones needed.

### Core Teaching

**Plain-English explanation.** Given raw 4H and 1H candle data
(including volume), work the entire pipeline from scratch: detect
swings and define the range, check proximity to an extreme, search for
a volume-confirmed Spring or Upthrust, confirm a matching-type CHoCH,
calculate entry from the pattern candle's close, and calculate the
hand-computed stop and single flat target — or correctly stop at
whichever of the seven BOT4-05 gates fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of
`VolumeLiquidityBot.analyze()` — called only when `market_data`
contains both `"4H"` and `"1H"`. A correct capstone answer matches
every field of the real `BotSignal` (with confidence FIXED at `0.78`
— verify no variation) or a precise `None` with the specific failing
gate, out of all seven possible.

### Visual Model

See diagram: `visuals/bot4-10-capstone-flow.svg` — the complete,
unbroken pipeline from raw 4H/1H candle data (with volume) through
every BOT4-01 through BOT4-09 stage to a final signal-or-None outcome.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 4H and 1H
data with volume. Working the complete pipeline: 7 total swings define
a valid range, price sits within 15% of the range low, a Spring is
confirmed at 71% of average volume (passes the <80% threshold), a
matching bullish CHoCH confirms, producing a long entry at the Spring
candle's close, a stop 2% of the range below the Spring's extreme, and
a flat target 5% short of the range high — matching what
`VolumeLiquidityBot.analyze()` would output for this exact data.

### Counterexample

A different capstone scenario supplies raw data where a clean-looking
Spring pattern exists, but its confirming candle's volume is 88% of
the 20-candle average — above the 80% threshold. The correct capstone
answer is an explicit `None` at the pattern-detection gate (BOT4-05),
regardless of how clean the price shape otherwise looks.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, genuinely
calculating the volume percentage rather than assuming it from the
price shape, and answering `None` with the specific gate when that's
correct. Bad: Assuming a clean-looking false-break candle automatically
qualifies without calculating its actual volume ratio.

### What to Look Out For

- A correct `None` answer, with the specific gate identified out of
  all seven possible, is just as complete a capstone answer as a full
  signal.
- The volume percentage must be genuinely calculated against the
  20-candle average — not assumed from the price pattern alone.
- Confidence for Bot 4 is a fixed 0.78 whenever a signal fires — no
  TP2 field, and the computed `rr` value should not appear anywhere in
  the final answer (BOT4-07's confirmed dead code).

### Common Mistakes

At this capstone level, inventing a TP2-style second target, or
including the unused `rr` value as if it were part of the real output,
are the two most consequential mistakes — both directly contradict
BOT4-07's confirmed findings about this bot's actual code.

### Key Takeaways

1. The capstone works Bot 4's complete, seven-gate pipeline from raw
   candle data — the longest of any bot's capstone in this curriculum.
2. A correctly-identified `None`, with the specific failing gate out
   of seven, is just as valid a capstone answer as a complete signal.
3. A correct signal answer has no TP2 field and no visible `rr` value
   — Bot 4 produces a single flat target and a fixed 0.78 confidence.

### Practice Drill

Given three raw multi-timeframe scenarios with volume data (provided
in Practise, at least one producing `None`), work the complete Bot 4
pipeline for each.

### Scenario Challenge

Given a raw scenario where every gate passes except the final
pattern/CHoCH pairing (a confirmed Upthrust paired with a bullish, not
bearish, CHoCH), produce the complete, correct pipeline output,
including exactly which gate this fails at.

### Mini Quiz

Q1 (True/False): A correct capstone signal answer for Bot 4 should
include a TP2 field.
Answer: False — Bot 4 produces a single flat target only; no
multi-target structure exists anywhere in the real code.

Q2 (Multiple choice): How many possible gates could a correct `None`
answer for Bot 4 need to identify?
(a) Two
(b) Four
(c) Five
(d) Seven

Answer: (d).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 4H
  and 1H candle data, including volume — no swings, range, pattern, or
  CHoCH pre-identified.
- Front: How many possible failing gates might a correct `None` answer
  need to identify? Back: Up to seven — the most of any bot's capstone
  in this curriculum.

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios.

### Reflection

Across this entire track, which single real detail — the 7-swing
range definition, the volume-divergence threshold, the pattern/CHoCH
pairing rule, or the unused `rr` variable — took the most repetition
to internalize as an exact rule rather than an approximation?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone completes the
four-bot comparison begun in BOT1-10, and is the direct template for
BOT5's own capstone.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 4:
Needs 4H + 1H" invocation of `VolumeLiquidityBot.analyze()` in full —
every real step, gate, hand-computed value, and confirmed dead-code
detail, verified directly against `bot_strategies.py`.
