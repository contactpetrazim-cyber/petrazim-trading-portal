"""Shared "can this Manager/Partner act on this Trader" check — used
by roster.py's oversight endpoint and by bots.py's ownership gate, so
a Fund Manager/Partner can actually manage (not just view) the risk
settings of the Traders on their own roster. A RosterAssignment ties
exactly one Trader to exactly one Manager/Partner (trader_user_id is
UNIQUE — see models/roster.py), so this is a single row lookup.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.roster import RosterAssignment
from app.models.user import User, UserRole

STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


async def user_can_manage_trader(manager: User, trader_id, db: AsyncSession) -> bool:
    """True if `manager` may view/edit the given trader's data:
    themselves (trivially, though callers rarely need this), Admin/
    Super Admin (everyone), or a Fund Manager/Partner with that trader
    on their own roster."""
    if manager.id == trader_id or manager.role in STAFF_ROLES:
        return True
    if manager.role not in (UserRole.FUND_MANAGER, UserRole.PARTNER):
        return False
    row = (await db.execute(
        select(RosterAssignment).where(
            RosterAssignment.trader_user_id == trader_id,
            RosterAssignment.assigned_to_user_id == manager.id,
        )
    )).scalar_one_or_none()
    return row is not None
