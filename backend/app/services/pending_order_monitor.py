"""
Pending Order Monitor — fills a paper LIMIT/STOP order for real once
live price actually reaches its trigger.
=====================================================================

Root-caused from a direct bug report: a paper SHORT stop order sat at
"Pending — not filled yet" for 16 hours after live price had already
reached its trigger price. `broker_integrations.py`'s own
`_paper_place_order` docstring explains why: "A LIMIT/STOP order fills
at its own given price — paper mode has no real order book to rest on,
so there's no 'still waiting to be touched' state to simulate." In
practice that meant `manual_trading.py`'s `place_manual_order` used to
mark every successfully-submitted paper LIMIT/STOP order ACTIVE
synchronously, in the SAME request it was placed in — regardless of
whether live price had ever actually reached the trigger.

That mostly "worked" (a paper fill never touches a real order book
either way), but it had two real consequences:
1. The "Pending — not filled yet" label the UI shows was never
   genuinely true for more than the length of one HTTP request on a
   healthy path — and outright lied on an unhealthy one. If that one
   request got interrupted mid-flight (a Render cold-start/redeploy,
   a network hiccup fetching the price-deviation guard's live ticker
   — see execution_engine.py's `_check_price_deviation`, which still
   runs even in paper mode), the Trade row had already been committed
   as PENDING *before* that call, with nothing anywhere ever
   revisiting it afterward — exactly the stuck-forever row from the
   bug report.
2. Even on the healthy path, position_monitor.py started applying
   SL/TP-hit detection to the trade from the moment it was PLACED, not
   from when live price had genuinely reached its entry — backwards
   from how a real resting order behaves (a stop-loss could "fire"
   before the position was ever really entered from a live-price
   standpoint).

The fix: manual_trading.py's place_manual_order now leaves a paper
LIMIT/STOP order genuinely PENDING (skips the broker call — there's no
broker to call for an order that isn't filling yet, and nothing to
price-deviation-check against a deliberately-away-from-market trigger).
THIS monitor is what actually fills it, the moment live price crosses
the trigger — closing both gaps above at once. A paper MARKET order is
unaffected (still fills instantly, unchanged) and so is any real LIVE
order (a real broker has its own real order book to rest on; this is
pure simulation, same scope and same reasoning as position_monitor.py).

Scoped to is_test=True, PENDING, LIMIT/STOP trades ONLY — mirrors
position_monitor.py's own scope and rationale exactly. Runs as a
second, small in-process asyncio task alongside it (see main.py's
lifespan) — same "simplest thing that actually works for one web
instance" convention, reusing the same POSITION_MONITOR_ENABLED /
POSITION_MONITOR_INTERVAL_SECONDS settings rather than inventing a
second pair for what is really the same feature (watch live prices for
paper trades) applied to a second trade state.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Optional

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.trade import EntryType, Trade, TradeDirection, TradeStatus

logger = structlog.get_logger()
settings = get_settings()


class PendingOrderMonitor:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info("pending_order_monitor_started", interval_seconds=settings.POSITION_MONITOR_INTERVAL_SECONDS)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_forever(self) -> None:
        while True:
            try:
                await self.check_once()
            except Exception as e:
                # One bad cycle should never kill the loop — same
                # tolerance as position_monitor.py's own _run_forever.
                logger.error("pending_order_monitor_cycle_failed", error=str(e))
            await asyncio.sleep(settings.POSITION_MONITOR_INTERVAL_SECONDS)

    async def check_once(self) -> None:
        # Local import — avoids a circular import at module load, same
        # reason execution_engine.py imports some of its own models
        # locally rather than at the top of the file.
        from app.services.live_price import get_crypto_price

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Trade).where(
                    Trade.status == TradeStatus.PENDING,
                    Trade.is_test == True,  # noqa: E712
                    Trade.entry_type.in_([EntryType.LIMIT, EntryType.STOP]),
                    # Real bug fix, by direct report ("how can I have
                    # active trades if I have not approved any
                    # recommendations yet"): this monitor was built for
                    # a TRADER's own manually-placed resting paper order
                    # (see this file's own module docstring) — it never
                    # checked requires_approval, so a bot's
                    # Human-in-the-Loop draft (ALSO stored as PENDING +
                    # LIMIT/STOP, awaiting a person's decision, never
                    # touched by execution_engine.py's own approve_trade
                    # until a human calls it) got silently "filled" the
                    # moment live price reached its entry — completely
                    # bypassing approval. Confirmed directly from
                    # production data: every wrongly-ACTIVE trade had
                    # approved_at IS NULL, proving none were ever
                    # actually approved. A trader's own manual order
                    # never sets requires_approval=True in the first
                    # place, so this exclusion only ever removes exactly
                    # the rows it should.
                    Trade.requires_approval.isnot(True),
                    # A deleted duplicate (see Trade.is_deleted's own
                    # comment) is still PENDING/LIMIT-or-STOP in the DB
                    # — without this it would silently come back ACTIVE
                    # the moment price touched it, defeating the point
                    # of deleting it.
                    Trade.is_deleted.isnot(True),
                )
            )
            pending_orders = result.scalars().all()
            if not pending_orders:
                return

            symbols = {t.symbol for t in pending_orders}
            prices = dict(zip(symbols, await asyncio.gather(*(get_crypto_price(s) for s in symbols))))

            for order in pending_orders:
                price = prices.get(order.symbol)
                if price is None:
                    continue  # forex/metals or an unresolvable symbol — same honest limitation as position_monitor.py
                try:
                    await self._check_order(db, order, price)
                except Exception as e:
                    logger.error("pending_order_monitor_order_failed", trade_id=order.trade_id, error=str(e))

    async def _check_order(self, db, order: Trade, price: float) -> None:
        is_long = order.direction == TradeDirection.LONG
        is_stop = order.entry_type == EntryType.STOP
        trigger = order.entry_price

        # STOP (breakout-style — arms as price moves further in the
        # trade's own direction, e.g. a long entered as price breaks
        # UP through resistance): a long stop triggers on price rising
        # THROUGH the trigger, a short stop on price falling through
        # it. LIMIT (pullback-style — waits for a better price than
        # today's) is the mirror image for the same long/short. Same
        # convention every broker integration in this app already
        # assumes (see e.g. broker_integrations.py's own STOP/LIMIT
        # order-type mapping).
        if is_stop:
            triggered = (price >= trigger) if is_long else (price <= trigger)
        else:
            triggered = (price <= trigger) if is_long else (price >= trigger)

        if not triggered:
            return

        order.status = TradeStatus.ACTIVE
        # Naive UTC, not datetime.now(timezone.utc) — Trade.entry_timestamp
        # is a plain DateTime column (no timezone=True). Root-caused
        # directly from production logs: this exact line was throwing
        # "can't subtract offset-naive and offset-aware datetimes" on
        # every single cycle for any order that had genuinely triggered,
        # so the fill NEVER actually committed — the order sat rolled
        # back at PENDING forever, retried and failed again 20 seconds
        # later, indefinitely. Same bug, same fix, as the one already
        # documented in routers/manual_trading.py's own
        # place_manual_order (see its comment on today_start) — this
        # exact spot was simply never audited when that one was found.
        order.entry_timestamp = datetime.utcnow()
        await db.commit()
        logger.info(
            "pending_order_filled", trade_id=order.trade_id, entry_type=order.entry_type.value,
            direction=order.direction.value, trigger=trigger, live_price=price,
        )
