# CORE 1 — MARKET BASICS

---

## C1-01 — What a Market Is: Buyers, Sellers, Price, Bid/Ask, Spread

**Level:** 0
**Estimated study time:** 15 minutes
**Prerequisites:** ORIENT-01, ORIENT-02
**Learning objectives:** Explain what determines price movement, read a
bid/ask quote, and calculate spread cost on a real instrument.

### Why This Matters

Every concept you'll learn later — liquidity, order blocks, sweeps —
is ultimately a story about buyers and sellers disagreeing on price.
If the mechanics of price formation aren't solid, the more advanced
concepts become memorized shapes rather than understood behavior.

### Core Teaching

**Plain-English explanation.** A market is just a continuous
negotiation. At every moment, some people want to buy and some want to
sell, and price is wherever the two sides currently agree to trade.
When more people want to buy urgently than sell, price rises to find
sellers willing to let go at a higher level. When more people want to
sell urgently than buy, price falls to find buyers willing to step in
lower. Price is not decided by any single actor — it's the visible
result of that ongoing negotiation.

**Technical explanation.** Every tradable instrument has two live
prices, not one: the bid (the highest price a buyer is currently
willing to pay) and the ask or offer (the lowest price a seller is
currently willing to accept). The spread is the difference between
them. If EUR/USD shows a bid of 1.0900 and an ask of 1.0902, the spread
is 0.0002, or 2 pips. If you buy right now, you buy at the ask
(1.0902); if you sell right now, you sell at the bid (1.0900). This
means you are down 2 pips the instant you open a position, before
price has moved at all — spread is a real, guaranteed cost of trading,
not a theoretical one. This matters directly for later lessons: the
platform's engine explicitly requires spread checks before submitting
any order, and a 3:1 reward-to-risk plan on paper does not survive
contact with reality if spread and slippage aren't accounted for in
the actual numbers.

**Liquidity, briefly** (expanded fully in Core 3): liquidity refers to
how easily an instrument can be bought or sold without moving price
much. A highly liquid instrument (major FX pairs, large-cap crypto) has
narrow spreads and can absorb large orders with little price impact. A
thin, illiquid instrument has wide spreads and large price swings on
small orders — a critical difference when position-sizing later.

### Visual Model

See diagram: `visuals/c1-01-bid-ask.svg` — labeled price ladder showing
bid, ask, and the spread gap between them, with a worked "new position
is underwater immediately" annotation.

### Worked Example

You want to buy Gold (XAU/USD). The quote shows bid 2400.10, ask
2400.60 — a 50-cent spread. You buy at 2400.60. If price does not move
at all and you close immediately, you sell back at the bid, 2400.10 —
a 50-cent loss per unit, purely from spread, with no market movement
involved. This is why a spread check exists before letting a trade
through: on a wide-spread instrument, spread alone can consume a
meaningful chunk of a tight stop's total risk budget.

### Counterexample

A beginner assumes "the price" is one number and is confused when
their P&L shows a small loss the instant they enter a trade with no
adverse price movement. The instrument didn't do anything wrong — the
bid/ask spread was never accounted for in their mental model.

### Good Example / Bad Example

Good: Before sizing a trade on a wider-spread instrument, checking what
the current spread is as a fraction of your intended stop distance —
if spread is 10% of your stop distance, that's a meaningful, real cost
eating into your reward-to-risk before the trade even starts.
Bad: Assuming spread is negligible on every instrument and every
timeframe. On a 15-minute scalp with a tight stop, a spread that would
be trivial on a daily swing trade can be a large percentage of total
risk.

### What to Look Out For

- Spread widens during major news events and outside main trading
  sessions — a spread check done once at the start of the day is not
  valid all day.
- A tight stop-loss on a wide-spread instrument can mean spread alone
  is a significant fraction of your total risk — always check, don't
  assume.
- "Price" as shown on a simple chart is usually the last trade price
  or midpoint — it is not the price you'll actually get filled at.

### Common Mistakes

Treating spread as a rounding error rather than a real, calculable
cost that should factor into position sizing and reward-to-risk math,
especially on shorter timeframes and less liquid instruments.

### Key Takeaways

1. Price exists because buyers and sellers disagree — it's a
   negotiation outcome, not a fixed number.
2. Every instrument has a bid and an ask; the gap between them, the
   spread, is a real trading cost paid on every entry and exit.
3. Spread cost matters more, proportionally, on tight-stop, short-
   timeframe trades than on wide-stop swing trades.

### Practice Drill

