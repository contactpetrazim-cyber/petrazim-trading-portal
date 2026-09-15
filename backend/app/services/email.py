"""
Email Service — session confirmations
=========================================

Sends the scheduled-cycle and standalone-module confirmation emails,
join link first in the body so it works even if portal access expires
— matching the confirmed pattern (Jitsi link as the first line of the
description, ahead of other details, so it's not something a recipient
has to scroll past).

STUBBED: needs a real email provider (SMTP relay, SendGrid, Postmark,
etc.) and credentials, neither of which exist yet. Structured so the
actual send call is the only thing to fill in once a provider is
chosen — the message content/formatting below is real and final.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Tuple

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


def build_trader_invite_email(
    trader_name: str, email: str, temporary_password: str, login_url: str,
) -> Tuple[str, str]:
    """The invite a new Trader gets from routers/roster.py's own
    POST /roster/invite — by direct request ("summarise step by step
    and integrate into the email or invite that goes to the new user
    or trader"). Steps 2+ mirror ConnectExchangePage.tsx's own current
    state exactly: "Add Exchange" now lives inside the Settings
    slide-over (SettingsPanel.tsx), not its own sidebar entry — keep
    this in sync if that page moves again. Login credentials appear
    FIRST, same "the thing they actually need, ahead of everything
    else" ordering as the facilitator confirmation emails above put
    their join link first."""
    subject = f"You're invited to Petrazim — your trading account is ready, {trader_name}"

    lines = [
        f"LOG IN: {login_url}",
        f"Email: {email}",
        f"Temporary password: {temporary_password}",
        "",
        f"Hi {trader_name},",
        "",
        "You've been added to the Petrazim trading portal. Here's how to get set up:",
        "",
        "1. Log in with the link and temporary password above, and set your own "
        "password from Settings once you're in.",
        "",
        "2. (Optional) Connect your own exchange account, so trades you place — or "
        "a bot you subscribe to — execute on YOUR account instead of a shared pool. "
        "Open the gear/Settings icon and choose \"Add Exchange.\"",
        "",
        "3. Pick your exchange (BingX, Binance, Bybit, MEXC, TradeLocker, or MT4/5 "
        "via MetaApi) and fill in the connect form. You'll need an API key/secret "
        "from that exchange, scoped to trading only with WITHDRAWALS DISABLED — "
        "never your exchange password itself. The form shows this platform's real "
        "outbound IP to whitelist on that key.",
        "",
        "4. Click \"Test connection\" — a real, harmless check (reads your balance) "
        "to confirm the key works before it's relied on.",
        "",
        "5. Choose Manual, Bot, or Both for how that connection may be used, and "
        "optionally subscribe one of our bots with Auto (executes immediately) or "
        "Manual (you approve each trade yourself) copy mode.",
        "",
        "That's the whole setup — a few minutes, entirely self-service. Reach out to "
        "whoever invited you if you have any questions.",
    ]
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


def send_email(to_address: str, subject: str, body: str) -> None:
    provider_key = os.environ.get("EMAIL_PROVIDER_API_KEY", "")
    from_address = os.environ.get("EMAIL_FROM_ADDRESS", "")

    if not provider_key or not from_address:
        raise RuntimeError(
            "EMAIL_PROVIDER_API_KEY / EMAIL_FROM_ADDRESS not set — no email provider "
            "configured yet. Session booking still succeeds without this; the "
            "confirmation email just won't send until a provider is wired in."
        )

    raise NotImplementedError(
        "Wire this to your chosen provider's send call (SendGrid/Postmark/SES/SMTP) "
        "once EMAIL_PROVIDER_API_KEY is set. Subject/body content above is final — "
        "only the transport call itself is stubbed."
    )
