"""
Curriculum Router — the real API the Learn area never had
=============================================================

The Learning System Handover's data model and progression_engine.py
were both real and fully tested (locked sequence, the quiz+practice
dual gate, mastery thresholds, streak logic, XP formula, spaced
retention) — but nothing exposed any of it over HTTP. AreaPage.tsx's
Learn tab fell all the way through to a generic FoldedCard link list
because there was no endpoint for a real Learn page to call. This is
that endpoint layer.

Auth: gated on require_active_access, like every other content route —
Learn is a paid feature same as Trade or Insights.

GET /lessons/{lesson_id} was added after the fact: every other Learn
endpoint (stats, tracks, mastery, awards) surfaced progression
metadata, but nothing ever returned a lesson's actual content_body —
the practice/quiz/game endpoints each parse out one small subsection,
never the full authored lesson. See that endpoint's own docstring.

Two numbers on LearningStatsBar aren't in any source document, so
they're a reasonable default rather than an extracted spec:
  - "Level" — no leveling curve is specified anywhere; this uses
    1 level per 100 XP (level = xp // 100 + 1). Flag if a different
    curve is wanted.
  - Track-level "locked" — the handover only defines stage-level
    locking (can_attempt_stage). Applying the same sequential logic
    one level up (track N is locked until track N-1's every stage is
    complete) is an inference, not something spelled out in the docs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access, learner_progress_snapshot
from app.database import get_db
from app.engines.progression_engine import (
    MasteryInput, StreakUpdateResult, can_attempt_stage, compute_mastery_level,
    stage_completion_meets_requirements, update_streak, xp_for_stage,
)
from app.models.curriculum import (
    Certificate, Lesson, LearningTrack, MasteryLevel, PracticeAttempt, QuizAttempt,
    RetentionCheck, StageCompletion, TrackCategory, TrackStage, UserLearningStats,
)
from app.models.user import User

router = APIRouter(prefix="/curriculum", tags=["curriculum"])

# Same emoji-per-category fallback the Learning Handover's TrackCard
# expects (§4) — one emoji per TrackCategory since no per-track emoji
# field exists in the data model.
_CATEGORY_EMOJI = {"basics": "📘", "bot_mastery": "🤖", "psychology": "🧠", "advanced": "🎯"}


# --------------------------------------------------------------------------
# Response models
# --------------------------------------------------------------------------

class StatsResponse(BaseModel):
    overall_mastery_pct: float
    xp: int
    level: int
    current_streak_days: int
    longest_streak_days: int
    stages_complete: int
    stages_total: int
    tracks_complete: int
    tracks_total: int


class TrackSummaryResponse(BaseModel):
    id: str
    emoji: str
    title: str
    description: str
    category: str
    stages_completed: int
    total_stages: int
    locked: bool
    route: str


class StageResponse(BaseModel):
    id: str
    stage_number: int
    title: str
    lesson_id: Optional[str]
    min_quiz_score_pct: float
    min_practice_reps: int
    xp_reward: int
    completed: bool
    can_attempt: bool
    lock_reason: str = ""


class TrackDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    mastery_level: str
    stages: List[StageResponse]


class LessonResponse(BaseModel):
    id: str
    track_id: str
    track_title: str
    stage_number: int
    stage_title: str
    title: str
    content_body: str
    estimated_minutes: int


class QuizSubmitRequest(BaseModel):
    lesson_id: str
    score_pct: float


class PracticeSubmitRequest(BaseModel):
    track_id: str
    scenario_id: str
    correct: bool


class StageCompleteRequest(BaseModel):
    stage_id: str


class StageCompleteResponse(BaseModel):
    completed: bool
    reason: str = ""
    xp_awarded: int = 0
    new_streak_days: Optional[int] = None
    certificate_issued: bool = False


class MasteryTrackResponse(BaseModel):
    id: str
    emoji: str
    title: str
    category: str
    mastery_level: str
    stages_completed: int
    total_stages: int


class MasteryOverviewResponse(BaseModel):
    xp: int
    level: int
    current_streak_days: int
    longest_streak_days: int
    tracks: List[MasteryTrackResponse]


class BadgeResponse(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    earned: bool
    earned_detail: str = ""   # e.g. "Reached on 04/09/2026" or progress toward it, e.g. "3 of 5 tracks"


class CertificateResponse(BaseModel):
    certificate_number: str
    track_title: str
    category: str
    issued_at: datetime


class AwardsResponse(BaseModel):
    badges: List[BadgeResponse]
    certificates: List[CertificateResponse]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

async def _completed_stage_numbers(db: AsyncSession, user_id, track_id) -> List[int]:
    rows = (await db.execute(
        select(TrackStage.stage_number)
        .join(StageCompletion, StageCompletion.stage_id == TrackStage.id)
        .where(TrackStage.track_id == track_id, StageCompletion.user_id == user_id)
    )).scalars().all()
    return list(rows)


async def _track_stage_counts(db: AsyncSession, user_id, track_id) -> tuple[int, int]:
    total = (await db.execute(
        select(func.count(TrackStage.id)).where(TrackStage.track_id == track_id)
    )).scalar() or 0
    done = (await db.execute(
        select(func.count(StageCompletion.id))
        .join(TrackStage, TrackStage.id == StageCompletion.stage_id)
        .where(TrackStage.track_id == track_id, StageCompletion.user_id == user_id)
    )).scalar() or 0
    return done, total


async def _track_mastery_level(db: AsyncSession, user_id, track_id) -> MasteryLevel:
    """Same quiz+practice inputs get_track() already computed per-track
    mastery from — factored out so /mastery can reuse it across every
    track without duplicating the query pair."""
    quiz_scores = (await db.execute(
        select(QuizAttempt.score_pct)
        .join(Lesson, Lesson.id == QuizAttempt.lesson_id)
        .where(Lesson.track_id == track_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.attempted_at)
    )).scalars().all()
    practice_results = (await db.execute(
        select(PracticeAttempt.correct)
        .where(PracticeAttempt.track_id == track_id, PracticeAttempt.user_id == user_id)
        .order_by(PracticeAttempt.attempted_at)
    )).scalars().all()
    return compute_mastery_level(MasteryInput(
        quiz_scores_pct=list(quiz_scores),
        practice_attempts_correct=[bool(r) for r in practice_results],
    ))


async def _get_or_create_stats(db: AsyncSession, user_id) -> UserLearningStats:
    stats = (await db.execute(
        select(UserLearningStats).where(UserLearningStats.user_id == user_id)
    )).scalar_one_or_none()
    if stats is None:
        stats = UserLearningStats(user_id=user_id)
        db.add(stats)
        await db.flush()
    return stats


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    snap = await learner_progress_snapshot(db, user.id)
    mastery_pct = (
        round(100 * snap["stages_complete"] / snap["stages_total"], 1)
        if snap["stages_total"] else 0.0
    )
    return StatsResponse(
        overall_mastery_pct=mastery_pct,
        xp=snap["xp"], level=(snap["xp"] // 100) + 1,
        current_streak_days=snap["current_streak_days"],
        longest_streak_days=snap["longest_streak_days"],
        stages_complete=snap["stages_complete"], stages_total=snap["stages_total"],
        tracks_complete=snap["tracks_complete"], tracks_total=snap["tracks_total"],
    )


@router.get("/tracks", response_model=List[TrackSummaryResponse])
async def list_tracks(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    tracks = (await db.execute(
        select(LearningTrack).order_by(LearningTrack.order_index)
    )).scalars().all()

    out: List[TrackSummaryResponse] = []
    prev_complete = True   # track 1 (lowest order_index) is always unlocked
    for t in tracks:
        done, total = await _track_stage_counts(db, user.id, t.id)
        track_complete = total > 0 and done >= total
        locked = not prev_complete
        out.append(TrackSummaryResponse(
            id=str(t.id), emoji=_CATEGORY_EMOJI.get(t.category.value, "📘"),
            title=t.title, description=t.description, category=t.category.value,
            stages_completed=done, total_stages=total, locked=locked,
            route=f"/learn/tracks/{t.id}",
        ))
        prev_complete = track_complete or total == 0   # a track with no stages yet never blocks the next
    return out


@router.get("/tracks/{track_id}", response_model=TrackDetailResponse)
async def get_track(
    track_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    track = (await db.execute(
        select(LearningTrack).where(LearningTrack.id == track_id)
    )).scalar_one_or_none()
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    stages = (await db.execute(
        select(TrackStage).where(TrackStage.track_id == track_id).order_by(TrackStage.stage_number)
    )).scalars().all()
    completed_numbers = await _completed_stage_numbers(db, user.id, track_id)

    quiz_scores = (await db.execute(
        select(QuizAttempt.score_pct)
        .join(Lesson, Lesson.id == QuizAttempt.lesson_id)
        .where(Lesson.track_id == track_id, QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.attempted_at)
    )).scalars().all()
    practice_results = (await db.execute(
        select(PracticeAttempt.correct)
        .where(PracticeAttempt.track_id == track_id, PracticeAttempt.user_id == user.id)
        .order_by(PracticeAttempt.attempted_at)
    )).scalars().all()
    mastery = compute_mastery_level(MasteryInput(
        quiz_scores_pct=list(quiz_scores),
        practice_attempts_correct=[bool(r) for r in practice_results],
    ))

    stage_out: List[StageResponse] = []
    for s in stages:
        unlock = can_attempt_stage(s.stage_number, completed_numbers)
        stage_out.append(StageResponse(
            id=str(s.id), stage_number=s.stage_number, title=s.title,
            lesson_id=str(s.lesson_id) if s.lesson_id else None,
            min_quiz_score_pct=s.min_quiz_score_pct, min_practice_reps=s.min_practice_reps,
            xp_reward=s.xp_reward, completed=s.stage_number in completed_numbers,
            can_attempt=unlock.can_attempt, lock_reason=unlock.reason,
        ))

    return TrackDetailResponse(
        id=str(track.id), title=track.title, description=track.description,
        category=track.category.value, mastery_level=mastery.value, stages=stage_out,
    )


@router.get("/lessons/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """The one gap left after every other Learn endpoint: nothing has
    ever returned a lesson's actual content_body. LearnTrackPage could
    only ever show the stage list (locked/complete/XP) and hand a
    lesson_id off to the practice/quiz/game endpoints, which each
    parse out one small subsection (Practice Drill, Mini Quiz) — the
    full authored teaching content (Core Teaching, Worked Example,
    Key Takeaways, etc.) was never fetchable at all. Gated by the same
    locked-sequence rule as everything else: viewable once the stage's
    predecessor is complete, or forever after this stage itself is
    complete — never fully locked out after the fact."""
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    stage = (await db.execute(
        select(TrackStage).where(TrackStage.lesson_id == lesson.id)
    )).scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Lesson has no stage")

    track = (await db.execute(
        select(LearningTrack).where(LearningTrack.id == lesson.track_id)
    )).scalar_one_or_none()
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    completed_numbers = await _completed_stage_numbers(db, user.id, lesson.track_id)
    unlock = can_attempt_stage(stage.stage_number, completed_numbers)
    if not unlock.can_attempt and stage.stage_number not in completed_numbers:
        raise HTTPException(status_code=403, detail=unlock.reason)

    return LessonResponse(
        id=str(lesson.id), track_id=str(lesson.track_id), track_title=track.title,
        stage_number=stage.stage_number, stage_title=stage.title,
        title=lesson.title, content_body=lesson.content_body or "",
        estimated_minutes=lesson.estimated_minutes,
    )


@router.get("/mastery", response_model=MasteryOverviewResponse)
async def get_mastery_overview(
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Backs the Site Map's "Mastery Overview" link (/learn/mastery) —
    "Your mastery level across every track, at a glance." Every track's
    mastery_level here is computed the exact same way get_track() computes
    it for one track; this just loops it across all of them rather than
    requiring N separate requests from the frontend."""
    tracks = (await db.execute(
        select(LearningTrack).order_by(LearningTrack.order_index)
    )).scalars().all()

    stats = await _get_or_create_stats(db, user.id)
    await db.commit()  # release the row created by _get_or_create_stats's flush, if any

    track_out: List[MasteryTrackResponse] = []
    for t in tracks:
        done, total = await _track_stage_counts(db, user.id, t.id)
        mastery = await _track_mastery_level(db, user.id, t.id)
        track_out.append(MasteryTrackResponse(
            id=str(t.id), emoji=_CATEGORY_EMOJI.get(t.category.value, "📘"),
            title=t.title, category=t.category.value, mastery_level=mastery.value,
            stages_completed=done, total_stages=total,
        ))

    return MasteryOverviewResponse(
        xp=stats.total_xp, level=(stats.total_xp // 100) + 1,
        current_streak_days=stats.current_streak_days, longest_streak_days=stats.longest_streak_days,
        tracks=track_out,
    )


# Streak/level thresholds a badge is awarded at — arbitrary but explicit,
# same "reasonable default, flag if a different curve is wanted" caveat
# as LearningStatsBar's own level formula above.
_STREAK_BADGE_DAYS = [3, 7, 30]
_LEVEL_BADGE_LEVELS = [5, 10, 25]


@router.get("/awards", response_model=AwardsResponse)
async def get_awards(
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Backs the Site Map's "Awards & Certificates" link (/learn/awards).
    Badges are computed on the fly from real progress data (streak,
    level, per-category and full-curriculum completion) rather than
    stored — there is no seeded badge catalogue to drift out of sync
    with, and a newly-added track is automatically reflected. Certificates
    ARE stored rows (the Certificate model already existed but nothing
    ever wrote to it) — issued by complete_stage() below the moment a
    track's last stage completes."""
    stats = await _get_or_create_stats(db, user.id)
    await db.commit()

    tracks = (await db.execute(select(LearningTrack))).scalars().all()
    per_track_done: dict = {}
    for t in tracks:
        done, total = await _track_stage_counts(db, user.id, t.id)
        per_track_done[t.id] = (done, total, t.category)

    def _category_complete(cat: TrackCategory) -> tuple[bool, int, int]:
        cat_tracks = [(d, tot) for (d, tot, c) in per_track_done.values() if c == cat and tot > 0]
        if not cat_tracks:
            return False, 0, 0
        done_count = sum(1 for d, tot in cat_tracks if d >= tot)
        return done_count == len(cat_tracks), done_count, len(cat_tracks)

    trackable = [(d, tot) for (d, tot, _c) in per_track_done.values() if tot > 0]
    stages_done_total = sum(d for d, _ in trackable)
    all_tracks_complete = bool(trackable) and all(d >= tot for d, tot in trackable)

    badges: List[BadgeResponse] = []
    badges.append(BadgeResponse(
        id="first-step", title="First Step", icon="🎯",
        description="Complete your first learning stage.",
        earned=stages_done_total >= 1,
        earned_detail="Unlocked" if stages_done_total >= 1 else "0 stages complete",
    ))
    for cat, label, icon in [
        (TrackCategory.BASICS, "Basics Mastered", "📘"),
        (TrackCategory.BOT_MASTERY, "Bot Mastery Complete", "🤖"),
        (TrackCategory.PSYCHOLOGY, "Psychology Mastered", "🧠"),
    ]:
        complete, done_count, total_count = _category_complete(cat)
        badges.append(BadgeResponse(
            id=f"category-{cat.value}", title=label, icon=icon,
            description=f"Complete every track in the {label.split(' ')[0]} category.",
            earned=complete,
            earned_detail="Unlocked" if complete else f"{done_count} of {total_count} tracks complete",
        ))
    for days in _STREAK_BADGE_DAYS:
        earned = stats.longest_streak_days >= days
        badges.append(BadgeResponse(
            id=f"streak-{days}", title=f"{days}-Day Streak", icon="🔥",
            description=f"Reach a {days}-day learning streak.",
            earned=earned,
            earned_detail="Unlocked" if earned else f"Best streak so far: {stats.longest_streak_days}d",
        ))
    level = (stats.total_xp // 100) + 1
    for lvl in _LEVEL_BADGE_LEVELS:
        earned = level >= lvl
        badges.append(BadgeResponse(
            id=f"level-{lvl}", title=f"Level {lvl}", icon="⭐",
            description=f"Reach Level {lvl} ({(lvl - 1) * 100} XP).",
            earned=earned,
            earned_detail="Unlocked" if earned else f"Currently Level {level} ({stats.total_xp} XP)",
        ))
    badges.append(BadgeResponse(
        id="full-curriculum", title="Full Curriculum", icon="🏆",
        description="Complete every track currently published.",
        earned=all_tracks_complete,
        earned_detail="Unlocked" if all_tracks_complete else f"{sum(1 for d, tot in trackable if d >= tot)} of {len(trackable)} tracks complete",
    ))

    certs = (await db.execute(
        select(Certificate, LearningTrack)
        .join(LearningTrack, LearningTrack.id == Certificate.track_id)
        .where(Certificate.user_id == user.id)
        .order_by(Certificate.issued_at.desc())
    )).all()
    cert_out = [
        CertificateResponse(
            certificate_number=c.certificate_number, track_title=t.title,
            category=t.category.value, issued_at=c.issued_at,
        )
        for c, t in certs
    ]

    return AwardsResponse(badges=badges, certificates=cert_out)


@router.post("/quiz", response_model=dict)
async def submit_quiz(
    req: QuizSubmitRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    attempt = QuizAttempt(user_id=user.id, lesson_id=req.lesson_id, score_pct=req.score_pct)
    db.add(attempt)
    await db.commit()
    return {"recorded": True, "score_pct": req.score_pct}


@router.post("/practice", response_model=dict)
async def submit_practice(
    req: PracticeSubmitRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    attempt = PracticeAttempt(
        user_id=user.id, track_id=req.track_id, scenario_id=req.scenario_id,
        correct=1 if req.correct else 0,
    )
    db.add(attempt)
    await db.commit()
    return {"recorded": True, "correct": req.correct}


@router.post("/stages/complete", response_model=StageCompleteResponse)
async def complete_stage(
    req: StageCompleteRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Applies the real dual gate (§3b of the Learning System Handover):
    a stage only completes when BOTH the quiz-score minimum AND the
    practice-rep minimum are met — a 90% quiz score alone never
    completes a stage on its own."""
    stage = (await db.execute(
        select(TrackStage).where(TrackStage.id == req.stage_id)
    )).scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")

    already_done = (await db.execute(
        select(StageCompletion).where(
            StageCompletion.user_id == user.id, StageCompletion.stage_id == stage.id,
        )
    )).scalar_one_or_none()
    if already_done is not None:
        return StageCompleteResponse(completed=True, reason="Already completed.")

    completed_numbers = await _completed_stage_numbers(db, user.id, stage.track_id)
    unlock = can_attempt_stage(stage.stage_number, completed_numbers)
    if not unlock.can_attempt:
        return StageCompleteResponse(completed=False, reason=unlock.reason)

    best_quiz = 0.0
    if stage.lesson_id:
        best_quiz = (await db.execute(
            select(func.max(QuizAttempt.score_pct)).where(
                QuizAttempt.user_id == user.id, QuizAttempt.lesson_id == stage.lesson_id,
            )
        )).scalar() or 0.0
    practice_reps = (await db.execute(
        select(func.count(PracticeAttempt.id)).where(
            PracticeAttempt.user_id == user.id, PracticeAttempt.track_id == stage.track_id,
            PracticeAttempt.correct == 1,
        )
    )).scalar() or 0

    if not stage_completion_meets_requirements(
        best_quiz, practice_reps, stage.min_quiz_score_pct, stage.min_practice_reps
    ):
        return StageCompleteResponse(
            completed=False,
            reason=(
                f"Needs {stage.min_quiz_score_pct:.0f}%+ quiz score "
                f"(best so far: {best_quiz:.0f}%) and {stage.min_practice_reps} correct "
                f"practice reps (so far: {practice_reps})."
            ),
        )

    stats = await _get_or_create_stats(db, user.id)
    now = datetime.now(timezone.utc)
    streak: StreakUpdateResult = update_streak(
        stats.last_activity_date, stats.current_streak_days, stats.longest_streak_days, now,
    )
    xp_awarded = xp_for_stage(stage.xp_reward, streak.new_streak_days) if streak.xp_awarded_today else 0

    db.add(StageCompletion(user_id=user.id, stage_id=stage.id, completed_at=now))
    stats.current_streak_days = streak.new_streak_days
    stats.longest_streak_days = streak.new_longest_streak_days
    stats.last_activity_date = now
    stats.total_xp += xp_awarded

    # Schedule the first spaced-recall Retention Review check (routers/
    # practise.py) — the RetentionCheck model and schedule_next_
    # retention_check() already existed, but nothing had ever created
    # the FIRST check for a lesson; without this, /practise/retention/due
    # would stay permanently empty no matter how much was learned.
    if stage.lesson_id is not None:
        db.add(RetentionCheck(
            user_id=user.id, lesson_id=stage.lesson_id,
            due_at=now + timedelta(days=1), interval_index=0,
        ))

    # Certificate on track completion (Section "Gamification layer" of
    # the curriculum model) — the Certificate table already existed but
    # nothing ever wrote to it; issue one here the moment the stage just
    # completed was the LAST stage in its track, once per (user, track).
    certificate_issued = False
    total_stages_in_track = (await db.execute(
        select(func.count(TrackStage.id)).where(TrackStage.track_id == stage.track_id)
    )).scalar() or 0
    stages_now_complete = len(completed_numbers) + 1   # +1 for the StageCompletion just added above
    if total_stages_in_track > 0 and stages_now_complete >= total_stages_in_track:
        existing_cert = (await db.execute(
            select(Certificate).where(
                Certificate.user_id == user.id, Certificate.track_id == stage.track_id,
            )
        )).scalar_one_or_none()
        if existing_cert is None:
            db.add(Certificate(
                user_id=user.id, track_id=stage.track_id,
                certificate_number=f"PZ-{uuid.uuid4().hex[:10].upper()}",
            ))
            certificate_issued = True

    await db.commit()

    return StageCompleteResponse(
        completed=True, xp_awarded=xp_awarded, new_streak_days=streak.new_streak_days,
        certificate_issued=certificate_issued,
    )
