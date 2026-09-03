"""
Tiered Signal Broadcast — Explore Concept #5
================================================

Free tier gets a stripped-down, delayed sample of each signal (enough
to prove the service works); paid tier gets it real-time with full
entry/stop/target and coach reasoning. Reuses the existing
TelegramService entirely — this is a formatting + routing layer, not a
new Telegram integration.

IMPORTANT — WHY THIS DOESN'T `asyncio.sleep()` THE DELAY:
Blocking an API request for 15 minutes to implement "delayed posting"
would tie up a server worker for the entire delay on every single
signal — a real bug waiting to happen under any load. The correct
shape is: compute WHEN the free-tier message should go out, hand that
off to a scheduler/task queue (e.g. APScheduler, Celery beat, or a
simple DB-backed "due_at" row a cron job polls), and let that worker
call broadcast_free() at the right time. This file provides the timing
calculation and the actual send calls; wiring a scheduler is
infrastructure you likely already have opinions on, so it's left as
the integration point rather than guessed at here.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.telegram import TelegramService, TelegramChannel

FREE_TIER_DELAY_MINUTES = 15   # common industry pattern for "delayed sample" signal feeds


@dataclass
class SignalBroadcast:
    bot_id: str
    symbol: str
    direction: str
    confidence: float
    reasoning: str                      # full coach reasoning — paid tier only
    entry_price: Optional[float] = None
    stop_price: Optional[float] = None
    target_price: Optional[float] = None


def compute_free_tier_send_time(signal_generated_at: datetime) -> datetime:
    """When a scheduler should actually dispatch the free-tier version.
    Store this as a `due_at` value alongside the signal; a polling job
    calls broadcast_free() once due_at has passed."""
    return signal_generated_at + timedelta(minutes=FREE_TIER_DELAY_MINUTES)


def format_paid_message(signal: SignalBroadcast) -> str:
    return (
        f"<b>{signal.symbol} — {signal.direction.upper()}</b>\n"
        f"Confidence: {signal.confidence * 100:.0f}%\n"
        f"Entry: {signal.entry_price} | Stop: {signal.stop_price} | Target: {signal.target_price}\n\n"
        f"<i>{signal.reasoning}</i>"
    )


def format_free_message(signal: SignalBroadcast) -> str:
    """Deliberately withholds entry/stop/target/reasoning — enough to
    demonstrate the service is real and active, not enough to trade off
    directly. This is the product boundary between free and paid."""
    return (
        f"<b>{signal.symbol} — {signal.direction.upper()}</b> "
        f"<i>(delayed sample, {FREE_TIER_DELAY_MINUTES} min behind live)</i>\n"
        f"Full entry, stop, target, and coach reasoning are in the paid channel, real-time.\n"
        f"Upgrade for live signals: [checkout link]"
    )


class SignalBroadcastService:
    def __init__(self, paid_chat_id: str, free_chat_id: str):
        self._paid_service = TelegramService(TelegramChannel.INDIVIDUAL)
        self._paid_chat_id = paid_chat_id
        self._free_chat_id = free_chat_id

    async def broadcast_paid(self, signal: SignalBroadcast) -> None:
        """Call this immediately when a signal fires."""
        await self._paid_service.send_to_chat(self._paid_chat_id, format_paid_message(signal))

    async def broadcast_free(self, signal: SignalBroadcast) -> None:
        """Call this from your scheduler once compute_free_tier_send_time()
        has passed — NOT immediately, and NOT via an in-request sleep."""
        await self._paid_service.send_to_chat(self._free_chat_id, format_free_message(signal))
