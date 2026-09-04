import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

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

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    (async () => {
      const out: Tile[] = [];

      // Which bot (if any) to scope Monte Carlo / the go-live gate to.
      let botId: string | null = null;
      try {
        const botsRes = await apiFetch(`${API_URL}/bots/`, { headers });
        if (botsRes.ok) {
          const bots = await botsRes.json();
          if (bots.length > 0) botId = bots[0].bot_id;
        }
      } catch {}

      // 1. Performance Forecast (Monte Carlo)
      try {
        const url = new URL(`${API_URL}/api/monte-carlo/metrics`);
        if (botId) url.searchParams.set('bot_id', botId);
        const res = await apiFetch(url.toString(), { headers });
        if (res.ok) {
          const m = await res.json();
          out.push({
            label: 'Expectancy per trade', value: `${m.expectancy_r > 0 ? '+' : ''}${m.expectancy_r.toFixed(2)}R`,
            color: m.expectancy_r >= 0 ? 'emerald' : 'amber', note: `${m.n_trades} closed trades, ${Math.round(m.win_rate * 100)}% win rate`,
          });
        } else {
          out.push({ label: 'Performance Forecast', value: '—', color: 'gray', note: 'Not enough closed trades yet.' });
        }
      } catch {
        out.push({ label: 'Performance Forecast', value: '—', color: 'gray', note: 'Not enough closed trades yet.' });
      }

      // 2. Weekly Review
      try {
        const start = mondayOf(new Date());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const url = new URL(`${API_URL}/api/weekly-review/report`);
        url.searchParams.set('week_start', iso(start));
        url.searchParams.set('week_end', iso(end));
        if (botId) url.searchParams.set('bot_id', botId);
        const res = await apiFetch(url.toString(), { headers });
        if (res.ok) {
          const w = await res.json();
          out.push({
            label: 'This week', value: `${w.n_trades} trade${w.n_trades === 1 ? '' : 's'}`,
            color: w.n_trades > 0 ? 'blue' : 'gray',
            note: w.n_trades > 0 ? `${Math.round(w.win_rate * 100)}% win rate, ${w.expectancy_r.toFixed(2)}R expectancy` : 'No trades taken this week yet.',
          });
        } else {
          out.push({ label: 'Weekly Review', value: '—', color: 'gray', note: 'No trades taken this week yet.' });
        }
      } catch {
        out.push({ label: 'Weekly Review', value: '—', color: 'gray', note: 'No trades taken this week yet.' });
      }

      // 3. Go-Live Checklist
      if (botId) {
        try {
          const res = await apiFetch(`${API_URL}/api/validation-gate/evaluate`, {
            method: 'POST', headers, body: JSON.stringify({ bot_id: botId }),
          });
          if (res.ok) {
            const g = await res.json();
            const passed = g.checks.filter((c: any) => c.status === 'pass').length;
            out.push({
              label: 'Go-Live Checklist', value: `${passed}/${g.checks.length}`,
              color: g.overall_pass ? 'emerald' : 'amber',
              note: g.overall_pass ? 'Ready to go live.' : (g.blocking_failures[0] || 'Some checks still incomplete.'),
            });
          } else {
            out.push({ label: 'Go-Live Checklist', value: '—', color: 'gray', note: 'No backtest on file for this bot yet.' });
          }
        } catch {
          out.push({ label: 'Go-Live Checklist', value: '—', color: 'gray', note: 'No backtest on file for this bot yet.' });
        }
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

  return (
    <div>
      <PageHeader title="Insights" subtitle="Monte Carlo forecasts, weekly coach reviews, and the go-live validation gate." />

      {tiles === null && <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</p>}

      {tiles && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
              <div className={`text-xs mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.label}</div>
              <div className={`text-3xl font-extrabold font-display mb-1.5 ${colorClass[t.color]}`}>{t.value}</div>
              {t.note && <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{t.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
