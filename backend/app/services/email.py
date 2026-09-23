"""
Email Service — Resend transport + branded HTML templates
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

Every email is now HTML-first with the Petrazim logo in its header, by
direct request ("ensure the Petrazim logo is in all emails") — plain
text is still sent alongside as Resend's `text` fallback (some clients
strip images/HTML, and it's the same content either way). The logo is
served from the frontend's own public/ folder (same static-file pattern
tv-widget-embed.html already uses) rather than embedded/attached, so
every email references one canonical, always-current image instead of
a copy baked in per send.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
# resend.dev is Resend's own shared sending domain — works with zero
# setup (no DNS/domain verification needed) so sending has a safe
# default from day one; swap EMAIL_FROM_ADDRESS once a real
# petrazim.* domain is verified in the Resend dashboard.
DEFAULT_FROM_ADDRESS = "Petrazim <onboarding@resend.dev>"

# The production frontend domain (Vercel, verified — see
# list_project_domains for prj_HegRHZUoUOpDhBisjVywBOWo3kqJ). Overridable
# via EMAIL_LOGO_URL for a staging/preview build without editing code.
DEFAULT_LOGO_URL = "https://trade.petrazim.online/petrazim-logo.jpg"

BAND_TIME_LABEL = {"am": "Morning", "afternoon": "Afternoon", "evening": "Evening"}


def _logo_url() -> str:
    return os.environ.get("EMAIL_LOGO_URL", DEFAULT_LOGO_URL)


def render_html_email(preheader: str, body_html: str, cta: Optional[Tuple[str, str]] = None) -> str:
    """Wraps any email body in the shared Petrazim branded frame — logo
    header, white card, grey footer. `body_html` is the caller's own
    already-escaped/trusted markup (every call site here builds it from
    static copy plus plain names/dates, never raw user HTML). `cta`, if
    given, is (label, url) for a single prominent button under the body
    — used for join links / login links."""
    cta_html = ""
    if cta:
        label, url = cta
        cta_html = f"""
        <tr><td style="padding:0 32px 8px;" align="center">
          <a href="{url}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;
            font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">{label}</a>
        </td></tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f7;padding:24px 12px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;max-width:480px;width:100%;">
        <tr><td style="background:#0b1220;padding:24px 32px;text-align:center;">
          <img src="{_logo_url()}" alt="Petrazim Solutions Ltd" width="220"
            style="display:block;margin:0 auto;max-width:220px;height:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:32px 32px 16px;color:#111827;font-size:14px;line-height:1.6;">
          {body_html}
        </td></tr>
        {cta_html}
        <tr><td style="padding:24px 32px 20px;"></td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:11px;">
          Petrazim Solutions Ltd &middot; This is an automated message from the Petrazim Trading Portal.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


@dataclass
class ScheduledSession:
    module_name: str
    session_date: str
    band: str
    jitsi_room_url: str


def build_cycle_confirmation_email(trainee_name: str, sessions: List[ScheduledSession]) -> Tuple[str, str, str]:
    """Returns (subject, plain-text body, html body). Join links appear
    first for every session — this is what lets a trainee join straight
    from the email even if their portal access has lapsed by the
    session date."""
    subject = f"Your Petrazim training schedule is confirmed, {trainee_name}"

    lines = [f"Hi {trainee_name},", "",
             "Your facilitator sessions are confirmed. Join links work directly from this "
             "email — no portal login needed on the day.", ""]
    rows_html = []
    for s in sessions:
        lines.append(f"JOIN THE MEETING: {s.jitsi_room_url}")
        lines.append(f"{s.module_name} — {s.session_date} ({BAND_TIME_LABEL.get(s.band, s.band)})")
        lines.append("")
        rows_html.append(f"""
          <div style="margin:16px 0;padding:16px;background:#f4f4f7;border-radius:8px;">
            <a href="{s.jitsi_room_url}" style="display:inline-block;background:#0b1220;color:#ffffff;
              text-decoration:none;font-weight:bold;font-size:13px;padding:10px 20px;border-radius:6px;margin-bottom:8px;">
              Join the meeting</a>
            <p style="margin:10px 0 0;font-size:13px;color:#374151;">
              <strong>{s.module_name}</strong> &mdash; {s.session_date} ({BAND_TIME_LABEL.get(s.band, s.band)})
            </p>
          </div>""")

    lines.append("These links stay valid even if your portal access window closes before the session date.")

    body_html = (
        f"<p>Hi {trainee_name},</p>"
        "<p>Your facilitator sessions are confirmed. Join links work directly from this email "
        "&mdash; no portal login needed on the day.</p>"
        + "".join(rows_html)
        + "<p style=\"font-size:12px;color:#6b7280;\">These links stay valid even if your portal "
          "access window closes before the session date.</p>"
    )
    html = render_html_email(preheader=f"Your Petrazim training schedule is confirmed, {trainee_name}", body_html=body_html)
    return subject, "\n".join(lines), html


