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
