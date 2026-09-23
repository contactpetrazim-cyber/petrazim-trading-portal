
"""
TradingView Webhook Processor
Handles incoming alerts from TradingView Pine Script alerts.
"""

import json
import hmac
import hashlib
from typing import Dict, Optional
from datetime import datetime
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.core.bot_strategies import BotOrchestrator, BotSignal
from app.services.execution_engine import ExecutionEngine
from app.services.manual_trading import compute_r_multiple
from app.services.performance_fees import apply_performance_fee
from app.models.bot import BotConfig
from app.models.trade import ExitType, Trade, TradeDirection, TradeLog, TradeStatus

logger = structlog.get_logger()
settings = get_settings()

class WebhookProcessor:
    """
    Processes TradingView webhook alerts and routes to appropriate bot.

    Expected JSON payload from TradingView:
    {
        "bot_id": "bot_2_ob_reversal",
        "pair": "BTCUSDT",
        "action": "buy",
        "entry": 45000.00,
        "stop_loss": 44000.00,
        "take_profit": 48000.00,
        "timeframe": "15M",
        "structure_type": "choch",
        "fvg_present": true,
        "liquidity_swept": true
    }
    """

    def __init__(self):
        self.execution_engine = ExecutionEngine()
        self.orchestrator = BotOrchestrator([])

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature for security."""
        if not settings.WEBHOOK_SECRET:
            return True  # Skip verification if no secret set

        expected = hmac.new(
            settings.WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected, signature)

    async def process_alert(self, alert_data: Dict, db: Optional[AsyncSession] = None) -> Dict:
        """
        Process a TradingView alert and route to execution.

        Flow:
        1. Validate payload
        2. Determine target bot
        3. Enrich with SMC context if available
        4. Check risk limits
        5. Route to execution engine (HITL or Autonomous)
        6. Return response

        `db` is optional only so this stays callable from tests/scripts
        without a live session; the real HTTP route always passes one so
        the bot's actual configured execution_mode and exchange are
        used instead of the human_in_loop/no-preference defaults.
        """

        # Validation
        required_fields = ["bot_id", "pair", "action"]
        for field in required_fields:
            if field not in alert_data:
                return {
                    "success": False,
                    "message": f"Missing required field: {field}"
                }

        bot_id = alert_data["bot_id"]
        symbol = alert_data["pair"]
        action = alert_data["action"]

        logger.info(
            "webhook_alert_received",
            bot_id=bot_id,
            symbol=symbol,
            action=action
        )

        # Handle close/update actions immediately
        if action in ["close", "update_sl", "update_tp"]:
            return await self._handle_management_action(alert_data, db)

        # Look up this bot's real config once — drives both the
        # execution mode and which exchange the signal should execute
        # on (BotConfig.exchange -> BotSignal.preferred_broker).
        bot_config = await self._get_bot_config(bot_id, db)
        execution_mode = bot_config.execution_mode.value if bot_config else "human_in_loop"
        preferred_broker = bot_config.exchange if bot_config else None

        # Build trade signal from alert
        signal = self._build_signal_from_alert(alert_data, preferred_broker)

        if not signal:
            return {
                "success": False,
                "message": "Failed to build valid signal from alert data"
            }

        # Process through execution engine
        result = await self.execution_engine.process_signal(signal, execution_mode, db)

        # Enrich response
        result["execution_mode"] = execution_mode
        result["bot_id"] = bot_id
        result["symbol"] = symbol
        result["timestamp"] = datetime.utcnow().isoformat()

        logger.info(
            "webhook_processed",
            bot_id=bot_id,
            symbol=symbol,
            result=result["status"]
        )

        return result

    def _build_signal_from_alert(self, alert_data: Dict, preferred_broker: Optional[str] = None) -> Optional[BotSignal]:
        """
        Convert TradingView alert into a real BotSignal instance.

        NOTE: this used to return a plain dict here, while
        execution_engine.process_signal() reads it via attribute access
        (signal.bot_id, signal.entry_price, ...) — every webhook alert
        that reached process_signal() would have raised
        AttributeError: 'dict' object has no attribute 'bot_id' and
        crashed with a 500. Returning a proper BotSignal fixes that.
        """
        try:
            direction = "long" if alert_data["action"] == "buy" else "short"

            # Map bot_id to bot name
            bot_names = {
                "bot_1": "Pure Macro Swing Structure",
                "bot_2": "HF Order Block Reversal",
                "bot_3": "FVG Expansion & Fill",
                "bot_4": "Volume & Liquidity Sweep",
                "bot_5": "SMC BOT"
            }

            return BotSignal(
                bot_id=alert_data["bot_id"],
                bot_name=bot_names.get(alert_data["bot_id"], "Unknown Bot"),
                symbol=alert_data["pair"],
                direction=direction,
                confidence=0.75,  # Default from TV alert
                entry_price=alert_data.get("entry", 0),
                stop_loss=alert_data.get("stop_loss", 0),
                take_profit=alert_data.get("take_profit", 0),
                lot_size=0.01,  # Will be calculated
                risk_percent=alert_data.get("risk_percent", 1.0),
                reasoning=f"TradingView alert: {alert_data.get('structure_type', 'unknown')} on {alert_data.get('timeframe', '15M')}",
                timestamp=datetime.utcnow(),
                preferred_broker=preferred_broker,
            )
        except Exception as e:
            logger.error("signal_build_failed", error=str(e))
            return None

    async def _get_bot_config(self, bot_id: str, db: Optional[AsyncSession]) -> Optional[BotConfig]:
        """Look up this bot's real config — execution_mode and exchange
        are read fresh here on every alert, never cached, so a change
        made via PATCH /bots/{bot_id}/mode or /exchange takes effect on
        the very next signal with no restart needed."""
        if db is None:
            return None
        result = await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))
        return result.scalar_one_or_none()

    async def _handle_management_action(self, alert_data: Dict, db: Optional[AsyncSession]) -> Dict:
        """
        Handle close, update_sl, update_tp actions.

        Real bug fixed here, found during a trade-execution audit: every
        branch of this used to unconditionally return a fake `{"success":
        True, ...}` without EVER looking up the trade this alert was
        actually about, let alone touching it or the broker holding it —
        a TradingView strategy sending a genuine "close"/"update_sl"/
        "update_tp" alert had that alert silently no-op while this
        reported success, with no trace anywhere that nothing happened.
        `db is None` (the test/script-callable path process_alert's own
        docstring mentions) still can't look anything up — reported
        honestly as a failure now, not a fake success.

        Applies to every ACTIVE trade this bot currently holds on this
        symbol (ordinarily just one; a bot holding more than one
        simultaneous position on the same symbol is a real if unusual
        case, and every matching one is acted on rather than only the
        first). Reuses the exact same real broker calls (execution_engine.py's
        close_broker_position / update_broker_stop_loss_take_profit)
        manual_trading.py's own cancel_order/modify_targets now use —
        one real implementation of "close/modify at the broker", not a
        second copy.
        """
        action = alert_data["action"]
        symbol = alert_data["pair"].upper()
        bot_id = alert_data["bot_id"]

        if db is None:
            return {"success": False, "message": "No database session available — cannot look up this bot's trade.", "action": action}

        rows = (await db.execute(
            select(Trade).where(Trade.bot_id == bot_id, Trade.symbol == symbol, Trade.status == TradeStatus.ACTIVE)
        )).scalars().all()
        if not rows:
            return {"success": False, "message": f"No active {symbol} trade found for {bot_id} — nothing to {action}.", "action": action}

        if action == "close":
            exit_price = alert_data.get("entry")
            if not exit_price:
                from app.services.live_price import get_crypto_price
                exit_price = await get_crypto_price(symbol)
            if not exit_price:
                return {"success": False, "message": f"No price available to close {symbol} at.", "action": action}

            closed, failed = [], []
            for row in rows:
                if not row.is_test and row.broker_name:
                    close_result = await self.execution_engine.close_broker_position(
                        row.broker_name, row.symbol, row.direction.value, row.bot_id, db, paper=row.is_test,
                        user_id=row.user_id,
                    )
                    if not close_result.get("success"):
                        failed.append(row.trade_id)
                        continue
                direction_sign = 1 if row.direction == TradeDirection.LONG else -1
                pnl = direction_sign * (exit_price - row.entry_price) * row.lot_size
                row.realized_pnl = (row.realized_pnl or 0.0) + pnl
                row.lot_size = 0.0
                row.status = TradeStatus.CLOSED
                row.exit_price = exit_price
                row.exit_timestamp = datetime.utcnow()
                row.exit_type = ExitType.MANUAL
                row.r_multiple = compute_r_multiple(row.entry_price, exit_price, row.stop_loss, row.direction)
                closed.append(row.trade_id)
                await apply_performance_fee(db, row, pnl)
            await db.commit()
            if failed:
                return {"success": False, "message": f"Broker did not confirm close for {failed} — left open. Closed: {closed}.", "action": action}
            return {"success": True, "message": f"Closed {closed} at {exit_price}.", "action": action}

        elif action in ("update_sl", "update_tp"):
            new_sl = alert_data.get("stop_loss") if action == "update_sl" else None
            new_tp = alert_data.get("take_profit") if action == "update_tp" else None
            if not new_sl and not new_tp:
                return {"success": False, "message": f"No {'stop_loss' if action == 'update_sl' else 'take_profit'} value on the alert.", "action": action}

            synced, unsynced = [], []
            for row in rows:
                old_value = row.stop_loss if action == "update_sl" else row.take_profit_1
                new_value = new_sl if action == "update_sl" else new_tp
                if old_value == new_value:
                    continue
                if action == "update_sl":
                    row.stop_loss = new_value
                else:
                    row.take_profit_1 = new_value
                db.add(TradeLog(
                    trade_id=row.trade_id, event_type="sl_update" if action == "update_sl" else "tp_update",
                    event_data={"field": "stop_loss" if action == "update_sl" else "take_profit_1", "old_value": old_value, "new_value": new_value, "source": "tradingview_webhook"},
                    price_at_event=new_value,
                ))
                if not row.is_test:
                    sync_result = await self.execution_engine.update_broker_stop_loss_take_profit(
                        row.broker_name, row.symbol, row.direction.value, row.bot_id, db, paper=row.is_test,
                        stop_loss=new_sl, take_profit=new_tp, user_id=row.user_id,
                    )
                    (synced if sync_result.get("success") else unsynced).append(row.trade_id)
            await db.commit()
            return {
                "success": True, "action": action,
                "message": f"Updated {'stop-loss' if action == 'update_sl' else 'take-profit'} locally for {[r.trade_id for r in rows]}."
                           + (f" Broker sync failed for {unsynced}." if unsynced else ""),
            }

        return {"success": False, "message": "Unknown management action"}
