
"""
Execution Engine: Updated with BingX and TradeLocker support
"""

from typing import Optional, Dict, List
from datetime import datetime
import httpx
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.core.bot_strategies import BotSignal
from app.services.broker_integrations import (
    BingXBroker, TradeLockerBroker, BinanceBroker, BybitBroker, MexcBroker, MetaApiBroker,
    _FAILOVER_EXCEPTIONS,
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

    async def _bot_paper_mode(self, db: Optional[AsyncSession], bot_id: str) -> bool:
        """The same three-way OR manual_trading.py's own `paper` local
        computes for a trader (Test mode, OR this bot's own independent
        Paper Trading toggle, OR the Super Admin platform-wide kill-
        switch) — by direct request ("do the same and do paper trading
        for bot trading ... with a test/paper trading toggle ... so we
        can use paper trading in test mode ... with an additional
        option to toggle paper trading in live mode"). Before this, a
        bot's signals always executed with `paper` defaulting to False
        — no bot ever had a way to rehearse in Test mode or Paper
        Trading at all, and Trade.is_test was never set for a bot trade
        either, which also meant services/position_monitor.py (scoped
        to is_test=True) could never manage one.

        Defaults to False (real) when no db session is available — the
        same tolerant fallback _get_broker_client already makes for a
        caller with no DB access to look anything up against."""
        if db is None:
            return False
        from sqlalchemy import select as _select
        from app.models.bot import BotConfig
        from app.models.trade import TradingMode
        from app.services.manual_trading import get_master_paper_enforced

        bot = (await db.execute(_select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        bot_paper = bool(bot and (bot.trading_mode == TradingMode.TEST or bot.paper_trading_enabled))
        return bot_paper or await get_master_paper_enforced(db)

    async def _bot_owner_user_id(self, db: Optional[AsyncSession], bot_id: str):
        """The bot's owning trader — real bug fixed here, found during
        the bot-side half of a trade-execution audit ("check on the bot
        side, fix and update if not working"): _get_broker_client's own
        trader-connection lookup (see its own docstring) only ever
        fires when the trade dict carries a `user_id`. place_manual_order
        sets one, but process_signal/approve_trade — the actual
        bot-driven paths, which are most of this platform's real trade
        volume — never did, so a trader's own connected exchange
        account was silently never used for any autonomous or
        human-in-the-loop bot trade, only for a manual click. Returns
        None (falls back to the shared platform key, same as before)
        when no db session is available or the bot has no owner."""
        if db is None:
            return None
        from sqlalchemy import select as _select
        from app.models.bot import BotConfig

        bot = (await db.execute(_select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        return bot.user_id if bot else None

    async def process_signal(self, signal: BotSignal, mode: str = "human_in_loop", db: Optional[AsyncSession] = None) -> Dict:
        """
        Process a bot signal into a trade action. `db` is optional (a
        live DB session enables per-bot broker credentials — see
        _get_broker_client — and is threaded through from the caller,
        e.g. webhook_processor.py or market_scanner.py; without it,
        every bot shares the single global-key broker per exchange,
        which still works fine for a single-account setup).
        """
        # Computed once, up front, so it's baked into trade_data before
        # _persist_trade writes the Trade row below — a Human-in-the-
        # Loop signal doesn't execute until approve_trade, sometimes
        # much later, so this bot's OWN Test/Paper setting has to be
        # captured at draft time, not re-read (and potentially having
        # since changed) at approval time.
        paper = await self._bot_paper_mode(db, signal.bot_id)
        owner_user_id = await self._bot_owner_user_id(db, signal.bot_id)

        trade_data = {
            "is_test": paper,
            "user_id": owner_user_id,
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
            # Copy this same signal onto every trader who's subscribed
            # this bot to one of their own connected accounts — see
            # _fan_out_to_subscribers' own docstring. Independent of
            # THIS bot's own mode/paper status above: each subscriber's
            # copy gets its own separate Trade row, own broker routing,
            # and own auto/manual approval behavior.
            await self._fan_out_to_subscribers(db, signal.bot_id, trade_data)

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
            result = await self._execute_broker_order(trade_data, db, paper=paper)
            if result["success"]:
                trade_data["status"] = "active"
                trade_data["broker_order_id"] = result.get("order_id")
                self.active_trades.append(trade_data)
                self.daily_trade_count += 1
                if db is not None:
                    await self._update_trade_after_execution(db, trade_data["trade_id"], result)
            elif db is not None:
                # Real bug fixed here, found during a trade-execution
                # audit: a fully-autonomous bot's Trade row is inserted
                # by _persist_trade above BEFORE this broker call runs,
                # at its column default of PENDING — nothing here ever
                # updated it on a FAILED execution, so a rejected/failed
                # autonomous order was left stuck at PENDING forever,
                # indistinguishable from a still-resting order, with no
                # record anywhere that it had actually failed.
                # manual_trading.py's own place_manual_order already
                # marks ERROR on this exact failure case; this is that
                # same handling for the autonomous-bot path.
                await self._mark_trade_error(db, trade_data["trade_id"], result)
            return result

    async def _persist_trade(self, db: AsyncSession, trade_data: Dict) -> None:
        """Insert the real Trade row a drafted/executing signal produces."""
        from app.models.trade import Trade, TradeDirection  # local import: avoids a circular import at module load

        # A trade has no owner of its own in the request — it's drafted
        # from a TradingView signal, not a direct user API call — so it
        # inherits its owning bot's user_id, resolved once by
        # process_signal's own _bot_owner_user_id call (also what makes
        # the trader-connection broker routing work for a bot trade —
        # see that helper's docstring). Left None if the bot itself has
        # none (pre-ownership bot) or doesn't exist; see
        # migrations/008_bot_trade_ownership.sql.
        trade = Trade(
            trade_id=trade_data["trade_id"],
            user_id=trade_data.get("user_id"),
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
            # Only set on a subscriber's own copy of this signal (see
            # _fan_out_to_subscribers below) — what makes this trade
            # performance-fee-eligible at all; see Trade.subscription_id's
            # own comment and services/performance_fees.py.
            subscription_id=trade_data.get("subscription_id"),
            # Captured at draft time (see process_signal's own
            # _bot_paper_mode call) — approve_trade reads this same
            # value back later rather than re-computing it, since a
            # Human-in-the-Loop signal can sit pending for a while and
            # this bot's own Test/Paper setting shouldn't silently
            # change what an ALREADY-DRAFTED signal does once approved.
            is_test=trade_data.get("is_test", False),
        )
        db.add(trade)
        await db.commit()

    async def _mark_trade_error(self, db: AsyncSession, trade_id: str, result: Dict) -> None:
        """Counterpart to _update_trade_after_execution for the failure
        case — see process_signal's own comment on why this exists."""
        from sqlalchemy import select
        from app.models.trade import Trade, TradeStatus

        row = (await db.execute(select(Trade).where(Trade.trade_id == trade_id))).scalar_one_or_none()
        if row:
            row.status = TradeStatus.ERROR
            await db.commit()
            logger.error("autonomous_trade_execution_failed", trade_id=trade_id, error=result.get("error") or result.get("message"))

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

    async def _fan_out_to_subscribers(self, db: AsyncSession, bot_id: str, trade_data: Dict) -> None:
        """Copies a fresh bot signal onto every trader who's subscribed
        this bot to one of their own connected exchange accounts (see
        models/trader_broker_connection.py's TraderBotSubscription) —
        by direct follow-up request, after the platform's own
        onboarding-system rollout deliberately scoped this out as "a
        separate, larger execution-scheduling change... not wired in
        yet." Each subscriber gets their own independent Trade row (own
        trade_id, own user_id, own broker client built directly from
        their TraderBrokerConnection) — entirely separate from the
        platform's own pooled-account trade this same signal already
        produced in process_signal, above.

        Per-subscription `copy_mode` (TraderBotSubscription.copy_mode)
        is the "Auto Vs Manual - on Vs off toggle to operate":
          AUTO   — executes immediately on the subscriber's own
                   connection, no approval step, same as a
                   fully_autonomous platform bot.
          MANUAL — drafted as a PENDING, requires_approval trade owned
                   by that trader (the default — safer for real
                   trader money). It shows up on THEIR OWN dashboard's
                   pending-approvals, and approve_trade (which now
                   reads the Trade row's own user_id for broker
                   routing too) is what actually sends it to their
                   broker once they approve it — no separate approval
                   endpoint needed.

        Only fires for a genuinely VERIFIED, active connection with an
        active subscription — an unverified/suspended connection is
        skipped rather than attempting a broker call against
        credentials that have never actually been confirmed to work.
        Uses client_override on _execute_broker_order (see that
        method's own docstring) rather than the normal bot-credential-
        first priority chain, so a copy trade can NEVER silently land
        on the platform's own per-bot sub-account money instead of the
        subscriber's — a real risk since every copy shares the same
        bot_id as the platform's own trade.

        A subsequent close/SL-TP-update alert for this bot+symbol needs
        no separate fan-out of its own — see webhook_processor.py's
        own _handle_management_action, which already matches every
        ACTIVE trade by (bot_id, symbol) regardless of owner.
        """
        from sqlalchemy import select
        from app.models.trader_broker_connection import (
            ConnectionStatus, SubscriptionCopyMode, TraderBotSubscription, TraderBrokerConnection,
        )
        from app.services.trader_broker_connections import build_client_from_connection

        rows = (await db.execute(
            select(TraderBotSubscription, TraderBrokerConnection)
            .join(TraderBrokerConnection, TraderBotSubscription.connection_id == TraderBrokerConnection.id)
            .where(
                TraderBotSubscription.bot_id == bot_id,
                TraderBotSubscription.is_active == True,  # noqa: E712
                TraderBrokerConnection.is_active == True,  # noqa: E712
                TraderBrokerConnection.status == ConnectionStatus.VERIFIED,
            )
        )).all()
        if not rows:
            return

        from app.services.performance_fees import owed_from_previous_days

        base_risk_percent = trade_data.get("risk_percent") or 0.0
        for idx, (sub, conn) in enumerate(rows):
            lot_size = trade_data["lot_size"]
            if sub.risk_per_trade and base_risk_percent:
                # Honest, documented limitation: no per-trader account
                # equity is known here, so this scales proportionally
                # off the platform signal's own sizing rather than a
                # true equity-based size — see TraderBotSubscription's
                # own risk_per_trade field comment.
                lot_size = trade_data["lot_size"] * (sub.risk_per_trade / base_risk_percent)

            is_auto = sub.copy_mode == SubscriptionCopyMode.AUTO
            # The Paystack fee gate (core/fee_gate.py) — an AUTO
            # subscriber who owes performance fees from a previous day
            # gets downgraded to a drafted, requires-approval trade
            # instead of firing live, exactly as if they were on MANUAL
            # copy mode. Nothing is silently skipped: it's still
            # persisted and visible on their own pending-approvals,
            # they just can't have it fire unattended while unpaid.
            # approve_trade below re-checks the same gate before letting
            # them approve it into a live order.
            fees_owed = await owed_from_previous_days(db, sub.user_id) if is_auto else 0.0
            effective_auto = is_auto and fees_owed <= 0

            copy_trade_data = {
                **trade_data,
                "trade_id": f"{trade_data['trade_id']}_SUB{idx}",
                "user_id": sub.user_id,
                "subscription_id": sub.id,  # marks this trade fee-eligible — see Trade.subscription_id's own comment
                "lot_size": round(lot_size, 8),
                "is_test": False,  # a subscriber's own connection is always their real account
                "preferred_broker": conn.exchange,
                "requires_approval": not effective_auto,
            }
            try:
                await self._persist_trade(db, copy_trade_data)
            except Exception as e:
                logger.error("subscriber_copy_persist_failed", user_id=str(sub.user_id), bot_id=bot_id, error=str(e))
                continue

            if not effective_auto:
                if is_auto and fees_owed > 0:
                    logger.info(
                        "subscriber_copy_downgraded_fees_owed", trade_id=copy_trade_data["trade_id"],
                        user_id=str(sub.user_id), fees_owed=fees_owed,
                    )
                else:
                    logger.info("subscriber_copy_drafted", trade_id=copy_trade_data["trade_id"], user_id=str(sub.user_id))
                continue

            try:
                client = build_client_from_connection(conn)
            except Exception as e:
                logger.error("subscriber_copy_client_build_failed", user_id=str(sub.user_id), broker=conn.exchange, error=str(e))
                await self._mark_trade_error(db, copy_trade_data["trade_id"], {"error": str(e)})
                continue

            result = await self._execute_broker_order(copy_trade_data, db, paper=False, client_override=client)
            if result.get("success"):
                await self._update_trade_after_execution(db, copy_trade_data["trade_id"], result)
            else:
                await self._mark_trade_error(db, copy_trade_data["trade_id"], result)

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
                # Same Paystack fee gate as the AUTO-copy downgrade
                # above — only ever relevant for a subscriber's own
                # fee-eligible copy trade (subscription_id set), never
                # the platform's own Human-in-the-Loop bot trade.
                # Rejecting (approved=False) is never gated: declining a
                # drafted trade carries no risk and shouldn't require
                # paying first.
                if row.subscription_id is not None and not row.is_test:
                    from app.services.performance_fees import owed_from_previous_days
                    fees_owed = await owed_from_previous_days(db, row.user_id)
                    if fees_owed > 0:
                        return {
                            "success": False,
                            "message": (
                                f"Cannot approve — {fees_owed:,.2f} in performance fees is owed from a "
                                "previous day. Settle it to resume trading."
                            ),
                        }
                trade = {
                    "trade_id": row.trade_id, "bot_id": row.bot_id, "symbol": row.symbol,
                    "direction": "long" if row.direction.value == "long" else "short",
                    "entry_price": row.entry_price, "stop_loss": row.stop_loss,
                    "take_profit": row.take_profit_1, "lot_size": row.lot_size,
                    "preferred_broker": row.broker_name,
                    # Same bug/fix as process_signal's own _bot_owner_user_id
                    # call: without this, a Human-in-the-Loop bot trade's
                    # approval never routes to the trader's own connected
                    # exchange account either — row.user_id was already
                    # set at draft time by _persist_trade, so just read it
                    # back rather than re-querying BotConfig here too.
                    "user_id": row.user_id,
                }
                # row.is_test was captured at DRAFT time (process_signal's
                # own _bot_paper_mode call, persisted by _persist_trade) —
                # read back here rather than re-checking the bot's
                # CURRENT settings, so approving a signal drafted while
                # Paper Trading was on can't suddenly go real just
                # because the toggle changed while it sat pending.
                result = await self._execute_broker_order(trade, db, paper=row.is_test)
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
                # Same bug/fix as process_signal's own autonomous path
                # right above: a rejected/failed execution here used to
                # leave the row stuck at PENDING forever with nothing
                # ever marking it as the failure it actually was.
                row.status = TradeStatus.ERROR
                row.approval_notes = notes
                await db.commit()
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

    async def _get_broker_client(
        self, broker: str, bot_id: Optional[str], db: Optional[AsyncSession], paper: bool = False,
        user_id=None,
    ):
        """
        `paper=True` (the manual-trading Paper Trading toggle — see
        __init__'s self.paper_brokers) always wins outright and skips
        every credential lookup entirely: a paper fill needs no real
        credentials of any kind, and a bot/trader's real per-broker key
        is exactly the thing paper mode exists to avoid touching.

        Otherwise, priority is:
          1. A bot-specific credential (broker_credentials.py, one of
             your 4-6 internal sub-accounts per exchange) — unchanged,
             still wins first, since that's this platform's OWN money
             on its OWN sub-account for that specific bot.
          2. A TRADER's own connected exchange account
             (trader_broker_connections.py) for `user_id`, when one
             exists — this is the actual point of "trade manually and
             using our bots on their accounts": a trader's manual order
             (or a bot signal they've subscribed to copy) should
             execute on THEIR OWN exchange, not this platform's pooled
             one, whenever they've connected one for it.
          3. The single global-key client for that exchange (self.brokers,
             from BINANCE_API_KEY etc.) — unchanged fallback for a bot/
             trader with no credential of their own, exactly as before
             this feature existed.
        Returns None if none of the three exist (-> the OTHER, pre-
        existing "paper" meaning in _determine_broker/_execute_broker_order
        below: no broker could be determined at all, unrelated to the
        Paper Trading toggle).
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
        if db is not None and user_id is not None:
            try:
                # Local imports — same reason as _persist_trade's own
                # local model imports: avoids a circular import at
                # module load (trader_broker_connections.py doesn't
                # import this file, but keeps this dependency scoped to
                # only where it's actually used).
                from app.services.trader_broker_connections import build_client_from_connection, get_connection, mark_connection_activity
                connection = await get_connection(db, user_id, broker)
                if connection is not None:
                    if connection.exchange == "metatrader":
                        # Every real place/cancel/close/SL-TP-update
                        # call routes through here — this is the single
                        # choke point that resets the idle clock
                        # metaapi_lifecycle.py's auto-undeploy sweep
                        # reads, so it covers all of those, not just a
                        # fresh order.
                        await mark_connection_activity(db, connection)
                    return build_client_from_connection(connection)
            except Exception as e:
                logger.error("trader_connection_lookup_failed", user_id=str(user_id), broker=broker, error=str(e))
        return self.brokers.get(broker)

    async def cancel_broker_order(
        self, broker: Optional[str], order_id: Optional[str], symbol: str,
        bot_id: Optional[str], db: Optional[AsyncSession] = None, is_stop: bool = False,
        paper: bool = False, user_id=None,
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
        client = await self._get_broker_client(broker, bot_id, db, paper=paper, user_id=user_id)
        if client is None or not hasattr(client, "cancel_order"):
            return {"success": False, "error": "no_broker_client", "message": f"No {broker} client configured to cancel this order."}
        try:
            return await client.cancel_order(symbol, order_id, is_stop=is_stop)
        except Exception as e:
            logger.error("broker_cancel_failed", broker=broker, order_id=order_id, error=str(e))
            return {"success": False, "error": str(e)}

    async def close_broker_position(
        self, broker: Optional[str], symbol: str, side: str, bot_id: Optional[str],
        db: Optional[AsyncSession] = None, paper: bool = False, quantity: Optional[float] = None,
        user_id=None,
    ) -> Dict:
        """
        Send a genuine reduce-only close (full, or partial when
        `quantity` is given) to the real broker that holds this
        position — the counterpart to cancel_broker_order for an
        already-FILLED position. Real bug this closes: manual_trading.py's
        own partial_close and cancel_order (ACTIVE branch) previously
        never called a broker at all for a LIVE trade — only ever
        updated our own DB row, leaving the trader's real exchange
        position (and, for Binance, its real resting SL/TP orders)
        completely untouched regardless of what our own UI/DB said. Every
        broker integration in broker_integrations.py already HAD a
        close_position method the whole time; nothing ever called it
        (see this file's own dead-code-removal comment right below this
        method's siblings) — this is that missing call site.

        `broker`/`bot_id` should come from the Trade row's own
        broker_name/bot_id, same convention as cancel_broker_order.
        `paper` should mirror Trade.is_test — a paper position was never
        opened at a real broker, so there's nothing real to close; this
        still returns a real success/failure shape so callers don't need
        a separate paper branch of their own.
        """
        if paper:
            return {"success": True, "order_id": f"PAPER-CLOSE-{symbol}", "status": "FILLED", "paper": True}
        if not broker:
            return {"success": False, "error": "missing_broker_reference", "message": "No broker recorded for this trade — nothing to close at a broker."}
        client = await self._get_broker_client(broker, bot_id, db, paper=paper, user_id=user_id)
        if client is None or not hasattr(client, "close_position"):
            return {"success": False, "error": "no_broker_client", "message": f"No {broker} client configured to close this position."}
        try:
            return await client.close_position(symbol, side, quantity=quantity)
        except Exception as e:
            logger.error("broker_close_failed", broker=broker, symbol=symbol, error=str(e))
            return {"success": False, "error": str(e)}

    async def update_broker_stop_loss_take_profit(
        self, broker: Optional[str], symbol: str, side: str, bot_id: Optional[str],
        db: Optional[AsyncSession] = None, paper: bool = False,
        stop_loss: Optional[float] = None, take_profit: Optional[float] = None,
        user_id=None,
    ) -> Dict:
        """
        Move this position's REAL stop-loss/take-profit at the broker —
        the broker-side half of manual_trading.py's modify_targets,
        which before this only ever updated our own DB record (see that
        endpoint's own "Honest scope" docstring). Implemented for real,
        currently, on Bybit (native trading-stop endpoint), Binance
        (cancel+replace the resting STOP_MARKET/TAKE_PROFIT_MARKET
        order) and MetaApi/MT4-5 (native POSITION_MODIFY) — see each
        broker's own update_stop_loss_take_profit in
        broker_integrations.py. BingX/MEXC/TradeLocker don't have one
        yet; this returns an honest "not supported" failure for those
        rather than silently doing nothing, so the caller can tell the
        trader their broker's real order wasn't touched instead of
        wrongly implying it was.
        """
        if paper:
            return {"success": True, "paper": True}
        if not broker:
            return {"success": False, "error": "missing_broker_reference", "message": "No broker recorded for this trade — nothing to update at a broker."}
        client = await self._get_broker_client(broker, bot_id, db, paper=paper, user_id=user_id)
        if client is None or not hasattr(client, "update_stop_loss_take_profit"):
            return {
                "success": False, "error": "not_supported",
                "message": f"This app doesn't yet sync SL/TP edits to {broker} — your own record is updated, but the real order at {broker} is unchanged. Adjust it there directly for now.",
            }
        try:
            return await client.update_stop_loss_take_profit(symbol, side, stop_loss=stop_loss, take_profit=take_profit)
        except Exception as e:
            logger.error("broker_sltp_update_failed", broker=broker, symbol=symbol, error=str(e))
            return {"success": False, "error": str(e)}

    async def _execute_broker_order(
        self, trade: Dict, db: Optional[AsyncSession] = None, paper: bool = False, is_relay: bool = False,
        client_override=None,
    ) -> Dict:
        """Execute order via configured broker. `paper=True` is the
        manual-trading Paper Trading toggle: still runs the exact same
        broker-routing/order-shape/price-deviation-guard logic below
        against a real, live-priced ticker, it just never places a real
        order (see _get_broker_client and broker_integrations.py's
        per-broker paper=True short-circuits).

        `is_relay=True` means this call ITSELF is already the OTHER
        backend executing an order relayed to it (see routers/
        internal.py) — never attempt a further relay from here, or two
        backends each configured with the other's VM_API_URL could
        ping-pong a single failing order back and forth forever.

        `client_override`, when given, is used directly instead of
        resolving one via _get_broker_client's per-bot-credential /
        trader-connection / global-key priority chain — used by
        _fan_out_to_subscribers so a subscriber's copy trade ALWAYS
        executes on the exact TraderBrokerConnection it was drafted
        against. Without this, a subscriber's copy shares the SAME
        bot_id as the platform's own trade, and _get_broker_client's
        own priority order checks a per-bot credential FIRST — if that
        bot happens to have one configured, every subscriber's copy
        would silently execute on the platform's own sub-account money
        instead of the subscriber's, which is exactly the kind of
        misattributed-real-trade bug this whole feature exists to
        avoid."""
        broker = self._determine_broker(trade["symbol"], trade.get("preferred_broker"))
        if client_override is not None:
            client = client_override
        else:
            client = await self._get_broker_client(
                broker, trade.get("bot_id"), db, paper=paper, user_id=trade.get("user_id"),
            ) if broker != "paper" else None

        # Real, dangerous bug fixed here, found while extending this
        # path for trader-connection fan-out: broker == "paper" is the
        # ONE legitimate "no broker could even be determined for this
        # symbol" case (_determine_broker's own fallback) — that's fine
        # to report as a harmless simulated fill. But broker being a
        # REAL determined exchange (e.g. "bingx") with `client` still
        # None — meaning no credentials exist for it anywhere in the
        # priority chain — used to fall through the exact same
        # "elif ... and client is not None" chain below into the exact
        # same fake "Paper trade executed (no broker configured)"
        # success message, even for a genuinely LIVE (non-paper) order.
        # That's a false "success" on a trade that was never placed
        # anywhere — worse than an honest failure, since nothing about
        # the response told the caller their real money never moved.
        if broker != "paper" and client is None:
            return {
                "success": False,
                "error": "no_broker_client",
                "message": f"No {broker} credentials configured (checked per-bot, trader-connection, and global-key) — order NOT placed.",
            }

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
            elif broker == "oanda" and client is not None:
                return await self._execute_oanda(trade, client)
            else:
                return {
                    "success": True,
                    "order_id": f"PAPER_{trade['trade_id']}",
                    "broker": "paper",
                    "message": "Paper trade executed (no broker configured)"
                }
        except _FAILOVER_EXCEPTIONS as e:
            # A TRANSPORT failure (proxy down, connection refused,
            # timed out) — as opposed to the exchange itself rejecting
            # the order below, which relaying elsewhere wouldn't fix.
            # Real, non-paper orders only: a paper fill has nothing to
            # relay to another backend for, it's pure local simulation.
            logger.error("broker_execution_failed_transport", error=str(e), trade_id=trade["trade_id"], broker=broker)
            if not paper and not is_relay and self.settings.VM_API_URL and self.settings.INTERNAL_RELAY_SECRET:
                relay_result = await self._relay_to_other_backend(trade, paper)
                if relay_result is not None:
                    return relay_result
            return {"success": False, "error": str(e), "error_class": "transport"}
        except Exception as e:
            logger.error("broker_execution_failed", error=str(e), trade_id=trade["trade_id"])
            return {"success": False, "error": str(e)}

    async def _relay_to_other_backend(self, trade: Dict, paper: bool) -> Optional[Dict]:
        """The failover half of routers/internal.py's own docstring —
        see that file for the full reasoning (failover, not broadcast;
        why a real duplicate fill risk rules out sending an order down
        two paths at once). Returns None (never raises) on ANY relay
        failure, so the caller falls back to its own original local
        error instead of a confusing second one."""
        url = f"{self.settings.VM_API_URL.rstrip('/')}/internal/execute-broker-order"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    url, json={"trade": trade, "paper": paper},
                    headers={"X-Internal-Secret": self.settings.INTERNAL_RELAY_SECRET},
                )
            if resp.status_code != 200:
                logger.error("relay_to_other_backend_failed", status=resp.status_code, trade_id=trade.get("trade_id"))
                return None
            result = resp.json()
            logger.warning(
                "relay_to_other_backend_succeeded", trade_id=trade.get("trade_id"),
                broker=result.get("broker"), success=result.get("success"),
            )
            return result
        except Exception as e:
            logger.error("relay_to_other_backend_exception", error=str(e), trade_id=trade.get("trade_id"))
            return None

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

    async def _execute_oanda(self, trade: Dict, broker) -> Dict:
        """Execute via OANDA (broker_integrations.py::OandaBroker) — by
        direct request, added alongside MetaApi as a second forex/index
        broker option, mainly for its free data (see routers/oanda.py's
        own Chart O), with real order placement here as a genuine but
        secondary capability."""
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
                "broker": "oanda",
                "message": f"OANDA order placed: {result['status']}"
            }
        return result

    # close_trade, update_trailing_stop, and get_batch_allocation were
    # removed here (dead code, zero callers anywhere in the backend —
    # confirmed via a full-codebase grep for each call before removal).
    # Real trade closes go through routers/manual_trading.py's
    # partial_close/cancel_order and services/position_monitor.py's
    # _close/_partial_close instead, which is also where
    # compute_r_multiple() actually lives now — this class's own
    # close_trade had a second, parallel (and unused) r_multiple
    # formula that never matched it.
