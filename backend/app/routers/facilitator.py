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

import secrets
import time
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.access_gate import require_active_access
from app.core.auth import get_current_user, require_super_admin
from app.database import get_db
from app.models.access import UserAccess
from app.models.facilitator import (
    BookingStatus, ExternalConnector, GoogleCalendarCredential, MeetingBand, MeetingBooking,
)
from app.models.user import User
from app.services import google_calendar
from app.services.facilitator_booking import (
    check_booking_eligibility, compute_calendar_strip, generate_jitsi_room_url,
)
from app.services.fireflies import invite_fireflies_notetaker
from app.services.telegram import channel_for_access

# Band -> (start_hour, end_hour), UTC. Never defined anywhere else in
# the codebase — bands were only ever labels, not clock times — so
# this is a flagged assumption specific to calendar-event creation,
# not a business decision made elsewhere. Adjust here if a real
# schedule is confirmed; nothing else reads this mapping.
BAND_HOURS_UTC = {
    MeetingBand.AM: (9, 11),
    MeetingBand.AFTERNOON: (13, 15),
    MeetingBand.EVENING: (18, 19),
}

# In-memory CSRF state for the OAuth round-trip — fine for a single-
# instance deployment (this Render service runs 1 instance); a nonce
# is used within minutes of being issued, never persisted or needed
# across a restart.
_pending_oauth_states: dict[str, float] = {}
_OAUTH_STATE_TTL_SECONDS = 600

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

    # No separate Fireflies API call happens here (see fireflies.py's
    # own docstring on why) — this just resolves whether a notetaker
    # email is configured; the actual invite happens below, as an
    # attendee on the calendar event itself. fireflies_meeting_id stays
    # unset since there's no real Fireflies-side id to record without
    # a direct API call.
    notetaker = invite_fireflies_notetaker(room_url, req.topic)

    # Best-effort calendar sync — same fail-soft convention as
    # Fireflies above: a booking always succeeds even if this fails or
    # nothing is connected. Routes to the corporate vs individual
    # calendar by the exact same granted_via signal Telegram already
    # uses, rather than inventing a second routing rule.
    access = (await db.execute(
        select(UserAccess).where(UserAccess.user_id == user.id, UserAccess.is_active == True)  # noqa: E712
        .order_by(UserAccess.expires_at.desc()).limit(1)
    )).scalar_one_or_none()
    channel = channel_for_access(access.granted_via if access else "")
    connector_type = f"google_calendar_{channel.value}"
    credential = (await db.execute(
        select(GoogleCalendarCredential).where(GoogleCalendarCredential.connector_type == connector_type)
    )).scalar_one_or_none()
    if credential is not None:
        access_token = await google_calendar.get_valid_access_token(credential)
        if access_token:
            start_h, end_h = BAND_HOURS_UTC[MeetingBand(req.band)]
            start_dt = datetime.combine(day_obj, datetime.min.time(), tzinfo=timezone.utc).replace(hour=start_h)
            end_dt = start_dt.replace(hour=end_h)
            await google_calendar.create_calendar_event(
                access_token, summary=f"Petrazim facilitator session — {req.topic}",
                description=f"Join: {room_url}", start_iso=start_dt.isoformat(), end_iso=end_dt.isoformat(),
                location=room_url,
                # The real Fireflies-notetaker mechanism (see
                # fireflies.py's own docstring) — invited onto THIS
                # calendar event, not a separate API call.
                attendees=[notetaker.notetaker_email] if notetaker.invited and notetaker.notetaker_email else None,
            )
        await db.commit()   # persists get_valid_access_token's refreshed cache either way

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


# --------------------------------------------------------------------------
# Google Calendar OAuth — the connector cards were status-only before
# this; connecting either account now genuinely does something.
# Super-Admin-only to start/stop a connection (same stakes-based
# convention as payments.py's live/test toggle) — this affects every
# trainee's booking flow, not just the admin's own account.
# --------------------------------------------------------------------------

GOOGLE_CONNECTOR_TYPES = ("google_calendar_individual", "google_calendar_corporate")


