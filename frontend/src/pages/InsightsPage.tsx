import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { ChartPanel } from '../components/ChartPanel';
import { TradeAnalytics } from '../components/TradeAnalytics';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { LineChart, BarChart3 } from 'lucide-react';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;   // Monday-start week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Tile {
  label: string;
  value: string;
  color: 'blue' | 'emerald' | 'amber' | 'gray';
  note?: string;
  /** 0-100 — every metric here gets an actual bar, not just a number, by direct request ("visual is always better"). */
  barPct?: number;
}

/**
 * InsightsPage — the real Insights area. Per Section 4 of the Master
 * Handover: PageHeader -> 3-column grid, each a small label + a large
 * Sora-font number, colored by meaning (neutral blue for forecast,
 * emerald for good risk numbers, amber for incomplete checklists).
 * All three numbers now come from the real engines (Monte Carlo,
 * Weekly Review, Validation Gate) via routes that already existed but
 * were never authenticated or fed real trade data — see the commit
 * that fixed load_trade_history/load_taken_trades. If there's no bot
 * yet or no closed trades, each tile says so honestly instead of
 * showing a placeholder number.
 */
export function InsightsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    (async () => {
      const out: Tile[] = [];

      // Which bot (if any) to scope Monte Carlo / the go-live gate to.
      // Retries through a cold Render free-tier start (see
      // resilientFetch.ts) — previously a single failed attempt here
      // made every one of the three tiles below show "—", which read as
      // "Insights isn't working" even though each tile was individually
      // handling its own real "not enough data" case correctly.
      let botId: string | null = null;
      const bots = await fetchJsonWithRetry<{ bot_id: string }[]>(`${API_URL}/bots/`, { headers }, setPhase);
      if (bots && bots.length > 0) botId = bots[0].bot_id;

      // 1. Performance Forecast (Monte Carlo)
      const monteCarloUrl = new URL(`${API_URL}/api/monte-carlo/metrics`);
      if (botId) monteCarloUrl.searchParams.set('bot_id', botId);
      const m = await fetchJsonWithRetry<{ expectancy_r: number; n_trades: number; win_rate: number }>(
        monteCarloUrl.toString(), { headers },
      );
      out.push(
        m
          ? {
              label: 'Expectancy per trade', value: `${m.expectancy_r > 0 ? '+' : ''}${m.expectancy_r.toFixed(2)}R`,
              color: m.expectancy_r >= 0 ? 'emerald' : 'amber', note: `${m.n_trades} closed trades, ${Math.round(m.win_rate * 100)}% win rate`,
              barPct: Math.round(m.win_rate * 100),
            }
          : { label: 'Performance Forecast', value: '—', color: 'gray', note: 'Not enough closed trades yet.' },
      );

      // 2. Weekly Review
      const start = mondayOf(new Date());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const weeklyUrl = new URL(`${API_URL}/api/weekly-review/report`);
      weeklyUrl.searchParams.set('week_start', iso(start));
      weeklyUrl.searchParams.set('week_end', iso(end));
      if (botId) weeklyUrl.searchParams.set('bot_id', botId);
      const w = await fetchJsonWithRetry<{ n_trades: number; win_rate: number; expectancy_r: number }>(
        weeklyUrl.toString(), { headers },
      );
      out.push(
        w
          ? {
              label: 'This week', value: `${w.n_trades} trade${w.n_trades === 1 ? '' : 's'}`,
              color: w.n_trades > 0 ? 'blue' : 'gray',
              note: w.n_trades > 0 ? `${Math.round(w.win_rate * 100)}% win rate, ${w.expectancy_r.toFixed(2)}R expectancy` : 'No trades taken this week yet.',
              barPct: w.n_trades > 0 ? Math.round(w.win_rate * 100) : 0,
            }
          : { label: 'Weekly Review', value: '—', color: 'gray', note: 'No trades taken this week yet.' },
      );

      // 3. Go-Live Checklist
      if (botId) {
        const g = await fetchJsonWithRetry<{ checks: { status: string }[]; overall_pass: boolean; blocking_failures: string[] }>(
          `${API_URL}/api/validation-gate/evaluate`, { method: 'POST', headers, body: JSON.stringify({ bot_id: botId }) },
        );
        out.push(
          g
            ? {
                label: 'Go-Live Checklist', value: `${g.checks.filter((c) => c.status === 'pass').length}/${g.checks.length}`,
                color: g.overall_pass ? 'emerald' : 'amber',
                note: g.overall_pass ? 'Ready to go live.' : (g.blocking_failures[0] || 'Some checks still incomplete.'),
                barPct: g.checks.length ? Math.round((g.checks.filter((c) => c.status === 'pass').length / g.checks.length) * 100) : 0,
              }
            : { label: 'Go-Live Checklist', value: '—', color: 'gray', note: 'No backtest on file for this bot yet.' },
        );
      } else {
        out.push({ label: 'Go-Live Checklist', value: '—', color: 'gray', note: 'No bot configured yet.' });
      }

      setTiles(out);
    })();
  }, [token]);

  const colorClass: Record<Tile['color'], string> = {
    blue: 'text-corporate-hero', emerald: 'text-emerald-500', amber: 'text-amber-500',
    gray: dark ? 'text-white/30' : 'text-gray-300',
  };
  const barClass: Record<Tile['color'], string> = {
    blue: 'bg-corporate-hero', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
    gray: dark ? 'bg-white/20' : 'bg-gray-200',
  };

  return (
    <div>
      <PageHeader title="Insights" subtitle="Trader analytics from your real closed trades, Monte Carlo forecasts, weekly coach reviews, and the go-live validation gate." />

      <div className="mb-4">
        <FoldedCard title="Chart" summary="A live TradingView chart, right here" icon={<LineChart size={19} />} dark={dark} defaultOpen>
          <ChartPanel symbol="OANDA:EURUSD" height={380} tradeSymbol="EURUSD" dark={dark} />
        </FoldedCard>
      </div>

      {tiles === null && <LoadingIndicator phase={phase} dark={dark} />}

      {tiles && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
              <div className={`text-xs mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.label}</div>
              <div className={`text-3xl font-extrabold font-display mb-2 ${colorClass[t.color]}`}>{t.value}</div>
              {typeof t.barPct === 'number' && (
                <div className={`h-1.5 rounded-full overflow-hidden mb-2 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                  <div className={`h-full rounded-full ${barClass[t.color]}`} style={{ width: `${t.barPct}%` }} />
                </div>
              )}
              {t.note && <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{t.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Trader Analytics — real per-account analytics from closed
          trades (win rate, avg win/loss, best/worst, profit factor,
          performance by symbol, most traded pairs, daily/monthly
          realized PnL). See TradeAnalytics.tsx's own docstring for
          what the reference dashboard this was modeled on shows that
          this section deliberately doesn't (a running account
          balance and prop-firm-style challenge rules — this app has
          neither concept to honestly back those numbers with). */}
      <div className="mt-4">
        <FoldedCard title="Trader Analytics" summary="Win rate, PnL by symbol and by day, and more — from your real trade history" icon={<BarChart3 size={19} />} dark={dark} defaultOpen>
          <TradeAnalytics dark={dark} />
        </FoldedCard>
      </div>
    </div>
  );
}
