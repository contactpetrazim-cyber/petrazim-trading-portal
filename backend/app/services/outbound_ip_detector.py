"""
Outbound IP Auto-Detector — automatically discovers and persists the
real IP address(es) this platform's outbound broker traffic actually
egresses from, so PLATFORM_OUTBOUND_IPS never has to be hand-typed and
kept in sync by an admin — by direct follow-up request ("can we have
IPs stored so ... the VM [tiny] can be updated to possibly include new
and other traders IP ... can we work an engine that auto do this").

Probes each configured Fixie proxy (see config.py's own *_PROXY_URL
comment — every proxy URL routes through one of two shared Fixie
pools, ventoux/criterium, both already whitelisted on this platform's
OWN exchange keys) plus this backend's own direct/bare egress (no
proxy — what TradeLocker/MetaApi calls look like, since neither is
routed through Fixie; see trader_broker_connections.py's own
build_client_from_connection) against a public IP-echo service, and
persists the deduplicated result to PlatformSetting so BOTH backends
(Render primary, this VM backup — see this project's own CLAUDE.md)
read the same value from the one shared Supabase database, regardless
of which backend last ran the detection.

Runs periodically as a background task (see main.py's lifespan, same
convention as PositionMonitor/MarketScanner) since a Fixie plan's
assigned IPs essentially never change but genuinely CAN (a plan
upgrade/downgrade, Fixie-side infra) — a slow, occasional check costs
nothing. Also callable on demand from the admin endpoint
(routers/trader_broker_connections.py's own POST .../outbound-ips/refresh).
"""

from __future__ import annotations

import asyncio
from typing import Dict, Optional

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.platform_setting import PlatformSetting

logger = structlog.get_logger()
settings = get_settings()

# A separate key from the manually-set PLATFORM_OUTBOUND_IPS env var
# (config.py) — that one stays a deliberate, honest manual override
# when an admin has actually verified a value; this is the
# auto-detected one. get_effective_outbound_ips() below prefers the
# manual override when set, since an admin who explicitly typed a
# value presumably knows something this probe can't (e.g. an IP this
# probe found is correct but not yet whitelisted everywhere it needs
# to be, or a value from before this detector existed).
PLATFORM_OUTBOUND_IPS_DETECTED_KEY = "platform.outbound_ips_detected"

# An admin typing the real IP(s) into a form on the site (see
# routers/trader_broker_connections.py's own PATCH .../outbound-ips)
# and having it take effect immediately, with no env var edit or
# redeploy — by direct follow-up request ("if the IP is [entered]
# through a form on the site ... it automatically trigger[s]... on the
# backend"). Takes priority over both the env var AND the
# auto-detected value below (see get_effective_outbound_ips) — an
# admin who deliberately typed a value here is the most current,
# most-trusted source there is.
PLATFORM_OUTBOUND_IPS_MANUAL_KEY = "platform.outbound_ips_manual"

# One small, free, no-auth IP-echo endpoint — no exchange API call
# involved, so probing never touches or counts against any exchange's
# own rate limit/quota.
_IP_ECHO_URL = "https://api.ipify.org?format=json"

_PROXY_SOURCES = {
    "bybit": ("BYBIT_PROXY_URL", "BYBIT_BACKUP_PROXY_URL"),
    "bingx": ("BINGX_PROXY_URL", "BINGX_BACKUP_PROXY_URL"),
    "binance": ("BINANCE_PROXY_URL", "BINANCE_BACKUP_PROXY_URL"),
    "mexc": ("MEXC_PROXY_URL", "MEXC_BACKUP_PROXY_URL"),
}


async def _probe(proxy_url: Optional[str]) -> Optional[str]:
    """One IP-echo call, optionally through `proxy_url`. None on any
    failure (offline proxy, timeout, DNS) — a probe that can't reach
    the echo service contributes nothing rather than raising and
    aborting every other probe running alongside it."""
    try:
        kwargs = {"proxy": proxy_url} if proxy_url else {}
        async with httpx.AsyncClient(timeout=8.0, **kwargs) as client:
            resp = await client.get(_IP_ECHO_URL)
            resp.raise_for_status()
            return resp.json().get("ip")
    except Exception as e:
        logger.warning("outbound_ip_probe_failed", proxy=bool(proxy_url), error=str(e))
        return None


