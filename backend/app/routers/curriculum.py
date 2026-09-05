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

import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access, learner_progress_snapshot
from app.database import get_db
from app.engines.learning_content_ai import generate_flashcards, generate_recap, generate_retrieval_questions
from app.engines.progression_engine import (
    MasteryInput, StreakUpdateResult, can_attempt_stage, compute_mastery_level,
    schedule_next_retention_check, stage_completion_meets_requirements, update_streak, xp_for_stage,
)
from app.models.curriculum import (
    BookmarkedStage, Certificate, FlashcardCache, FlashcardReview, GameResult, Lesson,
    LearningTrack, LessonRecap, MasteryLevel, NotebookEntry, PracticeAttempt, QuizAttempt,
    RecapEngagement, ReflectionEntry, RetentionCheck, RetrievalQuizCache, RetrievalResponse,
    StageCompletion, TrackCategory, TrackStage, UserLearningStats,
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
    stage_id: str
    stage_number: int
    stage_title: str
    title: str
    content_body: str
    estimated_minutes: int


class RecapResponse(BaseModel):
    lesson_id: str
    summary: str
    generated_at: str
    open_count: int


class RetrievalQuestionResponse(BaseModel):
    id: str
    prompt: str
    type: str


class RetrievalQuizResponse(BaseModel):
    lesson_id: str
    questions: List[RetrievalQuestionResponse]


class RetrievalConfidenceRequest(BaseModel):
    question_id: str
    confidence: str   # 'not_sure' | 'fairly_sure' | 'very_sure'


class RetrievalRevealResponse(BaseModel):
    response_id: str
    correct_answer: str


class RetrievalGradeRequest(BaseModel):
    response_id: str
    self_reported_correct: bool


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
        stage_id=str(stage.id), stage_number=stage.stage_number, stage_title=stage.title,
        title=lesson.title, content_body=lesson.content_body or "",
        estimated_minutes=lesson.estimated_minutes,
    )


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def _get_lesson_or_404(db: AsyncSession, lesson_id: str) -> Lesson:
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not lesson.content_body:
        raise HTTPException(status_code=404, detail="This lesson has no content yet to generate from")
    return lesson


