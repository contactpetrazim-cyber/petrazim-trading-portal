# BOT 3 — IMBALANCE EXPANSION MASTERY

Ten-lesson specialization track for Bot 3 (Imbalance Expansion & FVG
Fill, Photon/Phantom style) — verified line-by-line against
`backend/app/core/bot_strategies.py`'s `FVGExpansionBot`. Contrasted
explicitly against BOT_1 and BOT_2 wherever the real logic actually
differs.

---

## BOT3-01 — Concept: Imbalance Expansion & FVG Fill

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** C5-01, C5-03
**Learning objectives:** Explain Bot 3's philosophy — trading a
partial retracement into an unmitigated 1H imbalance — and name its
real two-timeframe scope.

### Why This Matters

Bot 3 is neither Bot 1's slow swing continuation nor Bot 2's LTF
reversal — it's a momentum-continuation play on a fresh institutional
imbalance (C5-01), entering DURING the retracement rather than waiting
for a full fill. Getting this positioning right up front frames every
later BOT3 lesson correctly.

### Core Teaching

**Plain-English explanation.** Bot 3 (Photon/Phantom style) looks for
a Fair Value Gap (C5-01) on the 1H timeframe that hasn't been fully
mitigated — evidence of a genuine institutional imbalance still
"open." It waits for price to retrace partway back INTO that gap
(C5-03's fill lifecycle), then confirms the retracement is over and
the original expansion is resuming on the 15M timeframe, entering in
the direction of the ORIGINAL imbalance, not against it.

**Technical explanation.** `FVGExpansionBot.analyze()` takes two
candle series — `candles_1h` and `candles_15m` — the same COUNT as
Bot 1, but a genuinely different PAIR (1H+15M here, vs. 1D+4H for Bot
1). Its `EntryExitEngine` defaults to `rr=4.0` (between Bot 2's 3.0 and
Bot 1's 5.0) and `RiskManager` uses `base_risk_percent=1.0` (matching
Bot 2, tighter than Bot 1's 1.5).

### Visual Model

See diagram: `visuals/bot3-01-timeframe-pair.svg` — three bot icons
(Bot 1: 1D+4H, Bot 2: 4H+1H+15M, Bot 3: 1H+15M) showing each bot's
genuinely distinct timeframe combination, not a shared template.

### Worked Example

A trader assumes Bot 3, like Bot 1, waits for a fully-confirmed trend
before entering. Bot 3 actually enters WHILE a gap is still partially
open (C5-03) — a fundamentally earlier, momentum-continuation entry
point than Bot 1's confirmed-structure approach.

### Counterexample

A trader treats a Bot 3 signal as a reversal play (Bot 2's style),
expecting price to turn around at the FVG. Bot 3 trades WITH the
original imbalance direction — a continuation of the expansion move,
not a reversal against it.

### Good Example / Bad Example

Good: Recognizing Bot 3 as a momentum-continuation play on a still-open
1H imbalance, entered on 15M confirmation. Bad: Treating it as either
a slow swing-structure bot (Bot 1) or a reversal bot (Bot 2) — it's
neither.

### What to Look Out For

- Bot 3 uses 1H and 15M — a genuinely different pair from either Bot 1
  or Bot 2, despite Bot 1 also using two timeframes.
- Its 4:1 target sits between Bot 2's 3:1 and Bot 1's 5:1.
- It is a CONTINUATION play on a fresh imbalance, not a reversal.

### Common Mistakes

Assuming any bot using an FVG must be trading a "reversal" (confusing
FVG-based entries with Bot 2's zone-reversal style) is a common
cross-bot mix-up this lesson exists to prevent.

### Key Takeaways

1. Bot 3 reads 1H and 15M data — a distinct pair from Bot 1's 1D/4H
   and Bot 2's 4H/1H/15M.
2. Its target (4:1) and base risk (1.0%) sit between Bot 1's and
   Bot 2's real values.
3. Bot 3 is a continuation play on a still-open imbalance — trading
   WITH the original expansion direction, not against it.

### Practice Drill

Given five real bot signal cards (provided in Practise), identify the
Bot 3 signal using only its timeframe pair and target R:R.

### Scenario Challenge

A trader expects a Bot 3 signal to reverse at the FVG the way a Bot 2
signal reverses at an order block. Using this lesson's concept, why
is that expectation wrong?

### Mini Quiz

Q1 (True/False): Bot 3 uses the same timeframe pair as Bot 1.
Answer: False — Bot 3 reads 1H and 15M; Bot 1 reads 1D and 4H — both
are two-timeframe bots, but a genuinely different pair each.

Q2 (Multiple choice): What is Bot 3's real target reward-to-risk
ratio?
(a) 3:1
(b) 4:1
(c) 5:1
(d) 6:1

Answer: (b) — `EntryExitEngine(default_rr=4.0)`.

### Flashcards

- Front: What two timeframes does Bot 3 use? Back: 1H and 15M — the
  same count as Bot 1, but a genuinely different pair.
- Front: Is Bot 3 a continuation or reversal play? Back: Continuation
  — it trades WITH the direction of a still-open 1H imbalance.

### Reflection

Before this lesson, would you have assumed any FVG-based bot trades a
reversal? What does Bot 3's real continuation logic teach about
reading a setup by its actual mechanics, not just which concept
(FVG, order block) it references?

### Mastery Criteria

Correctly identify the Bot 3 signal card among the five in the
practice drill.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this concept frames every
following BOT3 lesson.

### Bot Connection

Verified against `FVGExpansionBot.__init__` and `analyze()`'s real
signature in `bot_strategies.py`.

---

## BOT3-02 — Identification: The Partial-Mitigation Window

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT3-01, C5-03
**Learning objectives:** State Bot 3's exact 1H FVG eligibility test —
the 30-70% mitigation window — and explain why neither a fully open
nor a mostly-filled gap qualifies.

### Why This Matters

C5-03 already taught the FVG fill lifecycle generally (partial, full,
inversion). This lesson makes it concrete and precise for Bot 3's real
logic — the exact numeric window its pipeline actually checks.

### Core Teaching

**Plain-English explanation.** Bot 3 doesn't trade a completely
untouched FVG (too early — no confirmation price is even interacting
with it yet) or a nearly-fully-filled one (too late — the imbalance is
basically gone). It requires the gap to be BETWEEN 30% and 70%
mitigated — genuine evidence price has retraced partway into the
imbalance and is a plausible resumption point, without having erased
the imbalance entirely.

**Technical explanation.** `fvgs = detect_fvg(candles_1h)`; `fvgs =
track_mitigation(fvgs, candles_1h)` — this populates each FVG's
`mitigated_percent`. `partial_fvgs = [f for f in fvgs if 0.3 <=
f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"]`. Both
conditions are required together — a gap outside the 30-70% window,
OR one that's no longer `ACTIVE` status even if inside the window
(e.g., already inverted, C5-03), is excluded. If `partial_fvgs` is
empty, `analyze()` returns `None`. Among eligible gaps,
`target_fvg = partial_fvgs[-1]` — the most recent, same
recency-based selection pattern as Bot 1's zone selection.

### Visual Model

See diagram: `visuals/bot3-02-mitigation-window.svg` — a horizontal
0%-100% mitigation bar with the 30%-70% eligible window shaded, and
three example FVGs marked at 10% (too early), 50% (eligible), and 90%
(too late).

### Worked Example

A 1H bullish FVG has been retraced into by 45% — it's ACTIVE and
falls inside the 30-70% window. It's eligible; if it's also the most
recent such gap, it becomes `target_fvg`.

### Counterexample

A different 1H bullish FVG has only been retraced into by 8% —
technically still ACTIVE, but well below the 30% floor. It's excluded
from `partial_fvgs` regardless of how fresh or clean it otherwise
looks — the mitigation percentage alone determines eligibility here.

### Good Example / Bad Example

Good: Checking both the exact 30-70% mitigation range AND ACTIVE
status before considering a gap eligible. Bad: Trading any FVG that's
"been touched a bit," without checking whether it falls inside the
specific numeric window this bot's logic actually requires.

### What to Look Out For

- BOTH conditions (30-70% mitigated AND ACTIVE status) are required
  together — satisfying only one isn't enough.
- A completely untouched gap (0% mitigated) is explicitly excluded,
  same as a nearly-full one — this is deliberately a MIDDLE window,
  not "any retracement."
- Among eligible gaps, the MOST RECENT is selected — the same
  recency-first pattern already seen in Bot 1's zone selection.

### Common Mistakes

Assuming "any retracement into the gap" qualifies, rather than the
specific 30-70% window, is the most common gap between intuition and
Bot 3's actual, more precise test.

### Key Takeaways

1. Bot 3 requires an ACTIVE 1H FVG mitigated between exactly 30% and
   70% — both bounds matter, and both conditions (window + status)
   are required together.
2. A completely fresh or a nearly-fully-filled gap is explicitly
   excluded — this is a deliberate middle window, not "any touch."
3. Among eligible gaps, the most recent one is selected.

### Practice Drill

Given six 1H FVGs with varying mitigation percentages and statuses
(provided in Practise), determine which are eligible under Bot 3's
exact test.

### Scenario Challenge

A trader sees a fresh, completely untouched 1H FVG and wants to enter
immediately, reasoning "the fresher the better." Using Bot 3's actual
window, explain why this gap isn't eligible yet.

### Mini Quiz

Q1 (True/False): A completely untouched (0% mitigated) FVG is the
best candidate for Bot 3.
Answer: False — Bot 3 requires 30-70% mitigation; a 0% gap is
explicitly excluded as too early.

Q2 (Multiple choice): What two conditions must an FVG satisfy
together to be eligible?
(a) Any mitigation percentage AND fresh formation
(b) 30-70% mitigated AND ACTIVE status
(c) Fully mitigated AND recent formation
(d) 0% mitigated AND high volume

Answer: (b).

### Flashcards

- Front: What's Bot 3's exact FVG eligibility window? Back: Mitigated
  between 30% and 70%, AND still ACTIVE status — both required
  together.
- Front: Why does Bot 3 exclude a 0%-mitigated gap? Back: No
  retracement has happened yet — too early for this bot's
  continuation-on-retracement logic.

### Reflection

Would you have intuitively favored the freshest, least-touched FVG on
a chart? What does Bot 3's actual middle-window logic suggest about
why "freshest" isn't the same as "most tradable" for this specific
strategy?

### Mastery Criteria

Correctly classify all six practice-drill FVGs by Bot 3's exact
eligibility test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this eligible-gap selection
feeds directly into BOT3-04's entry-price calculation.

### Bot Connection

Verified against `FVGExpansionBot.analyze()` Step 1 in
`bot_strategies.py` — the `0.3 <= f.mitigated_percent <= 0.7` and
`f.status.name == "ACTIVE"` conditions quoted directly from source.

---

## BOT3-03 — Context: Why 15M BOS Confirms (a Third Pattern)

**Level:** 3
**Estimated study time:** 13 minutes
**Prerequisites:** BOT3-02, BOT1-03, BOT2-03
**Learning objectives:** State that Bot 3 checks 15M BOS (not CHoCH),
and explain why this matches Bot 1's pattern rather than Bot 2's,
despite Bot 3 being neither bot's exact philosophy.

### Why This Matters

BOT1-03 and BOT2-03 already showed BOS-only and CHoCH-only as two
opposite real patterns. Bot 3 adds a third real data point: it's
neither a pure continuation-of-existing-trend bot (Bot 1) nor a
reversal bot (Bot 2), yet it still checks BOS, not CHoCH — worth
understanding precisely why.

### Core Teaching

**Plain-English explanation.** Bot 3 needs the 15M timeframe to
confirm that the ORIGINAL imbalance-driving move is actively
RESUMING, not reversing — that's a continuation signal, which is what
a BOS (C2-06) represents, not a CHoCH (C2-07). Even though Bot 3 isn't
Bot 1's slow swing-continuation style, it shares this specific
structural requirement with Bot 1 because both bots need confirmation
that a trend is CONTINUING, just measured against different reference
points (Bot 1: the 1D trend; Bot 3: the FVG's own original direction).

**Technical explanation.** `bos_15m = detect_bos(candles_15m,
swings_15m)`; if empty, `analyze()` returns `None`. Direction
alignment is checked against the FVG's OWN gap type, not a separately
computed trend: `if target_fvg.gap_type == "bullish" and
last_bos["type"] != "bullish_bos": return None` (mirror for bearish).
Like Bot 1, and unlike Bot 2, `detect_choch` is never called anywhere
in `FVGExpansionBot`.

### Visual Model

See diagram: `visuals/bot3-03-three-bot-pattern.svg` — a table: Bot 1
(BOS, confirms vs. 1D trend), Bot 2 (CHoCH, sets direction directly),
Bot 3 (BOS, confirms vs. the FVG's own gap type) — three genuinely
different reference points, two of the three sharing the BOS
mechanism.

### Worked Example

The selected 1H FVG (BOT3-02) has `gap_type == "bullish"`. The 15M
timeframe then prints a bullish BOS — confirming the original bullish
imbalance is resuming, not reversing. Alignment passes, and the
pipeline proceeds to BOT3-04's entry calculation.

### Counterexample

The same bullish FVG is selected, but the 15M timeframe instead prints
a bearish CHoCH — a genuine reversal signal. `detect_choch` is never
called by this bot's logic, so this event is simply invisible to it;
`bos_15m` would need its own real BOS event to proceed, and a CHoCH
alone (regardless of direction) never satisfies this stage.

### Good Example / Bad Example

Good: Checking specifically for a 15M BOS matching the FVG's own gap
type, understanding this confirms the original imbalance is resuming.
Bad: Treating any 15M structural shift (BOS or CHoCH) as equally
valid confirmation for a Bot 3 setup.

### What to Look Out For

- Bot 3 checks BOS, never CHoCH — matching Bot 1's pattern, not
  Bot 2's, despite being a different style of bot from either.
- The BOS must match the FVG's OWN `gap_type` — not a separately
  computed 1H or 1D trend the way Bot 1 checks against its 1D trend.
- No 15M BOS at all, or a mismatched direction, both return `None`.

### Common Mistakes

Assuming "reversal-adjacent" setups (anything involving a retracement)
must use CHoCH, the way Bot 2 does, is a common mistake this lesson
exists to correct — Bot 3's retracement entry is still fundamentally a
continuation play, hence BOS.

### Key Takeaways

1. Bot 3 checks 15M BOS, never CHoCH — the same mechanism as Bot 1,
   despite being a genuinely different bot.
2. The BOS must match the selected FVG's own `gap_type`, not a
   separately-computed higher-timeframe trend.
3. This is Bot 3's own continuation confirmation — evidence the
   original imbalance is resuming, not reversing.

### Practice Drill

Given five FVG-gap-type + 15M-structural-event pairs (provided in
Practise, mixing BOS and CHoCH events), determine which satisfy Bot
3's alignment test.

### Scenario Challenge

A trader assumes any bot trading a retracement entry (like Bot 3)
must be reversal-style and require a CHoCH, the way Bot 2 does. Using
this lesson's vocabulary, explain the actual distinction.

### Mini Quiz

Q1 (True/False): Bot 3 checks for a 15M CHoCH the same way Bot 2 does.
Answer: False — `detect_choch` is never called anywhere in
`FVGExpansionBot`; only BOS confirms, matching Bot 1's pattern.

Q2 (Multiple choice): What must the confirming 15M BOS's direction
match?
(a) The 1D trend, like Bot 1
(b) The selected FVG's own gap_type
(c) The 4H structure
(d) Nothing — any BOS direction is accepted

Answer: (b).

### Flashcards

- Front: Does Bot 3 check BOS or CHoCH? Back: BOS — matching Bot 1's
  pattern, despite Bot 3 being a genuinely different style of bot.
- Front: What must the 15M BOS direction match for Bot 3? Back: The
  selected FVG's own `gap_type` — not a separately-computed
  higher-timeframe trend.

### Reflection

Now that you've seen Bot 1 (BOS vs. 1D trend), Bot 2 (CHoCH sets
direction), and Bot 3 (BOS vs. FVG gap_type), what's the actual rule
for when a bot uses BOS versus CHoCH — is it about timeframe, or
about whether the bot is fundamentally continuation- or
reversal-seeking?

### Mastery Criteria

Correctly classify all five practice-drill pairs by Bot 3's exact
alignment test.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the third and final
data point in the BOS-vs-CHoCH cross-bot pattern, resurfacing again in
BOT4-03 and BOT5-03.

### Bot Connection

Verified against `FVGExpansionBot.analyze()` Step 2 in
`bot_strategies.py` — the `detect_bos` call and
`target_fvg.gap_type == "bullish"`/`"bearish"` alignment checks, and
the confirmed absence of any `detect_choch` call anywhere in this
bot's class.

---

## BOT3-04 — Setup: The Hand-Calculated Midpoint Entry

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT3-03, BOT1-06
**Learning objectives:** State Bot 3's entry-price formula, and
explain how it differs technically from Bot 1/Bot 2's entry-engine
calls.

### Why This Matters

BOT1-06 and BOT2-06 both used the shared `EntryExitEngine.calculate_entry`
helper. Bot 3 does something genuinely different at the code level —
worth knowing precisely, since it changes exactly what "entry price"
means for this bot compared to the other two.

### Core Teaching

**Plain-English explanation.** Bot 3's entry price is simply the exact
midpoint of the selected FVG — the average of its top and bottom
prices. Conceptually this is similar to Bot 1's "mean" entry, but it's
computed as a direct, hand-written calculation rather than going
through the shared entry-calculation helper both Bot 1 and Bot 2 use.

**Technical explanation.** `entry_price = (target_fvg.top +
target_fvg.bottom) / 2` — a plain Python arithmetic expression,
computed directly inside `analyze()`. This contrasts with Bot 1's
`self.entry_engine.calculate_entry(entry_zone, "mean", direction)` and
Bot 2's conditional `calculate_entry(target_ob, entry_type, direction)`
— both of which delegate to the shared `EntryExitEngine` class. Bot 3
never calls `calculate_entry` at all; its entry math is entirely
local to this one line.

### Visual Model

See diagram: `visuals/bot3-04-hand-calculated-entry.svg` — three code
snippets side by side: Bot 1's `calculate_entry(..., "mean", ...)`,
Bot 2's conditional `calculate_entry(..., entry_type, ...)`, and Bot
3's plain `(top + bottom) / 2` — visually flagging that only Bot 3
skips the shared engine call entirely.

### Worked Example

The selected FVG spans 1.0920 (top) to 1.0900 (bottom). Bot 3's entry
price is `(1.0920 + 1.0900) / 2 = 1.0910` — computed directly, no
entry-engine call involved.

### Counterexample

A trader assumes Bot 3's entry must route through the same
`calculate_entry("mean", ...)` call Bot 1 uses, since both produce a
conceptual midpoint. While the RESULT is arithmetically similar, the
actual code path is genuinely different — Bot 3 never touches
`EntryExitEngine.calculate_entry` at all.

### Good Example / Bad Example

Good: Understanding that Bot 3's entry price, while conceptually
similar to a "mean" entry, is computed via its own direct formula, not
the shared entry engine. Bad: Assuming every bot that uses a
zone/gap midpoint must be calling the same underlying helper function.

### What to Look Out For

- Bot 3's entry price is a direct FVG-top/bottom average — no
  `calculate_entry` call anywhere in this bot's class.
- The RESULT is conceptually similar to Bot 1's "mean" entry, but the
  underlying code path is genuinely different.
- This is a real implementation detail, not a simplification for
  teaching purposes — worth knowing precisely if extending or
  debugging this bot's code.

### Common Mistakes

Assuming every bot computes its entry price through one shared,
universal helper function is a common cross-bot misread — Bot 3's
entry math is entirely local and hand-written.

### Key Takeaways

1. Bot 3's entry price is the direct average of the selected FVG's top
   and bottom — `(top + bottom) / 2`.
2. This is computed locally, without any call to
   `EntryExitEngine.calculate_entry`, unlike Bot 1 and Bot 2.
3. The conceptual result (a midpoint entry) resembles Bot 1's "mean"
   style, but the actual code path is genuinely different.

### Practice Drill

Given four FVG top/bottom price pairs (provided in Practise), calculate
the exact entry price Bot 3 would use for each.

### Scenario Challenge

A developer extending this codebase assumes all three bots' entry
logic lives in `EntryExitEngine` and looks there to modify Bot 3's
entry calculation. Using this lesson's vocabulary, where would they
actually need to look instead?

### Mini Quiz

Q1 (True/False): Bot 3's entry price is calculated via
`EntryExitEngine.calculate_entry`, the same as Bot 1 and Bot 2.
Answer: False — it's a direct, local calculation:
`(target_fvg.top + target_fvg.bottom) / 2`.

Q2 (Multiple choice): What is Bot 3's entry price formula?
(a) The zone's near edge
(b) The average of the selected FVG's top and bottom
(c) The most recent 15M candle's close
(d) The FVG's top price only

Answer: (b).

### Flashcards

- Front: What's Bot 3's exact entry price formula? Back:
  `(target_fvg.top + target_fvg.bottom) / 2` — computed directly, no
  entry-engine call.
- Front: Does Bot 3 use the same entry-calculation code path as Bot 1
  and Bot 2? Back: No — it's the only one of the three that never
  calls `EntryExitEngine.calculate_entry`.

### Reflection

Why might it matter, for someone maintaining this codebase, to know
that Bot 3's entry math lives in a different place than Bot 1 and
Bot 2's? What real-world debugging scenario would this distinction
actually affect?

### Mastery Criteria

Correctly calculate the entry price for all four practice-drill FVG
pairs.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this entry price is the anchor
BOT3-07's stop calculation is measured from.

### Bot Connection

Verified against `FVGExpansionBot.analyze()` Step 3 in
`bot_strategies.py` — the direct `(target_fvg.top + target_fvg.bottom)
/ 2` line, confirmed as the only entry-price calculation anywhere in
this bot's class.

---

## BOT3-05 — Invalidation: The Two Conditions That Return No Signal

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT3-02, BOT3-03
**Learning objectives:** List both conditions in Bot 3's pipeline that
cause it to return no signal — the shortest gate list of any bot
covered so far.

### Why This Matters

Bot 1 had four gates, Bot 2 had three. Bot 3 has the shortest list yet
— exactly two — which is itself worth noticing: fewer real gates
generally means a bot fires more readily once its narrower conditions
are met, a real tradeoff worth understanding, not just memorizing the
count.

### Core Teaching

**Plain-English explanation.** Reading through
`FVGExpansionBot.analyze()` in order, there are exactly two points
where it stops and returns no signal: (1) no eligible 1H FVG exists —
none currently sit in the 30-70% mitigation window while still ACTIVE
(BOT3-02); (2) no 15M BOS exists at all, or the one that does exist
doesn't match the selected FVG's gap type (BOT3-03).

**Technical explanation.** This is the shortest gate list of the three
bots covered so far — Bot 1 has four, Bot 2 has three, Bot 3 has two.
There is no third gate analogous to Bot 2's inside-zone-price test,
because Bot 3's entry price is DERIVED from the FVG itself (BOT3-04),
not checked against a separately-observed current price — there's
nothing equivalent to "is price currently inside this zone" to check.

### Visual Model

See diagram: `visuals/bot3-05-two-gates.svg` — a two-step sequence
(eligible FVG found? -> matching 15M BOS found?), each with a "return
None" branch, contrasted against Bot 1's four-gate and Bot 2's
three-gate sequences shown alongside for scale.

### Worked Example

An eligible 1H FVG is found (BOT3-02) and a matching 15M BOS confirms
(BOT3-03) — both gates pass, and the pipeline proceeds directly to
entry calculation (BOT3-04) with no further gate checks.

### Counterexample

An eligible 1H FVG is found, but the 15M timeframe currently shows no
BOS event of any kind — gate 2 fails, and `analyze()` returns `None`,
even though the FVG itself was a genuinely good candidate.

### Good Example / Bad Example

Good: Understanding Bot 3 has only two real gates — fewer than Bot 1
or Bot 2 — and that this is a real structural difference in the
pipeline, not a simplification. Bad: Assuming every bot must have the
same number of gates, or inventing an extra check that doesn't
actually exist in this bot's code.

### What to Look Out For

- Bot 3 has exactly two gates — the shortest list of the three bots
  covered so far.
- There's no "is price inside a zone" gate the way Bot 2 has — Bot
  3's entry is derived directly from the FVG, with nothing separate
  to check price against.
- Fewer gates doesn't mean "less rigorous" — each remaining gate
  (mitigation window + BOS alignment) is still a real, precise test.

### Common Mistakes

Assuming a shorter gate list means a "looser" or less disciplined bot
is a misread — Bot 3 simply has fewer distinct real-world conditions
to check given its specific mechanics (an FVG-derived entry needs no
separate current-price check).

### Key Takeaways

1. Bot 3 has exactly two hard gates — eligible FVG found, and matching
   15M BOS found — the shortest list of the three bots covered so far.
2. There's no analog to Bot 2's inside-zone-price test, since Bot 3's
   entry is derived directly from the FVG itself.
3. A shorter gate list reflects this bot's specific mechanics, not
   reduced rigor.

### Practice Drill

Given six scenario summaries (provided in Practise) describing FVG
eligibility and BOS status, determine at which gate (if any)
`analyze()` would return `None`.

### Scenario Challenge

A trader assumes Bot 3 must have a "price inside the gap" check the
way Bot 2 checks price inside a zone. Using this lesson's vocabulary,
explain why no such gate exists in Bot 3's real logic.

### Mini Quiz

Q1 (True/False): Bot 3 has the same number of hard gates as Bot 1.
Answer: False — Bot 3 has two gates; Bot 1 has four.

Q2 (Multiple choice): Why doesn't Bot 3 need an "is price inside the
zone" gate like Bot 2's?
(a) It doesn't matter for this bot's risk profile
(b) Its entry price is derived directly from the FVG's own top and
    bottom, with no separate current-price check needed
(c) It's a missing feature that should be added
(d) The 15M BOS check already covers this

Answer: (b).

### Flashcards

- Front: How many hard gates does Bot 3's pipeline have? Back: Two —
  eligible FVG found (BOT3-02), and matching 15M BOS found (BOT3-03).
- Front: Why doesn't Bot 3 need an inside-zone-price gate? Back: Its
  entry price is derived directly from the FVG's own top/bottom
  (BOT3-04) — there's no separate current price to check against a
  zone.

### Mastery Criteria

Correctly identify the failing gate (or confirm both pass) in all six
practice-drill scenarios.

### Reflection

Comparing the gate counts across Bot 1 (four), Bot 2 (three), and Bot
3 (two), what does that progression suggest about how each bot's
specific mechanics — not some universal rulebook — determines how
many real checks it needs?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this is the assembly point for
BOT3-02 and BOT3-03.

### Bot Connection

Every gate here is a direct `return None` line inside
`FVGExpansionBot.analyze()` — confirmed as exactly two by tracing the
function's complete control flow in `bot_strategies.py`.

---

## BOT3-06 — Entry: Direction and Price, Assembled

**Level:** 3
**Estimated study time:** 11 minutes
**Prerequisites:** BOT3-04, BOT3-05
**Learning objectives:** Assemble Bot 3's direction determination and
entry price into one complete entry decision.

### Why This Matters

BOT3-03 established direction (from the FVG's gap type) and BOT3-04
established the entry price formula. This lesson is the short but
necessary assembly of both into the actual entry decision the bot
produces.

### Core Teaching

**Plain-English explanation.** Once both gates (BOT3-05) pass, Bot 3's
direction is set directly from the selected FVG's `gap_type` —
`"bullish"` becomes a long, `"bearish"` becomes a short — and the
entry price is the FVG midpoint (BOT3-04). There's no separate
direction-confirmation step beyond what's already been checked in
BOT3-03's BOS-alignment gate.

**Technical explanation.** `direction = "long" if target_fvg.gap_type
== "bullish" else "short"` — a direct, unconditional mapping,
computed AFTER both gates have already passed. This is simpler than
Bot 2's direction logic (which comes from the CHoCH type, a separate
detected event) and different from Bot 1's (which requires an
independently-confirmed 1D trend) — here, direction was effectively
locked in the moment the FVG itself was selected (BOT3-02), and the
BOS gate (BOT3-03) only confirms it, never sets it.

### Visual Model

See diagram: `visuals/bot3-06-direction-and-entry.svg` — the selected
FVG's `gap_type` flowing directly into both the trade `direction` and,
via its top/bottom, the entry price — one shared source for both
outputs.

### Worked Example

The selected FVG has `gap_type == "bearish"`, and the matching 15M
bearish BOS already confirmed (BOT3-03). `direction = "short"`, and
the entry price is the FVG's midpoint (BOT3-04) — both values now
finalized, ready for BOT3-07's stop and target calculation.

### Counterexample

A trader assumes Bot 3's direction could theoretically differ from
its selected FVG's gap type, the way Bot 1's direction is checked
against a separately-computed trend. In Bot 3's real logic, this
can't happen — the BOS alignment gate (BOT3-03) already guarantees
direction and gap type agree before this point is ever reached.

### Good Example / Bad Example

Good: Recognizing that once BOT3-05's gates pass, direction is already
locked in from the FVG's own gap type — no further confirmation step
exists. Bad: Looking for a separate direction check beyond the FVG's
gap type and the already-passed BOS alignment.

### What to Look Out For

- Direction comes directly from the selected FVG's `gap_type` — no
  additional confirmation step exists beyond BOT3-03's already-passed
  BOS alignment.
- Both direction and entry price trace back to the SAME selected FVG
  object — one source feeding two outputs.
- This is simpler than either Bot 1's (independently-confirmed trend)
  or Bot 2's (CHoCH-derived) direction logic.

### Common Mistakes

Looking for a separate, additional direction-confirmation step beyond
what BOT3-03's BOS-alignment gate already guarantees is a common
overcomplication — by the time this stage is reached, direction is
already settled.

### Key Takeaways

1. Direction comes directly from the selected FVG's `gap_type` — no
   further confirmation step exists.
2. Direction and entry price both trace back to the same selected FVG
   object.
3. This is the simplest of the three bots' direction logic covered so
   far, since BOT3-03's gate already guarantees alignment.

### Practice Drill

Given four selected-FVG scenarios (provided in Practise, with gap type
and top/bottom prices), state the exact direction and entry price Bot
3 would produce for each.

### Scenario Challenge

A trader wonders whether Bot 3's direction could ever disagree with
its selected FVG's own gap type. Using BOT3-03 and BOT3-05's logic
together, explain why that's structurally impossible in this bot's
real pipeline.

### Mini Quiz

Q1 (True/False): Bot 3's direction requires a separate confirmation
step beyond the FVG's gap type and the BOS alignment gate.
Answer: False — direction is set directly from `gap_type`; no further
step exists once BOT3-05's gates have passed.

Q2 (Multiple choice): What single object determines BOTH Bot 3's
direction and entry price?
(a) The 15M BOS event
(b) The selected FVG (`target_fvg`)
(c) A separately-computed 1H trend
(d) The account balance

Answer: (b).

### Flashcards

- Front: What determines Bot 3's trade direction? Back: The selected
  FVG's own `gap_type` — directly, with no separate confirmation step.
- Front: What single object feeds both Bot 3's direction and entry
  price? Back: `target_fvg` — its `gap_type` sets direction, its
  top/bottom average sets entry price.

### Mastery Criteria

Correctly state direction and entry price for all four practice-drill
scenarios.

### Reflection

Compare how direction is determined across Bot 1, Bot 2, and Bot 3.
Which bot's direction logic feels most "locked in early" versus most
"independently re-confirmed," and what does that suggest about each
bot's risk of a false signal?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this assembled entry decision
feeds directly into BOT3-07's stop and target calculation.

### Bot Connection

Verified against `FVGExpansionBot.analyze()` Step 2 (direction) and
Step 3 (entry price) together, in `bot_strategies.py`.

---

## BOT3-07 — Management: Stop, Target, Sizing — and What's NOT Implemented

**Level:** 3
**Estimated study time:** 14 minutes
**Prerequisites:** BOT3-06, C8-01, C8-02
**Learning objectives:** State Bot 3's exact stop and target
calculation, and honestly distinguish it from the docstring's
description of "trailing by BOS" — which the real code does not
implement.

### Why This Matters

This lesson includes a genuine honesty check worth calling out
explicitly: this bot's own class docstring describes trailing the
stop by new BOS formations, but the actual `analyze()` function
computes a single static stop and target, once, and returns. A
curriculum that quietly repeated the docstring's aspiration as if it
were implemented behavior would be teaching something the code
doesn't actually do.

### Core Teaching

**Plain-English explanation.** Bot 3's stop is placed just beyond the
selected FVG's far extreme, with a buffer equal to 10% of the gap's
own size — not a fixed pip distance, and not anchored to a separate
swing point the way Bot 1's is. Its target is a strict 4:1
reward-to-risk from that stop distance, with TP2 as the reported
take-profit — the same multi-target-then-TP2 pattern as Bot 1.
Position sizing uses a 1.15 setup-quality multiplier, between Bot 1's
1.2 and Bot 2's 1.1.

**Technical explanation.** For a long: `sl_price = target_fvg.bottom -
(target_fvg.top - target_fvg.bottom) * 0.1`; for a short:
`sl_price = target_fvg.top + (...) * 0.1` — the buffer is exactly
10% of the FVG's own top-to-bottom size, computed locally (`method:
"fvg_extreme"`), not via a shared engine call, matching BOT3-04's
hand-calculated entry pattern. `calculate_targets(..., rr_ratio=4.0)`,
reporting `tp2`. `calculate_position_risk(setup_quality=1.15)`, then
`calculate_lot_size`. Crucially: THIS IS THE ENTIRE MANAGEMENT LOGIC —
the class docstring's rule 5 ("Trail stop by new BOS formations") is
NOT implemented anywhere in `analyze()`; the function computes one
static `BotSignal` and returns, with no ongoing trailing loop or
stop-adjustment logic anywhere in this class.

### Visual Model

See diagram: `visuals/bot3-07-stop-and-docstring-gap.svg` — the real
stop/target calculation on one side, and a crossed-out "trailing by
BOS" label on the other, captioned "described in the class docstring,
not implemented in analyze() — verify against real code, not stated
intent, every time."

### Worked Example

The selected FVG spans 1.0900 (bottom) to 1.0920 (top) — a 20-pip
gap. For a long entry at the midpoint (1.0910, BOT3-04), the stop sits
at `1.0900 - (0.0020 * 0.1) = 1.0898` — 2 pips of buffer beyond the
gap's own bottom. Stop distance from entry is 12 pips; at 4:1, TP2
sits 48 pips above entry.

### Counterexample

A trader manually manages a live Bot-3-style position expecting the
bot itself to trail the stop upward as new 15M BOS events form,
because the class's own docstring describes that behavior. No such
logic exists anywhere in `analyze()` — the signal, once generated, is
a single static stop and target; any trailing would have to be
implemented separately or done manually.

### Good Example / Bad Example

Good: Treating the docstring's "trail stop by BOS" line as a stated
design intent that isn't actually implemented in the current code,
and managing the position accordingly (manually, or flagging it as a
real gap to build). Bad: Assuming a bot's stop automatically trails
just because its class docstring describes that as the intended
management style.

### What to Look Out For

- The stop buffer is 10% of the FVG's OWN size — proportional to
  that specific gap, not a fixed distance.
- The stop and entry calculations are both hand-written, local
  arithmetic — matching BOT3-04's pattern, not a shared engine call.
- The docstring's "trail stop by BOS" line is NOT implemented
  anywhere in this bot's actual `analyze()` function — a real,
  confirmed gap between stated intent and actual code.

### Common Mistakes

Trusting a class's documented intent (the docstring) as equivalent to
its actual implemented behavior is exactly the mistake this lesson
exists to prevent — always verify against the real code path, the
same discipline this whole curriculum applies throughout.

### Key Takeaways

1. Bot 3's stop buffer is 10% of the selected FVG's own size — a
   proportional, hand-calculated distance, not a fixed pip amount.
2. Its target is 4:1 via TP2, with a 1.15 setup-quality multiplier for
   sizing.
3. The docstring's "trail stop by BOS formations" line is NOT actually
   implemented in `analyze()` — the real function returns one static
   signal with no ongoing trailing logic.

### Practice Drill

Given three FVG top/bottom pairs with entry prices (provided in
Practise), calculate the exact stop price, stop distance, and TP2
target for each.

### Scenario Challenge

A trader is told this bot "trails its stop by BOS formations" and
expects that to happen automatically on an open Bot 3 position. Using
this lesson's exact code-vs-docstring finding, what should they
actually expect, and what would they need to build to get real
trailing behavior?

### Mini Quiz

Q1 (True/False): Bot 3's `analyze()` function includes logic to trail
the stop as new BOS formations appear.
Answer: False — the class docstring describes this as intended
behavior, but no such logic exists anywhere in the actual function;
it returns a single static stop and target.

Q2 (Multiple choice): How is Bot 3's stop buffer calculated?
(a) A fixed 0.0002 distance, like Bot 2's sweep-based stop
(b) 10% of the selected FVG's own top-to-bottom size
(c) Beyond the nearest 1H swing point
(d) A percentage of account balance

Answer: (b).

### Flashcards

- Front: What's Bot 3's exact stop buffer? Back: 10% of the selected
  FVG's own size, beyond its far extreme — proportional to that
  specific gap.
- Front: Does Bot 3 actually implement stop-trailing by BOS, as its
  docstring describes? Back: No — this is a confirmed gap between
  documented intent and actual code; `analyze()` returns one static
  signal only.

### Reflection

Why is it important, when learning a real codebase, to verify a
class's actual behavior against its code rather than trusting its
docstring or comments alone? Where else in this curriculum have you
seen a similar "verify against real code" discipline applied?

### Mastery Criteria

Correctly calculate stop, distance, and TP2 for all three
practice-drill FVG pairs, and correctly state that stop-trailing is
not implemented in the real code.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this stage feeds BOT3-08's
failure-mode analysis.

### Bot Connection

Verified against `FVGExpansionBot.analyze()` Steps 4-6 in
`bot_strategies.py` — the `* 0.1` buffer calculation, `rr_ratio=4.0`,
and `setup_quality=1.15` quoted directly from source, alongside a
confirmed line-by-line check that no trailing logic exists anywhere in
this bot's class despite the docstring's rule 5.

---

## BOT3-08 — Failure: What a Failed Bot 3 Setup Looks Like

**Level:** 3
**Estimated study time:** 12 minutes
**Prerequisites:** BOT3-05, BOT3-07, C9-02
**Learning objectives:** Distinguish a valid Bot 3 loss from a bad
one, with the specific Bot-3 pattern of trading outside the real
mitigation window.

### Why This Matters

Same discipline as BOT1-08 and BOT2-08, applied to Bot 3's own
real, narrower pipeline — this bot's most common bad-loss pattern is
specific to its unique 30-70% eligibility window.

### Core Teaching

**Plain-English explanation.** A valid Bot 3 loss looks like this:
both real gates (BOT3-05) genuinely passed — an FVG genuinely inside
the 30-70% mitigation window, a genuinely matching 15M BOS — and the
trade still hit its stop. A bad Bot 3 loss most often comes from a
trader manually entering on an FVG that's outside the real eligibility
window (too fresh, under 30%, or nearly filled, over 70%) because it
otherwise "looks like" a good setup.

**Technical explanation.** Because `FVGExpansionBot.analyze()` only
ever returns a complete signal or `None`, a genuine bot-generated Bot
3 signal that loses is a valid loss by the same construction argument
as BOT1-08 and BOT2-08. The Bot-3-specific bad-loss pattern traces
most often to the mitigation-window test (BOT3-02) specifically —
either the gap hadn't been retraced into enough yet (a trader jumping
in too early) or had already been mostly filled (a trader entering
too late, chasing a nearly-exhausted imbalance).

### Visual Model

See diagram: `visuals/bot3-08-valid-vs-bad-loss.svg` — a mitigation
bar (0-100%) with the real 30-70% eligible window shaded, and two
"bad loss" markers placed outside it (one under 30%, one over 70%),
both labeled "the real gate was never actually satisfied."

### Worked Example

A genuine Bot 3 signal fires on a 1H FVG mitigated to 55%, with a
matching 15M BOS. The trade hits its stop. Since both gates genuinely
passed, this is a valid loss (C9-02) — no process change is warranted.

### Counterexample

A trader sees a 1H FVG that's only 12% mitigated — well below the 30%
floor — but enters anyway because "it's a clean-looking gap." The
trade loses. This is a bad loss — the mitigation-window gate (BOT3-02)
was never actually satisfied; a human traded a setup the real pipeline
would have declined.

### Good Example / Bad Example

Good: Checking the exact 30-70% mitigation percentage before trusting
any Bot-3-style setup, and treating a genuine bot-generated loss
inside that window as a valid one. Bad: Trading an FVG that "looks
similar" without confirming its actual mitigation percentage falls
inside the real eligible window.

### What to Look Out For

- The most common Bot-3-specific bad-loss pattern is trading a gap
  outside the real 30-70% mitigation window — either too fresh or too
  filled.
- A genuine, bot-generated Bot 3 signal that loses is a valid loss by
  construction, same as Bot 1 and Bot 2.
- Unlike Bot 1 (CHoCH-for-BOS) and Bot 2 (soft signal treated as
  hard gate), Bot 3's characteristic mistake is specific to its
  numeric eligibility window.

### Common Mistakes

Judging FVG eligibility by how "clean" or visually appealing a gap
looks, rather than checking its actual computed mitigation percentage
against the real 30-70% window, is the single most consequential
mistake for this bot specifically.

### Key Takeaways

1. A genuine, bot-generated Bot 3 signal that loses is a valid loss by
   construction — both real gates were already enforced.
2. The most common Bot-3-specific bad loss comes from trading an FVG
   outside the real 30-70% mitigation window.
3. Each bot in this platform has its own characteristic bad-loss
   pattern, tied to its own specific mechanics — not a generic list.

### Practice Drill

Given five losing-trade case studies styled after Bot 3 (provided in
Practise), determine which are valid losses and which are bad losses,
checking the actual mitigation percentage in each case.

### Scenario Challenge

A trader's manually-placed "Bot 3 style" trade loses. On review, the
FVG they traded was only 18% mitigated at entry. Using this lesson's
vocabulary, classify this loss and explain the specific gate that was
never actually satisfied.

### Mini Quiz

Q1 (True/False): Any FVG that shows some retracement is a valid Bot 3
candidate.
Answer: False — Bot 3 requires the mitigation percentage to fall
specifically between 30% and 70%; any amount of retracement outside
that window is ineligible.

Q2 (Multiple choice): What's the most common Bot-3-specific pattern
behind a bad loss?
(a) Using too wide a stop
(b) Trading an FVG outside the real 30-70% mitigation window
(c) Targeting too low an R:R
(d) Ignoring the 15M BOS check entirely

Answer: (b).

### Flashcards

- Front: Is a losing, genuinely bot-generated Bot 3 signal a valid or
  bad loss? Back: Valid — both real gates (BOT3-05) were already
  enforced by construction.
- Front: What's the most common Bot-3-specific bad-loss pattern?
  Back: Trading an FVG outside the real 30-70% mitigation window —
  either too fresh or too filled.

### Reflection

Across Bot 1, Bot 2, and Bot 3, each has its own characteristic
bad-loss pattern tied to its own specific mechanics. What does that
suggest about the value of knowing each bot's real logic in enough
detail to catch ITS specific failure mode, rather than one generic
checklist for all five?

### Mastery Criteria

Correctly classify all five practice-drill loss case studies.

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — applies C9-02's model with full
Bot 3-specific precision, completing the three-bot comparison started
in BOT1-08 and BOT2-08.

### Bot Connection

Grounded in the fact that `FVGExpansionBot.analyze()` only ever
returns a complete signal or `None`, with the mitigation-window test
verified directly against `bot_strategies.py`.

---

## BOT3-09 — Practice: Running the Full Pipeline by Hand

**Level:** 4
**Estimated study time:** 15 minutes
**Prerequisites:** BOT3-01 through BOT3-08
**Learning objectives:** Apply every real stage of Bot 3's pipeline,
in order, to one continuous scenario.

### Why This Matters

Same discipline as BOT1-09 and BOT2-09, applied to Bot 3's shorter but
still genuinely distinct real pipeline — including its hand-calculated
entry and stop, which neither of the other two bots uses.

### Core Teaching

**Plain-English explanation.** Given a full 1H+15M scenario, work
through Bot 3's pipeline in order: find the eligible 1H FVG within
the 30-70% mitigation window (BOT3-02), confirm the matching 15M BOS
(BOT3-03), calculate the direct midpoint entry (BOT3-04/06), and
calculate the proportional 10%-of-gap stop and 4:1 TP2 target
(BOT3-07).

**Technical explanation.** This exercise mirrors
`FVGExpansionBot.analyze()`'s real, shorter control flow — two gates
instead of three or four, and two hand-calculated values (entry, stop)
instead of shared-engine calls. The exercise deliberately requires
computing the mitigation percentage and the 10%-of-gap-size buffer by
hand, not estimating them, since both are genuinely proportional
calculations specific to each individual FVG's own size.

### Visual Model

See diagram: `visuals/bot3-09-full-pipeline-worksheet.svg` — a
five-row worksheet (eligible FVG -> BOS match -> direction/entry ->
stop -> TP2/sizing) mirroring `analyze()`'s real, shorter step
sequence.

### Worked Example

A full worked scenario (provided in Practise) walks a 1H chart with
one FVG at 55% mitigation, ACTIVE, matched by a 15M bullish BOS,
ending with the exact entry, stop, and TP2 numbers Bot 3's real code
would compute for that data.

### Counterexample

A trader completes the exercise but uses a fixed pip buffer for the
stop instead of calculating exactly 10% of the specific FVG's own
size — their final stop price doesn't match what Bot 3's real,
proportional calculation would produce.

### Good Example / Bad Example

Good: Calculating the mitigation percentage and the stop buffer as
genuine proportions of the specific FVG's own size, not estimated or
fixed values. Bad: Using a fixed pip distance for the stop, or
skipping the mitigation-percentage check entirely.

### What to Look Out For

- The mitigation percentage and the stop buffer are both genuine
  proportional calculations, specific to each individual FVG's size —
  not fixed values.
- Bot 3's pipeline is shorter (two gates, two hand-calculated values)
  than Bot 1's or Bot 2's — don't add extra steps that don't exist.
- Every number produced should trace back to a specific real value
  from the given FVG's top and bottom prices.

### Common Mistakes

Using a fixed or estimated buffer instead of genuinely calculating 10%
of the specific FVG's own size is the most common shortcut this
lesson exists to catch.

### Key Takeaways

1. Bot 3's full pipeline is shorter than Bot 1's or Bot 2's — two
   gates, two hand-calculated values (entry, stop).
2. Both the mitigation percentage and the stop buffer are genuine
   proportional calculations specific to each FVG's own size.
3. This exercise rehearses the exact same "reproduce the real code,
   don't approximate it" discipline as BOT1-09 and BOT2-09.

### Practice Drill

Given a full chart scenario (provided in Practise) with 1H and 15M
data, work through the complete pipeline to produce the exact entry
price, stop price, and TP2 target Bot 3's code would output.

### Scenario Challenge

Given two scenarios (provided in Practise), one where the pipeline
should produce a real signal and one where it should return `None` at
a specific gate, correctly work through both.

### Mini Quiz

Q1 (True/False): Bot 3's stop buffer is the same fixed distance
regardless of the FVG's size.
Answer: False — it's exactly 10% of that specific FVG's own
top-to-bottom size, genuinely proportional, not fixed.

Q2 (Multiple choice): How many real gates does this exercise need to
check, at most?
(a) One
(b) Two
(c) Three
(d) Four

Answer: (b).

### Flashcards

- Front: How many real gates does Bot 3's pipeline have? Back: Two —
  eligible FVG found, and matching 15M BOS found.
- Front: What two values in Bot 3's pipeline are hand-calculated
  rather than using a shared engine call? Back: The entry price
  (FVG midpoint) and the stop price (10% of FVG size beyond the
  extreme).

### Mastery Criteria

Correctly produce the exact entry, stop, and TP2 target for the
practice-drill scenario, and correctly identify the failing gate in
the `None`-producing scenario.

### Reflection

Having now worked through all three bots' full pipelines by hand
(BOT1-09, BOT2-09, BOT3-09), which bot's real logic surprised you most
compared to what you'd have assumed from its name or general SMC
description alone?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this exercise is the direct
rehearsal for BOT3-10's capstone.

### Bot Connection

This lesson's worksheet is a literal step-by-step reproduction of
`FVGExpansionBot.analyze()`'s real control flow — no step here exists
that isn't a real line of code in `bot_strategies.py`.

---

## BOT3-10 — Capstone: Full Bot 3 Decision Simulation

**Level:** 4
**Estimated study time:** 17 minutes
**Prerequisites:** BOT3-01 through BOT3-09
**Learning objectives:** Given raw multi-timeframe chart data, produce
the complete Bot 3 decision — full signal or correctly-identified
`None` with the specific failing gate.

### Why This Matters

This capstone is the practical payoff of the entire BOT3 track —
producing Bot 3's complete, real decision from raw data, including
correctly identifying when its docstring's aspirational "trailing"
behavior does NOT apply, since it isn't actually implemented.

### Core Teaching

**Plain-English explanation.** Given raw 1H and 15M candle data, work
the entire pipeline from scratch: detect 1H FVGs and their mitigation
percentages, find one in the 30-70% ACTIVE window, detect a matching
15M BOS, calculate the direct midpoint entry, calculate the 10%-of-gap
stop, and produce the final 4:1 TP2 target and 0.82 confidence — or
correctly stop at whichever of the two BOT3-05 gates fails.

**Technical explanation.** This exercise mirrors
`BotOrchestrator.run_all()`'s real invocation of
`FVGExpansionBot.analyze()` — called only when `market_data` contains
both `"1H"` and `"15M"`. A correct capstone answer matches every field
of the real `BotSignal` (confidence is a FIXED `0.82` for this bot,
unlike Bot 2's conditional value — verify this doesn't vary) or a
precise `None` with the specific failing gate.

### Visual Model

See diagram: `visuals/bot3-10-capstone-flow.svg` — the complete,
unbroken pipeline from raw 1H/15M candle data through every BOT3-01
through BOT3-09 stage to a final signal-or-None outcome.

### Worked Example

A full capstone scenario (provided in Practise) supplies raw 1H and
15M data. Working the complete pipeline: one 1H FVG at 62% mitigation,
ACTIVE, a matching bearish 15M BOS, producing a short entry at the FVG
midpoint, a stop 10% of the gap's size beyond its top, and a 4:1 TP2
target at 0.82 confidence — matching what `FVGExpansionBot.analyze()`
would output for this exact data.

### Counterexample

A different capstone scenario supplies raw data where a 1H FVG exists
but is only 22% mitigated — below the eligibility floor. The correct
capstone answer is an explicit `None` at the mitigation-window gate
(BOT3-05), regardless of how clean or fresh the gap otherwise looks.

### Good Example / Bad Example

Good: Working the complete pipeline from raw data, correctly
calculating the real mitigation percentage before judging eligibility,
and answering `None` with the specific gate when that's correct. Bad:
Assuming a fresh-looking gap is automatically eligible without
calculating its actual mitigation percentage.

### What to Look Out For

- A correct `None` answer, with the specific gate identified, is just
  as complete a capstone answer as a full signal.
- Confidence for Bot 3 is a FIXED 0.82 whenever a signal fires — it
  doesn't vary the way Bot 2's does.
- Do not invent a "trailing stop" behavior in the capstone answer —
  BOT3-07 already confirmed this isn't implemented in the real code.

### Common Mistakes

At this capstone level, describing an imagined "trailing stop"
adjustment as part of the final answer — because the docstring
mentions it — is the most consequential mistake, directly contradicting
BOT3-07's confirmed finding that no such logic exists in the real code.

### Key Takeaways

1. The capstone works Bot 3's complete pipeline from raw candle data
   — nothing pre-identified.
2. A correctly-identified `None`, with the specific failing gate, is
   just as valid a capstone answer as a complete signal.
3. Confidence is fixed at 0.82 for every real Bot 3 signal — and no
   trailing-stop behavior should appear in a correct capstone answer.

### Practice Drill

Given three raw multi-timeframe scenarios (provided in Practise, at
least one producing `None`), work the complete Bot 3 pipeline for each.

### Scenario Challenge

Given a raw scenario where a 1H FVG is 71% mitigated — just outside
the eligible window — produce the complete, correct pipeline output,
including exactly why this single percentage point matters.

### Mini Quiz

Q1 (True/False): A correct capstone answer for Bot 3 should describe
how the stop trails as new BOS events form.
Answer: False — no trailing logic exists anywhere in the real
`analyze()` function (BOT3-07); a correct answer is a single static
signal.

Q2 (Multiple choice): What confidence value does a real, firing Bot 3
signal always report?
(a) A value that varies with mitigation percentage
(b) A fixed 0.82
(c) A value that varies with stop distance
(d) 1.0

Answer: (b).

### Flashcards

- Front: What raw inputs does this capstone start from? Back: Raw 1H
  and 15M candle data — no FVGs, mitigation percentages, or BOS
  events pre-identified.
- Front: Should a correct capstone answer include stop-trailing
  behavior? Back: No — BOT3-07 confirmed this isn't implemented in
  the real `analyze()` function; a correct answer is one static signal.

### Mastery Criteria

Produce the complete, correct pipeline output for all three
practice-drill scenarios, with no invented trailing behavior.

### Reflection

Across this entire track, which lesson (the mitigation window,
BOT3-02, or the docstring-vs-code gap, BOT3-07) did the most to change
how carefully you'd read a bot's stated intent versus its actual
implementation going forward?

### Spaced Review

Day 1, Day 3, Day 7, Day 14, Day 30 — this capstone completes the
three-bot comparison begun in BOT1-10 and BOT2-10, and is the direct
template for BOT4 and BOT5's own capstones.

### Bot Connection

This capstone reproduces `BotOrchestrator.run_all()`'s real "Bot 3:
Needs 1H + 15M" invocation of `FVGExpansionBot.analyze()` in full —
every real step, gate, and output, verified directly against
`bot_strategies.py`, including the confirmed absence of any trailing
logic despite the class docstring's description of it.
