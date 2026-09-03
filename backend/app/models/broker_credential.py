"""
Per-bot broker credentials — one row per (bot, exchange, sub-account),
so each of your 5 bots (or each exchange sub-account) can trade under
its own API key/secret instead of one key shared globally across every
bot on that exchange. api_key/api_secret are stored ENCRYPTED (see
app/services/broker_credentials.py) — never plaintext, since this table
is exactly the kind of thing a stray SQL dump or log line must not leak.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BotBrokerCredential(Base):
    __tablename__ = "bot_broker_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(String(50), ForeignKey("bot_configs.bot_id"), nullable=False, index=True)
    exchange = Column(String(20), nullable=False)  # "bingx" | "binance" | "bybit" | "mexc" | "tradelocker"

    # A human label for which of your 4-6 sub-accounts this is —
    # purely for your own identification, never sent to the exchange.
    sub_account_label = Column(String(100), nullable=True)

    # Fernet tokens (encrypted), not plaintext.
    api_key_encrypted = Column(String, nullable=False)
    api_secret_encrypted = Column(String, nullable=False)
    account_id_encrypted = Column(String, nullable=True)  # TradeLocker only

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
