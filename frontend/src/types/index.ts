
export interface Trade {
  id: string;
  trade_id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: string;
  entry_price: number | null;
  stop_loss: number;
  take_profit: number | null;
  lot_size: number;
  risk_percent: number;
  realized_pnl: number;
  bot_id: string;
  strategy_type: string;
  created_at: string;
  requires_approval: boolean;
}

export interface BotConfig {
  id: string;
  bot_id: string;
  bot_name: string;
  bot_type: string;
  status: string;
  execution_mode: string;
  symbols: string[];
  risk_per_trade: number;
  max_daily_trades: number;
  created_at: string;
}

export interface DashboardStats {
  total_trades_today: number;
  active_trades: number;
  pending_approvals: number;
  daily_pnl: number;
  win_rate_today: number;
  current_drawdown: number;
  active_bots: number;
}

export interface SignalPreview {
  bot_id: string;
  bot_name: string;
  symbol: string;
  direction: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  risk_percent: number;
  rr_ratio: number;
  reasoning: string;
  requires_approval: boolean;
  timestamp: string;
}

export interface PerformanceSummary {
  period: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  average_r_multiple: number;
  max_drawdown_pct: number;
  net_pnl: number;
}