Given five live-style quotes (provided), calculate the spread in both
raw price terms and as a percentage of a hypothetical 20-pip stop for
each. Rank them from least to most spread-impacted.

### Scenario Challenge

You're comparing two setups with identical structure and identical 2%
risk: one on a major FX pair with a 1-pip spread, one on an exotic
pair with a 15-pip spread, both using a 30-pip stop. What's different
about the real risk profile of these two trades even though the
percentage risk is identical?

### Mini Quiz

Q1: If bid = 1.2500 and ask = 1.2504, what is the spread in pips (for
a 4-decimal pair)?
Answer: 4 pips.

Q2 (True/False): Buying and immediately selling at the exact same
quoted "price," with zero market movement, always breaks even.
Answer: False — you buy at the ask and sell at the bid, so you lose
the spread even with zero price movement.

### Flashcards

- Front: What is spread? Back: The difference between the bid (what
  buyers pay) and ask (what sellers accept) — a real, immediate cost
  paid on every trade entry.
- Front: Why does spread matter more on short-timeframe trades? Back:
  Because tighter stops mean spread is a larger percentage of total
  planned risk.

### Reflection

Think of a time you were surprised by a small loss right after opening
a position. Could spread explain part of it?

### Mastery Criteria

Correctly calculate spread-as-percentage-of-stop for all five drill
quotes and correctly rank them by impact.

### Spaced Review

Day 1, Day 7 — resurfaces directly in Core 8 (Risk Management) when
calculating true expected cost of a trade plan, and in C1-04
(Liquidity) immediately following.

### Bot Connection

Every bot's execution layer explicitly checks spread before allowing a
trade through. This isn't incidental engineering — it's this lesson,
encoded as a rule.

---

## C1-02 — Candlestick Anatomy: Open, High, Low, Close, Body, Wick

**Level:** 0
**Estimated study time:** 15 minutes
**Prerequisites:** C1-01
**Learning objectives:** Correctly identify every component of a
candlestick and state what each one tells you about the underlying
buy/sell battle during that period.

### Why This Matters

Every pattern taught later — swings, BOS, CHoCH, order blocks, FVGs —
is built entirely out of candlestick relationships. If you can't read
a single candle precisely, you can't reliably read the patterns made
of many candles.

### Core Teaching

**Plain-English explanation.** A candlestick is a snapshot of a fixed
time period's price battle — one hour, one day, whatever timeframe
you've selected. It answers four questions about that period: where
did price start, where did it end, and how far did it stretch in each
direction along the way.

**Technical explanation.** Each candle has four defining prices:

- Open — the first traded price of the period.
- High — the highest traded price during the period.
- Low — the lowest traded price during the period.
- Close — the last traded price of the period.

The body is the thick rectangle between the open and the close — it
shows the net result of the period's battle. The wick (or shadow) is
the thin line extending above and/or below the body to the high and
low — it shows how far price traveled before being pushed back, i.e.
rejected. A candle where close > open is typically shown as bullish
(often green or white); close < open is bearish (often red or black).

This distinction between body and wick matters immensely once you
reach Break of Structure in Core 2: the platform's engine explicitly
supports multiple confirmation modes for a structural break — a wick
poking through a level is treated completely differently from a body
closing through it. A wick-only break is labeled a sweep candidate,
not a confirmed break — this single distinction (body close vs. wick)
is one of the most load-bearing technical facts in the entire course,
and it starts here, at the level of a single candle.

### Visual Model

See diagram: `visuals/c1-02-candle-anatomy.svg` — a labeled bullish and
bearish candle pair with body, upper wick, and lower wick all annotated
with arrows.

### Worked Example

A 1-hour candle opens at 1.1000, trades up to 1.1030, sells back down
to 1.0980, then closes at 1.1010. Open: 1.1000. High: 1.1030. Low:
1.0980. Close: 1.1010. Since close (1.1010) > open (1.1000), this is a
bullish candle. The body spans 1.1000-1.1010 (small — the net move was
modest). The upper wick spans 1.1010-1.1030 (buyers pushed higher but
couldn't hold it). The lower wick spans 1.0980-1.1000 (sellers pushed
lower but buyers stepped back in). The full range (1.0980-1.1030, 50
pips) tells a far more volatile story than the small bullish body
alone would suggest.

### Counterexample

A beginner sees a candle with a small bullish body and assumes "not
much happened" during that period, missing that the long wicks above
and below show real (and potentially important) rejection at both
extremes — the body alone doesn't tell the whole story.

### Good Example / Bad Example

