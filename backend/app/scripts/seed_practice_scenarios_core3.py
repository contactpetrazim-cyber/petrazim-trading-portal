"""
Practice Scenario Set Seed Script — CORE_3 Liquidity Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1 done;
this covers all six CORE_3 lessons, C3-01 through C3-06). As with
CORE_1/CORE_2, there is no bot_strategies.py equivalent to check these
concept-only lessons against -- every rule and number below is taken
directly from CORE_3_LIQUIDITY.md's own Core Teaching / Worked Example
/ Key Takeaways text (re-read in full immediately before writing this).
All arithmetic (close-location value, range-vs-average-range ratios
for C3-04's sweep/breakout/random-wick classification, reusing the
exact same CLV/displacement formula and "clearly outsized vs. not"
qualitative standard already used in seed_practice_scenarios_core2.py's
C2-08 and seed_practice_scenarios_core1.py's C1-03, since this lesson's
own .md text never states a precise ATR multiplier either) was
independently computed and verified with a throwaway Python script
before being written down -- every OHLC value used was also checked
for internal validity (low <= open/close <= high).

Lesson titles below were checked against the LIVE DB -- all six
matched exactly with no title drift.

Every "classify" kind item here uses kind the frontend already renders
(see ScenarioDrillPanel.tsx); no new kind was needed.

C3-02 note: the lesson's own text never states a precise numeric
tolerance for what counts as "equal" highs/lows ("nearly the same
price... the specific tolerance varying by instrument volatility") --
rather than invent one, every item here is deliberately unambiguous:
either the two prices are extremely close (well under a tenth of a
percent apart) or clearly, obviously far apart, so no item's correct
answer depends on a threshold number the source material never
commits to.

C3-06 note: the original drill asks to "score and rank eight pools."
Ranking isn't a shape any existing kind renders well, so this is
adapted (same way C3-02/C3-04 adapt their own drills) into a per-pool
classify question: each item states explicitly, in its own prompt,
which of the lesson's four named factors (fresh, HTF context,
concentrated, good session) that specific pool passes, and asks the
learner to classify its overall tradability tier from that stated,
countable fact -- a straightforward count, not an invented score.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core3
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C3-01 -- "Given five chart annotations using the word 'liquidity' in
# different sentences (provided in Practise), classify each as
# referring to market-depth liquidity (C1-04) or price-level liquidity
# (this lesson)." classify kind.
# ---------------------------------------------------------------------------
C3_01_TITLE = "What Liquidity Means in This Framework"
_C3_01_OPTIONS = ["Market-depth liquidity (C1-04 sense -- ease of execution)", "Price-level liquidity (this lesson's sense -- resting orders at a level)"]
C3_01_ITEMS = [
    {"prompt": "\"BTC/USD has deep liquidity right now -- tight spreads and large order book depth at every price.\"", "options": _C3_01_OPTIONS, "correct_index": 0,
     "explanation": "This describes the instrument's overall ease of execution (tight spread, deep book across many prices) -- the C1-04 market-depth sense."},
    {"prompt": "\"There's a cluster of resting buy-stop orders sitting just above that swing high -- liquidity resting above the highs.\"", "options": _C3_01_OPTIONS, "correct_index": 1,
     "explanation": "This describes a concentration of resting orders at ONE specific price level, exactly this lesson's definition -- price-level liquidity."},
    {"prompt": "\"This exotic pair has very thin liquidity -- wide spreads, hard to get filled without moving price.\"", "options": _C3_01_OPTIONS, "correct_index": 0,
     "explanation": "A statement about the whole instrument's general tradability (spread, fill quality) -- market-depth liquidity."},
    {"prompt": "\"Price is likely drawn toward the liquidity pool resting below that recent swing low.\"", "options": _C3_01_OPTIONS, "correct_index": 1,
     "explanation": "\"Liquidity pool\" at a specific swing low is this lesson's resting-orders-at-a-level sense, not a statement about the instrument overall."},
    {"prompt": "\"Major FX pairs are generally considered highly liquid instruments during the London/New York overlap.\"", "options": _C3_01_OPTIONS, "correct_index": 0,
     "explanation": "A general statement about an instrument's tradability during a session -- this is C1-04's market-depth sense, the same vocabulary that lesson used for session-dependent liquidity."},
]

# ---------------------------------------------------------------------------
# C3-02 -- "Given six swing points across three charts (provided in
# Practise), identify which pairs qualify as 'equal highs' or 'equal
# lows,' and label each pool as buy-side or sell-side liquidity."
# classify kind, adapted into three chart items (one swing-point pair
# each), per the module docstring's note on the undefined tolerance.
# ---------------------------------------------------------------------------
C3_02_TITLE = "Buy-Side / Sell-Side Liquidity, Equal Highs/Lows"
_C3_02_OPTIONS = [
    "Equal highs -- one denser buy-side liquidity pool",
    "Equal lows -- one denser sell-side liquidity pool",
    "Not equal -- two separate, thinner pools at clearly different prices",
]
C3_02_ITEMS = [
    {"prompt": "Chart 1: Swing high A at 1.0952, swing high B (three days later) at 1.0949 -- 3 pips apart, both clean reaction highs.", "options": _C3_02_OPTIONS, "correct_index": 0,
     "explanation": "1.0952 and 1.0949 are 3 pips apart on a major FX pair -- effectively the same price. This lesson's own Worked Example (two highs 'within a few points of 1.0950'). Equal highs, one denser buy-side pool."},
    {"prompt": "Chart 2: Swing low A at 1.2600, swing low B (one week later) at 1.2603 -- 3 pips apart, both clean reaction lows.", "options": _C3_02_OPTIONS, "correct_index": 1,
     "explanation": "3 pips apart is effectively the same price for this pair. Equal lows, one denser sell-side pool."},
    {"prompt": "Chart 3: Swing high A at 43,500 and swing high B at 44,800 -- 1,300 points apart, each an isolated, unrelated reaction high on BTC/USD.", "options": _C3_02_OPTIONS, "correct_index": 2,
     "explanation": "1,300 points apart on BTC is a clearly different price level, not 'nearly the same price' by any reasonable standard -- these are two separate, thinner isolated pools, exactly this lesson's own Scenario Challenge case (three separate highs, none close to each other -- no equal-highs pool, just isolated buy-side liquidity at each)."},
]

# ---------------------------------------------------------------------------
# C3-03 -- "Given three charts each with a visible diagonal trendline
# (provided in Practise), rate each trendline's liquidity-signal
# confidence (strong, moderate, weak) based on how many times and how
# cleanly price actually touched it." classify kind, grounded directly
# in the lesson's own stated rule: "two barely-touching points is much
# weaker evidence than three or more clean touches."
# ---------------------------------------------------------------------------
C3_03_TITLE = "Trendline Liquidity, Liquidity Pools"
_C3_03_OPTIONS = ["Strong", "Moderate", "Weak"]
C3_03_ITEMS = [
    {"prompt": "Trendline A: price cleanly touches and respects the rising trendline at four separate higher lows, each a precise, clean touch.", "options": _C3_03_OPTIONS, "correct_index": 0,
     "explanation": "Four clean touches is well above the lesson's own 'three or more clean touches' bar for a strong signal."},
    {"prompt": "Trendline B: connects only two swing lows, and price loosely approached rather than cleanly touched the line both times -- the Scenario Challenge's own example.", "options": _C3_03_OPTIONS, "correct_index": 2,
     "explanation": "Two barely-touching points is exactly this lesson's own named example of the weakest case -- 'much weaker evidence than three or more clean touches.'"},
    {"prompt": "Trendline C: connects three swing highs; two of the touches are clean and precise, but the third is a loose, barely-touching approach.", "options": _C3_03_OPTIONS, "correct_index": 1,
     "explanation": "This sits between the two named extremes -- it clears the 'three touches' count the lesson treats as the strong bar, but one of those three is loose rather than clean, so it doesn't fully qualify as 'three or more clean touches.' A reasonable moderate rating, not strong (not all touches are clean) and not weak (it has more than two touches, unlike the lesson's own weak example)."},
]

# ---------------------------------------------------------------------------
# C3-04 -- "Given twelve level-touch examples (provided in Practise,
# spanning real liquidity pools and insignificant levels), classify
# each as a sweep, a breakout, or a random wick, citing
# close-location value, displacement, and whether a real pool was
# present." classify kind. Eight items (not twelve, to keep the set
# reviewable) spanning every combination the lesson distinguishes:
# real-pool sweep, real-pool breakout (with and without displacement),
# and random wick where no real pool existed regardless of candle
# shape -- all OHLC values, CLV, and range-ratio figures verified in
# Python before writing (see module docstring).
# ---------------------------------------------------------------------------
C3_04_TITLE = "Liquidity Sweeps: Sweep vs. Breakout vs. Random Wick"
_C3_04_OPTIONS = ["Sweep", "Breakout", "Random wick (no real liquidity pool was there)"]
C3_04_ITEMS = [
    {"prompt": "Real buy-side pool (equal highs) at 1.0950. Candle: O=1.0948, H=1.0965, L=1.0944, C=1.0947. Recent avg range = 0.0020.", "options": _C3_04_OPTIONS, "correct_index": 0,
     "explanation": "A real pool was there. High (1.0965) exceeds the level, but close (1.0947) snaps back BELOW 1.0950 -- CLV=(1.0947-1.0944)/(1.0965-1.0944)=0.14, near the bottom, consistent with a failed upside push. Classic sweep."},
    {"prompt": "Same real pool at 1.0950. Candle: O=1.0955, H=1.0990, L=1.0950, C=1.0985. Recent avg range = 0.0020.", "options": _C3_04_OPTIONS, "correct_index": 1,
     "explanation": "Close (1.0985) stays beyond the level -- CLV=(1.0985-1.0950)/(1.0990-1.0950)=0.875, near the top. Range=0.0040, 2x the 0.0020 average -- genuine displacement. A real breakout with real follow-through evidence."},
    {"prompt": "Real sell-side pool (equal lows) at 1.2600. Candle: O=1.2605, H=1.2612, L=1.2580, C=1.2608. Recent avg range = 0.0022.", "options": _C3_04_OPTIONS, "correct_index": 0,
     "explanation": "Low (1.2580) breaks below the pool, but close (1.2608) snaps back ABOVE 1.2600. CLV=(1.2612-1.2608)/(1.2612-1.2580)=0.125, close near the bottom of the range (consistent with a failed downside push). Sweep."},
    {"prompt": "Same real pool at 1.2600. Candle: O=1.2605, H=1.2608, L=1.2555, C=1.2558. Recent avg range = 0.0022.", "options": _C3_04_OPTIONS, "correct_index": 1,
     "explanation": "Close (1.2558) stays below the level. CLV=(1.2608-1.2558)/(1.2608-1.2555)=0.943, near the extreme. Range=0.0053, ~2.4x average -- genuine displacement. Breakout."},
    {"prompt": "An isolated price point at 43,500 with NO prior swing high, no equal-highs cluster, and no resting-order reason to matter (fails C3-01's own definition entirely). Candle: O=43490, H=43560, L=43480, C=43495. Recent avg range = 250.", "options": _C3_04_OPTIONS, "correct_index": 2,
     "explanation": "This fails the prior test (C3-01-C3-03): no real liquidity pool was ever there. Regardless of the candle's shape (a modest wick, CLV=0.19), there's nothing meaningful being 'swept' -- a random wick through an insignificant level."},
    {"prompt": "Real buy-side pool at 1.0950. Candle: O=1.0948, H=1.0966, L=1.0945, C=1.0958. Recent avg range = 0.0024.", "options": _C3_04_OPTIONS, "correct_index": 1,
     "explanation": "Close (1.0958) stays beyond the 1.0950 level -- the close is what decides sweep vs. breakout, not the range or displacement. CLV=(1.0958-1.0945)/(1.0966-1.0945)=0.62 and range (0.0021) is roughly in line with the 0.0024 average -- a weak, undisplaced breakout, but still a breakout (closed beyond, didn't snap back), not a sweep."},
    {"prompt": "Real buy-side pool (equal highs) at 43,500. Candle: O=43480, H=43650, L=43470, C=43490. Recent avg range = 260.", "options": _C3_04_OPTIONS, "correct_index": 0,
     "explanation": "High (43650) exceeds the pool, but close (43490) snaps back below 43500. CLV=(43490-43470)/(43650-43470)=0.11, near the bottom -- a sweep, same rule at BTC scale."},
    {"prompt": "An isolated, insignificant level at 0.6500 with no real resting orders behind it. Candle: O=0.6495, H=0.6560, L=0.6490, C=0.6555. Recent avg range = 0.0025.", "options": _C3_04_OPTIONS, "correct_index": 2,
     "explanation": "Even though this candle's shape looks exactly like a textbook breakout (CLV=0.93, range 2.8x average, genuine displacement), there was no real liquidity pool here to begin with -- nothing of significance was triggered. This lesson's own point: the shape of the wick doesn't matter if nothing was resting there. Random wick, not a breakout."},
]

# ---------------------------------------------------------------------------
# C3-05 -- "Given six chart sequences (provided in Practise), identify
# which show the complete sweep + displacement + CHoCH sequence, which
# show only a partial sequence, and which show none of it." classify
# kind, with the missing piece named in each partial case's options.
# ---------------------------------------------------------------------------
C3_05_TITLE = "Sweep + Displacement + CHoCH: Reading Sequences"
_C3_05_OPTIONS = [
    "Complete sequence (sweep, then displacement, then confirming CHoCH)",
    "Partial sequence -- sweep occurred but no real displacement followed",
    "Partial sequence -- sweep and displacement occurred but no CHoCH confirmed yet",
    "No sequence -- price simply continued in its original direction with no sweep at all",
]
C3_05_ITEMS = [
    {"prompt": "Price sweeps above a clean equal-highs pool, closing back below it. The next two candles are large-range, high-CLV bearish candles. The second of those candles also closes below the prior protected low.", "options": _C3_05_OPTIONS, "correct_index": 0,
     "explanation": "Sweep (close back inside), then genuine displacement (large-range, high-CLV bearish candles), then a confirming CHoCH (close below the protected low) -- all three pieces, in order. This lesson's own Worked Example, verbatim."},
    {"prompt": "Price sweeps above a clean equal-highs pool, closing back below it. The next candle is modest, undisplaced, moving slightly lower. No CHoCH has occurred -- the protected low remains intact.", "options": _C3_05_OPTIONS, "correct_index": 1,
     "explanation": "A valid sweep occurred, but the following candle shows no genuine displacement (modest range, no real follow-through) -- the sequence stalls at step one. This lesson's own Counterexample."},
    {"prompt": "Price sweeps above a clean equal-highs pool, closing back below it. The next two candles ARE large-range, high-CLV bearish displacement -- but the protected low has not been broken yet; the prior uptrend's structure is still technically intact.", "options": _C3_05_OPTIONS, "correct_index": 2,
     "explanation": "Sweep and genuine displacement both occurred, but no CHoCH has confirmed -- per the lesson's own Scenario Challenge, the sequence is not yet complete without that structural confirmation."},
    {"prompt": "Price approaches a level with no real liquidity pool behind it, wicks slightly above, and simply continues higher over the following candles with no reversal attempt at all.", "options": _C3_05_OPTIONS, "correct_index": 3,
     "explanation": "No real sweep occurred here in the first place (C3-04's random-wick case) -- price just kept going. None of the three pieces apply."},
    {"prompt": "Price sweeps below a clean equal-lows pool, closing back above it. The next three candles are large-range bullish candles with CLV above 0.85 each. The third closes above the prior protected high, breaking the prior downtrend's structure.", "options": _C3_05_OPTIONS, "correct_index": 0,
     "explanation": "The mirrored (bullish) version of the complete sequence: sweep, then real displacement, then a confirming CHoCH through the protected high."},
    {"prompt": "Price sweeps below a clean equal-lows pool, closing back above it. The very next candle closes below the broken protected high again, resuming the ORIGINAL downtrend -- no displacement away from the sweep ever materialized.", "options": _C3_05_OPTIONS, "correct_index": 1,
     "explanation": "A valid sweep occurred, but instead of displacement away from it, price resumed the original trend immediately -- displacement never materialized, so the sequence stops at step one, same as item 2's bearish mirror."},
]

# ---------------------------------------------------------------------------
# C3-06 -- adapted per module docstring: each item states explicitly
# which of the lesson's four named tradability factors (Fresh?, HTF
# Context?, Concentrated?, Good Session?) a given pool passes, and asks
# for the resulting tradability tier -- a plain count of stated,
# already-given facts, not an invented score.
# ---------------------------------------------------------------------------
C3_06_TITLE = "Why Not Every Pool Is Tradable"
_C3_06_OPTIONS = [
    "Strong candidate -- passes 3-4 of the four factors, worth actively tracking",
    "Marginal candidate -- passes about half (2 of 4), track with added caution",
    "Weak candidate -- passes 0-1 of the four factors, better to skip",
]
C3_06_ITEMS = [
    {"prompt": "Pool 1 (equal highs near a fresh 4H order block, London/NY overlap session): Fresh? Yes (never swept). HTF Context? Yes (sits near a fresh 4H order block). Concentrated? Yes (equal highs). Good Session? Yes (overlap).", "options": _C3_06_OPTIONS, "correct_index": 0,
     "explanation": "Passes all four factors (4/4) -- this lesson's own Worked Example, 'worth actively tracking for a sweep + displacement + CHoCH setup.'"},
    {"prompt": "Pool 2 (isolated swing high, already swept once three weeks ago, no nearby higher-timeframe context, thin overnight session): Fresh? No (already swept). HTF Context? No. Concentrated? No (isolated, not equal highs). Good Session? No (thin overnight).", "options": _C3_06_OPTIONS, "correct_index": 2,
     "explanation": "Passes zero of the four factors (0/4) -- this lesson's own Counterexample, which 'scores poorly on every tradability factor' despite technically meeting C3-01's bare definition of a liquidity pool."},
    {"prompt": "Pool 3 (equal lows, fresh/never swept, but sitting with no nearby higher-timeframe zone, approached during a thin Asian session): Fresh? Yes. HTF Context? No. Concentrated? Yes (equal lows). Good Session? No (thin session).", "options": _C3_06_OPTIONS, "correct_index": 1,
     "explanation": "Passes exactly two of the four factors (fresh, concentrated) and fails two (HTF context, session) -- a genuinely mixed case, worth tracking only with the added caution this lesson recommends for partial scores, not full confidence."},
    {"prompt": "Pool 4 (isolated single swing low -- not equal lows -- but fresh/never swept, sitting right at a strong 4H demand zone, approached during the London/NY overlap): Fresh? Yes. HTF Context? Yes. Concentrated? No (isolated, not equal lows). Good Session? Yes.", "options": _C3_06_OPTIONS, "correct_index": 0,
     "explanation": "Passes three of the four factors (3/4) -- missing only concentration (it's an isolated point, not an equal-lows cluster), still a strong candidate overall per this lesson's own 'none of these factors alone disqualifies a pool' framing."},
]


async def seed_core3_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C3_01_TITLE, "classify", C3_01_ITEMS)
        count += await _upsert(db, C3_02_TITLE, "classify", C3_02_ITEMS)
        count += await _upsert(db, C3_03_TITLE, "classify", C3_03_ITEMS)
        count += await _upsert(db, C3_04_TITLE, "classify", C3_04_ITEMS)
        count += await _upsert(db, C3_05_TITLE, "classify", C3_05_ITEMS)
        count += await _upsert(db, C3_06_TITLE, "classify", C3_06_ITEMS)
        await db.commit()
        print(f"\n{count} of 6 CORE_3 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core3_scenarios())
    sys.exit(0)
