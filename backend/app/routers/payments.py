"""
Payments Router
==================

Three endpoints: browse pricing, start a checkout, redeem a code. The
redemption endpoint is deliberately ONE endpoint for all three code
types (promo / partner referral / corporate seat) — same simplification
that worked in the Academy build, so the frontend only needs one input
field and one submit button, not three different forms.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.access import (
    DURATION_PASS_CATALOGUE, AccessCode, AccessTier, CodeType,
    DurationPassType, Payment, PaymentProvider, PaymentStatus, UserAccess,
)
from app.models.user import User
from app.services.payments import get_payment_client, recommend_provider

router = APIRouter(prefix="/payments", tags=["payments"])


class DurationPassOption(BaseModel):
    type: str
    label: str
    hours: int
    ngn: int
    usd: int


@router.get("/pricing/duration-passes", response_model=List[DurationPassOption])
async def get_duration_passes():
    return [
        DurationPassOption(type=t.value, label=v["label"], hours=v["hours"], ngn=v["ngn"], usd=v["usd"])
        for t, v in DURATION_PASS_CATALOGUE.items()
    ]


class CheckoutRequest(BaseModel):
    currency: Literal["NGN", "USD"]
    duration_pass_type: Optional[DurationPassType] = None
    tier: Optional[AccessTier] = None
    seat_count: int = 1
    provider_override: Optional[Literal["stripe", "paystack"]] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    reference: str
    provider: str
    amount: float
    currency: str


@router.post("/checkout", response_model=CheckoutResponse)
async def start_checkout(
    req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if req.duration_pass_type is None and req.tier is None:
        raise HTTPException(status_code=400, detail="Specify either duration_pass_type or tier")

    if req.duration_pass_type is not None:
        catalogue_entry = DURATION_PASS_CATALOGUE[req.duration_pass_type]
        unit_price = catalogue_entry["ngn"] if req.currency == "NGN" else catalogue_entry["usd"]
        description = catalogue_entry["label"]
    else:
        raise HTTPException(
            status_code=501,
            detail="Full-tier subscription pricing (vs. duration passes) isn't in the "
                   "catalogue yet — add tier prices when those are finalized.",
        )

    amount = unit_price * req.seat_count
    provider = req.provider_override or recommend_provider(req.currency)

    try:
        client = get_payment_client(provider)
        session = client.create_checkout(
            amount=amount, currency=req.currency,
            description=f"{description} x{req.seat_count}", customer_email=user.email,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))

    payment = Payment(
        user_id=user.id, provider=PaymentProvider(provider), provider_reference=session.reference,
        status=PaymentStatus.PENDING, amount=amount, currency=req.currency,
        duration_pass_type=req.duration_pass_type, seat_count=req.seat_count,
    )
    db.add(payment)
    await db.commit()

    return CheckoutResponse(
        checkout_url=session.checkout_url, reference=session.reference,
        provider=provider, amount=amount, currency=req.currency,
    )


class RedeemCodeRequest(BaseModel):
    code: str


class RedeemCodeResponse(BaseModel):
    success: bool
    tier_granted: str
    expires_at: str
    message: str


@router.post("/redeem-code", response_model=RedeemCodeResponse)
async def redeem_code(
    req: RedeemCodeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    code_row = (await db.execute(
        select(AccessCode).where(AccessCode.code == req.code.strip().upper())
    )).scalar_one_or_none()

    if code_row is None:
        raise HTTPException(status_code=404, detail="Code not recognized")
    if code_row.expires_at and code_row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This code has expired")
    if code_row.redemption_count >= code_row.max_redemptions:
        raise HTTPException(status_code=409, detail="This code has already been used")

    now = datetime.now(timezone.utc)
    access = UserAccess(
        user_id=user.id, tier=code_row.tier_granted,
        granted_via=code_row.code_type.value,
        starts_at=now, expires_at=now + timedelta(hours=code_row.duration_hours),
    )
    db.add(access)
    code_row.redemption_count += 1
    await db.commit()

    label = {
        CodeType.PROMO: "Promo code redeemed",
        CodeType.PARTNER_REFERRAL: "Referral code redeemed — signup tagged for commission tracking",
        CodeType.CORPORATE_SEAT: "Corporate seat activated",
    }[code_row.code_type]

    return RedeemCodeResponse(
        success=True, tier_granted=code_row.tier_granted.value,
        expires_at=access.expires_at.isoformat(), message=label,
    )


class AccessStatusResponse(BaseModel):
    has_active_access: bool
    tier: Optional[str] = None
    expires_at: Optional[str] = None
    granted_via: Optional[str] = None


@router.get("/access-status", response_model=AccessStatusResponse)
async def access_status(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(UserAccess)
        .where(UserAccess.user_id == user.id, UserAccess.is_active == True,  # noqa: E712
               UserAccess.expires_at > now)
        .order_by(UserAccess.expires_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if row is None:
        return AccessStatusResponse(has_active_access=False)

    return AccessStatusResponse(
        has_active_access=True, tier=row.tier.value,
        expires_at=row.expires_at.isoformat(), granted_via=row.granted_via,
    )
