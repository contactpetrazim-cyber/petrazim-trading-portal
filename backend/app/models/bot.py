
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean, JSON, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.trade import TradingMode
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

    # Test/Live + Paper Trading — the exact same two-toggle model
    # ManualTradingSettings already gives a manual trader, now given to
    # each bot too, by direct request ("do the same and do paper
    # trading for bot trading ... with a test/paper trading toggle ...
    # so we can use paper trading in test mode ... with an additional
    # option to toggle paper trading in live mode"). Before this, a bot
    # had NO concept of test/live or paper at all — every signal this
    # bot ever produced went straight at _execute_broker_order with no
    # `paper` argument (defaulting to False), so it always attempted a
    # REAL broker call the moment it had a broker client to reach, and
    # never got Trade.is_test set — meaning services/position_monitor.py
    # (scoped to is_test=True) could never manage a bot's own trades
    # either, unlike manual trading's already-paper-aware trades.
    #   - trading_mode: TEST never reaches a real broker for THIS bot's
    #     signals — starts at TEST, same safe-default convention
    #     ManualTradingSettings already established (going live is
    #     opt-in, never a default a bot silently starts in).
    #   - paper_trading_enabled: independent of trading_mode, exactly
    #     like the manual toggle — stays available while trading_mode
    #     is LIVE too, so a bot can go "live" (real broker routing,
    #     real risk caps) while still diverting the final fill, e.g.
    #     to rehearse a brand-new strategy at real market conditions
    #     with zero money actually at risk before trusting it further.
    trading_mode = Column(Enum(TradingMode), default=TradingMode.TEST)
    paper_trading_enabled = Column(Boolean, default=False)

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
    # Real bug, found while adding Sleep/Sub-Auto below: market_scanner.py's
    # own _record_scan_result has been writing bot.last_scan_error on
    # every scan since PR #161, but this column never existed on the
    # model — SQLAlchemy silently accepts an unmapped attribute
    # assignment as a plain Python attribute, so it was never actually
    # persisted (and never surfaced by any API response either). This
    # closes that gap for real.
    last_scan_error = Column(String(500), nullable=True)

    # Sleep — pauses this bot's scanning for a set window, by direct
    # request ("Makes the bot to pause operations for a set time
    # defined ... Bot operations resume after pause or sleep time
    # window to same settings originally"). Deliberately just a
    # timestamp gate, not a status change or settings snapshot: nothing
    # about the bot's own config is ever touched, so "resume to the
    # same settings" is automatically true — there's nothing to
    # restore. market_scanner.py's scan_once skips a sleeping bot
    # entirely (no wasted candle fetch); execution_engine.py's
    # process_signal enforces it too, for the webhook path which
    # bypasses scan_once's own bot list. A bot wakes up the moment
    # `now` passes this timestamp — no background job needed.
    sleep_until = Column(DateTime, nullable=True)

    # Sub-Auto Mode — pre-approved autonomous execution up to a
    # trader-set TOTAL trade count and a max trades PER DAY, both
    # pre-approved, by direct request ("bot has pre-approval to trade a
    # certain number of trades in total and also a certain max number
    # of trades per day - both with pre approval ... Bot resumes
    # original settings after completing the pre-approved
    # activities"). While active, execution_engine.py's process_signal
    # forces every signal for this bot to execute exactly like Fully
    # Autonomous — no per-trade human approval — as long as neither cap
    # is exhausted. Hitting the daily cap just skips the rest of today
    # (same "resumes automatically" semantics as max_daily_trades);
    # hitting the total cap turns Sub-Auto off and restores
    # execution_mode from the snapshot below, right after that final
    # trade executes.
    sub_auto_active = Column(Boolean, default=False)
    sub_auto_total_cap = Column(Integer, nullable=True)
    sub_auto_daily_cap = Column(Integer, nullable=True)
    # Reset to 0 every time Sub-Auto is freshly engaged (see
    # routers/bots.py's own set_sub_auto) — a running count across the
    # CURRENT engagement only, not lifetime.
    sub_auto_trades_executed = Column(Integer, default=0)
    sub_auto_daily_count = Column(Integer, default=0)
    sub_auto_daily_date = Column(Date, nullable=True)
    # Snapshot of execution_mode from the moment Sub-Auto was engaged —
    # what both the total-cap completion above and the Reset endpoint
    # restore to, so "original settings" really means whatever this
    # bot was actually set to before, not a hardcoded default.
    pre_sub_auto_execution_mode = Column(Enum(ExecutionMode), nullable=True)
