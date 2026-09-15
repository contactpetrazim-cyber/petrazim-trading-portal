"""
Proxy Health Tracker — a lightweight, in-process early-warning system
for the Binance proxy pair (Fixie today) breaking down.
=====================================================================

By direct request: "other creative workarounds... proactive Fixie
quota monitoring." Fixie doesn't expose a public API this app could
poll for "how much quota is left" (nothing documented, and guessing
one would risk silently doing nothing useful) — so instead of a made-
up check, this tracks REAL failures as they actually happen. Every
call site that already distinguishes a transport-level proxy failure
from an application-level rejection (order_flow.py's `_binance_get`,
live_price.py's `get_crypto_price` — both already catch
`_FAILOVER_EXCEPTIONS`) reports here, and this raises one loud,
structured log line the moment failures cluster, instead of each one
logging quietly on its own and only being noticed much later from a
user bug report — exactly how this session found the "407 Proxy
Authentication Required" issue in the first place.

Deliberately in-process/in-memory, not persisted — matches this app's
existing convention for this class of thing (position_monitor.py,
pending_order_monitor.py are the same: simplest thing that works for
one web instance, not a distributed system). A restart clears it,
which is fine — the point is catching a live incident quickly, not
keeping a permanent audit log (TradeLog already exists for anything
that needs one).
"""

from __future__ import annotations

import time
from collections import deque
from typing import Deque

import structlog

logger = structlog.get_logger()

# 5+ transport failures within a 5-minute window is well past "one
# blip" — that's the same shape the 407 incident actually had (a
# steady stream of failures, not an isolated one).
_FAILURE_WINDOW_SECONDS = 300
_ALERT_THRESHOLD = 5

_failures: Deque[float] = deque()
_alert_active = False
_last_error: str = ""


def record_proxy_failure(source: str, error: str) -> None:
    """Call this the moment a Binance proxy call fails at the
    TRANSPORT level (ProxyError/ConnectError/ConnectTimeout/
    ReadTimeout — the same exception classes _FAILOVER_EXCEPTIONS
    already targets), not on an ordinary application-level rejection
    (a bad symbol, a 400) — this tracks the proxy itself being broken,
    not normal request errors."""
    global _alert_active, _last_error
    now = time.monotonic()
    _last_error = error
    _failures.append(now)
    while _failures and now - _failures[0] > _FAILURE_WINDOW_SECONDS:
        _failures.popleft()

    if len(_failures) >= _ALERT_THRESHOLD and not _alert_active:
        _alert_active = True
        logger.error(
            "proxy_health_alert", source=source, error=error, failures_in_window=len(_failures),
            window_seconds=_FAILURE_WINDOW_SECONDS,
            message="Repeated Binance proxy failures — check Fixie credentials/quota on Render.",
        )
    elif _alert_active:
        logger.warning("proxy_health_failure_while_alert_active", source=source, error=error)


def record_proxy_success() -> None:
    """Call this whenever a Binance proxy call succeeds — clears the
    tracked failures and, if an alert was active, logs that things
    recovered, so the alert doesn't stay stuck 'on' forever after a
    transient blip resolves itself."""
    global _alert_active
    if _failures:
        _failures.clear()
    if _alert_active:
        _alert_active = False
        logger.info("proxy_health_recovered")


def get_status() -> dict:
    """For GET /admin/proxy-health — the Admin Console's own real-time
    view of this, instead of needing to go dig through Render logs."""
    now = time.monotonic()
    recent = [f for f in _failures if now - f <= _FAILURE_WINDOW_SECONDS]
    return {
        "alert_active": _alert_active,
        "failures_in_last_5_min": len(recent),
        "threshold": _ALERT_THRESHOLD,
        "last_error": _last_error or None,
    }
