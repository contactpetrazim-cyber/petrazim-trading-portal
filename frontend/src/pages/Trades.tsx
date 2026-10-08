
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TradeRow } from '../components/TradeRow';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { FoldedCard } from '../components/FoldedCard';
import { SourceToggle, type TradeSource } from '../components/TradeAnalytics';
import { tradesApi } from '../services/api';
import { Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { Filter, Search, Download, RefreshCw, Archive, Trash2, ClipboardCheck, ArrowRight, Calendar, CheckSquare, Square, Bot } from 'lucide-react';
import { formatApiError } from '../lib/apiError';

// Quick date-range options for the Trades filter bar — by direct
// request ("integrate both calender and quick options: Today,
// Previous 1D, 3D, 5D, 7D, 14D, 28D"). Each resolves to a rolling
// lookback window from right now (`date_from` = now - N days), the
// same convention AnalyticsPage's own 1D/7D/30D/90D period pills
// already use — "Today" is the one exception, anchored to local
// midnight rather than a rolling 24h window, since "today" means the
// calendar day, not "the last 24 hours".
type DateQuick = 'today' | '1d' | '3d' | '5d' | '7d' | '14d' | '28d';
const DATE_QUICK_OPTIONS: { id: DateQuick; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '1d', label: '1D' },
  { id: '3d', label: '3D' },
  { id: '5d', label: '5D' },
  { id: '7d', label: '7D' },
  { id: '14d', label: '14D' },
  { id: '28d', label: '28D' },
];
const DATE_QUICK_DAYS: Record<Exclude<DateQuick, 'today'>, number> = {
  '1d': 1, '3d': 3, '5d': 5, '7d': 7, '14d': 14, '28d': 28,
};

// Live unrealized PnL only means something if it's actually kept
// current — by direct request ("the order should show as an existing
// trade with live PnL that can be seen or tracked"). Matches
// ChartPanel/OrderFlowChartTool's own polling cadence for "live-
// feeling" data elsewhere in this app.
const LIVE_PNL_POLL_MS = 10_000;

/**
 * TradesPage — "Trade Management". Was a static array of 5 mock
 * trades with no API call at all; now backed by GET /trades/ (now
 * real and user-scoped as of the ownership work — see
 * routers/trades.py). Filter/search run server-side (status/symbol
 * query params) rather than filtering an already-fetched page, so
 * they keep working once a trader has more than one page of history.
 * Approve/Reject were wired on TradeRow but never passed a handler
 * here — they're real now, via POST /trades/approve.
 */
