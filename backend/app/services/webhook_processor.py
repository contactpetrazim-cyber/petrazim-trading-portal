
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
from app.config import get_settings
from app.core.bot_strategies import BotOrchestrator
from app.services.execution_engine import ExecutionEngine

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
        self.orchestrator = BotOrchestrator({})

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

    async def process_alert(self, alert_data: Dict) -> Dict:
        """
        Process a TradingView alert and route to execution.

        Flow:
        1. Validate payload
        2. Determine target bot
        3. Enrich with SMC context if available
        4. Check risk limits
        5. Route to execution engine (HITL or Autonomous)
        6. Return response
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
            return await self._handle_management_action(alert_data)

        # For new trades, determine execution mode
        execution_mode = await self._get_bot_execution_mode(bot_id)

        # Build trade signal from alert
        signal = self._build_signal_from_alert(alert_data)

        if not signal:
            return {
                "success": False,
                "message": "Failed to build valid signal from alert data"
            }

        # Process through execution engine
        result = await self.execution_engine.process_signal(signal, execution_mode)

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

    def _build_signal_from_alert(self, alert_data: Dict) -> Optional[Dict]:
        """Convert TradingView alert to internal signal format."""
        try:
            direction = "long" if alert_data["action"] == "buy" else "short"

            # Map bot_id to bot name
            bot_names = {
                "bot_1": "Pure Macro Swing Structure",
                "bot_2": "HF Order Block Reversal",
                "bot_3": "FVG Expansion & Fill",
                "bot_4": "Volume & Liquidity Sweep",
                "bot_5": "Jeafx SMC Specialist"
            }

            return {
                "bot_id": alert_data["bot_id"],
                "bot_name": bot_names.get(alert_data["bot_id"], "Unknown Bot"),
                "symbol": alert_data["pair"],
                "direction": direction,
                "confidence": 0.75,  # Default from TV alert
                "entry_price": alert_data.get("entry", 0),
                "stop_loss": alert_data.get("stop_loss", 0),
                "take_profit": alert_data.get("take_profit", 0),
                "lot_size": 0.01,  # Will be calculated
                "risk_percent": alert_data.get("risk_percent", 1.0),
                "reasoning": f"TradingView alert: {alert_data.get('structure_type', 'unknown')} on {alert_data.get('timeframe', '15M')}",
                "timestamp": datetime.utcnow()
            }
        except Exception as e:
            logger.error("signal_build_failed", error=str(e))
            return None

    async def _get_bot_execution_mode(self, bot_id: str) -> str:
        """Get execution mode for bot (human_in_loop or fully_autonomous)."""
        # In production: query database for bot config
        # Default to human_in_loop for safety
        return "human_in_loop"

    async def _handle_management_action(self, alert_data: Dict) -> Dict:
        """Handle close, update_sl, update_tp actions."""
        action = alert_data["action"]
        symbol = alert_data["pair"]

        if action == "close":
            # Find active trade for symbol and close it
            return {
                "success": True,
                "message": f"Close signal received for {symbol}",
                "action": "close"
            }

        elif action == "update_sl":
            return {
                "success": True,
                "message": f"SL update signal received for {symbol}",
                "new_sl": alert_data.get("stop_loss"),
                "action": "update_sl"
            }

        elif action == "update_tp":
            return {
                "success": True,
                "message": f"TP update signal received for {symbol}",
                "new_tp": alert_data.get("take_profit"),
                "action": "update_tp"
            }

        return {"success": False, "message": "Unknown management action"}
