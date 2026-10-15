
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid
from datetime import datetime

class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Period
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly

    # Bot/Strategy filter
    bot_id = Column(String(50), index=True)
    strategy_type = Column(String(50), index=True)
    symbol = Column(String(50), index=True)  # widened — see trade.py's Trade.symbol for the real bug this matches

    # Core metrics
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)

    profit_factor = Column(Float, default=0.0)
    average_win = Column(Float, default=0.0)
    average_loss = Column(Float, default=0.0)

    # R-Multiples
    average_r_multiple = Column(Float, default=0.0)
    max_r_multiple = Column(Float, default=0.0)
    min_r_multiple = Column(Float, default=0.0)
    r_multiple_distribution = Column(JSON, default=list)

    # Drawdown
    max_drawdown_pct = Column(Float, default=0.0)
    max_drawdown_amount = Column(Float, default=0.0)
    current_drawdown_pct = Column(Float, default=0.0)

    # Returns
    gross_profit = Column(Float, default=0.0)
    gross_loss = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    return_pct = Column(Float, default=0.0)

    # Trade characteristics
    average_hold_time = Column(Float)  # minutes
    median_hold_time = Column(Float)
    max_hold_time = Column(Float)
    min_hold_time = Column(Float)

    # Slippage
    average_slippage = Column(Float, default=0.0)
    max_slippage = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

class LessonLearned(Base):
    __tablename__ = "lessons_learned"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Widened to match Trade.trade_id's own fix (trade.py).
    trade_id = Column(String(120), index=True)
    bot_id = Column(String(50), index=True)
    symbol = Column(String(50))  # widened — see trade.py's Trade.symbol for the real bug this matches

    # Classification
    lesson_type = Column(String(50), nullable=False)  # premature_exit, missed_entry, sl_too_tight, etc.
    severity = Column(String(20), default="medium")  # low, medium, high, critical

    # Details
    description = Column(Text, nullable=False)
    market_conditions = Column(Text)
    deviation_from_plan = Column(Text)

    # Technical snapshot
    price_action = Column(Text)
    structure_state = Column(Text)
    volume_profile = Column(Text)

    # Resolution
    recommended_action = Column(Text)
    implemented = Column(Boolean, default=False)
    implementation_date = Column(DateTime)

    # Feedback loop
    strategy_adjustment = Column(JSON, default=dict)
    parameter_changes = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(String(100))

class StrategyAdjustment(Base):
    """The Intelligent-mode auto-tuning audit trail — every candidate
    change that actually got applied to a bot's own strategy_params,
    with enough recorded to answer "why did this change happen" and
    "what was it before" at any later point, and to support a
    one-click revert. Resurrected from a schema-only, never-
    instantiated model (see app/services/intelligent_tuning_worker.py,
    the first real writer). `bot_id` is a loose string, not a real FK
    — checked directly against the live database before adding one:
    bot_configs.bot_id has no actual unique constraint there (only its
    `id` UUID primary key does, confirmed via pg_constraint), so a real
    FK would fail at deploy time without a separate migration adding
    that constraint first. Same deliberate convention ClosedTradeORM.
    bot_id and BacktestRunORM.bot_id already use for exactly this
    reason."""
    __tablename__ = "strategy_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    bot_id = Column(String(50), nullable=False, index=True)
    adjustment_type = Column(String(50), nullable=False)

    # Before/After
    previous_config = Column(JSON, nullable=False)
    new_config = Column(JSON, nullable=False)

    # Trigger
    trigger_metric = Column(String(50))
    trigger_value = Column(Float)
    threshold_value = Column(Float)

    # Validation
    backtest_results = Column(JSON)
    forward_test_results = Column(JSON)
    approved = Column(Boolean, default=False)
    approved_by = Column(String(100))

    created_at = Column(DateTime, default=datetime.utcnow)
    applied_at = Column(DateTime)
