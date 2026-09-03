
from pydantic import BaseModel, Field
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
    lot_size: float
    risk_percent: float
    realized_pnl: float
    unrealized_pnl: float = 0.0
    bot_id: str
    strategy_type: str
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True

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
    symbols: List[str]
    timeframes: List[str] = ["1D", "4H", "1H", "15M"]
    risk_per_trade: float = 1.0
    max_daily_trades: int = 10
    max_concurrent_trades: int = 5
    min_rr_ratio: float = 3.0
    execution_mode: Literal["human_in_loop", "fully_autonomous"] = "human_in_loop"
    use_trailing_stop: bool = True
    strategy_params: Optional[Dict] = {}
    exchange: Optional[Literal["bingx", "binance", "bybit", "mexc", "tradelocker", "metatrader"]] = None

class BotConfigResponse(BaseModel):
    id: UUID
    bot_id: str
    bot_name: str
    bot_type: str
    status: str
    execution_mode: str
    symbols: List[str]
    risk_per_trade: float
    max_daily_trades: int
    exchange: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BotToggle(BaseModel):
    bot_id: str
    active: bool

class BotExchangeUpdate(BaseModel):
    exchange: Literal["bingx", "binance", "bybit", "mexc", "tradelocker", "metatrader"]

# =============================================================================
# DASHBOARD / ANALYTICS SCHEMAS
# =============================================================================

class DashboardStats(BaseModel):
    total_trades_today: int
    active_trades: int
    pending_approvals: int
    daily_pnl: float
    win_rate_today: float
    current_drawdown: float
    active_bots: int

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
