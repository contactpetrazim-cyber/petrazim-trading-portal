"""
Performance fee calculation — the execution-side counterpart to
models/fee_settings.py. See that module's own docstring for the full
"calculation + disclosure, not automatic collection" scope.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fee_payment import FeePayment, FeePaymentStatus
from app.models.fee_settings import PlatformFeeSettings, PerformanceFeeLedgerEntry, FeeLedgerStatus
from app.models.trade import Trade

_SETTINGS_ID = "singleton"


async def get_fee_settings(db: AsyncSession) -> PlatformFeeSettings:
    """Reads the one platform-wide fee row, creating it with safe
    defaults (fee OFF, 0%) the first time anything asks — so a fresh
    deployment never charges a cent until an Admin explicitly opens
    the Fee Settings page and turns it on."""
    row = (await db.execute(
        select(PlatformFeeSettings).where(PlatformFeeSettings.id == _SETTINGS_ID)
    )).scalar_one_or_none()
    if row is None:
        row = PlatformFeeSettings(id=_SETTINGS_ID)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def apply_performance_fee(db: AsyncSession, trade: Trade, pnl_this_close: float) -> Optional[PerformanceFeeLedgerEntry]:
    """Called right after a Trade row's realized P&L for ONE close (a
    full close or one partial-close slice) is finalized — see the real
    call sites: webhook_processor.py's own close-alert handler, and
    manual_trading.py's own partial_close/cancel_order.

    A trade is fee-ELIGIBLE if either:
      - trade.subscription_id is set — a subscriber's own bot-copied
        trade (see that column's own comment), gated by
        PlatformFeeSettings.enabled, or
      - trade.strategy_type == "manual" — a trader's own manual trade
        (set exactly once, in routers/manual_trading.py's own
        place_manual_order), gated by its own separate
        PlatformFeeSettings.manual_trade_fee_enabled — by direct
        follow-up request ("add a fee system to manual trades also for
        using the platform... can be toggled on or off in the admin
        portal"). The platform's own bot trade (neither of the above —
        no subscription_id, strategy_type is whatever the signal
        named it) is NEVER eligible: the platform doesn't charge
        itself.
    Beyond eligibility, a ledger entry is only ever created when ALL of
    these also hold:
      - trade.is_test is NOT True — a Paper/Test trade risks no real
        money, so it never owes a fee regardless of either toggle,
      - the relevant toggle above is actually on,
      - `pnl_this_close` is POSITIVE — "on a success basis" from the
        original request: a losing close owes nothing, ever, no matter
        how large the loss.
    Returns None (no-op) whenever any of those don't hold — safe to
    call unconditionally from every close site rather than each one
    re-checking these conditions itself."""
    if trade.is_test or pnl_this_close <= 0:
        return None

    is_copy_trade = trade.subscription_id is not None
    is_manual_trade = trade.strategy_type == "manual"
    if not is_copy_trade and not is_manual_trade:
        return None

    settings_row = await get_fee_settings(db)
    if is_copy_trade and not settings_row.enabled:
        return None
    if is_manual_trade and not settings_row.manual_trade_fee_enabled:
        return None
    if settings_row.fee_percent <= 0:
        return None

    fee_amount = round(pnl_this_close * settings_row.fee_percent / 100.0, 2)
    if fee_amount <= 0:
        return None

    entry = PerformanceFeeLedgerEntry(
        user_id=trade.user_id,
        trade_id=trade.trade_id,
        subscription_id=trade.subscription_id,
        pnl_amount=round(pnl_this_close, 2),
        fee_percent_applied=settings_row.fee_percent,
        fee_amount=fee_amount,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def _owed_entries(db: AsyncSession, user_id, before=None) -> List[PerformanceFeeLedgerEntry]:
    query = select(PerformanceFeeLedgerEntry).where(
        PerformanceFeeLedgerEntry.user_id == user_id,
        PerformanceFeeLedgerEntry.status == FeeLedgerStatus.OWED,
    )
    if before is not None:
        query = query.where(PerformanceFeeLedgerEntry.created_at < before)
    return (await db.execute(query)).scalars().all()


async def owed_from_previous_days(db: AsyncSession, user_id) -> float:
    """The gate's own number — "pays for previous day fees before
    access to a new day," by direct request. Only counts a fee that
    accrued BEFORE today (UTC) started; a fee that just accrued from a
    trade that closed minutes ago, today, never blocks anything until
    tomorrow — today's own trading is never retroactively gated by
    itself."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    rows = await _owed_entries(db, user_id, before=today_start)
    return round(sum(e.fee_amount for e in rows), 2)


async def total_owed(db: AsyncSession, user_id) -> float:
    """Every OWED entry regardless of date — what a "Pay now" checkout
    actually charges. Settling this always also settles the (subset)
    amount owed_from_previous_days is gating on, so a trader who pays
    can never end up still gated afterward."""
    rows = await _owed_entries(db, user_id)
    return round(sum(e.fee_amount for e in rows), 2)


async def start_fee_checkout_snapshot(db: AsyncSession, user_id) -> tuple[float, List[str]]:
    """Snapshots every currently-OWED entry for this trader — the exact
    set a checkout is started against (see FeePayment.covered_entry_ids'
    own comment for why this needs to be a snapshot, not "whatever's
    OWED when the webhook later arrives"). Returns (amount, entry_ids)."""
    rows = await _owed_entries(db, user_id)
    amount = round(sum(e.fee_amount for e in rows), 2)
    return amount, [str(r.id) for r in rows]


async def settle_fee_payment(db: AsyncSession, payment: FeePayment) -> None:
    """The one place a FeePayment is actually marked settled and its
    covered ledger entries flipped to PAID — called from BOTH the real
    Paystack webhook (routers/payment_webhooks.py) and the Test-mode
    simulated-checkout completion (routers/fees.py), so there is
    exactly one code path from "payment confirmed" to "access
    restored," matching how _grant_access_for_payment is the single
    such path for the Academy's own payments. Idempotent: a webhook
    that fires twice for the same reference is a no-op the second time."""
    if payment.status == FeePaymentStatus.SUCCEEDED:
        return
    payment.status = FeePaymentStatus.SUCCEEDED
    payment.paid_at = datetime.utcnow()

    covered_ids = json.loads(payment.covered_entry_ids or "[]")
    if covered_ids:
        ids = [uuid.UUID(i) for i in covered_ids]
        rows = (await db.execute(
            select(PerformanceFeeLedgerEntry).where(PerformanceFeeLedgerEntry.id.in_(ids))
        )).scalars().all()
        for row in rows:
            if row.status == FeeLedgerStatus.OWED:
                row.status = FeeLedgerStatus.PAID
                row.paid_at = datetime.utcnow()
                row.paid_note = f"Paid via {payment.provider} — ref {payment.provider_reference}"
    await db.commit()
