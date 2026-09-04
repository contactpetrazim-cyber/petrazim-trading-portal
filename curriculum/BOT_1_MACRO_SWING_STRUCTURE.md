# BOT 1 — MACRO SWING STRUCTURE MASTERY

Ten-lesson specialization track for Bot 1 (Pure Macro Swing Structure,
Damir/Brooks style) — the real methodology this bot's own `analyze()`
pipeline runs (`backend/app/core/bot_strategies.py`,
`MacroSwingStructureBot`), taught as ten stages: Concept,
Identification, Context, Setup, Invalidation, Entry, Management,
Failure, Practice, Capstone. Every rule below is verified against that
file's real logic — nothing here is invented philosophy.

---

## BOT1-01 — Concept: What Macro Swing Structure Trading Is

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** C2-06, C7-01
**Learning objectives:** Explain Bot 1's core philosophy — trading
confirmed higher-timeframe structural transitions, not lower-timeframe
noise — and name the two timeframes its own pipeline actually runs on.

### Why This Matters

Each of the 5 bots is a genuinely different, real methodology, not five
skins on one strategy — Bot 1 is the slowest, widest-stop, longest-hold
of the five, and understanding why up front is what keeps a trader from
applying Bot 2's tight, high-frequency mindset to a Bot 1 signal (or
vice versa) and misjudging it entirely.

### Core Teaching

**Plain-English explanation.** Bot 1 trades major structural
transitions on the Daily (1D) and 4-Hour (4H) timeframes only — it
never looks at anything faster. Its whole premise (Damir/Brooks style)
is that the highest-quality, most reliable moves are the big, slow ones
that only become visible once real structure has already confirmed
itself, and that chasing faster timeframes trades noise dressed up as
signal.

**Technical explanation.** Concretely, `MacroSwingStructureBot.analyze()`
takes exactly two candle series as input — `candles_1d` and
`candles_4h` — and nothing faster; every other bot in this platform
uses at least one lower timeframe somewhere in its pipeline (see BOT2
through BOT5), which is the single clearest structural difference
between Bot 1 and the rest. It also runs the widest stops and the
highest reward-to-risk target of any bot (5:1, vs. 3:1-4:1 for the
others) and is explicitly designed to be held for multi-day to
multi-week moves rather than closed same-session.

### Visual Model

See diagram: `visuals/bot1-01-two-timeframe-scope.svg` — five bot
icons in a row, each annotated with its real input timeframes from
`BotOrchestrator.run_all()`; Bot 1's is the only one with just two
(1D, 4H), all wider than every other bot's fastest timeframe.

### Worked Example

A trader is used to Bot 2's 15-minute-timeframe signals firing several
times a day. They see a Bot 1 signal and expect the same cadence — but
Bot 1 only evaluates 1D and 4H data, so a new signal might not appear
for days. Understanding Bot 1's concept means expecting exactly that
cadence, not treating the silence as the bot being broken.

### Counterexample

A trader manually "helps" a Bot 1 setup along by tightening its stop
to a 15-minute swing level because that's what feels intuitive from
other bots. This directly contradicts Bot 1's own philosophy — its
wide stop (beyond the 1D/4H swing that defined the structure) is the
entire point, not an oversight to correct.

### Good Example / Bad Example

Good: Judging a Bot 1 signal by 1D/4H structure alone and accepting
its wider stop and longer hold time as part of the methodology. Bad:
Applying lower-timeframe intuition (tight stops, fast signals) to a
Bot 1 trade because that's the habit built from a different bot.

### What to Look Out For

- Bot 1 uses ONLY 1D and 4H data — no lower timeframe input exists
  anywhere in its pipeline.
- Its 5:1 target and wide, swing-based stop are both wider than any
  other bot's — by design, not by accident.
- Expect a lower signal frequency than any other bot — this is the
  tradeoff for higher per-trade reliability on genuine structure.

### Common Mistakes

Judging Bot 1 as "underperforming" because it fires less often than
Bot 2 or Bot 5 misunderstands the concept — signal frequency and setup
quality are a real tradeoff (ORIENT-03), and Bot 1 is deliberately
positioned at the low-frequency, high-conviction end of that tradeoff.

### Key Takeaways

1. Bot 1 trades only 1D and 4H structure — no lower timeframe input.
2. It targets 5:1 with the widest stops of any bot, held for
   multi-day to multi-week moves.
3. Low signal frequency is the deliberate cost of Bot 1's higher
   per-setup conviction, not a flaw.

### Practice Drill

Given five real bot signal cards (provided in Practise), correctly
identify which one came from Bot 1 using only its timeframe inputs
and stop/target width.

### Scenario Challenge

A trader hasn't seen a Bot 1 signal in six trading days and asks
support if it's broken. Using this lesson's concept, what's the
honest first question to check before assuming anything is wrong?

### Mini Quiz

Q1 (True/False): Bot 1's pipeline reads any timeframe faster than 4H.
Answer: False — `MacroSwingStructureBot.analyze()` takes only
`candles_1d` and `candles_4h`; no faster timeframe is read anywhere in
its logic.

Q2 (Multiple choice): What is Bot 1's real target reward-to-risk ratio?
(a) 1:1
(b) 3:1
(c) 5:1
(d) 10:1

Answer: (c) — `EntryExitEngine(default_rr=5.0)` and
`calculate_targets(..., rr_ratio=5.0, ...)`.

### Flashcards

- Front: What two timeframes does Bot 1's pipeline actually use? Back:
  1D and 4H only — no lower timeframe input exists in its analyze()
  method.
- Front: What's Bot 1's real target R:R? Back: 5:1, the widest of any
  of the 5 bots.

### Reflection

Which of the 5 bots' signal cadence do you find yourself expecting
from every bot? How does Bot 1's genuinely slower, wider-stop approach
change how you'd size and hold a signal from it specifically?

### Mastery Criteria

Correctly identify the Bot 1 signal card from the five in the practice
drill using only its stated timeframe inputs and stop/target width.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT1 lesson's Identification-through-Capstone detail.

### Bot Connection

Every field here traces directly to `bot_strategies.py`'s
`MacroSwingStructureBot` class and `BotOrchestrator.run_all()`'s own
"Bot 1: Needs 1D + 4H" gate — nothing in this lesson is a
simplification of the real logic.

---

## BOT1-02 — Identification: Reading the 1D Trend Bot 1 Requires

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT1-01, C2-02
**Learning objectives:** Reproduce the exact swing-comparison test
Bot 1's pipeline runs to determine 1D trend direction, using its real
four-swing minimum.

### Why This Matters

Every later BOT1 stage assumes this exact trend test has already
passed — Identification is where the whole signal either has a
foundation or doesn't, so understanding precisely what the bot checks
here (not a rough approximation of it) is what makes every later stage
legible.

### Core Teaching

