import { useState } from 'react';
import type { TodayTradeBreakdown, TradeBreakdown, TradeBreakdownPeriod } from '../types';
import { dashboardApi } from '../services/api';

const PERIODS: { key: TradeBreakdownPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/**
 * TodayTradeBreakdownPills — the Today's Trades card's own breakdown,
 * by direct request ("can you provide more clarity ... Pending trades
 * Vs Executed Trades Vs Canceled Vs Loss Vs Won Vs BreakEven"), after
 * the card's single total/win-rate pair got flagged as too coarse
 * (and, separately, was fixed to stop counting cancelled orders as
 * real trades at all — see routers/dashboard.py's own comment).
 * Cancelled is shown here deliberately, not folded back into the
 * headline total above these pills: visible for context, without
 * inflating "trades taken today" again.
 *
 * Today/Week/Month toggle added by direct follow-up request ("can we
 * include Today, Week, Month toggle ... instead of just Today"). The
 * `breakdown` prop is always the card's own /stats-sourced "today"
 * numbers (so the default view needs no extra request); switching to
 * Week or Month fetches routers/dashboard.py's separate
 * /dashboard/trade-breakdown endpoint on demand and caches each period
 * in state so re-toggling between them doesn't re-fetch.
 */
export function TodayTradeBreakdownPills({ breakdown }: { breakdown: TodayTradeBreakdown }) {
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
      // Leave that period's cache empty — the pills just show nothing
      // rather than a stale/wrong number until the user retries.
    } finally {
      setLoading(false);
    }
  }

  const active = period === 'today' ? breakdown : wider[period];
  const items: { label: string; value: number; cls: string }[] = active ? [
    { label: 'Pending', value: active.pending, cls: 'bg-amber-100 text-amber-700' },
    { label: 'Executed', value: active.executed, cls: 'bg-blue-100 text-blue-700' },
    { label: 'Cancelled', value: active.cancelled, cls: 'bg-gray-200 text-gray-600' },
    { label: 'Won', value: active.won, cls: 'bg-emerald-100 text-emerald-700' },
    { label: 'Loss', value: active.loss, cls: 'bg-red-100 text-red-700' },
    { label: 'Break-even', value: active.breakeven, cls: 'bg-gray-200 text-gray-600' },
  ] : [];

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
      <div className="flex flex-wrap gap-1.5 mt-2">
        {loading && !active ? (
          <span className="text-[11px] text-gray-500">Loading…</span>
        ) : (
          items.map((i) => (
            <span key={i.label} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${i.cls}`}>
              {i.value} {i.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
