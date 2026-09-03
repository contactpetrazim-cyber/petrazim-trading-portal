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

import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

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


class GoogleLoginRequest(BaseModel):
    credential: str  # the signed ID token JWT from Google Identity Services' button


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


@router.get("/google/client-id")
async def google_client_id():
    """The frontend calls this to decide whether to render the
    "Continue with Google" button at all, and what Client ID to
    initialize Google Identity Services with — the Client ID is public
    by design (it's embedded in every Google sign-in page's HTML), so
    there's nothing sensitive being handed back here."""
    from app.config import get_settings
    client_id = get_settings().GOOGLE_CLIENT_ID
    return {"client_id": client_id or None}


@router.post("/google", response_model=LoginResponse)
async def google_login(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """"Continue with Google" — verifies the ID token Google Identity
    Services' button already signed (client-side, no page redirect,
    no client secret needed) against Google's own public keys and this
    app's Client ID, then finds-or-creates a User by the token's
    verified email and issues our normal JWT — same response shape as
    POST /auth/login, so the frontend's post-login flow (including the
    portal-selection step) doesn't need a separate code path.

    A first-time Google sign-in creates a PENDING account, identical to
    POST /auth/register — Google verifying someone's email is not the
    same thing as this platform granting trading/console access, and
    the same payment/activation gate applies either way.
    """
    from app.config import get_settings
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    settings = get_settings()
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on this server")

    try:
        idinfo = await run_in_threadpool(
            google_id_token.verify_oauth2_token,
            req.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")
    email = idinfo["email"]

    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            full_name=idinfo.get("name") or email.split("@")[0],
            # Google-only accounts have no password of their own — a
            # random, never-shown, never-usable hash fills the (non-
            # nullable) column rather than leaving it a guessable
            # constant. They can still set a real password later via a
            # password-reset flow, same as any account.
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role=UserRole.TRADER, status=UserStatus.PENDING,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

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
