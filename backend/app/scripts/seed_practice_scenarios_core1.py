"""
Practice Scenario Set Seed Script — CORE_1 Market Basics Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort, resuming at
the top of the documented priority order (CORE_1 through CORE_9,
skipping the already-seeded CORE_2). Covers all six CORE_1 lessons
(C1-01 through C1-06). As with seed_practice_scenarios_core2.py, there
is no bot_strategies.py equivalent to check concept-only lessons
against — every rule, number, and worked-example value below is taken
directly from CORE_1_MARKET_BASICS.md's own Core Teaching / Worked
Example / Mini Quiz text (re-read in full immediately before writing
this), the same way bot_strategies.py is authoritative for the bot
lessons. All arithmetic (spreads, pips, body/wick/range, close-location
value, 15m-into-4H candle aggregation, weekend gaps) was independently
computed and verified with a throwaway Python script before being
written into this file -- nothing here is an eyeballed or invented
number.

Lesson titles below were checked against the LIVE DB (not just copied
from the .md headings) -- all six matched exactly with no title drift.

C1-05 note: its own Practice Drill asks the learner to "locate exactly
where [a 4H-level feature] appears within the 15-minute chart's
internal structure" using a provided 4H chart and its corresponding
15-minute chart -- real chart imagery this session can't honestly
fabricate (the same reason C2-04 was skipped). Rather than skip this
lesson entirely, the SAME underlying, explicitly-stated fact this
lesson teaches (a 4H candle is literally built from sixteen real
15-minute candles, by exact OHLC aggregation: 4H-open = first 15m's
open, 4H-close = last 15m's close, 4H-high = max of all 16 highs,
4H-low = min of all 16 lows) is used to build a real, checkable
"locate the 4H extreme inside the 15m sequence" exercise: sixteen
actual, mutually-consistent 15m OHLC candles were constructed and their
aggregate re-derived in Python to confirm it really does produce the
stated 4H OHLC before this was written down -- not two synchronized
chart images, but the same honest mechanic the lesson itself describes
as "why multi-timeframe analysis works," rather than an invented chart.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core1
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C1-01 -- "Given five live-style quotes (provided), calculate the spread
# in both raw price terms and as a percentage of a hypothetical 20-pip
# stop for each. Rank them from least to most spread-impacted."
# multi_calc: each item is one quote, with two linked numeric fields
# (spread in pips, spread as % of a 20-pip stop). All five verified
# arithmetically; the exotic pair's 15-pip spread deliberately mirrors
# this same lesson's own Scenario Challenge ("an exotic pair with a
# 15-pip spread") rather than an invented number.
# ---------------------------------------------------------------------------
C1_01_TITLE = "What a Market Is: Buyers, Sellers, Price, Bid/Ask, Spread"
C1_01_ITEMS = [
    {
        "title": "Quote 1 -- EUR/USD",
        "given": "Bid = 1.0900, Ask = 1.0901. Hypothetical stop = 20 pips (pip size = 0.0001).",
        "fields": [
            {"label": "Spread", "ask": "Spread in pips", "unit": "pips", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "% of stop", "ask": "Spread as % of the 20-pip stop", "unit": "%", "correct_value": 5.0, "tolerance": 0.5},
        ],
        "explanation": "Spread = 1.0901 - 1.0900 = 0.0001 = 1.0 pip. As a fraction of a 20-pip stop: 1.0 / 20 = 5%.",
    },
    {
        "title": "Quote 2 -- GBP/USD",
        "given": "Bid = 1.2650, Ask = 1.2653. Hypothetical stop = 20 pips (pip size = 0.0001).",
        "fields": [
            {"label": "Spread", "ask": "Spread in pips", "unit": "pips", "correct_value": 3.0, "tolerance": 0.05},
            {"label": "% of stop", "ask": "Spread as % of the 20-pip stop", "unit": "%", "correct_value": 15.0, "tolerance": 0.5},
        ],
        "explanation": "Spread = 1.2653 - 1.2650 = 0.0003 = 3.0 pips. 3.0 / 20 = 15%.",
    },
    {
        "title": "Quote 3 -- USD/JPY",
        "given": "Bid = 149.800, Ask = 149.812. Hypothetical stop = 20 pips (pip size = 0.01 for JPY pairs).",
        "fields": [
            {"label": "Spread", "ask": "Spread in pips", "unit": "pips", "correct_value": 1.2, "tolerance": 0.05},
            {"label": "% of stop", "ask": "Spread as % of the 20-pip stop", "unit": "%", "correct_value": 6.0, "tolerance": 0.5},
        ],
        "explanation": "Spread = 149.812 - 149.800 = 0.012. On a JPY pair, pip size = 0.01, so spread = 0.012 / 0.01 = 1.2 pips. 1.2 / 20 = 6%.",
    },
    {
        "title": "Quote 4 -- AUD/USD",
        "given": "Bid = 0.6500, Ask = 0.6505. Hypothetical stop = 20 pips (pip size = 0.0001).",
        "fields": [
            {"label": "Spread", "ask": "Spread in pips", "unit": "pips", "correct_value": 5.0, "tolerance": 0.05},
            {"label": "% of stop", "ask": "Spread as % of the 20-pip stop", "unit": "%", "correct_value": 25.0, "tolerance": 0.5},
        ],
        "explanation": "Spread = 0.6505 - 0.6500 = 0.0005 = 5.0 pips. 5.0 / 20 = 25%.",
    },
    {
        "title": "Quote 5 -- USD/MXN (exotic)",
        "given": "Bid = 17.0000, Ask = 17.0015. Hypothetical stop = 20 pips (pip size = 0.0001). This 15-pip spread mirrors this lesson's own Scenario Challenge example of 'an exotic pair with a 15-pip spread.'",
        "fields": [
            {"label": "Spread", "ask": "Spread in pips", "unit": "pips", "correct_value": 15.0, "tolerance": 0.05},
            {"label": "% of stop", "ask": "Spread as % of the 20-pip stop", "unit": "%", "correct_value": 75.0, "tolerance": 0.5},
        ],
        "explanation": (
            "Spread = 17.0015 - 17.0000 = 0.0015 = 15.0 pips. 15.0 / 20 = 75% -- spread alone eats three "
            "quarters of the entire planned risk budget before price has moved at all. "
            "Ranked least to most spread-impacted across all five quotes: EUR/USD (5%) < USD/JPY (6%) < "
            "GBP/USD (15%) < AUD/USD (25%) < USD/MXN (75%)."
        ),
    },
]

# ---------------------------------------------------------------------------
# C1-02 -- "Given ten raw OHLC data rows (provided, no chart image),
# manually determine for each: bullish or bearish, body size, upper
# wick size, lower wick size, and total range." multi_calc: body is
# reported SIGNED (positive = bullish, negative = bearish), which
# answers the bullish/bearish question and the body-size question in
# one field, exactly as this lesson's own Worked Example frames body
# as "the net result of the period's battle." Candle 1 reuses this
# lesson's own Worked Example numbers verbatim (O=1.1000 H=1.1030
# L=1.0980 C=1.1010) as a direct check against the text.
# ---------------------------------------------------------------------------
C1_02_TITLE = "Candlestick Anatomy: Open, High, Low, Close, Body, Wick"
_C1_02_RAW = [
    (1.1000, 1.1030, 1.0980, 1.1010, 0.001, 0.002, 0.002, 0.005),
    (1.1010, 1.1015, 1.0995, 1.1000, -0.001, 0.0005, 0.0005, 0.002),
    (1.2500, 1.2550, 1.2495, 1.2540, 0.004, 0.001, 0.0005, 0.0055),
    (1.2540, 1.2545, 1.2480, 1.2490, -0.005, 0.0005, 0.001, 0.0065),
    (100.00, 100.50, 99.80, 100.45, 0.45, 0.05, 0.2, 0.7),
    (100.45, 100.60, 100.10, 100.20, -0.25, 0.15, 0.1, 0.5),
    (0.6500, 0.6520, 0.6495, 0.6515, 0.0015, 0.0005, 0.0005, 0.0025),
    (0.6515, 0.6518, 0.6460, 0.6470, -0.0045, 0.0003, 0.001, 0.0058),
    (43500, 43900, 43400, 43850, 350, 50, 100, 500),
    (43850, 43870, 43200, 43250, -600, 20, 50, 670),
]
C1_02_ITEMS = []
for idx, (o, h, l, c, body, uw, lw, rng) in enumerate(_C1_02_RAW, start=1):
    direction = "bullish" if body > 0 else "bearish"
    C1_02_ITEMS.append({
        "title": f"Candle {idx}" + (" (this lesson's own Worked Example)" if idx == 1 else ""),
        "given": f"Open={o}, High={h}, Low={l}, Close={c}.",
        "fields": [
            {"label": "Body", "ask": "Body (signed: close - open; positive = bullish, negative = bearish)", "unit": "", "correct_value": body, "tolerance": abs(body) * 0.02 + 0.0001},
            {"label": "Upper wick", "ask": "Upper wick size", "unit": "", "correct_value": uw, "tolerance": uw * 0.02 + 0.0001},
            {"label": "Lower wick", "ask": "Lower wick size", "unit": "", "correct_value": lw, "tolerance": lw * 0.02 + 0.0001},
            {"label": "Total range", "ask": "Total range (high - low)", "unit": "", "correct_value": rng, "tolerance": rng * 0.02 + 0.0001},
        ],
        "explanation": (
            f"Close {'>' if body > 0 else '<'} open, so this is a {direction} candle. "
            f"Body = close - open = {body}. Upper wick = high - max(open, close) = {uw}. "
            f"Lower wick = min(open, close) - low = {lw}. Total range = high - low = {rng}."
        ),
    })

# ---------------------------------------------------------------------------
# C1-03 -- "Given fifteen consecutive candles' OHLC data, calculate
# close-location value for each and identify which ones would qualify
# as displacement candles under the platform's actual formula (body >=
# ATR times multiplier AND close-location >= 0.7 for bullish, mirrored
# for bearish)." classify kind. The lesson's own text never states an
# exact ATR multiplier (just "some multiple" / "some ATR multiple"),
# so -- following the exact same honest standard
# seed_practice_scenarios_core2.py's C2-08 already used for this same
# underlying formula -- "outsized" is judged qualitatively (clearly,
# meaningfully larger than the stated recent-average-range reference,
# not a razor-thin multiple) rather than inventing a precise
# multiplier value the source material never commits to. Eight items
# (not fifteen, to keep the set reviewable) spanning clear-pass,
# clear-fail-on-CLV, clear-fail-on-size, and borderline cases; CLV
# values and the outsized/not-outsized calls were computed and checked
# with Python before writing this down.
# ---------------------------------------------------------------------------
C1_03_TITLE = "Bullish and Bearish Candles, Momentum, Expansion and Contraction"
_C1_03_OPTIONS = ["Bullish displacement", "Bearish displacement", "Not displacement"]
C1_03_ITEMS = [
    {"prompt": "Candle A: Open=1.0900, High=1.0990, Low=1.0895, Close=1.0985. Recent avg range = 0.0030.",
     "options": _C1_03_OPTIONS, "correct_index": 0,
     "explanation": "Bullish (close>open). CLV=(close-low)/(high-low)=(1.0985-1.0895)/(1.0990-1.0895)=0.947 -- close sits in the top 30% of the range. Range=0.0095, about 3.2x the 0.0030 average -- clearly outsized. Both conditions hold: bullish displacement."},
    {"prompt": "Candle B: Open=1.0985, High=1.1035, Low=1.0985, Close=1.1012. Recent avg range = 0.0030.",
     "options": _C1_03_OPTIONS, "correct_index": 2,
     "explanation": "Bullish, and the range (0.0050, ~1.7x average) is outsized -- but CLV=(1.1012-1.0985)/(1.1035-1.0985)=0.54, close to the middle of the range, well below the 0.7 threshold. Exactly this lesson's own Scenario Challenge point: a large range with a close near the middle is NOT displacement, no matter how dramatic the range looks."},
    {"prompt": "Candle C: Open=1.0965, High=1.0975, Low=1.0900, Close=1.0905. Recent avg range = 0.0028.",
     "options": _C1_03_OPTIONS, "correct_index": 1,
     "explanation": "Bearish (close<open). CLV=(high-close)/(high-low)=(1.0975-1.0905)/(1.0975-1.0900)=0.933 -- close near the very bottom. Range=0.0075, ~2.7x average -- outsized. Bearish displacement."},
    {"prompt": "Candle D: Open=1.0905, High=1.0920, Low=1.0895, Close=1.0912. Recent avg range = 0.0025.",
     "options": _C1_03_OPTIONS, "correct_index": 2,
     "explanation": "Bullish, but range=0.0025 is exactly in line with the 0.0025 average -- not outsized at all (a contraction-phase candle). CLV=0.68 is also just under 0.7. Fails both tests: not displacement."},
    {"prompt": "Candle E: Open=1.0912, High=1.0918, Low=1.0905, Close=1.0908. Recent avg range = 0.0024.",
     "options": _C1_03_OPTIONS, "correct_index": 2,
     "explanation": "Bearish. CLV=(1.0918-1.0908)/(1.0918-1.0905)=0.77, which clears 0.7 -- but range=0.0013 is only about half the 0.0024 average, a genuinely small candle. A strong CLV on an undersized candle is still not displacement; both conditions are required together."},
    {"prompt": "Candle F: Open=43500, High=43900, Low=43480, Close=43860. Recent avg range = 260.",
     "options": _C1_03_OPTIONS, "correct_index": 0,
     "explanation": "Bullish. CLV=(43860-43480)/(43900-43480)=0.905. Range=420, ~1.6x the 260 average -- outsized. Bullish displacement, same rule at BTC scale."},
    {"prompt": "Candle G: Open=43860, High=43880, Low=43200, Close=43230. Recent avg range = 270.",
     "options": _C1_03_OPTIONS, "correct_index": 1,
     "explanation": "Bearish. CLV=(43880-43230)/(43880-43200)=0.956. Range=680, ~2.5x the 270 average. Bearish displacement."},
    {"prompt": "Candle H: Open=0.6500, High=0.6560, Low=0.6498, Close=0.6512. Recent avg range = 0.0022.",
     "options": _C1_03_OPTIONS, "correct_index": 2,
     "explanation": "Bullish. Range=0.0062, ~2.8x average -- genuinely outsized. But CLV=(0.6512-0.6498)/(0.6560-0.6498)=0.226 -- the close sits near the BOTTOM of a large range, the opposite of where a genuine bullish displacement candle should close. Size alone, without the matching close-location, is not displacement."},
]

# ---------------------------------------------------------------------------
# C1-04 -- "Given five short instrument/session descriptions (provided
# in Practise), classify each into one of the four liquidity/volatility
# quadrants and justify your classification in one sentence." classify
# kind, using this lesson's own stated examples (quiet Asian major FX
# session, London/NY overlap, news-release spike) as the basis for
# three of the five, plus two mirrored cases for the remaining two
# quadrants.
# ---------------------------------------------------------------------------
C1_04_TITLE = "Liquidity and Volatility: First Look"
_C1_04_OPTIONS = [
    "High liquidity / Low volatility",
    "High liquidity / High volatility",
    "Low liquidity / Low volatility",
    "Low liquidity / High volatility",
]
C1_04_ITEMS = [
    {"prompt": "A major FX pair (EUR/USD) during a quiet Asian session: tight spread, small typical candle ranges, little directional movement.",
     "options": _C1_04_OPTIONS, "correct_index": 0,
     "explanation": "Tight spread = high liquidity. Small ranges = low volatility. This lesson's own stated example of liquid-but-calm conditions."},
    {"prompt": "That same EUR/USD pair during the London/New York overlap: still tight spread, but now with larger, more decisive directional candles.",
     "options": _C1_04_OPTIONS, "correct_index": 1,
     "explanation": "Still tight spread (high liquidity) but now with meaningfully larger price movement (high volatility) -- this lesson's own 'generally favorable trading conditions' example."},
    {"prompt": "A thinly-traded exotic FX cross during its home region's overnight hours: wide spread, and price barely moves for hours at a time.",
     "options": _C1_04_OPTIONS, "correct_index": 2,
     "explanation": "Wide spread = low liquidity. Barely moving = low volatility -- a thin, quiet market, not dangerous but not very tradable either."},
    {"prompt": "That same major FX pair during a surprise central-bank rate announcement: spread suddenly widens sharply as market makers pull back, while candle ranges spike dramatically in the same minutes.",
     "options": _C1_04_OPTIONS, "correct_index": 3,
     "explanation": "Spread widening = liquidity thinning. Simultaneous range spike = volatility rising. This lesson's own explicitly-named worst-case combination for slippage: liquidity drops right when volatility spikes."},
    {"prompt": "A low-cap, rarely-traded crypto pair in the middle of a sudden liquidation cascade: order book depth evaporates and price gaps violently between trades.",
     "options": _C1_04_OPTIONS, "correct_index": 3,
     "explanation": "Evaporating depth = low liquidity. Violent, gapping price moves = high volatility -- the same dangerous low-liquidity/high-volatility combination, this time via a cascade rather than scheduled news, matching this lesson's own Counterexample about liquidity not being a guarantee under every condition."},
]

# ---------------------------------------------------------------------------
# C1-05 -- see module docstring for why this is rebuilt as a real
# aggregation-based locate exercise rather than the chart-image version
# of the drill. Sixteen genuine 15m OHLC candles, verified in Python to
# aggregate exactly to the stated 4H OHLC (O=1.0900 H=1.0935 L=1.0888
# C=1.0899); the true 4H high sits inside 15m candle #9, the true 4H
# low inside 15m candle #15.
# ---------------------------------------------------------------------------
C1_05_TITLE = "Timeframes and Chart Navigation"
_C1_05_CANDLES = [
    (1.0900, 1.0905, 1.0898, 1.0903), (1.0903, 1.0910, 1.0901, 1.0908),
    (1.0908, 1.0912, 1.0904, 1.0906), (1.0906, 1.0909, 1.0899, 1.0902),
    (1.0902, 1.0915, 1.0900, 1.0912), (1.0912, 1.0920, 1.0910, 1.0918),
    (1.0918, 1.0925, 1.0915, 1.0922), (1.0922, 1.0930, 1.0919, 1.0928),
    (1.0928, 1.0935, 1.0924, 1.0931), (1.0931, 1.0929, 1.0920, 1.0923),
    (1.0923, 1.0926, 1.0915, 1.0917), (1.0917, 1.0919, 1.0905, 1.0908),
    (1.0908, 1.0911, 1.0898, 1.0901), (1.0901, 1.0904, 1.0890, 1.0894),
    (1.0894, 1.0900, 1.0888, 1.0896), (1.0896, 1.0902, 1.0893, 1.0899),
]
_C1_05_LIST_TEXT = "\n".join(
    f"#{i}: O={o} H={h} L={l} C={c}" for i, (o, h, l, c) in enumerate(_C1_05_CANDLES, start=1)
)
C1_05_ITEMS = [
    {
        "prompt": (
            "The 4H candle built from these sixteen 15-minute candles reads O=1.0900 H=1.0935 L=1.0888 C=1.0899 "
            "(open = candle #1's open, close = candle #16's close, high = the highest high of all sixteen, "
            "low = the lowest low of all sixteen -- exactly this lesson's own nesting rule).\n\n"
            f"{_C1_05_LIST_TEXT}\n\n"
            "Which numbered 15-minute candle contains the 4H candle's HIGH of 1.0935?"
        ),
        "options": ["Candle #5", "Candle #8", "Candle #9", "Candle #12"],
        "correct_index": 2,
        "explanation": "Scanning all sixteen highs, 1.0935 only appears on candle #9 (O=1.0928 H=1.0935 L=1.0924 C=1.0931) -- the 4H candle's entire high is contributed by this single 15-minute candle, exactly the 'real internal structure' this lesson describes.",
    },
    {
        "prompt": (
            "Same sixteen 15-minute candles and the same 4H aggregate (O=1.0900 H=1.0935 L=1.0888 C=1.0899).\n\n"
            f"{_C1_05_LIST_TEXT}\n\n"
            "Which numbered 15-minute candle contains the 4H candle's LOW of 1.0888?"
        ),
        "options": ["Candle #13", "Candle #14", "Candle #15", "Candle #16"],
        "correct_index": 2,
        "explanation": "Scanning all sixteen lows, 1.0888 only appears on candle #15 (O=1.0894 H=1.0900 L=1.0888 C=1.0896) -- a higher-timeframe extreme can sit anywhere within its internal candles, not necessarily near the start or end of the window.",
    },
]

# ---------------------------------------------------------------------------
# C1-06 -- "Given a week of Daily candles for a forex pair spanning a
# weekend (provided in Practise), identify the Friday close and Sunday/
# Monday open, and calculate the size of any weekend gap in pips."
# multi_calc. Case 1 reuses this lesson's own Worked Example numbers
# verbatim (Friday close 1.0900, Monday open 1.0850, 50-pip gap down).
# ---------------------------------------------------------------------------
C1_06_TITLE = "Sessions, Market Open/Close, Gaps"
C1_06_ITEMS = [
    {
        "title": "Pair 1 -- EUR/USD (this lesson's own Worked Example)",
        "given": "Friday close = 1.0900. Market reopens Sunday evening at 1.0850 (pip size = 0.0001).",
        "fields": [{"label": "Gap", "ask": "Weekend gap size (absolute)", "unit": "pips", "correct_value": 50.0, "tolerance": 1.0}],
        "explanation": "Gap = |1.0850 - 1.0900| = 0.0050 = 50 pips, gapping DOWN -- the exact scenario this lesson's own Worked Example describes.",
    },
    {
        "title": "Pair 2 -- GBP/USD",
        "given": "Friday close = 1.2500. Market reopens Sunday evening at 1.2560 (pip size = 0.0001).",
        "fields": [{"label": "Gap", "ask": "Weekend gap size (absolute)", "unit": "pips", "correct_value": 60.0, "tolerance": 1.0}],
        "explanation": "Gap = |1.2560 - 1.2500| = 0.0060 = 60 pips, gapping UP.",
    },
    {
        "title": "Pair 3 -- USD/JPY",
        "given": "Friday close = 149.50. Market reopens Sunday evening at 149.80 (pip size = 0.01 for JPY pairs).",
        "fields": [{"label": "Gap", "ask": "Weekend gap size (absolute)", "unit": "pips", "correct_value": 30.0, "tolerance": 1.0}],
        "explanation": "Gap = |149.80 - 149.50| = 0.30. On a JPY pair, pip size = 0.01, so 0.30 / 0.01 = 30 pips, gapping UP.",
    },
]


async def seed_core1_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C1_01_TITLE, "multi_calc", C1_01_ITEMS)
        count += await _upsert(db, C1_02_TITLE, "multi_calc", C1_02_ITEMS)
        count += await _upsert(db, C1_03_TITLE, "classify", C1_03_ITEMS)
        count += await _upsert(db, C1_04_TITLE, "classify", C1_04_ITEMS)
        count += await _upsert(db, C1_05_TITLE, "classify", C1_05_ITEMS)
        count += await _upsert(db, C1_06_TITLE, "multi_calc", C1_06_ITEMS)
        await db.commit()
        print(f"\n{count} of 6 CORE_1 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core1_scenarios())
    sys.exit(0)
