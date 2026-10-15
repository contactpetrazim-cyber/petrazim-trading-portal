"""
Trade Forensics — Part 10 of the master audit prompt ("TradingView and
Historical Chart Analysis"), done with this platform's own real
historical exchange data instead of an external chart service: there
is no credential-less TradingView API available here, and the real
broker/exchange's own candle feed already IS the primary source Part
10 itself calls for ("internal broker/exchange records remain the
primary source for actual fills/outcomes" — this never assumes a
TradingView chart matches the executing broker's exact feed, because
it never touches TradingView at all).

compute_trade_forensics(trade) re-derives, from REAL candles fetched
fresh around the trade's own real entry_timestamp (no lookahead —
every detector call is truncated to "closed bars at or before entry",
the same no-lookahead discipline the backtest engine itself enforces),
the real SMC structural picture that was actually in play: swing
points, BOS/CHoCH events, order blocks, FVGs, liquidity sweeps — one
call per required timeframe for that trade's own bot family
(STRATEGY_FAMILY), using the SAME primitive detector classes
(MarketStructureDetector, ZoneDetector, FVGDetector, LiquidityDetector)
every bot already uses, not a separate reimplementation.

Deliberately generic/bot-agnostic: this reconstructs the real SMC
CONCEPTS present (what Part 10.2/10.3 actually asks for — "swing
points, liquidity levels, BOS/CHoCH/MSS, displacement, FVG/OB zones"),
not a trace of one specific bot's own internal gating sequence (that's
Stage 8/Part 11.3's job, already covered in the Bot Optimization
Matrix's own per-bot mechanics).

Also computes the real price path between entry and exit (MFE/MAE in
R, whether each configured TP level was actually reached) from real
candles. On demand, per trade — the same "fetch live on each view, a
past window never changes" philosophy routers/trades.py's own
trade_snapshot endpoint already uses, not a batch precompute job: with
169 real trades and real exchange rate limits, computing this for
every trade up front isn't the right shape for this feature; it's
callable per trade_id exactly when someone is looking at that trade.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional

from app.core.bot_strategies import TUNABLE_PARAM_BOUNDS
from app.core.smc_algorithms import FVGDetector, LiquidityDetector, MarketStructureDetector, ZoneDetector
from app.engines.strategy_adapter import STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles
from app.models.trade import ExitType, Trade, TradeDirection
from app.services.data_ingestion import shared_ingestion

# Real lookback before entry so swing/structure detection has genuine
# context, not a cold start — same reasoning
# fetch_required_timeframe_candles' own per-timeframe padding already
# uses for a backtest's own start_date, applied here around the
# trade's real entry_timestamp instead.
_FORENSICS_LOOKBACK_DAYS = 40


def _resolve_strategy_key(bot_id: Optional[str]) -> Optional[str]:
    if not bot_id or bot_id.startswith("manual"):
        return None
    candidate = "_".join(bot_id.split("_")[:2])
    return candidate if candidate in STRATEGY_FAMILY else None


async def compute_trade_forensics(trade: Trade) -> Dict:
    """Real, on-demand per-trade SMC forensic reconstruction. Returns
    an error dict (never raises) for a trade this can't cover — a
    manual trade (no strategy to replay), one with no entry_timestamp
    yet, or a real data-fetch gap — so a caller can show that plainly
    instead of a stack trace."""
    if not trade.entry_timestamp:
        return {"error": "This trade has no entry timestamp yet — nothing to reconstruct."}

    strategy_key = _resolve_strategy_key(trade.bot_id)
    if strategy_key is None:
        return {"error": f"No recognized bot strategy for bot_id={trade.bot_id!r} — forensic reconstruction only covers bot-placed trades with a known strategy family."}

    exchange = (trade.broker_name or "bingx").lower()
    _bot_class, required = STRATEGY_FAMILY[strategy_key]
    required_tf_labels = [label for _, label in required]

    entry_ts = trade.entry_timestamp
    # One bar past entry so the entry candle itself is included — same
    # "+5min" convention used elsewhere this session to confirm a real
    # signal replay lines up with its own real timestamp.
    structure_end = entry_ts + timedelta(minutes=5)
    fetch_start = structure_end - timedelta(days=_FORENSICS_LOOKBACK_DAYS)

    timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
        shared_ingestion, exchange, trade.symbol, required_tf_labels, fetch_start, structure_end,
    )
    if fetch_error:
        return {"error": fetch_error}

    bounds = TUNABLE_PARAM_BOUNDS.get(strategy_key, {})
    left_bars = int(bounds.get("left_bars", (2, 10, 3))[2])
    right_bars = int(bounds.get("right_bars", (2, 10, 3))[2])
    structure_detector = MarketStructureDetector(left_bars=left_bars, right_bars=right_bars)
    zone_detector = ZoneDetector()
    fvg_detector = FVGDetector()
    liq_detector = LiquidityDetector()

    structure: Dict[str, Dict] = {}
    for label in required_tf_labels:
        candles = [c for c in timeframe_candles.get(label, []) if c.timestamp <= entry_ts]
        if len(candles) < 10:
            structure[label] = {"note": f"Too few real candles ({len(candles)}) before entry for meaningful detection."}
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
        active_obs = [z for z in obs if z.status.name == "ACTIVE"]
        if swing_high is not None and swing_low is not None and active_obs:
            zone_detector.classify_premium_discount(active_obs, swing_high, swing_low)

        structure[label] = {
            "candles_considered": len(candles),
            "swing_points": [
                {"price": s.price, "type": s.structure_type.name, "timestamp": s.timestamp.isoformat()}
                for s in sorted(swings, key=lambda s: s.timestamp)[-10:]
            ],
            "bos_events": [
                {"type": b["type"], "timestamp": b["timestamp"].isoformat(), "structure_level": b.get("structure_level")}
                for b in bos[-5:]
            ],
            "choch_events": [
                {"type": c["type"], "timestamp": c["timestamp"].isoformat(), "structure_level": c.get("structure_level")}
                for c in choch[-5:]
            ],
            "order_blocks": [
                {
                    "top": z.top, "bottom": z.bottom, "status": z.status.name, "test_count": z.test_count,
                    "classification": getattr(z, "classification", None),
                }
                for z in active_obs[-5:]
            ],
            "fvgs": [
                {"top": f.top, "bottom": f.bottom, "gap_type": f.gap_type, "status": f.status.name, "mitigated_percent": round(f.mitigated_percent, 3)}
                for f in fvgs if f.status.name == "ACTIVE"
            ][-5:],
            "liquidity_sweeps": [
                {
                    "timestamp": s["timestamp"].isoformat() if hasattr(s["timestamp"], "isoformat") else s["timestamp"],
                    "type": s["type"], "sweep_price": s["sweep_price"],
                }
                for s in sweeps
            ],
        }

    # Coarsest required timeframe's own swing trend = the real HTF bias
    # at entry time — same "last 2 highs/2 lows" trend read every
    # bot's own early direction step already uses (e.g.
    # MacroSwingStructureBot's bullish_trend/bearish_trend check, read
    # directly from source), applied here generically.
    htf_label = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))
    htf_bias = "unclear"
    htf_swings = structure.get(htf_label, {}).get("swing_points", [])
    highs = [s for s in htf_swings if s["type"] == "SWING_HIGH"]
    lows = [s for s in htf_swings if s["type"] == "SWING_LOW"]
    if len(highs) >= 2 and len(lows) >= 2:
        if highs[-1]["price"] > highs[-2]["price"] and lows[-1]["price"] > lows[-2]["price"]:
            htf_bias = "bullish"
        elif highs[-1]["price"] < highs[-2]["price"] and lows[-1]["price"] < lows[-2]["price"]:
            htf_bias = "bearish"

    # Real price path between entry and exit — base timeframe only, the
    # one every bot actually enters/exits trades against. This is a
    # SEPARATE fetch from the structure one above: structure
    # deliberately stops at entry (no lookahead, so it reflects what
    # the bot itself could see), but the price path needs real candles
    # AFTER entry through exit — reusing the structure fetch (which
    # ends 5 minutes past entry) would silently truncate the path for
    # any trade open longer than 5 minutes, which is effectively every
    # trade.
    base_tf = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))
    exit_ts = trade.exit_timestamp
    path_end = (exit_ts + timedelta(hours=6)) if exit_ts else datetime.utcnow()
    path_fetch, path_fetch_error = await fetch_required_timeframe_candles(
        shared_ingestion, exchange, trade.symbol, [base_tf], entry_ts, path_end,
    )
    path_candles = [] if path_fetch_error else [
        c for c in path_fetch.get(base_tf, []) if entry_ts <= c.timestamp <= path_end
    ]
    # Real in-trade action (what actually happened while the position
    # was open) vs. the 6-hour-past-exit window (only used to answer
    # "would TP have been hit anyway had the SL not closed it" —
    # target feasibility, not something that happened "before/at
    # exit"). Blending the two would let post-exit market movement
    # inflate MFE/MAE past what the live position could have realized.
    in_trade_candles = [c for c in path_candles if not exit_ts or c.timestamp <= exit_ts]
    post_exit_candles = [c for c in path_candles if exit_ts and c.timestamp > exit_ts]

    is_long = trade.direction == TradeDirection.LONG
    sl_for_r = trade.initial_stop_loss if trade.initial_stop_loss is not None else trade.stop_loss
    sl_distance = abs(trade.entry_price - sl_for_r) if (trade.entry_price and sl_for_r) else None
    tp1 = trade.initial_take_profit_1 if trade.initial_take_profit_1 is not None else trade.take_profit_1

    mfe_r = mae_r = None
    reached = {"tp1": False, "tp2": False, "tp3": False}
    would_have_reached = {"tp1": False, "tp2": False, "tp3": False}
    if sl_distance and sl_distance > 0 and in_trade_candles:
        if is_long:
            best = max(c.high for c in in_trade_candles)
            worst = min(c.low for c in in_trade_candles)
            mfe_r = round((best - trade.entry_price) / sl_distance, 3)
            mae_r = round((trade.entry_price - worst) / sl_distance, 3)
        else:
            best = min(c.low for c in in_trade_candles)
            worst = max(c.high for c in in_trade_candles)
            mfe_r = round((trade.entry_price - best) / sl_distance, 3)
            mae_r = round((worst - trade.entry_price) / sl_distance, 3)
        for level, price in [("tp1", tp1), ("tp2", trade.take_profit_2), ("tp3", trade.take_profit_3)]:
            if price is None:
                continue
            reached[level] = any(c.high >= price for c in in_trade_candles) if is_long else any(c.low <= price for c in in_trade_candles)
            if not reached[level] and post_exit_candles:
                would_have_reached[level] = any(c.high >= price for c in post_exit_candles) if is_long else any(c.low <= price for c in post_exit_candles)

    exit_type = trade.exit_type.value if trade.exit_type else None
    sl_hit_before_tp = (trade.exit_type == ExitType.STOP_LOSS) if trade.exit_type else None

    outcome = "unresolved"
    if trade.realized_pnl is not None:
        outcome = "win" if trade.realized_pnl > 0 else ("loss" if trade.realized_pnl < 0 else "breakeven")

    narrative_parts = [
        f"{trade.direction.value.upper()} {trade.symbol} via {trade.bot_id}.",
        f"HTF bias at entry ({htf_label}): {htf_bias}.",
        f"Outcome: {outcome} (exit_type={exit_type}, r_multiple={trade.r_multiple}).",
    ]
    if mfe_r is not None:
        narrative_parts.append(
            f"Real price path: reached {mfe_r:.2f}R favorable and {mae_r:.2f}R adverse before/at exit. "
            f"TP1 {'reached' if reached['tp1'] else 'not reached'}, "
            f"TP2 {'reached' if reached['tp2'] else 'not reached'}, "
            f"TP3 {'reached' if reached['tp3'] else 'not reached'}."
        )
    if outcome == "loss" and mfe_r is not None and mfe_r > 0:
        narrative_parts.append(f"This loss DID move {mfe_r:.2f}R favorable at some point before reversing — a real, not immediate, invalidation.")
    missed_but_feasible = [lvl.upper() for lvl, hit in would_have_reached.items() if hit]
    if missed_but_feasible:
        narrative_parts.append(
            f"Target feasibility: {', '.join(missed_but_feasible)} would have been reached within 6h after exit had the stop not closed the trade first."
        )

    price_path = {"mfe_r": mfe_r, "mae_r": mae_r, "reached": reached, "would_have_reached_post_exit": would_have_reached}
    if path_fetch_error:
        price_path["note"] = f"Price path unavailable: {path_fetch_error}"

    return {
        "trade_id": trade.trade_id, "bot_id": trade.bot_id, "strategy_key": strategy_key,
        "symbol": trade.symbol, "direction": trade.direction.value,
        "entry_timestamp": entry_ts.isoformat(), "exit_timestamp": exit_ts.isoformat() if exit_ts else None,
        "entry_price": trade.entry_price, "stop_loss": sl_for_r, "take_profit_1": tp1,
        "exit_price": trade.exit_price, "exit_type": exit_type, "outcome": outcome,
        "r_multiple": trade.r_multiple, "sl_hit_before_tp": sl_hit_before_tp,
        "htf_bias": htf_bias, "htf_timeframe": htf_label,
        "structure": structure,
        "price_path": price_path,
        "narrative": " ".join(narrative_parts),
    }