Good: Reading the full candle — body AND both wicks — before
concluding anything about what happened during that period.
Bad: Only glancing at candle color/body direction and ignoring wick
length, which often carries the more important information about
rejection and failed attempts at continuation.

### What to Look Out For

- A long wick shows rejection — but rejection from what, and why,
  requires the context taught in Core 2 and Core 3. Don't over-interpret
  a single wick in isolation yet.
- Candle color conventions (green/red, white/black) vary by platform —
  always confirm which color means bullish vs. bearish on your specific
  charting tool before reading anything.
- An "unclosed" candle (the current, still-forming one) can and will
  change shape before it closes — never treat a live, in-progress
  candle as a finished piece of information. The platform's own swing
  and structure detection explicitly refuses to use unclosed candles
  for this reason.

### Common Mistakes

Reading only the candle's color and ignoring wick length and
proportion entirely — missing half the information a single candle
actually contains.

### Key Takeaways

1. A candle encodes four prices: open, high, low, close.
2. Body = net result (open to close). Wick = the extremes reached and
   rejected from along the way.
3. The body-vs-wick distinction becomes critical later for
   distinguishing a confirmed structural break from a mere sweep
   candidate — this lesson is the foundation for that.

### Practice Drill

Given ten raw OHLC data rows (provided, no chart image), manually
determine for each: bullish or bearish, body size, upper wick size,
lower wick size, and total range.

### Scenario Challenge

Two candles have identical open and close prices (identical bodies)
but one has almost no wicks and the other has wicks three times the
size of its body. What does the second candle's shape suggest about
the volatility and disagreement during that period, even though the
"net result" looks the same on both?

### Mini Quiz

Q1: A candle opens at 100, closes at 95. Is it bullish or bearish?
Answer: Bearish (close < open).

Q2 (True/False): The body of a candle always shows the full price
range traded during that period.
Answer: False — the body only shows open-to-close; the full range
includes the wicks out to the high and low.

### Flashcards

- Front: What does the body of a candle represent? Back: The net
  result of the period — the distance from open to close.
- Front: What does a wick represent? Back: Price that was reached
  during the period but not held — rejected before the close.

### Reflection

Pull up any chart you have access to and find one candle with an
unusually long wick relative to its body. Before reading further
lessons, just describe in your own words what you think might have
happened during that period.

### Mastery Criteria

100% accuracy identifying bullish/bearish direction and correct
body/wick measurements across all ten practice drill rows.

### Spaced Review

Day 1, Day 3, Day 7 — every subsequent Core 2 lesson (swings, BOS,
CHoCH) directly depends on precise body/wick reading.

### Bot Connection

The platform's Break of Structure confirmation modes (Wick / Close /
Body-buffer / Two-close, detailed in Core 2) are all just different,
more rigorous versions of the body-vs-wick distinction taught in this
lesson.

---

## C1-03 — Bullish and Bearish Candles, Momentum, Expansion and Contraction

**Level:** 0
**Estimated study time:** 15 minutes
**Prerequisites:** C1-02
**Learning objectives:** Distinguish strong-momentum candles from weak
ones, and recognize expansion vs. contraction phases across a short
sequence of candles.

### Why This Matters

"Displacement" — a term used constantly from Core 2 onward, and a
required condition in every single bot's signal rules — is really just
a precise, measurable version of "a strong momentum candle." This
lesson builds the intuition that later gets formalized into an exact
rule.

### Core Teaching

**Plain-English explanation.** Not all bullish candles are equally
bullish. A candle that closes only slightly above its open, with long
wicks on both sides, shows a weak, contested move. A candle that opens
near its low and closes near its high, with a large body and small
wicks, shows strong, one-sided momentum — buyers were in control for
almost the entire period with little resistance. The same logic applies
in reverse for bearish candles.

**Technical explanation — momentum and displacement.** The platform's
engine formalizes "strong momentum" using two measurable properties:
body size relative to recent volatility (measured via ATR, Average
True Range), and where the close falls within the candle's total range
— called the close-location value. A genuine displacement candle, as
used in the platform's actual bullish-sweep detection logic, requires
close > open, a body size at least some multiple of ATR, AND a
close-location value of 0.7 or higher — meaning the close sits in the
top 30% of the candle's total range. All three conditions together,
not any one alone, define genuine displacement. A large body with a
close near the middle of its range is not displacement by this
definition, because it shows the move was not sustained into the
close.

