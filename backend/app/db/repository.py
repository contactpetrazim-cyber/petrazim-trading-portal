"""
Repository — real DB queries
==============================

This is where "wire it to your real database" actually happens. Every
function here does one real query and converts the result into the
dataclasses the engines already understand. If your schema differs
from migrations/001_create_core_tables.sql, this is the file to edit —
change the query, not the return type, and every router/engine keeps
working unmodified.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ClosedTradeORM, GateAttestationORM, JournalEntryORM, RejectedSignalORM
from app.engines.backtest_engine import ClosedBacktestTrade
from app.engines.monte_carlo_engine import TradeRecord
from app.engines.weekly_review_engine import EmotionalJournalEntry, RejectedSignal, TakenTrade
from app.core.attestation_store import AttestationRecord
from app.models.trade import Trade, TradeStatus


# --------------------------------------------------------------------------
# Monte Carlo engine data source
# --------------------------------------------------------------------------

async def load_trade_history(
    db: AsyncSession, bot_id: Optional[str] = None, user_id: Optional[str] = None,
) -> List[TradeRecord]:
    """Live trades only — this is what the Monte Carlo forecast is built
    from. Queries the app's real `trades` table (models/trade.py) directly
    rather than the closed_trades side-table below: nothing in the live
    execution path ever wrote a "source=live" row there, so that version
    of this function silently returned an empty history no matter how
    many real trades existed. user_id scopes to one Trader's own trades;
    omit it (Admin/Super Admin only) to forecast across the whole
    platform, matching every other router's staff-see-all convention."""
    stmt = select(Trade).where(Trade.status == TradeStatus.CLOSED, Trade.r_multiple.isnot(None))
    if bot_id:
        stmt = stmt.where(Trade.bot_id == bot_id)
    if user_id:
        stmt = stmt.where(Trade.user_id == user_id)
    stmt = stmt.order_by(Trade.exit_timestamp)
    rows = (await db.execute(stmt)).scalars().all()

    return [
        TradeRecord(
            trade_id=r.trade_id, r_multiple=r.r_multiple, bot_id=r.bot_id, symbol=r.symbol,
            timestamp=(r.exit_timestamp.isoformat() if r.exit_timestamp else ""),
        )
        for r in rows
    ]


# --------------------------------------------------------------------------
# Validation gate data sources
# --------------------------------------------------------------------------

async def load_backtest_trades(db: AsyncSession, bot_id: str) -> List[TradeRecord]:
    stmt = select(ClosedTradeORM).where(
        ClosedTradeORM.source == "backtest", ClosedTradeORM.bot_id == bot_id
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        TradeRecord(trade_id=r.trade_id, r_multiple=r.r_multiple,
                    bot_id=r.bot_id, symbol=r.symbol, timestamp=r.exit_time.isoformat())
        for r in rows
    ]


