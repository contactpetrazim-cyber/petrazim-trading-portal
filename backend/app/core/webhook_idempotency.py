"""
Webhook Idempotency Guard
=========================

TradingView delivers alerts on an "at-least-once" basis — the same alert
can arrive twice (retries, network blips). Without a dedup check, a
duplicate delivery becomes a duplicate order.

Usage in the webhook handler:

    from app.core.webhook_idempotency import IdempotencyGuard

    guard = IdempotencyGuard(redis_client)   # or any key/value store

    async def webhook(request):
        payload = parse_json(await request.body())
        event_id = payload["event_id"]

        if await guard.already_processed(event_id):
            return {"status": "duplicate_ignored", "event_id": event_id}

        # ... normal processing (risk check, execution, etc.) ...

        await guard.mark_processed(event_id)
        return {"status": "accepted"}

If you don't have Redis wired up yet, InMemoryIdempotencyStore works as a
drop-in for local/paper-trading use — swap to RedisIdempotencyStore once
you deploy for real, since in-memory state resets on every restart.
"""

from __future__ import annotations

import time
from typing import Protocol


class IdempotencyStore(Protocol):
    async def exists(self, key: str) -> bool: ...
    async def set_with_ttl(self, key: str, ttl_seconds: int) -> None: ...


class InMemoryIdempotencyStore:
    """Dev/paper-trading only. Not durable across restarts or multiple workers."""

    def __init__(self):
        self._seen: dict[str, float] = {}

    async def exists(self, key: str) -> bool:
        self._prune()
        return key in self._seen

    async def set_with_ttl(self, key: str, ttl_seconds: int) -> None:
        self._seen[key] = time.time() + ttl_seconds

    def _prune(self) -> None:
        now = time.time()
        expired = [k for k, exp in self._seen.items() if exp < now]
        for k in expired:
            del self._seen[k]


class RedisIdempotencyStore:
    """Production store. Pass an async redis client (e.g. redis.asyncio)."""

    def __init__(self, redis_client):
        self._redis = redis_client

    async def exists(self, key: str) -> bool:
        return bool(await self._redis.exists(f"webhook_event:{key}"))

    async def set_with_ttl(self, key: str, ttl_seconds: int) -> None:
        await self._redis.set(f"webhook_event:{key}", "1", ex=ttl_seconds)


class IdempotencyGuard:
    """Wraps a store with the two calls the webhook handler needs."""

    def __init__(self, store: IdempotencyStore, ttl_seconds: int = 24 * 60 * 60):
        self._store = store
        self._ttl = ttl_seconds

    async def already_processed(self, event_id: str) -> bool:
        if not event_id:
            # Missing event_id should never silently pass through —
            # treat as a rejected/malformed alert upstream, not as "new".
            raise ValueError("event_id is required for idempotency checks")
        return await self._store.exists(event_id)

    async def mark_processed(self, event_id: str) -> None:
        await self._store.set_with_ttl(event_id, self._ttl)
