import { useState, FormEvent } from 'react';
import { Radar, AlertTriangle, Sparkles, Lock } from 'lucide-react';
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

// Same five rules, loosened -- a real near-miss, not yet a hit (RSI 31
// doesn't miss "oversold" any less meaningfully than RSI 29 hits it).
// By direct request ("be proactive ... we may miss some").
const WATCHING_LABEL: Record<string, string> = {
  approaching_breakout_20: 'Approaching 20-bar high',
  approaching_bull_flag: 'Building a flag',
  approaching_reclaim_ma20: 'Approaching 20-bar MA',
  approaching_oversold: 'Approaching oversold',
  approaching_oversold_bounce: 'Approaching oversold bounce',
};

// Shows every scanned symbol's real numbers, hit or not -- a symbol
// with no setup tags is an honest "nothing active right now" result,
// not a failure, and hiding it left the UI with nothing to show on a
// correct zero-hit scan (direct bug report: read as broken). Border
// accent distinguishes an active setup from a checked-and-clear one;
// a near-miss (watching) gets a softer amber badge, one step down from
// a confirmed hit's emerald one.
function HitRow({ hit, dark }: { hit: TradeScannerHit; dark: boolean }) {
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const hasSetup = hit.setups.length > 0;
  const hasWatching = hit.watching.length > 0;
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${
      hasSetup
        ? dark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100'
        : hasWatching
          ? dark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-100'
          : dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold">{hit.symbol}</span>
        <span className={`text-xs ${mutedCls}`}>{hit.price} · RSI {hit.rsi ?? '—'} · run {hit.run_pct > 0 ? '+' : ''}{hit.run_pct}%</span>
      </div>
      {(hasSetup || hasWatching) ? (
        <div className="flex flex-wrap gap-1.5">
          {hit.setups.map((tag) => (
            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
              {SETUP_LABEL[tag] || tag}
            </span>
          ))}
          {hit.watching.map((tag) => (
            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              {WATCHING_LABEL[tag] || tag}
            </span>
          ))}
        </div>
      ) : (
        <span className={`text-[11px] ${mutedCls}`}>No setup active right now.</span>
      )}
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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGated, setAiGated] = useState(false);

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
    setAiSummary(null);
    setAiError(null);
    tradeScannerApi.scan({ exchange, symbols, timeframe })
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || 'Could not run the scan right now.'))
      .finally(() => setLoading(false));
  }

  // Admin/invite-gated -- same real per-call cost and same gate as Day
  // Trader Skill Chat (require_feature_access("day_trader_skill_chat")
  // on the backend). A 403 here means "not invited," not a bug.
  function aiRead() {
    if (!data || data.hits.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    tradeScannerApi.aiRead(data.exchange, data.timeframe, data.hits)
      .then((res) => setAiSummary(res.summary))
      .catch((err) => {
        if (err?.response?.status === 403) setAiGated(true);
        setAiError(err?.response?.data?.detail || 'Could not get an AI read right now.');
      })
      .finally(() => setAiLoading(false));
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
            <option value="bingx">BingX</option>
            <option value="mexc">MEXC</option>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Radar size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
            <span className="text-sm font-semibold">{data.counts.hits} setup{data.counts.hits === 1 ? '' : 's'} active</span>
            <span className={`text-xs ${mutedCls}`}>
              {data.counts.scanned} scanned · {data.counts.skipped_short} too short · {data.counts.skipped_illiquid} illiquid
              {data.counts.errored > 0 ? ` · ${data.counts.errored} errored` : ''}
            </span>
            {data.hits.length > 0 && !aiGated && (
              <button
                onClick={aiRead} disabled={aiLoading}
                className={`ml-auto flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50 ${
                  dark ? 'bg-corporate-hero/20 text-corporate-hero' : 'bg-corporate-hero/10 text-corporate-hero'
                }`}
              >
                <Sparkles size={12} /> {aiLoading ? 'Reading…' : 'AI Read'}
              </button>
            )}
          </div>

          {aiGated && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <Lock size={13} className="mt-0.5 shrink-0" />
              <span>AI Read is admin/invite-only (a real, paid Claude call) -- ask an admin to grant you access from the Admin Console's Feature Access panel.</span>
            </div>
          )}

          {aiError && !aiGated && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {aiSummary && (
            <div className={`rounded-xl px-3 py-2.5 border ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={13} className="text-corporate-hero" />
                <span className="text-xs font-semibold">Claude's read</span>
              </div>
              <p className={`text-sm whitespace-pre-wrap ${dark ? 'text-white/90' : 'text-corporate-text-on-bg'}`}>{aiSummary}</p>
            </div>
          )}

          {data.errors.length > 0 && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{data.errors.join(' · ')}</span>
            </div>
          )}

          <div className="space-y-2">
            {data.hits.map((hit) => <HitRow key={hit.symbol} hit={hit} dark={dark} />)}
            {data.hits.length === 0 && (
              <p className={`text-sm ${mutedCls}`}>
                {data.counts.scanned === 0 ? 'Nothing could be scanned -- check the symbols/exchange above.' : 'No setups fired for this watchlist right now.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
