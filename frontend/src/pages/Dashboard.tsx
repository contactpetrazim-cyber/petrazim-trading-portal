import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { TradeRow } from '../components/TradeRow';
import { FoldedCard } from '../components/FoldedCard';
import { ChartPanel } from '../components/ChartPanel';
import { useAppStore } from '../hooks/useStore';
import { useThemeStore } from '../hooks/useTheme';
import { HERO_GRADIENT } from '../config/theme';
import { dashboardApi, tradesApi, botsApi } from '../services/api';
import { Trade, BotConfig, BotPerformance } from '../types';
import {
  Activity,
  AlertCircle,
  DollarSign,
  Target,
  TrendingDown,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { LoadingIndicator } from '../components/LoadingIndicator';
import type { FetchPhase } from '../lib/resilientFetch';

interface EquityPoint {
  timestamp: string;
  equity: number;
}

export function DashboardPage() {
  const { stats, setStats } = useAppStore();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [equityData, setEquityData] = useState<EquityPoint[]>([]);
  const [pending, setPending] = useState<Trade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [performance, setPerformance] = useState<Record<string, BotPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  async function loadData(): Promise<'ok' | 'retry' | 'stop'> {
    try {
      const [statsData, curve, pendingApprovals, trades, botList] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getEquityCurve(30),
        tradesApi.getPendingApprovals(),
        tradesApi.getTrades({ limit: 5 }),
        botsApi.getBots(),
      ]);
      setStats(statsData);
      setEquityData(curve);
      setPending(pendingApprovals);
      setRecentTrades(trades);
      setBots(botList);

      const perfEntries = await Promise.all(
        botList.map(async (b) => [b.bot_id, await botsApi.getPerformance(b.bot_id).catch(() => null)] as const)
      );
      const perfMap: Record<string, BotPerformance> = {};
      for (const [id, perf] of perfEntries) if (perf) perfMap[id] = perf;
      setPerformance(perfMap);
      setError(null);
      return 'ok';
    } catch (e: any) {
      setError('Could not load dashboard data.');
      const status = e?.response?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        return 'stop';
      }
      return 'retry';
    }
  }

  const RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 15000, 20000, 20000];
  async function loadWithRetry() {
    setPhase('loading');
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const result = await loadData();
      if (result === 'ok') { setPhase('ready'); setLoading(false); return; }
      if (result === 'stop') { setPhase('failed'); setLoading(false); return; }
      setPhase(attempt >= 2 ? 'stalled' : 'loading');
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
    setPhase('failed');
    setLoading(false);
  }

  useEffect(() => {
    loadWithRetry();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove(tradeId: string) {
    await tradesApi.approveTrade(tradeId, true);
    loadData();
  }

  async function handleReject(tradeId: string) {
    await tradesApi.approveTrade(tradeId, false);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        {phase === 'stalled' ? (
          <div className="w-full max-w-xs"><LoadingIndicator phase={phase} dark={dark} /></div>
        ) : (
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${dark ? 'border-smc-accent' : 'border-corporate-hero'}`}></div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6 md:p-8 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <div className="absolute -right-8 -bottom-14 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-white/60 text-xs font-bold tracking-[0.15em] mb-2 block">TRADER CONSOLE</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white font-display">Dashboard</h2>
            <p className="text-white/80 text-sm mt-1">Real-time SMC Trading Engine overview</p>
          </div>
          {error && <span className="px-3 py-1 bg-red-500/20 text-white rounded-full text-sm font-medium">{error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Today's Trades"
          value={stats?.total_trades_today || 0}
          subtitle={`${stats?.win_rate_today || 0}% win rate`}
          icon={<Activity size={20} />}
          color="blue" dark={dark}
        />
        <StatCard
          title="Daily P&L"
          value={`$${stats?.daily_pnl?.toFixed(2) || '0.00'}`}
          subtitle="Net realized profit"
          icon={<DollarSign size={20} />}
          color={stats && stats.daily_pnl >= 0 ? 'green' : 'red'} dark={dark}
        />
        <StatCard
          title="Daily Drawdown"
          value={`$${stats?.current_drawdown?.toFixed(2) || '0.00'}`}
          subtitle="Decline from today's P&L high"
          icon={<TrendingDown size={20} />}
          color={stats && stats.current_drawdown > 0 ? 'amber' : 'blue'} dark={dark}
        />
        <StatCard
          title="Active Trades"
          value={stats?.active_trades || 0}
          subtitle="Currently in market"
          icon={<Target size={20} />}
          color="purple" dark={dark}
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pending_approvals || 0}
          subtitle="Human-in-the-Loop"
          icon={<AlertCircle size={20} />}
          color="amber" dark={dark}
        />
      </div>

      <FoldedCard
        title="Chart" summary="A live TradingView chart, right on your dashboard"
        icon={<LineChartIcon size={19} />} dark={dark}
      >
        <ChartPanel symbol="BINANCE:BTCUSDT" height={420} tradeSymbol="BTCUSDT" dark={dark} />
        <Link to="/tradingview" className={`text-xs font-medium mt-2 inline-block ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>
          Open My Workspace (saved views, drawing tools) →
        </Link>
      </FoldedCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FoldedCard title="Equity Curve" dark={dark}>
            {equityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">
                No closed trades yet — the equity curve fills in as trades close.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#e5e7eb'} />
                  <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} tickFormatter={(t) => new Date(t).toLocaleDateString()} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 200', 'dataMax + 200']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', border: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`, borderRadius: '8px' }}
                    labelStyle={{ color: dark ? '#9ca3af' : '#374151' }}
                    labelFormatter={(t) => new Date(t).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#equityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </FoldedCard>
        </div>

        <FoldedCard title="Bot Performance" dark={dark}>
          {bots.length === 0 ? (
            <p className="text-sm text-gray-400">No bots configured yet.</p>
          ) : (
            <div className="space-y-4">
              {bots.map((bot) => {
                const perf = performance[bot.bot_id];
                return (
                  <div key={bot.bot_id} className={`flex items-center justify-between p-3 rounded-lg ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
                    <div>
                      <div className="font-medium text-sm">{bot.bot_name}</div>
                      <div className="text-xs text-gray-400">{perf ? `${perf.total_trades} trades` : '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${(perf?.win_rate ?? 0) >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {perf ? `${perf.win_rate}%` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">{bot.status === 'active' ? 'Active' : 'Paused'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FoldedCard>
      </div>

      <FoldedCard
        title="Pending Approvals"
        summary={pending.length === 0 ? 'Nothing waiting on your approval right now.' : `${pending.length} waiting on you`}
        dark={dark}
      >
        <div className="flex items-center justify-end mb-2">
          <span className="text-xs text-gray-400">Auto-refresh every 30s</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing waiting on your approval right now.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((trade) => (
              <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </FoldedCard>

      <FoldedCard title="Recent Trades" dark={dark}>
        {recentTrades.length === 0 ? (
          <p className="text-sm text-gray-400">No trades yet.</p>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade) => (
              <TradeRow key={trade.trade_id} trade={trade} />
            ))}
          </div>
        )}
      </FoldedCard>
    </div>
  );
}