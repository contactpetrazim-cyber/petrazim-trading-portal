"""
Auth Router — unified login for all four roles
==================================================

One login endpoint. The response includes the role and the frontend's
landing route for it — the frontend redirects based on that, but every
protected endpoint still checks the role itself server-side.

Registration here creates a PENDING account by default (Phase 2 payment
flow activates it, or an Admin/Super Admin activates manually) — nobody
gets an ACTIVE trading/console account just by signing up, since access
tiers and payment are part of this same v3 spec.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models.user import ROLE_BADGE_COLOR, ROLE_LANDING_ROUTE, User, UserRole, UserStatus

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    phone: str | None = None
    full_name: str = Field(min_length=1)
    password: str = Field(min_length=8)
    role: UserRole = UserRole.TRADER   # self-registration never allows admin/super_admin


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    status: str
    badge_color: str
    landing_route: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


def _to_profile(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id), email=user.email, full_name=user.full_name,
        role=user.role.value, status=user.status.value,
        badge_color=ROLE_BADGE_COLOR[user.role],
        landing_route=ROLE_LANDING_ROUTE[user.role],
    )


@router.post("/register", response_model=UserProfileResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if req.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=400,
            detail="Admin and Super Admin accounts cannot be self-registered — "
                   "they're created from the Admin console.",
        )

    existing = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=req.email, phone=req.phone, full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role=req.role, status=UserStatus.PENDING,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _to_profile(user)


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if user is None or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account suspended — contact an administrator")

    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(user)
    return LoginResponse(access_token=token, user=_to_profile(user))


@router.get("/me", response_model=UserProfileResponse)
async def me(user: User = Depends(get_current_user)):
    return _to_profile(user)
