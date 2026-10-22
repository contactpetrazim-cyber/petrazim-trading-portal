"""
Practice Scenario Set Seed Script — ORDER_FLOW_TRADING Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort, moving to
priority-2 scope now that CORE_1 through CORE_9 are done. Covers all
eleven Order Flow Trading lessons (OF-01 through OF-11). No
bot_strategies.py equivalent exists for most of this module by its own
explicit design -- the module's own opening note (re-read in full
immediately before writing this, along with every individual lesson)
states plainly that none of this platform's 5 bots read tape,
footprint/delta, DOM, or volume-profile data anywhere in the codebase;
only Bot 4 reads a single aggregate `candle.volume` figure (BOT4-04).
Every rule, number, and worked scenario below is taken directly from
ORDER_FLOW_TRADING.md's own Core Teaching / Worked Example / Key
Takeaways text for each lesson. Where arithmetic is involved (OF-03's
POC-vs-equilibrium comparison, OF-04's delta-divergence pairs), the
numbers were independently computed and verified with a throwaway
Python script before being written down.

Lesson titles below were checked against the LIVE DB -- all eleven
matched exactly with no title drift.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_order_flow
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# OF-01 -- "Given three descriptions of price action (provided in
# Practise), identify what a candle-only view would show versus what
# genuine order flow data would additionally reveal for each."
# classify kind.
# ---------------------------------------------------------------------------
OF_01_TITLE = "Concept: What Order Flow Actually Is"
_OF_01_OPTIONS = [
    "Whether the move was driven by aggressive buying, aggressive selling, or large orders being absorbed without moving price",
    "Nothing additional -- a candle already shows everything genuine order flow data would reveal",
]
OF_01_ITEMS = [
    {"prompt": "A 1-hour candle closes higher than it opened, with total volume of 1,200 units. A candle-only view shows the net bullish result and the volume total. What would genuine order flow data additionally reveal?", "options": _OF_01_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: order flow would show whether that volume was mostly aggressive buying pushing price up, or a smaller number of large sell orders being absorbed without pushing price down -- two very different stories behind an identical-looking candle."},
    {"prompt": "A trader points out that Bot 4 reads a `candle.volume` field and concludes the platform is 'already doing order flow analysis.'", "options": _OF_01_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Counterexample, verbatim: a single aggregate volume number, used only for an 80%-of-20-candle-average check, is a world away from reading individual trade prints, bid/ask aggression, or order-book depth -- real order flow would still reveal information this platform's one volume field cannot."},
    {"prompt": "Two different trading sessions produce visually identical bullish candles with identical total volume. A candle-only view cannot tell them apart. What would genuine order flow (tape, aggressor-side data) additionally reveal that could distinguish them?", "options": _OF_01_OPTIONS, "correct_index": 0,
     "explanation": "The same total volume can come from sustained one-sided aggression or from a large order being absorbed with no real directional conviction -- order flow data distinguishes these; the candle and its single volume figure cannot."},
]

# ---------------------------------------------------------------------------
# OF-02 -- "Given four short tape sequences (provided in Practise,
# with price, size, and aggressor side per trade), determine which
# show sustained one-sided pressure and which show balanced two-sided
# activity." classify kind. Items 1-2 reuse this lesson's own Worked
# Example and Counterexample numbers verbatim.
# ---------------------------------------------------------------------------
OF_02_TITLE = "Reading the Tape: Time & Sales and Aggressor Side"
_OF_02_OPTIONS = ["Sustained one-sided pressure", "Balanced two-sided activity"]
OF_02_ITEMS = [
    {"prompt": "30-second window, six consecutive trades, all printing AT THE ASK, sizes 50/80/120/60/200/90.", "options": _OF_02_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: six consecutive ask-side prints reads as sustained aggressive buying -- buyers repeatedly willing to pay up."},
    {"prompt": "Same 30-second window, same total volume (600 units), but alternating bid/ask prints of roughly equal size.", "options": _OF_02_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample, verbatim: buyers and sellers trading at similar urgency -- a genuinely different market condition from the first example, even though the aggregate volume figure alone would look identical."},
    {"prompt": "A 20-second window shows eight consecutive trades, all printing AT THE BID, sizes 40/90/150/110/70/200/85/60.", "options": _OF_02_OPTIONS, "correct_index": 0,
     "explanation": "Eight consecutive bid-side prints reads as sustained aggressive selling -- sellers repeatedly willing to accept the buyer's price immediately, the mirror of the ask-side case."},
    {"prompt": "A 45-second window shows ten trades with no more than two consecutive prints on the same side at any point, roughly equal total size on each side.", "options": _OF_02_OPTIONS, "correct_index": 1,
     "explanation": "No sustained run on either side, and roughly equal totals -- balanced two-sided activity, not a one-sided pressure read."},
]

# ---------------------------------------------------------------------------
# OF-03 -- "Given three volume-profile datasets (provided in
# Practise), identify the POC, VAH, and VAL for each, and compare each
# POC against the range's geometric midpoint." numeric_calc kind
# (POC value), with the geometric-equilibrium comparison stated in the
# explanation. All datasets verified with Python (POC = the price with
# the highest listed volume; equilibrium = (range high + range low)/2).
# ---------------------------------------------------------------------------
OF_03_TITLE = "Volume Profile: Value Area, POC, and Auction Market Theory"
OF_03_ITEMS = [
    {"label": "Dataset 1 -- EUR/USD session", "trades": [1.0860, 1.0865, 1.0870, 1.0875, 1.0880, 1.0885, 1.0890], "ask": "POC (the single price with the most volume: 400/900/1500/2200/1600/950/420 units at these prices in order, range 1.0800-1.1000)", "correct_value": 1.0875, "tolerance": 0.0002, "unit": "", "explanation": "1.0875 carries the most volume (2,200 units) of any listed price -- the POC. Range 1.0800-1.1000's geometric equilibrium = 1.0900 -- the POC (1.0875) sits BELOW the geometric equilibrium, a real, verified divergence between the two reference points, this lesson's own central point."},
    {"label": "Dataset 2 -- BTC/USD session", "trades": [43300, 43400, 43500, 43600, 43700], "ask": "POC (volumes 300/1800/2600/1400/600 units at these prices in order, range 43000-44000)", "correct_value": 43500, "tolerance": 10, "unit": "", "explanation": "43500 carries the most volume (2,600 units) -- the POC. Range 43000-44000's geometric equilibrium = 43500 -- here the POC and equilibrium happen to COINCIDE, a reminder that they CAN land at the same price; the lesson's point is that they aren't automatically the same, not that they're never the same."},
    {"label": "Dataset 3 -- GBP/USD session", "trades": [1.2510, 1.2520, 1.2550, 1.2580, 1.2600, 1.2630], "ask": "POC (volumes 1900/800/500/650/300/400 units at these prices in order, range 1.2500-1.2650)", "correct_value": 1.2510, "tolerance": 0.0002, "unit": "", "explanation": "1.2510 carries by far the most volume (1,900 units) -- the POC. Range 1.2500-1.2650's geometric equilibrium = 1.2575 -- the POC sits well BELOW equilibrium here, since most trading activity actually concentrated near the lower end of the range, this lesson's own named Counterexample pattern exactly."},
]

# ---------------------------------------------------------------------------
# OF-04 -- "Given four pairs of consecutive price moves with their
# delta values (provided in Practise), identify which pairs show a
# genuine delta divergence." classify kind. Item 1 reuses this
# lesson's own Worked Example numbers verbatim. All pairs verified in
# Python (divergence = the new price extreme's delta magnitude is
# SMALLER than the prior extreme's).
# ---------------------------------------------------------------------------
OF_04_TITLE = "Footprint Charts and Bid/Ask Delta"
_OF_04_OPTIONS = ["Genuine delta divergence (new extreme, weaker delta)", "No divergence (new extreme, delta confirms with equal or stronger magnitude)"]
OF_04_ITEMS = [
    {"prompt": "Move 1: new high, candle delta +850. Move 2: an even higher high, candle delta +310.", "options": _OF_04_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: +310 is much weaker than +850 despite reaching a higher price -- a bearish delta divergence."},
    {"prompt": "Move 1: new high, candle delta +400. Move 2: an even higher high, candle delta +600.", "options": _OF_04_OPTIONS, "correct_index": 1,
     "explanation": "Delta GREW (+600 vs +400) alongside the higher high -- genuine confirmation, not divergence. More aggressive buying drove the higher price, consistent with healthy continuation."},
    {"prompt": "Move 1: new low, candle delta -700. Move 2: an even lower low, candle delta -250.", "options": _OF_04_OPTIONS, "correct_index": 0,
     "explanation": "-250 is much weaker (smaller magnitude) than -700, despite reaching a lower price -- a bullish delta divergence, the mirror case for a downtrend extreme."},
    {"prompt": "Move 1: new low, candle delta -300. Move 2: an even lower low, candle delta -550.", "options": _OF_04_OPTIONS, "correct_index": 1,
     "explanation": "Delta grew in magnitude (-550 vs -300) alongside the lower low -- genuine confirmation, not divergence."},
]

# ---------------------------------------------------------------------------
# OF-05 -- "Given three DOM scenarios (provided in Practise) describing
# resting size and subsequent executed activity, determine which show
# genuine intent and which show likely spoofing behavior." classify
# kind. Items 1-2 reuse this lesson's own Worked Example and
# Counterexample verbatim.
# ---------------------------------------------------------------------------
OF_05_TITLE = "The Order Book and DOM: Visible Liquidity vs. Real Intent"
_OF_05_OPTIONS = ["Likely genuine intent -- confirmed by real executed volume", "Likely spoofing -- cancelled without real executed volume confirming it"]
OF_05_ITEMS = [
    {"prompt": "A DOM shows an unusually large resting sell order just above current price. A trader treats it as strong resistance. Price approaches, the order is cancelled without ever trading, and price continues higher.", "options": _OF_05_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Worked Example, verbatim: the order vanished without any real executed volume confirming it -- the 'resistance' was never real. Likely spoofing."},
    {"prompt": "The same large resting sell order stays in place as price approaches it, and a genuine wave of aggressive selling, visible on the tape, actually executes against it, stalling price there.", "options": _OF_05_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Counterexample, verbatim: real executed volume (the tape) confirmed the resting size this time -- genuine intent, observable only by checking what actually traded, not the resting size alone."},
    {"prompt": "A large resting buy order sits well below current price for an extended period. As price approaches, substantial real volume executes against it on the tape, and price stalls and reverses upward from that level.", "options": _OF_05_OPTIONS, "correct_index": 0,
     "explanation": "Real executed volume confirmed the resting order as price reached it -- genuine intent, the mirror of the Counterexample on the buy side."},
]

# ---------------------------------------------------------------------------
# OF-06 -- "Given six volume/price-movement scenarios (provided in
# Practise), classify each as absorption, exhaustion, ordinary
# displacement, or none of these." classify kind. Items reuse this
# lesson's own Worked Example and Counterexample verbatim where
# applicable.
# ---------------------------------------------------------------------------
OF_06_TITLE = "Absorption and Exhaustion"
_OF_06_OPTIONS = ["Absorption (high volume, little price movement)", "Exhaustion (shrinking volume at a new price extreme)", "Ordinary displacement (high volume WITH significant price movement)", "None of these"]
OF_06_ITEMS = [
    {"prompt": "Price approaches a resistance level. A large volume spike occurs, but price barely moves.", "options": _OF_06_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: heavy aggressive buying absorbed by resting sell orders without price actually breaking through. Absorption."},
    {"prompt": "Price makes a new high with a LARGE volume spike that actually moves price significantly further.", "options": _OF_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: high volume WITH significant price movement is genuine displacement (C2-08), not absorption -- the distinguishing factor is price-movement-per-unit-of-volume, not the volume spike alone."},
    {"prompt": "Price pushes to three consecutive new highs. Volume on the first push is substantial; volume on the second is noticeably lower; volume on the third, the highest price of the three, is lower still, even though price is still technically advancing.", "options": _OF_06_OPTIONS, "correct_index": 1,
     "explanation": "Shrinking volume as price reaches a new extreme, even though price is still advancing -- this lesson's own definition of exhaustion: fewer participants willing to keep pushing further."},
    {"prompt": "A candle shows moderate volume, roughly in line with recent average, and a moderate price move, also roughly in line with recent candles -- nothing unusual in either dimension.", "options": _OF_06_OPTIONS, "correct_index": 3,
     "explanation": "No high-volume-low-movement combination (absorption), no shrinking volume at a new extreme (exhaustion), and no particularly large volume-with-movement (displacement) -- an ordinary, unremarkable candle. None of these."},
    {"prompt": "Price approaches a demand zone. A large volume spike occurs right at that level, and price barely moves for several candles before reversing upward.", "options": _OF_06_OPTIONS, "correct_index": 0,
     "explanation": "High volume, little resulting price movement, right at a level -- absorption, the mirror of the Worked Example on the buy side, and this lesson's own named pattern that often precedes a reversal."},
    {"prompt": "A trader sees a large volume spike right at a key level and immediately calls it 'absorption' without checking what price actually did in response -- it turns out price moved significantly further on that same volume.", "options": _OF_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Scenario Challenge, verbatim: the volume spike alone isn't enough -- checking what price actually did reveals this was ordinary displacement (significant movement accompanied the volume), not absorption."},
]

# ---------------------------------------------------------------------------
# OF-07 -- "Given five order-flow scenarios (provided in Practise),
# identify which of the three named setups (if any) applies, and
# whether a second confirming signal is present." classify kind.
# ---------------------------------------------------------------------------
OF_07_TITLE = "Order Flow Setups: Divergence, Absorption Reversals, and POC Rejection"
_OF_07_OPTIONS = [
    "Delta Divergence Reversal -- CONFIRMED by a second signal (absorption or a structural level)",
    "Absorption Reversal -- CONFIRMED by a second signal",
    "POC Rejection/Acceptance -- CONFIRMED by a second signal",
    "A real signal is present, but UNCONFIRMED -- no second signal agrees, weaker evidence",
]
OF_07_ITEMS = [
    {"prompt": "Price makes a new high with delta divergence (weaker aggressive buying than the prior high) AND a volume spike shows absorption right at that new high.", "options": _OF_07_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: delta divergence reinforced by absorption at the same price -- a confirmed Delta Divergence Reversal setup."},
    {"prompt": "A trader sees delta divergence alone, with no absorption and no proximity to any known structural level (a liquidity pool or a POC).", "options": _OF_07_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own Counterexample, verbatim: a single unconfirmed signal is weaker evidence than one reinforced by a second -- treating it as a complete setup on its own is the exact mistake this lesson warns against."},
    {"prompt": "Heavy volume is absorbed at a level with little price movement, and that same level sits exactly at a known liquidity pool from Core 3.", "options": _OF_07_OPTIONS, "correct_index": 1,
     "explanation": "Absorption (OF-06) reinforced by a known structural level (C3-02) -- a confirmed Absorption Reversal setup."},
    {"prompt": "Price returns to a prior session's POC and rejects it (bounces away), with a confirming delta divergence also present at the same price.", "options": _OF_07_OPTIONS, "correct_index": 2,
     "explanation": "POC rejection (OF-03) confirmed by a second, independent signal (delta divergence) -- a confirmed POC Rejection setup."},
    {"prompt": "Price returns to a prior session's POC and bounces away from it, but no delta divergence, no absorption, and no other confirming evidence is present at that moment.", "options": _OF_07_OPTIONS, "correct_index": 3,
     "explanation": "A real POC rejection signal is present, but with nothing else confirming it -- a genuine but unconfirmed single signal, weaker than the same event with a second agreeing signal."},
]

# ---------------------------------------------------------------------------
# OF-08 -- "Given five DOM/price scenarios (provided in Practise),
# classify each as likely spoofing, a genuine iceberg order, a stop
# hunt/liquidity sweep, or none of these." classify kind.
# ---------------------------------------------------------------------------
OF_08_TITLE = "Common Order Flow Manipulation: Spoofing, Layering, and Stop Hunts"
_OF_08_OPTIONS = ["Likely spoofing (no real intent to fill, cancelled)", "Genuine iceberg order (real size, shown in small pieces)", "Stop hunt / liquidity sweep (same observable event, two names)", "None of these"]
OF_08_ITEMS = [
    {"prompt": "A large sell order appears on the DOM well above current price. As price approaches, the order is cancelled without ever trading.", "options": _OF_08_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: visible size cancelled before it could ever be tested by real volume -- a likely spoof, using the OF-05 mechanism deliberately."},
    {"prompt": "A visible resting order of modest size keeps refilling at the same price level every time it's filled, well beyond what its visible size alone would suggest, repeatedly over an extended period.", "options": _OF_08_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own definition: a genuine large order displayed in small visible pieces, refilling as each piece actually fills -- distinct from a spoof, which has no real size or intent to fill behind it at all."},
    {"prompt": "Price pushes just far enough to trigger a cluster of resting stop-loss orders below a recent swing low, which become market sell orders once triggered, and price then reverses back up once that forced liquidity is consumed.", "options": _OF_08_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own framing, verbatim: mechanically identical to C3-04's liquidity sweep -- the SAME observable price action described with (stop hunt) or without (liquidity sweep) an unprovable intent claim."},
    {"prompt": "Multiple large resting orders appear simultaneously at several different nearby price levels, creating an impression of unusually deep support, and all of them get cancelled in sequence as price approaches each one.", "options": _OF_08_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own definition of layering -- multiple spoofed orders at several levels simultaneously, to create a false impression of depth. A form of spoofing."},
    {"prompt": "A moderate resting order sits at a price level, gets filled completely by genuine, steady two-sided trading activity over the session with no unusual cancellation pattern, and no cluster of stop-losses was ever near that level.", "options": _OF_08_OPTIONS, "correct_index": 3,
     "explanation": "No spoofing (it filled genuinely, no suspicious cancellation), no iceberg behavior described (no refilling pattern noted), and no stop-loss cluster being triggered -- ordinary, unremarkable order flow. None of these."},
]

# ---------------------------------------------------------------------------
# OF-09 -- "Given four trader decision narratives (provided in
# Practise), identify which of the four named mistakes (if any) each
# one makes." classify kind.
# ---------------------------------------------------------------------------
OF_09_TITLE = "Common Mistakes in Order Flow Trading"
_OF_09_OPTIONS = [
    "Over-reading a single signal (no second confirmation, OF-07)",
    "Ignoring timeframe context (no higher-timeframe structure check, Core 7)",
    "Treating DOM size as commitment (the OF-05 mistake)",
    "Assuming intent from price alone (the OF-08 mistake)",
    "No mistake -- correctly applies this lesson's discipline",
]
OF_09_ITEMS = [
    {"prompt": "A trader sees a single absorption spike on a 1-minute chart and enters immediately, without checking the 1-hour structure that 1-minute move is happening inside, or waiting for a second confirming signal.", "options": _OF_09_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim, combines mistakes 1 AND 2 in the same trade -- but the single best-match answer here is over-reading a single signal, since no second confirmation was sought at all (the timeframe-context failure is a compounding second issue noted in the same example)."},
    {"prompt": "A trader avoids going long purely because a large resting sell order sits on the DOM, without waiting to see whether real executed volume ever confirms it.", "options": _OF_09_OPTIONS, "correct_index": 2,
     "explanation": "This is the exact OF-05 mistake, named explicitly in this lesson as mistake #3: treating visible DOM size as a firm commitment rather than confirming it against executed volume."},
    {"prompt": "A trader insists a specific liquidity sweep 'must have been' a deliberate stop hunt by a large institution, treating intent as provable from price action alone.", "options": _OF_09_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own named mistake #4: claiming unprovable intent from price data alone, rather than describing the event observably as this curriculum's C3-04 framing does."},
    {"prompt": "A different trader sees the same absorption spike as the first scenario, checks that it aligns with a genuine liquidity level on the higher timeframe, and waits for a second confirming signal (a delta divergence) before entering.", "options": _OF_09_OPTIONS, "correct_index": 4,
     "explanation": "This lesson's own Counterexample, verbatim: the same absorption evidence, applied WITH the multi-confirmation and timeframe-context discipline this lesson requires -- no mistake."},
]

# ---------------------------------------------------------------------------
# OF-10 -- "Given four SMC concepts from Core 3-6 (provided in
# Practise), correctly match each to its order-flow counterpart from
# this module and state what additional, independent information that
# counterpart would add." classify kind.
# ---------------------------------------------------------------------------
OF_10_TITLE = "Order Flow + SMC Synthesis"
_OF_10_OPTIONS = ["OF-03 (POC / Value Area)", "OF-04 (Delta divergence)", "OF-06 (Absorption)", "OF-08 (Stop hunt / spoofing)"]
OF_10_ITEMS = [
    {"prompt": "C3-04's liquidity sweep -- which order-flow lesson describes the SAME observable event, from a different vantage point?", "options": _OF_10_OPTIONS, "correct_index": 3,
     "explanation": "This lesson's own first named pairing, verbatim: a liquidity sweep (C3-04) and a stop hunt (OF-08) describe the same observable price event -- the difference is only an added, unprovable intent claim."},
    {"prompt": "C4-02's order block -- marking where institutional displacement ORIGINATED. Which order-flow concept is one possible signature of that same origin, if tick data were available?", "options": _OF_10_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own pairing, verbatim: absorption (OF-06) is one possible order-flow signature at the same origin an order block marks -- related, independently-learned concepts."},
    {"prompt": "C5-01's Fair Value Gap -- marking a PRICE imbalance. Which order-flow concept marks a related but independent VOLUME/participation imbalance?", "options": _OF_10_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own pairing, verbatim: an FVG (C5-01) marks a price imbalance; delta divergence (OF-04) marks a volume/participation imbalance -- related but independent signals that can agree or disagree."},
    {"prompt": "C6-02's premium/discount -- describing LOCATION within a dealing range. Which order-flow concept describes a different way of asking 'where is this range's fair value'?", "options": _OF_10_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own pairing, verbatim: premium/discount (C6-02) describes geometric location; POC and Value Area (OF-03) describe where volume actually concentrated -- two different lenses on the same question."},
]

# ---------------------------------------------------------------------------
# OF-11 -- Capstone. "Given three full order-flow scenarios (provided
# in Practise, at least one that should be correctly read as
# incomplete), work through all five checks for each and produce a
# final verdict." classify kind, matching every BOT-track capstone's
# own honest None-is-valid discipline.
# ---------------------------------------------------------------------------
OF_11_TITLE = "Capstone: Full Order Flow Read"
_OF_11_OPTIONS = [
    "COMPLETE setup -- at least two of the five checks genuinely agree",
    "INCOMPLETE setup -- only one check (if any) is satisfied; insufficient confirmation",
]
OF_11_ITEMS = [
    {"prompt": "Sustained aggressive selling on the tape (check 1: pass). Delta divergence at a new low, weaker than the prior low (check 2: pass). Absorption visible at that same low, heavy volume, little further downside (check 3: pass). That low sits almost exactly at the prior session's POC (check 4: pass). Four of five checks agree.", "options": _OF_11_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: four of five checks agree -- a well-confirmed Absorption Reversal / Delta Divergence setup at a POC. Clearly COMPLETE."},
    {"prompt": "A clean delta divergence at a fresh price extreme (check 1: pass). Balanced, two-sided tape activity, no sustained pressure either way (check 2: fail). No absorption visible (check 3: fail). No DOM confirmation checked (check 4: n/a). No proximity to any POC or liquidity level (check 5: fail).", "options": _OF_11_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Counterexample, verbatim: only one signal (the delta divergence) is present, with nothing else confirming it -- the correct capstone answer is 'incomplete setup -- one signal only,' not a forced trade recommendation."},
    {"prompt": "A compelling absorption spike at a key level (check 1: pass), but no delta divergence (check 2: fail), no DOM confirmation (check 3: fail), and no POC proximity (check 4: fail).", "options": _OF_11_OPTIONS, "correct_index": 1,
     "explanation": "This lesson's own Scenario Challenge, verbatim: one strong, compelling signal alone is still just one signal -- the honest, correct verdict is incomplete, not a forced trade call based on how compelling that single signal feels."},
]


async def seed_order_flow_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, OF_01_TITLE, "classify", OF_01_ITEMS)
        count += await _upsert(db, OF_02_TITLE, "classify", OF_02_ITEMS)
        count += await _upsert(db, OF_03_TITLE, "numeric_calc", OF_03_ITEMS)
        count += await _upsert(db, OF_04_TITLE, "classify", OF_04_ITEMS)
        count += await _upsert(db, OF_05_TITLE, "classify", OF_05_ITEMS)
        count += await _upsert(db, OF_06_TITLE, "classify", OF_06_ITEMS)
        count += await _upsert(db, OF_07_TITLE, "classify", OF_07_ITEMS)
        count += await _upsert(db, OF_08_TITLE, "classify", OF_08_ITEMS)
        count += await _upsert(db, OF_09_TITLE, "classify", OF_09_ITEMS)
        count += await _upsert(db, OF_10_TITLE, "classify", OF_10_ITEMS)
        count += await _upsert(db, OF_11_TITLE, "classify", OF_11_ITEMS)
        await db.commit()
        print(f"\n{count} of 11 ORDER_FLOW scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_order_flow_scenarios())
    sys.exit(0)
