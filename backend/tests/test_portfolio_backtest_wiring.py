"""
End-to-end test for the PORTFOLIO-mode ROUTER/RUNNER wiring added on
top of the already-tested PortfolioBacktestEngine (see
test_portfolio_backtest_engine.py, which tests the engine itself).
This file tests the NEW part: POST /api/backtests(scope="portfolio")
-> start_portfolio_backtest_run -> run_portfolio_backtest (the
asyncio.create_task background job) -> PortfolioBacktestEngine ->
BacktestRunORM/ClosedTradeORM persistence -> GET-able result.

Real production code runs throughout (the router's own validation,
start_portfolio_backtest_run, run_portfolio_backtest, the real
PortfolioBacktestEngine, save_backtest_trades) against real in-memory
sqlite tables for both declarative Bases this app actually uses. Only
the two genuinely external-data boundaries are faked, the same way
test_portfolio_backtest_engine.py already fakes its own adapters
rather than depending on a live exchange:
  - fetch_required_timeframe_candles: returns deterministic candles
    instead of a live ccxt fetch.
  - SmcStrategyAdapter: swapped for a fake that fires one deterministic
    signal per bot (same technique as that file's own
    FixedSignalOnceAdapter), instead of depending on the real SMC
    detection logic finding a real pattern in synthetic candles.
"""

from __future__ import annotations

import itertools
import uuid as uuid_module
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.schema import ColumnDefault
from sqlalchemy.sql.sqltypes import Uuid as _GenericUuid

import app.routers.backtests as backtests_router
import app.services.backtest_runner as backtest_runner
from app.database import Base as PrimaryBase
from app.db.session import Base as LegacyBase
from app.db.models import BacktestRunORM, BacktestRunStatus, ClosedTradeORM
from app.models.bot import BotConfig, BotStatus
from app.core.smc_algorithms import Candle


def make_candles(n: int, start: datetime, step_hours: int, base: float = 100.0):
    out, price = [], base
    for i in range(n):
        out.append(Candle(timestamp=start + timedelta(hours=i * step_hours), open=price, high=price + 1, low=price - 1, close=price, volume=1.0))
        price += 2.0  # steady uptrend -> the fake adapter's long signal should hit target
    return out


class FakeSignalOnceAdapter:
    """Duck-typed like the real SmcStrategyAdapter (same evaluate(window,
    context) signature) — fires exactly one long signal on the 2nd bar,
    sized against context["account_balance"], mirroring
    test_portfolio_backtest_engine.py's own FixedSignalOnceAdapter."""

    def __init__(self, real_bot_id, strategy_key=None, symbol=None, timeframe_candles=None, account_balance=1000.0, **kwargs):
        self.bot_id = real_bot_id
        self.fired = False

    def evaluate(self, window, context):
        from app.engines.backtest_engine import BacktestSignal
        if len(window) == 2 and not self.fired:
            self.fired = True
            entry = window.current.close
            balance = context["account_balance"]
            risk_amount = balance * 0.01
            lot_size = risk_amount / 10.0
            return BacktestSignal(
                direction="long", stop_price=entry - 10.0, target_price=entry + 20.0,
                bot_id=self.bot_id, lot_size=lot_size,
            )
        return None


async def fake_fetch_required_timeframe_candles(shared_ingestion, exchange, symbol, required_tf_labels, start_date, end_date):
    candles = {label: make_candles(40, start_date - timedelta(days=1), 4) for label in required_tf_labels}
    return candles, None


_ORIGINAL_UUID_BIND_PROCESSOR = _GenericUuid.bind_processor


