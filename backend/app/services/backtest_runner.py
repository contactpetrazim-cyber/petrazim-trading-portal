"""
Backtest Runner — the orchestration layer that actually calls
BacktestEngine.run() and persists the result, closing the gap found
during planning: the backtest harness, the StrategyAdapter bridging it
to the real bots, and the closed_trades storage/validation-gate
pipeline all already existed, but nothing had ever connected them
end-to-end. This is that connection.

Follows this codebase's own established pattern for a long-running,
user-triggered background job (no Celery/job-queue infrastructure
exists anywhere here — everything is either a synchronous request or
a fixed-interval asyncio.create_task loop): POST /backtests creates a
BacktestRunORM row (status=QUEUED) and fires `asyncio.create_task`
against `run_backtest` below, returning immediately; GET /backtests/{id}
polls the same row for status/progress/results.
"""

from __future__ import annotations

import asyncio
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional

import structlog
from sqlalchemy import select

from app.database import AsyncSessionLocal as PrimaryAsyncSessionLocal
from app.db.session import AsyncSessionLocal as LegacyAsyncSessionLocal
from app.db.models import BacktestRunORM, BacktestRunStatus
from app.db.repository import save_backtest_trades
from app.models.bot import BotConfig, BotStatus
from app.services.data_ingestion import shared_ingestion
from app.engines.backtest_engine import BacktestEngine, Bar, CostModel
from app.engines.strategy_adapter import SmcStrategyAdapter, STRATEGY_FAMILY, TF_ORDER, fetch_required_timeframe_candles
from app.engines.portfolio_backtest_engine import PortfolioBacktestEngine, PortfolioParticipant, PortfolioBacktestResult

logger = structlog.get_logger()

# Conservative, explicitly-labeled-as-assumptions placeholder cost
# figures per the approved plan — nothing in this codebase measures
# real broker fees/spread/slippage anywhere, live or paper, so these
# are a judgment call, not a measured number. Expressed in price units
# (CostModel's own convention), looked up by a coarse asset class
# rather than per-symbol, and deliberately small: the point is a
# directionally-honest backtest, not a precisely-calibrated one.
_DEFAULT_COST_MODELS = {
    "crypto": CostModel(spread=0.0, slippage=0.0, commission_r=0.001),
    "forex": CostModel(spread=0.0, slippage=0.0, commission_r=0.0005),
}
_FOREX_LIKE_BROKERS = {"tradelocker", "metatrader", "oanda"}

# BacktestRunORM.bot_id is NOT NULL and semantically "exactly one real
# bot" everywhere else in this codebase — a portfolio run has no
# single bot, so this constant marks the row instead of a comma-joined
# string or similar. The real participant set lives in bot_ids (see
# BacktestRunORM's own docstring).
_PORTFOLIO_BOT_ID_SENTINEL = "__portfolio__"


