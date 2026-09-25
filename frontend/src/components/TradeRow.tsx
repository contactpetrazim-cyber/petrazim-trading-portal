
import { useState } from 'react';
import { Trade } from '../types';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle, XCircle, AlertCircle, Ban, Settings2, ChevronDown, Archive, ArchiveRestore, Trash2, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '../hooks/useTheme';
import { PositionManager } from './PositionManager';

interface TradeRowProps {
  trade: Trade;
  onApprove?: (tradeId: string) => void;
  onReject?: (tradeId: string) => void;
  onCancel?: (tradeId: string) => void;
  /** Re-fetches the trade list — passed straight to PositionManager so
   * an edit/partial-close made from the expanded row is reflected in
   * this row (and everywhere else the list is shown) right away. */
  onChanged?: () => void;
  /** Moves this trade into/out of the folded "Archive Trades" card —
   * omitted (button hidden) on rows that don't support archiving. */
  onArchive?: (tradeId: string, archived: boolean) => void;
  /** Moves this trade into/out of the "Deleted Trades" card — by
   * direct request ("include a delete option ... a Delete card where
   * all the deleted trades are stored for future reference"). Same
   * reversible on/off shape as onArchive. */
  onDelete?: (tradeId: string, deleted: boolean) => void;
}

export function TradeRow({ trade, onApprove, onReject, onCancel, onChanged, onArchive, onDelete }: TradeRowProps) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  // "Copy exchange style trade order management setup and dashboard
  // for individual trades" — by direct request. Folded by default
  // (this is a list of every trade, most of them closed history —
  // expanding by default would be the same "disfiguring the layout"
  // complaint ChartPanel's own docstring already records for a
  // different card) so only PositionManager for a row you actually
  // click into ever mounts.
  const [managing, setManaging] = useState(false);
  const isLong = trade.direction === 'long';

  // Win / Loss / Breakeven — by direct request ("provide details of
  // the trade - Entry, SL, TP, Closed price, Win, Loss or BE for every
  // closed trade"). A realized_pnl of exactly 0 is a real, distinct
  // outcome (breakeven), not a loss — the status pill, icon, and PnL
  // figure below previously all treated "not a win" as red/loss,
  // coloring a genuine breakeven trade the same as an actual loser.
  const outcome: 'win' | 'loss' | 'be' | null = trade.status !== 'closed'
    ? null
    : trade.realized_pnl > 0 ? 'win' : trade.realized_pnl < 0 ? 'loss' : 'be';
  const outcomeLabel = outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'BE';
  const outcomeColorCls = outcome === 'win' ? 'text-emerald-400' : outcome === 'loss' ? 'text-red-400' : 'text-amber-400';

  const statusColors: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10',
    active: 'text-blue-400 bg-blue-400/10',
    closed: outcome === 'loss' ? 'text-red-400 bg-red-400/10' : outcome === 'be' ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10',
    cancelled: 'text-gray-400 bg-gray-400/10',
  };

  const StatusIcon = () => {
    switch (trade.status) {
      case 'pending': return <Clock size={14} />;
      case 'active': return <AlertCircle size={14} />;
      case 'closed': return outcome === 'loss' ? <XCircle size={14} /> : <CheckCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-colors ${
      dark ? 'bg-smc-card border-smc-border hover:border-smc-accent/30' : 'bg-white border-corporate-bg hover:border-corporate-hero/30'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Direction Badge */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium ${
            isLong ? 'bg-smc-long/10 text-smc-long' : 'bg-smc-short/10 text-smc-short'
          }`}>
            {isLong ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trade.direction.toUpperCase()}
          </div>

          {/* Symbol & Details */}
          <div>
            <div className={`font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{trade.symbol}</div>
            <div className="text-xs text-gray-400">{trade.strategy_type}</div>
          </div>

          {/* Prices — 2 decimal places, matching every other price in
              the portal, by direct request ("Use two decimal points
              for the prices. Apply to the entire portal"). */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Entry:</span>
              <span className="ml-1 font-mono">{trade.entry_price?.toFixed(2) || 'Pending'}</span>
            </div>
            <div>
              <span className="text-gray-500">SL:</span>
              <span className="ml-1 font-mono text-red-400">{trade.stop_loss.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">TP:</span>
              <span className="ml-1 font-mono text-emerald-400">{trade.take_profit?.toFixed(2) || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${statusColors[trade.status] || statusColors.pending}`}>
            <StatusIcon />
            {trade.status.toUpperCase()}
          </div>

          {/* P&L — realized once closed, live unrealized while active */}
          {trade.status === 'closed' && (
            <div className={`text-right font-mono font-bold ${outcomeColorCls}`}>
              {trade.realized_pnl > 0 ? '+' : ''}{trade.realized_pnl.toFixed(2)}
              <span className="block text-[10px] font-normal">{outcomeLabel}</span>
            </div>
          )}
          {trade.status === 'active' && (
            <div className={`text-right font-mono font-bold ${trade.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trade.unrealized_pnl >= 0 ? '+' : ''}{trade.unrealized_pnl.toFixed(2)}
              <span className="block text-[10px] font-normal text-gray-500">unrealized</span>
            </div>
          )}

          {/* Approval Actions */}
          {trade.requires_approval && trade.status === 'pending' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onApprove?.(trade.trade_id)}
                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                Approve
              </button>
              <button 
                onClick={() => onReject?.(trade.trade_id)}
                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {/* Manual cancel/close — by direct request ("partial or
              manual cancellations ... even in test mode"). Scoped to
              this trader's OWN manual trades (not bot-managed ones —
              cancelling a bot's own active position out from under it
              here would desync the bot's own logic from what's
              actually still open). */}
          {trade.strategy_type === 'manual' && (trade.status === 'pending' || trade.status === 'active') && (
            <button
              onClick={() => onCancel?.(trade.trade_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-500/30 hover:text-gray-300 transition-colors"
              title={trade.status === 'pending' ? 'Cancel this order' : 'Close this position now'}
            >
              <Ban size={13} /> {trade.status === 'pending' ? 'Cancel' : 'Close'}
            </button>
          )}

          {/* Manage — view/edit SL, TP1-3, and partial-exit this
              position, exchange style. Any active OR still-pending
              trade, bot-placed or manual — modify_targets' own
              backend already scopes it that way (see
              PositionManager.tsx's docstring). PENDING added by
              direct bug report ("no menu to review trade order
              statistics or update or manage trades") — a still-
              pending order had no way to review its own stats or
              amend its SL/TP/trigger price before this, only Cancel. */}
          {(trade.status === 'active' || trade.status === 'pending') && (
            <button
              onClick={() => setManaging((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                managing ? 'bg-blue-600 text-white' : 'bg-blue-500/15 text-blue-500 hover:bg-blue-500/25'
              }`}
            >
              <Settings2 size={13} /> Manage <ChevronDown size={13} className={`transition-transform ${managing ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Archive/Unarchive — moves this row between the "Recent
              Trades" and "Archive Trades" cards. Any status can be
              archived; see Trade.is_archived's own backend comment. */}
          {onArchive && (
            <button
              onClick={() => onArchive(trade.trade_id, !trade.is_archived)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-500/30 hover:text-gray-300 transition-colors"
              title={trade.is_archived ? 'Move back to Recent Trades' : 'Move to Archive Trades'}
            >
              {trade.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {trade.is_archived ? 'Unarchive' : 'Archive'}
            </button>
          )}

          {/* Delete/Restore — moves this row into/out of the "Deleted
              Trades" card, by direct request ("include a delete option
              ... so we have a clean slate"). Soft delete only — see
              Trade.is_deleted's own backend comment; "Restore" brings
              it right back exactly where it was. */}
          {onDelete && (
            <button
              onClick={() => onDelete(trade.trade_id, !trade.is_deleted)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors"
              title={trade.is_deleted ? 'Restore this trade' : 'Delete this trade'}
            >
              {trade.is_deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
              {trade.is_deleted ? 'Restore' : 'Delete'}
            </button>
          )}

          {/* Time — relative, plus the exact date and time underneath,
              by direct request ("include date and time ... in the
              trades form"). */}
          <div className="text-xs text-gray-500 hidden lg:block text-right">
            <div>{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(trade.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Closed-trade details — Entry, SL, TP, Closed price, Win/Loss/BE
          — by direct request ("provide details of the trade ... for
          every closed trade"). Own row, always visible (unlike the
          Entry/SL/TP row above, which is `hidden md:flex` and so never
          shows at all on a narrow card like the one in the bug
          report), since a closed trade's history is exactly the case
          where these numbers matter most and there's no live position
          to fall back on managing instead. */}
      {trade.status === 'closed' && (
        <div className={`mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2 text-xs ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
          {/* Label on its own line, price on the line below — by
              direct request ("the corresponding prices should be
              under each of the following Entry, SL, TP, Close etc -
              the second or following line - for consistency"):
              Entry/Closed used to wrap onto a second line only
              because their 5-decimal values ran long, while SL/TP/
              Result stayed inline — same stacked layout for all five
              now, regardless of value length. Also 2 decimal places
              (was 5), matching every other price shown on this row. */}
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">Entry:</span>
            <span className="font-mono">{trade.entry_price?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">SL:</span>
            <span className="font-mono text-red-400">{trade.stop_loss.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">TP:</span>
            <span className="font-mono text-emerald-400">{trade.take_profit?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">Closed:</span>
            <span className="font-mono">{trade.exit_price?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">Result:</span>
            <span className={`font-semibold ${outcomeColorCls}`}>{outcomeLabel}</span>
          </div>
        </div>
      )}

      {managing && (
        <div className="mt-3">
          <PositionManager trade={trade} dark={dark} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}
