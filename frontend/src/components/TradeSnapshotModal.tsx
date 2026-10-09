import { useEffect, useState } from 'react';
import { X, Clock3, ChevronDown, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { tradesApi } from '../services/api';
import type { TradeSnapshot, SnapshotTimeframe } from '../types';
import { useYAxisZoom, applyYZoom } from '../hooks/useYAxisZoom';

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

// Candle index whose bar the event (entry/exit) actually happened
// DURING — by direct request ("Include a triangle on the specific
// candle to indicate the specific candle for either entry and also
// either SL or TP"). c.timestamp is each candle's OPEN time (standard
// OHLCV), so the right match is the LAST candle whose open is at or
// before the event — a floor-match, not "closest by absolute time
// distance": an event in the second half of its own candle's duration
// (e.g. 10 minutes into a 15M bar) is numerically CLOSER to the NEXT
// candle's open than to its own, so nearest-by-distance silently
// picked the following candle roughly half the time — a real,
// confirmed bug, by direct report ("the correct candles are ones just
// before what is currently indicated"), not a display preference.
// candles is sorted ascending by time (ccxt convention), so a single
// forward scan works; clamps to the first candle when the event
// predates every candle in the fetched window (shouldn't happen given
// the backend's own lookback buffer, but a last/first candle is a
// safer fallback than null).
function nearestCandleIndex(candles: { timestamp: string }[], iso: string | null): number | null {
  if (!iso || candles.length === 0) return null;
  const target = new Date(iso).getTime();
  let idx = 0;
  for (let i = 0; i < candles.length; i++) {
    if (new Date(candles[i].timestamp).getTime() <= target) idx = i;
    else break;
  }
  return idx;
}

function SnapshotChart({ snapshot, dark }: { snapshot: TradeSnapshot; dark: boolean }) {
  const { candles, entry_price, entry_timestamp, stop_loss, take_profit_1, take_profit_2, take_profit_3, exit_price, exit_timestamp, direction, trailing_active, trailing_stop_price } = snapshot;
  // Vertical (price) axis zoom — by direct request ("make the
  // vertical axis adjustable for all charts portal wide ... on
  // charts, snapshots and approval charts"). This component has no
  // CandleChart under it (its own hand-rolled SVG, same reasoning as
  // its own module docstring), so it owns this state directly rather
  // than going through CandleChart's priceRangeOverride prop.
  const { yZoom, zoomInY, zoomOutY, resetY } = useYAxisZoom();
  if (candles.length === 0) {
    return <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>No candle data for this window.</p>;
  }

  // Price range spans the candles AND every reference line, so a far
  // SL/TP outside the visible candle range still shows (clamped to
  // the chart edge) rather than being silently cut off.
  const refPrices = [entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, exit_price].filter((v): v is number => v != null);
  const allHighs = candles.map((c) => c.high);
  const allLows = candles.map((c) => c.low);
  const maxP = Math.max(...allHighs, ...refPrices);
  const minP = Math.min(...allLows, ...refPrices);
  const pad = (maxP - minP) * 0.08 || maxP * 0.01 || 1;
  const { yTop: yMax, yBottom: yMin } = applyYZoom(maxP + pad, minP - pad, yZoom);

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
  // TP2/TP3 — by direct report: a multi-target "4R target with BOS
  // trailing" trade's real exit landed well past TP1 with nothing on
  // the chart to explain why (it had actually run through TP2 and
  // closed exactly at TP3). Progressively darker green so "further
  // target" reads visually without a second legend system.
  if (take_profit_2 != null) refLines.push({ price: take_profit_2, color: '#059669', label: 'TP2' });
  if (take_profit_3 != null) refLines.push({ price: take_profit_3, color: '#047857', label: 'TP3' });
  // Trailing stop — once engaged, replaces the old static TP3
  // full-close for the runner leg. Same pattern as TP2/TP3 above.
  if (trailing_active && trailing_stop_price != null) refLines.push({ price: trailing_stop_price, color: '#f59e0b', label: 'Trail' });
  if (exit_price != null) refLines.push({ price: exit_price, color: exitColor, label: 'Exit' });

  // Entry/exit candle markers — a small triangle sitting just off the
  // candle's wick, pointing at it: upward (from below) at the entry
  // candle, downward (from above) at the exit candle (whichever of
  // SL/TP actually closed the trade) — by direct request.
  const entryIdx = nearestCandleIndex(candles, entry_timestamp);
  const exitIdx = nearestCandleIndex(candles, exit_timestamp);

  return (
    <div>
      {/* Vertical (price) axis zoom — by direct request ("make the
          vertical axis adjustable for all charts portal wide ... on
          charts, snapshots and approval charts"). Same icons/pattern
          as On Chart's own Y-axis zoom buttons. */}
      <div className={`flex items-center gap-1 mb-2 rounded-lg p-1 w-fit ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
        <span className={`text-[10px] font-semibold px-0.5 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Y</span>
        <button onClick={zoomOutY} disabled={yZoom <= 0.25} aria-label="Zoom out price axis" title="Zoom out price axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <ZoomOut size={14} />
        </button>
        <button onClick={zoomInY} disabled={yZoom >= 6} aria-label="Zoom in price axis" title="Zoom in price axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <ZoomIn size={14} />
        </button>
        <button onClick={resetY} disabled={yZoom === 1} aria-label="Reset price axis zoom" title="Reset price axis zoom" className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <Maximize2 size={12} /> Reset
        </button>
      </div>
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
          {/* Fixed margin strips, not anchored to the candle's own
              price — by direct follow-up request ("the triangle ...
              does not need to overlay the candle ... it can be placed
              in upper section of the chart or lower section ... it
              only needs to point at the correct candle"): anchoring to
              the candle's low/high could land the triangle directly
              on top of a neighboring candle's body/wick when price
              action is dense. Entry sits in a fixed strip near the
              bottom of the chart pointing up, exit near the top
              pointing down — X position (which candle) is still exact;
              only the Y position moved off the price action. A fast-
              closing trade (entry and exit on the same candle — a
              real, confirmed case, not a bug: a paper/test fill can
              close in well under one bar) still gets a small
              horizontal nudge apart so both stay visible. */}
          {entryIdx != null && (() => {
            const sameCandle = exitIdx === entryIdx;
            const x = toX(entryIdx) - (sameCandle ? 6 : 0);
            const base = h - 6;
            return <polygon points={`${x - 5},${base} ${x + 5},${base} ${x},${base - 8}`} fill={entryColor} />;
          })()}
          {exitIdx != null && (() => {
            const sameCandle = exitIdx === entryIdx;
            const x = toX(exitIdx) + (sameCandle ? 6 : 0);
            const base = 6;
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
                  {p.toFixed(4)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
        {refLines.map((r) => (
          <span key={r.label} className="flex items-center gap-1" style={{ color: r.color }}>
            <span className="w-3 h-0.5" style={{ background: r.color }} /> {r.label}: {r.price.toFixed(4)}
          </span>
        ))}
        <span className={`ml-auto ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          {direction.toUpperCase()} · {candles.length} candles
        </span>
      </div>
    </div>
  );
}
