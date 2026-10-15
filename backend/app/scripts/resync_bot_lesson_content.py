"""
Resync Bot Lesson Content
==========================

seed_curriculum.py is idempotent-by-refusal: it only ever writes
Lesson rows once, and refuses to run again if any LearningTrack
already exists (real learner StageCompletion rows could point at
those stages). That means a later fix to a curriculum/*.md file never
reaches the live DB on its own — this script is the missing "push an
edit to already-seeded content" path, scoped narrowly to the bot
lesson tracks (BOT_1..BOT_7 .md files), reusing the exact same
`parse_authored_lessons` parser seed_curriculum.py itself uses so the
pushed content can never drift from what that parser would produce.

Built for one concrete, real correction: BOT1/2/3/5/6's own Management
lessons (and the BOT*-09/10 lessons that reference them) previously
claimed the REPORTED take-profit field is `tp2` (a fixed 2:1) — wrong,
confirmed by re-reading `bot_strategies.py` directly, where every bot's
`BotSignal.take_profit` is `targets["tp1"]` (a fixed 1:1), no
exceptions. The .md files have already been corrected; this pushes
that correction into the already-seeded `Lesson.content_body` rows.

Also picks up BOT_7 (previously a track with 10 placeholder stages and
zero authored content — now has a real, verified lesson file).

Safe to re-run: for each `BOT{n}-{stage}` code found in the relevant
.md files, finds that bot's track (`LearningTrack.bot_id`) and the
matching `TrackStage.stage_number`, then either updates the existing
Lesson's `content_body`/`title` in place (preserving its id, so any
real StageCompletion/progress rows pointing at it are undisturbed) or
creates+links a new Lesson if that stage was still a placeholder
(`lesson_id IS NULL`) — exactly BOT_7's case.

Run manually:
    python -m app.scripts.resync_bot_lesson_content
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.curriculum import Lesson, LearningTrack, TrackStage
from app.scripts.seed_curriculum import parse_authored_lessons

CURRICULUM_DIR = Path(__file__).resolve().parents[3] / "curriculum"

# Every bot lesson file whose content this run should push — the 5
# corrected files (tp1/tp2 fix) plus Bot 7 (brand new content).
BOT_LESSON_FILES = {
    "bot_1": "BOT_1_MACRO_SWING_STRUCTURE.md",
    "bot_2": "BOT_2_ORDER_BLOCK_REVERSAL.md",
    "bot_3": "BOT_3_IMBALANCE_EXPANSION.md",
    "bot_5": "BOT_5_LIQUIDITY_PURGE_SPECIALIST.md",
    "bot_6": "BOT_6_SMC_V2.md",
    "bot_7": "BOT_7_FVG_EXPANSION_V3.md",
}


async def main():
    updated = 0
    created = 0
    skipped_no_track = 0
    skipped_no_stage = 0

    async with AsyncSessionLocal() as db:
        for bot_id, filename in BOT_LESSON_FILES.items():
            path = CURRICULUM_DIR / filename
            if not path.exists():
                print(f"SKIP {bot_id}: {filename} not found")
                continue

            authored = parse_authored_lessons(path)
            bot_number = bot_id.rsplit("_", 1)[-1]

            track = (await db.execute(
                select(LearningTrack).where(LearningTrack.bot_id == bot_id)
            )).scalar_one_or_none()
            if track is None:
                print(f"SKIP {bot_id}: no LearningTrack row exists for this bot_id")
                skipped_no_track += len(authored)
                continue

            for code, lesson_data in sorted(authored.items()):
                # code is "BOT{n}-{stage:02d}" — only touch this bot's
                # own codes, in case a file somehow referenced another
                # bot's prefix.
                if not code.startswith(f"BOT{bot_number}-"):
                    continue
                stage_number = int(code.rsplit("-", 1)[-1])

                stage = (await db.execute(
                    select(TrackStage).where(
                        TrackStage.track_id == track.id,
                        TrackStage.stage_number == stage_number,
                    )
                )).scalar_one_or_none()
                if stage is None:
                    print(f"SKIP {code}: no TrackStage at stage_number={stage_number} for {bot_id}")
                    skipped_no_stage += 1
                    continue

                if stage.lesson_id is not None:
                    lesson = (await db.execute(
                        select(Lesson).where(Lesson.id == stage.lesson_id)
                    )).scalar_one_or_none()
                    if lesson is None:
                        print(f"SKIP {code}: TrackStage.lesson_id set but Lesson row missing — needs manual look")
                        continue
                    changed = lesson.content_body != lesson_data["body"] or lesson.title != lesson_data["title"]
                    lesson.content_body = lesson_data["body"]
                    lesson.title = lesson_data["title"]
                    if changed:
                        updated += 1
                else:
                    lesson = Lesson(
                        track_id=track.id, title=lesson_data["title"],
                        order_index=stage_number, content_body=lesson_data["body"],
                    )
                    db.add(lesson)
                    await db.flush()
                    stage.lesson_id = lesson.id
                    created += 1

        await db.commit()

    print(f"\nDone. {updated} existing lessons updated, {created} new lessons created "
          f"(placeholder stages now authored), {skipped_no_track} skipped (no track), "
          f"{skipped_no_stage} skipped (no matching stage).")


if __name__ == "__main__":
    asyncio.run(main())
