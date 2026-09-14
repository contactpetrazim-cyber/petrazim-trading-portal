import { useEffect, useState } from 'react';
import { X, Loader2, RotateCcw, Sun, Moon, Palette, Target } from 'lucide-react';
import { CandleChart, type Candle, type ChartLine } from './CandleChart';
import { formatSignedMoney, type ChartPosition } from './TradingViewChart';
import { PositionManager } from './PositionManager';
import { orderFlowApi } from '../services/api';
import { formatApiError } from '../lib/apiError';
import { useQuickPrice } from '../hooks/useQuickPrice';
import type { Trade } from '../types';

const LIVE_PRICE_REFRESH_MS = 15_000;

type KlineInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

// Matches order_flow.py's own ALLOWED_INTERVALS exactly — by direct
// request ("add additional timeframes"). Was 15m/1H/4H/D only; Binance's
// public klines endpoint genuinely supports every one of these, so this
// widens the backend allow-list too rather than just the buttons here.
const KLINE_INTERVALS: { label: string; value: KlineInterval }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: 'D', value: '1d' },
  { label: 'W', value: '1w' },
];

/** Maps the main TradingView chart's own interval codes ("1", "5",
 * "15", "30", "60", "240", "D", "W", ...) to order_flow.py's
 * ALLOWED_INTERVALS — so opening "On Chart" defaults to whatever
 * timeframe you were already looking at, by direct request ("make the
 * chart inherit the trade chart colour, template and timeframe").
 * Falls back to '1h' for anything this modal doesn't have a matching
 * option for. */
function mapTvIntervalToKlines(tv: string | undefined): KlineInterval {
  switch (tv) {
    case '1': return '1m';
    case '5': return '5m';
    case '15': return '15m';
    case '30': return '30m';
    case '60': return '1h';
    case '240': return '4h';
    case 'D': return '1d';
    case 'W': return '1w';
    default: return '1h';
  }
}

