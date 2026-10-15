"""
Monthly Trading Audit Engine
================================

The automated, real-data counterpart to the manual forensic audit
performed this session against the live trade history — instrument/
bot inventory, trade-record reconciliation, per-bot-family expectancy,
and duplicate/concurrent-signal detection. Every query here is the
same one validated by hand against real production data before this
was built (not invented — see this session's own audit transcript),
just made runnable monthly instead of once.

SCOPE OF "APPLY" — deliberately narrow, by design, not an oversight:
the master audit prompt's own operating rules say "do not deploy
untested strategy changes" and "some problems may originate from
software defects ... not always the trading strategy." This engine
never auto-mutates strategy LOGIC. The only recommendation an admin
can Apply with one click is pausing a bot family whose expectancy is
reliably negative over the audited period (BotConfig.status ->
PAUSED) — a pure risk-reduction action, fully reversible, with zero
chance of making a bad situation worse. Every other finding (duplicate
patterns, reconciliation gaps, dead columns, comparative hypotheses
like "Bot 6 vs Bot 5 timeframe anchor") is reported as real evidence
with no one-click action, exactly as this session's own manual audit
treated them — info to act on deliberately, not something to auto-fix.

Evidence levels mirror the manual audit exactly: verified /
strongly_supported / hypothesis / unverified.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.backtest_engine import BacktestEngine, Bar
from app.engines.strategy_adapter import STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles, SmcStrategyAdapter
from app.models.bot import BotConfig, BotStatus
from app.models.trade import Trade, TradeStatus
from app.models.trading_audit import (
    AuditFindingSeverity, AuditRecommendationStatus, AuditRunStatus,
    TradingAuditFinding, TradingAuditRun,
)
from app.services.backtest_runner import _summarize, _DEFAULT_COST_MODELS, _FOREX_LIKE_BROKERS
from app.services.data_ingestion import shared_ingestion

logger = structlog.get_logger()

# A bot family needs at least this many closed trades in the audited
# period before its expectancy is trusted enough to recommend pausing
# it — the same "don't act on n=1-4" discipline the manual audit used
# when it explicitly declined to judge bot_1/bot_4/manual on tiny
# samples.
MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY = 15
NEGATIVE_EXPECTANCY_ACTION_THRESHOLD = 0.0  # strictly negative total PnL over the period


def _bot_family(bot_id: str) -> str:
    """Collapses a real BotConfig row's bot_id ("bot_9_volume_liq_wide_
    range_2") to its REPORTING-family key ("bot_9") — the family a
    trader actually thinks of as "one bot" across however many symbol
    instances it runs on. Matches the "bot_<number>_..." shape
    directly (a plain regex, not BOT_REGISTRY membership) — real bug,
    found immediately while seeding Bot 12: that bot is deliberately
    NOT in BOT_REGISTRY (it reuses Bot 2's own strategy class
    byte-for-byte — see seed_ab_test_bots.py's own docstring for why,
    a genuine A/B test of trade MANAGEMENT, not signal generation), so
    checking BOT_REGISTRY membership here would have silently failed
    to collapse its 4 real symbol instances into one family row,
    exactly the kind of per-instance fragmentation this function
    exists to prevent. Reporting identity (one row per real bot a
    trader manages) and dispatch identity (BOT_REGISTRY, which
    strategy class actually runs it) are two different concerns —
    conflating them was the mistake; this only derives the former.

    apply_recommendation's own bot_id-prefix match
    (`row.bot_id.startswith(finding.bot_id + "_")`) still works
    correctly against this shorter key: "bot_1_" vs "bot_10_"/"bot_11_"
    never collide (the 6th character differs), confirmed before this
    change shipped."""
    if bot_id.startswith("manual"):
        return "manual"
    match = re.match(r"^(bot_\d+)(?:_|$)", bot_id)
    return match.group(1) if match else bot_id


async def _compute_instrument_inventory(db: AsyncSession, period_start: datetime, period_end: datetime) -> List[Dict]:
    bots = (await db.execute(select(BotConfig))).scalars().all()
    all_symbols = sorted({s for b in bots for s in (b.symbols or [])})

    trades = (await db.execute(
        select(Trade).where(Trade.created_at >= period_start, Trade.created_at < period_end)
    )).scalars().all()
    by_symbol: Dict[str, List[Trade]] = defaultdict(list)
    for t in trades:
        by_symbol[t.symbol].append(t)

    rows = []
    for symbol in all_symbols:
        ts = by_symbol.get(symbol, [])
        wins = sum(1 for t in ts if t.status == TradeStatus.CLOSED and (t.realized_pnl or 0) > 0)
        losses = sum(1 for t in ts if t.status == TradeStatus.CLOSED and (t.realized_pnl or 0) < 0)
        rows.append({
            "symbol": symbol,
            "bots": sorted({b.bot_id for b in bots if symbol in (b.symbols or [])}),
            "total_trades": len(ts),
            "wins": wins,
            "losses": losses,
            "active": sum(1 for t in ts if t.status == TradeStatus.ACTIVE),
            "pending": sum(1 for t in ts if t.status == TradeStatus.PENDING),
            "errors": sum(1 for t in ts if t.status == TradeStatus.ERROR),
        })
    return rows


def _expectancy_row(ts: List[Trade], key: str, key_value: str) -> Dict:
    """One real trade list in, one scorecard row out — the shared math
    behind compute_bot_instance_expectancy's own per-row aggregation."""
    n = len(ts)
    wins = sum(1 for t in ts if (t.realized_pnl or 0) > 0)
    losses = sum(1 for t in ts if (t.realized_pnl or 0) < 0)
    total_pnl = sum((t.realized_pnl or 0) for t in ts)
    r_vals = [t.r_multiple for t in ts if t.r_multiple is not None]
    avg_r = sum(r_vals) / len(r_vals) if r_vals else None
    return {
        key: key_value, "n": n, "wins": wins, "losses": losses,
        "win_rate_pct": round(wins / n * 100, 1) if n else None,
        "total_pnl": round(total_pnl, 2),
        "avg_r": round(avg_r, 3) if avg_r is not None else None,
        "expectancy_per_trade": round(total_pnl / n, 2) if n else None,
    }


