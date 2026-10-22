"""
Practice Scenario Set Seed Script — CORE_4 Supply, Demand & Zones Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1 and
CORE_3 done; this covers all six CORE_4 lessons, C4-01 through C4-06).
No bot_strategies.py equivalent exists for these concept-only lessons;
every rule and number below is taken directly from
CORE_4_SUPPLY_DEMAND_ZONES.md's own Core Teaching / Worked Example /
Key Takeaways text (re-read in full immediately before writing this).
The C4-05 body-vs-full-range boundary math was independently computed
and OHLC-validity-checked with a throwaway Python script before being
written down.

Lesson titles below were checked against the LIVE DB -- all six
matched exactly with no title drift.

C4-05 note: the drill asks for all THREE boundary conventions (body,
full-range, wick-inclusive). The lesson's own text gives exact,
checkable formulas for only two of them (body = open/close,
full-range = high/low); "wick-inclusive" is explicitly described as
"a middle ground... extending slightly beyond the body but not all the
way to the full wick extreme" with no stated formula or fraction. Per
this effort's own rule against inventing a plausible-sounding number
for anything the source material doesn't actually commit to, this
drill tests only the two conventions with real, computable boundaries
(body-only and full-range) and the resulting hold/miss verdict
difference between them -- exactly the concrete, checkable half of the
lesson's own point -- rather than fabricating a wick-inclusive
fraction.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core4
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C4-01 -- "Given eight displaced moves across four charts (provided
# in Practise), mark the specific origin candle(s) for each,
# distinguishing them from the displacement itself." classify kind.
# ---------------------------------------------------------------------------
C4_01_TITLE = "Supply and Demand, Origin of Displacement"
C4_01_ITEMS = [
    {"prompt": "Sequence: Candle 1 (small, unremarkable), Candle 2 (small, unremarkable), Candle 3 (small, unremarkable -- the last small candle), Candles 4-7 (large-range bullish, closing near their highs -- confirmed displacement). Which candle is the origin of this move?",
     "options": ["Candle 1 (the first small candle)", "Candle 3 (the last small candle, immediately before displacement began)", "Candle 4 (the first displacement candle)", "Candles 4-7 together (the whole displaced move)"],
     "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: the origin is the LAST of the small candles before displacement began -- not the first small candle, not the first displacement candle, and not the whole multi-candle move."},
    {"prompt": "Sequence: Candle 1 (small bearish), Candle 2 (small bullish), Candle 3 (small bearish -- the last candle before the move), Candles 4-6 (large-range bearish, high close-location value downward -- confirmed displacement). A colleague marks Candles 1-3 together as 'the demand zone.' Is that correct?",
     "options": ["Yes -- the whole 3-candle cluster is the origin", "No -- only Candle 3, the single candle immediately before displacement, is the origin", "No -- Candle 4 (the first displacement candle) is the origin", "No -- none of candles 1-6 qualify since this is a bearish move"],
     "correct_index": 1,
     "explanation": "This lesson's own Counterexample: marking the whole small-candle cluster (or the displacement itself) as 'the zone' conflates cause and effect. Only the single candle immediately preceding the displacement -- Candle 3 -- is the origin."},
    {"prompt": "Sequence: Candle 1 (small, unremarkable), Candle 2 (small, unremarkable), Candle 3 (large-range bullish, high close-location value -- itself the first displacement candle). Does Candle 2 qualify as a meaningful origin here?",
     "options": ["Yes, automatically -- any small candle before a move qualifies", "Yes, but only if genuine displacement (C2-08) actually follows it -- which it does here, so Candle 2 IS the origin", "No -- small candles are never origins", "No -- only candles that are themselves large qualify as origins"],
     "correct_index": 1,
     "explanation": "This lesson's own rule: not every small candle before a move is a meaningful origin -- it requires genuine displacement (C2-08) to have actually followed it. Here it does, so Candle 2 (the last small candle before Candle 3's displacement) is the valid origin."},
    {"prompt": "Sequence: Candle 1 (small, unremarkable), Candle 2 (small, unremarkable), Candle 3 (modest, undisplaced move -- NOT genuine displacement, just an ordinary small up-move). Does Candle 2 qualify as a supply/demand origin?",
     "options": ["Yes -- it's a small candle before a move, which is all that's required", "No -- Candle 3's move was never genuine displacement, so there's no supply/demand origin here at all in this framework's sense", "Yes, but only because Candle 1 also qualifies", "No -- Candle 3 itself is the origin instead"],
     "correct_index": 1,
     "explanation": "This lesson's own explicit caveat: a small candle before an unremarkable, UNDISPLACED move is not a supply/demand origin in this framework's sense. Without genuine displacement following it, there's nothing to mark here."},
]

# ---------------------------------------------------------------------------
# C4-02 -- "Given ten displacement moves across five charts (provided
# in Practise), identify and correctly label the order block (bullish
# or bearish) for each." classify kind, including the lesson's own
# named counterexample (picking the wrong-colored candle).
# ---------------------------------------------------------------------------
C4_02_TITLE = "Order Blocks: Bullish and Bearish"
_C4_02_OPTIONS = [
    "Bullish order block -- the last BEARISH (down-close) candle before confirmed bullish displacement",
    "Bearish order block -- the last BULLISH (up-close) candle before confirmed bearish displacement",
    "Not a valid order block -- no genuine displacement actually followed",
]
C4_02_ITEMS = [
    {"prompt": "A red (down-close) candle is immediately followed by three large-range green candles closing near their highs (confirmed bullish displacement, per C2-08).",
     "options": _C4_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: the red candle is the bullish order block -- the last candle where sellers were still in control before buyers overwhelmed them."},
    {"prompt": "A green (up-close) candle is immediately followed by a strong bearish displacement move (large-range red candles, high close-location value downward).",
     "options": _C4_02_OPTIONS, "correct_index": 1,
     "explanation": "The green candle is the last bullish candle before confirmed bearish displacement -- a bearish order block. The naming describes the direction of the move that FOLLOWS, not the candle's own color (this lesson's own Scenario Challenge)."},
    {"prompt": "A trader marks a GREEN candle sitting TWO candles before a bullish displacement move as 'the bullish order block,' skipping past a RED candle sitting directly adjacent to the displacement's start.",
     "options": _C4_02_OPTIONS, "correct_index": 2,
     "explanation": "This is this lesson's own named Counterexample -- the rule requires the LAST opposite-color candle immediately before displacement, not any nearby candle of the 'wrong' expected color. Marking the green candle (not the adjacent red one) is simply an incorrect identification, not a valid order block by this rule."},
    {"prompt": "A red (down-close) candle is immediately followed by an ordinary, modest up-move with no genuine displacement (small range, close-location value near the middle).",
     "options": _C4_02_OPTIONS, "correct_index": 2,
     "explanation": "An order block requires genuine displacement (C2-08) to follow the candidate candle -- a random down-close candle before an undisplaced move is not a bullish order block, per this lesson's own explicit caveat."},
    {"prompt": "A green (up-close) candle is immediately followed by four large-range red candles, each closing in the bottom 10% of its own range.",
     "options": _C4_02_OPTIONS, "correct_index": 1,
     "explanation": "Strong bearish displacement (very high close-location value downward across multiple candles) confirmed -- the preceding green candle is the bearish order block."},
]

# ---------------------------------------------------------------------------
# C4-03 -- "Given six broken-zone examples across three charts
# (provided in Practise), identify which show a clean breaker-block
# reaction and which show the zone simply being invalidated with no
# further reaction." classify kind, including mitigation as a third
# distinct option per this lesson's own explicit distinction between
# the two concepts.
# ---------------------------------------------------------------------------
C4_03_TITLE = "Breaker Blocks and Mitigation Blocks"
_C4_03_OPTIONS = [
    "Breaker block -- the zone was genuinely invalidated (close-through), then later reacted in the OPPOSITE direction",
    "Invalidated, no further reaction -- a genuine close-through, but no clean opposite-direction reaction has occurred",
    "Mitigation only -- price traded deep into the zone, but it still holds its ORIGINAL role (never invalidated)",
]
C4_03_ITEMS = [
    {"prompt": "A bullish order block holds as support on its first retest. Weeks later, price closes decisively below it (genuine invalidation, per C2-09). Price later rallies back into that same zone and is rejected DOWNWARD.",
     "options": _C4_03_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: a real invalidation (close-through) followed by a reaction in the opposite direction (rejected downward, where it once held as support) -- a genuine breaker."},
    {"prompt": "A bearish order block gets closed through decisively (genuine invalidation). Price never returns to that zone again at all within the available chart history.",
     "options": _C4_03_OPTIONS, "correct_index": 1,
     "explanation": "The zone was genuinely invalidated, but since price never returned to react there at all, there's no evidence yet of a breaker -- this is just an invalidated zone with no further reaction, not a confirmed breaker. A breaker requires the actual opposite-direction reaction, not just the invalidation."},
    {"prompt": "A bullish order block has never closed through fully, but price has twice traded deep into the zone (well past its outer boundary wick-wise, using up much of its original imbalance) before reversing back up and holding support both times.",
     "options": _C4_03_OPTIONS, "correct_index": 2,
     "explanation": "No genuine close-through invalidation ever occurred -- the zone still holds its ORIGINAL bullish/support role. This is mitigation (price filling leftover orders, C4-04's zone-state concept), not a breaker, since a breaker specifically requires the zone to have been invalidated first."},
    {"prompt": "A bearish order block gets closed through decisively (genuine invalidation, confirmed per C2-09). Price later returns to that same zone and continues falling right through it with no reaction at all.",
     "options": _C4_03_OPTIONS, "correct_index": 1,
     "explanation": "Genuinely invalidated, and price did return -- but there was no reaction in the opposite direction (no rejection, no reversal); price simply continued through. This lesson's own named outcome: not every broken zone becomes a clean breaker."},
    {"prompt": "A bullish order block closes through decisively (confirmed invalidation). Price rallies back into the same zone months later and is cleanly rejected back downward, holding as resistance.",
     "options": _C4_03_OPTIONS, "correct_index": 0,
     "explanation": "Genuine invalidation followed by a clean opposite-direction reaction (resistance, where it once was support) -- a confirmed breaker, mirroring the lesson's own Worked Example."},
    {"prompt": "A bearish order block has price trade moderately into it twice, each time reversing back down and holding its original resistance role -- it has never closed through.",
     "options": _C4_03_OPTIONS, "correct_index": 2,
     "explanation": "No invalidation occurred at all -- the zone still functions in its original bearish/resistance role, just with some of its imbalance used up by two touches. Mitigation (and specifically a Tested/Mitigated zone-state per C4-04), not a breaker."},
]

# ---------------------------------------------------------------------------
# C4-04 -- "Given a zone's full price-interaction history across eight
# examples (provided in Practise), classify each zone's CURRENT
# lifecycle state (Fresh, Tested, Mitigated, or Invalid)." classify
# kind.
# ---------------------------------------------------------------------------
C4_04_TITLE = "Fresh / Tested / Mitigated / Invalid Zones"
_C4_04_OPTIONS = ["Fresh", "Tested", "Mitigated", "Invalid"]
C4_04_ITEMS = [
    {"prompt": "A bullish order block formed two days ago. Price has never returned to it since.", "options": _C4_04_OPTIONS, "correct_index": 0,
     "explanation": "Never touched since formation -- Fresh, the highest-confidence state."},
    {"prompt": "A bullish order block formed, and price has returned once, held right at the top of the zone, and reversed back up.", "options": _C4_04_OPTIONS, "correct_index": 1,
     "explanation": "Returned once and reacted, holding the zone's role -- Tested, per this lesson's own Worked Example."},
    {"prompt": "The same zone from the prior item: weeks later, price returns again and trades deep into the zone before finally reversing, without closing fully through.", "options": _C4_04_OPTIONS, "correct_index": 2,
     "explanation": "Traded well INTO the zone, using up a meaningful portion of it, without a full close-through -- Mitigated, using up much of its original imbalance even though it technically still held. This lesson's own Worked Example, continued."},
    {"prompt": "A bearish order block has price close fully through it, per C2-09's invalidation standard.", "options": _C4_04_OPTIONS, "correct_index": 3,
     "explanation": "A confirmed close-through -- Invalid in its original role (though C4-03's breaker concept means it may still matter in the opposite direction)."},
    {"prompt": "A bullish order block formed one hour ago on a 15-minute chart. No price interaction has occurred since.", "options": _C4_04_OPTIONS, "correct_index": 0,
     "explanation": "Untouched since formation, regardless of how recently it formed -- Fresh."},
    {"prompt": "A bearish order block has been touched twice already, each time with price trading moderately into it before reversing and holding its original role both times, never closing through.", "options": _C4_04_OPTIONS, "correct_index": 2,
     "explanation": "Multiple touches trading meaningfully into the zone without a full close-through -- this lesson's own Scenario Challenge describes exactly this as Mitigated, not merely Tested (which implies closer to a single clean hold)."},
    {"prompt": "A bullish order block has price return exactly once, touch right at the zone's edge, and reverse immediately with minimal penetration into the zone.", "options": _C4_04_OPTIONS, "correct_index": 1,
     "explanation": "One clean touch and hold, without trading deep into the zone -- Tested, distinct from the deeper-penetration Mitigated state."},
    {"prompt": "A very violent single return trades straight through a previously-untouched order block with a full close beyond it, with no intermediate hold ever occurring.", "options": _C4_04_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own named exception: a sufficiently violent single return can move a zone straight from Fresh to Invalid without a clean Tested or Mitigated phase in between."},
]

# ---------------------------------------------------------------------------
# C4-05 -- see module docstring for why this tests only the two
# conventions (body-only, full-range) with real, stated formulas.
# multi_calc: four linked numeric fields per candle (body low/high,
# full-range low/high), plus the explanation states whether a given
# later touch price would be scored a hold under each convention --
# all boundary values and hold/miss verdicts verified in Python.
# ---------------------------------------------------------------------------
C4_05_TITLE = "Zone Boundaries: Body vs. Full-Range vs. Wick-Inclusive"
C4_05_ITEMS = [
    {
        "title": "Candle 1 -- EUR/USD",
        "given": "Open=1.0900, High=1.0928, Low=1.0895, Close=1.0920. A later reaction touches 1.0898 and reverses.",
        "fields": [
            {"label": "Body low", "ask": "Body-only lower boundary", "unit": "", "correct_value": 1.0900, "tolerance": 0.0001},
            {"label": "Body high", "ask": "Body-only upper boundary", "unit": "", "correct_value": 1.0920, "tolerance": 0.0001},
            {"label": "Full low", "ask": "Full-range lower boundary", "unit": "", "correct_value": 1.0895, "tolerance": 0.0001},
            {"label": "Full high", "ask": "Full-range upper boundary", "unit": "", "correct_value": 1.0928, "tolerance": 0.0001},
        ],
        "explanation": "Body-only = open/close = [1.0900, 1.0920]. Full-range = low/high = [1.0895, 1.0928]. The touch at 1.0898 sits inside the full-range box but BELOW the body-only box -- this lesson's own Worked Example exactly: a hold under full-range, but a 'miss' under body-only, from the identical price action.",
    },
    {
        "title": "Candle 2 -- GBP/USD",
        "given": "Open=1.2650, High=1.2680, Low=1.2630, Close=1.2660. A later reaction touches 1.2655 and reverses.",
        "fields": [
            {"label": "Body low", "ask": "Body-only lower boundary", "unit": "", "correct_value": 1.2650, "tolerance": 0.0001},
            {"label": "Body high", "ask": "Body-only upper boundary", "unit": "", "correct_value": 1.2660, "tolerance": 0.0001},
            {"label": "Full low", "ask": "Full-range lower boundary", "unit": "", "correct_value": 1.2630, "tolerance": 0.0001},
            {"label": "Full high", "ask": "Full-range upper boundary", "unit": "", "correct_value": 1.2680, "tolerance": 0.0001},
        ],
        "explanation": "Body-only = [1.2650, 1.2660]. Full-range = [1.2630, 1.2680]. The touch at 1.2655 sits INSIDE the body itself -- both conventions score this as a hold. No disagreement here, unlike Candle 1.",
    },
    {
        "title": "Candle 3 -- AUD/USD",
        "given": "Open=0.6500, High=0.6525, Low=0.6480, Close=0.6510. A later reaction touches 0.6490 and reverses.",
        "fields": [
            {"label": "Body low", "ask": "Body-only lower boundary", "unit": "", "correct_value": 0.6500, "tolerance": 0.0001},
            {"label": "Body high", "ask": "Body-only upper boundary", "unit": "", "correct_value": 0.6510, "tolerance": 0.0001},
            {"label": "Full low", "ask": "Full-range lower boundary", "unit": "", "correct_value": 0.6480, "tolerance": 0.0001},
            {"label": "Full high", "ask": "Full-range upper boundary", "unit": "", "correct_value": 0.6525, "tolerance": 0.0001},
        ],
        "explanation": "Body-only = [0.6500, 0.6510]. Full-range = [0.6480, 0.6525]. The touch at 0.6490 is inside the wick but below the body -- a hold under full-range, a miss under body-only, same disagreement pattern as Candle 1.",
    },
    {
        "title": "Candle 4 -- BTC/USD",
        "given": "Open=43500, High=43650, Low=43400, Close=43600. A later reaction touches 43550 and reverses.",
        "fields": [
            {"label": "Body low", "ask": "Body-only lower boundary", "unit": "", "correct_value": 43500, "tolerance": 1},
            {"label": "Body high", "ask": "Body-only upper boundary", "unit": "", "correct_value": 43600, "tolerance": 1},
            {"label": "Full low", "ask": "Full-range lower boundary", "unit": "", "correct_value": 43400, "tolerance": 1},
            {"label": "Full high", "ask": "Full-range upper boundary", "unit": "", "correct_value": 43650, "tolerance": 1},
        ],
        "explanation": "Body-only = [43500, 43600]. Full-range = [43400, 43650]. The touch at 43550 sits inside the body itself -- both conventions agree this is a hold.",
    },
    {
        "title": "Candle 5 -- USD/JPY",
        "given": "Open=149.50, High=149.80, Low=149.20, Close=149.65. A later reaction touches 149.05 and reverses.",
        "fields": [
            {"label": "Body low", "ask": "Body-only lower boundary", "unit": "", "correct_value": 149.50, "tolerance": 0.01},
            {"label": "Body high", "ask": "Body-only upper boundary", "unit": "", "correct_value": 149.65, "tolerance": 0.01},
            {"label": "Full low", "ask": "Full-range lower boundary", "unit": "", "correct_value": 149.20, "tolerance": 0.01},
            {"label": "Full high", "ask": "Full-range upper boundary", "unit": "", "correct_value": 149.80, "tolerance": 0.01},
        ],
        "explanation": "Body-only = [149.50, 149.65]. Full-range = [149.20, 149.80]. The touch at 149.05 is BELOW even the full-range box -- a miss under both conventions. Not every reaction is a boundary-convention disagreement; sometimes price simply never reached the zone at all under either rule.",
    },
]

# ---------------------------------------------------------------------------
# C4-06 -- adapted the same way as seed_practice_scenarios_core3.py's
# C3-06: each item states explicitly which of this lesson's named
# confluence factors (nearby liquidity, structural alignment, HTF bias
# agreement, reasonable freshness) a given zone has, plus its relative
# age, and asks for the resulting quality tier -- a count of stated
# facts, not an invented score.
# ---------------------------------------------------------------------------
C4_06_TITLE = "Zone Age, Zone Quality, Confluence"
_C4_06_OPTIONS = [
    "High-quality, high-confluence candidate -- most/all factors stack together",
    "Mixed candidate -- roughly half the factors present, weight with real caution",
    "Low-quality candidate -- old and/or isolated, with little to no supporting confluence",
]
C4_06_ITEMS = [
    {"prompt": "A 4H bullish order block formed three days ago (reasonably fresh for this timeframe). It sits directly beneath a cluster of equal lows (sell-side liquidity). It aligns with a clean higher-timeframe protected low. The overall 4H trend is bullish (HTF bias agrees).",
     "options": _C4_06_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: fresh + nearby liquidity + structural alignment + agreeing HTF bias, all four factors stacked. A high-quality, high-confluence candidate."},
    {"prompt": "An order block from six months ago (old for its 4H timeframe), sitting with no nearby liquidity pool, no structural alignment, and against the current higher-timeframe bias.",
     "options": _C4_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Worked Example, the contrasting case: old, with zero supporting confluence factors, and against HTF bias -- technically still 'a valid order block' per C4-02's rule, but a much weaker trading candidate."},
    {"prompt": "An order block that's reasonably fresh for its timeframe and aligns with a clean structural level, but has no nearby liquidity pool and the higher-timeframe bias is currently neutral/unclear.",
     "options": _C4_06_OPTIONS, "correct_index": 1,
     "explanation": "Two supporting factors present (freshness, structural alignment) out of the four named in this lesson, with the other two absent or unclear -- a genuinely mixed case, not the strong 4-factor stack of the Worked Example, but not the zero-factor Counterexample either."},
    {"prompt": "An order block that is old for its timeframe and has no structural alignment, but happens to sit right beneath a fresh, dense equal-lows liquidity cluster, with the current HTF bias agreeing with its expected direction.",
     "options": _C4_06_OPTIONS, "correct_index": 1,
     "explanation": "Age counts against it and structural alignment is missing, but nearby liquidity and HTF bias agreement are both present -- a mixed picture, worth tracking with real caution rather than full confidence or outright dismissal."},
]


async def seed_core4_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C4_01_TITLE, "classify", C4_01_ITEMS)
        count += await _upsert(db, C4_02_TITLE, "classify", C4_02_ITEMS)
        count += await _upsert(db, C4_03_TITLE, "classify", C4_03_ITEMS)
        count += await _upsert(db, C4_04_TITLE, "classify", C4_04_ITEMS)
        count += await _upsert(db, C4_05_TITLE, "multi_calc", C4_05_ITEMS)
        count += await _upsert(db, C4_06_TITLE, "classify", C4_06_ITEMS)
        await db.commit()
        print(f"\n{count} of 6 CORE_4 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core4_scenarios())
    sys.exit(0)