@router.get("/lessons/{lesson_id}/recap", response_model=RecapResponse)
async def get_lesson_recap(
    lesson_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Section 3 of the Learning Design Spec — an AI-condensed version
    of this lesson's own real content, cached in LessonRecap and only
    regenerated if the lesson's content_body has actually changed
    (content_hash mismatch) since the cached copy was made."""
    lesson = await _get_lesson_or_404(db, lesson_id)
    current_hash = _content_hash(lesson.content_body)

    cached = (await db.execute(
        select(LessonRecap).where(LessonRecap.lesson_id == lesson.id)
    )).scalar_one_or_none()

    if cached is None or cached.content_hash != current_hash:
        summary = await generate_recap(lesson.title, lesson.content_body)
        if summary is None:
            raise HTTPException(
                status_code=503,
                detail="Recap isn't available right now — no AI provider responded. Try again in a moment.",
            )
        if cached is None:
            cached = LessonRecap(lesson_id=lesson.id, summary=summary, content_hash=current_hash)
            db.add(cached)
        else:
            cached.summary = summary
            cached.content_hash = current_hash
            cached.generated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(cached)

    engagement = (await db.execute(
        select(RecapEngagement).where(
            RecapEngagement.user_id == user.id, RecapEngagement.lesson_id == lesson.id,
        )
    )).scalar_one_or_none()

    return RecapResponse(
        lesson_id=str(lesson.id), summary=cached.summary,
        generated_at=cached.generated_at.isoformat(),
        open_count=engagement.open_count if engagement else 0,
    )


@router.post("/lessons/{lesson_id}/recap/open", response_model=dict)
async def open_lesson_recap(
    lesson_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Every real open of the Recap panel increments this — feeds
    Insights (Section 15) as a behavioral-engagement signal. Called
    once per panel-open by the frontend, separate from GET .../recap
    itself so re-renders/refetches of the same open don't double-count."""
    engagement = (await db.execute(
        select(RecapEngagement).where(
            RecapEngagement.user_id == user.id, RecapEngagement.lesson_id == uuid.UUID(lesson_id),
        )
    )).scalar_one_or_none()
    if engagement is None:
        engagement = RecapEngagement(user_id=user.id, lesson_id=lesson_id, open_count=0)
        db.add(engagement)
    engagement.open_count += 1
    engagement.last_opened_at = datetime.utcnow()
    await db.commit()
    return {"open_count": engagement.open_count}


@router.get("/lessons/{lesson_id}/retrieval-quiz", response_model=RetrievalQuizResponse)
async def get_retrieval_quiz(
    lesson_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Section 6 — 3-5 ungraded retrieval-practice questions, grounded
    strictly in this lesson's own real content (never QuizAttempt's
    graded assessmentScore). Cached the same way Recap is; correct
    answers are withheld from this response (RetrievalAnswerResponse
    reveals them only after an answer is submitted with a confidence
    rating, per the spec's "confidence before reveal, every time")."""
    lesson = await _get_lesson_or_404(db, lesson_id)
    current_hash = _content_hash(lesson.content_body)

    cached = (await db.execute(
        select(RetrievalQuizCache).where(RetrievalQuizCache.lesson_id == lesson.id)
    )).scalar_one_or_none()

    if cached is None or cached.content_hash != current_hash:
        drafts = await generate_retrieval_questions(lesson.title, lesson.content_body)
        if not drafts:
            raise HTTPException(
                status_code=503,
                detail="A quick check isn't available for this lesson right now — try again in a moment.",
            )
        questions = [
            {"id": f"{lesson.id}-{i}", "prompt": d.prompt, "type": d.type, "correct_answer": d.correct_answer}
            for i, d in enumerate(drafts)
        ]
        payload = json.dumps(questions)
        if cached is None:
            cached = RetrievalQuizCache(lesson_id=lesson.id, questions_json=payload, content_hash=current_hash)
            db.add(cached)
        else:
            cached.questions_json = payload
            cached.content_hash = current_hash
            cached.generated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(cached)

    questions = json.loads(cached.questions_json)
    return RetrievalQuizResponse(
        lesson_id=str(lesson.id),
        questions=[RetrievalQuestionResponse(id=q["id"], prompt=q["prompt"], type=q["type"]) for q in questions],
    )


@router.post("/lessons/{lesson_id}/retrieval-quiz/confidence", response_model=RetrievalRevealResponse)
async def submit_retrieval_confidence(
    lesson_id: str, req: RetrievalConfidenceRequest,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Step 1 of 2 — confidence is logged and the answer revealed only
    after that, never before, per the spec's "confidence captured
    before the answer is revealed, every time." Creates the
    RetrievalResponse row ungraded (answered_correctly stays null);
    the frontend calls .../grade next, once the trainee has compared
    their own recall against correct_answer."""
    if req.confidence not in ("not_sure", "fairly_sure", "very_sure"):
        raise HTTPException(status_code=400, detail="confidence must be 'not_sure', 'fairly_sure', or 'very_sure'")

    cached = (await db.execute(
        select(RetrievalQuizCache).where(RetrievalQuizCache.lesson_id == uuid.UUID(lesson_id))
    )).scalar_one_or_none()
    if cached is None:
        raise HTTPException(status_code=404, detail="No quiz cached for this lesson — fetch it first")

    questions = json.loads(cached.questions_json)
    question = next((q for q in questions if q["id"] == req.question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    response = RetrievalResponse(
        user_id=user.id, lesson_id=uuid.UUID(lesson_id), question_id=req.question_id,
        confidence=req.confidence, answered_correctly=None,
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)

    return RetrievalRevealResponse(response_id=str(response.id), correct_answer=question["correct_answer"])


@router.post("/retrieval-quiz/grade", response_model=dict)
async def grade_retrieval_response(
    req: RetrievalGradeRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Step 2 of 2 — the trainee self-grades against the answer .../confidence
    just revealed (same self-graded pattern as PracticeAttempt's drills
    elsewhere in this app). Ungraded/untracked toward assessmentScore
    either way; only feeds the confidence-accuracy "worth revisiting" flag."""
    response = (await db.execute(
        select(RetrievalResponse).where(
            RetrievalResponse.id == uuid.UUID(req.response_id), RetrievalResponse.user_id == user.id,
        )
    )).scalar_one_or_none()
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    response.answered_correctly = 1 if req.self_reported_correct else 0
    await db.commit()
    return {"ok": True}


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


# --------------------------------------------------------------------------
# Reflection Journal (Section 9) — free-text, one prompt per track,
# deliberately low-complexity: no AI grading, no required length, not
# mandatory (an empty/skipped reflection is allowed, just not useful).
# --------------------------------------------------------------------------

class ReflectionSubmitRequest(BaseModel):
    track_id: str
    text: str


class ReflectionEntryResponse(BaseModel):
    id: str
    track_id: str
    track_title: str
    text: str
    created_at: str


@router.post("/reflections", response_model=ReflectionEntryResponse)
async def submit_reflection(
    req: ReflectionSubmitRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    track = (await db.execute(select(LearningTrack).where(LearningTrack.id == req.track_id))).scalar_one_or_none()
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    entry = ReflectionEntry(user_id=user.id, track_id=track.id, text=req.text)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return ReflectionEntryResponse(
        id=str(entry.id), track_id=str(track.id), track_title=track.title,
        text=entry.text, created_at=entry.created_at.isoformat(),
    )


@router.get("/reflections", response_model=List[ReflectionEntryResponse])
async def list_reflections(
    track_id: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """"My Reflections" — chronological, filterable by track (EP-style
    read view, Section 9's RJ02 test case)."""
    query = select(ReflectionEntry).where(ReflectionEntry.user_id == user.id)
    if track_id:
        query = query.where(ReflectionEntry.track_id == track_id)
    entries = (await db.execute(query.order_by(ReflectionEntry.created_at.desc()))).scalars().all()
    if not entries:
        return []

    track_ids = {e.track_id for e in entries}
    tracks = (await db.execute(select(LearningTrack).where(LearningTrack.id.in_(track_ids)))).scalars().all()
    title_by_id = {t.id: t.title for t in tracks}

    return [
        ReflectionEntryResponse(
            id=str(e.id), track_id=str(e.track_id), track_title=title_by_id.get(e.track_id, "Unknown track"),
            text=e.text, created_at=e.created_at.isoformat(),
        )
        for e in entries
    ]


# --------------------------------------------------------------------------
# Notebook (Section 12) — per-stage free-text notes + consolidated
# "My Notes" list. Independent of ReflectionEntry/RetrievalResponse.
# --------------------------------------------------------------------------

class NotebookSubmitRequest(BaseModel):
    stage_id: str
    text: str


class NotebookEntryResponse(BaseModel):
    id: str
    stage_id: str
    stage_title: str
    pillar_id: str
    pillar_title: str
    text: str
    created_at: str


async def _stage_and_track_or_404(db: AsyncSession, stage_id: str) -> tuple[TrackStage, LearningTrack]:
    stage = (await db.execute(select(TrackStage).where(TrackStage.id == stage_id))).scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    track = (await db.execute(select(LearningTrack).where(LearningTrack.id == stage.track_id))).scalar_one_or_none()
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return stage, track


@router.post("/notebook", response_model=NotebookEntryResponse)
async def add_notebook_entry(
    req: NotebookSubmitRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    stage, track = await _stage_and_track_or_404(db, req.stage_id)
    entry = NotebookEntry(user_id=user.id, pillar_id=track.id, stage_id=stage.id, text=req.text)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return NotebookEntryResponse(
        id=str(entry.id), stage_id=str(stage.id), stage_title=stage.title,
        pillar_id=str(track.id), pillar_title=track.title,
        text=entry.text, created_at=entry.created_at.isoformat(),
    )


@router.get("/notebook", response_model=List[NotebookEntryResponse])
async def list_notebook_entries(
    stage_id: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    query = select(NotebookEntry).where(NotebookEntry.user_id == user.id)
    if stage_id:
        query = query.where(NotebookEntry.stage_id == stage_id)
    entries = (await db.execute(query.order_by(NotebookEntry.created_at.desc()))).scalars().all()
    if not entries:
        return []

    stage_ids = {e.stage_id for e in entries}
    stages = (await db.execute(select(TrackStage).where(TrackStage.id.in_(stage_ids)))).scalars().all()
    stage_by_id = {s.id: s for s in stages}
    track_ids = {s.track_id for s in stages}
    tracks = (await db.execute(select(LearningTrack).where(LearningTrack.id.in_(track_ids)))).scalars().all()
    track_title_by_id = {t.id: t.title for t in tracks}

    out = []
    for e in entries:
        stage = stage_by_id.get(e.stage_id)
        out.append(NotebookEntryResponse(
            id=str(e.id), stage_id=str(e.stage_id), stage_title=stage.title if stage else "Unknown stage",
            pillar_id=str(e.pillar_id), pillar_title=track_title_by_id.get(e.pillar_id, "Unknown track"),
            text=e.text, created_at=e.created_at.isoformat(),
        ))
    return out


@router.delete("/notebook/{entry_id}", response_model=dict)
async def delete_notebook_entry(
    entry_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    entry = (await db.execute(
        select(NotebookEntry).where(NotebookEntry.id == entry_id, NotebookEntry.user_id == user.id)
    )).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(entry)
    await db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Bookmarks (Section 12) — dashboard "Bookmarked" section. Explicitly
# NOT completion tracking (EP02): bookmarking a stage and completing it
# are independent state.
# --------------------------------------------------------------------------

class BookmarkResponse(BaseModel):
    stage_id: str
    stage_title: str
    pillar_id: str
    pillar_title: str
    saved_at: str


@router.post("/bookmarks/{stage_id}", response_model=BookmarkResponse)
async def add_bookmark(
    stage_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    stage, track = await _stage_and_track_or_404(db, stage_id)
    existing = (await db.execute(
        select(BookmarkedStage).where(BookmarkedStage.user_id == user.id, BookmarkedStage.stage_id == stage.id)
    )).scalar_one_or_none()
    if existing is None:
        existing = BookmarkedStage(user_id=user.id, stage_id=stage.id)
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
    return BookmarkResponse(
        stage_id=str(stage.id), stage_title=stage.title, pillar_id=str(track.id),
        pillar_title=track.title, saved_at=existing.saved_at.isoformat(),
    )


@router.delete("/bookmarks/{stage_id}", response_model=dict)
async def remove_bookmark(
    stage_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    existing = (await db.execute(
        select(BookmarkedStage).where(BookmarkedStage.user_id == user.id, BookmarkedStage.stage_id == stage_id)
    )).scalar_one_or_none()
    if existing is not None:
        await db.delete(existing)
        await db.commit()
    return {"ok": True}


@router.get("/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    rows = (await db.execute(
        select(BookmarkedStage).where(BookmarkedStage.user_id == user.id).order_by(BookmarkedStage.saved_at.desc())
    )).scalars().all()
    if not rows:
        return []

    stage_ids = {r.stage_id for r in rows}
    stages = (await db.execute(select(TrackStage).where(TrackStage.id.in_(stage_ids)))).scalars().all()
    stage_by_id = {s.id: s for s in stages}
    track_ids = {s.track_id for s in stages}
    tracks = (await db.execute(select(LearningTrack).where(LearningTrack.id.in_(track_ids)))).scalars().all()
    track_title_by_id = {t.id: t.title for t in tracks}

    out = []
    for r in rows:
        stage = stage_by_id.get(r.stage_id)
        if stage is None:
            continue
        out.append(BookmarkResponse(
            stage_id=str(r.stage_id), stage_title=stage.title,
            pillar_id=str(stage.track_id), pillar_title=track_title_by_id.get(stage.track_id, "Unknown track"),
            saved_at=r.saved_at.isoformat(),
        ))
    return out


# --------------------------------------------------------------------------
# Flashcards (Section 13) — AI-extracted from a lesson's own real
# content, cached like Recap/Retrieval Quiz. "still_learning" schedules
# a RetentionCheck through the SAME spaced-review engine a missed
# assessment/retrieval question already uses (shared scheduling logic,
# not a second system, per the spec's own instruction).
# --------------------------------------------------------------------------

class FlashcardResponse(BaseModel):
    index: int
    term: str
    definition: str
    source_lesson_id: str
    source_stage_title: str


class FlashcardReviewRequest(BaseModel):
    self_rating: str   # 'got_it' | 'still_learning'


@router.get("/lessons/{lesson_id}/flashcards", response_model=List[FlashcardResponse])
async def get_lesson_flashcards(
    lesson_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    lesson = await _get_lesson_or_404(db, lesson_id)
    stage = (await db.execute(select(TrackStage).where(TrackStage.lesson_id == lesson.id))).scalar_one_or_none()
    current_hash = _content_hash(lesson.content_body)

    cached = (await db.execute(
        select(FlashcardCache).where(FlashcardCache.lesson_id == lesson.id)
    )).scalar_one_or_none()

    if cached is None or cached.content_hash != current_hash:
        drafts = await generate_flashcards(lesson.title, lesson.content_body)
        if not drafts:
            raise HTTPException(
                status_code=503,
                detail="Flashcards aren't available for this lesson right now — try again in a moment.",
            )
        payload = json.dumps([{"term": d.term, "definition": d.definition} for d in drafts])
        if cached is None:
            cached = FlashcardCache(lesson_id=lesson.id, cards_json=payload, content_hash=current_hash)
            db.add(cached)
        else:
            cached.cards_json = payload
            cached.content_hash = current_hash
            cached.generated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(cached)

    cards = json.loads(cached.cards_json)
    return [
        FlashcardResponse(
            index=i, term=c["term"], definition=c["definition"],
            source_lesson_id=str(lesson.id), source_stage_title=stage.title if stage else lesson.title,
        )
        for i, c in enumerate(cards)
    ]


@router.post("/lessons/{lesson_id}/flashcards/{index}/review", response_model=dict)
async def review_flashcard(
    lesson_id: str, index: int, req: FlashcardReviewRequest,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    if req.self_rating not in ("got_it", "still_learning"):
        raise HTTPException(status_code=400, detail="self_rating must be 'got_it' or 'still_learning'")

    db.add(FlashcardReview(
        user_id=user.id, lesson_id=uuid.UUID(lesson_id), card_index=index, self_rating=req.self_rating,
    ))

    scheduled = False
    if req.self_rating == "still_learning":
        due_at, interval_index = schedule_next_retention_check(
            completed_at=datetime.utcnow(), current_interval_index=0, passed_last_check=False,
        )
        db.add(RetentionCheck(
            user_id=user.id, lesson_id=uuid.UUID(lesson_id), due_at=due_at, interval_index=interval_index,
        ))
        scheduled = True

    await db.commit()
    return {"ok": True, "scheduled_for_review": scheduled}


# --------------------------------------------------------------------------
# Games (Section 10a) — shared results-screen contract + XP, one row
# per play (never overwritten — GM03). Games are frontend-owned content
# (scenario text/mechanics live in the component, not the database);
# this only records outcomes and awards XP through the SAME
# xp_for_stage/update_streak path stage completion already uses, per
# Section 16's "single source of truth" for XP/streaks.
# --------------------------------------------------------------------------

class GameCompleteRequest(BaseModel):
    track_id: Optional[str] = None
    score: int
    performance_summary: str
    missed_items: List[str] = []
    base_xp: int = 15


class GameResultResponse(BaseModel):
    id: str
    game_id: str
    score: int
    performance_summary: str
    missed_items: List[str]
    xp_awarded: int
    new_streak_days: int
    completed_at: str


@router.post("/games/{game_id}/complete", response_model=GameResultResponse)
async def complete_game(
    game_id: str, req: GameCompleteRequest,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    stats = await _get_or_create_stats(db, user.id)
    now = datetime.utcnow()

    streak = update_streak(
        last_activity_date=stats.last_activity_date, current_streak_days=stats.current_streak_days,
        longest_streak_days=stats.longest_streak_days, activity_date=now,
    )
    xp_awarded = xp_for_stage(req.base_xp, streak.new_streak_days) if streak.xp_awarded_today else 0

    stats.total_xp += xp_awarded
    stats.current_streak_days = streak.new_streak_days
    stats.longest_streak_days = streak.new_longest_streak_days
    stats.last_activity_date = now

    result = GameResult(
        user_id=user.id, game_id=game_id, track_id=uuid.UUID(req.track_id) if req.track_id else None,
        score=req.score, performance_summary=req.performance_summary,
        missed_items_json=json.dumps(req.missed_items), xp_awarded=xp_awarded, completed_at=now,
    )
    db.add(result)
    await db.commit()
    await db.refresh(result)

    return GameResultResponse(
        id=str(result.id), game_id=game_id, score=result.score,
        performance_summary=result.performance_summary, missed_items=req.missed_items,
        xp_awarded=xp_awarded, new_streak_days=streak.new_streak_days,
        completed_at=result.completed_at.isoformat(),
    )


@router.get("/games/{game_id}/history", response_model=List[GameResultResponse])
async def game_history(
    game_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    rows = (await db.execute(
        select(GameResult)
        .where(GameResult.user_id == user.id, GameResult.game_id == game_id)
        .order_by(GameResult.completed_at.desc())
        .limit(20)
    )).scalars().all()
    return [
        GameResultResponse(
            id=str(r.id), game_id=r.game_id, score=r.score, performance_summary=r.performance_summary,
            missed_items=json.loads(r.missed_items_json), xp_awarded=r.xp_awarded,
            new_streak_days=0, completed_at=r.completed_at.isoformat(),
        )
        for r in rows
    ]