def _naive_utc(dt: datetime) -> datetime:
    """Every timestamp elsewhere in this codebase (candle data,
    Trade.entry_timestamp, TradeLog.timestamp, ...) is naive-but-UTC —
    an aware datetime compared against one of those raises "can't
    compare offset-naive and offset-aware datetimes". BacktestRunORM's
    start_date/end_date columns are timezone=True (matching
    ClosedTradeORM's own entry_time/exit_time, since this table lives
    on the same legacy Base) so asyncpg round-trips them as aware —
    normalized back to naive UTC at both the write boundary
    (start_backtest_run) and the read boundary (run_backtest) so
    nothing downstream ever has to think about this."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


async def start_backtest_run(bot_id: str, start_date: datetime, end_date: datetime, created_by: Optional[str] = None, symbol: Optional[str] = None) -> str:
    """Creates the QUEUED row and hands back its id immediately — the
    caller (the router) fires run_backtest as a background task right
    after this returns."""
    start_date, end_date = _naive_utc(start_date), _naive_utc(end_date)
    async with LegacyAsyncSessionLocal() as db:
        run = BacktestRunORM(
            bot_id=bot_id, scope="isolated", symbol=symbol,
            start_date=start_date, end_date=end_date,
            status=BacktestRunStatus.QUEUED, progress_pct=0.0,
            created_by=created_by, created_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return str(run.id)


async def start_portfolio_backtest_run(
    bot_ids: Optional[List[str]], start_date: datetime, end_date: datetime, created_by: Optional[str] = None,
) -> str:
    """Portfolio-mode counterpart to start_backtest_run above — creates
    the QUEUED row and hands back its id immediately. `bot_ids` is
    stored exactly as requested (an explicit list, or None meaning "all
    ACTIVE bots"); run_portfolio_backtest overwrites it with the
    actually-resolved list once that resolution happens at RUN time,
    per BacktestRunORM's own docstring."""
    start_date, end_date = _naive_utc(start_date), _naive_utc(end_date)
    async with LegacyAsyncSessionLocal() as db:
        run = BacktestRunORM(
            bot_id=_PORTFOLIO_BOT_ID_SENTINEL, scope="portfolio", bot_ids=bot_ids, symbol=None,
            start_date=start_date, end_date=end_date,
            status=BacktestRunStatus.QUEUED, progress_pct=0.0,
            created_by=created_by, created_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return str(run.id)


async def _update_run(run_id: str, **fields) -> None:
    async with LegacyAsyncSessionLocal() as db:
        run = (await db.execute(select(BacktestRunORM).where(BacktestRunORM.id == run_id))).scalar_one()
        for key, value in fields.items():
            setattr(run, key, value)
        await db.commit()


async def run_backtest(run_id: str) -> None:
    """The actual background task — fetch real history, run the real
    strategy bar-by-bar through BacktestEngine, persist every closed
    trade via the already-built save_backtest_trades (so the already-
    live /api/validation-gate endpoint finally has real data to read),
    and leave the run row in a terminal COMPLETED/FAILED state no
    matter what happens. Never left stuck at RUNNING/QUEUED."""
    try:
        await _update_run(run_id, status=BacktestRunStatus.RUNNING, progress_pct=5.0)

        async with LegacyAsyncSessionLocal() as db:
            run = (await db.execute(select(BacktestRunORM).where(BacktestRunORM.id == run_id))).scalar_one()
            bot_id, start_date, end_date, requested_symbol = run.bot_id, _naive_utc(run.start_date), _naive_utc(run.end_date), run.symbol

        async with PrimaryAsyncSessionLocal() as db:
            bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        if bot is None:
            await _update_run(run_id, status=BacktestRunStatus.FAILED, error_message=f"No BotConfig found for bot_id={bot_id}", completed_at=datetime.now(timezone.utc))
            return
        if not bot.strategy_key or bot.strategy_key not in STRATEGY_FAMILY:
            await _update_run(run_id, status=BacktestRunStatus.FAILED, error_message=f"bot_id={bot_id} has no recognized strategy_key ({bot.strategy_key!r})", completed_at=datetime.now(timezone.utc))
            return

        symbol = requested_symbol or (bot.symbols[0] if bot.symbols else None)
        if not symbol:
            await _update_run(run_id, status=BacktestRunStatus.FAILED, error_message=f"bot_id={bot_id} has no symbol configured and none was requested", completed_at=datetime.now(timezone.utc))
            return

        exchange = bot.exchange or "bingx"
        _bot_class, required = STRATEGY_FAMILY[bot.strategy_key]
        required_tf_labels = [label for _, label in required]
        base_tf = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))

        await _update_run(run_id, symbol=symbol, base_timeframe=base_tf, progress_pct=10.0)

        # fetch_required_timeframe_candles (strategy_adapter.py) checks
        # EVERY required timeframe for real data in-window, not just
        # the base one — see its own docstring for the real bug this
        # fixes (Bot 5/6/8 silently "backtesting" to 0 signals when
        # their secondary 5M timeframe ran past this exchange's real
        # retention window, looking exactly like a genuine null result).
        timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
            shared_ingestion, exchange, symbol, required_tf_labels, start_date, end_date,
        )
        if fetch_error:
            await _update_run(
                run_id, status=BacktestRunStatus.FAILED, error_message=fetch_error,
                completed_at=datetime.now(timezone.utc),
            )
            return

        await _update_run(run_id, progress_pct=40.0)

        base_candles = [c for c in timeframe_candles[base_tf] if c.timestamp >= start_date]
        bars = [Bar(timestamp=c.timestamp, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume) for c in base_candles]

        trailing_activation_r = bot.trailing_stop_activation if bot.use_trailing_stop else None
        adapter = SmcStrategyAdapter(
            real_bot_id=bot.bot_id, strategy_key=bot.strategy_key, symbol=symbol,
            timeframe_candles=timeframe_candles, account_balance=bot.account_balance_usd or 1000.0,
            risk_per_trade=bot.risk_per_trade, min_rr_ratio=bot.min_rr_ratio,
            tp1_percent=bot.tp1_percent, tp2_percent=bot.tp2_percent, tp3_percent=bot.tp3_percent,
            trailing_activation_r=trailing_activation_r, trailing_stop_mode=bot.trailing_stop_distance or "fixed",
        )

        cost_model = _DEFAULT_COST_MODELS["forex" if exchange in _FOREX_LIKE_BROKERS else "crypto"]
        await _update_run(run_id, progress_pct=50.0, cost_model={"spread": cost_model.spread, "slippage": cost_model.slippage, "commission_r": cost_model.commission_r})

        engine = BacktestEngine(cost_model=cost_model, max_hold_bars=2000)
        # engine.run is a pure, synchronous, bar-by-bar replay -- CPU-
        # bound for as long as the window has bars, same class of bug as
        # market_scanner.py's own run_all call (see that fix's comment).
        # Called inline, this freezes the entire process -- every
        # concurrent request -- for the backtest's full duration, not
        # just this one background task's own progress. Offloaded to a
        # thread so a long backtest window degrades only its own
        # progress bar, never every other user's response time.
        trades = await asyncio.get_event_loop().run_in_executor(None, engine.run, bars, adapter, symbol)

        await _update_run(run_id, progress_pct=80.0)

        async with LegacyAsyncSessionLocal() as db:
            if trades:
                await save_backtest_trades(db, trades, source="backtest")

        stats = _summarize(trades)
        await _update_run(
            run_id, status=BacktestRunStatus.COMPLETED, progress_pct=100.0,
            completed_at=datetime.now(timezone.utc), **stats,
        )
        logger.info("backtest_run_completed", run_id=run_id, bot_id=bot_id, symbol=symbol, total_trades=stats["total_trades"])

    except Exception as e:
        # Real bug, found live via audit: a run from 2026-10-14 failed
        # with "can't compare offset-naive and offset-aware datetimes"
        # and nothing beyond that bare message was ever recorded —
        # str(e) alone, with no traceback, gave no way to tell which
        # of several datetime-handling call sites (_naive_utc here,
        # fetch_historical_range's pagination, ccxt's own since=
        # handling) actually raised it. Re-running the same bot/
        # symbol/window against current main did NOT reproduce it, so
        # whatever caused it may already be fixed as a side effect of
        # later changes, or was a transient near-live-edge timing
        # issue — but if it (or anything else here) recurs, this makes
        # it actually debuggable from GET /backtests/{id} alone,
        # without needing live log access.
        tb = traceback.format_exc()
        logger.error("backtest_run_failed", run_id=run_id, error=str(e), traceback=tb)
        await _update_run(
            run_id, status=BacktestRunStatus.FAILED,
            error_message=f"{e}\n\n{tb}"[:4000], completed_at=datetime.now(timezone.utc),
        )