**Expansion vs. contraction.** Across a sequence of several candles,
markets alternate between expansion (larger ranges, decisive directional
moves, momentum candles appearing) and contraction (smaller ranges,
indecisive candles, price coiling in a tight band). Recognizing which
phase you're in matters enormously for every bot: several of the five
bots explicitly require displacement (an expansion event) as a
precondition, and contraction phases are where "no-trade" conditions
are most often correctly triggered.

### Visual Model

See diagram: `visuals/c1-03-expansion-contraction.svg` — a 12-candle
sequence showing contraction, a displacement candle, then expansion,
each phase clearly bracketed and labeled.

### Worked Example

Price has been coiling in a 20-pip range for several hours (contraction
— many small, overlapping candles). Then a candle appears that opens at
the bottom of that range, closes near the top, with a body several
times the size of the recent average candle, and almost no wicks. This
qualifies as a displacement candle under the platform's actual
detection logic: large body relative to ATR, close-location value near
1.0. This is the kind of candle several bots require to see before
treating a reversal or continuation signal as valid.

### Counterexample

A candle has a large total range (high to low) but closes almost
exactly back at its open, with long wicks on both sides. Despite the
large range, this is NOT displacement — the close-location value is
near 0.5, meaning neither side actually won by the close. Range alone,
without a decisive close location, is not momentum.

### Good Example / Bad Example

Good: Checking both body-size-relative-to-ATR AND close-location
before calling something a genuine displacement candle.
Bad: Calling any large-range candle "displacement" just because it
looks dramatic on the chart, without checking where it actually closed
within that range.

### What to Look Out For

- A big range is not the same as displacement — the close location
  matters just as much as the size.
- Displacement is relative to recent volatility (ATR), not an absolute
  pip count — what counts as a big candle on a quiet instrument is
  different from a naturally volatile one.
- Contraction phases can persist far longer than feels comfortable —
  the temptation to force a trade during a genuinely quiet, coiling
  market is one of the most common sources of low-quality setups.

### Common Mistakes

Treating any visually large candle as automatically significant,
without checking the close-location value — a wide-ranging but
indecisive candle (long wicks both sides, close near the middle) is
routinely mistaken for a strong momentum move by beginners.

### Key Takeaways

1. Momentum is a function of both size (relative to recent volatility)
   and where the candle actually closed within its range.
2. Genuine displacement requires body size AND close-location together
   — neither alone is sufficient.
3. Markets alternate between contraction (coiling) and expansion
   (displacement + follow-through) — recognizing which phase you're in
   is a precondition for correctly applying almost every later concept.

### Practice Drill

Given fifteen consecutive candles' OHLC data, calculate close-location
value for each and identify which ones would qualify as displacement
candles under the platform's actual formula (body >= ATR times
multiplier AND close-location >= 0.7 for bullish, mirrored for
bearish).

### Scenario Challenge

You see a large-range candle that everyone in a trading chat is
excited about, calling it "huge momentum." You calculate its
close-location value and find it's 0.45. What would you tell them, and
why does the size of the range not settle the question on its own?

### Mini Quiz

Q1: What two properties together define a genuine displacement candle
in this framework?
Answer: Body size relative to recent volatility (ATR) AND
close-location value near the extreme of the candle's range (e.g.
>= 0.7 for bullish).

Q2 (True/False): A candle with a very large high-to-low range is
always a displacement candle.
Answer: False — range alone is not sufficient; the close must also
be near the extreme of that range, not the middle.

### Flashcards

- Front: What is close-location value? Back: A measure of where a
  candle's close falls within its total high-low range — near 1.0 means
  it closed near the high, near 0.0 means near the low, near 0.5 means
  it closed in the middle.
- Front: What two conditions define displacement in this platform's
  actual detection logic? Back: Body size at least some ATR multiple,
  AND close-location value at or above roughly 0.7 (bullish) or at or
  below roughly 0.3 (bearish).

### Reflection

Recall a time you got excited about a "huge" candle that then
completely reversed the next period. Could close-location value have
warned you?

### Mastery Criteria

Correctly calculate close-location value for all fifteen drill candles
and correctly flag which qualify as genuine displacement.

### Spaced Review

Day 1, Day 3, Day 7, Day 14 — displacement is a required condition in
Bot 2, Bot 3, and Bot 5's signal rules explicitly, and appears
implicitly in all five.

### Bot Connection

Bot 3 (Imbalance Expansion) is built almost entirely around correctly
identifying displacement: its very first signal rule requires a
higher-timeframe BOS confirming direction, and its second requires
displacement to create an FVG above minimum ATR size — this lesson is
the literal prerequisite for reading that rule correctly.

---

## C1-04 — Liquidity and Volatility: First Look

