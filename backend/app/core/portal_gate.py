"""
Portal Access Dependency
===========================

Wraps portal_access.py's pure logic as a FastAPI dependency — the
actual server-side enforcement of "no upward migration," not just the
frontend's selection screen. Mount this on any router that's specific
to one portal (e.g. all /manager/* routes require the fund_manager
portal, all /admin/* routes require the admin portal).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException

from app.core.auth import get_current_user
from app.models.user import User
from app.services.portal_access import check_portal_access


def require_portal_access(portal: str):
    async def checker(user: User = Depends(get_current_user)) -> User:
        result = check_portal_access(user.role.value, portal)
        if not result.allowed:
            raise HTTPException(status_code=403, detail=result.reason)
        return user
    return checker
