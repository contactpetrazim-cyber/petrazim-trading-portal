"""
require_feature_access — "Admin or invitee" gate for one-off features.

Admin/Super Admin always pass (same as every other admin-tier check in
this codebase). Everyone else needs a FeatureAccessGrant row for this
exact feature_key, managed from the Admin Console (see admin.py's
feature-access endpoints and the frontend's FeatureAccessPanel).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.feature_access import FeatureAccessGrant
from app.models.user import User, UserRole


def require_feature_access(feature_key: str):
    async def checker(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return user
        grant = (await db.execute(
            select(FeatureAccessGrant).where(
                FeatureAccessGrant.user_id == user.id,
                FeatureAccessGrant.feature_key == feature_key,
            )
        )).scalar_one_or_none()
        if grant is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature ('{feature_key}') is admin/invite-only. Ask an admin to grant you access from the Admin Console.",
            )
        return user
    return checker
