
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime
import enum

class BotStatus(enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    MAINTENANCE = "maintenance"

class ExecutionMode(enum.Enum):
    HUMAN_IN_LOOP = "human_in_loop"
    FULLY_AUTONOMOUS = "fully_autonomous"

class BotConfig(Base):
    __tablename__ = "bot_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(String(50), unique=True, nullable=False, index=True)
    bot_name = Column(String(100), nullable=False)
    bot_type = Column(String(50), nullable=False)

    # Owning Trader. Nullable — pre-existing bots (none, as of the
    # migration that added this column) have no owner; every bot
    # created from here on gets it set from the authenticated caller
    # (routers/bots.py::create_bot). See migrations/008_bot_trade_ownership.sql.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    # Status
    status = Column(Enum(BotStatus), default=BotStatus.ACTIVE)
    execution_mode = Column(Enum(ExecutionMode), default=ExecutionMode.HUMAN_IN_LOOP)

    # Assets
    symbols = Column(JSON, default=list)  # ["BTCUSDT", "EURUSD"]
    timeframes = Column(JSON, default=list)  # ["1D", "4H", "1H", "15M"]

    # Which exchange this bot's orders execute on — "bingx", "binance",
    # "bybit", "mexc", or "tradelocker". Pinning this (rather than
    # letting execution_engine guess from the symbol) is what the
    # cross-exchange price-deviation guard depends on: it fetches its
    # sanity-check ticker from exactly this exchange. Changeable anytime
    # via PATCH /bots/{bot_id}/exchange — takes effect on the very next
    # signal for this bot, since it's read fresh from the DB each time,
    # never cached.
    exchange = Column(String(20), nullable=True)

    # Risk Parameters
    risk_per_trade = Column(Float, default=1.0)
    max_daily_trades = Column(Integer, default=10)
    max_concurrent_trades = Column(Integer, default=5)
    max_portfolio_exposure = Column(Float, default=5.0)
    min_rr_ratio = Column(Float, default=3.0)

    # Entry Parameters
    entry_types = Column(JSON, default=list)  # ["limit", "market"]
    limit_order_offset = Column(Float, default=0.0)  # pips/points offset

    # Exit Parameters
    use_trailing_stop = Column(Boolean, default=True)
    trailing_stop_activation = Column(Float, default=1.0)  # R-multiple
    trailing_stop_distance = Column(String(20), default="structure")  # structure, atr, fixed

    # Multi-target
    tp1_percent = Column(Float, default=30.0)
    tp2_percent = Column(Float, default=40.0)
    tp3_percent = Column(Float, default=30.0)

    # SMC Specifics
    require_mtf_alignment = Column(Boolean, default=True)
    require_liquidity_sweep = Column(Boolean, default=True)
    require_fvg_confirmation = Column(Boolean, default=False)
    require_order_block = Column(Boolean, default=False)

    # Batch settings
    batch_size = Column(Integer, default=1)
    batch_allocation = Column(String(20), default="equal")  # equal, risk_weighted, confidence

    # Strategy-specific config
    strategy_params = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run = Column(DateTime)
