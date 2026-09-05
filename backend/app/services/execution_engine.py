
"""
Execution Engine: Updated with BingX and TradeLocker support
"""

from typing import Optional, Dict, List
from datetime import datetime
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.core.bot_strategies import BotSignal
from app.services.broker_integrations import (
    BingXBroker, TradeLockerBroker, BinanceBroker, BybitBroker, MexcBroker, MetaApiBroker,
)
from app.services.broker_credentials import build_broker_client

logger = structlog.get_logger()
settings = get_settings()

class ExecutionEngine:
    """Core execution engine with multi-broker support."""

    def __init__(self):
        self.settings = get_settings()
        self.pending_trades: List[Dict] = []
        self.active_trades: List[Dict] = []
        self.daily_trade_count = 0

        # Initialize broker clients — only exchanges with a configured
        # API key are wired up; everything else stays in paper mode.
        # Each routes its signed calls through its own Fixie static-IP
        # proxy when one is set (BINGX_PROXY_URL etc.) — most exchanges
        # require whitelisting a fixed IP for a trading-enabled key,
        # which Render's own (dynamic) egress IP can't satisfy.
        self.brokers = {}
        if self.settings.BINGX_API_KEY:
            self.brokers["bingx"] = BingXBroker(
                self.settings.BINGX_API_KEY,
                self.settings.BINGX_SECRET,
                proxy=self.settings.BINGX_PROXY_URL or None,
                backup_proxy=self.settings.BINGX_BACKUP_PROXY_URL or None,
            )
        if self.settings.TRADELOCKER_API_KEY:
            self.brokers["tradelocker"] = TradeLockerBroker(
                self.settings.TRADELOCKER_API_KEY,
                self.settings.TRADELOCKER_SECRET,
                self.settings.TRADELOCKER_ACCOUNT_ID
            )
        if self.settings.BINANCE_API_KEY:
            self.brokers["binance"] = BinanceBroker(
                self.settings.BINANCE_API_KEY,
                self.settings.BINANCE_SECRET,
                proxy=self.settings.BINANCE_PROXY_URL or None,
                backup_proxy=self.settings.BINANCE_BACKUP_PROXY_URL or None,
            )
        if self.settings.BYBIT_API_KEY:
            self.brokers["bybit"] = BybitBroker(
                self.settings.BYBIT_API_KEY,
                self.settings.BYBIT_SECRET,
                proxy=self.settings.BYBIT_PROXY_URL or None,
                backup_proxy=self.settings.BYBIT_BACKUP_PROXY_URL or None,
            )
        if self.settings.MEXC_API_KEY:
            self.brokers["mexc"] = MexcBroker(
                self.settings.MEXC_API_KEY,
                self.settings.MEXC_SECRET,
                proxy=self.settings.MEXC_PROXY_URL or None,
                backup_proxy=self.settings.MEXC_BACKUP_PROXY_URL or None,
            )
        if self.settings.METAAPI_TOKEN and self.settings.METAAPI_ACCOUNT_ID:
            self.brokers["metatrader"] = MetaApiBroker(
                self.settings.METAAPI_TOKEN,
                self.settings.METAAPI_ACCOUNT_ID,
                self.settings.METAAPI_REGION,
            )

        # One instance per exchange, always available regardless of
        # whether that exchange has a real API key configured above —
        # backs the manual-trading Paper Trading toggle (independent of
        # Test/Live), not to be confused with this class's own
        # pre-existing "paper" fallback string in _determine_broker/
        # _execute_broker_order (that one means "no broker could be
        # determined at all"; this is a deliberate, per-exchange
        # simulated fill). Each broker's own paper=True short-circuits
        # place_order/cancel_order before any signed/authenticated call
        # would go out (see broker_integrations.py), so no real
        # credentials are needed here — empty strings are fine.
        self.paper_brokers = {
            "bingx": BingXBroker("", "", paper=True),
            "tradelocker": TradeLockerBroker("", "", paper=True),
            "binance": BinanceBroker("", "", paper=True),
            "bybit": BybitBroker("", "", paper=True),
            "mexc": MexcBroker("", "", paper=True),
            "metatrader": MetaApiBroker("", "", paper=True),
        }

    async def process_signal(self, signal: BotSignal, mode: str = "human_in_loop", db: Optional[AsyncSession] = None) -> Dict:
        """
        Process a bot signal into a trade action. `db` is optional (a
        live DB session enables per-bot broker credentials — see
        _get_broker_client — and is threaded through from the caller,
        e.g. webhook_processor.py or market_scanner.py; without it,
        every bot shares the single global-key broker per exchange,
        which still works fine for a single-account setup).
        """

        trade_data = {
            "trade_id": f"TRD_{signal.bot_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "bot_id": signal.bot_id,
            "bot_name": signal.bot_name,
            "symbol": signal.symbol,
            "direction": signal.direction,
            "entry_price": signal.entry_price,
            "stop_loss": signal.stop_loss,
            "take_profit": signal.take_profit,
            "lot_size": signal.lot_size,
            "risk_percent": signal.risk_percent,
            "risk_amount": signal.lot_size * abs(signal.entry_price - signal.stop_loss),
            "preferred_broker": signal.preferred_broker,
            "strategy_type": signal.bot_name,
            "confidence": signal.confidence,
            "reasoning": signal.reasoning,
            "timestamp": signal.timestamp,
            "status": "pending_approval" if mode == "human_in_loop" else "executing",
            "requires_approval": mode == "human_in_loop",
            "execution_mode": mode
        }

        # Also persist to the real `trades` table whenever a DB session
        # is available (webhook and market_scanner callers always pass
        # one). Without this, process_signal only ever wrote to this
        # instance's in-memory pending_trades list — invisible to
        # GET /trades/pending-approvals (which reads the Trade table)
        # and to POST /trades/approve when it runs in a different
        # ExecutionEngine instance (the webhook router and the trades
        # router each construct their own). That gap meant every
        # webhook-drafted trade was, in practice, unapprovable and
        # invisible on the dashboard — a real problem now that
        # market_scanner.py can generate many more signals than the
        # rare manual webhook ever did.
        if db is not None:
            await self._persist_trade(db, trade_data)

        if mode == "human_in_loop":
            self.pending_trades.append(trade_data)
            logger.info("trade_drafted", trade_id=trade_data["trade_id"], bot=signal.bot_name, symbol=signal.symbol)
            return {
                "success": True,
                "status": "pending_approval",
                "trade_id": trade_data["trade_id"],
                "message": f"Trade drafted: {signal.symbol} {signal.direction} @ {signal.entry_price}"
            }
        else:
            result = await self._execute_broker_order(trade_data, db)
            if result["success"]:
                trade_data["status"] = "active"
                trade_data["broker_order_id"] = result.get("order_id")
                self.active_trades.append(trade_data)
                self.daily_trade_count += 1
                if db is not None:
                    await self._update_trade_after_execution(db, trade_data["trade_id"], result)
            return result

    async def _persist_trade(self, db: AsyncSession, trade_data: Dict) -> None:
        """Insert the real Trade row a drafted/executing signal produces."""
        from sqlalchemy import select
        from app.models.trade import Trade, TradeDirection  # local import: avoids a circular import at module load
        from app.models.bot import BotConfig

        # A trade has no owner of its own in the request — it's drafted
        # from a TradingView signal, not a direct user API call — so it
        # inherits its owning bot's user_id. Left None if the bot itself
        # has none (pre-ownership bot) or doesn't exist; see
        # migrations/008_bot_trade_ownership.sql.
        bot_config = (await db.execute(
            select(BotConfig).where(BotConfig.bot_id == trade_data["bot_id"])
        )).scalar_one_or_none()

        trade = Trade(
            trade_id=trade_data["trade_id"],
            user_id=bot_config.user_id if bot_config else None,
            bot_id=trade_data["bot_id"],
            bot_name=trade_data["bot_name"],
            strategy_type=trade_data["strategy_type"],
            symbol=trade_data["symbol"],
            direction=TradeDirection.LONG if trade_data["direction"] == "long" else TradeDirection.SHORT,
            entry_price=trade_data["entry_price"],
            stop_loss=trade_data["stop_loss"],
            take_profit_1=trade_data["take_profit"],
            lot_size=trade_data["lot_size"],
            risk_percent=trade_data["risk_percent"],
            risk_amount=trade_data["risk_amount"],
            reasoning_log=trade_data.get("reasoning", ""),
            requires_approval=trade_data["requires_approval"],
            broker_name=trade_data.get("preferred_broker"),
        )
        db.add(trade)
        await db.commit()

    async def _update_trade_after_execution(self, db: AsyncSession, trade_id: str, result: Dict) -> None:
        from sqlalchemy import select
        from app.models.trade import Trade, TradeStatus

        row = (await db.execute(select(Trade).where(Trade.trade_id == trade_id))).scalar_one_or_none()
        if row:
            row.status = TradeStatus.ACTIVE
            row.entry_timestamp = datetime.utcnow()
            row.broker_order_id = str(result.get("order_id", ""))
            row.broker_name = result.get("broker", row.broker_name)
            await db.commit()

    async def approve_trade(self, trade_id: str, approved: bool, notes: str = "", db: Optional[AsyncSession] = None) -> Dict:
        """
        Manual approval handler. Checks the real Trade table first (the
        source of truth once a DB session is available — see
        process_signal's note above on why the in-memory list alone
        isn't reliable across router instances or a restart), falling
        back to the in-memory list only when no `db` is given.
        """
        from sqlalchemy import select
        from app.models.trade import Trade, TradeStatus

        if db is not None:
            row = (await db.execute(select(Trade).where(Trade.trade_id == trade_id))).scalar_one_or_none()
            if not row:
                return {"success": False, "message": "Trade not found"}

            if approved:
                trade = {
                    "trade_id": row.trade_id, "bot_id": row.bot_id, "symbol": row.symbol,
                    "direction": "long" if row.direction.value == "long" else "short",
                    "entry_price": row.entry_price, "stop_loss": row.stop_loss,
                    "take_profit": row.take_profit_1, "lot_size": row.lot_size,
                    "preferred_broker": row.broker_name,
                }
                result = await self._execute_broker_order(trade, db)
                if result["success"]:
                    row.status = TradeStatus.ACTIVE
                    row.entry_timestamp = datetime.utcnow()
                    row.approved_at = datetime.utcnow()
                    row.approval_notes = notes
                    row.broker_order_id = str(result.get("order_id", ""))
                    row.broker_name = result.get("broker", row.broker_name)
                    await db.commit()
                    self.daily_trade_count += 1
                    return {"success": True, "message": "Trade approved and executed", "trade_id": trade_id}
                return {"success": False, "message": f"Approval granted but execution failed: {result.get('error')}"}
            else:
                row.status = TradeStatus.CANCELLED
                row.approval_notes = notes
                await db.commit()
                return {"success": True, "message": "Trade rejected", "trade_id": trade_id}

        # No DB session — legacy in-memory-only path.
        trade = None
        for t in self.pending_trades:
            if t["trade_id"] == trade_id:
                trade = t
                break

        if not trade:
            return {"success": False, "message": "Trade not found"}

        if approved:
            result = await self._execute_broker_order(trade, db)
            if result["success"]:
                trade["status"] = "active"
                trade["approved_at"] = datetime.utcnow()
                trade["approval_notes"] = notes
                self.active_trades.append(trade)
                self.pending_trades.remove(trade)
                self.daily_trade_count += 1
                return {"success": True, "message": "Trade approved and executed", "trade_id": trade_id}
            else:
                return {"success": False, "message": f"Approval granted but execution failed: {result.get('error')}"}
        else:
            trade["status"] = "rejected"
            trade["rejection_notes"] = notes
            self.pending_trades.remove(trade)
            return {"success": True, "message": "Trade rejected", "trade_id": trade_id}

    async def _get_broker_client(self, broker: str, bot_id: Optional[str], db: Optional[AsyncSession], paper: bool = False):
        """
        `paper=True` (the manual-trading Paper Trading toggle — see
        __init__'s self.paper_brokers) always wins outright and skips
        the per-bot-credential lookup entirely: a paper fill needs no
        real credentials of any kind, and a bot/user's real per-broker
        key is exactly the thing paper mode exists to avoid touching.

        Otherwise, a bot-specific credential (see broker_credentials.py,
        one of your 4-6 sub-accounts per exchange) wins when one exists;
        falls back to the single global-key client for that exchange
        (self.brokers, from BINANCE_API_KEY etc.) so a bot with no
        credential row of its own keeps working exactly as before.
        Returns None if neither exists (-> the OTHER, pre-existing
        "paper" meaning in _determine_broker/_execute_broker_order below:
        no broker could be determined at all, unrelated to the Paper
        Trading toggle).
        """
        if paper:
            return self.paper_brokers.get(broker)
        if db is not None and bot_id is not None:
            try:
                credential_client = await build_broker_client(db, bot_id, broker)
                if credential_client is not None:
                    return credential_client
            except Exception as e:
                logger.error("per_bot_credential_lookup_failed", bot_id=bot_id, broker=broker, error=str(e))
        return self.brokers.get(broker)

    async def cancel_broker_order(
        self, broker: Optional[str], order_id: Optional[str], symbol: str,
        bot_id: Optional[str], db: Optional[AsyncSession] = None, is_stop: bool = False,
        paper: bool = False,
    ) -> Dict:
        """
        Cancel a still-open order at the broker that actually accepted
        it — the counterpart to _execute_broker_order for the one thing
        it never needed to do until now (manual_trading.py's own cancel
        endpoint previously just 501'd here, honestly, since no broker
        integration implemented a cancel call at all). `broker`/`bot_id`
        should come from the Trade row's own broker_name/bot_id — the
        broker that actually filled/accepted this specific order — not
        re-derived from the symbol the way a fresh order's routing is,
        since broker config can change after an order was placed.
        `paper` should mirror whatever the order was actually placed
        with (Trade.is_test, once manual_trading.py unifies Test/Paper
        onto it) — a real trade needs a real broker client to cancel
        against, a paper one needs the matching paper client so its own
        instant-fill semantics apply (see broker_integrations.py's
        _paper_cancel_order).
        """
        if not broker or not order_id:
            return {"success": False, "error": "missing_broker_reference", "message": "No broker order reference stored for this trade — nothing to cancel at a broker."}
        client = await self._get_broker_client(broker, bot_id, db, paper=paper)
        if client is None or not hasattr(client, "cancel_order"):
            return {"success": False, "error": "no_broker_client", "message": f"No {broker} client configured to cancel this order."}
        try:
            return await client.cancel_order(symbol, order_id, is_stop=is_stop)
        except Exception as e:
            logger.error("broker_cancel_failed", broker=broker, order_id=order_id, error=str(e))
            return {"success": False, "error": str(e)}

    async def _execute_broker_order(self, trade: Dict, db: Optional[AsyncSession] = None, paper: bool = False) -> Dict:
        """Execute order via configured broker. `paper=True` is the
        manual-trading Paper Trading toggle: still runs the exact same
        broker-routing/order-shape/price-deviation-guard logic below
        against a real, live-priced ticker, it just never places a real
        order (see _get_broker_client and broker_integrations.py's
        per-broker paper=True short-circuits)."""
        broker = self._determine_broker(trade["symbol"], trade.get("preferred_broker"))
        client = await self._get_broker_client(broker, trade.get("bot_id"), db, paper=paper) if broker != "paper" else None

        try:
            if client is not None:
                # Cross-exchange price sanity guard — a signal's
                # entry_price was computed off whatever exchange fed the
                # bot's candles (see data_ingestion.py), which is not
                # guaranteed to be THIS broker. Refuse to fire blind if
                # the two disagree by more than the configured
                # tolerance; a bad SL/TP/entry from a stale or
                # foreign-exchange price is worse than a skipped trade.
                guard_result = await self._check_price_deviation(client, broker, trade)
                if not guard_result["ok"]:
                    logger.error("price_deviation_guard_blocked", trade_id=trade["trade_id"], **guard_result)
                    return {
                        "success": False,
                        "error": "price_deviation_guard",
                        "message": (
                            f"Blocked: signal entry {guard_result['signal_price']} vs live "
                            f"{broker} price {guard_result['live_price']} differ by "
                            f"{guard_result['deviation_pct']:.3f}% (tolerance "
                            f"{self.settings.PRICE_DEVIATION_TOLERANCE_PCT}%). Re-check the "
                            f"bot's data source against its execution exchange."
                        ),
                    }

            if broker == "bingx" and client is not None:
                return await self._execute_bingx(trade, client)
            elif broker == "tradelocker" and client is not None:
                return await self._execute_tradelocker(trade, client)
            elif broker == "binance" and client is not None:
                return await self._execute_binance(trade, client)
            elif broker == "bybit" and client is not None:
                return await self._execute_bybit(trade, client)
            elif broker == "mexc" and client is not None:
                return await self._execute_mexc(trade, client)
            elif broker == "metatrader" and client is not None:
                return await self._execute_metatrader(trade, client)
            else:
                return {
                    "success": True,
                    "order_id": f"PAPER_{trade['trade_id']}",
                    "broker": "paper",
                    "message": "Paper trade executed (no broker configured)"
                }
        except Exception as e:
            logger.error("broker_execution_failed", error=str(e), trade_id=trade["trade_id"])
            return {"success": False, "error": str(e)}

    async def _check_price_deviation(self, client, broker: str, trade: Dict) -> Dict:
        """
        Pull a live ticker straight from the execution broker and
        compare it to the signal's entry_price. Returns {"ok": True}
        when there's no live price to check against (paper mode, or a
        broker without a ticker method) rather than blocking trades a
        price check can't actually run for.
        """
        signal_price = trade.get("entry_price")
        if not client or signal_price is None or not hasattr(client, "get_ticker_price"):
            return {"ok": True}

        ticker = await client.get_ticker_price(trade["symbol"])
        if not ticker.get("success"):
            # Can't verify — fail open with a warning rather than
            # blocking every trade whenever a ticker call has a hiccup.
            logger.warning("price_check_unavailable", broker=broker, error=ticker.get("error"))
            return {"ok": True}

        live_price = ticker["price"]
        deviation_pct = abs(live_price - signal_price) / live_price * 100 if live_price else 0.0
        ok = deviation_pct <= self.settings.PRICE_DEVIATION_TOLERANCE_PCT
        return {
            "ok": ok,
            "signal_price": signal_price,
            "live_price": live_price,
            "deviation_pct": deviation_pct,
        }

    def _determine_broker(self, symbol: str, preferred_broker: Optional[str] = None) -> str:
        """
        Route to the appropriate broker.

        `preferred_broker` lets a bot config pin exactly which exchange
        it trades on (BotConfig.strategy_params["preferred_broker"]) —
        set this explicitly rather than relying on the symbol heuristic
        below whenever the bot's data source and execution venue need
        to be the same exchange (see _check_price_deviation): if a bot
        pulls candles from Binance, its trades should also execute on
        Binance, not silently land on whichever broker this heuristic
        guesses from the symbol string.
        """
        if preferred_broker:
            # Trust an explicit pin even if there's no *global* key for
            # it — a per-bot credential (broker_credentials.py) might
            # be the only thing configured for this exchange, and
            # _get_broker_client checks that separately.
            return preferred_broker

        symbol_upper = symbol.upper()

        # Crypto pairs (BTCUSDT, ETHUSDT, etc.) — prefer whichever
        # configured crypto broker is available, in a fixed order.
        if "USDT" in symbol_upper or "USD" in symbol_upper:
            for candidate in ("bingx", "binance", "bybit", "mexc"):
                if candidate in self.brokers:
                    return candidate
            return "binance"

        # TradeLocker: Forex and prop firm accounts
        if len(symbol) == 6 and symbol.isalpha():
            if "tradelocker" in self.brokers:
                return "tradelocker"
            return "metatrader"

        # Default
        return "paper"

    async def _execute_bingx(self, trade: Dict, broker) -> Dict:
        """Execute via BingX."""
        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = {"limit": "LIMIT", "stop": "STOP"}.get(trade.get("entry_type"), "MARKET")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )

        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "bingx",
                "message": f"BingX order placed: {result['status']}"
            }
        return result

    async def _execute_tradelocker(self, trade: Dict, broker) -> Dict:
        """Execute via TradeLocker."""
        side = "buy" if trade["direction"] == "long" else "sell"
        order_type = {"limit": "limit", "stop": "stop"}.get(trade.get("entry_type"), "market")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )

        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "tradelocker",
                "message": f"TradeLocker order placed: {result['status']}"
            }
        return result

    async def _execute_binance(self, trade: Dict, broker) -> Dict:
        """Execute via Binance USDT-M Futures."""
        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = {"limit": "LIMIT", "stop": "STOP"}.get(trade.get("entry_type"), "MARKET")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )
        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "binance",
                "message": f"Binance order placed: {result['status']}"
            }
        return result

    async def _execute_bybit(self, trade: Dict, broker) -> Dict:
        """Execute via Bybit V5 (linear/USDT perpetuals)."""
        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = {"limit": "LIMIT", "stop": "STOP"}.get(trade.get("entry_type"), "MARKET")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )
        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "bybit",
                "message": f"Bybit order placed: {result['status']}"
            }
        return result

    async def _execute_mexc(self, trade: Dict, broker) -> Dict:
        """Execute via MEXC Futures (contract)."""
        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = {"limit": "LIMIT", "stop": "STOP"}.get(trade.get("entry_type"), "MARKET")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )
        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "mexc",
                "message": f"MEXC order placed: {result['status']}"
            }
        return result

    async def _execute_metatrader(self, trade: Dict, broker) -> Dict:
        """
        Execute via MT4/MT5 (MetaApi.cloud). This used to be a stub that
        fabricated a fake success with no real broker call at all —
        replaced now that MetaApiBroker exists (see
        broker_integrations.py for prerequisites: it needs a MetaApi
        account with your real MT4/5 login connected and deployed there
        first).
        """
        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = {"limit": "LIMIT", "stop": "STOP"}.get(trade.get("entry_type"), "MARKET")

        result = await broker.place_order(
            symbol=trade["symbol"],
            side=side,
            order_type=order_type,
            quantity=trade["lot_size"],
            price=trade.get("entry_price"),
            stop_loss=trade.get("stop_loss"),
            take_profit=trade.get("take_profit")
        )
        if result["success"]:
            return {
                "success": True,
                "order_id": result["order_id"],
                "broker": "metatrader",
                "message": f"MT4/5 order placed: {result['status']}"
            }
        return result

    async def close_trade(self, trade_id: str, exit_price: float, exit_type: str) -> Dict:
        """Close an active trade."""
        for trade in self.active_trades:
            if trade["trade_id"] == trade_id:
                trade["status"] = "closed"
                trade["exit_price"] = exit_price
                trade["exit_type"] = exit_type
                trade["exit_timestamp"] = datetime.utcnow()

                if trade["direction"] == "long":
                    pnl = (exit_price - trade["entry_price"]) * trade["lot_size"]
                else:
                    pnl = (trade["entry_price"] - exit_price) * trade["lot_size"]

                trade["realized_pnl"] = pnl
                sl_dist = abs(trade["entry_price"] - trade["stop_loss"])
                if sl_dist > 0:
                    trade["r_multiple"] = pnl / (sl_dist * trade["lot_size"])

                self.active_trades.remove(trade)
                return {"success": True, "trade_id": trade_id, "pnl": pnl, "r_multiple": trade.get("r_multiple", 0)}
        return {"success": False, "message": "Active trade not found"}

    async def update_trailing_stop(self, trade_id: str, new_sl: float) -> Dict:
        """Update stop loss for trailing stop."""
        for trade in self.active_trades:
            if trade["trade_id"] == trade_id:
                old_sl = trade["stop_loss"]
                trade["stop_loss"] = new_sl
                trade["sl_updates"] = trade.get("sl_updates", []) + [{
                    "old": old_sl, "new": new_sl, "timestamp": datetime.utcnow().isoformat()
                }]
                return {"success": True, "trade_id": trade_id, "new_sl": new_sl}
        return {"success": False, "message": "Trade not found"}

    def get_batch_allocation(self, signals: List[BotSignal], batch_size: int = 5) -> List[Dict]:
        """Batch allocation engine."""
        if not signals:
            return []
        if len(signals) > batch_size:
            signals = sorted(signals, key=lambda x: x.confidence, reverse=True)[:batch_size]

        allocations = []
        total_confidence = sum(s.confidence for s in signals)

        for signal in signals:
            weight = signal.confidence / total_confidence if total_confidence > 0 else 1.0 / len(signals)
            allocations.append({
                "bot_id": signal.bot_id,
                "symbol": signal.symbol,
                "direction": signal.direction,
                "confidence": signal.confidence,
                "allocation_weight": round(weight, 2),
                "recommended_risk": round(signal.risk_percent * weight, 2),
                "lot_size": signal.lot_size,
                "entry": signal.entry_price,
                "sl": signal.stop_loss,
                "tp": signal.take_profit
            })
        return allocations