**Plain-English explanation.** Bot 1 requires at least 4 swing points
on the 1D chart (C2-01's swing highs/lows). It takes the most recent 4,
splits them into highs and lows, and checks C2-02's higher-highs/
higher-lows pattern for an uptrend, or lower-highs/lower-lows for a
downtrend. If neither pattern holds cleanly, there's no valid 1D trend
and the bot stops here — no signal.

**Technical explanation.** Concretely: `swings_1d` is built from
`detect_swing_highs` + `detect_swing_lows`; if `len(swings_1d) < 4`,
the function returns `None` immediately. The most recent 4 (sorted by
timestamp) are split into `highs` and `lows` by `structure_type.name`.
`bullish_trend` requires BOTH `highs[-1].price > highs[-2].price` AND
`lows[-1].price > lows[-2].price` — i.e., the two most recent highs
AND the two most recent lows must both show progression in the same
direction; `bearish_trend` is the mirror. If neither is true (e.g., a
higher high but a lower low — an unclear, transitional structure per
C2-03), the function returns `None`.

### Visual Model

See diagram: `visuals/bot1-02-four-swing-test.svg` — four labeled
swing points on a 1D chart, with the two comparisons
(`highs[-1] > highs[-2]`, `lows[-1] > lows[-2]`) drawn as explicit
arrows, both required simultaneously for a bullish read.

### Worked Example

The most recent 4 swings on a 1D chart show: low, high, higher low,
higher high — both the high-to-high and low-to-low comparisons show
progression upward. `bullish_trend = True`, and the pipeline proceeds
to BOT1-03's 4H BOS check.

### Counterexample

The most recent 4 swings show a higher high but a LOWER low than the
prior low (an expanding range, not a clean trend — C2-03's transition
state). Neither `bullish_trend` nor `bearish_trend` evaluates true,
and `analyze()` returns `None` — correctly, since this is exactly the
unclear structure C2-03 warns isn't tradable as a clean trend.

### Good Example / Bad Example

Good: Requiring both the high-to-high AND low-to-low comparison to
agree before calling a 1D trend valid. Bad: Calling a trend from a
single higher high alone, ignoring what the lows are doing — Bot 1's
own code never does this, and neither should a manual read of the
same structure.

### What to Look Out For

- Fewer than 4 total 1D swings means an automatic `None` — no trend
  read is even attempted.
- BOTH the high comparison and the low comparison must agree — one
  without the other is not a valid trend by this bot's own test.
- This test uses the two MOST RECENT swings of each type — not the
  full swing history.

### Common Mistakes

Assuming any single higher high counts as an uptrend, without checking
what the corresponding low did, is the most common gap between an
intuitive trend read and Bot 1's actual, stricter test.

### Key Takeaways

1. Bot 1 requires at least 4 total 1D swing points before any trend
   read is attempted.
2. A bullish trend requires the two most recent highs AND the two
   most recent lows to both show upward progression — not just one.
3. A structure where highs and lows disagree returns no signal — this
   is Bot 1 correctly declining an unclear transition (C2-03).

### Practice Drill

Given six different 1D swing sequences (provided in Practise), apply
the exact `highs[-1]>highs[-2]` and `lows[-1]>lows[-2]` test to
determine which show a valid bullish trend, valid bearish trend, or no
valid trend.

### Scenario Challenge

A chart shows a clear higher high on the 1D timeframe, but the most
recent low is lower than the prior low. A trader argues this still
"looks bullish." Using Bot 1's actual test, what does its pipeline
conclude, and why is that the more disciplined read?

### Mini Quiz

Q1 (True/False): A single higher high is enough for Bot 1 to call a
1D uptrend.
Answer: False — both the high-to-high AND low-to-low comparisons must
independently confirm progression in the same direction.

Q2 (Multiple choice): What does Bot 1's pipeline do with fewer than 4
total 1D swing points?
(a) Uses whatever swings exist anyway
(b) Returns None immediately — no trend read is attempted
(c) Falls back to the 4H timeframe
(d) Assumes a bullish trend by default

Answer: (b).

### Flashcards

- Front: What's Bot 1's exact bullish-trend test? Back:
  `highs[-1].price > highs[-2].price` AND `lows[-1].price > lows[-2].price`
  — both required, using the two most recent swings of each type.
- Front: What happens with fewer than 4 total 1D swings? Back: The
  pipeline returns `None` immediately — no trend is even attempted.

### Reflection

Think of a chart you'd have called "uptrending" from a single higher
high. Would it pass Bot 1's actual two-comparison test? What does
that gap tell you about the difference between an intuitive read and
a disciplined one?

### Mastery Criteria

Correctly classify all six practice-drill swing sequences using Bot
1's exact trend test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this trend read is the gate
every later BOT1 stage depends on.

### Bot Connection

Direct line-by-line correspondence to `MacroSwingStructureBot.analyze()`
Step 1 in `bot_strategies.py` — the `bullish_trend`/`bearish_trend`
boolean logic quoted above is copied, not paraphrased, from the real
code.

---

## BOT1-03 — Context: Why 4H BOS (Not CHoCH) Confirms the Signal

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT1-02, C2-06, C2-07
**Learning objectives:** Explain why Bot 1 specifically requires a
4H BOS aligned with the 1D trend, and why a CHoCH does not satisfy
this stage.

### Why This Matters

C2-06 and C2-07 already distinguished BOS (continuation) from CHoCH
(reversal) as two different structural events. This lesson places that
distinction in its exact real role inside Bot 1's pipeline — the
difference between the two determines whether the pipeline proceeds
or returns `None`.

### Core Teaching

**Plain-English explanation.** Once a 1D trend is confirmed (BOT1-02),
Bot 1 needs the FASTER 4H timeframe to confirm that trend is actively
continuing right now, not just that it existed at some point. It does
this by requiring a 4H Break of Structure (BOS, C2-06) in the SAME
direction as the 1D trend — a bullish 1D trend needs a bullish 4H BOS;
a bearish 1D trend needs a bearish 4H BOS. A CHoCH on the 4H (C2-07) —
which would signal the 4H trend is REVERSING — is never what this
stage looks for, because Bot 1 is a continuation strategy, not a
reversal one.

**Technical explanation.** `bos_4h = detect_bos(candles_4h, ...)`; if
empty, `analyze()` returns `None`. The last detected BOS's `type` field
must match the 1D trend direction exactly: `bullish_trend and
last_bos["type"] != "bullish_bos"` returns `None`, and the mirror for
bearish. There is no branch anywhere in `MacroSwingStructureBot` that
reads or checks for a CHoCH — `detect_choch` is never called in this
bot's class at all, unlike Bot 2, Bot 4, and Bot 5, which all use it
explicitly (see their own BOT2/BOT4/BOT5-03 lessons).

### Visual Model

See diagram: `visuals/bot1-03-alignment-gate.svg` — a two-column gate:
1D trend direction (left) must match 4H BOS type (right) exactly,
with a CHoCH icon shown crossed out and labeled "never checked by this
bot."

### Worked Example

The 1D trend is confirmed bullish (BOT1-02). The 4H timeframe then
prints a bullish BOS — price breaking above a prior 4H swing high with
conviction. Direction alignment passes (`bullish_trend` and
`last_bos["type"] == "bullish_bos"`), and the pipeline proceeds to
BOT1-04's zone search.

### Counterexample

The 1D trend is confirmed bullish, but the most recent 4H structural
event is a bearish CHoCH — the 4H trend attempting to reverse against
the 1D bias. Even though something structurally significant just
happened on the 4H, it is neither a BOS nor in the confirming
direction; `analyze()` returns `None` here, correctly declining a
setup where the faster timeframe is fighting the slower one.

### Good Example / Bad Example

Good: Treating a same-direction 4H BOS as the only valid confirmation
for a Bot 1 setup, and a 4H CHoCH as a clear "no trade" signal for
this specific bot. Bad: Treating any 4H structural break (BOS or
CHoCH) as equally confirming — Bot 1's real logic never does this.

### What to Look Out For

- Only BOS confirms — CHoCH is never checked anywhere in Bot 1's
  pipeline; that distinction belongs to other bots.
- The BOS direction must match the 1D trend exactly — a bullish 1D
  trend with a bearish 4H BOS returns `None`, not a weaker signal.
- No 4H BOS at all (empty `bos_4h` list) is an automatic `None`, same
  as too few 1D swings.

### Common Mistakes

Assuming any 4H structural shift — BOS or CHoCH — adds confirmation is
the most common gap between intuition and Bot 1's actual, stricter
test: only a same-direction BOS satisfies this stage.

### Key Takeaways

1. Bot 1 requires a 4H BOS, never a CHoCH — the two are genuinely
   different tests and only one applies here.
2. The 4H BOS direction must exactly match the confirmed 1D trend
   direction, or the pipeline returns `None`.
3. This is a continuation confirmation, not a reversal one — matching
   Bot 1's whole "trade the confirmed trend" philosophy (BOT1-01).

### Practice Drill

Given five 1D-trend + 4H-structural-event pairs (provided in
Practise), determine which pairs pass Bot 1's alignment test and
which return `None`, including at least one CHoCH case.

### Scenario Challenge

A 1D trend reads bullish, and the 4H timeframe just printed a bearish
CHoCH. A trader argues "that's still a big structural event, it
should count for something." Using Bot 1's exact logic, why doesn't it?

### Mini Quiz

Q1 (True/False): A 4H CHoCH in the same general direction as the 1D
trend satisfies Bot 1's confirmation stage.
Answer: False — Bot 1's pipeline never checks for CHoCH at all; only
a same-direction BOS satisfies this stage.

Q2 (Multiple choice): What happens if `bos_4h` (the list of detected
4H BOS events) is empty?
(a) The bot waits for a CHoCH instead
(b) `analyze()` returns None
(c) The bot uses the 1D trend alone
(d) The bot defaults to a lower-confidence signal

Answer: (b).

### Flashcards

- Front: Does Bot 1 ever check for a 4H CHoCH? Back: No —
  `detect_choch` is never called anywhere in `MacroSwingStructureBot`;
  only BOS confirms this stage.
- Front: What must the 4H BOS direction match? Back: The confirmed 1D
  trend direction, exactly — a mismatch returns `None`.

### Reflection

Why does a continuation-only bot like Bot 1 deliberately ignore
CHoCH signals that other bots (see BOT2/4/5) actively look for? What
does that tell you about how the same structural event means
different things to different methodologies?

### Mastery Criteria

Correctly classify all five practice-drill pairs by Bot 1's exact
alignment test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this BOS-only distinction
resurfaces by direct contrast in BOT2-03, BOT4-03, and BOT5-03, which
each DO use CHoCH.

### Bot Connection

Verified directly against `MacroSwingStructureBot.analyze()` Step 2 in
`bot_strategies.py` — the exact `last_bos["type"] != "bullish_bos"` /
`"bearish_bos"` checks, and the confirmed absence of any `detect_choch`
call anywhere in this bot's class.

---

## BOT1-04 — Setup: Finding the 4H Entry Zone

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT1-03, C4-02, C6-02
**Learning objectives:** Identify which 4H order block Bot 1 selects
for entry, and explain its premium/discount filter.

### Why This Matters

A confirmed 1D trend and aligned 4H BOS (BOT1-02, BOT1-03) tell Bot 1
THAT a move is happening — this stage is where it decides WHERE,
specifically, to enter that move, using C4-02's order block concept
and C6-02's premium/discount location filter together.

### Core Teaching

**Plain-English explanation.** Once direction is confirmed, Bot 1
looks for 4H order blocks (C4-02) that are still ACTIVE (C4-04 — not
yet fully invalidated). It then filters those zones by direction: for
a bullish setup it keeps only bullish order blocks (the demand zones
that would sit in a discount per C6-02); for a bearish setup, only
bearish ones. Among the valid zones, it picks the MOST RECENT one.

**Technical explanation.** `zones = detect_order_blocks(candles_4h, ...)`;
`valid_zones = [z for z in zones if z.status.name == "ACTIVE"]`. Then,
for a bullish trend, `valid_zones = [z for z in valid_zones if "bull"
in z.id]` — filtering to bullish-tagged zones only (the mirror for
bearish, filtering to `"bear" in z.id`). If `valid_zones` is empty
after this filter, `analyze()` returns `None`. Otherwise
`entry_zone = valid_zones[-1]` — explicitly the LAST (most recently
formed) zone in the filtered list, not the oldest or the "best" by any
other quality measure.

### Visual Model

See diagram: `visuals/bot1-04-zone-selection.svg` — a 4H chart with
several order blocks marked, some ACTIVE and some MITIGATED (grayed
out), and among the active bullish-tagged zones, the most recent one
highlighted as the selected `entry_zone`.

### Worked Example

Three 4H bullish order blocks exist: two are already MITIGATED
(C4-04), one is still ACTIVE and freshly formed. After filtering to
active bullish zones, only one remains — that one becomes
`entry_zone` by default, since it's also necessarily the most recent
of the (single) valid zone.

### Counterexample

Two 4H order blocks are both ACTIVE and bullish-tagged: an older,
larger zone and a newer, smaller one. Bot 1's real logic picks the
NEWER one (`valid_zones[-1]`) regardless of size or any other quality
measure — a trader who'd have picked the "better-looking" larger zone
would be reading a different rule than the one actually running.

### Good Example / Bad Example

Good: Filtering zones to ACTIVE + direction-matching first, then
taking the most recently formed of what remains. Bad: Picking a zone
by visual size or "how clean it looks" rather than recency — that's
not what Bot 1's own selection logic does.

### What to Look Out For

- Only ACTIVE zones are considered — a MITIGATED or INVALID zone
  (C4-04) is filtered out entirely, no exceptions.
- The direction filter (`"bull"`/`"bear" in z.id`) must match the
  confirmed trend — a zone of the wrong polarity is never selected.
- Among valid zones, the MOST RECENT one is chosen — not the largest,
  oldest, or most-tested.

### Common Mistakes

Assuming Bot 1 picks the "best-looking" zone by some quality judgment
is a common misread — its real selection rule is purely
recency-among-valid-zones, a simpler and more mechanical test than
that assumption implies.

### Key Takeaways

1. Only ACTIVE, direction-matching 4H order blocks are eligible for
   selection — everything else is filtered out first.
2. Among eligible zones, Bot 1 selects the MOST RECENT one, not the
   largest or oldest.
3. No eligible zones after filtering means `analyze()` returns `None`
   — no fallback to a lower-quality zone.

### Practice Drill

Given a 4H chart with six order blocks in varying states (provided in
Practise), correctly filter to eligible zones and identify which one
Bot 1's logic would select.

### Scenario Challenge

Two ACTIVE bullish 4H zones exist — an older one that looks "textbook
clean" and a newer, messier one. A trader wants to override the bot
and use the cleaner-looking older zone. Using Bot 1's actual
selection rule, what would the bot pick, and is the override
justified by anything in this bot's real logic?

### Mini Quiz

Q1 (True/False): Bot 1 selects the largest available order block
among eligible zones.
Answer: False — it selects the MOST RECENT eligible zone
(`valid_zones[-1]`); size is never part of the selection criteria.

Q2 (Multiple choice): What happens to a MITIGATED 4H order block in
this stage?
(a) It's used as a backup if no ACTIVE zone exists
(b) It's filtered out entirely — only ACTIVE zones are eligible
(c) It's weighted lower but still considered
(d) It becomes the stop-loss reference

Answer: (b).

### Flashcards

- Front: What two filters does a 4H order block need to pass to be
  eligible? Back: ACTIVE status (not mitigated/invalid) AND matching
  direction tag (`"bull"`/`"bear" in z.id`).
- Front: Among eligible zones, which one does Bot 1 pick? Back: The
  most recently formed one (`valid_zones[-1]`) — not the largest or
  oldest.

### Reflection

Have you ever picked a "cleaner-looking" zone over a more recent one
when reading a chart manually? How does knowing Bot 1's actual,
purely-recency-based rule change how you'd interpret its signals?

### Mastery Criteria

Correctly identify the selected zone in all six practice-drill
scenarios using Bot 1's exact filter-then-recency rule.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this zone selection feeds
directly into BOT1-06's entry mechanics.

### Bot Connection

Verified against `MacroSwingStructureBot.analyze()` Step 3 in
`bot_strategies.py` — the `valid_zones[-1]` selection and
`"bull"`/`"bear" in z.id` filter logic quoted directly from source.

---

## BOT1-05 — Invalidation: The Four Conditions That Return No Signal

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT1-02, BOT1-03, BOT1-04, C2-09
**Learning objectives:** List all four conditions in Bot 1's pipeline
that cause it to return no signal, in the order they're checked.

### Why This Matters

C2-09 taught structural invalidation as a general concept; this lesson
makes it concrete and exhaustive for Bot 1 specifically — the complete,
real list of every reason this bot declines to signal, not an
approximation of it.

### Core Teaching

**Plain-English explanation.** Reading straight through
`MacroSwingStructureBot.analyze()` in order, there are exactly four
points where it can stop and return no signal: (1) fewer than 4 total
1D swing points (BOT1-02); (2) the 1D highs and lows don't agree on a
single trend direction (BOT1-02); (3) no 4H BOS exists, or the one
that does exist doesn't match the 1D trend direction (BOT1-03); (4) no
ACTIVE, direction-matching 4H order block exists (BOT1-04). Any one of
these four is sufficient on its own to end the pipeline with no trade.

**Technical explanation.** This ordered list matters because each
check happens SEQUENTIALLY — the function returns immediately at the
first failed condition, never evaluating anything downstream of it.
This means a chart that fails condition 1 (too few 1D swings) never
even gets checked against conditions 2 through 4; the four aren't
independent parallel checks, they're a gate the analysis has to pass
through in order.

### Visual Model

See diagram: `visuals/bot1-05-four-gates.svg` — a horizontal sequence
of four gates (1D swing count -> 1D trend clarity -> 4H BOS alignment
-> 4H zone availability), each with a "return None" exit branching
downward, only the far end leading to an actual signal.

### Worked Example

A chart has a clean, confirmed 1D uptrend (passes gates 1-2) and a
matching bullish 4H BOS (passes gate 3), but every existing 4H bullish
order block is already MITIGATED. Gate 4 fails, and `analyze()`
returns `None` — even though the first three gates were fully
satisfied.

### Counterexample

A chart has only 3 total 1D swing points. Gate 1 fails immediately —
the function returns `None` before ever checking whether a 4H BOS
exists or whether any zones are available, even if both of those
would otherwise have been favorable.

### Good Example / Bad Example

Good: Understanding that ANY one of the four gates failing is
sufficient to end the analysis — there's no partial credit or
weighted scoring across them. Bad: Assuming a "strong" pass on three
of the four gates should count for something even if the fourth
fails — Bot 1's real logic has no such weighting.

### What to Look Out For

- The four gates are checked IN ORDER — an early failure means later
  gates are never evaluated at all.
- Passing three of four gates still returns `None` if the fourth
  fails — there's no partial-credit scoring anywhere in this pipeline.
- Every one of these four gates has already been taught individually
  in BOT1-02 through BOT1-04 — this lesson is their assembly into one
  complete list, not new material.

### Common Mistakes

Treating a signal that "almost" formed (three of four gates passed) as
meaningfully different from one that failed at the first gate is a
common misread — Bot 1's own logic treats every gate failure
identically: no signal, regardless of which gate or how many others
passed.

### Key Takeaways

1. Bot 1's pipeline has exactly four possible no-signal points, checked
   in a fixed sequential order.
2. An early gate failure means later gates are never even evaluated.
3. There is no partial credit — passing most gates but failing one
   still returns no signal, identically to failing the first gate.

### Practice Drill

Given eight scenario summaries (provided in Practise), each describing
which of the four gates pass or fail, determine at which gate (if any)
`analyze()` would return `None`.

### Scenario Challenge

A trader says "the setup was so close — three out of four conditions
were perfect." Using Bot 1's actual sequential-gate logic, explain why
this framing (partial credit) doesn't match how the bot actually
decides.

### Mini Quiz

Q1 (True/False): Bot 1 evaluates all four gates independently and
weighs how many passed.
Answer: False — the four gates are sequential; a single failure ends
the analysis immediately, with no weighting of how many others passed.

Q2 (Multiple choice): If a chart has fewer than 4 total 1D swing
points, which later gates get evaluated?
(a) All of them, for completeness
(b) None — the function returns immediately at the first gate
(c) Only the 4H BOS gate
(d) Only the zone-availability gate

Answer: (b).

### Flashcards

- Front: How many distinct no-signal gates exist in Bot 1's pipeline?
  Back: Four — 1D swing count, 1D trend clarity, 4H BOS alignment,
  and 4H zone availability — checked in that sequential order.
- Front: Does passing 3 of 4 gates count for anything? Back: No —
  Bot 1's logic has no partial-credit scoring; any single gate failure
  returns no signal, identically regardless of which gate.

### Mastery Criteria

Correctly identify the failing gate (or confirm all four pass) in all
eight practice-drill scenarios.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the assembly point for
BOT1-02 through BOT1-04, mirroring C9-01's own lifecycle-assembly
pattern.

### Bot Connection

Every gate here is a direct `return None` line inside
`MacroSwingStructureBot.analyze()` — this lesson is the complete,
ordered enumeration of every one of them.

---

## BOT1-06 — Entry: Exact Entry Price Mechanics

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT1-04
**Learning objectives:** State exactly where within the selected 4H
zone Bot 1 places its entry order.

### Why This Matters

BOT1-04 established WHICH zone gets selected; this lesson covers the
one remaining question — exactly where inside that zone the entry
order actually sits, which is what a trader replicating this signal
manually needs to get right.

### Core Teaching

**Plain-English explanation.** Once the entry zone is selected, Bot 1
places its entry at the MEAN (the midpoint) of that zone — not at the
zone's near edge (an aggressive entry) and not at its far edge (a
conservative, deep-retracement entry). This mean-of-zone approach is a
deliberate middle ground between entry price and fill probability.