async def run_portfolio_backtest(run_id: str) -> None:
    """Portfolio-mode counterpart to run_backtest above, mirroring its
    structure/progress-update/error-handling conventions exactly
    (including the full-traceback-on-failure pattern): resolves the
    real bot list (fresh, at RUN time — never trusting a list computed
    back when the request was made), fetches each bot's own required
    candles (reusing fetch_required_timeframe_candles per bot, exactly
    like isolated mode — no reimplementation), feeds every bot's own
    SmcStrategyAdapter + bars into PortfolioBacktestEngine's real
    shared-ledger simulation, and persists the result. Never left stuck
    at RUNNING/QUEUED."""
    try:
        await _update_run(run_id, status=BacktestRunStatus.RUNNING, progress_pct=5.0)

        async with LegacyAsyncSessionLocal() as db:
            run = (await db.execute(select(BacktestRunORM).where(BacktestRunORM.id == run_id))).scalar_one()
            requested_bot_ids, start_date, end_date = run.bot_ids, _naive_utc(run.start_date), _naive_utc(run.end_date)

        async with PrimaryAsyncSessionLocal() as db:
            if requested_bot_ids:
                bots = (await db.execute(select(BotConfig).where(BotConfig.bot_id.in_(requested_bot_ids)))).scalars().all()
            else:
                # Resolved fresh HERE, at run time — not back when
                # start_portfolio_backtest_run created the row — so a
                # bot activated/deactivated in between this run never
                # produces a stale participant list.
                bots = (await db.execute(select(BotConfig).where(BotConfig.status == BotStatus.ACTIVE))).scalars().all()

        if not bots:
            msg = (
                f"None of the requested bot_ids were found: {requested_bot_ids}" if requested_bot_ids
                else "No ACTIVE bots found to run a portfolio backtest against"
            )
            await _update_run(run_id, status=BacktestRunStatus.FAILED, error_message=msg, completed_at=datetime.now(timezone.utc))
            return

        resolved_bot_ids = [b.bot_id for b in bots]
        await _update_run(run_id, bot_ids=resolved_bot_ids, progress_pct=10.0)

        participants: List[PortfolioParticipant] = []
        per_bot_errors: Dict[str, str] = {}
        total = len(bots)
        for i, bot in enumerate(bots):
            if not bot.strategy_key or bot.strategy_key not in STRATEGY_FAMILY:
                per_bot_errors[bot.bot_id] = f"no recognized strategy_key ({bot.strategy_key!r})"
                continue
            symbol = bot.symbols[0] if bot.symbols else None
            if not symbol:
                per_bot_errors[bot.bot_id] = "no symbol configured"
                continue

            exchange = bot.exchange or "bingx"
            _bot_class, required = STRATEGY_FAMILY[bot.strategy_key]
            required_tf_labels = [label for _, label in required]
            base_tf = min(required_tf_labels, key=lambda l: TF_ORDER.index(l))

            # Same real-candle-fetch machinery isolated mode uses — no
            # reimplementation. No fake/synthetic data: a bot whose real
            # candles are genuinely unavailable for this window is a
            # real per-bot error surfaced on the completed run, never
            # silently skipped as if it simply produced zero signals.
            timeframe_candles, fetch_error = await fetch_required_timeframe_candles(
                shared_ingestion, exchange, symbol, required_tf_labels, start_date, end_date,
            )
            if fetch_error:
                per_bot_errors[bot.bot_id] = fetch_error
                continue

            base_candles = [c for c in timeframe_candles[base_tf] if c.timestamp >= start_date]
            bars = [Bar(timestamp=c.timestamp, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume) for c in base_candles]

            trailing_activation_r = bot.trailing_stop_activation if bot.use_trailing_stop else None
            adapter = SmcStrategyAdapter(
                real_bot_id=bot.bot_id, strategy_key=bot.strategy_key, symbol=symbol,
                timeframe_candles=timeframe_candles, account_balance=bot.account_balance_usd or 1000.0,
                risk_per_trade=bot.risk_per_trade, min_rr_ratio=bot.min_rr_ratio,
                tp1_percent=bot.tp1_percent, tp2_percent=bot.tp2_percent, tp3_percent=bot.tp3_percent,
                trailing_activation_r=trailing_activation_r, trailing_stop_mode=bot.trailing_stop_distance or "fixed",
            )
            participants.append(PortfolioParticipant(bot_id=bot.bot_id, symbol=symbol, adapter=adapter, bars=bars))
            await _update_run(run_id, progress_pct=10.0 + 50.0 * (i + 1) / total)

        if not participants:
            await _update_run(
                run_id, status=BacktestRunStatus.FAILED,
                error_message="No participating bot had usable real candle data: " + "; ".join(f"{k}: {v}" for k, v in per_bot_errors.items()),
                completed_at=datetime.now(timezone.utc),
            )
            return

        await _update_run(run_id, progress_pct=65.0)

        # Same placeholder-cost convention isolated mode uses (see
        # _DEFAULT_COST_MODELS' own comment above). A portfolio run can
        # mix exchanges across bots, so this only picks the forex model
        # when EVERY participating bot is forex-like — otherwise it
        # falls back to the crypto default, the same conservative,
        # labeled-as-assumption spirit, not a new blended model.
        all_forex = all((b.exchange or "bingx") in _FOREX_LIKE_BROKERS for b in bots)
        cost_model = _DEFAULT_COST_MODELS["forex" if all_forex else "crypto"]
        await _update_run(run_id, progress_pct=70.0, cost_model={"spread": cost_model.spread, "slippage": cost_model.slippage, "commission_r": cost_model.commission_r})

        engine = PortfolioBacktestEngine(cost_model=cost_model, max_hold_bars=2000)
        # Same reasoning as run_backtest's own fix above -- portfolio
        # mode replays every participating bot together against one
        # shared ledger, inherently sequential and typically heavier
        # than isolated mode, so this is the single most important of
        # these calls to keep off the event loop.
        result = await asyncio.get_event_loop().run_in_executor(None, engine.run, participants)

        await _update_run(run_id, progress_pct=85.0)

        async with LegacyAsyncSessionLocal() as db:
            if result.trades:
                # Same source='backtest' isolated mode already uses —
                # ClosedTradeORM has no DB-level CHECK constraint on
                # `source` (plain String column; confirmed by reading
                # the real column def), and this run row's own
                # scope='portfolio' is what actually distinguishes a
                # portfolio run's trades from an isolated run's for
                # later querying, not a new source value.
                await save_backtest_trades(db, result.trades, source="backtest")

        stats = _summarize_portfolio(result, per_bot_errors)
        await _update_run(
            run_id, status=BacktestRunStatus.COMPLETED, progress_pct=100.0,
            completed_at=datetime.now(timezone.utc), **stats,
        )
        logger.info("portfolio_backtest_run_completed", run_id=run_id, bot_ids=resolved_bot_ids, total_trades=stats["total_trades"])

    except Exception as e:
        # Same full-traceback-on-failure pattern run_backtest's own
        # except block uses — see its comment for why str(e) alone was
        # never enough to actually debug a real failure from
        # GET /backtests/{id} alone.
        tb = traceback.format_exc()
        logger.error("portfolio_backtest_run_failed", run_id=run_id, error=str(e), traceback=tb)
        await _update_run(
            run_id, status=BacktestRunStatus.FAILED,
            error_message=f"{e}\n\n{tb}"[:4000], completed_at=datetime.now(timezone.utc),
        )


