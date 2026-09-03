
"""
Execution Engine: Updated with BingX and TradeLocker support
"""

from typing import Optional, Dict, List
from datetime import datetime
import structlog
from app.config import get_settings
from app.core.bot_strategies import BotSignal
from app.services.broker_integrations import BingXBroker, TradeLockerBroker

logger = structlog.get_logger()
settings = get_settings()

class ExecutionEngine:
    """Core execution engine with multi-broker support."""

    def __init__(self):
        self.settings = get_settings()
        self.pending_trades: List[Dict] = []
        self.active_trades: List[Dict] = []
        self.daily_trade_count = 0

        # Initialize broker clients
        self.brokers = {}
        if self.settings.BINGX_API_KEY:
            self.brokers["bingx"] = BingXBroker(
                self.settings.BINGX_API_KEY,
                self.settings.BINGX_SECRET
            )
        if self.settings.TRADELOCKER_API_KEY:
            self.brokers["tradelocker"] = TradeLockerBroker(
                self.settings.TRADELOCKER_API_KEY,
                self.settings.TRADELOCKER_SECRET,
                self.settings.TRADELOCKER_ACCOUNT_ID
            )

    async def process_signal(self, signal: BotSignal, mode: str = "human_in_loop") -> Dict:
        """Process a bot signal into a trade action."""

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
            "strategy_type": signal.bot_name,
            "confidence": signal.confidence,
            "reasoning": signal.reasoning,
            "timestamp": signal.timestamp,
            "status": "pending_approval" if mode == "human_in_loop" else "executing",
            "requires_approval": mode == "human_in_loop",
            "execution_mode": mode
        }

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
            result = await self._execute_broker_order(trade_data)
            if result["success"]:
                trade_data["status"] = "active"
                trade_data["broker_order_id"] = result.get("order_id")
                self.active_trades.append(trade_data)
                self.daily_trade_count += 1
            return result

    async def approve_trade(self, trade_id: str, approved: bool, notes: str = "") -> Dict:
        """Manual approval handler."""
        trade = None
        for t in self.pending_trades:
            if t["trade_id"] == trade_id:
                trade = t
                break

        if not trade:
            return {"success": False, "message": "Trade not found"}

        if approved:
            result = await self._execute_broker_order(trade)
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

    async def _execute_broker_order(self, trade: Dict) -> Dict:
        """Execute order via configured broker."""
        broker = self._determine_broker(trade["symbol"])

        try:
            if broker == "bingx" and "bingx" in self.brokers:
                return await self._execute_bingx(trade)
            elif broker == "tradelocker" and "tradelocker" in self.brokers:
                return await self._execute_tradelocker(trade)
            elif broker == "binance":
                return await self._execute_binance(trade)
            elif broker == "bybit":
                return await self._execute_bybit(trade)
            elif broker == "metatrader":
                return await self._execute_metatrader(trade)
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

    def _determine_broker(self, symbol: str) -> str:
        """Route to appropriate broker based on symbol."""
        symbol_upper = symbol.upper()

        # BingX: Crypto pairs (BTCUSDT, ETHUSDT, etc.)
        if "USDT" in symbol_upper or "USD" in symbol_upper:
            if "bingx" in self.brokers:
                return "bingx"
            return "binance"

        # TradeLocker: Forex and prop firm accounts
        if len(symbol) == 6 and symbol.isalpha():
            if "tradelocker" in self.brokers:
                return "tradelocker"
            return "metatrader"

        # Default
        return "paper"

    async def _execute_bingx(self, trade: Dict) -> Dict:
        """Execute via BingX."""
        broker = self.brokers["bingx"]

        side = "BUY" if trade["direction"] == "long" else "SELL"
        order_type = "LIMIT" if trade.get("entry_type") == "limit" else "MARKET"

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

    async def _execute_tradelocker(self, trade: Dict) -> Dict:
        """Execute via TradeLocker."""
        broker = self.brokers["tradelocker"]

        side = "buy" if trade["direction"] == "long" else "sell"
        order_type = "limit" if trade.get("entry_type") == "limit" else "market"

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

    async def _execute_binance(self, trade: Dict) -> Dict:
        return {"success": True, "order_id": f"BIN_{trade['trade_id']}", "broker": "binance"}

    async def _execute_bybit(self, trade: Dict) -> Dict:
        return {"success": True, "order_id": f"BYB_{trade['trade_id']}", "broker": "bybit"}

    async def _execute_metatrader(self, trade: Dict) -> Dict:
        return {"success": True, "order_id": f"MT_{trade['trade_id']}", "broker": "metatrader"}

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