**Level:** 0
**Estimated study time:** 14 minutes
**Prerequisites:** C1-01, C1-03
**Learning objectives:** Define liquidity and volatility as distinct
properties, explain why a market can be liquid but not volatile (or
volatile but not liquid), and identify the practical trading
consequences of each.

### Why This Matters

Liquidity and volatility get used almost interchangeably in casual
trading talk, but they measure genuinely different things and have
different practical consequences for spread, slippage, and position
sizing. Confusing them leads to mis-set expectations — for example,
assuming a highly liquid instrument is automatically "safe," when
liquidity says nothing about how much price actually moves.

### Core Teaching

**Plain-English explanation.** Liquidity is about how easily you can
get in and out of a position without moving price against yourself —
how many willing buyers and sellers are actively present. Volatility is
about how much price actually moves over a given period, regardless of
how easy it was to trade. A market can be extremely liquid (tight
spreads, huge order flow) and still calm (small price swings), or
liquid and violently volatile at the same time — these are two
independent dials, not one.

**Technical explanation.** Liquidity is commonly estimated from bid/ask
spread and traded volume: tight spreads and high volume indicate deep
liquidity; wide spreads and thin volume indicate shallow liquidity.
Volatility is commonly measured with tools like Average True Range
(ATR), which averages the true range (accounting for gaps) of recent
candles to give a single number representing typical price movement
per period. A major FX pair during a quiet Asian session can be highly
liquid (tight spread) with low ATR (small typical range) — liquid but
low-volatility. The same pair during a major news release can spike to
very high ATR while spreads simultaneously widen — a combination of
rising volatility and temporarily thinning liquidity that produces the
worst slippage conditions.

### Visual Model

See diagram: `visuals/c1-04-liquidity-volatility-grid.svg` — a
two-axis grid, Liquidity (low to high) on one axis, Volatility (low to
high) on the other, with example market conditions plotted in each of
the four quadrants (e.g., "quiet major FX session" in high-liquidity/
low-volatility; "news-release spike" in temporarily-lower-liquidity/
high-volatility).

### Worked Example

EUR/USD during the London/New York overlap typically shows tight
spreads (deep liquidity) and moderate, tradable ATR (moderate
volatility) — generally considered favorable trading conditions. The
same pair during a surprise central bank rate announcement can show
both a spike in ATR and a simultaneous widening of spread as market
makers pull back — high volatility paired with temporarily reduced
liquidity, a combination that increases slippage risk sharply.

### Counterexample

A trader assumes that because an instrument is "known to be liquid"
(a major crypto pair, say), it's automatically safe to trade any
position size at any time. During a sudden liquidation cascade, spread
can widen and slippage can spike sharply even on a normally
deep-liquidity instrument — liquidity is a general tendency, not a
guarantee that holds under every condition.

### Good Example / Bad Example

Good: Checking both current spread AND current ATR (or a volatility
indicator) before sizing a trade, especially around scheduled news
events. Bad: Treating "this instrument is usually liquid" as a
permanent, unconditional fact rather than a normal condition that can
temporarily break down around news or thin-session hours.

### What to Look Out For

- Liquidity and volatility can move independently — check both, not
  just one.
- Liquidity often drops sharply exactly when volatility spikes (major
  news, low-volume hours) — the worst possible combination for
  slippage.
- "This is normally a liquid market" is a statement about typical
  conditions, not a guarantee for right now.

### Common Mistakes

Beginners often use "volatile" and "risky" as if they were the same
word, or "liquid" and "safe." Both conflations skip over the actual
mechanism: volatility measures movement, liquidity measures ease of
execution, and risk depends on how your position size interacts with
both, not on either property alone.

### Key Takeaways

1. Liquidity measures ease of entry/exit without moving price;
   volatility measures how much price actually moves.
2. The two are independent — a market can be liquid and calm, liquid
   and volatile, thin and calm, or thin and volatile.
3. Liquidity frequently thins exactly when volatility spikes (news
   events), which is when slippage risk is highest.

### Practice Drill

Given five short instrument/session descriptions (provided in
Practise), classify each into one of the four liquidity/volatility
quadrants and justify your classification in one sentence.

### Scenario Challenge

A major economic release is scheduled in ten minutes on an instrument
you were planning to trade. Using this lesson's vocabulary, what two
things should you expect to change in the minutes around the release,
and how should that change your plan?

### Mini Quiz

Q1 (True/False): A highly liquid instrument is always low-volatility.
Answer: False — liquidity and volatility are independent properties.

