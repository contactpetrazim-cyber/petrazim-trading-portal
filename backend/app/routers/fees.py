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

from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.database import get_db
from app.models.fee_settings import FeeLedgerStatus, PayoutMethod, PerformanceFeeLedgerEntry, PlatformFeeSettings
from app.models.user import User, UserRole
from app.services.performance_fees import get_fee_settings

router = APIRouter(prefix="/fees", tags=["performance-fees"])
admin_router = APIRouter(prefix="/admin/fees", tags=["performance-fees-admin"])

ADMIN_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


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
    updated_at: datetime


def _settings_response(s: PlatformFeeSettings) -> FeeSettingsResponse:
    return FeeSettingsResponse(
        enabled=s.enabled, fee_percent=s.fee_percent, payout_method=s.payout_method.value,
        crypto_address=s.crypto_address, crypto_network=s.crypto_network,
        paystack_account_name=s.paystack_account_name, paystack_account_number=s.paystack_account_number,
        paystack_bank_name=s.paystack_bank_name, paystack_bank_code=s.paystack_bank_code,
        notes=s.notes, updated_at=s.updated_at,
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
    total_owed = round(sum(e.fee_amount for e in rows if e.status == FeeLedgerStatus.OWED), 2)
    return MyFeesResponse(
        enabled=settings_row.enabled, fee_percent=settings_row.fee_percent, payout_method=settings_row.payout_method.value,
        crypto_address=settings_row.crypto_address, crypto_network=settings_row.crypto_network,
        paystack_account_name=settings_row.paystack_account_name, paystack_account_number=settings_row.paystack_account_number,
        paystack_bank_name=settings_row.paystack_bank_name,
        total_owed=total_owed, entries=[_entry_response(e) for e in rows],
    )
