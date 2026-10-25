"""
Bot Simulation — the "watch it happen" bar-by-bar replay the SMC Bot
Academy plan calls for (plan item 6, buzzing-mixing-micali.md): steps
through a real historical candle window one base-timeframe bar at a
time and, at each step, runs the SAME real detection primitives every
bot already uses (`MarketStructureDetector`, `ZoneDetector`,
`FVGDetector`, `LiquidityDetector`, all `smc_algorithms.py`) against
the candles truncated to "closed at or before this bar" — exactly the
no-lookahead truncation `SmcStrategyAdapter.evaluate` already performs
per required timeframe (strategy_adapter.py) — and records which
detector results are NEW at that step, so the frontend can reveal each
one as a `CandleChart` zone/marker in sync with candle playback.

This is a thin, strictly READ-ONLY reporting layer: it does not call
any bot's own `.analyze()` and does not change `bot_strategies.py` or
`smc_algorithms.py` in any way (the plan's own non-negotiable) — it
only re-runs the same detector classes those files already export,
the same way `trade_forensics.py`'s `compute_trade_forensics` already
does for a single point-in-time reconstruction. This module is the
bar-by-bar extension of that same idea.

Zero order-placement capability anywhere in this module — it never
touches `execution_engine.py`, never constructs a `BotSignal`, and
never writes anything to the `trades`/`closed_trades` tables.
"""

from __future__ import annotations

import asyncio
import bisect
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bot_strategies import TUNABLE_PARAM_BOUNDS
from app.core.smc_algorithms import (
    Candle, FVGDetector, LiquidityDetector, MarketStructureDetector, MitigationStatus, ZoneDetector,
)
from app.engines.strategy_adapter import STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles
from app.models.bot import BotConfig
from app.models.trade import Trade, TradeDirection, TradeStatus
from app.models.user import User, UserRole
from app.services.data_ingestion import shared_ingestion

# Real bar durations per the same TF labels used throughout this
# codebase (strategy_adapter.py's own TF_TO_CCXT/TF_ORDER) — used only
# to size the real candle window (lookback-before-entry /
# trail-after-exit, or the no-trade-found fallback window), never to
# invent a price.
_BAR_SECONDS = {"1D": 86400, "4H": 14400, "1H": 3600, "15M": 900, "5M": 300}

# Real bars of lookback before a matched trade's own entry (so the
# setup that led into it is visible, not just the trade itself) and
# trail after its exit (so the immediate aftermath plays out too) —
# same "lookback_bars"/"trail" shape routers/trades.py's own
# trade_snapshot endpoint already uses for the same reason, sized
# smaller here since this window is walked bar-by-bar for animation,
# not just rendered once.
_LOOKBACK_BARS = 60
_TRAIL_BARS = 15
# Fallback window size (bot+direction has no real closed trade yet) —
# real RECENT market data, not a trade-anchored window. See
# compute_bot_simulation's own "source" field for how this is labeled.
_FALLBACK_BARS = 90

_STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)

# Teaching color convention this app already uses elsewhere (see
# OrderBlockZoneVisualizer.tsx / Dashboard.tsx): green = bullish/good,
# red = bearish, amber = caution/neutral — not invented here.
_COLOR_BULLISH = "#22c55e"
_COLOR_BEARISH = "#ef4444"
_COLOR_AMBER = "#f59e0b"
_COLOR_BLUE = "#3b82f6"


def _finest_timeframe(labels: List[str]) -> str:
    """The required timeframe closest to real execution granularity —
    same selection trade_forensics.py's own base_tf uses for price-path
    precision (see that file's own comment on why `max` by TF_ORDER
    index, not `min`, is the correct one for this purpose). Used here
    as the base/display timeframe the candle player actually steps
    through, bar by bar."""
    return max(labels, key=lambda l: TF_ORDER.index(l))


async def _find_real_trade(db: AsyncSession, bot_id: str, direction: str, user: User) -> Optional[Trade]:
    """Most recent real closed trade for this bot_id+direction — same
    ownership scoping routers/trades.py's own list_trades endpoint
    already applies (a non-staff learner only ever sees their OWN
    trade history for a bot_id; ADMIN/SUPER_ADMIN see all), so this
    endpoint can never surface another trader's trade data to a
    regular learner."""
    query = select(Trade).where(
        Trade.bot_id == bot_id,
        Trade.direction == TradeDirection(direction),
        Trade.status == TradeStatus.CLOSED,
        Trade.is_deleted == False,  # noqa: E712
        Trade.entry_timestamp.isnot(None),
        Trade.exit_timestamp.isnot(None),
    )
    if user.role not in _STAFF_ROLES:
        query = query.where(Trade.user_id == user.id)
    query = query.order_by(Trade.exit_timestamp.desc()).limit(1)
    return (await db.execute(query)).scalar_one_or_none()