Q2 (Multiple choice): What commonly happens to liquidity during a
major, surprise news release?
(a) It typically increases sharply
(b) It's unaffected by news
(c) It often thins temporarily, even on normally liquid instruments
(d) It only affects illiquid instruments

Answer: (c). Spreads often widen and depth thins right around
high-impact news, even on instruments that are normally deep.

### Flashcards

- Front: Liquidity vs. volatility — what's the difference? Back:
  Liquidity measures how easily you can trade without moving price;
  volatility measures how much price actually moves. They're
  independent.
- Front: What commonly happens to liquidity right around major news
  events? Back: It often thins temporarily, even on normally
  deep-liquidity instruments, which combines badly with the volatility
  spike that also occurs.

### Reflection

Have you ever been surprised by slippage or a wide spread during a
news event on an instrument you considered "always liquid"? What would
checking both dials in advance have told you?

### Mastery Criteria

Correctly classify all five practice-drill scenarios into the correct
liquidity/volatility quadrant with valid justification.

### Spaced Review

Day 1, Day 7, Day 21 — this distinction resurfaces directly in Core 8's
lesson on leverage, margin, spread, slippage, and fees.

### Bot Connection

Every bot's risk engine checks both current spread and a volatility
measure before allowing an order through — this lesson is the
conceptual basis for why that dual check exists rather than relying on
just one signal.

---

## C1-05 — Timeframes and Chart Navigation

**Level:** 0
**Estimated study time:** 13 minutes
**Prerequisites:** C1-02
**Learning objectives:** Explain what a timeframe represents, describe
the tradeoffs between higher and lower timeframes, and correctly
navigate a multi-timeframe chart setup.

### Why This Matters

Nearly every concept from Core 2 onward (structure, liquidity, zones)
is defined relative to a specific timeframe — a "swing high" on a
1-hour chart and a "swing high" on a 1-minute chart are not the same
event. Without a solid grasp of what a timeframe actually represents
and how timeframes relate to each other, later multi-timeframe
analysis (Core 7) will feel arbitrary rather than logical.

### Core Teaching

**Plain-English explanation.** A timeframe is simply the amount of
price action compressed into one candle. A 1-hour candle summarizes
everything that happened to price during that hour into a single open,
high, low, close. A 1-minute candle does the same for just one minute.
Higher timeframes (Daily, 4H, 1H) show the big picture with less noise
but react slowly; lower timeframes (15m, 5m, 1m) show fine detail and
react quickly but contain far more noise — much of what looks like a
meaningful move on a 1-minute chart is invisible on a Daily chart.

**Technical explanation.** Every higher-timeframe candle is built from
many lower-timeframe candles — a single 4H candle is composed of
sixteen 15-minute candles, for example. This nesting relationship is
exactly why multi-timeframe analysis works: a pattern on a higher
timeframe (say, a 4H order block) has real internal structure visible
only by dropping to a lower timeframe (a 15-minute chart) to find a
precise entry within that broader zone. This is the basis of Core 7's
five-layer timeframe stack — different timeframes are used for
different jobs (macro bias, direction, opportunity, trigger, execution)
specifically because no single timeframe does all of those jobs well.

### Visual Model

See diagram: `visuals/c1-05-timeframe-nesting.svg` — a single 4H
candle shown expanded into the sixteen 15-minute candles that compose
it, demonstrating that higher-timeframe structure is not a different
kind of price action, just a different resolution of the same price
action.

### Worked Example

A trader identifies a strong bullish 4H order block. Rather than
entering blindly at the top of that 4H zone, they drop to the
15-minute chart, wait for price to enter the zone, and look for a
15-minute market structure shift (a small CHoCH) before entering — the
higher timeframe supplied the zone, the lower timeframe supplied
entry precision.

### Counterexample

A trader analyzes a setup entirely on a 1-minute chart with no
reference to any higher timeframe, then wonders why a "clean-looking"
pattern immediately fails. The 1-minute chart alone has no way of
showing that price is approaching a major Daily resistance level — the
zoomed-in view was missing essential context only a higher timeframe
provides.

### Good Example / Bad Example

Good: Establishing directional bias and key zones on a higher
timeframe first, then using a lower timeframe only to refine entry
timing within that established context. Bad: Picking whichever
timeframe currently shows the most exciting-looking pattern with no
consistent top-down process.

### What to Look Out For

- A pattern that looks compelling on a low timeframe can be
  meaningless noise from a higher timeframe's perspective — always
  check up before trusting down.
- Higher timeframes update and confirm slower — don't expect a 4H
  structure shift to be obvious within minutes.
