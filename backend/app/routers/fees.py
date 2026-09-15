"""
Performance Fees — the Fee/Free toggle, fee percentage, and payout
destination (crypto address and/or Paystack bank details) an Admin
configures, plus the resulting fee ledger — by direct request
("introduce a fee base or a share of the profit - on a success
basis... Create a fee vs free toggle... include in Admin portal...
include the form for Admin to enter Account to receive the benefit...
Crypto address and/or bank account - Paystack?").

See models/fee_settings.py's own docstring for the honest scope: this
computes and records what's owed, it does not move money — an admin
marks a ledger entry PAID once a real transfer (crypto or otherwise)
has actually been confirmed outside this app.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.database import get_db
from app.models.fee_payment import FeePayment, FeePaymentStatus
from app.models.fee_settings import FeeLedgerStatus, PayoutMethod, PerformanceFeeLedgerEntry, PlatformFeeSettings
from app.models.user import User, UserRole
from app.services.payments import TestPaymentClient, get_payment_client
from app.services.performance_fees import (
    get_fee_settings, owed_from_previous_days, settle_fee_payment,
    start_fee_checkout_snapshot, total_owed,
)

router = APIRouter(prefix="/fees", tags=["performance-fees"])
admin_router = APIRouter(prefix="/admin/fees", tags=["performance-fees-admin"])

ADMIN_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


async def _get_payments_mode(db: AsyncSession) -> Literal["test", "live"]:
    """Reuses the exact same runtime test/live toggle the Academy
    checkout uses (routers/payments.py's own GET/PATCH /payments/mode)
    — one switch controls whether ANY checkout in this app (Academy
    tier or fee settlement) hits a real gateway, rather than two
    separate toggles an Admin could forget to flip together."""
    from app.routers.payments import get_payments_mode
    return await get_payments_mode(db)


# =============================================================================
# Admin: the Fee/Free toggle, percentage, and payout destination
# =============================================================================

class FeeSettingsResponse(BaseModel):
    enabled: bool
    fee_percent: float
    payout_method: str
    crypto_address: Optional[str]
    crypto_network: Optional[str]
    paystack_account_name: Optional[str]
    paystack_account_number: Optional[str]
    paystack_bank_name: Optional[str]
    paystack_bank_code: Optional[str]
    notes: Optional[str]
    settlement_currency: str
    updated_at: datetime


def _settings_response(s: PlatformFeeSettings) -> FeeSettingsResponse:
    return FeeSettingsResponse(
        enabled=s.enabled, fee_percent=s.fee_percent, payout_method=s.payout_method.value,
        crypto_address=s.crypto_address, crypto_network=s.crypto_network,
        paystack_account_name=s.paystack_account_name, paystack_account_number=s.paystack_account_number,
        paystack_bank_name=s.paystack_bank_name, paystack_bank_code=s.paystack_bank_code,
        notes=s.notes, settlement_currency=s.settlement_currency, updated_at=s.updated_at,
    )


@admin_router.get("/settings", response_model=FeeSettingsResponse)
async def admin_get_fee_settings(db: AsyncSession = Depends(get_db), _admin: User = Depends(require_role(*ADMIN_ROLES))):
    return _settings_response(await get_fee_settings(db))


class UpdateFeeSettingsRequest(BaseModel):
    enabled: Optional[bool] = None
    fee_percent: Optional[float] = None
    payout_method: Optional[Literal["crypto", "paystack", "both"]] = None
    crypto_address: Optional[str] = None
    crypto_network: Optional[str] = None
    paystack_account_name: Optional[str] = None
    paystack_account_number: Optional[str] = None
    paystack_bank_name: Optional[str] = None
    paystack_bank_code: Optional[str] = None
    notes: Optional[str] = None
    settlement_currency: Optional[str] = None


@admin_router.patch("/settings", response_model=FeeSettingsResponse)
async def admin_update_fee_settings(
    req: UpdateFeeSettingsRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    """Only fields actually sent are changed — e.g. flipping the
    enabled toggle doesn't require re-sending the payout destination
    every time. fee_percent is clamped to [0, 100] — a typo'd 200%
    fee should fail loudly, not silently charge more than a trade's
    entire profit."""
    s = await get_fee_settings(db)
    if req.enabled is not None:
        s.enabled = req.enabled
    if req.fee_percent is not None:
        if not (0 <= req.fee_percent <= 100):
            raise HTTPException(status_code=422, detail="fee_percent must be between 0 and 100.")
        s.fee_percent = req.fee_percent
    if req.payout_method is not None:
        s.payout_method = PayoutMethod(req.payout_method)
    if req.crypto_address is not None:
        s.crypto_address = req.crypto_address
    if req.crypto_network is not None:
        s.crypto_network = req.crypto_network
    if req.paystack_account_name is not None:
        s.paystack_account_name = req.paystack_account_name
    if req.paystack_account_number is not None:
        s.paystack_account_number = req.paystack_account_number
    if req.paystack_bank_name is not None:
        s.paystack_bank_name = req.paystack_bank_name
    if req.paystack_bank_code is not None:
        s.paystack_bank_code = req.paystack_bank_code
    if req.notes is not None:
        s.notes = req.notes
    if req.settlement_currency is not None:
        s.settlement_currency = req.settlement_currency.upper()
    s.updated_by = admin.id
    s.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(s)
    return _settings_response(s)


# =============================================================================
# Admin: the fee ledger — who owes what, and marking entries settled
# =============================================================================

class LedgerEntryResponse(BaseModel):
    id: str
    user_id: str
    trader_email: Optional[str] = None
    trader_name: Optional[str] = None
    trade_id: str
    pnl_amount: float
    fee_percent_applied: float
    fee_amount: float
    status: str
    paid_at: Optional[datetime]
    paid_note: Optional[str]
    created_at: datetime


def _entry_response(e: PerformanceFeeLedgerEntry, trader: Optional[User] = None) -> LedgerEntryResponse:
    return LedgerEntryResponse(
        id=str(e.id), user_id=str(e.user_id), trader_email=trader.email if trader else None,
        trader_name=trader.full_name if trader else None, trade_id=e.trade_id, pnl_amount=e.pnl_amount,
        fee_percent_applied=e.fee_percent_applied, fee_amount=e.fee_amount, status=e.status.value,
        paid_at=e.paid_at, paid_note=e.paid_note, created_at=e.created_at,
    )


@admin_router.get("/ledger", response_model=List[LedgerEntryResponse])
async def admin_list_ledger(
    status: Optional[Literal["owed", "paid", "waived"]] = None,
    db: AsyncSession = Depends(get_db), _admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    query = select(PerformanceFeeLedgerEntry)
    if status is not None:
        query = query.where(PerformanceFeeLedgerEntry.status == FeeLedgerStatus(status))
    query = query.order_by(PerformanceFeeLedgerEntry.created_at.desc())
    rows = (await db.execute(query)).scalars().all()
    if not rows:
        return []
    user_ids = {r.user_id for r in rows}
    users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    users_by_id = {u.id: u for u in users}
    return [_entry_response(r, users_by_id.get(r.user_id)) for r in rows]


class MarkLedgerRequest(BaseModel):
    note: Optional[str] = None


@admin_router.patch("/ledger/{entry_id}/mark-paid", response_model=LedgerEntryResponse)
async def admin_mark_paid(
    entry_id: str, req: MarkLedgerRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    """Records that a fee owed was actually settled — a real crypto
    transfer the trader sent, or a Paystack/bank transfer the admin
    confirmed — OUTSIDE this app. This app never verifies the transfer
    itself; `note` is the admin's own record of how it was confirmed
    (e.g. a tx hash or a bank reference)."""
    row = (await db.execute(select(PerformanceFeeLedgerEntry).where(PerformanceFeeLedgerEntry.id == entry_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    row.status = FeeLedgerStatus.PAID
    row.paid_at = datetime.utcnow()
    row.paid_note = req.note
    row.marked_by = admin.id
    await db.commit()
    await db.refresh(row)
    return _entry_response(row)


@admin_router.patch("/ledger/{entry_id}/waive", response_model=LedgerEntryResponse)
async def admin_waive(
    entry_id: str, req: MarkLedgerRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    """Forgives a fee without payment — e.g. a goodwill exception."""
    row = (await db.execute(select(PerformanceFeeLedgerEntry).where(PerformanceFeeLedgerEntry.id == entry_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    row.status = FeeLedgerStatus.WAIVED
    row.paid_note = req.note
    row.marked_by = admin.id
    await db.commit()
    await db.refresh(row)
    return _entry_response(row)


# =============================================================================
# Trader-facing: what THEY owe, and where to pay it
# =============================================================================

class MyFeesResponse(BaseModel):
    enabled: bool
    fee_percent: float
    payout_method: str
    crypto_address: Optional[str]
    crypto_network: Optional[str]
    paystack_account_name: Optional[str]
    paystack_account_number: Optional[str]
    paystack_bank_name: Optional[str]
    settlement_currency: str
    total_owed: float
    entries: List[LedgerEntryResponse]


@router.get("/my-ledger", response_model=MyFeesResponse)
async def my_fee_ledger(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """What THIS trader owes and where to pay it — the payout fields
    are shown here even when there's nothing owed yet, so a trader
    considering Auto copy mode can see the terms up front."""
    settings_row = await get_fee_settings(db)
    rows = (await db.execute(
        select(PerformanceFeeLedgerEntry).where(PerformanceFeeLedgerEntry.user_id == user.id).order_by(PerformanceFeeLedgerEntry.created_at.desc())
    )).scalars().all()
    total_owed_amount = round(sum(e.fee_amount for e in rows if e.status == FeeLedgerStatus.OWED), 2)
    return MyFeesResponse(
        enabled=settings_row.enabled, fee_percent=settings_row.fee_percent, payout_method=settings_row.payout_method.value,
        crypto_address=settings_row.crypto_address, crypto_network=settings_row.crypto_network,
        paystack_account_name=settings_row.paystack_account_name, paystack_account_number=settings_row.paystack_account_number,
        paystack_bank_name=settings_row.paystack_bank_name, settlement_currency=settings_row.settlement_currency,
        total_owed=total_owed_amount, entries=[_entry_response(e) for e in rows],
    )


# =============================================================================
# Trader-facing: the Paystack payment gate itself — "checks payment and
# grants access to bot trading or manual trading or automated trades"
# =============================================================================

class GateStatusResponse(BaseModel):
    gated: bool
    owed_from_previous_days: float
    total_owed: float
    currency: str


@router.get("/gate-status", response_model=GateStatusResponse)
async def gate_status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Same number core/fee_gate.py's dependency blocks on — exposed
    here so the frontend can show/hide the paywall banner proactively,
    without waiting to get bounced off a real order attempt first."""
    settings_row = await get_fee_settings(db)
    previous_days = await owed_from_previous_days(db, user.id)
    everything = await total_owed(db, user.id)
    return GateStatusResponse(
        gated=previous_days > 0, owed_from_previous_days=previous_days,
        total_owed=everything, currency=settings_row.settlement_currency,
    )


class FeeCheckoutResponse(BaseModel):
    checkout_url: str
    reference: str
    provider: str
    amount: float
    currency: str


class FeeCheckoutRequest(BaseModel):
    # IvoryPay added alongside Paystack as a second, crypto-native way
    # to settle — by direct request ("ADD Ivorypay as the option for
    # crypto payments... integrate for both bot and manual trade
    # fees"). "Both" here needs no special handling: this one checkout
    # endpoint already serves every OWED entry regardless of whether it
    # came from a bot-copied trade or a manual one (apply_performance_fee
    # writes the same PerformanceFeeLedgerEntry shape either way), so a
    # trader picking IvoryPay settles their whole balance in one go
    # exactly like Paystack does.
    provider: Literal["paystack", "ivorypay"] = "paystack"


@router.post("/checkout", response_model=FeeCheckoutResponse)
async def start_fee_checkout(
    req: FeeCheckoutRequest, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Starts a real checkout (Paystack or IvoryPay — the trader's
    choice — or the Test-mode simulated one, see GET/PATCH
    /payments/mode) for EVERY currently-OWED fee, not just the
    previous-day amount the gate itself blocks on — paying clears the
    whole balance in one go rather than leaving today's already-accrued
    fee to trigger the gate again tomorrow."""
    settings_row = await get_fee_settings(db)
    amount, covered_ids = await start_fee_checkout_snapshot(db, user.id)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Nothing owed — there is no fee balance to pay.")

    is_test = (await _get_payments_mode(db)) == "test"
    try:
        client = (
            TestPaymentClient(base_url=str(request.base_url), path_prefix="/fees/test-checkout")
            if is_test else get_payment_client(req.provider)
        )
        session = client.create_checkout(
            amount=amount, currency=settings_row.settlement_currency,
            description="Petrazim performance fee settlement", customer_email=user.email,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    provider_label = "test" if is_test else req.provider
    payment = FeePayment(
        user_id=user.id, provider=provider_label, provider_reference=session.reference,
        status=FeePaymentStatus.PENDING, amount=amount, currency=settings_row.settlement_currency,
        covered_entry_ids=json.dumps(covered_ids), is_test=is_test,
    )
    db.add(payment)
    await db.commit()

    return FeeCheckoutResponse(
        checkout_url=session.checkout_url, reference=session.reference,
        provider=provider_label, amount=amount, currency=settings_row.settlement_currency,
    )


class FeeVerifyResponse(BaseModel):
    reference: str
    provider: str
    status: str
    amount: float
    currency: str


@router.post("/checkout/{reference}/verify", response_model=FeeVerifyResponse)
async def verify_fee_checkout(
    reference: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Manually re-checks a still-PENDING checkout against the real
    gateway and settles it if it's actually succeeded — the honest
    complement to the Paystack webhook (routers/payment_webhooks.py),
    and the ONLY confirmation path IvoryPay actually has here: unlike
    Paystack, this codebase has no documented IvoryPay webhook
    signature scheme to verify against (see services/payments.py's own
    IvoryPayClient docstring on the real, unresolved gaps in their
    docs), so faking one would mean trusting an unsigned "it worked"
    from wherever this URL got called — a real security hole. IvoryPay's
    own verify_payment(reference) IS fully documented and real, so this
    endpoint calls that directly instead. Scoped to the caller's own
    payment; a webhook racing this (both can fire) is safe —
    settle_fee_payment is idempotent."""
    payment = (await db.execute(
        select(FeePayment).where(FeePayment.provider_reference == reference, FeePayment.user_id == user.id)
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="No matching fee payment for this reference")

    if payment.status == FeePaymentStatus.PENDING and not payment.is_test:
        try:
            client = get_payment_client(payment.provider)  # type: ignore[arg-type]
            if client.verify_payment(reference):
                await settle_fee_payment(db, payment)
        except (RuntimeError, NotImplementedError) as e:
            raise HTTPException(status_code=503, detail=str(e))

    return FeeVerifyResponse(
        reference=payment.provider_reference, provider=payment.provider,
        status=payment.status.value, amount=payment.amount, currency=payment.currency,
    )


def _fee_test_checkout_page(reference: str, payment: FeePayment, result: Optional[str] = None) -> str:
    """Same self-contained-HTML-standing-in-for-a-real-gateway pattern
    as routers/payments.py's own _test_checkout_page — kept as a
    separate small copy rather than shared, since the two pages differ
    in exactly what they're confirming (a fee balance vs. an Academy
    tier) and sharing would mean threading that distinction through a
    single function's parameters for no real benefit."""
    if result:
        heading = "Payment succeeded" if result == "success" else "Payment failed"
        color = "#059669" if result == "success" else "#dc2626"
        body = f"""
        <h1 style="color:{color}">{heading}</h1>
        <p>{"Your fee balance has been settled — trading access is restored." if result == "success" else "No payment was recorded — the gate stays up, exactly as it should."}</p>
        """
    else:
        body = f"""
        <p style="color:#666">Reference: <code>{reference}</code></p>
        <p style="font-size:24px;font-weight:bold;">{payment.amount:,.2f} {payment.currency}</p>
        <p style="color:#666;font-size:14px;">Performance fee settlement</p>
        <form method="POST" action="/fees/test-checkout/{reference}/complete" style="margin-top:20px;">
            <input type="hidden" name="succeeded" value="true">
            <button type="submit" style="padding:12px 24px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-right:12px;">
                Simulate Successful Payment
            </button>
        </form>
        <form method="POST" action="/fees/test-checkout/{reference}/complete">
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
<h2 style="margin-top:0;">Petrazim — Simulated Fee Settlement</h2>
{body}
</body></html>"""


@router.get("/test-checkout/{reference}", response_class=HTMLResponse)
async def fee_test_checkout_page(reference: str, db: AsyncSession = Depends(get_db)):
    payment = (await db.execute(
        select(FeePayment).where(FeePayment.provider_reference == reference, FeePayment.is_test == True)  # noqa: E712
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="No matching test fee payment for this reference")
    if payment.status != FeePaymentStatus.PENDING:
        return HTMLResponse(_fee_test_checkout_page(reference, payment, result="success" if payment.status == FeePaymentStatus.SUCCEEDED else "failed"))
    return HTMLResponse(_fee_test_checkout_page(reference, payment))


@router.post("/test-checkout/{reference}/complete", response_class=HTMLResponse)
async def complete_fee_test_checkout(reference: str, succeeded: str = Form(...), db: AsyncSession = Depends(get_db)):
    payment = (await db.execute(
        select(FeePayment).where(FeePayment.provider_reference == reference, FeePayment.is_test == True)  # noqa: E712
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="No matching test fee payment for this reference")

    if payment.status == FeePaymentStatus.PENDING:
        if succeeded == "true":
            await settle_fee_payment(db, payment)
        else:
            payment.status = FeePaymentStatus.FAILED
            await db.commit()

    result = "success" if payment.status == FeePaymentStatus.SUCCEEDED else "failed"
    return HTMLResponse(_fee_test_checkout_page(reference, payment, result=result))
