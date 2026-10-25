import { useState, FormEvent } from 'react';
import { Radar, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { tradeScannerApi } from '../services/api';
import type { TradeScannerResponse, TradeScannerHit } from '../types';
import { useThemeStore } from '../hooks/useTheme';

const SETUP_LABEL: Record<string, string> = {
  breakout_20: 'Breakout (20-bar high)',
  bull_flag: 'Bull flag',
  reclaim_ma20: 'Reclaimed 20-bar MA',
  oversold: 'Oversold (RSI < 30)',
  oversold_bounce: 'Oversold bounce',
};

function HitRow({ hit, dark }: { hit: TradeScannerHit; dark: boolean }) {
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold">{hit.symbol}</span>
        <span className={`text-xs ${mutedCls}`}>{hit.price} · RSI {hit.rsi ?? '—'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hit.setups.map((tag) => (
          <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
            {SETUP_LABEL[tag] || tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * ExploreTradeScannerPage -- momentum/RSI setup screener across a symbol
 * watchlist, ported from the MIT-licensed trader-scanner skill's daily-setup
 * scan (github.com/Jakeschincariol/day-trader-skill, scan.py) -- same five
 * setup rules (breakout, bull flag, MA reclaim, oversold, oversold bounce),
 * generalized from US-equity daily bars to this app's own crypto symbols
 * on any chosen timeframe. The source skill's opening-range-breakout mode
 * isn't ported: it's built around a single daily market-open window that
 * doesn't exist in a 24/7 market.
 */
export function ExploreTradeScannerPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [symbolsText, setSymbolsText] = useState('BTC/USDT, ETH/USDT, SOL/USDT');
  const [exchange, setExchange] = useState('okx');
  const [timeframe, setTimeframe] = useState('1h');
  const [data, setData] = useState<TradeScannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const inputCls = `px-3 py-2 rounded-lg text-sm border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`;

  function scan(e?: FormEvent) {
    e?.preventDefault();
    const symbols = symbolsText.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) {
      setError('Enter at least one symbol, comma-separated.');
      return;
    }
    setLoading(true);
    setError(null);
    tradeScannerApi.scan({ exchange, symbols, timeframe })
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || 'Could not run the scan right now.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <PageHeader
        title="Trade Scanner"
        subtitle="Scan a watchlist for momentum/RSI setups right now -- breakouts, bull flags, MA reclaims, oversold bounces."
      />

      <form onSubmit={scan} className="space-y-2 mb-4">
        <input
          value={symbolsText} onChange={(e) => setSymbolsText(e.target.value)}
          placeholder="Symbols, comma-separated: BTC/USDT, ETH/USDT, SOL/USDT" className={`${inputCls} w-full`}
        />
        <div className="grid grid-cols-3 gap-2">
          <select value={exchange} onChange={(e) => setExchange(e.target.value)} className={inputCls}>
            <option value="okx">OKX</option>
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
          </select>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={inputCls}>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-corporate-hero disabled:opacity-40">
            {loading ? 'Scanning…' : 'Scan'}
          </button>
        </div>
      </form>

      {!data && !loading && !error && (
        <p className={`text-sm ${mutedCls}`}>A momentum/RSI screen of real recent price action -- a lead to investigate, not a signal to act on.</p>
      )}

      {!loading && error && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radar size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
            <span className="text-sm font-semibold">{data.counts.hits} hit{data.counts.hits === 1 ? '' : 's'}</span>
            <span className={`text-xs ${mutedCls}`}>
              {data.counts.scanned} scanned · {data.counts.skipped_short} too short · {data.counts.skipped_illiquid} illiquid
              {data.counts.errored > 0 ? ` · ${data.counts.errored} errored` : ''}
            </span>
          </div>

          {data.errors.length > 0 && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{data.errors.join(' · ')}</span>
            </div>
          )}

          <div className="space-y-2">
            {data.hits.map((hit) => <HitRow key={hit.symbol} hit={hit} dark={dark} />)}
            {data.hits.length === 0 && <p className={`text-sm ${mutedCls}`}>No setups fired for this watchlist right now.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
