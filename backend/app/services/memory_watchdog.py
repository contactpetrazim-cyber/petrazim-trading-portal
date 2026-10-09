"""
Memory Watchdog — by direct request, after a real Render alert:
"Web Service petrazim-trading-backend exceeded its memory limit ...
FIX - create an auto engine to fix this."

Render's own platform ALREADY auto-restarts an instance that hits its
hard memory limit — that's what "triggered an automatic restart" in
the alert means, and it's already working exactly as designed. This
doesn't duplicate that (a second, in-app self-restart mechanism would
just race Render's own and risk making restarts MORE frequent, not
fewer). What was actually missing is prevention: something that
notices memory climbing BEFORE the hard limit, reclaims what it can,
and leaves a real trail in the logs for whichever cause turns out to
be responsible (this session's own investigation found the specific
alert most plausibly came from the sheer frequency of same-day
redeploys, not a sustained leak — but a real, separate leak was also
found and fixed alongside this: routers/oanda.py was constructing a
fresh httpx.AsyncClient, and its whole connection pool, on every
single request instead of reusing one long-lived client the way
order_flow.py's own Binance clients already do).

Runs as a single in-process asyncio task (see main.py's lifespan),
same convention as MarketScanner/PositionMonitor/MetaApiIdleUndeployer.

Reads this process's own RSS from /proc/self/status (Linux-only, which
every real deployment of this app — Render, the VM, Docker in general
— already is; no new dependency like psutil needed for one number).
The "limit" to compare against is read from the container's own cgroup
(v2 memory.max, falling back to v1 memory.limit_in_bytes) when
available, since that's the actual real ceiling Render enforces —
falling back to METAAPI... no, MEMORY_WATCHDOG_LIMIT_BYTES (config.py,
defaults to 512MB, this service's actual current Render free-tier
limit, confirmed via its own metrics) when cgroup limits aren't
readable or report "max" (unbounded — true on this VM's own backup
container, which has no cgroup cap set).
"""

from __future__ import annotations

import asyncio
import gc
from typing import TYPE_CHECKING, Optional

import structlog

from app.config import get_settings

if TYPE_CHECKING:
    from app.services.market_scanner import MarketScanner

logger = structlog.get_logger()
settings = get_settings()


def _read_rss_bytes() -> Optional[int]:
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    # e.g. "VmRSS:      123456 kB"
                    return int(line.split()[1]) * 1024
    except Exception:
        return None
    return None


def _read_meminfo() -> dict[str, int]:
    """Raw /proc/meminfo values in bytes, by key (e.g. "MemTotal",
    "MemAvailable", "SwapTotal", "SwapFree"). Linux-only, same as
    _read_rss_bytes above — every real deployment of this app already
    is Linux. Returns {} on any read failure rather than raising."""
    out: dict[str, int] = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2 and parts[1].isdigit():
                    out[parts[0].rstrip(":")] = int(parts[1]) * 1024  # kB -> bytes
    except Exception:
        pass
    return out


def _read_memory_limit_bytes() -> int:
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            with open(path) as f:
                value = f.read().strip()
            if value.isdigit():
                limit = int(value)
                # A very large value here (no real cap set) means treat
                # it the same as "unreadable" — fall through below
                # rather than trust an effectively infinite number.
                if limit < (1 << 40):  # < 1 TB — a real, meaningful cap
                    return limit
        except Exception:
            continue

    # No readable cgroup cap — true on this VM's own backup container
    # (docker inspect confirmed Memory=0), where the OLD behavior here
    # was to silently use MEMORY_WATCHDOG_LIMIT_BYTES (512MB, Render's
    # free-tier figure) as if this were Render too. That's the wrong
    # reference point for a shared VM: its real ceiling is "whatever's
    # left of host MemTotal after the OS + co-tenants (Coolify's own
    # full management stack, confirmed live via docker stats)", not a
    # number borrowed from a different host entirely. Use host
    # MemTotal minus a reserved chunk when meminfo is readable; only
    # fall back to the Render constant when even that isn't available.
    meminfo = _read_meminfo()
    mem_total = meminfo.get("MemTotal")
    if mem_total:
        reserved = settings.MEMORY_WATCHDOG_HOST_RESERVED_MB * 1024 * 1024
        return max(mem_total - reserved, 1)
    return settings.MEMORY_WATCHDOG_LIMIT_BYTES


