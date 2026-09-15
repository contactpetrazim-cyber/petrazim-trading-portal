"""
Fee Settlement Payments — the real Paystack-collection half of the
performance-fee system (see models/fee_settings.py's own docstring for
why that system, on its own, only calculates and records what's owed
rather than collecting it).

By direct follow-up request: "introduce a Paystack payment gate that
pays for previous day fees before access to a new day... checks
payment and grants access to bot trading or manual trading or
automated trades." This is that payment record — one row per real
checkout attempt against Paystack (or the same TestPaymentClient the
existing Academy checkout uses in Test mode), separate from the
Academy's own Payment/UserAccess tables since a successful one here
marks PerformanceFeeLedgerEntry rows PAID, not a tier/UserAccess grant.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class FeePaymentStatus(enum.Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, default="paystack")
    provider_reference = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(Enum(FeePaymentStatus), nullable=False, default=FeePaymentStatus.PENDING)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    # JSON list of PerformanceFeeLedgerEntry ids this checkout was
    # started against — a snapshot taken at checkout-creation time, so
    # a fee that accrues AFTER checkout started (a new profitable close
    # while the trader is mid-payment) is correctly left OWED rather
    # than silently swept into a payment that was never charged for it.
    covered_entry_ids = Column(Text, nullable=False, default="[]")
    # Same meaning as Payment.is_test (models/access.py) — true when
    # this ran through TestPaymentClient rather than a real gateway.
    is_test = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)
