import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowUpRight, BookOpen, DollarSign, Gauge,
  LineChart as LineChartIcon, RefreshCw, Target, TrendingDown, Wrench,
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StatCard } from '../components/StatCard';
import { TodayTradeBreakdownPills } from '../components/TodayTradeBreakdownPills';
import { TradeRow } from '../components/TradeRow';
import { FoldedCard } from '../components/FoldedCard';
import { ChartPanel } from '../components/ChartPanel';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { AccessStatusBanner } from '../components/AccessStatusBanner';
import { RoleBadge } from '../components/RoleBadge';
import { apiFetch } from '../components/AccessExpiredGate';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { HERO_GRADIENT } from '../config/theme';
import { dashboardApi, tradesApi, botsApi } from '../services/api';
import { RETRY_DELAYS_MS, type FetchPhase } from '../lib/resilientFetch';
import type { BotConfig, BotPerformance, DashboardStats, Trade } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface EquityPoint { timestamp: string; equity: number }
interface LearningStats {
  stages_completed?: number;
  tracks_started?: number;
  total_xp?: number;
  current_streak_days?: number;
}

const QUICK_LINKS = [
  { to: '/trade', label: 'Trading workspace', hint: 'Charts, tickets and open risk', icon: LineChartIcon },
  { to: '/analytics', label: 'Trade analytics', hint: 'Win rate, R multiples, sessions', icon: Gauge },
  { to: '/tools', label: 'Tools', hint: 'Order flow, journal reviewer, calculators', icon: Wrench },
  { to: '/learn', label: 'Learn', hint: 'Tracks, drills and decision labs', icon: BookOpen },
];

/**
 * PremiumDashboardPage — Phase 4. One post-login overview that mirrors
 * the pages a trader already has (Dashboard stats, Analytics equity,
 * Trades, Bots, Chart, Learn) instead of inventing a second set of
 * numbers: every figure below comes from the same real endpoints those
 * pages use, and every card links through to the page that owns it.
 *
 * Access state is shown at the top rather than discovered on a locked
 * page later — same shared entitlement answer EntitlementGate uses.
 */
