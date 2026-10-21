"""
Practice Scenario Set Seed Script
=====================================

By direct bug report ("the drills prompts are not follow through ...
only the summary shows"): dozens of authored '### Practice Drill'
prompts across the curriculum literally say "given five signal cards
(provided in Practise), ..." or "a 40% win-rate coin-flip simulator
(provided in Practise), ..." — but nothing ever built the signal
cards, chart sequences, numeric logs, or simulator those prompts refer
to. PracticeDrillsPage only ever rendered the prompt's own TEXT.

This seeds the first real wave of PracticeScenarioSet rows — one per
"kind" the frontend's ScenarioDrillPanel knows how to render (see
routers/practise.py) — covering one lesson from each promised-material
shape found in the curriculum: a coin-flip tool, a numeric-calculation
drill, a swing-point classification drill, a bot signal-card
identification drill, and an open chart-reflection drill. The
remaining 90+ drills across every bot/core lesson that make the same
"(provided in Practise)" promise are the explicitly-scoped next phase
(the SMC Bot Academy overhaul), not invented here.

Every item below is either textbook-correct math (the ORIENT-02
expectancy logs — a general stats point, not bot-specific) or traced
directly against this app's own real code just before writing it (the
BOT1-01 signal cards — see the comment on BOT1_SIGNAL_CARDS below for
the exact bot_strategies.py lines each card's timeframe/R:R fingerprint
came from). Nothing here is AI-generated or invented to "look plausible".

Idempotent — safe to re-run after adding a new scenario set; upserts
by lesson_id rather than refusing like seed_curriculum.py, since this
seeds alongside already-live lessons rather than creating them.

Run after the practice_scenario_sets table exists (create_all handles
this automatically on next app startup):
    python -m app.scripts.seed_practice_scenarios
"""

from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.curriculum import Lesson, LearningTrack, PracticeScenarioSet

# ---------------------------------------------------------------------------
# ORIENT-01 — "Look at three chart screenshots (provided in the Practise
# area). For each one, write two separate sentences: (1) a purely
# observational description ... (2) the SMC label ..." An open, reflective
# exercise (no single "correct" classification) — kind="chart_reflection"
# gives real chart sequences (plain price-action descriptions, not actual
# screenshots) plus a sample answer pair to compare against, rather than
# nothing at all.
# ---------------------------------------------------------------------------
ORIENT_01_TITLE = "What Honest Gap Is (and Isn't)"
ORIENT_01_ITEMS = [
    {
        "description": "Price rallies steadily for 40 candles, then prints six candles in a row with long upper wicks and small bodies, each closing lower than the last.",
        "sample_observation": "Price moved up for a long stretch, then six candles in a row had long upper wicks and closed progressively lower.",
        "sample_label": "Bearish divergence / exhaustion into a possible reversal.",
    },
    {
        "description": "Price drops sharply through a prior swing low on one large candle with a long lower wick, then the next three candles all close back above that swing low's price.",
        "sample_observation": "One large candle poked below the recent low and wicked back up, then three more candles closed back above that same level.",
        "sample_label": "A liquidity sweep of the swing low, followed by reclaiming it.",
    },
    {
        "description": "Price consolidates in a tight 15-candle range, then one candle closes well outside the range with a body roughly three times the average candle size in that range.",
        "sample_observation": "Price moved sideways in a narrow band for a while, then one candle closed far outside that band, with a body much larger than the candles before it.",
        "sample_label": "A breakout/displacement candle out of a range.",
    },
]

# ---------------------------------------------------------------------------
# ORIENT-02 — "Given three hypothetical trade logs (provided in Practise),
# calculate win rate, average win, average loss, and expectancy for each.
# Rank them by expectancy, not by win rate, and explain in one sentence
# why the ranking changes." Deliberately constructed so win-rate ranking
# and expectancy ranking land in OPPOSITE order — the exact point the
# prompt asks the learner to notice.
# ---------------------------------------------------------------------------
ORIENT_02_TITLE = "Trading vs. Gambling, Signal vs. Setup vs. Trade"
ORIENT_02_ITEMS = [
    {
        "label": "Trade Log A",
        "trades": [50, 50, 50, 50, 50, 50, 50, 50, -200, -200],
        "ask": "Expectancy per trade ($)",
        "correct_value": 0.0,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 80% (8/10), avg win $50, avg loss $200. Expectancy = 0.8×50 − 0.2×200 = 40 − 40 = $0 per trade — the highest win rate of the three, but a breakeven system.",
    },
    {
        "label": "Trade Log B",
        "trades": [150, 150, 150, 150, -50, -50, -50, -50, -50, -50],
        "ask": "Expectancy per trade ($)",
        "correct_value": 30.0,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 40% (4/10), avg win $150, avg loss $50. Expectancy = 0.4×150 − 0.6×50 = 60 − 30 = $30 per trade.",
    },
    {
        "label": "Trade Log C",
        "trades": [400, 400, 400, -50, -50, -50, -50, -50, -50, -50],
        "ask": "Expectancy per trade ($)",
        "correct_value": 85.0,
        "tolerance": 0.5,
        "unit": "$",
        "explanation": "Win rate 30% (3/10), avg win $400, avg loss $50. Expectancy = 0.3×400 − 0.7×50 = 120 − 35 = $85 per trade — the LOWEST win rate of the three, but by far the best expectancy.",
    },
]
ORIENT_02_SUMMARY = (
    "Ranked by win rate: A (80%) > B (40%) > C (30%). Ranked by expectancy — the number that "
    "actually determines long-run profit — the order flips completely: C ($85) > B ($30) > A ($0). "
    "Win rate alone told you nothing about which system was worth trading."
)

