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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bot_strategies import TUNABLE_PARAM_BOUNDS
from app.core.smc_algorithms import FVGDetector, LiquidityDetector, MarketStructureDetector, ZoneDetector, compute_htf_bias
from app.engines.strategy_adapter import STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles
from app.models.bot import BotConfig
from app.models.trade import ExitType, Trade, TradeDirection
from app.services.data_ingestion import shared_ingestion

# Real lookback before entry so swing/structure detection has genuine
# context, not a cold start — same reasoning
# fetch_required_timeframe_candles' own per-timeframe padding already
# uses for a backtest's own start_date, applied here around the
# trade's real entry_timestamp instead.
_FORENSICS_LOOKBACK_DAYS = 40


async def _resolve_strategy_key(db: AsyncSession, bot_id: Optional[str]) -> Optional[str]:
    """DISPATCH identity (which strategy class/required timeframes to
    replay), not reporting identity — these are different concerns
    (see trading_audit_engine._bot_family's own comment for the
    reporting-side version of this same lesson). The real source of
    truth is BotConfig.strategy_key, exactly what BotOrchestrator/
    market_scanner.py itself dispatches by ("this is what run_all
    actually dispatches by, not a derived guess from the bot_id
    string" — BotConfig.strategy_key's own comment, models/bot.py).

    A derived guess from the bot_id's own naming convention is WRONG
    whenever a bot's strategy_key doesn't match its own bot_id prefix
    — a real, confirmed case: Bot 12 (bot_id prefix "bot_12") reuses
    Bot 2's strategy class via strategy_key="bot_2" on its own
    BotConfig row (a trade-MANAGEMENT A/B test, not a new signal
    strategy — see seed_ab_test_bots.py), so "bot_12" was never added
    to STRATEGY_FAMILY/BOT_REGISTRY at all. The old naming-guess
    version of this function returned None for every real bot_12
    trade, silently refusing forensics for an entire bot. Falls back
    to the naming-convention guess only when the DB row is missing or
    its strategy_key is NULL (the known, harmless bot_6_smc_v2 rows —
    same fallback order market_scanner.py's own resolution already
    uses: `bot.strategy_key or "_".join(bot.bot_id.split("_")[:2])`)."""
    if not bot_id or bot_id.startswith("manual"):
        return None
    bot_config = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
    candidate = (bot_config.strategy_key if bot_config else None) or "_".join(bot_id.split("_")[:2])
    return candidate if candidate in STRATEGY_FAMILY else None


