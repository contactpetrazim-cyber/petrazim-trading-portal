"""
Chart Layout Model — Petrazim's own persistence, not TradingView's
=======================================================================

This is what actually delivers "my drawings are saved" without ever
claiming to sync a user's real TradingView account (which is
architecturally impossible per TRADINGVIEW_BOUNDARY_TABLE.md).

Implements the shape TradingView's Advanced Charts Save/Load REST API
contract expects, so if/when the self-hosted Advanced Charts Library
is integrated, this backend slots in directly — but it works today
independent of that, as the persistence layer for anything Petrazim
builds around chart state (symbol, interval, drawings as JSON).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ChartLayout(Base):
    """One saved layout per user per name — e.g. 'My EURUSD swing setup'.
    `content` stores the Advanced-Charts-compatible JSON blob (drawings,
    indicators, symbol, interval) as text; Petrazim never inspects or
    modifies its internal structure, just stores and returns it verbatim,
    matching what the Save/Load API contract expects from a backend."""
    __tablename__ = "chart_layouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    symbol = Column(String(50), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class ChartDrawingTemplate(Base):
    """Reusable drawing templates (e.g. a saved Fibonacci preset or
    annotation style) — separate from full layouts since these are
    meant to be applied across many charts, not tied to one symbol."""
    __tablename__ = "chart_drawing_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    tool_name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
