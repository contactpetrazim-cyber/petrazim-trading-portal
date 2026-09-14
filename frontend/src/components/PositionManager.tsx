import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, X, Check, Scissors, AlertCircle, Ban, LineChart } from 'lucide-react';
import { Trade } from '../types';
import { tradesApi } from '../services/api';
import { useQuickPrice } from '../hooks/useQuickPrice';
import { formatApiError } from '../lib/apiError';
import { pairFromTradeSymbol } from '../hooks/useQuickPairs';

/**
 * PositionManager — "view and edit the statistics of this trade ...
 * entry, SL, TP, partial TP, partial exit ... copy exchange style
 * trade order management setup and dashboard for individual trades",
 * by direct request. Both mutations this renders (edit SL/TP,
 * partial-close) already existed as real, tested backend endpoints
 * (routers/manual_trading.py's modify_targets and partial_close) with
 * zero frontend caller anywhere in the app until this component — the
 * gap was entirely the UI, not the API.
 *
 * Deliberately its own self-contained unit (owns its own edit/closing
 * state, talks to the API directly) rather than lifting that state
 * into every page that shows a position, so both TradeRow's expanded
 * row (Trade Management / all trades) and ManualTradingPage's "your
 * open position on this symbol" panel can drop in the exact same
 * component instead of two parallel implementations drifting apart.
 *
 * Honest scope, same as modify_targets' own backend docstring: this
 * edits OUR OWN record of the targets and closes size against OUR OWN
 * price feed — for a LIVE trade actually resting at a real broker,
 * the broker's own order isn't touched by this UI. No "R multiple"
 * fabrication either: it's computed from real fields (entry, stop,
 * live unrealized P&L), not invented.
 */
