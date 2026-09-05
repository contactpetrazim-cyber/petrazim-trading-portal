"""
Google Calendar OAuth + API client
=====================================

The actual OAuth call flow the Master Handover flagged as missing:
"Real OAuth credentials exist for both Google accounts (Client ID/
Secret/Refresh Token) but the actual OAuth call flow is NOT built —
only the connection-status UI." This is that flow.

The two Google accounts (petrazim.solutions@gmail.com / individual,
contact.petrazim@gmail.com / corporate) each have their OWN registered
OAuth client — not one shared client used to connect either account,
which was this file's first draft. Reads its own env vars directly
(see config.py's own comment on why third-party connector credentials
aren't Settings fields):
  GOOGLE_CALENDAR_CLIENT_ID_INDIVIDUAL / _SECRET_INDIVIDUAL
  GOOGLE_CALENDAR_CLIENT_ID_CORPORATE  / _SECRET_CORPORATE
  BACKEND_URL — this API's own public base URL, used to build the
                redirect_uri Google calls back to (must exactly match
                an "Authorized redirect URI" registered on BOTH OAuth
                clients in Google Cloud Console — the callback route
                itself is one shared URL regardless of which client
                sent the user there)

Not built here: token encryption at rest (see GoogleCalendarCredential's
own docstring) and a background refresh sweep (access tokens are
refreshed lazily, on first use after expiry, which is correct but means
the very first calendar call after a long idle period pays the refresh
round-trip).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlencode

import httpx

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# calendar.events (not the broader "calendar" scope) — enough to create
# the booking event this app actually needs, nothing wider than that.
SCOPE = "https://www.googleapis.com/auth/calendar.events"

_ENV_SUFFIX = {
    "google_calendar_individual": "INDIVIDUAL",
    "google_calendar_corporate": "CORPORATE",
}


def _client_id(connector_type: str) -> str:
    return os.environ.get(f"GOOGLE_CALENDAR_CLIENT_ID_{_ENV_SUFFIX[connector_type]}", "")


def _client_secret(connector_type: str) -> str:
    return os.environ.get(f"GOOGLE_CALENDAR_CLIENT_SECRET_{_ENV_SUFFIX[connector_type]}", "")


def is_configured(connector_type: str) -> bool:
    return bool(_client_id(connector_type) and _client_secret(connector_type))


def _redirect_uri() -> str:
    backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
    return f"{backend_url}/meetings/connectors/google/callback"


def build_authorize_url(connector_type: str, csrf_token: str) -> str:
    """connector_type + csrf_token are packed into `state` together
    (colon-joined — connector_type is one of two known enum-like
    strings, never contains a colon) so the callback can recover which
    connector this was for (and therefore which client_id/secret pair
    to exchange the code with) AND verify it wasn't forged, from the
    one round-trip param OAuth gives back unchanged."""
    params = {
        "client_id": _client_id(connector_type),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",   # required to get a refresh_token back at all
        "prompt": "consent",        # forces a refresh_token even on a re-connect
        "state": f"{connector_type}:{csrf_token}",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(connector_type: str, code: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(TOKEN_URL, data={
            "code": code, "client_id": _client_id(connector_type), "client_secret": _client_secret(connector_type),
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


async def _refresh_access_token(connector_type: str, refresh_token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token, "client_id": _client_id(connector_type),
            "client_secret": _client_secret(connector_type), "grant_type": "refresh_token",
        })
    res.raise_for_status()
    return res.json()


async def get_valid_access_token(credential) -> Optional[str]:
    """credential: a GoogleCalendarCredential row (its connector_type
    field says which client_id/secret pair refreshes it). Refreshes
    lazily if the cached access token is missing or expired (with a
    60s safety margin), and updates the row's cache in place — caller
    is responsible for committing the session afterward. Returns None
    (never raises) if the refresh itself fails, e.g. the connection was
    revoked on Google's side — calendar sync degrades to "skipped" the
    same way a missing Fireflies key does, not a hard failure."""
    now = datetime.now(timezone.utc)
    if credential.access_token and credential.access_token_expires_at and credential.access_token_expires_at > now + timedelta(seconds=60):
        return credential.access_token

    try:
        tokens = await _refresh_access_token(credential.connector_type, credential.refresh_token)
    except httpx.HTTPStatusError:
        return None

    credential.access_token = tokens["access_token"]
    credential.access_token_expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))
    return credential.access_token


async def create_calendar_event(
    access_token: str, *, summary: str, description: str, start_iso: str, end_iso: str, location: str = "",
    attendees: Optional[List[str]] = None,
) -> Optional[str]:
    """Creates an event on the connected account's primary calendar.
    Returns the created event's id, or None if the call failed (never
    raises — a calendar-sync failure should never block a booking that
    otherwise succeeded, same fail-soft convention as Fireflies).

    `attendees` — how the Fireflies notetaker actually gets into a
    Jitsi meeting (services/fireflies.py's own docstring: Jitsi isn't
    one of Fireflies' natively-integrated platforms, so inviting its
    notetaker email onto this same calendar event is the real
    mechanism, not a separate Fireflies API call). `sendUpdates=all`
    (below) is what makes Google actually email the invite, including
    to the notetaker address, rather than silently adding it."""
    body = {
        "summary": summary, "description": description, "location": location,
        "start": {"dateTime": start_iso}, "end": {"dateTime": end_iso},
    }
    if attendees:
        body["attendees"] = [{"email": email} for email in attendees]
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{CALENDAR_API_BASE}/calendars/primary/events",
            params={"sendUpdates": "all"} if attendees else None,
            headers={"Authorization": f"Bearer {access_token}"}, json=body,
        )
    if res.status_code not in (200, 201):
        return None
    return res.json().get("id")
