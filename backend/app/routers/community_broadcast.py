"""
Community Broadcast Trigger Router
======================================

Two endpoints meant to be called on a schedule (a Render Cron Job, or
any external scheduler) rather than by a logged-in user clicking a
button — there's no in-process scheduler in this codebase (no Celery
beat / APScheduler), so the recurring part of "daily broadcast" has to
come from outside the request/response cycle somewhere.

Gated on a shared secret header (X-Cron-Secret matching CRON_SECRET),
not a user JWT: a cron caller has no user session to hold a token for,
and a long-lived admin JWT baked into a cron job's config would be a
worse secret to leak than a single-purpose one scoped to exactly these
two endpoints. Same env-var-driven pattern as every other integration
secret in this app (WEBHOOK_SECRET, FIREFLIES_API_KEY, ...).
"""

from __future__ import annotations

import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.community_broadcast import (
    CURATED_QUIZ_QUESTIONS, build_daily_tip, build_leaderboard, send_daily_broadcast, send_weekly_quiz,
)

router = APIRouter(prefix="/community/broadcast", tags=["community-broadcast"])


class PreviewResponse(BaseModel):
    daily_tip: Optional[str]
    leaderboard: Optional[str]
    weekly_quiz_question: str
    weekly_quiz_source: str


@router.get("/preview", response_model=PreviewResponse)
async def preview(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Read-only — lets the Community page show what the channels
    receive without actually sending anything to Telegram."""
    q = CURATED_QUIZ_QUESTIONS[date.today().isocalendar()[1] % len(CURATED_QUIZ_QUESTIONS)]
    return PreviewResponse(
        daily_tip=await build_daily_tip(db), leaderboard=await build_leaderboard(db),
        weekly_quiz_question=q["question"], weekly_quiz_source=q["source"],
    )


def _check_cron_secret(x_cron_secret: str = Header(default="")) -> None:
    expected = os.environ.get("CRON_SECRET", "")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="CRON_SECRET is not set on the backend — set it before wiring up a scheduled caller.",
        )
    if x_cron_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Cron-Secret header")


@router.post("/daily-tip")
async def trigger_daily_broadcast(db: AsyncSession = Depends(get_db), _=Depends(_check_cron_secret)):
    return await send_daily_broadcast(db)


@router.post("/weekly-quiz")
async def trigger_weekly_quiz(_=Depends(_check_cron_secret)):
    return await send_weekly_quiz()
