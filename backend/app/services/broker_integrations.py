
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

    async def get_ticker_price(self, symbol: str) -> Dict:
        """
        Public, unsigned last-price lookup — used as the pre-trade price
        sanity check (see execution_engine.py's _check_price_deviation)
        so a signal computed off one exchange's candles never fires an
        order on this exchange without confirming the two prices agree.
        """
        endpoint = "/openApi/swap/v2/quote/price"
        params = {"symbol": symbol.replace("/", "-").upper()}
        try:
            response = await self.client.get(f"{self.BASE_URL}{endpoint}", params=params)
            data = response.json()
            if data.get("code") != 0:
                return {"success": False, "error": data.get("msg")}
            return {"success": True, "price": float(data["data"]["price"])}
        except Exception as e:
            logger.error("bingx_ticker_failed", error=str(e))
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

    async def get_ticker_price(self, symbol: str) -> Dict:
        """
        Pre-trade price sanity check (see execution_engine.py's
        _check_price_deviation). NOTE: TradeLocker is a white-label
        platform — the exact quotes endpoint can differ per broker
        deployment. This targets the documented generic `/quotes`
        route; verify against your specific TradeLocker broker's API
        docs before relying on it in production.
        """
        endpoint = f"/quotes/{symbol}"
        result = await self._request("GET", endpoint)
        if result["success"] and result["data"]:
            data = result["data"]
            mid = data.get("mid") or data.get("price")
            if mid is None and "bid" in data and "ask" in data:
                mid = (data["bid"] + data["ask"]) / 2
            if mid is not None:
                return {"success": True, "price": float(mid)}
        return {"success": False, "error": result.get("error", "no quote data")}


# =============================================================================
# BINANCE BROKER INTEGRATION (USDT-M Futures)
# =============================================================================

