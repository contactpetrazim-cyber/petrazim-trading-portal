
"""
Market Data Ingestion Service
Handles real-time and historical price data from multiple sources.
Supports: CCXT (Binance, Bybit), Yahoo Finance, CSV files, WebSocket feeds.
"""

from typing import List, Optional, Dict, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import asyncio
import time
import aiohttp
import pandas as pd
import structlog
from app.config import get_settings
from app.core.smc_algorithms import Candle

logger = structlog.get_logger()
settings = get_settings()

# Same per-exchange static-IP proxies execution_engine.py's own
# BinanceBroker/BybitBroker/BingXBroker/MexcBroker already route every
# SIGNED order-placement call through (most exchanges require
# whitelisting a fixed IP for a trading-enabled key, which Render's own
# dynamic egress IP can't satisfy) — by direct request ("no proxy
# fallback, unlike order placement ... build that resilience fix").
# Candle-fetching never needed a whitelisted IP (it's public market
# data, no signing), so it was left on Render's raw IP — which is
# exactly what a real Binance IP ban (HTTP 418, "Way too many
# requests ... banned until ...", confirmed live in production logs)
# then took down entirely: every bot's own candle fetch AND the Trade
# Snapshot/Encroachment endpoints all share this one ingestion path.
# Routing candle-fetching through the SAME proxies closes that gap —
# a ban on one IP (direct or either proxy) no longer blocks the others.
# okx/kucoin have no proxy configured here (same as execution_engine.py
# — neither is a real order-placement broker in this app today) and
# fall through to a direct connection, unchanged from before.
_PROXY_SETTINGS = {
    "binance": ("BINANCE_PROXY_URL", "BINANCE_BACKUP_PROXY_URL"),
    "bybit": ("BYBIT_PROXY_URL", "BYBIT_BACKUP_PROXY_URL"),
    "bingx": ("BINGX_PROXY_URL", "BINGX_BACKUP_PROXY_URL"),
    "mexc": ("MEXC_PROXY_URL", "MEXC_BACKUP_PROXY_URL"),
}


def to_ccxt_symbol(symbol: str) -> str:
    """
    "BTCUSDT" (TradingView/BotConfig convention, no separator) ->
    "BTC/USDT" (ccxt convention, required). A symbol that already has a
    "/" is returned unchanged.

    ".P" (TradingView's own perpetual-futures suffix — e.g. "BTCUSDT.P",
    the exact symbol format every active bot's BotConfig.symbols uses,
    same convention order_flow.py's _resolve_market strips before its
    own Binance calls) maps to ccxt's own unified symbol for a linear
    perpetual swap: "BASE/QUOTE:QUOTE" — e.g. "BTC/USDT:USDT". This is
    what actually routes a ccxt call to the futures/swap market instead
    of spot; passing "BTCUSDT.P" through unchanged (the bug this fixes)
    made every market-scanner candle fetch for a futures bot fail with
    "binance does not have market symbol BTCUSDT.P", so autonomous
    scanning never had any real candles to run strategies against.
    """
    if symbol.upper().endswith(".P"):
        base_symbol = to_ccxt_symbol(symbol[:-2])
        if "/" in base_symbol:
            quote = base_symbol.split("/", 1)[1]
            return f"{base_symbol}:{quote}"
        return base_symbol
    if "/" in symbol:
        return symbol.upper()
    symbol = symbol.upper()
    for quote in ("USDT", "USDC", "BUSD", "USD"):
        if symbol.endswith(quote) and len(symbol) > len(quote):
            return f"{symbol[:-len(quote)]}/{quote}"
    return symbol

@dataclass
class DataSourceConfig:
    name: str
    source_type: str  # "ccxt", "yahoo", "csv", "websocket"
    symbol: str
    timeframe: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None

