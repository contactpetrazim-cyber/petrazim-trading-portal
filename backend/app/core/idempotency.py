"""
Idempotency Guard
====================

A reusable "make this mutating endpoint safe to retry" helper — see
migrations/016_idempotency_keys.sql for the full reasoning on why this
exists (concretely: manual order placement had no protection against a
retried request placing a duplicate order, and curriculum.complete_game
awarded XP with zero dedup at all — every call, including a retry,
unconditionally granted XP a second time).

Usage — add an optional header param to the route, then wrap the
handler body in the async context manager:

    @router.post("/order", response_model=ManualOrderResponse)
    async def place_manual_order(
        req: ManualOrderRequest, db: AsyncSession = Depends(get_db),
        user: User = Depends(get_current_user),
        idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    ):
        async with idempotency_guard(db, user.id, "manual_trading.place_order", idempotency_key) as guard:
            if guard.cached is not None:
                return guard.cached
            ... existing handler body, unchanged ...
            response = ManualOrderResponse(...)
            await guard.finalize(response)
            return response

Deliberately fails OPEN, not closed: when the caller sends no
Idempotency-Key header (every existing caller, until the frontend is
updated to send one for a given call site), `guard.cached` is always
None and `guard.finalize` is a no-op — behavior is byte-for-byte
identical to before this existed. This matches this codebase's own
convention for every other optional integration (Fireflies, Google
Calendar, community broadcast channels): missing configuration skips
the feature rather than breaking the request.

Any HTTPException raised inside the guarded block (a real, definitive
answer — "risk check failed", "stage not found", ...) is cached too,
so a retry of a request that genuinely failed replays the exact same
error instead of re-running the validation a second time. An
unexpected non-HTTPException error deletes the reservation instead of
caching it, so a genuine retry after a real server error can actually
try again rather than being permanently locked out by a half-finished
record.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency import IdempotencyRecord


class IdempotencyGuard:
    """Handed to the caller by idempotency_guard(). `cached` is set (and
    the caller should return it immediately) when this exact key has
    already completed; otherwise call `finalize(response)` right before
    returning a successful response, so a subsequent replay has
    something real to return."""

    def __init__(self, cached: Optional[Any] = None, _finalize=None):
        self.cached = cached
        self._finalize = _finalize

    async def finalize(self, response_body: Any, status_code: int = 200) -> None:
        if self._finalize is not None:
            await self._finalize(status_code, response_body)


@asynccontextmanager
async def idempotency_guard(db: AsyncSession, user_id: UUID, endpoint: str, idempotency_key: Optional[str]):
    if not idempotency_key:
        yield IdempotencyGuard()
        return

    existing = (await db.execute(
        select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.endpoint == endpoint,
            IdempotencyRecord.idempotency_key == idempotency_key,
        )
    )).scalar_one_or_none()

    if existing is not None:
        if existing.completed_at is None:
            # A genuinely concurrent duplicate — the original request
            # with this exact key is still being processed right now.
            raise HTTPException(
                status_code=409,
                detail="A request with this Idempotency-Key is already being processed.",
            )
        if existing.response_status and existing.response_status >= 400:
            raise HTTPException(status_code=existing.response_status, detail=existing.response_body)
        yield IdempotencyGuard(cached=existing.response_body)
        return

    record = IdempotencyRecord(user_id=user_id, endpoint=endpoint, idempotency_key=idempotency_key)
    db.add(record)
    try:
        await db.commit()
    except IntegrityError:
        # Lost a race against a concurrent identical request that
        # inserted its own reservation row a moment earlier — same
        # outcome as the "already in progress" branch above.
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A request with this Idempotency-Key is already being processed.",
        )

    async def _finalize(status_code: int, response_body: Any) -> None:
        record.response_status = status_code
        record.response_body = jsonable_encoder(response_body)
        record.completed_at = datetime.now(timezone.utc)
        await db.commit()

    try:
        yield IdempotencyGuard(_finalize=_finalize)
    except HTTPException as e:
        record.response_status = e.status_code
        record.response_body = e.detail if isinstance(e.detail, (dict, list)) else {"detail": e.detail}
        record.completed_at = datetime.now(timezone.utc)
        await db.commit()
        raise
    except Exception:
        await db.delete(record)
        await db.commit()
        raise
