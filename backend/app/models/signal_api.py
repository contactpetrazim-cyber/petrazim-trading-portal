"""
Signal Confidence API — Explore Concept #8
==============================================

Exposes the platform's own MTF-alignment/coach confidence scoring as a
metered, pay-per-call (or subscription) API other tools/bots can call
— monetizing the existing scoring logic as a standalone product rather
than keeping it locked inside the dashboard.

This module is the metering/auth layer: API key issuance, per-call
usage logging, and rate/quota enforcement. The actual confidence score
computation is assumed to already exist in the platform's MTF
alignment engine (Phase 1 base build) — this wraps that, it doesn't
reimplement it.
"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ApiKey(Base):
    __tablename__ = "signal_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key_prefix = Column(String(12), nullable=False)   # shown in UI, e.g. "pzk_live_a1b2"
    key_hash = Column(String(255), nullable=False)    # never store the raw key
    is_active = Column(Boolean, nullable=False, default=True)

    monthly_quota = Column(Integer, nullable=False, default=1000)
    calls_this_period = Column(Integer, nullable=False, default=0)
    period_started_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


@dataclass
class GeneratedApiKey:
    raw_key: str          # shown to the user ONCE at generation, never again
    key_prefix: str
    key_hash: str


def generate_api_key() -> GeneratedApiKey:
    import hashlib
    raw = f"pzk_live_{secrets.token_urlsafe(32)}"
    prefix = raw[:16]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return GeneratedApiKey(raw_key=raw, key_prefix=prefix, key_hash=key_hash)


def hash_key(raw_key: str) -> str:
    import hashlib
    return hashlib.sha256(raw_key.encode()).hexdigest()


@dataclass
class QuotaCheckResult:
    allowed: bool
    remaining: int
    reason: Optional[str] = None


def check_quota(api_key: ApiKey, now: Optional[datetime] = None) -> QuotaCheckResult:
    """Call before serving a request; call record_usage() after a
    successful response. Kept as two separate steps (rather than one
    atomic check-and-increment) so a failed downstream call doesn't
    consume quota — the caller decides when a call actually 'counted'."""
    now = now or datetime.now(timezone.utc)

    period_elapsed = now - api_key.period_started_at
    if period_elapsed >= timedelta(days=30):
        # Period rolled over — caller should reset calls_this_period and
        # period_started_at in the same transaction as this check.
        return QuotaCheckResult(allowed=True, remaining=api_key.monthly_quota)

    if not api_key.is_active:
        return QuotaCheckResult(allowed=False, remaining=0, reason="API key is deactivated")

    remaining = api_key.monthly_quota - api_key.calls_this_period
    if remaining <= 0:
        return QuotaCheckResult(allowed=False, remaining=0, reason="Monthly quota exhausted")

    return QuotaCheckResult(allowed=True, remaining=remaining)
