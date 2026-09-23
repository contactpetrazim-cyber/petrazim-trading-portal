"""
Canonical ".P" (TradingView's own perpetual-futures suffix) handling —
ONE place, used by every module that needs to know whether a symbol
string is a futures/perpetual reference before making its own real API
call.

By direct request ("can we have a permanent fix of this issue") after
the SAME symbol-format bug was independently reintroduced twice:
first in live_price.py (a stuck pending order never triggered — see
that fix's own history), then months later in data_ingestion.py (the
autonomous market scanner silently failed every single fetch the
moment it was turned on, for every futures-configured bot, until
caught live in production). Both times, the root cause was the exact
same thing: a module reimplementing its own ".P" stripping logic
instead of sharing one already-correct implementation.

A shared helper doesn't guarantee a future fourth call site can't
still forget to import it — but it means there is exactly ONE place
to fix or extend the convention (e.g. a future ".PS" suffix, or an
exchange-specific variant) instead of N independently-drifting copies.
"""

from __future__ import annotations

FUTURES_SUFFIX = ".P"


def strip_futures_suffix(symbol: str) -> tuple[str, bool]:
    """"BTCUSDT.P" -> ("BTCUSDT", True); "BTCUSDT" -> ("BTCUSDT", False).
    Case-insensitive on the way in; the returned base symbol is always
    upper-cased."""
    clean = symbol.upper()
    if clean.endswith(FUTURES_SUFFIX):
        return clean[: -len(FUTURES_SUFFIX)], True
    return clean, False
