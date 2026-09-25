import type { Trade } from '../types';

/**
 * PendingApprovalsList — the "Pending Approvals" stat card's own
 * lower-section listing, by direct request ("Introduce a listing
 * style for the dashboard in the Pending Approval box in addition to
 * the number, include a list in small fonts, show first 5 ... then
 * add +x more positions"). Same small-font pill-row visual language
 * as ActivePositionsMetrics (this card's sibling on Active Trades),
 * just amber-toned to match this card's own color and capped at 5
 * shown instead of 4, per that exact request.
 */
const MAX_SHOWN = 5;

export function PendingApprovalsList({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  const shown = trades.slice(0, MAX_SHOWN);
  const overflow = trades.length - shown.length;

  return (
    <div className="mt-3 pt-3 border-t border-black/10">
      <div className="flex flex-col gap-1.5">
        {shown.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {t.symbol} {t.direction === 'long' ? 'L' : 'S'}
            </span>
            {t.bot_name && (
              <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{t.bot_name}</span>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] font-medium text-gray-500">+{overflow} more position{overflow === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}
