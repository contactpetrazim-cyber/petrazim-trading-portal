"""
Trader Exchange Connections — self-service onboarding for a trader to
connect THEIR OWN exchange account, so trades genuinely execute there
(manually, through a subscribed bot, or both) instead of on the
platform's own pooled accounts. By direct request: "guess they can
give us an API for the selected account....we give them our IP to add
to their exchange ... create an onboarding page or system ... trade
manually and using our bots on their accounts ... Put the onboarding
controls and management in the admin portal."

How a trader actually gets here: Manager+ invites them the same way
every trader is invited today (POST /roster/invite — already built,
unchanged by this file); once they have a real login, this router's
own endpoints are what they use to connect an exchange account
themselves, self-service, from their own dashboard. No separate
"invite to connect" flow exists or is needed — connecting an exchange
is just something an already-onboarded trader can now do.

Trader-facing endpoints are scoped to the caller's own connections only
(never another trader's, and never a decrypted key/secret back out —
only a masked preview, same convention as broker_credentials.py).
Admin-facing endpoints (prefix /admin/exchange-connections) let an
Admin/Super Admin see and manage every trader's connections platform-
wide, per the direct request above.
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
from app.models.bot import BotConfig
from app.models.trader_broker_connection import ConnectionMode, ConnectionStatus, TraderBotSubscription, TraderBrokerConnection
from app.models.user import User, UserRole
from app.services.trader_broker_connections import EXCHANGE_META, encrypt_secret, platform_outbound_ips, test_connection

router = APIRouter(prefix="/exchange-connections", tags=["trader-broker-connections"])
admin_router = APIRouter(prefix="/admin/exchange-connections", tags=["trader-broker-connections-admin"])

ExchangeName = Literal["bingx", "binance", "bybit", "mexc", "tradelocker", "metatrader"]


# =============================================================================
# Shared shapes
# =============================================================================

class ExchangeInfo(BaseModel):
    exchange: str
    label: str
    fields: List[str]
    instructions: str


class ExchangeMetaResponse(BaseModel):
    exchanges: List[ExchangeInfo]
    outbound_ips: str  # empty until PLATFORM_OUTBOUND_IPS is set — see that setting's own comment


@router.get("/exchanges", response_model=ExchangeMetaResponse)
async def list_exchanges(_user: User = Depends(get_current_user)):
    """What a trader needs to enter, and the real IP(s) to whitelist,
    for every exchange this platform can connect a trader's own account
    to — drives the connect form. Any authenticated user can read this
    (no secrets in it)."""
    return ExchangeMetaResponse(
        exchanges=[ExchangeInfo(exchange=k, **v) for k, v in EXCHANGE_META.items()],
        outbound_ips=platform_outbound_ips(),
    )


def _preview(encrypted: str) -> str:
    return f"...{encrypted[-4:]}" if encrypted and len(encrypted) > 4 else "...."


class ConnectionResponse(BaseModel):
    id: str
    exchange: str
    label: Optional[str]
    mode: str
    status: str
    is_active: bool
    api_key_preview: str
    last_verified_at: Optional[datetime]
    last_error: Optional[str]
    created_at: datetime
    # Admin listing only — which trader owns this connection.
    trader_email: Optional[str] = None
    trader_name: Optional[str] = None


def _to_response(c: TraderBrokerConnection, trader: Optional[User] = None) -> ConnectionResponse:
    return ConnectionResponse(
        id=str(c.id), exchange=c.exchange, label=c.label, mode=c.mode.value, status=c.status.value,
        is_active=c.is_active, api_key_preview=_preview(c.api_key_encrypted),
        last_verified_at=c.last_verified_at, last_error=c.last_error, created_at=c.created_at,
        trader_email=trader.email if trader else None, trader_name=trader.full_name if trader else None,
    )


# =============================================================================
# Trader-facing: connect / list / update / delete / test MY OWN connections
# =============================================================================

class ConnectExchangeRequest(BaseModel):
    exchange: ExchangeName
    api_key: str
    api_secret: Optional[str] = None  # not used for metatrader (token goes in api_key — see EXCHANGE_META)
    account_id: Optional[str] = None  # tradelocker / metatrader only
    label: Optional[str] = None
    mode: Literal["manual", "bot", "both"] = "manual"


@router.post("", response_model=ConnectionResponse)
async def connect_exchange(
    req: ConnectExchangeRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Save a trader's own exchange credentials, encrypted — never
    tested/verified automatically here (see POST .../test), so a typo'd
    key still saves and can be corrected rather than silently
    discarded."""
    connection = TraderBrokerConnection(
        user_id=user.id, exchange=req.exchange, label=req.label,
        api_key_encrypted=encrypt_secret(req.api_key),
        api_secret_encrypted=encrypt_secret(req.api_secret) if req.api_secret else None,
        account_id_encrypted=encrypt_secret(req.account_id) if req.account_id else None,
        mode=ConnectionMode(req.mode),
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    return _to_response(connection)


@router.get("", response_model=List[ConnectionResponse])
async def list_my_connections(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(TraderBrokerConnection).where(TraderBrokerConnection.user_id == user.id)
    )).scalars().all()
    return [_to_response(c) for c in rows]


