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

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role, require_super_admin
from app.database import get_db
from app.models.access import AccessCode, CodeType, UserAccess
from app.models.broadcast_log import BroadcastLog
from app.models.facilitator import BookingStatus, MeetingBooking
from app.models.user import ROLE_BADGE_COLOR, User, UserRole, UserStatus
from app.models.roster import RosterAssignment

router = APIRouter(prefix="/admin", tags=["admin"])
STAFF_ROLES = (UserRole.FUND_MANAGER, UserRole.PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)


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


class RoleChangeByEmailRequest(BaseModel):
    email: str
    new_role: UserRole


@router.patch("/users/by-email/role", response_model=UserListItem)
async def change_role_by_email(
    req: RoleChangeByEmailRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """The Admin console's "Role Administration" panel (Member email +
    New level + Apply), adapted from the reference training portal's
    own promote/demote-by-email flow — same rule as change_role above
    (id-keyed, used internally by any future admin UI that already has
    a user row to act on), just addressed by email since that's the
    only identifier a Super Admin has on hand for someone not already
    on screen.

    "Strictly downward" isn't a separate check here: this app's own
    portal-hierarchy-superset design already guarantees it structurally
    — each console is built as a strict superset of the one below it,
    so promoting someone to any role hands them that role's own
    workspace plus everything beneath it, never anything above.
    """
    # Exact match, no case-folding — mirrors every other email lookup in
    # this codebase (auth.py's login/register), none of which normalize
    # case either, so introducing it only here would risk a mismatch
    # against however the account's email was originally stored.
    target = (await db.execute(select(User).where(User.email == req.email.strip()))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="No account found with that email")
    if target.is_super_admin_seed:
        raise HTTPException(status_code=400, detail="Cannot change the seeded Super Admin's role")

    target.role = req.new_role
    await db.commit()
    await db.refresh(target)
    return UserListItem(id=str(target.id), email=target.email, full_name=target.full_name,
                         role=target.role.value, status=target.status.value,
                         badge_color=ROLE_BADGE_COLOR[target.role])


class PlatformOverviewResponse(BaseModel):
    organisations: int
    staff_accounts: int
    daily_sends: int
    live_bookings: int


@router.get("/platform-overview", response_model=PlatformOverviewResponse)
async def platform_overview(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """The Admin console's own extra tier of counters, on top of
    everything roster.py's /roster/learning-dashboard already gives a
    Fund Manager/Partner — adapted from the reference training
    portal's Platform Overview panel (Organisations/Staff
    accounts/Daily sends/Live bookings), re-derived from what this
    codebase actually tracks rather than copied as-is:

    - `organisations`: this app has no separate Organization entity —
      the real, honest proxy is the count of DISTINCT accounts that
      have ever issued a corporate seat batch (AccessCode.code_type ==
      CORPORATE_SEAT), since each one represents a sponsoring org.
    - `staff_accounts`: Fund Manager/Partner/Admin/Super Admin users —
      "Trainer and above" in the reference's own wording.
    - `daily_sends`: real BroadcastLog rows from today (UTC) — see that
      model's own docstring on why this needed a new table rather than
      being guessed.
    - `live_bookings`: CONFIRMED facilitator sessions still ahead of
      today — "facilitator seats held."
    """
    organisations = (await db.execute(
        select(func.count(func.distinct(AccessCode.issued_by_user_id)))
        .where(AccessCode.code_type == CodeType.CORPORATE_SEAT)
    )).scalar_one()

    staff_accounts = (await db.execute(
        select(func.count()).select_from(User).where(User.role.in_(STAFF_ROLES))
    )).scalar_one()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_sends = (await db.execute(
        select(func.count()).select_from(BroadcastLog).where(BroadcastLog.sent_at >= today_start)
    )).scalar_one()

    today = today_start.date()
    live_bookings = (await db.execute(
        select(func.count()).select_from(MeetingBooking)
        .where(MeetingBooking.status == BookingStatus.CONFIRMED, MeetingBooking.day >= today)
    )).scalar_one()

    return PlatformOverviewResponse(
        organisations=organisations or 0, staff_accounts=staff_accounts or 0,
        daily_sends=daily_sends or 0, live_bookings=live_bookings or 0,
    )


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