**Technical explanation.** `entry = self.entry_engine.calculate_entry
(entry_zone, "mean", direction)` — the literal string `"mean"` is
passed as the entry-type argument, contrasted with the `"aggressive"`
entry type Bot 2 uses in some conditions (see BOT2-06). This is the
ONLY entry type Bot 1's pipeline ever uses — there's no branching logic
that would select a different entry type under any condition.

### Visual Model

See diagram: `visuals/bot1-06-mean-entry.svg` — the selected 4H zone
shown as a rectangle, with three candidate entry points marked (near
edge, mean/midpoint, far edge) and the midpoint highlighted as the one
Bot 1 always uses.

### Worked Example

The selected bullish 4H zone spans from 1.0850 to 1.0900. Bot 1's
entry order is placed at the mean: 1.0875 — the exact midpoint,
regardless of how the zone's price action has behaved since it formed.

### Counterexample

A trader manually trading this same zone places their entry at 1.0850
(the near/aggressive edge) reasoning "why wait for a deeper fill."
This is not the entry Bot 1's own logic uses — replicating a Bot 1
signal manually means using the mean, not a discretionary
improvement on it.

### Good Example / Bad Example

Good: Always using the zone's exact midpoint as the entry price when
manually replicating a Bot 1 signal. Bad: Substituting a different
entry point (near edge, far edge, or anything else) based on
discretionary judgment about the current chart.

