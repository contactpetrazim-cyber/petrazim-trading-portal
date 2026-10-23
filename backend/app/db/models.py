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
    sandbox round" history. `scope` is "isolated" (one bot_id, the
    default) or "portfolio" (every participating bot replayed together
    against one shared ledger — app/engines/portfolio_backtest_engine.py,
    wired up via app/services/backtest_runner.py's run_portfolio_backtest).
    For a portfolio run, `bot_id` itself is set to the constant
    `_PORTFOLIO_BOT_ID_SENTINEL` (see backtest_runner.py) rather than a
    real bot_id — this column is NOT NULL and semantically "exactly one
    real bot" everywhere else in this codebase (ClosedTradeORM.bot_id
    included), so reusing it for a multi-bot run would be misleading.
    The real participant set lives in `bot_ids`: an explicit list if the
    request named one, or null meaning "every currently-ACTIVE bot,
    resolved fresh at RUN time (not request time) so a bot
    activated/deactivated in between can't produce a stale list" — the
    runner overwrites this column with the actually-resolved list once
    that resolution happens, so a completed run's `bot_ids` is always
    the real participant set, never just the request's own ambiguity.
    `variant_group` is unused until the Intelligent-mode auto-tuning
    phase — included now so that phase doesn't need its own migration,
    same reasoning ClosedTradeORM.variant_group was already added for.
    `equity_curve` is a self-contained snapshot computed once at
    completion, deliberately NOT re-derived later by querying
    closed_trades for this bot_id — closed_trades(source='backtest')
    rows aren't tagged with which run produced them (no run_id column
    there), so a second run for the same bot(s) would make that query
    ambiguous; storing the curve here keeps each run's own result fully
    self-describing regardless of how many other runs exist. Isolated
    mode's own shape is [{"timestamp": iso, "cum_r": float}, ...]
    (unchanged); portfolio mode's shape is a dict — see
    backtest_runner.py's `_summarize_portfolio` for exactly what it
    contains (starting/ending balance, the raw per-bot/symbol event
    list, a per-bot trade breakdown, and any per-bot fetch errors) —
    this column was always a generic JSON blob, never schema-locked to
    isolated mode's own list shape, so no migration is needed for this
    part either."""
    __tablename__ = "backtest_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(String, nullable=False, index=True)
    scope = Column(String, nullable=False, default="isolated")
    # Portfolio-mode only (see class docstring) — always null for an
    # isolated run. New, nullable column rather than overloading bot_id
    # or symbol: auto-added to the live table by main.py's existing
    # generic `_repair_missing_columns` schema-repair sweep on next
    # deploy (driven purely off this model, nothing hand-listed there),
    # so this needs no migration file and no main.py edit.
    bot_ids = Column(JSON, nullable=True)
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
