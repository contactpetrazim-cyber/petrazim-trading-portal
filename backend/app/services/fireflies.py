"""
Fireflies Notetaker — auto-invite to booked facilitator sessions
=====================================================================

Fireflies' notetaker joins a meeting by being invited as a participant
— typically by adding its dedicated notetaker email address to the
meeting invite/calendar event, or via Fireflies' API for platforms
they directly support. Jitsi isn't one of Fireflies' natively
integrated platforms (Zoom/Meet/Teams are), so the reliable path is:
add the Fireflies notetaker email to the Jitsi meeting's calendar
invite, same as inviting a human participant — routers/facilitator.py
does exactly that, passing this function's returned notetaker_email
into google_calendar.create_calendar_event()'s attendees list. This
module makes no direct call to Fireflies' own API at all: there's
nothing Fireflies-side to call for a platform it doesn't natively
join, and Fireflies auto-joins any meeting its notetaker email is
invited to on a connected calendar, no separate API request needed.

Config: FIREFLIES_API_KEY / FIREFLIES_NOTETAKER_EMAIL. The API key
isn't actually used by the calendar-invite path above — it's kept as
a required config value anyway (not just the email) so "Fireflies not
connected" reads as a deliberate, verified state (both values present)
rather than one stray env var away from silently mis-configuring
whose notetaker gets invited.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class NotetakerInviteResult:
    invited: bool
    notetaker_email: Optional[str] = None
    reason: str = ""


def invite_fireflies_notetaker(jitsi_room_url: str, meeting_title: str) -> NotetakerInviteResult:
    api_key = os.environ.get("FIREFLIES_API_KEY", "")
    notetaker_email = os.environ.get("FIREFLIES_NOTETAKER_EMAIL", "")

    if not api_key or not notetaker_email:
        return NotetakerInviteResult(
            invited=False,
            reason=(
                "FIREFLIES_API_KEY / FIREFLIES_NOTETAKER_EMAIL not set — the booking "
                "still succeeds and the Jitsi room still works, it just won't have an "
                "automatic transcript until these are configured."
            ),
        )

    return NotetakerInviteResult(invited=True, notetaker_email=notetaker_email)
