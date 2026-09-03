"""
Roster Router
================

Manager+ (Fund Manager, Partner, Admin, Super Admin) can invite new
Traders and manage their own roster. Every action re-checks role
server-side against the caller's own authenticated identity — never
trusts a role claim from the request body, only from the verified JWT.
"""

from __future__ import annotations

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, require_role, get_current_user
from app.database import get_db
from app.models.roster import RosterAssignment
from app.models.user import User, UserRole, UserStatus
from app.models.bot import BotConfig
from app.models.trade import Trade, TradeStatus
from app.services.roster_access import user_can_manage_trader

router = APIRouter(prefix="/roster", tags=["roster"])

MANAGER_ROLES = (UserRole.FUND_MANAGER, UserRole.PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)


class InviteTraineeRequest(BaseModel):
    email: str
    full_name: str


class InviteTraineeResponse(BaseModel):
    user_id: str
    email: str
    temporary_password: str


@router.post("/invite", response_model=InviteTraineeResponse)
async def invite_trainee(
    req: InviteTraineeRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    existing = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    import secrets
    temp_password = secrets.token_urlsafe(9)

    trader = User(
        email=req.email, full_name=req.full_name, role=UserRole.TRADER,
        hashed_password=hash_password(temp_password), status=UserStatus.PENDING,
        created_by=manager.id,
    )
    db.add(trader)
    await db.flush()

    assignment = RosterAssignment(
        trader_user_id=trader.id, assigned_to_user_id=manager.id, assigned_by_user_id=manager.id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(trader)

    return InviteTraineeResponse(user_id=str(trader.id), email=trader.email, temporary_password=temp_password)


class AssignTraderRequest(BaseModel):
    trader_user_id: str


@router.post("/assign")
async def assign_trader(
    req: AssignTraderRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    trader = (await db.execute(
        select(User).where(User.id == req.trader_user_id, User.role == UserRole.TRADER)
    )).scalar_one_or_none()
    if trader is None:
        raise HTTPException(status_code=404, detail="Trader not found")

    existing = (await db.execute(
        select(RosterAssignment).where(RosterAssignment.trader_user_id == trader.id)
    )).scalar_one_or_none()

    if existing:
        existing.assigned_to_user_id = manager.id
        existing.assigned_by_user_id = manager.id
    else:
        db.add(RosterAssignment(
            trader_user_id=trader.id, assigned_to_user_id=manager.id, assigned_by_user_id=manager.id,
        ))

    await db.commit()
    return {"ok": True}


@router.delete("/assign/{trader_user_id}")
async def detach_trader(
    trader_user_id: str, db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    row = (await db.execute(
        select(RosterAssignment).where(RosterAssignment.trader_user_id == trader_user_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No assignment found")
    if row.assigned_to_user_id != manager.id and manager.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="You can only detach traders on your own roster")

    await db.delete(row)
    await db.commit()
    return {"ok": True}


class RosterEntry(BaseModel):
    trader_user_id: str
    full_name: str
    email: str
    status: str
    assigned_at: str


@router.get("", response_model=List[RosterEntry])
async def get_roster(
    db: AsyncSession = Depends(get_db), manager: User = Depends(require_role(*MANAGER_ROLES))
):
    """Admin/Super Admin see the FULL roster across all managers; a
    Fund Manager/Partner sees only their own assigned traders — same
    scoping principle used everywhere else access is role-gated."""
    query = (
        select(RosterAssignment, User)
        .join(User, User.id == RosterAssignment.trader_user_id)
    )
    if manager.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        query = query.where(RosterAssignment.assigned_to_user_id == manager.id)

    rows = (await db.execute(query)).all()
    return [
        RosterEntry(
            trader_user_id=str(trader.id), full_name=trader.full_name, email=trader.email,
            status=trader.status.value, assigned_at=assignment.assigned_at.isoformat(),
        )
        for assignment, trader in rows
    ]


class TraderBotSummary(BaseModel):
    bot_id: str
    bot_name: str
    status: str
    risk_per_trade: float
    max_daily_trades: int
    max_concurrent_trades: int
    max_portfolio_exposure: float
    min_rr_ratio: float
    active_trades: int
    trades_today: int


class TraderOverview(BaseModel):
    trader_user_id: str
    full_name: str
    email: str
    status: str
    bots: List[TraderBotSummary]
    daily_pnl: float
    total_trades_today: int
    total_active_trades: int
    open_risk_exposure_pct: float


@router.get("/{trader_id}/overview", response_model=TraderOverview)
async def trader_overview(
    trader_id: str,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(get_current_user),
):
    """Real per-trader oversight for the Manager console: that
    Trader's bots with their actual risk settings, today's trade
    count/P&L, open exposure. Only for a Trader on the caller's own
    roster (or Admin/Super Admin) — this is the "manage risks, trade
    amounts for all traders" feature; PATCH /bots/{id}/metrics already
    accepts edits from this same caller (see bots.py's ownership gate,
    which now also allows a Manager/Partner with this trader on their
    roster), so this page can both show and change these numbers.
    """
    if not await user_can_manage_trader(manager, trader_id, db):
        raise HTTPException(status_code=404, detail="Trader not found")

    trader = (await db.execute(select(User).where(User.id == trader_id))).scalar_one_or_none()
    if not trader:
        raise HTTPException(status_code=404, detail="Trader not found")

    bots = (await db.execute(select(BotConfig).where(BotConfig.user_id == trader_id))).scalars().all()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    all_trades = (await db.execute(select(Trade).where(Trade.user_id == trader_id))).scalars().all()
    today_trades = [t for t in all_trades if t.created_at >= today_start]
    active_trades = [t for t in all_trades if t.status == TradeStatus.ACTIVE]

    bot_summaries = []
    for bot in bots:
        bot_active = [t for t in active_trades if t.bot_id == bot.bot_id]
        bot_today = [t for t in today_trades if t.bot_id == bot.bot_id]
        bot_summaries.append(TraderBotSummary(
            bot_id=bot.bot_id, bot_name=bot.bot_name, status=bot.status.value,
            risk_per_trade=bot.risk_per_trade, max_daily_trades=bot.max_daily_trades,
            max_concurrent_trades=bot.max_concurrent_trades, max_portfolio_exposure=bot.max_portfolio_exposure,
            min_rr_ratio=bot.min_rr_ratio, active_trades=len(bot_active), trades_today=len(bot_today),
        ))

    return TraderOverview(
        trader_user_id=str(trader.id), full_name=trader.full_name, email=trader.email,
        status=trader.status.value, bots=bot_summaries,
        daily_pnl=round(sum(t.realized_pnl or 0 for t in today_trades), 2),
        total_trades_today=len(today_trades),
        total_active_trades=len(active_trades),
        open_risk_exposure_pct=round(sum(t.risk_percent or 0 for t in active_trades), 2),
    )
