"""
Outbound IP Auto-Detector — automatically discovers and persists the
real IP address(es) this platform's outbound broker traffic actually
egresses from, so PLATFORM_OUTBOUND_IPS never has to be hand-typed and
kept in sync by an admin — by direct follow-up request ("can we have
IPs stored so ... the VM [tiny] can be updated to possibly include new
and other traders IP ... can we work an engine that auto do this").

Reports TWO separate, labeled IPs, not one merged list — by direct
follow-up request ("Let it show the two IP / VM / Fixie / New user"),
after this session confirmed the platform's real, working topology:
Render's own outbound broker traffic is proxied THROUGH a tinyproxy
instance running on the Nube VM (its *_PROXY_URL settings) as the
PRIMARY route — the exchange sees the VM's own IP — with a Fixie pool
configured as *_BACKUP_PROXY_URL, used only if the VM's proxy is
unreachable. So:
  - "vm"    — the IP a request egresses with when it goes out via the
              VM (either the VM's OWN backend calling an exchange
              directly with no proxy at all, since it has none
              configured — see the VM's own container env, verified
              empty — or, when this code runs on Render, whichever
              *_PROXY_URL primary proxy is configured, which per the
              above IS the VM's own tinyproxy).
  - "fixie" — whichever *_BACKUP_PROXY_URL is configured, the genuine
              secondary/failover pool.
A bare, unproxied ("direct") probe is only ever trusted as the VM's
own IP when NO primary proxy is configured at all for anything (true
when this code runs ON the VM itself, which has zero proxy vars) — on
Render, a direct probe would reveal Render's own ephemeral dyno IP,
which is neither whitelisted anywhere nor useful, so it's never used
there once a real primary-proxy reading exists.

Persists each category as its OWN PlatformSetting row, MERGED (union
with whatever's already stored) rather than overwritten on every
cycle — both Render and this VM run their own independent copy of this
background loop (see OutboundIpDetector below, started from every
instance's own main.py lifespan), and each only has visibility into
its own side of the topology (the VM can't discover Fixie's IP itself,
since it has no Fixie proxy configured; Render's own "direct" reading
is useless). Overwriting on every cycle would make the reported IPs
flip-flop or go missing depending on which backend last ran —
merging means the two instances' own findings simply accumulate into
one complete picture over time.
"""

from __future__ import annotations

import asyncio
from typing import Dict, Optional, Set

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.platform_setting import PlatformSetting

logger = structlog.get_logger()
settings = get_settings()

# Auto-detected, merged-across-cycles values — one row per category.
PLATFORM_OUTBOUND_IP_VM_KEY = "platform.outbound_ip_vm_detected"
PLATFORM_OUTBOUND_IP_FIXIE_KEY = "platform.outbound_ip_fixie_detected"

# An admin typing the real IP(s) into a form on the site (see
# routers/trader_broker_connections.py's own PATCH .../outbound-ips)
# and having it take effect immediately, with no env var edit or
# redeploy — by direct follow-up request ("if the IP is [entered]
# through a form on the site ... it automatically trigger[s]... on the
# backend"). Takes priority over the auto-detected value for that same
# category — an admin who deliberately typed a value presumably knows
# something the probe can't (e.g. a value not yet reflected by a fresh
# probe, or one deliberately overridden for a migration).
PLATFORM_OUTBOUND_IP_VM_MANUAL_KEY = "platform.outbound_ip_vm_manual"
PLATFORM_OUTBOUND_IP_FIXIE_MANUAL_KEY = "platform.outbound_ip_fixie_manual"

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


async def detect_outbound_ips() -> Dict[str, Set[str]]:
    """Returns {"vm": {ip, ...}, "fixie": {ip, ...}} — see this
    module's own docstring for exactly how each category is sourced."""
    primary_urls: Set[str] = set()
    backup_urls: Set[str] = set()
    for primary_setting, backup_setting in _PROXY_SOURCES.values():
        url = getattr(settings, primary_setting, "") or ""
        if url:
            primary_urls.add(url)
        url = getattr(settings, backup_setting, "") or ""
        if url:
            backup_urls.add(url)

    vm_ips: Set[str] = set()
    fixie_ips: Set[str] = set()

    if primary_urls:
        # Running somewhere (Render) that has a primary proxy
        # configured — per this module's own docstring, that primary
        # proxy IS the VM's tinyproxy, so its result belongs in "vm",
        # and a bare/unproxied probe here would just be this backend's
        # own irrelevant address, so it's skipped entirely.
        results = await asyncio.gather(*(_probe(u) for u in primary_urls))
        vm_ips.update(ip for ip in results if ip)
    else:
        # No primary proxy configured at all — this is what the VM's
        # own instance looks like (verified: its container has none of
        # these set). A bare, unproxied probe here genuinely reveals
        # the VM's own real IP.
        direct_ip = await _probe(None)
        if direct_ip:
            vm_ips.add(direct_ip)

    if backup_urls:
        results = await asyncio.gather(*(_probe(u) for u in backup_urls))
        fixie_ips.update(ip for ip in results if ip)

    return {"vm": vm_ips, "fixie": fixie_ips}