def _prune_expired_states() -> None:
    now = time.monotonic()
    for k in [k for k, issued in _pending_oauth_states.items() if now - issued > _OAUTH_STATE_TTL_SECONDS]:
        del _pending_oauth_states[k]


@router.get("/connectors/google/{connector_type}/authorize")
async def google_calendar_authorize(connector_type: str, admin: User = Depends(require_super_admin)):
    if connector_type not in GOOGLE_CONNECTOR_TYPES:
        raise HTTPException(status_code=404, detail="Unknown connector")
    if not google_calendar.is_configured(connector_type):
        suffix = "INDIVIDUAL" if connector_type == "google_calendar_individual" else "CORPORATE"
        raise HTTPException(
            status_code=503,
            detail=f"Google Calendar isn't configured for this account yet — set "
                   f"GOOGLE_CALENDAR_CLIENT_ID_{suffix}, GOOGLE_CALENDAR_CLIENT_SECRET_{suffix}, "
                   f"and BACKEND_URL on the backend first.",
        )
    _prune_expired_states()
    nonce = secrets.token_urlsafe(24)
    _pending_oauth_states[nonce] = time.monotonic()
    return {"authorize_url": google_calendar.build_authorize_url(connector_type, nonce)}


@router.get("/connectors/google/callback")
async def google_calendar_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Google redirects the admin's browser here directly — there's no
    JWT on this request, by the nature of an OAuth redirect. `state`
    (issued only from the authorize endpoint above, which IS
    JWT-gated) is what proves this callback corresponds to a login an
    admin actually started, not a forged request."""
    _prune_expired_states()
    try:
        connector_type, nonce = state.split(":", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed state")
    if connector_type not in GOOGLE_CONNECTOR_TYPES or nonce not in _pending_oauth_states:
        raise HTTPException(status_code=400, detail="This connection attempt expired or wasn't recognized — try connecting again.")
    del _pending_oauth_states[nonce]

    tokens = await google_calendar.exchange_code(connector_type, code)
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        # Google only issues a refresh_token on first consent (or with
        # prompt=consent, which build_authorize_url always sets) — if
        # it's still missing here something upstream changed; fail
        # loudly rather than silently saving a connector that can
        # never actually refresh past its first hour.
        raise HTTPException(status_code=502, detail="Google didn't return a refresh token — try disconnecting and reconnecting.")

    now = datetime.now(timezone.utc)
    email = await google_calendar.fetch_connected_email(tokens["access_token"])

    credential = (await db.execute(
        select(GoogleCalendarCredential).where(GoogleCalendarCredential.connector_type == connector_type)
    )).scalar_one_or_none()
    if credential is None:
        credential = GoogleCalendarCredential(connector_type=connector_type)
        db.add(credential)
    credential.refresh_token = refresh_token
    credential.access_token = tokens["access_token"]
    credential.access_token_expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))
    credential.connected_email = email
    credential.scope = tokens.get("scope")
    credential.updated_at = now

    connector = (await db.execute(
        select(ExternalConnector).where(ExternalConnector.connector_type == connector_type)
    )).scalar_one_or_none()
    if connector is None:
        connector = ExternalConnector(connector_type=connector_type)
        db.add(connector)
    connector.is_connected = "true"
    connector.connected_account_label = email
    connector.connected_at = now

    await db.commit()
    return RedirectResponse(url=f"{get_settings().FRONTEND_URL}/meetings?google_connected={connector_type}")


@router.post("/connectors/google/{connector_type}/disconnect")
async def google_calendar_disconnect(
    connector_type: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin),
):
    if connector_type not in GOOGLE_CONNECTOR_TYPES:
        raise HTTPException(status_code=404, detail="Unknown connector")

    credential = (await db.execute(
        select(GoogleCalendarCredential).where(GoogleCalendarCredential.connector_type == connector_type)
    )).scalar_one_or_none()
    if credential is not None:
        await db.delete(credential)

    connector = (await db.execute(
        select(ExternalConnector).where(ExternalConnector.connector_type == connector_type)
    )).scalar_one_or_none()
    if connector is not None:
        connector.is_connected = "false"
        connector.connected_account_label = None
        connector.connected_at = None

    await db.commit()
    return {"ok": True}
