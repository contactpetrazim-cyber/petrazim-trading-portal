"""
Roster Router
================

Manager+ (Fund Manager, Partner, Admin, Super Admin) can invite new
Traders and manage their own roster. Every action re-checks role
server-side against the caller's own authenticated identity — never
trusts a role claim from the request body, only from the verified JWT.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, require_role
from app.database import get_db
from app.models.roster import RosterAssignment
from app.models.user import User, UserRole, UserStatus

router = APIRouter(prefix="/roster", tags=["roster"])

MANAGER_ROLES = (UserRole.FUND_MANAGER, UserRole.PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)


class InviteTraineeRequest(BaseModel):
    email: str
    full_name: str


class InviteTraineeResponse(BaseModel):
    user_id: str
    email: str
    temporary_password: str


@router.post("/invite", response_model=InviteTraineeResponse)
async def invite_trainee(
    req: InviteTraineeRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    existing = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    import secrets
    temp_password = secrets.token_urlsafe(9)

    trader = User(
        email=req.email, full_name=req.full_name, role=UserRole.TRADER,
        hashed_password=hash_password(temp_password), status=UserStatus.PENDING,
        created_by=manager.id,
    )
    db.add(trader)
    await db.flush()

    assignment = RosterAssignment(
        trader_user_id=trader.id, assigned_to_user_id=manager.id, assigned_by_user_id=manager.id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(trader)

    return InviteTraineeResponse(user_id=str(trader.id), email=trader.email, temporary_password=temp_password)


class AssignTraderRequest(BaseModel):
    trader_user_id: str


@router.post("/assign")
async def assign_trader(
    req: AssignTraderRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    trader = (await db.execute(
        select(User).where(User.id == req.trader_user_id, User.role == UserRole.TRADER)
    )).scalar_one_or_none()
    if trader is None:
        raise HTTPException(status_code=404, detail="Trader not found")

    existing = (await db.execute(
        select(RosterAssignment).where(RosterAssignment.trader_user_id == trader.id)
    )).scalar_one_or_none()

    if existing:
        existing.assigned_to_user_id = manager.id
        existing.assigned_by_user_id = manager.id
    else:
        db.add(RosterAssignment(
            trader_user_id=trader.id, assigned_to_user_id=manager.id, assigned_by_user_id=manager.id,
        ))

    await db.commit()
    return {"ok": True}


@router.delete("/assign/{trader_user_id}")
async def detach_trader(
    trader_user_id: str, db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    row = (await db.execute(
        select(RosterAssignment).where(RosterAssignment.trader_user_id == trader_user_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No assignment found")
    if row.assigned_to_user_id != manager.id and manager.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="You can only detach traders on your own roster")

    await db.delete(row)
    await db.commit()
    return {"ok": True}


class RosterEntry(BaseModel):
    trader_user_id: str
    full_name: str
    email: str
    status: str
    assigned_at: str


@router.get("", response_model=List[RosterEntry])
async def get_roster(
    db: AsyncSession = Depends(get_db), manager: User = Depends(require_role(*MANAGER_ROLES))
):
    """Admin/Super Admin see the FULL roster across all managers; a
    Fund Manager/Partner sees only their own assigned traders — same
    scoping principle used everywhere else access is role-gated."""
    query = (
        select(RosterAssignment, User)
        .join(User, User.id == RosterAssignment.trader_user_id)
    )
    if manager.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        query = query.where(RosterAssignment.assigned_to_user_id == manager.id)

    rows = (await db.execute(query)).all()
    return [
        RosterEntry(
            trader_user_id=str(trader.id), full_name=trader.full_name, email=trader.email,
            status=trader.status.value, assigned_at=assignment.assigned_at.isoformat(),
        )
        for assignment, trader in rows
    ]
