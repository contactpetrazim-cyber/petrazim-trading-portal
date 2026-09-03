"""
Roster Model
===============

Tracks which Traders are managed by which Fund Manager or Partner —
the relationship that makes the Manager/Partner consoles actually do
something, rather than just being a login destination with no data.

One Trader can be managed by at most one Fund Manager/Partner at a
time (assigned_to_user_id is not a list) — a Trader being managed by
two people simultaneously is a real-world coordination problem this
model deliberately doesn't allow; reassignment replaces, not adds.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class RosterAssignment(Base):
    __tablename__ = "roster_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trader_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    assigned_to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
