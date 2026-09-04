
import { useEffect, useState } from 'react';
import { TradeRow } from '../components/TradeRow';
import { tradesApi } from '../services/api';
import { Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { Filter, Search, Download, RefreshCw } from 'lucide-react';

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
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  async function loadTrades() {
    setLoading(true);
    setError(null);
    try {
      const params: { status?: string; symbol?: string } = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.symbol = search.toUpperCase();
      setTrades(await tradesApi.getTrades(params));
    } catch (e: any) {
      setError('Could not load trades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(loadTrades, 300); // debounce the search input
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  async function handleApprove(tradeId: string) {
    await tradesApi.approveTrade(tradeId, true);
    loadTrades();
  }

  async function handleReject(tradeId: string) {
    await tradesApi.approveTrade(tradeId, false);
    loadTrades();
  }

  function exportCsv() {
    const header = 'trade_id,symbol,direction,status,entry_price,stop_loss,take_profit,lot_size,realized_pnl,unrealized_pnl,bot_id,created_at';
    const rows = trades.map((t) =>
      [t.trade_id, t.symbol, t.direction, t.status, t.entry_price, t.stop_loss, t.take_profit, t.lot_size, t.realized_pnl, t.unrealized_pnl, t.bot_id, t.created_at].join(',')
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
            disabled={trades.length === 0}
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

      {/* Trade List */}
      <div className="space-y-2">
        {trades.map((trade) => (
          <TradeRow key={trade.trade_id} trade={trade} onApprove={handleApprove} onReject={handleReject} />
        ))}
      </div>

      {!loading && trades.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          {search || filter !== 'all' ? 'No trades found matching your criteria.' : 'No trades yet — they\'ll show up here as your bots trade.'}
        </div>
      )}
    </div>
  );
}
