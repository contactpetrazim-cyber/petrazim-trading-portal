
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
  /** Immutable snapshots of stop_loss/take_profit at creation, before
   * any live ratchet/breakeven move -- see stop_loss/take_profit's own
   * comments on why those live values can end up inconsistent with
   * entry_price once a trade has run past TP1. Exposed for "Add from
   * Manual trade / Bot trade" (Time Machine), which needs the
   * trade's ORIGINAL plan, not wherever its stop has since moved to.
   * Null for a trade predating this snapshot. */
  initial_stop_loss?: number | null;
  initial_take_profit_1?: number | null;
  lot_size: number;
  /** The ORIGINAL position size at open — by direct report ("the
   * quantity on the card shows 0.000"): lot_size above is live-
   * mutated down to 0 as partial take-profit legs close (see backend
   * Trade.initial_lot_size's own comment), so it reads 0 for EVERY
   * closed trade regardless of what was actually traded. Null only
   * for a pre-migration row with no way to recover it — fall back to
   * lot_size itself in that case. */
  initial_lot_size?: number | null;
  risk_percent: number;
  /** Dollar risk on this trade — by direct request ("include the Risk
   * Amount and the Unit Quantity traded"); lot_size above is the
   * "Unit Quantity". Optional only because a pre-this-field legacy
   * row could in principle have None at the DB level. */
  risk_amount?: number | null;
  /** Realized PnL in risk-multiples — a real DB column, exposed for
   * "Add from Recent Trades" (Prop-Firm Challenge Simulator). */
  r_multiple?: number | null;
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
  /** Why a trade landed at status "error" — by direct report
   * ("critically review this error ... fix ... permanently"). Null for
   * any trade that never errored, and for one that did before this
   * field existed (the reason only ever reached a container log line,
   * which doesn't survive a redeploy). */
  error_message?: string | null;
  /** Which exchange this trade actually filled on (or would have,
   * for a paper/test trade) — "binance", "bybit", "bingx", "mexc",
   * "tradelocker", "metatrader". Null for a trade placed before this
   * field was surfaced by the API, or the rare symbol the backend's
   * own routing heuristic couldn't match to any broker. */
  broker_name?: string | null;
  /** True once moved into the folded "Archive Trades" card (see
   * tradesApi.archiveTrade) — a pure declutter flag, unrelated to
   * status/PnL. */
  is_archived?: boolean;
  /** Both surfaced by direct request, for the Pending Approvals
   * page's cards ("complete with all the details"). */
  bot_name?: string | null;
  reasoning_log?: string | null;
  /** True once moved into the "Deleted Trades" card (see
   * tradesApi.deleteTrade) — same reversible declutter flag as
   * is_archived, just for trades the trader wants out of every normal
   * view entirely (e.g. duplicate bot signals). */
  is_deleted?: boolean | null;
  /** Trailing exit on the final runner leg — the "let winners run"
   * mechanism. trailing_activation_r: the R-multiple (1.0/2.0) at
   * which it takes over, or null if trailing is off for this trade.
   * trailing_active: whether it's actually engaged yet.
   * trailing_peak_price/trailing_stop_price: the live trail state
   * once active — trailing_stop_price is what a chart should draw. */
  trailing_activation_r?: number | null;
  trailing_active?: boolean;
  trailing_peak_price?: number | null;
  trailing_stop_price?: number | null;
}

