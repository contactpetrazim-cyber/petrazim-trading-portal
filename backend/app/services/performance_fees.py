"""
Performance fee calculation — the execution-side counterpart to
models/fee_settings.py. See that module's own docstring for the full
"calculation + disclosure, not automatic collection" scope.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    full close or one partial-close slice) is finalized — see the
    three real call sites: webhook_processor.py's own close-alert
    handler, and manual_trading.py's own partial_close/cancel_order.
    Only ever creates a ledger entry when ALL of these hold:
      - trade.subscription_id is set (a subscriber's own bot-copied
        trade — see that column's own comment; never a platform trade
        or a trader's own manual one),
      - fees are currently enabled in PlatformFeeSettings,
      - `pnl_this_close` is POSITIVE — "on a success basis" from the
        original request: a losing close owes nothing, ever, no matter
        how large the loss.
    Returns None (no-op) whenever any of those don't hold — safe to
    call unconditionally from every close site rather than each one
    re-checking the same three conditions itself."""
    if trade.subscription_id is None or pnl_this_close <= 0:
        return None

    settings_row = await get_fee_settings(db)
    if not settings_row.enabled or settings_row.fee_percent <= 0:
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