def _to_base_index(ts: datetime, base_timestamps: List[datetime]) -> int:
    """Maps a detector result's own real timestamp (which may come
    from a COARSER required timeframe than the base/display one) onto
    the base-timeframe bar index CandleChart actually renders against
    — the most recent base bar at or before that timestamp, clipped
    into range."""
    j = bisect.bisect_right(base_timestamps, ts) - 1
    return max(0, min(j, len(base_timestamps) - 1))


async def compute_bot_simulation(
    db: AsyncSession, bot: BotConfig, direction: str, symbol: Optional[str], user: User,
) -> Dict:
    """Returns a dict shaped for frontend animation (bars + zones +
    markers, each zone/marker tagged with `reveal_bar_index` — the
    step at which the real detector first produced it, no-lookahead)
    or {"error": ...} for a real, explainable data gap — never raises
    for a data problem, same convention as trade_forensics.py's own
    compute_trade_forensics."""
    strategy_key = bot.strategy_key if bot.strategy_key in STRATEGY_FAMILY else None
    if strategy_key is None:
        return {"error": f"bot_id={bot.bot_id!r} has no recognized strategy_key ({bot.strategy_key!r}) — simulation only covers a known SMC strategy family."}

    _bot_class, required = STRATEGY_FAMILY[strategy_key]
    required_tf_labels = [label for _, label in required]
    base_tf = _finest_timeframe(required_tf_labels)
    bar_seconds = _BAR_SECONDS[base_tf]

    trade = await _find_real_trade(db, bot.bot_id, direction, user)

    if trade is not None:
        resolved_symbol = symbol or trade.symbol
        start_date = trade.entry_timestamp - timedelta(seconds=bar_seconds * _LOOKBACK_BARS)
        end_date = trade.exit_timestamp + timedelta(seconds=bar_seconds * _TRAIL_BARS)
        source = "real_trade"
        matched_trade_id = trade.trade_id
        label = (
            f"Real {trade.direction.value} {trade.symbol} trade this bot actually placed "
            f"(trade_id={trade.trade_id}) — candles and every zone/marker below are re-derived "
            f"from real historical exchange data, not fabricated."
        )
    else:
        resolved_symbol = symbol or (bot.symbols[0] if bot.symbols else None)
        if not resolved_symbol:
            return {"error": f"bot_id={bot.bot_id!r} has no symbol configured and none was requested — cannot fetch real candles."}
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(seconds=bar_seconds * _FALLBACK_BARS)
        source = "real_market_fallback"
        matched_trade_id = None
        label = (
            f"No real closed {direction} trade found yet for this bot — showing real, RECENT "
            f"{resolved_symbol} market data instead (not a fabricated price sequence, and not "
            f"guaranteed to contain a clean example of this bot's setup)."
        )

    exchange = bot.exchange or "bingx"
    timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
        shared_ingestion, exchange, resolved_symbol, required_tf_labels, start_date, end_date,
    )
    if fetch_error:
        return {"error": fetch_error}

    base_candles = [c for c in timeframe_candles[base_tf] if start_date <= c.timestamp <= end_date]
    if len(base_candles) < 15:
        return {"error": f"Only {len(base_candles)} real {base_tf} candles available in this window — not enough to animate a simulation."}

    base_timestamps = [c.timestamp for c in base_candles]
    tf_timestamps = {tf: [c.timestamp for c in timeframe_candles.get(tf, [])] for tf in required_tf_labels}

    zones, markers = await asyncio.get_event_loop().run_in_executor(
        None, _run_detectors_sync, strategy_key, required_tf_labels, base_candles, base_timestamps, timeframe_candles, tf_timestamps,
    )

    return {
        "bot_id": bot.bot_id, "strategy_key": strategy_key, "symbol": resolved_symbol, "exchange": exchange,
        "direction": direction, "base_timeframe": base_tf, "required_timeframes": required_tf_labels,
        "source": source, "matched_trade_id": matched_trade_id, "is_synthetic": False, "label": label,
        "bars": [
            {"timestamp": c.timestamp.isoformat(), "open": c.open, "high": c.high, "low": c.low, "close": c.close}
            for c in base_candles
        ],
        "zones": zones,
        "markers": markers,
    }