export interface BotConfig {
  id: string;
  bot_id: string;
  bot_name: string;
  bot_type: string;
  // Which of the 5 fixed SMC algorithms this bot runs — see the
  // backend BotConfig model's own strategy_key comment. Optional only
  // for a pre-migration row that predates this column.
  strategy_key?: string | null;
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
  /** 1.0 (after TP1) or 2.0 (after TP2, the default) — the R-multiple
   * at which the final TP leg switches from a fixed price to a
   * trailing exit. See BotConfig.trailing_stop_activation's own
   * backend comment. */
  trailing_stop_activation?: number;
  exchange?: string | null;
  /** Exchange Engine — see BotConfig.exchange_mode's own backend
   * comment. "fixed" (default) means `exchange` above is what's
   * actually used; "auto" means exchange_engine.py picks from this
   * bot's own credentialed exchanges, reflected live in
   * active_exchange/active_exchange_reason/active_exchange_picked_at. */
  exchange_mode?: 'fixed' | 'auto';
  active_exchange?: string | null;
  active_exchange_reason?: string | null;
  active_exchange_picked_at?: string | null;
  // Same Test/Live + Paper Trading pair the Manual Trading order form
  // already has, now per-bot — see BotConfig's own backend comment.
  trading_mode?: 'test' | 'live';
  paper_trading_enabled?: boolean;
  user_id?: string | null;
  created_at: string;
  /** Real bot health — by direct request ("confirm my five bots are
   * active and are looking for trade opportunities"). */
  last_run?: string | null;
  last_scan_error?: string | null;
  /** Sleep — set while this bot's scanning is paused for a window; see
   * BotConfig.sleep_until's own backend comment. */
  sleep_until?: string | null;
  /** Sub-Auto Mode — pre-approved autonomous execution up to a total
   * AND daily cap; see BotConfig.sub_auto_active's own backend
   * comment. */
  sub_auto_active?: boolean;
  sub_auto_total_cap?: number | null;
  sub_auto_daily_cap?: number | null;
  sub_auto_trades_executed?: number;
  sub_auto_daily_count?: number;
  /** Sub-Auto-specific Risk Amount (USD) / RR overrides — see
   * BotConfig.sub_auto_risk_amount's own backend comment. Unset means
   * Sub-Auto trades with this bot's own risk_per_trade/min_rr_ratio,
   * same as every other mode. */
  sub_auto_risk_amount?: number | null;
  sub_auto_min_rr_ratio?: number | null;
  /** Trading Schedule — bot-level now, applies regardless of Sub-Auto
   * — see BotConfig.schedule_sessions' own backend comment. Empty/null
   * on any of these means "All" (no restriction) for that dimension. */
  schedule_sessions?: string[] | null;
  schedule_days?: number[] | null;
  schedule_half_day?: string | null;
  /** Starting Reference Capital/Balance — this bot's own setting (null
   * = no override). See BotConfig.account_balance_usd's own backend
   * comment; the effective value (accounting for the Admin master
   * override) is resolved client-side from botsApi.getMasterAccountBalance. */
  account_balance_usd?: number | null;
  /** This bot's own leverage override (null = no override) — by direct
   * request ("put a form to set leverage for Bot and manual -
   * separately on the trader dashboard ... with a global override
   * form in the Admin"). See BotConfig.leverage's own backend comment. */
  leverage?: number | null;
  /** "dedicated Vs Auto margin account setting for bots" — by direct
   * request for the margin auto-switch engine. Also requires the
   * Admin portal's master switch to be on. */
  margin_mode?: 'dedicated' | 'auto_switch';
  /** Basic (manual, fixed-until-changed-by-hand) vs Intelligent
   * (opt-in bounded self-tuning) — see app/models/bot.py's BotMode. */
  bot_mode?: 'basic' | 'intelligent';
  /** This bot's current tunable strategy knobs (e.g.
   * {"left_bars": 5}) — empty/missing means every value falls back to
   * this bot's own original hardcoded default. */
  strategy_params?: Record<string, number>;
}



/** Real historical candles around a trade's entry/exit window, by
 * direct request ("snapshots of the trade ... 1H and 15M ... showing
 * the entry, SL or TP ... with the candles"). See tradesApi.
 * getTradeSnapshot's own comment for why this is fetched live each
 * time rather than a stored image. */