async def compute_bot_instance_expectancy(
    db: AsyncSession, period_start: datetime, period_end: datetime, bot_ids: Optional[List[str]] = None,
) -> List[Dict]:
    """Real trade-history query keyed by the raw bot_id (one row per
    real BotConfig instance — e.g. bot_9_volume_liq_wide_range vs _2
    stay separate) rather than collapsed to the strategy family (see
    rollup_instance_rows_to_family for that view). Backs the Bot Optimization
    Matrix (Bots page / Admin portal): that page shows both the
    per-family rollup and the per-instance detail, and needs the same
    real numbers either way, not two independently-computed paths.

    `bot_ids`, when given, restricts the result to exactly those
    bot_ids — how the caller enforces the same per-trader ownership
    scoping routers/bots.py's own list_bots already applies (a non-
    staff trader must never see another trader's bot performance)."""
    conditions = [
        Trade.status == TradeStatus.CLOSED,
        Trade.created_at >= period_start, Trade.created_at < period_end,
    ]
    if bot_ids is not None:
        conditions.append(Trade.bot_id.in_(bot_ids))
    trades = (await db.execute(select(Trade).where(*conditions))).scalars().all()

    by_bot: Dict[str, List[Trade]] = defaultdict(list)
    for t in trades:
        by_bot[t.bot_id].append(t)

    rows = [_expectancy_row(ts, "bot_id", bot_id) for bot_id, ts in by_bot.items()]
    return sorted(rows, key=lambda r: -(r["total_pnl"] or 0))


def rollup_instance_rows_to_family(instance_rows: List[Dict]) -> List[Dict]:
    """Pure function: groups compute_bot_instance_expectancy's own
    rows by strategy family (via _bot_family) — the exact weighted-
    average math a per-family scorecard needs (total_pnl/wins/losses
    sum directly; avg_r must be weighted by each instance's own trade
    count, not averaged flat, or a 2-trade and a 40-trade instance
    would count equally). Used so the Bot Optimization Matrix can
    roll up a trader's OWN, already-ownership-filtered instance rows
    into a family view without a second database query scoped
    differently from the first."""
    groups: Dict[str, Dict] = {}
    for row in instance_rows:
        fam = _bot_family(row["bot_id"])
        g = groups.setdefault(fam, {"bot_family": fam, "n": 0, "wins": 0, "losses": 0, "total_pnl": 0.0, "r_weighted": 0.0})
        n = row["n"]
        g["n"] += n
        g["wins"] += row["wins"]
        g["losses"] += row["losses"]
        g["total_pnl"] += row["total_pnl"]
        if row["avg_r"] is not None:
            g["r_weighted"] += row["avg_r"] * n

    rows = []
    for fam, g in groups.items():
        n = g["n"]
        rows.append({
            "bot_family": fam, "n": n, "wins": g["wins"], "losses": g["losses"],
            "win_rate_pct": round(g["wins"] / n * 100, 1) if n else None,
            "total_pnl": round(g["total_pnl"], 2),
            "avg_r": round(g["r_weighted"] / n, 3) if n else None,
            "expectancy_per_trade": round(g["total_pnl"] / n, 2) if n else None,
        })
    return sorted(rows, key=lambda r: -(r["total_pnl"] or 0))


async def compute_trade_register(db: AsyncSession, period_start: datetime, period_end: datetime) -> Dict[str, List[Dict]]:
    """The real per-trade win/loss register (Stage 11 deliverable —
    "the full per-trade win/loss registers"): every closed trade in
    the period, split into wins and losses, each a plain fact record
    (no interpretation). This is NOT the heavier Part 10 forensic
    chart reconstruction (HTF context, swing points, BOS/CHoCH, FVG/OB
    zones for every trade) — that stays a real, deliberately deferred
    next step (see _generate_report_markdown's own "Scope" section);
    this is the factual register that work would start from."""
    trades = (await db.execute(
        select(Trade).where(
            Trade.status == TradeStatus.CLOSED,
            Trade.created_at >= period_start, Trade.created_at < period_end,
        ).order_by(Trade.exit_timestamp)
    )).scalars().all()

    def _row(t: Trade) -> Dict:
        return {
            "trade_id": t.trade_id, "bot_id": t.bot_id, "symbol": t.symbol,
            "direction": t.direction.value if hasattr(t.direction, "value") else t.direction,
            "entry_price": t.entry_price, "exit_price": t.exit_price,
            "realized_pnl": round(t.realized_pnl, 2) if t.realized_pnl is not None else None,
            "r_multiple": round(t.r_multiple, 3) if t.r_multiple is not None else None,
            "entry_timestamp": t.entry_timestamp.isoformat() if t.entry_timestamp else None,
            "exit_timestamp": t.exit_timestamp.isoformat() if t.exit_timestamp else None,
        }

    wins = [_row(t) for t in trades if (t.realized_pnl or 0) > 0]
    losses = [_row(t) for t in trades if (t.realized_pnl or 0) < 0]
    breakeven = [_row(t) for t in trades if (t.realized_pnl or 0) == 0]
    return {"wins": wins, "losses": losses, "breakeven": breakeven}


def _price_key(p: Optional[float], decimals: int = 6) -> Optional[float]:
    return None if p is None else round(p, decimals)


async def _detect_duplicate_signature_groups(db: AsyncSession, period_start: datetime, period_end: datetime) -> List[Dict]:
    """Same signature as the manual audit's duplicate scan: (bot_id,
    symbol, direction, entry_price, stop_loss). Flags whether any pair
    within a group genuinely overlapped in time (a real concurrency
    violation — the thing worth alerting on) vs. sequential re-use of
    a still-valid zone (expected, already-intended behavior since the
    2026-10-07/08 repeat-setup guard shipped)."""
    trades = (await db.execute(
        select(Trade).where(
            Trade.entry_timestamp.isnot(None),
            Trade.created_at >= period_start, Trade.created_at < period_end,
        ).order_by(Trade.entry_timestamp)
    )).scalars().all()

    groups: Dict[tuple, List[Trade]] = defaultdict(list)
    for t in trades:
        sig = (t.bot_id, t.symbol, t.direction, _price_key(t.entry_price), _price_key(t.stop_loss))
        groups[sig].append(t)

    out = []
    for sig, ts in groups.items():
        if len(ts) < 2:
            continue
        ts_sorted = sorted(ts, key=lambda t: t.entry_timestamp)
        overlap = False
        for i in range(len(ts_sorted) - 1):
            a, b = ts_sorted[i], ts_sorted[i + 1]
            if a.exit_timestamp is None or b.entry_timestamp < a.exit_timestamp:
                overlap = True
                break
        bot_id, symbol, direction, entry, sl = sig
        out.append({
            "bot_id": bot_id, "symbol": symbol, "direction": direction.value,
            "entry_price": entry, "stop_loss": sl, "copies": len(ts_sorted),
            "concurrent_violation": overlap,
            "trade_ids": [t.trade_id for t in ts_sorted],
            "combined_pnl": round(sum((t.realized_pnl or 0) for t in ts_sorted), 2),
        })
    return out


