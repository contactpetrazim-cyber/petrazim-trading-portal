"""
Training Curriculum — foundational data model
==================================================

SCOPE NOTE, read this first: this is the FOUNDATION — the data model
and progression logic that a real Learn/Practise system needs. It is
NOT a finished LMS. What's genuinely a separate, larger body of work
that this doesn't attempt to fake:
  - Actual lesson CONTENT (text, video, diagrams) — that's authoring,
    not engineering, and specific to how you want the 5 bots' methods
    explained.
  - Game-layer polish (points animations, leaderboard UI, streak
    visuals) — the data to support these exists here (see
    PracticeAttempt, RetentionCheck); the game FEEL is a design/frontend
    project of its own.
  - AI-generated content — "leverage AI" for lesson generation is a
    prompt-engineering + content-review workflow, not something to bolt
    on as a stub function; flagged as a next step, not built blind here.

WHAT THIS DOES GIVE YOU: a real progression model — novice-to-mastery
tracks (one per bot + general tracks), lessons within tracks, quiz
scoring, spaced-recall retention scheduling (adapted from the
Academy's "spaced-recall nudges" pattern), and a mastery-level
calculation that combines quiz performance with practice repetition,
not just "did they click through the lesson."
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TrackCategory(enum.Enum):
    BASICS = "basics"                    # zero-to-fundamentals, bot-agnostic
    BOT_MASTERY = "bot_mastery"          # one track per bot's specific methodology
    PSYCHOLOGY = "psychology"            # trading psychology, separate from technical tracks
    ADVANCED = "advanced"


class MasteryLevel(enum.Enum):
    NOVICE = "novice"
    DEVELOPING = "developing"
    COMPETENT = "competent"
    PROFICIENT = "proficient"
    MASTERY = "mastery"


class LearningTrack(Base):
    __tablename__ = "learning_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    category = Column(Enum(TrackCategory), nullable=False)
    bot_id = Column(String(50), nullable=True)   # set only for BOT_MASTERY tracks
    description = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)   # display/progression order


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    content_body = Column(Text, nullable=True)     # authored content goes here — empty until written
    estimated_minutes = Column(Integer, nullable=False, default=10)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    score_pct = Column(Float, nullable=False)
    attempted_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class PracticeAttempt(Base):
    """One row per scenario drill / game round — the data backbone for
    the 'Practise' area's drills and game section."""
    __tablename__ = "practice_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    scenario_id = Column(String(100), nullable=False)   # identifies which drill/scenario
    correct = Column(Integer, nullable=False, default=0)   # 1 or 0 — kept as int for simple SQL aggregation
    attempted_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class RetentionCheck(Base):
    """Spaced-recall check-ins — adapted from the Academy's spaced-recall
    nudge pattern. due_at is computed by schedule_next_retention_check()
    below; a scheduler polls for due rows and sends the nudge."""
    __tablename__ = "retention_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    passed = Column(Integer, nullable=True)   # null until completed; then 1/0
    # Position in RETENTION_INTERVALS_DAYS (progression_engine.py) this
    # check's due_at was scheduled from — needed so completing a check
    # can advance (pass) or reset (fail) to the right next interval;
    # nothing previously read or wrote this column at all.
    interval_index = Column(Integer, nullable=False, default=0)


# ---------------------------------------------------------------------------
# Gamification layer — XP, streaks, locked sequential stages, certificates.
# Patterns confirmed working at 10m.training.petrazim.online: stage-based
# progress ("0/23 stages"), XP + level, daily learning streak, locked
# sequence (can't jump ahead), and certificates on completion. Adapted here
# for bot-mastery tracks rather than the Academy's 10 business pillars.
# ---------------------------------------------------------------------------

class TrackStage(Base):
    """One track (e.g. 'Bot 5 — Liquidity Purge Specialist Mastery') is
    broken into a fixed, ordered sequence of stages — mirrors the Academy's
    '23 stages per module' structure. A stage can require a minimum quiz
    score AND a minimum number of practice reps to complete, matching how
    compute_mastery_level() already weighs both signals."""
    __tablename__ = "track_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    stage_number = Column(Integer, nullable=False)   # 1-indexed, sequential within track
    title = Column(String(255), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True)
    min_quiz_score_pct = Column(Float, nullable=False, default=70.0)
    min_practice_reps = Column(Integer, nullable=False, default=0)
    xp_reward = Column(Integer, nullable=False, default=10)


class StageCompletion(Base):
    __tablename__ = "stage_completions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("track_stages.id"), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class UserLearningStats(Base):
    """One row per user — aggregate XP and streak state, updated by the
    progression engine rather than recomputed from scratch each time."""
    __tablename__ = "user_learning_stats"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    total_xp = Column(Integer, nullable=False, default=0)
    current_streak_days = Column(Integer, nullable=False, default=0)
    longest_streak_days = Column(Integer, nullable=False, default=0)
    last_activity_date = Column(DateTime(timezone=True), nullable=True)
    # Best-ever consecutive-correct run in the quiz Game (routers/practise.py)
    # — never decreases, same "longest" pattern as longest_streak_days.
    best_quiz_streak = Column(Integer, nullable=False, default=0)


