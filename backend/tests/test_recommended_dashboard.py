"""Recommended Bots dashboard: baseline = pre-rollout evidence of the same
family on the same instrument; live = the recommended bot's own trades."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models.bot import BotConfig, BotStatus
from app.models.trade import ExitType, Trade, TradeDirection, TradeStatus
from app.services.recommended_dashboard import build_dashboard

ROLLOUT = datetime(2026, 11, 11, 12)


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


def _bot(bot_id, symbol, created=ROLLOUT, owner=None):
    return BotConfig(bot_id=bot_id, bot_name=f"Recommended · {bot_id} · {symbol}", bot_type="smc",
                     strategy_key="_".join(bot_id.split("_")[:2]), symbols=[symbol],
                     status=BotStatus.ACTIVE, created_at=created, user_id=owner)


def _trade(bot_id, symbol, r, when, exit_type=ExitType.TP1):
    return Trade(trade_id=str(uuid.uuid4())[:20], bot_id=bot_id, symbol=symbol, status=TradeStatus.CLOSED,
                 direction=TradeDirection.LONG, entry_price=1.0, stop_loss=0.9, r_multiple=r, strategy_type="smc",
                 lot_size=1.0, risk_percent=1.0, risk_amount=10.0, realized_pnl=r * 10,
                 created_at=when, exit_timestamp=when + timedelta(hours=1), exit_type=exit_type)


async def test_baseline_is_pre_rollout_family_evidence_and_live_is_own_trades(db):
    db.add_all([_bot("bot_3_rec_btc", "BTC"), _bot("bot_3_fvg_expansion", "BTC", ROLLOUT - timedelta(days=90))])
    before = ROLLOUT - timedelta(days=5)
    db.add_all([_trade("bot_3_fvg_expansion", "BTC", 2.0, before) for _ in range(4)])
    db.add(_trade("bot_7_other", "BTC", -1.0, before))               # other family -> not baseline
    db.add(_trade("bot_3_fvg_expansion", "BTC", -1.0, ROLLOUT + timedelta(days=1)))  # post-rollout -> not baseline
    db.add_all([_trade("bot_3_rec_btc", "BTC", r, ROLLOUT + timedelta(days=d)) for d, r in enumerate([1.0, -1.0, 3.0], 1)])
    await db.commit()

    out = await build_dashboard(db, now=ROLLOUT + timedelta(days=10))
    [bot] = out["bots"]
    assert bot["baseline"]["n"] == 4 and bot["baseline"]["avg_r"] == 2.0 and bot["baseline"]["evidence_score"] == 4.0
    assert bot["live"]["n"] == 3 and bot["live"]["total_r"] == 3.0
    assert bot["live"]["max_drawdown_r"] == 1.0
    assert bot["verdict"]["key"] == "early"            # < 5 trades: no verdict
    assert [p["cum_r"] for p in out["equity"]] == [1.0, 0.0, 3.0]
    assert out["days_live"] == 10
    assert sum(b["count"] for b in out["r_distribution"]) == 3


async def test_verdicts_and_review_recommendation(db):
    db.add(_bot("bot_8_rec_jpy", "JPY"))
    db.add_all([_trade("bot_8_old", "JPY", 0.5, ROLLOUT - timedelta(days=3)) for _ in range(6)])
    db.add_all([_trade("bot_8_rec_jpy", "JPY", -1.0, ROLLOUT + timedelta(hours=h)) for h in range(1, 11)])
    await db.commit()
    out = await build_dashboard(db, now=ROLLOUT + timedelta(days=3))
    assert out["bots"][0]["verdict"]["key"] == "review"
    assert out["recommendations"][0]["priority"] == 1 and "Pause" in out["recommendations"][0]["action"]
    assert out["insights"][0]["level"] == "critical"


async def test_scoped_to_owner_and_empty_state(db):
    mine, theirs = uuid.uuid4(), uuid.uuid4()
    db.add_all([_bot("bot_3_rec_a", "BTC", owner=mine), _bot("bot_3_rec_b", "EUR", owner=theirs), _bot("bot_3_plain", "BTC", owner=mine)])
    await db.commit()
    out = await build_dashboard(db, owner_ids=[mine])
    assert [b["bot_id"] for b in out["bots"]] == ["bot_3_rec_a"]
    empty = await build_dashboard(db, owner_ids=[uuid.uuid4()])
    assert empty["bots"] == [] and empty["totals"] is None
