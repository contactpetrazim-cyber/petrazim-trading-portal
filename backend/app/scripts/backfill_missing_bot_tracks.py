"""
Backfill Missing Bot-Mastery Tracks
=======================================

By direct question: "we now have 7 bots - are these assumptions
correct and still valid". Checking the REAL live database (not just
seed_curriculum.py's own BOT_TRACKS list, which is a wishlist, not a
report of what's actually seeded) found this was worse than expected:
**Bot 6 has zero LearningTrack row, despite BOT_6_SMC_V2.md being a
fully-authored 10-lesson file already sitting in the repo** — it was
apparently added to seed_curriculum.py's BOT_TRACKS/BOT_LESSON_FILES
sometime after the original seeding ran, and since that script
refuses to re-run once any LearningTrack exists (by design, to protect
real learners' StageCompletion rows), bot_6's real content never
actually reached the database. Bot 7 (FVGExpansionV3Bot) has no
markdown file at all yet and also had zero track.

This is the additive counterpart to seed_curriculum.py — it adds ONLY
whichever bot tracks are still missing (checked by bot_id, so running
this again after bot_7's own file eventually gets authored is safe:
it will just add bot_7 with real content at that point instead of a
second placeholder). For a bot whose .md file exists (bot_6), lessons
are parsed the exact same way seed_curriculum.py's own
parse_authored_lessons() does - real content, not re-typed. For a bot
with no file yet (bot_7 today), every stage stays a correctly-titled
placeholder, same convention as every other un-authored stage.

Run once (safe to re-run - it's a no-op for any bot_id already seeded):
    python -m app.scripts.backfill_missing_bot_tracks
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models.curriculum import Lesson, LearningTrack, TrackCategory, TrackStage

CURRICULUM_DIR = Path(__file__).resolve().parents[3] / "curriculum"

BOT_STAGE_TEMPLATE = [
    "Concept", "Identification", "Context", "Setup", "Invalidation",
    "Entry", "Management", "Failure", "Practice", "Capstone",
]

# Every real bot in the current roster (bot_strategies.py's
# BotOrchestrator.bots) that should have a track. Matches
# seed_curriculum.py's BOT_TRACKS exactly.
ALL_BOT_TRACKS = [
    ("bot_1", "Bot 1 — Macro Swing Structure"),
    ("bot_2", "Bot 2 — Order Block Reversal"),
    ("bot_3", "Bot 3 — Imbalance Expansion"),
    ("bot_4", "Bot 4 — Volume & Liquidity Sweep"),
    ("bot_5", "Bot 5 — Liquidity Purge Specialist"),
    ("bot_6", "Bot 6 — SMC v2"),
    ("bot_7", "Bot 7 — FVG Expansion v3"),
]
ALL_BOT_LESSON_FILES = {
    "bot_1": "BOT_1_MACRO_SWING_STRUCTURE.md",
    "bot_2": "BOT_2_ORDER_BLOCK_REVERSAL.md",
    "bot_3": "BOT_3_IMBALANCE_EXPANSION.md",
    "bot_4": "BOT_4_VOLUME_LIQUIDITY_SWEEP.md",
    "bot_5": "BOT_5_LIQUIDITY_PURGE_SPECIALIST.md",
    "bot_6": "BOT_6_SMC_V2.md",
    # bot_7: no file yet - stays a placeholder track until authored.
}


def parse_authored_lessons(md_path: Path) -> dict[str, dict]:
    """Verbatim copy of seed_curriculum.py's own parser — splits a
    curriculum .md file on its '## CODE — Title' headers."""
    text = md_path.read_text()
    sections = re.split(r"\n## ", text)[1:]
    lessons: dict[str, dict] = {}
    for section in sections:
        heading, _, rest = section.partition("\n")
        code_match = re.match(r"([A-Z0-9]+-\d+)\s*[—-]\s*(.+)", heading.strip())
        if not code_match:
            continue
        code, title = code_match.group(1), code_match.group(2).strip()
        body = rest.strip()
        body = re.sub(r"\n---\s*$", "", body).strip()
        lessons[code] = {"title": title, "body": f"## {heading.strip()}\n\n{body}"}
    return lessons


async def backfill_missing_bot_tracks():
    async with AsyncSessionLocal() as db:
        existing_bot_ids = set(
            (await db.execute(select(LearningTrack.bot_id).where(LearningTrack.bot_id.isnot(None)))).scalars().all()
        )
        missing = [(bot_id, title) for bot_id, title in ALL_BOT_TRACKS if bot_id not in existing_bot_ids]
        if not missing:
            print("Every bot already has a LearningTrack — nothing to backfill.")
            return

        max_order = (await db.execute(select(func.max(LearningTrack.order_index)))).scalar_one() or 0

        for bot_id, bot_title in missing:
            max_order += 1
            track = LearningTrack(
                title=f"{bot_title} Mastery", category=TrackCategory.BOT_MASTERY,
                bot_id=bot_id, description=f"Novice-to-mastery path for {bot_title}'s specific methodology.",
                order_index=max_order,
            )
            db.add(track)
            await db.flush()

            md_filename = ALL_BOT_LESSON_FILES.get(bot_id)
            authored = parse_authored_lessons(CURRICULUM_DIR / md_filename) if md_filename else {}
            bot_number = bot_id.rsplit("_", 1)[-1]
            authored_count = 0

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
                    authored_count += 1

                db.add(TrackStage(
                    track_id=track.id, stage_number=i, title=f"{stage_title} — {bot_title}",
                    lesson_id=lesson_id, xp_reward=10,
                ))

            print(f"Added {bot_id} track (id={track.id}) — {authored_count} of {len(BOT_STAGE_TEMPLATE)} stages authored.")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(backfill_missing_bot_tracks())