### What to Look Out For

- Bot 1 uses ONLY the `"mean"` entry type — there is no conditional
  branch to a different entry style anywhere in this bot's class.
- The mean is the exact midpoint of the selected zone's top and
  bottom — a simple, mechanical calculation, not a judgment call.
- This differs from other bots (see BOT2-06) that do branch between
  entry types based on conditions like a confirmed liquidity sweep.

### Common Mistakes

Assuming Bot 1 picks an entry style the way Bot 2 does (conditionally,
based on confirmation strength) is a common cross-bot confusion — Bot
1's entry logic is unconditional: always the mean, every time.

### Key Takeaways

1. Bot 1's entry is always placed at the exact midpoint ("mean") of
   the selected zone.
2. This is unconditional — no branch anywhere selects a different
   entry style for Bot 1.
3. Replicating a Bot 1 signal manually means using the zone's
   midpoint, not a discretionary variation on it.

### Practice Drill

Given four zone price ranges (provided in Practise), calculate the
exact mean entry price Bot 1 would use for each.

### Scenario Challenge

A trader manually recreating a Bot 1 signal enters at the zone's near
edge instead of its mean, reasoning it improves their fill price. What
specifically has changed about the trade versus the actual Bot 1
signal it was meant to replicate?

### Mini Quiz

