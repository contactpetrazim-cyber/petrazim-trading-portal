"""
Roster Router
================

Manager+ (Fund Manager, Partner, Admin, Super Admin) can invite new
Traders and manage their own roster. Every action re-checks role
server-side against the caller's own authenticated identity — never
trusts a role claim from the request body, only from the verified JWT.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, require_role, get_current_user
from app.database import get_db
from app.models.access import AccessCode, CodeType, UserAccess
from app.models.curriculum import TrackStage, StageCompletion, UserLearningStats
from app.models.facilitator import BookingStatus, MeetingBooking
from app.models.roster import RosterAssignment
from app.models.telegram_link import TelegramLink
from app.models.user import User, UserRole, UserStatus
from app.models.bot import BotConfig
from app.models.trade import Trade, TradeStatus
from app.services.roster_access import user_can_manage_trader
from app.services.email import build_trader_invite_email, send_email
from app.config import get_settings

import structlog

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/roster", tags=["roster"])

MANAGER_ROLES = (UserRole.FUND_MANAGER, UserRole.PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)


class InviteTraineeRequest(BaseModel):
    email: str
    full_name: str


class InviteTraineeResponse(BaseModel):
    user_id: str
    email: str
    temporary_password: str
    # False whenever no email provider is configured yet (see
    # services/email.py's own send_email) — the invite itself always
    # still succeeds either way; temporary_password is returned above
    # so the inviting Manager can hand it over directly (Slack, in
    # person, etc.) when it is.
    email_sent: bool


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

    # Best-effort — an invite must always succeed even when no email
    # provider is configured yet (send_email's own honest
    # NotImplementedError/RuntimeError in that case) or the provider
    # call itself fails for any other reason. temporary_password is
    # always returned in the response either way, so the inviting
    # Manager can hand it over directly when the email doesn't go out.
    email_sent = False
    try:
        subject, body = build_trader_invite_email(
            trader_name=trader.full_name, email=trader.email,
            temporary_password=temp_password, login_url=f"{settings.FRONTEND_URL.rstrip('/')}/login",
        )
        send_email(trader.email, subject, body)
        email_sent = True
    except Exception as e:
        logger.warning("trader_invite_email_not_sent", trader_email=trader.email, error=str(e))

    return InviteTraineeResponse(
        user_id=str(trader.id), email=trader.email, temporary_password=temp_password, email_sent=email_sent,
    )


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
    # CANCELLED/ERROR excluded — same fix as dashboard.py's own
    # "Today's Trades", by the same direct bug report: a withdrawn
    # order was never actually a trade taken today.
    today_trades = [
        t for t in all_trades
        if t.created_at >= today_start and t.status not in (TradeStatus.CANCELLED, TradeStatus.ERROR)
    ]
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


# --------------------------------------------------------------------------
# Learning Console — adapted from the reference training portal's
# Trainer/Manager/Admin dashboards (cohorts, "furthest along", next
# seven days of facilitator sessions, roster progress), re-derived from
# what this app actually tracks rather than copied number-for-number.
# One endpoint covers every tier this codebase actually has above
# Trader: Fund Manager and Partner already carry full manager-tier
# powers here (see MANAGER_ROLES above — there's no reduced "view only"
# role between Trader and Admin in this app), so both get the full
# roster+commerce picture below; Admin/Super Admin get the same shape
# scoped platform-wide instead of to their own roster, plus their own
# separate /admin/platform-overview on top (organisations, staff
# accounts, daily sends, live bookings).
# --------------------------------------------------------------------------

class FurthestAlongEntry(BaseModel):
    full_name: str
    progress_pct: float


class NextSessionEntry(BaseModel):
    booking_id: str
    day: str
    band: str
    topic: str
    booked_count: int
    capacity: int
    at_capacity: bool


class LearningRosterRow(BaseModel):
    trader_user_id: str
    full_name: str
    email: str
    sponsor: str  # "Individual" | "Corporate" — derived from their most recent active UserAccess.granted_via
    completed_stages: int
    total_stages: int
    community_linked: bool
    last_activity: Optional[str]


class LearningDashboardResponse(BaseModel):
    roster_size: int
    active_learners_30d: int
    avg_completion_pct: float
    finished_count: int
    community_joins: int
    total_stages: int
    furthest_along: List[FurthestAlongEntry]
    next_seven_days: List[NextSessionEntry]
    roster: List[LearningRosterRow]
    seats_issued: int
    active_plans: int
    codes_live: int
    codes_redeemed: int


@router.get("/learning-dashboard", response_model=LearningDashboardResponse)
async def learning_dashboard(
    db: AsyncSession = Depends(get_db), manager: User = Depends(require_role(*MANAGER_ROLES)),
):
    """Real numbers behind the console's "Cohorts and Your Sessions"
    header, "Furthest Along" list, "Next Seven Days" sessions widget,
    and Roster table — all computed from this roster's actual
    curriculum progress (StageCompletion/UserLearningStats), Telegram
    links, and access grants, not placeholders.
    """
    is_platform_wide = manager.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

    roster_query = select(RosterAssignment, User).join(User, User.id == RosterAssignment.trader_user_id)
    if not is_platform_wide:
        roster_query = roster_query.where(RosterAssignment.assigned_to_user_id == manager.id)
    roster_rows = (await db.execute(roster_query)).all()
    trader_ids = [trader.id for _, trader in roster_rows]

    total_stages = (await db.execute(select(func.count()).select_from(TrackStage))).scalar_one() or 0

    stats_by_user, completed_by_user, linked_user_ids, sponsor_by_user = {}, {}, set(), {}
    if trader_ids:
        stats_by_user = {
            s.user_id: s for s in (await db.execute(
                select(UserLearningStats).where(UserLearningStats.user_id.in_(trader_ids))
            )).scalars().all()
        }
        completed_by_user = dict((await db.execute(
            select(StageCompletion.user_id, func.count())
            .where(StageCompletion.user_id.in_(trader_ids))
            .group_by(StageCompletion.user_id)
        )).all())
        linked_user_ids = set((await db.execute(
            select(TelegramLink.user_id).where(TelegramLink.user_id.in_(trader_ids)).distinct()
        )).scalars().all())
        # Most recent active grant per user decides their sponsor label
        # — ordering by expires_at desc and taking the first hit per
        # user_id (dict.setdefault only keeps the first assignment).
        for uid, granted_via in (await db.execute(
            select(UserAccess.user_id, UserAccess.granted_via)
            .where(UserAccess.user_id.in_(trader_ids), UserAccess.is_active == True)  # noqa: E712
            .order_by(UserAccess.expires_at.desc())
        )).all():
            sponsor_by_user.setdefault(uid, "Corporate" if granted_via == CodeType.CORPORATE_SEAT.value else "Individual")

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    roster_out: List[LearningRosterRow] = []
    furthest_along: List[FurthestAlongEntry] = []
    active_30d = 0
    completion_sum = 0.0
    finished_count = 0
    for _assignment, trader in roster_rows:
        completed = completed_by_user.get(trader.id, 0)
        pct = (completed / total_stages * 100) if total_stages else 0.0
        completion_sum += pct
        if total_stages and completed >= total_stages:
            finished_count += 1
        stats = stats_by_user.get(trader.id)
        last_activity = stats.last_activity_date if stats else None
        if last_activity is not None:
            last_activity_utc = last_activity if last_activity.tzinfo else last_activity.replace(tzinfo=timezone.utc)
            if last_activity_utc >= thirty_days_ago:
                active_30d += 1
        roster_out.append(LearningRosterRow(
            trader_user_id=str(trader.id), full_name=trader.full_name, email=trader.email,
            sponsor=sponsor_by_user.get(trader.id, "Individual"),
            completed_stages=completed, total_stages=total_stages,
            community_linked=trader.id in linked_user_ids,
            last_activity=last_activity.isoformat() if last_activity else None,
        ))
        furthest_along.append(FurthestAlongEntry(full_name=trader.full_name, progress_pct=round(pct, 1)))
    furthest_along.sort(key=lambda e: e.progress_pct, reverse=True)

    # Next Seven Days — the reference's own per-session "N/25 seats
    # taken" doesn't apply here: this app's real facilitator capacity
    # (services/facilitator_booking.py) caps at MAX_BOOKINGS_PER_DAY
    # total sessions PER DAY, not per-session seat count, so this shows
    # that real cap instead of inventing a seat number.
    from app.services.facilitator_booking import MAX_BOOKINGS_PER_DAY
    today = now.date()
    upcoming_bookings = (await db.execute(
        select(MeetingBooking)
        .where(MeetingBooking.status == BookingStatus.CONFIRMED,
               MeetingBooking.day >= today, MeetingBooking.day < today + timedelta(days=7))
        .order_by(MeetingBooking.day, MeetingBooking.band)
    )).scalars().all()
    bookings_per_day: dict = {}
    for b in upcoming_bookings:
        bookings_per_day[b.day] = bookings_per_day.get(b.day, 0) + 1
    next_seven_days = [
        NextSessionEntry(
            booking_id=str(b.id), day=b.day.isoformat(), band=b.band.value, topic=b.topic or "",
            booked_count=bookings_per_day[b.day], capacity=MAX_BOOKINGS_PER_DAY,
            at_capacity=bookings_per_day[b.day] >= MAX_BOOKINGS_PER_DAY,
        )
        for b in upcoming_bookings
    ]

    # Commerce counters — a Fund Manager/Partner sees only what they
    # personally issued/sponsor; Admin/Super Admin see the platform
    # total, same scoping split as everything above.
    codes_query = select(AccessCode)
    if not is_platform_wide:
        codes_query = codes_query.where(AccessCode.issued_by_user_id == manager.id)
    codes = (await db.execute(codes_query)).scalars().all()
    codes_redeemed = sum(1 for c in codes if c.redemption_count >= c.max_redemptions)
    codes_live = sum(
        1 for c in codes
        if not c.is_held and c.redemption_count < c.max_redemptions and (not c.expires_at or c.expires_at > now)
    )

    active_plans_query = select(func.count()).select_from(UserAccess).where(
        UserAccess.is_active == True, UserAccess.expires_at > now,  # noqa: E712
    )
    if not is_platform_wide:
        active_plans_query = active_plans_query.where(UserAccess.user_id.in_(trader_ids))
    active_plans = (await db.execute(active_plans_query)).scalar_one() or 0

    return LearningDashboardResponse(
        roster_size=len(roster_rows), active_learners_30d=active_30d,
        avg_completion_pct=round(completion_sum / len(roster_rows), 1) if roster_rows else 0.0,
        finished_count=finished_count, community_joins=len(linked_user_ids), total_stages=total_stages,
        furthest_along=furthest_along, next_seven_days=next_seven_days, roster=roster_out,
        seats_issued=len(codes), active_plans=active_plans,
        codes_live=codes_live, codes_redeemed=codes_redeemed,
    )
