"""
Admin Router — Super Admin user management
=============================================

Add/remove Admins, Fund Managers, Traders, and Partners. Every
destructive or privilege-granting action here requires
require_super_admin (role + seed flag), not just require_role(ADMIN) —
regular Admins get a read-only view of the user list in this v3 slice;
granting them mutation power is a deliberate later decision, not a
default, given how sensitive account creation/removal is on a platform
that also handles payments and fund access (Phase 2).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role, require_super_admin
from app.database import get_db
from app.models.user import ROLE_BADGE_COLOR, User, UserRole, UserStatus

router = APIRouter(prefix="/admin", tags=["admin"])


class UserListItem(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    status: str
    badge_color: str


class CreateUserRequest(BaseModel):
    email: str
    full_name: str
    role: UserRole
    temporary_password: str


class RoleChangeRequest(BaseModel):
    new_role: UserRole


@router.get("/users", response_model=list[UserListItem])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Admins and Super Admin can both view the full user list."""
    rows = (await db.execute(select(User))).scalars().all()
    return [
        UserListItem(id=str(u.id), email=u.email, full_name=u.full_name,
                     role=u.role.value, status=u.status.value,
                     badge_color=ROLE_BADGE_COLOR[u.role])
        for u in rows
    ]


@router.post("/users", response_model=UserListItem)
async def create_user(
    req: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_super_admin),
):
    """Super Admin only — creates Admin/Manager/Trader/Partner accounts directly,
    bypassing the pending/payment flow (for staff and pre-approved accounts)."""
    from app.core.auth import hash_password

    existing = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=req.email, full_name=req.full_name, role=req.role,
        hashed_password=hash_password(req.temporary_password),
        status=UserStatus.ACTIVE, is_super_admin_seed=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserListItem(id=str(user.id), email=user.email, full_name=user.full_name,
                         role=user.role.value, status=user.status.value,
                         badge_color=ROLE_BADGE_COLOR[user.role])


@router.patch("/users/{user_id}/role", response_model=UserListItem)
async def change_role(
    user_id: str,
    req: RoleChangeRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_super_admin_seed:
        raise HTTPException(status_code=400, detail="Cannot change the seeded Super Admin's role")

    target.role = req.new_role
    await db.commit()
    await db.refresh(target)
    return UserListItem(id=str(target.id), email=target.email, full_name=target.full_name,
                         role=target.role.value, status=target.status.value,
                         badge_color=ROLE_BADGE_COLOR[target.role])


@router.delete("/users/{user_id}")
async def remove_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_super_admin_seed:
        raise HTTPException(status_code=400, detail="Cannot remove the seeded Super Admin account")
    if str(target.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot remove your own account")

    await db.delete(target)
    await db.commit()
    return {"status": "removed", "user_id": user_id}
