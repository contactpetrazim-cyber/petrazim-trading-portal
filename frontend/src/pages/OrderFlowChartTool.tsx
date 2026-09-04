import { useEffect, useState } from 'react';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TradePrint { price: number; qty: number; time: number; aggressor: 'buy' | 'sell' }
interface FootprintBucket {
  bucket_start_ms: number; buy_volume: number; sell_volume: number;
  delta: number; high: number; low: number; trade_count: number;
}
interface DepthLevel { price: number; qty: number }
interface Depth { bids: DepthLevel[]; asks: DepthLevel[] }

const TRADES_POLL_MS = 4000;
const FOOTPRINT_POLL_MS = 10000;
const DEPTH_POLL_MS = 5000;

/**
 * OrderFlowChartTool — a REAL order-flow chart, not a simulation.
 * Embedded as a FoldedCard section in ToolsPage.tsx, the same pattern
 * every other real tool on that page already follows (kept in its own
 * file rather than inlined, unlike the others, only because its three
 * independently-polled live data streams make it meaningfully more
 * stateful than a calculator). Backs the Order Flow Trading curriculum
 * module (OF-01 through OF-11), which this platform otherwise has no
 * live data to demonstrate against (see that module's own opening
 * note: this platform's Candle model carries no tick or order-book
 * data anywhere). Proxies Binance's free, no-API-key-required public
 * market-data endpoints (routers/order_flow.py) for a fixed list of
 * liquid crypto pairs — genuine time & sales (the tape, OF-02),
 * genuine aggressor-side delta per time bucket (footprint, OF-04),
 * and a genuine resting order-book snapshot (DOM, OF-05).
 *
 * Deliberately scoped to crypto: Binance is the free, real,
 * no-account data source this exists to use — it has no forex data,
 * so this tool doesn't claim to cover the same symbols this
 * platform's own bots trade.
 */
export function OrderFlowChartTool() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [trades, setTrades] = useState<TradePrint[] | null>(null);
  const [footprint, setFootprint] = useState<FootprintBucket[] | null>(null);
  const [depth, setDepth] = useState<Depth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/order-flow/symbols`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSymbols(d.symbols))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch(`${API_URL}/order-flow/trades?symbol=${symbol}&limit=40`, { headers })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => !cancelled && setTrades(d.reverse()))
        .catch(() => !cancelled && setError('Could not load live order flow data right now.'));
    };
    load();
    const id = setInterval(load, TRADES_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch(`${API_URL}/order-flow/footprint?symbol=${symbol}&limit=500&buckets=20`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && d && setFootprint(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, FOOTPRINT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch(`${API_URL}/order-flow/depth?symbol=${symbol}&limit=10`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && d && setDepth(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, DEPTH_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-4 ${dark ? 'text-white/40' : 'text-gray-400'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  const maxAbsDelta = footprint ? Math.max(1, ...footprint.map((b) => Math.abs(b.delta))) : 1;

  return (
    <div>
      <p className={`text-xs mb-4 ${mutedCls}`}>
        Live tape, delta, and order book — real data from Binance's free public market data, not a
        simulation.
      </p>

      <div className="mb-5 flex items-center gap-2">
        <span className={`text-xs ${mutedCls}`}>Symbol</span>
        <select
          value={symbol}
          onChange={(e) => { setTrades(null); setFootprint(null); setDepth(null); setSymbol(e.target.value); }}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
        >
          {(symbols.length ? symbols : [symbol]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className={`text-xs ml-2 ${mutedCls}`}>Crypto only — free data source, not this platform's own broker feed.</span>
      </div>

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tape */}
        <div className={cardCls}>
          <div className={titleCls}>Time &amp; Sales (Tape)</div>
          {trades === null ? (
            <p className={`text-sm ${mutedCls}`}>Loading live trades…</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1">
              {trades.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className={`font-mono font-semibold ${t.aggressor === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className={mutedCls}>{t.qty.toFixed(4)}</span>
                  <span className={`uppercase text-[10px] font-bold ${t.aggressor === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.aggressor}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footprint / Delta */}
        <div className={cardCls}>
          <div className={titleCls}>Delta per Bucket (Footprint)</div>
          {footprint === null ? (
            <p className={`text-sm ${mutedCls}`}>Loading delta…</p>
          ) : footprint.length === 0 ? (
            <p className={`text-sm ${mutedCls}`}>No recent trades to bucket.</p>
          ) : (
            <div className="flex items-end gap-1 h-56">
              {footprint.map((b) => {
                const pct = (Math.abs(b.delta) / maxAbsDelta) * 100;
                const positive = b.delta >= 0;
                return (
                  <div key={b.bucket_start_ms} className="flex-1 flex flex-col justify-end h-full" title={`Δ ${b.delta.toFixed(4)} (${b.trade_count} trades)`}>
                    <div
                      className={`w-full rounded-sm ${positive ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ height: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className={`text-xs mt-3 ${mutedCls}`}>
            Each bar is real aggressor-side buy volume minus sell volume for that time window — a
            positive (green) bar means more aggressive buying than selling.
          </div>
        </div>

        {/* DOM */}
        <div className={cardCls}>
          <div className={titleCls}>Order Book (DOM)</div>
          {depth === null ? (
            <p className={`text-sm ${mutedCls}`}>Loading order book…</p>
          ) : (
            <div className="text-xs space-y-2">
              <div>
                <div className={`font-semibold mb-1 ${mutedCls}`}>Asks</div>
                {[...depth.asks].reverse().map((a, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="text-red-500 font-mono">{a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className={mutedCls}>{a.qty.toFixed(4)}</span>
                  </div>
                ))}
              </div>
              <div className={`border-t my-1 ${dark ? 'border-white/10' : 'border-gray-100'}`} />
              <div>
                <div className={`font-semibold mb-1 ${mutedCls}`}>Bids</div>
                {depth.bids.map((b, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="text-emerald-500 font-mono">{b.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className={mutedCls}>{b.qty.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={`text-xs mt-3 ${mutedCls}`}>
            Resting orders only (OF-05) — remember: visible size here isn't a commitment until it
            actually trades on the tape.
          </div>
        </div>
      </div>
    </div>
  );
}