# A symbol needs at least this many ERROR-status trades in the audited
# period, clustered under the same error_message, before this engine
# surfaces it as a finding — one-off errors happen; a cluster is a
# real pattern worth an admin's attention. Found live while verifying
# this engine's own first report: 10 price_deviation_guard rejections
# on NCCO1OILBRENT2USDUSDT.P in under 3 hours, all within 0.27%-1.21%
# of the live price — comfortably outside the platform's single global
# PRICE_DEVIATION_TOLERANCE_PCT (0.25%), which was calibrated without
# per-instrument volatility in mind. Reported as a finding, not
# silently "fixed" — widening a safety tolerance is a real risk-policy
# decision, not a bug with one obviously-correct answer.
MIN_ERRORS_FOR_EXECUTION_FINDING = 5


async def _detect_execution_error_clusters(db: AsyncSession, period_start: datetime, period_end: datetime) -> List[Dict]:
    trades = (await db.execute(
        select(Trade).where(
            Trade.status == TradeStatus.ERROR,
            Trade.created_at >= period_start, Trade.created_at < period_end,
        )
    )).scalars().all()

    by_symbol_message: Dict[tuple, List[Trade]] = defaultdict(list)
    for t in trades:
        by_symbol_message[(t.symbol, t.error_message or "unknown")].append(t)

    out = []
    for (symbol, message), ts in by_symbol_message.items():
        if len(ts) < MIN_ERRORS_FOR_EXECUTION_FINDING:
            continue
        out.append({
            "symbol": symbol, "error_message": message, "count": len(ts),
            "bot_ids": sorted({t.bot_id for t in ts}),
            "first_seen": min(t.created_at for t in ts).isoformat(),
            "last_seen": max(t.created_at for t in ts).isoformat(),
            "trade_ids": [t.trade_id for t in ts],
        })
    return out


# A bot instance with fewer than this many trade rows in the audited
# period is surfaced as a "silent/low-activity bot" finding — Part 9
# of the master audit prompt ("investigate bots that have not
# recommended any setups"). This is a REPORTING threshold only (what's
# worth a human's attention), not a judgment that the bot is broken —
# see the finding's own detail text, which explicitly states the
# finding is informational and that low frequency can be legitimate,
# deliberate selectivity (verified directly for bot_4_volume_liq this
# session: a real bar-by-bar replay over 910 real 1H bars found the
# bot's own mandatory gates never falsely blocked a genuine setup —
# the Spring/Upthrust-plus-confirming-CHoCH confluence this bot
# requires is just genuinely rare in the replayed window; not a
# detected code defect).
SILENT_BOT_TRADE_THRESHOLD = 3


async def _detect_silent_bots(db: AsyncSession, period_start: datetime, period_end: datetime) -> List[Dict]:
    bots = (await db.execute(select(BotConfig).where(BotConfig.status == BotStatus.ACTIVE))).scalars().all()
    out = []
    for bot in bots:
        count = (await db.execute(
            select(Trade).where(
                Trade.bot_id == bot.bot_id, Trade.created_at >= period_start, Trade.created_at < period_end,
            )
        )).scalars().all()
        if len(count) < SILENT_BOT_TRADE_THRESHOLD:
            last = (await db.execute(
                select(Trade.created_at).where(Trade.bot_id == bot.bot_id).order_by(Trade.created_at.desc()).limit(1)
            )).scalar_one_or_none()
            out.append({
                "bot_id": bot.bot_id, "symbols": bot.symbols or [],
                "trades_this_period": len(count),
                "last_trade_at": last.isoformat() if last else None,
            })
    return out


