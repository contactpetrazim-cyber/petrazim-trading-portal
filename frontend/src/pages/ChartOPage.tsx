import { useEffect, useMemo, useState } from 'react';
import { Search, LineChart } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { CandleChart, type Candle } from '../components/CandleChart';
import { oandaApi, type OandaInstrument } from '../services/api';
import { useThemeStore } from '../hooks/useTheme';

/**
 * Chart O — a genuine, free OANDA-backed chart, the direct counterpart
 * to /tradingview's own TradingView-backed one. By direct request:
 * "OANDA is great news ... I get to use their data for free ...
 * Make sure there is a button for oanda charts just like tradingview.
 * Call the Oanda charts 'Chart O'."
 *
 * Unlike the TradingView embed (an iframe showing TradingView's OWN
 * data), this draws real candles this app fetched itself from
 * routers/oanda.py — the same CandleChart primitive PositionOnChartModal
 * already uses for order_flow.py's Binance-backed klines, reused here
 * for OANDA's forex/index candles instead of built twice.
 *
 * Symbol search is a plain client-side filter over the platform
 * account's own real instrument list (GET /oanda/instruments) — OANDA
 * only has ~120 tradeable instruments total, small enough that a
 * server-side search endpoint (like the TradingView-backed unified
 * Pairs search elsewhere) would be pure overhead here.
 */
const INTERVALS: { label: string; value: string }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: 'D', value: '1d' },
  { label: 'W', value: '1w' },
];

export function ChartOPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  const [instruments, setInstruments] = useState<OandaInstrument[]>([]);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [symbol, setSymbol] = useState('NAS100_USD');
  const [interval, setInterval_] = useState('1h');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    oandaApi.instruments()
      .then(setInstruments)
      .catch((err) => setInstrumentsError(err?.response?.data?.detail || 'Could not load the OANDA instrument list.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    setError(null);
    oandaApi.candles(symbol, interval, 200)
      .then((bars) => {
        if (cancelled) return;
        setCandles(bars.map((b) => ({ time: b.time_ms, open: b.open, high: b.high, low: b.low, close: b.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.detail || `Could not load OANDA candles for ${symbol}.`);
      });
    return () => { cancelled = true; };
  }, [symbol, interval]);

  const results = useMemo(() => {
    if (!query.trim()) return instruments.slice(0, 20);
    const q = query.trim().toUpperCase();
    return instruments.filter((i) => i.name.includes(q) || i.display_name.toUpperCase().includes(q)).slice(0, 20);
  }, [instruments, query]);

  const inputCls = `w-full pl-8 pr-3 py-2 text-sm rounded-lg border ${
    dark ? 'bg-smc-dark border-smc-border text-white placeholder:text-white/30' : 'bg-white border-corporate-bg'
  }`;

  return (
    <div>
      <PageHeader title="Chart O" subtitle="A real, free OANDA chart — forex majors, NAS100, and other indices, fetched live." />

      <FoldedCard title="Chart O" summary={symbol} icon={<LineChart size={19} />} dark={dark} defaultOpen>
        <div className="relative mb-3">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-gray-400'}`} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
            placeholder="Search instruments — EUR_USD, NAS100_USD, XAU_USD..."
            className={inputCls}
          />
          {showResults && results.length > 0 && (
            <div className={`absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border shadow-lg ${dark ? 'bg-smc-dark border-smc-border' : 'bg-white border-corporate-bg'}`}>
              {results.map((i) => (
                <button
                  key={i.name}
                  onMouseDown={() => { setSymbol(i.name); setQuery(''); setShowResults(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${dark ? 'hover:bg-white/5 text-white' : 'hover:bg-black/5'}`}
                >
                  <span className="font-medium">{i.display_name}</span>
                  <span className={`text-[11px] ${dark ? 'text-white/40' : 'text-gray-400'}`}>{i.type}</span>
                </button>
              ))}
            </div>
          )}
          {instrumentsError && <p className="text-xs text-red-600 mt-1.5">{instrumentsError}</p>}
        </div>

        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {INTERVALS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval_(tf.value)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                interval === tf.value
                  ? 'bg-corporate-hero text-white'
                  : dark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-gray-500'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 py-4">{error}</p>}
        {!error && !candles && <p className={`text-sm py-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Loading…</p>}
        {!error && candles && <CandleChart candles={candles} height={420} dark={dark} />}
      </FoldedCard>
    </div>
  );
}
