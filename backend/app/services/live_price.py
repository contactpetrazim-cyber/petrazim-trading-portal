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
from app.core.symbols import strip_futures_suffix
from app.services.broker_integrations import _FAILOVER_EXCEPTIONS, _send_with_failover
from app.services.proxy_health import record_proxy_failure, record_proxy_success

logger = structlog.get_logger()

COINGECKO_IDS = {"BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "BNBUSDT": "binancecoin", "SOLUSDT": "solana"}

_settings = get_settings()
_binance_client = httpx.AsyncClient(
    timeout=5.0, base_url="https://api.binance.com/api/v3", proxy=_settings.BINANCE_PROXY_URL or None,
)
_binance_backup_client = (
    httpx.AsyncClient(timeout=5.0, base_url="https://api.binance.com/api/v3", proxy=_settings.BINANCE_BACKUP_PROXY_URL)
    if _settings.BINANCE_BACKUP_PROXY_URL else None
)


async def get_crypto_price(symbol: str) -> Optional[float]:
    """Real data, not invented — tries Binance's public ticker first
    (via the proxy pair), CoinGecko second. Returns None (never
    raises) if neither has this symbol, so a caller enriching a list
    of trades can skip one bad symbol without failing the whole list.

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
    clean, _ = strip_futures_suffix(clean)

    try:
        resp = await _send_with_failover(_binance_client, _binance_backup_client, "get", "/ticker/price", params={"symbol": clean})
        if resp.status_code == 200:
            record_proxy_success()
            return float(resp.json()["price"])
        logger.warning("live_price_binance_non_200", symbol=clean, status=resp.status_code)
    except _FAILOVER_EXCEPTIONS as e:
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
