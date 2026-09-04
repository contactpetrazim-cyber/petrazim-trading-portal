"""
Community Broadcasts — daily learning tip, streak leaderboard, weekly quiz
==============================================================================

Posts real content to both Telegram channels (individual + corporate):
  - A rotating "Key Takeaways" excerpt pulled from an actually-authored
    curriculum lesson (Lesson.content_body) — never a fabricated tip.
    Rotates deterministically by day-of-year, so it cycles through
    whatever's authored rather than repeating lesson 1 forever or
    picking randomly (which could repeat the same lesson twice in a
    row by chance).
  - A real streak/XP leaderboard from UserLearningStats.
  - A weekly quiz poll, using Telegram's native quiz-poll object
    (see TelegramService.send_quiz_poll) rather than a text message
    asking people to reply with a letter.

CURATED_QUIZ_QUESTIONS below is hand-transcribed from the curriculum's
own Mini Quiz sections — the ONLY ones already in a fixed-answer shape
a quiz poll can represent (2-10 discrete options, one correct). Most
authored Mini Quiz questions are True/False or multiple-choice and fit
directly; open-ended "put these in order" / scenario questions don't
fit a poll's shape at all and are deliberately left out rather than
mangled into one. This is a small, real set (5 questions) — not a
full quiz bank, which the Learning System Handover itself says was
never started.

Fails soft per-channel: a missing bot token for one channel (e.g.
corporate not set up yet) logs and skips that channel rather than
aborting the whole broadcast, matching this codebase's established
convention for every other optional integration (Fireflies, Google
Calendar).
"""

from __future__ import annotations

import re
from datetime import date
from typing import List, Optional

import structlog
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.curriculum import Lesson, UserLearningStats
from app.models.telegram_link import TelegramChannel
from app.models.user import User
from app.services.telegram import CHANNEL_USERNAME, TelegramService

logger = structlog.get_logger()


# --------------------------------------------------------------------------
# Curated quiz questions — real content, see module docstring
# --------------------------------------------------------------------------

CURATED_QUIZ_QUESTIONS = [
    {
        "question": 'An Order Block being clearly visible on a chart is sufficient evidence that it will hold as support/resistance in the future.',
        "options": ["True", "False"], "correct_option_id": 1,
        "explanation": "Visibility in hindsight says nothing about forward reliability without testing.",
        "source": "Part 0 — Honest Gap Orientation",
    },
    {
        "question": 'What does "deterministic" mean in "SMC is a deterministic price-action labeling framework"?',
        "options": [
            "It guarantees future price direction",
            "The same rules applied to the same data always produce the same labels",
            "It was determined by institutional traders",
            "It removes the need for risk management",
        ],
        "correct_option_id": 1,
        "explanation": "That's the one property that makes testing possible at all.",
        "source": "Part 0 — Honest Gap Orientation",
    },
    {
        "question": "Buying and immediately selling at the exact same quoted price, with zero market movement, always breaks even.",
        "options": ["True", "False"], "correct_option_id": 1,
        "explanation": "You buy at the ask and sell at the bid, so you lose the spread even with zero price movement.",
        "source": "Core 1 — Market Basics",
    },
    {
        "question": "The body of a candle always shows the full price range traded during that period.",
        "options": ["True", "False"], "correct_option_id": 1,
        "explanation": "The body only shows open-to-close; the full range includes the wicks out to the high and low.",
        "source": "Core 1 — Market Basics",
    },
    {
        "question": "A candle with a very large high-to-low range is always a displacement candle.",
        "options": ["True", "False"], "correct_option_id": 1,
        "explanation": "Range alone isn't sufficient — the close must also be near the extreme of that range, not the middle.",
        "source": "Core 1 — Market Basics",
    },
]


async def _pick_daily_lesson(db: AsyncSession) -> Optional[Lesson]:
    lessons = (await db.execute(
        select(Lesson).where(Lesson.content_body.isnot(None)).order_by(Lesson.order_index)
    )).scalars().all()
    if not lessons:
        return None
    idx = date.today().timetuple().tm_yday % len(lessons)
    return lessons[idx]


def _extract_key_takeaways(content_body: str) -> Optional[str]:
    """Pulls the '### Key Takeaways' section out of an authored lesson's
    markdown body, matching the 15-section template every authored
    lesson follows (see the Learning System Handover)."""
    match = re.search(r"###\s*Key Takeaways\s*\n(.*?)(?=\n###|\Z)", content_body, re.DOTALL)
    if not match:
        return None
    text = match.group(1).strip()
    return text if text else None


async def build_daily_tip(db: AsyncSession) -> Optional[str]:
    lesson = await _pick_daily_lesson(db)
    if lesson is None or not lesson.content_body:
        return None
    takeaways = _extract_key_takeaways(lesson.content_body) or lesson.content_body.strip()[:400]
    return (
        f"📘 <b>Today's Tip — {lesson.title}</b>\n\n{takeaways}\n\n"
        f"<i>From the Petrazim curriculum. Open the Learn tab for the full lesson.</i>"
    )


async def build_leaderboard(db: AsyncSession, top_n: int = 5) -> Optional[str]:
    rows = (await db.execute(
        select(UserLearningStats, User.full_name)
        .join(User, User.id == UserLearningStats.user_id)
        .where(UserLearningStats.total_xp > 0)
        .order_by(desc(UserLearningStats.total_xp))
        .limit(top_n)
    )).all()
    if not rows:
        return None
    lines = [
        f"{i + 1}. {name} — {stats.total_xp} XP ({stats.current_streak_days}d streak)"
        for i, (stats, name) in enumerate(rows)
    ]
    return "🏆 <b>This Week's Leaderboard</b>\n\n" + "\n".join(lines)


async def _send_to_all_channels(text: str) -> None:
    for channel in (TelegramChannel.INDIVIDUAL, TelegramChannel.CORPORATE):
        try:
            service = TelegramService(channel)
            await service.send_to_chat(CHANNEL_USERNAME[channel], text)
        except RuntimeError as e:
            logger.warning("community_broadcast.skipped_channel", channel=channel.value, reason=str(e))


async def send_daily_broadcast(db: AsyncSession) -> dict:
    tip = await build_daily_tip(db)
    leaderboard = await build_leaderboard(db)
    parts = [p for p in (tip, leaderboard) if p]
    if not parts:
        return {"sent": False, "reason": "No lesson content or leaderboard data yet."}
    await _send_to_all_channels("\n\n———\n\n".join(parts))
    return {"sent": True, "included_tip": tip is not None, "included_leaderboard": leaderboard is not None}


async def send_weekly_quiz() -> dict:
    week_index = date.today().isocalendar()[1] % len(CURATED_QUIZ_QUESTIONS)
    q = CURATED_QUIZ_QUESTIONS[week_index]
    for channel in (TelegramChannel.INDIVIDUAL, TelegramChannel.CORPORATE):
        try:
            service = TelegramService(channel)
            await service.send_quiz_poll(
                CHANNEL_USERNAME[channel], q["question"], q["options"],
                q["correct_option_id"], q["explanation"],
            )
        except RuntimeError as e:
            logger.warning("community_broadcast.quiz_skipped_channel", channel=channel.value, reason=str(e))
    return {"sent": True, "question": q["question"], "source": q["source"]}