async def detect_outbound_ips() -> Dict[str, str]:
    """Probes this backend's own direct egress plus every configured
    proxy pool, returns {label: ip} for whichever probes succeeded.
    Labels are for humans/logging (which pool an IP came from); the
    persisted, trader-facing value (see refresh_and_persist below) is
    just the deduplicated set of IPs themselves — Fixie assigns the
    SAME small pool of IPs across every proxy URL on one account, so
    most labels collapse down to 1-2 unique addresses in practice."""
    labels = ["direct"]
    coros = [_probe(None)]

    seen_urls = set()
    for exchange, (primary_setting, backup_setting) in _PROXY_SOURCES.items():
        for pool, setting_name in (("primary", primary_setting), ("backup", backup_setting)):
            url = getattr(settings, setting_name, "") or ""
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            labels.append(f"{exchange}_{pool}")
            coros.append(_probe(url))

    results = await asyncio.gather(*coros)
    return {label: ip for label, ip in zip(labels, results) if ip}


async def refresh_and_persist(db: AsyncSession) -> str:
    """Runs detection and persists the deduplicated IP list to
    PlatformSetting (shared across both backends via the one Supabase
    database). Returns the comma-joined string that ends up stored,
    same shape PLATFORM_OUTBOUND_IPS itself already uses."""
    detected = await detect_outbound_ips()
    unique_ips = sorted(set(detected.values()))
    joined = ", ".join(unique_ips)

    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_DETECTED_KEY)
    )).scalar_one_or_none()
    if row is None:
        row = PlatformSetting(key=PLATFORM_OUTBOUND_IPS_DETECTED_KEY, value=joined)
        db.add(row)
    else:
        row.value = joined
    await db.commit()
    logger.info("outbound_ips_detected", ips=joined, sources=detected)
    return joined


async def get_effective_outbound_ips(db: AsyncSession) -> str:
    """What the onboarding page and admin dashboard actually display,
    in priority order:
      1. An admin's value typed into the site's own form (DB-backed,
         PLATFORM_OUTBOUND_IPS_MANUAL_KEY) — takes effect immediately,
         no redeploy.
      2. The PLATFORM_OUTBOUND_IPS env var — an older, deploy-time-only
         override, kept working for anyone who already set it.
      3. The last value OutboundIpDetector auto-discovered.
    No live network probe on this call — detection only ever runs from
    the background OutboundIpDetector loop or an explicit admin
    refresh, never on a normal page load."""
    manual_row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_MANUAL_KEY)
    )).scalar_one_or_none()
    if manual_row and manual_row.value.strip():
        return manual_row.value.strip()

    env_override = (getattr(settings, "PLATFORM_OUTBOUND_IPS", "") or "").strip()
    if env_override:
        return env_override

    detected_row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_DETECTED_KEY)
    )).scalar_one_or_none()
    return detected_row.value if detected_row else ""


async def get_effective_outbound_ips_with_source(db: AsyncSession) -> "tuple[str, str]":
    """Same priority order as get_effective_outbound_ips, but also
    says WHICH source won — "manual_override" (the site's own form, or
    the legacy env var) or "auto_detected" — so the admin dashboard can
    show the admin which one is actually in effect right now."""
    manual_row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_MANUAL_KEY)
    )).scalar_one_or_none()
    if manual_row and manual_row.value.strip():
        return manual_row.value.strip(), "manual_override"

    env_override = (getattr(settings, "PLATFORM_OUTBOUND_IPS", "") or "").strip()
    if env_override:
        return env_override, "manual_override"

    detected_row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_DETECTED_KEY)
    )).scalar_one_or_none()
    return (detected_row.value if detected_row else ""), "auto_detected"


async def set_manual_outbound_ips(db: AsyncSession, value: str) -> None:
    """Saves (or, given an empty string, clears) the admin form's own
    override — see PLATFORM_OUTBOUND_IPS_MANUAL_KEY's own comment.
    Clearing it falls back to the env var, then the auto-detected
    value, per get_effective_outbound_ips' own priority order."""
    value = (value or "").strip()
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IPS_MANUAL_KEY)
    )).scalar_one_or_none()
    if row is None:
        row = PlatformSetting(key=PLATFORM_OUTBOUND_IPS_MANUAL_KEY, value=value)
        db.add(row)
    else:
        row.value = value
    await db.commit()


class OutboundIpDetector:
    """Background refresh loop — same shape as PositionMonitor/
    MarketScanner (see main.py's lifespan). Fixie's assigned IPs are
    effectively static, so this runs on a long interval purely as a
    safety net for the rare case they ever change (a plan
    upgrade/downgrade, Fixie-side infra change), plus once at startup
    so a fresh deployment isn't stuck showing an empty value until the
    first interval elapses."""

    def __init__(self):
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info("outbound_ip_detector_started", interval_seconds=settings.OUTBOUND_IP_DETECTOR_INTERVAL_SECONDS)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_forever(self) -> None:
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    await refresh_and_persist(db)
            except Exception as e:
                logger.error("outbound_ip_detector_cycle_failed", error=str(e))
            await asyncio.sleep(settings.OUTBOUND_IP_DETECTOR_INTERVAL_SECONDS)
