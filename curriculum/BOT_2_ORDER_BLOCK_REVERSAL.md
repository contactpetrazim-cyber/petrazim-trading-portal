# BOT 2 — ORDER BLOCK REVERSAL MASTERY

Ten-lesson specialization track for Bot 2 (High-Frequency Order Block
Reversal, ICT Core Mentorship style) — verified line-by-line against
`backend/app/core/bot_strategies.py`'s `OrderBlockReversalBot`. Where a
rule differs from Bot 1's (BOT_1_MACRO_SWING_STRUCTURE.md), that
contrast is called out explicitly — the two bots share vocabulary
(zones, structure, FVGs) but run genuinely different real logic.

---

## BOT2-01 — Concept: High-Frequency Order Block Reversal

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT1-01, C4-02, C6-02
**Learning objectives:** Explain Bot 2's philosophy — trading LTF
reversals INSIDE HTF order blocks — and name its real three-timeframe
scope.

### Why This Matters

Bot 1 traded slow, two-timeframe continuation moves. Bot 2 is a
genuinely different animal: fast, three-timeframe, reversal-seeking —
understanding that difference up front is what keeps a trader from
expecting Bot 1's cadence and hold time from a Bot 2 signal.

### Core Teaching

**Plain-English explanation.** Bot 2 (ICT Core Mentorship style)
looks for price returning INSIDE a higher-timeframe order block
(C4-02) — the discount zone for a long, premium zone for a short
(C6-02) — and then reversing there on a faster timeframe, confirmed by
an internal liquidity sweep and a fresh structural shift. It's built
for rapid premium/discount adjustments, not the slow, wide-stop swing
Bot 1 targets.

