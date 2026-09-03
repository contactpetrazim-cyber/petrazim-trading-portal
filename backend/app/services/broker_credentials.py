"""
Per-bot broker credential storage + lookup.

Encrypts/decrypts BotBrokerCredential rows (Fernet, symmetric — this is
"encrypted at rest in our own database", not a secrets-manager-grade
HSM setup, but a real improvement over the alternative of plaintext API
keys sitting in Postgres rows) and builds the actual broker client
instance a bot should trade through, given its bot_id + exchange.

Falls back to the single global-key broker (from ExecutionEngine's own
Settings-based clients) when a bot has no credential row of its own —
so this is additive: bots that don't need sub-account isolation keep
working exactly as before.
"""

from __future__ import annotations

from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.broker_credential import BotBrokerCredential
from app.services.broker_integrations import (
    BingXBroker, BinanceBroker, BybitBroker, MexcBroker, TradeLockerBroker,
)

settings = get_settings()

_BROKER_CLASSES = {
    "bingx": BingXBroker,
    "binance": BinanceBroker,
    "bybit": BybitBroker,
    "mexc": MexcBroker,
    "tradelocker": TradeLockerBroker,
}

# Same Fixie static-IP proxies (primary + backup) per exchange as the
# global-key brokers in execution_engine.py — the exchange's IP
# whitelist is per-account-key, not per our internal bot/credential
# split, so every credential for a given exchange goes out through
# that exchange's same whitelisted IPs.
_PROXY_SETTINGS = {
    "bingx": ("BINGX_PROXY_URL", "BINGX_BACKUP_PROXY_URL"),
    "binance": ("BINANCE_PROXY_URL", "BINANCE_BACKUP_PROXY_URL"),
    "bybit": ("BYBIT_PROXY_URL", "BYBIT_BACKUP_PROXY_URL"),
    "mexc": ("MEXC_PROXY_URL", "MEXC_BACKUP_PROXY_URL"),
}


def _get_fernet() -> Fernet:
    if not settings.CREDENTIALS_ENCRYPTION_KEY:
        raise RuntimeError(
            "CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with "
            "`python3 -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` and set it as an "
            "env var before storing any broker credential — without it "
            "there is no way to decrypt what gets stored, by design."
        )
    return Fernet(settings.CREDENTIALS_ENCRYPTION_KEY.encode())


def encrypt_secret(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise RuntimeError(
            "Could not decrypt a stored credential — CREDENTIALS_ENCRYPTION_KEY "
            "may have changed since it was saved. Re-enter the credential."
        ) from e


async def get_credential(db: AsyncSession, bot_id: str, exchange: str) -> Optional[BotBrokerCredential]:
    result = await db.execute(
        select(BotBrokerCredential).where(
            BotBrokerCredential.bot_id == bot_id,
            BotBrokerCredential.exchange == exchange,
            BotBrokerCredential.is_active == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


async def build_broker_client(db: AsyncSession, bot_id: str, exchange: str):
    """
    Returns a broker client instance scoped to this bot's own
    sub-account credential, or None if no such credential exists (the
    caller should fall back to the shared/global-key client in that
    case — see execution_engine.py's _get_broker_client).
    """
    credential = await get_credential(db, bot_id, exchange)
    if not credential:
        return None

    broker_cls = _BROKER_CLASSES.get(exchange)
    if not broker_cls:
        raise ValueError(f"Unknown exchange: {exchange!r}")

    api_key = decrypt_secret(credential.api_key_encrypted)
    api_secret = decrypt_secret(credential.api_secret_encrypted)

    if exchange == "tradelocker":
        account_id = decrypt_secret(credential.account_id_encrypted) if credential.account_id_encrypted else None
        return broker_cls(api_key, api_secret, account_id)

    proxy_setting, backup_proxy_setting = _PROXY_SETTINGS.get(exchange, (None, None))
    proxy = getattr(settings, proxy_setting, "") if proxy_setting else ""
    backup_proxy = getattr(settings, backup_proxy_setting, "") if backup_proxy_setting else ""
    return broker_cls(api_key, api_secret, proxy=proxy or None, backup_proxy=backup_proxy or None)
