
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Literal
from datetime import datetime
from uuid import UUID

# =============================================================================
# TRADE SCHEMAS
# =============================================================================

class TradeCreate(BaseModel):
    symbol: str = Field(..., min_length=3, max_length=20)
    direction: Literal["long", "short"]
    entry_price: float = Field(..., gt=0)
    stop_loss: float = Field(..., gt=0)
    take_profit: float = Field(..., gt=0)
    lot_size: float = Field(..., gt=0)
    risk_percent: float = Field(default=1.0, ge=0.1, le=5.0)
    bot_id: str
    strategy_type: str
    entry_type: Literal["market", "limit", "stop"] = "limit"

    # MTF Context
    higher_tf_bias: Optional[str] = None
    intermediate_tf_direction: Optional[str] = None
    entry_tf_trigger: Optional[str] = None

    # SMC Context
    zone_id: Optional[str] = None
    fvg_id: Optional[str] = None
    liquidity_sweep_id: Optional[str] = None

    # Execution mode
    requires_approval: bool = True
    reasoning: Optional[str] = None

class TradeResponse(BaseModel):
    id: UUID
    trade_id: str
    symbol: str
    direction: str
    status: str
    entry_price: Optional[float]
    stop_loss: float
    take_profit: Optional[float]
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    lot_size: float
    # The ORIGINAL position size at open — distinct from lot_size
    # above, which is live-mutated down to 0 as partial TP legs close
    # (see Trade.initial_lot_size's own comment). Falls back to None
    # for a pre-migration row with no way to recover it; the frontend
    # falls back to lot_size itself in that case.
    initial_lot_size: Optional[float] = None
    risk_percent: float
    # Dollar risk on this trade — the Trade.risk_amount column always
    # existed but was never actually exposed in this response, by
    # direct request ("include the Risk Amount and the Unit Quantity
    # traded"). lot_size above is the "Unit Quantity".
    risk_amount: Optional[float] = None
    # Realized PnL expressed in risk-multiples — already a real DB
    # column (set on close), just never exposed here before. By direct
    # request ("Add from Recent Trades" for the Prop-Firm Challenge
    # Simulator, which models a trade history as a list of r_multiples
    # — see routers/tools.py's own PropFirmRequest.r_multiples).
    r_multiple: Optional[float] = None
    realized_pnl: float
    unrealized_pnl: float = 0.0
    bot_id: str
    strategy_type: str
    # Optional, not plain bool: the schema-repair step backfills NULLs
    # to False on startup, but this stays tolerant of a stray NULL
    # slipping through so a legacy row never 500s the whole list.
    is_test: Optional[bool] = False
    user_id: Optional[UUID] = None
    created_at: datetime
    # Added so a client polling GET /trades/{trade_id} (the Manual
    # Trading order form's own "watch this position dynamically" view)
    # can tell WHY a trade closed — TP1/2/3, stop_loss, manual, etc.
    # (position_monitor.py already writes all of these; nothing in this
    # schema surfaced them before, so a client had no way to show more
    # than "it's closed now, here's the PnL").
    entry_timestamp: Optional[datetime] = None
    exit_price: Optional[float] = None
    exit_type: Optional[str] = None
    exit_timestamp: Optional[datetime] = None
    # Why a trade landed at status=ERROR — by direct report ("critically
    # review this error ... fix ... permanently"). See Trade.error_message's
    # own comment / execution_engine.py's _mark_trade_error for why this
    # needed to be persisted at all (a container log line doesn't
    # survive a redeploy).
    error_message: Optional[str] = None
    # The Trade row already records which exchange actually filled (or
    # would have filled, for a paper/test trade — _determine_broker
    # runs unconditionally in execution_engine.py, only the final
    # send-to-broker step is skipped for paper) this specific order —
    # see Trade.broker_name's own "Broker details" comment. It was
    # never surfaced here, so no client could ever show or use it, by
    # direct request ("exchange record is important ... a trade record
    # in this app doesn't actually store which exchange it was placed
    # on" — the DB column already existed, it just never left the API).
    broker_name: Optional[str] = None
    # Same tolerant-Optional pattern as is_test above — the schema-
    # repair step backfills existing rows to False, but a legacy row
    # mid-migration shouldn't 500 the whole list.
    is_archived: Optional[bool] = False
    # By direct request ("Each trade recommendations is listed as a
    # card complete with all the details"), for the new Pending
    # Approvals page — both columns already existed on Trade (set at
    # draft time by execution_engine.py's own process_signal), just
    # never surfaced here before.
    bot_name: Optional[str] = None
    reasoning_log: Optional[str] = None
    # Same tolerant-Optional pattern as is_archived above — see
    # Trade.is_deleted's own comment for what this powers (the new
    # "Deleted" card).
    is_deleted: Optional[bool] = False

    class Config:
        from_attributes = True