**Technical explanation.** `OrderBlockReversalBot.analyze()` takes
THREE candle series — `candles_4h`, `candles_1h`, `candles_15m` — one
more than Bot 1's two. Its `EntryExitEngine` defaults to `rr=3.0`
(vs. Bot 1's 5.0) and its `RiskManager` uses `base_risk_percent=1.0`
(vs. Bot 1's 1.5) — both numbers reflecting a tighter, higher-frequency
style than Bot 1's wide-stop swing approach.

### Visual Model

See diagram: `visuals/bot2-01-three-timeframe-scope.svg` — Bot 1's two
boxes (1D, 4H) shown next to Bot 2's three (4H, 1H, 15M), with the
15M box highlighted as the reversal-confirmation timeframe neither of
Bot 1's timeframes has an equivalent to.

### Worked Example

A trader used to Bot 1's multi-day hold expects a Bot 2 signal to
behave the same way. Bot 2's actual position, once triggered, is
managed on a much faster internal clock (15M confirmation, tight
sweep-based stops) — a completely different rhythm from the same
platform's Bot 1.

### Counterexample

A trader applies Bot 1's "trust the wide stop, hold for days" mindset
to a Bot 2 position. This misapplies Bot 1's philosophy to a bot whose
own real risk parameters (1.0% base risk, a tighter target parameter
than Bot 1's) are tuned for a faster, tighter style entirely.

### Good Example / Bad Example

Good: Recognizing Bot 2 as a fast, three-timeframe reversal specialist
with its own distinct risk parameters. Bad: Treating all 5 bots as
interchangeable variations of one generic SMC strategy.

### What to Look Out For

- Bot 2 uses THREE timeframes (4H, 1H, 15M) — one more than Bot 1.
- Its real base risk (1.0%) and target parameter (3.0) are both
  tighter than Bot 1's (1.5%, 5.0) — see BOT2-07 for a real, verified
  nuance about what "target parameter" actually controls.
- It is a REVERSAL bot (trading INSIDE a zone, expecting a turn) —
  Bot 1 is a CONTINUATION bot (trading a confirmed ongoing trend).

### Common Mistakes

Assuming any two of the platform's 5 bots share the same risk profile
or hold-time expectation just because they both use SMC vocabulary
(zones, BOS, FVGs) is the most common cross-bot confusion this lesson
exists to correct.

### Key Takeaways

1. Bot 2 reads 4H, 1H, and 15M data — three timeframes, one more than
   Bot 1's two.
2. Its real base risk (1.0%) and target parameter (3.0) are both
   tighter than Bot 1's, reflecting a faster, higher-frequency style.
3. Bot 2 is a reversal specialist — trading INSIDE an HTF zone for a
   turn — genuinely different from Bot 1's continuation philosophy.

### Practice Drill

Given five real bot signal cards (provided in Practise), correctly
identify the Bot 2 signal using only its timeframe inputs and
risk/target parameters.

### Scenario Challenge

A trader holds a Bot 2 position for a week the way they would a Bot 1
signal, reasoning "they're both SMC bots." Using this lesson's real
risk-parameter contrast, what's misapplied here?

### Mini Quiz

Q1 (True/False): Bot 2 uses the same three-candle-series input as
Bot 1.
Answer: False — Bot 2 takes `candles_4h`, `candles_1h`, AND
`candles_15m`; Bot 1 takes only `candles_1d` and `candles_4h`.

Q2 (Multiple choice): What reward-to-risk PARAMETER does Bot 2 pass
into its target calculation?
(a) 1.0
(b) 3.0
(c) 5.0
(d) 10.0

Answer: (b) — `EntryExitEngine(default_rr=3.0)` — though see BOT2-07
for what the actually-reported take-profit field turns out to be.

### Flashcards

- Front: How many timeframes does Bot 2's pipeline read? Back: Three
  — 4H, 1H, and 15M.
- Front: Is Bot 2 a continuation or reversal specialist? Back:
  Reversal — it trades price returning INSIDE an HTF order block,
  expecting a turn there, unlike Bot 1's continuation philosophy.

### Reflection

Which of your own habits (hold time, stop tolerance) would need to
change moving from a Bot 1 signal to a Bot 2 one? Why does that
matter given they share the same underlying SMC vocabulary?

### Mastery Criteria

Correctly identify the Bot 2 signal card among the five in the
practice drill.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT2 lesson.

### Bot Connection

Verified against `OrderBlockReversalBot.__init__` and `analyze()`'s
real signature in `bot_strategies.py`.

---

## BOT2-02 — Identification: The 4H-Then-1H Order Block Fallback

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT2-01, C4-02, C4-04
**Learning objectives:** Reproduce Bot 2's exact HTF order block
search — including its fallback from 4H to 1H — and state why price
must be found INSIDE the selected zone.

### Why This Matters

Bot 1's zone search (BOT1-04) only ever looked at 4H. Bot 2's real
logic is more layered — a genuine fallback mechanic that doesn't exist
anywhere in Bot 1's pipeline — and getting this exactly right is what
separates an accurate read of Bot 2 from an approximation of it.

### Core Teaching

**Plain-English explanation.** Bot 2 first looks for ACTIVE order
blocks (C4-02, C4-04) on the 4H timeframe. If none are found, it
FALLS BACK to searching the 1H timeframe instead — a real two-tier
search that only exists in this bot's pipeline. Whichever timeframe
produces active zones, the bot then checks whether the CURRENT 15M
price is actually sitting INSIDE one of them (between its top and
bottom) — not just nearby.

**Technical explanation.** `obs = detect_order_blocks(candles_4h, ...)`;
`active_obs = [z for z in obs if z.status.name == "ACTIVE"]`. If
`active_obs` is empty, the code explicitly re-runs the same detection
on `candles_1h` instead: `obs = detect_order_blocks(candles_1h, ...)`;
`active_obs = [...]`. If STILL empty after both attempts,
`analyze()` returns `None`. Then: `current_price = candles_15m[-1].close`;
`inside_obs = [z for z in active_obs if z.bottom <= current_price <=
z.top]` — an explicit inclusive range check, not a proximity or
"near enough" test. Empty `inside_obs` also returns `None`.

### Visual Model

See diagram: `visuals/bot2-02-fallback-and-inside-test.svg` — a
two-step flowchart: "4H active OBs found?" (No -> try 1H) -> "1H
active OBs found?" (No -> None) -> "current 15M price inside any
active OB?" (No -> None) -> proceed.

### Worked Example

No 4H order blocks are currently ACTIVE. The bot falls back to 1H,
where one ACTIVE bullish order block exists spanning 1.0840-1.0880.
The most recent 15M candle closed at 1.0860 — inside that range.
`inside_obs` contains this zone, and the pipeline proceeds.

### Counterexample

The same 1H zone (1.0840-1.0880) is active, but the most recent 15M
candle closed at 1.0895 — ABOVE the zone's top, not inside it. Even
though price is close to the zone, `inside_obs` is empty (the test is
inclusive range, not proximity), and `analyze()` returns `None`.

### Good Example / Bad Example

Good: Always checking 4H first, only falling back to 1H if 4H has no
active zones, then requiring price to be genuinely INSIDE the
selected zone's range. Bad: Treating "price is near the zone" as
equivalent to "price is inside the zone," or skipping straight to 1H
without checking 4H first.

### What to Look Out For

- 4H is always checked FIRST — 1H is a fallback, only used when 4H
  has zero active zones, never the primary search.
- "Inside" means the inclusive range test `bottom <= price <= top` —
  proximity to a zone's edge is not the same as being inside it.
- No active zones on EITHER timeframe (not just 4H) is what actually
  returns `None` here.

### Common Mistakes

Treating "close to a zone" as functionally the same as "inside a
zone" is the most common gap between an intuitive read and Bot 2's
real, stricter inclusive-range test.

### Key Takeaways

1. Bot 2 searches 4H first, falling back to 1H only if 4H has no
   ACTIVE order blocks.
2. Current 15M price must be genuinely INSIDE the selected zone's
   range — an inclusive `bottom <= price <= top` test, not proximity.
3. No active zones on either timeframe returns `None` — the fallback
   doesn't guarantee a zone will be found.

### Practice Drill

Given six 4H/1H zone-availability scenarios paired with a current 15M
price (provided in Practise), determine which zone (if any) Bot 2's
logic would select, applying the fallback and inside-range test
exactly.

### Scenario Challenge

A trader sees price sitting just 2 pips above a 1H order block's top
edge and calls it "basically inside." Using Bot 2's actual inclusive-
range test, is that read correct?

### Mini Quiz

Q1 (True/False): Bot 2 always checks 1H order blocks, regardless of
whether 4H has active zones.
Answer: False — 1H is only checked as a fallback when the 4H search
finds zero active order blocks.

Q2 (Multiple choice): What test does Bot 2 use to determine if price
is "inside" a zone?
(a) Within 10 pips of either edge
(b) `zone.bottom <= current_price <= zone.top`, inclusive
(c) Within the zone's middle 50% only
(d) Any price on the same day the zone formed

Answer: (b).

### Flashcards

- Front: What's Bot 2's real HTF search order? Back: 4H first; only
  falls back to 1H if 4H has zero ACTIVE order blocks.
- Front: What's the exact "inside zone" test? Back: The inclusive
  range check `zone.bottom <= current_price <= zone.top` — proximity
  alone doesn't satisfy it.

### Reflection

Have you ever judged price as "close enough" to a zone rather than
strictly inside it? How does Bot 2's exact inclusive-range test change
that judgment?

### Mastery Criteria

Correctly apply the fallback and inside-range test to all six
practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this zone selection is the
foundation BOT2-03's 15M confirmation stage builds on.

### Bot Connection

Verified against `OrderBlockReversalBot.analyze()` Steps 1-2 in
`bot_strategies.py` — the 4H-then-1H fallback and
`z.bottom <= current_price <= z.top` inside-range test quoted directly
from source.

---

## BOT2-03 — Context: Why 15M CHoCH (Not BOS) Confirms This Reversal

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT2-02, C2-06, C2-07
**Learning objectives:** Explain why Bot 2 requires a 15M CHoCH, in
direct contrast to Bot 1's BOS-only requirement, and state how
direction is derived from it.

### Why This Matters

BOT1-03 taught that Bot 1 checks BOS and never CHoCH. Bot 2 is the
exact mirror image — a direct, concrete illustration of why the same
structural vocabulary (C2-06, C2-07) means genuinely different things
to a continuation bot versus a reversal bot.

### Core Teaching

**Plain-English explanation.** Because Bot 2 is trading a REVERSAL
(price turning around inside an HTF zone, not continuing an existing
trend), it needs the opposite structural signal from Bot 1: a CHoCH
(C2-07) on the 15M timeframe — evidence the short-term trend is
actually changing direction right there, inside the selected zone.
Bot 2's own trade direction (long or short) comes directly from
WHICH TYPE of CHoCH fires — there's no separate 1H/4H trend check to
align against, unlike Bot 1.

**Technical explanation.** `choch_15m = detect_choch(candles_15m,
swings_15m)`; if empty, `analyze()` returns `None`. Direction is read
directly off the last CHoCH's type: `if last_choch["type"] ==
"bullish_choch": direction = "long"`, `elif ... "bearish_choch": ...
"short"`, `else: return None`. There is no `detect_bos` call anywhere
in `OrderBlockReversalBot` — the exact opposite omission from Bot 1,
which never calls `detect_choch`.

### Visual Model

See diagram: `visuals/bot2-03-choch-derives-direction.svg` — a 15M
chart inside the selected HTF zone, with a CHoCH marked and an arrow
showing its type (`bullish_choch`/`bearish_choch`) directly setting
the trade's `direction` field — no separate trend-alignment check
shown, unlike Bot 1's two-step (trend THEN BOS-match) process.

### Worked Example

Price is inside a bullish 1H order block (BOT2-02). The 15M timeframe
prints a bullish CHoCH — the short-term downswing reversing upward
right at the zone. `direction = "long"` is set directly from this
CHoCH's type, and the pipeline proceeds to BOT2-04's sweep/FVG check.

### Counterexample

Price is inside the same bullish zone, but the 15M timeframe instead
prints a bullish BOS (continuation of the existing 15M downtrend
breaking further down, then a bullish break) rather than a CHoCH.
Bot 2's logic never calls `detect_bos` at all — this event is
invisible to its pipeline; `choch_15m` would be empty, and
`analyze()` returns `None` regardless of what the BOS shows.

### Good Example / Bad Example

Good: Treating a 15M CHoCH as the only valid confirmation signal for
Bot 2, with its type directly setting trade direction. Bad: Looking
for a BOS to confirm a Bot 2 setup, or assuming direction needs a
separate trend-alignment check the way Bot 1 requires.

### What to Look Out For

- Bot 2 checks ONLY CHoCH — `detect_bos` is never called anywhere in
  this bot's class.
- Direction comes DIRECTLY from the CHoCH type — there's no separate
  "does this match the HTF trend" check like Bot 1 has.
- An unrecognized CHoCH type (neither bullish nor bearish, a defensive
  code branch) also returns `None`.

### Common Mistakes

Carrying Bot 1's "BOS confirms, CHoCH doesn't apply" rule over to Bot
2 is the single most common cross-bot error this lesson exists to
prevent — the two bots require exactly opposite structural signals.

### Key Takeaways

1. Bot 2 requires a 15M CHoCH — never a BOS, the exact opposite of
   Bot 1's requirement.
2. Trade direction is read directly from the CHoCH's type
   (`bullish_choch`/`bearish_choch`) — no separate trend-alignment
   check exists in this bot.
3. No CHoCH detected, or an unrecognized type, returns `None`.

### Practice Drill

Given five 15M structural-event scenarios (provided in Practise, a
mix of BOS and CHoCH events, both directions), determine which ones
Bot 2's logic would act on and what direction each would produce.

### Scenario Challenge

A trader familiar with Bot 1 sees a strong 15M BOS inside a Bot 2
target zone and assumes it confirms the setup. Using this lesson's
exact contrast with BOT1-03, explain why it doesn't.

### Mini Quiz

Q1 (True/False): A 15M BOS can confirm a Bot 2 setup the same way a
CHoCH does.
Answer: False — `detect_bos` is never called anywhere in
`OrderBlockReversalBot`; only CHoCH confirms this bot's setups.

Q2 (Multiple choice): Where does Bot 2's trade direction come from?
(a) A separate 1D trend check, like Bot 1
(b) Directly from the detected 15M CHoCH's type
(c) Whichever direction has more volume
(d) The HTF zone's own polarity alone, ignoring the 15M event

Answer: (b).

### Flashcards

- Front: Does Bot 2 ever check for a BOS? Back: No —
  `detect_bos` is never called anywhere in `OrderBlockReversalBot`;
  only CHoCH confirms.
- Front: How is Bot 2's trade direction determined? Back: Directly
  from the 15M CHoCH's type — no separate HTF trend-alignment check
  exists, unlike Bot 1.

### Reflection

Why does it make sense that a reversal bot (Bot 2) requires the
opposite structural signal from a continuation bot (Bot 1)? What does
this contrast teach about reading structural events by CONTEXT, not
just by their name?

### Mastery Criteria

Correctly classify all five practice-drill structural events by
whether Bot 2 would act on them and what direction each implies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this BOS-vs-CHoCH contrast with
BOT1-03 resurfaces again in BOT4-03 and BOT5-03.

### Bot Connection

Verified against `OrderBlockReversalBot.analyze()` Step 3 in
`bot_strategies.py` — the `detect_choch` call and
`last_choch["type"]` direction logic, and the confirmed absence of any
`detect_bos` call anywhere in this bot's class.

---

## BOT2-04 — Setup: Liquidity Sweep and FVG Confirmation

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT2-03, C3-04, C5-01
**Learning objectives:** State what a confirmed internal liquidity
sweep adds to a Bot 2 setup, and how FVG presence is checked
afterward.

### Why This Matters

A confirmed CHoCH (BOT2-03) is enough to determine direction, but Bot
2's real logic layers TWO more real checks on top before deciding how
aggressively to enter and how confident to report the signal — this
lesson covers both.

### Core Teaching

**Plain-English explanation.** After the 15M CHoCH confirms direction,
Bot 2 checks whether a liquidity sweep (C3-04) of internal equal
highs/lows happened in the last few candles — evidence retail
stop-liquidity was grabbed right before the reversal, a stronger
signal than a CHoCH alone. Separately, it also checks whether an
active Fair Value Gap (C5-01) matching the trade direction exists on
the 15M timeframe — additional confluence, though NOT a hard
requirement the way the sweep check partially is (see BOT2-06).

**Technical explanation.** `pools = detect_equal_highs_lows(candles_15m)`;
`sweeps = detect_liquidity_sweeps(pools, candles_15m[-5:])` — checked
only against the last 5 candles. `has_sweep = len(sweeps) > 0`, a
simple boolean the rest of the pipeline branches on (BOT2-06,
BOT2-07). Separately: `fvgs = detect_fvg(candles_15m[-10:])`;
`active_fvgs = [f for f in fvgs if f.status.name == "ACTIVE" and
f.gap_type == direction]` — filtered to the last 10 candles and to
the CONFIRMED direction from BOT2-03. Note: `active_fvgs` is computed
and referenced in the signal's `reasoning` string, but its COUNT does
not gate whether a signal fires at all — only `has_sweep` changes the
entry type and stop method downstream.

### Visual Model

See diagram: `visuals/bot2-04-sweep-and-fvg.svg` — a 15M chart showing
an equal-highs/lows pool, a sweep of it in the last 5 candles, and a
direction-matching FVG in the last 10 candles, with `has_sweep`
labeled as the branching flag and the FVG count labeled "confluence,
not a gate."

### Worked Example

Following a confirmed bullish CHoCH, the last 5 candles show a sweep
of a sell-side liquidity pool — `has_sweep = True`. Checking the last
10 candles for bullish FVGs, one active bullish FVG is found. Both
facts feed into `reasoning`, and `has_sweep` will determine the entry
type in BOT2-06.

### Counterexample

The same confirmed CHoCH occurs, but no liquidity sweep is found in
the last 5 candles (`has_sweep = False`). The setup still proceeds —
a liquidity sweep is confirmation-strength information, not a hard
gate the way the CHoCH itself is — but it will take the more
conservative entry path in BOT2-06 and carry a lower reported
confidence in BOT2-07.

### Good Example / Bad Example

Good: Checking for a sweep in exactly the last 5 candles and an FVG
in exactly the last 10, both scoped to the real windows the code
uses, and treating the sweep as a signal-quality input rather than a
hard requirement. Bad: Treating either the sweep or the FVG as a
mandatory gate that blocks the signal entirely if absent — neither
actually does that in this bot's real logic.

### What to Look Out For

- The sweep check is scoped to exactly the last 5 candles — not the
  whole visible chart.
- The FVG check is scoped to exactly the last 10 candles, and filtered
  to match the confirmed trade direction.
- Neither check is a hard gate on its own — `has_sweep` changes
  DOWNSTREAM behavior (entry type, stop method); the FVG count is
  informational, feeding `reasoning` only.

### Common Mistakes

Treating the sweep or FVG check as pass/fail gates the way the CHoCH
check (BOT2-03) actually is confuses two different roles in this
pipeline — only the CHoCH is a hard requirement; the sweep and FVG
checks shape HOW the resulting signal is built, not WHETHER one exists.

### Key Takeaways

1. A liquidity sweep is checked in exactly the last 5 candles — its
   presence (`has_sweep`) changes downstream behavior, but its absence
   doesn't block the signal.
2. A direction-matching FVG is checked in exactly the last 10 candles
   — informational confluence, not a gate.
3. Only the CHoCH (BOT2-03) is a hard pass/fail gate at this point in
   the pipeline — the sweep and FVG checks shape quality, not
   existence.

### Practice Drill

Given four 15M scenarios with varying sweep/FVG presence (provided in
Practise), correctly determine `has_sweep` and the count of matching
active FVGs for each, using the real 5-candle/10-candle windows.

### Scenario Challenge

A trader sees a confirmed CHoCH but no liquidity sweep in the recent
candles and assumes the setup is invalid. Using this lesson's
vocabulary, is that the correct read of Bot 2's actual logic?

### Mini Quiz

Q1 (True/False): A Bot 2 setup with no detected liquidity sweep is
automatically invalidated.
Answer: False — `has_sweep` shapes the entry type and stop method
downstream, but its absence doesn't block the signal from being
produced.

Q2 (Multiple choice): Over how many recent candles does Bot 2 check
for a liquidity sweep?
(a) The last 3
(b) The last 5
(c) The last 10
(d) The entire visible chart

Answer: (b).

### Flashcards

- Front: Is a liquidity sweep a hard requirement for a Bot 2 signal?
  Back: No — its presence shapes downstream entry/stop behavior
  (BOT2-06/07), but its absence doesn't block a signal from firing.
- Front: What windows does Bot 2 use for the sweep and FVG checks?
  Back: Last 5 candles for the sweep check; last 10 candles for the
  direction-matching FVG check.

### Reflection

Why might a bot design a "soft" confirmation signal (the sweep) that
changes HOW a trade is built rather than a hard gate on WHETHER it
fires? What does that say about the sweep's actual confirmation strength
versus the CHoCH's?

### Mastery Criteria

Correctly determine `has_sweep` and matching active FVG count for all
four practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — `has_sweep` is the exact flag
BOT2-06 and BOT2-07 branch on.

### Bot Connection

Verified against `OrderBlockReversalBot.analyze()` Steps 4-5 in
`bot_strategies.py` — the `candles_15m[-5:]` sweep window and
`candles_15m[-10:]` FVG window, and `has_sweep`'s downstream role,
quoted directly from source.

---

## BOT2-05 — Invalidation: The Three Points That Return No Signal

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT2-02, BOT2-03, C2-09
**Learning objectives:** List, in order, the three points in Bot 2's
pipeline where it returns no signal.

### Why This Matters

Same discipline as BOT1-05, applied to Bot 2's genuinely different
real pipeline — the complete, exact list of every reason this specific
bot declines to signal, not an approximation borrowed from Bot 1.

### Core Teaching

**Plain-English explanation.** Reading through
`OrderBlockReversalBot.analyze()` in order, there are exactly three
points where it stops and returns no signal: (1) no ACTIVE order block
exists on EITHER 4H or the 1H fallback (BOT2-02); (2) the current 15M
price isn't actually inside any of the active zones found (BOT2-02);
(3) no 15M CHoCH is detected, or its type is unrecognized (BOT2-03).
Note there are only three gates here — fewer than Bot 1's four — since
the sweep and FVG checks (BOT2-04) are never hard gates.

**Technical explanation.** This matters because, unlike Bot 1 (four
sequential hard gates), Bot 2 has only three, and its confirmation
signals split cleanly into HARD gates (order block availability,
inside-zone test, CHoCH detection) and SOFT quality signals (sweep
presence, FVG presence) that shape the eventual signal's fields
without being able to block it outright. Confusing a soft signal for
a hard gate (e.g., assuming no sweep = no signal) is a real,
Bot-2-specific misread this lesson exists to prevent.

### Visual Model

See diagram: `visuals/bot2-05-three-gates.svg` — three sequential hard
gates (HTF zone availability -> inside-zone test -> 15M CHoCH
detected) each with a "return None" branch, with the sweep and FVG
checks shown OFF this main gate sequence, feeding only into the final
signal's fields once all three gates pass.

### Worked Example

A setup passes all three gates: an active 1H order block exists, 15M
price sits inside it, and a matching CHoCH confirms direction. Whether
or not a sweep or matching FVG is also present, a signal IS produced
— those two checks only affect which entry type and confidence level
that signal carries.

### Counterexample

A setup has an active 1H order block and price is inside it, but no
CHoCH forms on the 15M timeframe. Even with a clean liquidity sweep
and a matching FVG both present, gate 3 fails and `analyze()` returns
`None` — the soft signals never override a failed hard gate.

### Good Example / Bad Example

Good: Checking the three hard gates first, in order, and only then
looking at sweep/FVG presence to understand what KIND of signal (entry
type, confidence) would result. Bad: Treating a strong sweep or FVG
as able to compensate for a missing CHoCH or an order block price
isn't actually inside.

### What to Look Out For

- Only three hard gates exist for Bot 2 — fewer than Bot 1's four.
- The sweep and FVG checks (BOT2-04) are NEVER among these three hard
  gates — they only shape a signal that's already going to fire.
- All three hard gates must pass in order — an early failure means
  later checks (including the soft ones) are never even reached.

### Common Mistakes

Assuming a strong liquidity sweep or FVG can "make up for" a failed
hard gate (no CHoCH, price not inside the zone) is the single most
consequential Bot-2-specific misread — soft signals never override a
failed hard gate in this bot's real logic.

### Key Takeaways

1. Bot 2 has exactly three hard gates: HTF zone availability,
   inside-zone test, and 15M CHoCH detection.
2. The sweep and FVG checks are soft signals — they shape signal
   quality but never substitute for a failed hard gate.
3. All three hard gates are sequential — failing one means later
   checks (hard or soft) are never reached.

### Practice Drill

Given seven scenario summaries (provided in Practise) describing which
of the three hard gates pass or fail, plus sweep/FVG presence,
determine whether `analyze()` returns a signal or `None` for each.

### Scenario Challenge

A setup has a strong liquidity sweep and a matching FVG, but price
never actually entered the selected order block's range. A trader
argues the sweep and FVG should be enough. Using this lesson's
vocabulary, why isn't it?

### Mini Quiz

Q1 (True/False): A confirmed liquidity sweep can substitute for a
missing 15M CHoCH.
Answer: False — the sweep is a soft signal that only shapes an
already-firing signal; it never substitutes for a failed hard gate.

Q2 (Multiple choice): How many hard gates does Bot 2's pipeline have?
(a) Two
(b) Three
(c) Four
(d) Five

Answer: (b).

### Flashcards

- Front: What are Bot 2's three hard gates? Back: HTF (4H-then-1H)
  zone availability, current-price-inside-zone test, and 15M CHoCH
  detection — in that order.
- Front: Can the sweep or FVG checks override a failed hard gate?
  Back: No — they're soft signals that only shape an already-firing
  signal's fields (entry type, confidence), never a substitute for a
  hard gate.

### Mastery Criteria

Correctly determine the outcome (signal or None, and why) for all
seven practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — the hard/soft distinction here
is the direct foundation for BOT2-08's failure-mode analysis.

### Bot Connection

Every gate here is a direct `return None` line inside
`OrderBlockReversalBot.analyze()` in `bot_strategies.py`, with the
hard/soft distinction confirmed by tracing exactly which checks can
and cannot short-circuit the function.

---

## BOT2-06 — Entry: The Conditional Mean-or-Aggressive Entry

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT2-04, BOT1-06
**Learning objectives:** State Bot 2's conditional entry-type rule and
contrast it directly with Bot 1's unconditional one.

### Why This Matters

BOT1-06 established that Bot 1 always uses a mean entry, unconditionally.
Bot 2 is the direct counter-example — the platform's only bot (of the
first two covered) whose entry TYPE itself depends on a real, checked
condition, not just its price level.

### Core Teaching

**Plain-English explanation.** Bot 2 chooses between two entry types
based on whether a liquidity sweep was confirmed (BOT2-04): if a sweep
happened, it uses the more conservative "mean" entry (the zone's
midpoint, same style as Bot 1); if NO sweep was found, it uses a more
"aggressive" entry instead — entering closer to the near edge of the
zone rather than waiting for the deeper mean-level fill.

**Technical explanation.** `entry_type = "mean" if has_sweep else
"aggressive"`; `entry = calculate_entry(target_ob, entry_type,
direction)`. This is a genuine conditional branch — the only one of
its kind covered so far in this curriculum — contrasted directly with
Bot 1's unconditional `"mean"` call. The logic here is that a
confirmed sweep is stronger evidence the reversal is real, which
justifies waiting for a better (deeper) fill; without that
confirmation, the bot enters more aggressively to avoid missing the
move entirely.

### Visual Model

See diagram: `visuals/bot2-06-conditional-entry.svg` — a decision
diamond ("has_sweep?") branching to two entry markers on the same
zone: "mean" (sweep confirmed, deeper fill) and "aggressive" (no
sweep, shallower fill, closer to the zone's near edge).

### Worked Example

A confirmed sweep (BOT2-04) means Bot 2 enters at the selected zone's
mean — the same calculation style as Bot 1's BOT1-06, but here it's a
CONDITIONAL choice, not the bot's only option.

### Counterexample

The same setup, but with no liquidity sweep detected. Bot 2 enters
"aggressively" instead — a shallower fill closer to the zone's edge,
genuinely different math from the mean calculation, even though the
zone and direction are identical.

### Good Example / Bad Example

Good: Checking `has_sweep` first, then applying the correct entry
type — mean for a confirmed sweep, aggressive otherwise. Bad: Always
using a mean entry for Bot 2 regardless of sweep status, which
misses this bot's real conditional logic entirely.

### What to Look Out For

- Bot 2's entry type is CONDITIONAL on `has_sweep` — unlike Bot 1,
  which always uses "mean" no matter what.
- A confirmed sweep leads to the MORE conservative entry (mean); no
  sweep leads to the MORE aggressive one — this might feel backwards
  at first, so check it against the real code, not intuition.
- This conditional-entry pattern is unique to Bot 2 among the bots
  covered so far.

### Common Mistakes

Assuming every bot's entry-type logic works like Bot 1's (a single,
unconditional choice) is the most common gap this lesson exists to
close — Bot 2's real logic genuinely branches on a checked condition.

### Key Takeaways

1. Bot 2's entry type is conditional: `"mean"` if a sweep was
   confirmed, `"aggressive"` otherwise.
2. This directly contrasts with Bot 1's unconditional `"mean"` entry
   — genuinely different logic, not a simplification of it.
3. A confirmed sweep leads to the more conservative (mean) entry;
   its absence leads to the more aggressive one.

### Practice Drill

Given four zone/sweep-status pairs (provided in Practise), determine
which entry type Bot 2's logic would use for each and explain why.

### Scenario Challenge

A trader assumes Bot 2 always enters at a zone's mean, the same as
Bot 1. They see a Bot 2 signal enter noticeably closer to a zone's
edge than expected. Using this lesson's vocabulary, what actually
happened?

### Mini Quiz

Q1 (True/False): Bot 2 always enters at the exact mean of its
selected zone, the same as Bot 1.
Answer: False — its entry type is conditional on `has_sweep`: mean if
confirmed, aggressive if not.

Q2 (Multiple choice): When does Bot 2 use the "aggressive" entry type?
(a) When a liquidity sweep is confirmed
(b) When no liquidity sweep is confirmed
(c) Only on the 4H timeframe
(d) Never — it's dead code

Answer: (b).

### Flashcards

- Front: What determines Bot 2's entry type? Back: `has_sweep` — mean
  if a liquidity sweep was confirmed, aggressive if not.
- Front: How does Bot 2's entry logic contrast with Bot 1's? Back:
  Bot 1's entry type is unconditional (always mean); Bot 2's is
  conditional on sweep confirmation.

### Reflection

Before this lesson, would you have assumed all 5 bots use the same
entry-price logic? What does Bot 2's real conditional branch suggest
about how differently "the same underlying idea" can actually be
implemented?

### Mastery Criteria

Correctly determine the entry type for all four practice-drill
zone/sweep pairs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this conditional-entry pattern
is the direct setup for BOT2-07's matching conditional stop method.

### Bot Connection

Verified against `OrderBlockReversalBot.analyze()` Step 6 in
`bot_strategies.py` — `entry_type = "mean" if has_sweep else
"aggressive"` quoted directly from source.

---

## BOT2-07 — Management: Sweep-Based vs. Structure-Based Stops

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT2-06, C8-02
**Learning objectives:** State Bot 2's two stop-placement methods and
which condition selects each.

### Why This Matters

BOT2-06 showed entry type branches on `has_sweep`. This lesson shows
the SAME condition also determines an entirely different stop-placement
METHOD — not just a different distance, but a genuinely different
reference point.

### Core Teaching

**Plain-English explanation.** If a liquidity sweep was confirmed, Bot
2 places its stop right beyond the sweep's own extreme price (with a
small fixed buffer) — a tight, sweep-anchored stop, reflecting high
confidence in exactly where the reversal happened. If NO sweep was
confirmed, it falls back to a structure-based stop instead — beyond
the most recent 15M swing point, the same general style as Bot 1's
stop logic (BOT1-07), just on a much faster timeframe.

**Technical explanation.** If `has_sweep`: `sl_price = sweeps[-1]
["sweep_price"]`, then a small FIXED buffer (`0.0002`, not a
percentage or ATR-based distance) is subtracted (long) or added
(short); `method: "sweep_extreme"`. If NOT `has_sweep`: `sl_swing =
swings_15m[-1]`; `sl = calculate_stop_loss(entry, target_ob, sl_swing,
"structure_swing")` — the same `"structure_swing"` method name Bot 1
uses, just against 15M swings instead of 1D ones. Target:
`calculate_targets(..., rr_ratio=3.0)`, reporting `tp2` — but as
BOT1-07 found, `tp2`'s multiplier is hardcoded to a fixed 2:1 in
`EntryExitEngine.calculate_targets`, completely ignoring the passed
`rr_ratio`; Bot 2's real, reported take-profit is a fixed 2:1, the
same as Bot 1's, regardless of the different `rr_ratio` value each bot
passes in. Risk uses `setup_quality=1.1`. Confidence is reported as
`0.80` if `has_sweep` else `0.70` — a real, coded confidence
difference tied to the exact same condition.

### Visual Model

See diagram: `visuals/bot2-07-two-stop-methods.svg` — two stop
placements on the same zone: "sweep_extreme" (tight, anchored to the
sweep's own price + a fixed 0.0002 buffer) and "structure_swing"
(wider, anchored to the most recent 15M swing) — both feeding into the
same fixed-2:1 TP2 target calculation.

### Worked Example

A confirmed sweep's extreme price is 1.0838. The stop is placed at
1.0836 (1.0838 minus the 0.0002 buffer, for a long). Entry (mean, from
BOT2-06) is 1.0860 — stop distance is 24 pips, and the reported TP2
target sits 48 pips above entry (a fixed 2:1) — not 72 pips (3:1),
even though `rr_ratio=3.0` was passed in.

### Counterexample

The same setup with no confirmed sweep instead uses the most recent
15M swing low as its structural stop reference — likely a wider
distance than the sweep-based 24 pips, changing both the reported
confidence (0.70 instead of 0.80) and the position size that results
from the wider stop.

### Good Example / Bad Example

Good: Checking `has_sweep` first, then applying the matching stop
method (sweep-extreme-plus-buffer, or structure-swing) exactly as the
real code does. Bad: Always using one stop method regardless of
sweep status, or using a percentage-based buffer instead of the real
fixed 0.0002 value.

### What to Look Out For

- The sweep-based stop's buffer is a FIXED value (0.0002), not a
  percentage or ATR-scaled distance.
- The structure-based stop uses the SAME `"structure_swing"` method
  name as Bot 1, but references 15M swings, not 1D ones.
- Reported confidence (0.80 vs 0.70) is directly tied to the same
  `has_sweep` condition that determines entry type and stop method.

### Common Mistakes

Assuming Bot 2's stop distance is always roughly the same regardless
of sweep status is a common misread — the sweep and no-sweep paths use
genuinely different reference points and typically produce very
different stop distances.

### Key Takeaways

1. A confirmed sweep produces a tight stop anchored to the sweep's own
   extreme price plus a fixed 0.0002 buffer.
2. No confirmed sweep falls back to a structure-based stop against the
   most recent 15M swing — wider, and less certain.
3. Reported confidence (0.80/0.70) and the earlier entry-type choice
   (BOT2-06) are both tied to this exact same `has_sweep` condition.

### Practice Drill

Given three complete sweep/no-sweep scenarios (provided in Practise),
calculate the exact stop price, stop distance, TP2 target, and
reported confidence for each.

### Scenario Challenge

A trader notices two Bot 2 signals on the same symbol have very
different stop distances despite similar-looking zones. Using this
lesson's vocabulary, what single condition most likely explains the
difference?

### Mini Quiz

Q1 (True/False): Bot 2's sweep-based stop buffer scales with the
size of the zone.
Answer: False — it's a fixed 0.0002 buffer beyond the sweep's own
extreme price, regardless of zone size.

Q2 (Multiple choice): What confidence does Bot 2 report when NO
liquidity sweep was confirmed?
(a) 0.60
(b) 0.70
(c) 0.80
(d) 0.90

Answer: (b).

### Flashcards

- Front: What are Bot 2's two stop-placement methods? Back:
  "sweep_extreme" (sweep price + fixed 0.0002 buffer) if a sweep was
  confirmed; "structure_swing" (most recent 15M swing) if not.
- Front: What confidence values does Bot 2 report, and what determines
  which one? Back: 0.80 if `has_sweep`, 0.70 if not — the same
  condition that also determines entry type and stop method.

### Reflection

Why might a bot use a tighter, more confident stop when a liquidity
sweep confirms the reversal, and a wider, less confident one when it
doesn't? What does that suggest about how confirmation strength should
shape risk, not just direction?

### Mastery Criteria

Correctly calculate stop, distance, TP2, and confidence for all three
practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds directly into
BOT2-08's failure-mode analysis.

### Bot Connection

Verified against `OrderBlockReversalBot.analyze()` Step 7 in
`bot_strategies.py` — the `0.0002` fixed buffer, `"sweep_extreme"` /
`"structure_swing"` method names, `rr_ratio=3.0`, and `0.80`/`0.70`
confidence values all quoted directly from source.

---

## BOT2-08 — Failure: What a Failed Bot 2 Setup Looks Like

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT2-05, BOT2-07, C9-02
**Learning objectives:** Distinguish a valid Bot 2 loss from a bad one,
using this bot's real three-hard-gate structure.

### Why This Matters

BOT1-08 applied C9-02's model with full Bot 1-specific precision. This
lesson does the same for Bot 2's genuinely different pipeline — the
most common bad-loss pattern here is a different mistake entirely
from Bot 1's.

### Core Teaching

**Plain-English explanation.** A valid Bot 2 loss looks like this: all
three hard gates from BOT2-05 genuinely passed (an active HTF zone
found, price genuinely inside it, a real CHoCH confirming direction),
the entry/stop were calculated correctly per BOT2-06/07 given the
actual `has_sweep` status, and the trade still hit its stop — normal
variance (ORIENT-04). A bad Bot 2 loss most often traces back to the
exact opposite mistake from Bot 1's most common one: mistaking a 15M
BOS for a CHoCH (BOT2-03), since this bot's whole confirmation depends
on the reversal-specific signal, not the continuation one.

**Technical explanation.** Because `OrderBlockReversalBot.analyze()`
either returns a fully gate-passed `BotSignal` or `None`, any REAL Bot
2 signal has, by construction, already passed all three BOT2-05 gates
— so a genuine signal that loses is a valid loss by the same logic as
BOT1-08. A bad Bot 2 loss specifically traces to a human treating a
soft signal (a sweep or FVG, BOT2-04) as sufficient confirmation on
its own without an actual CHoCH present — the exact hard/soft
confusion BOT2-05 warned against.

### Visual Model

See diagram: `visuals/bot2-08-valid-vs-bad-loss.svg` — two paths: a
real Bot 2 signal (all three hard gates passed) hitting its stop,
labeled "valid loss"; and a manually forced trade based on a sweep +
FVG alone with no actual CHoCH, labeled "bad loss — hard gate never
passed."

### Worked Example

A genuine Bot 2 signal fires: 1H order block active, 15M price inside
it, confirmed bullish CHoCH, confirmed sweep (tight sweep-based stop).
Price reverses again and the stop is hit. Since all three hard gates
genuinely passed, this is a valid loss — no process change is
warranted from this single trade.

### Counterexample

A trader sees a clean liquidity sweep and a matching bullish FVG
inside an active order block, but no CHoCH has actually formed yet —
they enter anyway, treating the sweep and FVG as "enough" confirmation.
The trade loses. This is a bad loss — the actual hard gate (CHoCH,
BOT2-03/05) was never satisfied; a soft signal was mistaken for one.

### Good Example / Bad Example

Good: Trusting that a genuine, bot-generated Bot 2 signal that loses
is a valid loss by construction. Bad: Manually entering on a sweep +
FVG combination alone, without an actual confirmed CHoCH, and treating
a resulting loss as if the real process had been followed.

### What to Look Out For

- A genuine, bot-generated Bot 2 signal is a valid loss by
  construction if it loses — all three hard gates were already
  enforced automatically.
- The most common Bot-2-specific bad-loss pattern is treating a soft
  signal (sweep, FVG) as sufficient without an actual CHoCH present.
- This is the mirror-image mistake from Bot 1's most common bad loss
  (mistaking CHoCH for BOS) — here it's mistaking soft confluence for
  the hard CHoCH gate.

### Common Mistakes

Assuming strong-looking confluence (a clean sweep, a nice FVG) is
"basically as good as" a confirmed CHoCH is the single most
consequential mistake this lesson exists to correct for this
specific bot.

### Key Takeaways

1. A genuine, bot-generated Bot 2 signal that loses is a valid loss by
   construction — all three hard gates were already enforced.
2. The most common Bot-2-specific bad loss comes from treating a soft
   signal (sweep or FVG) as sufficient without an actual CHoCH.
3. This mirrors, but is distinct from, Bot 1's most common bad-loss
   pattern — each bot has its own characteristic failure mode.

### Practice Drill

Given five losing-trade case studies styled after Bot 2 (provided in
Practise), determine which are valid losses and which are bad losses,
identifying the specific missing hard gate where relevant.

### Scenario Challenge

A trader's manually-placed "Bot 2 style" trade loses. On review, a
clean sweep and matching FVG were both present, but no CHoCH had
actually formed. Using this lesson's vocabulary, classify this loss.

### Mini Quiz

Q1 (True/False): A strong liquidity sweep and matching FVG are
sufficient confirmation for a Bot 2 setup even without a CHoCH.
Answer: False — CHoCH is the hard gate; sweep and FVG are soft signals
that never substitute for it (BOT2-05).

Q2 (Multiple choice): What's the most common Bot-2-specific pattern
behind a bad loss?
(a) Using too tight a stop
(b) Treating a sweep/FVG combination as sufficient without an actual
    confirmed CHoCH
(c) Targeting too low an R:R
(d) Trading too infrequently

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 2 signal a valid or
  bad loss? Back: Valid — all three BOT2-05 hard gates were already
  enforced by construction.
- Front: What's the most common Bot-2-specific bad-loss pattern?
  Back: Treating a soft signal (sweep or FVG) as sufficient
  confirmation without an actual confirmed CHoCH.

### Reflection

Compare this bot's most common bad-loss pattern to Bot 1's (BOT1-08).
What does the contrast teach about how "confirmation" means something
different, and can be misread differently, for each bot's specific
methodology?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — applies C9-02's model with full
Bot 2-specific precision, directly contrasted with BOT1-08.

### Bot Connection

Grounded in the fact that `OrderBlockReversalBot.analyze()` only ever
returns a complete signal or `None`, with the sweep/FVG soft-signal
distinction verified directly against the code's own branching logic.

---

## BOT2-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 16 minutes
**Prerequisites:** BOT2-01 through BOT2-08
**Learning objectives:** Apply every real stage of Bot 2's pipeline,
in order, to one continuous scenario.

### Why This Matters

Same discipline as BOT1-09, applied to Bot 2's genuinely different
seven real steps — the first lesson to require running the FULL
sequence (HTF zone search with fallback, inside-zone test, CHoCH,
sweep/FVG check, conditional entry, conditional stop, target/sizing)
in the pipeline's real order.

### Core Teaching

**Plain-English explanation.** Given a full multi-timeframe scenario,
work through Bot 2's pipeline exactly in order: search 4H then 1H for
active order blocks (BOT2-02), confirm current 15M price is inside one
(BOT2-02), check for a 15M CHoCH and derive direction (BOT2-03), check
for a sweep and matching FVG (BOT2-04), apply the correct conditional
entry type (BOT2-06), apply the correct conditional stop method
(BOT2-07), and calculate the actual, fixed-2:1 TP2 target (not the
3:1 the passed `rr_ratio` might suggest) with the right reported
confidence.

**Technical explanation.** This exercise mirrors
`OrderBlockReversalBot.analyze()`'s literal control flow, including
its fallback logic and its TWO conditional branches (entry type, stop
method) both keyed off the same `has_sweep` boolean — a genuinely more
branching exercise than BOT1-09's more linear pipeline.

### Visual Model

See diagram: `visuals/bot2-09-full-pipeline-worksheet.svg` — a
seven-row worksheet mirroring `analyze()`'s real step sequence, with
the entry-type and stop-method rows both explicitly branching on the
same `has_sweep` value computed earlier in the same worksheet.

### Worked Example

A full worked scenario (provided in Practise) walks a 4H/1H/15M chart
set through the whole pipeline — no active 4H zones, a fallback to 1H
finds one, price is inside it, a confirmed CHoCH sets direction, a
confirmed sweep sets `has_sweep = True`, producing a mean entry and a
sweep-extreme stop, ending in the exact same final signal
`OrderBlockReversalBot.analyze()` would compute for that data.

### Counterexample

A trader completes the exercise but applies the mean entry type
despite `has_sweep` being `False` in the given scenario — their final
entry price doesn't match what the real conditional logic (BOT2-06)
would actually produce.

### Good Example / Bad Example

Good: Computing `has_sweep` once, then correctly applying it to BOTH
the entry-type and stop-method decisions, exactly as the real code
does. Bad: Treating entry type and stop method as two separate,
unrelated choices rather than both being keyed off the same underlying
condition.

### What to Look Out For

- `has_sweep` is computed ONCE and used TWICE (entry type AND stop
  method) — get it right the first time.
- The 4H-then-1H fallback (BOT2-02) must be checked before anything
  else — don't skip straight to 1H.
- Every number produced should trace back to a specific real value
  from the given chart data.

### Common Mistakes

Recomputing or second-guessing `has_sweep` differently for the entry
decision versus the stop decision is a common exercise-specific
mistake — it's the same single boolean value driving both choices.

### Key Takeaways

1. Bot 2's full pipeline is seven real, ordered steps, with genuine
   branching (fallback search, then two decisions keyed off one
   shared condition).
2. `has_sweep` is computed once and reused for both the entry-type and
   stop-method decisions — consistency matters.
3. This is the same "assemble the pieces" discipline as BOT1-09, now
   applied to a pipeline with real conditional branches.

### Practice Drill

Given a full chart scenario (provided in Practise), work through all
seven real steps to produce the exact entry price, stop price, TP2
target, and confidence Bot 2's code would output.

### Scenario Challenge

Given two full scenarios (provided in Practise) that differ only in
sweep presence, work both through completely and show how that single
difference changes FOUR separate output fields (entry price, stop
method, stop distance, confidence).

### Mini Quiz

Q1 (True/False): The entry-type decision and the stop-method decision
in Bot 2's pipeline are independent of each other.
Answer: False — both are keyed off the exact same `has_sweep` boolean,
computed once.

Q2 (Multiple choice): What must be checked before the 1H order block
search in this exercise?
(a) The 15M CHoCH
(b) Whether the 4H timeframe already has active order blocks
(c) The liquidity sweep
(d) The FVG count

Answer: (b).

### Flashcards

- Front: How many output fields does `has_sweep` affect in Bot 2's
  pipeline? Back: At least four — entry type, entry price, stop
  method, stop distance, and reported confidence.
- Front: What must be checked before falling back to the 1H order
  block search? Back: Whether the 4H timeframe already has ACTIVE
  order blocks — 1H is only a fallback.

### Mastery Criteria

Correctly produce the exact entry, stop, TP2, and confidence for the
practice-drill scenario, and correctly show all four affected fields
in the sweep-presence comparison exercise.

### Reflection

Which single value in Bot 2's pipeline (`has_sweep`) ended up
affecting the most downstream decisions? What does that suggest about
which real-world confirmation signal to weigh most carefully when
reading this bot's setups?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT2-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`OrderBlockReversalBot.analyze()`'s real control flow, including its
two `has_sweep`-keyed branches — no step here exists that isn't a real
line of code in `bot_strategies.py`.

---

## BOT2-10 — Capstone: Full Bot 2 Decision Simulation

**Level:** 4
**Estimated study time:** 18 minutes
**Prerequisites:** BOT2-01 through BOT2-09
**Learning objectives:** Given raw multi-timeframe chart data, produce
the complete Bot 2 decision — full signal or correctly-identified
`None` with the specific failing gate.

### Why This Matters

This capstone is the practical payoff of the entire BOT2 track — the
first and only lesson requiring the complete, real Bot 2 decision
from raw data, including its fallback search and both conditional
branches, with nothing pre-selected.

### Core Teaching

**Plain-English explanation.** Given raw 4H, 1H, and 15M candle data,
work the entire pipeline from scratch: detect 4H order blocks (falling
back to 1H if needed), confirm price is inside one, detect the 15M
CHoCH and derive direction, check for a sweep and matching FVG, apply
the correct conditional entry and stop, and calculate the final target
and confidence — or correctly stop at whichever of the three hard
gates (BOT2-05) fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of
`OrderBlockReversalBot.analyze()` — called only when
`market_data` contains all of `"4H"`, `"1H"`, and `"15M"`, with the
exact same raw inputs a live signal run would use. A correct capstone
answer matches every field of the real `BotSignal` (or a precise
`None` with the specific failing gate) — nothing approximated.

### Visual Model

See diagram: `visuals/bot2-10-capstone-flow.svg` — the complete,
unbroken pipeline from raw candle data through every BOT2-01 through
BOT2-09 stage to a final signal-or-None outcome, including both
conditional branches drawn explicitly.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 4H, 1H,
and 15M data. Working the complete pipeline: no active 4H zones, a 1H
fallback finds one, 15M price sits inside it, a bearish CHoCH confirms
direction, no sweep is found (`has_sweep = False`), producing an
aggressive entry and a structure-swing stop at the most recent 15M
swing high, with a fixed-2:1 TP2 target and 0.70 confidence — matching
what `OrderBlockReversalBot.analyze()` would output for this exact
data.

### Counterexample

A different capstone scenario supplies raw data where price is inside
an active 1H zone, a sweep is present, and an FVG matches direction —
but no CHoCH has formed on the 15M timeframe. The correct capstone
answer is an explicit `None` at the CHoCH gate (BOT2-05), regardless of
how strong the sweep and FVG confluence looks.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, correctly applying
the 4H-then-1H fallback and both conditional branches, and answering
`None` with the specific gate when that's the correct outcome. Bad:
Skipping the fallback check, or forcing a signal based on strong soft
confluence (sweep, FVG) without a genuine hard-gate pass.

### What to Look Out For

- A correct `None` answer, with the specific gate identified, is just
  as complete a capstone answer as a full signal.
- Both conditional branches (entry type, stop method) must use the
  SAME `has_sweep` value, computed once from the raw data.
- The 4H-then-1H fallback must be checked in the correct order before
  the inside-zone test.

### Common Mistakes

At this capstone level, forcing a signal from strong-looking soft
confluence (a clean sweep, a nice FVG) without an actual CHoCH present
is the most consequential mistake — exactly the BOT2-08 failure mode,
now tested against raw, unscaffolded data.

### Key Takeaways

1. The capstone works Bot 2's complete pipeline from raw candle data,
   including the 4H-then-1H fallback search.
2. A correctly-identified `None`, with the specific failing hard gate,
   is just as valid a capstone answer as a complete signal.
3. Both conditional branches (entry type, stop method) must be driven
   by the same, correctly-computed `has_sweep` value.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one producing `None`), work the complete Bot 2 pipeline for each.

### Scenario Challenge

Given a raw scenario where 4H has no active zones, 1H has one, price
is inside it, and the 15M timeframe shows a clean sweep and matching
FVG but no CHoCH, produce the complete, correct pipeline output —
including which gate this fails at and why the sweep/FVG confluence
doesn't change that outcome.

### Mini Quiz

Q1 (True/False): Strong sweep and FVG confluence can produce a valid
capstone signal even without a detected CHoCH.
Answer: False — CHoCH is a hard gate (BOT2-05); no amount of soft
confluence substitutes for it.

Q2 (Multiple choice): What must be true for BOTH the entry-type and
stop-method fields in a correct capstone answer?
(a) They can be computed independently with different sweep
    assumptions
(b) They must both be derived from the same, single `has_sweep` value
    computed from the raw data
(c) They're always "mean" and "structure_swing" respectively
(d) They depend only on the 4H timeframe, not the sweep check

Answer: (b).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 4H,
  1H, and 15M candle data — no zones, CHoCH, sweeps, or FVGs
  pre-identified, matching `BotOrchestrator.run_all()`'s real
  invocation.
- Front: Is a correct `None` output as valid a capstone answer as a
  full signal? Back: Yes — as long as the specific failing hard gate
  (BOT2-05) is correctly identified.

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios.

### Reflection

Across this entire track, which of Bot 2's real branches (the HTF
fallback, the CHoCH-vs-BOS contrast, or the sweep-keyed conditional
entry/stop) took the most repetition to internalize as an exact rule?
Why do you think that particular branch was hardest to pin down?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone is the complete
synthesis of BOT2-01 through BOT2-09, and — directly contrasted with
BOT1-10 — demonstrates how two bots sharing the same vocabulary can
run genuinely different real decision logic.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 2:
Needs 4H + 1H + 15M" invocation of `OrderBlockReversalBot.analyze()`
in full — every real step, gate, and conditional branch, verified
directly against `bot_strategies.py`.
