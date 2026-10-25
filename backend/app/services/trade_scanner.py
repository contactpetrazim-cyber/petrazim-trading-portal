"""
Trade Scanner — momentum/RSI setup screener across a symbol watchlist
=========================================================================

Ported in spirit from the MIT-licensed trader-scanner skill
(github.com/Jakeschincariol/day-trader-skill, scan.py's `rsi`/`find_setups`
daily-setup scan) -- same core screening logic and thresholds, rebuilt here
for this app's own 24/7 crypto symbols instead of NYSE/Nasdaq equities:

- The source skill's opening-range-breakout (ORB) mode is deliberately NOT
  ported: it is built entirely around a single daily US-market-open window
  (Eastern time sessions, pre/post-market handling) that has no equivalent
  in a 24/7 perpetual market -- there is no "market open" to range off of.
- The source skill's daily-setup scan has no such market-hours dependency
  -- it is pure technical analysis over a list of closes -- so it ports
  directly, generalized from "daily bars" to "the user's chosen timeframe"
  (the five setup rules below are about shape, not the literal calendar).
- Fetches real OHLCV via `shared_ingestion.fetch_historical_ccxt` (the same
  proxy-failover client the other scanners/engines use), one bounded call
  per symbol, run concurrently across the watchlist.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from app.core.smc_algorithms import Candle
from app.services.data_ingestion import shared_ingestion

MIN_BARS = 30
DEFAULT_LIMIT = 60
MAX_SYMBOLS = 25


class TradeScannerError(Exception):
    pass


def _rsi(closes: List[float], n: int = 14) -> Optional[float]:
    """Wilder's RSI -- identical formula to the source skill's own rsi()."""
    if len(closes) < n + 1:
        return None
    gains = [max(0.0, closes[i] - closes[i - 1]) for i in range(1, len(closes))]
    losses = [max(0.0, closes[i - 1] - closes[i]) for i in range(1, len(closes))]
    avg_gain, avg_loss = sum(gains[:n]) / n, sum(losses[:n]) / n
    for i in range(n, len(gains)):
        avg_gain = (avg_gain * (n - 1) + gains[i]) / n
        avg_loss = (avg_loss * (n - 1) + losses[i]) / n
    return 100 - 100 / (1 + avg_gain / avg_loss) if avg_loss else 100.0


def find_setups(closes: List[float]) -> tuple[List[str], Dict[str, Optional[float]]]:
    """closes (oldest first, >= MIN_BARS) -> (setup tags, numbers). Same five
    rules and thresholds as the source skill's find_setups(); only the
    "daily bar" framing is generalized to "the caller's chosen timeframe"."""
    c = closes
    last = c[-1]
    high20 = max(c[-21:-1])
    ma20 = sum(c[-20:]) / 20.0
    ma20_prev = sum(c[-21:-1]) / 20.0
    run = c[-6] / c[-16] - 1
    range5 = (max(c[-5:]) - min(c[-5:])) / last
    r = _rsi(c)
    r_prev = _rsi(c[:-1])

    tags: List[str] = []
    if last > high20:
        tags.append("breakout_20")
    if run > 0.10 and range5 < 0.05:
        tags.append("bull_flag")
    if c[-2] < ma20_prev and last > ma20:
        tags.append("reclaim_ma20")
    if r is not None and r < 30:
        tags.append("oversold")
    if r_prev is not None and r_prev < 30 and last > c[-2]:
        tags.append("oversold_bounce")

    return tags, {
        "rsi": r, "rsi_prev": r_prev, "high20": high20, "ma20": ma20,
        "run_pct": round(run * 100, 2), "range5_pct": round(range5 * 100, 2),
    }


async def _fetch_one(exchange: str, symbol: str, timeframe: str, limit: int) -> tuple[str, Optional[List[Candle]], Optional[str]]:
    try:
        candles = await shared_ingestion.fetch_historical_ccxt(exchange, symbol, timeframe, limit=limit)
        return symbol, candles, None
    except Exception as exc:  # a bad symbol or a down exchange shouldn't sink the whole scan
        return symbol, None, str(exc)


async def scan_symbols(
    *, exchange: str, symbols: List[str], timeframe: str = "1h",
    limit: int = DEFAULT_LIMIT, min_price: float = 0.0, min_volume: float = 0.0,
) -> Dict[str, Any]:
    if not symbols:
        raise TradeScannerError("Provide at least one symbol to scan.")
    if len(symbols) > MAX_SYMBOLS:
        raise TradeScannerError(f"Scan at most {MAX_SYMBOLS} symbols at a time (got {len(symbols)}).")

    results = await asyncio.gather(*(_fetch_one(exchange, s, timeframe, limit) for s in symbols))

    # Every symbol that actually got scanned, setup tags or not -- a
    # symbol with zero tags is a real, honest result (the five
    # conditions just aren't met right now), not a failure, and
    # throwing its computed numbers away left the UI with nothing to
    # show but "no setups fired," indistinguishable from the tool not
    # actually having analyzed anything (direct bug report: a correct
    # zero-hit result read as broken). Every scanned symbol now carries
    # its real numbers; `setups` is simply empty when nothing fired.
    scanned: List[Dict[str, Any]] = []
    errors: List[str] = []
    counts = {"requested": len(symbols), "scanned": 0, "skipped_short": 0, "skipped_illiquid": 0, "errored": 0}

    for symbol, candles, error in results:
        if error is not None:
            counts["errored"] += 1
            errors.append(f"{symbol}: {error}")
            continue
        closes = [c.close for c in candles]
        volume = candles[-1].volume if candles else 0.0
        price = closes[-1] if closes else None
        if price is None or price < min_price or (min_volume > 0 and volume < min_volume):
            counts["skipped_illiquid"] += 1
            continue
        if len(closes) < MIN_BARS:
            counts["skipped_short"] += 1
            continue
        counts["scanned"] += 1
        tags, nums = find_setups(closes)
        scanned.append({
            "symbol": symbol, "setups": tags, "price": round(price, 8),
            "volume": round(volume, 4), "rsi": round(nums["rsi"], 1) if nums["rsi"] is not None else None,
            "run_pct": nums["run_pct"], "range5_pct": nums["range5_pct"],
        })

    # Hits (a real setup fired) first, most dollars traded first within
    # each group -- a trader scanning a long watchlist wants the active
    # setups at the top, not buried alphabetically among the misses.
    scanned.sort(key=lambda h: (not h["setups"], -(h["price"] * (h["volume"] or 0)), h["symbol"]))
    counts["hits"] = sum(1 for h in scanned if h["setups"])
    return {"exchange": exchange, "timeframe": timeframe, "hits": scanned, "counts": counts, "errors": errors}