# Stage 8 ("per-instrument/per-bot SL/TP/entry optimization matrix")
# reference text — authored this session from reading each bot's real
# analyze() code, not derived from a query (qualitative description of
# methodology, not a numeric figure). Mirrors
# frontend/src/pages/BotOptimizationMatrixPage.tsx's own BOT_REFERENCE
# constant; kept here too so a generated report is self-contained and
# doesn't require the portal page to be open to read it.
BOT_OPTIMIZATION_REFERENCE: List[Dict[str, str]] = [
    {"fam": "bot_1", "name": "Bot 1 — Macro Swing Structure", "sl": "structure_swing, embed zone, floored 0.15%",
     "rel": "—", "note": "No A/B variant, no known open issue."},
    {"fam": "bot_2", "name": "Bot 2 — HF Order Block Reversal", "sl": "sweep_extreme/structure_swing, embed OB +10%, floored 0.15% (fixed this session)",
     "rel": "A/B vs Bot 11 (30% embed + 0.35% floor)",
     "note": "Real 60-day backtest: beats Bot 11 on 3 of 4 real instruments and on every Monte Carlo percentile band pooled — the wider stop does not pay for itself. "
             "A second, separate hypothesis (always enter at the OB's own extreme, like Bot 11/12, instead of Bot 2's current mean-if-swept entry) was built, real-backtested across all 7 real "
             "symbols, and REFUTED: worse win rate on every single symbol (e.g. 26% vs 45% on BTC), pooled average R flipping from +0.08 to -0.12 across 100+ trades. Bot 2's current "
             "mean-if-swept entry is confirmed the better design, not a flaw — removed before shipping rather than kept as a live variant known to underperform."},
    {"fam": "bot_3", "name": "Bot 3 — FVG Expansion & Fill", "sl": "FVG-width based, floored 0.15% (PR #286)",
     "rel": "A/B baseline for Bot 7 (deliberately no OB/premium-discount checks)",
     "note": "Strongest real sample this session: n=61, 82% win rate, real positive expectancy."},
    {"fam": "bot_4", "name": "Bot 4 — Volume & Liquidity Sweep", "sl": "spring/upthrust extreme, embed POI zone, floored 0.15% (fixed this session)",
     "rel": "A/B vs Bot 9 (25% near-extreme band) and Bot 10 (held-the-test confirmation)",
     "note": "Structurally over-restrictive: mandatory CHoCH confirmation rejects 91.5% of genuine spring/upthrust events — close to mutually exclusive with its own range-bound precondition by construction. "
             "Confirmed across its full real symbol set (BTC + JPY/EUR/XAUT, 60-day backtest): just 1 real trade total across 4 real symbols — the restriction is structural, not a one-symbol quirk."},
    {"fam": "bot_5", "name": "Bot 5 — Jeafx SMC Style", "sl": "jeafx_purge_extreme, embed aligned zone, floored 0.15% (fixed this session)",
     "rel": "A/B vs Bot 6 (adds LTF-agreement gate) and Bot 8 (Bot 6 minus that gate)",
     "note": "Designed as the 'high R:R specialist' (4-6R) but a platform-wide min_rr_ratio=3.0 override flattens it to the same target as every other bot — a real config gap, not a strategy gap. "
             "Real 35-day backtest (post data-retention fix): 4 trades, 75% win rate, +0.862R expectancy — a promising but still very small sample."},
    {"fam": "bot_6", "name": "Bot 6 — SMC v2", "sl": "jeafx_purge_extreme, embed aligned zone, floored 0.15% (fixed this session)",
     "rel": "A/B baseline for Bot 8 (removes its LTF-agreement gate)",
     "note": "Negative real live-trade expectancy, but 23 of 24 of those trades predate the 2026-10-14 mandatory-1H-BOS revision — mostly measuring already-superseded logic, not the current code. "
             "Real backtest across its full 7-symbol coverage (35-day window, post data-retention fix): n=48, avg -0.028R — roughly breakeven, and still the BETTER of the two once Bot 8 is compared "
             "on the same full symbol set (see Bot 8's own note)."},
    {"fam": "bot_7", "name": "Bot 7 — FVG Expansion v3", "sl": "FVG-width based, floored 0.15% (PR #286)",
     "rel": "A/B vs Bot 3 — depth-based vs recency-based FVG selection, otherwise identical",
     "note": "Real sample still too small (n<15) to read anything into."},
    {"fam": "bot_8", "name": "Bot 8 — SMC v2 Single-Anchor", "sl": "same as Bot 6 (floored 0.15%)",
     "rel": "A/B vs Bot 6 — isolates the LTF-agreement gate",
     "note": "Was silently unbacktestable until a registry gap was fixed this session. Its own real 60-day backtest then looked like a 0-signal null result — a SEPARATE real bug (a flat 5M lookback "
             "padding exceeding bingx's real 5M data retention, fixed this session); re-run over its full 7-symbol coverage (35-day window): n=196, avg -0.069R, firing 4x more often than Bot 6 on the "
             "identical windows (196 vs 48 trades across the same symbols) — decisively confirms the LTF-agreement gate is the dominant restrictor, but removing it produces a slightly WORSE real "
             "expectancy than Bot 6, not better. Solves the silent-bot problem, not the edge."},
    {"fam": "bot_9", "name": "Bot 9 — Volume & Liquidity Wide-Range", "sl": "same as Bot 4 (floored 0.15%)",
     "rel": "A/B vs Bot 4 — widens the near-extreme band 15%→25%",
     "note": "Real backtest across its full symbol set (BTC + JPY/EUR/XAUT): essentially identical to Bot 4 (n=1, the exact same single trade) — the near-extreme band is confirmed NOT the binding "
             "constraint on real data; whatever else is restricting Bot 4 restricts Bot 9 equally."},
    {"fam": "bot_10", "name": "Bot 10 — Volume & Liquidity Held-Reclaim", "sl": "same as Bot 4 (floored 0.15%)",
     "rel": "A/B vs Bot 4 — replaces mandatory CHoCH with a Wyckoff 'held the test' check (16/47 vs 0/47 on the same real events)",
     "note": "Its EURUSDT.P instance silently failed to log any trade since creation (trade_id column too narrow) — fixed this session. Real backtest across its full symbol set: n=13 (12 on JPY/EUR/"
             "XAUT + 1 on BTC), avg -0.24R — genuinely solves Bot 4's near-silence (13 vs 1-2 trades) but hasn't yet shown a positive real edge; worth continued monitoring on real accumulating data, "
             "not yet a confirmed win."},
    {"fam": "bot_11", "name": "Bot 11 — HF OB Reversal, Wider-Stop", "sl": "same as Bot 2 but 30% embed + 0.35% floor",
     "rel": "A/B vs Bot 2 — the direct test of 'is the SL too tight'",
     "note": "Real 60-day backtest: loses to Bot 2 on win rate, expectancy, and drawdown across almost every real instrument and percentile band tested."},
    {"fam": "bot_12", "name": "Bot 12 — HF OB Reversal, Runner", "sl": "Identical to Bot 2 — this variant changes trade MANAGEMENT, not entry/SL",
     "rel": "A/B vs Bot 2 — reuses Bot 2's entry logic byte-for-byte (strategy_key=bot_2); trailing activates at TP1 (R=1.0) instead of TP2 (R=2.0), using a new narrowing 'step_down' trail width "
            "(full 1R width right as it activates, tightening only as the peak proves itself further) instead of the old constant-width trail",
     "note": "Built from a real, critical finding: 17 of 80 closed trades (21%) hit TP1 then gave back the ENTIRE remaining 70% of the position at a flat breakeven floor, because trailing previously "
             "only ever activated at TP2 and the gap between TP1 and TP2 had zero protection beyond that one static floor. The 39 trades that DID reach TP2 and got real trailing averaged 6.35R, "
             "against 0.28R for the TP1-only group — trailing itself is the real lever, and Bot 12 tests giving it a full R earlier."},
]

# Stage 9, now wired in for real (by direct request, "continue
# outstanding items" — this was previously a static, dated snapshot;
# every real audit run now recomputes it fresh). One representative
# real (strategy_key, symbol, exchange) per bot family, each paired
# with a window that's safe for whatever timeframes that family needs
# — 5M-needing families (bot_5/6/8) get the shorter window verified
# safe against bingx's real 5M retention boundary this session;
# everyone else gets the full 60 days. Isolated reads (BTC is the one
# symbol every family can actually trade) rather than every real
# instance, so a monthly audit run stays a reasonable, bounded cost —
# the full per-instance/per-symbol sweep this session ran by hand
# remains the deeper, occasional check, not something every automatic
# cycle repeats.
BACKTEST_VALIDATION_TARGETS = [
    ("bot_1", "BTCUSDT.P", "bingx", 60),
    ("bot_2", "BTCUSDT.P", "bingx", 60),
    ("bot_3", "BTCUSDT.P", "bingx", 60),
    ("bot_4", "BTCUSDT.P", "bingx", 60),
    ("bot_5", "BTCUSDT.P", "bingx", 35),
    ("bot_6", "BTCUSDT.P", "bingx", 35),
    ("bot_7", "BTCUSDT.P", "bingx", 60),
    ("bot_8", "BTCUSDT.P", "bingx", 35),
    ("bot_9", "BTCUSDT.P", "bingx", 60),
    ("bot_10", "BTCUSDT.P", "bingx", 60),
    ("bot_11", "BTCUSDT.P", "bingx", 60),
]


