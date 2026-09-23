import type { Trade } from '../types';

/**
 * ActivePositionsMetrics — the Active Trades card's own lower-section
 * breakdown, by direct request ("show all the metrics on the position
 * on the lower section of the card ... similar to 0 Pending / 1
 * Executed / ... show current PL on active trade ... info about the
 * position e.g PL, RR etc in small font size in a neat and appealing
 * manner"). Same pill-row visual language as TodayTradeBreakdownPills
 * (small font, rounded-full colored badges under a border-t divider)
 * so the two stat cards read as one family, but the numbers here are
 * per-position live figures, not category counts — there's no
 * "pending/executed/won" breakdown for something that's already open.
 *
 * Same "no fabricated numbers" rule PositionManager follows: P&L is
 * the trade's own real unrealized_pnl, and R-multiple is derived from
 * that same live P&L backed out to an implied current price (the
 * identical formula PositionManager.tsx already uses) rather than any
 * separate estimate — so this card and the position's own management
 * card never show two different numbers for the same trade.
 */
function positionMetrics(trade: Trade) {
  const isLong = trade.direction === 'long';
  const entry = trade.entry_price ?? 0;
  const pnl = trade.unrealized_pnl ?? 0;
  const impliedPrice = trade.lot_size > 0 ? entry + (pnl / trade.lot_size) * (isLong ? 1 : -1) : entry;
  const riskDistance = trade.stop_loss ? Math.abs(entry - trade.stop_loss) : null;
  const rMultiple = riskDistance && riskDistance > 0
    ? ((impliedPrice - entry) * (isLong ? 1 : -1)) / riskDistance
    : null;
  return { pnl, rMultiple };
}

const MAX_SHOWN = 4;

export function ActivePositionsMetrics({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  const shown = trades.slice(0, MAX_SHOWN);
  const overflow = trades.length - shown.length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.unrealized_pnl ?? 0), 0);

  return (
    <div className="mt-3 pt-3 border-t border-black/10">
      {trades.length > 1 && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total live P&L</span>
          <span className={`text-[11px] font-bold ${totalPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {shown.map((t) => {
          const { pnl, rMultiple } = positionMetrics(t);
          const pnlUp = pnl >= 0;
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {t.symbol} {t.direction === 'long' ? 'L' : 'S'}
              </span>
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${pnlUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {pnlUp ? '+' : ''}${pnl.toFixed(2)}
              </span>
              {rMultiple != null && (
                <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                </span>
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <span className="text-[10px] font-medium text-gray-500">+{overflow} more open position{overflow === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}
