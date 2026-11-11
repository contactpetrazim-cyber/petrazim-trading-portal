"""Instrument Focus engine — master modes, period expiry, ranking, and
the scanner actually dropping disallowed instruments."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models.bot import BotConfig, BotStatus
from app.models.platform_setting import PlatformSetting
from app.models.trade import Trade, TradeStatus, TradeDirection
from app.services import instrument_selection as focus


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        focus._invalidate_cache()
        yield session
    await engine.dispose()


def _bot(bot_id, symbols, user_id=None, status=BotStatus.ACTIVE):
    return BotConfig(bot_id=bot_id, bot_name=bot_id, bot_type="smc", strategy_key="_".join(bot_id.split("_")[:2]),
                     symbols=symbols, status=status, user_id=user_id)


def _trade(bot_id, symbol, r, when):
    return Trade(trade_id=str(uuid.uuid4())[:20], bot_id=bot_id, symbol=symbol, status=TradeStatus.CLOSED,
                 direction=TradeDirection.LONG, entry_price=1.0, stop_loss=0.9, r_multiple=r, strategy_type="smc",
                 lot_size=1.0, risk_percent=1.0, risk_amount=10.0,
                 realized_pnl=r * 10, entry_timestamp=when, created_at=when)


NOW = datetime(2026, 11, 11, 13, 30)  # Wednesday, London/NY overlap


# ── master mode ──────────────────────────────────────────────────────

async def test_limit_mode_defaults_to_three(db):
    mode = await focus.get_limit_mode(db)
    assert mode == {"mode": "limited", "custom_max": 3, "effective_max": 3}


async def test_limit_mode_custom_and_all(db):
    assert (await focus.set_limit_mode(db, "custom", 5))["effective_max"] == 5
    assert (await focus.get_limit_mode(db))["effective_max"] == 5
    assert (await focus.set_limit_mode(db, "all", 5))["effective_max"] is None
    with pytest.raises(ValueError):
        await focus.set_limit_mode(db, "bogus", 3)


# ── expiry ───────────────────────────────────────────────────────────

def test_expiry_per_period():
    assert focus.compute_expiry("perpetual", None, NOW) is None
    assert focus.compute_expiry("daily", None, NOW) == datetime(2026, 11, 12)
    assert focus.compute_expiry("weekly", None, NOW) == datetime(2026, 11, 16)  # next Monday
    assert focus.compute_expiry("monthly", None, NOW) == datetime(2026, 12, 1)
    assert focus.compute_expiry("monthly", None, datetime(2026, 12, 20)) == datetime(2027, 1, 1)
    # 13:30 is inside both London and New York -> the later-opening one wins.
    assert focus.current_session(NOW) == "new_york"
    assert focus.compute_expiry("session", None, NOW) == datetime(2026, 11, 11, 21)
    assert focus.compute_expiry("session", "london", NOW) == datetime(2026, 11, 11, 16)
    # Asia already closed today -> its next run tomorrow.
    assert focus.compute_expiry("session", "asia", NOW) == datetime(2026, 11, 12, 8)
    # The 21-24 UTC gap has no open session -> next to open is Asia.
    assert focus.current_session(datetime(2026, 11, 11, 22)) is None
    assert focus.next_session(datetime(2026, 11, 11, 22)) == "asia"


# ── ranking ──────────────────────────────────────────────────────────

async def test_suggestions_rank_by_evidence_weighted_expectancy(db):
    old = NOW - timedelta(days=40)
    db.add_all(
        [_trade("bot_3_a", "BTC", 2.0, old) for _ in range(9)]       # strong, large sample
        + [_trade("bot_2_a", "EUR", 3.0, old) for _ in range(3)]     # strong, tiny sample
        + [_trade("bot_8_a", "NAS", -0.5, old) for _ in range(9)]    # negative edge
    )
    await db.commit()
    ranked = await focus.compute_suggestions(db, ["BTC", "EUR", "NAS", "OIL"], None, "perpetual", None, NOW)
    assert [r["symbol"] for r in ranked] == ["BTC", "EUR", "NAS", "OIL"]
    assert ranked[0]["best_bots"][0]["family"] == "bot_3"
    assert ranked[2]["score"] == 0.0 and "No bot family has a positive edge" in ranked[2]["reason"]
    assert ranked[3]["n"] == 0


async def test_session_suggestions_only_count_trades_inside_the_session(db):
    asia_ts = datetime(2026, 11, 10, 3)
    ny_ts = datetime(2026, 11, 10, 15)
    db.add_all([_trade("bot_3_a", "JPY", 2.0, asia_ts) for _ in range(5)] + [_trade("bot_3_b", "NAS", 2.0, ny_ts) for _ in range(5)])
    await db.commit()
    asia = await focus.compute_suggestions(db, ["JPY", "NAS"], None, "session", "asia", NOW)
    assert asia[0]["symbol"] == "JPY" and asia[1]["n"] == 0


async def test_suggestions_scoped_to_owner_bots(db):
    db.add_all([_trade("bot_3_mine", "BTC", 1.0, NOW) for _ in range(5)] + [_trade("bot_3_theirs", "EUR", 5.0, NOW) for _ in range(5)])
    await db.commit()
    ranked = await focus.compute_suggestions(db, ["BTC", "EUR"], ["bot_3_mine"], "perpetual", None, NOW)
    eur = next(r for r in ranked if r["symbol"] == "EUR")
    assert eur["n"] == 0  # another trader's results never leak into my ranking


# ── resolution ───────────────────────────────────────────────────────

async def test_resolve_live_selection_then_lapse_to_auto(db):
    bots = [_bot("bot_3_x", ["BTC", "EUR", "JPY", "NAS"])]
    db.add_all(bots)
    db.add_all([_trade("bot_3_x", s, 1.0, NOW) for s in ("BTC", "EUR", "JPY", "NAS") for _ in range(3)])
    await db.commit()

    await focus.save_selection(db, "platform", ["NAS"], "daily", None, set_by="t", now=NOW)
    got = await focus.resolve_allowed_symbols(db, "platform", bots, NOW)
    assert got["source"] == "selection" and got["symbols"] == {"NAS"}

    # Next day the daily pick has lapsed -> auto-pick top 3, never "nothing".
    focus._invalidate_cache()
    lapsed = await focus.resolve_allowed_symbols(db, "platform", bots, NOW + timedelta(days=1))
    assert lapsed["source"] == "auto" and len(lapsed["symbols"]) == 3


async def test_resolve_all_mode_is_unrestricted(db):
    await focus.set_limit_mode(db, "all", 3)
    got = await focus.resolve_allowed_symbols(db, "platform", [_bot("bot_3_x", ["BTC"])], NOW)
    assert got == {"symbols": None, "source": "all", "max": None, "expires_at": None}


async def test_selection_is_capped_to_current_max(db):
    bots = [_bot("bot_3_x", ["A", "B", "C", "D"])]
    await focus.set_limit_mode(db, "custom", 4)
    await focus.save_selection(db, "platform", ["A", "B", "C", "D"], "perpetual", None, set_by="t", now=NOW)
    await focus.set_limit_mode(db, "limited", 4)  # admin tightens the cap later
    got = await focus.resolve_allowed_symbols(db, "platform", bots, NOW)
    assert got["symbols"] == {"A", "B", "C"}


async def test_candidates_prefer_active_bots(db):
    owner = uuid.uuid4()
    db.add_all([_bot("bot_3_on", ["BTC"], owner), _bot("bot_3_off", ["EUR"], owner, BotStatus.PAUSED)])
    await db.commit()
    symbols, bots = await focus.candidate_symbols_for_owner(db, str(owner))
    assert symbols == ["BTC"] and [b.bot_id for b in bots] == ["bot_3_on"]


# ── scanner integration ──────────────────────────────────────────────

async def test_scanner_drops_symbols_outside_the_focus(db, monkeypatch):
    from app.services import exchange_engine
    from app.services.market_scanner import MarketScanner

    async def fixed_exchange(_db, bot, symbol, default):
        return default, "fixed"
    monkeypatch.setattr(exchange_engine, "resolve_exchange", fixed_exchange)

    db.add(_bot("bot_3_x", ["BTC", "EUR", "JPY", "NAS"]))
    await db.commit()
    await focus.save_selection(db, "platform", ["EUR", "NAS"], "perpetual", None, set_by="t")

    scanner = MarketScanner.__new__(MarketScanner)
    groups = await scanner._current_scan_groups(db)
    assert sorted(sym for _ex, sym in groups) == ["EUR", "NAS"]

    await focus.set_limit_mode(db, "all", 3)
    groups = await scanner._current_scan_groups(db)
    assert sorted(sym for _ex, sym in groups) == ["BTC", "EUR", "JPY", "NAS"]


async def test_fresh_trader_roster_ranks_off_retired_bots_history(db):
    """A brand-new active roster has zero trades of its own; the ranking
    must still use the owner's paused bots' history, not fall back to
    alphabetical order."""
    from app.models.user import User, UserRole
    owner = uuid.uuid4()
    db.add(User(id=owner, email="t@example.com", full_name="T", role=UserRole.TRADER, hashed_password="x"))
    db.add_all([
        _bot("bot_3_old", ["AAA", "ZZZ"], owner, BotStatus.PAUSED),
        _bot("bot_3_rec_new", ["AAA", "ZZZ"], owner),
    ])
    db.add_all([_trade("bot_3_old", "ZZZ", 2.0, NOW) for _ in range(5)])
    await db.commit()
    await focus.set_limit_mode(db, "custom", 1)
    _, active = await focus.candidate_symbols_for_owner(db, str(owner))
    got = await focus.resolve_allowed_symbols(db, str(owner), active, NOW)
    assert got["source"] == "auto" and got["symbols"] == {"ZZZ"}
