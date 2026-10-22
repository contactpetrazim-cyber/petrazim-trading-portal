"""
Practice Scenario Set Seed Script — CORE_6 Premium / Discount Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1,
CORE_3, CORE_4, CORE_5 done; this covers all three CORE_6 lessons,
C6-01 through C6-03). No bot_strategies.py equivalent exists for these
concept-only lessons; every rule and number below is taken directly
from CORE_6_PREMIUM_DISCOUNT.md's own Core Teaching / Worked Example /
Key Takeaways text (re-read in full immediately before writing this).
All equilibrium arithmetic was independently computed and verified
with a throwaway Python script before being written down.

Lesson titles below were checked against the LIVE DB -- all three
matched exactly with no title drift.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core6
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C6-01 -- "Given six charts with a clearly marked external leg each
# (provided in Practise), calculate the exact equilibrium price for
# each dealing range." numeric_calc kind. Item 1 reuses this lesson's
# own Worked Example numbers verbatim.
# ---------------------------------------------------------------------------
C6_01_TITLE = "Dealing Range, External Leg, Equilibrium"
C6_01_ITEMS = [
    {"label": "Range 1 -- EUR/USD (this lesson's own Worked Example)", "trades": [1.0800, 1.1000], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 1.0900, "tolerance": 0.0002, "unit": "", "explanation": "(1.0800 + 1.1000) / 2 = 1.0900 -- exactly the midpoint. This lesson's own Worked Example, verbatim."},
    {"label": "Range 2 -- GBP/USD", "trades": [1.2500, 1.2700], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 1.2600, "tolerance": 0.0002, "unit": "", "explanation": "(1.2500 + 1.2700) / 2 = 1.2600."},
    {"label": "Range 3 -- AUD/USD", "trades": [0.6400, 0.6600], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 0.6500, "tolerance": 0.0002, "unit": "", "explanation": "(0.6400 + 0.6600) / 2 = 0.6500."},
    {"label": "Range 4 -- BTC/USD", "trades": [43000, 45000], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 44000.0, "tolerance": 10, "unit": "", "explanation": "(43000 + 45000) / 2 = 44000."},
    {"label": "Range 5 -- USD/JPY", "trades": [149.00, 151.00], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 150.0, "tolerance": 0.05, "unit": "", "explanation": "(149.00 + 151.00) / 2 = 150.00."},
    {"label": "Range 6 -- EUR/USD (asymmetric, non-round range)", "trades": [1.0950, 1.1150], "ask": "Equilibrium ((high + low) / 2)", "correct_value": 1.1050, "tolerance": 0.0002, "unit": "", "explanation": "(1.0950 + 1.1150) / 2 = 1.1050 -- the same arithmetic midpoint rule applies regardless of where the range happens to sit."},
]

# ---------------------------------------------------------------------------
# C6-02 -- "Given ten price points across five dealing ranges
# (provided in Practise), classify each as premium or discount, and
# state the preferred direction bias for each." classify kind.
# Items 1-2 reuse this lesson's own Worked Example numbers verbatim.
# ---------------------------------------------------------------------------
C6_02_TITLE = "Premium and Discount, Long/Short Location"
_C6_02_OPTIONS = [
    "Discount (below equilibrium) -- favors longs",
    "Premium (above equilibrium) -- favors shorts",
    "Exactly at equilibrium -- a boundary case, no strong location preference either way",
]
C6_02_ITEMS = [
    {"prompt": "Dealing range 1.0800-1.1000 (equilibrium 1.0900). Current price = 1.0850.", "options": _C6_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: 1.0850 is below equilibrium (1.0900) -- discount, favoring longs, with more favorable range-based reward-to-risk geometry."},
    {"prompt": "Same dealing range (1.0800-1.1000, equilibrium 1.0900). Current price = 1.0980.", "options": _C6_02_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example's contrast, verbatim: 1.0980 is above equilibrium -- deep in premium, favoring shorts, with less favorable reward-to-risk geometry for a long taken here."},
    {"prompt": "Dealing range 1.2500-1.2700 (equilibrium 1.2600). Current price = 1.2650.", "options": _C6_02_OPTIONS, "correct_index": 1,
     "explanation": "1.2650 > 1.2600 (equilibrium) -- premium, favoring shorts."},
    {"prompt": "Same dealing range (1.2500-1.2700, equilibrium 1.2600). Current price = 1.2540.", "options": _C6_02_OPTIONS, "correct_index": 0,
     "explanation": "1.2540 < 1.2600 (equilibrium) -- discount, favoring longs."},
    {"prompt": "Dealing range 0.6400-0.6600 (equilibrium 0.6500). Current price = 0.6500 exactly.", "options": _C6_02_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own named boundary case: a price exactly AT equilibrium has no strong location preference either way."},
    {"prompt": "Same dealing range (0.6400-0.6600, equilibrium 0.6500). Current price = 0.6420.", "options": _C6_02_OPTIONS, "correct_index": 0,
     "explanation": "0.6420 < 0.6500 -- discount, favoring longs."},
    {"prompt": "Dealing range 43000-45000 (equilibrium 44000). Current price = 44700.", "options": _C6_02_OPTIONS, "correct_index": 1,
     "explanation": "44700 > 44000 -- premium, favoring shorts, at BTC scale."},
    {"prompt": "Same dealing range (43000-45000, equilibrium 44000). Current price = 43300.", "options": _C6_02_OPTIONS, "correct_index": 0,
     "explanation": "43300 < 44000 -- discount, favoring longs."},
    {"prompt": "Dealing range 149.00-151.00 (equilibrium 150.00). Current price = 150.60.", "options": _C6_02_OPTIONS, "correct_index": 1,
     "explanation": "150.60 > 150.00 -- premium, favoring shorts."},
    {"prompt": "Same dealing range (149.00-151.00, equilibrium 150.00). A colleague wants to buy here purely 'because the trend is up,' with price at 150.85 (deep in premium) and no other confirming setup evidence.", "options": _C6_02_OPTIONS, "correct_index": 1,
     "explanation": "150.85 is deep in premium -- favoring shorts by location, the opposite of what the colleague wants to do. This lesson's own Scenario Challenge, verbatim: being in premium doesn't manufacture a valid long out of nothing, and taking one here goes directly against the location filter rather than combining with it."},
]

# ---------------------------------------------------------------------------
# C6-03 -- "Given four charts each showing two nested dealing ranges
# (provided in Practise), classify a marked price against both ranges
# and note where the readings agree versus conflict." classify kind,
# plus confluence-strength items per the lesson's second half.
# ---------------------------------------------------------------------------
C6_03_TITLE = "Multiple Dealing Ranges, Interaction With Liquidity/Zones"
_C6_03_OPTIONS = [
    "Agree -- discount on both scales",
    "Agree -- premium on both scales",
    "Conflict -- discount on the larger scale, premium on the smaller nested scale",
    "Conflict -- premium on the larger scale, discount on the smaller nested scale",
]
C6_03_ITEMS = [
    {"prompt": "4H dealing range: 1.0800-1.1000 (equilibrium 1.0900). Nested 15m dealing range inside it: 1.0840-1.0880 (equilibrium 1.0860). Current price = 1.0870.", "options": _C6_03_OPTIONS, "correct_index": 2,
     "explanation": "On the 4H range, 1.0870 is BELOW the 4H equilibrium of 1.0900 -- discount on the larger 4H scale. On the 15m range, 1.0870 is ABOVE the 15m equilibrium of 1.0860 -- premium on the smaller nested scale. This lesson's own Worked Example pattern, verbatim (a price can be discount on one scale and premium on another, both validly) -- the trader needs to be explicit about which scale their setup is actually built on."},
    {"prompt": "4H dealing range: 1.2500-1.2700 (equilibrium 1.2600). Nested 15m dealing range: 1.2520-1.2560 (equilibrium 1.2540). Current price = 1.2530.", "options": _C6_03_OPTIONS, "correct_index": 0,
     "explanation": "On 4H: 1.2530 < 1.2600 -- discount. On 15m: 1.2530 < 1.2540 -- also discount. Both scales agree here -- a case where the readings line up, unlike the lesson's own Worked Example."},
    {"prompt": "4H dealing range: 43000-45000 (equilibrium 44000). Nested 15m dealing range: 44100-44500 (equilibrium 44300). Current price = 44200.", "options": _C6_03_OPTIONS, "correct_index": 3,
     "explanation": "On 4H: 44200 > 44000 -- premium. On 15m: 44200 < 44300 -- discount. Premium on the larger scale, discount on the smaller nested scale -- the mirror conflict case."},
    {"prompt": "4H dealing range: 149.00-151.00 (equilibrium 150.00). Nested 15m dealing range: 150.20-150.80 (equilibrium 150.50). Current price = 150.65.", "options": _C6_03_OPTIONS, "correct_index": 1,
     "explanation": "On 4H: 150.65 > 150.00 -- premium. On 15m: 150.65 > 150.50 -- also premium. Both scales agree."},
]
_C6_03_CONFLUENCE_OPTIONS = [
    "Strong setup -- favorable location, a genuine liquidity pool, AND a valid zone all agree at this price",
    "Weaker setup -- favorable location alone, with no liquidity pool or zone confirming it",
]
C6_03_ITEMS += [
    {"prompt": "Price sits in discount on the 4H dealing range, directly at a fresh 4H order block (Core 4), with sell-side liquidity resting just below it (Core 3).", "options": _C6_03_CONFLUENCE_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Scenario Challenge, verbatim: discount location, a genuine liquidity pool, and a valid zone all agree at the same price -- three independent factors stacking together, a meaningfully stronger setup than location alone."},
    {"prompt": "Price sits in discount on the 4H dealing range, but there is no nearby order block and no liquidity pool anywhere near this price -- discount location is the only factor present.", "options": _C6_03_CONFLUENCE_OPTIONS, "correct_index": 1,
     "explanation": "Favorable location by itself, with neither of the other two confirming factors -- this lesson's own point that location alone is weaker evidence than the three lining up together."},
]


async def seed_core6_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C6_01_TITLE, "numeric_calc", C6_01_ITEMS)
        count += await _upsert(db, C6_02_TITLE, "classify", C6_02_ITEMS)
        count += await _upsert(db, C6_03_TITLE, "classify", C6_03_ITEMS)
        await db.commit()
        print(f"\n{count} of 3 CORE_6 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core6_scenarios())
    sys.exit(0)
