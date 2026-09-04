"""
Facilitator Meetings Router
==============================

/meetings endpoints backing FacilitatorCalendar.tsx: the 3-month
availability strip, booking, cancellation, and connector status for
Fireflies + both Google Calendars.

Access-gating is deliberately asymmetric here, by direct instruction:
booking a NEW session (POST /book) requires active access — that's the
paid action. Viewing or cancelling a booking already made (GET
/my-bookings, DELETE /{id}) stays on plain get_current_user, gated on
nothing but being logged in, so an existing invite/Jitsi link a trainee
already has stays usable even if their access window has since closed
— access expiring should stop new bookings, not retroactively revoke
one already confirmed.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.core.auth import get_current_user
from app.database import get_db
from app.models.access import UserAccess
from app.models.facilitator import BookingStatus, ExternalConnector, MeetingBand, MeetingBooking
from app.models.user import User
from app.services.facilitator_booking import (
    check_booking_eligibility, compute_calendar_strip, generate_jitsi_room_url,
)
from app.services.fireflies import invite_fireflies_notetaker

router = APIRouter(prefix="/meetings", tags=["facilitator"])


async def _get_user_tier(db: AsyncSession, user_id) -> Optional[str]:
    now = datetime.now(timezone.utc)
    access = (await db.execute(
        select(UserAccess).where(
            UserAccess.user_id == user_id, UserAccess.is_active == True,  # noqa: E712
            UserAccess.expires_at > now,
        )
    )).scalar_one_or_none()
    return access.tier.value if access else None


async def _booked_by_day(db: AsyncSession, start: date, window_days: int) -> dict:
    from datetime import timedelta
    end = start + timedelta(days=window_days)
    rows = (await db.execute(
        select(MeetingBooking).where(
            MeetingBooking.day >= start, MeetingBooking.day < end,
            MeetingBooking.status == BookingStatus.CONFIRMED,
        )
    )).scalars().all()
    result: dict = {}
    for r in rows:
        result.setdefault(r.day.isoformat(), []).append(r.band.value)
    return result


class DayAvailabilityResponse(BaseModel):
    day: str
    bands_available: List[str]
    bands_booked: List[str]
    at_capacity: bool


@router.get("/availability", response_model=List[DayAvailabilityResponse])
async def get_availability(start: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    start_day = date.fromisoformat(start) if start else date.today()
    booked = await _booked_by_day(db, start_day, 90)
    strip = compute_calendar_strip(start_day, booked, window_days=90)
    return [
        DayAvailabilityResponse(day=d.day, bands_available=d.bands_available,
                                 bands_booked=d.bands_booked, at_capacity=d.at_capacity)
        for d in strip
    ]


class BookRequest(BaseModel):
    day: str
    band: str
    topic: str


class BookResponse(BaseModel):
    booking_id: str
    jitsi_room_url: str
    fireflies_status: str


@router.post("/book", response_model=BookResponse)
async def book_session(
    req: BookRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    tier = await _get_user_tier(db, user.id)
    if tier is None:
        raise HTTPException(status_code=403, detail="No active access tier — cannot book a facilitator session.")

    day_obj = date.fromisoformat(req.day)
    booked = await _booked_by_day(db, day_obj, 1)

    eligibility = check_booking_eligibility(tier, req.day, req.band, booked)
    if not eligibility.eligible:
        raise HTTPException(status_code=409, detail=eligibility.reason)

    room_url = generate_jitsi_room_url(req.day, req.band)

    booking = MeetingBooking(
        trainee_user_id=user.id, day=day_obj, band=MeetingBand(req.band),
        topic=req.topic, jitsi_room_url=room_url, status=BookingStatus.CONFIRMED,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    notetaker = invite_fireflies_notetaker(room_url, req.topic)
    if notetaker.invited:
        booking.fireflies_meeting_id = notetaker.fireflies_meeting_id
        await db.commit()

    return BookResponse(
        booking_id=str(booking.id), jitsi_room_url=room_url,
        fireflies_status=("connected" if notetaker.invited else "not_configured"),
    )


class MyBookingResponse(BaseModel):
    id: str
    day: str
    band: str
    topic: str
    jitsi_room_url: str
    status: str


@router.get("/my-bookings", response_model=List[MyBookingResponse])
async def my_bookings(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(MeetingBooking).where(MeetingBooking.trainee_user_id == user.id).order_by(MeetingBooking.day)
    )).scalars().all()
    return [
        MyBookingResponse(id=str(r.id), day=r.day.isoformat(), band=r.band.value,
                           topic=r.topic, jitsi_room_url=r.jitsi_room_url, status=r.status.value)
        for r in rows
    ]


@router.delete("/{booking_id}")
async def cancel_booking(booking_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = (await db.execute(
        select(MeetingBooking).where(MeetingBooking.id == booking_id, MeetingBooking.trainee_user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    row.status = BookingStatus.CANCELLED
    await db.commit()
    return {"ok": True}


class ConnectorStatusResponse(BaseModel):
    connector_type: str
    is_connected: bool
    connected_account_label: Optional[str]


@router.get("/connectors", response_model=List[ConnectorStatusResponse])
async def list_connectors(db: AsyncSession = Depends(get_db)):
    expected = ["fireflies", "google_calendar_individual", "google_calendar_corporate"]
    rows = (await db.execute(select(ExternalConnector))).scalars().all()
    by_type = {r.connector_type: r for r in rows}

    out = []
    for t in expected:
        r = by_type.get(t)
        out.append(ConnectorStatusResponse(
            connector_type=t,
            is_connected=(r.is_connected == "true") if r else False,
            connected_account_label=r.connected_account_label if r else None,
        ))
    return out