def build_standalone_confirmation_email(trainee_name: str, session: ScheduledSession) -> Tuple[str, str, str]:
    subject = f"Your {session.module_name} session is confirmed"
    body = "\n".join([
        f"JOIN THE MEETING: {session.jitsi_room_url}",
        "",
        f"Hi {trainee_name},",
        f"Your standalone booking for {session.module_name} is confirmed for "
        f"{session.session_date} ({BAND_TIME_LABEL.get(session.band, session.band)}).",
        "This link stays valid even if your portal access window closes before the session date.",
    ])
    band_label = BAND_TIME_LABEL.get(session.band, session.band)
    body_html = (
        f"<p>Hi {trainee_name},</p>"
        f"<p>Your standalone booking for <strong>{session.module_name}</strong> is confirmed for "
        f"{session.session_date} ({band_label}).</p>"
        "<p style=\"font-size:12px;color:#6b7280;\">This link stays valid even if your portal "
        "access window closes before the session date.</p>"
    )
    html = render_html_email(
        preheader=subject, body_html=body_html,
        cta=("Join the meeting", session.jitsi_room_url),
    )
    return subject, body, html


def build_registration_confirmation_email(full_name: str) -> Tuple[str, str, str]:
    subject = "Welcome to Petrazim"
    body = "\n".join([
        f"Hi {full_name},",
        "",
        "Your Petrazim account has been created successfully. You can log in "
        "any time at the portal to view your dashboard, trades and settings.",
        "",
        "If you didn't create this account, you can safely ignore this email.",
    ])
    body_html = (
        f"<p>Hi {full_name},</p>"
        "<p>Your Petrazim account has been created successfully. You can log in any time "
        "at the portal to view your dashboard, trades and settings.</p>"
        "<p style=\"font-size:12px;color:#6b7280;\">If you didn't create this account, "
        "you can safely ignore this email.</p>"
    )
    html = render_html_email(
        preheader="Your Petrazim account is ready", body_html=body_html,
        cta=("Log in to Petrazim", "https://trade.petrazim.online/login"),
    )
    return subject, body, html


def send_email(to_address: str, subject: str, text_body: str, html_body: Optional[str] = None) -> bool:
    """Sends via Resend. Returns True/False rather than raising for the
    caller's own convenience (every call site here treats a failed
    send as non-fatal — see this module's own docstring) — an
    exception would force every caller to add its own try/except for
    the exact same "log it, move on" behavior. Logs loudly either way
    so a silently-broken key doesn't go unnoticed.

    `html_body` is optional so this still works for a plain-text-only
    caller, but every builder in this module now supplies one (with
    the logo) — pass it through whenever you have it."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_address = os.environ.get("EMAIL_FROM_ADDRESS", DEFAULT_FROM_ADDRESS)

    if not api_key:
        logger.warning("email_not_sent reason=no_resend_api_key to=%s subject=%s", to_address, subject)
        return False

    payload = {"from": from_address, "to": [to_address], "subject": subject, "text": text_body}
    if html_body:
        payload["html"] = html_body

    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.info("email_sent to=%s subject=%s", to_address, subject)
        return True
    except Exception:
        logger.exception("email_send_failed to=%s subject=%s", to_address, subject)
        return False
