import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { CandleChart, type Candle, type ChartLine } from './CandleChart';
import { formatSignedMoney, type ChartPosition } from './TradingViewChart';
import { orderFlowApi } from '../services/api';
import { formatApiError } from '../lib/apiError';

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
  onClose,
}: {
  position: ChartPosition;
  /** Exchange-format symbol, e.g. "BTCUSDT" — same format order_flow.py's /klines expects. */
  symbol: string;
  onClose: () => void;
}) {
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    setError(null);
    orderFlowApi.getKlines(symbol, '1h', 100)
      .then((res) => {
        if (cancelled) return;
        setCandles(res.candles.map((c) => ({ time: c.time_ms, open: c.open, high: c.high, low: c.low, close: c.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setError(formatApiError(detail, 'Live candle data isn\'t available for this symbol.'));
      });
    return () => { cancelled = true; };
  }, [symbol]);

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

  return (
    <div className="fixed inset-0 z-[210] bg-black/90 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold">{symbol} — price references on chart</span>
        <button onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white flex items-center gap-1.5 text-xs">
          <X size={16} /> Close
        </button>
      </div>
      <div className="flex-1 min-h-0 rounded-lg bg-[#0b1220] p-3 overflow-auto">
        {error ? (
          <div className="h-full flex items-center justify-center text-center text-white/70 text-sm px-6">{error}</div>
        ) : !candles ? (
          <div className="h-full flex items-center justify-center text-white/50 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading live candles…
          </div>
        ) : (
          <CandleChart candles={candles} lines={lines} height={520} dark />
        )}
      </div>
    </div>
  );
}
