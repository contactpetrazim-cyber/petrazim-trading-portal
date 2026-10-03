import { useEffect, useState } from 'react';
import { X, Clock3, ChevronDown } from 'lucide-react';
import { tradesApi } from '../services/api';
import type { TradeSnapshot, SnapshotTimeframe } from '../types';

const GREEN = '#10b981';
const RED = '#ef4444';

// Same 5-timeframe set every bot strategy/scanner already uses — by
// direct request ("Add 5M, 4D and 1D to the snapshots chart").
const TIMEFRAMES: SnapshotTimeframe[] = ['5m', '15m', '1h', '4h', '1d'];

/**
 * TradeSnapshotModal — "a quick reference ... showing the entry, SL
 * or TP ... with the candles," by direct request. Renders the REAL
 * 5M/15M/1H/4H/1D candles around this trade's own entry/exit window as
 * a static candlestick chart (not a live widget — this is deliberately
 * a look-back at what actually happened, not a live feed), with
 * entry/SL/TP1/exit drawn as labeled reference lines. Backed by
 * GET /trades/{id}/snapshot (routers/trades.py) — see that endpoint's
 * own comment for why this counts as a real "snapshot" without
 * storing an image: a past candle's OHLCV never changes.
 */
export function TradeSnapshotModal({ tradeId, dark, onClose }: { tradeId: string; dark: boolean; onClose: () => void }) {
  const [timeframe, setTimeframe] = useState<SnapshotTimeframe>('1h');
  const [snapshot, setSnapshot] = useState<TradeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    tradesApi.getTradeSnapshot(tradeId, timeframe)
      .then(setSnapshot)
      .catch((e) => setError(e?.response?.data?.detail || 'Could not load the chart snapshot right now.'))
      .finally(() => setLoading(false));
  }, [tradeId, timeframe]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className={dark ? 'text-white/50' : 'text-gray-400'} />
            <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
              {snapshot?.symbol || '…'} — Trade Snapshot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-0.5 rounded-md p-0.5 ${dark ? 'bg-white/5' : 'bg-gray-100'}`}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                    timeframe === tf ? (dark ? 'bg-white/20 text-white' : 'bg-white text-corporate-text-on-bg shadow-sm') : dark ? 'text-white/40' : 'text-gray-500'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <button onClick={onClose} className={dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
              <X size={18} />
            </button>
          </div>
        </div>

        {loading && <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading real {timeframe.toUpperCase()} candles…</p>}
        {!loading && error && <p className={`text-sm ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}
        {!loading && !error && snapshot && <SnapshotChart snapshot={snapshot} dark={dark} />}

        {/* Reason summary — by direct request ("Also include a reason
            summary that opens when clicked on the snapshot"). Same
            folded-by-default pattern as TradeRow's own "Reason
            summary" toggle, just inside the snapshot modal too so it's
            visible alongside the chart it explains. */}
        {!loading && !error && snapshot?.reasoning_log && <ReasonSummary text={snapshot.reasoning_log} dark={dark} />}
      </div>
    </div>
  );
}

