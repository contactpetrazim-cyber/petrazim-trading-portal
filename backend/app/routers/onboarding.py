"""
Community Status + Onboarding Status
========================================

Two small, read-only endpoints that power the mandatory
Register -> Pay -> Community -> Trade/Explore flow. The frontend
OnboardingPage polls /onboarding/status to know which step to show —
this is what makes the community step genuinely mandatory (not just a
UI convention): /trade and other gated routes should check the same
underlying state server-side, not trust that the frontend enforced the
sequence.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.access import UserAccess
from app.models.telegram_link import TelegramLink
from app.models.user import User

router = APIRouter(tags=["onboarding"])


class CommunityStatusResponse(BaseModel):
    telegram_connected: bool
    telegram_username: Optional[str] = None


@router.get("/community/status", response_model=CommunityStatusResponse)
async def community_status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    link = (await db.execute(
        select(TelegramLink).where(TelegramLink.user_id == user.id)
    )).scalar_one_or_none()

    return CommunityStatusResponse(
        telegram_connected=link is not None,
        telegram_username=link.telegram_username if link else None,
    )


class OnboardingStatusResponse(BaseModel):
    registered: bool
    has_paid_access: bool
    community_joined: bool
    current_step: str


@router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def onboarding_status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)

    access = (await db.execute(
        select(UserAccess).where(
            UserAccess.user_id == user.id, UserAccess.is_active == True,  # noqa: E712
            UserAccess.expires_at > now,
        )
    )).scalar_one_or_none()

    link = (await db.execute(
        select(TelegramLink).where(TelegramLink.user_id == user.id)
    )).scalar_one_or_none()

    has_paid_access = access is not None
    community_joined = link is not None

    if not has_paid_access:
        current_step = "payment"
    elif not community_joined:
        current_step = "community"
    else:
        current_step = "complete"

    return OnboardingStatusResponse(
        registered=True, has_paid_access=has_paid_access,
        community_joined=community_joined, current_step=current_step,
    )