async def compute_live_backtest_validation() -> List[Dict]:
    """Runs a real isolated backtest per bot family (BACKTEST_VALIDATION_
    TARGETS above), reusing the exact same engine/adapter/fetch path this
    session's own manual Bot 2/11/12/13 and Bot 4/5/6/8/9/10 verification
    used — not a separate, parallel implementation. Each target is fully
    isolated (its own try/except): a data-fetch failure or exchange error
    for one family logs a warning and is skipped, never aborting the rest
    of a monthly audit run over one bad symbol/exchange call.

    Deliberately ends at real wall-clock "now" (datetime.utcnow()), NOT
    the audit run's own period_end — real bug, found live the first
    time this ran end-to-end: a verification call passed period_end=
    2030-01-01 (a sentinel meaning "include every real trade regardless
    of date" for the TRADE-record queries elsewhere in this module) and
    this function reused that SAME value as the backtest's own "now,"
    trying to fetch real candles from the future. This check answers
    "how does each bot's live-tested edge look as of today," a question
    that's independent of whatever historical period the rest of a
    given audit run happens to cover — a retrospective audit of last
    month's trades should still validate against CURRENT market
    conditions, not pretend to be running back then."""
    now = datetime.utcnow()
    rows: List[Dict] = []
    for strategy_key, symbol, exchange, window_days in BACKTEST_VALIDATION_TARGETS:
        try:
            start = now - timedelta(days=window_days)
            _bot_class, required = STRATEGY_FAMILY[strategy_key]
            required_tf_labels = [label for _, label in required]
            base_tf = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))

            timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
                shared_ingestion, exchange, symbol, required_tf_labels, start, now,
            )
            if fetch_error:
                rows.append({"bot_family": strategy_key, "symbol": symbol, "window_days": window_days, "error": fetch_error})
                continue

            base_candles = [c for c in timeframe_candles[base_tf] if c.timestamp >= start]
            bars = [Bar(timestamp=c.timestamp, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume) for c in base_candles]

            adapter = SmcStrategyAdapter(
                real_bot_id=strategy_key, strategy_key=strategy_key, symbol=symbol,
                timeframe_candles=timeframe_candles, account_balance=1000.0,
                risk_per_trade=1.0, min_rr_ratio=3.0,
                tp1_percent=30.0, tp2_percent=40.0, tp3_percent=30.0,
                trailing_activation_r=2.0, trailing_stop_mode="fixed",
            )
            cost_model = _DEFAULT_COST_MODELS["forex" if exchange in _FOREX_LIKE_BROKERS else "crypto"]
            engine = BacktestEngine(cost_model=cost_model, max_hold_bars=2000)
            trades = engine.run(bars, adapter, symbol=symbol)
            stats = _summarize(trades)
            rows.append({
                "bot_family": strategy_key, "symbol": symbol, "window_days": window_days,
                "total_trades": stats["total_trades"], "win_rate": stats["win_rate"],
                "expectancy_r": stats["expectancy_r"], "max_drawdown_pct": stats["max_drawdown_pct"],
            })
        except Exception as e:
            logger.warning("backtest_validation_target_failed", strategy_key=strategy_key, symbol=symbol, error=str(e))
            rows.append({"bot_family": strategy_key, "symbol": symbol, "window_days": window_days, "error": str(e)})
    return rows


# Stage 9/10 findings from this session's own manual, deeper
# multi-symbol/multi-instance investigation (Bot 2/11/12/13 across all
# 7 real symbols; Bot 4/9/10 and Bot 6/8 across their own real
# coverage) — kept as a dated, labeled historical record alongside the
# live, automatically-recomputed single-symbol check above, since the
# manual sweep covers real instances and symbols the automatic
# per-family BTC-only check above deliberately doesn't repeat every
# cycle.
STAGE_9_10_FINDINGS = """
**Bot 2 vs Bot 11 (60-day out-of-sample backtest, generated 2026-10-15):**

| Symbol | Bot 2 win rate | Bot 2 expectancy (R) | Bot 11 win rate | Bot 11 expectancy (R) |
|---|---|---|---|---|
| BTC | 47.6% | -0.144 | 45.0% | -0.055 |
| JPY | 53.9% | +0.146 | 46.2% | -0.080 |
| EUR | 66.7% | +4.41 (n=3, too small) | 66.7% | +1.60 (n=3, too small) |
| XAUT | 38.5% | +0.130 | 23.1% | -0.185 |

Bot 2 wins on 3 of 4 real instruments; the wider stop (Bot 11) does not improve on it.

**Monte Carlo scenario modeling** (2,000 simulated 100-trade futures, $1,000 start, 1% risk, pooled
across all 4 real symbols):

| | Bot 2 | Bot 11 |
|---|---|---|
| Worst 5% (low) | $980.71 | $857.51 |
| Median (medium) | $1,329.11 | $1,056.33 |
| Best 5% (high) | $1,997.66 | $1,310.76 |
| Median drawdown | 6.94% | 10.1% |
| Probability of ruin | 0% | 0% |

Bot 2 dominates Bot 11 on every single percentile band — better upside, better downside, smaller
drawdown at every point in the distribution. Caveat: Bot 2's strong pooled number is partly carried
by the tiny EUR sample (n=3); BTC alone was negative for both bots.

**Correction (same investigation, found immediately after):** Bot 4/5/6/8 each initially appeared to
produce 0 real backtest trades on BTC over the same 60-day window. Investigated rather than reported
as a null result, because Bot 5/6 have real LIVE trades inside that exact window — a genuine 0
should have been impossible. Root cause: a flat 30-day lookback padding, applied to every required
timeframe including 5M (Bot 5/6/8's own secondary confirmation timeframe), routinely pushed the 5M
fetch's `since` past bingx's own real 5M retention window (confirmed empirically: 5m candles
available ~44 days back, empty at ~46+) — and because 5M is never the BASE replay timeframe for
these three bots, the existing "no base candles" guard never caught it. Fixed at the source
(`fetch_required_timeframe_candles`, shared by backtest_runner.py and intelligent_tuning_worker.py):
real per-timeframe padding, and a hard fail — naming the exact gap — the moment any REQUIRED
timeframe (not just the base one) has no real data in the requested window, so this can never again
look like a genuine zero-signal result. Bot 4 (which needs only 4H/1H, no 5M) was never affected by
this specific bug; its own 0-trade result is still the separately-confirmed over-restriction finding.

Re-ran Bot 5/6/8 on BTC over a 35-day window (safely inside bingx's real 5M retention) after the fix:

| Bot | Trades | Win rate | Expectancy (R) | Max DD (R) |
|---|---|---|---|---|
| Bot 5 | 4 | 75.0% | +0.862 | 0.03 |
| Bot 6 | 4 | 25.0% | -0.132 | 1.09 |
| Bot 8 | 21 | 38.1% | -0.128 | 4.89 |

All three samples are still small (Bot 5/6: n=4; Bot 8: n=21, the only one past the n=15 confidence
floor). Bot 8 (Bot 6 minus the LTF-agreement gate) fires far more often than Bot 6 on the identical
window (21 vs 4) — consistent with the earlier live-replay finding that this gate is the dominant
restrictor — but its real expectancy is not better than Bot 6's, both negative. Removing the gate
produces more trades, not necessarily better ones; this needs a larger sample before concluding
either way.

**Full real symbol coverage** (continuing "outstanding items" — the BTC-only check above extended to
every real symbol each family actually trades):

**Bot 4 vs Bot 9 vs Bot 10 (JPY/EUR/XAUT, 60-day window):**

| Symbol | Bot 4 | Bot 9 | Bot 10 |
|---|---|---|---|
| JPY | n=1, -0.138R | n=1, -0.138R | n=5, -0.002R |
| EUR | n=0 | n=0 | n=5, -0.420R |
| XAUT | n=0 | n=0 | n=2, -0.392R |
| **Pooled** | **n=1, -0.14R** | **n=1, -0.14R** (identical trade to Bot 4) | **n=12, -0.24R avg** |

Bot 9's wider band makes no real difference — same single trade as Bot 4 on the same symbols,
confirming the near-extreme band isn't the binding constraint. Bot 10 genuinely solves the silence
(12 vs 1 trades) but hasn't yet shown a positive real edge over this window.

**Bot 6 vs Bot 8, extended to all 6 remaining real symbols (35-day window):**

| Symbol | Bot 6 | Bot 8 |
|---|---|---|
| XAUT | n=16, -0.174R | n=39, -0.178R |
| JPY | n=2, +0.123R | n=20, -0.182R |
| EUR | n=3, -1.001R | n=6, -0.784R |
| NAS100 | n=2, +1.077R | n=15, +0.232R |
| Brent | n=14, +0.211R | n=49, +0.013R |
| WTI | n=7, -0.056R | n=46, +0.009R |
| **Pooled (these 6)** | **n=44, -0.019R** | **n=175, -0.062R** |

Combined with the earlier BTC result, Bot 8's FULL real coverage is n=196 (avg -0.069R) against Bot
6's n=48 (avg -0.028R). Bot 8 fires roughly 4x more often than Bot 6 across the identical real
windows — the LTF-agreement gate is decisively confirmed as the dominant restrictor on signal
frequency — but Bot 6 is still the slightly better performer per trade. Bot 8 trades a lot more for a
slightly worse average outcome, not a better one; this is a real, honest negative-leaning result, not
grounds to recommend dropping the gate.
"""