export function TradesPage() {
  const { portalThemes } = useThemeStore();
  const theme = portalThemes.trader;
  const dark = theme === 'dark';
  const [trades, setTrades] = useState<Trade[]>([]);
  // Archived trades — a separate list/card ("Archive Trades", folded
  // by default) rather than a filter over the same list, by direct
  // request ("create an option to move individual trades to a new
  // archive trades card ... So two cards: Recent Trades, Archive
  // Trades").
  const [archivedTrades, setArchivedTrades] = useState<Trade[]>([]);
  // Deleted trades — a third card ("Deleted Trades", folded by
  // default), by direct request ("include a delete option ... a
  // Delete card where all the deleted trades are stored for future
  // reference"). Same shape as archivedTrades above.
  const [deletedTrades, setDeletedTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Quick filters — extended past the original 4 status filters to
  // also cover a closed trade's real OUTCOME (Won/Loss/BreakEven), by
  // direct request ("introduce a filter for Won, Loss, BreakEven,
  // Cancelled, Closed in addition to other quick filters already
  // existing"). Won/Loss/BreakEven aren't a stored `status` — see
  // TradeRow's own `outcome` derivation (realized_pnl sign) — so those
  // three resolve to status=closed server-side and get narrowed
  // further client-side by applyOutcomeFilter below.
  type QuickFilter = 'all' | 'active' | 'pending' | 'closed' | 'cancelled' | 'won' | 'loss' | 'breakeven';
  const OUTCOME_FILTERS: QuickFilter[] = ['won', 'loss', 'breakeven'];
  const FILTER_LABELS: Record<QuickFilter, string> = {
    all: 'All', active: 'Active', pending: 'Pending', closed: 'Closed', cancelled: 'Cancelled',
    won: 'Won', loss: 'Loss', breakeven: 'BreakEven',
  };
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  // Bots vs Manual — by direct request ("all visuals or analytics
  // should be differentiated by a toggle bots vs Manual trades").
  // Same `source` filter analytics/summary uses (routers/trades.py).
  const [source, setSource] = useState<TradeSource>('all');

  // Bot/Strategy filter — by direct request ("Add filter for Bot for
  // Strategy / Setup"). '' = every bot/strategy. Independent of the
  // Bots-vs-Manual `source` toggle above (that's origin; this narrows
  // to ONE specific bot within it) — both apply together server-side.
  const [botFilter, setBotFilter] = useState('');
  // Real bug, found via direct report on the Analytics page's own copy
  // of this exact filter ("The bot / strategy quick filter in
  // Analytics is not working"): GET /bots/ scopes by BotConfig.user_id
  // — the bot's OWNER/creator — which an ordinary trader almost never
  // is for the platform's own strategy bots, so the dropdown was
  // silently empty for them here too. Same fix: derive options from
  // GET /trades/analytics/bot-options (unions every real BotConfig row
  // with the caller's own trade history) instead.
  const [bots, setBots] = useState<{ bot_id: string; bot_name: string }[]>([]);
  useEffect(() => { tradesApi.getBotFilterOptions().then(setBots).catch(() => setBots([])); }, []);

  // Date filter — quick lookback pills + an optional exact calendar
  // range, by direct request. A custom calendar pick (either field
  // set) always takes priority over whichever quick pill is also
  // selected, rather than the two silently fighting each other.
  const [dateQuick, setDateQuick] = useState<DateQuick | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const hasCustomDate = Boolean(customFrom || customTo);
  const dateActive = hasCustomDate || dateQuick !== null;

  function selectDateQuick(id: DateQuick) {
    setDateQuick((prev) => (prev === id ? null : id));
    setCustomFrom('');
    setCustomTo('');
  }

  function clearDateFilter() {
    setDateQuick(null);
    setCustomFrom('');
    setCustomTo('');
  }

  function computeDateRange(): { date_from?: string; date_to?: string } {
    if (hasCustomDate) {
      return {
        date_from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
        date_to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined,
      };
    }
    if (!dateQuick) return {};
    if (dateQuick === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { date_from: start.toISOString() };
    }
    const from = new Date(Date.now() - DATE_QUICK_DAYS[dateQuick] * 24 * 60 * 60 * 1000);
    return { date_from: from.toISOString() };
  }

  // Multi-select — by direct request ("Include a select option for
  // individual trades - so user can select multiple at once for
  // archive or delete"). Scoped to trade_id, cleared on every reload
  // so a selection never silently points at a row that moved cards
  // (e.g. archiving clears it rather than leaving a stale id selected
  // against the now-different Archive Trades list).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  function toggleSelect(tradeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId); else next.add(tradeId);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  // Select-all toggles just THIS list's rows into/out of the shared
  // selection, leaving whatever's already selected in another card
  // (e.g. Recent + Archive at once) untouched.
  function toggleSelectAll(list: Trade[]) {
    const allSelected = list.length > 0 && list.every((t) => selectedIds.has(t.trade_id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((t) => (allSelected ? next.delete(t.trade_id) : next.add(t.trade_id)));
      return next;
    });
  }

  function buildParams(): { status?: string; symbol?: string; source?: string; bot_id?: string; date_from?: string; date_to?: string } {
    const params: { status?: string; symbol?: string; source?: string; bot_id?: string; date_from?: string; date_to?: string } = {};
    if (OUTCOME_FILTERS.includes(filter)) params.status = 'closed';
    else if (filter !== 'all') params.status = filter;
    if (search) params.symbol = search.toUpperCase();
    if (source !== 'all') params.source = source;
    if (botFilter) params.bot_id = botFilter;
    Object.assign(params, computeDateRange());
    return params;
  }

  function applyOutcomeFilter(list: Trade[]): Trade[] {
    if (!OUTCOME_FILTERS.includes(filter)) return list;
    return list.filter((t) => {
      if (filter === 'won') return t.realized_pnl > 0;
      if (filter === 'loss') return t.realized_pnl < 0;
      return t.realized_pnl === 0; // breakeven
    });
  }

  // "Recent Trades should show what is Executed or Closed after
  // Execution" — by direct request, now that bot recommendations
  // awaiting a decision have their own home (the Pending Approvals
  // page). Only strips those out of the default "All" view — the
  // explicit "Pending" quick filter above still shows every pending
  // trade, including these, and a trader's own manual resting order
  // (PENDING but requires_approval=false — never a recommendation to
  // begin with) is never touched.
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  function excludeAwaitingApproval(list: Trade[]): Trade[] {
    if (filter !== 'all') return list;
    return list.filter((t) => !(t.status === 'pending' && t.requires_approval));
  }

  async function loadTrades() {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const [recent, archived, deleted] = await Promise.all([
        tradesApi.getTrades({ ...params, archived: false }),
        tradesApi.getTrades({ ...params, archived: true }),
        tradesApi.getTrades({ ...params, deleted: true }),
      ]);
      setPendingApprovalCount(recent.filter((t) => t.status === 'pending' && t.requires_approval).length);
      setTrades(excludeAwaitingApproval(applyOutcomeFilter(recent)));
      setArchivedTrades(applyOutcomeFilter(archived));
      setDeletedTrades(applyOutcomeFilter(deleted));
    } catch (e: any) {
      setError('Could not load trades.');
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(tradeId: string, archived: boolean) {
    try {
      await tradesApi.archiveTrade(tradeId, archived);
      setError(null);
      loadTrades();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not update the archive — try again in a moment.'));
    }
  }

  async function handleDelete(tradeId: string, deleted: boolean) {
    try {
      await tradesApi.deleteTrade(tradeId, deleted);
      setError(null);
      loadTrades();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not update — try again in a moment.'));
    }
  }

  // Bulk Archive/Delete — applies to every currently-selected trade_id
  // regardless of which of the 3 cards it's actually sitting in (a
  // selection can span Recent + Archive at once, e.g. archiving one
  // while restoring another in the same pass). No dedicated bulk
  // endpoint exists server-side; archiveTrade/deleteTrade are already
  // per-trade and idempotent, so this is just those, fired together.
  async function handleBulkArchive(archived: boolean) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => tradesApi.archiveTrade(id, archived)));
      setError(null);
      clearSelection();
      loadTrades();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not update some of the selected trades — try again in a moment.'));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete(deleted: boolean) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => tradesApi.deleteTrade(id, deleted)));
      setError(null);
      clearSelection();
      loadTrades();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not update some of the selected trades — try again in a moment.'));
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { clearSelection(); loadTrades(); }, 300); // debounce the search input
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, source, botFilter, dateQuick, customFrom, customTo]);

  // Silent background refresh (no loading-indicator flash) so live
  // unrealized PnL actually updates while an active trade is open,
  // rather than only refreshing on a manual click.
  useEffect(() => {
    if (!trades.some((t) => t.status === 'active')) return;
    const id = setInterval(() => {
      tradesApi.getTrades({ ...buildParams(), archived: false }).then((r) => setTrades(excludeAwaitingApproval(applyOutcomeFilter(r)))).catch(() => {});
    }, LIVE_PNL_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, filter, search, source, botFilter, dateQuick, customFrom, customTo]);

  async function handleApprove(tradeId: string) {
    await tradesApi.approveTrade(tradeId, true);
    loadTrades();
  }

  async function handleReject(tradeId: string) {
    await tradesApi.approveTrade(tradeId, false);
    loadTrades();
  }

  async function handleCancel(tradeId: string) {
    try {
      await tradesApi.cancelOrder(tradeId);
      setError(null);
      loadTrades();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not cancel — try again in a moment.'));
    }
  }

  function exportCsv() {
    // lot_size, not take_profit alone — by the same "Qty: 0.000" fix
    // as TradeRow.tsx: lot_size is live-mutated down to 0 as partial
    // TP legs close, so every closed trade's exported row showed 0
    // regardless of what was actually traded. initial_lot_size is the
    // immutable opening size (falls back to lot_size for a legacy row
    // with no way to recover it).
    const header = 'trade_id,symbol,direction,status,entry_price,stop_loss,take_profit,lot_size,realized_pnl,unrealized_pnl,bot_id,created_at,archived,deleted';
    const rows = [...trades, ...archivedTrades, ...deletedTrades].map((t) =>
      [t.trade_id, t.symbol, t.direction, t.status, t.entry_price, t.stop_loss, t.take_profit, t.initial_lot_size ?? t.lot_size, t.realized_pnl, t.unrealized_pnl, t.bot_id, t.created_at, t.is_archived ?? false, t.is_deleted ?? false].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trade Management</h2>
          <p className="text-gray-400 text-sm mt-1">Monitor, approve, and analyze all trades</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadTrades} className="p-2 text-gray-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCsv}
            disabled={trades.length === 0 && archivedTrades.length === 0 && deletedTrades.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 ${
              dark ? 'bg-smc-accent/10 text-smc-accent hover:bg-smc-accent/20' : 'bg-corporate-hero/10 text-corporate-hero hover:bg-corporate-hero/20'
            }`}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters — two aligned rows, by direct request ("properly
          arrange all existing button quick filters in a 'aligned'
          table or row/column format ... to align with the top line
          filters"). Row 1: search, origin (Bots/Manual), Bot/Strategy,
          date. Row 2: status/outcome quick filters (incl. Won/Loss/
          BreakEven), same button sizing and gap as row 1's own pills
          so the two rows read as one consistent filter bar rather than
          a mismatched stack. */}
      <div className={`rounded-xl border p-3 space-y-3 ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none ${
                dark ? 'bg-corporate-nav-dark border-smc-border focus:border-smc-accent' : 'bg-white border-corporate-bg focus:border-corporate-hero'
              }`}
            />
          </div>

          <SourceToggle value={source} onChange={setSource} dark={dark} />

          {/* Bot/Strategy filter — by direct request ("Add filter for
              Bot for Strategy / Setup"). */}
          <div className="flex items-center gap-1.5">
            <Bot size={15} className="text-gray-400 shrink-0" />
            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className={`px-2.5 py-2 border rounded-lg text-sm focus:outline-none max-w-[200px] ${
                dark ? 'bg-corporate-nav-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
              }`}
            >
              <option value="">All Bots/Strategies</option>
              {bots.map((b) => <option key={b.bot_id} value={b.bot_id}>{b.bot_name}</option>)}
            </select>
          </div>

          {/* Date filter — quick lookback pills + an "open calendar"
              toggle for an exact custom range, by direct request
              ("integrate both calender and quick options"). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={15} className="text-gray-400 shrink-0" />
            {DATE_QUICK_OPTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => selectDateQuick(d.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  dateQuick === d.id && !hasCustomDate
                    ? dark ? 'bg-smc-accent text-white border-transparent' : 'bg-corporate-hero text-white border-transparent'
                    : dark ? 'bg-corporate-nav-dark border-smc-border text-gray-400 hover:text-white' : 'bg-white border-corporate-bg text-gray-500 hover:text-corporate-text-on-bg'
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              onClick={() => setDateOpen((o) => !o)}
              title="Pick an exact date range"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                hasCustomDate
                  ? dark ? 'bg-smc-accent text-white border-transparent' : 'bg-corporate-hero text-white border-transparent'
                  : dark ? 'bg-corporate-nav-dark border-smc-border text-gray-400 hover:text-white' : 'bg-white border-corporate-bg text-gray-500 hover:text-corporate-text-on-bg'
              }`}
            >
              {hasCustomDate ? `${customFrom || '…'} → ${customTo || '…'}` : 'Custom…'}
            </button>
            {dateActive && (
              <button onClick={clearDateFilter} className="text-xs text-gray-400 hover:text-gray-300 underline">
                Clear
              </button>
            )}
          </div>
        </div>

        {dateOpen && (
          <div className="flex items-center gap-2 flex-wrap text-xs pl-6">
            <label className="flex items-center gap-1.5">
              <span className="text-gray-400">From</span>
              <input
                type="date" value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setDateQuick(null); }}
                className={`px-2 py-1 border rounded text-xs ${dark ? 'bg-corporate-nav-dark border-smc-border text-white' : 'bg-white border-corporate-bg'}`}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-gray-400">To</span>
              <input
                type="date" value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setDateQuick(null); }}
                className={`px-2 py-1 border rounded text-xs ${dark ? 'bg-corporate-nav-dark border-smc-border text-white' : 'bg-white border-corporate-bg'}`}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-dashed border-current/10">
          <Filter size={16} className="text-gray-400 shrink-0" />
          {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === f
                  ? dark ? 'bg-smc-accent text-white border-transparent' : 'bg-corporate-hero text-white border-transparent'
                  : dark ? 'bg-corporate-nav-dark border-smc-border text-gray-400 hover:text-white' : 'bg-white border-corporate-bg text-gray-500 hover:text-corporate-text-on-bg'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk selection toolbar — by direct request ("Include a select
          option for individual trades - so user can select multiple
          at once for archive or delete"). Only appears once something
          is selected, right above the list it applies to. */}
      {selectedIds.size > 0 && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${dark ? 'bg-smc-accent/10 border-smc-accent/20' : 'bg-corporate-hero/10 border-corporate-hero/20'}`}>
          <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
            {selectedIds.size} trade{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-300 underline mr-1">Clear</button>
            <button
              onClick={() => handleBulkArchive(true)}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-500/30 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              <Archive size={13} /> Archive Selected
            </button>
            <button
              onClick={() => handleBulkDelete(true)}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}

      {/* By direct request ("for loading area put the loading
          indicator to help user wait") — only for the initial/manual
          load, not the silent background live-PnL refresh above. */}
      {loading && trades.length === 0 && archivedTrades.length === 0 && deletedTrades.length === 0 && (
        <div className="py-2"><LoadingIndicator phase="loading" dark={dark} /></div>
      )}

      {/* Banner to the new Pending Approvals page — by direct request
          ("ensure a clear link ... Recent Trades should show what is
          Executed or Closed after Execution"). Only shown for the
          default "All" filter, where those trades are now excluded
          from the list below. */}
      {filter === 'all' && pendingApprovalCount > 0 && (
        <Link
          to="/pending-approvals"
          className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
            dark ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-amber-500">
            <ClipboardCheck size={16} />
            {pendingApprovalCount} recommendation{pendingApprovalCount === 1 ? '' : 's'} waiting on your decision
          </span>
          <span className="flex items-center gap-1 text-xs text-amber-500">Review now <ArrowRight size={14} /></span>
        </Link>
      )}

      {/* Recent Trades / Archive Trades — two cards, by direct request
          ("create an option to move individual trades to a new
          archive trades card ... So two cards: Recent Trades, Archive
          Trades"). Recent stays open (it's the primary working view);
          Archive is folded by default (FoldedCard's own default).
          Pending bot recommendations excluded from this list by
          direct request — see excludeAwaitingApproval above. */}
      <FoldedCard title="Recent Trades" summary={`${trades.length} trade${trades.length === 1 ? '' : 's'}`} defaultOpen dark={dark}>
        {trades.length > 0 && (
          <SelectAllRow list={trades} selectedIds={selectedIds} onToggle={toggleSelectAll} dark={dark} />
        )}
        <div className="space-y-2">
          {trades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} onChanged={loadTrades} onArchive={handleArchive} onDelete={handleDelete} selected={selectedIds.has(trade.trade_id)} onToggleSelect={toggleSelect} />
          ))}
        </div>

        {!loading && trades.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            {search || filter !== 'all' ? 'No trades found matching your criteria.' : 'No trades yet — they\'ll show up here as your bots trade.'}
          </div>
        )}
      </FoldedCard>

      <FoldedCard
        title="Archive Trades"
        summary={`${archivedTrades.length} archived trade${archivedTrades.length === 1 ? '' : 's'}`}
        icon={<Archive size={18} />}
        dark={dark}
      >
        {archivedTrades.length > 0 && (
          <SelectAllRow list={archivedTrades} selectedIds={selectedIds} onToggle={toggleSelectAll} dark={dark} />
        )}
        <div className="space-y-2">
          {archivedTrades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} onChanged={loadTrades} onArchive={handleArchive} onDelete={handleDelete} selected={selectedIds.has(trade.trade_id)} onToggleSelect={toggleSelect} />
          ))}
        </div>

        {!loading && archivedTrades.length === 0 && (
          <div className="text-center py-8 text-gray-400">No archived trades — use "Archive" on a trade above to move it here.</div>
        )}
      </FoldedCard>

      {/* Deleted Trades — by direct request ("include a delete option
          ... a Delete card where all the deleted trades are stored for
          future reference"). Folded by default, same as Archive. */}
      <FoldedCard
        title="Deleted Trades"
        summary={`${deletedTrades.length} deleted trade${deletedTrades.length === 1 ? '' : 's'}`}
        icon={<Trash2 size={18} />}
        dark={dark}
      >
        {deletedTrades.length > 0 && (
          <SelectAllRow list={deletedTrades} selectedIds={selectedIds} onToggle={toggleSelectAll} dark={dark} />
        )}
        <div className="space-y-2">
          {deletedTrades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onChanged={loadTrades} onDelete={handleDelete} selected={selectedIds.has(trade.trade_id)} onToggleSelect={toggleSelect} />
          ))}
        </div>

        {!loading && deletedTrades.length === 0 && (
          <div className="text-center py-8 text-gray-400">No deleted trades — use "Delete" on a trade above to move it here.</div>
        )}
      </FoldedCard>
    </div>
  );
}

/** Small "select all visible" toggle shown above each of the 3 trade
 * cards — reflects whether EVERY row currently in that specific list
 * is selected (not the global selection count, which can span cards). */
function SelectAllRow({ list, selectedIds, onToggle, dark }: {
  list: Trade[]; selectedIds: Set<string>; onToggle: (list: Trade[]) => void; dark: boolean;
}) {
  const allSelected = list.length > 0 && list.every((t) => selectedIds.has(t.trade_id));
  return (
    <button
      onClick={() => onToggle(list)}
      className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
    >
      {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
      {allSelected ? 'Deselect all' : 'Select all'}
    </button>
  );
}
