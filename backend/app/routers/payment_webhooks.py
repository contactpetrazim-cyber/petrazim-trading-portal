"""
Payment Webhooks — closes a real gap
========================================

Until now, /payments/checkout created a PENDING Payment row and
nothing ever marked it succeeded or granted access — there was no
path from "paid" to "has access." This is that path: Stripe/Paystack
call these endpoints when a payment completes, we verify it's really
them (not just anyone POSTing a fake success), mark the Payment
SUCCEEDED, and create the UserAccess grant that actually unlocks
content.

For corporate purchases (seat_count > 1), this ALSO triggers seat-code
generation automatically — the org doesn't need a second manual step
after paying.

SIGNATURE VERIFICATION IS STUBBED, ON PURPOSE. Both Stripe and
Paystack sign their webhook payloads so you can prove a request really
came from them and wasn't forged — that verification needs your real
webhook secret (STRIPE_WEBHOOK_SECRET / PAYSTACK_WEBHOOK_SECRET), which
doesn't exist yet. Processing an unverified "payment succeeded" event
would mean anyone who found this URL could grant themselves free
access — this raises clearly instead of pretending to verify.
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.access import ACCESS_TIER_CATALOGUE, DURATION_PASS_CATALOGUE, Payment, PaymentStatus, UserAccess

router = APIRouter(prefix="/payments/webhook", tags=["payments"])


def _verify_stripe_signature(payload: bytes, signature_header: str) -> bool:
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise RuntimeError(
            "STRIPE_WEBHOOK_SECRET not set — cannot safely verify this webhook is "
            "really from Stripe. Set it from your Stripe dashboard before this "
            "endpoint processes anything."
        )
    raise NotImplementedError(
        "Wire to stripe.Webhook.construct_event() once STRIPE_WEBHOOK_SECRET is set."
    )


def _verify_paystack_signature(payload: bytes, signature_header: str) -> bool:
    secret = os.environ.get("PAYSTACK_WEBHOOK_SECRET", "")
    if not secret:
        raise RuntimeError("PAYSTACK_WEBHOOK_SECRET not set — cannot safely verify this webhook.")
    computed = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed, signature_header)


async def _grant_access_for_payment(payment: Payment) -> UserAccess:
    # Was hardcoded to 30 days for every tier purchase — wrong for
    # Essential (3 days) and Professional (7 days), only coincidentally
    # right for Executive. Now looks up the tier actually purchased;
    # 30 days remains the fallback only for the (should-be-impossible)
    # case of neither a duration pass nor a tier being set.
    duration_hours = 24 * 30
    if payment.duration_pass_type:
        duration_hours = DURATION_PASS_CATALOGUE[payment.duration_pass_type]["hours"]
    elif payment.tier_purchased and ACCESS_TIER_CATALOGUE[payment.tier_purchased]["duration_hours"] is not None:
        duration_hours = ACCESS_TIER_CATALOGUE[payment.tier_purchased]["duration_hours"]

    now = datetime.now(timezone.utc)
    return UserAccess(
        user_id=payment.user_id, tier=payment.tier_purchased,
        granted_via="payment", duration_pass_type=payment.duration_pass_type,
        starts_at=now, expires_at=now + timedelta(hours=duration_hours),
    )


@router.post("/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        _verify_stripe_signature(payload, signature)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))

    raise HTTPException(status_code=501, detail="Wire up alongside Stripe signature verification.")


@router.post("/paystack")
async def paystack_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    try:
        if not _verify_paystack_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid Paystack signature")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    import json
    event = json.loads(payload)

    if event.get("event") != "charge.success":
        return {"ok": True, "ignored": True}

    reference = event["data"]["reference"]

    async with AsyncSessionLocal() as db:
        payment = (await db.execute(
            select(Payment).where(Payment.provider_reference == reference)
        )).scalar_one_or_none()

        if payment is None:
            raise HTTPException(status_code=404, detail="No matching payment record for this reference")
        if payment.status == PaymentStatus.SUCCEEDED:
            return {"ok": True, "already_processed": True}

        payment.status = PaymentStatus.SUCCEEDED
        access = await _grant_access_for_payment(payment)
        db.add(access)
        await db.commit()

        seats_generated = None
        if payment.seat_count and payment.seat_count > 1:
            from app.services.corporate_codes import build_access_code_rows, generate_seat_codes

            batch = generate_seat_codes(
                issued_by_user_id=str(payment.user_id), tier=payment.tier_purchased,
                seat_count=payment.seat_count,
            )
            rows = build_access_code_rows(batch, payment.tier_purchased)
            db.add_all(rows)
            await db.commit()
            seats_generated = len(rows)

    return {"ok": True, "access_granted": True, "seats_generated": seats_generated}