class BinanceBroker:
    """
    Binance USDT-M Futures API client.

    Base URL: https://fapi.binance.com
    Documentation: https://binance-docs.github.io/apidocs/futures/en/

    NOTE: written from Binance's documented request/signing shape, not
    exercised against a live account in this session (no keys
    available here) — verify against a testnet account
    (https://testnet.binancefuture.com) before trading real size.
    """

    BASE_URL = "https://fapi.binance.com"

    def __init__(self, api_key: str, api_secret: str, demo: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.demo = demo
        self.client = httpx.AsyncClient(timeout=30.0)

    def _sign(self, query_string: str) -> str:
        return hmac.new(self.api_secret.encode(), query_string.encode(), hashlib.sha256).hexdigest()

    async def _request(self, method: str, endpoint: str, params: Dict = None, signed: bool = True) -> Dict:
        params = dict(params or {})
        headers = {"X-MBX-APIKEY": self.api_key}
        if signed:
            params["timestamp"] = str(int(datetime.now(timezone.utc).timestamp() * 1000))
            params["recvWindow"] = 5000
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            params["signature"] = self._sign(query_string)

        url = f"{self.BASE_URL}{endpoint}"
        try:
            if method == "GET":
                response = await self.client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await self.client.post(url, params=params, headers=headers)
            elif method == "DELETE":
                response = await self.client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            data = response.json()
            if response.status_code >= 400:
                logger.error("binance_api_error", status=response.status_code, error=data)
                return {"success": False, "error": data.get("msg", str(data))}
            return {"success": True, "data": data}
        except Exception as e:
            logger.error("binance_request_failed", error=str(e))
            return {"success": False, "error": str(e)}

    async def get_ticker_price(self, symbol: str) -> Dict:
        """Public, unsigned last-price lookup."""
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/fapi/v1/ticker/price",
                params={"symbol": symbol.replace("/", "").replace("-", "").upper()}
            )
            data = response.json()
            if "price" not in data:
                return {"success": False, "error": data.get("msg", str(data))}
            return {"success": True, "price": float(data["price"])}
        except Exception as e:
            logger.error("binance_ticker_failed", error=str(e))
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
        Places the entry order, then (best-effort) two follow-up
        reduce-only STOP_MARKET / TAKE_PROFIT_MARKET orders if SL/TP
        were given — Binance Futures has no single-call "attached"
        SL/TP the way BingX does, these are genuinely separate orders.
        """
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        params = {
            "symbol": symbol_clean,
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": quantity,
        }
        if order_type.upper() == "LIMIT":
            params["timeInForce"] = "GTC"
            if price:
                params["price"] = price

        result = await self._request("POST", "/fapi/v1/order", params)
        if not result["success"]:
            return result

        order_data = result["data"]
        response = {
            "success": True,
            "order_id": order_data.get("orderId"),
            "symbol": symbol_clean,
            "status": order_data.get("status", "NEW"),
        }

        close_side = "SELL" if side.upper() == "BUY" else "BUY"
        if stop_loss:
            sl_result = await self._request("POST", "/fapi/v1/order", {
                "symbol": symbol_clean, "side": close_side, "type": "STOP_MARKET",
                "stopPrice": stop_loss, "closePosition": "true",
            })
            response["stop_loss_order_id"] = sl_result.get("data", {}).get("orderId") if sl_result["success"] else None
            if not sl_result["success"]:
                logger.error("binance_sl_attach_failed", error=sl_result.get("error"))
        if take_profit:
            tp_result = await self._request("POST", "/fapi/v1/order", {
                "symbol": symbol_clean, "side": close_side, "type": "TAKE_PROFIT_MARKET",
                "stopPrice": take_profit, "closePosition": "true",
            })
            response["take_profit_order_id"] = tp_result.get("data", {}).get("orderId") if tp_result["success"] else None
            if not tp_result["success"]:
                logger.error("binance_tp_attach_failed", error=tp_result.get("error"))

        logger.info("binance_order_placed", symbol=symbol_clean, side=side, order_id=response["order_id"])
        return response

    async def close_position(self, symbol: str, side: str) -> Dict:
        """Close an open position with an opposite reduce-only market order."""
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        close_side = "SELL" if side.upper() == "BUY" else "BUY"
        position = await self.get_position(symbol_clean)
        qty = 0.0
        if position["success"] and position.get("data"):
            positions = position["data"] if isinstance(position["data"], list) else [position["data"]]
            for p in positions:
                if p.get("symbol") == symbol_clean:
                    qty = abs(float(p.get("positionAmt", 0)))
        if qty == 0:
            return {"success": False, "error": "No open position quantity found to close"}
        return await self._request("POST", "/fapi/v1/order", {
            "symbol": symbol_clean, "side": close_side, "type": "MARKET",
            "quantity": qty, "reduceOnly": "true",
        })

    async def get_position(self, symbol: str) -> Dict:
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        return await self._request("GET", "/fapi/v2/positionRisk", {"symbol": symbol_clean})

    async def get_balance(self) -> Dict:
        result = await self._request("GET", "/fapi/v2/balance")
        if result["success"]:
            usdt = next((a for a in result["data"] if a.get("asset") == "USDT"), None)
            if usdt:
                return {"success": True, "balance": float(usdt.get("balance", 0)),
                        "available_balance": float(usdt.get("availableBalance", 0))}
        return result

    async def set_leverage(self, symbol: str, leverage: int) -> Dict:
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        return await self._request("POST", "/fapi/v1/leverage", {"symbol": symbol_clean, "leverage": leverage})


# =============================================================================
# BYBIT BROKER INTEGRATION (V5 Unified, linear/USDT perpetuals)
# =============================================================================

class BybitBroker:
    """
    Bybit V5 unified-account API client (linear/USDT perpetuals).

    Base URL: https://api.bybit.com
    Documentation: https://bybit-exchange.github.io/docs/v5/intro

    NOTE: written from Bybit's documented request/signing shape, not
    exercised against a live account in this session — verify against
    Bybit's testnet (https://testnet.bybit.com) before trading real size.
    """

    BASE_URL = "https://api.bybit.com"
    RECV_WINDOW = "5000"

    def __init__(self, api_key: str, api_secret: str, demo: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.demo = demo
        self.client = httpx.AsyncClient(timeout=30.0)

    def _sign(self, timestamp: str, payload: str) -> str:
        raw = f"{timestamp}{self.api_key}{self.RECV_WINDOW}{payload}"
        return hmac.new(self.api_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()

    async def _request(self, method: str, endpoint: str, params: Dict = None) -> Dict:
        params = params or {}
        timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))

        if method == "GET":
            query_string = "&".join(f"{k}={v}" for k, v in sorted(params.items())) if params else ""
            signature = self._sign(timestamp, query_string)
        else:
            query_string = json.dumps(params) if params else "{}"
            signature = self._sign(timestamp, query_string)

        headers = {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-SIGN": signature,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": self.RECV_WINDOW,
            "Content-Type": "application/json",
        }
        url = f"{self.BASE_URL}{endpoint}"

        try:
            if method == "GET":
                response = await self.client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await self.client.post(url, headers=headers, content=query_string)
            else:
                raise ValueError(f"Unsupported method: {method}")

            data = response.json()
            if data.get("retCode") != 0:
                logger.error("bybit_api_error", code=data.get("retCode"), msg=data.get("retMsg"))
                return {"success": False, "error": data.get("retMsg")}
            return {"success": True, "data": data.get("result", {})}
        except Exception as e:
            logger.error("bybit_request_failed", error=str(e))
            return {"success": False, "error": str(e)}

    async def get_ticker_price(self, symbol: str) -> Dict:
        """Public, unsigned last-price lookup."""
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/v5/market/tickers",
                params={"category": "linear", "symbol": symbol_clean}
            )
            data = response.json()
            tickers = data.get("result", {}).get("list", [])
            if not tickers:
                return {"success": False, "error": data.get("retMsg", "no ticker data")}
            return {"success": True, "price": float(tickers[0]["lastPrice"])}
        except Exception as e:
            logger.error("bybit_ticker_failed", error=str(e))
            return {"success": False, "error": str(e)}

    async def place_order(self,
                         symbol: str,
                         side: str,  # BUY or SELL (Bybit expects "Buy"/"Sell")
                         order_type: str,  # MARKET or LIMIT
                         quantity: float,
                         price: Optional[float] = None,
                         stop_loss: Optional[float] = None,
                         take_profit: Optional[float] = None) -> Dict:
        """
        Bybit V5 supports attaching takeProfit/stopLoss directly on the
        entry order (unlike Binance) — one call, like BingX.
        """
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        params = {
            "category": "linear",
            "symbol": symbol_clean,
            "side": "Buy" if side.upper() == "BUY" else "Sell",
            "orderType": "Market" if order_type.upper() == "MARKET" else "Limit",
            "qty": str(quantity),
        }
        if order_type.upper() == "LIMIT" and price:
            params["price"] = str(price)
        if stop_loss:
            params["stopLoss"] = str(stop_loss)
        if take_profit:
            params["takeProfit"] = str(take_profit)

        result = await self._request("POST", "/v5/order/create", params)
        if result["success"]:
            order_data = result["data"]
            logger.info("bybit_order_placed", symbol=symbol_clean, side=side, order_id=order_data.get("orderId"))
            return {
                "success": True,
                "order_id": order_data.get("orderId"),
                "symbol": symbol_clean,
                "status": "NEW",
            }
        return result

    async def close_position(self, symbol: str, side: str) -> Dict:
        """Close via Bybit's reduce-only market order against the open size."""
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        position = await self.get_position(symbol_clean)
        qty = 0.0
        if position["success"] and position.get("data"):
            for p in position["data"]:
                if p.get("symbol") == symbol_clean:
                    qty = abs(float(p.get("size", 0)))
        if qty == 0:
            return {"success": False, "error": "No open position quantity found to close"}
        close_side = "Sell" if side.upper() == "BUY" else "Buy"
        return await self._request("POST", "/v5/order/create", {
            "category": "linear", "symbol": symbol_clean, "side": close_side,
            "orderType": "Market", "qty": str(qty), "reduceOnly": True,
        })

    async def get_position(self, symbol: str) -> Dict:
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        result = await self._request("GET", "/v5/position/list", {"category": "linear", "symbol": symbol_clean})
        if result["success"]:
            return {"success": True, "data": result["data"].get("list", [])}
        return result

    async def get_balance(self) -> Dict:
        result = await self._request("GET", "/v5/account/wallet-balance", {"accountType": "UNIFIED"})
        if result["success"]:
            accounts = result["data"].get("list", [])
            if accounts:
                acc = accounts[0]
                return {
                    "success": True,
                    "balance": float(acc.get("totalWalletBalance", 0)),
                    "equity": float(acc.get("totalEquity", 0)),
                    "available_balance": float(acc.get("totalAvailableBalance", 0)),
                }
        return result

    async def set_leverage(self, symbol: str, leverage: int) -> Dict:
        symbol_clean = symbol.replace("/", "").replace("-", "").upper()
        return await self._request("POST", "/v5/position/set-leverage", {
            "category": "linear", "symbol": symbol_clean,
            "buyLeverage": str(leverage), "sellLeverage": str(leverage),
        })


