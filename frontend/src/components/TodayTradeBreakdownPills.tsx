import type { TodayTradeBreakdown } from '../types';

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
 */
export function TodayTradeBreakdownPills({ breakdown }: { breakdown: TodayTradeBreakdown }) {
  const items: { label: string; value: number; cls: string }[] = [
    { label: 'Pending', value: breakdown.pending, cls: 'bg-amber-100 text-amber-700' },
    { label: 'Executed', value: breakdown.executed, cls: 'bg-blue-100 text-blue-700' },
    { label: 'Cancelled', value: breakdown.cancelled, cls: 'bg-gray-200 text-gray-600' },
    { label: 'Won', value: breakdown.won, cls: 'bg-emerald-100 text-emerald-700' },
    { label: 'Loss', value: breakdown.loss, cls: 'bg-red-100 text-red-700' },
    { label: 'Break-even', value: breakdown.breakeven, cls: 'bg-slate-100 text-slate-600' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/10">
      {items.map((i) => (
        <span key={i.label} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${i.cls}`}>
          {i.value} {i.label}
        </span>
      ))}
    </div>
  );
}
