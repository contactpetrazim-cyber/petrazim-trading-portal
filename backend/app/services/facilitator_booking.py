"""
Facilitator Booking Service
==============================

Pure availability/capacity logic, kept separate from the router so it
can be tested without a database. The router (facilitator.py) wraps
these functions with real DB queries.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List

CALENDAR_WINDOW_DAYS = 90   # "3-month strip"
BANDS = ["am", "afternoon", "evening"]
MAX_BOOKINGS_PER_DAY = 2


@dataclass
class DayAvailability:
    day: str
    bands_available: List[str]
    bands_booked: List[str]
    at_capacity: bool


def compute_calendar_strip(
    start_day: date, booked_by_day: Dict[str, List[str]], window_days: int = CALENDAR_WINDOW_DAYS
) -> List[DayAvailability]:
    """booked_by_day: {'2026-09-01': ['am', 'evening'], ...} — bands
    already confirmed-booked per day, as ISO date strings. Returns the
    full window, one entry per day, with derived availability.

    Sundays are excluded entirely — facilitators don't run sessions
    that day, so it's dropped from the strip rather than shown as a
    day with zero availability (those are different things: "closed"
    vs. "open but fully booked")."""
    strip: List[DayAvailability] = []
    for offset in range(window_days):
        day = start_day + timedelta(days=offset)
        if day.weekday() == 6:  # Sunday
            continue
        day_str = day.isoformat()
        booked = booked_by_day.get(day_str, [])
        at_capacity = len(booked) >= MAX_BOOKINGS_PER_DAY
        available = [] if at_capacity else [b for b in BANDS if b not in booked]
        strip.append(DayAvailability(day=day_str, bands_available=available, bands_booked=booked, at_capacity=at_capacity))
    return strip


@dataclass
class BookingEligibilityResult:
    eligible: bool
    reason: str = ""


def check_booking_eligibility(
    user_tier: str, day_str: str, band: str, booked_by_day: Dict[str, List[str]]
) -> BookingEligibilityResult:
    """Three independent gates: tier eligibility (Professional/Executive
    only), the day being a working day (no Sunday sessions), and
    capacity (this exact band not already booked AND day not already
    at MAX_BOOKINGS_PER_DAY)."""
    if user_tier not in ("professional", "executive"):
        return BookingEligibilityResult(
            eligible=False,
            reason="Facilitator sessions are available on Professional and Executive tiers.",
        )

    if date.fromisoformat(day_str).weekday() == 6:
        return BookingEligibilityResult(eligible=False, reason="Facilitator sessions don't run on Sundays.")

    booked = booked_by_day.get(day_str, [])
    if band not in BANDS:
        return BookingEligibilityResult(eligible=False, reason=f"Unknown band '{band}'.")
    if band in booked:
        return BookingEligibilityResult(eligible=False, reason="That band is already booked for this day.")
    if len(booked) >= MAX_BOOKINGS_PER_DAY:
        return BookingEligibilityResult(
            eligible=False,
            reason=f"This day has reached its {MAX_BOOKINGS_PER_DAY}-session capacity — try another day.",
        )

    return BookingEligibilityResult(eligible=True)


def generate_jitsi_room_url(day_str: str, band: str) -> str:
    """Ad-hoc Jitsi Meet room — no API key needed for the public
    meet.jit.si instance. Room name includes a random suffix so it's
    unguessable (Jitsi rooms are otherwise joinable by anyone who knows
    the name)."""
    suffix = secrets.token_urlsafe(6).replace("-", "").replace("_", "")
    room_name = f"Petrazim-{day_str.replace('-', '')}-{band}-{suffix}"
    return f"https://meet.jit.si/{room_name}"
