
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trade } from '../types';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle, XCircle, AlertCircle, Ban, Settings2, ChevronDown, Archive, ArchiveRestore, Trash2, RotateCcw, Bot, User, CheckSquare, Square, Camera, LineChart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '../hooks/useTheme';
import { PositionManager } from './PositionManager';
import { TradeSnapshotModal } from './TradeSnapshotModal';
import { pairFromTradeSymbol } from '../hooks/useQuickPairs';

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
  /** Multi-select for bulk Archive/Delete on TradesPage — by direct
   * request ("Include a select option for individual trades - so user
   * can select multiple at once for archive or delete"). Both omitted
   * (checkbox hidden) on any usage that doesn't support bulk actions. */
  selected?: boolean;
  onToggleSelect?: (tradeId: string) => void;
}

export function TradeRow({ trade, onApprove, onReject, onCancel, onChanged, onArchive, onDelete, selected, onToggleSelect }: TradeRowProps) {
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
  // "Provide closed trade snapshot as a link or button in the card
  // under trade" — by direct request. Only meaningful once a trade
  // actually has entry/exit history to show, so this never shows for
  // pending/active rows, only closed ones (see the button below).
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  // Reason summary — by direct request ("each of the bot trades should
  // have a reason summary - default is fold until triggered"). Folded
  // by default, same rationale as `managing` above (a list of many
  // trades, not a place to dump a paragraph of reasoning per row
  // unasked). reasoning_log is real, bot-generated text already
  // stored on every bot signal (e.g. "FVG Expansion short. 1H FVG
  // bearish 56% mitigated. 15M BOS confirms...") — this was captured
  // all along but never actually surfaced anywhere in the UI.
  const [reasonOpen, setReasonOpen] = useState(false);
  const isLong = trade.direction === 'long';
  // Manual vs Bot origin watermark — by direct request ("introduce a
  // watermark that shows whether it's a manual or Bot ... so at a
  // glance a user knows the origin"). Same bot_id convention
  // routers/trades.py's own _apply_source_filter already uses to tell
  // the two apart ("manual_{user_id}" vs a real bot's own id).
  const isManual = trade.bot_id?.startsWith('manual_') ?? false;

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
      <div className="flex items-start justify-between flex-wrap gap-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(trade.trade_id)}
              className={`shrink-0 ${selected ? (dark ? 'text-smc-accent' : 'text-corporate-hero') : 'text-gray-400 hover:text-gray-300'}`}
              title={selected ? 'Deselect' : 'Select'}
            >
              {selected ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
          )}
          {/* Direction Badge */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium ${
            isLong ? 'bg-smc-long/10 text-smc-long' : 'bg-smc-short/10 text-smc-short'
          }`}>
            {isLong ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trade.direction.toUpperCase()}
          </div>

          {/* Symbol & Details */}
          <div>
            <div className={`flex items-center gap-1.5 font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              {trade.symbol}
              <span
                title={isManual ? 'Placed manually' : `Placed by ${trade.bot_name || 'a bot'}`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                  isManual ? 'bg-sky-500/15 text-sky-400' : 'bg-violet-500/15 text-violet-400'
                }`}
              >
                {isManual ? <User size={10} /> : <Bot size={10} />}
                {isManual ? 'Manual' : 'Bot'}
              </span>
            </div>
            <div className="text-xs text-gray-400">{trade.strategy_type}</div>
            {/* Risk Amount + Unit Quantity (lot_size) — by direct
                request ("include the Risk Amount and the Unit Quantity
                traded (upto three decimal points) ... single line,
                similar font size as the ... 5 hours ago"), matching
                the relative-time line's own text-xs/gray-500 size. */}
            <div className="text-xs text-gray-500">
              Risk: {trade.risk_amount != null ? `$${trade.risk_amount.toFixed(2)}` : '—'}
              {' '}&nbsp;·&nbsp; Qty: {trade.lot_size.toFixed(3)}
            </div>
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

        <div className="flex flex-col items-end gap-2">
          {/* Time — relative, plus the exact date and time underneath,
              by direct request ("include date and time ... in the
              trades form"). Pinned to the TOP of this column, level
              with the symbol/bot-badge line on the left — by direct
              follow-up request ("the 'about 8 hours ago' should move
              up to the first horizontal line ... Make sure
              arrangements on all cards are always aesthetic and well
              aligned"): it used to sit down with Status/P&L, which
              itself only existed to keep it off the action-button row
              below (see that row's own comment) — pulling it all the
              way up to its own top-aligned slot, matching the card's
              own `items-start` on the outer row, reads as a clean
              header/timestamp pairing instead of a mid-card
              afterthought, and leaves Status/P&L room to breathe on
              their own line underneath. */}
          <div className="text-xs text-gray-500 text-right shrink-0">
            <div className="whitespace-nowrap">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5 whitespace-nowrap">{new Date(trade.created_at).toLocaleString()}</div>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-end">
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
          </div>
        </div>
      </div>

      {/* Action buttons — own dedicated row, by direct request
          ("re-arrange all the link buttons - to be on a single
          horizontal line .... move the delete button to the same
          [row] line as archive and on chart etc"). Previously these
          shared one flex-wrap row with Status/P&L/Time, which — on a
          card this width, with every action present at once (Manage +
          On Chart + Archive + Delete) — routinely ran out of room and
          wrapped Delete onto its own line below the other three,
          confirmed live via screenshot. Giving this row the full card
          width to itself, with nothing else competing for space,
          keeps every action on one line for any status/action
          combination this card actually renders. */}
      {(trade.requires_approval && trade.status === 'pending'
        || (trade.strategy_type === 'manual' && (trade.status === 'pending' || trade.status === 'active'))
        || trade.status === 'active' || trade.status === 'pending'
        || onArchive || onDelete) && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-smc-border">
          {/* Approval Actions */}
          {trade.requires_approval && trade.status === 'pending' && (
            <>
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
            </>
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

          {/* On Chart — quick one-click view of this specific ongoing
              trade, right on the card itself, by direct request ("put
              a 'On Chart' link on all active trades cards to allow
              quick view of the ongoing trade"). Goes straight to the
              real On Chart view (TradingViewFramePage, the same chart
              Manual Trading's own "On Chart" toggle opens) rather than
              Manual Trading's full order-ticket page — by direct
              follow-up bug report ("the On Chart does not go directly
              to the actual On Chart page and price chart but to the
              manual trade chart first - it should go straight, so
              user can view ongoing position"): landing on the order
              form first, with the trader having to additionally click
              a toggle to even see the chart, defeated the point of a
              "quick view" link. `onchart=1` tells that page to open
              its On Chart modal immediately on load — see its own
              preselectTradeId/autoOpenOnChart comments. */}
          {(trade.status === 'active' || trade.status === 'pending') && (
            <Link
              to={`/tradingview?tv=${encodeURIComponent(pairFromTradeSymbol(trade.symbol, trade.broker_name).tv)}&trade_id=${encodeURIComponent(trade.trade_id)}&onchart=1`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors"
            >
              <LineChart size={13} /> On Chart
            </Link>
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
        </div>
      )}

      {/* Reason summary — by direct request ("each of the bot trades
          should have a reason summary - default is fold until
          triggered"). Bot trades only (a manual order has no strategy
          reasoning to show) and only when one actually exists — folded
          by default; clicking reveals the real reasoning_log text
          captured at signal time, regardless of trade status (an
          ERROR'd or still-open trade benefits from seeing why it was
          taken just as much as a closed one). */}
      {!isManual && trade.reasoning_log && (
        <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-smc-border">
          <button
            onClick={() => setReasonOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
          >
            <ChevronDown size={13} className={`transition-transform ${reasonOpen ? 'rotate-180' : ''}`} />
            Reason summary
          </button>
          {reasonOpen && (
            <p className={`mt-2 text-xs leading-relaxed ${dark ? 'text-white/70' : 'text-gray-600'}`}>
              {trade.reasoning_log}
            </p>
          )}
        </div>
      )}

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
          <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-5">
            <button
              onClick={() => setSnapshotOpen(true)}
              className={`self-start flex items-center gap-1.5 text-xs font-medium mt-1 ${dark ? 'text-smc-accent hover:text-white' : 'text-corporate-hero hover:text-corporate-text-on-bg'}`}
            >
              <Camera size={13} /> Snapshot
            </button>
          </div>
        </div>
      )}

      {managing && (
        <div className="mt-3">
          <PositionManager trade={trade} dark={dark} onChanged={onChanged} />
        </div>
      )}

      {snapshotOpen && <TradeSnapshotModal tradeId={trade.trade_id} dark={dark} onClose={() => setSnapshotOpen(false)} />}
    </div>
  );
}
