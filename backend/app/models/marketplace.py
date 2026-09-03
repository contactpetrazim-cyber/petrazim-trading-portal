"""
Strategy Marketplace — Explore Concept #6
=============================================

A bot that passes the go-live validation gate (Phase 3/4) earns a
"Gate-Approved" badge — this module turns that badge into a
licensable product. A Fund Manager, Partner, or the platform itself
can list an approved strategy; other traders license it for a period,
same billing shape as the duration-pass/access-tier system already
built (reuses AccessCode-style expiry, not a new payment concept).

DELIBERATELY NOT INCLUDED: actual strategy CODE distribution. Licensing
here grants ACCESS to run a strategy on the platform's own
infrastructure (i.e., "turn this bot on for my account"), not a code
export — exporting real trading logic to a licensee is an IP decision
with legal implications beyond what a data model should decide.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ListingStatus(enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"       # e.g. gate re-evaluation failed after a strategy change
    RETIRED = "retired"


class StrategyListing(Base):
    __tablename__ = "strategy_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(String(50), nullable=False)          # which internal bot this lists
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    listed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Snapshot of the validation gate result at listing time — NOT a
    # live pointer, because a strategy that later fails re-validation
    # shouldn't silently invalidate this historical record; instead,
    # is_gate_approved gets flipped to False by a re-check job.
    is_gate_approved = Column(Boolean, nullable=False, default=False)
    gate_snapshot_summary = Column(Text, nullable=True)   # human-readable summary of the gate report

    monthly_price_usd = Column(Float, nullable=False)
    status = Column(Enum(ListingStatus), nullable=False, default=ListingStatus.DRAFT)

    total_licenses_sold = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class StrategyLicense(Base):
    """One row per trader who's licensed a listed strategy."""
    __tablename__ = "strategy_licenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("strategy_listings.id"), nullable=False)
    licensee_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    starts_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


def can_list_strategy(gate_overall_pass: bool) -> tuple[bool, str]:
    """A strategy can only be listed if it currently passes the go-live
    validation gate — the marketplace's entire value proposition is
    that a listed strategy has been through real scrutiny, not just
    that someone claims it works."""
    if not gate_overall_pass:
        return False, (
            "This bot has not passed the go-live validation gate. Listing an "
            "unvalidated strategy would undermine the one thing that makes "
            "'Gate-Approved' mean anything."
        )
    return True, "Eligible for listing."
