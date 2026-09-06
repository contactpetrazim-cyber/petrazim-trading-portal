"""
Corporate Seats Router
=========================

Answers "how do individuals sponsored by a corporate org access
content individually": a Fund Manager/Partner/Admin purchases N seats,
this generates N unique single-use codes, the org distributes them
however they like (email, spreadsheet, whatever) — each recipient
redeems their own code through the existing single-field
/payments/redeem-code endpoint and gets their own independent account
access, fully decoupled from the org's account after that point.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.database import get_db
from app.models.access import AccessCode, AccessTier
from app.models.user import User, UserRole
from app.services.corporate_codes import build_access_code_rows, generate_seat_codes

router = APIRouter(prefix="/payments/corporate", tags=["corporate"])


class GenerateSeatsRequest(BaseModel):
    tier: AccessTier
    seat_count: int


class SeatBatchResponse(BaseModel):
    codes: List[str]
    tier: str
    seat_count: int
    expires_at: str


@router.post("/generate-seats", response_model=SeatBatchResponse)
async def generate_seats(
    req: GenerateSeatsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.FUND_MANAGER, UserRole.PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Call this AFTER a corporate payment succeeds (wired from the
    payment webhook for seat_count > 1 — see payment_webhooks.py) or
    directly for admin-granted corporate batches. Only Fund
    Manager/Partner/Admin/Super Admin roles can issue seats — a Trader
    account has nobody to sponsor."""
    existing_rows = (await db.execute(select(AccessCode.code))).scalars().all()

    try:
        batch = generate_seat_codes(
            issued_by_user_id=str(user.id), tier=req.tier,
            seat_count=req.seat_count, existing_codes=set(existing_rows),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows = build_access_code_rows(batch, req.tier)
    db.add_all(rows)
    await db.commit()

    return SeatBatchResponse(
        codes=batch.codes, tier=batch.tier, seat_count=batch.seat_count,
        expires_at=batch.expires_at.isoformat(),
    )


class IssuedSeatResponse(BaseModel):
    code: str
    seat_label: str
    tier: str
    redeemed: bool
    redemption_count: int
    max_redemptions: int
    is_held: bool
    expires_at: str


@router.get("/my-codes", response_model=List[IssuedSeatResponse])
async def my_issued_codes(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Lets the purchasing Fund Manager/Partner see which of their
    issued seats have been redeemed yet, without exposing WHO redeemed
    which one — redemption is tracked as a count/boolean here, not
    linked back to the individual's identity, since the sponsor
    shouldn't need to know who on their team used which specific code.

    Admin/Super Admin see every issued code platform-wide (same
    everyone-vs-own-roster split roster.py's get_roster already uses),
    not just their own — the Admin console's Access Codes panel needs
    the full picture; a Fund Manager/Partner only ever needs their own
    batch.
    """
    query = select(AccessCode).order_by(AccessCode.created_at)
    if user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        query = query.where(AccessCode.issued_by_user_id == user.id)
    rows = (await db.execute(query)).scalars().all()

    # "Seat N" is a display label, not a stored column — 1-indexed
    # position within this issuer's own codes, in the order they were
    # generated (generate_seats always inserts a whole batch in one
    # call, so codes from the same POST keep insertion order here).
    seat_number: dict = {}
    out = []
    for r in rows:
        seat_number[r.issued_by_user_id] = seat_number.get(r.issued_by_user_id, 0) + 1
        out.append(IssuedSeatResponse(
            code=r.code, seat_label=f"Seat {seat_number[r.issued_by_user_id]}",
            tier=r.tier_granted.value,
            redeemed=r.redemption_count >= r.max_redemptions,
            redemption_count=r.redemption_count, max_redemptions=r.max_redemptions,
            is_held=r.is_held,
            expires_at=r.expires_at.isoformat() if r.expires_at else "",
        ))
    return out


@router.patch("/codes/{code}/hold", response_model=IssuedSeatResponse)
async def set_code_hold(
    code: str, held: bool,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Pause or resume one issued seat without deleting it — the
    "Hold"/"Resume" action on the Manager console's Access Codes panel,
    adapted from the reference training portal's own seat-management
    screen. A held code is rejected at redeem time (payments.py's
    redeem_code) but keeps its redemption_count/expiry untouched, so
    resuming it picks up exactly where the seat left off.

    Scoped like my-codes above: the issuer can hold/resume their own
    seats; Admin/Super Admin can act on any.
    """
    row = (await db.execute(select(AccessCode).where(AccessCode.code == code.strip().upper()))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Code not found")
    if row.issued_by_user_id != user.id and user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="You can only hold/resume seats you issued")

    row.is_held = held
    await db.commit()
    await db.refresh(row)
    return IssuedSeatResponse(
        code=row.code, seat_label="", tier=row.tier_granted.value,
        redeemed=row.redemption_count >= row.max_redemptions,
        redemption_count=row.redemption_count, max_redemptions=row.max_redemptions,
        is_held=row.is_held, expires_at=row.expires_at.isoformat() if row.expires_at else "",
    )
