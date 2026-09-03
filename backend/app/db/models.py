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

from sqlalchemy import Boolean, Column, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import BIGINT

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