export function PremiumDashboardPage() {
  const { user, token } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { refresh: refreshAccess } = useEntitlement();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [pending, setPending] = useState<Trade[]>([]);
  const [recent, setRecent] = useState<Trade[]>([]);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [performance, setPerformance] = useState<Record<string, BotPerformance>>({});
  const [learning, setLearning] = useState<LearningStats | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  async function loadOnce(): Promise<boolean> {
    try {
      const [statsData, curve, pendingApprovals, trades, botList] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getEquityCurve(30),
        tradesApi.getPendingApprovals(),
        tradesApi.getTrades({ limit: 6 }),
        botsApi.getBots(),
      ]);
      setStats(statsData);
      setEquity(curve);
      setPending(pendingApprovals);
      setRecent(trades);
      setBots(botList);

      const perfEntries = await Promise.all(
        botList.map(async (b) => [b.bot_id, await botsApi.getPerformance(b.bot_id).catch(() => null)] as const),
      );
      const map: Record<string, BotPerformance> = {};
      for (const [id, perf] of perfEntries) if (perf) map[id] = perf;
      setPerformance(map);
      setError(null);
      return true;
    } catch {
      setError('Could not load your live figures yet.');
      return false;
    }
  }

  // Same cold-start ladder the rest of the portal uses: a sleeping
  // free-tier backend must not present as a broken dashboard.
  async function loadWithRetry() {
    setPhase('loading');
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (await loadOnce()) { setPhase('ready'); return; }
      setPhase(attempt >= 2 ? 'stalled' : 'loading');
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
    setPhase('failed');
  }

  useEffect(() => {
    void loadWithRetry();
    const interval = setInterval(() => { void loadOnce(); }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/auth/learning-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLearning(d))
      .catch(() => {});
  }, [token]);

  const openRisk = useMemo(
    () => bots.reduce((sum, b) => sum + (b.risk_per_trade ?? 0), 0),
    [bots],
  );

  const surface = dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-[#dcdce8] text-corporate-text-on-bg';
  const muted = dark ? 'text-white/50' : 'text-gray-500';

  return (
    <div className="space-y-6">
      <header className="rounded-3xl p-6 md:p-8 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <div className="absolute -right-10 -bottom-16 h-56 w-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="mb-2 block text-xs font-bold tracking-[0.15em] text-white/60">PETRAZIM PREMIUM</span>
            <h1 className="font-display text-2xl font-extrabold text-white md:text-3xl">
              {user?.full_name ? `Welcome back, ${user.full_name.split(' ')[0]}` : 'Your trading overview'}
            </h1>
            <p className="mt-1 text-sm text-white/80">Live positions, risk, learning and tools in one place.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {user && <RoleBadge user={user} />}
            <div className="flex items-center gap-3">
              <LoadingIndicator phase={phase} dark showLabel={false} />
              <button
                type="button"
                onClick={() => { void loadWithRetry(); void refreshAccess(); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <AccessStatusBanner dark={dark} />

      {phase === 'failed' && error && (
        <div className={`rounded-2xl border p-4 ${dark ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <p className="text-sm font-medium">{error}</p>
          <button type="button" onClick={() => void loadWithRetry()} className="mt-2 text-sm font-semibold underline">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Today's Trades" value={stats?.total_trades_today ?? 0} subtitle={`${stats?.win_rate_today ?? 0}% win rate`} icon={<Activity size={20} />} color="blue">
          {stats?.today_breakdown && <TodayTradeBreakdownPills breakdown={stats.today_breakdown} />}
        </StatCard>
        <StatCard title="Daily P&L" value={`$${stats?.daily_pnl?.toFixed(2) ?? '0.00'}`} subtitle="Net realized profit" icon={<DollarSign size={20} />} color={(stats?.daily_pnl ?? 0) >= 0 ? 'green' : 'red'} />
        <StatCard title="Daily Drawdown" value={`$${stats?.current_drawdown?.toFixed(2) ?? '0.00'}`} subtitle="Decline from today's high" icon={<TrendingDown size={20} />} color={(stats?.current_drawdown ?? 0) > 0 ? 'amber' : 'blue'} />
        <StatCard title="Active Trades" value={stats?.active_trades ?? 0} subtitle="Currently in market" icon={<Target size={20} />} color="purple" />
        <StatCard title="Configured Risk" value={`${openRisk.toFixed(2)}%`} subtitle={`${bots.length} bot${bots.length === 1 ? '' : 's'} configured`} icon={<Gauge size={20} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map(({ to, label, hint, icon: Icon }) => (
          <Link key={to} to={to} className={`group rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${surface}`}>
            <div className="mb-2 flex items-center justify-between">
              <Icon size={18} style={{ color: '#005FB8' }} />
              <ArrowUpRight size={15} className={muted} />
            </div>
            <div className="text-sm font-semibold">{label}</div>
            <p className={`mt-0.5 text-xs ${muted}`}>{hint}</p>
          </Link>
        ))}
      </div>

      <FoldedCard title="Live Chart" summary="A live TradingView chart with your saved workspace one click away" icon={<LineChartIcon size={19} />} dark={dark} defaultOpen>
        <ChartPanel symbol="BINANCE:BTCUSDT" height={420} tradeSymbol="BTCUSDT" dark={dark} />
        <Link to="/tradingview" className={`mt-2 inline-block text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>
          Open My Workspace (saved views, drawing tools) →
        </Link>
      </FoldedCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FoldedCard title="Equity Curve (30 days)" dark={dark}>
            {equity.length === 0 ? (
              <div className={`flex h-[300px] items-center justify-center text-sm ${muted}`}>
                No closed trades yet — the curve fills in as trades close.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equity}>
                  <defs>
                    <linearGradient id="premiumEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#005FB8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#005FB8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#e5e7eb'} />
                  <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} tickFormatter={(t) => new Date(t).toLocaleDateString()} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 200', 'dataMax + 200']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', border: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`, borderRadius: 8 }}
                    labelFormatter={(t) => new Date(t as string).toLocaleString()}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#005FB8" strokeWidth={2} fill="url(#premiumEquity)" fillOpacity={1} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <Link to="/analytics" className={`mt-2 inline-block text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>
              Full trade analytics →
            </Link>
          </FoldedCard>
        </div>

        <FoldedCard title="Bots" summary={bots.length === 0 ? 'No bots configured yet' : `${bots.length} configured`} dark={dark}>
          {bots.length === 0 ? (
            <p className={`text-sm ${muted}`}>No bots configured yet. <Link to="/bots" className="underline">Set one up</Link>.</p>
          ) : (
            <div className="space-y-3">
              {bots.map((bot) => {
                const perf = performance[bot.bot_id];
                return (
                  <div key={bot.bot_id} className={`flex items-center justify-between rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
                    <div>
                      <div className="text-sm font-medium">{bot.bot_name}</div>
                      <div className={`text-xs ${muted}`}>{perf ? `${perf.total_trades} trades` : '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${(perf?.win_rate ?? 0) >= 60 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {perf ? `${perf.win_rate}%` : '—'}
                      </div>
                      <div className={`text-xs ${muted}`}>{bot.status === 'active' ? 'Active' : 'Paused'}</div>
                    </div>
                  </div>
                );
              })}
              <Link to="/bots" className={`inline-block text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>Manage bots →</Link>
            </div>
          )}
        </FoldedCard>
      </div>

      <FoldedCard
        title="Waiting on you"
        summary={pending.length === 0 ? 'Nothing waiting on your approval' : `${pending.length} trade${pending.length === 1 ? '' : 's'} to approve`}
        icon={<AlertCircle size={19} />}
        dark={dark}
      >
        {pending.length === 0 ? (
          <p className={`text-sm ${muted}`}>Nothing waiting on your approval right now.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((trade) => (
              <TradeRow
                key={trade.trade_id}
                trade={trade}
                onApprove={async (id) => { await tradesApi.approveTrade(id, true); void loadOnce(); }}
                onReject={async (id) => { await tradesApi.approveTrade(id, false); void loadOnce(); }}
              />
            ))}
          </div>
        )}
      </FoldedCard>

      <FoldedCard title="Recent Trades" dark={dark}>
        {recent.length === 0 ? (
          <p className={`text-sm ${muted}`}>No trades yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((trade) => <TradeRow key={trade.trade_id} trade={trade} />)}
            <Link to="/trades" className={`inline-block text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>All trades →</Link>
          </div>
        )}
      </FoldedCard>

      <FoldedCard title="Learning Progress" summary="Your Learn track activity" icon={<BookOpen size={19} />} dark={dark}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Stages completed', learning?.stages_completed ?? 0],
            ['Tracks started', learning?.tracks_started ?? 0],
            ['Total XP', learning?.total_xp ?? 0],
            ['Day streak', learning?.current_streak_days ?? 0],
          ].map(([label, value]) => (
            <div key={label as string} className={`rounded-xl border p-3 ${surface}`}>
              <div className="font-display text-xl font-extrabold">{value as number}</div>
              <div className={`text-xs ${muted}`}>{label as string}</div>
            </div>
          ))}
        </div>
        <Link to="/learn" className={`mt-3 inline-block text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>Continue learning →</Link>
      </FoldedCard>
    </div>
  );
}