function ReasonSummary({ text, dark }: { text: string; dark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mt-3 pt-3 border-t border-dashed ${dark ? 'border-smc-border' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
      >
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        Reason summary
      </button>
      {open && <p className={`mt-2 text-xs leading-relaxed ${dark ? 'text-white/70' : 'text-gray-600'}`}>{text}</p>}
    </div>
  );
}

// Nearest candle index to a given ISO timestamp — by direct request
// ("Include a triangle on the specific candle to indicate the
// specific candle for either entry and also either SL or TP").
// entry_timestamp/exit_timestamp rarely land EXACTLY on a candle open
// (a trade can enter/exit mid-candle), so "nearest" is the honest
// match, same spirit as the backend's own lookback-window math.
function nearestCandleIndex(candles: { timestamp: string }[], iso: string | null): number | null {
  if (!iso || candles.length === 0) return null;
  const target = new Date(iso).getTime();
  let best = 0;
  let bestDiff = Infinity;
  candles.forEach((c, i) => {
    const diff = Math.abs(new Date(c.timestamp).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

function SnapshotChart({ snapshot, dark }: { snapshot: TradeSnapshot; dark: boolean }) {
  const { candles, entry_price, entry_timestamp, stop_loss, take_profit_1, exit_price, exit_timestamp, direction } = snapshot;
  if (candles.length === 0) {
    return <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>No candle data for this window.</p>;
  }

  // Price range spans the candles AND every reference line, so a far
  // SL/TP outside the visible candle range still shows (clamped to
  // the chart edge) rather than being silently cut off.
  const refPrices = [entry_price, stop_loss, take_profit_1, exit_price].filter((v): v is number => v != null);
  const allHighs = candles.map((c) => c.high);
  const allLows = candles.map((c) => c.low);
  const maxP = Math.max(...allHighs, ...refPrices);
  const minP = Math.min(...allLows, ...refPrices);
  const pad = (maxP - minP) * 0.08 || maxP * 0.01 || 1;
  const yMax = maxP + pad, yMin = minP - pad;

  // Price axis — by direct request ("Include a price axis ....").
  // Reserves a left margin for tick labels; candles/lines/markers all
  // shift right by AXIS_W so nothing draws under the labels.
  const AXIS_W = 56;
  const chartW = Math.max(400, candles.length * 8);
  const w = chartW + AXIS_W;
  const h = 260;
  const candleW = (chartW / candles.length) * 0.65;
  const toY = (price: number) => h - ((price - yMin) / (yMax - yMin)) * h;
  const toX = (i: number) => AXIS_W + (i + 0.5) * (chartW / candles.length);
  const TICKS = 5;
  const priceTicks = Array.from({ length: TICKS }, (_, i) => yMin + ((yMax - yMin) * i) / (TICKS - 1));

  // All four reference lines now dashed, consistently — by direct
  // request ("No entry, SL and TP dash lines ....."): Entry/Exit used
  // to render as solid, blending into the candles behind them.
  const DASH = '4 3';
  const entryColor = dark ? '#60a5fa' : '#005FB8';
  const exitColor = '#f59e0b';
  const refLines: { price: number; color: string; label: string }[] = [];
  if (entry_price != null) refLines.push({ price: entry_price, color: entryColor, label: 'Entry' });
  refLines.push({ price: stop_loss, color: RED, label: 'SL' });
  if (take_profit_1 != null) refLines.push({ price: take_profit_1, color: GREEN, label: 'TP1' });
  if (exit_price != null) refLines.push({ price: exit_price, color: exitColor, label: 'Exit' });

  // Entry/exit candle markers — a small triangle sitting just off the
  // candle's wick, pointing at it: upward (from below) at the entry
  // candle, downward (from above) at the exit candle (whichever of
  // SL/TP actually closed the trade) — by direct request.
  const entryIdx = nearestCandleIndex(candles, entry_timestamp);
  const exitIdx = nearestCandleIndex(candles, exit_timestamp);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block">
          {candles.map((c, i) => {
            const up = c.close >= c.open;
            const x = toX(i);
            const bodyTop = toY(Math.max(c.open, c.close));
            const bodyBottom = toY(Math.min(c.open, c.close));
            return (
              <g key={i}>
                <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={up ? GREEN : RED} strokeWidth={1} />
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={Math.max(bodyBottom - bodyTop, 1)} fill={up ? GREEN : RED} />
              </g>
            );
          })}
          {refLines.map((r) => (
            <g key={r.label}>
              <line x1={AXIS_W} y1={toY(r.price)} x2={w} y2={toY(r.price)} stroke={r.color} strokeWidth={1} strokeDasharray={DASH} opacity={0.8} />
            </g>
          ))}
          {entryIdx != null && (() => {
            const x = toX(entryIdx);
            const base = toY(candles[entryIdx].low) + 8;
            return <polygon points={`${x - 5},${base} ${x + 5},${base} ${x},${base - 8}`} fill={entryColor} />;
          })()}
          {exitIdx != null && (() => {
            const x = toX(exitIdx);
            const base = toY(candles[exitIdx].high) - 8;
            return <polygon points={`${x - 5},${base} ${x + 5},${base} ${x},${base + 8}`} fill={exitColor} />;
          })()}
          {priceTicks.map((p, i) => {
            const y = toY(p);
            return (
              <g key={i}>
                <line x1={AXIS_W - 4} y1={y} x2={AXIS_W} y2={y} stroke={dark ? '#6b7280' : '#9ca3af'} strokeWidth={1} />
                <text
                  x={AXIS_W - 6} y={y} textAnchor="end" dominantBaseline="middle"
                  fontSize={9} fontFamily="monospace" fill={dark ? '#9ca3af' : '#6b7280'}
                >
                  {p.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
        {refLines.map((r) => (
          <span key={r.label} className="flex items-center gap-1" style={{ color: r.color }}>
            <span className="w-3 h-0.5" style={{ background: r.color }} /> {r.label}: {r.price.toFixed(2)}
          </span>
        ))}
        <span className={`ml-auto ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          {direction.toUpperCase()} · {candles.length} candles
        </span>
      </div>
    </div>
  );
}
