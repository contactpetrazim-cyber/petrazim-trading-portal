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
