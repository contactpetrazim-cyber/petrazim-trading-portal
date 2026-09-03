"""
Access & Payment Models — recreated exactly from the Phase 2 build for
this turn's dependencies. If you're merging zips, this should be
byte-identical to the one you already have; keep whichever copy you
diff as canonical if they ever drift.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AccessTier(enum.Enum):
    ESSENTIAL = "essential"
    PROFESSIONAL = "professional"
    EXECUTIVE = "executive"


class DurationPassType(enum.Enum):
    ONE_DAY = "one_day"
    HALF_DAY = "half_day"
    AM = "am"
    PM = "pm"
    THREE_HOUR_REFRESH = "three_hour_refresh"
    ONE_MODULE = "one_module"


class CodeType(enum.Enum):
    PROMO = "promo"
    PARTNER_REFERRAL = "partner_referral"
    CORPORATE_SEAT = "corporate_seat"


class PaymentProvider(enum.Enum):
    STRIPE = "stripe"
    PAYSTACK = "paystack"


class PaymentStatus(enum.Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


DURATION_PASS_CATALOGUE = {
    DurationPassType.ONE_DAY: {"label": "One-Day Pass", "hours": 24, "ngn": 50000, "usd": 85, "tier": AccessTier.ESSENTIAL},
    DurationPassType.HALF_DAY: {"label": "Half-Day Pass", "hours": 4, "ngn": 25000, "usd": 45, "tier": AccessTier.ESSENTIAL},
    DurationPassType.AM: {"label": "AM Pass", "hours": 4, "ngn": 15000, "usd": 25, "tier": AccessTier.ESSENTIAL},
    DurationPassType.PM: {"label": "PM Pass", "hours": 4, "ngn": 15000, "usd": 25, "tier": AccessTier.ESSENTIAL},
    DurationPassType.THREE_HOUR_REFRESH: {"label": "3-HR Refresh", "hours": 3, "ngn": 10000, "usd": 10, "tier": AccessTier.ESSENTIAL},
    DurationPassType.ONE_MODULE: {"label": "One Module", "hours": 72, "ngn": 100000, "usd": 25, "tier": AccessTier.ESSENTIAL},
}


class UserAccess(Base):
    __tablename__ = "user_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tier = Column(Enum(AccessTier), nullable=False)
    granted_via = Column(String(50), nullable=False)
    duration_pass_type = Column(Enum(DurationPassType), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class AccessCode(Base):
    __tablename__ = "access_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(32), unique=True, nullable=False, index=True)
    code_type = Column(Enum(CodeType), nullable=False)
    tier_granted = Column(Enum(AccessTier), nullable=False)
    duration_hours = Column(Integer, nullable=False, default=24 * 30)
    issued_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    max_redemptions = Column(Integer, nullable=False, default=1)
    redemption_count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(Enum(PaymentProvider), nullable=False)
    provider_reference = Column(String(255), nullable=True)
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False)
    tier_purchased = Column(Enum(AccessTier), nullable=True)
    duration_pass_type = Column(Enum(DurationPassType), nullable=True)
    seat_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
