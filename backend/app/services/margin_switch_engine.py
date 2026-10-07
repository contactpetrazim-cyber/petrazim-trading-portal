"""
Margin auto-switch engine.

By direct request ("Create an automatic switch engine that checks
which accounts have margin capital to trade and if the dedicated
accounts do not have money it can switch to the account that has
margin to take the trade — there should be a dedicated Vs Auto margin
account setting for bots and manual and also a master switch in the
Admin portal.").

Before this, execution_engine.py's own broker-resolution chain
(_get_broker_client's "bot credential -> trader connection -> global
key" priority) had zero margin awareness — whatever account that
chain resolved to was used unconditionally, even if it had nowhere
near enough free margin for the order about to be placed. This module
is the one place that decides whether to look PAST that resolved
"dedicated" account at all, and if so, which funded alternative to use
instead. It never invents a new failure mode: if auto-switch is off,
disabled for this bot/connection, or no funded alternative exists, the
original dedicated account is returned completely unchanged — exactly
today's behavior, including whatever the exchange itself does with an
underfunded order.

Resolved tiering (from direct clarifying answers):
  1. Switch pool order: same-exchange alternate sub-account(s) first
     (if more than one active credential/connection exists for that
     exchange — not true for any bot/trader today, but this doesn't
     assume otherwise), then cross-exchange accounts.
  2. A trader's own fallback pool is their OTHER TraderBrokerConnection
     rows only — never a bot's BotBrokerCredential rows, and never
     another trader's connection.
  3. Margin-check timing: a LIVE get_balance() call is the primary
     source of truth; a short-TTL cached balance is only a fallback
     when the live call fails/times out, so one slow/erroring exchange
     API call doesn't block trading outright.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import MarginMode
from app.models.platform_setting import MARGIN_AUTO_SWITCH_ENABLED_KEY, PlatformSetting
from app.services.broker_credentials import build_broker_client, list_credentials_for_bot

logger = structlog.get_logger()

# A short-TTL in-memory cache of the last known LIVE balance per
# account, keyed by whatever string identifies that account (see
# _cache_key below). Deliberately per-process, not persisted — this
# exists only to bridge a single transient live-call failure, not to
# be a real balance store (get_balance() itself remains the source of
# truth on every call that succeeds).
_BALANCE_CACHE: Dict[str, Tuple[float, float]] = {}
_CACHE_TTL_SECONDS = 60.0


async def get_margin_auto_switch_enabled(db: AsyncSession) -> bool:
    """The Admin portal's master switch. Defaults to False (off) when
    never explicitly set — a bot/trader with their own margin_mode
    already set to AUTO_SWITCH still can't trigger a fallback until an
    Admin explicitly turns this on, same fail-safe-not-fail-open shape
    as every other master switch in app/models/platform_setting.py."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MARGIN_AUTO_SWITCH_ENABLED_KEY)
    )).scalar_one_or_none()
    return row.value.lower() == "true" if row else False


def _extract_available_balance(balance_result: Any) -> Optional[float]:
    """Normalizes across the differing get_balance() response shapes
    in broker_integrations.py (available_balance / free_margin /
    margin_available). Returns None — "could not determine" — rather
    than guessing, for a failed call or an unrecognized shape (e.g.
    BingXBroker.get_balance() currently returns the raw, un-normalized
    exchange response with none of these keys)."""
    if not isinstance(balance_result, dict):
        return None
    for key in ("available_balance", "free_margin", "margin_available"):
        if key in balance_result:
            try:
                return float(balance_result[key])
            except (TypeError, ValueError):
                return None
    return None


async def _live_or_cached_balance(cache_key: str, client: Any) -> Optional[float]:
    """Live get_balance() first (the primary source of truth by direct
    request); falls back to this account's last cached balance — only
    if it's still within _CACHE_TTL_SECONDS — when the live call
    raises or the client has no get_balance() at all. Returns None
    when neither is available, which callers treat as "can't tell,
    don't switch" rather than assuming either sufficiency or
    insufficiency."""
    if hasattr(client, "get_balance"):
        try:
            balance = _extract_available_balance(await client.get_balance())
            if balance is not None:
                _BALANCE_CACHE[cache_key] = (time.monotonic(), balance)
                return balance
        except Exception as e:
            logger.warning("margin_switch_live_balance_failed", cache_key=cache_key, error=str(e))
    cached = _BALANCE_CACHE.get(cache_key)
    if cached and (time.monotonic() - cached[0]) <= _CACHE_TTL_SECONDS:
        logger.info("margin_switch_used_cached_balance", cache_key=cache_key)
        return cached[1]
    return None