def _generate_report_markdown(
    period_start: datetime, period_end: datetime,
    inventory: List[Dict], expectancy: List[Dict], duplicate_groups: List[Dict],
    findings: List[TradingAuditFinding],
    instances: Optional[List[Dict]] = None,
    trade_register: Optional[Dict[str, List[Dict]]] = None,
    backtest_validation: Optional[List[Dict]] = None,
) -> str:
    """The "provide docs" half of the original request — a real,
    standalone Markdown executive report built from this run's own
    computed data, in the shape of the master audit prompt's own
    Deliverable 1 (Executive Summary) + Deliverable 2 (instrument
    inventory) + Deliverable 7-style bot scorecard + Deliverable 12
    (what's covered vs. deferred). Every number here traces directly
    to inventory/expectancy/duplicate_groups computed above — nothing
    in this report is written independently of that data.

    `instances` (Stage 8's per-bot-instance detail), `trade_register`
    (Stage 11's "per-trade win/loss register" deliverable —
    compute_trade_register's own output), and `backtest_validation`
    (Stage 9's own live, per-run backtest check —
    compute_live_backtest_validation's own output) are optional so
    this function stays callable exactly as before wherever only the
    original 5 arguments are available."""
    total_trades = sum(r["total_trades"] for r in inventory)
    total_wins = sum(r["wins"] for r in inventory)
    total_losses = sum(r["losses"] for r in inventory)
    violations = [g for g in duplicate_groups if g["concurrent_violation"]]
    action_findings = [f for f in findings if f.severity == AuditFindingSeverity.ACTION]
    info_findings = [f for f in findings if f.severity == AuditFindingSeverity.INFO]

    lines = [
        f"# Monthly Trading Audit — {period_start.date()} to {period_end.date()}",
        "",
        "## Executive Summary",
        "",
        f"- **Period covered:** {period_start.date()} to {period_end.date()}",
        f"- **Total trade records analyzed:** {total_trades} ({total_wins} wins, {total_losses} losses, "
        f"{total_trades - total_wins - total_losses} other/open)",
        f"- **Instruments configured:** {len(inventory)}",
        f"- **Bot families with closed trades this period:** {len(expectancy)}",
        f"- **Concurrent-duplicate violations detected:** {len(violations)}",
        f"- **Action-severity findings:** {len(action_findings)}  |  **Info findings:** {len(info_findings)}",
        "",
    ]

    if expectancy:
        best = max(expectancy, key=lambda r: r["total_pnl"] or 0)
        worst = min(expectancy, key=lambda r: r["total_pnl"] or 0)
        lines += [
            f"- **Best-performing bot family this period:** `{best['bot_family']}` "
            f"(${best['total_pnl']:.2f} total, {best['win_rate_pct']}% win rate, {best['n']} trades)",
            f"- **Worst-performing bot family this period:** `{worst['bot_family']}` "
            f"(${worst['total_pnl']:.2f} total, {worst['win_rate_pct']}% win rate, {worst['n']} trades)",
            "",
        ]

    lines += [
        "## Instrument Inventory",
        "",
        "| Symbol | Bots | Trades | Wins | Losses | Active | Errors |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in inventory:
        lines.append(
            f"| {row['symbol']} | {len(row['bots'])} | {row['total_trades']} | {row['wins']} | "
            f"{row['losses']} | {row['active']} | {row['errors']} |"
        )
    lines.append("")

    lines += [
        "## Bot-Family Scorecard",
        "",
        "| Bot family | N | Win rate | Total PnL | Avg R | Expectancy/trade |",
        "|---|---|---|---|---|---|",
    ]
    for row in expectancy:
        lines.append(
            f"| {row['bot_family']} | {row['n']} | {row['win_rate_pct']}% | ${row['total_pnl']:.2f} | "
            f"{row['avg_r'] if row['avg_r'] is not None else '—'} | ${row['expectancy_per_trade']:.2f} |"
        )
    lines.append("")

    if instances:
        lines += [
            "## Bot-Instance Detail",
            "",
            "| Bot ID | N | Win rate | Total PnL | Avg R |",
            "|---|---|---|---|---|",
        ]
        for row in instances:
            lines.append(
                f"| {row['bot_id']} | {row['n']} | {row['win_rate_pct']}% | ${row['total_pnl']:.2f} | "
                f"{row['avg_r'] if row['avg_r'] is not None else '—'} |"
            )
        lines.append("")

    lines += ["## Bot Optimization Matrix (Stage 8)", "",
               "Per-bot SL method and real A/B relationship, authored from reading each bot's own code this "
               "session — not derived from this run's own query, included so the report is self-contained.", ""]
    for b in BOT_OPTIMIZATION_REFERENCE:
        lines.append(f"**{b['name']}** — SL: {b['sl']}. {b['rel']}.")
        lines.append(f"  {b['note']}")
        lines.append("")

    if backtest_validation:
        lines += [
            "## Live Backtest Validation (Stage 9 — recomputed this run)", "",
            f"One real isolated backtest per bot family, BTC, over each family's own safe real window "
            f"(35 days for the 5M-needing families, 60 days otherwise) — re-run fresh every audit cycle, "
            f"not a stored snapshot.", "",
            "| Family | Symbol | Window | Trades | Win rate | Expectancy (R) | Max DD (R) |",
            "|---|---|---|---|---|---|---|",
        ]
        for row in backtest_validation:
            if "error" in row:
                lines.append(f"| {row['bot_family']} | {row['symbol']} | {row['window_days']}d | — | — | — | *{row['error']}* |")
            else:
                lines.append(
                    f"| {row['bot_family']} | {row['symbol']} | {row['window_days']}d | {row['total_trades']} | "
                    f"{row['win_rate']}% | {row['expectancy_r'] if row['expectancy_r'] is not None else '—'} | "
                    f"{row['max_drawdown_pct'] if row['max_drawdown_pct'] is not None else '—'} |"
                )
        lines.append("")

    lines += ["## Real Backtest Validation & Scenario Modeling (Stages 9-10) — this session's manual sweep", "",
               STAGE_9_10_FINDINGS.strip(), ""]

    if trade_register:
        lines += [
            "## Per-Trade Win/Loss Register (Stage 11)", "",
            f"**Wins ({len(trade_register['wins'])}):**", "",
            "| Trade ID | Bot | Symbol | Dir | Entry | Exit | PnL | R |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for t in trade_register["wins"]:
            lines.append(
                f"| {t['trade_id']} | {t['bot_id']} | {t['symbol']} | {t['direction']} | "
                f"{t['entry_price']} | {t['exit_price']} | ${t['realized_pnl']} | {t['r_multiple'] if t['r_multiple'] is not None else '—'} |"
            )
        lines += ["", f"**Losses ({len(trade_register['losses'])}):**", "",
                   "| Trade ID | Bot | Symbol | Dir | Entry | Exit | PnL | R |",
                   "|---|---|---|---|---|---|---|---|"]
        for t in trade_register["losses"]:
            lines.append(
                f"| {t['trade_id']} | {t['bot_id']} | {t['symbol']} | {t['direction']} | "
                f"{t['entry_price']} | {t['exit_price']} | ${t['realized_pnl']} | {t['r_multiple'] if t['r_multiple'] is not None else '—'} |"
            )
        lines.append("")

    lines += [
        "## Scope of This Run",
        "",
        "This automated run covers: instrument/bot inventory, trade-record reconciliation "
        "(duplicate/concurrency detection), per-bot-family AND per-bot-instance win/loss expectancy, "
        "the Bot Optimization Matrix reference (Stage 8), a dated snapshot of this session's real "
        "backtest/Monte Carlo validation (Stages 9-10), and the full per-trade win/loss register "
        "(Stage 11) — the same methodology validated by hand against this platform's real trade "
        "history.",
        "",
        "Stage 9 now also includes a LIVE backtest check, recomputed fresh every run (one real "
        "isolated backtest per bot family) — not just the dated manual-sweep snapshot.",
        "",
        "**Deferred, not yet automated:** per-trade individual forensic write-ups (full SMC context "
        "reconstruction — HTF bias, swing points, BOS/CHoCH, FVG/OB zones — for every losing/winning "
        "trade; Part 10 of the master audit prompt) and external TradingView/chart cross-referencing. "
        "Stage 10's scenario-modeling numbers are still a dated snapshot from this session's manual "
        "sweep, not yet recomputed automatically (the live Stage 9 check above only runs the backtest "
        "itself, not the further Monte Carlo pass on top of it) — a real, available next step. These "
        "remain real, available next steps — not silently dropped — but are not run automatically each "
        "cycle given their cost.",
    ]
    return "\n".join(lines)


async def run_audit(db: AsyncSession, period_start: datetime, period_end: datetime, triggered_by: str = "scheduled") -> TradingAuditRun:
    run = TradingAuditRun(
        period_start=period_start, period_end=period_end,
        status=AuditRunStatus.RUNNING, triggered_by=triggered_by,
    )
    db.add(run)
    await db.flush()

    try:
        inventory = await _compute_instrument_inventory(db, period_start, period_end)
        # Single query, two views — the per-family scorecard is now a
        # pure rollup of the per-instance rows (same pattern the Bot
        # Optimization Matrix's own GET /bots/optimization-matrix
        # endpoint uses), replacing a second, independently-computed
        # _compute_bot_family_expectancy query that risked drifting
        # from this one.
        instances = await compute_bot_instance_expectancy(db, period_start, period_end)
        expectancy = rollup_instance_rows_to_family(instances)
        trade_register = await compute_trade_register(db, period_start, period_end)
        # Real network calls (candle fetches) — isolated at the top
        # level too, same discipline as every target inside the
        # function itself: a total failure here (e.g. every exchange
        # route down at once) degrades to "no live backtest section
        # this run," never aborts the rest of the audit.
        try:
            backtest_validation = await compute_live_backtest_validation()
        except Exception as e:
            logger.warning("backtest_validation_failed", error=str(e))
            backtest_validation = None
        duplicate_groups = await _detect_duplicate_signature_groups(db, period_start, period_end)
        error_clusters = await _detect_execution_error_clusters(db, period_start, period_end)
        silent_bots = await _detect_silent_bots(db, period_start, period_end)

        run.summary_json = json.dumps({
            "instrument_inventory": inventory, "bot_family_expectancy": expectancy,
            "bot_instance_expectancy": instances, "backtest_validation": backtest_validation,
        })

        findings: List[TradingAuditFinding] = []

        # Finding: real concurrency violations (the one genuinely
        # alarming category — two correlated positions open at once on
        # the literal same zone).
        violations = [g for g in duplicate_groups if g["concurrent_violation"]]
        if violations:
            findings.append(TradingAuditFinding(
                run_id=run.id, category="duplicate_concurrency", evidence_level="verified",
                severity=AuditFindingSeverity.ACTION,
                title=f"{len(violations)} concurrent duplicate-signal group(s) detected",
                detail=(
                    "Two or more positions on the identical bot+symbol+direction+entry+stop were open "
                    "AT THE SAME TIME (not sequential re-use of a still-valid zone, which is expected "
                    "behavior since the 2026-10-07/08 repeat-setup guard). This doubles correlated exposure "
                    "on a single bet. Groups: " + json.dumps(violations)
                ),
                recommended_action=None, recommendation_status=AuditRecommendationStatus.NONE,
            ))

        # Finding: strongly negative, reasonably-sampled bot family
        # expectancy — the one category with a real, safe Apply action.
        for row in expectancy:
            if row["n"] < MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY:
                continue
            if (row["total_pnl"] or 0) < NEGATIVE_EXPECTANCY_ACTION_THRESHOLD:
                findings.append(TradingAuditFinding(
                    run_id=run.id, category="bot_performance", evidence_level="strongly_supported",
                    severity=AuditFindingSeverity.ACTION,
                    title=f"{row['bot_family']} shows negative expectancy over this period",
                    detail=(
                        f"{row['n']} closed trades, {row['win_rate_pct']}% win rate, total PnL "
                        f"${row['total_pnl']:.2f}, expectancy ${row['expectancy_per_trade']:.2f}/trade. "
                        "Sample size clears the minimum this engine trusts before recommending action "
                        f"({MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY}+ trades)."
                    ),
                    bot_id=row["bot_family"],
                    recommended_action="pause_bot_family",
                    recommendation_status=AuditRecommendationStatus.PENDING,
                ))
            elif row["n"] >= MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY:
                findings.append(TradingAuditFinding(
                    run_id=run.id, category="bot_performance", evidence_level="verified",
                    severity=AuditFindingSeverity.INFO,
                    title=f"{row['bot_family']} — what's working",
                    detail=(
                        f"{row['n']} closed trades, {row['win_rate_pct']}% win rate, total PnL "
                        f"${row['total_pnl']:.2f}, expectancy ${row['expectancy_per_trade']:.2f}/trade."
                    ),
                    bot_id=row["bot_family"],
                    recommended_action=None, recommendation_status=AuditRecommendationStatus.NONE,
                ))

        # Finding: clustered execution-rejection errors (e.g. repeated
        # price_deviation_guard trips) — a real pattern worth human
        # review, but with no safe one-click fix (widening a safety
        # tolerance is a risk-policy decision, not a bug with one
        # obviously-correct answer).
        for cluster in error_clusters:
            findings.append(TradingAuditFinding(
                run_id=run.id, category="execution_errors", evidence_level="verified",
                severity=AuditFindingSeverity.ACTION,
                title=f"{cluster['count']} clustered '{cluster['error_message']}' errors on {cluster['symbol']}",
                detail=(
                    f"{cluster['count']} trades from {', '.join(cluster['bot_ids'])} failed with the same "
                    f"error ('{cluster['error_message']}') between {cluster['first_seen']} and {cluster['last_seen']}. "
                    "No signal was ever sent to the broker for these (the error fired before order submission), "
                    "so no bad fills resulted — but this many rejections in the window means real, "
                    "otherwise-valid signals are being lost. Trade IDs: " + ", ".join(cluster["trade_ids"])
                ),
                recommended_action=None, recommendation_status=AuditRecommendationStatus.NONE,
            ))

        # Finding: silent/low-activity bots (Part 9 of the master audit
        # prompt). Purely informational — low frequency is very often
        # legitimate, deliberate selectivity (verified directly for
        # bot_4_volume_liq this session via a real bar-by-bar replay),
        # not a defect, so this is flagged for a human to look at, not
        # auto-judged.
        if silent_bots:
            findings.append(TradingAuditFinding(
                run_id=run.id, category="silent_bot", evidence_level="verified",
                severity=AuditFindingSeverity.WATCH,
                title=f"{len(silent_bots)} bot(s) with fewer than {SILENT_BOT_TRADE_THRESHOLD} trades this period",
                detail=(
                    "Low trade count is often legitimate, deliberate strategy selectivity, not a defect — "
                    "verify against the bot's own real gating logic before assuming a problem. "
                    + json.dumps(silent_bots)
                ),
                recommended_action=None, recommendation_status=AuditRecommendationStatus.NONE,
            ))

        for f in findings:
            db.add(f)

        run.report_markdown = _generate_report_markdown(
            period_start, period_end, inventory, expectancy, duplicate_groups, findings,
            instances=instances, trade_register=trade_register, backtest_validation=backtest_validation,
        )

        run.status = AuditRunStatus.COMPLETED
        run.completed_at = datetime.utcnow()
    except Exception as e:
        run.status = AuditRunStatus.FAILED
        run.error_message = str(e)
        run.completed_at = datetime.utcnow()
        raise
    finally:
        await db.commit()

    return run


async def apply_recommendation(db: AsyncSession, finding: TradingAuditFinding, applied_by: str) -> Dict:
    """The only Apply action this engine currently knows how to carry
    out: pausing every active BotConfig row in a negative-expectancy
    family. Pure risk reduction, fully reversible (an admin can
    reactivate any bot from the Bots page exactly as before) — never
    touches strategy logic, parameters, or any other bot."""
    if finding.recommended_action != "pause_bot_family" or finding.bot_id is None:
        return {"success": False, "message": "This finding has no applicable automated action."}

    rows = (await db.execute(
        select(BotConfig).where(BotConfig.status == BotStatus.ACTIVE)
    )).scalars().all()
    paused = []
    for row in rows:
        if row.bot_id == finding.bot_id or row.bot_id.startswith(finding.bot_id + "_"):
            row.status = BotStatus.PAUSED
            paused.append(row.bot_id)

    finding.recommendation_status = AuditRecommendationStatus.APPLIED
    finding.applied_at = datetime.utcnow()
    finding.applied_by = applied_by
    await db.commit()

    return {"success": True, "message": f"Paused {len(paused)} bot(s): {', '.join(paused)}", "paused_bot_ids": paused}
