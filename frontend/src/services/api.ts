
import axios from 'axios';
import { Trade, BotConfig, BotPerformance, BotMetricsUpdate, DashboardStats, SignalPreview, PerformanceSummary } from '../types';
import { useAuthStore } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
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
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
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

export const webhookApi = {
  sendAlert: (payload: any) => api.post<{
    success: boolean;
    message: string;
    trade_id?: string;
    status?: string;
  }>('/webhook/tradingview', payload).then(r => r.data),
};

export default api;