def _summarize(trades: list) -> dict:
    if not trades:
        return {"total_trades": 0, "win_rate": None, "expectancy_r": None, "max_drawdown_pct": None, "equity_curve": []}

    total = len(trades)
    wins = sum(1 for t in trades if t.r_multiple > 0)
    win_rate = round(100.0 * wins / total, 2)
    expectancy_r = round(sum(t.r_multiple for t in trades) / total, 4)

    # Peak-to-trough drawdown over the CUMULATIVE R sequence (ordered
    # by exit time) — a dollar drawdown needs a real account-size
    # assumption this isolated-mode backtest deliberately doesn't make
    # (see the approved plan's "static per-bot balance, matches live"
    # decision); R-multiple drawdown is the honest equivalent that
    # doesn't require inventing one.
    ordered = sorted(trades, key=lambda t: t.exit_time)
    cum_r = 0.0
    peak = 0.0
    max_dd = 0.0
    equity_curve = []
    for t in ordered:
        cum_r += t.r_multiple
        peak = max(peak, cum_r)
        max_dd = max(max_dd, peak - cum_r)
        equity_curve.append({"timestamp": t.exit_time.isoformat(), "cum_r": round(cum_r, 4)})

    return {
        "total_trades": total, "win_rate": win_rate, "expectancy_r": expectancy_r,
        "max_drawdown_pct": round(max_dd, 4), "equity_curve": equity_curve,
    }