class TradeArchiveUpdate(BaseModel):
    archived: bool

class TradeDeleteUpdate(BaseModel):
    deleted: bool

class TradeApproval(BaseModel):
    trade_id: str
    approved: bool
    notes: Optional[str] = None

# =============================================================================
# WEBHOOK SCHEMAS
# =============================================================================

class TradingViewWebhook(BaseModel):
    bot_id: str = Field(..., description="Target bot ID")
    pair: str = Field(..., description="Trading pair symbol")
    action: Literal["buy", "sell", "close", "update_sl", "update_tp"]
    entry: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    risk_percent: Optional[float] = 1.0
    timeframe: Optional[str] = "15M"

    # SMC-specific payload fields
    structure_type: Optional[str] = None  # BOS, CHoCH, sweep
    zone_level: Optional[float] = None
    fvg_present: Optional[bool] = False
    liquidity_swept: Optional[bool] = False

    # Signature for verification
    signature: Optional[str] = None

class WebhookResponse(BaseModel):
    success: bool
    message: str
    trade_id: Optional[str] = None
    status: Optional[str] = None
    execution_mode: Optional[str] = None

# =============================================================================
# BOT CONFIG SCHEMAS
# =============================================================================

class BotConfigCreate(BaseModel):
    bot_id: str
    bot_name: str
    bot_type: str
    # Which of the 6 fixed SMC algorithms this bot runs — see
    # BotConfig.strategy_key's own comment. Required so a trader can
    # create more than one bot per strategy (by direct request): the
    # frontend's "New Bot" form now generates a unique bot_id when the
    # chosen strategy is already taken, so strategy_key is what the
    # dispatch engine actually keys off, not bot_id itself. bot_6 (SMC
    # v2) added by direct request alongside the original 5.
    strategy_key: Literal["bot_1", "bot_2", "bot_3", "bot_4", "bot_5", "bot_6"]
    symbols: List[str]
    timeframes: List[str] = ["1D", "4H", "1H", "15M"]
    risk_per_trade: float = 1.0
    max_daily_trades: int = 10
    max_concurrent_trades: int = 5
    min_rr_ratio: float = 3.0
    execution_mode: Literal["human_in_loop", "fully_autonomous"] = "human_in_loop"
    use_trailing_stop: bool = True
    strategy_params: Optional[Dict] = {}
    # Was a closed Literal of the 6 exchanges this platform has a real
    # broker integration for — loosened to a free string by direct
    # request ("option to type in specific Exchange"), so the Create
    # Bot form's quick buttons (bingx/binance/bybit/mexc) can sit
    # alongside a genuine free-text field rather than blocking anything
    # not on that fixed list. Degrades safely either way: an
    # unrecognized name just means execution_engine._get_broker_client
    # finds no client for it and falls through to its existing paper
    # fallback (same as today for any bot with no exchange pinned at
    # all) — never a crash.
    exchange: Optional[str] = Field(default=None, max_length=50)

