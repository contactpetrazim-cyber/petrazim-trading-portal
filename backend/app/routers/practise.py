"""
Practise Router — Practice Drills, Retention Review, and the quiz Game
==========================================================================

Backs the three Site Map "Practise" sub-features (Practice Drills,
Retention Review, Trading Simulator Game) — none of which had ANY
backend before this. PracticeAttempt and RetentionCheck already
existed in models/curriculum.py, real and used by the Learn dual-gate
(stage_completion_meets_requirements) and the spaced-recall scheduler
(schedule_next_retention_check), but nothing had ever exposed either
over HTTP for a learner to actually use them directly, and nothing had
ever created a RetentionCheck row in the first place.

Deliberately SELF-GRADED rather than auto-graded: every authored
lesson's "### Practice Drill" and "### Mini Quiz" sections are
free-form prose (a True/False question, a multiple-choice question
with worked reasoning in the answer, or an open scenario prompt) —
there's no structured answer key to check a submitted string against
without either inventing one (fabricating content the curriculum/
source files don't actually specify) or building a real NLP grader.
Self-report ("I got this right" / "I need more practice") against
REAL authored content — the exact prose from CORE_*.md and
PART_0_ORIENTATION.md, parsed at read time, never re-typed or
invented here — is the honest v1, the same pattern spaced-repetition
apps use for open-response items.

The "Trading Simulator Game" is a rapid-fire streak challenge over
real Mini Quiz questions pulled from across every authored lesson —
deliberately NOT a fabricated live paper-trading price simulator.
This app already has a real trading path (Manual Trading, against a
real broker) and a real Monte Carlo outcome-simulation engine; a
second, fake price-action engine here would show numbers this app has
nothing real behind it, which is exactly what this app's design has
consistently avoided elsewhere (see TradeAnalytics.tsx's own docstring
on why it has no account-balance figure).
"""

from __future__ import annotations

import random
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.database import get_db
from app.engines.progression_engine import RETENTION_INTERVALS_DAYS, schedule_next_retention_check
from app.models.curriculum import (
    Lesson, LearningTrack, PracticeAttempt, RetentionCheck, UserLearningStats,
)
from app.models.user import User

router = APIRouter(prefix="/practise", tags=["practise"])


def _extract_section(content_body: Optional[str], section_name: str) -> str:
    """Pulls one '### <section_name>' block out of a lesson's authored
    content_body. Returns '' for a placeholder lesson (content_body is
    None) or one with no such section."""
    if not content_body:
        return ""
    m = re.search(rf"### {re.escape(section_name)}\s*\n(.*?)(?=\n### |\Z)", content_body, re.S)
    return m.group(1).strip() if m else ""


def _extract_q1(mini_quiz_block: str) -> tuple[str, str]:
    """Every authored Mini Quiz section follows the same shape:
    'Q1 (...): ...\\nAnswer: ...\\n\\nQ2 (...): ...'. Pulls just Q1 out
    (one question is plenty for a single retention check or game round
    — variety comes from sampling different lessons, not both questions
    of one lesson) and splits it into (question, answer). Falls back to
    treating the whole block as an ungraded prompt if the shape doesn't
    match — still real authored text, just not split into two fields."""
    if not mini_quiz_block:
        return "", ""
    m = re.search(r"Q1.*?(?=\n\nQ2|\Z)", mini_quiz_block, re.S)
    block = m.group(0) if m else mini_quiz_block
    q_part, sep, a_part = block.partition("\nAnswer:")
    if not sep:
        return block.strip(), ""
    return q_part.strip(), a_part.strip()


# ---------------------------------------------------------------------------
# Practice Drills
# ---------------------------------------------------------------------------

class DrillItem(BaseModel):
    lesson_id: str
    lesson_title: str
    prompt: str
    attempts: int
    correct_attempts: int


class DrillTrackGroup(BaseModel):
    track_id: str
    track_title: str
    drills: List[DrillItem]


class DrillAttemptRequest(BaseModel):
    track_id: str
    lesson_id: str
    correct: bool


