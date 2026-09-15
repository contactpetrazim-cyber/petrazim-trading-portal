
export interface Trade {
  id: string;
  trade_id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: string;
  entry_price: number | null;
  stop_loss: number;
  take_profit: number | null;
  take_profit_2?: number | null;
  take_profit_3?: number | null;
  lot_size: number;
  risk_percent: number;
  realized_pnl: number;
  unrealized_pnl: number;
  bot_id: string;
  strategy_type: string;
  is_test?: boolean;
  user_id?: string | null;
  created_at: string;
  requires_approval: boolean;
  entry_timestamp?: string | null;
  exit_price?: number | null;
  exit_type?: string | null;
  exit_timestamp?: string | null;
  /** Which exchange this trade actually filled on (or would have,
   * for a paper/test trade) — "binance", "bybit", "bingx", "mexc",
   * "tradelocker", "metatrader". Null for a trade placed before this
   * field was surfaced by the API, or the rare symbol the backend's
   * own routing heuristic couldn't match to any broker. */
  broker_name?: string | null;
}

export interface BotConfig {
  id: string;
  bot_id: string;
  bot_name: string;
  bot_type: string;
  status: string;
  execution_mode: string;
  symbols: string[];
  timeframes: string[];
  risk_per_trade: number;
  max_daily_trades: number;
  max_concurrent_trades: number;
  max_portfolio_exposure: number;
  min_rr_ratio: number;
  use_trailing_stop: boolean;
  exchange?: string | null;
  // Same Test/Live + Paper Trading pair the Manual Trading order form
  // already has, now per-bot — see BotConfig's own backend comment.
  trading_mode?: 'test' | 'live';
  paper_trading_enabled?: boolean;
  user_id?: string | null;
  created_at: string;
}

export interface BotPerformance {
  bot_id: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  average_r: number;
}

export interface BotMetricsUpdate {
  risk_per_trade?: number;
  max_daily_trades?: number;
  max_concurrent_trades?: number;
  max_portfolio_exposure?: number;
  min_rr_ratio?: number;
  use_trailing_stop?: boolean;
  symbols?: string[];
  timeframes?: string[];
}

export interface TodayTradeBreakdown {
  pending: number;
  executed: number;
  cancelled: number;
  won: number;
  loss: number;
  breakeven: number;
}

export type TradeBreakdownPeriod = 'today' | 'week' | 'month';

export interface TradeBreakdown extends TodayTradeBreakdown {
  period: TradeBreakdownPeriod;
  total: number;
  win_rate: number;
  pnl: number;
}

export interface DashboardStats {
  total_trades_today: number;
  active_trades: number;
  pending_approvals: number;
  daily_pnl: number;
  win_rate_today: number;
  current_drawdown: number;
  active_bots: number;
  today_breakdown: TodayTradeBreakdown;
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

// Trader Exchange Connections — a trader's own exchange account,
// connected so trades genuinely execute there (manually, via a
// subscribed bot, or both). See backend/app/routers/trader_broker_connections.py
// for the full flow this mirrors.
export interface ExchangeInfo {
  exchange: string;
  label: string;
  fields: string[];
  instructions: string;
}

export interface ExchangeMetaResponse {
  exchanges: ExchangeInfo[];
  // Two separate, labeled IPs (not one merged list) — this platform's
  // real topology routes exchange traffic via the VM (primary) or
  // Fixie (backup); a trader should whitelist BOTH.
  outbound_ip_vm: string;
  outbound_ip_fixie: string;
}

export interface OutboundIpsResponse {
  outbound_ip_vm: string;
  outbound_ip_fixie: string;
  vm_source: 'manual' | 'auto';
  fixie_source: 'manual' | 'auto';
}

export interface TraderBrokerConnection {
  id: string;
  exchange: string;
  label: string | null;
  mode: 'manual' | 'bot' | 'both';
  status: 'pending' | 'verified' | 'failed' | 'suspended';
  is_active: boolean;
  api_key_preview: string;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  trader_email?: string | null;
  trader_name?: string | null;
}

export interface AvailableBot {
  bot_id: string;
  bot_name: string;
  bot_type: string;
}

export type SubscriptionCopyMode = 'auto' | 'manual';

export interface TraderBotSubscription {
  id: string;
  bot_id: string;
  connection_id: string;
  is_active: boolean;
  risk_per_trade: number | null;
  copy_mode: SubscriptionCopyMode;
}

export type PayoutMethod = 'crypto' | 'paystack' | 'both';

export interface FeeSettings {
  enabled: boolean;
  manual_trade_fee_enabled: boolean;
  fee_percent: number;
  payout_method: PayoutMethod;
  crypto_address: string | null;
  crypto_network: string | null;
  paystack_account_name: string | null;
  paystack_account_number: string | null;
  paystack_bank_name: string | null;
  paystack_bank_code: string | null;
  notes: string | null;
  settlement_currency: string;
  updated_at: string;
}

export type FeeLedgerStatus = 'owed' | 'paid' | 'waived';

export interface FeeLedgerEntry {
  id: string;
  user_id: string;
  trader_email?: string | null;
  trader_name?: string | null;
  trade_id: string;
  pnl_amount: number;
  fee_percent_applied: number;
  fee_amount: number;
  status: FeeLedgerStatus;
  paid_at: string | null;
  paid_note: string | null;
  created_at: string;
}

export interface MyFeesResponse {
  enabled: boolean;
  manual_trade_fee_enabled: boolean;
  fee_percent: number;
  payout_method: PayoutMethod;
  crypto_address: string | null;
  crypto_network: string | null;
  paystack_account_name: string | null;
  paystack_account_number: string | null;
  paystack_bank_name: string | null;
  settlement_currency: string;
  total_owed: number;
  entries: FeeLedgerEntry[];
}

// Trading fee payment gate — "pays for previous day fees before
// access to a new day," by direct request. See backend/app/core/fee_gate.py.
export interface FeeGateStatus {
  gated: boolean;
  owed_from_previous_days: number;
  total_owed: number;
  currency: string;
}

export type FeeCheckoutProvider = 'paystack' | 'ivorypay';

export interface FeeCheckoutSession {
  checkout_url: string;
  reference: string;
  provider: string;
  amount: number;
  currency: string;
}

// Result of re-checking a still-pending checkout against the real
// gateway — the manual complement to a webhook, and the ONLY
// confirmation path IvoryPay actually has (no documented webhook
// signature scheme for it in this app — see routers/fees.py's own
// verify_fee_checkout docstring).
export interface FeeVerifyResult {
  reference: string;
  provider: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
}