// A handful of standard up/down schemes, same idea as
// CandleColorPicker's own PRESETS — kept as this modal's own small
// copy rather than reusing that component directly: CandleColorPicker
// also offers a chart TYPE row (Hollow Candles, Heikin Ashi, Bars,
// Line, Area, Baseline) for the TradingView widget's own override
// system, which this hand-rolled CandleChart has no way to honor —
// it only ever draws classic filled candlesticks (see CandleChart's
// own docstring: "no zoom/pan/crosshair", nothing about alternate
// series styles either). Offering that row here would be exactly the
// "never show broken markup" mistake this codebase repeatedly fixes
// elsewhere — a control that visibly does nothing when touched.
const COLOR_PRESETS: { label: string; up: string; down: string }[] = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'TradingView', up: '#26a69a', down: '#ef5350' },
  { label: 'Binance', up: '#f0b90b', down: '#1e2329' },
  { label: 'Monochrome', up: '#e5e7eb', down: '#4b5563' },
];

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
 * (dark/bullColor/bearColor/initialInterval below) as its OWN starting
 * point rather than a fixed always-dark look — but, by further direct
 * request ("add ability to change candle colour on the chart ... also
 * provide a light vs dark toggle"), every one of those is then a real,
 * independently-changeable control right here too (localDark/
 * localBull/localBearColor below), not just a one-time inherited
 * value: this modal's own light/dark toggle and color picker change
 * ONLY this view, same "local, not written back to the shared
 * preference" contract CandleColorPicker's own "This chart only" scope
 * already uses elsewhere — closing and reopening this modal reverts to
 * the calling chart's own colors/theme again, on purpose. The
 * timeframe row was already changeable before this; it's just wider
 * now (see KLINE_INTERVALS above). Defaults to LIGHT regardless of
 * what the calling chart was showing, by further direct instruction
 * ("default is light chart") — candle colors still start from the
 * caller's own, only the theme default was pinned.
 *
 * A "Position" toggle (only rendered when `trade` is passed) drops in
 * the exact same PositionManager card ChartPanel's own folded Position
 * view and the Trade Management list already use — by direct request
 * ("in addition to seeing the entry, SL and TP levels ... you can edit
 * or manage your trade orders in that chart and see it render or
 * update after refresh"). One implementation, not a second one: same
 * edit-targets/partial-close/cancel logic, same `onChanged` contract —
 * an edit here calls the SAME refresh the caller's own Position card
 * already uses (ChartPanel's onPositionChanged / TradingViewFramePage's
 * loadOpenPosition), so once that refetch lands a fresh `position` prop,
 * the horizontal lines drawn below update to match with no extra
 * plumbing — this modal never caches its own separate copy of the
 * trade's SL/TP.
 *
 * A genuinely full-featured chart (real drawing tools, zoom/pan,
 * indicators) needs TradingView's paid/licensed Charting Library — see
 * this component's own tracking note for that upgrade path; this stays
 * the fallback if that license isn't approved.
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
  trade,
  symbol,
  bullColor,
  bearColor,
  initialInterval,
  onClose,
  onChanged,
}: {
  /** Omit entirely to open "On Chart" with no open/pending order on
   * this symbol — by direct request ("make 'Position' and 'On Chart'
   * a permanent feature on all charts ... you can always click on it
   * to review order position"): candles still render, just with no
   * Entry/SL/TP lines (only the live-price line, if any). */
  position?: ChartPosition;
  /** The full Trade row — needed only to power the "Position" toggle's
   * real edit/cancel/partial-close card. Omit on a caller that has no
   * such record to hand (or pass the same one `position` was derived
   * from via tradeToChartPosition) and the Position button simply
   * doesn't render, same as ChartPanel's own Position/On Chart toggles
   * already do when there's no trade to manage. */
  trade?: Trade | null;
  /** Exchange-format symbol, e.g. "BTCUSDT" — same format order_flow.py's /klines expects. */
  symbol: string;
  /** The calling chart's own up/down candle colors (useCandleColors),
   * so the candles here match rather than always using the fixed
   * TradingView-default green/red. Theme itself always starts light
   * regardless of the caller — see this component's own docstring. */
  bullColor?: string;
  bearColor?: string;
  /** The calling chart's current TradingView interval code ("15",
   * "60", "240", "D") — mapped to the nearest option here so this
   * chart opens already showing the same timeframe you were on. */
  initialInterval?: string;
  onClose: () => void;
  /** Forwarded straight to the embedded PositionManager's own
   * `onChanged` — call the SAME refresh the caller's own Position card
   * already uses, so an edit made here is reflected everywhere,
   * including the lines drawn on this very chart once the caller's
   * refreshed `position` prop flows back down. */
  onChanged?: () => void;
}) {
  const [interval, setInterval] = useState<KlineInterval>(mapTvIntervalToKlines(initialInterval));
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [positionOpen, setPositionOpen] = useState(false);

  // Local-only theme/color overrides. Theme defaults to light always
  // (by direct instruction), independent of whatever the calling chart
  // was showing; candle colors still start from the caller's own.
  const [localDark, setLocalDark] = useState(false);
  const [localBull, setLocalBull] = useState(bullColor ?? '#22c55e');
  const [localBear, setLocalBear] = useState(bearColor ?? '#ef4444');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Live "where is price right now" line — the candles above only
  // update on the next full refetch, so without this the chart can
  // sit visibly stale (last candle's close) even while the real
  // market has moved on. Reuses the same quick-price lookup the order
  // ticket itself uses, not a second implementation.
  const { price: livePrice, refresh: refreshLivePrice } = useQuickPrice(symbol);
  useEffect(() => {
    refreshLivePrice({ silent: true });
    const t = window.setInterval(() => refreshLivePrice({ silent: true }), LIVE_PRICE_REFRESH_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

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

  const dirLabel = position?.direction === 'long' ? 'LONG' : 'SHORT';
  const pnlLabel = position?.pending
    ? 'Pending'
    : position?.unrealizedPnl != null ? `P/L ${formatSignedMoney(position.unrealizedPnl)}` : '';
  const lines: ChartLine[] = [
    ...(position ? [{ price: position.entryPrice, color: '#2962FF', dashed: true, label: `Entry ${dirLabel} ${position.entryPrice}${pnlLabel ? ` (${pnlLabel})` : ''}` }] : []),
    ...(position?.stopLoss != null ? [{ price: position.stopLoss, color: '#EF5350', dashed: true, label: `SL ${position.stopLoss}` }] : []),
    ...(position?.takeProfit1 != null ? [{ price: position.takeProfit1, color: '#26A69A', dashed: true, label: `TP1 ${position.takeProfit1}` }] : []),
    ...(position?.takeProfit2 != null ? [{ price: position.takeProfit2, color: '#26A69A', dashed: true, label: `TP2 ${position.takeProfit2}` }] : []),
    ...(position?.takeProfit3 != null ? [{ price: position.takeProfit3, color: '#26A69A', dashed: true, label: `TP3 ${position.takeProfit3}` }] : []),
    // Solid (not dashed) and a distinct amber, so it's unmistakably
    // "where price is right this second" versus the dashed reference
    // levels above — refreshes every 15s while this stays open.
    ...(livePrice != null ? [{ price: livePrice, color: '#f59e0b', dashed: false, label: `Live ${livePrice}` }] : []),
  ];

  const overlayCls = localDark ? 'bg-black/90' : 'bg-white/95';
  const chromeTextCls = localDark ? 'text-white' : 'text-corporate-text-on-bg';
  const chromeMutedCls = localDark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg';
  const paneCls = localDark ? 'bg-[#0b1220]' : 'bg-corporate-bg';
  const pillIdleCls = localDark ? 'text-white/50 hover:text-white bg-white/5' : 'text-gray-500 hover:text-corporate-text-on-bg bg-white';
  const pillActiveCls = 'bg-corporate-hero text-white';
  const toggleWrapCls = localDark ? 'bg-white/5' : 'bg-black/5';
  const popoverCls = localDark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200';

  return (
    <div className={`fixed inset-0 z-[210] ${overlayCls} p-4 flex flex-col`}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className={`text-sm font-semibold ${chromeTextCls}`}>
          {symbol} — {position ? 'price references on chart' : 'no open or pending order on this symbol'}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
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
          {/* Local light/dark toggle — by direct request ("provide a
              light vs dark toggle"). Only ever affects this modal; the
              calling chart's own theme is untouched. */}
          <div className={`flex items-center gap-1 rounded-lg p-1 ${toggleWrapCls}`}>
            <button
              onClick={() => setLocalDark(false)}
              aria-label="Light chart"
              className={`p-1.5 rounded-md ${!localDark ? 'bg-black/10 text-corporate-text-on-bg' : chromeMutedCls}`}
            >
              <Sun size={13} />
            </button>
            <button
              onClick={() => setLocalDark(true)}
              aria-label="Dark chart"
              className={`p-1.5 rounded-md ${localDark ? 'bg-white/20 text-white' : chromeMutedCls}`}
            >
              <Moon size={13} />
            </button>
          </div>
          {/* "Position" — edit/cancel/partial-close this trade right
              here, by direct request ("in addition to seeing the entry,
              SL and TP levels ... you can edit or manage your trade
              orders in that chart"). Only rendered when a full Trade
              record was actually handed to this modal (see `trade`'s
              own docstring above). */}
          {trade && (
            <button
              onClick={() => setPositionOpen((o) => !o)}
              aria-label={positionOpen ? 'Hide position management' : 'Manage this position'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${positionOpen ? 'bg-corporate-hero text-white' : `${chromeMutedCls} ${toggleWrapCls}`}`}
            >
              <Target size={13} /> Position
            </button>
          )}
          {/* Local candle color picker — by direct request ("add
              ability to change candle colour on the chart"). No chart
              TYPE row here on purpose — see COLOR_PRESETS' own comment
              on why (CandleChart can't honor one). */}
          <div className="relative">
            <button
              onClick={() => setColorPickerOpen((o) => !o)}
              aria-label="Candle colors"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${colorPickerOpen ? 'bg-corporate-hero text-white' : `${chromeMutedCls} ${toggleWrapCls}`}`}
            >
              <Palette size={13} /> Colors
            </button>
            {colorPickerOpen && (
              <div className={`absolute right-0 top-full mt-2 z-10 w-60 rounded-xl border p-3 space-y-2.5 shadow-lg ${popoverCls}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setLocalBull(p.up); setLocalBear(p.down); }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium ${localDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-gray-700'}`}
                    >
                      <span className="flex gap-0.5 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.up }} />
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.down }} />
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className={`flex items-center gap-1.5 text-[11px] font-medium ${localDark ? 'text-white/60' : 'text-gray-500'}`}>
                    <input type="color" value={localBull} onChange={(e) => setLocalBull(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                    Up
                  </label>
                  <label className={`flex items-center gap-1.5 text-[11px] font-medium ${localDark ? 'text-white/60' : 'text-gray-500'}`}>
                    <input type="color" value={localBear} onChange={(e) => setLocalBear(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                    Down
                  </label>
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className={`flex items-center gap-1.5 text-xs ${chromeMutedCls}`}>
            <X size={16} /> Close
          </button>
        </div>
      </div>
      {positionOpen && trade && (
        <div className="mb-3">
          <PositionManager trade={trade} dark={localDark} onChanged={onChanged} />
        </div>
      )}
      <div className={`flex-1 min-h-0 rounded-lg ${paneCls} p-3 overflow-auto`}>
        {error ? (
          <div className={`h-full flex flex-col items-center justify-center text-center gap-3 text-sm px-6 ${localDark ? 'text-white/70' : 'text-gray-500'}`}>
            <span>{error}</span>
            <button
              onClick={() => setRetryTick((t) => t + 1)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${localDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-corporate-bg text-corporate-hero hover:bg-[#dcdce8]'}`}
            >
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        ) : !candles ? (
          <div className={`h-full flex items-center justify-center gap-2 text-sm ${localDark ? 'text-white/50' : 'text-gray-400'}`}>
            <Loader2 size={16} className="animate-spin" /> Loading live candles…
          </div>
        ) : (
          <CandleChart candles={candles} lines={lines} height={520} dark={localDark} bullColor={localBull} bearColor={localBear} />
        )}
      </div>
    </div>
  );
}
