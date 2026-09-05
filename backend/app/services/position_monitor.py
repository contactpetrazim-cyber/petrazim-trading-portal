"""
Position Monitor — closes a Paper Trade for real when live price
actually touches it.
=====================================================================

The real fix for "no automated TP/SL-hit detection," the biggest
outstanding gap the platform audit flagged: every ACTIVE trade in this
app previously just sat there — a partial close or cancel only ever
happened when the trader clicked something, even in Paper Trading,
even though Paper Trading's whole point (by direct request) is to
"simulate trade management with live price data."

Scoped to is_test=True trades ONLY. A genuinely LIVE order already has
its stop-loss/take-profit placed as real broker-side conditional
orders — see execution_engine.py's own _execute_bingx/_execute_binance/
etc., each of which passes stop_loss/take_profit straight through to
that broker's place_order call — so the exchange itself already
enforces those; running this same auto-close logic against a live
position too would be redundant at best and a real double-close risk
at worst. For a paper trade there is no broker enforcing anything at
all, so this is pure simulation, zero real-money exposure, and safe to
run on by default (unlike market_scanner.py, which makes real exchange
API calls with real execution consequences and is opt-in for exactly
that reason).

Runs as a single in-process asyncio task (see main.py's lifespan),
same convention as MarketScanner — the simplest thing that actually
works for one web instance.

Close math is intentionally identical to routers/trades.py's
partial_close and manual_trading.py's cancel_order (100% case):
direction_sign * (exit_price - entry_price) * closed_size. Not a
second, parallel PnL formula.

Multi-target trades (TP2/TP3 also set): the FIRST untriggered
intermediate level price crosses closes an even split of the
ORIGINAL number of targets still configured (half if TP1+TP2 only,
a third if TP1+TP2+TP3), tracked via tp1_triggered/tp2_triggered so
the same level never re-fires on a later poll while price sits past
it. Whichever target is the LAST one configured (TP3 if set, else
TP2, else TP1) closes the entire remaining position, same as the
stop-loss case — there's nothing left to partially close once every
configured target has been reached.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.trade import ExitType, Trade, TradeDirection, TradeLog, TradeStatus
from app.services.live_price import get_crypto_price

logger = structlog.get_logger()
settings = get_settings()


class PositionMonitor:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info("position_monitor_started", interval_seconds=settings.POSITION_MONITOR_INTERVAL_SECONDS)

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
                # One bad cycle (a price-feed hiccup, an unexpected
                # row shape) should never kill the loop.
                logger.error("position_monitor_cycle_failed", error=str(e))
            await asyncio.sleep(settings.POSITION_MONITOR_INTERVAL_SECONDS)

    async def check_once(self) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Trade).where(Trade.status == TradeStatus.ACTIVE, Trade.is_test == True)  # noqa: E712
            )
            active_paper_trades = result.scalars().all()
            if not active_paper_trades:
                return

            # Batch price lookups per symbol — several paper trades
            # commonly share the same instrument.
            symbols = {t.symbol for t in active_paper_trades}
            prices = dict(zip(symbols, await asyncio.gather(*(get_crypto_price(s) for s in symbols))))

            for trade in active_paper_trades:
                price = prices.get(trade.symbol)
                if price is None:
                    continue  # forex/metals or an unresolvable symbol — same honest limitation as everywhere else
                try:
                    await self._check_trade(db, trade, price)
                except Exception as e:
                    logger.error("position_monitor_trade_failed", trade_id=trade.trade_id, error=str(e))

    async def _check_trade(self, db, trade: Trade, price: float) -> None:
        is_long = trade.direction == TradeDirection.LONG
        sign = 1 if is_long else -1

        # Stop-loss — touched if price has moved against the position
        # past it. Closes the entire remaining position.
        sl_hit = (price <= trade.stop_loss) if is_long else (price >= trade.stop_loss)
        if sl_hit:
            await self._close(db, trade, exit_price=trade.stop_loss, exit_type=ExitType.STOP_LOSS, event="auto_stop_loss_hit")
            return

        # Take-profit levels, in order — only the first untriggered
        # one each cycle; a level that's already fired is skipped so
        # it can't re-trigger while price sits past it.
        targets = [
            (1, trade.take_profit_1, trade.tp1_triggered),
            (2, trade.take_profit_2, trade.tp2_triggered),
            (3, trade.take_profit_3, False),  # TP3 has no "already triggered" column — it's always the final close
        ]
        configured = [t for t in targets if t[1] is not None]
        if not configured:
            return
        last_level = configured[-1][0]

        for idx, (level, target_price, already_triggered) in enumerate(configured):
            if already_triggered:
                continue
            hit = (price >= target_price) if is_long else (price <= target_price)
            if not hit:
                continue

            exit_type = {1: ExitType.TP1, 2: ExitType.TP2, 3: ExitType.TP3}[level]
            if level == last_level:
                await self._close(db, trade, exit_price=target_price, exit_type=exit_type, event=f"auto_take_profit_{level}_hit")
            else:
                # An even split of however many targets remain
                # configured from this point — e.g. TP1 of TP1+TP2+TP3
                # closes a third, leaving two-thirds for TP2/TP3.
                remaining_targets = len(configured) - idx
                fraction = 1.0 / remaining_targets
                await self._partial_close(db, trade, exit_price=target_price, fraction=fraction, level=level, event=f"auto_take_profit_{level}_hit")
            return  # one trigger per trade per cycle — the next cycle re-reads the (now updated) row

    async def _partial_close(self, db, trade: Trade, exit_price: float, fraction: float, level: int, event: str) -> None:
        closed_size = trade.lot_size * fraction
        direction_sign = 1 if trade.direction == TradeDirection.LONG else -1
        pnl_this_close = direction_sign * (exit_price - trade.entry_price) * closed_size

        trade.lot_size = round(trade.lot_size - closed_size, 8)
        trade.realized_pnl = (trade.realized_pnl or 0.0) + pnl_this_close
        if level == 1:
            trade.tp1_triggered = True
        elif level == 2:
            trade.tp2_triggered = True

        db.add(TradeLog(
            trade_id=trade.trade_id, event_type=event,
            event_data={"exit_price": exit_price, "closed_lot_size": round(closed_size, 8), "realized_pnl_this_close": round(pnl_this_close, 2)},
            price_at_event=exit_price, pnl_at_event=round(pnl_this_close, 2),
        ))
        await db.commit()
        logger.info("position_monitor_partial_close", trade_id=trade.trade_id, level=level, exit_price=exit_price, pnl=round(pnl_this_close, 2))

    async def _close(self, db, trade: Trade, exit_price: float, exit_type: ExitType, event: str) -> None:
        direction_sign = 1 if trade.direction == TradeDirection.LONG else -1
        pnl_this_close = direction_sign * (exit_price - trade.entry_price) * trade.lot_size

        trade.realized_pnl = (trade.realized_pnl or 0.0) + pnl_this_close
        trade.lot_size = 0.0
        trade.status = TradeStatus.CLOSED
        trade.exit_price = exit_price
        trade.exit_timestamp = datetime.now(timezone.utc)
        trade.exit_type = exit_type

        db.add(TradeLog(
            trade_id=trade.trade_id, event_type=event,
            event_data={"exit_price": exit_price, "realized_pnl_this_close": round(pnl_this_close, 2)},
            price_at_event=exit_price, pnl_at_event=round(pnl_this_close, 2),
        ))
        await db.commit()
        logger.info("position_monitor_closed", trade_id=trade.trade_id, exit_type=exit_type.value, exit_price=exit_price, pnl=round(pnl_this_close, 2))