async def _merge_into(db: AsyncSession, key: str, new_ips: Set[str]) -> str:
    """Unions `new_ips` into whatever's already stored under `key`
    (comma-separated), rather than overwriting — see this module's own
    docstring on why a single cycle from a single backend must never
    erase what the OTHER backend's own cycle already found."""
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    existing = {ip.strip() for ip in (row.value.split(",") if row and row.value else []) if ip.strip()}
    merged = sorted(existing | new_ips)
    joined = ", ".join(merged)
    if row is None:
        db.add(PlatformSetting(key=key, value=joined))
    else:
        row.value = joined
    return joined


async def refresh_and_persist(db: AsyncSession) -> Dict[str, str]:
    """Runs detection and merges each category into its own
    PlatformSetting row. Returns {"vm": "...", "fixie": "..."} — the
    merged, comma-joined values that ended up stored."""
    detected = await detect_outbound_ips()
    vm_joined = await _merge_into(db, PLATFORM_OUTBOUND_IP_VM_KEY, detected["vm"])
    fixie_joined = await _merge_into(db, PLATFORM_OUTBOUND_IP_FIXIE_KEY, detected["fixie"])
    await db.commit()
    logger.info("outbound_ips_detected", vm=vm_joined, fixie=fixie_joined)
    return {"vm": vm_joined, "fixie": fixie_joined}


async def _read(db: AsyncSession, key: str) -> str:
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    return (row.value.strip() if row and row.value else "")


async def get_effective_outbound_ips_with_source(db: AsyncSession) -> Dict[str, str]:
    """What the onboarding page and admin dashboard actually display —
    {"vm": "...", "fixie": "...", "vm_source": "manual"|"auto",
    "fixie_source": "manual"|"auto"}. Each category independently
    prefers its own admin-set manual override, else its own
    auto-detected value, else (only if BOTH structured sources for
    BOTH categories are empty) the legacy combined PLATFORM_OUTBOUND_IPS
    env var, surfaced under "vm" as a last resort so an admin who set
    only that old setting isn't left with a blank page. No live network
    probe on this call — detection only ever runs from the background
    OutboundIpDetector loop or an explicit admin refresh."""
    vm_manual = await _read(db, PLATFORM_OUTBOUND_IP_VM_MANUAL_KEY)
    fixie_manual = await _read(db, PLATFORM_OUTBOUND_IP_FIXIE_MANUAL_KEY)
    vm_detected = await _read(db, PLATFORM_OUTBOUND_IP_VM_KEY)
    fixie_detected = await _read(db, PLATFORM_OUTBOUND_IP_FIXIE_KEY)

    vm = vm_manual or vm_detected
    vm_source = "manual" if vm_manual else "auto"
    fixie = fixie_manual or fixie_detected
    fixie_source = "manual" if fixie_manual else "auto"

    if not vm and not fixie:
        legacy = (getattr(settings, "PLATFORM_OUTBOUND_IPS", "") or "").strip()
        if legacy:
            vm, vm_source = legacy, "manual"

    return {"vm": vm, "fixie": fixie, "vm_source": vm_source, "fixie_source": fixie_source}


async def set_manual_outbound_ips(db: AsyncSession, vm: Optional[str], fixie: Optional[str]) -> None:
    """Saves (or, given an empty string, clears) the admin form's own
    override for each category independently — see the two
    *_MANUAL_KEY comments above. Only a category actually passed
    (not None) is touched."""
    if vm is not None:
        row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IP_VM_MANUAL_KEY))).scalar_one_or_none()
        if row is None:
            db.add(PlatformSetting(key=PLATFORM_OUTBOUND_IP_VM_MANUAL_KEY, value=vm.strip()))
        else:
            row.value = vm.strip()
    if fixie is not None:
        row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == PLATFORM_OUTBOUND_IP_FIXIE_MANUAL_KEY))).scalar_one_or_none()
        if row is None:
            db.add(PlatformSetting(key=PLATFORM_OUTBOUND_IP_FIXIE_MANUAL_KEY, value=fixie.strip()))
        else:
            row.value = fixie.strip()
    await db.commit()


class OutboundIpDetector:
    """Background refresh loop — same shape as PositionMonitor/
    MarketScanner (see main.py's lifespan). Both backends run their
    own copy independently (see this module's own docstring on why
    merging, not overwriting, matters here). Fixie's assigned IPs and
    the VM's own address are effectively static, so this runs on a
    long interval purely as a safety net for the rare case either
    changes — not a tight polling loop."""

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
