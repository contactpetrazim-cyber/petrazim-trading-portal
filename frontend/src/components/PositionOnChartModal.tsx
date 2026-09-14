import { useEffect, useState } from 'react';
import { X, Loader2, RotateCcw } from 'lucide-react';
import { CandleChart, type Candle, type ChartLine } from './CandleChart';
import { formatSignedMoney, type ChartPosition } from './TradingViewChart';
import { orderFlowApi } from '../services/api';
import { formatApiError } from '../lib/apiError';

const KLINE_INTERVALS: { label: string; value: '15m' | '1h' | '4h' | '1d' }[] = [
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: 'D', value: '1d' },
];

/** Maps the main TradingView chart's own interval codes ("15", "60",
 * "240", "D", ...) to order_flow.py's ALLOWED_INTERVALS — so opening
 * "On Chart" defaults to whatever timeframe you were already looking
 * at, by direct request ("make the chart inherit the trade chart
 * colour, template and timeframe"). Falls back to '1h' for anything
 * this modal doesn't have a matching option for (1m/5m/weekly/etc). */
function mapTvIntervalToKlines(tv: string | undefined): '15m' | '1h' | '4h' | '1d' {
  switch (tv) {
    case '15': return '15m';
    case '60': return '1h';
    case '240': return '4h';
    case 'D': return '1d';
    default: return '1h';
  }
}

/**
 * PositionOnChartModal — the second "on chart" option for viewing a
 * position, alongside ChartPanel's folded Position info card, by
 * direct request ("an additional 'on chart' option that opens a
 * workspace chart that allows the price references for the position
 * to be drawn or embedded"). Unlike the embedded TradingView widget
 * (see TradingViewChart.tsx's docstring — its free tier has no JS API
 * to draw shapes at all), this renders the app's own hand-rolled
 * CandleChart, so Entry/SL/TP genuinely ARE drawn as real horizontal
 * lines on real candles here — this app owns every pixel of this
 * chart, unlike the third-party iframe.
 *
 * Inherits the calling chart's theme, candle colors, and timeframe
 * (dark/bullColor/bearColor/initialInterval below) rather than a
 * fixed always-dark look, and lets the timeframe be changed here too
 * — the honest, permanent version of "adjust like all other charts"
 * this free-tier setup can actually offer. A genuinely full-featured
 * chart (real drawing tools, zoom/pan, indicators) needs TradingView's
 * paid/licensed Charting Library — see this component's own tracking
 * note for that upgrade path; this stays the fallback if that license
 * isn't approved.
 *
 * HONEST SCOPE: the real candle data comes from order_flow.py's
 * `/klines` proxy, which only covers Binance's own small, explicit
 * crypto allow-list (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT,
 * DOGEUSDT — see that router's own ALLOWED_SYMBOLS comment.). A
 * position on any other symbol (every forex pair, for instance) has
 * no live candle source to draw on here yet, and this modal says so
 * plainly rather than showing an empty or fake chart.
 */
export function PositionOnChartModal({
  position,
  symbol,
  dark = true,
  bullColor,
  bearColor,
  initialInterval,
  onClose,
}: {
  position: ChartPosition;
  /** Exchange-format symbol, e.g. "BTCUSDT" — same format order_flow.py's /klines expects. */
  symbol: string;
  /** Matches the calling chart's current theme. Defaults to dark (this
   * modal's original look) for any caller that hasn't been updated to
   * pass its own theme yet. */
  dark?: boolean;
  /** The calling chart's own up/down candle colors (useCandleColors),
   * so the candles here match rather than always using the fixed
   * TradingView-default green/red. */
  bullColor?: string;
  bearColor?: string;
  /** The calling chart's current TradingView interval code ("15",
   * "60", "240", "D") — mapped to the nearest option here so this
   * chart opens already showing the same timeframe you were on. */
  initialInterval?: string;
  onClose: () => void;
}) {
  const [interval, setInterval] = useState<'15m' | '1h' | '4h' | '1d'>(mapTvIntervalToKlines(initialInterval));
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    setError(null);
    orderFlowApi.getKlines(symbol, interval, 100)
      .then((res) => {
        if (cancelled) return;
        setCandles(res.candles.map((c) => ({ time: c.time_ms, open: c.open, high: c.high, low: c.low, close: c.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setError(formatApiError(detail, 'Live candle data isn\'t available for this symbol right now.'));
      });
    return () => { cancelled = true; };
  }, [symbol, interval, retryTick]);

  const dirLabel = position.direction === 'long' ? 'LONG' : 'SHORT';
  const pnlLabel = position.pending
    ? 'Pending'
    : position.unrealizedPnl != null ? `P/L ${formatSignedMoney(position.unrealizedPnl)}` : '';
  const lines: ChartLine[] = [
    { price: position.entryPrice, color: '#2962FF', dashed: true, label: `Entry ${dirLabel} ${position.entryPrice}${pnlLabel ? ` (${pnlLabel})` : ''}` },
    ...(position.stopLoss != null ? [{ price: position.stopLoss, color: '#EF5350', dashed: true, label: `SL ${position.stopLoss}` }] : []),
    ...(position.takeProfit1 != null ? [{ price: position.takeProfit1, color: '#26A69A', dashed: true, label: `TP1 ${position.takeProfit1}` }] : []),
    ...(position.takeProfit2 != null ? [{ price: position.takeProfit2, color: '#26A69A', dashed: true, label: `TP2 ${position.takeProfit2}` }] : []),
    ...(position.takeProfit3 != null ? [{ price: position.takeProfit3, color: '#26A69A', dashed: true, label: `TP3 ${position.takeProfit3}` }] : []),
  ];

  const overlayCls = dark ? 'bg-black/90' : 'bg-white/95';
  const chromeTextCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const chromeMutedCls = dark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg';
  const paneCls = dark ? 'bg-[#0b1220]' : 'bg-corporate-bg';
  const pillIdleCls = dark ? 'text-white/50 hover:text-white bg-white/5' : 'text-gray-500 hover:text-corporate-text-on-bg bg-white';
  const pillActiveCls = 'bg-corporate-hero text-white';

  return (
    <div className={`fixed inset-0 z-[210] ${overlayCls} p-4 flex flex-col`}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className={`text-sm font-semibold ${chromeTextCls}`}>{symbol} — price references on chart</span>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full p-1">
            {KLINE_INTERVALS.map((i) => (
              <button
                key={i.value}
                onClick={() => setInterval(i.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${interval === i.value ? pillActiveCls : pillIdleCls}`}
              >
                {i.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label="Close" className={`flex items-center gap-1.5 text-xs ${chromeMutedCls}`}>
            <X size={16} /> Close
          </button>
        </div>
      </div>
      <div className={`flex-1 min-h-0 rounded-lg ${paneCls} p-3 overflow-auto`}>
        {error ? (
          <div className={`h-full flex flex-col items-center justify-center text-center gap-3 text-sm px-6 ${dark ? 'text-white/70' : 'text-gray-500'}`}>
            <span>{error}</span>
            <button
              onClick={() => setRetryTick((t) => t + 1)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-corporate-bg text-corporate-hero hover:bg-[#dcdce8]'}`}
            >
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        ) : !candles ? (
          <div className={`h-full flex items-center justify-center gap-2 text-sm ${dark ? 'text-white/50' : 'text-gray-400'}`}>
            <Loader2 size={16} className="animate-spin" /> Loading live candles…
          </div>
        ) : (
          <CandleChart candles={candles} lines={lines} height={520} dark={dark} bullColor={bullColor} bearColor={bearColor} />
        )}
      </div>
    </div>
  );
}