def _summarize_portfolio(result: PortfolioBacktestResult, per_bot_errors: Dict[str, str]) -> dict:
    """Portfolio-mode counterpart to _summarize above. Unlike isolated
    mode, a portfolio run has a real shared DOLLAR ledger
    (result.starting_balance/ending_balance) — no invented account-size
    assumption needed — so max_drawdown_pct here is a genuine
    peak-to-trough balance drawdown, expressed as a percent of peak
    balance (matching the existing column's own name), not the
    R-multiple proxy isolated mode's own _summarize settles for.

    `equity_curve` is deliberately a dict here, not isolated mode's own
    list-of-{timestamp,cum_r} — BacktestRunORM.equity_curve was always
    a generic JSON blob (see its own docstring), never schema-locked to
    one shape, so this is not a schema change. It carries everything a
    per-bot breakdown needs without a new column: the raw per-
    bot/symbol open/close event trace the engine itself already
    produces, a per-bot trade/win-rate/expectancy breakdown, the
    starting/ending balance and capital-adequacy-rejection count, and
    any per-bot data/strategy errors (so a bot excluded from this run
    for a real reason — not silently dropped — is still visible on the
    completed run, not just in a log line)."""
    trades = result.trades
    total = len(trades)

    if total == 0:
        return {
            "total_trades": 0, "win_rate": None, "expectancy_r": None, "max_drawdown_pct": None,
            "equity_curve": {
                "starting_balance": result.starting_balance, "ending_balance": result.ending_balance,
                "rejected_by_capital_adequacy": result.rejected_by_capital_adequacy,
                "events": result.equity_curve, "per_bot": {}, "errors": per_bot_errors,
            },
        }

    wins = sum(1 for t in trades if t.r_multiple > 0)
    win_rate = round(100.0 * wins / total, 2)
    expectancy_r = round(sum(t.r_multiple for t in trades) / total, 4)

    peak = result.starting_balance
    max_dd_pct = 0.0
    for point in result.equity_curve:
        bal = point["balance"]
        peak = max(peak, bal)
        if peak > 0:
            max_dd_pct = max(max_dd_pct, 100.0 * (peak - bal) / peak)

    per_bot: Dict[str, Dict] = {}
    for t in trades:
        b = per_bot.setdefault(t.bot_id, {"trades": 0, "wins": 0, "sum_r": 0.0})
        b["trades"] += 1
        b["wins"] += 1 if t.r_multiple > 0 else 0
        b["sum_r"] += t.r_multiple
    per_bot_summary = {
        bot_id: {
            "trades": b["trades"],
            "win_rate": round(100.0 * b["wins"] / b["trades"], 2),
            "expectancy_r": round(b["sum_r"] / b["trades"], 4),
        }
        for bot_id, b in per_bot.items()
    }

    return {
        "total_trades": total, "win_rate": win_rate, "expectancy_r": expectancy_r,
        "max_drawdown_pct": round(max_dd_pct, 4),
        "equity_curve": {
            "starting_balance": result.starting_balance, "ending_balance": result.ending_balance,
            "rejected_by_capital_adequacy": result.rejected_by_capital_adequacy,
            "events": result.equity_curve, "per_bot": per_bot_summary, "errors": per_bot_errors,
        },
    }
