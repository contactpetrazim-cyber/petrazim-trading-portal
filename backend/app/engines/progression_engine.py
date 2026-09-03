"""
Progression Engine
=====================

Two independent, testable pieces:

1. compute_mastery_level() — combines quiz performance AND practice
   repetition into one mastery reading. Quiz score alone is a bad
   signal (someone can memorize answers); repetition alone is a bad
   signal (someone can grind drills without understanding). Both
   together is closer to the truth.

2. schedule_next_retention_check() — spaced-recall scheduling, adapted
   from the Academy's "spaced-recall nudges" pattern. Standard spaced-
   repetition intervals (1 day, 3 days, 7 days, 14 days, 30 days),
   advancing on a pass and resetting to the start on a fail — this is
   the well-established spacing-effect approach, not a novel algorithm.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional

from app.models.curriculum import MasteryLevel

# Standard spaced-repetition intervals. Resets to index 0 on a failed
# retention check; advances one step on a pass.
RETENTION_INTERVALS_DAYS = [1, 3, 7, 14, 30]


@dataclass
class MasteryInput:
    quiz_scores_pct: List[float]      # all quiz attempts for this track, most recent last
    practice_attempts_correct: List[bool]   # all practice drill results for this track


def compute_mastery_level(inp: MasteryInput) -> MasteryLevel:
    if not inp.quiz_scores_pct and not inp.practice_attempts_correct:
        return MasteryLevel.NOVICE

    # Weight recent quiz performance more than early attempts (people
    # improve) — simple recency weighting via a trailing average over
    # the last 3 attempts rather than all-time average.
    recent_quiz = inp.quiz_scores_pct[-3:] if inp.quiz_scores_pct else []
    avg_quiz = sum(recent_quiz) / len(recent_quiz) if recent_quiz else 0.0

    practice_count = len(inp.practice_attempts_correct)
    recent_practice = inp.practice_attempts_correct[-10:] if inp.practice_attempts_correct else []
    practice_accuracy = (sum(recent_practice) / len(recent_practice)) if recent_practice else 0.0

    # Mastery requires BOTH strong recent quiz performance AND enough
    # practice volume with good accuracy — either alone caps out at
    # PROFICIENT, never MASTERY.
    if avg_quiz >= 90 and practice_accuracy >= 0.85 and practice_count >= 20:
        return MasteryLevel.MASTERY
    if avg_quiz >= 80 and practice_accuracy >= 0.75 and practice_count >= 10:
        return MasteryLevel.PROFICIENT
    if avg_quiz >= 65 and practice_count >= 5:
        return MasteryLevel.COMPETENT
    if avg_quiz > 0 or practice_count > 0:
        return MasteryLevel.DEVELOPING
    return MasteryLevel.NOVICE


def schedule_next_retention_check(
    completed_at: datetime, current_interval_index: int, passed_last_check: bool
) -> tuple[datetime, int]:
    """Returns (next_due_at, next_interval_index). Call this after every
    retention check completes (pass or fail) to schedule the next one."""
    if not passed_last_check:
        next_index = 0
    else:
        next_index = min(current_interval_index + 1, len(RETENTION_INTERVALS_DAYS) - 1)

    days = RETENTION_INTERVALS_DAYS[next_index]
    return completed_at + timedelta(days=days), next_index


# ---------------------------------------------------------------------------
# Locked-sequence stage progression + XP/streak — matches the proven
# pattern at 10m.training.petrazim.online (stage-based %, XP, daily streak,
# can't skip ahead).
# ---------------------------------------------------------------------------

@dataclass
class StageUnlockCheck:
    can_attempt: bool
    reason: str = ""


def can_attempt_stage(
    stage_number: int, completed_stage_numbers: List[int]
) -> StageUnlockCheck:
    """Locked sequence: stage N can only be attempted once stage N-1 is
    complete. Stage 1 is always open."""
    if stage_number == 1:
        return StageUnlockCheck(can_attempt=True)
    if (stage_number - 1) in completed_stage_numbers:
        return StageUnlockCheck(can_attempt=True)
    return StageUnlockCheck(
        can_attempt=False,
        reason=f"Complete stage {stage_number - 1} first — stages unlock in sequence.",
    )


def stage_completion_meets_requirements(
    quiz_score_pct: float, practice_reps: int,
    min_quiz_score_pct: float, min_practice_reps: int,
) -> bool:
    return quiz_score_pct >= min_quiz_score_pct and practice_reps >= min_practice_reps


@dataclass
class StreakUpdateResult:
    new_streak_days: int
    new_longest_streak_days: int
    xp_awarded_today: bool   # False if streak already counted today (no double-count)


def update_streak(
    last_activity_date: Optional[datetime], current_streak_days: int,
    longest_streak_days: int, activity_date: datetime,
) -> StreakUpdateResult:
    """Call once per day a user does ANY learning activity (stage complete,
    quiz, practice, retention check). Same-day repeat calls don't inflate
    the streak; a gap of more than 1 day resets it to 1, not 0 — the day
    they're active on still counts."""
    if last_activity_date is None:
        return StreakUpdateResult(1, max(1, longest_streak_days), True)

    days_gap = (activity_date.date() - last_activity_date.date()).days

    if days_gap == 0:
        return StreakUpdateResult(current_streak_days, longest_streak_days, False)
    if days_gap == 1:
        new_streak = current_streak_days + 1
        return StreakUpdateResult(new_streak, max(new_streak, longest_streak_days), True)
    # gap > 1 day: streak broken, restart at 1
    return StreakUpdateResult(1, longest_streak_days, True)


def xp_for_stage(base_xp: int, current_streak_days: int) -> int:
    """Small streak bonus — matches common LMS gamification (the Academy
    reference explicitly frames streak as driving retention); capped so a
    huge streak doesn't spiral XP economy out of balance."""
    streak_multiplier = 1.0 + min(current_streak_days, 30) * 0.02   # up to +60% at a 30-day streak
    return round(base_xp * streak_multiplier)
