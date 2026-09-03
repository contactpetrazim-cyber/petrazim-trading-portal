
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime
import enum

class Timeframe(enum.Enum):
    D1 = "1D"
    H4 = "4H"
    H1 = "1H"
    M15 = "15M"
    M5 = "5M"
    M1 = "1M"

class StructureType(enum.Enum):
    BOS = "break_of_structure"
    CHOCH = "change_of_character"
    SWING_HIGH = "swing_high"
    SWING_LOW = "swing_low"
    INTERNAL_HIGH = "internal_high"
    INTERNAL_LOW = "internal_low"

class ZoneType(enum.Enum):
    SUPPLY = "supply"
    DEMAND = "demand"
    ORDER_BLOCK = "order_block"
    BREAKER_BLOCK = "breaker_block"
    MITIGATION_BLOCK = "mitigation_block"

class MitigationStatus(enum.Enum):
    ACTIVE = "active"
    TESTED = "tested"
    MITIGATED = "mitigated"
    INVALIDATED = "invalidated"

class SwingPoint(Base):
    __tablename__ = "swing_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(Enum(Timeframe), nullable=False, index=True)
    structure_type = Column(Enum(StructureType), nullable=False)

    price = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)

    # Fractal confirmation details
    left_bars = Column(Integer, default=3)
    right_bars = Column(Integer, default=3)
    confirmed = Column(Boolean, default=False)

    # Relationships
    source_candle_open = Column(Float)
    source_candle_high = Column(Float)
    source_candle_low = Column(Float)
    source_candle_close = Column(Float)
    source_candle_volume = Column(Float)

    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(Enum(Timeframe), nullable=False, index=True)
    zone_type = Column(Enum(ZoneType), nullable=False)

    # Zone boundaries
    top = Column(Float, nullable=False)
    bottom = Column(Float, nullable=False)
    mean_threshold = Column(Float, nullable=False)  # 50% equilibrium

    # Origin details
    origin_timestamp = Column(DateTime, nullable=False)
    origin_candle_open = Column(Float)
    origin_candle_close = Column(Float)
    origin_candle_high = Column(Float)
    origin_candle_low = Column(Float)

    # Premium/Discount classification
    fib_level = Column(Float)  # 0.0 to 1.0 relative to swing range
    classification = Column(String(20))  # premium, discount, equilibrium

    # Mitigation tracking
    status = Column(Enum(MitigationStatus), default=MitigationStatus.ACTIVE)
    test_count = Column(Integer, default=0)
    last_test_timestamp = Column(DateTime)
    mitigated_timestamp = Column(DateTime)
    invalidated_timestamp = Column(DateTime)

    # Touch tracking
    touches = Column(JSON, default=list)  # [{price, timestamp, type}]

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FairValueGap(Base):
    __tablename__ = "fair_value_gaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(Enum(Timeframe), nullable=False)

    # FVG boundaries (bullish: candle1.high < candle3.low, bearish: candle1.low > candle3.high)
    top = Column(Float, nullable=False)
    bottom = Column(Float, nullable=False)

    gap_type = Column(String(10))  # bullish, bearish

    # 3-candle mapping
    candle1_timestamp = Column(DateTime, nullable=False)
    candle1_open = Column(Float)
    candle1_high = Column(Float)
    candle1_low = Column(Float)
    candle1_close = Column(Float)

    candle2_timestamp = Column(DateTime, nullable=False)
    candle2_open = Column(Float)
    candle2_high = Column(Float)
    candle2_low = Column(Float)
    candle2_close = Column(Float)

    candle3_timestamp = Column(DateTime, nullable=False)
    candle3_open = Column(Float)
    candle3_high = Column(Float)
    candle3_low = Column(Float)
    candle3_close = Column(Float)

    # Mitigation tracking
    status = Column(Enum(MitigationStatus), default=MitigationStatus.ACTIVE)
    mitigated_percent = Column(Float, default=0.0)
    inversion_fvg_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
