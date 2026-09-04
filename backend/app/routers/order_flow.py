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

from app.core.access_gate import require_active_access
from app.models.user import User

router = APIRouter(prefix="/order-flow", tags=["order-flow"])

BINANCE_BASE_URL = "https://api.binance.com/api/v3"

# A small, fixed allow-list of liquid pairs — real Binance symbols,
# not an open passthrough. Extend this list rather than accepting an
# arbitrary symbol string from the client.
ALLOWED_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
]

_client = httpx.AsyncClient(timeout=10.0, base_url=BINANCE_BASE_URL)


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
        resp = await _client.get(path, params=params)
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


class FootprintBucket(BaseModel):
    bucket_start_ms: int
    buy_volume: float
    sell_volume: float
    delta: float
    high: float
    low: float
    trade_count: int


@router.get("/footprint", response_model=List[FootprintBucket])
async def get_footprint(
    symbol: str = "BTCUSDT", limit: int = 500, buckets: int = 20,
    user: User = Depends(require_active_access),
):
    """Real footprint/delta (OF-04), computed by bucketing genuine
    recent trades into `buckets` equal time windows and summing real
    aggressor-side volume in each — not simulated. `limit` (trades
    fetched) is capped at 1000 (Binance's own max for this endpoint);
    `buckets` at 60."""
    symbol = _validate_symbol(symbol)
    limit = max(buckets, min(limit, 1000))
    buckets = max(1, min(buckets, 60))

    resp = await _binance_get("/trades", {"symbol": symbol, "limit": limit})
    raw = resp.json()
    if not raw:
        return []

    times = [t["time"] for t in raw]
    t_min, t_max = min(times), max(times)
    span = max(1, t_max - t_min)
    bucket_ms = max(1, span // buckets)

    grouped: Dict[int, dict] = defaultdict(lambda: {
        "buy": 0.0, "sell": 0.0, "high": None, "low": None, "count": 0,
    })
    for t in raw:
        idx = min(buckets - 1, (t["time"] - t_min) // bucket_ms)
        bucket_start = t_min + idx * bucket_ms
        g = grouped[bucket_start]
        qty = float(t["qty"])
        price = float(t["price"])
        if t["isBuyerMaker"]:
            g["sell"] += qty
        else:
            g["buy"] += qty
        g["high"] = price if g["high"] is None else max(g["high"], price)
        g["low"] = price if g["low"] is None else min(g["low"], price)
        g["count"] += 1

    return [
        FootprintBucket(
            bucket_start_ms=start, buy_volume=round(g["buy"], 6), sell_volume=round(g["sell"], 6),
            delta=round(g["buy"] - g["sell"], 6), high=g["high"], low=g["low"], trade_count=g["count"],
        )
        for start, g in sorted(grouped.items())
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