async def _get_own_connection(db: AsyncSession, user: User, connection_id: str) -> TraderBrokerConnection:
    row = (await db.execute(
        select(TraderBrokerConnection).where(TraderBrokerConnection.id == connection_id, TraderBrokerConnection.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return row


class UpdateConnectionRequest(BaseModel):
    label: Optional[str] = None
    mode: Optional[Literal["manual", "bot", "both"]] = None
    is_active: Optional[bool] = None
    # Re-entering credentials (a rotated key) — omit to leave the
    # currently-stored ones untouched.
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    account_id: Optional[str] = None


@router.patch("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: str, req: UpdateConnectionRequest,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    row = await _get_own_connection(db, user, connection_id)
    if req.label is not None:
        row.label = req.label
    if req.mode is not None:
        row.mode = ConnectionMode(req.mode)
    if req.is_active is not None:
        row.is_active = req.is_active
    credentials_changed = False
    if req.api_key is not None:
        row.api_key_encrypted = encrypt_secret(req.api_key)
        credentials_changed = True
    if req.api_secret is not None:
        row.api_secret_encrypted = encrypt_secret(req.api_secret)
        credentials_changed = True
    if req.account_id is not None:
        row.account_id_encrypted = encrypt_secret(req.account_id)
        credentials_changed = True
    if credentials_changed:
        # A rotated/edited key hasn't been re-verified yet — back to
        # PENDING rather than leaving a stale VERIFIED badge on
        # credentials that were never actually tested.
        row.status = ConnectionStatus.PENDING
        row.last_error = None
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _to_response(row)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    row = await _get_own_connection(db, user, connection_id)
    await db.delete(row)
    await db.commit()
    return {"success": True, "deleted": connection_id}


class TestConnectionResponse(BaseModel):
    success: bool
    status: str
    error: Optional[str] = None


@router.post("/{connection_id}/test", response_model=TestConnectionResponse)
async def test_my_connection(
    connection_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    """Genuinely authenticates against the real exchange with these
    stored credentials (a real signed balance/ticker call — see
    services/trader_broker_connections.py's own test_connection) and
    persists the result, so VERIFIED on this row actually means
    something rather than just "the form was submitted.\""""
    row = await _get_own_connection(db, user, connection_id)
    result = await test_connection(row)
    row.status = ConnectionStatus.VERIFIED if result["success"] else ConnectionStatus.FAILED
    row.last_verified_at = datetime.utcnow() if result["success"] else row.last_verified_at
    row.last_error = None if result["success"] else result.get("error")
    await db.commit()
    return TestConnectionResponse(success=result["success"], status=row.status.value, error=row.last_error)


# =============================================================================
# Bot subscriptions — "using our bots on their accounts"
# =============================================================================

class AvailableBot(BaseModel):
    bot_id: str
    bot_name: str
    bot_type: str


@router.get("/available-bots", response_model=List[AvailableBot])
async def list_available_bots(db: AsyncSession = Depends(get_db), _user: User = Depends(get_current_user)):
    """Every configured bot a trader could subscribe to copy — this
    platform's own strategy bots, not something a trader creates."""
    rows = (await db.execute(select(BotConfig))).scalars().all()
    return [AvailableBot(bot_id=b.bot_id, bot_name=b.bot_name, bot_type=b.bot_type) for b in rows]


class SubscribeBotRequest(BaseModel):
    bot_id: str
    risk_per_trade: Optional[float] = None


class SubscriptionResponse(BaseModel):
    id: str
    bot_id: str
    connection_id: str
    is_active: bool
    risk_per_trade: Optional[float]


@router.post("/{connection_id}/bots", response_model=SubscriptionResponse)
async def subscribe_bot(
    connection_id: str, req: SubscribeBotRequest,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    connection = await _get_own_connection(db, user, connection_id)
    if connection.mode == ConnectionMode.MANUAL:
        raise HTTPException(status_code=409, detail="This connection is set to manual-only — switch its mode to 'bot' or 'both' first.")
    bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == req.bot_id))).scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot not found")

    existing = (await db.execute(
        select(TraderBotSubscription).where(
            TraderBotSubscription.user_id == user.id, TraderBotSubscription.bot_id == req.bot_id,
        )
    )).scalar_one_or_none()
    if existing:
        existing.connection_id = connection.id
        existing.is_active = True
        existing.risk_per_trade = req.risk_per_trade
        sub = existing
    else:
        sub = TraderBotSubscription(
            user_id=user.id, bot_id=req.bot_id, connection_id=connection.id, risk_per_trade=req.risk_per_trade,
        )
        db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return SubscriptionResponse(id=str(sub.id), bot_id=sub.bot_id, connection_id=str(sub.connection_id), is_active=sub.is_active, risk_per_trade=sub.risk_per_trade)


@router.get("/bots", response_model=List[SubscriptionResponse])
async def list_my_bot_subscriptions(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(TraderBotSubscription).where(TraderBotSubscription.user_id == user.id))).scalars().all()
    return [SubscriptionResponse(id=str(s.id), bot_id=s.bot_id, connection_id=str(s.connection_id), is_active=s.is_active, risk_per_trade=s.risk_per_trade) for s in rows]


@router.delete("/bots/{subscription_id}")
async def unsubscribe_bot(subscription_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = (await db.execute(
        select(TraderBotSubscription).where(TraderBotSubscription.id == subscription_id, TraderBotSubscription.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.delete(row)
    await db.commit()
    return {"success": True, "deleted": subscription_id}


# =============================================================================
# Admin-facing: view + manage EVERY trader's connections platform-wide
# =============================================================================

ADMIN_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


@admin_router.get("", response_model=List[ConnectionResponse])
async def admin_list_connections(db: AsyncSession = Depends(get_db), _admin: User = Depends(require_role(*ADMIN_ROLES))):
    """Every trader's connection, platform-wide — masked key preview
    only, same as the trader-facing list; an admin can see WHO has
    connected WHAT and its status, never the real secret."""
    rows = (await db.execute(select(TraderBrokerConnection))).scalars().all()
    if not rows:
        return []
    user_ids = {r.user_id for r in rows}
    users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    users_by_id = {u.id: u for u in users}
    return [_to_response(c, users_by_id.get(c.user_id)) for c in rows]


class AdminSuspendRequest(BaseModel):
    suspended: bool


@admin_router.patch("/{connection_id}/suspend", response_model=ConnectionResponse)
async def admin_suspend_connection(
    connection_id: str, req: AdminSuspendRequest,
    db: AsyncSession = Depends(get_db), _admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    """Suspends (or un-suspends) a trader's connection platform-wide —
    execution_engine.py's own trader-connection lookup skips a
    SUSPENDED row entirely, the real kill-switch for "this trader's own
    account should stop trading through us" without deleting their
    saved credentials."""
    row = (await db.execute(select(TraderBrokerConnection).where(TraderBrokerConnection.id == connection_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    row.status = ConnectionStatus.SUSPENDED if req.suspended else ConnectionStatus.PENDING
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _to_response(row)


@admin_router.delete("/{connection_id}")
async def admin_delete_connection(
    connection_id: str, db: AsyncSession = Depends(get_db), _admin: User = Depends(require_role(*ADMIN_ROLES)),
):
    row = (await db.execute(select(TraderBrokerConnection).where(TraderBrokerConnection.id == connection_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.delete(row)
    await db.commit()
    return {"success": True, "deleted": connection_id}
