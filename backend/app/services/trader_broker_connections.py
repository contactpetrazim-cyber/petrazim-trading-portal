"""
Trader-owned broker connection storage + lookup + client-building —
the execution-side counterpart to models/trader_broker_connection.py.
Reuses broker_credentials.py's own encrypt_secret/decrypt_secret
(same Fernet key, CREDENTIALS_ENCRYPTION_KEY) rather than a second
encryption implementation — one real implementation of "encrypt a
credential for this app," not two.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.trader_broker_connection import ConnectionMode, ConnectionStatus, TraderBrokerConnection
from app.services.broker_credentials import decrypt_secret, encrypt_secret  # noqa: F401 — re-exported for routers
from app.services.broker_integrations import (
    BingXBroker, BinanceBroker, BybitBroker, MexcBroker, TradeLockerBroker, MetaApiBroker,
)

settings = get_settings()

_BROKER_CLASSES = {
    "bingx": BingXBroker,
    "binance": BinanceBroker,
    "bybit": BybitBroker,
    "mexc": MexcBroker,
    "tradelocker": TradeLockerBroker,
    "metatrader": MetaApiBroker,
}

# Same static-IP proxy convention as broker_credentials.py's per-bot
# credentials — a trader's own key needs to be whitelisted (on THEIR
# exchange account) to the exact same outbound IP(s) this platform
# already trades our own accounts through, since the exchange sees
# every signed request as coming from wherever this backend's traffic
# actually egresses, regardless of whose key it's signed with.
_PROXY_SETTINGS = {
    "bingx": ("BINGX_PROXY_URL", "BINGX_BACKUP_PROXY_URL"),
    "binance": ("BINANCE_PROXY_URL", "BINANCE_BACKUP_PROXY_URL"),
    "bybit": ("BYBIT_PROXY_URL", "BYBIT_BACKUP_PROXY_URL"),
    "mexc": ("MEXC_PROXY_URL", "MEXC_BACKUP_PROXY_URL"),
}

# What a trader actually needs to hand over to connect each exchange,
# and the honest, minimum-privilege instructions for creating that key
# — shown verbatim on the connect form. `ip_setting` names the exact
# environment variable this deployment already uses for that
# exchange's outbound proxy (see config.py) — the real IP(s) to
# whitelist are whatever Fixie (or your own proxy) currently assigns
# there; this app deliberately doesn't hardcode an IP address it can't
# verify is still correct. PLATFORM_OUTBOUND_IPS (config.py) is the one
# place to put the actual current IP(s) once you have them, so every
# exchange's onboarding instructions can show a real value instead of
# "ask your admin."
EXCHANGE_META = {
    "bingx": {
        "label": "BingX", "fields": ["api_key", "api_secret"],
        "instructions": "Create a BingX API key scoped to Futures trading only, with withdrawals DISABLED, and IP-restricted to this platform's outbound IP (see below).",
    },
    "binance": {
        "label": "Binance", "fields": ["api_key", "api_secret"],
        "instructions": "Create a Binance API key scoped to Futures trading only, with withdrawals DISABLED, and IP-restricted to this platform's outbound IP (see below).",
    },
    "bybit": {
        "label": "Bybit", "fields": ["api_key", "api_secret"],
        "instructions": "Create a Bybit API key scoped to Derivatives (Contract) trading only, with withdrawals DISABLED, and IP-restricted to this platform's outbound IP (see below).",
    },
    "mexc": {
        "label": "MEXC", "fields": ["api_key", "api_secret"],
        "instructions": "Create a MEXC API key scoped to Futures trading only, with withdrawals DISABLED, and IP-restricted to this platform's outbound IP (see below).",
    },
    "tradelocker": {
        "label": "TradeLocker", "fields": ["api_key", "api_secret", "account_id"],
        "instructions": "Enter your TradeLocker API key/secret and account ID, from your broker's TradeLocker API access page.",
    },
    "metatrader": {
        "label": "MT4 / MT5 (via MetaApi.cloud)", "fields": ["api_key", "account_id"],
        "instructions": "Create a free MetaApi.cloud account, add your real MT4/5 login there as a trading account, and wait for it to show 'deployed'. api_key here is your MetaApi API token; account_id is the trading account ID MetaApi gives you — your MT4/5 password itself is never entered here.",
    },
}


    # The literal outbound IP(s) to tell a trader to whitelist now come
    # from outbound_ip_detector.py's get_effective_outbound_ips_with_source()
    # — two separate, labeled values (VM primary, Fixie backup), each an
    # admin's manual override when set, else whatever that module's
    # background detector engine auto-discovers. See that module's own
    # docstring for the full "why two, not one" explanation.


async def get_connection(
    db: AsyncSession, user_id, exchange: str, require_mode: Optional[ConnectionMode] = None,
) -> Optional[TraderBrokerConnection]:
    """The one this trader's manual orders (or a subscribed bot's
    copied ones) on `exchange` should route through — active, and
    (when require_mode is given) actually enabled for that use. A
    SUSPENDED or inactive row is never returned, same as a bot with no
    credential row falls through to the next option in the chain."""
    query = select(TraderBrokerConnection).where(
        TraderBrokerConnection.user_id == user_id,
        TraderBrokerConnection.exchange == exchange,
        TraderBrokerConnection.is_active == True,  # noqa: E712
        TraderBrokerConnection.status != ConnectionStatus.SUSPENDED,
    )
    result = await db.execute(query)
    connections = result.scalars().all()
    if require_mode is not None:
        connections = [c for c in connections if c.mode in (require_mode, ConnectionMode.BOTH)]
    return connections[0] if connections else None


def build_client_from_connection(connection: TraderBrokerConnection):
    """Decrypts and constructs the real broker client for this
    connection — mirrors broker_credentials.py's build_broker_client
    shape for a bot's own sub-account credential."""
    broker_cls = _BROKER_CLASSES.get(connection.exchange)
    if not broker_cls:
        raise ValueError(f"Unknown exchange: {connection.exchange!r}")

    api_key = decrypt_secret(connection.api_key_encrypted)

    if connection.exchange == "metatrader":
        account_id = decrypt_secret(connection.account_id_encrypted) if connection.account_id_encrypted else None
        return broker_cls(api_key, account_id, settings.METAAPI_REGION or "new-york")

    api_secret = decrypt_secret(connection.api_secret_encrypted) if connection.api_secret_encrypted else ""
    if connection.exchange == "tradelocker":
        account_id = decrypt_secret(connection.account_id_encrypted) if connection.account_id_encrypted else None
        return broker_cls(api_key, api_secret, account_id)

    proxy_setting, backup_proxy_setting = _PROXY_SETTINGS.get(connection.exchange, (None, None))
    proxy = getattr(settings, proxy_setting, "") if proxy_setting else ""
    backup_proxy = getattr(settings, backup_proxy_setting, "") if backup_proxy_setting else ""
    return broker_cls(api_key, api_secret, proxy=proxy or None, backup_proxy=backup_proxy or None)


async def test_connection(connection: TraderBrokerConnection) -> dict:
    """
    Genuinely authenticates against the real exchange — a real signed
    balance (or, where a broker has no simple balance call available
    the same way, a ticker) call, not just "the fields are non-empty."
    Never places or touches any order. Callers should persist the
    result onto connection.status/last_verified_at/last_error
    themselves (this function is a pure check, no DB write) — see
    routers/trader_broker_connections.py's own POST .../test.
    """
    try:
        client = build_client_from_connection(connection)
    except Exception as e:
        return {"success": False, "error": str(e)}

    try:
        if hasattr(client, "get_balance"):
            result = await client.get_balance()
        elif hasattr(client, "get_ticker_price"):
            result = await client.get_ticker_price("BTCUSDT")
        else:
            return {"success": False, "error": "This broker integration has no way to verify credentials."}
    except Exception as e:
        return {"success": False, "error": str(e)}

    if not result.get("success"):
        return {"success": False, "error": result.get("error") or "Could not authenticate with these credentials."}
    return {"success": True}