// Same 5-timeframe set every bot strategy/scanner already uses — by
// direct request ("Add 5M, 4D and 1D to the snapshots chart"; "4D"
// read as "4H", the only 4-prefixed timeframe this app uses anywhere
// else).
export type SnapshotTimeframe = '5m' | '15m' | '1h' | '4h' | '1d';
export interface TradeSnapshotCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface TradeSnapshot {
  trade_id: string;
  symbol: string;
  timeframe: SnapshotTimeframe;
  direction: 'long' | 'short';
  entry_price: number | null;
  entry_timestamp: string | null;
  stop_loss: number;
  take_profit_1: number | null;
  /** Further multi-target levels on a "30/40/30 allocation" strategy —
   * by direct report (a trade's real exit landed well past TP1 with
   * no line explaining why; it had actually run through TP2 and
   * closed exactly at TP3). Current values, not an immutable opening
   * snapshot like stop_loss/take_profit_1 above — no initial_take_
   * profit_2/3 columns exist yet. */
  take_profit_2: number | null;
  take_profit_3: number | null;
  /** Current (live) trailing-stop state — once engaged, replaces the
   * old static TP3 full-close for the runner leg. See
   * Trade.trailing_active's own backend comment. */
  trailing_active?: boolean;
  trailing_stop_price?: number | null;
  exit_price: number | null;
  exit_timestamp: string | null;
  /** Per-level fill events (TP1/TP2/TP3/SL/trailing), each with its
   * OWN timestamp and price — by direct follow-up request ("which
   * candle was the trade entered and which candle was the trade
   * exited ... for each TP 1, TP2 TP3 etc"). Read from TradeLog;
   * populated for bot/auto-managed trades and (going forward) manual
   * partial closes — an older or purely-manual trade may have none
   * beyond what entry/exit already cover. */
  level_events: { event_type: string; timestamp: string | null; price: number | null }[];
  status: string;
  /** Real bot reasoning captured at signal time — by direct request
   * ("include a reason summary that opens when clicked on the
   * snapshot"). Null for a manual trade or a bot signal predating this
   * field. */
  reasoning_log: string | null;
  candles: TradeSnapshotCandle[];
}

/** Per-trade SMC forensic reconstruction — Part 10 of the master audit
 * prompt ("TradingView and Historical Chart Analysis"). See
 * GET /trades/{id}/forensics and its backend compute_trade_forensics
 * (engines/trade_forensics.py) for how this is computed: real swing
 * points/BOS/CHoCH/order blocks/FVGs/liquidity sweeps around the
 * trade's own entry, plus the real price path (MFE/MAE in R, which TP
 * levels were actually reached) between entry and exit — all from
 * real exchange candles, fetched fresh per trade, not stored. */
export interface ForensicsSwingPoint { price: number; type: string; timestamp: string }
export interface ForensicsBosChoch { type: string; timestamp: string; structure_level: number | null }
export interface ForensicsOrderBlock { top: number; bottom: number; status: string; test_count: number; classification: string | null; formed_at: string | null }
export interface ForensicsFvg { top: number; bottom: number; gap_type: string; status: string; mitigated_percent: number; formed_at: string | null }
export interface ForensicsSweep { timestamp: string; type: string; sweep_price: number }
export interface ForensicsTimeframe {
  note?: string;
  candles_considered?: number;
  swing_points?: ForensicsSwingPoint[];
  bos_events?: ForensicsBosChoch[];
  choch_events?: ForensicsBosChoch[];
  order_blocks?: ForensicsOrderBlock[];
  fvgs?: ForensicsFvg[];
  liquidity_sweeps?: ForensicsSweep[];
}
export interface TradeForensics {
  trade_id: string;
  bot_id: string;
  strategy_key: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_timestamp: string;
  exit_timestamp: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  exit_price: number | null;
  exit_type: string | null;
  outcome: 'win' | 'loss' | 'breakeven' | 'unresolved';
  r_multiple: number | null;
  sl_hit_before_tp: boolean | null;
  htf_bias: 'bullish' | 'bearish' | 'unclear';
  htf_timeframe: string;
  structure: Record<string, ForensicsTimeframe>;
  price_path: {
    mfe_r: number | null;
    mae_r: number | null;
    reached: { tp1: boolean; tp2: boolean; tp3: boolean };
    would_have_reached_post_exit?: { tp1: boolean; tp2: boolean; tp3: boolean };
    note?: string;
  };
  narrative: string;
}

/** GET /curriculum/bots/{bot_id}/simulation — SMC Bot Academy plan
 * item 6's "watch it happen" bot-simulation player. Bars + zones +
 * markers already shaped for CandleChart.tsx; `reveal_bar_index` on
 * every zone/marker is the step the real detector first produced it
 * (no-lookahead) — the frontend player reveals each one once candle
 * playback reaches that bar index, rather than showing everything at
 * once. See backend/app/engines/bot_simulation.py's own docstring. */
