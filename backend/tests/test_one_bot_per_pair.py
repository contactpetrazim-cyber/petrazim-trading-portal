"""Only one bot may hold a pair at a time: another bot's open or
awaiting-approval trade on the symbol blocks a new signal."""

import uuid
from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.bot_strategies import BotSignal
from app.database import Base
from app.models.trade import Trade, TradeDirection, TradeStatus
from app.services.execution_engine import ExecutionEngine


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


def _trade(bot_id, symbol, status):
    return Trade(trade_id=str(uuid.uuid4())[:20], bot_id=bot_id, symbol=symbol, status=status, strategy_type="smc",
                 direction=TradeDirection.LONG, entry_price=1.0, stop_loss=0.9, lot_size=1.0, risk_percent=1.0, risk_amount=10.0)


def _signal(bot_id, symbol):
    return BotSignal(bot_id=bot_id, bot_name=bot_id, symbol=symbol, direction="long", confidence=0.8, entry_price=100.0,
                     stop_loss=99.0, take_profit=103.0, lot_size=1.0, risk_percent=1.0, reasoning="t", timestamp=datetime.utcnow())


@pytest.mark.parametrize("status", [TradeStatus.ACTIVE, TradeStatus.PENDING])
async def test_other_bots_open_or_pending_trade_blocks_the_pair(db, status):
    db.add(_trade("bot_7_rec_btcusdt", "BTCUSDT.P", status))
    await db.commit()
    engine = ExecutionEngine.__new__(ExecutionEngine)
    result = await engine.process_signal(_signal("bot_3_rec_btcusdt", "BTCUSDT.P"), db=db)
    assert result["status"] == "pair_occupied" and "bot_7_rec_btcusdt" in result["message"]


async def test_closed_trades_other_pairs_and_manual_trades_do_not_block(db):
    db.add_all([
        _trade("bot_7_rec_btcusdt", "BTCUSDT.P", TradeStatus.CLOSED),
        _trade("bot_7_rec_btcusdt", "EURUSDT.P", TradeStatus.ACTIVE),
        _trade("manual_abc", "BTCUSDT.P", TradeStatus.ACTIVE),
    ])
    await db.commit()
    engine = ExecutionEngine.__new__(ExecutionEngine)
    try:
        result = await engine.process_signal(_signal("bot_3_rec_btcusdt", "BTCUSDT.P"), db=db)
        status = result.get("status")
    except Exception:
        status = "continued_past_guard"   # bare engine has no brokers; getting past the guard is the point
    assert status != "pair_occupied"
