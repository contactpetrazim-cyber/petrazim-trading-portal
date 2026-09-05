import { useEffect, useState } from 'react';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TradePrint { price: number; qty: number; time: number; aggressor: 'buy' | 'sell' }
interface DepthLevel { price: number; qty: number }
interface Depth { bids: DepthLevel[]; asks: DepthLevel[] }
interface FootprintRow { row_price: number; bid_volume: number; ask_volume: number }
interface FootprintCandleData {
  time_ms: number; open: number; high: number; low: number; close: number;
  delta: number; total_volume: number; trade_count: number; rows: FootprintRow[];
}
interface VolumeProfileRow { row_price: number; volume: number }
interface FootprintChart {
  symbol: string; tick_size: number; candles: FootprintCandleData[];
  volume_profile: VolumeProfileRow[]; poc_price: number;
}

const TRADES_POLL_MS = 4000;
const DEPTH_POLL_MS = 5000;
const CHART_POLL_MS = 15000;

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
 * liquid crypto pairs — genuine time & sales (the tape, OF-02), a
 * genuine resting order-book snapshot (DOM, OF-05), and a genuine
 * per-price-level footprint chart with volume profile (OF-03, OF-04,
 * OF-06, OF-07).
 *
 * Deliberately scoped to crypto: Binance is the free, real,
 * no-account data source this exists to use — it has no forex data,
 * so this tool doesn't claim to cover the same symbols this
 * platform's own bots trade.
 */
