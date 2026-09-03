"""
Fireflies Notetaker — auto-invite to booked facilitator sessions
=====================================================================

Fireflies' notetaker joins a meeting by being invited as a participant
— typically by adding its dedicated notetaker email address to the
meeting invite/calendar event, or via Fireflies' API for platforms
they directly support. Jitsi isn't one of Fireflies' natively
integrated platforms (Zoom/Meet/Teams are), so the reliable path is:
add the Fireflies notetaker email to the Jitsi meeting's calendar
invite, same as inviting a human participant.

STUBBED, honestly: this needs your actual Fireflies account's
notetaker email address and API key, neither of which exist yet. The
booking flow works today without this (a session can be booked and
joined via Jitsi right now) — this only adds the automatic
transcription/summary layer on top, and is designed to fail loudly
rather than silently skip the invite if it's not configured.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class NotetakerInviteResult:
    invited: bool
    fireflies_meeting_id: Optional[str] = None
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

    raise NotImplementedError(
        "Wire this to Fireflies' actual API (or calendar-invite-based join, since Jitsi "
        "isn't a natively integrated platform) once FIREFLIES_API_KEY is set. Kept as an "
        "explicit stub rather than faking a meeting ID that would look real but isn't."
    )
