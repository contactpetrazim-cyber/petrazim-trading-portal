
"""
Market Data Ingestion Service
Handles real-time and historical price data from multiple sources.
Supports: CCXT (Binance, Bybit), Yahoo Finance, CSV files, WebSocket feeds.
"""

from typing import List, Optional, Dict, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime, timedelta
import asyncio
import aiohttp
import pandas as pd
from app.core.smc_algorithms import Candle

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

    def __init__(self):
        self.active_streams: Dict[str, asyncio.Task] = {}
        self.candle_buffer: Dict[str, List[Candle]] = {}

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
        """
        try:
            import ccxt

            ex = getattr(ccxt, exchange)({
                'enableRateLimit': True,
            })

            # Convert symbol format
            ccxt_symbol = symbol.replace("/", "")

            # Fetch OHLCV
            since_ms = int(since.timestamp() * 1000) if since else None
            ohlcv = ex.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=limit)

            candles = []
            for data in ohlcv:
                timestamp_ms, open_p, high_p, low_p, close_p, volume = data
                candles.append(Candle(
                    timestamp=datetime.fromtimestamp(timestamp_ms / 1000),
                    open=float(open_p),
                    high=float(high_p),
                    low=float(low_p),
                    close=float(close_p),
                    volume=float(volume)
                ))

            return candles

        except ImportError:
            raise ImportError("CCXT not installed. Run: pip install ccxt")
        except Exception as e:
            raise Exception(f"Failed to fetch from {exchange}: {str(e)}")

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
