"""
Curriculum Seed Script
=========================

Populates LearningTrack / Lesson / TrackStage from the REAL curriculum
already written in the repo's top-level curriculum/ directory
(00_MASTER_CONTENT_MAP.md, PART_0_ORIENTATION.md,
CORE_1_MARKET_BASICS.md, CORE_2_MARKET_STRUCTURE.md,
CORE_3_LIQUIDITY.md, CORE_4_SUPPLY_DEMAND_ZONES.md,
CORE_5_FAIR_VALUE_GAPS.md, CORE_6_PREMIUM_DISCOUNT.md,
CORE_7_MULTI_TIMEFRAME.md, CORE_8_RISK_MANAGEMENT.md,
CORE_9_TRADE_MANAGEMENT.md, CORE_10_TRADING_PSYCHOLOGY.md, and each
bot's own file listed in BOT_LESSON_FILES below, e.g.
BOT_1_MACRO_SWING_STRUCTURE.md) — nothing here invents lesson content.

Two kinds of stage get created, matching the content map's own
[DONE] / [ ] status legend:
  - AUTHORED stages: real content_body, parsed directly out of the
    twelve-plus .md files that have full lessons written (PART_0,
    CORE_1, CORE_2, CORE_3, CORE_4, CORE_5, CORE_6, CORE_7, CORE_8,
    CORE_9, CORE_10, and whichever BOT_N files exist so far).
    The parser (not a hand-copied string) is the intentional choice —
    it means the seeded content can never silently drift from the
    actual .md file, and re-running this script after an edit to
    those files picks the edit up.
  - PLACEHOLDER stages: real titles (copied from the master content
    map's own outline — those ARE a real content decision already
    made) but no lesson body yet, since nobody has authored one. Each
    placeholder's Lesson.content_body is left None; the frontend shows
    "Not yet authored" rather than a blank or fabricated lesson. This
    is what keeps "0 of 113 stages" honest instead of showing a
    smaller, misleadingly-complete-looking number.

Run ONCE, manually, after the tables exist:
    python -m app.scripts.seed_curriculum

Idempotent: refuses to run if any LearningTrack already exists, same
safety pattern as seed_super_admin.py — re-seeding after a real
learner has StageCompletion rows pointing at these stages would be
destructive.
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.curriculum import Lesson, LearningTrack, TrackCategory, TrackStage

CURRICULUM_DIR = Path(__file__).resolve().parents[3] / "curriculum"


def parse_authored_lessons(md_path: Path) -> dict[str, dict]:
    """Splits a curriculum .md file on its '## CODE — Title' headers and
    returns {code: {title, body}}. CODE is the leading token before the
    first ' — ' or ' - ' (e.g. 'C1-01' out of '## C1-01 — What a Market
    Is...'). body is everything from that heading up to (not including)
    the next '## ' heading or end of file, minus the leading '---'
    separator lines the source files use between lessons."""
    text = md_path.read_text()
    sections = re.split(r"\n## ", text)[1:]  # [0] is the file's own "# Title" preamble
    lessons: dict[str, dict] = {}
    for section in sections:
        heading, _, rest = section.partition("\n")
        code_match = re.match(r"([A-Z0-9]+-\d+)\s*[—-]\s*(.+)", heading.strip())
        if not code_match:
            continue
        code, title = code_match.group(1), code_match.group(2).strip()
        body = rest.strip()
        # Trim a trailing '---' lesson separator if present.
        body = re.sub(r"\n---\s*$", "", body).strip()
        lessons[code] = {"title": title, "body": f"## {heading.strip()}\n\n{body}"}
    return lessons


# ---------------------------------------------------------------------------
# Track structure — titles and ordering from curriculum/00_MASTER_CONTENT_MAP.md.
# `stages` lists (stage_number, code_or_None, title). A stage with a code
# present in the parsed authored-lesson dicts gets a real Lesson row; every
# other stage is a real, correctly-titled placeholder with no lesson yet.
# ---------------------------------------------------------------------------

ORIENT_STAGES = [
    (1, "ORIENT-01", "What Honest Gap Is (and Isn't)"),
    (2, "ORIENT-02", "Trading vs. Gambling, Signal vs. Setup vs. Trade"),
    (3, "ORIENT-03", "Framework vs. Proven Edge — Why Probability Matters"),
    (4, "ORIENT-04", "Why Losses Are Normal, Why Risk Management Beats Being Right"),
    (5, "ORIENT-05", "How to Use Learn / Practise / Mastery — a Learner's Map"),
    (6, "ORIENT-06", "How the Five Bots Relate to One Another"),
]

CORE1_STAGES = [
    (1, "C1-01", "What a Market Is — Buyers, Sellers, Price, Bid/Ask, Spread"),
    (2, "C1-02", "Candlestick Anatomy — Open, High, Low, Close, Body, Wick"),
    (3, "C1-03", "Bullish vs. Bearish Candles, Momentum, Expansion & Contraction"),
    (4, "C1-04", "Liquidity and Volatility — First Look"),
    (5, "C1-05", "Timeframes and Chart Navigation"),
    (6, "C1-06", "Sessions, Market Open/Close, Gaps"),
]

CORE2_STAGES = [
    (1, "C2-01", "Swing Highs and Swing Lows"),
    (2, "C2-02", "Higher Highs/Lows, Lower Highs/Lows — Defining Trend"),
    (3, "C2-03", "Trend vs. Range vs. Transition"),
    (4, "C2-04", "Internal vs. External Structure"),
    (5, "C2-05", "Protected Highs and Lows"),
    (6, "C2-06", "BOS — Break of Structure"),
    (7, "C2-07", "CHoCH — Change of Character"),
    (8, "C2-08", "Wick vs. Body Break, Displacement, False Break"),
    (9, "C2-09", "Structural Invalidation"),
]

CORE3_STAGES = [
    (1, "C3-01", "What Liquidity Means in This Framework"),
    (2, "C3-02", "Buy-Side / Sell-Side Liquidity, Equal Highs/Lows"),
    (3, "C3-03", "Trendline Liquidity, Liquidity Pools"),
    (4, "C3-04", "Liquidity Sweeps — Sweep vs. Breakout vs. Random Wick"),
    (5, "C3-05", "Sweep + Displacement + CHoCH — Reading Sequences"),
    (6, "C3-06", "Why Not Every Pool Is Tradable"),
]

CORE4_STAGES = [
    (1, "C4-01", "Supply and Demand, Origin of Displacement"),
    (2, "C4-02", "Order Blocks — Bullish and Bearish"),
    (3, "C4-03", "Breaker Blocks and Mitigation Blocks"),
    (4, "C4-04", "Fresh / Tested / Mitigated / Invalid Zones"),
    (5, "C4-05", "Zone Boundaries — Body vs. Full-Range vs. Wick-Inclusive"),
    (6, "C4-06", "Zone Age, Zone Quality, Confluence"),
]

CORE5_STAGES = [
    (1, "C5-01", "What Imbalance Means, FVG Formation"),
    (2, "C5-02", "Bullish/Bearish FVG, Minimum Gap"),
    (3, "C5-03", "FVG Fill — Partial, Full, Inversion, Retracement"),
    (4, "C5-04", "FVG vs. Ordinary Price Noise — When Not to Trade It"),
]

CORE6_STAGES = [
    (1, "C6-01", "Dealing Range, External Leg, Equilibrium"),
    (2, "C6-02", "Premium and Discount, Long/Short Location"),
    (3, "C6-03", "Multiple Dealing Ranges, Interaction With Liquidity/Zones"),
]

CORE7_STAGES = [
    (1, "C7-01", "The Five-Layer Stack — Macro/Direction/Opportunity/Trigger/Execution"),
    (2, "C7-02", "MTF Alignment vs. Conflict, Transition States"),
    (3, "C7-03", "Long/Short Decision Trees, No-Trade Conditions"),
]

CORE8_STAGES = [
    (1, "C8-01", "Risk Per Trade, Fixed Fractional Sizing"),
    (2, "C8-02", "Stop-Loss, Invalidation, R-Multiple"),
    (3, "C8-03", "Reward-to-Risk, Partial Exits, Breakeven, Trailing"),
    (4, "C8-04", "Max Daily/Weekly Loss, Correlated Exposure"),
    (5, "C8-05", "Leverage, Margin, Spread, Slippage, Fees"),
    (6, "C8-06", "Kill Switches and Circuit Breakers"),
    (7, "C8-07", "Why a \"3:1 Setup\" Does Not Equal 3:1 Realized Expectancy"),
]

CORE9_STAGES = [
    (1, "C9-01", "Before Entry Through Exit — the Full Lifecycle"),
    (2, "C9-02", "Valid Loss vs. Bad Loss, Good Trade That Loses vs. Bad Trade That Wins"),
    (3, "C9-03", "Judging Process Separately From Outcome"),
]

PSY_STAGES = [
    (1, "PSY-01", "Emotional Regulation Under Live Risk"),
    (2, "PSY-02", "Cognitive Errors — Confirmation Bias, Recency, Overconfidence"),
    (3, "PSY-03", "Behavioural Discipline — Following Your Own Rules Under Pressure"),
    (4, "PSY-04", "Process Psychology — Plan, Observe, Decide, Execute, Record, Review, Improve"),
    (5, "PSY-05", "Pre-Trade Checklist Discipline"),
    (6, "PSY-06", "Post-Trade Review Without Self-Deception"),
    (7, "PSY-07", "Detectors — Impulse, Revenge Trading, FOMO"),
    (8, "PSY-08", "Confidence Calibration — Matching Certainty to Actual Edge"),
    (9, "PSY-09", "Shutdown Protocol — Recognizing When to Stop for the Day"),
    (10, "PSY-10", "Psychology Capstone"),
]

BOT_STAGE_TEMPLATE = [
    "Concept", "Identification", "Context", "Setup", "Invalidation",
    "Entry", "Management", "Failure", "Practice", "Capstone",
]

BOT_TRACKS = [
    ("bot_1", "Bot 1 — Macro Swing Structure"),
    ("bot_2", "Bot 2 — Order Block Reversal"),
    ("bot_3", "Bot 3 — Imbalance Expansion"),
    ("bot_4", "Bot 4 — Volume & Liquidity Sweep"),
    ("bot_5", "Bot 5 — Liquidity Purge Specialist"),
]

# Each bot's authored .md file, keyed the same as BOT_TRACKS above — a
# bot with no file yet (still [ ] in the master content map) is simply
# absent here, and its 10 stages stay real, correctly-titled
# placeholders (BOT_STAGE_TEMPLATE), same pattern as every other
# not-yet-authored stage in this script. Lesson codes inside each file
# follow BOT{n}-01 through BOT{n}-10, matching BOT_STAGE_TEMPLATE's own
# order (Concept, Identification, ..., Capstone).
BOT_LESSON_FILES = {
    "bot_1": "BOT_1_MACRO_SWING_STRUCTURE.md",
    "bot_2": "BOT_2_ORDER_BLOCK_REVERSAL.md",
    "bot_3": "BOT_3_IMBALANCE_EXPANSION.md",
    "bot_4": "BOT_4_VOLUME_LIQUIDITY_SWEEP.md",
    "bot_5": "BOT_5_LIQUIDITY_PURGE_SPECIALIST.md",
}

TRACKS = [
    {"title": "Honest Gap Orientation", "category": TrackCategory.BASICS,
     "description": "Start here — what this platform teaches, what it doesn't promise, and the vocabulary every later lesson assumes.",
     "stages": ORIENT_STAGES},
    {"title": "Core 1 — Market Basics", "category": TrackCategory.BASICS,
     "description": "Price, spread, candlesticks, and momentum — the raw material every later pattern is built from.",
     "stages": CORE1_STAGES},
    {"title": "Core 2 — Market Structure", "category": TrackCategory.BASICS,
     "description": "Swings, trend, BOS, and CHoCH — how price structure is actually read.",
     "stages": CORE2_STAGES},
    {"title": "Core 3 — Liquidity", "category": TrackCategory.BASICS,
     "description": "Liquidity pools, sweeps, and reading a sweep-displacement-CHoCH sequence.",
     "stages": CORE3_STAGES},
    {"title": "Core 4 — Supply, Demand & Zones", "category": TrackCategory.BASICS,
     "description": "Order blocks, breaker blocks, and zone quality.",
     "stages": CORE4_STAGES},
    {"title": "Core 5 — Fair Value Gaps & Imbalance", "category": TrackCategory.BASICS,
     "description": "FVG formation, fill types, and when an imbalance isn't worth trading.",
     "stages": CORE5_STAGES},
    {"title": "Core 6 — Premium / Discount", "category": TrackCategory.BASICS,
     "description": "Dealing ranges, equilibrium, and trade location.",
     "stages": CORE6_STAGES},
    {"title": "Core 7 — Multi-Timeframe Analysis", "category": TrackCategory.BASICS,
     "description": "The five-layer timeframe stack and alignment vs. conflict.",
     "stages": CORE7_STAGES},
    {"title": "Core 8 — Risk Management", "category": TrackCategory.BASICS,
     "description": "Position sizing, stop-loss discipline, and why realized expectancy differs from the setup on paper.",
     "stages": CORE8_STAGES},
    {"title": "Core 9 — Trade Management", "category": TrackCategory.BASICS,
     "description": "The full trade lifecycle, and judging process separately from outcome.",
     "stages": CORE9_STAGES},
    {"title": "Trading Psychology", "category": TrackCategory.PSYCHOLOGY,
     "description": "Emotional regulation, cognitive errors, and the discipline that keeps a tested process from breaking down under real risk.",
     "stages": PSY_STAGES},
]


async def seed_curriculum():
    orient_lessons = parse_authored_lessons(CURRICULUM_DIR / "PART_0_ORIENTATION.md")
    core1_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_1_MARKET_BASICS.md")
    core2_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_2_MARKET_STRUCTURE.md")
    core3_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_3_LIQUIDITY.md")
    core4_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_4_SUPPLY_DEMAND_ZONES.md")
    core5_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_5_FAIR_VALUE_GAPS.md")
    core6_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_6_PREMIUM_DISCOUNT.md")
    core7_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_7_MULTI_TIMEFRAME.md")
    core8_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_8_RISK_MANAGEMENT.md")
    core9_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_9_TRADE_MANAGEMENT.md")
    psy_lessons = parse_authored_lessons(CURRICULUM_DIR / "CORE_10_TRADING_PSYCHOLOGY.md")
    authored = {
        **orient_lessons, **core1_lessons, **core2_lessons, **core3_lessons,
        **core4_lessons, **core5_lessons, **core6_lessons, **core7_lessons,
        **core8_lessons, **core9_lessons, **psy_lessons,
    }
    for bot_id, filename in BOT_LESSON_FILES.items():
        authored.update(parse_authored_lessons(CURRICULUM_DIR / filename))

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(LearningTrack).limit(1))).scalar_one_or_none()
        if existing is not None:
            print("LearningTrack rows already exist — refusing to re-seed. "
                  "Delete existing curriculum rows first if this is intentional.")
            sys.exit(1)

        order_index = 0
        total_stages = 0
        total_authored = 0

        for track_def in TRACKS:
            track = LearningTrack(
                title=track_def["title"], category=track_def["category"],
                description=track_def["description"], order_index=order_index,
            )
            db.add(track)
            await db.flush()  # get track.id
            order_index += 1

            for stage_number, code, title in track_def["stages"]:
                lesson_id = None
                if code and code in authored:
                    lesson = Lesson(
                        track_id=track.id, title=authored[code]["title"],
                        order_index=stage_number, content_body=authored[code]["body"],
                    )
                    db.add(lesson)
                    await db.flush()
                    lesson_id = lesson.id
                    total_authored += 1

                db.add(TrackStage(
                    track_id=track.id, stage_number=stage_number, title=title,
                    lesson_id=lesson_id, xp_reward=10,
                ))
                total_stages += 1

        for bot_id, bot_title in BOT_TRACKS:
            track = LearningTrack(
                title=f"{bot_title} Mastery", category=TrackCategory.BOT_MASTERY,
                bot_id=bot_id, description=f"Novice-to-mastery path for {bot_title}'s specific methodology.",
                order_index=order_index,
            )
            db.add(track)
            await db.flush()
            order_index += 1

            bot_number = bot_id.rsplit("_", 1)[-1]   # "bot_1" -> "1"
            for i, stage_title in enumerate(BOT_STAGE_TEMPLATE, start=1):
                code = f"BOT{bot_number}-{i:02d}"
                lesson_id = None
                if code in authored:
                    lesson = Lesson(
                        track_id=track.id, title=authored[code]["title"],
                        order_index=i, content_body=authored[code]["body"],
                    )
                    db.add(lesson)
                    await db.flush()
                    lesson_id = lesson.id
                    total_authored += 1

                db.add(TrackStage(
                    track_id=track.id, stage_number=i, title=f"{stage_title} — {bot_title}",
                    lesson_id=lesson_id, xp_reward=10,
                ))
                total_stages += 1

        await db.commit()
        print(f"Seeded {order_index} tracks, {total_stages} stages "
              f"({total_authored} with real authored content, "
              f"{total_stages - total_authored} placeholder titles awaiting content).")


if __name__ == "__main__":
    asyncio.run(seed_curriculum())
