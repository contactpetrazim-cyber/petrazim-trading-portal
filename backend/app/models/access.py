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
    COMMUNITY = "community"
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
    IVORYPAY = "ivorypay"  # was missing — payments.py's start_checkout already accepts
                            # provider_override="ivorypay" and does PaymentProvider(provider),
                            # which would have raised ValueError on every real IvoryPay checkout


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


# Full-tier subscription pricing — the piece payments.py's start_checkout
# used to 501 on ("isn't in the catalogue yet"). Copied from the real,
# live petrazim.online training portal's own checkout page
# (10m.training.petrazim.online/checkout), per your instruction to match
# it exactly rather than invent numbers.
#
# NGN only, deliberately: that page shows NGN prices for all three paid
# tiers and doesn't display a separate USD figure for any of them
# (unlike DURATION_PASS_CATALOGUE above, whose usd values were filled in
# by an earlier session without a confirmed source — a decision this
# catalogue does NOT repeat; `usd` is None here rather than guessed).
# Community is the one exception: the training portal shows it as an
# explicit "₦1,000 / $2" figure, so it's the only tier with a real usd
# value.
#
# Corporate pricing is a genuinely different shape from individual, not
# just a volume discount: `corporate_ngn_per_seat` (cheaper per person)
# PLUS `corporate_flat_fee` (a flat platform/setup charge), only valid at
# `corporate_min_seats` or more — reproduced from the reference site's
# own corporate pricing structure. Below the minimum, the frontend
# should not allow the corporate rate at all; it collapses to the
# individual per-seat price instead.
#
# duration_hours is None for Community: the reference page describes it
# as ongoing "daily-content group entry," not a fixed expiring window
# like the other three — flag this back to the product owner before
# launch if a specific renewal period was actually intended; nothing
# here should be read as a confirmed number for that one field.
ACCESS_TIER_CATALOGUE = {
    AccessTier.COMMUNITY: {
        "label": "Community Access", "duration_hours": None,
        "individual_ngn": 1000, "individual_usd": 2,
        "corporate_ngn_per_seat": None, "corporate_flat_fee_ngn": None, "corporate_min_seats": None,
        "features": ["Guaranteed community access", "Bonus discount, credits or access on top"],
    },
    AccessTier.ESSENTIAL: {
        "label": "Essential", "duration_hours": 24 * 3,
        "individual_ngn": 150000, "individual_usd": None,
        "corporate_ngn_per_seat": 100000, "corporate_flat_fee_ngn": 200000, "corporate_min_seats": 20,
        "features": ["All 10 pillars, 23 stages each", "Ask Coach, Recap and Listen across every module", "Certification included"],
    },
    AccessTier.PROFESSIONAL: {
        "label": "Professional", "duration_hours": 24 * 7,
        "individual_ngn": 650000, "individual_usd": None,
        "corporate_ngn_per_seat": 400000, "corporate_flat_fee_ngn": 500000, "corporate_min_seats": 10,
        "features": ["Everything in Essential", "Live virtual facilitator sessions", "Certification included"],
    },
    AccessTier.EXECUTIVE: {
        "label": "Executive", "duration_hours": 24 * 30,
        "individual_ngn": 1250000, "individual_usd": None,
        "corporate_ngn_per_seat": 750000, "corporate_flat_fee_ngn": 500000, "corporate_min_seats": 10,
        "features": ["Everything in Professional", "Physical in-person facilitation", "Certification included"],
    },
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
    # True when this checkout ran through TestPaymentClient (Test mode
    # — see routers/payments.py's GET/PATCH /payments/mode) rather than
    # a real gateway. Keeps simulated payments visibly distinct from
    # real ones in this same table, rather than a separate one.
    is_test = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