class MarketDataIngestion:
    """
    Unified market data ingestion layer.

    Usage:
        ingestion = MarketDataIngestion()
        candles = await ingestion.fetch_historical(
            source="ccxt",
            exchange="binance",
            symbol="BTC/USDT",
            timeframe="1h",
            limit=500
        )
    """

    # See symbol_is_tradeable's own docstring.
    _MARKETS_CACHE_TTL_SECONDS = 3600.0

    def __init__(self):
        self.active_streams: Dict[str, asyncio.Task] = {}
        self.candle_buffer: Dict[str, List[Candle]] = {}
        # One long-lived ccxt exchange instance per exchange id, reused
        # across every call — by direct report ("confirm my five bots
        # are active ... I have received no recommendation ... fix").
        # Root cause: this used to create a FRESH exchange_class(...)
        # instance (and `await ex.close()` it) on every single
        # fetch_historical_ccxt call — 5 timeframes x every scan cycle,
        # every ~3 minutes, forever. Two real costs to that: (1) a
        # fresh instance's first fetch_ohlcv call also triggers a full
        # loadMarkets() (Binance's whole exchangeInfo, a heavy request)
        # EVERY time instead of once, and (2) `enableRateLimit: True`
        # only self-paces requests using state kept ON that instance —
        # a fresh instance every call means that pacing has no memory
        # of how recently the last request went out, so it can't
        # actually prevent bursting. Both together are exactly what
        # produced the real, observed failure: Binance's own IP-ban
        # error (HTTP 418, "Way too many requests ... banned until
        # ...") on this exact (exchange="binance", symbol="BTCUSDT.P")
        # scan group, confirmed directly from production logs — not a
        # bad symbol/market lookup (that separate bug, "does not have
        # market symbol BTCUSDT.P", was already fixed — see
        # to_ccxt_symbol's own docstring). While banned, every scan
        # cycle fails for every bot, which is the actual reason no bot
        # ever produced a recommendation: zero real candle data ever
        # reached BotOrchestrator to analyze.
        self._exchange_clients: Dict[str, object] = {}
        # Three routing tiers per exchange, each its own cached client
        # (long-lived, same reasoning as self._exchange_clients' own
        # comment above) — see _get_exchange_client's own docstring.
        self._exchange_backup_clients: Dict[str, object] = {}
        self._exchange_direct_clients: Dict[str, object] = {}
        # (loaded_at_monotonic, markets_dict) per exchange — see
        # symbol_is_tradeable's own docstring.
        self._markets_cache: Dict[str, "tuple[float, dict]"] = {}

    def _build_exchange_client(self, exchange: str, proxy_url: Optional[str]):
        import ccxt.async_support as ccxt_async
        try:
            exchange_class = getattr(ccxt_async, exchange)
        except AttributeError:
            raise ValueError(f"Unknown ccxt exchange id: {exchange!r}")
        client = exchange_class({'enableRateLimit': True})
        if proxy_url:
            # ccxt 4.x's own unified proxy attribute (confirmed present
            # on a live instance of this exact installed version) —
            # exchange APIs here are HTTPS-only, so only this one is
            # set. Real bug, found by actually exercising this against
            # a live ccxt instance before shipping: setting BOTH
            # httpsProxy and httpProxy raises ccxt.ProxyError
            # ("multiple conflicting proxy settings"), which would have
            # made every proxied route fail at construction time.
            client.httpsProxy = proxy_url
        return client

    def _get_exchange_client(self, exchange: str, route: str = "proxy"):
        """`route`: "proxy" (default — the same static-IP proxy order
        placement uses for this exchange, or a direct connection for an
        exchange with none configured), "backup" (the Fixie backup
        proxy), or "direct" (no proxy at all, Render's own raw IP —
        the ONLY route this method had before this fix, and the one a
        direct-IP ban like the one that prompted this change takes
        down entirely)."""
        primary_setting, backup_setting = _PROXY_SETTINGS.get(exchange, (None, None))

        if route == "backup":
            if exchange not in self._exchange_backup_clients:
                proxy_url = getattr(settings, backup_setting, "") if backup_setting else ""
                self._exchange_backup_clients[exchange] = self._build_exchange_client(exchange, proxy_url or None)
            return self._exchange_backup_clients[exchange]

        if route == "direct":
            if exchange not in self._exchange_direct_clients:
                self._exchange_direct_clients[exchange] = self._build_exchange_client(exchange, None)
            return self._exchange_direct_clients[exchange]

        if exchange not in self._exchange_clients:
            proxy_url = getattr(settings, primary_setting, "") if primary_setting else ""
            self._exchange_clients[exchange] = self._build_exchange_client(exchange, proxy_url or None)
        return self._exchange_clients[exchange]

    async def fetch_historical_ccxt(self,
                                    exchange: str,
                                    symbol: str,
                                    timeframe: str,
                                    limit: int = 500,
                                    since: Optional[datetime] = None) -> List[Candle]:
        """
        Fetch historical OHLCV data via CCXT.

        Timeframe mapping:
        - "1m", "5m", "15m", "1h", "4h", "1d"

        NOTE: this used to instantiate plain `ccxt` (the synchronous
        package) and call `ex.fetch_ohlcv(...)` with no `await` inside
        this `async def` — a blocking network call that freezes the
        entire asyncio event loop (every other request, every
        websocket) for as long as the exchange takes to respond. Fixed
        to use `ccxt.async_support`, ccxt's actual asyncio-native
        variant, so this is now genuinely non-blocking. Also: the
        symbol normalization line computed `ccxt_symbol` but then
        never used it, passing the original (wrong-format) `symbol` to
        fetch_ohlcv — and the direction was backwards anyway (it
        stripped "/" rather than inserting one). ccxt requires
        "BTC/USDT", not "BTCUSDT"; see to_ccxt_symbol() above.

        Proxy failover — by direct request ("no proxy fallback, unlike
        order placement ... build that resilience fix"): tries the
        proxy route first (_PROXY_SETTINGS — the same static IP order
        placement uses for this exchange), then the Fixie backup proxy,
        then a direct connection, stopping at the first one that
        actually returns candles. Only a ccxt.NetworkError (connection
        failures, AND the ban/rate-limit responses themselves —
        DDoSProtection/RateLimitExceeded/ExchangeNotAvailable all
        inherit from it — see that class hierarchy) advances to the
        next route; an exchange genuinely rejecting the request for a
        reason unrelated to which IP it came from (bad symbol, ...)
        is not retried, same "don't blindly retry an application
        error" principle as broker_integrations.py's own
        _send_with_failover.
        """
        ccxt_symbol = to_ccxt_symbol(symbol)
        since_ms = int(since.timestamp() * 1000) if since else None

        import ccxt
        routes = ["proxy", "backup", "direct"]
        last_error: Optional[Exception] = None
        for i, route in enumerate(routes):
            try:
                ex = self._get_exchange_client(exchange, route)
                ohlcv = await ex.fetch_ohlcv(ccxt_symbol, timeframe, since=since_ms, limit=limit)
                if i > 0:
                    logger.warning("candle_fetch_route_failover", exchange=exchange, route=route, previous_error=str(last_error))
                return [
                    Candle(
                        # Naive-but-UTC, matching every other timestamp
                        # in this codebase (smc_algorithms.py etc. use
                        # datetime.utcnow()) — an aware datetime here
                        # would raise "can't compare offset-naive and
                        # offset-aware datetimes" the moment it's
                        # compared against one of those.
                        timestamp=datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).replace(tzinfo=None),
                        open=float(open_p), high=float(high_p), low=float(low_p), close=float(close_p), volume=float(volume),
                    )
                    for timestamp_ms, open_p, high_p, low_p, close_p, volume in ohlcv
                ]
            except (ccxt.NetworkError, ccxt.ProxyError) as e:
                # ProxyError (malformed proxy config, unreachable proxy
                # at the transport level) is NOT a ccxt.NetworkError
                # subclass — it inherits from ExchangeError instead —
                # but it's exactly as eligible for failover as one:
                # this specific route's transport is broken, not the
                # exchange rejecting the actual request.
                last_error = e
                continue
            except Exception as e:
                raise Exception(f"Failed to fetch from {exchange}: {str(e)}")

        raise Exception(f"Failed to fetch from {exchange} via every route (proxy, backup, direct): {last_error}")
        # No `finally: await ex.close()` any more — every client is
        # long-lived (cached per exchange+route), not a one-shot
        # resource. Cleaned up when the process exits.

    async def symbol_is_tradeable(self, exchange: str, symbol: str) -> bool:
        """True iff `symbol` (TradingView/BotConfig format, e.g.
        "BTCUSDT.P") is a real, active market on `exchange` — used by
        services/exchange_engine.py to decide whether a bot's OWN
        credentialed exchange is even a legitimate Auto-mode candidate
        for its configured symbol, rather than assuming every
        credentialed exchange carries every symbol. Markets are loaded
        once per exchange and cached for _MARKETS_CACHE_TTL_SECONDS
        (a real exchange's listed markets change rarely enough that
        reloading on every single call would be pure waste). Fails
        OPEN (returns True) on a markets-load error — a transient
        exchange-API hiccup should never by itself block a bot from
        trading on an exchange it's otherwise fully credentialed for;
        a genuinely bad symbol still gets caught downstream the normal
        way (the candle fetch itself raising)."""
        ccxt_symbol = to_ccxt_symbol(symbol)
        now = time.monotonic()
        cached = self._markets_cache.get(exchange)
        if cached and (now - cached[0]) < self._MARKETS_CACHE_TTL_SECONDS:
            markets = cached[1]
        else:
            try:
                client = self._get_exchange_client(exchange)
                markets = await client.load_markets()
                self._markets_cache[exchange] = (now, markets)
            except Exception as e:
                logger.warning("symbol_tradeable_check_failed", exchange=exchange, symbol=symbol, error=str(e))
                return True
        market = markets.get(ccxt_symbol)
        return bool(market and market.get("active", True))

    async def fetch_historical_yahoo(self,
                                     symbol: str,
                                     period: str = "1mo",
                                     interval: str = "1h") -> List[Candle]:
        """
        Fetch historical data from Yahoo Finance.
        Good for stocks and forex.
        """
        try:
            import yfinance as yf

            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)

            candles = []
            for idx, row in df.iterrows():
                candles.append(Candle(
                    timestamp=idx.to_pydatetime(),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=float(row['Volume'])
                ))

            return candles

        except ImportError:
            raise ImportError("yfinance not installed. Run: pip install yfinance")

    async def load_from_csv(self, filepath: str) -> List[Candle]:
        """
        Load candles from CSV file.
        Expected columns: timestamp, open, high, low, close, volume
        """
        df = pd.read_csv(filepath)

        # Parse timestamp
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        elif 'date' in df.columns:
            df['timestamp'] = pd.to_datetime(df['date'])

        candles = []
        for _, row in df.iterrows():
            candles.append(Candle(
                timestamp=row['timestamp'],
                open=float(row['open']),
                high=float(row['high']),
                low=float(row['low']),
                close=float(row['close']),
                volume=float(row.get('volume', 0))
            ))

        return candles

    async def websocket_feed(self,
                            exchange: str,
                            symbol: str,
                            callback) -> None:
        """
        Connect to real-time WebSocket feed.
        Currently supports Binance and Bybit.
        """
        if exchange == "binance":
            ws_url = f"wss://stream.binance.com:9443/ws/{symbol.lower()}@kline_1m"
        elif exchange == "bybit":
            ws_url = f"wss://stream.bybit.com/v5/public/linear"
        else:
            raise ValueError(f"Unsupported exchange: {exchange}")

        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(ws_url) as ws:
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = msg.json()
                        # Parse and convert to Candle
                        candle = self._parse_websocket_message(data, exchange)
                        if candle:
                            await callback(candle)
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        break

    def _parse_websocket_message(self, data: dict, exchange: str) -> Optional[Candle]:
        """Parse exchange-specific WebSocket message format."""
        try:
            if exchange == "binance":
                kline = data.get('k', {})
                return Candle(
                    timestamp=datetime.fromtimestamp(kline['t'] / 1000),
                    open=float(kline['o']),
                    high=float(kline['h']),
                    low=float(kline['l']),
                    close=float(kline['c']),
                    volume=float(kline['v'])
                )
            return None
        except (KeyError, ValueError):
            return None

    async def run_bot_analysis(self,
                               bot_id: str,
                               symbol: str,
                               timeframes: List[str],
                               account_balance: float) -> Optional[Dict]:
        """
        Fetch data for all required timeframes and run bot analysis.

        This is the main entry point for automated analysis.
        """
        from app.core.bot_strategies import BotOrchestrator

        # Fetch data for each timeframe
        market_data = {}

        for tf in timeframes:
            # Map timeframe to CCXT format
            ccxt_tf = tf.replace("M", "m").replace("H", "h").replace("D", "d")
            candles = await self.fetch_historical_ccxt(
                exchange="binance",
                symbol=symbol,
                timeframe=ccxt_tf,
                limit=200
            )
            market_data[tf] = candles

        market_data["symbol"] = symbol

        # Run bot analysis
        orchestrator = BotOrchestrator({})
        signals = orchestrator.run_all(market_data, account_balance)

        return {
            "symbol": symbol,
            "timeframes": timeframes,
            "signals": signals,
            "timestamp": datetime.utcnow()
        }