- Switching timeframes mid-analysis without a defined process (called
  "timeframe shopping") is a common way to unconsciously find whatever
  chart confirms a bias you already have.

### Common Mistakes

New traders often anchor to whichever timeframe they happen to be
looking at, rather than deliberately choosing a timeframe for a
specific analytical job. This leads to reading a 5-minute chart as if
it contains all the context a Daily chart would provide, and being
repeatedly surprised when higher-timeframe forces override a
lower-timeframe pattern.

### Key Takeaways

1. A timeframe is a compression window — how much price action is
   summarized into one candle.
2. Higher timeframes show the big picture with less noise; lower
   timeframes show precise detail with more noise.
3. Effective analysis moves top-down: establish context on a higher
   timeframe, refine entries on a lower one.

### Practice Drill

Given a 4H chart and its corresponding 15-minute chart for the same
period (provided in Practise), identify one 4H-level feature (a zone,
a swing point) and locate exactly where it appears within the
15-minute chart's internal structure.

### Scenario Challenge

You spot what looks like a strong reversal pattern on a 5-minute
chart. Before acting on it, what two things should you check on a
higher timeframe, and why?

### Mini Quiz

Q1 (True/False): A pattern on a 1-minute chart always carries the same
significance as the same-shaped pattern on a Daily chart.
Answer: False — significance depends heavily on timeframe context, not
just the pattern's shape.

Q2 (Multiple choice): Why is a single 4H candle composed of exactly
sixteen 15-minute candles?
(a) Coincidence
(b) Because 4 hours contains sixteen 15-minute periods (4 x 60 / 15)
(c) Broker-specific convention with no fixed ratio
(d) Timeframes are unrelated to each other

Answer: (b). Timeframes nest in fixed, calculable ratios because a
higher timeframe candle is literally built from the lower-timeframe
candles inside its time window.

### Flashcards

- Front: What does a timeframe represent? Back: The amount of price
  action compressed into a single candle — e.g., one hour's worth for
  a 1H candle.
- Front: Why does multi-timeframe analysis work? Back: Higher-timeframe
  candles are literally composed of lower-timeframe candles, so a
  higher-timeframe zone always has real internal structure visible by
  dropping to a lower timeframe.

### Reflection

Which timeframe do you naturally gravitate toward when you open a
chart? Is that a deliberate choice for a specific analytical job, or
just habit?

### Mastery Criteria

Correctly locate the practice-drill's 4H-level feature within its
corresponding 15-minute internal structure.

### Spaced Review

Day 1, Day 7, Day 21 — this lesson is the direct prerequisite for Core
7's five-layer multi-timeframe stack, where it's applied formally.

### Bot Connection

Every bot's setup rules are defined across multiple explicit
timeframes (for example, Bot 2's 4H zone + 1H sweep + 15-minute
displacement) — this lesson is what makes those rules readable instead
of an arbitrary list of numbers.

---

## C1-06 — Sessions, Market Open/Close, Gaps

**Level:** 0
**Estimated study time:** 13 minutes
**Prerequisites:** C1-04, C1-05
**Learning objectives:** Identify the major global trading sessions and
their typical liquidity characteristics, and explain what a price gap
is and why it occurs.

### Why This Matters

Price behaves differently depending on which global session is active
and whether a market has just reopened after a closure — the same
setup can perform very differently depending on when it occurs. Gaps
in particular are a direct, visible consequence of markets closing and
reopening, and several later concepts (imbalance, FVGs in Core 5) are
closely related to the same underlying idea of price moving without
full two-sided participation at every level.

### Core Teaching

**Plain-English explanation.** Global markets are active at different
times depending on which financial center is open — broadly, Asian
(Tokyo/Sydney), London, and New York sessions, with the London/New
York overlap generally the most liquid and active window for most
instruments. Some markets (many crypto exchanges) trade continuously
with no close at all; others (most stock exchanges, and forex over
the weekend) close and reopen, and a gap is what happens when the
reopening price is meaningfully different from the prior closing
price, because relevant news or order flow occurred while the market
was closed and unable to reflect it.

**Technical explanation.** A gap appears on a chart as a visible space
between one candle's close and the next candle's open, with no trading
having occurred at the prices in between. Gaps happen because during a
market closure, news, economic data, or after-hours order flow builds
up a change in fair value that the market has no mechanism to price in
until it reopens — the first trade after reopening can occur well away
from the prior close. This is conceptually related to, but distinct
from, the Fair Value Gap (FVG) concept taught formally in Core 5: an
FVG is a specific three-candle imbalance pattern that can form even in
a continuously-trading market with no session close involved at all;
a session gap is caused specifically by a market closure, not by rapid
intra-session displacement.

