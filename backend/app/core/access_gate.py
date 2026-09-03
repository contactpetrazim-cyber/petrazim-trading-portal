"""
Access Expiry Gate
=====================

Once a user's access window closes, NO protected action should
succeed — not a soft warning, a hard block, with the exact specified
message and card design. This is a FastAPI dependency other routers
add alongside get_current_user, so the block happens server-side on
every protected call, not just as a frontend UI state a direct API
call could bypass.

Includes real progress stats in the error payload (stages/tracks
complete, XP) so the "your progress is preserved" reassurance on the
card is backed by actual numbers, not decorative placeholder text.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.access import UserAccess
from app.models.curriculum import LearningTrack, StageCompletion, TrackStage, UserLearningStats
from app.models.user import User


async def learner_progress_snapshot(db: AsyncSession, user_id) -> dict:
    """Public (not underscore-prefixed) on purpose — also called by
    GET /auth/learning-stats (routers/auth.py) for the corporate home
    page's stats grid, so both places share one query instead of two
    copies drifting apart. Every field defaults to 0 for a brand-new
    account with no UserLearningStats row yet, exactly as intended:
    these numbers are real, not decorative, and simply start at 0
    until the (not yet built) Learn progression engine writes to
    them."""
    total_stages = (await db.execute(select(func.count(TrackStage.id)))).scalar() or 0
    stages_complete = (await db.execute(
        select(func.count(StageCompletion.id)).where(StageCompletion.user_id == user_id)
    )).scalar() or 0

    total_tracks = (await db.execute(select(func.count(LearningTrack.id)))).scalar() or 0
    # A track counts as "finished" once every one of its stages is completed —
    # computed here rather than stored, so it's always consistent with the
    # underlying stage-completion rows rather than a separately-maintained flag.
    tracks_rows = (await db.execute(select(LearningTrack.id))).scalars().all()
    tracks_complete = 0
    for track_id in tracks_rows:
        stage_ids = (await db.execute(
            select(TrackStage.id).where(TrackStage.track_id == track_id)
        )).scalars().all()
        if not stage_ids:
            continue
        done = (await db.execute(
            select(func.count(StageCompletion.id)).where(
                StageCompletion.user_id == user_id, StageCompletion.stage_id.in_(stage_ids)
            )
        )).scalar() or 0
        if done >= len(stage_ids):
            tracks_complete += 1

    stats = (await db.execute(
        select(UserLearningStats).where(UserLearningStats.user_id == user_id)
    )).scalar_one_or_none()

    return {
        "stages_complete": stages_complete, "stages_total": total_stages,
        "tracks_complete": tracks_complete, "tracks_total": total_tracks,
        "xp": stats.total_xp if stats else 0,
        "current_streak_days": stats.current_streak_days if stats else 0,
    }


class AccessExpiredError(HTTPException):
    def __init__(self, expired_at: Optional[datetime], progress: dict):
        p = progress
        detail = {
            "error": "access_expired",
            "title": "Access Expired — Please Renew to Continue",
            "message": (
                f"Your access window closed on {expired_at.strftime('%d/%m/%Y, %H:%M:%S')}. "
                f"Everything you have done so far is safe."
                if expired_at else
                "Your access window has closed. Everything you have done so far is safe."
            ),
            "progress_label": "Your progress is preserved",
            "progress_detail": (
                f"{p['stages_complete']} of {p['stages_total']} stages complete · "
                f"{p['tracks_complete']} of {p['tracks_total']} tracks finished · "
                f"{p['xp']} XP. Renewing picks up exactly where you left off — "
                f"no restart, no lost notes, journals or badges."
            ),
            "promo_hint": "Have a promo code? You can apply it on the renewal screen.",
        }
        super().__init__(status_code=402, detail=detail)


async def require_active_access(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> User:
    """Drop-in replacement for get_current_user on any route that should
    be fully blocked once access lapses (everything except account
    settings, the renewal/payment flow itself, and public marketing
    pages — those should keep using plain get_current_user)."""
    now = datetime.now(timezone.utc)

    active = (await db.execute(
        select(UserAccess).where(
            UserAccess.user_id == user.id, UserAccess.is_active == True,  # noqa: E712
            UserAccess.expires_at > now,
        )
    )).scalar_one_or_none()

    if active is not None:
        return user

    most_recent_expired = (await db.execute(
        select(UserAccess)
        .where(UserAccess.user_id == user.id)
        .order_by(UserAccess.expires_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    progress = await learner_progress_snapshot(db, user.id)
    raise AccessExpiredError(most_recent_expired.expires_at if most_recent_expired else None, progress)
