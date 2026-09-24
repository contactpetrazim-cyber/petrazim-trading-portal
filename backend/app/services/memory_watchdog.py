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
from typing import Optional

import structlog

from app.config import get_settings

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


def _read_memory_limit_bytes() -> int:
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            with open(path) as f:
                value = f.read().strip()
            if value.isdigit():
                limit = int(value)
                # A very large value here (no real cap set) means treat
                # it the same as "unreadable" — fall through to the
                # configured default rather than trust an effectively
                # infinite number.
                if limit < (1 << 40):  # < 1 TB — a real, meaningful cap
                    return limit
        except Exception:
            continue
    return settings.MEMORY_WATCHDOG_LIMIT_BYTES


class MemoryWatchdog:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._limit_bytes = _read_memory_limit_bytes()
        self._warned = False

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

    def check_once(self) -> None:
        rss = _read_rss_bytes()
        if rss is None:
            return
        ratio = rss / self._limit_bytes

        if ratio >= settings.MEMORY_WATCHDOG_GC_PERCENT:
            # Proactively reclaim whatever Python's own garbage
            # collector can find — always safe (never destructive,
            # unlike a self-restart) and the one thing this process can
            # genuinely do for itself before Render's own OOM killer
            # would otherwise step in. Logged at error level so it
            # shows up loudly, since crossing this line means the next
            # stop is the hard limit.
            before = rss
            collected = gc.collect()
            after = _read_rss_bytes() or before
            logger.error(
                "memory_watchdog_high_reclaiming", rss_mb=round(before / 1024 / 1024, 1),
                limit_mb=round(self._limit_bytes / 1024 / 1024, 1), ratio=round(ratio, 3),
                gc_objects_collected=collected, rss_after_gc_mb=round(after / 1024 / 1024, 1),
            )
            self._warned = True
        elif ratio >= settings.MEMORY_WATCHDOG_WARN_PERCENT:
            if not self._warned:
                logger.warning(
                    "memory_watchdog_elevated", rss_mb=round(rss / 1024 / 1024, 1),
                    limit_mb=round(self._limit_bytes / 1024 / 1024, 1), ratio=round(ratio, 3),
                )
                self._warned = True
        else:
            self._warned = False