### Visual Model

See diagram: `visuals/c1-06-sessions-gap.svg` — a 24-hour clock face
showing the Asian, London, and New York session windows with their
overlap highlighted, alongside a small chart panel showing a visible
gap between Friday's close and Monday's open on a forex pair.

### Worked Example

A forex pair closes Friday at 1.0900. Over the weekend, unexpected
geopolitical news breaks. When the market reopens Sunday evening, the
first trade occurs at 1.0850 — a 50-pip gap down, with no trading
having occurred at any price in between. A trader with a resting order
inside that gapped range would not have gotten filled at their
intended price; their order fills, if at all, at whatever price the
market first offers.

### Counterexample

A trader analyzing a continuously-traded crypto pair looks for
"weekend gaps" the way they would on forex, and finds none, concluding
something is technically wrong with their chart. Continuously-traded
markets have no closure, so there's no mechanism for a session gap to
form — the absence of gaps here is expected, not a data error.

### Good Example / Bad Example

Good: Being aware of which session is currently active and adjusting
expectations for typical liquidity and range accordingly — the London/
New York overlap generally behaves differently than a thin Asian
session. Bad: Applying identical expectations for typical range and
liquidity to every hour of the day regardless of which session is
active.

### What to Look Out For

- Not every market can gap — only markets that actually close and
  reopen can produce a session gap.
- A gap represents a real absence of trading at those prices, not
  just a visual chart artifact.
- Liquidity and typical range vary significantly by session — a
  strategy tuned for the London/New York overlap may behave very
  differently during a thin Asian session.

### Common Mistakes

Beginners sometimes assume every visible "jump" on a chart is
automatically a Fair Value Gap in the Core 5 technical sense. A session
gap (caused by a market closure) and an FVG (a specific three-candle
displacement imbalance) can look superficially similar but have
different causes and different trading implications — this lesson
exists partly to prevent that conflation before Core 5 formally defines
the FVG.

### Key Takeaways

1. Global markets operate across Asian, London, and New York sessions,
   each with different typical liquidity and range characteristics.
2. A gap is a visible price jump caused by a market closing and
   reopening at a meaningfully different price — not every market can
   produce one.
3. A session gap and a Fair Value Gap are related in concept but
   distinct in cause — don't conflate them before Core 5 defines FVGs
   formally.

### Practice Drill

Given a week of Daily candles for a forex pair spanning a weekend
(provided in Practise), identify the Friday close and Sunday/Monday
open, and calculate the size of any weekend gap in pips.

### Scenario Challenge

You're comparing a strategy's typical results during the London/New
York overlap against its results during a thin, low-volume overnight
session. What two characteristics from this lesson would you expect to
differ between those two windows, and how might that change your
approach?

### Mini Quiz

Q1 (True/False): Every tradable market can produce a session gap.
Answer: False — only markets that actually close and reopen can gap; a
continuously-traded market has no mechanism to produce one.

Q2 (Multiple choice): What generally makes the London/New York overlap
distinct from other session windows?
(a) It's typically the least liquid window of the day
(b) It's generally the most liquid and active window for most
    instruments
(c) It only matters for crypto trading
(d) It has no effect on typical range

Answer: (b).

### Flashcards

- Front: What causes a session gap? Back: A market closing, then
  reopening at a meaningfully different price because relevant news or
  order flow occurred while trading was unavailable.
- Front: Is a session gap the same thing as a Fair Value Gap (FVG)?
  Back: No — related in concept (both represent price moving without
  full two-sided trading at every level) but caused differently: a
  session gap requires a market closure; an FVG is a three-candle
  displacement pattern that can form intra-session.

### Reflection

Have you noticed a difference in how an instrument you watch behaves
during different session windows? Write one specific observation.

### Mastery Criteria

Correctly calculate the weekend gap size from the practice-drill data
and correctly distinguish it, in one sentence, from a Core 5 Fair
Value Gap.

### Spaced Review

Day 1, Day 7, Day 21 — this lesson's gap/FVG distinction is directly
tested again inside Core 5's own FVG lessons to confirm the earlier
distinction actually stuck.

### Bot Connection

Bots trading forex pairs through TradeLocker/MetaApi integrations are
directly affected by weekend gap risk on any position held into a
market close — this is part of why Core 8's risk-management lessons
treat holding through a known closure as a distinct risk category.
