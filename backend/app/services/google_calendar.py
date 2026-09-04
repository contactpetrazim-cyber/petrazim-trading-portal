"""
Google Calendar OAuth + API client
=====================================

The actual OAuth call flow the Master Handover flagged as missing:
"Real OAuth credentials exist for both Google accounts (Client ID/
Secret/Refresh Token) but the actual OAuth call flow is NOT built —
only the connection-status UI." This is that flow.

Reads its own env vars directly (see config.py's own comment on why
third-party connector credentials aren't Settings fields):
  GOOGLE_CALENDAR_CLIENT_ID       — OAuth 2.0 Client ID, Web application
  GOOGLE_CALENDAR_CLIENT_SECRET   — its paired secret (this flow needs
                                    one; the login button's GOOGLE_CLIENT_ID
                                    deliberately doesn't, see routers/auth.py)
  BACKEND_URL                     — this API's own public base URL, used
                                    to build the redirect_uri Google calls
                                    back to (must exactly match an
                                    "Authorized redirect URI" registered
                                    on that OAuth client in Google Cloud
                                    Console)

One shared OAuth client connects EITHER Google account (individual or
corporate) — `connector_type` in the authorize URL's `state` param is
how the callback knows which ExternalConnector/GoogleCalendarCredential
row to update; the admin simply logs into whichever Google account
they're connecting when Google's own consent screen appears.

Not built here: token encryption at rest (see GoogleCalendarCredential's
own docstring) and a background refresh sweep (access tokens are
refreshed lazily, on first use after expiry, which is correct but means
the very first calendar call after a long idle period pays the refresh
round-trip).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# calendar.events (not the broader "calendar" scope) — enough to create
# the booking event this app actually needs, nothing wider than that.
SCOPE = "https://www.googleapis.com/auth/calendar.events"


def _client_id() -> str:
    return os.environ.get("GOOGLE_CALENDAR_CLIENT_ID", "")


def _client_secret() -> str:
    return os.environ.get("GOOGLE_CALENDAR_CLIENT_SECRET", "")


def is_configured() -> bool:
    return bool(_client_id() and _client_secret())


def _redirect_uri() -> str:
    backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
    return f"{backend_url}/meetings/connectors/google/callback"


def build_authorize_url(connector_type: str, csrf_token: str) -> str:
    """connector_type + csrf_token are packed into `state` together
    (colon-joined — connector_type is one of two known enum-like
    strings, never contains a colon) so the callback can recover which
    connector this was for AND verify it wasn't forged, from the one
    round-trip param OAuth gives back unchanged."""
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",   # required to get a refresh_token back at all
        "prompt": "consent",        # forces a refresh_token even on a re-connect
        "state": f"{connector_type}:{csrf_token}",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(TOKEN_URL, data={
            "code": code, "client_id": _client_id(), "client_secret": _client_secret(),
            "redirect_uri": _redirect_uri(), "grant_type": "authorization_code",
        })
    res.raise_for_status()
    return res.json()


async def fetch_connected_email(access_token: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if res.status_code != 200:
        return None
    return res.json().get("email")


async def _refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token, "client_id": _client_id(),
            "client_secret": _client_secret(), "grant_type": "refresh_token",
        })
    res.raise_for_status()
    return res.json()


async def get_valid_access_token(credential) -> Optional[str]:
    """credential: a GoogleCalendarCredential row. Refreshes lazily if
    the cached access token is missing or expired (with a 60s safety
    margin), and updates the row's cache in place — caller is
    responsible for committing the session afterward. Returns None
    (never raises) if the refresh itself fails, e.g. the connection was
    revoked on Google's side — calendar sync degrades to "skipped" the
    same way a missing Fireflies key does, not a hard failure."""
    now = datetime.now(timezone.utc)
    if credential.access_token and credential.access_token_expires_at and credential.access_token_expires_at > now + timedelta(seconds=60):
        return credential.access_token

    try:
        tokens = await _refresh_access_token(credential.refresh_token)
    except httpx.HTTPStatusError:
        return None

    credential.access_token = tokens["access_token"]
    credential.access_token_expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))
    return credential.access_token


async def create_calendar_event(
    access_token: str, *, summary: str, description: str, start_iso: str, end_iso: str, location: str = "",
) -> Optional[str]:
    """Creates an event on the connected account's primary calendar.
    Returns the created event's id, or None if the call failed (never
    raises — a calendar-sync failure should never block a booking that
    otherwise succeeded, same fail-soft convention as Fireflies)."""
    body = {
        "summary": summary, "description": description, "location": location,
        "start": {"dateTime": start_iso}, "end": {"dateTime": end_iso},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{CALENDAR_API_BASE}/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"}, json=body,
        )
    if res.status_code not in (200, 201):
        return None
    return res.json().get("id")
