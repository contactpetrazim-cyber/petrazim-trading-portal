"""
ORM Models
===========

Mirrors migrations/001_create_core_tables.sql exactly — column for
column. If your real schema differs (different table/column names),
this is the file to edit: change the `Column(...)` definitions to
match your actual database, not the migration or the engines. The
engines only ever see the dataclasses (TradeRecord, TakenTrade, etc.)
from app/engines/*, never these ORM classes directly — that boundary
is what makes it possible to point this at a differently-shaped
existing schema without touching engine code at all.
"""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import BIGINT, UUID

from app.db.session import Base


class ClosedTradeORM(Base):
    __tablename__ = "closed_trades"

    id = Column(BIGINT, primary_key=True)
    trade_id = Column(String, unique=True, nullable=False)
    bot_id = Column(String, nullable=True)
    symbol = Column(String, nullable=False)
    direction = Column(String, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    stop_price = Column(Float, nullable=False)
    r_multiple = Column(Float, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    exit_reason = Column(String, nullable=False)
    entry_rationale = Column(Text, nullable=False, default="")
    source = Column(String, nullable=False, default="live")
    variant_group = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class RejectedSignalORM(Base):
    __tablename__ = "rejected_signals"

    id = Column(BIGINT, primary_key=True)
    signal_id = Column(String, unique=True, nullable=False)
    bot_id = Column(String, nullable=True)
    symbol = Column(String, nullable=False)
    direction = Column(String, nullable=False)
    signal_time = Column(DateTime(timezone=True), nullable=False)
    entry_price_at_signal = Column(Float, nullable=False)
    stop_price = Column(Float, nullable=False)
    target_price = Column(Float, nullable=False)
    rejection_reason = Column(String, nullable=False)
    rationale_at_signal = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False)


class JournalEntryORM(Base):
    __tablename__ = "journal_entries"

    id = Column(BIGINT, primary_key=True)
    entry_id = Column(String, unique=True, nullable=False)
    trade_id = Column(String, nullable=True)
    entry_date = Column(DateTime(timezone=True), nullable=False)
    mood_tag = Column(String, nullable=False)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False)


class GateAttestationORM(Base):
    __tablename__ = "gate_attestations"

    id = Column(BIGINT, primary_key=True)
    bot_id = Column(String, nullable=False)
    check_name = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    signed_by = Column(String, nullable=False)
    signed_at = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=False, default="")


class BacktestRunStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BacktestRunORM(Base):
    """Job-tracking row for one backtest — created QUEUED by
    POST /backtests, advanced by the in-process asyncio task that
    actually runs it (app/services/backtest_runner.py), polled by
    GET /backtests/{id}. `bot_id` is a loose string, not a real FK —
    same deliberate convention ClosedTradeORM.bot_id already uses,
    since this table and bot_configs live on two different
    SQLAlchemy declarative Bases (this one, the same as
    ClosedTradeORM/closed_trades; bot_configs on app.database.Base) —
    see that file's own module docstring for the "built in an isolated
    sandbox round" history. `scope` is always "isolated" for now;
    "portfolio" (whole-operation, shared-ledger replay) is a later,
    explicitly separate phase of the same approved plan.
    `variant_group` is unused until the Intelligent-mode auto-tuning
    phase — included now so that phase doesn't need its own migration,
    same reasoning ClosedTradeORM.variant_group was already added for.
    `equity_curve` is a self-contained [{"timestamp": iso, "cum_r":
    float}, ...] snapshot computed once at completion, deliberately
    NOT re-derived later by querying closed_trades for this bot_id —
    closed_trades(source='backtest') rows aren't tagged with which run
    produced them (no run_id column there), so a second run for the
    same bot would make that query ambiguous; storing the curve here
    keeps each run's own result fully self-describing regardless of
    how many other runs exist for the same bot."""
    __tablename__ = "backtest_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(String, nullable=False, index=True)
    scope = Column(String, nullable=False, default="isolated")
    symbol = Column(String, nullable=True)
    base_timeframe = Column(String, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(BacktestRunStatus), nullable=False, default=BacktestRunStatus.QUEUED)
    progress_pct = Column(Float, nullable=False, default=0.0)
    error_message = Column(Text, nullable=True)
    cost_model = Column(JSON, nullable=True)
    total_trades = Column(Integer, nullable=True)
    win_rate = Column(Float, nullable=True)
    expectancy_r = Column(Float, nullable=True)
    max_drawdown_pct = Column(Float, nullable=True)
    equity_curve = Column(JSON, nullable=True)
    variant_group = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