export interface BotSimulationBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface BotSimulationZone {
  kind: 'order_block' | 'fvg';
  timeframe: string;
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  from_index: number;
  to_index: number;
  color: string;
  label: string;
  status: string;
  classification?: string | null;
  mitigated_percent?: number;
  reveal_bar_index: number;
}
export interface BotSimulationMarker {
  kind: 'swing' | 'bos' | 'choch' | 'sweep' | 'premium_discount';
  timeframe: string;
  index: number;
  price: number;
  label: string;
  color: string;
  shape: 'dot' | 'triangle-up' | 'triangle-down' | 'diamond';
  side: 'above' | 'below';
  reveal_bar_index: number;
}
export interface BotSimulationResponse {
  bot_id: string;
  strategy_key: string;
  symbol: string;
  exchange: string;
  direction: 'long' | 'short';
  base_timeframe: string;
  required_timeframes: string[];
  // 'real_trade' = this bot's own real closed trade for the
  // requested direction; 'real_market_fallback' = no such trade
  // exists yet, so this is real RECENT market data instead — never a
  // fabricated price (see the plan's own non-negotiable).
  source: 'real_trade' | 'real_market_fallback';
  matched_trade_id: string | null;
  is_synthetic: false;
  label: string;
  bars: BotSimulationBar[];
  zones: BotSimulationZone[];
  markers: BotSimulationMarker[];
}

/** Drawdown & Target Encroachment — by direct request ("a metric that
 * can help monitor specific trades drawdown encroachment ... how much
 * of my SL area is used or encroached into during each trade"). See
 * GET /trades/analytics/encroachment's own backend comment for how
 * this is computed (real candles, not an approximation). */
export interface EncroachmentRow {
  trade_id: string;
  symbol: string;
  direction: 'long' | 'short';
  outcome: 'win' | 'loss' | 'breakeven';
  realized_pnl: number;
  sl_encroachment_pct: number;
  tp_encroachment_pct: number | null;
}
export interface WhatIfRow {
  tighten_pct: number;
  winners_would_be_stopped: number;
  winners_total: number;
  winners_would_be_stopped_pct: number;
}
export interface EncroachmentResponse {
  rows: EncroachmentRow[];
  avg_sl_encroachment_pct: number;
  avg_tp_encroachment_pct: number;
  what_if_tighter_sl: WhatIfRow[];
  trades_requested: number;
  trades_analyzed: number;
}

export interface BotPerformance {
  bot_id: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  average_r: number;
}

/** GET /bots/exchange-balances — see routers/bots.py's own
 * get_exchange_balances docstring. `balance` is null when either the
 * read failed (`error` set) or the broker's own get_balance() shape
 * isn't normalized yet (`unrecognized_shape: true`, `error: null`) —
 * these are two different, distinguishable reasons for "no number
 * here," not one. */
export interface ExchangeBalanceEntry {
  exchange: string;
  label?: string | null;
  balance: number | null;
  unrecognized_shape: boolean;
  error?: string | null;
}
/** Which of the caller's own visible bots is CURRENTLY preferring
 * this exact account, and how — see routers/bots.py's own
 * get_exchange_balances docstring ("integrate with the preferred
 * exchange and auto"). `mode: "auto"` carries exchange_engine.py's
 * own live `reason` string; `"fixed"` never does. */
export interface ExchangeBalanceUsedBy {
  bot_id: string;
  bot_name: string;
  mode: 'fixed' | 'auto';
  reason: string | null;
}
export interface BotExchangeBalanceEntry extends ExchangeBalanceEntry {
  bot_id: string;
  bot_name: string;
  used_by: ExchangeBalanceUsedBy[];
}
export interface TraderExchangeBalanceEntry extends ExchangeBalanceEntry {
  connection_id: string;
  /** Only set on GET /bots/master-exchange-balances (Admin's Master
   * card) — whose connection this is. Absent on the trader-facing
   * endpoint, since that one is always already scoped to the caller's
   * own connections. */
  user_id?: string;
  user_name?: string | null;
  user_email?: string | null;
}
export interface ExchangeBalancesResponse {
  bot_accounts: BotExchangeBalanceEntry[];
  /** True when `bot_accounts` was deliberately left empty because the
   * caller isn't Admin/Super Admin — see routers/bots.py's own
   * get_exchange_balances docstring ("the exchange balance info
   * should be gated based on user"). Distinguishes "nothing to show"
   * from "you can't see this" so the page can say which one it is. */
  bot_accounts_restricted: boolean;
  trader_accounts: TraderExchangeBalanceEntry[];
}
/** GET /bots/master-exchange-balances — the Admin portal's "sees all"
 * view (no ownership scoping on either side). Same shape as
 * ExchangeBalancesResponse minus bot_accounts_restricted (never
 * applicable here — Super Admin always sees everything). */
