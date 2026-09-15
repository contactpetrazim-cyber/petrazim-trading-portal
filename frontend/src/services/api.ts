
import axios from 'axios';
import { Trade, BotConfig, BotPerformance, BotMetricsUpdate, DashboardStats, SignalPreview, PerformanceSummary, TradeBreakdown, TradeBreakdownPeriod, ExchangeMetaResponse, TraderBrokerConnection, AvailableBot, TraderBotSubscription, OutboundIpsResponse, FeeSettings, FeeLedgerEntry, MyFeesResponse } from '../types';
import { useAuthStore } from '../hooks/useAuth';
import { triggerAccessExpired } from '../components/AccessExpiredGate';
import { handleUnauthorized } from '../lib/authGuard';
import { getActiveBase, tryFailoverToVm } from '../lib/backendFailover';


const api = axios.create({
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// dashboard/trades/bots (the Trader console) now require auth on every
// route — see routers/dashboard.py, trades.py, bots.py — so every
// request through this client needs a Bearer token. Read straight from
// the zustand store rather than a prop/hook: this module is imported
// by plain .then()-chained API objects below, outside any component.
api.interceptors.request.use((config) => {
  // Dual-failover — see lib/backendFailover.ts. Resolved fresh on
  // EVERY request (not a static `baseURL` on the client, which is
  // what this used to be) so a request made after a failover already
  // switched mid-session picks it up automatically, same as the
  // fixed-once retry below picks it up for the request that triggered
  // the switch.
  config.baseURL = getActiveBase();
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;

    if (status === 402 && detail?.error === 'access_expired') {
      triggerAccessExpired(detail);
    }

    if (status === 401) {
      // Only a token /auth/me itself rejects ends the session — see
      // lib/authGuard.ts (this used to log out on ANY 401, which is
      // what produced the perpetual sign-in loop).
      void handleUnauthorized();
    }

    // A genuine connection failure never reaches a server at all, so
    // axios never populates `error.response` for one — a real HTTP
    // error status always has one, and must never trigger a failover
    // (the backend answering with e.g. a 500 means it's up). Guarded
    // to one retry per request via a flag on its own config, same
    // shape as apiFetch's own `_failoverRetried` — a VM that's ALSO
    // down fails straight through instead of retrying forever.
    if (!error.response && !error.config?.__failoverRetried && tryFailoverToVm()) {
      error.config.__failoverRetried = true;
      return api(error.config);
    }

    return Promise.reject(error);
  },
);

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
  getTradeBreakdown: (period: TradeBreakdownPeriod = 'today') =>
    api.get<TradeBreakdown>(`/dashboard/trade-breakdown?period=${period}`).then(r => r.data),
  getPerformance: (period = '7d') => api.get<PerformanceSummary[]>(`/dashboard/performance?period=${period}`).then(r => r.data),
  getEquityCurve: (days = 30) => api.get(`/dashboard/equity-curve?days=${days}`).then(r => r.data),
  getSignalPreview: () => api.get<SignalPreview[]>('/dashboard/signals/preview').then(r => r.data),
};

export const tradesApi = {
  getTrades: (params?: { status?: string; bot_id?: string; symbol?: string; direction?: string; source?: string; limit?: number; offset?: number }) =>
    api.get<Trade[]>('/trades/', { params }).then(r => r.data),
  getPendingApprovals: () => api.get<Trade[]>('/trades/pending-approvals').then(r => r.data),
  approveTrade: (tradeId: string, approved: boolean, notes?: string) =>
    api.post('/trades/approve', { trade_id: tradeId, approved, notes }).then(r => r.data),
  getActiveTrades: () => api.get<Trade[]>('/trades/active').then(r => r.data),
  getTodayStats: () => api.get('/trades/stats/today').then(r => r.data),
  getTrade: (tradeId: string) => api.get<Trade>(`/trades/${tradeId}`).then(r => r.data),
  getTradeLogs: (tradeId: string) => api.get(`/trades/${tradeId}/logs`).then(r => r.data),
  // Manual cancellation — by direct request ("partial or manual
  // cancellations ... even in test mode"). Lives under /manual-trading/
  // (see that router's own cancel_order docstring for what this
  // actually does for a PENDING vs an ACTIVE trade).
  cancelOrder: (tradeId: string, exitPrice?: number) =>
    api.post(`/manual-trading/${tradeId}/cancel`, { exit_price: exitPrice ?? null }).then(r => r.data),
  // Exchange-style "manage this position" actions — by direct request
  // ("view and edit the statistics of this trade ... entry, SL, TP,
  // partial TP, partial exit ... copy exchange style trade order
  // management"). Both already existed as real, working backend
  // endpoints (routers/manual_trading.py) with no frontend caller at
  // all until PositionManager.tsx.
  // entry_price only ever takes effect for a still-PENDING trade
  // (amending the resting order's own trigger price) — the backend
  // silently ignores it for an already-ACTIVE one; see that route's
  // own docstring.
  modifyTargets: (tradeId: string, targets: { stop_loss?: number; take_profit?: number; take_profit_2?: number; take_profit_3?: number; entry_price?: number }) =>
    api.patch(`/manual-trading/${tradeId}/modify-targets`, targets).then(r => r.data),
  partialClose: (tradeId: string, percent: number, exitPrice: number) =>
    api.post(`/manual-trading/${tradeId}/partial-close`, { percent, exit_price: exitPrice }).then(r => r.data),
};

export const botsApi = {
  getBots: () => api.get<BotConfig[]>('/bots/').then(r => r.data),
  getBot: (botId: string) => api.get<BotConfig>(`/bots/${botId}`).then(r => r.data),
  createBot: (config: {
    bot_id: string; bot_name: string; bot_type: string; symbols: string[];
    timeframes?: string[]; risk_per_trade?: number; max_daily_trades?: number;
    max_concurrent_trades?: number; min_rr_ratio?: number;
    execution_mode?: 'human_in_loop' | 'fully_autonomous'; use_trailing_stop?: boolean;
    // Free-typed (not a closed list) — by direct request ("option to
    // type in specific Exchange"); routers/bots.py normalizes casing.
    exchange?: string | null;
  }) => api.post<BotConfig>('/bots/', config).then(r => r.data),
  toggleBot: (botId: string, active: boolean) =>
    api.patch(`/bots/${botId}/toggle`, { bot_id: botId, active }).then(r => r.data),
  setMode: (botId: string, mode: 'human_in_loop' | 'fully_autonomous') =>
    api.patch(`/bots/${botId}/mode?mode=${mode}`).then(r => r.data),
  // Same Test/Live + Paper Trading pair the Manual Trading order form
  // already exposes, per-bot — by direct request ("do the same and do
  // paper trading for bot trading ... with a test / paper trading
  // toggle"). Either field can be omitted to leave it unchanged.
  setTradingMode: (botId: string, update: { trading_mode?: 'test' | 'live'; paper_trading_enabled?: boolean }) =>
    api.patch<BotConfig>(`/bots/${botId}/trading-mode`, update).then(r => r.data),
  updateMetrics: (botId: string, update: BotMetricsUpdate) =>
    api.patch<BotConfig>(`/bots/${botId}/metrics`, update).then(r => r.data),
  getPerformance: (botId: string) => api.get<BotPerformance>(`/bots/${botId}/performance`).then(r => r.data),
  // Rename/delete — by direct request ("create options to edit bot
  // names and also to delete bots").
  renameBot: (botId: string, botName: string) =>
    api.patch<BotConfig>(`/bots/${botId}/name`, { bot_name: botName }).then(r => r.data),
  deleteBot: (botId: string) => api.delete(`/bots/${botId}`).then(r => r.data),
  // Real, live-searchable Binance instrument list — by direct request
  // ("a search instrument space that searches the instrument - exactly
  // like the one on the chart ... removing errors"). Reuses the same
  // proxy order_flow.py already has for the Order Flow tool.
  searchInstruments: (q: string) =>
    api.get<{ instruments: { symbol: string; base_asset: string; quote_asset: string }[] }>(
      '/order-flow/instruments', { params: { q, limit: 25 } }
    ).then(r => r.data.instruments),
  // The chart's own "search any instrument" — real TradingView symbols
  // across every asset class (not just Binance crypto), proxied
  // server-side. See order_flow.py's chart_symbol_search for why this
  // has to be a backend proxy rather than a direct browser call.
  chartSymbolSearch: (q: string) =>
    api.get<{ results: { symbol: string; exchange: string; description: string; type: string }[] }>(
      '/order-flow/symbol-search', { params: { q, limit: 25 } }
    ).then(r => r.data.results),
};

export interface KlineBar {
  time_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const orderFlowApi = {
  // Real Binance OHLC candles for the small crypto allow-list
  // order_flow.py already validates against (see that router's own
  // ALLOWED_SYMBOLS comment) — used by ChartPanel's "On Chart" position
  // view (PositionOnChartModal.tsx) to actually draw Entry/SL/TP as
  // lines on real candles, something the embedded TradingView iframe
  // can't do (see TradingViewChart.tsx's own docstring on why). A 400
  // here for an unsupported symbol (e.g. a forex pair) is expected and
  // handled by the caller, not a bug.
  getKlines: (symbol: string, interval: string = '1h', limit: number = 100) =>
    api.get<{ symbol: string; interval: string; candles: KlineBar[] }>(
      '/order-flow/klines', { params: { symbol, interval, limit } }
    ).then(r => r.data),
};

export interface TraderBotSummary {
  bot_id: string;
  bot_name: string;
  status: string;
  risk_per_trade: number;
  max_daily_trades: number;
  max_concurrent_trades: number;
  max_portfolio_exposure: number;
  min_rr_ratio: number;
  active_trades: number;
  trades_today: number;
}

export interface TraderOverview {
  trader_user_id: string;
  full_name: string;
  email: string;
  status: string;
  bots: TraderBotSummary[];
  daily_pnl: number;
  total_trades_today: number;
  total_active_trades: number;
  open_risk_exposure_pct: number;
}

export const rosterApi = {
  getOverview: (traderId: string) => api.get<TraderOverview>(`/roster/${traderId}/overview`).then(r => r.data),
};

// Trader Exchange Connections — self-service "connect your own
// exchange account" onboarding, by direct request ("create an
// onboarding page or system ... trade manually and using our bots on
// their accounts"). Mirrors backend/app/routers/trader_broker_connections.py
// one-to-one; adminExchangeConnectionsApi below is the separate
// /admin/exchange-connections surface for platform-wide management.
export const exchangeConnectionsApi = {
  listExchanges: () => api.get<ExchangeMetaResponse>('/exchange-connections/exchanges').then(r => r.data),
  list: () => api.get<TraderBrokerConnection[]>('/exchange-connections').then(r => r.data),
  connect: (body: { exchange: string; api_key: string; api_secret?: string; account_id?: string; label?: string; mode?: string }) =>
    api.post<TraderBrokerConnection>('/exchange-connections', body).then(r => r.data),
  update: (id: string, body: Partial<{ label: string; mode: string; is_active: boolean; api_key: string; api_secret: string; account_id: string }>) =>
    api.patch<TraderBrokerConnection>(`/exchange-connections/${id}`, body).then(r => r.data),
  remove: (id: string) => api.delete(`/exchange-connections/${id}`).then(r => r.data),
  test: (id: string) => api.post<{ success: boolean; status: string; error?: string }>(`/exchange-connections/${id}/test`).then(r => r.data),
  availableBots: () => api.get<AvailableBot[]>('/exchange-connections/available-bots').then(r => r.data),
  mySubscriptions: () => api.get<TraderBotSubscription[]>('/exchange-connections/bots').then(r => r.data),
  subscribeBot: (connectionId: string, botId: string, riskPerTrade?: number, copyMode: 'auto' | 'manual' = 'manual') =>
    api.post<TraderBotSubscription>(`/exchange-connections/${connectionId}/bots`, { bot_id: botId, risk_per_trade: riskPerTrade, copy_mode: copyMode }).then(r => r.data),
  updateSubscription: (subscriptionId: string, body: Partial<{ is_active: boolean; risk_per_trade: number; copy_mode: 'auto' | 'manual' }>) =>
    api.patch<TraderBotSubscription>(`/exchange-connections/bots/${subscriptionId}`, body).then(r => r.data),
  unsubscribeBot: (subscriptionId: string) => api.delete(`/exchange-connections/bots/${subscriptionId}`).then(r => r.data),
};

export const adminExchangeConnectionsApi = {
  list: () => api.get<TraderBrokerConnection[]>('/admin/exchange-connections').then(r => r.data),
  suspend: (id: string, suspended: boolean) =>
    api.patch<TraderBrokerConnection>(`/admin/exchange-connections/${id}/suspend`, { suspended }).then(r => r.data),
  remove: (id: string) => api.delete(`/admin/exchange-connections/${id}`).then(r => r.data),
  getOutboundIps: () => api.get<OutboundIpsResponse>('/admin/exchange-connections/outbound-ips').then(r => r.data),
  refreshOutboundIps: () => api.post<OutboundIpsResponse>('/admin/exchange-connections/outbound-ips/refresh').then(r => r.data),
  setOutboundIps: (body: { outbound_ip_vm?: string; outbound_ip_fixie?: string }) =>
    api.patch<OutboundIpsResponse>('/admin/exchange-connections/outbound-ips', body).then(r => r.data),
};

// Performance-fee toggle, percentage, and payout destination — by
// direct request ("introduce a fee base or a share of the profit -
// on a success basis... Create a fee vs free toggle... include in
// Admin portal... form for Admin to enter Account to receive the
// benefit... Crypto address and/or bank account - Paystack?"). Mirrors
// backend/app/routers/fees.py one-to-one; feesApi below is the
// trader-facing "what do I owe" half of the same feature.
export const adminFeesApi = {
  getSettings: () => api.get<FeeSettings>('/admin/fees/settings').then(r => r.data),
  updateSettings: (body: Partial<{
    enabled: boolean; fee_percent: number; payout_method: string;
    crypto_address: string; crypto_network: string;
    paystack_account_name: string; paystack_account_number: string; paystack_bank_name: string; paystack_bank_code: string;
    notes: string;
  }>) => api.patch<FeeSettings>('/admin/fees/settings', body).then(r => r.data),
  listLedger: (status?: 'owed' | 'paid' | 'waived') =>
    api.get<FeeLedgerEntry[]>('/admin/fees/ledger', { params: status ? { status } : undefined }).then(r => r.data),
  markPaid: (entryId: string, note?: string) =>
    api.patch<FeeLedgerEntry>(`/admin/fees/ledger/${entryId}/mark-paid`, { note }).then(r => r.data),
  waive: (entryId: string, note?: string) =>
    api.patch<FeeLedgerEntry>(`/admin/fees/ledger/${entryId}/waive`, { note }).then(r => r.data),
};

export const feesApi = {
  myLedger: () => api.get<MyFeesResponse>('/fees/my-ledger').then(r => r.data),
};

export const webhookApi = {
  sendAlert: (payload: any) => api.post<{
    success: boolean;
    message: string;
    trade_id?: string;
    status?: string;
  }>('/webhook/tradingview', payload).then(r => r.data),
};

export default api;
