import { useEffect, useState } from 'react';
import { BarChart3, Percent, Target, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { StatCard } from '../components/StatCard';
import { FoldedCard } from '../components/FoldedCard';
import { dashboardApi } from '../services/api';
import { PerformanceSummary } from '../types';
import { useThemeStore } from '../hooks/useTheme';

const PERIODS: { id: '1d' | '7d' | '30d' | '90d'; label: string }[] = [
  { id: '1d', label: '1D' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

/**
 * AnalyticsPage — "Analytics" in the Trader console's sidebar. App.tsx
 * used to route /analytics to the exact same <DashboardPage /> that
 * /dashboard already renders, so clicking it looked like the click did
 * nothing at all — a real, confirmed bug ("fix the analytics" / "fix
 * the trader analytics metrics and visuals"). This is the real thing:
 * GET /dashboard/performance (dashboardApi.getPerformance), which
 * existed in services/api.ts, fully typed, and was never called from
 * anywhere in the app before this.
 *
 * Backend note: PerformanceSummary's max_drawdown_pct was hardcoded to
 * 0.0 ("Calculate properly") — fixed alongside this page (see
 * dashboard.py's performance_summary) using the same peak-to-trough
 * running-equity definition as the equity curve, so this number now
 * means something real rather than always reading 0%.
 */
export function AnalyticsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [period, setPeriod] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [allPeriods, setAllPeriods] = useState<Record<string, PerformanceSummary | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(PERIODS.map((p) => dashboardApi.getPerformance(p.id).catch(() => [])))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, PerformanceSummary | null> = {};
        PERIODS.forEach((p, i) => { map[p.id] = results[i]?.[0] ?? null; });
        setAllPeriods(map);
        setSummary(map[period] ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSummary(allPeriods[period] ?? null);
  }, [period, allPeriods]);

  const gridColor = dark ? '#1f2937' : '#e5e7eb';
  const axisColor = '#6b7280';
  const comparisonData = PERIODS.map((p) => ({
    period: p.label,
    win_rate: allPeriods[p.id]?.win_rate ?? 0,
    profit_factor: allPeriods[p.id]?.profit_factor ?? 0,
    max_drawdown_pct: allPeriods[p.id]?.max_drawdown_pct ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={22} className={dark ? 'text-smc-accent' : 'text-corporate-hero'} /> Analytics
          </h2>
          <p className="text-gray-400 text-sm mt-1">Real performance metrics from your own closed trades</p>
        </div>
        <div className={`flex gap-1 p-1 rounded-lg ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.id
                  ? dark ? 'bg-smc-accent text-white' : 'bg-corporate-hero text-white'
                  : dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && !summary && (
        <div className={`text-center py-16 text-gray-400 border rounded-xl ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}>
          No closed trades in this period yet — metrics fill in as trades close.
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Closed Trades" value={summary.total_trades} subtitle={`Last ${period}`} icon={<Target size={20} />} color="blue" />
          <StatCard title="Win Rate" value={`${summary.win_rate}%`} subtitle="Wins / closed trades" icon={<Percent size={20} />} color={summary.win_rate >= 50 ? 'green' : 'amber'} />
          <StatCard title="Profit Factor" value={summary.profit_factor} subtitle="Gross profit / gross loss" icon={<TrendingUp size={20} />} color={summary.profit_factor >= 1 ? 'green' : 'red'} />
          <StatCard title="Avg R-Multiple" value={summary.average_r_multiple} subtitle="Realized R per trade" icon={<BarChart3 size={20} />} color={summary.average_r_multiple >= 0 ? 'green' : 'red'} />
          <StatCard title="Max Drawdown" value={`${summary.max_drawdown_pct}%`} subtitle="Peak-to-trough, this period" icon={<TrendingDown size={20} />} color={summary.max_drawdown_pct > 10 ? 'red' : 'amber'} />
          <StatCard title="Net P&L" value={`${summary.net_pnl >= 0 ? '+' : ''}$${summary.net_pnl.toFixed(2)}`} subtitle="Realized, this period" icon={<DollarSign size={20} />} color={summary.net_pnl >= 0 ? 'green' : 'red'} />
        </div>
      )}

      <FoldedCard title="Win Rate & Profit Factor by Period" summary="How your edge holds up over 1D/7D/30D/90D" dark={dark} defaultOpen>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="period" stroke={axisColor} fontSize={12} />
            <YAxis stroke={axisColor} fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="win_rate" name="Win Rate %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="profit_factor" name="Profit Factor" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </FoldedCard>

      <FoldedCard title="Max Drawdown by Period" summary="Peak-to-trough decline, each window compared" dark={dark} defaultOpen>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="period" stroke={axisColor} fontSize={12} />
            <YAxis stroke={axisColor} fontSize={12} unit="%" />
            <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="max_drawdown_pct" name="Max Drawdown %" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </FoldedCard>
    </div>
  );
}