async def load_cost_stressed_trades(db: AsyncSession, bot_id: str) -> Optional[List[TradeRecord]]:
    stmt = select(ClosedTradeORM).where(
        ClosedTradeORM.source == "backtest_cost_stress", ClosedTradeORM.bot_id == bot_id
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return None  # correctly reports as "not evaluated" rather than an empty pass
    return [
        TradeRecord(trade_id=r.trade_id, r_multiple=r.r_multiple,
                    bot_id=r.bot_id, symbol=r.symbol, timestamp=r.exit_time.isoformat())
        for r in rows
    ]


async def load_parameter_variant_trades(db: AsyncSession, bot_id: str) -> Optional[List[List[TradeRecord]]]:
    stmt = select(ClosedTradeORM).where(
        ClosedTradeORM.source == "backtest_param_variant", ClosedTradeORM.bot_id == bot_id
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return None

    by_group: dict[str, List[TradeRecord]] = {}
    for r in rows:
        group = r.variant_group or "default"
        by_group.setdefault(group, []).append(
            TradeRecord(trade_id=r.trade_id, r_multiple=r.r_multiple,
                        bot_id=r.bot_id, symbol=r.symbol, timestamp=r.exit_time.isoformat())
        )
    return list(by_group.values())


async def save_backtest_trades(
    db: AsyncSession, trades: List[ClosedBacktestTrade], source: str, variant_group: Optional[str] = None
) -> None:
    """Persists BacktestEngine output so the validation gate can read it back later.
    `source` should be 'backtest', 'backtest_cost_stress', or 'backtest_param_variant'."""
    for t in trades:
        db.add(ClosedTradeORM(
            trade_id=t.trade_id, bot_id=t.bot_id, symbol=t.symbol, direction=t.direction,
            entry_price=t.entry_price, exit_price=t.exit_price, stop_price=t.stop_price,
            r_multiple=t.r_multiple, entry_time=t.entry_time, exit_time=t.exit_time,
            exit_reason=t.exit_reason, source=source, variant_group=variant_group,
            created_at=datetime.now(timezone.utc),
        ))
    await db.commit()


# --------------------------------------------------------------------------
# Weekly review data sources
# --------------------------------------------------------------------------

_EXIT_TYPE_TO_REASON = {
    "tp1": "target", "tp2": "target", "tp3": "target", "trailing": "target",
    "stop_loss": "stop", "manual": "manual_close", "structure": "timeout",
}


async def load_taken_trades(
    db: AsyncSession, week_start: datetime, week_end: datetime,
    bot_id: Optional[str] = None, user_id: Optional[str] = None,
) -> List[TakenTrade]:
    """Same fix as load_trade_history above and for the same reason:
    ClosedTradeORM(source='live') is never written by the live execution
    path, so this used to silently return an empty week every time no
    matter how many real trades closed. Queries the real `trades` table
    directly instead."""
    stmt = select(Trade).where(
        Trade.status == TradeStatus.CLOSED, Trade.r_multiple.isnot(None),
        Trade.exit_timestamp >= week_start, Trade.exit_timestamp <= week_end,
    )
    if bot_id:
        stmt = stmt.where(Trade.bot_id == bot_id)
    if user_id:
        stmt = stmt.where(Trade.user_id == user_id)
    rows = (await db.execute(stmt)).scalars().all()

    return [
        TakenTrade(
            trade_id=r.trade_id, bot_id=r.bot_id, symbol=r.symbol,
            direction=r.direction.value if r.direction else "long",
            entry_price=r.entry_price or 0.0, exit_price=r.exit_price or 0.0,
            stop_price=r.stop_loss, r_multiple=r.r_multiple,
            entry_time=r.entry_timestamp, exit_time=r.exit_timestamp,
            # exit_type has no exact 1:1 mapping onto the engine's
            # target/stop/timeout/manual_close vocabulary (STRUCTURE in
            # particular is an approximation, mapped to "timeout") — flag
            # if the engine's grading needs a finer-grained real reason.
            exit_reason=_EXIT_TYPE_TO_REASON.get(
                r.exit_type.value if r.exit_type else "", "manual_close"
            ),
            entry_rationale=r.reasoning_log or "",
        )
        for r in rows
    ]


async def load_rejected_signals(
    db: AsyncSession, week_start: datetime, week_end: datetime, bot_id: Optional[str] = None
) -> List[RejectedSignal]:
    stmt = select(RejectedSignalORM).where(
        RejectedSignalORM.signal_time >= week_start, RejectedSignalORM.signal_time <= week_end,
    )
    if bot_id:
        stmt = stmt.where(RejectedSignalORM.bot_id == bot_id)
    rows = (await db.execute(stmt)).scalars().all()

    return [
        RejectedSignal(
            signal_id=r.signal_id, bot_id=r.bot_id, symbol=r.symbol, direction=r.direction,
            timestamp=r.signal_time, entry_price_at_signal=r.entry_price_at_signal,
            stop_price=r.stop_price, target_price=r.target_price,
            rejection_reason=r.rejection_reason, rationale_at_signal=r.rationale_at_signal,
        )
        for r in rows
    ]


async def load_journal_entries(
    db: AsyncSession, week_start: datetime, week_end: datetime
) -> List[EmotionalJournalEntry]:
    stmt = select(JournalEntryORM).where(
        JournalEntryORM.entry_date >= week_start, JournalEntryORM.entry_date <= week_end,
    )
    rows = (await db.execute(stmt)).scalars().all()

    return [
        EmotionalJournalEntry(
            entry_id=r.entry_id, date=r.entry_date, mood_tag=r.mood_tag,
            trade_id=r.trade_id, notes=r.notes,
        )
        for r in rows
    ]


# --------------------------------------------------------------------------
# Attestations (audit trail for the go-live gate)
# --------------------------------------------------------------------------

async def save_attestation(db: AsyncSession, record: AttestationRecord) -> AttestationRecord:
    db.add(GateAttestationORM(
        bot_id=record.bot_id, check_name=record.check_name, passed=record.passed,
        signed_by=record.signed_by, signed_at=record.signed_at, notes=record.notes,
    ))
    await db.commit()
    return record


async def get_latest_attestation(db: AsyncSession, bot_id: str, check_name: str) -> Optional[AttestationRecord]:
    stmt = (
        select(GateAttestationORM)
        .where(GateAttestationORM.bot_id == bot_id, GateAttestationORM.check_name == check_name)
        .order_by(GateAttestationORM.signed_at.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).scalars().first()
    if row is None:
        return None
    return AttestationRecord(
        bot_id=row.bot_id, check_name=row.check_name, passed=row.passed,
        signed_by=row.signed_by, signed_at=row.signed_at, notes=row.notes,
    )


async def list_attestations_for_bot(db: AsyncSession, bot_id: str) -> List[AttestationRecord]:
    stmt = (
        select(GateAttestationORM)
        .where(GateAttestationORM.bot_id == bot_id)
        .order_by(GateAttestationORM.signed_at.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        AttestationRecord(bot_id=r.bot_id, check_name=r.check_name, passed=r.passed,
                           signed_by=r.signed_by, signed_at=r.signed_at, notes=r.notes)
        for r in rows
    ]
