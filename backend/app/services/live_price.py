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
from app.services.broker_integrations import _FAILOVER_EXCEPTIONS, _send_with_failover

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
    of trades can skip one bad symbol without failing the whole list."""
    clean = symbol.upper().replace("BINANCE:", "").replace("/", "")

    try:
        resp = await _send_with_failover(_binance_client, _binance_backup_client, "get", "/ticker/price", params={"symbol": clean})
        if resp.status_code == 200:
            return float(resp.json()["price"])
        logger.warning("live_price_binance_non_200", symbol=clean, status=resp.status_code)
    except _FAILOVER_EXCEPTIONS as e:
        logger.warning("live_price_binance_failed", symbol=clean, error=str(e))
    except httpx.HTTPError as e:
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
