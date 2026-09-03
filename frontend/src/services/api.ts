
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
  getTrades: (params?: { status?: string; bot_id?: string; symbol?: string; direction?: string; limit?: number; offset?: number }) =>
    api.get<Trade[]>('/trades/', { params }).then(r => r.data),
  getPendingApprovals: () => api.get<Trade[]>('/trades/pending-approvals').then(r => r.data),
  approveTrade: (tradeId: string, approved: boolean, notes?: string) =>
    api.post('/trades/approve', { trade_id: tradeId, approved, notes }).then(r => r.data),
  getActiveTrades: () => api.get<Trade[]>('/trades/active').then(r => r.data),
  getTodayStats: () => api.get('/trades/stats/today').then(r => r.data),
  getTrade: (tradeId: string) => api.get<Trade>(`/trades/${tradeId}`).then(r => r.data),
  getTradeLogs: (tradeId: string) => api.get(`/trades/${tradeId}/logs`).then(r => r.data),
};

export const botsApi = {
  getBots: () => api.get<BotConfig[]>('/bots/').then(r => r.data),
  getBot: (botId: string) => api.get<BotConfig>(`/bots/${botId}`).then(r => r.data),
  createBot: (config: {
    bot_id: string; bot_name: string; bot_type: string; symbols: string[];
    timeframes?: string[]; risk_per_trade?: number; max_daily_trades?: number;
    max_concurrent_trades?: number; min_rr_ratio?: number;
    execution_mode?: 'human_in_loop' | 'fully_autonomous'; use_trailing_stop?: boolean;
  }) => api.post<BotConfig>('/bots/', config).then(r => r.data),
  toggleBot: (botId: string, active: boolean) =>
    api.patch(`/bots/${botId}/toggle`, { bot_id: botId, active }).then(r => r.data),
  setMode: (botId: string, mode: 'human_in_loop' | 'fully_autonomous') =>
    api.patch(`/bots/${botId}/mode?mode=${mode}`).then(r => r.data),
  updateMetrics: (botId: string, update: BotMetricsUpdate) =>
    api.patch<BotConfig>(`/bots/${botId}/metrics`, update).then(r => r.data),
  getPerformance: (botId: string) => api.get<BotPerformance>(`/bots/${botId}/performance`).then(r => r.data),
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