class BotConfigResponse(BaseModel):
    id: UUID
    bot_id: str
    bot_name: str
    bot_type: str
    strategy_key: Optional[str] = None
    status: str
    execution_mode: str
    symbols: List[str]
    timeframes: List[str]
    risk_per_trade: float
    max_daily_trades: int
    max_concurrent_trades: int
    max_portfolio_exposure: float
    min_rr_ratio: float
    use_trailing_stop: bool
    exchange: Optional[str] = None
    # Starting Reference Capital/Balance — this bot's own setting (null
    # = no override, falls back to the Admin master override when
    # enabled, else the platform default). See BotConfig.
    # account_balance_usd's own comment.
    account_balance_usd: Optional[float] = None
    # This bot's own leverage override — same null-means-no-override
    # shape as account_balance_usd above. See BotConfig.leverage's own
    # comment.
    leverage: Optional[float] = None
    # Same Test/Live + Paper Trading pair ManualTradingSettings already
    # exposes, now per-bot — see BotConfig's own comment for why.
    trading_mode: str = "test"
    paper_trading_enabled: bool = False
    # "dedicated Vs Auto margin account setting for bots" — see
    # app/models/bot.py's MarginMode.
    margin_mode: str = "dedicated"
    user_id: Optional[UUID] = None
    created_at: datetime
    # Real bot health, by direct request ("confirm my five bots are
    # active and are looking for trade opportunities") — both columns
    # already existed and were being written by market_scanner.py, just
    # never surfaced here before (last_scan_error, in fact, was never
    # even a real column until now — see BotConfig's own comment).
    last_run: Optional[datetime] = None
    last_scan_error: Optional[str] = None
    # Sleep / Sub-Auto Mode — both by direct request, see BotConfig's
    # own comments for what each actually does.
    sleep_until: Optional[datetime] = None
    sub_auto_active: bool = False
    sub_auto_total_cap: Optional[int] = None
    sub_auto_daily_cap: Optional[int] = None
    sub_auto_trades_executed: int = 0
    sub_auto_daily_count: int = 0
    # Sub-Auto-specific Risk Amount (USD) / RR overrides — see
    # BotConfig.sub_auto_risk_amount's own comment.
    sub_auto_risk_amount: Optional[float] = None
    sub_auto_min_rr_ratio: Optional[float] = None

    # Real bug: these 3 columns are plain SQLAlchemy `default=False`/
    # `default=0` — a Python-side INSERT-time default, not a DB
    # `server_default`/NOT NULL constraint — so any row created through
    # a path that didn't trigger that (confirmed: a real bot_config row
    # existed with genuine NULLs here) has nothing to fall back to.
    # Pydantic's own `= False`/`= 0` field default only applies when a
    # field is MISSING, not when it's explicitly None — so one bad row
    # 500'd GET /bots/ for every trader, which cascaded into the whole
    # Dashboard page failing (it fetches bots in the same Promise.all as
    # everything else). Coercing None -> the same default here, instead
    # of just backfilling the one bad row, makes this permanently safe
    # regardless of how a future NULL gets in.
    @field_validator("sub_auto_active", mode="before")
    @classmethod
    def _default_sub_auto_active(cls, v):
        return False if v is None else v

    @field_validator("sub_auto_trades_executed", "sub_auto_daily_count", mode="before")
    @classmethod
    def _default_sub_auto_counts(cls, v):
        return 0 if v is None else v

    class Config:
        from_attributes = True

class BotToggle(BaseModel):
    bot_id: str
    active: bool

class BotSleepUpdate(BaseModel):
    """PATCH /bots/{bot_id}/sleep body — hours=None wakes the bot up
    immediately (the "Reset" action); a positive number puts it to
    sleep for that many hours from now. See BotConfig.sleep_until's
    own comment."""
    hours: Optional[float] = Field(default=None, gt=0, le=24 * 30)

class BotSubAutoUpdate(BaseModel):
    """PATCH /bots/{bot_id}/sub-auto body — see
    BotConfig.sub_auto_active's own comment. enabled=False is the
    "Reset" action (also used to interrupt an active engagement early);
    total_cap/daily_cap are required when enabling. risk_amount/
    min_rr_ratio are always optional (unset leaves whatever override
    — if any — was already saved untouched) and apply regardless of
    enabled, so a trader can update just the override on an already-
    active engagement without having to re-send total_cap/daily_cap."""
    enabled: bool
    total_cap: Optional[int] = Field(default=None, ge=1, le=10_000)
    daily_cap: Optional[int] = Field(default=None, ge=1, le=1000)
    risk_amount: Optional[float] = Field(default=None, gt=0)
    min_rr_ratio: Optional[float] = Field(default=None, gt=0)

class BotTradingModeUpdate(BaseModel):
    """PATCH /bots/{bot_id}/trading-mode body — mirrors
    manual_trading.py's own SettingsUpdateRequest shape for the same
    two toggles, just scoped to one bot instead of one trader."""
    trading_mode: Optional[Literal["test", "live"]] = None
    paper_trading_enabled: Optional[bool] = None

class BotRename(BaseModel):
    bot_name: str = Field(..., min_length=1, max_length=100)

class BotExchangeUpdate(BaseModel):
    # Same loosening as BotConfigCreate.exchange above, for consistency
    # between creating a bot and re-pinning its exchange later.
    exchange: str = Field(max_length=50)

