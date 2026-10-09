"""
Live crypto price lookup — shared by manual trading's "Use current
price" quick-fill and live unrealized-PnL on the Trades list.
=====================================================================

Was previously inline in routers/manual_trading.py, calling Binance
directly with no proxy — the exact same bug order_flow.py had (fixed
earlier): Binance geofences plenty of cloud-host IP ranges, Render's
included, with a 451, so this could work from a developer's own
machine but silently fail in production, falling through to
CoinGecko (which only covers 4 symbols — everything else just failed
outright with no live price). Now routes through the same Fixie proxy
pair every other exchange call in this app already uses.

Deliberately scoped to crypto: no free, credential-less price source
exists here for forex/metals (EURUSD, XAUUSD, ...) — those need the
trader's own connected broker, a per-user credential this app doesn't
require just to look up a live price.
"""

from __future__ import annotations

from typing import Optional

import httpx
import structlog

from app.config import get_settings
from app.services.broker_integrations import (
    BingXBroker, BinanceBroker, BybitBroker, MexcBroker,
    _FAILOVER_EXCEPTIONS, _send_with_failover,
)
from app.services.proxy_health import record_proxy_failure, record_proxy_success

logger = structlog.get_logger()

COINGECKO_IDS = {"BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "BNBUSDT": "binancecoin", "SOLUSDT": "solana"}

# Permanent fallback for a symbol Binance's spot market and CoinGecko's
# own narrow 4-symbol allowlist above don't cover at all — JPYUSDT.P,
# NAS100USDT.P, OILBRENTUSDT.P, and any future symbol in the same boat
# (a synthetic/index/commodity-style pair only listed on the trade's
# own exchange, not on Binance spot). Found live: a JPYUSDT.P paper
# trade sat ACTIVE for 17+ hours because get_crypto_price() below
# always returned None for it (confirmed via production logs —
# live_price_binance_non_200 status=400 symbol=JPYUSDT, nonstop —
# Binance simply has no JPYUSDT spot pair), and both position_monitor.py
# and pending_order_monitor.py silently skip a trade forever once price
# comes back None. Covers every crypto broker this app actually places
# paper/live orders through; TradeLocker/MetaApi/Oanda (MT5/forex
# brokers) aren't included here since paper-trade symbols on those
# routes are genuinely out of scope (see this module's own "Deliberately
# scoped to crypto" note above) and don't share this bug.
_BROKER_TICKER_CLASSES = {
    "bingx": BingXBroker, "mexc": MexcBroker, "binance": BinanceBroker, "bybit": BybitBroker,
}


async def get_broker_ticker_price(broker_name: Optional[str], symbol: str) -> Optional[float]:
    """THE primary price source for paper-trade monitoring — asks the
    trade's OWN exchange directly, the actual perpetual-futures venue
    every trade here runs on (x50 leverage), not a generic reference
    price. Originally added only as a fallback for a symbol Binance
    doesn't list at all (JPYUSDT.P, NAS100USDT.P, OILBRENTUSDT.P); now
    also the PREFERRED source even for a symbol get_crypto_price CAN
    resolve, by direct correction — Binance's own futures price can
    still diverge from the trade's real exchange (different venue,
    different funding/basis; ~0.06% observed live on BTC/XAUT, real
    money at 50x leverage). Reuses each Broker class's already-public,
    unsigned get_ticker_price() — api_key="" works, confirmed safe:
    it's the exact same call execution_engine.py's own
    _check_price_deviation already trusts with no real credentials, on
    every one of these four broker classes. Never raises; returns None
    exactly like get_crypto_price, so callers keep their existing
    skip-and-retry behavior for a genuinely unresolvable (broker_name,
    symbol) — e.g. a non-crypto broker (TradeLocker/MetaApi/Oanda) not
    in the map above, where get_crypto_price's Binance-futures/
    CoinGecko read remains the only fallback available."""
    broker_cls = _BROKER_TICKER_CLASSES.get((broker_name or "").lower())
    if not broker_cls:
        return None

    clean = symbol.upper().replace("BINANCE:", "").replace("/", "").replace("-", "")
    if clean.endswith(".P"):
        clean = clean[:-2]

    # BingX's get_ticker_price only replaces "/" with "-" — a plain
    # concatenated symbol like "OILBRENTUSDT" passes straight through
    # and BingX rejects it ("must ... end with -USDT or -USDC"),
    # confirmed live. MEXC/Binance/Bybit all expect the concatenated
    # form instead (MEXC's own _mexc_symbol splits it itself; Binance/
    # Bybit's get_ticker_price explicitly strips any dash) — so only
    # BingX needs the dash inserted here.
    query_symbol = clean
    if broker_cls is BingXBroker:
        for quote in ("USDT", "USDC", "USD"):
            if clean.endswith(quote) and clean != quote:
                query_symbol = f"{clean[:-len(quote)]}-{quote}"
                break

    client = broker_cls(api_key="", api_secret="")
    try:
        ticker = await client.get_ticker_price(query_symbol)
        if ticker.get("success") and ticker.get("price"):
            return float(ticker["price"])
        logger.warning("live_price_broker_ticker_miss", broker=broker_name, symbol=clean, error=ticker.get("error"))
    except Exception as e:
        logger.warning("live_price_broker_ticker_failed", broker=broker_name, symbol=clean, error=str(e))
    finally:
        await client.client.aclose()
        if client.backup_client is not None:
            await client.backup_client.aclose()
    return None

_settings = get_settings()
# USDⓈ-M FUTURES ticker (fapi), not spot — by direct correction ("all
# pairs are Futures - .P ... that includes EUR/XAUT ... they are not
# spot ... Only futures have the x50 leverage"). Was spot
# (api.binance.com/api/v3) until a live side-by-side check showed a
# real, non-trivial divergence from the trade's own futures venue
# (~0.06% on BTC/XAUT at the moment checked — meaningful at 50x
# leverage) — every trade this app places runs on a perpetual-futures
# contract, so the reference price used to decide SL/TP-hit here needs
# to track that same market, not Binance's separate spot order book.
_binance_client = httpx.AsyncClient(
    timeout=5.0, base_url="https://fapi.binance.com/fapi/v1", proxy=_settings.BINANCE_PROXY_URL or None,
)
_binance_backup_client = (
    httpx.AsyncClient(timeout=5.0, base_url="https://fapi.binance.com/fapi/v1", proxy=_settings.BINANCE_BACKUP_PROXY_URL)
    if _settings.BINANCE_BACKUP_PROXY_URL else None
)
# Third tier, no proxy — by direct request ("what happens when Fixie
# reaches its ... limit ... fix this permanently"). Same reasoning as
# order_flow.py's own _direct_client: this is an unsigned public price
# lookup, no API key/IP-whitelist involved, so a direct attempt is a
# genuinely useful last resort before falling all the way to
# CoinGecko's much narrower 4-symbol coverage below.
_binance_direct_client = httpx.AsyncClient(timeout=5.0, base_url="https://fapi.binance.com/fapi/v1")


async def get_crypto_price(symbol: str) -> Optional[float]:
    """Real data, not invented — tries Binance's public FUTURES ticker
    first (via the proxy pair), CoinGecko second. Returns None (never
    raises) if neither has this symbol, so a caller enriching a list
    of trades can skip one bad symbol without failing the whole list.

    Used as a broker-agnostic fallback/display price (manual trading's
    "use current price", the trades list, ...) where there's no single
    trade's own exchange to ask yet. For paper-trade price MONITORING
    (position_monitor.py, pending_order_monitor.py), prefer
    get_broker_ticker_price(trade.broker_name, symbol) instead — it
    queries the trade's own actual execution venue directly, which is
    strictly more accurate than this generic Binance-futures reference
    whenever the two diverge (different exchange, different funding/
    basis).

    CRITICAL FIX, root-caused from a direct bug report ("price reached
    my trigger point entry 81367.39933, but the trade was not
    executed"): a ".P" suffix (this app's own perpetual-futures
    convention — see order_flow.py's `_resolve_market`, e.g.
    "BTCUSDT.P") was never stripped here, so every caller of this
    function — pending_order_monitor.py (fills a paper LIMIT/STOP the
    moment live price crosses its trigger), position_monitor.py
    (SL/TP-hit detection on ACTIVE trades), manual_trading.py
    (unrealized P&L, "Use current price"), trades.py (live price on
    the trades list), webhook_processor.py (webhook-triggered exit
    price) — silently got back None for any ".P" symbol: Binance's
    SPOT ticker endpoint doesn't recognize "BTCUSDT.P" as a symbol at
    all (its real spot symbols never carry that suffix), so the request
    failed, CoinGecko's lookup also missed (COINGECKO_IDS is keyed by
    the bare spot ticker), and every caller's own "price is None, skip
    this one" fallback made a `.P` order behave as if price could never
    be checked — a pending order on a perpetual-futures symbol could
    sit at "Pending" forever, and SL/TP would never fire on an ACTIVE
    one either, regardless of how far real price actually moved.
    Stripping it here, once, fixes every caller at the source: spot and
    perpetual-futures prices for the same underlying pair track each
    other closely enough that the existing spot ticker is a perfectly
    good reference price for this app's own paper-trading simulation
    (this app never places a real futures order; `.P` only distinguishes
    which chart/UI symbol string the user is looking at)."""
    clean = symbol.upper().replace("BINANCE:", "").replace("/", "")
    if clean.endswith(".P"):
        clean = clean[:-2]

    try:
        resp = await _send_with_failover(_binance_client, _binance_backup_client, "get", "/ticker/price", params={"symbol": clean})
        if resp.status_code == 200:
            record_proxy_success()
            return float(resp.json()["price"])
        logger.warning("live_price_binance_non_200", symbol=clean, status=resp.status_code)
    except _FAILOVER_EXCEPTIONS as e:
        # Both the primary proxy and the Fixie backup failed at the
        # transport level — one last direct attempt (see
        # _binance_direct_client's own comment) before falling through
        # to CoinGecko below.
        try:
            resp = await _binance_direct_client.get("/ticker/price", params={"symbol": clean})
            if resp.status_code == 200:
                record_proxy_success()
                logger.warning("live_price_direct_fallback", symbol=clean, proxy_error=str(e))
                return float(resp.json()["price"])
        except httpx.HTTPError:
            pass
        record_proxy_failure("live_price", str(e))
        logger.warning("live_price_binance_failed", symbol=clean, error=str(e))
    except httpx.HTTPError as e:
        record_proxy_failure("live_price", str(e))
        logger.warning("live_price_binance_failed", symbol=clean, error=str(e))

    coingecko_id = COINGECKO_IDS.get(clean)
    if coingecko_id:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": coingecko_id, "vs_currencies": "usd"},
                )
            if resp.status_code == 200:
                price = resp.json().get(coingecko_id, {}).get("usd")
                if price is not None:
                    return float(price)
        except httpx.HTTPError as e:
            logger.warning("live_price_coingecko_failed", symbol=clean, error=str(e))

    return None