export interface MasterExchangeBalancesResponse {
  bot_accounts: BotExchangeBalanceEntry[];
  trader_accounts: TraderExchangeBalanceEntry[];
}

/** GET /bots/system-health — by direct request ("give a memory audit
 * or indicator signal ... what number of Bots running is safe ...
 * auto engine that manages memory"). Mirrors
 * memory_watchdog.MemoryWatchdog.get_status()'s own shape exactly —
 * single source of truth, no second copy of this math on the
 * frontend. */
export interface SystemHealthResponse {
  zone: 'ok' | 'warn' | 'critical' | 'unknown';
  note?: string;
  process_rss_mb: number | null;
  process_limit_mb: number;
  process_ratio: number | null;
  host_mem_total_mb: number | null;
  host_mem_available_mb: number | null;
  host_swap_used_mb: number | null;
  host_ratio: number | null;
  scanner_degraded: boolean | null;
  scan_group_count: number | null;
  scan_group_warn_count?: number;
  scan_groups_near_limit?: boolean;
  active_bot_count: number;
}

/** GET /bots/system-health-summary — the trader-facing, trimmed
 * counterpart to SystemHealthResponse above (no raw host MB/swap
 * numbers, just the traffic-light zone). */
export interface SystemHealthSummaryResponse {
  zone: 'ok' | 'warn' | 'critical' | 'unknown';
  scanner_degraded: boolean | null;
  message: string;
}

export interface BotMetricsUpdate {
  risk_per_trade?: number;
  max_daily_trades?: number;
  max_concurrent_trades?: number;
  max_portfolio_exposure?: number;
  min_rr_ratio?: number;
  use_trailing_stop?: boolean;
  trailing_stop_activation?: 1.0 | 2.0;
  symbols?: string[];
  timeframes?: string[];
  /** null clears this bot's own override (falls back to the platform
   * default/Admin master). See BotConfig.account_balance_usd's own
   * backend comment. */
  account_balance_usd?: number | null;
  /** null clears this bot's own leverage override. See BotConfig.
   * leverage's own backend comment. */
  leverage?: number | null;
  /** See BotConfig.margin_mode above. */
  margin_mode?: 'dedicated' | 'auto_switch';
  /** Merged server-side over whatever's already stored, then
   * hard-clipped to each key's declared bounds regardless of what's
   * sent — see botsApi.getTunableParams for the bounds to validate
   * against client-side too. */
  strategy_params?: Record<string, number>;
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
  drawdown: number;
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
  // MetaApi (MT4/MT5) only — null/meaningless for the other 5 exchanges.
  last_activity_at?: string | null;
  auto_undeploy_minutes?: number | null;
  /** "dedicated Vs Auto margin account setting for ... manual" — see
   * BotConfig.margin_mode's own comment above. */
  margin_mode?: 'dedicated' | 'auto_switch';
}

