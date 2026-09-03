
"""
BingX Broker Integration
Supports: Spot and Futures trading via REST API
"""

import hmac
import hashlib
import base64
import json
from datetime import datetime, timezone
from typing import Dict, Optional
import httpx
import structlog

logger = structlog.get_logger()

class BingXBroker:
    """
    BingX API Client

    Base URL: https://open-api.bingx.com
    Documentation: https://bingx-api.github.io/docs/

    Features:
    - Market orders
    - Limit orders
    - Stop-loss / Take-profit
    - Position tracking
    - Order history
    """

    BASE_URL = "https://open-api.bingx.com"

    def __init__(self, api_key: str, api_secret: str, demo: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.demo = demo
        self.client = httpx.AsyncClient(timeout=30.0)

    def _generate_signature(self, payload: str) -> str:
        """Generate HMAC SHA256 signature."""
        signature = hmac.new(
            self.api_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature

    def _get_timestamp(self) -> str:
        """Get current timestamp in milliseconds."""
        return str(int(datetime.now(timezone.utc).timestamp() * 1000))

    async def _request(self, method: str, endpoint: str, params: Dict = None, body: Dict = None) -> Dict:
        """Make authenticated request to BingX API."""
        timestamp = self._get_timestamp()

        # Build query string
        query_params = {
            "timestamp": timestamp,
            "recvWindow": 5000
        }
        if params:
            query_params.update(params)

        query_string = "&".join([f"{k}={v}" for k, v in sorted(query_params.items())])

        # Generate signature
        signature = self._generate_signature(query_string)
        query_string += f"&signature={signature}"

        url = f"{self.BASE_URL}{endpoint}?{query_string}"
        headers = {
            "X-BX-APIKEY": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            if method == "GET":
                response = await self.client.get(url, headers=headers)
            elif method == "POST":
                response = await self.client.post(url, headers=headers, json=body)
            elif method == "DELETE":
                response = await self.client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            data = response.json()

            if data.get("code") != 0:
                logger.error("bingx_api_error", code=data.get("code"), msg=data.get("msg"))
                return {"success": False, "error": data.get("msg")}

            return {"success": True, "data": data.get("data")}

        except Exception as e:
            logger.error("bingx_request_failed", error=str(e))
            return {"success": False, "error": str(e)}

    async def place_order(self,
                         symbol: str,
                         side: str,  # BUY or SELL
                         order_type: str,  # MARKET or LIMIT
                         quantity: float,
                         price: Optional[float] = None,
                         stop_loss: Optional[float] = None,
                         take_profit: Optional[float] = None) -> Dict:
        """
        Place a new order on BingX.

        Example:
            await broker.place_order(
                symbol="BTC-USDT",
                side="BUY",
                order_type="LIMIT",
                quantity=0.01,
                price=45000,
                stop_loss=44000,
                take_profit=48000
            )
        """
        endpoint = "/openApi/swap/v2/trade/order"

        params = {
            "symbol": symbol.replace("/", "-").upper(),
            "side": side.upper(),
            "positionSide": "LONG" if side.upper() == "BUY" else "SHORT",
            "type": order_type.upper(),
            "quantity": str(quantity)
        }

        if order_type.upper() == "LIMIT" and price:
            params["price"] = str(price)

        # Add stop loss and take profit
        if stop_loss:
            params["stopLoss"] = json.dumps({"stopPrice": str(stop_loss), "workingType": "MARK_PRICE"})

        if take_profit:
            params["takeProfit"] = json.dumps({"stopPrice": str(take_profit), "workingType": "MARK_PRICE"})

        result = await self._request("POST", endpoint, body=params)

        if result["success"]:
            order_data = result["data"]
            logger.info("bingx_order_placed", 
                       symbol=symbol, 
                       side=side, 
                       order_id=order_data.get("orderId"))
            return {
                "success": True,
                "order_id": order_data.get("orderId"),
                "client_order_id": order_data.get("clientOrderID"),
                "symbol": symbol,
                "status": order_data.get("status", "NEW")
            }

        return result

    async def close_position(self, symbol: str, side: str) -> Dict:
        """Close an open position."""
        endpoint = "/openApi/swap/v2/trade/order"

        params = {
            "symbol": symbol.replace("/", "-").upper(),
            "side": "SELL" if side.upper() == "BUY" else "BUY",  # Opposite side to close
            "type": "MARKET",
            "quantity": "0",  # Close all
            "reduceOnly": "true"
        }

        return await self._request("POST", endpoint, body=params)

    async def get_position(self, symbol: str) -> Dict:
        """Get current position for a symbol."""
        endpoint = "/openApi/swap/v2/user/positions"
        params = {"symbol": symbol.replace("/", "-").upper()}

        return await self._request("GET", endpoint, params=params)

    async def get_balance(self) -> Dict:
        """Get account balance."""
        endpoint = "/openApi/swap/v2/user/balance"
        return await self._request("GET", endpoint)

    async def set_leverage(self, symbol: str, leverage: int) -> Dict:
        """Set leverage for a symbol."""
        endpoint = "/openApi/swap/v2/trade/leverage"
        params = {
            "symbol": symbol.replace("/", "-").upper(),
            "leverage": str(leverage)
        }
        return await self._request("POST", endpoint, body=params)


# =============================================================================
# TRADELOCKER BROKER INTEGRATION
# =============================================================================

class TradeLockerBroker:
    """
    TradeLocker API Client

    TradeLocker is a prop firm / broker with API access.
    Base URL: https://api.tradelocker.com

    Features:
    - OAuth2 authentication
    - Order placement
    - Position management
    - Account info
    """

    BASE_URL = "https://api.tradelocker.com"

    def __init__(self, api_key: str, api_secret: str, account_id: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.account_id = account_id
        self.access_token = None
        self.client = httpx.AsyncClient(timeout=30.0)

    async def authenticate(self) -> bool:
        """Authenticate and get access token."""
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/auth/token",
                json={
                    "apiKey": self.api_key,
                    "apiSecret": self.api_secret
                }
            )
            data = response.json()

            if response.status_code == 200 and data.get("accessToken"):
                self.access_token = data["accessToken"]
                logger.info("tradelocker_authenticated")
                return True
            else:
                logger.error("tradelocker_auth_failed", error=data)
                return False

        except Exception as e:
            logger.error("tradelocker_auth_error", error=str(e))
            return False

    async def _request(self, method: str, endpoint: str, params: Dict = None, body: Dict = None) -> Dict:
        """Make authenticated request."""
        if not self.access_token:
            auth_success = await self.authenticate()
            if not auth_success:
                return {"success": False, "error": "Authentication failed"}

        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        try:
            if method == "GET":
                response = await self.client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await self.client.post(url, headers=headers, json=body)
            elif method == "DELETE":
                response = await self.client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            data = response.json()

            if response.status_code >= 400:
                logger.error("tradelocker_api_error", status=response.status_code, error=data)
                return {"success": False, "error": str(data)}

            return {"success": True, "data": data}

        except Exception as e:
            logger.error("tradelocker_request_failed", error=str(e))
            return {"success": False, "error": str(e)}

    async def place_order(self,
                         symbol: str,
                         side: str,  # buy or sell
                         order_type: str,  # market or limit
                         quantity: float,
                         price: Optional[float] = None,
                         stop_loss: Optional[float] = None,
                         take_profit: Optional[float] = None) -> Dict:
        """
        Place order on TradeLocker.

        Example:
            await broker.place_order(
                symbol="EURUSD",
                side="buy",
                order_type="limit",
                quantity=0.1,
                price=1.0850,
                stop_loss=1.0800,
                take_profit=1.0950
            )
        """
        endpoint = "/orders"

        body = {
            "accountId": self.account_id,
            "symbol": symbol,
            "side": side.lower(),
            "type": order_type.lower(),
            "quantity": quantity
        }

        if order_type.lower() == "limit" and price:
            body["price"] = price

        if stop_loss:
            body["stopLoss"] = stop_loss

        if take_profit:
            body["takeProfit"] = take_profit

        result = await self._request("POST", endpoint, body=body)

        if result["success"]:
            order_data = result["data"]
            logger.info("tradelocker_order_placed",
                       symbol=symbol,
                       side=side,
                       order_id=order_data.get("id"))
            return {
                "success": True,
                "order_id": order_data.get("id"),
                "symbol": symbol,
                "status": order_data.get("status", "pending")
            }

        return result

    async def close_position(self, position_id: str) -> Dict:
        """Close a position by ID."""
        endpoint = f"/positions/{position_id}/close"
        return await self._request("POST", endpoint)

    async def get_positions(self) -> Dict:
        """Get all open positions."""
        endpoint = "/positions"
        params = {"accountId": self.account_id} if self.account_id else {}
        return await self._request("GET", endpoint, params=params)

    async def get_account(self) -> Dict:
        """Get account information."""
        endpoint = "/accounts"
        return await self._request("GET", endpoint)

    async def get_balance(self) -> Dict:
        """Get account balance."""
        result = await self.get_account()
        if result["success"] and result["data"]:
            accounts = result["data"]
            for acc in accounts:
                if not self.account_id or acc.get("id") == self.account_id:
                    return {
                        "success": True,
                        "balance": acc.get("balance", 0),
                        "equity": acc.get("equity", 0),
                        "margin": acc.get("margin", 0),
                        "free_margin": acc.get("freeMargin", 0)
                    }
        return result