Q1 (True/False): Bot 1 sometimes uses an aggressive entry type
depending on confirmation strength.
Answer: False — its entry logic always calls `calculate_entry` with
`"mean"`; there is no conditional branch to any other entry type.

Q2 (Multiple choice): Where exactly does Bot 1 place its entry within
the selected zone?
(a) The zone's near edge
(b) The zone's far edge
(c) The zone's exact midpoint
(d) Wherever the most recent candle closed

Answer: (c).

### Flashcards

- Front: What entry type does Bot 1's pipeline always use? Back:
  `"mean"` — the zone's exact midpoint, unconditionally.
- Front: Does Bot 1 ever branch to a different entry style? Back: No
  — unlike Bot 2, there's no condition anywhere in Bot 1's class that
  selects an entry type other than mean.

### Reflection

If you were manually trading a Bot 1-style setup, would your natural
instinct be to enter at the mean, or would you drift toward a more
aggressive or conservative price? What does that tell you about
matching a system's real rules versus your own intuition?

### Mastery Criteria

Correctly calculate the mean entry price for all four practice-drill
zone ranges.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this entry price is the anchor
BOT1-07's stop and target calculations are both measured from.

### Bot Connection

Direct line from `MacroSwingStructureBot.analyze()` Step 4:
`self.entry_engine.calculate_entry(entry_zone, "mean", direction)` —
verified as the only entry-type string used anywhere in this class.

---

## BOT1-07 — Management: Stop Placement, Targets, and Position Size

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT1-06, C8-01, C8-02, C8-03
**Learning objectives:** State Bot 1's exact stop-placement rule,
target ratio, and how its position size is calculated.

### Why This Matters

C8-01 through C8-03 already taught sizing, stops, and reward-to-risk
as general concepts; this lesson is where those concepts become
concrete, real numbers for Bot 1 specifically — the exact stop
reference point and target ratio its own code uses.

### Core Teaching

**Plain-English explanation.** Bot 1's stop is placed beyond the
actual 1D swing point that defined the confirmed trend (BOT1-02) —
not a fixed pip distance, and not the 4H zone's own edge. Its target
is calculated at a strict 5:1 reward-to-risk ratio from that stop
distance, using a multi-target split (C8-03), with the SECOND target
(TP2) used as the bot's primary, reported take-profit level. Position
size is calculated from account balance, a risk percentage adjusted by
setup quality, and the actual stop distance — C8-01's formula, applied
mechanically.