export function OrderFlowChartTool({
  symbol: controlledSymbol,
  onSymbolChange,
}: {
  /** Optional controlled symbol — pass both this and onSymbolChange to
   * keep an external chart (e.g. OrderFlowFullPage's own ChartPanel)
   * showing the same instrument. Omit either and this manages its own
   * symbol internally, unchanged from before (ToolsPage's embedded use). */
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
} = {}) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [internalSymbol, setInternalSymbol] = useState('BTCUSDT');
  const symbol = controlledSymbol ?? internalSymbol;
  const setSymbol = onSymbolChange ?? setInternalSymbol;
  const [trades, setTrades] = useState<TradePrint[] | null>(null);
  const [depth, setDepth] = useState<Depth | null>(null);
  const [chart, setChart] = useState<FootprintChart | null>(null);
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
        // Real bug: on a cold Render free-tier start, the very first
        // poll could land before the backend woke up, setting this
        // error — which then NEVER cleared even once later polls (this
        // interval retries every 4s already) started succeeding, so
        // the tape kept updating live underneath a permanently stuck
        // "Could not load" banner.
        .then((d) => { if (!cancelled) { setTrades(d.reverse()); setError(null); } })
        .catch(() => !cancelled && setError('Could not load live order flow data right now.'));
    };
    load();
    const id = setInterval(load, TRADES_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  // Depth and footprint-chart used to swallow every failure into a
  // silent no-op, so a genuinely broken fetch (the require_active_access
  // 402 this tool used to wrongly return before it was fixed, or any
  // other real error) left these two panels stuck on "Loading…"
  // forever with zero visible signal, while the tape above at least
  // showed a (generic) error banner — the real cause behind "order
  // flow chart is still not loading, I only see a regular candle
  // chart" reading as if nothing below it was even trying. Both now
  // share the same error state the tape already sets/clears.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch(`${API_URL}/order-flow/depth?symbol=${symbol}&limit=10`, { headers })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => { if (!cancelled) { setDepth(d); setError(null); } })
        .catch(() => !cancelled && setError('Could not load live order flow data right now.'));
    };
    load();
    const id = setInterval(load, DEPTH_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch(`${API_URL}/order-flow/footprint-chart?symbol=${symbol}&trade_limit=1000&num_candles=15&target_rows=40`, { headers })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => { if (!cancelled) { setChart(d); setError(null); } })
        .catch(() => !cancelled && setError('Could not load live order flow data right now.'));
    };
    load();
    const id = setInterval(load, CHART_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, symbol]);

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-4 ${dark ? 'text-white/40' : 'text-gray-400'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

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
          onChange={(e) => { setTrades(null); setDepth(null); setChart(null); setSymbol(e.target.value); }}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
        >
          {(symbols.length ? symbols : [symbol]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className={`text-xs ml-2 ${mutedCls}`}>Crypto only — free data source, not this platform's own broker feed.</span>
      </div>

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Footprint chart + volume profile — the "volume clusters" view */}
      <div className={`${cardCls} mt-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className={titleCls} style={{ marginBottom: 0 }}>Footprint Chart — Bid × Ask Volume Clusters</div>
          {chart && (
            <span className={`text-xs ${mutedCls}`}>
              Tick size ≈ {chart.tick_size.toPrecision(3)} · POC {chart.poc_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {chart === null ? (
          <p className={`text-sm ${mutedCls}`}>Loading footprint chart…</p>
        ) : (
          <FootprintGrid chart={chart} dark={dark} mutedCls={mutedCls} />
        )}

        <div className={`mt-4 pt-4 border-t text-xs leading-relaxed ${dark ? 'border-white/10 text-white/60' : 'border-gray-100 text-gray-600'}`}>
          <div className="font-semibold mb-1.5">How to read this (see OF-03, OF-04, OF-07):</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Each cell is real bid volume (left, aggressive selling) × ask volume (right, aggressive buying) at that exact price, inside that candle only.</li>
            <li>A cell shaded green means more aggressive buying than selling happened there; red means the opposite — the darker the shade, the bigger the imbalance.</li>
            <li>The left bar chart is the session's Volume Profile — the longest bar is the Point of Control (POC), the single price with the most total volume.</li>
            <li>Watch for a new price high or low printed on thin, mostly-empty rows — that's often a fast, low-participation move, worth treating differently from a high built on heavy, two-sided volume (compare OF-06's absorption vs. exhaustion).</li>
            <li>A candle's Δ (delta, shown below it) is its total ask volume minus bid volume — compare it to the previous candle's Δ at a similar price to check for the delta divergence pattern from OF-04.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** One shared price grid — the volume-profile bars and every candle's
 * rows are placed by explicit row/column index so they line up
 * exactly, the same way a real footprint chart's rows align across
 * candles and against its volume-profile panel. */
function FootprintGrid({ chart, dark, mutedCls }: { chart: FootprintChart; dark: boolean; mutedCls: string }) {
  const rows = chart.volume_profile;   // already sorted high-to-low
  const maxVpVolume = Math.max(1e-9, ...rows.map((r) => r.volume));
  const maxCellVolume = Math.max(
    1e-9,
    ...chart.candles.flatMap((c) => c.rows.map((r) => r.bid_volume + r.ask_volume))
  );

  const candleRowMaps = chart.candles.map(
    (c) => new Map(c.rows.map((r) => [r.row_price.toFixed(8), r]))
  );

  const priceColWidth = 84;
  const vpColWidth = 90;
  const candleColWidth = 108;
  const rowHeight = 20;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${priceColWidth}px ${vpColWidth}px repeat(${chart.candles.length}, ${candleColWidth}px)`,
          gridTemplateRows: `repeat(${rows.length}, ${rowHeight}px) auto`,
          minWidth: priceColWidth + vpColWidth + chart.candles.length * candleColWidth,
        }}
      >
        {rows.map((row, ri) => {
          const isPoc = Math.abs(row.row_price - chart.poc_price) < chart.tick_size / 2;
          return (
            <div
              key={`price-${ri}`}
              className={`text-[10px] font-mono flex items-center pr-2 justify-end ${isPoc ? 'font-bold' : ''} ${mutedCls}`}
              style={{ gridRow: ri + 1, gridColumn: 1, color: isPoc ? '#f59e0b' : undefined }}
            >
              {row.row_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          );
        })}

        {rows.map((row, ri) => (
          <div key={`vp-${ri}`} className="flex items-center" style={{ gridRow: ri + 1, gridColumn: 2 }}>
            <div
              className={dark ? 'bg-white/20' : 'bg-gray-300'}
              style={{ height: rowHeight - 6, width: `${(row.volume / maxVpVolume) * 100}%`, minWidth: row.volume > 0 ? 2 : 0 }}
              title={`${row.volume} traded at this price`}
            />
          </div>
        ))}

        {chart.candles.map((candle, ci) =>
          rows.map((row, ri) => {
            const cell = candleRowMaps[ci].get(row.row_price.toFixed(8));
            if (!cell || (cell.bid_volume === 0 && cell.ask_volume === 0)) {
              return <div key={`c${ci}-${ri}`} style={{ gridRow: ri + 1, gridColumn: ci + 3 }} />;
            }
            const netAsk = cell.ask_volume - cell.bid_volume;
            const intensity = Math.min(1, Math.abs(netAsk) / maxCellVolume) * 0.7 + 0.08;
            const bg = netAsk >= 0 ? `rgba(16,185,129,${intensity})` : `rgba(239,68,68,${intensity})`;
            return (
              <div
                key={`c${ci}-${ri}`}
                className="text-[9px] font-mono flex items-center justify-center"
                style={{ gridRow: ri + 1, gridColumn: ci + 3, background: bg }}
                title={`bid ${cell.bid_volume} × ask ${cell.ask_volume}`}
              >
                {cell.bid_volume.toFixed(2)}×{cell.ask_volume.toFixed(2)}
              </div>
            );
          })
        )}

        <div style={{ gridRow: rows.length + 1, gridColumn: 1 }} />
        <div style={{ gridRow: rows.length + 1, gridColumn: 2 }} />
        {chart.candles.map((candle, ci) => (
          <div
            key={`delta-${ci}`}
            className="text-[10px] font-mono flex flex-col items-center pt-1.5"
            style={{ gridRow: rows.length + 1, gridColumn: ci + 3 }}
          >
            <span className={candle.delta >= 0 ? 'text-emerald-500 font-semibold' : 'text-red-500 font-semibold'}>
              Δ {candle.delta >= 0 ? '+' : ''}{candle.delta.toFixed(2)}
            </span>
            <span className={mutedCls}>{candle.trade_count} tr</span>
          </div>
        ))}
      </div>
    </div>
  );
}
