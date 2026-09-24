"""
Trader Broker Connections — a TRADER's own exchange account, connected
to this platform so trades genuinely execute there (manually, through
one of our bots, or both), instead of on the platform's own pooled
accounts. Deliberately a SEPARATE model from BotBrokerCredential (one
of your 4-6 internal bot sub-accounts): a trader's own account isn't a
bot, and BotBrokerCredential.bot_id has a real FOREIGN KEY into
bot_configs — it can't represent a trader's identity at all, only an
actual configured trading bot. Same encryption approach as that table
(Fernet, via encrypt_secret/decrypt_secret in
services/trader_broker_connections.py, which reuses the exact same
helpers broker_credentials.py already defines rather than a second
implementation) — api_key/api_secret/account_id stored ENCRYPTED,
never plaintext.

By direct request ("guess they can give us an API for the selected
account....we give them our IP tonadd to their exchange ... So create
an onboarding page or system ... trade manually and using our bots on
their accounts in select exchanges"). See routers/trader_broker_connections.py
for the trader-facing connect/list/test/delete endpoints and the
admin-facing management ones, and TraderBotSubscription (same file)
for opting specific bots into copying their signals onto a connection.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ConnectionMode(enum.Enum):
    MANUAL = "manual"  # trader places their own orders through our UI; they land on THIS connection's exchange
    BOT = "bot"  # only bots this trader subscribes to (TraderBotSubscription) copy their signals here
    BOTH = "both"


class ConnectionStatus(enum.Enum):
    PENDING = "pending"  # saved, never successfully tested
    VERIFIED = "verified"  # test_connection has authenticated against the real exchange at least once
    FAILED = "failed"  # last test_connection attempt failed — see last_error
    SUSPENDED = "suspended"  # admin-disabled; execution_engine.py skips a suspended connection entirely


class SubscriptionCopyMode(enum.Enum):
    """The "Auto Vs Manual - on Vs off toggle to operate" a trader gets
    per bot subscription, by direct follow-up request — see
    execution_engine.py's own _fan_out_to_subscribers for where this is
    actually read.
      AUTO   — a fresh signal from this bot executes on the trader's
               connection immediately, no approval step, same as a
               fully_autonomous platform bot.
      MANUAL — a fresh signal drafts a PENDING, requires_approval trade
               owned by the trader instead — it shows up on THEIR OWN
               pending-approvals, and they approve it themselves
               through the exact same human-in-the-loop flow a
               platform bot signal already uses."""
    AUTO = "auto"
    MANUAL = "manual"


class TraderBrokerConnection(Base):
    __tablename__ = "trader_broker_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    exchange = Column(String(20), nullable=False)  # "bingx" | "binance" | "bybit" | "mexc" | "tradelocker" | "metatrader" | "oanda"

    # A trader's own label for which real account this is — never sent
    # to the exchange, purely their own identification (mirrors
    # BotBrokerCredential.sub_account_label).
    label = Column(String(100), nullable=True)

    # Fernet tokens (encrypted), never plaintext — see this module's
    # own docstring. account_id_encrypted covers TradeLocker's
    # accountId and MetaApi's accountId (api_key_encrypted carries the
    # MetaApi auth TOKEN in that case — MetaApiBroker's own
    # constructor shape, not a real api_key/api_secret pair;
    # api_secret_encrypted stays unused/empty for that one exchange).
    api_key_encrypted = Column(String, nullable=False)
    api_secret_encrypted = Column(String, nullable=True)
    account_id_encrypted = Column(String, nullable=True)

    mode = Column(Enum(ConnectionMode), nullable=False, default=ConnectionMode.MANUAL)
    status = Column(Enum(ConnectionStatus), nullable=False, default=ConnectionStatus.PENDING)
    last_verified_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)

    # Trader or admin can disable without deleting (keeps the row, and
    # any TraderBotSubscription rows pointing at it, around) — a
    # suspended/inactive connection is skipped by execution_engine.py's
    # own trader-connection lookup exactly like a credential-less bot
    # falls through to the next option in the chain.
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # MetaApi (MT4/MT5) only — everything below is a no-op for the other
    # 5 exchanges, whose accounts have no deploy/undeploy concept and
    # bill nothing while idle. By direct request ("$9/month is high and
    # a waste of not used ... develop an auto engine that auto-undeploys
    # when not in use"): MetaApi bills for hosting time WHILE DEPLOYED,
    # not per API call, so leaving an account deployed 24/7 to cover a
    # trader's actual ~8 hours/day of real use wastes roughly two-thirds
    # of that cost. See services/metaapi_lifecycle.py for the background
    # sweep that reads these two fields.
    last_activity_at = Column(DateTime, nullable=True)
    # Minutes of no activity before the sweep auto-undeploys this
    # connection; NULL disables auto-undeploy for it entirely (a trader
    # who wants it always-on can opt out). Defaults to 30 for a NEW
    # metatrader connection (see routers/trader_broker_connections.py's
    # own connect_exchange) — deliberately not a platform-wide constant,
    # since one trader's "actually needed" cadence differs from
    # another's.
    auto_undeploy_minutes = Column(Integer, nullable=True)


class TraderBotSubscription(Base):
    """
    A trader opting ONE of this platform's bots into copying its
    signals onto one of their own TraderBrokerConnection accounts — the
    "using our bots on their accounts" half of the same direct request.
    `risk_per_trade` overrides the trader's own ManualTradingSettings
    risk-per-trade JUST for this bot's copied trades when set (None
    falls back to their normal manual settings — same effective_limits()
    resolution manual_trading.py already uses, not a second formula).

    Honest scope: this table is the real, working subscription/consent
    record (create one, see it, remove it) — a trader's actual list of
    "which bots may trade my account" is genuinely persisted and
    enforced wherever it's checked. A fresh bot signal IS now fanned
    out to every active subscriber (execution_engine.py's own
    process_signal calls _fan_out_to_subscribers right after persisting
    the platform's own trade) — each subscriber gets their own separate
    Trade row on their own connection, executed or drafted-for-approval
    according to `copy_mode` below. A subsequent close/SL-TP-update
    alert for the same bot+symbol needs no separate fan-out of its own:
    webhook_processor.py's _handle_management_action already matches
    every ACTIVE trade by (bot_id, symbol) regardless of owner, so it
    naturally closes/updates every subscriber's copy alongside the
    platform's own trade.
    """
    __tablename__ = "trader_bot_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    bot_id = Column(String(50), ForeignKey("bot_configs.bot_id"), nullable=False, index=True)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("trader_broker_connections.id"), nullable=False, index=True)

    is_active = Column(Boolean, nullable=False, default=True)
    risk_per_trade = Column(Float, nullable=True)
    # Defaults to MANUAL — the safer default for real trader money;
    # a trader explicitly opts into AUTO themselves (see
    # routers/trader_broker_connections.py's own subscribe_bot).
    copy_mode = Column(Enum(SubscriptionCopyMode), nullable=False, default=SubscriptionCopyMode.MANUAL)

    created_at = Column(DateTime, default=datetime.utcnow)
