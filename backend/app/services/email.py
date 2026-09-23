"""
Email Service — Resend transport + session confirmations
==========================================================

Sends the scheduled-cycle and standalone-module confirmation emails,
join link first in the body so it works even if portal access expires
— matching the confirmed pattern (Jitsi link as the first line of the
description, ahead of other details, so it's not something a recipient
has to scroll past).

Transport is Resend's HTTPS API (https://resend.com/docs/api-reference/emails/send-email),
selected once a real RESEND_API_KEY was provided. Every caller in this
codebase treats a failed send as non-fatal to whatever real action
triggered it (registration, a trade fill, a password reset request) —
an email provider outage must never block the underlying action it's
just notifying about.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List, Tuple

import httpx

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
# resend.dev is Resend's own shared sending domain — works with zero
# setup (no DNS/domain verification needed) so sending has a safe
# default from day one; swap EMAIL_FROM_ADDRESS once a real
# petrazim.* domain is verified in the Resend dashboard.
DEFAULT_FROM_ADDRESS = "Petrazim <onboarding@resend.dev>"

BAND_TIME_LABEL = {"am": "Morning", "afternoon": "Afternoon", "evening": "Evening"}


@dataclass
class ScheduledSession:
    module_name: str
    session_date: str
    band: str
    jitsi_room_url: str


def build_cycle_confirmation_email(trainee_name: str, sessions: List[ScheduledSession]) -> Tuple[str, str]:
    """Returns (subject, plain-text body). Join links appear first for
    every session — this is what lets a trainee join straight from the
    email even if their portal access has lapsed by the session date."""
    subject = f"Your Petrazim training schedule is confirmed, {trainee_name}"

    lines = [f"Hi {trainee_name},", "",
             "Your facilitator sessions are confirmed. Join links work directly from this "
             "email — no portal login needed on the day.", ""]
    for s in sessions:
        lines.append(f"JOIN THE MEETING: {s.jitsi_room_url}")
        lines.append(f"{s.module_name} — {s.session_date} ({BAND_TIME_LABEL.get(s.band, s.band)})")
        lines.append("")

    lines.append("These links stay valid even if your portal access window closes before the session date.")
    return subject, "\n".join(lines)


def build_standalone_confirmation_email(trainee_name: str, session: ScheduledSession) -> Tuple[str, str]:
    subject = f"Your {session.module_name} session is confirmed"
    body = "\n".join([
        f"JOIN THE MEETING: {session.jitsi_room_url}",
        "",
        f"Hi {trainee_name},",
        f"Your standalone booking for {session.module_name} is confirmed for "
        f"{session.session_date} ({BAND_TIME_LABEL.get(session.band, session.band)}).",
        "This link stays valid even if your portal access window closes before the session date.",
    ])
    return subject, body


def build_registration_confirmation_email(full_name: str) -> Tuple[str, str]:
    subject = "Welcome to Petrazim"
    body = "\n".join([
        f"Hi {full_name},",
        "",
        "Your Petrazim account has been created successfully. You can log in "
        "any time at the portal to view your dashboard, trades and settings.",
        "",
        "If you didn't create this account, you can safely ignore this email.",
    ])
    return subject, body


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Sends via Resend. Returns True/False rather than raising for the
    caller's own convenience (every call site here treats a failed
    send as non-fatal — see this module's own docstring) — an
    exception would force every caller to add its own try/except for
    the exact same "log it, move on" behavior. Logs loudly either way
    so a silently-broken key doesn't go unnoticed."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_address = os.environ.get("EMAIL_FROM_ADDRESS", DEFAULT_FROM_ADDRESS)

    if not api_key:
        logger.warning("email_not_sent reason=no_resend_api_key to=%s subject=%s", to_address, subject)
        return False

    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"from": from_address, "to": [to_address], "subject": subject, "text": body},
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info("email_sent to=%s subject=%s", to_address, subject)
        return True
    except Exception:
        logger.exception("email_send_failed to=%s subject=%s", to_address, subject)
        return False
