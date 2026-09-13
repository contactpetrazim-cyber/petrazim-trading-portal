"""
Telegram Webhook Router — the real automation
=================================================

Telegram calls this endpoint for two kinds of update:

1. chat_join_request — someone requests to join either channel. Check
   if the requesting Telegram user is linked to a platform account
   with active access, and if so, approve them within the same
   request — no admin has to click anything.
2. message — a text message in a linked chat. This is the Telegram
   community Q&A the Learning Design Spec's Section 4 calls for
   ("reused by the Telegram community Q&A — one shared answering
   system, not two"): answered through the exact same
   answer_coach_question() that backs the in-app Ask Coach panel
   (routers/coach.py), not a second copy of the grounding/fallback
   logic. Only a DM to the bot, or a group message starting with
   "/ask ", triggers a reply — every other group message is ignored,
   so the bot doesn't answer general chat traffic. Only a Telegram
   account linked to a platform login with active (or recently-
   expired-grace, see access_gate.require_completion_access's
   sibling check) access gets an AI reply; anyone else gets a short
   nudge to link/renew rather than a free answer or silence.

SETUP REQUIRED (one-time, per bot):
  1. Set both channels to "Approve new members" in Telegram's channel
     admin settings (this is what makes join attempts arrive as
     `chat_join_request` events instead of instant joins).
  2. Disable "Group Privacy" for each bot via @BotFather
     (/setprivacy -> Disable) so group `message` updates actually
     reach this webhook at all — with Privacy Mode on (the default),
     Telegram only forwards messages that explicitly @mention the
     bot or reply to one of its own messages, which would silently
     break the "/ask " trigger below.
  3. Call TelegramService.set_webhook() once per bot, pointing at:
       POST /telegram/webhook/individual
       POST /telegram/webhook/corporate
     using this app's deployed URL. (set_webhook already requests
     both "chat_join_request" and "message" updates.)

SECURITY: Telegram webhooks aren't authenticated by default. Add a
secret path segment or the `secret_token` header Telegram supports
(via set_webhook's optional secret_token param) before this goes live
— left as a TODO here since it depends on your deployed URL.
"""

from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import has_active_access
from app.database import AsyncSessionLocal
from app.models.access import UserAccess
from app.models.curriculum import StageCompletion, TrackStage
from app.models.telegram_link import TelegramChannel, TelegramLink
from app.models.user import User
from app.routers.coach import answer_coach_question
from app.services.telegram import CHANNEL_USERNAME, TelegramService

router = APIRouter(prefix="/telegram", tags=["telegram"])


class ChatJoinRequestUpdate(BaseModel):
    """Minimal shape of the Telegram update we care about — the real
    payload has more fields; only what's used is modeled here."""
    update_id: int
    chat_join_request: dict | None = None
    message: dict | None = None


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


async def _linked_user_with_access(db: AsyncSession, telegram_user_id: int) -> Optional[User]:
    """Coach-Q&A counterpart to _has_active_access above: returns the
    actual platform User (not just a bool) so the caller can ground the
    answer against their own progress, reusing access_gate.has_active_access
    (staff-role-aware) rather than a third copy of the expiry query."""
    link = (await db.execute(
        select(TelegramLink).where(TelegramLink.telegram_user_id == telegram_user_id)
    )).scalar_one_or_none()
    if link is None:
        return None
    user = (await db.execute(select(User).where(User.id == link.user_id))).scalar_one_or_none()
    if user is None or not await has_active_access(db, user):
        return None
    return user


async def _last_active_lesson_id(db: AsyncSession, user_id) -> Optional[str]:
    """Best-effort grounding context for a Telegram question: the
    lesson attached to whichever stage this user most recently
    completed, mirroring what FloatingTradeAI passes in-app as
    context_lesson_id. None (falls back to the general coach voice,
    same as the in-app panel with no lesson open) if they haven't
    completed anything yet, or their last stage had no lesson_id."""
    last = (await db.execute(
        select(TrackStage.lesson_id)
        .join(StageCompletion, StageCompletion.stage_id == TrackStage.id)
        .where(StageCompletion.user_id == user_id)
        .order_by(StageCompletion.completed_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    return str(last) if last else None


async def _handle_message(chat_channel: TelegramChannel, message: dict) -> dict:
    """Telegram community Q&A — see this module's own docstring for
    why only a DM or a "/ask " message triggers a reply, and why an
    unlinked/unentitled sender gets a nudge instead of a free answer."""
    sender = message.get("from") or {}
    if sender.get("is_bot"):
        return {"ok": True, "ignored": True, "reason": "message from a bot"}

    text = (message.get("text") or "").strip()
    if not text:
        return {"ok": True, "ignored": True, "reason": "no text"}

    is_private_chat = (message.get("chat") or {}).get("type") == "private"
    if is_private_chat:
        question = text
    elif text.lower().startswith("/ask"):
        question = text[len("/ask"):].strip()
        if not question:
            return {"ok": True, "ignored": True, "reason": "/ask with no question text"}
    else:
        # Regular group chatter — never answered, so the bot doesn't
        # talk over the community's own conversation.
        return {"ok": True, "ignored": True, "reason": "not a DM or /ask message"}

    telegram_user_id = sender["id"]
    chat_id = message["chat"]["id"]
    service = TelegramService(chat_channel)

    async with AsyncSessionLocal() as db:
        user = await _linked_user_with_access(db, telegram_user_id)
        if user is None:
            reply = (
                "Ask Coach here is a linked-account feature. Link your platform login and make sure "
                "your access is active, then ask again with /ask (or DM me directly)."
            )
        else:
            context_lesson_id = await _last_active_lesson_id(db, user.id)
            reply = await answer_coach_question(db, question, context_lesson_id)

    if is_private_chat:
        await service.send_message(chat_id, escape(reply))
    else:
        await service.send_to_chat(chat_id, escape(reply))
    return {"ok": True, "action": "answered"}


@router.post("/webhook/{channel}")
async def telegram_webhook(channel: str, update: ChatJoinRequestUpdate):
    try:
        chat_channel = TelegramChannel(channel)
    except ValueError:
        raise HTTPException(status_code=404, detail="Unknown channel")

    if update.chat_join_request is not None:
        telegram_user_id = update.chat_join_request["from"]["id"]
        chat_id = CHANNEL_USERNAME[chat_channel]

        service = TelegramService(chat_channel)

        if await _has_active_access(telegram_user_id):
            await service.approve_join_request(chat_id, telegram_user_id)
            return {"ok": True, "action": "approved"}
        else:
            await service.decline_join_request(chat_id, telegram_user_id)
            return {"ok": True, "action": "declined", "reason": "no active platform access linked"}

    if update.message is not None:
        return await _handle_message(chat_channel, update.message)

    # Not a join request or a message (could be another update type) — accept and ignore.
    return {"ok": True, "ignored": True}


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