export function PositionManager({ trade, dark = false, onChanged }: { trade: Trade; dark?: boolean; onChanged?: () => void }) {
  const [editingTargets, setEditingTargets] = useState(false);
  const [entryDraft, setEntryDraft] = useState('');
  const [slDraft, setSlDraft] = useState('');
  const [tp1Draft, setTp1Draft] = useState('');
  const [tp2Draft, setTp2Draft] = useState('');
  const [tp3Draft, setTp3Draft] = useState('');
  const [savingTargets, setSavingTargets] = useState(false);

  const [closingOpen, setClosingOpen] = useState(false);
  const [closePercent, setClosePercent] = useState('100');
  const [closePrice, setClosePrice] = useState('');
  const [closing, setClosing] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { price: livePrice, refresh: refreshLivePrice } = useQuickPrice(trade.symbol);

  // By direct bug report ("no menu to review trade order statistics
  // or update or manage trades") — the two trades in that report were
  // both still-PENDING manual orders, which this component (and the
  // backend it calls) previously only handled for ACTIVE ones.
  const isPending = trade.status === 'pending';
  const isLong = trade.direction === 'long';
  const entry = trade.entry_price ?? 0;
  const pnl = trade.unrealized_pnl ?? 0;
  const positionValue = entry * trade.lot_size;
  const pnlPercent = positionValue > 0 ? (pnl / positionValue) * 100 : null;
  // Back out an implied current price from live unrealized P&L (same
  // formula _enrich_live_pnl used server-side, run in reverse) so a
  // symbol with no separate live-price feed (forex/metals) still shows
  // SOME "where price is now" — falls back to entry when there's no
  // unrealized_pnl yet (a trade the crypto price feed can't resolve).
  const impliedPrice = trade.lot_size > 0 ? entry + (pnl / trade.lot_size) * (isLong ? 1 : -1) : entry;
  const riskDistance = trade.stop_loss ? Math.abs(entry - trade.stop_loss) : null;
  const rMultiple = riskDistance && riskDistance > 0
    ? ((impliedPrice - entry) * (isLong ? 1 : -1)) / riskDistance
    : null;
  // "Goto Chart" — by direct request ("add a link that triggers the
  // correct chart pair from the correct exchange embedded in each
  // order management card"). Exact whenever trade.broker_name is set
  // (every trade going forward — see the Exchange stat cell below);
  // falls back to a best-effort catalogue guess otherwise — see
  // pairFromTradeSymbol's own docstring. Opens in a new tab so
  // managing a trade here (e.g. on the Trade Management list) never
  // loses your place — same reasoning as PracticeDrillsPage's own
  // chart/diagram link.
  const chartPair = pairFromTradeSymbol(trade.symbol, trade.broker_name);
  // By direct follow-up request ("relocate the Goto Chart link to the
  // bottom right ... same line with cancel this order") — shared JSX
  // so both bottom-row layouts (pending -> Cancel; open -> Partial/
  // full exit) place it identically rather than drifting apart.
  // Standard solid-blue primary button — same bg-corporate-hero style
  // ChartPanel's own "Trade" button (and NoPositionCard's own Goto
  // Chart) use — by direct follow-up request ("update link of goto
  // chart to standard blue button right of cancel order"): was still
  // a plain text link here, confirmed live via screenshot — an
  // earlier attempt at this exact restyle was pushed to its branch
  // after that PR had already been merged, so it never actually
  // shipped (see this repo's PR #76 vs its own head commit).
  //
  // Labeled "Position Chart" (was "Goto Chart") specifically here —
  // by direct follow-up request ("update Goto Chart to 'Position
  // Chart' to indicate we want the chart with the position order ...
  // adapt for Goto embedded within the position management card"):
  // this is PositionManager itself, always resolved from a real
  // trade, so the label can say exactly what it does. NoPositionCard's
  // own "Goto Chart" (no trade to point at — see that component's own
  // docstring) is deliberately untouched; calling an empty state
  // "Position Chart" would claim a position that isn't there.
  const gotoChartLink = (
    <Link
      to={`/trade/manual?tv=${encodeURIComponent(chartPair.tv)}`}
      target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-corporate-hero hover:opacity-90"
    >
      <LineChart size={13} /> Position Chart ({chartPair.tv})
    </Link>
  );

  function startEditingTargets() {
    setEntryDraft(trade.entry_price != null ? String(trade.entry_price) : '');
    setSlDraft(String(trade.stop_loss ?? ''));
    setTp1Draft(trade.take_profit != null ? String(trade.take_profit) : '');
    setTp2Draft(trade.take_profit_2 != null ? String(trade.take_profit_2) : '');
    setTp3Draft(trade.take_profit_3 != null ? String(trade.take_profit_3) : '');
    setMessage(null);
    setEditingTargets(true);
  }

  async function saveTargets() {
    setSavingTargets(true);
    setMessage(null);
    try {
      const body: Record<string, number> = {};
      const sl = Number(slDraft);
      const tp1 = tp1Draft ? Number(tp1Draft) : NaN;
      const tp2 = tp2Draft ? Number(tp2Draft) : NaN;
      const tp3 = tp3Draft ? Number(tp3Draft) : NaN;
      if (isPending) {
        const entryVal = Number(entryDraft);
        if (entryVal && entryVal !== trade.entry_price) body.entry_price = entryVal;
      }
      if (sl && sl !== trade.stop_loss) body.stop_loss = sl;
      if (tp1Draft && tp1 !== trade.take_profit) body.take_profit = tp1;
      if (tp2Draft && tp2 !== trade.take_profit_2) body.take_profit_2 = tp2;
      if (tp3Draft && tp3 !== trade.take_profit_3) body.take_profit_3 = tp3;
      if (Object.keys(body).length === 0) {
        setEditingTargets(false);
        return;
      }
      await tradesApi.modifyTargets(trade.trade_id, body);
      setMessage({ ok: true, text: 'Targets updated.' });
      setEditingTargets(false);
      onChanged?.();
    } catch (err: any) {
      setMessage({ ok: false, text: formatApiError(err?.response?.data?.detail, 'Could not update targets — try again.') });
    } finally {
      setSavingTargets(false);
    }
  }

  function startClosing() {
    setClosePercent('100');
    setClosePrice(livePrice != null ? String(livePrice) : String(impliedPrice.toFixed(5)));
    refreshLivePrice({ silent: true }).then((p) => { if (p != null) setClosePrice(String(p)); });
    setMessage(null);
    setClosingOpen(true);
  }

  async function submitClose() {
    const percent = Number(closePercent);
    const exitPrice = Number(closePrice);
    if (!percent || percent <= 0 || percent > 100 || !exitPrice || exitPrice <= 0) {
      setMessage({ ok: false, text: 'Enter a valid % (1-100) and exit price.' });
      return;
    }
    setClosing(true);
    setMessage(null);
    try {
      const data = await tradesApi.partialClose(trade.trade_id, percent, exitPrice);
      setMessage({
        ok: true,
        text: data.status === 'closed'
          ? `Closed fully. Realized P&L this close: ${data.realized_pnl_this_close >= 0 ? '+' : ''}$${data.realized_pnl_this_close.toFixed(2)}.`
          : `Closed ${percent}%. Remaining size: ${data.remaining_lot_size}. Realized P&L this close: ${data.realized_pnl_this_close >= 0 ? '+' : ''}$${data.realized_pnl_this_close.toFixed(2)}.`,
      });
      setClosingOpen(false);
      onChanged?.();
    } catch (err: any) {
      setMessage({ ok: false, text: formatApiError(err?.response?.data?.detail, 'Close failed — try again.') });
    } finally {
      setClosing(false);
    }
  }

  // A still-PENDING order has nothing to partially close — it hasn't
  // filled yet — so it gets Cancel instead of the exit-% form, reusing
  // the same endpoint TradeRow's own row-level Cancel button already
  // calls (cancel_order's own docstring: a PENDING order needs no
  // exit price, there's nothing to price yet).
  async function cancelPendingOrder() {
    setCancelling(true);
    setMessage(null);
    try {
      await tradesApi.cancelOrder(trade.trade_id);
      setMessage({ ok: true, text: 'Order cancelled.' });
      onChanged?.();
    } catch (err: any) {
      setMessage({ ok: false, text: formatApiError(err?.response?.data?.detail, 'Could not cancel — try again.') });
    } finally {
      setCancelling(false);
    }
  }

  const cardCls = `rounded-xl border p-4 space-y-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-gray-900'}`;
  const inputCls = `w-full rounded-lg px-2.5 py-1.5 text-sm font-mono outline-none border ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`;
  const labelCls = `text-[11px] font-medium ${dark ? 'text-white/40' : 'text-gray-400'}`;
  const statCls = `text-sm font-mono font-semibold ${dark ? 'text-white' : 'text-gray-900'}`;

  return (
    <div className={cardCls}>
      {/* Stats row — the "dashboard" half of the request. A pending
          order has no mark price/P&L/R-multiple yet (it hasn't filled),
          so those three swap for a plain "Pending" status instead of
          showing fabricated numbers computed off a $0 P&L. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className={labelCls}>{isPending ? 'Trigger price' : 'Entry'}</div>
          <div className={statCls}>{entry ? entry.toFixed(5) : '—'}</div>
        </div>
        {isPending ? (
          <div>
            <div className={labelCls}>Status</div>
            <div className="text-sm font-mono font-semibold text-amber-500">Pending — not filled yet</div>
          </div>
        ) : (
          <>
            <div>
              <div className={labelCls}>Mark (est.)</div>
              <div className={statCls}>{impliedPrice ? impliedPrice.toFixed(5) : '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Unrealized P/L</div>
              <div className={`text-sm font-mono font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                {pnlPercent != null && <span className="ml-1 text-xs font-normal opacity-70">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>}
              </div>
            </div>
          </>
        )}
        <div>
          <div className={labelCls}>{isPending ? 'Placed' : 'Open'}</div>
          <div className={statCls}>
            {trade.entry_timestamp || trade.created_at ? formatDistanceToNow(new Date(trade.entry_timestamp || trade.created_at), { addSuffix: false }) : '—'}
          </div>
        </div>
        <div>
          <div className={labelCls}>Size</div>
          <div className={statCls}>{trade.lot_size} {trade.symbol}</div>
        </div>
        {/* Exchange — by direct request ("add exchange record for all
            trades paper or live ... a trade record in this app doesn't
            actually store which exchange it was placed on"). The
            record itself already existed (Trade.broker_name, set at
            execution time for every trade — paper included, since only
            the final send-to-broker step is simulated for those) — it
            just never reached the API or a client until now (see
            TradeResponse.broker_name / types/index.ts's own comment). */}
        <div>
          <div className={labelCls}>Exchange</div>
          <div className={statCls}>{trade.broker_name ? trade.broker_name.toUpperCase() : '—'}</div>
        </div>
        {!isPending && (
          <div>
            <div className={labelCls}>R-multiple</div>
            <div className={`text-sm font-mono font-semibold ${rMultiple != null && rMultiple < 0 ? 'text-red-500' : rMultiple != null ? 'text-emerald-500' : statCls}`}>
              {rMultiple != null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R` : '—'}
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className={`flex items-start gap-1.5 text-xs px-3 py-2 rounded-lg ${message.ok ? (dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')}`}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {message.text}
        </div>
      )}

      {/* SL / TP1-3 — view + inline edit */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={labelCls}>Stop Loss / Take Profit</span>
          {!editingTargets && (
            <button onClick={startEditingTargets} className={`flex items-center gap-1 text-xs font-medium ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>

        {!editingTargets ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-mono">
            {isPending && <div><span className="text-corporate-hero">Trigger</span> {trade.entry_price?.toFixed(5) ?? '—'}</div>}
            <div><span className="text-red-500">SL</span> {trade.stop_loss?.toFixed(5) ?? '—'}</div>
            <div><span className="text-emerald-500">TP1</span> {trade.take_profit?.toFixed(5) ?? '—'}</div>
            <div><span className="text-emerald-500">TP2</span> {trade.take_profit_2?.toFixed(5) ?? '—'}</div>
            <div><span className="text-emerald-500">TP3</span> {trade.take_profit_3?.toFixed(5) ?? '—'}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {isPending && (
                <div>
                  <label className={labelCls}>Trigger price</label>
                  <input className={inputCls} value={entryDraft} onChange={(e) => setEntryDraft(e.target.value)} inputMode="decimal" />
                </div>
              )}
              <div>
                <label className={labelCls}>Stop Loss</label>
                <input className={inputCls} value={slDraft} onChange={(e) => setSlDraft(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className={labelCls}>TP1</label>
                <input className={inputCls} value={tp1Draft} onChange={(e) => setTp1Draft(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className={labelCls}>TP2</label>
                <input className={inputCls} value={tp2Draft} onChange={(e) => setTp2Draft(e.target.value)} inputMode="decimal" placeholder="optional" />
              </div>
              <div>
                <label className={labelCls}>TP3</label>
                <input className={inputCls} value={tp3Draft} onChange={(e) => setTp3Draft(e.target.value)} inputMode="decimal" placeholder="optional" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveTargets} disabled={savingTargets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Check size={13} /> {savingTargets ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditingTargets(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${dark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-gray-500 hover:text-gray-800'}`}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Partial / full exit — a PENDING order hasn't filled yet, so
          there's nothing to partially close; it gets Cancel instead,
          the same action its row-level Cancel button already offers,
          just also reachable from this dashboard. */}
      {isPending ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={cancelPendingOrder} disabled={cancelling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-50"
          >
            <Ban size={13} /> {cancelling ? 'Cancelling…' : 'Cancel this order'}
          </button>
          {gotoChartLink}
        </div>
      ) : (
      <div>
        {!closingOpen ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={startClosing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
            >
              <Scissors size={13} /> Partial / full exit
            </button>
            {gotoChartLink}
          </div>
        ) : (
          <div className={`rounded-lg border p-3 space-y-2 ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Close %</label>
                <input className={inputCls} value={closePercent} onChange={(e) => setClosePercent(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className={labelCls}>Exit price</label>
                <input className={inputCls} value={closePrice} onChange={(e) => setClosePrice(e.target.value)} inputMode="decimal" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setClosePercent(String(p))}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold ${closePercent === String(p) ? 'bg-amber-500 text-white' : dark ? 'bg-white/5 text-white/50' : 'bg-black/5 text-gray-500'}`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitClose} disabled={closing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {closing ? 'Closing…' : `Close ${closePercent || 0}%`}
              </button>
              <button
                onClick={() => setClosingOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-gray-500 hover:text-gray-800'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
