"""
Telegram Webhook Router — the real automation
=================================================

Telegram calls this endpoint when someone requests to join either
channel (chat_join_request update). This is where "adding members
automatically" actually happens: check if the requesting Telegram user
is linked to a platform account with active access, and if so, approve
them within the same request — no admin has to click anything.

SETUP REQUIRED (one-time, per bot):
  1. Set both channels to "Approve new members" in Telegram's channel
     admin settings (this is what makes join attempts arrive as
     `chat_join_request` events instead of instant joins).
  2. Call TelegramService.set_webhook() once per bot, pointing at:
       POST /telegram/webhook/individual
       POST /telegram/webhook/corporate
     using this app's deployed URL.

SECURITY: Telegram webhooks aren't authenticated by default. Add a
secret path segment or the `secret_token` header Telegram supports
(via set_webhook's optional secret_token param) before this goes live
— left as a TODO here since it depends on your deployed URL.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.access import UserAccess
from app.models.telegram_link import TelegramChannel, TelegramLink
from app.services.telegram import CHANNEL_USERNAME, TelegramService

router = APIRouter(prefix="/telegram", tags=["telegram"])


class ChatJoinRequestUpdate(BaseModel):
    """Minimal shape of the Telegram update we care about — the real
    payload has more fields; only what's used is modeled here."""
    update_id: int
    chat_join_request: dict | None = None


async def _has_active_access(telegram_user_id: int) -> bool:
    """Looks up whether this Telegram user is linked to a platform
    account with a currently-active UserAccess grant."""
    async with AsyncSessionLocal() as db:
        link = (await db.execute(
            select(TelegramLink).where(TelegramLink.telegram_user_id == telegram_user_id)
        )).scalar_one_or_none()
        if link is None:
            return False   # this Telegram account was never linked to a platform login

        now = datetime.now(timezone.utc)
        access = (await db.execute(
            select(UserAccess).where(
                UserAccess.user_id == link.user_id,
                UserAccess.is_active == True,  # noqa: E712
                UserAccess.expires_at > now,
            )
        )).scalar_one_or_none()
        return access is not None


@router.post("/webhook/{channel}")
async def telegram_webhook(channel: str, update: ChatJoinRequestUpdate):
    try:
        chat_channel = TelegramChannel(channel)
    except ValueError:
        raise HTTPException(status_code=404, detail="Unknown channel")

    if update.chat_join_request is None:
        # Not a join request (could be another update type) — accept and ignore.
        return {"ok": True, "ignored": True}

    telegram_user_id = update.chat_join_request["from"]["id"]
    chat_id = CHANNEL_USERNAME[chat_channel]

    service = TelegramService(chat_channel)

    if await _has_active_access(telegram_user_id):
        await service.approve_join_request(chat_id, telegram_user_id)
        return {"ok": True, "action": "approved"}
    else:
        await service.decline_join_request(chat_id, telegram_user_id)
        return {"ok": True, "action": "declined", "reason": "no active platform access linked"}


class LinkTelegramRequest(BaseModel):
    telegram_user_id: int
    telegram_username: str | None = None
    channel: str


@router.post("/link")
async def link_telegram_account(req: LinkTelegramRequest, user_id: str):
    """Called from the frontend right after a user taps 'Connect Telegram' —
    links their Telegram id to their platform account BEFORE they request
    to join, so the webhook above has something to check against.
    (user_id comes from the authenticated session in the real router wiring —
    simplified here as a query param to keep this file focused on the
    webhook logic; wire through get_current_user like the other routers.)"""
    async with AsyncSessionLocal() as db:
        link = TelegramLink(
            user_id=user_id, telegram_user_id=req.telegram_user_id,
            telegram_username=req.telegram_username, channel=TelegramChannel(req.channel),
        )
        db.add(link)
        await db.commit()
    return {"ok": True}