**Technical explanation.** `sl_swing = lows[-1]` for a long (the most
recent 1D swing low from BOT1-02's own trend calculation) or
`highs[-1]` for a short; `calculate_stop_loss(entry, entry_zone,
sl_swing, "structure_swing")`. Targets: `calculate_targets(entry, sl,
rr_ratio=5.0, multi_target=True)`, with `targets["tp2"]` used as the
signal's reported `take_profit`. Risk: `calculate_position_risk
(setup_quality=1.2)` — a fixed 1.2 quality multiplier specific to Bot
1 (compare to Bot 2's 1.1, Bot 3's 1.15, Bot 5's 1.3 — each bot uses
its own multiplier) — then `calculate_lot_size(account_balance, risk,
sl["sl_distance"])` applies C8-01's real sizing formula.

### Visual Model

See diagram: `visuals/bot1-07-stop-target-sizing.svg` — the entry
(mean of zone), stop (beyond the 1D swing), and TP2 target (5:1 from
that stop distance) shown on one price axis, with the lot-size formula
below it referencing the same stop distance.

### Worked Example

Entry is 1.0875 (BOT1-06). The 1D swing low that defined the confirmed
uptrend sits at 1.0800 — the stop is placed just beyond it. Stop
distance is 75 pips. At 5:1, the TP2 target sits 375 pips above entry.
With a 1.2 setup-quality-adjusted risk percentage and the real stop
distance, `calculate_lot_size` produces the exact position size for
the account balance in question.

### Counterexample

A trader manually recreating this signal places the stop at a round
number 50 pips below entry instead of at the actual 1D swing low. This
is not Bot 1's real stop rule — its stop is always anchored to actual
structure (the 1D swing that defined the trend), never an arbitrary
fixed distance.

### Good Example / Bad Example

Good: Anchoring the stop to the exact 1D swing that defined the
confirmed trend, and calculating the target as a strict 5:1 multiple
of that real stop distance. Bad: Using a round-number or
"comfortable" stop distance instead of the actual structural level Bot
1's logic references.

### What to Look Out For

- The stop references the SAME 1D swing point already used to confirm
  trend direction in BOT1-02 — not a new, separate level.
- The reported take-profit is TP2 from a multi-target split, not a
  single flat 5:1 target with nothing in between.
- Bot 1's setup-quality multiplier (1.2) is fixed and specific to this
  bot — other bots use different values for the same formula.

### Common Mistakes

Treating Bot 1's stop as an arbitrary distance rather than a
structure-anchored one (C8-02's whole point) is the most common
mismatch between a manual replication and the actual signal.

### Key Takeaways

1. Bot 1's stop is anchored to the real 1D swing point that confirmed
   the trend — not a fixed distance.
2. Its target is a strict 5:1 R:R from that real stop distance, using
   TP2 of a multi-target split as the reported take-profit.
3. Position sizing uses C8-01's real formula with a bot-specific
   setup-quality multiplier of 1.2.

### Practice Drill

Given three complete entry/1D-swing pairs (provided in Practise),
calculate the exact stop price, TP2 target, and stop distance for
each, following Bot 1's real rules.

### Scenario Challenge

A trader wants to tighten Bot 1's stop closer to entry to reduce risk
per trade, reasoning smaller stops mean smaller losses. Using this
lesson's vocabulary (and C8-02's invalidation logic), what's lost by
moving the stop off the actual structural level it's anchored to?

### Mini Quiz

Q1 (True/False): Bot 1's stop is placed at a fixed pip distance from
entry, the same on every trade.
Answer: False — it's anchored to the actual 1D swing point that
confirmed the trend, which varies trade to trade.

Q2 (Multiple choice): Which target does Bot 1 report as its primary
take-profit?
(a) TP1
(b) TP2
(c) TP3
(d) The zone's far edge

Answer: (b).

### Flashcards

- Front: What does Bot 1 anchor its stop to? Back: The actual 1D
  swing point that defined the confirmed trend direction (BOT1-02) —
  not a fixed distance.
- Front: What R:R ratio does Bot 1 target, and which multi-target
  level is reported? Back: 5:1, using TP2 of a multi-target split as
  the primary reported take-profit.

### Reflection

Have you ever tightened a stop to a "comfortable" distance rather than
the actual structural level that invalidates the setup? What does
BOT1's real, structure-anchored rule suggest about that habit?

### Mastery Criteria

Correctly calculate stop, TP2 target, and stop distance for all three
practice-drill pairs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage is the direct
foundation for BOT1-08's failure-mode analysis.

### Bot Connection

Verified against `MacroSwingStructureBot.analyze()` Steps 5-7 in
`bot_strategies.py` — `sl_swing`, `calculate_targets(..., rr_ratio=5.0,
...)`, `targets["tp2"]`, and `calculate_position_risk(setup_quality=1.2)`
all quoted directly from source.

---

## BOT1-08 — Failure: What a Failed Bot 1 Setup Looks Like

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT1-05, BOT1-07, C9-02
**Learning objectives:** Distinguish a valid Bot 1 signal that loses
(a valid loss, C9-02) from a setup where the pipeline should never
have produced a signal at all.

### Why This Matters

C9-02 already taught valid loss vs. bad loss as a general concept.
This lesson applies it with full precision to Bot 1 — using the exact
gates from BOT1-05 to determine whether a losing Bot 1 trade was a
valid loss (every gate genuinely passed, the market simply moved
against a sound signal) or a bad loss (a gate was actually failed, and
a signal fired — or was manually forced — anyway).

### Core Teaching

**Plain-English explanation.** A valid Bot 1 loss looks like this: all
four gates from BOT1-05 genuinely passed, the entry, stop, and target
were calculated exactly as BOT1-06/07 describe, and the trade still
hit its stop — normal variance from a genuinely sound signal (ORIENT-04).
A bad Bot 1 loss looks like one of the four gates being ignored or
forced past — most commonly, a trader manually entering on a 4H CHoCH
(BOT1-03) mistaking it for confirmation, or using a zone that wasn't
actually ACTIVE (BOT1-04).

**Technical explanation.** Because `MacroSwingStructureBot.analyze()`
either returns a complete, gate-passed `BotSignal` or `None` — with no
partial or low-confidence signal in between — every REAL Bot 1 signal
by construction already passed all four BOT1-05 gates. This means any
genuine Bot 1 signal that loses is, by definition, a valid loss in
C9-02's sense: the process (the bot's own pipeline) was followed
correctly, and the loss reflects real market variance, not a process
failure. A "bad Bot 1 loss" therefore almost always traces back to a
human override — manually forcing a trade that resembles a Bot 1
setup but that the actual pipeline would have returned `None` for.

### Visual Model

See diagram: `visuals/bot1-08-valid-vs-bad-loss.svg` — two paths: a
real bot-generated signal (all four gates passed) hitting its stop,
labeled "valid loss — normal variance"; and a manually forced trade
that skipped a gate, labeled "bad loss — process was never actually
followed."

### Worked Example

A genuine Bot 1 signal fires: 1D trend confirmed, matching 4H BOS,
ACTIVE zone selected, mean entry, structure-anchored stop. Price moves
against it and the stop is hit. Since every gate genuinely passed,
this is a valid loss (C9-02) — no process change is warranted from
this single trade.

### Counterexample

A trader sees a bullish 1D trend and an ENTICING-looking 4H CHoCH
(not a BOS) and manually places a Bot-1-style trade anyway, reasoning
"it's basically the same thing." The trade loses. This is a bad loss
— gate 3 from BOT1-05 (BOS alignment, never CHoCH) was never actually
satisfied; the process wasn't followed, a human simply resembled it.

### Good Example / Bad Example

Good: Trusting that any genuine, bot-generated Bot 1 signal that
loses is a valid loss by construction, since the pipeline enforces
every gate automatically. Bad: Manually replicating what LOOKS like a
Bot 1 setup while quietly skipping one of its four real gates, then
treating a resulting loss as if the real process had been followed.

### What to Look Out For

- A genuine, bot-generated Bot 1 signal is a valid loss by
  construction if it loses — the pipeline itself enforces all four
  gates before ever producing a signal.
- A manually-forced trade that resembles Bot 1's style is only a
  valid Bot 1 loss if it ACTUALLY passes all four BOT1-05 gates, not
  just superficially resembles one.
- The single most common bad-loss pattern for this bot specifically is
  mistaking a 4H CHoCH for BOS confirmation (BOT1-03).

### Common Mistakes

Assuming any trade that "looks like" a Bot 1 setup carries the same
valid-loss status as an actual bot-generated signal is the most
consequential mistake this lesson exists to correct — resemblance is
not the same as actually passing all four gates.

### Key Takeaways

1. A genuine Bot 1 signal, by construction, has already passed all
   four BOT1-05 gates — a loss on one is a valid loss (C9-02).
2. A manually-forced trade only counts as a genuine Bot 1 signal if it
   ACTUALLY passes all four gates, not merely resembles the pattern.
3. The most common Bot-1-specific bad-loss pattern is mistaking a 4H
   CHoCH for the BOS confirmation this bot actually requires.

### Practice Drill

Given five losing-trade case studies styled after Bot 1 (provided in
Practise), determine which are valid losses (all four gates genuinely
passed) and which are bad losses (a gate was actually skipped).

### Scenario Challenge

A trader's manually-placed "Bot 1 style" trade loses. On review, the
4H structural event they used as confirmation turns out to have been a
CHoCH, not a BOS. Using this lesson's vocabulary, classify this loss
and explain what specifically should change going forward.

### Mini Quiz

Q1 (True/False): Every real, bot-generated Bot 1 signal that loses is
automatically a valid loss.
Answer: True — the pipeline only produces a signal after all four
BOT1-05 gates genuinely pass, so a loss on a real signal reflects
normal variance, not a process failure.

Q2 (Multiple choice): What's the most common Bot-1-specific pattern
behind a bad loss?
(a) Using too wide a stop
(b) Mistaking a 4H CHoCH for the BOS confirmation this bot requires
(c) Targeting too high an R:R
(d) Trading too infrequently

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 1 signal a valid or
  bad loss? Back: Valid — by construction it already passed all four
  BOT1-05 gates, so the loss reflects normal variance.
- Front: What's the most common Bot-1-specific bad-loss pattern?
  Back: Mistaking a 4H CHoCH for the BOS confirmation this bot
  actually requires (BOT1-03).

### Reflection

Have you ever manually replicated a bot-style setup that "resembled"
the real pattern without checking every one of its actual gates? What
specific gate would this lesson have caught?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies as valid
or bad losses.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this lesson applies C9-02's
general model with full Bot 1-specific precision.

### Bot Connection

Grounded in the fact that `MacroSwingStructureBot.analyze()` only ever
returns a complete signal or `None` — verified directly from
`bot_strategies.py` — with no partial-confidence middle ground that
could otherwise complicate this valid/bad-loss classification.

---

## BOT1-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 16 minutes
**Prerequisites:** BOT1-01 through BOT1-08
**Learning objectives:** Apply every stage of Bot 1's real pipeline,
in order, to a single chart scenario, producing the same
entry/stop/target Bot 1's own code would.

### Why This Matters

BOT1-01 through BOT1-08 taught each stage of Bot 1's pipeline
separately. This lesson is the first to require running all seven
real steps — 1D trend, 4H BOS alignment, zone selection, gate
checking, entry, stop, target/sizing — on one continuous scenario, the
same way `analyze()` actually executes them in sequence.

### Core Teaching

**Plain-English explanation.** Given a full chart scenario (1D swing
data, 4H swing and zone data), work through Bot 1's pipeline exactly
in its real order: confirm the 1D trend (BOT1-02), check 4H BOS
alignment (BOT1-03), select the eligible zone (BOT1-04), confirm no
gate failed (BOT1-05), calculate the mean entry (BOT1-06), and
calculate the structure-anchored stop and 5:1 TP2 target (BOT1-07).

**Technical explanation.** This exercise deliberately mirrors the
literal control flow of `MacroSwingStructureBot.analyze()` — each
step must be completed and must not fail before moving to the next,
exactly as the real function's sequential `if ... return None` gates
work. Skipping a step or reordering them (e.g., picking a zone before
confirming BOS alignment) produces a result that isn't actually what
the bot would output, even if the final numbers happen to look
similar.

### Visual Model

See diagram: `visuals/bot1-09-full-pipeline-worksheet.svg` — a
seven-row worksheet template mirroring `analyze()`'s own step
sequence, each row requiring a specific real output (trend direction,
BOS type, selected zone, gate-pass confirmation, entry price, stop
price, TP2) before the next row can be filled in.

### Worked Example

A full worked scenario (provided in Practise) walks a 1D chart through
all four recent swings, a 4H chart with a matching BOS and one ACTIVE
bullish zone, ending with the exact same entry/stop/TP2 numbers Bot
1's actual code would output for that data.

### Counterexample

A trader completes the exercise but calculates a stop distance from an
arbitrary round number instead of the actual 1D swing low used to
confirm trend (BOT1-07) — their final signal, even if directionally
correct, doesn't match what Bot 1's real pipeline would have produced.

### Good Example / Bad Example

Good: Working every step in the exact order and using the exact real
values (swing prices, zone edges) the pipeline references at each
stage. Bad: Jumping to a "reasonable-looking" final entry/stop/target
without working through each of the seven real steps in sequence.

### What to Look Out For

- The seven steps must be worked IN ORDER — later steps depend on
  exact outputs from earlier ones (the selected zone, the confirmed
  swing point).
- Every number produced should be traceable back to a specific real
  value from the given chart data, not estimated.
- This is the same "assemble the pieces into one process" discipline
  C9-01 taught generally, now applied to one specific bot's real code.

### Common Mistakes

Producing a plausible-looking final signal without actually working
through each of the seven real steps in order is the most common
shortcut this lesson exists to catch — the goal is reproducing what
the actual pipeline computes, not approximating it.

### Key Takeaways

1. Bot 1's full pipeline is seven real, ordered steps — not a single
   holistic judgment call.
2. Each step's output feeds the next exactly — skipping or reordering
   steps produces a signal that doesn't match the real bot's output.
3. Every final number (entry, stop, target) should trace back to a
   specific, real value from the chart data.

### Practice Drill

Given a full chart scenario (provided in Practise) with 1D and 4H
data, work through all seven real pipeline steps to produce the exact
entry price, stop price, and TP2 target Bot 1's code would output.

### Scenario Challenge

Given two full scenarios (provided in Practise), one where the
pipeline should produce a real signal and one where it should return
`None` at a specific gate, correctly work through both and identify
exactly where the second one fails.

### Mini Quiz

Q1 (True/False): It's acceptable to calculate stop and target before
confirming the 4H BOS alignment, as long as the final numbers look
reasonable.
Answer: False — the real pipeline's steps are sequential and
dependent; working out of order can produce a signal that doesn't
match what the actual code computes.

Q2 (Multiple choice): What determines whether a practice-drill
scenario is worked correctly?
(a) Whether the final entry/stop/target look reasonable
(b) Whether every step traces back to a specific real value from the
    chart data, worked in the pipeline's real order
(c) Whether the trade would have been profitable
(d) How quickly the exercise was completed

Answer: (b).

### Flashcards

- Front: How many real, ordered steps does Bot 1's full pipeline have?
  Back: Seven — 1D trend, 4H BOS alignment, zone selection, gate
  check, entry, stop, target/sizing.
- Front: Why must the steps be worked in order? Back: Later steps
  depend on exact outputs from earlier ones (e.g., the stop references
  the same swing point used to confirm trend) — reordering breaks
  that dependency.

### Mastery Criteria

Correctly produce the exact entry, stop, and TP2 target for the
practice-drill scenario, and correctly identify the failing gate in
the `None`-producing scenario.

### Reflection

Working through this by hand, which step took the most conscious
effort to get exactly right rather than approximate? What does that
suggest about which part of Bot 1's real logic is easiest to
misremember?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT1-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`MacroSwingStructureBot.analyze()`'s real control flow — no
step here exists that isn't a real line of code in `bot_strategies.py`.

---

## BOT1-10 — Capstone: Full Bot 1 Decision Simulation

**Level:** 4
**Estimated study time:** 18 minutes
**Prerequisites:** BOT1-01 through BOT1-09
**Learning objectives:** Given raw multi-timeframe chart data, produce
the complete Bot 1 decision — either a full signal (entry, stop, TP2,
lot size, reasoning) or a correctly-identified `None` with the exact
failing gate — matching what the real pipeline would output.

### Why This Matters

This capstone is the practical payoff of the entire BOT1 track — every
earlier lesson taught one real piece of `MacroSwingStructureBot`;
this is the first and only lesson that requires producing Bot 1's
complete, real decision from raw data with nothing pre-selected or
simplified, the same test the actual code faces on every real market
update.

### Core Teaching

**Plain-English explanation.** Given raw 1D and 4H candle data (no
swings, zones, or trend pre-identified), work the entire pipeline from
scratch: detect the swings, determine the trend, detect the 4H BOS,
detect the 4H zones, run all four BOT1-05 gates, and — if every gate
passes — produce the exact entry, stop, TP2, and a `reasoning` string
in the same style Bot 1's own code generates.

**Technical explanation.** This exercise is deliberately built to
mirror `BotOrchestrator.run_all()`'s own real invocation of
`MacroSwingStructureBot.analyze()` — called with only raw
`market_data["1D"]` and `market_data["4H"]` candle lists and an
account balance, exactly the same inputs a live signal run would use.
A correct capstone answer is either a complete `BotSignal`-equivalent
(matching every field: direction, entry_price, stop_loss, take_profit,
lot_size, reasoning) or an explicit `None` with the specific BOT1-05
gate identified as the cause — anything less specific than that
doesn't match what the real pipeline actually returns.

### Visual Model

See diagram: `visuals/bot1-10-capstone-flow.svg` — the complete,
unbroken pipeline from raw candle data through every one of BOT1-01
through BOT1-09's stages to a final signal-or-None outcome, presented
as one continuous flow for the first time in this track.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 1D and
4H candle series. Working the complete pipeline: 4+ 1D swings confirm
a bearish trend, a matching bearish 4H BOS is detected, one ACTIVE
bearish 4H zone is found, all four gates pass, entry is calculated at
the zone mean, stop beyond the confirming 1D swing high, and TP2 at
5:1 — producing a complete signal matching what
`MacroSwingStructureBot.analyze()` would output for this exact data.

### Counterexample

A different capstone scenario supplies raw data where the 1D trend is
confirmed but the most recent 4H structural event is a CHoCH, not a
BOS. The correct capstone answer is an explicit `None` at gate 3
(BOT1-05) — producing any entry/stop/target numbers here, even
plausible-looking ones, would not match the real pipeline's actual
output.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data every time, and
answering `None` with the specific failing gate when that's the
correct outcome — a `None` is just as valid and complete an answer as
a full signal. Bad: Skipping ahead to a plausible-looking final signal
without actually detecting the swings, BOS, and zones from the raw
data first.

### What to Look Out For

- A correct `None` answer, with the specific gate identified, is just
  as complete a capstone answer as a full signal — don't force a
  signal where the real pipeline wouldn't produce one.
- Every field of a produced signal (direction, entry, stop, TP2, lot
  size) must trace back to a real calculation from BOT1-01 through
  BOT1-07 — nothing estimated or approximated.
- This capstone uses RAW candle data — swings, BOS, and zones are not
  pre-identified, unlike BOT1-09's more scaffolded exercise.

### Common Mistakes

The most consequential mistake at this capstone level is treating
`None` as a lesser or incomplete answer compared to a full signal —
Bot 1's real pipeline returns `None` far more often than it returns a
signal (BOT1-01's low-frequency point), and correctly identifying
which of the four gates failed is exactly as demonstrative of mastery
as producing a correct full signal.

### Key Takeaways

1. The capstone works Bot 1's complete pipeline from raw candle data
   — nothing pre-identified, exactly matching how the real bot runs.
2. A correctly-identified `None`, with the specific failing gate, is
   just as valid a capstone answer as a complete signal.
3. Every field of a produced signal must trace back to a specific,
   real calculation from earlier BOT1 lessons — nothing approximated.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one of which should correctly produce `None`), work the
complete Bot 1 pipeline for each and produce the correct final output.

### Scenario Challenge

Given a raw scenario where the 1D trend is confirmed bullish, the 4H
BOS matches, but the only bullish 4H zone is MITIGATED rather than
ACTIVE, produce the complete, correct pipeline output — including
which specific gate this fails at and why no fallback zone is used.

### Mini Quiz

Q1 (True/False): A correctly-identified `None` output is a less
complete demonstration of mastery than a produced signal.
Answer: False — `None` is the more common real-world outcome for this
bot, and correctly identifying the specific failing gate demonstrates
the same mastery as producing a correct signal.

Q2 (Multiple choice): What must every field of a produced capstone
signal (entry, stop, TP2, lot size) be traceable to?
(a) A reasonable estimate given the overall chart
(b) A specific, real calculation from the raw data, following
    BOT1-01 through BOT1-07's actual rules
(c) Whatever number makes the R:R come out to exactly 5:1
(d) The trader's own discretionary judgment

Answer: (b).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 1D
  and 4H candle data — no swings, BOS, or zones pre-identified,
  matching `BotOrchestrator.run_all()`'s real invocation.
- Front: Is a correct `None` output as valid a capstone answer as a
  full signal? Back: Yes — as long as the specific failing gate
  (BOT1-05) is correctly identified; `None` is Bot 1's more common
  real-world outcome.

### Mastery Criteria

Produce the complete, correct pipeline output — full signal or
correctly-identified `None` with its specific gate — for all three
practice-drill scenarios.

### Reflection

Across this entire track, which single stage (Identification, Setup,
Entry, Management, or Failure) took the most repetition to internalize
as an exact rule rather than an approximation? Why do you think that
particular stage was hardest to pin down precisely?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone is the complete
synthesis of BOT1-01 through BOT1-09, and the direct template for how
BOT2 through BOT5's own capstones will apply the same discipline to
their genuinely different real pipelines.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 1:
Needs 1D + 4H" invocation of `MacroSwingStructureBot.analyze()` in
full — every one of its real steps, gates, and outputs, verified
directly against `bot_strategies.py`.
