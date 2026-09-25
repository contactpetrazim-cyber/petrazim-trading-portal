
import { useEffect, useState } from 'react';
import { TradeRow } from '../components/TradeRow';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { FoldedCard } from '../components/FoldedCard';
import { SourceToggle, type TradeSource } from '../components/TradeAnalytics';
import { tradesApi } from '../services/api';
import { Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { Filter, Search, Download, RefreshCw, Archive, Trash2 } from 'lucide-react';
import { formatApiError } from '../lib/apiError';

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
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Bots vs Manual — by direct request ("all visuals or analytics
  // should be differentiated by a toggle bots vs Manual trades").
  // Same `source` filter analytics/summary uses (routers/trades.py).
  const [source, setSource] = useState<TradeSource>('all');

  function buildParams(): { status?: string; symbol?: string; source?: string } {
    const params: { status?: string; symbol?: string; source?: string } = {};
    if (filter !== 'all') params.status = filter;
    if (search) params.symbol = search.toUpperCase();
    if (source !== 'all') params.source = source;
    return params;
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
      setTrades(recent);
      setArchivedTrades(archived);
      setDeletedTrades(deleted);
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

  useEffect(() => {
    const t = setTimeout(loadTrades, 300); // debounce the search input
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, source]);

  // Silent background refresh (no loading-indicator flash) so live
  // unrealized PnL actually updates while an active trade is open,
  // rather than only refreshing on a manual click.
  useEffect(() => {
    if (!trades.some((t) => t.status === 'active')) return;
    const id = setInterval(() => {
      tradesApi.getTrades({ ...buildParams(), archived: false }).then(setTrades).catch(() => {});
    }, LIVE_PNL_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, filter, search, source]);

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
    const header = 'trade_id,symbol,direction,status,entry_price,stop_loss,take_profit,lot_size,realized_pnl,unrealized_pnl,bot_id,created_at,archived,deleted';
    const rows = [...trades, ...archivedTrades, ...deletedTrades].map((t) =>
      [t.trade_id, t.symbol, t.direction, t.status, t.entry_price, t.stop_loss, t.take_profit, t.lot_size, t.realized_pnl, t.unrealized_pnl, t.bot_id, t.created_at, t.is_archived ?? false, t.is_deleted ?? false].join(',')
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none ${
              dark ? 'bg-smc-card border-smc-border focus:border-smc-accent' : 'bg-white border-corporate-bg focus:border-corporate-hero'
            }`}
          />
        </div>

        <SourceToggle value={source} onChange={setSource} dark={dark} />

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          {['all', 'active', 'pending', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === f
                  ? dark ? 'bg-smc-accent text-white border-transparent' : 'bg-corporate-hero text-white border-transparent'
                  : dark ? 'bg-smc-card border-smc-border text-gray-400 hover:text-white' : 'bg-white border-corporate-bg text-gray-500 hover:text-corporate-text-on-bg'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {/* By direct request ("for loading area put the loading
          indicator to help user wait") — only for the initial/manual
          load, not the silent background live-PnL refresh above. */}
      {loading && trades.length === 0 && archivedTrades.length === 0 && deletedTrades.length === 0 && (
        <div className="py-2"><LoadingIndicator phase="loading" dark={dark} /></div>
      )}

      {/* Recent Trades / Archive Trades — two cards, by direct request
          ("create an option to move individual trades to a new
          archive trades card ... So two cards: Recent Trades, Archive
          Trades"). Recent stays open (it's the primary working view);
          Archive is folded by default (FoldedCard's own default). */}
      <FoldedCard title="Recent Trades" summary={`${trades.length} trade${trades.length === 1 ? '' : 's'}`} defaultOpen dark={dark}>
        <div className="space-y-2">
          {trades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} onChanged={loadTrades} onArchive={handleArchive} onDelete={handleDelete} />
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
        <div className="space-y-2">
          {archivedTrades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} onChanged={loadTrades} onArchive={handleArchive} onDelete={handleDelete} />
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
        <div className="space-y-2">
          {deletedTrades.map((trade) => (
            <TradeRow key={trade.trade_id} trade={trade} onChanged={loadTrades} onDelete={handleDelete} />
          ))}
        </div>

        {!loading && deletedTrades.length === 0 && (
          <div className="text-center py-8 text-gray-400">No deleted trades — use "Delete" on a trade above to move it here.</div>
        )}
      </FoldedCard>
    </div>
  );
}