async def compute_trade_forensics(db: AsyncSession, trade: Trade) -> Dict:
    """Real, on-demand per-trade SMC forensic reconstruction. Returns
    an error dict (never raises) for a trade this can't cover — a
    manual trade (no strategy to replay), one with no entry_timestamp
    yet, or a real data-fetch gap — so a caller can show that plainly
    instead of a stack trace."""
    if not trade.entry_timestamp:
        return {"error": "This trade has no entry timestamp yet — nothing to reconstruct."}

    strategy_key = await _resolve_strategy_key(db, trade.bot_id)
    if strategy_key is None:
        return {"error": f"No recognized bot strategy for bot_id={trade.bot_id!r} — forensic reconstruction only covers bot-placed trades with a known strategy family."}

    exchange = (trade.broker_name or "bingx").lower()
    _bot_class, required = STRATEGY_FAMILY[strategy_key]
    required_tf_labels = [label for _, label in required]
    # Always reconstruct 4H and 1D structure too, even for a bot whose
    # own strategy never reads them — by direct request ("include 4H
    # / 1D timeframe for all forensic charts irrespective of strategy
    # - it will be good to observe the HTF bias"). A bot like Bot 3/6/
    # 7/8 (1H/15M/5M only) would otherwise never get real higher-
    # timeframe context on this chart at all. Only affects which
    # timeframes get a structure reconstruction and the HTF-bias read
    # below (now always the real daily trend, dropping "1D" in) —
    # base_tf (price-path precision, right below) deliberately keeps
    # using the bot's own REAL required_tf_labels, unaffected by this
    # addition, since that's about replaying this trade's own actual
    # execution granularity, not giving it extra context.
    display_tf_labels = list(dict.fromkeys(required_tf_labels + ["4H", "1D"]))

    entry_ts = trade.entry_timestamp
    # One bar past entry so the entry candle itself is included — same
    # "+5min" convention used elsewhere this session to confirm a real
    # signal replay lines up with its own real timestamp.
    structure_end = entry_ts + timedelta(minutes=5)
    fetch_start = structure_end - timedelta(days=_FORENSICS_LOOKBACK_DAYS)

    timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
        shared_ingestion, exchange, trade.symbol, display_tf_labels, fetch_start, structure_end,
    )
    if fetch_error:
        return {"error": fetch_error}

    # Also always reconstruct 15M and 5M — by direct request ("ADD 15M
    # and 5M to all forensic charts"), same "irrespective of strategy"
    # precedent as 4H/1D above. Fetched in a SEPARATE, best-effort call
    # rather than folded into display_tf_labels above: unlike 4H/1D,
    # 5M (and sometimes 15M) candles have a real, much shorter exchange
    # retention window (the ~35-day BingX 5M retention limit already
    # found and worked around earlier this session for backtesting) —
    # fetch_required_timeframe_candles fails its ENTIRE call if even
    # ONE requested timeframe has no candles in-window, so a trade
    # whose entry is older than that retention window would otherwise
    # take down 1D/4H/1H structure too for a problem specific to 5M.
    # A missing/partial fine-timeframe here degrades gracefully to its
    # own "too few real candles" note below instead.
    fine_extra_labels = [l for l in ("15M", "5M") if l not in display_tf_labels]
    if fine_extra_labels:
        # fetch_required_timeframe_candles returns whatever it DID
        # fetch even on error (see its own docstring/implementation) —
        # merge that partial dict in regardless, so one fine timeframe
        # failing (e.g. 5M past retention) doesn't also discard the
        # other one that may have succeeded (e.g. 15M). Any label still
        # missing/empty falls through to the existing per-label "too
        # few real candles" note below via timeframe_candles.get(...).
        fine_candles, _fine_fetch_error = await fetch_required_timeframe_candles(
            shared_ingestion, exchange, trade.symbol, fine_extra_labels, fetch_start, structure_end,
        )
        timeframe_candles.update(fine_candles)
        display_tf_labels = display_tf_labels + fine_extra_labels

    bounds = TUNABLE_PARAM_BOUNDS.get(strategy_key, {})
    left_bars = int(bounds.get("left_bars", (2, 10, 3))[2])
    right_bars = int(bounds.get("right_bars", (2, 10, 3))[2])
    structure_detector = MarketStructureDetector(left_bars=left_bars, right_bars=right_bars)
    zone_detector = ZoneDetector()
    fvg_detector = FVGDetector()
    liq_detector = LiquidityDetector()

    structure: Dict[str, Dict] = {}
    for label in display_tf_labels:
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
                    # Real formation timestamp (Zone.origin_timestamp) —
                    # so a caller charting this can anchor the zone to
                    # the actual candle it formed on instead of
                    # guessing an index.
                    "formed_at": z.origin_timestamp.isoformat() if z.origin_timestamp else None,
                }
                for z in active_obs[-5:]
            ],
            "fvgs": [
                {
                    "top": f.top, "bottom": f.bottom, "gap_type": f.gap_type, "status": f.status.name,
                    "mitigated_percent": round(f.mitigated_percent, 3),
                    # candle2 is the real displacement candle the gap
                    # forms around (see FVGDetector.detect_fvg's own
                    # 3-candle mapping) — the natural chart anchor.
                    "formed_at": f.candle2.timestamp.isoformat() if f.candle2 else None,
                }
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

    # Coarsest DISPLAYED timeframe's own swing trend = the real HTF
    # bias at entry time, via the shared compute_htf_bias
    # (smc_algorithms.py) — the same real "last 2 highs/2 lows" rule
    # MacroSwingStructureBot's own bullish_trend/bearish_trend check
    # uses, and now also what Bot 13's own HTF-alignment gate calls,
    # so this reconstruction and that live gate can never drift into
    # two independently-maintained copies of the same formula (the
    # exact anti-pattern found and fixed repeatedly elsewhere in this
    # codebase). Uses display_tf_labels (always includes "1D"), not
    # the bot's own required_tf_labels, so HTF bias now always
    # reflects the real daily trend rather than whatever the bot's own
    # narrowest "highest" timeframe happens to be (e.g. 1H for Bot
    # 3/6/7/8).
    htf_label = min(display_tf_labels, key=lambda l: TF_ORDER.index(l))
    htf_candles = [c for c in timeframe_candles.get(htf_label, []) if c.timestamp <= entry_ts]
    htf_bias = compute_htf_bias(htf_candles, left_bars, right_bars) if len(htf_candles) >= 10 else "unclear"

    # Real price path between entry and exit — base timeframe only, the
    # one every bot actually enters/exits trades against. This is a
    # SEPARATE fetch from the structure one above: structure
    # deliberately stops at entry (no lookahead, so it reflects what
    # the bot itself could see), but the price path needs real candles
    # AFTER entry through exit — reusing the structure fetch (which
    # ends 5 minutes past entry) would silently truncate the path for
    # any trade open longer than 5 minutes, which is effectively every
    # trade.
    # FINEST required timeframe (max TF_ORDER index, e.g. 15M/5M over
    # 4H/1D) — the one closest to actual execution granularity. This
    # was previously computed with the same `min(...)` formula as
    # htf_label above, which actually picks the COARSEST timeframe —
    # wrong for this use: it meant MFE/MAE got computed off much
    # coarser candles than the trade's own real execution/exit
    # precision, understating adverse/favorable excursion.
    base_tf = max(required_tf_labels, key=lambda l: TF_ORDER.index(l))
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
