"""
Order Flow Router — real tape, footprint/delta, and DOM data
==================================================================

Backs the real Order Flow Chart tool (/tools/order-flow) and the
Order Flow Trading curriculum module (curriculum/ORDER_FLOW_TRADING.md,
OF-01 through OF-11) with GENUINE transaction-level data — not a
simulation. This platform's own broker integrations and Candle model
carry no tick-level trade or order-book data anywhere (see
ORDER_FLOW_TRADING.md's own opening note), so rather than fabricate
that data, this proxies Binance's public market-data REST API —
free, no API key required, no account needed — for a fixed list of
liquid crypto pairs.

This is deliberately scoped to Binance's spot market data only:
- GET /api/v3/trades — individual trade prints, each carrying a real
  `isBuyerMaker` flag that tells you which side was the aggressor
  (OF-02's exact "who crossed the spread" question, answered by real
  data): isBuyerMaker=true means the resting order was a BUY, so the
  taker/aggressor SOLD (traded at the bid); isBuyerMaker=false means
  the taker/aggressor BOUGHT (traded at the ask).
- GET /api/v3/depth — real resting order-book depth (OF-05's DOM).

Symbols are restricted to a small allow-list of liquid pairs rather
than an open passthrough, to keep this platform's own exposure to
Binance's public rate limits bounded and predictable.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.broker_integrations import _FAILOVER_EXCEPTIONS, _send_with_failover

router = APIRouter(prefix="/order-flow", tags=["order-flow"])

BINANCE_BASE_URL = "https://api.binance.com/api/v3"

# A small, fixed allow-list of liquid pairs — real Binance symbols,
# not an open passthrough. Extend this list rather than accepting an
# arbitrary symbol string from the client.
ALLOWED_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
]

# Binance geofences plenty of cloud-host IP ranges (Render's included) with
# a 451, which is why the chart could load from a developer's own machine
# but never from production — every other exchange call in this codebase
# (execution_engine.py, broker_credentials.py) already routes through the
# Fixie proxy pair for exactly this reason; this client previously didn't,
# which was the actual cause of "order flow chart not loading" in prod.
_settings = get_settings()
_client = httpx.AsyncClient(
    timeout=10.0, base_url=BINANCE_BASE_URL, proxy=_settings.BINANCE_PROXY_URL or None,
)
_backup_client = (
    httpx.AsyncClient(
        timeout=10.0, base_url=BINANCE_BASE_URL, proxy=_settings.BINANCE_BACKUP_PROXY_URL,
    )
    if _settings.BINANCE_BACKUP_PROXY_URL else None
)


def _validate_symbol(symbol: str) -> str:
    symbol = symbol.upper()
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported symbol '{symbol}' — choose one of {ALLOWED_SYMBOLS}.",
        )
    return symbol


async def _binance_get(path: str, params: dict) -> httpx.Response:
    try:
        resp = await _send_with_failover(_client, _backup_client, "get", path, params=params)
    except _FAILOVER_EXCEPTIONS as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Binance market data: {e}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Binance market data: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Binance returned {resp.status_code} for {path}")
    return resp


class SymbolsResponse(BaseModel):
    symbols: List[str]


@router.get("/symbols", response_model=SymbolsResponse)
async def list_symbols(user: User = Depends(require_active_access)):
    return SymbolsResponse(symbols=ALLOWED_SYMBOLS)


class TradePrint(BaseModel):
    price: float
    qty: float
    time: int
    aggressor: Literal["buy", "sell"]


@router.get("/trades", response_model=List[TradePrint])
async def get_trades(
    symbol: str = "BTCUSDT", limit: int = 60,
    user: User = Depends(require_active_access),
):
    """Real, live time & sales — the tape (OF-02). `limit` is capped at
    200 (Binance's own recent-trades endpoint doesn't need more for a
    live-feeling tape view, and it keeps this platform's own request
    weight small)."""
    symbol = _validate_symbol(symbol)
    limit = max(1, min(limit, 200))
    resp = await _binance_get("/trades", {"symbol": symbol, "limit": limit})
    raw = resp.json()
    return [
        TradePrint(
            price=float(t["price"]), qty=float(t["qty"]), time=t["time"],
            # isBuyerMaker=True: the resting order was a buy, so the
            # taker (aggressor) sold — traded at the bid.
            aggressor="sell" if t["isBuyerMaker"] else "buy",
        )
        for t in raw
    ]


class DepthLevel(BaseModel):
    price: float
    qty: float


class DepthResponse(BaseModel):
    bids: List[DepthLevel]
    asks: List[DepthLevel]


@router.get("/depth", response_model=DepthResponse)
async def get_depth(
    symbol: str = "BTCUSDT", limit: int = 10,
    user: User = Depends(require_active_access),
):
    """Real resting order-book depth (OF-05's DOM) — snapshot only, not
    a live-updating stream (that needs a websocket, a larger feature;
    this platform's own paid-access model and every other data route
    here are simple request/response, so a polled snapshot matches the
    existing pattern rather than introducing new infrastructure)."""
    symbol = _validate_symbol(symbol)
    limit = limit if limit in (5, 10, 20, 50, 100) else 10
    resp = await _binance_get("/depth", {"symbol": symbol, "limit": limit})
    raw = resp.json()
    return DepthResponse(
        bids=[DepthLevel(price=float(p), qty=float(q)) for p, q in raw["bids"]],
        asks=[DepthLevel(price=float(p), qty=float(q)) for p, q in raw["asks"]],
    )


# ---------------------------------------------------------------------------
# Footprint chart + volume profile — the "volume clusters" view (OF-04
# footprint, OF-03 volume profile), computed at real per-price-level
# resolution from genuine trades, not simulated. Every candle and every
# volume-profile row shares the SAME price grid (one tick size for the
# whole fetched window) so they visually align, the same way a real
# footprint chart's rows line up across candles and against its
# volume-profile panel.
# ---------------------------------------------------------------------------

class FootprintRow(BaseModel):
    row_price: float
    bid_volume: float   # aggressor SOLD at this price (hit the bid)
    ask_volume: float   # aggressor BOUGHT at this price (hit the ask)


class FootprintCandle(BaseModel):
    time_ms: int
    open: float
    high: float
    low: float
    close: float
    delta: float
    total_volume: float
    trade_count: int
    rows: List[FootprintRow]   # high-to-low, only rows this candle's own trades touched


class VolumeProfileRow(BaseModel):
    row_price: float
    volume: float


class FootprintChartResponse(BaseModel):
    symbol: str
    tick_size: float
    candles: List[FootprintCandle]
    volume_profile: List[VolumeProfileRow]   # high-to-low, same grid as candles' rows
    poc_price: float                          # the volume_profile row with the most volume


@router.get("/footprint-chart", response_model=FootprintChartResponse)
async def get_footprint_chart(
    symbol: str = "BTCUSDT", trade_limit: int = 1000, num_candles: int = 15, target_rows: int = 40,
    user: User = Depends(require_active_access),
):
    """Real bid/ask volume clusters per price level per candle — the
    same chart type as a professional footprint tool, built from
    genuine Binance trades rather than simulated. `target_rows` sets
    ONE tick size for the whole fetched price range (session_high to
    session_low), so every candle's rows and the volume_profile panel
    share the identical price grid and line up visually; a calmer
    candle naturally gets fewer rows and a volatile one gets more,
    exactly like a real footprint chart — this isn't a fixed row count
    forced onto every candle."""
    symbol = _validate_symbol(symbol)
    trade_limit = max(50, min(trade_limit, 1000))
    num_candles = max(3, min(num_candles, 30))
    target_rows = max(10, min(target_rows, 80))

    resp = await _binance_get("/trades", {"symbol": symbol, "limit": trade_limit})
    raw = resp.json()
    if not raw:
        raise HTTPException(status_code=404, detail="No recent trades available for this symbol")

    prices = [float(t["price"]) for t in raw]
    session_high, session_low = max(prices), min(prices)
    price_range = max(session_high - session_low, session_high * 0.0001, 1e-8)
    tick = price_range / target_rows

    def row_index(price: float) -> int:
        return int((price - session_low) // tick)

    times = [t["time"] for t in raw]
    t_min, t_max = min(times), max(times)
    span = max(1, t_max - t_min)
    candle_ms = max(1, span // num_candles)

    candle_trades: Dict[int, list] = defaultdict(list)
    for t in raw:
        idx = min(num_candles - 1, (t["time"] - t_min) // candle_ms)
        candle_trades[idx].append(t)

    candles: List[FootprintCandle] = []
    for idx in sorted(candle_trades.keys()):
        trs = sorted(candle_trades[idx], key=lambda t: t["time"])
        c_prices = [float(t["price"]) for t in trs]
        c_high, c_low = max(c_prices), min(c_prices)

        row_vols: Dict[int, dict] = defaultdict(lambda: {"bid": 0.0, "ask": 0.0})
        for t in trs:
            r = row_index(float(t["price"]))
            qty = float(t["qty"])
            if t["isBuyerMaker"]:
                row_vols[r]["bid"] += qty
            else:
                row_vols[r]["ask"] += qty

        r_low, r_high = row_index(c_low), row_index(c_high)
        rows = [
            FootprintRow(
                row_price=round(session_low + r * tick, 8),
                bid_volume=round(row_vols.get(r, {"bid": 0.0})["bid"], 6),
                ask_volume=round(row_vols.get(r, {"ask": 0.0})["ask"], 6),
            )
            for r in range(r_low, r_high + 1)
        ]
        rows.sort(key=lambda rw: rw.row_price, reverse=True)

        total_bid = sum(rw.bid_volume for rw in rows)
        total_ask = sum(rw.ask_volume for rw in rows)
        candles.append(FootprintCandle(
            time_ms=t_min + idx * candle_ms, open=c_prices[0], high=c_high, low=c_low, close=c_prices[-1],
            delta=round(total_ask - total_bid, 6), total_volume=round(total_ask + total_bid, 6),
            trade_count=len(trs), rows=rows,
        ))

    vp: Dict[int, float] = defaultdict(float)
    for t in raw:
        vp[row_index(float(t["price"]))] += float(t["qty"])
    volume_profile = sorted(
        (VolumeProfileRow(row_price=round(session_low + r * tick, 8), volume=round(v, 6)) for r, v in vp.items()),
        key=lambda rw: rw.row_price, reverse=True,
    )
    poc_row = max(vp.items(), key=lambda kv: kv[1])[0] if vp else 0
    poc_price = round(session_low + poc_row * tick, 8)

    return FootprintChartResponse(
        symbol=symbol, tick_size=round(tick, 8), candles=candles,
        volume_profile=volume_profile, poc_price=poc_price,
    )


# ---------------------------------------------------------------------------
# Klines (OHLC candles) — real historical price data, backing the
# "What Happens Next?" chart-prediction game and case-study
# walkthroughs (by direct request: "add games with price charts what
# will happen next ... past price simulation cases"). Deliberately
# real Binance history, not synthetic candles — the whole point of a
# prediction game is that the outcome is a genuine, already-settled
# fact the trainee didn't get to see yet, not something authored to
# have a "correct" answer.
# ---------------------------------------------------------------------------

ALLOWED_INTERVALS = ["15m", "1h", "4h", "1d"]


class KlineBar(BaseModel):
    time_ms: int
    open: float
    high: float
    low: float
    close: float


class KlinesResponse(BaseModel):
    symbol: str
    interval: str
    candles: List[KlineBar]


@router.get("/klines", response_model=KlinesResponse)
async def get_klines(
    symbol: str = "BTCUSDT", interval: str = "4h", limit: int = 60,
    user: User = Depends(require_active_access),
):
    symbol = _validate_symbol(symbol)
    if interval not in ALLOWED_INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {ALLOWED_INTERVALS}")
    limit = max(10, min(limit, 500))
    resp = await _binance_get("/klines", {"symbol": symbol, "interval": interval, "limit": limit})
    raw = resp.json()
    return KlinesResponse(
        symbol=symbol, interval=interval,
        candles=[
            KlineBar(time_ms=int(row[0]), open=float(row[1]), high=float(row[2]), low=float(row[3]), close=float(row[4]))
            for row in raw
        ],
    )