def _lenient_uuid_bind_processor(self, dialect):
    """Test-only sqlite accommodation, not a production code change:
    SQLAlchemy's generic Uuid type (what postgresql.UUID(as_uuid=True)
    falls back to on a dialect with no native UUID support, i.e.
    sqlite here) requires an actual uuid.UUID instance to bind — it
    calls value.hex directly with no str coercion. Real production
    code always runs against real Postgres/asyncpg, which accepts the
    plain str ids this app passes everywhere (BacktestRunORM.id is
    always handled as `str(run.id)`); only sqlite is this strict, so
    this patches JUST the bind step to accept either, for this test
    file's in-memory sqlite only."""
    character_based_uuid = not dialect.supports_native_uuid or not self.native_uuid
    if character_based_uuid and self.as_uuid:
        def process(value):
            if value is not None:
                if isinstance(value, str):
                    value = uuid_module.UUID(value)
                value = value.hex
            return value
        return process
    return _ORIGINAL_UUID_BIND_PROCESSOR(self, dialect)


@pytest.fixture
async def dual_base_sessions(monkeypatch):
    """Spins up real in-memory sqlite tables for BOTH declarative Bases
    this app actually splits backtest state across (app.database.Base
    for bot_configs; app.db.session.Base for backtest_runs/
    closed_trades — see BacktestRunORM's own docstring for why), then
    monkeypatches backtest_runner's module-level session factories to
    point at them, exactly mirroring the real engine/session wiring
    main.py sets up at startup."""
    primary_engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False},
    )
    legacy_engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False},
    )
    # Only the specific tables this test touches — not the FULL
    # Base.metadata (which spans every model in the app, including
    # some using Postgres-only JSONB columns sqlite's compiler can't
    # render at all; this test doesn't need any of those).
    async with primary_engine.begin() as conn:
        await conn.run_sync(lambda c: PrimaryBase.metadata.create_all(c, tables=[BotConfig.__table__]))
    async with legacy_engine.begin() as conn:
        await conn.run_sync(lambda c: LegacyBase.metadata.create_all(c, tables=[BacktestRunORM.__table__, ClosedTradeORM.__table__]))

    PrimarySession = async_sessionmaker(primary_engine, expire_on_commit=False, class_=AsyncSession)
    LegacySession = async_sessionmaker(legacy_engine, expire_on_commit=False, class_=AsyncSession)

    monkeypatch.setattr(backtest_runner, "PrimaryAsyncSessionLocal", PrimarySession)
    monkeypatch.setattr(backtest_runner, "LegacyAsyncSessionLocal", LegacySession)
    monkeypatch.setattr(backtest_runner, "fetch_required_timeframe_candles", fake_fetch_required_timeframe_candles)
    monkeypatch.setattr(backtest_runner, "SmcStrategyAdapter", FakeSignalOnceAdapter)
    monkeypatch.setattr(_GenericUuid, "bind_processor", _lenient_uuid_bind_processor)

    # Another sqlite-only accommodation: closed_trades.id (BIGINT
    # primary key) is a real BIGSERIAL in production, set up by the
    # raw-SQL migration — main.py's create_all never recreates an
    # already-existing table, so the ORM column's own lack of an
    # explicit autoincrement default never matters there. Here, where
    # create_all is what actually builds the table, sqlite only
    # auto-increments a column declared exactly "INTEGER PRIMARY KEY"
    # (BIGINT doesn't qualify), so save_backtest_trades' real insert
    # (which never sets id itself, same as in production) needs an
    # explicit Python-side default for this test's table to accept it.
    id_counter = itertools.count(1)
    original_id_default = ClosedTradeORM.__table__.c.id.default
    ClosedTradeORM.__table__.c.id.default = ColumnDefault(lambda ctx: next(id_counter))

    yield PrimarySession, LegacySession

    ClosedTradeORM.__table__.c.id.default = original_id_default
    await primary_engine.dispose()
    await legacy_engine.dispose()


async def _make_bot(session: AsyncSession, bot_id: str, status: BotStatus = BotStatus.ACTIVE, symbol: str = "BTCUSDT") -> None:
    session.add(BotConfig(
        bot_id=bot_id, bot_name=bot_id, bot_type="smc", strategy_key="bot_1",
        status=status, symbols=[symbol], exchange="bingx",
        account_balance_usd=10_000.0, risk_per_trade=1.0, min_rr_ratio=1.5,
        tp1_percent=30.0, tp2_percent=40.0, tp3_percent=30.0, use_trailing_stop=False,
    ))
    await session.commit()