async def maybe_switch_broker(
    db: AsyncSession,
    tier: str,  # "bot" | "trader" | "global" — see execution_engine.py's _resolve_dedicated
    config_row: Optional[Any],  # BotConfig (tier="bot") or TraderBrokerConnection (tier="trader"); None for "global"
    bot_id: Optional[str],
    user_id: Optional[Any],
    preferred_broker: str,
    dedicated_client: Any,
    required_margin: float,
) -> Tuple[str, Any, bool]:
    """Returns (broker, client, switched) — `broker` may change too
    (not just the client), since a cross-exchange fallback requires
    execution_engine.py to dispatch the order to the matching
    per-exchange method. `switched` is False whenever the dedicated
    account is returned unchanged, for every reason described in this
    module's own docstring."""
    if tier == "global" or config_row is None:
        # No per-account margin_mode exists for the global shared-key
        # fallback — nothing to opt into auto-switch, so this never
        # applies to it.
        return preferred_broker, dedicated_client, False

    if config_row.margin_mode != MarginMode.AUTO_SWITCH:
        return preferred_broker, dedicated_client, False

    if not await get_margin_auto_switch_enabled(db):
        return preferred_broker, dedicated_client, False

    dedicated_balance = await _live_or_cached_balance(f"{tier}:{bot_id or user_id}:{preferred_broker}", dedicated_client)
    if dedicated_balance is None or dedicated_balance >= required_margin:
        # Sufficient, or genuinely unknown (e.g. BingX's unnormalized
        # balance shape) — fail open to the dedicated account exactly
        # as before this feature existed rather than switching on a
        # guess.
        return preferred_broker, dedicated_client, False

    if tier == "bot":
        candidates = [c for c in await list_credentials_for_bot(db, bot_id) if c.exchange != preferred_broker]
        # Same-exchange alternates first, then cross-exchange — see
        # this module's own docstring. No bot has more than one active
        # credential per exchange today, so this sort is a no-op in
        # practice but keeps working correctly if that ever changes.
        candidates.sort(key=lambda c: 0 if c.exchange == preferred_broker else 1)
        for credential in candidates:
            try:
                candidate_client = await build_broker_client(db, bot_id, credential.exchange)
            except Exception as e:
                logger.error("margin_switch_candidate_build_failed", bot_id=bot_id, exchange=credential.exchange, error=str(e))
                continue
            if candidate_client is None:
                continue
            balance = await _live_or_cached_balance(f"bot:{bot_id}:{credential.exchange}", candidate_client)
            if balance is not None and balance >= required_margin:
                logger.info(
                    "margin_auto_switch_used", bot_id=bot_id, from_broker=preferred_broker,
                    to_broker=credential.exchange, required_margin=required_margin,
                )
                return credential.exchange, candidate_client, True

    elif tier == "trader":
        from app.services.trader_broker_connections import build_client_from_connection, list_connections_for_trader
        candidates = [c for c in await list_connections_for_trader(db, user_id) if c.exchange != preferred_broker]
        candidates.sort(key=lambda c: 0 if c.exchange == preferred_broker else 1)
        for connection in candidates:
            try:
                candidate_client = build_client_from_connection(connection)
            except Exception as e:
                logger.error("margin_switch_candidate_build_failed", user_id=str(user_id), exchange=connection.exchange, error=str(e))
                continue
            balance = await _live_or_cached_balance(f"trader:{user_id}:{connection.exchange}", candidate_client)
            if balance is not None and balance >= required_margin:
                logger.info(
                    "margin_auto_switch_used", user_id=str(user_id), from_broker=preferred_broker,
                    to_broker=connection.exchange, required_margin=required_margin,
                )
                return connection.exchange, candidate_client, True

    # No funded alternative found — fall open to the dedicated account,
    # same as if auto-switch had never fired at all.
    return preferred_broker, dedicated_client, False
