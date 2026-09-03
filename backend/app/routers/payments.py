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

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user, require_super_admin
from app.database import get_db
from app.models.access import (
    ACCESS_TIER_CATALOGUE, DURATION_PASS_CATALOGUE, AccessCode, AccessTier, CodeType,
    DurationPassType, Payment, PaymentProvider, PaymentStatus, UserAccess,
)
from app.models.platform_setting import PAYMENTS_MODE_KEY, PlatformSetting
from app.models.user import User
from app.routers.payment_webhooks import _grant_access_for_payment
from app.services.payments import TestPaymentClient, get_payment_client, recommend_provider

router = APIRouter(prefix="/payments", tags=["payments"])


async def get_payments_mode(db: AsyncSession) -> Literal["test", "live"]:
    """Defaults to "test" when never explicitly set — same
    fail-safe-not-fail-open convention services/payments.py's provider
    clients already use (refuse rather than silently risk real money)."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PAYMENTS_MODE_KEY)
    )).scalar_one_or_none()
    return "live" if row and row.value == "live" else "test"


class PaymentsModeResponse(BaseModel):
    mode: Literal["test", "live"]


@router.get("/mode", response_model=PaymentsModeResponse)
async def get_mode(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Any authenticated user can read the current mode — the checkout
    page shows a "TEST MODE" banner off this so nobody mistakes a
    simulated payment for a real one."""
    return PaymentsModeResponse(mode=await get_payments_mode(db))


class SetPaymentsModeRequest(BaseModel):
    mode: Literal["test", "live"]


@router.patch("/mode", response_model=PaymentsModeResponse)
async def set_mode(
    req: SetPaymentsModeRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Super Admin only — flipping this to "live" is the single
    highest-stakes toggle in this app (every checkout from here on
    hits a real payment gateway with real cards). A runtime DB toggle
    rather than an env var on purpose: this needs to be flippable
    without a redeploy, and needs an audit trail (updated_at) more
    than it needs to survive being forgotten in a dashboard somewhere."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PAYMENTS_MODE_KEY)
    )).scalar_one_or_none()
    if row:
        row.value = req.mode
    else:
        db.add(PlatformSetting(key=PAYMENTS_MODE_KEY, value=req.mode))
    await db.commit()
    return PaymentsModeResponse(mode=req.mode)


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


class TierOption(BaseModel):
    tier: str
    label: str
    duration_hours: Optional[int]
    individual_ngn: int
    individual_usd: Optional[int]
    corporate_ngn_per_seat: Optional[int]
    corporate_flat_fee_ngn: Optional[int]
    corporate_min_seats: Optional[int]
    features: List[str]


@router.get("/pricing/tiers", response_model=List[TierOption])
async def get_tiers():
    return [
        TierOption(tier=t.value, label=v["label"], duration_hours=v["duration_hours"],
                   individual_ngn=v["individual_ngn"], individual_usd=v["individual_usd"],
                   corporate_ngn_per_seat=v["corporate_ngn_per_seat"],
                   corporate_flat_fee_ngn=v["corporate_flat_fee_ngn"],
                   corporate_min_seats=v["corporate_min_seats"], features=v["features"])
        for t, v in ACCESS_TIER_CATALOGUE.items()
    ]


class CheckoutRequest(BaseModel):
    currency: Literal["NGN", "USD"]
    duration_pass_type: Optional[DurationPassType] = None
    tier: Optional[AccessTier] = None
    is_corporate: bool = False
    seat_count: int = 1
    provider_override: Optional[Literal["stripe", "paystack", "ivorypay"]] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    reference: str
    provider: str
    amount: float
    currency: str


