"""
Practice Scenario Set Seed Script — CORE_8 Risk Management Lessons
=======================================================================

Continuation of the practice-drill-scenario-sets effort (CORE_1,
CORE_3 through CORE_7 done; this covers all seven CORE_8 lessons,
C8-01 through C8-07 -- the largest remaining CORE module). No
bot_strategies.py equivalent exists for these concept-only lessons;
every formula and number below is taken directly from
CORE_8_RISK_MANAGEMENT.md's own Core Teaching / Worked Example / Key
Takeaways text (re-read in full immediately before writing this). ALL
arithmetic (lot sizing, R-multiple, reward-to-risk per target, margin,
cost-adjusted outcomes, naive vs. realized expectancy) was
independently computed and verified with a throwaway Python script
before being written down -- this module is almost entirely numeric,
so this check mattered more here than anywhere else in the effort so
far (one arithmetic slip was caught and fixed during verification for
a C8-02 R-multiple item, and a C8-07 item was reworked to actually
match the lesson's own named Counterexample pattern of a thin positive
naive edge flipping negative after costs).

Lesson titles below were checked against the LIVE DB -- all seven
matched exactly with no title drift.

Run after the other seed_practice_scenarios* scripts (shares their
_upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_core8
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# C8-01 -- "Given six scenarios with account equity, risk percent, and
# stop distance (provided in Practise), calculate the correct lot size
# for each using the fixed-fractional formula." numeric_calc kind.
# Lot Size = (Account Equity x Risk Percent) / Stop Distance. Item 1
# reuses this lesson's own Worked Example numbers verbatim.
# ---------------------------------------------------------------------------
C8_01_TITLE = "Risk Per Trade, Fixed Fractional Sizing"
C8_01_ITEMS = [
    {"label": "Scenario 1 (this lesson's own Worked Example)", "trades": [10000, 0.01, 50], "ask": "Lot size (units per point of stop distance)", "correct_value": 2.0, "tolerance": 0.05, "unit": "", "explanation": "Equity=$10,000, Risk=1% ($100), Stop=50 points. Lot Size = (10000 x 0.01) / 50 = 100 / 50 = 2."},
    {"label": "Scenario 2", "trades": [10000, 0.02, 40], "ask": "Lot size (units per point of stop distance)", "correct_value": 5.0, "tolerance": 0.05, "unit": "", "explanation": "(10000 x 0.02) / 40 = 200 / 40 = 5."},
    {"label": "Scenario 3", "trades": [5000, 0.01, 25], "ask": "Lot size (units per point of stop distance)", "correct_value": 2.0, "tolerance": 0.05, "unit": "", "explanation": "(5000 x 0.01) / 25 = 50 / 25 = 2."},
    {"label": "Scenario 4", "trades": [20000, 0.005, 100], "ask": "Lot size (units per point of stop distance)", "correct_value": 1.0, "tolerance": 0.05, "unit": "", "explanation": "(20000 x 0.005) / 100 = 100 / 100 = 1."},
    {"label": "Scenario 5 (post-losing-streak account, equity down to $7,000)", "trades": [7000, 0.02, 35], "ask": "Lot size (units per point of stop distance)", "correct_value": 4.0, "tolerance": 0.05, "unit": "", "explanation": "(7000 x 0.02) / 35 = 140 / 35 = 4 -- recalculated from CURRENT equity, exactly this lesson's own required discipline."},
    {"label": "Scenario 6", "trades": [15000, 0.015, 60], "ask": "Lot size (units per point of stop distance)", "correct_value": 3.75, "tolerance": 0.05, "unit": "", "explanation": "(15000 x 0.015) / 60 = 225 / 60 = 3.75."},
]

# ---------------------------------------------------------------------------
# C8-02 -- "Given eight trade outcomes with entry, stop, and exit
# prices provided (in Practise), calculate the R-multiple for each."
# numeric_calc kind. R = (Actual Price Move) / (Stop Distance), signed.
# Item 1 reuses this lesson's own Worked Example numbers verbatim.
# ---------------------------------------------------------------------------
C8_02_TITLE = "Stop-Loss, Invalidation, R-Multiple"
C8_02_ITEMS = [
    {"label": "Trade 1 -- long (this lesson's own Worked Example)", "trades": [1.0900, 1.0850, 1.1000], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 2.0, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 1.0900-1.0850 = 50 points (1R). Move to exit = 1.1000-1.0900 = 100 points = +2R."},
    {"label": "Trade 2 -- long, stop hit exactly", "trades": [1.0900, 1.0850, 1.0850], "ask": "R-multiple (entry, stop, exit given)", "correct_value": -1.0, "tolerance": 0.05, "unit": "R", "explanation": "Exit equals the stop price -- by definition, this is exactly -1R, the stop distance itself being the -1R reference point."},
    {"label": "Trade 3 -- short", "trades": [1.2600, 1.2650, 1.2500], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 2.0, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 1.2650-1.2600 = 50 points. Favorable move = 1.2600-1.2500 = 100 points = +2R (mirrored for a short)."},
    {"label": "Trade 4 -- long, BTC scale", "trades": [43500, 43300, 44100], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 3.0, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 43500-43300 = 200 points. Move = 44100-43500 = 600 points = +3R."},
    {"label": "Trade 5 -- short, stopped out beyond the stop", "trades": [1.0500, 1.0540, 1.0580], "ask": "R-multiple (entry, stop, exit given)", "correct_value": -2.0, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 1.0540-1.0500 = 40 points. Adverse move = 1.0580-1.0500 = 80 points = -2R (a slippage/gap-through scenario, worse than the defined -1R stop)."},
    {"label": "Trade 6 -- long", "trades": [0.6500, 0.6480, 0.6560], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 3.0, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 0.6500-0.6480 = 0.0020. Move = 0.6560-0.6500 = 0.0060 = +3R."},
    {"label": "Trade 7 -- short, JPY pair", "trades": [149.50, 149.80, 149.00], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 1.667, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 149.80-149.50 = 0.30. Favorable move = 149.50-149.00 = 0.50. R = 0.50/0.30 = 1.667."},
    {"label": "Trade 8 -- long, partial favorable move (less than 1R)", "trades": [1.1000, 1.0950, 1.1025], "ask": "R-multiple (entry, stop, exit given)", "correct_value": 0.5, "tolerance": 0.05, "unit": "R", "explanation": "Stop distance = 1.1000-1.0950 = 50 points. Move = 1.1025-1.1000 = 25 points = +0.5R -- a real, positive but sub-1R outcome."},
]

# ---------------------------------------------------------------------------
# C8-03 -- "Given six trade setups with entry, stop, and multiple
# targets (provided in Practise), calculate the reward-to-risk ratio
# for each target." multi_calc kind (three linked RR fields per
# setup). Setup 1 reuses this lesson's own Worked Example numbers
# verbatim.
# ---------------------------------------------------------------------------
C8_03_TITLE = "Reward-to-Risk, Partial Exits, Breakeven, Trailing"
C8_03_ITEMS = [
    {
        "title": "Setup 1 -- long (this lesson's own Worked Example)",
        "given": "Entry=1.0900, Stop=1.0850 (50-point risk). TP1=1.0950, TP2=1.1000, TP3=1.1050.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 3.0, "tolerance": 0.05},
        ],
        "explanation": "Stop distance = 50 points. TP1 (50pt away) = 1:1. TP2 (100pt away) = 2:1. TP3 (150pt away) = 3:1 -- this lesson's own Worked Example, verbatim.",
    },
    {
        "title": "Setup 2 -- long",
        "given": "Entry=1.2600, Stop=1.2550 (50-point risk). TP1=1.2650, TP2=1.2700, TP3=1.2750.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 3.0, "tolerance": 0.05},
        ],
        "explanation": "Same 1:1 / 2:1 / 3:1 pattern, same 50-point stop and 50-point target spacing.",
    },
    {
        "title": "Setup 3 -- long, BTC scale",
        "given": "Entry=43500, Stop=43300 (200-point risk). TP1=43700, TP2=43900, TP3=44100.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 3.0, "tolerance": 0.05},
        ],
        "explanation": "Stop distance = 200 points, targets at 200/400/600 points away = 1:1 / 2:1 / 3:1.",
    },
    {
        "title": "Setup 4 -- short",
        "given": "Entry=1.2700, Stop=1.2750 (50-point risk). TP1=1.2650, TP2=1.2600, TP3=1.2550.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 3.0, "tolerance": 0.05},
        ],
        "explanation": "Mirrored for a short -- same 1:1 / 2:1 / 3:1 pattern measured downward from entry.",
    },
    {
        "title": "Setup 5 -- long, JPY pair (uneven target spacing)",
        "given": "Entry=149.50, Stop=149.20 (0.30-point risk). TP1=149.65, TP2=149.80, TP3=150.10.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 0.5, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
        ],
        "explanation": "Stop distance = 0.30. TP1 (0.15 away) = 0.5:1 -- not every target needs to be a round multiple. TP2 (0.30 away) = 1:1. TP3 (0.60 away) = 2:1.",
    },
    {
        "title": "Setup 6 -- short",
        "given": "Entry=0.6500, Stop=0.6540 (0.0040-point risk). TP1=0.6460, TP2=0.6420, TP3=0.6340.",
        "fields": [
            {"label": "RR1", "ask": "Reward-to-risk at TP1", "unit": "", "correct_value": 1.0, "tolerance": 0.05},
            {"label": "RR2", "ask": "Reward-to-risk at TP2", "unit": "", "correct_value": 2.0, "tolerance": 0.05},
            {"label": "RR3", "ask": "Reward-to-risk at TP3", "unit": "", "correct_value": 4.0, "tolerance": 0.05},
        ],
        "explanation": "Stop distance = 0.0040. TP1 (0.0040 away) = 1:1. TP2 (0.0080 away) = 2:1. TP3 (0.0160 away) = 4:1 -- a wider final target than the usual 3:1 pattern, same ratio math.",
    },
]

# ---------------------------------------------------------------------------
# C8-04 -- "Given five sets of open positions (provided in Practise),
# identify which sets show meaningful correlation and estimate the
# effective combined exposure versus the sum of the individually-
# stated risk percentages." classify kind.
# ---------------------------------------------------------------------------
C8_04_TITLE = "Max Daily/Weekly Loss, Correlated Exposure"
_C8_04_OPTIONS = [
    "Meaningfully correlated -- effective exposure is closer to the FULL SUM of individual risk percentages, not independent",
    "Not meaningfully correlated -- individual risk percentages are genuinely closer to independent",
]
C8_04_ITEMS = [
    {"prompt": "Five open positions, each individually risking 1%: EUR/USD long, GBP/USD long, AUD/USD long, NZD/USD long, XAU/USD long -- all effectively bets against USD strength.", "options": _C8_04_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: all five share the same underlying driver (USD strength) -- a single USD-strengthening event could move all five against the trader at once. Real effective exposure looks much more like a single ~5% bet than five independent 1% bets."},
    {"prompt": "Three open positions, each individually risking 1.5%, all in precious metals: Gold, Silver, Platinum.", "options": _C8_04_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Scenario Challenge, verbatim: precious metals commonly share a common underlying driver (real yields, USD strength, safe-haven flows) -- real effective exposure is likely closer to a single concentrated ~4.5% bet than three genuinely independent 1.5% positions, though confirming this requires actually checking what's driving each one, not assuming it from the instrument names alone."},
    {"prompt": "Two open positions, each individually risking 1%: a long on a tech-sector equity index and a short on an agricultural commodity, with no obvious shared macro driver between them.", "options": _C8_04_OPTIONS, "correct_index": 1,
     "explanation": "No shared underlying driver is evident between an equity-index long and an agricultural-commodity short -- these are genuinely closer to independent bets, and the combined 2% exposure is a reasonable estimate of the real effective risk."},
    {"prompt": "Four open positions, each individually risking 1%, all long on different cryptocurrency pairs (BTC/USD, ETH/USD, SOL/USD, XRP/USD) during a period when crypto assets are moving together closely.", "options": _C8_04_OPTIONS, "correct_index": 0,
     "explanation": "Crypto assets moving together closely during this period is exactly the correlated-exposure pattern this lesson describes -- the real effective exposure is closer to the full 4% sum than four independent 1% bets."},
    {"prompt": "Two open positions, each individually risking 1%: a long on EUR/USD based on a European Central Bank-driven setup, and a short on USD/JPY based on an entirely separate Bank of Japan-driven setup, with each position's thesis resting on a different central bank's independent decision.", "options": _C8_04_OPTIONS, "correct_index": 1,
     "explanation": "While both involve USD, each position's actual thesis rests on a different, independent driver (ECB policy vs. BoJ policy) rather than one shared macro event moving both the same way -- a more genuinely independent pairing than the lesson's own all-USD-long Worked Example, where every position shared the identical directional driver."},
]

# ---------------------------------------------------------------------------
# C8-05 -- "Given six trade scenarios with leverage, margin, spread,
# and fee figures (provided in Practise), calculate the margin
# required and the real, cost-adjusted outcome for each." multi_calc
# kind: Margin = Notional / Leverage; Realized Outcome = Nominal
# Outcome - (spread cost + commission). Scenario 1 reuses this
# lesson's own Worked Example numbers verbatim.
# ---------------------------------------------------------------------------
C8_05_TITLE = "Leverage, Margin, Spread, Slippage, Fees"
C8_05_ITEMS = [
    {
        "title": "Scenario 1 (this lesson's own Worked Example)",
        "given": "Position notional value = $10,000. Leverage = 20:1. Nominal (pre-cost) trade outcome = +$250. Round-trip spread cost = $15. Commission = $5.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 500.0, "tolerance": 5},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": 230.0, "tolerance": 2},
        ],
        "explanation": "Margin = Notional / Leverage = 10000 / 20 = $500 -- this lesson's own Worked Example, verbatim: only 1/20th of the position's notional value needs to be set aside. Realized outcome = 250 - 15 - 5 = $230 -- the actual dollar risk and gain are unchanged by leverage itself; only the real costs (spread, commission) reduce the nominal result.",
    },
    {
        "title": "Scenario 2",
        "given": "Position notional value = $5,000. Leverage = 50:1. Nominal (pre-cost) trade outcome = -$100. Round-trip spread cost = $15. Commission = $5.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 100.0, "tolerance": 2},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": -120.0, "tolerance": 2},
        ],
        "explanation": "Margin = 5000 / 50 = $100. Realized outcome = -100 - 15 - 5 = -$120 -- costs apply on losing trades too, making the real loss larger than the nominal one.",
    },
    {
        "title": "Scenario 3",
        "given": "Position notional value = $20,000. Leverage = 10:1. Nominal (pre-cost) trade outcome = +$400. Round-trip spread cost = $20. Commission = $8.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 2000.0, "tolerance": 20},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": 372.0, "tolerance": 4},
        ],
        "explanation": "Margin = 20000 / 10 = $2,000 -- lower leverage ties up proportionally more capital for the identical trade. Realized outcome = 400 - 20 - 8 = $372.",
    },
    {
        "title": "Scenario 4",
        "given": "Position notional value = $15,000. Leverage = 30:1. Nominal (pre-cost) trade outcome = -$150. Round-trip spread cost = $10. Commission = $4.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 500.0, "tolerance": 5},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": -164.0, "tolerance": 2},
        ],
        "explanation": "Margin = 15000 / 30 = $500. Realized outcome = -150 - 10 - 4 = -$164.",
    },
    {
        "title": "Scenario 5",
        "given": "Position notional value = $8,000. Leverage = 25:1. Nominal (pre-cost) trade outcome = +$250 (same dollar risk/reward as Scenario 1, but at a different leverage ratio). Round-trip spread cost = $15. Commission = $5.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 320.0, "tolerance": 4},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": 230.0, "tolerance": 2},
        ],
        "explanation": "Margin = 8000 / 25 = $320 -- a different margin figure from Scenario 1 purely because notional and leverage differ, but the realized outcome math (250 - 15 - 5 = $230) is identical, this lesson's own point that leverage and actual dollar risk/reward are separate decisions.",
    },
    {
        "title": "Scenario 6",
        "given": "Position notional value = $12,000. Leverage = 40:1. Nominal (pre-cost) trade outcome = +$180. Round-trip spread cost = $12. Commission = $6.",
        "fields": [
            {"label": "Margin", "ask": "Margin required", "unit": "$", "correct_value": 300.0, "tolerance": 3},
            {"label": "Realized outcome", "ask": "Real, cost-adjusted outcome", "unit": "$", "correct_value": 162.0, "tolerance": 2},
        ],
        "explanation": "Margin = 12000 / 40 = $300. Realized outcome = 180 - 12 - 6 = $162.",
    },
]

# ---------------------------------------------------------------------------
# C8-06 -- "Given four trader scenarios (provided in Practise),
# identify whether each shows a working kill switch, a circuit
# breaker, or neither, and explain what was missing in any case
# showing neither." classify kind.
# ---------------------------------------------------------------------------
C8_06_TITLE = "Kill Switches and Circuit Breakers"
_C8_06_OPTIONS = ["Kill switch (manual, deliberate stop)", "Circuit breaker (automated stop)", "Neither -- no actual stop occurred"]
C8_06_ITEMS = [
    {"prompt": "A trader's account hits a serious, unexpected drawdown following a major surprise news event. Recognizing this is outside their normal plan, they manually trigger their emergency stop, closing open positions and halting new trades for the rest of the day.", "options": _C8_06_OPTIONS, "correct_index": 0,
     "explanation": "This lesson's own Worked Example, verbatim: a deliberate, decisive manual action taken under real pressure -- a kill switch working exactly as intended."},
    {"prompt": "A trading system automatically halts all new trading the instant the account's daily loss reaches a predefined threshold, with no human decision required in the moment.", "options": _C8_06_OPTIONS, "correct_index": 1,
     "explanation": "An automated system enforcing a stop once a predefined condition is met, removing the in-the-moment human judgment call -- this lesson's own definition of a circuit breaker."},
    {"prompt": "A trader has configured no automated stop and has never actually tested whether their manual emergency-stop process works end to end. During a genuinely stressful drawdown, they hesitate, rationalize 'just one more trade to get it back,' and the stop never actually gets used.", "options": _C8_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own Counterexample, verbatim: an untested, purely-hypothetical kill switch provides none of its intended protection in the moment it's actually needed -- neither mechanism actually functioned here."},
    {"prompt": "A trader's account approaches a serious drawdown. They have no automated daily-loss system configured at all, and rather than manually stopping, they tell themselves 'I'll just stop if it gets worse' without ever actually taking the deliberate stop action.", "options": _C8_06_OPTIONS, "correct_index": 2,
     "explanation": "This lesson's own named failure mode, verbatim: assuming you'll 'just manually stop' is not the same as a kill switch actually being used, and there is no automated circuit breaker here either. Neither mechanism actually functioned -- the stop everyone assumed would happen never happened."},
]

# ---------------------------------------------------------------------------
# C8-07 -- "Given five backtested setups with naive win rate and
# reward-to-risk figures, plus realistic cost estimates (provided in
# Practise), calculate both naive and cost-adjusted realized
# expectancy for each, and identify which setups survive the
# adjustment and which don't." multi_calc kind. Naive expectancy =
# (WinRate x RR) - (1 - WinRate); Realized = Naive - Cost. Setup 1
# reuses this lesson's own Worked Example numbers verbatim; Setup 4
# reconstructed to actually match this lesson's own named
# Counterexample pattern (a thin +0.05R positive naive edge flipping
# negative after costs).
# ---------------------------------------------------------------------------
C8_07_TITLE = "Why a \"3:1 Setup\" Does Not Equal 3:1 Realized Expectancy"
C8_07_ITEMS = [
    {
        "title": "Setup 1 (this lesson's own Worked Example)",
        "given": "Win rate = 30%. Reward-to-risk = 3:1. Estimated round-trip cost = 0.05R per trade.",
        "fields": [
            {"label": "Naive", "ask": "Naive expectancy (ignoring costs)", "unit": "R", "correct_value": 0.20, "tolerance": 0.01},
            {"label": "Realized", "ask": "Cost-adjusted realized expectancy", "unit": "R", "correct_value": 0.15, "tolerance": 0.01},
        ],
        "explanation": "Naive = (0.30 x 3) - 0.70 = 0.90 - 0.70 = +0.20R. Realized = 0.20 - 0.05 = +0.15R -- this lesson's own Worked Example, verbatim: still positive, but 25% smaller than the naive figure suggested.",
    },
    {
        "title": "Setup 2",
        "given": "Win rate = 40%. Reward-to-risk = 2:1. Estimated round-trip cost = 0.08R per trade.",
        "fields": [
            {"label": "Naive", "ask": "Naive expectancy (ignoring costs)", "unit": "R", "correct_value": 0.20, "tolerance": 0.01},
            {"label": "Realized", "ask": "Cost-adjusted realized expectancy", "unit": "R", "correct_value": 0.12, "tolerance": 0.01},
        ],
        "explanation": "Naive = (0.40 x 2) - 0.60 = 0.80 - 0.60 = +0.20R. Realized = 0.20 - 0.08 = +0.12R -- a comfortably positive naive edge survives this cost level.",
    },
    {
        "title": "Setup 3",
        "given": "Win rate = 20%. Reward-to-risk = 5:1. Estimated round-trip cost = 0.10R per trade.",
        "fields": [
            {"label": "Naive", "ask": "Naive expectancy (ignoring costs)", "unit": "R", "correct_value": 0.20, "tolerance": 0.01},
            {"label": "Realized", "ask": "Cost-adjusted realized expectancy", "unit": "R", "correct_value": 0.10, "tolerance": 0.01},
        ],
        "explanation": "Naive = (0.20 x 5) - 0.80 = 1.00 - 0.80 = +0.20R. Realized = 0.20 - 0.10 = +0.10R -- a low win rate / high RR setup can carry the identical naive edge as Setups 1-2, but loses a larger proportion of it here.",
    },
    {
        "title": "Setup 4 -- this lesson's own named Counterexample pattern",
        "given": "Win rate = 35%. Reward-to-risk = 2:1. Estimated round-trip cost = 0.08R per trade.",
        "fields": [
            {"label": "Naive", "ask": "Naive expectancy (ignoring costs)", "unit": "R", "correct_value": 0.05, "tolerance": 0.01},
            {"label": "Realized", "ask": "Cost-adjusted realized expectancy", "unit": "R", "correct_value": -0.03, "tolerance": 0.01},
        ],
        "explanation": "Naive = (0.35 x 2) - 0.65 = 0.70 - 0.65 = +0.05R -- a real but thin positive edge. Realized = 0.05 - 0.08 = -0.03R. This lesson's own Counterexample, verbatim: a thin naive edge of +0.05R, once real costs exceeding that thin margin are honestly included, flips to a genuine loss -- this setup does NOT survive the cost adjustment.",
    },
    {
        "title": "Setup 5",
        "given": "Win rate = 50%. Reward-to-risk = 1.2:1. Estimated round-trip cost = 0.15R per trade.",
        "fields": [
            {"label": "Naive", "ask": "Naive expectancy (ignoring costs)", "unit": "R", "correct_value": 0.10, "tolerance": 0.01},
            {"label": "Realized", "ask": "Cost-adjusted realized expectancy", "unit": "R", "correct_value": -0.05, "tolerance": 0.01},
        ],
        "explanation": "Naive = (0.50 x 1.2) - 0.50 = 0.60 - 0.50 = +0.10R. Realized = 0.10 - 0.15 = -0.05R -- another thin naive edge erased by real costs, this time from a high-win-rate/low-RR setup rather than Setup 4's low-win-rate/moderate-RR one. Does NOT survive the adjustment."},
]


async def seed_core8_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, C8_01_TITLE, "numeric_calc", C8_01_ITEMS)
        count += await _upsert(db, C8_02_TITLE, "numeric_calc", C8_02_ITEMS)
        count += await _upsert(db, C8_03_TITLE, "multi_calc", C8_03_ITEMS)
        count += await _upsert(db, C8_04_TITLE, "classify", C8_04_ITEMS)
        count += await _upsert(db, C8_05_TITLE, "multi_calc", C8_05_ITEMS)
        count += await _upsert(db, C8_06_TITLE, "classify", C8_06_ITEMS)
        count += await _upsert(db, C8_07_TITLE, "multi_calc", C8_07_ITEMS)
        await db.commit()
        print(f"\n{count} of 7 CORE_8 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_core8_scenarios())
    sys.exit(0)