@router.get("/drills", response_model=List[DrillTrackGroup])
async def list_drills(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    tracks = (await db.execute(select(LearningTrack).order_by(LearningTrack.order_index))).scalars().all()
    lessons = (await db.execute(select(Lesson).where(Lesson.content_body.isnot(None)))).scalars().all()
    lessons_by_track: dict = {}
    for l in lessons:
        lessons_by_track.setdefault(l.track_id, []).append(l)

    attempt_rows = (await db.execute(
        select(PracticeAttempt.scenario_id, PracticeAttempt.correct).where(PracticeAttempt.user_id == user.id)
    )).all()
    attempts_by_lesson: dict = {}
    for scenario_id, correct in attempt_rows:
        a = attempts_by_lesson.setdefault(scenario_id, {"attempts": 0, "correct": 0})
        a["attempts"] += 1
        a["correct"] += int(correct)

    out: List[DrillTrackGroup] = []
    for t in tracks:
        drills: List[DrillItem] = []
        for l in sorted(lessons_by_track.get(t.id, []), key=lambda x: x.order_index):
            prompt = _extract_section(l.content_body, "Practice Drill")
            if not prompt:
                continue
            a = attempts_by_lesson.get(str(l.id), {"attempts": 0, "correct": 0})
            drills.append(DrillItem(
                lesson_id=str(l.id), lesson_title=l.title, prompt=prompt,
                attempts=a["attempts"], correct_attempts=a["correct"],
            ))
        if drills:
            out.append(DrillTrackGroup(track_id=str(t.id), track_title=t.title, drills=drills))
    return out


@router.post("/drills/attempt", response_model=dict)
async def submit_drill_attempt(
    req: DrillAttemptRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Same PracticeAttempt row the Learn dual-gate already reads
    (stage_completion_meets_requirements) — a drill marked correct here
    counts toward a track's practice-rep requirement for real, not just
    toward this page's own tally."""
    db.add(PracticeAttempt(
        user_id=user.id, track_id=req.track_id, scenario_id=req.lesson_id,
        correct=1 if req.correct else 0,
    ))
    await db.commit()
    return {"recorded": True, "correct": req.correct}


# ---------------------------------------------------------------------------
# Retention Review (spaced recall)
# ---------------------------------------------------------------------------

class RetentionDueItem(BaseModel):
    check_id: str
    lesson_id: str
    lesson_title: str
    track_title: str
    due_at: datetime
    question: str
    answer: str


class RetentionCompleteRequest(BaseModel):
    passed: bool


class RetentionCompleteResponse(BaseModel):
    next_due_at: datetime
    next_interval_days: int


@router.get("/retention/due", response_model=List[RetentionDueItem])
async def list_due_retention_checks(
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(RetentionCheck, Lesson, LearningTrack)
        .join(Lesson, Lesson.id == RetentionCheck.lesson_id)
        .join(LearningTrack, LearningTrack.id == Lesson.track_id)
        .where(
            RetentionCheck.user_id == user.id, RetentionCheck.completed_at.is_(None),
            RetentionCheck.due_at <= now,
        )
        .order_by(RetentionCheck.due_at)
    )).all()

    out: List[RetentionDueItem] = []
    for check, lesson, track in rows:
        mini_quiz = _extract_section(lesson.content_body, "Mini Quiz")
        question, answer = _extract_q1(mini_quiz)
        if not question:
            continue   # a lesson with no Mini Quiz content yet — nothing honest to show
        out.append(RetentionDueItem(
            check_id=str(check.id), lesson_id=str(lesson.id), lesson_title=lesson.title,
            track_title=track.title, due_at=check.due_at, question=question, answer=answer,
        ))
    return out


@router.post("/retention/{check_id}/complete", response_model=RetentionCompleteResponse)
async def complete_retention_check(
    check_id: str, req: RetentionCompleteRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    check = (await db.execute(
        select(RetentionCheck).where(RetentionCheck.id == check_id, RetentionCheck.user_id == user.id)
    )).scalar_one_or_none()
    if check is None:
        raise HTTPException(status_code=404, detail="Retention check not found")
    if check.completed_at is not None:
        raise HTTPException(status_code=400, detail="Already completed")

    now = datetime.now(timezone.utc)
    check.completed_at = now
    check.passed = 1 if req.passed else 0

    next_due_at, next_index = schedule_next_retention_check(now, check.interval_index, req.passed)
    db.add(RetentionCheck(
        user_id=user.id, lesson_id=check.lesson_id, due_at=next_due_at, interval_index=next_index,
    ))
    await db.commit()

    return RetentionCompleteResponse(
        next_due_at=next_due_at, next_interval_days=RETENTION_INTERVALS_DAYS[next_index],
    )


# ---------------------------------------------------------------------------
# Trading Simulator Game — a real-content quiz streak challenge, not a
# fabricated price-action simulator (see module docstring).
# ---------------------------------------------------------------------------

class GameRoundItem(BaseModel):
    lesson_id: str
    track_title: str
    question: str
    answer: str


class GameStreakSubmitRequest(BaseModel):
    streak: int


class GameStreakSubmitResponse(BaseModel):
    best_quiz_streak: int
    is_new_best: bool


class LeaderboardEntry(BaseModel):
    full_name: str
    best_quiz_streak: int
    level: int


@router.get("/game/round", response_model=List[GameRoundItem])
async def get_game_round(
    count: int = 10, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    rows = (await db.execute(
        select(Lesson, LearningTrack)
        .join(LearningTrack, LearningTrack.id == Lesson.track_id)
        .where(Lesson.content_body.isnot(None))
    )).all()

    candidates: List[GameRoundItem] = []
    for lesson, track in rows:
        mini_quiz = _extract_section(lesson.content_body, "Mini Quiz")
        question, answer = _extract_q1(mini_quiz)
        if question and answer:
            candidates.append(GameRoundItem(
                lesson_id=str(lesson.id), track_title=track.title, question=question, answer=answer,
            ))

    random.shuffle(candidates)
    return candidates[: max(1, min(count, 25))]


@router.post("/game/streak", response_model=GameStreakSubmitResponse)
async def submit_game_streak(
    req: GameStreakSubmitRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    stats = (await db.execute(
        select(UserLearningStats).where(UserLearningStats.user_id == user.id)
    )).scalar_one_or_none()
    if stats is None:
        stats = UserLearningStats(user_id=user.id)
        db.add(stats)

    is_new_best = req.streak > stats.best_quiz_streak
    if is_new_best:
        stats.best_quiz_streak = req.streak
    await db.commit()
    return GameStreakSubmitResponse(best_quiz_streak=stats.best_quiz_streak, is_new_best=is_new_best)


@router.get("/game/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    rows = (await db.execute(
        select(User.full_name, UserLearningStats.best_quiz_streak, UserLearningStats.total_xp)
        .join(UserLearningStats, UserLearningStats.user_id == User.id)
        .where(UserLearningStats.best_quiz_streak > 0)
        .order_by(UserLearningStats.best_quiz_streak.desc())
        .limit(20)
    )).all()
    return [
        LeaderboardEntry(full_name=name, best_quiz_streak=streak, level=(xp // 100) + 1)
        for name, streak, xp in rows
    ]