export interface DeployStateResponse {
  success: boolean;
  state?: string | null;
  connection_status?: string | null;
  error?: string | null;
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

// One isolated-mode (single bot, single symbol) backtest run — see
// backend/app/routers/backtests.py. Portfolio mode isn't exposed yet
// (scope is always "isolated" for now). Stats are null until
// status === 'completed'; equity_curve is a self-contained cumulative
// R-multiple sequence (not dollars — this backtest mode deliberately
// doesn't assume a compounding account size, matching how every live
// bot actually sizes trades off a static reference balance).
interface BacktestRunBase {
  id: string;
  bot_id: string;
  start_date: string;
  end_date: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  error_message: string | null;
  total_trades: number | null;
  win_rate: number | null;
  expectancy_r: number | null;
  max_drawdown_pct: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface IsolatedBacktestRun extends BacktestRunBase {
  scope: 'isolated';
  bot_ids: null;
  symbol: string | null;
  base_timeframe: string | null;
  equity_curve: { timestamp: string; cum_r: number }[] | null;
}

// Portfolio mode's own per-bot/symbol open/close event trace — the raw
// output of PortfolioBacktestEngine.run(), persisted as-is inside
// equity_curve.events (backend/app/services/backtest_runner.py's own
// _summarize_portfolio).
export interface PortfolioEquityEvent {
  timestamp: string;
  balance: number;
  bot_id: string;
  symbol: string;
  event: 'open' | 'close';
  pnl: number;
}

export interface PortfolioBacktestEquityCurve {
  starting_balance: number;
  ending_balance: number;
  rejected_by_capital_adequacy: number;
  events: PortfolioEquityEvent[];
  per_bot: Record<string, { trades: number; win_rate: number; expectancy_r: number }>;
  errors: Record<string, string>;
}

export interface PortfolioBacktestRun extends BacktestRunBase {
  scope: 'portfolio';
  // Null while queued (not yet resolved); once running/completed,
  // always the real resolved participant set — see BacktestRunORM's
  // own docstring for why this is never just the request's own list.
  bot_ids: string[] | null;
  symbol: null;
  base_timeframe: null;
  equity_curve: PortfolioBacktestEquityCurve | null;
}

export type BacktestRun = IsolatedBacktestRun | PortfolioBacktestRun;

// --- Explore: Congressional Trades + News Monitor ---
// Backed by backend/app/services/congress_trades.py and
// backend/app/services/news_monitor.py.

export interface CongressTradeOption {
  contracts: number;
  kind: 'call' | 'put';
  strike: number;
  expires: string | null;
  exercised: boolean;
}

export interface CongressTradeRow {
  owner: string;
  owner_name: string;
  asset: string;
  ticker: string | null;
  type: string;
  type_name: string;
  date: string | null;
  notified: string | null;
  amount: string;
  amount_low: number | null;
  amount_high: number | null;
  status: string | null;
  account: string | null;
  description: string | null;
  option?: CongressTradeOption;
  shares?: number;
  days_to_disclose?: number;
  late?: boolean;
}

export interface CongressTradeReport {
  name: string | null;
  status: string | null;
  district: string | null;
  doc_id: string | null;
  filed: string | null;
  rows: CongressTradeRow[];
}

export interface CongressTradeFiling {
  doc_id: string;
  type: string;
  type_name: string;
  last: string;
  first: string;
  name: string;
  district: string;
  year: number;
  filed: string | null;
  url: string | null;
  report: CongressTradeReport | null;
}

export interface CongressTradesResponse {
  source: string;
  note: string;
  year: number;
  filings: CongressTradeFiling[];
}

export interface NewsMonitorItem {
  id: string;
  source: 'Yahoo Finance' | 'SEC EDGAR';
  kind: 'headline' | 'filing';
  ticker: string;
  title: string;
  summary: string;
  link: string;
  time: string | null;
  important: boolean;
  topics: string[];
  form?: string;
  items?: string[];
}

export interface NewsMonitorResponse {
  symbol: string;
  items: NewsMonitorItem[];
  errors: string[];
}

export interface TimeMachineRequest {
  exchange?: string;
  symbol: string;
  timeframe?: string;
  entry: number;
  stop: number;
  target: number;
  direction?: 'long' | 'short';
  horizon_bars?: number;
  replays?: number;
  lookback_days?: number;
}

export interface TimeMachineFanChartPoint {
  step: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface TimeMachineResponse {
  sessions_used: number;
  horizon_bars: number;
  replays: number;
  target_r: number;
  odds: {
    target_first_pct: number;
    stop_first_pct: number;
    neither_pct: number;
    green_pct: number;
  };
  r_multiple: {
    mean: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  verdict: string;
  fan_chart: TimeMachineFanChartPoint[];
  history: {
    sessions: number;
    target_first: number;
    stop_first: number;
    neither: number;
    mean_r: number;
  };
  exchange: string;
  symbol: string;
  timeframe: string;
  entry: number;
  stop: number;
  target: number;
  direction: 'long' | 'short';
}

export interface TradeScannerRequest {
  exchange?: string;
  symbols: string[];
  timeframe?: string;
  limit?: number;
  min_price?: number;
  min_volume?: number;
}

export interface TradeScannerHit {
  symbol: string;
  setups: string[];
  watching: string[];
  price: number;
  volume: number;
  rsi: number | null;
  run_pct: number;
  range5_pct: number;
}

export interface TradeScannerResponse {
  exchange: string;
  timeframe: string;
  hits: TradeScannerHit[];
  counts: {
    requested: number;
    scanned: number;
    skipped_short: number;
    skipped_illiquid: number;
    errored: number;
    hits: number;
  };
  errors: string[];
}

export interface DayTraderSkillChatResponse {
  reply: string;
}

export interface FeatureAccessGrantItem {
  id: string;
  email: string;
  feature_key: string;
  granted_at: string;
}

export interface TradeScannerAiReadResponse {
  summary: string;
}