def _run_detectors_sync(
    strategy_key: str, required_tf_labels: List[str], base_candles: List[Candle], base_timestamps: List[datetime],
    timeframe_candles: Dict[str, List[Candle]], tf_timestamps: Dict[str, List[datetime]],
) -> tuple[List[Dict], List[Dict]]:
    """The actual CPU-bound work of compute_bot_simulation above: re-runs
    every real SMC detector bar by bar, on an ever-growing candle slice
    per timeframe, for every bar in the window (confirmed O(bars x
    timeframes) real detector calls -- this is the loop that blew up
    chart rendering before the recency-based label fix in
    BotSimulationPlayer.tsx; the compute itself was always this heavy,
    it just wasn't visible until that many results could all reach the
    frontend). Pulled into its own plain synchronous function and run
    via run_in_executor by the caller, rather than inline in the async
    route handler -- the same event-loop-blocking bug as market_scanner.
    py's own run_all call (see that fix's comment), except this one sits
    directly on a live, user-facing GET request (and became a lot more
    frequently hit once BotSimulationsPage made it one click from the
    Learn hub)."""
    bounds = TUNABLE_PARAM_BOUNDS.get(strategy_key, {})
    left_bars = int(bounds.get("left_bars", (2, 10, 3))[2])
    right_bars = int(bounds.get("right_bars", (2, 10, 3))[2])
    structure_detector = MarketStructureDetector(left_bars=left_bars, right_bars=right_bars)
    zone_detector = ZoneDetector()
    fvg_detector = FVGDetector()
    liq_detector = LiquidityDetector()

    seen: Dict[str, Dict[str, set]] = {
        tf: {"swing": set(), "bos": set(), "choch": set(), "sweep": set(), "pd": set()} for tf in required_tf_labels
    }
    # Order blocks / FVGs are long-lived and their own status/mitigation
    # can change on a later step — tracked by id so the final emitted
    # entry reflects the LATEST truncation's state, while
    # `reveal_bar_index` stays pinned to the step it was FIRST detected
    # on (no-lookahead reveal timing).
    ob_by_id: Dict[str, Dict] = {}
    fvg_by_id: Dict[str, Dict] = {}
    markers: List[Dict] = []

    for i, bar in enumerate(base_candles):
        now_ts = bar.timestamp
        for tf in required_tf_labels:
            idx = bisect.bisect_right(tf_timestamps[tf], now_ts)
            candles: List[Candle] = timeframe_candles[tf][:idx]
            if len(candles) < 10:
                continue

            swings = structure_detector.detect_swing_highs(candles) + structure_detector.detect_swing_lows(candles)
            sig_swings = structure_detector.filter_significant_swings(swings)
            bos = structure_detector.detect_bos(candles, sig_swings)
            choch = structure_detector.detect_choch(candles, sig_swings)
            obs = zone_detector.detect_order_blocks(candles, swings)
            fvgs = fvg_detector.detect_fvg(candles[-20:])
            pools = liq_detector.detect_equal_highs_lows(candles)
            sweeps = liq_detector.detect_liquidity_sweeps(pools, candles[-10:])

            swing_high = max((s.price for s in swings), default=None)
            swing_low = min((s.price for s in swings), default=None)
            active_obs = [z for z in obs if z.status == MitigationStatus.ACTIVE]
            if swing_high is not None and swing_low is not None and active_obs:
                zone_detector.classify_premium_discount(active_obs, swing_high, swing_low)

            for s in swings:
                key = (round(s.price, 8), s.structure_type.name, s.timestamp.isoformat())
                if key in seen[tf]["swing"]:
                    continue
                seen[tf]["swing"].add(key)
                is_high = "HIGH" in s.structure_type.name
                markers.append({
                    "kind": "swing", "timeframe": tf, "index": _to_base_index(s.timestamp, base_timestamps),
                    "price": s.price, "label": f"{tf} {'Swing High' if is_high else 'Swing Low'}",
                    "color": _COLOR_BLUE, "shape": "dot", "side": "above" if is_high else "below",
                    "reveal_bar_index": i,
                })

            for b in bos:
                key = (b["type"], b["timestamp"].isoformat(), b.get("structure_level"))
                if key in seen[tf]["bos"]:
                    continue
                seen[tf]["bos"].add(key)
                bullish = b["type"].startswith("bullish")
                markers.append({
                    "kind": "bos", "timeframe": tf, "index": _to_base_index(b["timestamp"], base_timestamps),
                    "price": b["trigger_price"], "label": f"{tf} BOS ({'bullish' if bullish else 'bearish'})",
                    "color": _COLOR_BULLISH if bullish else _COLOR_BEARISH,
                    "shape": "triangle-up" if bullish else "triangle-down", "side": "below" if bullish else "above",
                    "reveal_bar_index": i,
                })

            for c in choch:
                key = (c["type"], c["timestamp"].isoformat(), c.get("structure_level"))
                if key in seen[tf]["choch"]:
                    continue
                seen[tf]["choch"].add(key)
                bullish = c["type"].startswith("bullish")
                markers.append({
                    "kind": "choch", "timeframe": tf, "index": _to_base_index(c["timestamp"], base_timestamps),
                    "price": c["trigger_price"], "label": f"{tf} CHoCH ({'bullish' if bullish else 'bearish'})",
                    "color": _COLOR_AMBER, "shape": "diamond", "side": "below" if bullish else "above",
                    "reveal_bar_index": i,
                })

            for sw in sweeps:
                key = (sw["pool_id"], sw["type"], sw["timestamp"].isoformat())
                if key in seen[tf]["sweep"]:
                    continue
                seen[tf]["sweep"].add(key)
                buy_side = sw["type"] == "buy_side_sweep"
                markers.append({
                    "kind": "sweep", "timeframe": tf, "index": _to_base_index(sw["timestamp"], base_timestamps),
                    "price": sw["sweep_price"], "label": f"{tf} Liquidity sweep ({sw['type']})",
                    "color": _COLOR_AMBER, "shape": "diamond", "side": "below" if buy_side else "above",
                    "reveal_bar_index": i,
                })

            for z in obs:
                bullish = z.id.startswith("ob_bull_")
                entry = ob_by_id.get(z.id)
                if entry is None:
                    entry = {
                        "kind": "order_block", "timeframe": tf, "direction": "bullish" if bullish else "bearish",
                        "top": z.top, "bottom": z.bottom,
                        "from_index": _to_base_index(z.origin_timestamp, base_timestamps),
                        "to_index": len(base_candles) - 1,
                        "color": _COLOR_BULLISH if bullish else _COLOR_BEARISH,
                        "reveal_bar_index": i,
                    }
                    ob_by_id[z.id] = entry
                entry["status"] = z.status.name
                entry["classification"] = z.classification
                entry["label"] = (
                    f"{tf} {'Bullish' if bullish else 'Bearish'} OB"
                    + (f" — {z.classification}" if z.classification else "")
                )
                if z.classification:
                    pd_key = (z.id, z.classification)
                    if pd_key not in seen[tf]["pd"]:
                        seen[tf]["pd"].add(pd_key)
                        markers.append({
                            "kind": "premium_discount", "timeframe": tf,
                            "index": _to_base_index(z.origin_timestamp, base_timestamps),
                            "price": (z.top + z.bottom) / 2, "label": f"{tf} {z.classification.title()} zone",
                            "color": _COLOR_AMBER if z.classification == "premium" else _COLOR_BULLISH if z.classification == "discount" else _COLOR_BLUE,
                            "shape": "dot", "side": "above", "reveal_bar_index": i,
                        })

            for f in fvgs:
                bullish = f.gap_type == "bullish"
                entry = fvg_by_id.get(f.id)
                if entry is None:
                    entry = {
                        "kind": "fvg", "timeframe": tf, "direction": f.gap_type,
                        "top": f.top, "bottom": f.bottom,
                        "from_index": _to_base_index(f.candle2.timestamp, base_timestamps),
                        "to_index": len(base_candles) - 1,
                        "color": _COLOR_BULLISH if bullish else _COLOR_BEARISH,
                        "reveal_bar_index": i,
                    }
                    fvg_by_id[f.id] = entry
                entry["status"] = f.status.name
                entry["mitigated_percent"] = round(f.mitigated_percent, 3)
                entry["label"] = f"{tf} FVG ({f.gap_type}, {round(f.mitigated_percent * 100)}% filled)"

    return list(ob_by_id.values()) + list(fvg_by_id.values()), markers
