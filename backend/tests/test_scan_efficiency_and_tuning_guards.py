"""Scan efficiency (skip unused strategies, fetch only needed timeframes),
per-bot strategy params, and the Intelligent-tuning guards that protect
the one-instrument Recommended Bots roster."""

from dataclasses import dataclass
from typing import Optional

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.bot_strategies import BOT_REGISTRY, BotOrchestrator
from app.database import Base
from app.models.bot import BotConfig, BotMode, BotStatus
from app.services import intelligent_tuning_worker as itw
from app.services.market_scanner import required_timeframes


@dataclass
class FakeBot:
    bot_id: str
    strategy_key: Optional[str]


# ── run_all ──────────────────────────────────────────────────────────

def _spy_orchestrator(monkeypatch):
    calls = []
    orch = BotOrchestrator({})

    class Spy:
        def __init__(self, key, params):
            self.key, self.params = key, params

        def analyze(self, *args, **kwargs):
            calls.append((self.key, kwargs.get("bot_id"), self.params))
            return None

    monkeypatch.setattr(orch, "_instance_for", lambda key, params: Spy(key, params))
    return orch, calls


def _full_market_data():
    return {"symbol": "BTCUSDT.P", "1D": [], "4H": [], "1H": [], "15M": [], "5M": []}


def test_scanner_path_runs_only_families_with_bots(monkeypatch):
    orch, calls = _spy_orchestrator(monkeypatch)
    settings = {"bot_3": [{"bot_id": "bot_3_rec_btc", "strategy_params": {}}],
                "bot_7": [{"bot_id": "bot_7_rec_btc", "strategy_params": {}}]}
    orch.run_all(_full_market_data(), 1000.0, settings)
    assert sorted(k for k, _b, _p in calls) == ["bot_3", "bot_7"]


def test_preview_path_without_bot_settings_still_runs_everything(monkeypatch):
    orch, calls = _spy_orchestrator(monkeypatch)
    orch.run_all(_full_market_data(), 1000.0)
    assert {k for k, _b, _p in calls} == set(BOT_REGISTRY)


def test_each_bot_runs_with_its_own_params(monkeypatch):
    orch, calls = _spy_orchestrator(monkeypatch)
    settings = {"bot_3": [{"bot_id": "a", "strategy_params": {"left_bars": 4}},
                          {"bot_id": "b", "strategy_params": {"left_bars": 6}}]}
    orch.run_all(_full_market_data(), 1000.0, settings)
    assert {(b, p["left_bars"]) for _k, b, p in calls} == {("a", 4), ("b", 6)}


def test_instance_for_builds_from_params_and_caches():
    orch = BotOrchestrator({})
    a1 = orch._instance_for("bot_3", {"left_bars": 4})
    a2 = orch._instance_for("bot_3", {"left_bars": 4})
    b = orch._instance_for("bot_3", {"left_bars": 6})
    assert a1 is a2 and a1 is not b
    assert orch._instance_for("bot_3", None) is orch.bots["bot_3"]


# ── timeframes ───────────────────────────────────────────────────────

def test_required_timeframes_is_the_union_of_strategy_needs():
    assert required_timeframes([FakeBot("bot_3_rec_btc", "bot_3"), FakeBot("bot_7_rec_btc", "bot_7")]) == {"1H", "15M"}
    assert required_timeframes([FakeBot("bot_8_rec_jpy", "bot_8"), FakeBot("bot_3_rec_jpy", "bot_3")]) == {"1H", "15M", "5M"}
    assert required_timeframes([FakeBot("bot_12_rec_xaut", "bot_2")]) == {"4H", "1H", "15M"}


def test_unknown_strategy_falls_back_to_fetching_everything():
    assert required_timeframes([FakeBot("bot_3_x", "bot_3"), FakeBot("mystery", "bot_999")]) is None


# ── Intelligent tuning guards ────────────────────────────────────────

