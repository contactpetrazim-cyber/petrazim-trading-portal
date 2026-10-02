import { useEffect, useState } from 'react';
import { X, Clock3 } from 'lucide-react';
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
      </div>
    </div>
  );
}

function SnapshotChart({ snapshot, dark }: { snapshot: TradeSnapshot; dark: boolean }) {
  const { candles, entry_price, stop_loss, take_profit_1, exit_price, direction } = snapshot;
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

  const w = Math.max(400, candles.length * 8);
  const h = 260;
  const candleW = (w / candles.length) * 0.65;
  const toY = (price: number) => h - ((price - yMin) / (yMax - yMin)) * h;
  const toX = (i: number) => (i + 0.5) * (w / candles.length);

  const refLines: { price: number; color: string; label: string; dash?: string }[] = [];
  if (entry_price != null) refLines.push({ price: entry_price, color: dark ? '#60a5fa' : '#005FB8', label: 'Entry' });
  refLines.push({ price: stop_loss, color: RED, label: 'SL', dash: '4 3' });
  if (take_profit_1 != null) refLines.push({ price: take_profit_1, color: GREEN, label: 'TP1', dash: '4 3' });
  if (exit_price != null) refLines.push({ price: exit_price, color: '#f59e0b', label: 'Exit' });

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
              <line x1={0} y1={toY(r.price)} x2={w} y2={toY(r.price)} stroke={r.color} strokeWidth={1} strokeDasharray={r.dash} opacity={0.8} />
            </g>
          ))}
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
