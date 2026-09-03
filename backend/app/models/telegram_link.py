"""Recreated exactly from the earlier Telegram integration build."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TelegramChannel(enum.Enum):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"


class TelegramLink(Base):
    __tablename__ = "telegram_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    telegram_user_id = Column(BigInteger, nullable=False, index=True)
    telegram_username = Column(String(255), nullable=True)
    channel = Column(Enum(TelegramChannel), nullable=False)
    invite_link_used = Column(String(255), nullable=True)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