# ONE true app-wide instance — by critical investigation into "wake up
# taking longer than usual," traced to the Render free-tier backend
# (512MB cap) OOM-crash-looping roughly every 1-3 minutes (confirmed
# live via Render's own logs: memory_watchdog_elevated readings
# climbing to ~81% of the cap within a couple of minutes of every
# fresh restart, each followed by a restart of the SAME container
# instance with no graceful app_shutdown log line in between — the
# signature of an external OOM-kill, not a normal deploy or the
# scanner's own watchdog, which only logs/GCs and never force-exits).
#
# Root cause: market_scanner.py's MarketScanner and routers/trades.py's
# Trade Snapshot/Encroachment endpoints each held their OWN separate,
# long-lived MarketDataIngestion() instance — and this class's own
# _exchange_clients cache deliberately NEVER closes a ccxt client once
# created (see fetch_historical_ccxt's own comment), because closing
# and recreating per-call was the exact mistake that caused the earlier
# real Binance IP ban. Two independent instances both touching the
# same exchange (binance is the default for both paths) each trigger
# their OWN ccxt loadMarkets() the first time they're used — Binance
# alone has 2000+ markets, and ccxt's parsed-market cache for that is
# genuinely tens of MB per instance. Two live copies of that, on top
# of five autonomous bots' own per-cycle candle buffers, is a direct,
# avoidable contributor to a 512MB cap being exhausted this fast.
#
# Every long-lived caller (anything that isn't a short, one-off, human-
# triggered action — see routers/trades.py's reanalyze_trade for the
# one deliberate exception, which stays a fresh short-lived instance
# precisely because it's single-shot and GC'd right after) should
# import and reuse THIS instance rather than constructing its own.
shared_ingestion = MarketDataIngestion()
