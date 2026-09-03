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
    tier: str
    redeemed: bool
    expires_at: str


@router.get("/my-codes", response_model=List[IssuedSeatResponse])
async def my_issued_codes(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Lets the purchasing Fund Manager/Partner see which of their
    issued seats have been redeemed yet, without exposing WHO redeemed
    which one — redemption is tracked as a count/boolean here, not
    linked back to the individual's identity, since the sponsor
    shouldn't need to know who on their team used which specific code."""
    rows = (await db.execute(
        select(AccessCode).where(AccessCode.issued_by_user_id == user.id)
    )).scalars().all()

    return [
        IssuedSeatResponse(
            code=r.code, tier=r.tier_granted.value,
            redeemed=r.redemption_count >= r.max_redemptions,
            expires_at=r.expires_at.isoformat() if r.expires_at else "",
        )
        for r in rows
    ]