class FakeUser:
    def __init__(self, user_id="test-user"):
        self.id = user_id


class TestPortfolioBacktestWiring:
    async def test_run_portfolio_backtest_end_to_end_resolves_active_bots_and_persists(self, dual_base_sessions):
        """Direct runner-level test: start_portfolio_backtest_run creates
        the QUEUED row with bot_ids=None (meaning "all ACTIVE, resolved
        at run time"); run_portfolio_backtest must then resolve exactly
        the 2 ACTIVE bots (not the 1 INACTIVE one), fetch each one's
        candles, run them through the real PortfolioBacktestEngine, and
        persist a non-degenerate result."""
        PrimarySession, LegacySession = dual_base_sessions
        async with PrimarySession() as db:
            # Different symbols, deliberately: PortfolioBacktestEngine's
            # own trade_id scheme is f"{symbol}_{run_id}_{trade_counter}"
            # with trade_counter scoped per (bot_id, symbol) pair and
            # run_id shared across the WHOLE portfolio run — two bots
            # sharing a symbol can produce the same trade_id on their
            # respective first trade (a real latent collision in that
            # engine, out of scope for this wiring task to fix; flagged
            # in the PR instead). Distinct symbols keeps this test about
            # the wiring, not that pre-existing engine edge case.
            await _make_bot(db, "bot_a", BotStatus.ACTIVE, symbol="BTCUSDT")
            await _make_bot(db, "bot_b", BotStatus.ACTIVE, symbol="ETHUSDT")
            await _make_bot(db, "bot_c", BotStatus.PAUSED, symbol="SOLUSDT")  # not ACTIVE -> must be excluded from the resolved set

        start = datetime(2024, 1, 1)
        end = start + timedelta(days=5)
        run_id = await backtest_runner.start_portfolio_backtest_run(bot_ids=None, start_date=start, end_date=end, created_by="test-user")

        async with LegacySession() as db:
            row = await db.get(BacktestRunORM, run_id)
            assert row.scope == "portfolio"
            assert row.status == BacktestRunStatus.QUEUED
            assert row.bot_ids is None  # not yet resolved

        await backtest_runner.run_portfolio_backtest(run_id)

        async with LegacySession() as db:
            row = await db.get(BacktestRunORM, run_id)
            assert row.status == BacktestRunStatus.COMPLETED, row.error_message
            assert row.progress_pct == 100.0
            # Resolved fresh at run time to the real ACTIVE set only —
            # never request-time, never including the inactive bot.
            resolved = set(row.bot_ids or [])
            assert resolved == {"bot_a", "bot_b"}

            assert row.total_trades is not None and row.total_trades > 0, "a trending-up fake signal on 2 active bots should produce real trades, not an empty/degenerate result"
            assert row.win_rate is not None
            assert isinstance(row.equity_curve, dict)
            assert row.equity_curve["starting_balance"] == pytest.approx(10_000.0 * 2) or row.equity_curve["starting_balance"] > 0
            assert row.equity_curve["events"], "expected a non-empty per-bot/symbol open/close event trace"
            assert set(row.equity_curve["per_bot"].keys()) <= {"bot_a", "bot_b"}

            trades = (await db.execute(
                ClosedTradeORM.__table__.select().where(ClosedTradeORM.source == "backtest")
            )).fetchall()
            assert len(trades) == row.total_trades
            assert {t.bot_id for t in trades} <= {"bot_a", "bot_b"}

    async def test_explicit_bot_ids_subset_only_runs_those_bots(self, dual_base_sessions):
        PrimarySession, LegacySession = dual_base_sessions
        async with PrimarySession() as db:
            await _make_bot(db, "bot_a", BotStatus.ACTIVE, symbol="BTCUSDT")
            await _make_bot(db, "bot_b", BotStatus.ACTIVE, symbol="ETHUSDT")

        start = datetime(2024, 1, 1)
        end = start + timedelta(days=5)
        run_id = await backtest_runner.start_portfolio_backtest_run(bot_ids=["bot_a"], start_date=start, end_date=end)
        await backtest_runner.run_portfolio_backtest(run_id)

        async with LegacySession() as db:
            row = await db.get(BacktestRunORM, run_id)
            assert row.status == BacktestRunStatus.COMPLETED, row.error_message
            assert row.bot_ids == ["bot_a"]

    async def test_router_dispatches_portfolio_scope_end_to_end(self, dual_base_sessions, monkeypatch):
        """Router-level test: POST /api/backtests with scope="portfolio"
        validates the request, creates the run, and fires
        run_portfolio_backtest as a background task exactly like
        isolated mode fires run_backtest — called here as a plain
        coroutine (bypassing FastAPI's HTTP/dependency-injection layer,
        which carries no logic of its own beyond Depends lookups) with
        asyncio.create_task intercepted so the test can await the real
        background task deterministically instead of racing it."""
        PrimarySession, LegacySession = dual_base_sessions
        async with PrimarySession() as db:
            await _make_bot(db, "bot_a", BotStatus.ACTIVE)

        # `backtests_router.asyncio` IS the real, shared asyncio module
        # object (plain `import asyncio`) — patching an attribute ON IT
        # would corrupt real asyncio.create_task for everything else
        # running in this process, including SQLAlchemy's own asyncio
        # session internals (confirmed: doing that broke session
        # teardown with an unrelated "asyncio.shield" TypeError). Swap
        # the NAME `asyncio` inside backtests_router's own module
        # globals for a thin proxy instead, leaving the real module
        # alone everywhere else.
        import asyncio as real_asyncio

        class _FakeAsyncioModule:
            def __init__(self):
                self.scheduled = []

            def create_task(self, coro):
                self.scheduled.append(coro)

            def __getattr__(self, name):
                return getattr(real_asyncio, name)

        fake_asyncio = _FakeAsyncioModule()
        monkeypatch.setattr(backtests_router, "asyncio", fake_asyncio)
        scheduled = fake_asyncio.scheduled

        start = datetime(2024, 1, 1)
        end = start + timedelta(days=5)
        req = backtests_router.BacktestRunRequest(scope="portfolio", bot_ids=["bot_a"], start_date=start, end_date=end)

        async with PrimarySession() as primary_db, LegacySession() as legacy_db:
            resp = await backtests_router.create_backtest_run(req, user=FakeUser(), primary_db=primary_db, legacy_db=legacy_db)

        assert resp.scope == "portfolio"
        assert resp.status == "queued"
        assert len(scheduled) == 1

        await scheduled[0]  # run the real background task to completion

        async with LegacySession() as db:
            row = await db.get(BacktestRunORM, resp.id)
            assert row.status == BacktestRunStatus.COMPLETED, row.error_message
            assert row.total_trades and row.total_trades > 0

    async def test_router_rejects_bot_id_with_portfolio_scope(self, dual_base_sessions):
        from fastapi import HTTPException
        PrimarySession, LegacySession = dual_base_sessions
        start = datetime(2024, 1, 1)
        end = start + timedelta(days=5)
        req = backtests_router.BacktestRunRequest(scope="portfolio", bot_id="bot_a", start_date=start, end_date=end)

        async with PrimarySession() as primary_db, LegacySession() as legacy_db:
            with pytest.raises(HTTPException) as exc_info:
                await backtests_router.create_backtest_run(req, user=FakeUser(), primary_db=primary_db, legacy_db=legacy_db)
        assert exc_info.value.status_code == 400

    async def test_router_rejects_isolated_scope_without_bot_id(self, dual_base_sessions):
        from fastapi import HTTPException
        PrimarySession, LegacySession = dual_base_sessions
        start = datetime(2024, 1, 1)
        end = start + timedelta(days=5)
        req = backtests_router.BacktestRunRequest(scope="isolated", start_date=start, end_date=end)

        async with PrimarySession() as primary_db, LegacySession() as legacy_db:
            with pytest.raises(HTTPException) as exc_info:
                await backtests_router.create_backtest_run(req, user=FakeUser(), primary_db=primary_db, legacy_db=legacy_db)
        assert exc_info.value.status_code == 400
