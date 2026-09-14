"""
Idempotency Records
=======================

Dedup ledger backing app/core/idempotency.py's guard — see
migrations/016_idempotency_keys.sql for the full reasoning on why this
exists and which endpoints use it (manual order placement, Role
Administration, and the learning system's XP/completion endpoints).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", "idempotency_key", name="uq_idempotency_user_endpoint_key"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    endpoint = Column(String(100), nullable=False)
    idempotency_key = Column(String(200), nullable=False)
    # NULL while the original request is still being processed —
    # see this table's own migration comment for why that matters.
    response_status = Column(Integer, nullable=True)
    response_body = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
