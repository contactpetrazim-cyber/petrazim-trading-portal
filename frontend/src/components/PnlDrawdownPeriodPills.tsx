import { useState } from 'react';
import type { TradeBreakdown, TradeBreakdownPeriod } from '../types';
import { dashboardApi } from '../services/api';

const PERIODS: { key: TradeBreakdownPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/**
 * PnlDrawdownPeriodPills — Today/Week/Month toggle for the Daily P&L
 * and Daily Drawdown stat cards, by direct request ("Add - Today Week
 * Month To 'Daily Drawdown' and 'Daily PL' - just like it works for
 * 'Todays Trades'"). Same fetch-on-demand-and-cache shape as
 * TodayTradeBreakdownPills (that card's own Today/Week/Month toggle) —
 * "today" is free (the card's own headline figure, passed in as
 * `todayValue`), Week/Month call /dashboard/trade-breakdown on first
 * selection and cache the result so re-toggling never re-fetches.
 *
 * The card's own headline number (StatCard's `value`) stays fixed at
 * "today" regardless of this toggle, exactly like Today's Trades'
 * total does — this only changes the smaller figure shown here.
 */
export function PnlDrawdownPeriodPills({ metric, todayValue }: { metric: 'pnl' | 'drawdown'; todayValue: number }) {
  const [period, setPeriod] = useState<TradeBreakdownPeriod>('today');
  const [wider, setWider] = useState<Partial<Record<TradeBreakdownPeriod, TradeBreakdown>>>({});
  const [loading, setLoading] = useState(false);

  async function selectPeriod(p: TradeBreakdownPeriod) {
    setPeriod(p);
    if (p === 'today' || wider[p]) return;
    setLoading(true);
    try {
      const data = await dashboardApi.getTradeBreakdown(p);
      setWider((prev) => ({ ...prev, [p]: data }));
    } catch {
      // Leave that period's cache empty — shows "—" until retried.
    } finally {
      setLoading(false);
    }
  }

  const value = period === 'today' ? todayValue : wider[period]?.[metric];

  function formatted(v: number): string {
    if (metric === 'pnl') return `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`;
    // Drawdown — same negative-magnitude display convention the
    // headline card itself uses.
    return `${v ? '-' : ''}$${v.toFixed(2)}`;
  }

  const positive = value != null && (metric === 'pnl' ? value >= 0 : value === 0);

  return (
    <div className="mt-3 pt-3 border-t border-black/10">
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={(e) => { e.stopPropagation(); void selectPeriod(p.key); }}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              period === p.key ? 'bg-gray-900 text-white' : 'bg-black/5 text-gray-600 hover:bg-black/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={`mt-1.5 text-sm font-bold ${value == null ? 'text-gray-400' : positive ? 'text-emerald-600' : 'text-red-600'}`}>
        {loading && value == null ? 'Loading…' : value != null ? formatted(value) : '—'}
      </div>
    </div>
  );
}
