
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Enum, ForeignKey
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
    # Per-ROW unique identifier — used to be the same string as the one
    # real strategy engine backing it 1:1 (only 5 possible values ever
    # existed), which is exactly what capped the whole platform at 5
    # bots total. Now auto-generated fresh per bot (routers/bots.py's
    # create_bot), so any number of bots can exist — by direct request
    # ("there should not be limits to the number of Bots that can be
    # created ... just like no limits on the number of positions").
    bot_id = Column(String(50), unique=True, nullable=False, index=True)
    bot_name = Column(String(100), nullable=False)
    bot_type = Column(String(50), nullable=False)
    # Which of the 5 REAL strategy engines (core/bot_strategies.py's
    # own STRATEGY_ENGINES registry) this bot's signals actually come
    # from — the thing bot_id used to encode 1:1 before this column
    # existed. Nullable only for legacy rows created before this
    # column existed (none as of when this was added — the 5
    # pre-existing bots were backfilled to their own bot_id, since for
    # them bot_id WAS already the engine key); every bot created going
    # forward always sets it.
    strategy_engine = Column(String(50), nullable=True)

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
    # last_run existed but was never actually written anywhere — dead
    # column. Now genuinely updated by market_scanner.py every cycle
    # this bot's own symbols were scanned, whether or not a signal
    # resulted — by direct request ("put an indicator that the bot is
    # actually searching the instrument and following the set up ...
    # else how can we know if something is wrong"). last_scan_error is
    # new: the most recent real failure message for this bot's own
    # symbols (a fetch failure, an unrecognized ccxt exchange, etc.),
    # cleared the moment a cycle succeeds — together these are what let
    # the frontend show a real "No issues" vs "Needs Attention" state
    # instead of a fabricated one.
    last_run = Column(DateTime)
    last_scan_error = Column(String(500), nullable=True)