# ---------------------------------------------------------------------------
# ORIENT-04 — "Using a 40% win-rate coin-flip simulator (provided in
# Practise), run 100 simulated trades at 1% risk per trade and again at
# 5% risk per trade with identical outcomes. Compare the two equity
# curves and the depth of their worst drawdowns." kind="coin_flip" carries
# no items — the frontend renders a real interactive CoinFlipSimulator
# component, not scenario data.
# ---------------------------------------------------------------------------
ORIENT_04_TITLE = "Why Losses Are Normal, Why Risk Management Beats Being Right"

# ---------------------------------------------------------------------------
# C2-01 — "Given four sequences of six swing points each (provided in
# Practise), classify each as uptrend, downtrend, or neither, showing the
# specific pairwise comparisons that support your classification." Built
# directly off this lesson's own stated rule (HH/HL = uptrend, LH/LL =
# downtrend, rising highs + falling lows = expanding range/neither) and
# its own Mini Quiz Q2 (steep-but-still-valid uptrend case).
# ---------------------------------------------------------------------------
C2_01_TITLE = "Swing Highs and Swing Lows"
C2_01_ITEMS = [
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 95},
            {"type": "high", "price": 108}, {"type": "low", "price": 101},
            {"type": "high", "price": 115}, {"type": "low", "price": 107},
        ],
        "options": ["Uptrend", "Downtrend", "Neither"],
        "correct_index": 0,
        "explanation": "Highs: 100 < 108 < 115 (rising). Lows: 95 < 101 < 107 (rising). Both rising together — a clean uptrend.",
    },
    {
        "points": [
            {"type": "high", "price": 120}, {"type": "low", "price": 110},
            {"type": "high", "price": 112}, {"type": "low", "price": 100},
            {"type": "high", "price": 105}, {"type": "low", "price": 90},
        ],
        "options": ["Uptrend", "Downtrend", "Neither"],
        "correct_index": 1,
        "explanation": "Highs: 120 > 112 > 105 (falling). Lows: 110 > 100 > 90 (falling). Both falling together — a downtrend.",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 90},
            {"type": "high", "price": 110}, {"type": "low", "price": 85},
            {"type": "high", "price": 118}, {"type": "low", "price": 80},
        ],
        "options": ["Uptrend", "Downtrend", "Neither"],
        "correct_index": 2,
        "explanation": "Highs rising (100 < 110 < 118) but lows FALLING (90 > 85 > 80) at the same time — rising highs with falling lows is an expanding range, not a trend, under this lesson's own definition.",
    },
    {
        "points": [
            {"type": "high", "price": 100}, {"type": "low", "price": 50},
            {"type": "high", "price": 160}, {"type": "low", "price": 120},
            {"type": "high", "price": 220}, {"type": "low", "price": 200},
        ],
        "options": ["Uptrend", "Downtrend", "Neither"],
        "correct_index": 0,
        "explanation": "Highs: 100 < 160 < 220. Lows: 50 < 120 < 200 — both rising, just at different rates. The definition only requires each new high/low beat the last one; relative steepness between them doesn't disqualify it. Still a valid uptrend.",
    },
]

