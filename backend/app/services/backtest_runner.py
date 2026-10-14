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

from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from sqlalchemy import select

from app.database import AsyncSessionLocal as PrimaryAsyncSessionLocal
from app.db.session import AsyncSessionLocal as LegacyAsyncSessionLocal
from app.db.models import BacktestRunORM, BacktestRunStatus
from app.db.repository import save_backtest_trades
from app.models.bot import BotConfig
from app.services.data_ingestion import shared_ingestion
from app.engines.backtest_engine import BacktestEngine, Bar, CostModel
from app.engines.strategy_adapter import SmcStrategyAdapter, STRATEGY_FAMILY

logger = structlog.get_logger()

# ccxt timeframe strings, same mapping market_scanner.py's own
# _TIMEFRAME_TO_CCXT uses for the live scan.
_TF_TO_CCXT = {"1D": "1d", "4H": "4h", "1H": "1h", "15M": "15m", "5M": "5m"}
_TF_ORDER = ["1D", "4H", "1H", "15M", "5M"]

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

# Extra history fetched before `start_date` so the FIRST replayed bars
# still have real higher-timeframe context to read (swing/zone
# detectors need real lookback, not an artificially cold start) —
# candles in this padding window are fetched for every secondary
# timeframe, but the base/execution timeframe's own bar list passed to
# BacktestEngine is sliced to begin at start_date, so no trade can ever
# be entered before the requested window.
_LOOKBACK_PADDING_DAYS = 30


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
        base_tf = min(required_tf_labels, key=lambda l: _TF_ORDER.index(l))

        await _update_run(run_id, symbol=symbol, base_timeframe=base_tf, progress_pct=10.0)

        fetch_start = start_date - timedelta(days=_LOOKBACK_PADDING_DAYS)
        timeframe_candles = {}
        for label in required_tf_labels:
            candles = await shared_ingestion.fetch_historical_range(
                exchange, symbol, _TF_TO_CCXT[label], start=fetch_start, end=end_date,
            )
            timeframe_candles[label] = candles

        await _update_run(run_id, progress_pct=40.0)

        base_candles = [c for c in timeframe_candles[base_tf] if c.timestamp >= start_date]
        if not base_candles:
            await _update_run(
                run_id, status=BacktestRunStatus.FAILED,
                error_message=f"No {base_tf} candles returned for {symbol} on {exchange} in the requested window",
                completed_at=datetime.now(timezone.utc),
            )
            return
        bars = [Bar(timestamp=c.timestamp, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume) for c in base_candles]

        trailing_activation_r = bot.trailing_stop_activation if bot.use_trailing_stop else None
        adapter = SmcStrategyAdapter(
            real_bot_id=bot.bot_id, strategy_key=bot.strategy_key, symbol=symbol,
            timeframe_candles=timeframe_candles, account_balance=bot.account_balance_usd or 1000.0,
            risk_per_trade=bot.risk_per_trade, min_rr_ratio=bot.min_rr_ratio,
            tp1_percent=bot.tp1_percent, tp2_percent=bot.tp2_percent, tp3_percent=bot.tp3_percent,
            trailing_activation_r=trailing_activation_r,
        )

        cost_model = _DEFAULT_COST_MODELS["forex" if exchange in _FOREX_LIKE_BROKERS else "crypto"]
        await _update_run(run_id, progress_pct=50.0, cost_model={"spread": cost_model.spread, "slippage": cost_model.slippage, "commission_r": cost_model.commission_r})

        engine = BacktestEngine(cost_model=cost_model, max_hold_bars=2000)
        trades = engine.run(bars, adapter, symbol=symbol)

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
        logger.error("backtest_run_failed", run_id=run_id, error=str(e))
        await _update_run(run_id, status=BacktestRunStatus.FAILED, error_message=str(e)[:2000], completed_at=datetime.now(timezone.utc))


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
