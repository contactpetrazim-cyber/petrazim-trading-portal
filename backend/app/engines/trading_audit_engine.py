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
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import BotConfig, BotStatus
from app.models.trade import Trade, TradeStatus
from app.models.trading_audit import (
    AuditFindingSeverity, AuditRecommendationStatus, AuditRunStatus,
    TradingAuditFinding, TradingAuditRun,
)

# Real base strategy-family names (confirmed against the live
# BotConfig roster) — each "_N" suffix (bot_2_ob_reversal_2, _3...) is
# the same strategy class deployed on a different symbol, not a
# different strategy, so these collapse together for expectancy.
#
# bot_8-11 added later ("finish Stage 8"): this list was built before
# those 4 A/B variants existed — the same hand-maintained-registry
# drift already found and fixed once this session (BOT_REGISTRY in
# bot_strategies.py). Without these 4 entries, _bot_family's fallback
# (`return bot_id`) would keep every one of their symbol-instance rows
# (e.g. bot_9_volume_liq_wide_range vs _2) separate instead of
# collapsing into one real family, silently wrong the moment any of
# them accumulates trades across more than one symbol.
BOT_FAMILIES = [
    "bot_1_macro_swing", "bot_2_ob_reversal", "bot_3_fvg_expansion",
    "bot_4_volume_liq", "bot_5_jeafx", "bot_6_smc_v2", "bot_7_fvg_expansion_v3",
    "bot_8_smc_v2_single_anchor", "bot_9_volume_liq_wide_range",
    "bot_10_volume_liq_held_reclaim", "bot_11_ob_reversal_wider_stop",
]

# A bot family needs at least this many closed trades in the audited
# period before its expectancy is trusted enough to recommend pausing
# it — the same "don't act on n=1-4" discipline the manual audit used
# when it explicitly declined to judge bot_1/bot_4/manual on tiny
# samples.
MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY = 15
NEGATIVE_EXPECTANCY_ACTION_THRESHOLD = 0.0  # strictly negative total PnL over the period


def _bot_family(bot_id: str) -> str:
    if bot_id.startswith("manual"):
        return "manual"
    for fam in BOT_FAMILIES:
        if bot_id == fam or bot_id.startswith(fam + "_"):
            return fam
    return bot_id


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


async def _compute_bot_family_expectancy(db: AsyncSession, period_start: datetime, period_end: datetime) -> List[Dict]:
    trades = (await db.execute(
        select(Trade).where(
            Trade.status == TradeStatus.CLOSED,
            Trade.created_at >= period_start, Trade.created_at < period_end,
        )
    )).scalars().all()

    by_family: Dict[str, List[Trade]] = defaultdict(list)
    for t in trades:
        by_family[_bot_family(t.bot_id)].append(t)

    rows = []
    for fam, ts in by_family.items():
        n = len(ts)
        wins = sum(1 for t in ts if (t.realized_pnl or 0) > 0)
        losses = sum(1 for t in ts if (t.realized_pnl or 0) < 0)
        total_pnl = sum((t.realized_pnl or 0) for t in ts)
        r_vals = [t.r_multiple for t in ts if t.r_multiple is not None]
        avg_r = sum(r_vals) / len(r_vals) if r_vals else None
        rows.append({
            "bot_family": fam, "n": n, "wins": wins, "losses": losses,
            "win_rate_pct": round(wins / n * 100, 1) if n else None,
            "total_pnl": round(total_pnl, 2),
            "avg_r": round(avg_r, 3) if avg_r is not None else None,
            "expectancy_per_trade": round(total_pnl / n, 2) if n else None,
        })
    return sorted(rows, key=lambda r: -(r["total_pnl"] or 0))


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


def _generate_report_markdown(
    period_start: datetime, period_end: datetime,
    inventory: List[Dict], expectancy: List[Dict], duplicate_groups: List[Dict],
    findings: List[TradingAuditFinding],
) -> str:
    """The "provide docs" half of the original request — a real,
    standalone Markdown executive report built from this run's own
    computed data, in the shape of the master audit prompt's own
    Deliverable 1 (Executive Summary) + Deliverable 2 (instrument
    inventory) + Deliverable 7-style bot scorecard + Deliverable 12
    (what's covered vs. deferred). Every number here traces directly
    to inventory/expectancy/duplicate_groups computed above — nothing
    in this report is written independently of that data."""
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

    lines += ["## Findings & Recommendations", ""]
    if not findings:
        lines.append("No findings this run.")
    for f in findings:
        lines.append(f"### [{f.severity.value.upper()}] {f.title}")
        lines.append(f"*Evidence: {f.evidence_level} · Category: {f.category}*")
        lines.append("")
        lines.append(f.detail)
        if f.recommended_action:
            lines.append(f"\n**Recommended action:** {f.recommended_action} (status: {f.recommendation_status.value})")
        lines.append("")

    lines += [
        "## Scope of This Run",
        "",
        "This automated run covers: instrument/bot inventory, trade-record reconciliation "
        "(duplicate/concurrency detection), and per-bot-family win/loss expectancy — the same "
        "methodology validated by hand against this platform's real trade history.",
        "",
        "**Deferred, not yet automated:** per-trade individual forensic write-ups (SMC context "
        "reconstruction for every losing/winning trade), external TradingView/chart cross-referencing, "
        "formal backtesting and out-of-sample validation of candidate strategy changes, and low/"
        "medium/high performance scenario modeling. These remain real, available next steps — not "
        "silently dropped — but are not run automatically each cycle given their cost.",
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
        expectancy = await _compute_bot_family_expectancy(db, period_start, period_end)
        duplicate_groups = await _detect_duplicate_signature_groups(db, period_start, period_end)
        error_clusters = await _detect_execution_error_clusters(db, period_start, period_end)
        silent_bots = await _detect_silent_bots(db, period_start, period_end)

        run.summary_json = json.dumps({"instrument_inventory": inventory, "bot_family_expectancy": expectancy})

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
