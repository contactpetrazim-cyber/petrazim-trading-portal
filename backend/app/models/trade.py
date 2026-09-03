
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime
import enum

class TradeStatus(enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    ERROR = "error"

class TradeDirection(enum.Enum):
    LONG = "long"
    SHORT = "short"

class EntryType(enum.Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"

class ExitType(enum.Enum):
    TP1 = "tp1"
    TP2 = "tp2"
    TP3 = "tp3"
    TRAILING = "trailing"
    STOP_LOSS = "stop_loss"
    MANUAL = "manual"
    STRUCTURE = "structure"

class Trade(Base):
    __tablename__ = "trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trade_id = Column(String(50), unique=True, nullable=False, index=True)

    # Bot & Strategy
    bot_id = Column(String(50), nullable=False, index=True)
    bot_name = Column(String(100))
    strategy_type = Column(String(50), nullable=False)

    # Market
    symbol = Column(String(20), nullable=False, index=True)
    direction = Column(Enum(TradeDirection), nullable=False)

    # Execution
    status = Column(Enum(TradeStatus), default=TradeStatus.PENDING)
    entry_type = Column(Enum(EntryType), default=EntryType.LIMIT)

    entry_price = Column(Float)
    entry_timestamp = Column(DateTime)

    stop_loss = Column(Float, nullable=False)
    take_profit_1 = Column(Float)
    take_profit_2 = Column(Float)
    take_profit_3 = Column(Float)

    # Position sizing
    lot_size = Column(Float, nullable=False)
    risk_percent = Column(Float, nullable=False)
    risk_amount = Column(Float, nullable=False)

    # P&L
    realized_pnl = Column(Float, default=0.0)
    unrealized_pnl = Column(Float, default=0.0)
    r_multiple = Column(Float)

    # Exit details
    exit_price = Column(Float)
    exit_timestamp = Column(DateTime)
    exit_type = Column(Enum(ExitType))

    # MTF Context
    higher_tf_bias = Column(String(20))  # bullish, bearish, neutral
    intermediate_tf_direction = Column(String(20))
    entry_tf_trigger = Column(String(50))

    # SMC Context
    entry_zone_id = Column(UUID(as_uuid=True))
    fvg_id = Column(UUID(as_uuid=True))
    liquidity_sweep_id = Column(UUID(as_uuid=True))

    # Full reasoning log
    reasoning_log = Column(Text)
    technical_snapshot = Column(JSON, default=dict)

    # Broker details
    broker_order_id = Column(String(100))
    broker_name = Column(String(50))

    # Human-in-the-loop
    requires_approval = Column(Boolean, default=False)
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    approval_notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TradeLog(Base):
    __tablename__ = "trade_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trade_id = Column(String(50), ForeignKey("trades.trade_id"), nullable=False, index=True)

    event_type = Column(String(50), nullable=False)  # entry, exit, sl_update, tp_hit, error
    event_data = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)

    price_at_event = Column(Float)
    pnl_at_event = Column(Float)