@router.post("/checkout", response_model=CheckoutResponse)
async def start_checkout(
    req: CheckoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if req.duration_pass_type is None and req.tier is None:
        raise HTTPException(status_code=400, detail="Specify either duration_pass_type or tier")
    if req.seat_count < 1:
        raise HTTPException(status_code=400, detail="seat_count must be at least 1")

    if req.duration_pass_type is not None:
        catalogue_entry = DURATION_PASS_CATALOGUE[req.duration_pass_type]
        unit_price = catalogue_entry["ngn"] if req.currency == "NGN" else catalogue_entry["usd"]
        amount = unit_price * req.seat_count
        description = catalogue_entry["label"]
    else:
        tier_entry = ACCESS_TIER_CATALOGUE[req.tier]
        if req.currency != "NGN":
            # Every tier's real pricing (from the live training portal
            # this was copied from) is NGN-only, Community's $2 excepted
            # — no invented USD figure for Essential/Professional/
            # Executive, see models/access.py's own comment on why.
            if req.tier != AccessTier.COMMUNITY or tier_entry["individual_usd"] is None:
                raise HTTPException(status_code=400, detail=f"{tier_entry['label']} is only available in NGN")
            amount = tier_entry["individual_usd"] * req.seat_count
        elif req.is_corporate:
            if tier_entry["corporate_min_seats"] is None:
                raise HTTPException(status_code=400, detail=f"{tier_entry['label']} has no corporate rate")
            if req.seat_count < tier_entry["corporate_min_seats"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Corporate {tier_entry['label']} requires at least "
                           f"{tier_entry['corporate_min_seats']} seats — use the individual rate below that.",
                )
            amount = tier_entry["corporate_ngn_per_seat"] * req.seat_count + tier_entry["corporate_flat_fee_ngn"]
        else:
            amount = tier_entry["individual_ngn"] * req.seat_count
        description = f"{tier_entry['label']}{' (Corporate)' if req.is_corporate else ''}"

    provider = req.provider_override or recommend_provider(req.currency)
    is_test = (await get_payments_mode(db)) == "test"

    try:
        # Test mode ignores the requested provider entirely and never
        # calls a real gateway — see TestPaymentClient's own docstring.
        # `payment.provider` below still records what would have been
        # used, for a record's own honesty about routing; is_test is
        # what actually marks it simulated.
        client = TestPaymentClient(base_url=str(request.base_url)) if is_test else get_payment_client(provider)
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
        duration_pass_type=req.duration_pass_type,
        # tier_purchased was never set here before — dead code as long as
        # the tier branch above 501'd, but payment_webhooks.py's
        # _grant_access_for_payment reads payment.tier_purchased to grant
        # the right access tier, so a real tier checkout needs this set
        # (falls back to the duration pass's own catalogued tier when
        # this was a duration-pass purchase instead).
        tier_purchased=req.tier or (DURATION_PASS_CATALOGUE[req.duration_pass_type]["tier"] if req.duration_pass_type else None),
        seat_count=req.seat_count,
        is_test=is_test,
    )
    db.add(payment)
    await db.commit()

    return CheckoutResponse(
        checkout_url=session.checkout_url, reference=session.reference,
        provider="test" if is_test else provider, amount=amount, currency=req.currency,
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


def _test_checkout_page(reference: str, payment: Payment, result: Optional[str] = None) -> str:
    """A self-contained HTML page standing in for a real gateway's
    hosted checkout — no JS needed, plain <form> POSTs, so this works
    identically to how the real thing would (a full-page redirect
    away from and back to the app). Deliberately unstyled beyond the
    basics: this is a test tool, not a page a real customer ever sees."""
    if result:
        heading = "Payment succeeded" if result == "success" else "Payment failed"
        color = "#059669" if result == "success" else "#dc2626"
        body = f"""
        <h1 style="color:{color}">{heading}</h1>
        <p>{"Access has been granted." if result == "success" else "No access was granted — use this to confirm the paywall correctly blocks the account now."}</p>
        <a href="{get_settings().FRONTEND_URL}/payments" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#005FB8;color:#fff;text-decoration:none;border-radius:8px;">Return to app</a>
        """
    else:
        body = f"""
        <p style="color:#666">Reference: <code>{reference}</code></p>
        <p style="font-size:24px;font-weight:bold;">{payment.amount:,.2f} {payment.currency}</p>
        <form method="POST" action="/payments/test-checkout/{reference}/complete" style="margin-top:20px;">
            <input type="hidden" name="succeeded" value="true">
            <button type="submit" style="padding:12px 24px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-right:12px;">
                Simulate Successful Payment
            </button>
        </form>
        <form method="POST" action="/payments/test-checkout/{reference}/complete">
            <input type="hidden" name="succeeded" value="false">
            <button type="submit" style="padding:12px 24px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
                Simulate Failed Payment
            </button>
        </form>
        """
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Test Checkout — Petrazim</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;">
<div style="background:#fef3c7;color:#92400e;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;display:inline-block;margin-bottom:20px;">TEST MODE — no real payment gateway is involved</div>
<h2 style="margin-top:0;">Petrazim — Simulated Checkout</h2>
{body}
</body></html>"""


@router.get("/test-checkout/{reference}", response_class=HTMLResponse)
async def test_checkout_page(reference: str, db: AsyncSession = Depends(get_db)):
    """The page TestPaymentClient.create_checkout() sends the user to
    instead of a real Stripe/Paystack hosted page. No auth — a real
    gateway's checkout page isn't gated behind this app's session
    either, it's reached via the opaque checkout_url alone."""
    payment = (await db.execute(
        select(Payment).where(Payment.provider_reference == reference, Payment.is_test == True)  # noqa: E712
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="No matching test payment for this reference")
    if payment.status != PaymentStatus.PENDING:
        return HTMLResponse(_test_checkout_page(reference, payment, result="success" if payment.status == PaymentStatus.SUCCEEDED else "failed"))
    return HTMLResponse(_test_checkout_page(reference, payment))


@router.post("/test-checkout/{reference}/complete", response_class=HTMLResponse)
async def complete_test_checkout(
    reference: str, succeeded: str = Form(...), db: AsyncSession = Depends(get_db)
):
    """Simulates the gateway's own webhook call, inline, since a fake
    provider has no real webhook to fire — success grants access via
    the exact same _grant_access_for_payment the real Paystack webhook
    uses (including corporate seat generation), failure marks the
    Payment FAILED and grants nothing, so GET /payments/access-status
    correctly keeps reporting no active access afterward."""
    payment = (await db.execute(
        select(Payment).where(Payment.provider_reference == reference, Payment.is_test == True)  # noqa: E712
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="No matching test payment for this reference")

    if payment.status == PaymentStatus.PENDING:
        if succeeded == "true":
            payment.status = PaymentStatus.SUCCEEDED
            access = await _grant_access_for_payment(payment)
            db.add(access)
            await db.commit()

            if payment.seat_count and payment.seat_count > 1:
                from app.services.corporate_codes import build_access_code_rows, generate_seat_codes

                batch = generate_seat_codes(
                    issued_by_user_id=str(payment.user_id), tier=payment.tier_purchased,
                    seat_count=payment.seat_count,
                )
                rows = build_access_code_rows(batch, payment.tier_purchased)
                db.add_all(rows)
                await db.commit()
        else:
            payment.status = PaymentStatus.FAILED
            await db.commit()

    result = "success" if payment.status == PaymentStatus.SUCCEEDED else "failed"
    return HTMLResponse(_test_checkout_page(reference, payment, result=result))
