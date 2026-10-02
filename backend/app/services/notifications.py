"""
Pending-Approval Notifications
================================

Fires an email + (if linked) a Telegram DM the moment a trade lands in
"requires your approval" state — by direct request ("push to phone and
email alerts for pending approvals"). Single call site:
execution_engine.py's _persist_trade, right after the Trade row that
set requires_approval=True actually commits — the same choke point
every requires_approval trade (the platform's own pooled trade AND
every subscriber's own copy via _fan_out_to_subscribers) already goes
through, so no other call site is needed.

Fire-and-forget by design (asyncio.create_task, never awaited by the
caller): a Resend or Telegram outage must never slow down or block
trade drafting itself — same "notify, never gate" principle as every
other notification in this codebase (see email.py's own docstring).
Opens its OWN AsyncSessionLocal rather than reusing the caller's
session, since the caller (execution_engine.py's process_signal) keeps
using its own session concurrently right after this fires (the
_fan_out_to_subscribers call that follows _persist_trade) — sharing
one AsyncSession across two concurrently-running coroutines is exactly
the kind of asyncpg "another operation is in progress" bug this avoids.
Every exception is caught and logged, never raised back.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from sqlalchemy import select

from app.models.telegram_link import TelegramLink
from app.models.user import User
from app.services.email import render_html_email, send_email
from app.services.telegram import TelegramService

logger = logging.getLogger(__name__)


def notify_pending_approval(user_id: Optional[str], trade_summary: dict) -> None:
    """Schedules the actual notification work in the background —
    non-blocking by design, see this module's own docstring. A no-op
    for a bot with no owning user (pre-ownership bot row — see
    migrations/008_bot_trade_ownership.sql)."""
    if not user_id:
        return
    asyncio.create_task(_send_pending_approval_alerts(user_id, trade_summary))


async def _send_pending_approval_alerts(user_id: str, trade_summary: dict) -> None:
    from app.database import AsyncSessionLocal  # local import: avoids a circular import at module load

    try:
        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            if user is None:
                return

            symbol = trade_summary.get("symbol", "")
            direction = str(trade_summary.get("direction", "")).upper()
            bot_name = trade_summary.get("bot_name") or trade_summary.get("bot_id", "")
            entry = trade_summary.get("entry_price")
            sl = trade_summary.get("stop_loss")
            tp = trade_summary.get("take_profit")

            text = (
                f"A trade is waiting for your approval: {symbol} {direction} via {bot_name}.\n"
                f"Entry {entry} | SL {sl} | TP {tp if tp is not None else '—'}\n"
                f"Review and approve it on your Pending Approvals page: "
                f"https://trade.petrazim.online/dashboard"
            )
            subject = f"Pending approval: {symbol} {direction}"
            body_html = (
                f"<p>A trade is waiting for your approval:</p>"
                f"<p><strong>{symbol} {direction}</strong> via {bot_name}</p>"
                f"<p>Entry {entry} &middot; SL {sl} &middot; TP {tp if tp is not None else '—'}</p>"
            )
            html = render_html_email(
                preheader=subject, body_html=body_html,
                cta=("Review pending approvals", "https://trade.petrazim.online/dashboard"),
            )

            # send_email is a blocking httpx.post (see its own docstring) —
            # run_in_threadpool keeps it off this event loop even though
            # we're already off the main request's loop turn.
            from starlette.concurrency import run_in_threadpool
            await run_in_threadpool(send_email, user.email, subject, text, html)

            # First linked channel only (a user who's joined both the
            # individual and corporate community would have two rows —
            # one DM is enough for a "push to phone" alert; this isn't
            # the actual community membership, just a notify channel).
            link = (await db.execute(
                select(TelegramLink).where(TelegramLink.user_id == user_id)
            )).scalars().first()
            if link is not None:
                try:
                    await TelegramService(link.channel).send_message(link.telegram_user_id, text)
                except Exception:
                    logger.exception("pending_approval_telegram_failed user_id=%s", user_id)
    except Exception:
        logger.exception("pending_approval_notification_failed user_id=%s", user_id)