class LessonRecap(Base):
    """AI-condensed version of a lesson's real content_body — cached
    per lesson, regenerated only if content_hash changes (the lesson
    was re-authored), matching Section 3 of the Learning Design Spec's
    "fetch from cache first, regenerate only on miss/version change".
    One row per lesson; summary/content_hash are overwritten in place
    on regeneration rather than versioned, since nothing here needs
    history of past recaps."""
    __tablename__ = "lesson_recaps"

    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), primary_key=True)
    summary = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)   # sha256 of the lesson's content_body this was generated from
    generated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class RecapEngagement(Base):
    """Per-user open-count on a lesson's Recap — feeds Insights as a
    behavioral-engagement signal alongside quiz/mastery data (Section
    15 of the spec): opening the Recap 5x on a lesson you scored low
    on is a "still confused here" signal a score alone doesn't show."""
    __tablename__ = "recap_engagements"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), primary_key=True)
    open_count = Column(Integer, nullable=False, default=0)
    last_opened_at = Column(DateTime(timezone=True), nullable=True)


class RetrievalQuizCache(Base):
    """AI-generated retrieval-practice questions, grounded ONLY in the
    named lesson's own real content_body (never open-ended) — cached
    per lesson the same way LessonRecap is. `questions_json` is a JSON-
    encoded list of {id, prompt, type, correct_answer}. Distinct from
    QuizAttempt (the real end-of-stage graded assessment, unchanged);
    these are ungraded — see RetrievalResponse below."""
    __tablename__ = "retrieval_quiz_cache"

    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), primary_key=True)
    questions_json = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class RetrievalResponse(Base):
    """One row per answered retrieval question. Ungraded — never reads
    into QuizAttempt.score_pct or any mastery calculation. confidence
    is always captured BEFORE the correct answer is revealed
    (enforced client-side by RetrievalQuizWidget's own flow, and
    server-side here by requiring it on submission)."""
    __tablename__ = "retrieval_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    question_id = Column(String(50), nullable=False)
    # Null until the trainee self-grades against the revealed answer
    # (RetrievalResponse is created at confidence-capture time, before
    # the answer is shown — see routers/curriculum.py's two-step
    # answer/grade flow); 1/0 once graded, matching PracticeAttempt's
    # own self-graded-drill convention.
    answered_correctly = Column(Integer, nullable=True, default=None)
    confidence = Column(String(20), nullable=False)         # 'not_sure' | 'fairly_sure' | 'very_sure'
    answered_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class ReflectionEntry(Base):
    """Free-text reflection, one prompt per track/module end — no AI
    grading, no required length (Section 9 of the spec: "deliberately
    low-complexity")."""
    __tablename__ = "reflection_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class NotebookEntry(Base):
    """Free-text note on a specific stage — Section 12's inline
    per-stage popover + consolidated 'My Notes' list. Independent of
    ReflectionEntry (one prompt per track-end) and of RetrievalResponse
    — this is unstructured note-taking, no prompt, no grading."""
    __tablename__ = "notebook_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pillar_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("track_stages.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class BookmarkedStage(Base):
    """Section 12: dashboard 'Bookmarked' section. Bookmarking is
    explicitly NOT completion tracking (EP02) — a bookmarked stage
    stays bookmarked after being completed, this table never reads or
    writes StageCompletion."""
    __tablename__ = "bookmarked_stages"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("track_stages.id"), primary_key=True)
    saved_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class FlashcardCache(Base):
    """AI-extracted terms from one lesson's own real content — Section
    13: 'extraction, not new content'. Same content_hash caching
    pattern as LessonRecap/RetrievalQuizCache. cards_json is a list of
    {term, definition}."""
    __tablename__ = "flashcard_cache"

    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), primary_key=True)
    cards_json = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class FlashcardReview(Base):
    """One row per self-rating. 'still_learning' feeds the SAME spaced-
    review queue as a missed assessment/retrieval question (Section 13:
    'shared scheduling logic, not a second system') — see
    routers/curriculum.py's flashcard-review handler, which schedules a
    RetentionCheck exactly like schedule_next_retention_check() already
    does for a missed quiz question."""
    __tablename__ = "flashcard_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    card_index = Column(Integer, nullable=False)   # position within FlashcardCache.cards_json for this lesson
    self_rating = Column(String(20), nullable=False)   # 'got_it' | 'still_learning'
    reviewed_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class GameResult(Base):
    """Section 10's shared results-screen contract, persisted. One row
    per play — a replay is a NEW row, the previous score is never
    overwritten (GM03: "New session, previous score not overwritten in
    history (both stored)"). game_id is a fixed string slug (e.g.
    'setup-spotter'), not a foreign key — games are content owned by
    the frontend, this table only records outcomes."""
    __tablename__ = "game_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    game_id = Column(String(50), nullable=False)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=True)
    score = Column(Integer, nullable=False)
    performance_summary = Column(Text, nullable=False)
    missed_items_json = Column(Text, nullable=False, default="[]")
    xp_awarded = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class Certificate(Base):
    """Issued when a user completes every stage in a track — matches the
    Academy's certificate-on-completion pattern. Certificate content
    (PDF generation) is a docx/pdf-skill task at issuance time, not part
    of this data model."""
    __tablename__ = "certificates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    track_id = Column(UUID(as_uuid=True), ForeignKey("learning_tracks.id"), nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    certificate_number = Column(String(50), nullable=False, unique=True)
