"""
Practice Scenario Set Seed Script — CORE_5 Fair Value Gaps Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1,
CORE_3, CORE_4 done; this covers all four CORE_5 lessons, C5-01
through C5-04). No bot_strategies.py equivalent exists for these
concept-only lessons; every rule and number below is taken directly
from CORE_5_FAIR_VALUE_GAPS.md's own Core Teaching / Worked Example /
Key Takeaways text (re-read in full immediately before writing this).
The C5-01 non-overlap comparisons were independently checked with a
throwaway Python script before being written down.

Lesson titles below were checked against the LIVE DB -- all four
matched exactly with no title drift.

C5-02 note: the lesson's own text never states a precise minimum-size
fraction of ATR ("some fraction of ATR... the specific threshold
varies across frameworks"). Per this effort's own rule against
inventing a number the source material doesn't commit to, every item
uses sizes that sit clearly on one side or the other of this lesson's
own two named Worked Example numbers (an 80-point gap against a
50-point ATR = worth tracking; an 8-point gap against the same ATR =
filtered out) rather than a borderline case that would require
guessing an exact cutoff fraction.

C5-04 note: like C3-06/C4-06, the "score and rank eight FVGs" drill is
adapted into a per-item factor-count classification (displacement
quality, confluence, fill state -- the three factors this lesson
itself names), the same pattern used for liquidity pools and zones.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core5
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C5-01 -- "Given fifteen three-candle sequences (provided in
# Practise), identify which show a valid bullish FVG, which show a
# valid bearish FVG, and which show no FVG at all." classify kind.
# Eight items (not fifteen, to keep the set reviewable), including the
# lesson's own Worked Example and its own Scenario Challenge's
# near-miss case verbatim.
# ---------------------------------------------------------------------------
C5_01_TITLE = "What Imbalance Means, FVG Formation"
_C5_01_OPTIONS = ["Bullish FVG", "Bearish FVG", "No FVG (candle 1 and candle 3's ranges overlap)"]
C5_01_ITEMS = [
    {"prompt": "Candle 1 high = 1.0900. Candle 2: large, fast bullish candle. Candle 3 low = 1.0915.", "options": _C5_01_OPTIONS, "correct_index": 0,
     "explanation": "Candle 1's high (1.0900) sits below candle 3's low (1.0915) -- the range 1.0900-1.0915 was never traded by either candle. This lesson's own Worked Example, verbatim: a genuine bullish FVG."},
    {"prompt": "Candle 1 high = 1.0910. Candle 2: fast bullish candle. Candle 3 low = 1.0908.", "options": _C5_01_OPTIONS, "correct_index": 2,
     "explanation": "Candle 3's low (1.0908) is actually BELOW candle 1's high (1.0910) -- the ranges overlap by 2 pips. This lesson's own Scenario Challenge, verbatim: close, but not quite non-overlapping, so this does NOT qualify as an FVG. Precision in the exact rule matters."},
    {"prompt": "Candle 1 low = 1.2650. Candle 2: large, fast bearish candle. Candle 3 high = 1.2630.", "options": _C5_01_OPTIONS, "correct_index": 1,
     "explanation": "Candle 1's low (1.2650) sits above candle 3's high (1.2630) -- the mirror condition for a bearish FVG. The range 1.2630-1.2650 was never traded."},
    {"prompt": "Candle 1 low = 1.2650. Candle 2: fast bearish candle. Candle 3 high = 1.2648.", "options": _C5_01_OPTIONS, "correct_index": 1,
     "explanation": "Candle 1's low (1.2650) is still above candle 3's high (1.2648), even though the gap is tiny (2 pips) -- the non-overlap condition is met, so this technically qualifies as a (very small) bearish FVG per C5-01's rule alone. (Whether it's big enough to bother tracking is a separate question -- C5-02's minimum-size filter.)"},
    {"prompt": "Candle 1 high = 43,500. Candle 2: large, fast bullish candle. Candle 3 low = 43,520.", "options": _C5_01_OPTIONS, "correct_index": 0,
     "explanation": "43,500 < 43,520 -- a genuine bullish FVG at BTC scale, same rule."},
    {"prompt": "Candle 1 high = 43,500. Candle 2: fast bullish candle. Candle 3 low = 43,495.", "options": _C5_01_OPTIONS, "correct_index": 2,
     "explanation": "Candle 3's low (43,495) is below candle 1's high (43,500) -- the ranges overlap, so there's no gap left untraded. No FVG."},
    {"prompt": "Candle 1 is a Monday-morning candle opening well away from Friday's close (a session gap per C1-06). Only two candles are being checked here, not three.", "options": ["Bullish FVG", "Bearish FVG", "Cannot determine -- this lesson's FVG rule requires checking THREE consecutive candles' non-overlap, not a two-candle session-open gap"], "correct_index": 2,
     "explanation": "This lesson's own Counterexample: a session gap (C1-06) and an FVG are identified by different rules. Calling a two-candle session-open gap an FVG, without checking all three candles' exact highs and lows, is exactly the mistake this lesson warns against."},
    {"prompt": "Candle 1 low = 0.6500. Candle 2: large, fast bearish candle. Candle 3 high = 0.6495.", "options": _C5_01_OPTIONS, "correct_index": 1,
     "explanation": "0.6500 > 0.6495 -- candle 1's low sits above candle 3's high. A genuine bearish FVG."},
]

# ---------------------------------------------------------------------------
# C5-02 -- "Given ten FVGs with their sizes and the instrument's
# current ATR provided (in Practise), determine which meet a
# reasonable minimum-size threshold and which don't." classify kind.
# Per the module docstring, every item sits clearly on one side of
# this lesson's own two named Worked Example numbers (80pt vs 50pt ATR
# = worth tracking; 8pt vs 50pt ATR = filtered), not a borderline case
# needing an invented exact fraction.
# ---------------------------------------------------------------------------
C5_02_TITLE = "Bullish/Bearish FVG, Minimum Gap"
_C5_02_OPTIONS = ["Well above a reasonable minimum -- worth tracking", "Tiny relative to ATR -- reasonably filtered out as noise"]
C5_02_ITEMS = [
    {"prompt": "Instrument's current ATR is roughly 50 points. A bullish FVG measures 80 points wide.", "options": _C5_02_OPTIONS, "correct_index": 0,
     "explanation": "80 points against a 50-point ATR (1.6x ATR) -- this lesson's own Worked Example, verbatim: well above threshold, worth tracking."},
    {"prompt": "Instrument's current ATR is roughly 50 points. A different, technically-valid FVG on the same chart measures 8 points wide.", "options": _C5_02_OPTIONS, "correct_index": 1,
     "explanation": "8 points against a 50-point ATR (0.16x ATR) -- this lesson's own Worked Example, verbatim: tiny relative to ATR, reasonably filtered out as insignificant noise despite meeting C5-01's formation rule."},
    {"prompt": "Instrument's current ATR is roughly 0.0030 (30 pips) on EUR/USD. A bullish FVG measures 0.0050 (50 pips) wide.", "options": _C5_02_OPTIONS, "correct_index": 0,
     "explanation": "50 pips against a 30-pip ATR (about 1.7x ATR) -- clearly well above the instrument's normal candle range, same proportion as the lesson's own 80-vs-50 example."},
    {"prompt": "Instrument's current ATR is roughly 0.0030 (30 pips) on EUR/USD. A different FVG on the same chart measures 0.0004 (4 pips) wide.", "options": _C5_02_OPTIONS, "correct_index": 1,
     "explanation": "4 pips against a 30-pip ATR (about 0.13x ATR) -- tiny relative to normal price movement, same proportion as the lesson's own 8-vs-50 example. Reasonably filtered."},
    {"prompt": "Instrument's current ATR is roughly 300 points on BTC/USD. A bullish FVG measures 550 points wide.", "options": _C5_02_OPTIONS, "correct_index": 0,
     "explanation": "550 points against a 300-point ATR (about 1.8x ATR) -- well above threshold, same proportion as the Worked Example, worth tracking."},
    {"prompt": "Instrument's current ATR is roughly 300 points on BTC/USD. A different FVG on the same chart measures 25 points wide.", "options": _C5_02_OPTIONS, "correct_index": 1,
     "explanation": "25 points against a 300-point ATR (about 0.08x ATR) -- even smaller, proportionally, than the lesson's own filtered example. Reasonably filtered as noise."},
]

# ---------------------------------------------------------------------------
# C5-03 -- "Given eight FVGs with their full price-interaction history
# (provided in Practise), classify each as unfilled, partially filled,
# fully filled, or (fully filled AND) inverted." classify kind. Items
# 1-3 reuse this lesson's own Worked Example numbers verbatim
# (1.0900-1.0915 bullish FVG).
# ---------------------------------------------------------------------------
C5_03_TITLE = "FVG Fill: Partial, Full, Inversion, Retracement"
_C5_03_OPTIONS = ["Unfilled", "Partially filled", "Fully filled", "Fully filled AND inverted (confirmed opposite-direction reaction)"]
C5_03_ITEMS = [
    {"prompt": "A bullish FVG spans 1.0900 to 1.0915. Price has never returned to it since it formed.", "options": _C5_03_OPTIONS, "correct_index": 0,
     "explanation": "No retracement at all yet -- unfilled, the FVG's original state."},
    {"prompt": "Same FVG (1.0900-1.0915). Price later dips to 1.0910 (covering roughly a third of the gap) and reverses back up.", "options": _C5_03_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: a dip to 1.0910 covers roughly a third of the gap, leaving two-thirds still untraded -- a partial fill."},
    {"prompt": "Same FVG (1.0900-1.0915). Weeks later, price trades cleanly through the ENTIRE 1.0900-1.0915 range, continuing lower, with no return and no reaction afterward.", "options": _C5_03_OPTIONS, "correct_index": 2,
     "explanation": "The entire gap has been traded through -- a full fill. No subsequent reaction has been observed yet, so it's fully filled but NOT (yet) a confirmed inversion -- this lesson's own Counterexample point: a full fill alone doesn't automatically confirm inversion."},
    {"prompt": "Same FVG (1.0900-1.0915), continuing the prior item: price later returns to that same (now fully-filled) zone and is cleanly rejected UPWARD from beneath it, the opposite of its original bullish bias.", "options": _C5_03_OPTIONS, "correct_index": 3,
     "explanation": "Fully filled, AND a confirmed opposite-direction reaction (rejected upward -- now acting as resistance rather than its original bullish/support bias) -- this lesson's own Worked Example's completion: a genuine, confirmed inversion."},
    {"prompt": "A bearish FVG has price trade into roughly half of it before reversing back down, leaving the remainder untraded.", "options": _C5_03_OPTIONS, "correct_index": 1,
     "explanation": "Real, untraded range remains -- a partial fill, mirrored for a bearish FVG."},
    {"prompt": "A bearish FVG gets closed through entirely by a single strong candle. No further price interaction with that zone has occurred since.", "options": _C5_03_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the gap is fully filled by the close-through, but you cannot yet call this an inversion -- no confirming opposite-direction reaction has been observed. Fully filled, not (yet) inverted."},
    {"prompt": "A bullish FVG gets fully filled by a strong bearish candle, and the trader immediately labels the zone 'now bearish' without waiting to see any reaction there.", "options": _C5_03_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: assuming inversion the instant a full fill occurs, without any observed reaction, is a mistake -- correctly, this zone is only fully filled so far, not confirmed inverted."},
    {"prompt": "A bearish FVG is fully filled, and price later returns to the same zone and is rejected back DOWNWARD from above it -- the opposite of its original bearish/resistance bias.", "options": _C5_03_OPTIONS, "correct_index": 3,
     "explanation": "Fully filled plus a confirmed opposite-direction reaction (rejected downward, now acting as support rather than resistance) -- a genuine inversion, mirrored for a bearish FVG."},
]

# ---------------------------------------------------------------------------
# C5-04 -- adapted the same way as C3-06/C4-06: each item states
# explicitly which of this lesson's three named factors (displacement
# quality, confluence, fill state) a given FVG has, and asks for the
# resulting quality tier.
# ---------------------------------------------------------------------------
C5_04_TITLE = "FVG vs. Ordinary Price Noise: When Not to Trade It"
_C5_04_OPTIONS = [
    "Strong candidate -- scores well on displacement, confluence, AND fill state",
    "Mixed candidate -- scores well on some factors, poorly on others",
    "Weak candidate -- weak displacement, no confluence, and mostly/fully filled",
]
C5_04_ITEMS = [
    {"prompt": "FVG 1: Displacement -- genuinely strong, well above the C5-02 minimum size. Confluence -- sits directly beneath a fresh order block and aligns with a nearby liquidity pool. Fill state -- fully unfilled.",
     "options": _C5_04_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: strong on all three named factors -- a strong candidate."},
    {"prompt": "FVG 2: Displacement -- barely meets the minimum size threshold. Confluence -- no nearby order block, liquidity pool, or favorable HTF bias. Fill state -- already mostly filled once.",
     "options": _C5_04_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Worked Example's contrasting case, verbatim: weak on all three factors despite meeting every formal rule from C5-01-C5-03 -- a weak candidate, 'technically an FVG, not worth acting on.'"},
    {"prompt": "FVG 3: Displacement -- genuinely strong, well above minimum size. Confluence -- no nearby order block or liquidity pool at all. Fill state -- fully unfilled.",
     "options": _C5_04_OPTIONS, "correct_index": 1,
     "explanation": "Strong on displacement and fill state, but missing confluence entirely -- a mixed case, better than the all-weak Worked Example contrast but not the fully-stacked strong case."},
    {"prompt": "FVG 4: Displacement -- barely meets minimum size. Confluence -- aligns with a nearby liquidity pool AND favorable higher-timeframe bias. Fill state -- fully unfilled.",
     "options": _C5_04_OPTIONS, "correct_index": 1,
     "explanation": "Weak displacement quality, but strong confluence and fill state -- a mixed candidate. This lesson's own point that a technically-valid FVG with partial supporting evidence sits between the two named extremes, not automatically in either one."},
]


async def seed_core5_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C5_01_TITLE, "classify", C5_01_ITEMS)
        count += await _upsert(db, C5_02_TITLE, "classify", C5_02_ITEMS)
        count += await _upsert(db, C5_03_TITLE, "classify", C5_03_ITEMS)
        count += await _upsert(db, C5_04_TITLE, "classify", C5_04_ITEMS)
        await db.commit()
        print(f"\n{count} of 4 CORE_5 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core5_scenarios())
    sys.exit(0)
