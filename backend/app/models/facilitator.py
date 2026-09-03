"""
Facilitator Meeting Models
=============================

Backs the facilitator calendar: three fixed daily bands (AM/Afternoon/
Evening), a hard cap of 2 bookable sessions per day (facilitator
capacity, not per-trainee), Tier 2/3 gating (Professional/Executive
access tiers only — Essential-tier trainees see an upsell instead of
a booking button), Jitsi Meet for the room itself, and a Fireflies
notetaker auto-invited to every booked session.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class MeetingBand(enum.Enum):
    AM = "am"              # morning
    AFTERNOON = "afternoon"
    EVENING = "evening"


class BookingStatus(enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


MAX_BOOKINGS_PER_DAY = 2   # facilitator capacity — total across all 3 bands, not per-trainee


class MeetingBooking(Base):
    """One row per booked facilitator session. day + band together
    identify the slot; MAX_BOOKINGS_PER_DAY is enforced at the service
    layer (facilitator_booking.py), not by a DB constraint alone, since
    it needs to count existing CONFIRMED bookings for that day, which a
    simple unique constraint can't express."""
    __tablename__ = "meeting_bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trainee_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    facilitator_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # assigned facilitator, if pre-known

    day = Column(Date, nullable=False, index=True)
    band = Column(Enum(MeetingBand), nullable=False)
    topic = Column(Text, nullable=False)

    jitsi_room_url = Column(String(500), nullable=False)
    fireflies_meeting_id = Column(String(255), nullable=True)   # set once the notetaker invite succeeds

    status = Column(Enum(BookingStatus), nullable=False, default=BookingStatus.CONFIRMED)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class ExternalConnector(Base):
    """Connection status for Fireflies and the two Google Calendars
    (individual + corporate) — 'connect cards' in the UI read/write
    this table. Storing only connection STATUS and non-secret metadata
    here; actual OAuth tokens belong in a proper secrets store, not
    this table, once real credentials exist."""
    __tablename__ = "external_connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connector_type = Column(String(50), nullable=False, unique=True)  # 'fireflies', 'google_calendar_individual', 'google_calendar_corporate'
    is_connected = Column(String(10), nullable=False, default="false")  # 'true'/'false' as string — kept simple, not a real boolean enum
    connected_account_label = Column(String(255), nullable=True)   # e.g. the connected email, for display only
    connected_at = Column(DateTime(timezone=True), nullable=True)