# ---------------------------------------------------------------------------
# BOT1-01 — "Given five real bot signal cards (provided in Practise),
# correctly identify which one came from Bot 1 using only its timeframe
# inputs and stop/target width." Every card's timeframe list and R:R is
# traced directly against the real analyze() signatures and
# EntryExitEngine(default_rr=...) constructor calls in bot_strategies.py
# (checked right before writing this, not from memory):
#   MacroSwingStructureBot.analyze(candles_1d, candles_4h, ...)          default_rr=5.0  (line ~183/190)
#   OrderBlockReversalBot.analyze(candles_4h, candles_1h, candles_15m)   default_rr=3.0  (line ~397/401)
#   FVGExpansionBot.analyze(candles_1h, candles_15m, ...)                default_rr=4.0  (line ~676/679)
#   VolumeLiquidityBot.analyze(candles_4h, candles_1h, ...)              default_rr=3.0  (line ~996/999)
#   JeafxSMCBot.analyze(candles_4h, candles_1h, candles_15m, candles_5m) default_rr=4.0  (line ~1239/1242)
# Bot 1 is the only one of the 7 real bots that reads 1D at all — every
# other bot's deepest timeframe is 4H — and the only one with
# default_rr=5.0, so it's uniquely identifiable by BOTH signals at once.
# ---------------------------------------------------------------------------
BOT1_01_TITLE = "Concept: What Macro Swing Structure Trading Is"
BOT1_SIGNAL_CARDS = [
    {
        "symbol": "ETHUSDT.P", "timeframes": "4H, 1H, 15M", "rr": "1 : 3",
        "label": "Card 1",
    },
    {
        "symbol": "BTCUSDT.P", "timeframes": "1D, 4H", "rr": "1 : 5",
        "label": "Card 2",
    },
    {
        "symbol": "XAUUSDT.P", "timeframes": "4H, 1H", "rr": "1 : 3",
        "label": "Card 3",
    },
    {
        "symbol": "SOLUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4",
        "label": "Card 4",
    },
    {
        "symbol": "NCCO1OILWTI2USDUSDT.P", "timeframes": "4H, 1H, 15M, 5M", "rr": "1 : 4",
        "label": "Card 5",
    },
]
BOT1_01_ITEMS = [{
    "prompt": "Which card came from Bot 1 (MacroSwingStructureBot)?",
    "cards": BOT1_SIGNAL_CARDS,
    "correct_index": 1,
    "explanation": (
        "Card 2 is the only one that reads 1D at all — Bot 1 is the only one of the 7 real bots "
        "whose analyze() takes candles_1d — and the only one with a 1:5 reward-to-risk ratio "
        "(EntryExitEngine(default_rr=5.0)). Every other real bot's deepest timeframe tops out at 4H."
    ),
}]


async def _upsert(db, title: str, kind: str, items: list, summary: str | None = None, bot_id: str | None = None) -> bool:
    """`bot_id` (e.g. "bot_1") disambiguates a title that isn't actually
    unique across the curriculum — discovered the hard way seeding Bot
    1's "Practice: Running the Full Pipeline by Hand" lesson:
    BOT_STAGE_TEMPLATE (seed_curriculum.py) reuses several stage titles
    VERBATIM across all 7 bot tracks with no bot number in the string
    at all ("Practice: Running the Full Pipeline by Hand", unlike
    "Capstone: Full Bot N Decision Simulation", which does vary per
    bot) — a plain `Lesson.title == title` lookup hits
    MultipleResultsFound across those lessons. Passing bot_id joins to
    LearningTrack and filters on its own `bot_id` column (confirmed
    real and populated: "Bot 1 — Macro Swing Structure Mastery" etc.)
    to pick the right one."""
    query = select(Lesson).where(Lesson.title == title)
    if bot_id is not None:
        query = query.join(LearningTrack, LearningTrack.id == Lesson.track_id).where(LearningTrack.bot_id == bot_id)
    lesson = (await db.execute(query)).scalar_one_or_none()
    if lesson is None:
        print(f"  SKIP — no lesson titled {title!r}{f' in {bot_id}' if bot_id else ''} found (curriculum not seeded yet, or title drifted)")
        return False
    existing = (await db.execute(
        select(PracticeScenarioSet).where(PracticeScenarioSet.lesson_id == lesson.id)
    )).scalar_one_or_none()
    if existing is not None:
        existing.kind, existing.items_json, existing.summary = kind, json.dumps(items), summary
    else:
        db.add(PracticeScenarioSet(lesson_id=lesson.id, kind=kind, items_json=json.dumps(items), summary=summary))
    print(f"  OK — {title!r} -> kind={kind}, {len(items)} item(s)")
    return True


async def seed_practice_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, ORIENT_01_TITLE, "chart_reflection", ORIENT_01_ITEMS)
        count += await _upsert(db, ORIENT_02_TITLE, "numeric_calc", ORIENT_02_ITEMS, ORIENT_02_SUMMARY)
        count += await _upsert(db, ORIENT_04_TITLE, "coin_flip", [])
        count += await _upsert(db, C2_01_TITLE, "swing_sequence", C2_01_ITEMS)
        count += await _upsert(db, BOT1_01_TITLE, "signal_cards", BOT1_01_ITEMS)
        await db.commit()
        print(f"\n{count} of 5 scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_practice_scenarios())
    sys.exit(0)
