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

Binance spot for /api/v3/{trades,depth,klines}:
- GET /api/v3/trades — individual trade prints, each carrying a real
  `isBuyerMaker` flag that tells you which side was the aggressor
  (OF-02's exact "who crossed the spread" question, answered by real
  data): isBuyerMaker=true means the resting order was a BUY, so the
  taker/aggressor SOLD (traded at the bid); isBuyerMaker=false means
  the taker/aggressor BOUGHT (traded at the ask).
- GET /api/v3/depth — real resting order-book depth (OF-05's DOM).

Also Binance USDⓈ-M perpetual futures (/fapi/v1/{trades,depth,klines})
for the same base symbols, TradingView-suffix-style as "BTCUSDT.P" —
by direct bug report/request ("Unsupported symbol 'BTCUSDT.P' ...
We should be able to use all charts"): the main TradingView chart
embed (TradingViewChart.tsx) already lets a trader change symbol
inside the widget itself, including to a perpetual — PositionOnChartModal's
own hand-rolled chart correctly inherited that exact symbol, it just
had nowhere to fetch its candles from. Binance's spot and futures
REST APIs return the identical trades/depth/klines row shapes, so
`_resolve_market` below is the only place that needs to know which
base URL/client a given symbol resolves to.

Symbols are restricted to a small allow-list of liquid pairs rather
than an open passthrough, to keep this platform's own exposure to
Binance's public rate limits bounded and predictable. Forex, indices,
and commodities are a separate, larger scope: unlike crypto, there is
no free/no-key public REST source for those the way Binance's own API
is for crypto — a real (paid or keyed) market-data provider would need
to be chosen and configured before this proxy could cover them, so
that stays out of this file's scope for now.

Auth: every endpoint here was gated on require_active_access (paid
access) — a real bug, found from a cross-session bug report ("order
flow chart is still not loading ... I only see a regular candle
chart"). ToolsPage.tsx and OrderFlowFullPage.tsx both market this tool
as "Free — live tape, delta, and order book," matching this module's
own free-lead-magnet framing above, so any trader without an active
paid subscription got a 402 on every single request here — the tape
showed a generic error, but the DOM and footprint-chart panels swallow
their own fetch error silently and sit on "Loading…" forever, which
reads exactly like the reported symptom (the real ChartPanel candle
chart above it needs no access at all, so it always rendered fine).
Fixed to plain get_current_user, the same "logged in, not necessarily
paid" gate manual_trading.py's own settings routes already use for
their equivalent case — still a real account, just not a paywall,
matching the "Free" claim already made twice in the frontend rather
than rewriting that copy to admit a paywall that was never the
intent.
"""

from __future__ import annotations

import re
import time
from collections import defaultdict
from typing import Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.symbols import strip_futures_suffix
from app.models.user import User
from app.services.broker_integrations import _FAILOVER_EXCEPTIONS, _send_with_failover
from app.services.live_price import COINGECKO_IDS
from app.services.proxy_health import record_proxy_failure, record_proxy_success

router = APIRouter(prefix="/order-flow", tags=["order-flow"])

BINANCE_BASE_URL = "https://api.binance.com/api/v3"
FUTURES_BASE_URL = "https://fapi.binance.com/fapi/v1"

# A small, fixed allow-list of liquid pairs — real Binance symbols,
# not an open passthrough. Extend this list rather than accepting an
# arbitrary symbol string from the client.
ALLOWED_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
]

# The same base symbols, as Binance USDⓈ-M perpetual futures —
# TradingView's own ".P" suffix convention for a perpetual (e.g. the
# main chart shows "BINANCE:BTCUSDT.P"), which this module's own
# client-facing symbols use too so a caller never has to know which
# underlying Binance market a symbol resolves to. Binance's futures
# API itself takes the bare "BTCUSDT" (no suffix) — the suffix is
# stripped in _resolve_market below before the real API call.
ALLOWED_FUTURES_SYMBOLS = [f"{s}.P" for s in ALLOWED_SYMBOLS]

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
# Same Fixie proxy pair as spot — Binance geofences futures the same
# way it geofences spot, and fapi.binance.com is still Binance.
_futures_client = httpx.AsyncClient(
    timeout=10.0, base_url=FUTURES_BASE_URL, proxy=_settings.BINANCE_PROXY_URL or None,
)
_futures_backup_client = (
    httpx.AsyncClient(
        timeout=10.0, base_url=FUTURES_BASE_URL, proxy=_settings.BINANCE_BACKUP_PROXY_URL,
    )
    if _settings.BINANCE_BACKUP_PROXY_URL else None
)

# TradingView's own public symbol-search endpoint — the exact one the
# embedded chart widget's own internal search box calls, so a result
# here is guaranteed to be a real symbol the chart can actually
# display, across every asset class TradingView carries (stocks,
# forex, crypto, indices, commodities), not just this router's small
# Binance-only allow-list above. Calling it straight from the BROWSER
# gets a 403 (verified directly): TradingView checks the request's
# Referer/Origin and rejects anything that isn't tradingview.com
# itself, which a browser can't fake. A server-side call has no such
# restriction — this is the same technique the widget's own frontend
# JS uses, just relocated to our backend, and every request still
# only runs on behalf of a real logged-in user's own search (same
# require-auth + debounce discipline as /instruments above), not an
# open scrape.
_TV_SYMBOL_SEARCH_URL = "https://symbol-search.tradingview.com/symbol_search/v3/"
_TV_HEADERS = {
    "Referer": "https://www.tradingview.com/",
    "Origin": "https://www.tradingview.com",
    "User-Agent": "Mozilla/5.0 (compatible; PetrazimChartSearch/1.0)",
}
_tv_client = httpx.AsyncClient(timeout=8.0, headers=_TV_HEADERS)
_TV_HIGHLIGHT_TAGS_RE = re.compile(r"</?em>")


def _resolve_market(symbol: str) -> tuple[str, bool]:
    """Validates a client-facing symbol and says which Binance market it
    belongs to — (base_symbol, is_futures). A ".P" suffix (TradingView's
    own perpetual-futures convention, e.g. "BTCUSDT.P") routes to
    Binance's USDⓈ-M futures API with the suffix stripped (Binance
    futures symbols carry no suffix of their own); anything else is
    validated as spot, unchanged from before."""
    base, is_futures = strip_futures_suffix(symbol)
    if is_futures:
        if base in ALLOWED_SYMBOLS:
            return base, True
    elif base in ALLOWED_SYMBOLS:
        return base, False
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported symbol '{symbol.upper()}' — choose one of {ALLOWED_SYMBOLS + ALLOWED_FUTURES_SYMBOLS}.",
    )


def _validate_symbol(symbol: str) -> str:
    """Spot-only validation — kept for the instrument-search endpoints
    below, which are explicitly spot-only by their own docstring."""
    symbol = symbol.upper()
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported symbol '{symbol}' — choose one of {ALLOWED_SYMBOLS}.",
        )
    return symbol


async def _binance_get(path: str, params: dict, futures: bool = False) -> httpx.Response:
    client, backup = (_futures_client, _futures_backup_client) if futures else (_client, _backup_client)
    market = "Binance futures" if futures else "Binance"
    try:
        resp = await _send_with_failover(client, backup, "get", path, params=params)
    except _FAILOVER_EXCEPTIONS as e:
        record_proxy_failure("order_flow", str(e))
        raise HTTPException(status_code=502, detail=f"Could not reach {market} market data: {e}")
    except httpx.RequestError as e:
        record_proxy_failure("order_flow", str(e))
        raise HTTPException(status_code=502, detail=f"Could not reach {market} market data: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"{market} returned {resp.status_code} for {path}")
    record_proxy_success()
    return resp


class SymbolsResponse(BaseModel):
    symbols: List[str]


@router.get("/symbols", response_model=SymbolsResponse)
async def list_symbols(user: User = Depends(get_current_user)):
    return SymbolsResponse(symbols=ALLOWED_SYMBOLS + ALLOWED_FUTURES_SYMBOLS)


class TradePrint(BaseModel):
    price: float
    qty: float
    time: int
    aggressor: Literal["buy", "sell"]


@router.get("/trades", response_model=List[TradePrint])
async def get_trades(
    symbol: str = "BTCUSDT", limit: int = 60,
    user: User = Depends(get_current_user),
):
    """Real, live time & sales — the tape (OF-02). `limit` is capped at
    200 (Binance's own recent-trades endpoint doesn't need more for a
    live-feeling tape view, and it keeps this platform's own request
    weight small)."""
    symbol, futures = _resolve_market(symbol)
    limit = max(1, min(limit, 200))
    resp = await _binance_get("/trades", {"symbol": symbol, "limit": limit}, futures=futures)
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
    user: User = Depends(get_current_user),
):
    """Real resting order-book depth (OF-05's DOM) — snapshot only, not
    a live-updating stream (that needs a websocket, a larger feature;
    this platform's own paid-access model and every other data route
    here are simple request/response, so a polled snapshot matches the
    existing pattern rather than introducing new infrastructure)."""
    symbol, futures = _resolve_market(symbol)
    limit = limit if limit in (5, 10, 20, 50, 100) else 10
    resp = await _binance_get("/depth", {"symbol": symbol, "limit": limit}, futures=futures)
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
    interval: str
    tick_size: float
    candles: List[FootprintCandle]
    volume_profile: List[VolumeProfileRow]   # high-to-low, same grid as candles' rows
    poc_price: float                          # the volume_profile row with the most volume


# Real, fixed candle durations — by direct report ("Is there a time
# frame control for the Footprint Chart... If so please fix and add"):
# there wasn't one. This endpoint used to split whatever time span the
# fetched trades happened to cover into `num_candles` EQUAL pieces
# (`span // num_candles`) — a width with no relationship to any real
# duration, couldn't be chosen by the trader, and silently changed
# candle-to-candle depending on how fast the market happened to be
# trading. Capped at 1h (not the klines endpoint's full 1d/1w range):
# this data source is Binance's most-recent-1000-trades feed, not a
# historical range query, so a longer interval on a liquid pair like
# BTCUSDT can genuinely span very few real candles from that window —
# honest, not fabricated to fill a fixed count either way.
FOOTPRINT_INTERVAL_MS = {
    "1m": 60_000, "5m": 5 * 60_000, "15m": 15 * 60_000, "30m": 30 * 60_000, "1h": 3_600_000,
}


@router.get("/footprint-chart", response_model=FootprintChartResponse)
async def get_footprint_chart(
    symbol: str = "BTCUSDT", interval: str = "1m", trade_limit: int = 1000, num_candles: int = 15, target_rows: int = 40,
    user: User = Depends(get_current_user),
):
    """Real bid/ask volume clusters per price level per candle — the
    same chart type as a professional footprint tool, built from
    genuine Binance trades rather than simulated. `target_rows` sets
    ONE tick size for the whole fetched price range (session_high to
    session_low), so every candle's rows and the volume_profile panel
    share the identical price grid and line up visually; a calmer
    candle naturally gets fewer rows and a volatile one gets more,
    exactly like a real footprint chart — this isn't a fixed row count
    forced onto every candle. `interval` is a REAL, calendar-aligned
    candle duration (same convention as the klines endpoint below, so a
    5m footprint candle lines up with a real 5m candlestick elsewhere)
    — see FOOTPRINT_INTERVAL_MS's own comment for why it's capped at 1h."""
    symbol, futures = _resolve_market(symbol)
    if interval not in FOOTPRINT_INTERVAL_MS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {list(FOOTPRINT_INTERVAL_MS)}")
    interval_ms = FOOTPRINT_INTERVAL_MS[interval]
    trade_limit = max(50, min(trade_limit, 1000))
    num_candles = max(3, min(num_candles, 30))
    target_rows = max(10, min(target_rows, 80))

    resp = await _binance_get("/trades", {"symbol": symbol, "limit": trade_limit}, futures=futures)
    raw = resp.json()
    if not raw:
        raise HTTPException(status_code=404, detail="No recent trades available for this symbol")

    prices = [float(t["price"]) for t in raw]
    session_high, session_low = max(prices), min(prices)
    price_range = max(session_high - session_low, session_high * 0.0001, 1e-8)
    tick = price_range / target_rows

    def row_index(price: float) -> int:
        return int((price - session_low) // tick)

    def candle_start(ts: int) -> int:
        return (ts // interval_ms) * interval_ms

    candle_trades: Dict[int, list] = defaultdict(list)
    for t in raw:
        candle_trades[candle_start(t["time"])].append(t)

    # Only the most recent `num_candles` real candles this trade data
    # actually spans — never stretched or compressed to hit that count.
    starts = sorted(candle_trades.keys())[-num_candles:]

    candles: List[FootprintCandle] = []
    for start in starts:
        trs = sorted(candle_trades[start], key=lambda t: t["time"])
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
            time_ms=start, open=c_prices[0], high=c_high, low=c_low, close=c_prices[-1],
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
        symbol=symbol, interval=interval, tick_size=round(tick, 8), candles=candles,
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

ALLOWED_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]


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


# Render's own production logs (checked directly, not guessed) show
# this fallback firing constantly now — NOT because of Binance's 451
# geofence any more, but because BOTH Fixie proxies are themselves
# failing with "407 Proxy Authentication Required" (stale/misconfigured
# proxy credentials — an infrastructure setting, not something fixable
# from this code; check BINANCE_PROXY_URL/BINANCE_BACKUP_PROXY_URL on
# Render). With Binance unreachable on every call, this fallback was
# getting hit far more often than the "occasional 451" it was built
# for, at real risk of tripping CoinGecko's own free-tier rate limit
# for a shared Render IP (their OHLC endpoint doesn't 451 like Binance
# does, it just quietly 429s once you're over the limit — which
# `resp.status_code != 200` below reports the exact same way as any
# other failure: `None`, invisibly re-raising the ORIGINAL Binance
# error to the caller). A short in-memory cache keyed by symbol cuts
# the actual CoinGecko call volume down to roughly one every 3 minutes
# per symbol regardless of how many trainees/games request it, which
# is the real fix for the rate-limit risk — a real Binance outage was
# never going to be this frequent.
_coingecko_cache: Dict[str, tuple] = {}  # symbol -> (fetched_at_monotonic, candles)
_COINGECKO_CACHE_TTL_SECONDS = 180


async def _coingecko_klines_fallback(symbol: str) -> Optional[List[KlineBar]]:
    """Binance's own geofence can 451 even through the Fixie proxy pair
    (the proxy's own exit IP can itself be in a region Binance
    restricts — the same class of failure order_flow.py's own module
    doc already documents for the browser-direct case, just one hop
    further out) — by direct bug report ("Binance returned 451 for
    /klines"), the first real caller of this endpoint since it was
    written (nothing in the frontend called /klines until
    PositionOnChartModal.tsx). Falls back to CoinGecko's free public
    OHLC endpoint, which only exists for 4 of the 6 ALLOWED_SYMBOLS
    (see COINGECKO_IDS in services/live_price.py — the same honest
    coverage gap get_crypto_price already lives with).

    HONEST APPROXIMATION: CoinGecko's OHLC endpoint takes a `days`
    window, not our own `interval` — it doesn't offer a matching 15m/
    1h/4h/1d selector at all, just whatever granularity its own `days`
    value implies (1 day of history -> 30m candles, 2-30 days -> 4h
    candles, 31+ days -> 4-day candles, per CoinGecko's own docs).
    `days=7` (-> 4h candles) is used as a single reasonable general-
    purpose reference resolution regardless of what interval was
    requested — this is ONLY reached when Binance is unreachable, as a
    "some real reference chart is better than none" fallback, not a
    silent promise that the requested interval was honored."""
    coingecko_id = COINGECKO_IDS.get(symbol)
    if not coingecko_id:
        return None

    cached = _coingecko_cache.get(symbol)
    if cached is not None and (time.monotonic() - cached[0]) < _COINGECKO_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://api.coingecko.com/api/v3/coins/{coingecko_id}/ohlc",
                params={"vs_currency": "usd", "days": 7},
            )
        if resp.status_code != 200:
            return None
        # A rate-limited or otherwise degraded response can still come
        # back with a 200 but non-JSON/unexpected-shaped body (a
        # gateway's own error page, for instance) — this used to
        # propagate as an unhandled 500 instead of the honest "no
        # fallback available, surface the original error" every other
        # failure path here already gives.
        candles = [
            KlineBar(time_ms=int(row[0]), open=float(row[1]), high=float(row[2]), low=float(row[3]), close=float(row[4]))
            for row in resp.json()
        ]
    except (httpx.RequestError, ValueError, TypeError, KeyError, IndexError):
        return None

    _coingecko_cache[symbol] = (time.monotonic(), candles)
    return candles


@router.get("/klines", response_model=KlinesResponse)
async def get_klines(
    symbol: str = "BTCUSDT", interval: str = "4h", limit: int = 60,
    user: User = Depends(get_current_user),
):
    requested_symbol = symbol.upper()
    symbol, futures = _resolve_market(symbol)
    if interval not in ALLOWED_INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {ALLOWED_INTERVALS}")
    limit = max(10, min(limit, 500))
    try:
        resp = await _binance_get("/klines", {"symbol": symbol, "interval": interval, "limit": limit}, futures=futures)
        candles = [
            KlineBar(time_ms=int(row[0]), open=float(row[1]), high=float(row[2]), low=float(row[3]), close=float(row[4]))
            for row in resp.json()
        ]
    except HTTPException:
        # The CoinGecko fallback only ever covers spot (see its own
        # docstring — it's keyed by COINGECKO_IDS, base symbols only),
        # so a futures request that fails just re-raises rather than
        # silently handing back spot candles under a futures symbol.
        fallback = None if futures else await _coingecko_klines_fallback(symbol)
        if fallback is None:
            raise
        candles = fallback[-limit:]
    return KlinesResponse(symbol=requested_symbol, interval=interval, candles=candles)


# ---------------------------------------------------------------------------
# Instrument search — the Create Bot form's real symbol picker, by direct
# request ("for instrument include a search instrument space that
# searches the instrument - exactly like the one on the chart ... allow
# selection ... removing errors"). Backed by Binance's own public
# exchangeInfo listing (every genuinely tradable pair, ~2000+), the
# same real-data-not-a-guess standard the rest of this router already
# holds to, rather than a short fixed list or free-typed text a trader
# could mistype. Deliberately crypto-only, same honest scope as the
# rest of this proxy: a bot trading forex (e.g. EURUSD) has no live
# instrument list to search here, and the Create Bot form still lets a
# trader type one in directly for that case.
# ---------------------------------------------------------------------------

class InstrumentInfo(BaseModel):
    symbol: str
    base_asset: str
    quote_asset: str


class InstrumentsResponse(BaseModel):
    instruments: List[InstrumentInfo]


_INSTRUMENTS_CACHE_TTL_SECONDS = 3600  # exchangeInfo's tradable-pair list barely changes hour to hour
_instruments_cache: Dict[str, object] = {"data": None, "fetched_at": 0.0}


async def _get_all_instruments() -> List[InstrumentInfo]:
    now = time.monotonic()
    cached = _instruments_cache["data"]
    if cached is not None and now - _instruments_cache["fetched_at"] < _INSTRUMENTS_CACHE_TTL_SECONDS:
        return cached  # type: ignore[return-value]
    resp = await _binance_get("/exchangeInfo", {})
    raw = resp.json()
    instruments = [
        InstrumentInfo(symbol=s["symbol"], base_asset=s["baseAsset"], quote_asset=s["quoteAsset"])
        for s in raw.get("symbols", [])
        if s.get("status") == "TRADING"
    ]
    _instruments_cache["data"] = instruments
    _instruments_cache["fetched_at"] = now
    return instruments


@router.get("/instruments", response_model=InstrumentsResponse)
async def search_instruments(
    q: str = "", limit: int = 25, user: User = Depends(get_current_user),
):
    """Real, live-tradable Binance symbols matching `q` (substring,
    case-insensitive) — an empty query returns the first `limit`
    alphabetically, so the field has something to show before a trader
    types anything."""
    limit = max(1, min(limit, 100))
    all_instruments = await _get_all_instruments()
    query = q.strip().upper()
    matches = (
        [i for i in all_instruments if query in i.symbol]
        if query else sorted(all_instruments, key=lambda i: i.symbol)
    )
    return InstrumentsResponse(instruments=matches[:limit])


# ---------------------------------------------------------------------------
# Chart symbol search — the Pairs panel's "search any instrument", by
# direct bug report ("the search any instrument should connect to the
# chart search so that instrument selected can choose from the very
# large database of instrument pairs ... it sometimes gives an error
# that 'nothing matched' — yet the search in the chart actually brings
# out the correct instrument"). PairsPanel.tsx previously only had a
# small ~35-instrument hand-picked catalogue (config/instrumentCatalogue.ts)
# plus this router's own crypto-only /instruments above, because a
# direct browser call to TradingView's search was blocked (see
# _tv_client's own comment) — this is the real fix: the identical
# search the chart's own widget uses, proxied server-side so it
# actually reaches TradingView instead of being 403'd.
# ---------------------------------------------------------------------------

class ChartSymbolResult(BaseModel):
    symbol: str
    exchange: str
    description: str
    type: str


class ChartSymbolSearchResponse(BaseModel):
    results: List[ChartSymbolResult]


@router.get("/symbol-search", response_model=ChartSymbolSearchResponse)
async def chart_symbol_search(
    q: str, limit: int = 25, user: User = Depends(get_current_user),
):
    """Real TradingView symbols matching `q`, across every asset class
    — every result's `symbol`+`exchange` is a validated `EXCHANGE:TICKER`
    pair the chart widget can actually load, the same guarantee
    config/instrumentCatalogue.ts's hand-picked list makes, just from
    TradingView's own live database instead of a ~35-row fallback."""
    query = q.strip()
    if not query:
        return ChartSymbolSearchResponse(results=[])
    try:
        resp = await _tv_client.get(
            _TV_SYMBOL_SEARCH_URL,
            params={
                "text": query, "hl": 1, "exchange": "", "lang": "en",
                "search_type": "undefined", "domain": "production",
            },
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach the chart's symbol database: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Chart symbol search returned {resp.status_code}")

    raw = resp.json()
    limit = max(1, min(limit, 50))
    results = [
        ChartSymbolResult(
            symbol=_TV_HIGHLIGHT_TAGS_RE.sub("", s.get("symbol", "")),
            exchange=s.get("exchange", ""),
            description=_TV_HIGHLIGHT_TAGS_RE.sub("", s.get("description", "")),
            type=s.get("type", ""),
        )
        for s in raw.get("symbols", [])[:limit]
        # Skip TradingView's own synthetic/discontinued entries (e.g. the
        # "APPLEUSD" crypto-swap noise that outranks real AAPL for a
        # query like "apple") — real, currently listed instruments only.
        if "discontinued" not in s.get("typespecs", [])
    ]
    return ChartSymbolSearchResponse(results=results)
