"""
Position Monitor — closes a Paper Trade for real when live price
actually touches it, and (opt-in, see POSITION_MONITOR_LIVE_ENABLED)
drives the same ladder/ratchet/trailing mechanism for a REAL broker
position too.
=====================================================================

The real fix for "no automated TP/SL-hit detection," the biggest
outstanding gap the platform audit flagged: every ACTIVE trade in this
app previously just sat there — a partial close or cancel only ever
happened when the trader clicked something, even in Paper Trading,
even though Paper Trading's whole point (by direct request) is to
"simulate trade management with live price data."

Originally scoped to is_test=True trades ONLY, because a genuinely
LIVE order already has its stop-loss/take-profit placed as real
broker-side conditional orders (see execution_engine.py's own
_execute_bingx/_execute_binance/etc.) — running this same auto-close
logic against a live position too would have been redundant at best
and a real double-close risk at worst.

EXTENDED to live trades (by direct request, "fix the live-trade
partial-exit ladder / let winners run gap now"), but carefully, not by
just dropping the is_test filter: every position-REDUCING action for a
live trade (_partial_close, _close) now goes through
ExecutionEngine.close_broker_position FIRST, gated strictly on that
broker call succeeding — no DB mutation at all on a failure, so this
can never claim a reduction that didn't actually happen at the broker
(exactly the discipline manual_trading.py's own partial_close endpoint
already established). The stop-loss ratchet additionally best-effort
syncs to the broker via update_broker_stop_loss_take_profit where
supported (SL_SYNC_CAPABLE_BROKERS) — a failed sync there just leaves
the broker's own stop at an old-but-still-safe level, never loosens
it, so it's fine for that one piece to be best-effort rather than
gated. See execution_engine.py's own LIVE_LADDER_CAPABLE_BROKERS/
SL_SYNC_CAPABLE_BROKERS and the centralized final-target override in
_execute_broker_order for the broker-side half of this design — a live
trade with a ladder configured gets its own broker-side take_profit
pointed at the FINAL target (a disaster-recovery fallback, full
quantity) rather than TP1, precisely because this worker is what
actually fires each earlier partial leg now.

Scope, deliberately narrow: only live trades with trailing_activation_r
set (a real ladder configured) AND routed through one of
LIVE_LADDER_CAPABLE_BROKERS are pulled in at all — a live trade with no
ladder is already correctly left alone (its one broker-side TP/SL
already covers it, unchanged). TradeLocker/MetaApi/OANDA trades are
never reachable here regardless of the flag — live_price.py has no
credential-less ticker source for forex at all, so this worker could
never even price them to check. Ships with POSITION_MONITOR_LIVE_ENABLED
defaulting to False (see config.py's own comment) — this cannot be
verified against a real broker this session (zero live trades exist on
the platform today); canary it deliberately with one small live trade
before trusting it broadly.

Runs as a single in-process asyncio task (see main.py's lifespan),
same convention as MarketScanner — the simplest thing that actually
works for one web instance.

Close math is intentionally identical to routers/trades.py's
partial_close and manual_trading.py's cancel_order (100% case):
direction_sign * (exit_price - entry_price) * closed_size. Not a
second, parallel PnL formula.

Multi-target trades (TP2/TP3 also set): the FIRST untriggered
intermediate level price crosses closes a fraction of whatever's
currently left — see _target_fraction for the exact math. A bot-
placed trade uses that bot's own tp1_percent/tp2_percent/tp3_percent
(BotConfig, 30/40/30 by default, matching the ladder
smc_algorithms.py's calculate_targets drafted the signal against); a
manual trade (no BotConfig row) falls back to an even split across
however many targets remain (half if TP1+TP2 only, a third if
TP1+TP2+TP3). Tracked via tp1_triggered/tp2_triggered so the same
level never re-fires on a later poll while price sits past it.
Whichever target is the LAST one configured (TP3 if set, else TP2,
else TP1) closes the entire remaining position, same as the
stop-loss case — there's nothing left to partially close once every
configured target has been reached.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Optional

import structlog
from sqlalchemy import select

from app.config import get_settings
from app.core.smc_algorithms import compute_trailing_stop
from app.database import AsyncSessionLocal
from app.models.bot import BotConfig
from app.models.trade import ExitType, Trade, TradeDirection, TradeLog, TradeStatus
from app.services.live_price import get_broker_ticker_price, get_crypto_price, price_is_plausible
from app.services.manual_trading import compute_blended_r_multiple
from app.services.performance_fees import apply_performance_fee

logger = structlog.get_logger()
settings = get_settings()


class PositionMonitor:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        # One instance, constructed once — same convention as every
        # other caller of ExecutionEngine (manual_trading.py's own
        # module-level `_engine`, trades.py's `engine`, etc.); no
        # shared singleton exists anywhere in this codebase to reuse
        # instead, confirmed by grep before adding this.
        from app.services.execution_engine import ExecutionEngine
        self._engine = ExecutionEngine()

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
            active_trades = list(result.scalars().all())

            # Live-trade ladder extension — opt-in (see this module's
            # own docstring and POSITION_MONITOR_LIVE_ENABLED's own
            # comment for why this isn't on by default the way the
            # paper query above is). Deliberately narrow: only a live
            # trade with a real ladder configured (trailing_activation_r
            # set) AND routed through a broker this worker can actually
            # act on (LIVE_LADDER_CAPABLE_BROKERS) is pulled in — a live
            # trade with no ladder is already correctly left alone.
            if settings.POSITION_MONITOR_LIVE_ENABLED:
                from app.services.execution_engine import LIVE_LADDER_CAPABLE_BROKERS
                live_result = await db.execute(
                    select(Trade).where(
                        Trade.status == TradeStatus.ACTIVE,
                        Trade.is_test == False,  # noqa: E712
                        Trade.trailing_activation_r.isnot(None),
                        Trade.broker_name.in_(LIVE_LADDER_CAPABLE_BROKERS),
                    )
                )
                active_trades += list(live_result.scalars().all())

            if not active_trades:
                return

            # Primary: the trade's own exchange's futures/perpetual-swap
            # ticker (x50 leverage venue every trade here actually runs
            # on) — not a generic reference price. By direct correction
            # ("all pairs are Futures ... that includes EUR/XAUT ...
            # not spot") after a live check showed Binance's own
            # futures price can still diverge from the trade's real
            # exchange by a real, non-trivial amount. See
            # live_price.get_broker_ticker_price's own docstring.
            broker_keys = {(t.broker_name, t.symbol) for t in active_trades}
            broker_prices = dict(zip(
                broker_keys,
                await asyncio.gather(*(get_broker_ticker_price(b, s) for b, s in broker_keys)),
            ))
            prices: dict[str, float] = {}
            still_missing_symbols = set()
            for t in active_trades:
                p = broker_prices.get((t.broker_name, t.symbol))
                if p is not None:
                    prices[t.symbol] = p
                else:
                    still_missing_symbols.add(t.symbol)

            # Fallback only for what the broker-ticker map above can't
            # cover at all (a non-crypto broker_name, or a transient
            # miss) — e.g. JPYUSDT.P/NAS100USDT.P/OILBRENTUSDT.P used to
            # need this as their ONLY option before being added to real
            # exchanges; now it's the rarer path.
            if still_missing_symbols:
                fallback_prices = dict(zip(
                    still_missing_symbols,
                    await asyncio.gather(*(get_crypto_price(s) for s in still_missing_symbols)),
                ))
                for s, p in fallback_prices.items():
                    if p is not None:
                        prices[s] = p

            for trade in active_trades:
                price = prices.get(trade.symbol)
                if price is None:
                    continue  # forex/metals or an unresolvable symbol — same honest limitation as everywhere else
                # Sanity check — by direct, critical bug report
                # ("extremely high trade values ... fix portal wide
                # issue"). FAR more consequential here than on a
                # display-only number: this price is what actually
                # decides whether a stop-loss/take-profit fires and
                # closes a real position. See price_is_plausible's own
                # docstring. Skipped exactly like a missing price —
                # this trade just waits for next cycle's fresh read
                # rather than risking a close at a fabricated price.
                if not price_is_plausible(price, trade.entry_price):
                    logger.warning(
                        "position_monitor_price_implausible", trade_id=trade.trade_id, symbol=trade.symbol,
                        fetched_price=price, entry_price=trade.entry_price,
                    )
                    continue
                try:
                    await self._check_trade(db, trade, price)
                except Exception as e:
                    logger.error("position_monitor_trade_failed", trade_id=trade.trade_id, error=str(e))

    async def _check_trade(self, db, trade: Trade, price: float) -> None:
        is_long = trade.direction == TradeDirection.LONG
        sign = 1 if is_long else -1

        # Stop-loss — touched if price has moved against the position
        # past it. Closes the entire remaining position. This is the
        # RATCHETED stop once trailing has engaged (see _partial_close)
        # — breakeven after TP1, TP1's own price after TP2 — so it can
        # only ever improve, never loosen, regardless of what the
        # trailing check below does with the runner leg.
        sl_hit = (price <= trade.stop_loss) if is_long else (price >= trade.stop_loss)
        if sl_hit:
            await self._close(db, trade, exit_price=trade.stop_loss, exit_type=ExitType.STOP_LOSS, event="auto_stop_loss_hit")
            return

        # Once trailing has activated (see _partial_close), the final
        # runner leg is managed entirely by _check_trailing instead of
        # the static TP-ladder loop below — see Trade.trailing_active's
        # own comment for the full "let winners run" mechanism.
        if trade.trailing_active:
            await self._check_trailing(db, trade, price)
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
                fraction = await self._target_fraction(db, trade, idx, configured)
                await self._partial_close(db, trade, exit_price=target_price, fraction=fraction, level=level, event=f"auto_take_profit_{level}_hit")
            return  # one trigger per trade per cycle — the next cycle re-reads the (now updated) row

    async def _target_fraction(self, db, trade: Trade, idx: int, configured: list) -> float:
        """What fraction of the CURRENT remaining lot_size to close at
        configured[idx] (relative to what's left, not the original
        size — e.g. 30% of the original at TP1 needs fraction=0.30
        there, but 40%-of-original at TP2 needs fraction=40/70 of
        what's left AFTER TP1 already took its 30%).

        Defaults to an even split across whatever targets remain (e.g.
        half if TP1+TP2 only, a third if TP1+TP2+TP3) — the original,
        still-correct behavior for a manual trade, which has no
        BotConfig row to read a split from. For a bot-placed trade,
        uses that bot's own tp1_percent/tp2_percent/tp3_percent
        (BotConfig) instead, so a multi-target close actually matches
        the 30/40/30 allocation its own signal was drafted against
        (smc_algorithms.py's calculate_targets) rather than silently
        ignoring those columns for a flat even split — closing the gap
        found alongside the TP-always-~2R bug this was fixed with.
        """
        remaining = len(configured) - idx
        even = 1.0 / remaining
        if not trade.bot_id or trade.bot_id.startswith("manual_"):
            return even
        bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == trade.bot_id))).scalar_one_or_none()
        if bot is None:
            return even
        percents = [bot.tp1_percent or 0, bot.tp2_percent or 0, bot.tp3_percent or 0]
        remaining_levels = [configured[i][0] for i in range(idx, len(configured))]
        remaining_percents = [percents[level - 1] for level in remaining_levels]
        total = sum(remaining_percents)
        if total <= 0:
            return even
        return remaining_percents[0] / total

    async def _partial_close(self, db, trade: Trade, exit_price: float, fraction: float, level: int, event: str) -> None:
        closed_size = trade.lot_size * fraction
        direction_sign = 1 if trade.direction == TradeDirection.LONG else -1
        pnl_this_close = direction_sign * (exit_price - trade.entry_price) * closed_size

        # Live trade: reduce the REAL broker position FIRST, strictly
        # gated on that succeeding — no DB mutation at all on a
        # failure, so this can never claim a reduction that didn't
        # actually happen at the broker. Exactly the same discipline
        # manual_trading.py's own partial_close endpoint already
        # established for a human-triggered partial close; this is the
        # automated equivalent. A failure here just means the next
        # 20s cycle re-reads the still-unchanged row and retries —
        # no partial/inconsistent state is ever left behind.
        if not trade.is_test:
            broker_result = await self._engine.close_broker_position(
                trade.broker_name, trade.symbol, trade.direction.value, trade.bot_id, db,
                paper=False, quantity=closed_size, user_id=trade.user_id,
            )
            if not broker_result.get("success"):
                logger.warning(
                    "position_monitor_live_partial_close_broker_failed", trade_id=trade.trade_id,
                    level=level, error=broker_result.get("error") or broker_result.get("message"),
                )
                await db.rollback()
                return

        trade.lot_size = round(trade.lot_size - closed_size, 8)
        trade.realized_pnl = (trade.realized_pnl or 0.0) + pnl_this_close
        if level == 1:
            trade.tp1_triggered = True
        elif level == 2:
            trade.tp2_triggered = True

        # Ratchet + trailing activation — the real "let winners run"
        # mechanism, by direct request after a real screenshot showed
        # Actual R capped at ~2.3R repeatedly. Gated entirely on
        # trailing_activation_r being set (None means use_trailing_stop
        # was off at trade-creation time — old, unchanged behavior).
        # Tighten-only (max/min guarded) so the floor can never loosen,
        # whatever level fires.
        if trade.trailing_activation_r is not None:
            is_long = trade.direction == TradeDirection.LONG
            if level == 1:
                # Breakeven the moment the trade has proven itself at
                # TP1 — fixes the real "give-back" bug this was built
                # from (TRD_bot_3_fvg_expansion_2_20261009_003055: hit
                # TP1 AND TP2, then reversed all the way back to the
                # ORIGINAL stop, closing at 0.8R instead of something
                # close to what TP2 had already proven).
                trade.stop_loss = max(trade.stop_loss, trade.entry_price) if is_long else min(trade.stop_loss, trade.entry_price)
            elif level == 2 and trade.take_profit_1 is not None:
                trade.stop_loss = max(trade.stop_loss, trade.take_profit_1) if is_long else min(trade.stop_loss, trade.take_profit_1)

            # Activation — 1.0 (after TP1) or 2.0 (after TP2, the
            # default) matches this level's own R-multiple exactly
            # (TP1/TP2 are defined at exactly 1R/2R by
            # smc_algorithms.calculate_targets), so a plain equality
            # check is all that's needed. _partial_close is only ever
            # called for a non-last level (the last level always goes
            # through _close instead), so there's always a genuine
            # runner leg left once this fires.
            if float(level) == trade.trailing_activation_r:
                trade.trailing_active = True
                trade.trailing_peak_price = exit_price
                trade.trailing_stop_price = self._trailing_stop_from_peak(trade, exit_price)

            # Live trade: best-effort push the (already tightened-only)
            # ratcheted stop to the broker too, where supported — a
            # failed sync here just leaves the broker's own resting
            # stop at an old-but-still-safe level, never loosens it, so
            # (unlike the broker-side CLOSE above) this never blocks or
            # reverts the DB-side ratchet. Same "DB always wins, broker
            # sync is best-effort" pattern as manual_trading.py's own
            # modify_targets.
            if not trade.is_test:
                from app.services.execution_engine import SL_SYNC_CAPABLE_BROKERS
                if trade.broker_name in SL_SYNC_CAPABLE_BROKERS:
                    sync_result = await self._engine.update_broker_stop_loss_take_profit(
                        trade.broker_name, trade.symbol, trade.direction.value, trade.bot_id, db,
                        paper=False, stop_loss=trade.stop_loss, user_id=trade.user_id,
                    )
                    if not sync_result.get("success"):
                        logger.warning(
                            "position_monitor_live_sl_sync_failed", trade_id=trade.trade_id,
                            error=sync_result.get("error") or sync_result.get("message"),
                        )

        db.add(TradeLog(
            trade_id=trade.trade_id, event_type=event,
            event_data={"exit_price": exit_price, "closed_lot_size": round(closed_size, 8), "realized_pnl_this_close": round(pnl_this_close, 2)},
            price_at_event=exit_price, pnl_at_event=round(pnl_this_close, 2),
        ))
        await db.commit()
        if not trade.is_test:
            await apply_performance_fee(db, trade, pnl_this_close)
        logger.info("position_monitor_partial_close", trade_id=trade.trade_id, level=level, exit_price=exit_price, pnl=round(pnl_this_close, 2))

    async def _close(self, db, trade: Trade, exit_price: float, exit_type: ExitType, event: str) -> None:
        direction_sign = 1 if trade.direction == TradeDirection.LONG else -1
        pnl_this_close = direction_sign * (exit_price - trade.entry_price) * trade.lot_size

        # Live trade: close the REAL remaining broker position FIRST
        # (no quantity = full remaining close, same as manual_trading.py's
        # own cancel_order), strictly gated on success — same reasoning
        # as _partial_close's own identical guard above.
        if not trade.is_test:
            broker_result = await self._engine.close_broker_position(
                trade.broker_name, trade.symbol, trade.direction.value, trade.bot_id, db,
                paper=False, user_id=trade.user_id,
            )
            if not broker_result.get("success"):
                logger.warning(
                    "position_monitor_live_close_broker_failed", trade_id=trade.trade_id,
                    exit_type=exit_type.value, error=broker_result.get("error") or broker_result.get("message"),
                )
                await db.rollback()
                return

        trade.realized_pnl = (trade.realized_pnl or 0.0) + pnl_this_close
        trade.lot_size = 0.0
        trade.status = TradeStatus.CLOSED
        trade.exit_price = exit_price
        # Naive UTC, not datetime.now(timezone.utc) — Trade.exit_timestamp
        # is a plain DateTime column (no timezone=True). Same bug class
        # confirmed live for pending_order_monitor.py's own
        # entry_timestamp write (see its own comment): asyncpg raises
        # "can't subtract offset-naive and offset-aware datetimes" on
        # commit for a tz-aware value into a naive column, which would
        # have silently broken every paper trade's automatic TP/SL close
        # the same way it broke every pending-order fill. Fixed
        # proactively here before a real close ever hit it in production.
        trade.exit_timestamp = datetime.utcnow()
        trade.exit_type = exit_type
        # Blended across every leg (TP1/TP2 partials + this final
        # close), not just this leg's own price — critical bug fix,
        # see compute_blended_r_multiple's own docstring.
        trade.r_multiple = compute_blended_r_multiple(
            trade.realized_pnl, trade.risk_amount, trade.entry_price, exit_price, trade.stop_loss, trade.direction,
        )

        db.add(TradeLog(
            trade_id=trade.trade_id, event_type=event,
            event_data={"exit_price": exit_price, "realized_pnl_this_close": round(pnl_this_close, 2)},
            price_at_event=exit_price, pnl_at_event=round(pnl_this_close, 2),
        ))
        await db.commit()
        if not trade.is_test:
            await apply_performance_fee(db, trade, pnl_this_close)
            # Position is confirmed flat now — clean up any still-
            # resting broker-side order from entry (Binance only; see
            # cancel_stale_broker_orders' own docstring for why every
            # other broker here is safe by construction). Best-effort,
            # logged only — never blocks on this close, which has
            # already fully succeeded by this point.
            cleanup_result = await self._engine.cancel_stale_broker_orders(
                trade.broker_name, trade.symbol, trade.bot_id, db, paper=False, user_id=trade.user_id,
            )
            if not cleanup_result.get("success") and not cleanup_result.get("skipped"):
                logger.warning(
                    "position_monitor_live_stale_order_cleanup_failed", trade_id=trade.trade_id,
                    error=cleanup_result.get("error"),
                )
        logger.info("position_monitor_closed", trade_id=trade.trade_id, exit_type=exit_type.value, exit_price=exit_price, pnl=round(pnl_this_close, 2))

    def _trailing_stop_from_peak(self, trade: Trade, peak: float) -> Optional[float]:
        """The trail level implied by the given peak — delegates to
        compute_trailing_stop (smc_algorithms.py), the single shared
        formula also used by backtest_engine.py's own replay, keyed by
        trade.trailing_stop_distance (resolved once at trade-creation
        time, same "snapshot at open" convention as initial_stop_loss
        itself). Reuses initial_stop_loss (not the live, already-
        ratcheted stop_loss) as the distance basis for every mode."""
        if trade.initial_stop_loss is None:
            return None
        sl_distance = abs(trade.entry_price - trade.initial_stop_loss)
        if sl_distance <= 0:
            return None
        is_long = trade.direction == TradeDirection.LONG
        return compute_trailing_stop(
            trade.entry_price, trade.initial_stop_loss, "long" if is_long else "short",
            peak, mode=trade.trailing_stop_distance or "fixed",
        )

    async def _check_trailing(self, db, trade: Trade, price: float) -> None:
        """Manages the final runner leg once trailing has activated
        (see _partial_close) — replaces what used to be a hard,
        fixed-price close on the last configured TP level. Advances
        the peak/trail level only in the favorable direction each
        cycle, and closes the entire remaining position the moment
        price crosses the trail — which can land well beyond the old
        static target when the move keeps going, the actual "let
        winners run" improvement this was built for. The honest
        trade-off, stated plainly: a trade that touches the old static
        target and instantly reverses can close for a little LESS than
        that guaranteed target would have — the inherent cost of
        giving a winner room to run further the rest of the time."""
        is_long = trade.direction == TradeDirection.LONG

        if trade.initial_stop_loss is None or abs(trade.entry_price - trade.initial_stop_loss) <= 0:
            # Shouldn't happen for a trade that reached activation
            # (initial_stop_loss is always set at creation) — defensive
            # fallback: close at the current price rather than trail
            # forever with no known distance.
            await self._close(db, trade, exit_price=price, exit_type=ExitType.TRAILING, event="auto_trailing_stop_no_distance")
            return

        peak = trade.trailing_peak_price
        peak = max(peak, price) if is_long else min(peak, price)
        trade.trailing_peak_price = peak
        trail_stop = self._trailing_stop_from_peak(trade, peak)
        trade.trailing_stop_price = trail_stop

        hit = (price <= trail_stop) if is_long else (price >= trail_stop)
        if hit:
            await self._close(db, trade, exit_price=trail_stop, exit_type=ExitType.TRAILING, event="auto_trailing_stop_hit")
        else:
            await db.commit()
