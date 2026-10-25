"""
TTL Cache — a tiny in-process cache for hot, slow-changing read paths
========================================================================

Not Redis. This app's own `redis==5.0.6` dependency has sat in
requirements.txt completely unused (confirmed: zero imports anywhere in
the codebase) -- and more importantly, no Redis instance is actually
provisioned anywhere in this deployment (confirmed against the live Render
account: only the two web services exist, no key-value service). Redis only
earns its keep once there's more than one process/instance sharing cache
state; this backend runs as a single free-tier instance, so a real Redis
deployment would be new paid infrastructure bought to solve a problem a
plain in-memory dict already solves for free, at this scale.

Use this for a response that's (a) read often (dashboard stats polled every
few seconds), (b) expensive enough to matter (a few sequential DB round
trips, each crossing Render-Frankfurt <-> Supabase-eu-west-2), and (c) fine
being a few seconds stale (nothing here is a live order-execution path).
Never cache anything that gates money moving or that a user just mutated and
expects to see reflected immediately.

Usage:
    from app.core.ttl_cache import ttl_cache

    cached = ttl_cache.get("dashboard_stats", user.id)
    if cached is not None:
        return cached
    result = await _compute_it()
    ttl_cache.set("dashboard_stats", user.id, result, ttl_seconds=8)
    return result
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Any, Dict, Hashable, Optional, Tuple


class TTLCache:
    def __init__(self) -> None:
        self._store: Dict[Tuple[str, Hashable], Tuple[float, Any]] = {}
        self._lock = Lock()

    def get(self, namespace: str, key: Hashable) -> Optional[Any]:
        with self._lock:
            entry = self._store.get((namespace, key))
            if entry is None:
                return None
            expires_at, value = entry
            if time.monotonic() >= expires_at:
                del self._store[(namespace, key)]
                return None
            return value

    def set(self, namespace: str, key: Hashable, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._store[(namespace, key)] = (time.monotonic() + ttl_seconds, value)

    def invalidate(self, namespace: str, key: Optional[Hashable] = None) -> None:
        """Drop one entry, or every entry in a namespace when key is
        omitted -- e.g. after an action that changes what dashboard_stats
        would report, so the next read isn't stale for the rest of its TTL."""
        with self._lock:
            if key is not None:
                self._store.pop((namespace, key), None)
                return
            for k in [k for k in self._store if k[0] == namespace]:
                del self._store[k]


# One process-wide instance, matching this app's existing
# shared_ingestion-style module-level singleton convention
# (app/services/data_ingestion.py).
ttl_cache = TTLCache()
