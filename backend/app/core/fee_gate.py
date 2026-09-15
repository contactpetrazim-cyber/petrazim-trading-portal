"""
Trading Fee Settlement Gate
================================

The Paystack-backed access gate for the performance-fee system — by
direct request: "introduce a Paystack payment gate that pays for
previous day fees before access to a new day... checks payment and
grants access to bot trading or manual trading or automated trades."

Same shape as core/access_gate.py's own require_active_access /
_raise_if_access_expired pair (a FastAPI dependency for routes that
should be fully blocked, plus a plain-function form for a call site
that needs to gate only one branch — e.g. a real order, never a paper
one, or only a subscriber's fee-eligible copy trade, never the
platform's own bot trade) — deliberately NOT unified into one shared
gate with the Academy's access_expired, because the two are genuinely
independent: a trader can owe performance fees regardless of whether
their Academy subscription is active, and vice versa.

Deliberately narrow in what it blocks: only NEW trade creation (a
fresh manual order, a bot signal fanning out into a new copy trade, a
trader approving a drafted copy trade into a live one, subscribing to
a new bot). Managing or closing a position you already have open is
NEVER gated here — blocking an exit because of an unpaid fee would
leave real risk sitting open for no reason, which is a worse outcome
than the fee itself. See routers/manual_trading.py's own call sites
for where this line is actually drawn.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.performance_fees import owed_from_previous_days


class FeesOwedError(HTTPException):
    def __init__(self, owed_amount: float, currency: str = "USD"):
        detail = {
            "error": "trading_fees_owed",
            "title": "Settle yesterday's performance fees to keep trading",
            "message": (
                f"You have {currency} {owed_amount:,.2f} in performance fees carried over from a "
                "previous day. New trades — manual, bot, or automated copy trades — are paused "
                "until this is settled. Managing or closing any trade you already have open is "
                "never affected."
            ),
            "owed_amount": owed_amount,
            "currency": currency,
        }
        super().__init__(status_code=402, detail=detail)


async def raise_if_fees_owed(db: AsyncSession, user: User, currency: str = "USD") -> None:
    """The plain-function form — call this explicitly from a branch
    that should be gated, exactly like access_gate.py's own
    _raise_if_access_expired. Never called for a paper/test trade, and
    never for the platform's own (non-subscription) bot trade — only a
    real order genuinely at risk of an unpaid fee is gated."""
    owed = await owed_from_previous_days(db, user.id)
    if owed > 0:
        raise FeesOwedError(owed, currency)


async def require_fees_settled(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> User:
    """Drop-in dependency for a route that should be fully blocked
    while fees are owed — e.g. subscribing to a new bot. Prefer
    raise_if_fees_owed directly when a route needs to gate only one
    branch (test vs. live, as manual_trading.py's routes do)."""
    await raise_if_fees_owed(db, user)
    return user
