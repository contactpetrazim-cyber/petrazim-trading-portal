import { useEffect, useState } from 'react';
import { INSTRUMENT_CATALOGUE, searchCatalogue } from '../config/instrumentCatalogue';
import { MAX_QUICK_PAIRS, pairFromResult, useQuickPairsStore, type QuickPair } from '../hooks/useQuickPairs';
import { botsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

/** The 4 exchanges this app can route a live order to — used only to
 *  tag a pair with a broker id when its real exchange happens to match. */
export const ORDER_BROKERS = [
  { id: 'binance', tvPrefix: 'BINANCE' },
  { id: 'bybit', tvPrefix: 'BYBIT' },
  { id: 'bingx', tvPrefix: 'BINGX' },
  { id: 'mexc', tvPrefix: 'MEXC' },
];

/**
 * PairsPanel — the folded "Pairs" surface every chart shares: saved
 * quick-links on the left, a "+" that opens the searchable instrument
 * inventory. Picking a search result immediately switches the chart to
 * that instrument AND saves it as a quick-link (shared across charts),
 * so the chart and the quick-link can never disagree — that mismatch
 * was the reported "the chart still shows BTC" bug.
 */
export function PairsPanel({
  selected,
  onSelect,
  dark = false,
}: {
  selected: QuickPair;
  onSelect: (pair: QuickPair) => void;
  dark?: boolean;
}) {
  const { token } = useAuth();
  const { pairs, addPair, removePair } = useQuickPairsStore();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ symbol: string; exchange: string; description: string; type: string }[]>(
    INSTRUMENT_CATALOGUE.slice(0, 25).map((i) => ({ ...i })),
  );
  const [remoteBusy, setRemoteBusy] = useState(false);

  useEffect(() => {
    if (!searching) return;
    const q = query.trim();
    // Local catalogue first — instant, zero-latency results for the
    // handful of common instruments (and every DEFAULT_QUICK_PAIRS
    // entry, guaranteed to still match itself), while the broader
    // TradingView-backed search below fills in behind it.
    const local = searchCatalogue(q).map((i) => ({
      symbol: i.symbol, exchange: i.exchange, description: i.description, type: i.type as string,
    }));
    setResults(local);
    if (q.length < 2 || !token) { setRemoteBusy(false); return; }
    setRemoteBusy(true);
    const t = setTimeout(() => {
      // Real TradingView symbols across every asset class — the exact
      // database the chart's own internal search uses (see
      // order_flow.py's chart_symbol_search) — by direct bug report
      // ("the search any instrument should connect to the chart
      // search ... at the moment it sometimes gives an error that
      // 'nothing matched' — yet the search in the chart actually
      // brings out the correct instrument"). Replaces the old
      // Binance-only /instruments fallback, which could never find a
      // forex/stock/index symbol no matter how exactly it was typed.
      botsApi.chartSymbolSearch(q)
        .then((list) => {
          const extra = list
            .map((i) => ({ symbol: i.symbol, exchange: i.exchange, description: i.description, type: i.type }))
            .filter((i) => !local.some((l) => l.symbol === i.symbol && l.exchange === i.exchange));
          setResults([...local, ...extra].slice(0, 30));
        })
        .catch(() => { /* catalogue results already shown */ })
        .finally(() => setRemoteBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, searching, token]);

  function pick(result: { symbol: string; exchange: string; description?: string }) {
    const pair = pairFromResult(result, ORDER_BROKERS);
    if (!pair) return;
    addPair(pair);
    onSelect(pair);
    setSearching(false);
    setQuery('');
  }

  function pickTyped(raw: string) {
    const clean = raw.trim().toUpperCase();
    if (!clean) return;
    if (clean.includes(':')) {
      const [exch, sym] = clean.split(':');
      if (exch && sym) pick({ symbol: sym, exchange: exch });
      return;
    }
    if (results.length > 0) pick(results[0]);
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1 rounded-lg p-1 ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
          {pairs.map((p) => (
            <span key={p.tv} className="relative group inline-flex">
              <button
                onClick={() => onSelect(p)}
                title={p.tv}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  selected.tv === p.tv
                    ? dark ? 'bg-white/20 text-white' : 'bg-white text-corporate-text-on-bg shadow-sm'
                    : dark ? 'text-white/40' : 'text-gray-500'
                }`}
              >
                {p.label}
              </button>
              {pairs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removePair(p.tv); }}
                  aria-label={`Remove ${p.label}`}
                  className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full items-center justify-center text-[9px] bg-red-500 text-white"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {pairs.length < MAX_QUICK_PAIRS && (
            <button
              onClick={() => setSearching((v) => !v)}
              title="Add a pair quick-link"
              aria-label="Add a pair quick-link"
              className={`px-2 py-1 rounded-md text-xs font-bold ${dark ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-white'}`}
            >
              +
            </button>
          )}
        </div>
      </div>

      {searching && (
        <div className={`rounded-lg border p-3 mt-2 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
          <input
            autoFocus
            placeholder="Search any instrument — e.g. AAPL, XAUUSD, EURUSD, BTCUSDT, NAS100…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') pickTyped(query);
              if (e.key === 'Escape') { setSearching(false); setQuery(''); }
            }}
            className={`w-full rounded-lg px-3 py-2 text-sm outline-none border ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200'}`}
          />
          <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-black/5">
            {results.map((r) => (
              <button
                key={`${r.exchange}:${r.symbol}`}
                onClick={() => pick(r)}
                className={`w-full text-left px-2 py-2 flex items-center justify-between gap-2 rounded ${dark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
              >
                <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                  {r.symbol}
                  <span className={`ml-2 font-normal ${dark ? 'text-white/40' : 'text-gray-400'}`}>{r.description}</span>
                </span>
                <span className={`text-[10px] uppercase shrink-0 ${dark ? 'text-white/30' : 'text-gray-400'}`}>{r.exchange}</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className={`text-xs py-3 text-center ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                {remoteBusy ? 'Searching…' : 'Nothing matched — type an EXCHANGE:TICKER pair and press Enter.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
