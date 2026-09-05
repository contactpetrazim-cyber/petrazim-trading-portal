
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from typing import Optional
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

    # Owning Trader — set from the bot's own owner at trade-creation
    # time (execution_engine.py::_persist_trade), not from the request,
    # since trades are drafted from TradingView signals, not a direct
    # user API call. Nullable for the same reason as BotConfig.user_id:
    # see migrations/008_bot_trade_ownership.sql.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

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

    # Immutable snapshots of stop_loss/take_profit_1 AT CREATION —
    # distinct from the mutable columns above, which modify_targets
    # (routers/manual_trading.py) overwrites in place. Without these,
    # "was this trade's SL ever shifted from where it opened" has no
    # honest answer once the live value has already been changed. Powers
    # the "dynamic SL management" analytics — by direct request ("same
    # for dynamic SL management shift vs trades without shifting SL
    # over time"). See migrations/012_trade_modification_tracking.sql.
    initial_stop_loss = Column(Float)
    initial_take_profit_1 = Column(Float)

    @property
    def take_profit(self) -> Optional[float]:
        """Alias for take_profit_1 — schemas.TradeResponse has always
        serialized a field named exactly `take_profit` via plain
        attribute passthrough (routers/trades.py returns the ORM object
        directly), but no column or property by that name existed, so
        every trade's take_profit came back None regardless of what was
        actually stored. Found and fixed while adding multi-target
        (take_profit_2/3) support below — a real, previously invisible
        bug, not something introduced by this change."""
        return self.take_profit_1

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

    # True for a manual-trading Test-mode order (services/manual_trading.py) —
    # simulated fill, never reaches a real broker. Same is_test convention as
    # Payment.is_test (models/access.py) — mirrors the payments Test/Live
    # toggle's own safe-default pattern for manual trade execution.
    is_test = Column(Boolean, default=False)

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


class TradingMode(enum.Enum):
    TEST = "test"
    LIVE = "live"


class ManualTradingSettings(Base):
    """One row per trader — powers the manual-trading order form's two
    toggles, by direct instruction:
      1. use_global_defaults: True follows the platform's own Trading
         Defaults (config.py — DEFAULT_RISK_PERCENT, DEFAULT_RR_RATIO,
         MAX_DAILY_TRADES, MAX_PORTFOLIO_EXPOSURE), same numbers every
         bot falls back to with no config of its own. False switches to
         this row's own risk_per_trade/max_daily_trades/etc, exactly
         like giving manual trading its own bot-style risk profile.
      2. trading_mode: TEST never reaches a real broker (a simulated
         fill, is_test=True on the Trade row) — LIVE calls the exact
         same execution_engine.py path a bot's own trades use. Starts
         at TEST always, the same safe-default convention
         platform_setting.py's payments mode already established —
         going live is something a trader opts into, never a default.
      3. paper_trading_enabled: a THIRD, independent toggle — by direct
         request ("provide a test vs live toggle and also while in
         live mode still provide a paper trading toggle ... so the
         paper trading is a permanent toggle both for test mode and
         live mode"). trading_mode==TEST or this flag being on both
         route through the exact same paper-trading engine
         (execution_engine.py's _execute_broker_order(..., paper=...)):
         the real broker-selection + price-deviation-guard pipeline
         runs, but the final send-to-broker step is diverted to a
         simulated fill. Only trading_mode==LIVE with this OFF reaches
         a real broker. Defaults True — a brand-new user starts fully
         simulated on both axes, not just one.
    """
    __tablename__ = "manual_trading_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    use_global_defaults = Column(Boolean, nullable=False, default=True)
    trading_mode = Column(Enum(TradingMode), nullable=False, default=TradingMode.TEST)
    paper_trading_enabled = Column(Boolean, nullable=False, default=True)

    risk_per_trade = Column(Float, nullable=False, default=1.0)
    max_daily_trades = Column(Integer, nullable=False, default=10)
    max_concurrent_trades = Column(Integer, nullable=False, default=5)
    max_portfolio_exposure = Column(Float, nullable=False, default=5.0)
    min_rr_ratio = Column(Float, nullable=False, default=1.5)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