class MemoryWatchdog:
    def __init__(self, scanner: Optional["MarketScanner"] = None):
        # `scanner` — the live MarketScanner instance (main.py's
        # lifespan), or None when MARKET_SCANNER_ENABLED is off. Used
        # ONLY to widen its scan interval under sustained memory
        # pressure (see market_scanner.py's own set_degraded/
        # is_degraded and self._degraded's comment there) — never to
        # touch PositionMonitor/PendingOrderMonitor, which must keep
        # running at full cadence regardless.
        self._scanner = scanner
        self._task: Optional[asyncio.Task] = None
        self._limit_bytes = _read_memory_limit_bytes()
        self._warned = False
        self._consecutive_critical = 0

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_forever())
            logger.info(
                "memory_watchdog_started",
                interval_seconds=settings.MEMORY_WATCHDOG_INTERVAL_SECONDS,
                limit_mb=round(self._limit_bytes / 1024 / 1024, 1),
            )

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
                self.check_once()
            except Exception as e:
                logger.error("memory_watchdog_cycle_failed", error=str(e))
            await asyncio.sleep(settings.MEMORY_WATCHDOG_INTERVAL_SECONDS)

    def _host_ratio(self, meminfo: dict[str, int]) -> Optional[float]:
        """Worse of (host memory used, swap used) as a single 0-1
        ratio — an INDEPENDENT signal from the process-RSS check above,
        added because this process's own RSS can be comfortably under
        its limit while the shared Nube VM host is already under real
        pressure (confirmed live: 1.1GB/4GB swap already in use while
        this process sat at 177MB RSS — the existing RSS-only check
        structurally cannot see that). None when meminfo is empty
        (unreadable, e.g. non-Linux) — same "don't guess" convention
        as the rest of this module."""
        mem_total = meminfo.get("MemTotal")
        mem_available = meminfo.get("MemAvailable")
        swap_total = meminfo.get("SwapTotal")
        swap_free = meminfo.get("SwapFree")
        ratios = []
        if mem_total:
            ratios.append(1 - (mem_available or 0) / mem_total)
        if swap_total:
            ratios.append((swap_total - (swap_free or 0)) / swap_total)
        return max(ratios) if ratios else None

    def check_once(self) -> None:
        rss = _read_rss_bytes()
        meminfo = _read_meminfo()
        host_ratio = self._host_ratio(meminfo)
        process_ratio = (rss / self._limit_bytes) if rss is not None else None
        if process_ratio is None and host_ratio is None:
            return

        is_critical = (
            (process_ratio is not None and process_ratio >= settings.MEMORY_WATCHDOG_GC_PERCENT)
            or (host_ratio is not None and host_ratio >= settings.MEMORY_WATCHDOG_HOST_CRITICAL_PERCENT)
        )
        is_elevated = (
            (process_ratio is not None and process_ratio >= settings.MEMORY_WATCHDOG_WARN_PERCENT)
            or (host_ratio is not None and host_ratio >= settings.MEMORY_WATCHDOG_HOST_WARN_PERCENT)
        )

        if is_critical:
            # Proactively reclaim whatever Python's own garbage
            # collector can find — always safe (never destructive,
            # unlike a self-restart) and the one thing this process can
            # genuinely do for itself before Render's own OOM killer
            # (or, on this VM, the kernel's own) would otherwise step
            # in. Logged at error level so it shows up loudly, since
            # crossing this line means the next stop is the hard limit.
            before = rss
            collected = gc.collect()
            after = _read_rss_bytes() or before
            logger.error(
                "memory_watchdog_high_reclaiming",
                rss_mb=round(before / 1024 / 1024, 1) if before is not None else None,
                limit_mb=round(self._limit_bytes / 1024 / 1024, 1),
                process_ratio=round(process_ratio, 3) if process_ratio is not None else None,
                host_ratio=round(host_ratio, 3) if host_ratio is not None else None,
                gc_objects_collected=collected,
                rss_after_gc_mb=round(after / 1024 / 1024, 1) if after is not None else None,
            )
            self._warned = True
            self._consecutive_critical += 1
            # Only engage degraded mode on the SECOND consecutive
            # critical cycle — i.e. GC alone didn't bring it back down
            # — rather than on the first sighting, so a single brief
            # spike doesn't throttle real signal-scanning for nothing.
            if self._consecutive_critical >= 2 and self._scanner is not None:
                self._scanner.set_degraded(True)
        elif is_elevated:
            if not self._warned:
                logger.warning(
                    "memory_watchdog_elevated",
                    rss_mb=round(rss / 1024 / 1024, 1) if rss is not None else None,
                    limit_mb=round(self._limit_bytes / 1024 / 1024, 1),
                    process_ratio=round(process_ratio, 3) if process_ratio is not None else None,
                    host_ratio=round(host_ratio, 3) if host_ratio is not None else None,
                )
                self._warned = True
            self._consecutive_critical = 0
        else:
            self._warned = False
            self._consecutive_critical = 0
            if self._scanner is not None and self._scanner.is_degraded():
                self._scanner.set_degraded(False)

    def get_status(self) -> dict:
        """Single source of truth for GET /bots/system-health — reuses
        the exact same reads/thresholds check_once() itself uses rather
        than a second copy of this math."""
        rss = _read_rss_bytes()
        meminfo = _read_meminfo()
        host_ratio = self._host_ratio(meminfo)
        process_ratio = (rss / self._limit_bytes) if rss is not None else None

        is_critical = (
            (process_ratio is not None and process_ratio >= settings.MEMORY_WATCHDOG_GC_PERCENT)
            or (host_ratio is not None and host_ratio >= settings.MEMORY_WATCHDOG_HOST_CRITICAL_PERCENT)
        )
        is_elevated = (
            (process_ratio is not None and process_ratio >= settings.MEMORY_WATCHDOG_WARN_PERCENT)
            or (host_ratio is not None and host_ratio >= settings.MEMORY_WATCHDOG_HOST_WARN_PERCENT)
        )
        zone = "critical" if is_critical else ("warn" if is_elevated else "ok")

        return {
            "zone": zone,
            "process_rss_mb": round(rss / 1024 / 1024, 1) if rss is not None else None,
            "process_limit_mb": round(self._limit_bytes / 1024 / 1024, 1),
            "process_ratio": round(process_ratio, 3) if process_ratio is not None else None,
            "host_mem_total_mb": round(meminfo["MemTotal"] / 1024 / 1024, 1) if meminfo.get("MemTotal") else None,
            "host_mem_available_mb": round(meminfo["MemAvailable"] / 1024 / 1024, 1) if meminfo.get("MemAvailable") else None,
            "host_swap_used_mb": (
                round((meminfo["SwapTotal"] - meminfo.get("SwapFree", 0)) / 1024 / 1024, 1)
                if meminfo.get("SwapTotal") else None
            ),
            "host_ratio": round(host_ratio, 3) if host_ratio is not None else None,
            "scanner_degraded": self._scanner.is_degraded() if self._scanner is not None else None,
        }