@pytest.fixture
async def session_factory(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(itw, "AsyncSessionLocal", factory)
    yield factory
    await engine.dispose()


def _bot(bot_id, key, symbols, status=BotStatus.ACTIVE):
    return BotConfig(bot_id=bot_id, bot_name=bot_id, bot_type="smc", strategy_key=key, symbols=symbols,
                     status=status, bot_mode=BotMode.INTELLIGENT)


async def test_run_once_tunes_only_active_bots(session_factory, monkeypatch):
    async with session_factory() as db:
        db.add_all([_bot("bot_17_live", "bot_17", ["BTC"]), _bot("bot_17_paused", "bot_17", ["EUR"], BotStatus.PAUSED)])
        await db.commit()
    worker = itw.IntelligentTuningWorker()
    tuned = []

    async def no_kill(_bot_id):
        return False

    async def record(bot_id):
        tuned.append(bot_id)

    async def noop(_bot_id):
        return None

    monkeypatch.setattr(worker, "_check_kill_switch", no_kill)
    monkeypatch.setattr(worker, "_tune_one_bot", record)
    monkeypatch.setattr(worker, "_tune_zone_variant_for_bot", noop)
    await worker.run_once()
    assert tuned == ["bot_17_live"]


async def test_zone_moves_never_touch_recommended_bots(session_factory, monkeypatch):
    async with session_factory() as db:
        db.add_all([
            _bot("bot_17_rec_xaut", "bot_17", ["XAUT"]),     # recommended source
            _bot("bot_3_rec_btc", "bot_3", ["BTC"]),          # recommended target only
            _bot("bot_17_plain", "bot_17", ["EUR"]),          # ordinary source
        ])
        await db.commit()
    worker = itw.IntelligentTuningWorker()
    attempted = []

    async def capture(bot, sibling_bot, symbol, lookback):
        attempted.append((bot.bot_id, sibling_bot.bot_id, symbol))

    monkeypatch.setattr(worker, "_tune_zone_variant_for_symbol", capture)
    await worker._tune_zone_variant_for_bot("bot_17_rec_xaut")   # recommended -> never moves
    await worker._tune_zone_variant_for_bot("bot_17_plain")      # only sibling is recommended -> nowhere to move
    assert attempted == []

    async with session_factory() as db:
        db.add(_bot("bot_3_plain", "bot_3", ["NAS"]))
        await db.commit()
    await worker._tune_zone_variant_for_bot("bot_17_plain")      # a non-recommended sibling exists -> allowed
    assert attempted == [("bot_17_plain", "bot_3_plain", "EUR")]


# ── HTF candle cache ─────────────────────────────────────────────────

from datetime import datetime, timedelta

from app.services.market_scanner import MarketScanner, htf_cache_is_fresh


def test_htf_cache_freshness_rules():
    t = datetime(2026, 11, 11, 13, 5)
    assert htf_cache_is_fresh("4H", t, t + timedelta(minutes=10))
    assert not htf_cache_is_fresh("4H", t, t + timedelta(minutes=16))          # max age
    assert not htf_cache_is_fresh("4H", datetime(2026, 11, 11, 11, 58), datetime(2026, 11, 11, 12, 1))  # new 4H bar opened
    assert htf_cache_is_fresh("1D", t, t + timedelta(minutes=50))
    assert not htf_cache_is_fresh("1D", datetime(2026, 11, 11, 23, 50), datetime(2026, 11, 12, 0, 5))  # new day


class _FakeIngestion:
    def __init__(self):
        self.calls = []

    async def fetch_historical_ccxt(self, exchange, symbol, timeframe, limit):
        self.calls.append(timeframe)
        return [object()]


async def test_scanner_serves_htf_from_cache_and_fetches_fast_tfs_live():
    scanner = MarketScanner.__new__(MarketScanner)
    scanner.ingestion = _FakeIngestion()
    scanner._htf_cache = {}
    wanted = {"1H", "15M", "4H", "1D"}
    first = await scanner._fetch_market_data("bingx", "BTCUSDT.P", wanted)
    second = await scanner._fetch_market_data("bingx", "BTCUSDT.P", wanted)
    assert set(first) == set(second) == {"symbol", "1H", "15M", "4H", "1D"}
    assert sorted(scanner.ingestion.calls) == sorted(["1h", "15m", "4h", "1d", "1h", "15m"])  # 4H/1D fetched once
    assert "5m" not in scanner.ingestion.calls
