"""
Broadcast Send Log
=====================

One row per actual Telegram dispatch (daily tip or weekly quiz) —
backs the Admin console's real "Daily sends" counter (adapted from the
reference training portal's Platform Overview panel). Before this,
community_broadcast.py's trigger endpoints fired-and-forgot with
nothing recording that a send happened, so there was no honest number
to show here; a real count needs a real row per send, not a guess.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BroadcastLog(Base):
    __tablename__ = "broadcast_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind = Column(String(50), nullable=False)  # 'daily_tip' | 'weekly_quiz'
    sent_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