# =============================================================================
# MEXC BROKER INTEGRATION (Futures/Contract)
# =============================================================================

class MexcBroker:
    """
    MEXC Futures (contract) API client.

    Base URL: https://contract.mexc.com
    Documentation: https://mexcdevelop.github.io/apidocs/contract_v1_en/

    NOTE: written from MEXC's documented request/signing shape, not
    exercised against a live account in this session — verify against
    a small/demo position before trading real size.
    """

    BASE_URL = "https://contract.mexc.com"

    def __init__(self, api_key: str, api_secret: str, demo: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.demo = demo
        self.client = httpx.AsyncClient(timeout=30.0)

    def _sign(self, timestamp: str, param_string: str) -> str:
        raw = f"{self.api_key}{timestamp}{param_string}"
        return hmac.new(self.api_secret.encode(), raw.encode(), hashlib.sha256).hexdigest()

    async def _request(self, method: str, endpoint: str, params: Dict = None) -> Dict:
        params = params or {}
        timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))

        if method == "GET":
            param_string = "&".join(f"{k}={v}" for k, v in sorted(params.items())) if params else ""
        else:
            param_string = json.dumps(params) if params else ""

        headers = {
            "ApiKey": self.api_key,
            "Request-Time": timestamp,
            "Signature": self._sign(timestamp, param_string),
            "Content-Type": "application/json",
        }
        url = f"{self.BASE_URL}{endpoint}"

        try:
            if method == "GET":
                response = await self.client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await self.client.post(url, headers=headers, content=param_string or "{}")
            else:
                raise ValueError(f"Unsupported method: {method}")

            data = response.json()
            if not data.get("success", False):
                logger.error("mexc_api_error", code=data.get("code"), msg=data.get("message"))
                return {"success": False, "error": data.get("message", str(data))}
            return {"success": True, "data": data.get("data")}
        except Exception as e:
            logger.error("mexc_request_failed", error=str(e))
            return {"success": False, "error": str(e)}

    @staticmethod
    def _mexc_symbol(symbol: str) -> str:
        """MEXC contract symbols use BASE_QUOTE, e.g. BTC_USDT."""
        s = symbol.replace("-", "").replace("/", "").upper()
        if "_" in symbol:
            return symbol.upper()
        for quote in ("USDT", "USDC", "USD"):
            if s.endswith(quote):
                return f"{s[:-len(quote)]}_{quote}"
        return s

    async def get_ticker_price(self, symbol: str) -> Dict:
        """Public, unsigned last-price lookup."""
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/api/v1/contract/ticker",
                params={"symbol": self._mexc_symbol(symbol)}
            )
            data = response.json()
            ticker = data.get("data")
            if not ticker or "lastPrice" not in ticker:
                return {"success": False, "error": data.get("message", "no ticker data")}
            return {"success": True, "price": float(ticker["lastPrice"])}
        except Exception as e:
            logger.error("mexc_ticker_failed", error=str(e))
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
        MEXC contract order sides are numeric (1=open long, 2=close
        short, 3=open short, 4=close long) rather than BUY/SELL — this
        maps our simple long/short vocabulary onto that, and attaches
        SL/TP directly on the entry order (MEXC supports this, like
        Bybit/BingX).
        """
        mexc_symbol = self._mexc_symbol(symbol)
        side_code = 1 if side.upper() == "BUY" else 3  # open long / open short
        params = {
            "symbol": mexc_symbol,
            "side": side_code,
            "type": 5 if order_type.upper() == "MARKET" else 1,  # 5=market, 1=limit
            "openType": 2,  # cross margin
            "vol": quantity,
        }
        if order_type.upper() == "LIMIT" and price:
            params["price"] = price
        if stop_loss:
            params["stopLossPrice"] = stop_loss
        if take_profit:
            params["takeProfitPrice"] = take_profit

        result = await self._request("POST", "/api/v1/private/order/submit", params)
        if result["success"]:
            logger.info("mexc_order_placed", symbol=mexc_symbol, side=side, order_id=result["data"])
            return {
                "success": True,
                "order_id": result["data"],
                "symbol": mexc_symbol,
                "status": "NEW",
            }
        return result

    async def close_position(self, symbol: str, side: str) -> Dict:
        """Close via an opposite close-side order sized to the open position."""
        mexc_symbol = self._mexc_symbol(symbol)
        position = await self.get_position(mexc_symbol)
        qty = 0.0
        if position["success"] and position.get("data"):
            for p in position["data"]:
                if p.get("symbol") == mexc_symbol:
                    qty = abs(float(p.get("holdVol", 0)))
        if qty == 0:
            return {"success": False, "error": "No open position quantity found to close"}
        close_side_code = 4 if side.upper() == "BUY" else 2  # close long / close short
        return await self._request("POST", "/api/v1/private/order/submit", {
            "symbol": mexc_symbol, "side": close_side_code, "type": 5,
            "openType": 2, "vol": qty,
        })

    async def get_position(self, symbol: str) -> Dict:
        mexc_symbol = self._mexc_symbol(symbol)
        result = await self._request("GET", "/api/v1/private/position/open_positions", {"symbol": mexc_symbol})
        if result["success"]:
            data = result["data"]
            return {"success": True, "data": data if isinstance(data, list) else [data]}
        return result

    async def get_balance(self) -> Dict:
        result = await self._request("GET", "/api/v1/private/account/assets")
        if result["success"]:
            assets = result["data"] if isinstance(result["data"], list) else [result["data"]]
            usdt = next((a for a in assets if a.get("currency") == "USDT"), None)
            if usdt:
                return {"success": True, "balance": float(usdt.get("equity", 0)),
                        "available_balance": float(usdt.get("availableBalance", 0))}
        return result

    async def set_leverage(self, symbol: str, leverage: int) -> Dict:
        return await self._request("POST", "/api/v1/private/position/change_leverage", {
            "symbol": self._mexc_symbol(symbol), "leverage": leverage, "openType": 2,
        })
