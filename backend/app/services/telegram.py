"""
Telegram Service
==================

WHAT A BOT CAN AND CANNOT DO (read this before wiring anything up):

  CANNOT: unilaterally add an arbitrary user to a channel. Telegram's
  Bot API has no "addChatMember" for channels — this is a deliberate
  anti-spam restriction, not a gap in this code. Any tool claiming to
  "auto-add members" to a Telegram channel is either lying or relying
  on the flows below, which still require the USER to take an action.

  CAN, and this is what's built here:
    1. Generate a unique, trackable invite link per user
       (createChatInviteLink) — optionally single-use.
    2. DM a user a join link directly, IF that user has already
       started a conversation with the bot (sendMessage) — Telegram
       blocks bots from messaging users who haven't opted in first.
    3. Auto-APPROVE join requests (approveChatJoinRequest) — the real
       automation: if your channel has "Approve new members" enabled,
       a user who requests to join triggers a `chat_join_request`
       webhook update; this service checks their platform access and
       approves or declines automatically, no human in the loop.

  The realistic end-to-end flow this service supports:
    User pays/redeems code on the platform
      -> platform shows them the channel's join link (public, "request
         to join" mode)
      -> user taps it, Telegram sends a join request
      -> Telegram calls our webhook (telegram_webhook.py)
      -> this service checks UserAccess, approves automatically
      -> user is in, within seconds, no manual admin action

TWO BOTS, ROUTED BY SPONSOR TYPE — same pattern as the Academy:
  individual signups -> @petrazim_tradefx_bot -> t.me/petrazim_tradefx
  corporate-sponsored -> @petrazim_tradefx_corp_bot -> t.me/petrazim_tradefx_corp
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx

from app.models.telegram_link import TelegramChannel

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"


@dataclass
class TelegramConfig:
    token_env_var: str
    channel: TelegramChannel


BOT_CONFIG = {
    TelegramChannel.INDIVIDUAL: TelegramConfig(
        token_env_var="TELEGRAM_BOT_TOKEN_INDIVIDUAL", channel=TelegramChannel.INDIVIDUAL
    ),
    TelegramChannel.CORPORATE: TelegramConfig(
        token_env_var="TELEGRAM_BOT_TOKEN_CORP", channel=TelegramChannel.CORPORATE
    ),
}


class TelegramService:
    def __init__(self, channel: TelegramChannel):
        config = BOT_CONFIG[channel]
        token = os.environ.get(config.token_env_var, "")
        if not token:
            raise RuntimeError(
                f"{config.token_env_var} is not set. Store the bot token you got from "
                f"@BotFather as this environment variable — never hardcode it in code, "
                f"and regenerate it via @BotFather first since it was shared in chat "
                f"during setup."
            )
        self.token = token
        self.channel = channel
        self._base_url = TELEGRAM_API_BASE.format(token=token)

    async def _call(self, method: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{self._base_url}/{method}", json=payload)
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(f"Telegram API error on {method}: {data.get('description')}")
            return data["result"]

    async def create_invite_link(
        self, chat_id: str, name: str, single_use: bool = True, expire_seconds: Optional[int] = None
    ) -> str:
        """chat_id: the channel's @username (e.g. '@petrazim_tradefx') or numeric chat id.
        Requires the bot to be an admin of that channel with invite-link permission."""
        payload = {"chat_id": chat_id, "name": name, "creates_join_request": True}
        if single_use:
            payload["member_limit"] = 1
        if expire_seconds:
            import time
            payload["expire_date"] = int(time.time()) + expire_seconds

        result = await self._call("createChatInviteLink", payload)
        return result["invite_link"]

    async def send_message(self, telegram_user_id: int, text: str) -> None:
        """Only succeeds if the user has already started a chat with this bot
        (Telegram blocks unsolicited bot DMs) — send this AFTER they've tapped
        'Start' on the bot, not as a cold outreach."""
        await self._call("sendMessage", {"chat_id": telegram_user_id, "text": text, "parse_mode": "HTML"})

    async def send_to_chat(self, chat_id: str, text: str) -> None:
        """Posts to a CHANNEL (chat_id as '@channelname' or numeric channel id),
        not a DM — requires the bot to be an admin of that channel with post
        permission. Used for signal broadcasts (see services/signal_broadcast.py)."""
        await self._call("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML"})

    async def send_quiz_poll(
        self, chat_id: str, question: str, options: list[str], correct_option_id: int, explanation: str = "",
    ) -> None:
        """Telegram's own native quiz poll (sendPoll, type='quiz') — a real
        interactive object with a visible correct answer and vote tally,
        not a text message asking people to reply with a letter. 2-10
        options, exactly one correct index; explanation shows automatically
        once someone answers. Used for services/community_broadcast.py's
        curated quiz questions."""
        await self._call("sendPoll", {
            "chat_id": chat_id, "question": question, "options": options,
            "type": "quiz", "correct_option_id": correct_option_id,
            "explanation": explanation[:200], "is_anonymous": True,
        })

    async def approve_join_request(self, chat_id: str, telegram_user_id: int) -> None:
        """Call this from the webhook handler after confirming the user has
        active platform access (UserAccess row, not expired)."""
        await self._call("approveChatJoinRequest", {"chat_id": chat_id, "user_id": telegram_user_id})

    async def decline_join_request(self, chat_id: str, telegram_user_id: int) -> None:
        await self._call("declineChatJoinRequest", {"chat_id": chat_id, "user_id": telegram_user_id})

    async def set_webhook(self, webhook_url: str) -> None:
        """Run once per bot, pointing Telegram at your deployed webhook endpoint.
        e.g. TelegramService(TelegramChannel.INDIVIDUAL).set_webhook(
                 'https://your-api.example.com/telegram/webhook/individual')"""
        await self._call("setWebhook", {"url": webhook_url, "allowed_updates": ["chat_join_request"]})


CHANNEL_USERNAME = {
    TelegramChannel.INDIVIDUAL: "@petrazim_tradefx",
    TelegramChannel.CORPORATE: "@petrazim_tradefx_corp",
}


def channel_for_access(granted_via: str) -> TelegramChannel:
    """Routes to the corporate channel/bot for corporate-seat grants,
    individual channel/bot for everything else — same sponsor-type
    routing logic used in the Academy build."""
    return TelegramChannel.CORPORATE if granted_via == "corporate_seat" else TelegramChannel.INDIVIDUAL