class BotMetricsUpdate(BaseModel):
    """The editable risk/entry metrics a Trader can tune on their own
    bot from the Bots or Risk Management pages — everything here maps
    1:1 to a BotConfig column already present in the model but never
    exposed for editing (only toggle/mode/exchange had their own
    endpoint before this)."""
    risk_per_trade: Optional[float] = Field(None, ge=0.1, le=25.0)
    max_daily_trades: Optional[int] = Field(None, ge=1, le=200)
    max_concurrent_trades: Optional[int] = Field(None, ge=1, le=50)
    max_portfolio_exposure: Optional[float] = Field(None, ge=0.1, le=100.0)
    min_rr_ratio: Optional[float] = Field(None, ge=0.1, le=20.0)
    use_trailing_stop: Optional[bool] = None
    symbols: Optional[List[str]] = None
    timeframes: Optional[List[str]] = None
    # Starting Reference Capital/Balance — by direct request ("Create a
    # master bot control for bot starting reference capital and
    # balance"). update_bot_metrics below applies this via
    # model_dump(exclude_unset=True), which already distinguishes
    # "field not sent at all" (left alone) from "sent as null"
    # (clears this bot's own override, falling back to the platform
    # default) — the same real, meaningful-null convention every
    # nullable BotConfig column here already gets for free.
    account_balance_usd: Optional[float] = Field(None, gt=0)
    # This bot's own leverage override — same meaningful-null
    # convention as account_balance_usd above. See BotConfig.leverage's
    # own comment.
    leverage: Optional[float] = Field(None, gt=0, le=125)
    # "dedicated Vs Auto margin account setting for bots" — see
    # app/models/bot.py's MarginMode. Also requires the Admin portal's
    # master switch to be on; see services/margin_switch_engine.py.
    margin_mode: Optional[Literal["dedicated", "auto_switch"]] = None

# =============================================================================
# DASHBOARD / ANALYTICS SCHEMAS
# =============================================================================

class TodayTradeBreakdown(BaseModel):
    """Today's trades split into the buckets a trader actually thinks
    in — by direct request ("can you provide more clarity / Pending
    trades Vs Executed Trades Vs Canceled Vs Loss Vs Won Vs
    BreakEven"), after DashboardStats' own single total_trades_today/
    win_rate_today pair got flagged as too coarse (that pair still
    reflects only REAL trades — pending/executed/closed, cancelled and
    errored excluded, per the earlier "cancelled order inflating the
    count" fix — `cancelled` here is shown separately, deliberately not
    folded back into the headline total)."""
    pending: int
    executed: int  # filled and still open (ACTIVE) — distinct from a still-resting PENDING order
    cancelled: int
    won: int
    loss: int
    breakeven: int

class TradeBreakdown(TodayTradeBreakdown):
    """The same Pending/Executed/Cancelled/Won/Loss/Break-even buckets
    as TodayTradeBreakdown, widened to any of Today/Week/Month — by
    direct request ("can we include Today, Week, Month toggle in the
    dashboard ... instead of just Today"). A separate schema (and
    separate /dashboard/trade-breakdown endpoint) rather than widening
    DashboardStats.today_breakdown itself, so that field's existing
    shape and every consumer of it (the headline stat card) is
    untouched — this is the data source for the new toggle only.

    `drawdown` added by direct follow-up request ("Add - Today Week
    Month To 'Daily Drawdown' and 'Daily P&L' - just like it works for
    'Todays Trades'") — same $ peak-to-trough definition
    dashboard_stats.current_drawdown already uses for "today", now
    computed over whichever period this call asked for."""
    period: str  # "today" | "week" | "month"
    total: int
    win_rate: float
    pnl: float
    drawdown: float


class DashboardStats(BaseModel):
    total_trades_today: int
    active_trades: int
    pending_approvals: int
    daily_pnl: float
    win_rate_today: float
    current_drawdown: float
    active_bots: int
    today_breakdown: TodayTradeBreakdown

class PerformanceSummary(BaseModel):
    period: str
    total_trades: int
    win_rate: float
    profit_factor: float
    average_r_multiple: float
    max_drawdown_pct: float
    net_pnl: float

class SignalPreview(BaseModel):
    bot_id: str
    bot_name: str
    symbol: str
    direction: str
    confidence: float
    entry_price: float
    stop_loss: float
    take_profit: float
    lot_size: float
    risk_percent: float
    rr_ratio: float
    reasoning: str
    requires_approval: bool
    timestamp: datetime
