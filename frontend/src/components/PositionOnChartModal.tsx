import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, RotateCcw, Sun, Moon, Palette, Target, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Crosshair, TrendingUp, PenLine, Square, Eraser, Zap, CandlestickChart } from 'lucide-react';
import { CandleChart, CHART_LAYOUT, computeChartRange, type Candle, type ChartLine, type ChartZone, type OverlaySeries, type DrawnSegment } from './CandleChart';
import { formatSignedMoney, type ChartPosition } from './TradingViewChart';
import { PositionManager } from './PositionManager';
import { PairsPanel } from './PairsPanel';
import { useQuickPairsStore } from '../hooks/useQuickPairs';
import { orderFlowApi } from '../services/api';
import { formatApiError } from '../lib/apiError';
import { useQuickPrice } from '../hooks/useQuickPrice';
import type { Trade } from '../types';

const LIVE_PRICE_REFRESH_MS = 15_000;

// Mirrors order_flow.py's own ALLOWED_SYMBOLS exactly — this chart's
// candles come from that endpoint alone (a small, fixed Binance
// allow-list), unlike the TradingView-backed main charts elsewhere in
// the app that can show forex/indices/stocks too. Passed as Pairs'
// `symbolFilter` so switching pairs here only ever offers instruments
// this chart can actually render, instead of a pick that immediately
// errors with "Unsupported symbol". Strips a trailing ".P" (Binance
// perpetual futures, same suffix convention as the main chart) before
// checking, matching that endpoint's own _resolve_market.
const ONCHART_ALLOWED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
function isOnChartSupportedSymbol(tradeSymbol: string): boolean {
  const base = tradeSymbol.toUpperCase().endsWith('.P') ? tradeSymbol.slice(0, -2).toUpperCase() : tradeSymbol.toUpperCase();
  return ONCHART_ALLOWED_SYMBOLS.includes(base);
}

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
  // Standard Monochrome keeps its original, purest grayscale pairing —
  // by direct follow-up request ("add another monochrome selection
  // that is different from standard ... so there will be two
  // monochrome selections: Standard / Optimised for on chart"), after
  // an earlier attempt just overwrote these values outright (by
  // direct bug report: "the up candles are not visible"). That fix is
  // real, it just belongs as a SECOND, separate choice rather than
  // replacing this one — some traders may genuinely want the subtler
  // standard look and accept the lower up-candle contrast.
  { label: 'Monochrome (Standard)', up: '#e5e7eb', down: '#4b5563' },
  // The same grayscale identity, just dark enough on the up side to
  // actually read as a candle against the chart's light pane (gray-400
  // instead of near-white gray-200); down moves to slate-700 to keep
  // clear contrast between the two.
  { label: 'Monochrome (Optimised)', up: '#94a3b8', down: '#334155' },
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
 * Zoom (fewer/more candles visible) and pan (scroll back through
 * history, up to the POOL_SIZE-candle fetch) work both as +/-/‹/›
 * toolbar buttons AND as real click-drag/touch-drag/pinch/wheel
 * gestures side by side — by direct request ("add feature to ...
 * zoom in or out", then "keep the tap/click buttons ... work on
 * [the hands-on feel] additional[ly]"). By further direct request
 * ("add drawing tools and other standard charting tools"), a
 * crosshair + OHLC readout, SMA(20)/SMA(50) overlays, and drawn
 * shapes — trend lines, and (by further direct request, "include a
 * drawing tool for boxes - the box tool") boxes, picked from their
 * own small tool row, persisted per symbol in localStorage — are real
 * too — see the toolbar row above the chart pane and pixelToChartLive
 * below. SCOPE, stated plainly: no Fibonacci/text annotations/other
 * shapes, no per-shape selection/recolor (Clear removes every drawn
 * line/box on a symbol at once), no live server-side indicators
 * beyond the two SMAs computed client-side here. A
 * genuinely full-featured chart (that full toolset, plus multi-chart
 * layouts, saved templates) still needs TradingView's paid/licensed
 * Charting Library — see this component's own tracking note for that
 * upgrade path; this stays the fallback if that license isn't
 * approved.
 *
 * QUICK TRADE — a real Long/Short position tool, by direct request
 * ("the quick trade button from the short position or long position
 * tradingview tool ... integrate this with my order position form so
 * that the entry level, SL and TP are automatically populated").
 * TradingView's own Long/Short Position drawing tool lives INSIDE its
 * free embedded widget's iframe (TradingViewChart.tsx), which — same
 * honest limitation already documented there and on ManualTradingPage's
 * own Exits section — exposes no JS API to read back what's dragged on
 * it; that tool's Entry/SL/TP/Amount can never be read out of the free
 * embed into this app's own state, only TradingView's separately
 * licensed Charting Library could do that. This is the real, buildable
 * equivalent: drag on THIS app's own chart (which this app has full
 * pixel and event access to) from an entry price to a stop price — the
 * drag direction sets LONG vs SHORT (dragging down = stop below entry
 * = long, same convention as TradingView's own tool), a take-profit is
 * computed at a chosen risk:reward multiple, and a confirm card lets
 * you adjust R:R before handing the three prices straight to the
 * caller's order form via `onQuickTrade` — no retyping.
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
  onQuickTrade,
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
  /** Wire this to your own order form's setters (direction/entry/SL/TP)
   * to enable the "Quick Trade" drag tool in the toolbar below — see
   * this component's own QUICK TRADE docstring above. Omitted (as on
   * every read-only chart page with no order form to feed) and the
   * tool button simply doesn't render, same convention as ChartPanel's
   * own optional onQuickFill/onToggleOrderForm. Called once, when the
   * trader taps "Use in Order Ticket" on the confirm card — this
   * modal then closes itself so they land back on the now-filled form. */
  onQuickTrade?: (trade: { direction: 'long' | 'short'; entryPrice: number; stopLoss: number; takeProfit: number }) => void;
}) {
  const [interval, setInterval] = useState<KlineInterval>(mapTvIntervalToKlines(initialInterval));
  // The symbol actually being CHARTED — starts as the caller's own
  // `symbol` (the position's instrument) but can be pointed at any
  // other pair via the "Pairs" quick-selector below, by direct request
  // ("include the quick 'Pairs' in the 'on Chart' - so that there
  // could be a quick selection of charts on that page"). Deliberately
  // separate from `symbol` itself: `position`/`trade` (and everything
  // derived from them — the Entry/SL/TP lines, the Position card, the
  // Quick Trade tool) only ever describe the ORIGINAL `symbol`, so
  // those stay gated on `activeSymbol === symbol` throughout this file
  // rather than silently relabeling a different instrument's chart
  // with this position's own levels.
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const isOriginalSymbol = activeSymbol === symbol;
  const [pairsOpen, setPairsOpen] = useState(false);
  // The full fetched pool — up to POOL_SIZE candles, most-recent last
  // (order_flow.py's /klines already returns oldest-to-newest). `zoom`/
  // `pan` below slice a WINDOW out of this pool; nothing here refetches
  // on zoom/pan, only on a real symbol/interval/retry change.
  const [allCandles, setAllCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [positionOpen, setPositionOpen] = useState(false);

  // Resize/scroll/zoom — by direct request ("add feature to resize or
  // move the chart or scroll to the left or down or increase or
  // decrease scale ... or zoom in or out"). `visibleCount` is how many
  // candles are shown at once (zoom level — fewer = zoomed in, more =
  // zoomed out); `panOffset` is how many candles back from the most
  // recent one the visible window's right edge sits (0 = live edge,
  // larger = further back in history). Started as plain +/-/‹/›
  // buttons only; by further direct follow-up ("keep the tap/click
  // buttons ... work on [the hands-on feel] additional[ly]") real
  // click-drag (mouse) / touch-drag (finger) panning and two-finger
  // pinch-to-zoom now sit ALONGSIDE the buttons — see the pointer
  // handlers below and their own attachment point near the chart pane
  // — neither replaces the other; whichever's more convenient works.
  const POOL_SIZE = 300;
  const DEFAULT_VISIBLE = 60;
  const MIN_VISIBLE = 15;
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const [panOffset, setPanOffset] = useState(0);
  const maxPanOffset = Math.max(0, (allCandles?.length ?? 0) - visibleCount);
  // `visibleStart` — the index into the STABLE `allCandles` pool where
  // the current visible window begins. Exposed (not just used inline)
  // because drawings/crosshair below anchor to `allCandles`-relative
  // index specifically so they stay attached to their real candle as
  // you pan/zoom (only `visibleStart`/`visibleCount` change on pan/
  // zoom — `allCandles` itself doesn't, so an index into IT is stable
  // in a way an index into the shifting visible slice isn't).
  const visibleStart = allCandles ? Math.max(0, Math.max(0, allCandles.length - panOffset) - visibleCount) : 0;
  const candles = useMemo(() => {
    if (!allCandles) return null;
    const end = Math.max(0, allCandles.length - panOffset);
    const start = Math.max(0, end - visibleCount);
    return allCandles.slice(start, end);
  }, [allCandles, visibleCount, panOffset]);
  function zoomIn() { setVisibleCount((v) => Math.max(MIN_VISIBLE, Math.round(v * 0.7))); }
  function zoomOut() { setVisibleCount((v) => Math.min(allCandles?.length ?? POOL_SIZE, Math.round(v * 1.4))); }
  function panOlder() { setPanOffset((p) => Math.min(maxPanOffset, p + Math.max(1, Math.round(visibleCount * 0.5)))); }
  function panNewer() { setPanOffset((p) => Math.max(0, p - Math.max(1, Math.round(visibleCount * 0.5)))); }
  function resetView() { setVisibleCount(DEFAULT_VISIBLE); setPanOffset(0); }

  const CHART_HEIGHT = 520;
  // Click-drag / touch-drag pan + two-finger pinch-zoom, attached to
  // the chart pane below via ref (native listeners, not React's
  // onWheel/onTouch* — React attaches those as passive at the root for
  // scroll performance, which silently blocks preventDefault() on
  // exactly the wheel/touch events this needs to intercept). Pointer
  // Events (not separate mouse/touch handlers) so one code path covers
  // mouse-drag and single-finger touch-drag identically; a second
  // simultaneous pointer switches the SAME gesture to pinch. Refs, not
  // state, for the moment-to-moment pointer bookkeeping — this fires
  // on every pixel of movement, and only the derived visibleCount/
  // panOffset actually need to be React state (they're what's drawn).
  const chartPaneRef = useRef<HTMLDivElement>(null);
  // Tight wrapper directly around <CandleChart> only (no padding) —
  // used for pixel<->chart conversion (crosshair, drawing) so it lines
  // up exactly with what CandleChart renders; chartPaneRef above has
  // its own p-3 padding around that, which would throw the math off.
  const chartBoxRef = useRef<HTMLDivElement>(null);
  // The Quick Trade confirm card sits inside chartPaneRef's own
  // pointer-tracked subtree — checked at the top of onPointerDown
  // below so a click on its buttons/R:R selector can never be
  // misread as starting a new drag on the chart underneath it. A
  // plain onPointerDown-stopPropagation on the card itself is NOT
  // enough: chartPaneRef's listener is a native addEventListener on
  // an ANCESTOR closer to the target than React's own root-level
  // event delegation, so it already runs before a React synthetic
  // handler further down ever gets the chance to stop it — confirmed
  // live (clicking "Use in Order Ticket" was re-armed as a chart
  // drag instead of cleanly confirming).
  const quickTradeCardRef = useRef<HTMLDivElement>(null);
  // Same reasoning as quickTradeCardRef — the right-margin drag
  // handle also sits inside chartPaneRef's own pointer-tracked
  // subtree, so its own pointerdown needs the same exclusion or
  // grabbing it would ALSO start a pan/draw/quick-trade gesture on
  // the chart underneath at the same time.
  const rightMarginHandleRef = useRef<HTMLDivElement>(null);

  // Drawing tool — by direct request ("add drawing tools ... to this
  // chart"). Segments are anchored to `allCandles`-relative (absolute)
  // index/price pairs — same reasoning as `visibleStart` above — and
  // only converted to visible-relative right before being handed to
  // CandleChart (see `visibleDrawings` below). Persisted per-symbol in
  // localStorage (survives closing/reopening this modal); every
  // read/write is wrapped since storage can fail (private browsing,
  // quota) without that being a reason to break the feature.
  // `null` = not drawing (pan/pinch/wheel active as normal); 'line' or
  // 'box' = which shape the next drag creates — by direct follow-up
  // request ("include a drawing tool for boxes - the box tool"), a
  // second shape alongside the original trend-line tool, picked from
  // its own small tool row (see the toolbar below) rather than a
  // single on/off toggle. 'position' is the Quick Trade Long/Short
  // tool below — a third mode, not persisted into `drawings` (see
  // this component's own QUICK TRADE docstring).
  const [drawShape, setDrawShape] = useState<'line' | 'box' | 'position' | null>(null);
  const [drawings, setDrawings] = useState<DrawnSegment[]>([]);
  const [inProgressDraw, setInProgressDraw] = useState<DrawnSegment | null>(null);
  // Switching pairs mid-draw would leave an active tool pointed at
  // candles that just got replaced out from under it — clear the
  // active tool and fold the Position card on every symbol change
  // (including switching back to the original one, which starts
  // clean too). quickTradeDraft is deliberately NOT reset here
  // anymore — see its own declaration below for why.
  useEffect(() => {
    setDrawShape(null);
    setInProgressDraw(null);
    setPositionOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);

  // Quick Trade — see this component's own QUICK TRADE docstring.
  // `quickTradeDraft` is the live (while dragging) or final (after
  // pointer-up, awaiting confirm) Entry/SL/TP; entryIndex is stored
  // absolute (allCandles-relative, same convention as `drawings`) so
  // the risk/reward zones stay anchored to the real entry candle
  // across pan/zoom, converted to visible-relative only at render
  // time (see quickTradeZones below).
  //
  // Persisted to localStorage per symbol, same pattern `drawings`
  // below already uses — by direct bug report ("the [tool/lines] to
  // stay on the 'On Chart' after closing the quick trade tool - just
  // like box stays on the chart after unlocking the box tool"). This
  // USED to be deliberately unpersisted ("a one-shot order proposal,
  // not a chart annotation to keep around") — but On Chart's modal
  // fully UNMOUNTS on close (it's conditionally rendered, not just
  // hidden — see ChartPanel.tsx's
  // `{onChartOpen && ... && <PositionOnChartModal />}`), which was
  // silently discarding an in-progress draft and its drawn preview
  // lines the instant the modal closed. A drawn box never had this
  // problem because it's the one thing here that was already
  // localStorage-backed. Root cause was that mismatch — not a bug in
  // drawShape itself, which behaves identically for the Quick Trade,
  // Line and Box tools (none of them stay "selected" across a
  // remount; only a drawn box's own OUTPUT does, and now a Quick
  // Trade draft's does too).
  const quickTradeStorageKey = `petrazim.chartQuickTrade.${activeSymbol}`;
  const [quickTradeDraft, setQuickTradeDraft] = useState<{
    entryIndex: number; entryPrice: number; stopLoss: number; takeProfit: number; direction: 'long' | 'short';
  } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(quickTradeStorageKey);
      setQuickTradeDraft(raw ? JSON.parse(raw) : null);
    } catch { setQuickTradeDraft(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);
  useEffect(() => {
    try {
      if (quickTradeDraft) localStorage.setItem(quickTradeStorageKey, JSON.stringify(quickTradeDraft));
      else localStorage.removeItem(quickTradeStorageKey);
    } catch { /* not fatal — just won't persist */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickTradeDraft, activeSymbol]);
  const [quickTradeRR, setQuickTradeRR] = useState(2);
  // Free-typed R:R, alongside the preset buttons — by direct request
  // ("Add 4R and 5R to the quick trade - Don't stop at 3R ... can we
  // put a free form RR that I can type specific RR"). Kept as its own
  // string (not derived from quickTradeRR on every render) so a
  // partial value mid-typing — "4." on the way to "4.5" — isn't
  // reformatted out from under the trader on every keystroke; only a
  // successfully-parsed positive number ever calls applyQuickTradeRR.
  const [customRRText, setCustomRRText] = useState('');

  function computeQuickTradeDraft(entryIndex: number, entryPrice: number, dragPrice: number, rr: number) {
    const direction: 'long' | 'short' = dragPrice < entryPrice ? 'long' : 'short';
    const stopLoss = dragPrice;
    const risk = Math.abs(entryPrice - stopLoss);
    const takeProfit = direction === 'long' ? entryPrice + risk * rr : entryPrice - risk * rr;
    return { entryIndex, entryPrice, stopLoss, takeProfit, direction };
  }

  /** Same magnitude-based precision CandleChart's own price axis uses
   * (fmt), kept as a small local copy since that one isn't exported —
   * just for the confirm card's numbers reading sensibly for both a
   * ~1.08 forex pair and a ~65000 crypto pair. */
  function formatQuickTradePrice(p: number): string {
    return p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(4);
  }

  function togglePositionTool() {
    setDrawShape((v) => (v === 'position' ? null : 'position'));
    setQuickTradeDraft(null);
    setCustomRRText('');
  }

  /** Recompute takeProfit only, keeping entry/stopLoss/direction fixed
   * — the confirm card's R:R buttons use this so bumping 1R -> 2R
   * doesn't require redragging. */
  function applyQuickTradeRR(rr: number) {
    setQuickTradeRR(rr);
    setQuickTradeDraft((d) => {
      if (!d) return d;
      const risk = Math.abs(d.entryPrice - d.stopLoss);
      const takeProfit = d.direction === 'long' ? d.entryPrice + risk * rr : d.entryPrice - risk * rr;
      return { ...d, takeProfit };
    });
  }
  const drawStorageKey = `petrazim.chartDrawings.${activeSymbol}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(drawStorageKey);
      setDrawings(raw ? JSON.parse(raw) : []);
    } catch { setDrawings([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);
  useEffect(() => {
    try { localStorage.setItem(drawStorageKey, JSON.stringify(drawings)); } catch { /* not fatal — just won't persist */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings, activeSymbol]);
  function clearDrawings() { setDrawings([]); }

  // Crosshair — by direct request ("add ... other standard charting
  // tools"). Relative to the CURRENTLY VISIBLE `candles` — unlike
  // drawings, a hover position is instantaneous and never needs to
  // survive a pan/zoom, so there's no reason to route it through the
  // heavier absolute-index scheme those use.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Moving average overlay — by direct request. Computed from the
  // STABLE allCandles pool (needs real lookback beyond just what's
  // currently visible to be accurate near the left edge of the
  // visible window), then sliced to match it — see `maSeries` below.
  const [showMA, setShowMA] = useState(false);

  // Always holds the LATEST visibleCount/panOffset/visibleStart AND
  // the candle count/price range CandleChart is CURRENTLY drawing
  // against — the gesture effect below intentionally does not re-run
  // when any of these change (re-running it mid-gesture would freeze
  // whatever drag/draw was in progress — same class of bug documented
  // on the effect's own dependency array), so pixelToChartLive (used
  // for BOTH the crosshair and drawing pixel math) reads this ref at
  // call time instead of closing over stale values from whenever the
  // effect last (re-)attached.
  const liveRef = useRef({ visibleCount, panOffset, visibleStart, candlesLength: 0, yTop: 0, yBottom: 0, rr: quickTradeRR });
  useEffect(() => {
    const range = candles && candles.length > 0 ? computeChartRange(candles, [], lines, []) : { yTop: 0, yBottom: 0 };
    liveRef.current = { visibleCount, panOffset, visibleStart, candlesLength: candles?.length ?? 0, yTop: range.yTop, yBottom: range.yBottom, rr: quickTradeRR };
  });

  useEffect(() => {
    const el = chartPaneRef.current;
    if (!el || !allCandles) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: { mode: 'pan' | 'pinch'; visibleCount: number; panOffset: number; x?: number; dist?: number } | null = null;
    // Same non-reactive-local pattern as `gesture` above (see this
    // effect's own dependency-array comment for why) — the Quick
    // Trade drag's entry anchor only needs to survive for the
    // duration of one gesture, not trigger a re-render itself.
    let quickTradeAnchor: { entryIndex: number; entryPrice: number } | null = null;

    function clampPan(offset: number, visible: number) {
      return Math.max(0, Math.min(offset, Math.max(0, (allCandles?.length ?? 0) - visible)));
    }

    /** Viewport pixel -> {visibleIndex, price}, reading liveRef fresh
     * on every call (see liveRef's own comment on why). */
    function pixelToChartLive(clientX: number, clientY: number): { visibleIndex: number; price: number } | null {
      const box = chartBoxRef.current;
      const live = liveRef.current;
      if (!box || live.candlesLength === 0) return null;
      const rect = box.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const { padLeft, padRight, padTop, padBottom, width } = CHART_LAYOUT;
      const plotWidth = width - padLeft - padRight;
      const plotHeight = CHART_HEIGHT - padTop - padBottom;
      const relX = ((clientX - rect.left) / rect.width) * width;
      const slotWidth = plotWidth / live.candlesLength;
      const idx = (relX - padLeft) / slotWidth - 0.5;
      const visibleIndex = Math.round(Math.max(0, Math.min(live.candlesLength - 1, idx)));
      const relY = ((clientY - rect.top) / rect.height) * CHART_HEIGHT;
      const priceFrac = (relY - padTop) / plotHeight;
      const price = live.yTop - priceFrac * (live.yTop - live.yBottom);
      return { visibleIndex, price };
    }

    function onPointerDown(e: PointerEvent) {
      // See quickTradeCardRef's own comment above — a click on the
      // confirm card or the right-margin handle must never be read
      // as the start of a new drag on the chart underneath them.
      if (quickTradeCardRef.current?.contains(e.target as Node)) return;
      if (rightMarginHandleRef.current?.contains(e.target as Node)) return;
      el!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drawShape === 'position') {
        const pt = pixelToChartLive(e.clientX, e.clientY);
        if (pt) {
          quickTradeAnchor = { entryIndex: liveRef.current.visibleStart + pt.visibleIndex, entryPrice: pt.price };
          setQuickTradeDraft(null);
          setCustomRRText('');
        }
        return;
      }
      if (drawShape) {
        const pt = pixelToChartLive(e.clientX, e.clientY);
        if (pt) {
          const abs = liveRef.current.visibleStart + pt.visibleIndex;
          setInProgressDraw({ id: 'preview', index1: abs, price1: pt.price, index2: abs, price2: pt.price, shape: drawShape });
        }
        return;
      }
      const { visibleCount: vc, panOffset: po } = liveRef.current;
      if (pointers.size === 1) {
        gesture = { mode: 'pan', visibleCount: vc, panOffset: po, x: e.clientX };
      } else if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        gesture = { mode: 'pinch', visibleCount: vc, panOffset: po, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    }
    function onPointerMove(e: PointerEvent) {
      // Crosshair follows ANY pointer movement over the chart —
      // independent of an active pan/pinch/draw gesture, so it also
      // works as a plain hover (mouse, no button pressed).
      const pt = pixelToChartLive(e.clientX, e.clientY);
      setHoverIndex(pt ? pt.visibleIndex : null);

      if (drawShape === 'position') {
        if (!pointers.has(e.pointerId) || !quickTradeAnchor) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pt) {
          setQuickTradeDraft(computeQuickTradeDraft(quickTradeAnchor.entryIndex, quickTradeAnchor.entryPrice, pt.price, liveRef.current.rr));
        }
        return;
      }

      if (drawShape) {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pt) {
          const abs = liveRef.current.visibleStart + pt.visibleIndex;
          setInProgressDraw((prev) => (prev ? { ...prev, index2: abs, price2: pt.price } : prev));
        }
        return;
      }

      if (!pointers.has(e.pointerId) || !gesture || !allCandles) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture.mode === 'pan' && pointers.size === 1) {
        const rect = el!.getBoundingClientRect();
        const pxPerCandle = rect.width / gesture.visibleCount;
        const deltaCandles = Math.round((e.clientX - gesture.x!) / pxPerCandle);
        // Dragging left reveals newer data (content slides left under
        // your finger, same feel as scrolling any horizontal list);
        // dragging right reveals older data.
        setPanOffset(clampPan(gesture.panOffset - deltaCandles, gesture.visibleCount));
      } else if (gesture.mode === 'pinch' && pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const nextVisible = Math.max(MIN_VISIBLE, Math.min(allCandles.length, Math.round(gesture.visibleCount * (gesture.dist! / dist))));
        setVisibleCount(nextVisible);
        setPanOffset((p) => clampPan(p, nextVisible));
      }
    }
    function onPointerUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (drawShape === 'position') {
        if (pointers.size === 0) {
          quickTradeAnchor = null;
          // A click with no real drag (stopLoss === entryPrice) has
          // zero risk to size a trade off — discard it rather than
          // leave a degenerate confirm card up.
          setQuickTradeDraft((d) => (d && d.stopLoss !== d.entryPrice ? d : null));
        }
        return;
      }
      if (drawShape) {
        if (pointers.size === 0) {
          setInProgressDraw((prev) => {
            if (prev && (prev.index1 !== prev.index2 || prev.price1 !== prev.price2)) {
              const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              setDrawings((ds) => [...ds, { ...prev, id }]);
            }
            return null;
          });
        }
        return;
      }
      if (pointers.size === 0) {
        gesture = null;
      } else if (pointers.size === 1 && gesture) {
        // Lifted one finger mid-pinch — re-baseline as a fresh pan
        // from here rather than jumping using stale pinch state.
        const [remaining] = Array.from(pointers.values());
        gesture = { mode: 'pan', visibleCount: liveRef.current.visibleCount, panOffset: liveRef.current.panOffset, x: remaining.x };
      }
    }
    function onPointerLeave() { setHoverIndex(null); }
    function onWheel(e: WheelEvent) {
      if (!allCandles || drawShape) return;
      e.preventDefault();
      setVisibleCount((v) => (e.deltaY < 0 ? Math.max(MIN_VISIBLE, Math.round(v * 0.85)) : Math.min(allCandles.length, Math.round(v * 1.18))));
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('wheel', onWheel);
    };
    // Deliberately depends on `allCandles`/`drawMode` only, not
    // `visibleCount`/`panOffset`/`candles` — those change on every
    // single pan/zoom/draw step (including mid-gesture, via this same
    // effect's own setPanOffset/setInProgressDraw calls), and
    // re-running this effect tears down + re-attaches the listeners,
    // which would reset `pointers`/`gesture` to empty and silently
    // freeze whatever gesture was in progress. `allCandles` only
    // changes on a real refetch (symbol/interval/retry — exactly when
    // a fresh, clean gesture-state reattachment is wanted); `drawMode`
    // toggling mid-gesture is fine to re-attach on — there's no
    // in-progress gesture worth preserving across a deliberate
    // pan<->draw mode switch. Every value that DOES need to stay fresh
    // without being a dep (visibleCount/panOffset/visibleStart/
    // candlesLength/yTop/yBottom) is read from liveRef at call time
    // instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCandles, drawShape]);

  /** Persisted drawings, converted from stable allCandles-relative
   * index to the CURRENTLY VISIBLE window's relative index — this is
   * what actually gets handed to CandleChart. A segment whose both
   * endpoints fall outside the visible window still gets passed
   * through (SVG clips it automatically, same as how a horizontal
   * reference line already behaves when its price is off-screen) —
   * no separate filtering needed. */
  const visibleDrawings: DrawnSegment[] = useMemo(() => {
    const toVisible = (d: DrawnSegment): DrawnSegment => ({
      ...d, index1: d.index1 - visibleStart, index2: d.index2 - visibleStart,
    });
    const list = drawings.map(toVisible);
    if (inProgressDraw) list.push({ ...toVisible(inProgressDraw), color: '#2563eb', id: 'preview' });
    return list;
  }, [drawings, inProgressDraw, visibleStart]);

  /** The Quick Trade draft's risk (red, entry->SL) and reward (green,
   * entry->TP) brackets — same visible-relative conversion as
   * visibleDrawings above, spanning from the entry candle out to the
   * right edge of the currently-visible window so it reads as the
   * same kind of bracket TradingView's own Long/Short tool draws. */
  const quickTradeZones: ChartZone[] = useMemo(() => {
    if (!quickTradeDraft || !candles || candles.length === 0) return [];
    const entryVisible = quickTradeDraft.entryIndex - visibleStart;
    const rightEdge = candles.length - 1;
    if (entryVisible > rightEdge) return []; // entry scrolled out of the visible window
    const fromIndex = Math.max(0, entryVisible);
    return [
      {
        fromIndex, toIndex: rightEdge,
        priceTop: Math.max(quickTradeDraft.entryPrice, quickTradeDraft.stopLoss),
        priceBottom: Math.min(quickTradeDraft.entryPrice, quickTradeDraft.stopLoss),
        color: '#ef4444',
      },
      {
        fromIndex, toIndex: rightEdge,
        priceTop: Math.max(quickTradeDraft.entryPrice, quickTradeDraft.takeProfit),
        priceBottom: Math.min(quickTradeDraft.entryPrice, quickTradeDraft.takeProfit),
        color: '#22c55e',
      },
    ];
  }, [quickTradeDraft, candles, visibleStart]);

  /** Simple moving average(s) — by direct request ("add ... standard
   * charting tools"). Computed from the STABLE allCandles pool (real
   * lookback, not just what happens to be visible) then sliced to the
   * visible window so CandleChart gets exactly one point per visible
   * candle, same shape `lines`/`zones` already use. */
  const maSeries: OverlaySeries[] = useMemo(() => {
    if (!showMA || !allCandles || !candles || candles.length === 0) return [];
    const pool = allCandles;
    function sma(period: number): (number | null)[] {
      const closes = pool.map((c) => c.close);
      return closes.map((_, i) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let k = i - period + 1; k <= i; k++) sum += closes[k];
        return sum / period;
      });
    }
    const sma20 = sma(20).slice(visibleStart, visibleStart + candles.length);
    const sma50 = sma(50).slice(visibleStart, visibleStart + candles.length);
    return [
      { points: sma20, color: '#a855f7', label: 'SMA 20' },
      { points: sma50, color: '#f97316', label: 'SMA 50' },
    ];
  }, [showMA, allCandles, candles, visibleStart]);

  const hoveredCandle = hoverIndex != null ? candles?.[hoverIndex] : null;

  // Local-only theme/color overrides. Theme defaults to light always
  // (by direct instruction), independent of whatever the calling chart
  // was showing. Candle colors default to classic green/red — by
  // direct request ("Make the default colour green and red classic for
  // the 'on chart'"), reverting an earlier attempt at defaulting to
  // Monochrome (Optimised) instead. Deliberately hardcoded rather than
  // inherited from the caller's own bullColor/bearColor prop — this
  // view's own default stays Classic regardless of whatever the main
  // chart happens to be customized to. Still fully overridable via the
  // Colors picker right here.
  const [localDark, setLocalDark] = useState(false);
  const [localBull, setLocalBull] = useState('#22c55e');
  const [localBear, setLocalBear] = useState('#ef4444');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Reserved empty space on the right for the always-right-anchored
  // Entry/SL/TP/live-price labels (and the Quick Trade confirm card)
  // to sit over instead of real candles — by direct bug report, with
  // screenshot ("make about 10 candles on the right side free space
  // ... provide a drag line that can define the limit"). Starts at a
  // reasonable default (about 10 candle-slots); the drag handle below
  // lets a trader shrink it back toward 0 if they'd rather have the
  // candles fill the space instead.
  const [rightMargin, setRightMargin] = useState(10);
  const MAX_RIGHT_MARGIN = 40;

  /** Drag-to-resize the right margin — native window listeners (not
   * React's onPointerMove/Up) so the drag keeps tracking even if the
   * pointer leaves the small handle element itself mid-drag, same
   * "don't lose the gesture" reasoning as the main pan/pinch/draw
   * system below, just scoped to this one handle rather than the
   * whole chart pane. stopPropagation on pointerdown keeps this from
   * also being interpreted as a pan/draw gesture on chartPaneRef. */
  function onRightMarginHandlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const box = chartBoxRef.current;
    const count = candles?.length ?? 0;
    if (!box || count === 0) return;
    const rect = box.getBoundingClientRect();
    const { width, padLeft, padRight } = CHART_LAYOUT;
    const plotWidth = width - padLeft - padRight;
    const startX = e.clientX;
    const startMargin = rightMargin;
    function onMove(ev: PointerEvent) {
      // Recomputed every move (not just once) — the slot width itself
      // changes as the margin changes mid-drag, so a fixed conversion
      // factor would drift from what's actually on screen.
      const pxPerSlot = (rect.width / width) * (plotWidth / (count + startMargin));
      const deltaSlots = Math.round((startX - ev.clientX) / Math.max(1, pxPerSlot));
      setRightMargin(Math.max(0, Math.min(MAX_RIGHT_MARGIN, startMargin + deltaSlots)));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Live "where is price right now" line — the candles above only
  // update on the next full refetch, so without this the chart can
  // sit visibly stale (last candle's close) even while the real
  // market has moved on. Reuses the same quick-price lookup the order
  // ticket itself uses, not a second implementation.
  const { price: livePrice, refresh: refreshLivePrice } = useQuickPrice(activeSymbol);
  useEffect(() => {
    refreshLivePrice({ silent: true });
    const t = window.setInterval(() => refreshLivePrice({ silent: true }), LIVE_PRICE_REFRESH_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);

  useEffect(() => {
    let cancelled = false;
    setAllCandles(null);
    setError(null);
    // A real, moving pan/zoom window (not the old bug-fix "widget got
    // stuck on one symbol" story) — the whole POOL_SIZE fetches once
    // per symbol/interval/retry, then zoomIn/zoomOut/panOlder/panNewer
    // above just re-slice it client-side with zero extra requests.
    setVisibleCount(DEFAULT_VISIBLE);
    setPanOffset(0);
    orderFlowApi.getKlines(activeSymbol, interval, POOL_SIZE)
      .then((res) => {
        if (cancelled) return;
        setAllCandles(res.candles.map((c) => ({ time: c.time_ms, open: c.open, high: c.high, low: c.low, close: c.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setError(formatApiError(detail, 'Live candle data isn\'t available for this symbol right now.'));
      });
    return () => { cancelled = true; };
  }, [activeSymbol, interval, retryTick]);

  const dirLabel = position?.direction === 'long' ? 'LONG' : 'SHORT';
  // Second line under the Entry price — by direct request ("the
  // current entry line is too long - let's break into two lines /
  // Entry price / Short or Long (Pending/Live) / The live will show
  // then current PL as the position progresses"): direction and
  // Pending-vs-Live status, plus the SAME live unrealized P&L already
  // shown elsewhere once the position is actually Live — updates on
  // its own as `position.unrealizedPnl` refreshes from the caller.
  // The P&L figure itself gets its own green/profit or red/loss color
  // (label2Suffix), by further direct request ("put the live PL in
  // colours green for profit and red for loss") — same green/red pair
  // (#22c55e/#ef4444) this file already uses for every other SL/TP-
  // style line, rather than inheriting the Entry line's own blue.
  const entryStatusLabel = position?.pending ? `${dirLabel} (Pending)` : `${dirLabel} (Live)`;
  const entryPnlSuffix = !position?.pending && position?.unrealizedPnl != null
    ? { text: formatSignedMoney(position.unrealizedPnl), color: position.unrealizedPnl >= 0 ? '#22c55e' : '#ef4444' }
    : undefined;
  // Every price drawn on this chart — by direct request ("make all
  // prices text max of two decimal points"): the raw values here carry
  // whatever precision the backend computed them at (position sizing
  // etc. can produce e.g. "81982.92169386141"), which is real data but
  // unreadable as a line label crowding the chart pane.
  const fmtPrice = (p: number) => p.toFixed(2);
  // Position-derived lines (and the Quick Trade draft) only ever
  // describe `symbol` — the position's own instrument — so they're
  // hidden the moment "Pairs" points this chart at a different one;
  // see `isOriginalSymbol`'s own comment above `activeSymbol`.
  // Vivid Blue/Red/Green — by direct request ("Make the dash lines for
  // entry, SL and TP more visible ..... Blue, Red and Green Dash
  // lines"), replacing TradingView's own muted palette (#2962FF/
  // #EF5350/#26A69A), which read as too soft against a white pane.
  // Same hexes as the Classic candle preset and the Quick Trade
  // draft's own lines, so every dashed reference line in On Chart now
  // shares one consistent, punchy color language.
  const ENTRY_LINE_COLOR = '#2563eb';
  const SL_LINE_COLOR = '#ef4444';
  const TP_LINE_COLOR = '#22c55e';
  const lines: ChartLine[] = [
    ...(position && isOriginalSymbol ? [{ price: position.entryPrice, color: ENTRY_LINE_COLOR, dashed: true, label: fmtPrice(position.entryPrice), label2: entryStatusLabel, label2Suffix: entryPnlSuffix }] : []),
    ...(position?.stopLoss != null && isOriginalSymbol ? [{ price: position.stopLoss, color: SL_LINE_COLOR, dashed: true, label: `SL ${fmtPrice(position.stopLoss)}` }] : []),
    ...(position?.takeProfit1 != null && isOriginalSymbol ? [{ price: position.takeProfit1, color: TP_LINE_COLOR, dashed: true, label: `TP1 ${fmtPrice(position.takeProfit1)}` }] : []),
    ...(position?.takeProfit2 != null && isOriginalSymbol ? [{ price: position.takeProfit2, color: TP_LINE_COLOR, dashed: true, label: `TP2 ${fmtPrice(position.takeProfit2)}` }] : []),
    ...(position?.takeProfit3 != null && isOriginalSymbol ? [{ price: position.takeProfit3, color: TP_LINE_COLOR, dashed: true, label: `TP3 ${fmtPrice(position.takeProfit3)}` }] : []),
    // Solid (not dashed) and a distinct amber, so it's unmistakably
    // "where price is right this second" versus the dashed reference
    // levels above — refreshes every 15s while this stays open. Not
    // gated on isOriginalSymbol: whatever pair you're currently
    // viewing, its own live price is still correct and useful.
    ...(livePrice != null ? [{ price: livePrice, color: '#f59e0b', dashed: false, label: `Live ${fmtPrice(livePrice)}` }] : []),
    // Quick Trade draft — see quickTradeZones above for the matching
    // risk/reward brackets.
    ...(quickTradeDraft && isOriginalSymbol ? [
      { price: quickTradeDraft.entryPrice, color: '#2563eb', dashed: true, label: `Entry ${quickTradeDraft.direction.toUpperCase()} ${fmtPrice(quickTradeDraft.entryPrice)}` },
      { price: quickTradeDraft.stopLoss, color: '#ef4444', dashed: true, label: `SL ${fmtPrice(quickTradeDraft.stopLoss)}` },
      { price: quickTradeDraft.takeProfit, color: '#22c55e', dashed: true, label: `TP ${fmtPrice(quickTradeDraft.takeProfit)}` },
    ] : []),
  ];

  // Same shared quick-links store every other chart's Pairs panel
  // reads/writes — a pair picked here shows up everywhere else too.
  // `selectedPair` falls back to a plain synthesized entry when
  // `activeSymbol` isn't (yet) one of the saved quick-links, e.g. the
  // very first render, before the position's OWN symbol has ever been
  // added as a pill — PairsPanel only needs it for highlighting.
  const { pairs: quickPairs } = useQuickPairsStore();
  const selectedPair = quickPairs.find((p) => p.trade === activeSymbol)
    ?? { label: activeSymbol, trade: activeSymbol, tv: activeSymbol };

  const overlayCls = localDark ? 'bg-black/90' : 'bg-white/95';
  const chromeTextCls = localDark ? 'text-white' : 'text-corporate-text-on-bg';
  const chromeMutedCls = localDark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg';
  // Literal white, not the app's usual light lavender-grey surface —
  // by direct request ("make the background of the 'On chart' white -
  // default"). The light/dark toggle itself already existed
  // (localDark, defaulting to light); this only changes what "light"
  // actually renders as for the chart pane specifically.
  const paneCls = localDark ? 'bg-[#0b1220]' : 'bg-white';
  const pillIdleCls = localDark ? 'text-white/50 hover:text-white bg-white/5' : 'text-gray-500 hover:text-corporate-text-on-bg bg-white';
  const pillActiveCls = 'bg-corporate-hero text-white';
  const toggleWrapCls = localDark ? 'bg-white/5' : 'bg-black/5';
  const popoverCls = localDark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200';

  return (
    <div className={`fixed inset-0 z-[210] ${overlayCls} p-4 flex flex-col`}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className={`text-sm font-semibold ${chromeTextCls}`}>
          {activeSymbol}
          {' — '}
          {isOriginalSymbol
            ? (position ? 'price references on chart' : 'no open or pending order on this symbol')
            : 'browsing — Pairs to switch back'}
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
          {/* Pairs — quick symbol switcher, by direct request ("include
              the quick 'Pairs' in the 'on Chart' - so that there could
              be a quick selection of charts on that page"), placed
              directly next to "Position" by further direct request.
              Same PairsPanel every other chart uses; switching away
              from the position's own `symbol` hides the Entry/SL/TP/
              Quick Trade tooling below (see isOriginalSymbol) since
              those only ever describe that one instrument. */}
          <button
            onClick={() => setPairsOpen((o) => !o)}
            aria-label={pairsOpen ? 'Hide pairs and exchanges' : 'Show pairs and exchanges'}
            title={pairsOpen ? 'Hide pairs and exchanges' : 'Pairs and exchanges'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${pairsOpen ? 'bg-corporate-hero text-white' : `${chromeMutedCls} ${toggleWrapCls}`}`}
          >
            <CandlestickChart size={13} /> Pairs
          </button>
          {/* "Position" — edit/cancel/partial-close this trade right
              here, by direct request ("in addition to seeing the entry,
              SL and TP levels ... you can edit or manage your trade
              orders in that chart"). Only rendered when a full Trade
              record was actually handed to this modal (see `trade`'s
              own docstring above) AND you're still looking at that
              trade's own instrument — see isOriginalSymbol. */}
          {trade && isOriginalSymbol && (
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
            {/* w-72 (was w-60) — the two Monochrome labels now need the
                extra room so they don't wrap awkwardly. */}
            {colorPickerOpen && (
              <div className={`absolute right-0 top-full mt-2 z-10 w-72 rounded-xl border p-3 space-y-2.5 shadow-lg ${popoverCls}`}>
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
      {pairsOpen && (
        <div className="mb-3">
          <PairsPanel
            selected={selectedPair}
            onSelect={(p) => { setActiveSymbol(p.trade); setPairsOpen(false); }}
            dark={localDark}
            symbolFilter={isOnChartSupportedSymbol}
          />
        </div>
      )}
      {positionOpen && trade && isOriginalSymbol && (
        <div className="mb-3">
          <PositionManager trade={trade} dark={localDark} onChanged={onChanged} />
        </div>
      )}
      {/* Zoom/pan toolbar — by direct request ("add feature to resize
          or move the chart or scroll to the left or down or increase
          or decrease scale ... or zoom in or out"). Own row rather
          than crowding into the already-busy header above. Pan Older
          disables once panOffset hits maxPanOffset (the edge of the
          POOL_SIZE-candle fetch — nothing further back is loaded);
          Pan Newer disables at panOffset 0 (already at the live edge,
          same place Reset returns to). */}
      {allCandles && (
        <div className={`flex items-center gap-1 mb-2 rounded-lg p-1 w-fit ${toggleWrapCls}`}>
          <button onClick={zoomOut} disabled={visibleCount >= allCandles.length} aria-label="Zoom out (see more candles)" title="Zoom out" className={`p-1.5 rounded-md disabled:opacity-30 ${chromeMutedCls}`}>
            <ZoomOut size={14} />
          </button>
          <button onClick={zoomIn} disabled={visibleCount <= MIN_VISIBLE} aria-label="Zoom in (see fewer, wider candles)" title="Zoom in" className={`p-1.5 rounded-md disabled:opacity-30 ${chromeMutedCls}`}>
            <ZoomIn size={14} />
          </button>
          <span className={`w-px self-stretch mx-0.5 ${localDark ? 'bg-white/10' : 'bg-black/10'}`} />
          <button onClick={panOlder} disabled={panOffset >= maxPanOffset} aria-label="Scroll left (older candles)" title="Scroll left" className={`p-1.5 rounded-md disabled:opacity-30 ${chromeMutedCls}`}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={panNewer} disabled={panOffset === 0} aria-label="Scroll right (newer candles)" title="Scroll right" className={`p-1.5 rounded-md disabled:opacity-30 ${chromeMutedCls}`}>
            <ChevronRight size={14} />
          </button>
          <span className={`w-px self-stretch mx-0.5 ${localDark ? 'bg-white/10' : 'bg-black/10'}`} />
          <button onClick={resetView} disabled={visibleCount === DEFAULT_VISIBLE && panOffset === 0} aria-label="Reset zoom and scroll" title="Reset to the live view" className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-30 ${chromeMutedCls}`}>
            <Maximize2 size={12} /> Reset
          </button>
          <span className={`w-px self-stretch mx-0.5 ${localDark ? 'bg-white/10' : 'bg-black/10'}`} />
          {/* Moving average + drawing tool — by direct request ("add
              drawing tools and other standard charting tools to this
              chart", then "include a drawing tool for boxes - the box
              tool"). SCOPE, said plainly rather than overpromising:
              SMA(20)/SMA(50) overlays, straight trend lines, and boxes
              only — no Fibonacci/text annotations/other shapes, no
              per-shape selection or color picker (Clear removes every
              drawn line/box on this symbol, not one at a time). A real
              full toolset (those, plus live indicators, multi-chart
              layouts) is what TradingView's paid Charting Library is
              for — see this component's own tracking note. */}
          <button
            onClick={() => setShowMA((v) => !v)}
            aria-label={showMA ? 'Hide moving averages' : 'Show moving averages (SMA 20 / SMA 50)'}
            title="SMA 20 / SMA 50"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${showMA ? 'bg-corporate-hero text-white' : chromeMutedCls}`}
          >
            <TrendingUp size={13} /> MA
          </button>
          {/* Quick Trade — Long/Short position tool, only rendered when
              the caller wired an order form up to receive it (see this
              component's own QUICK TRADE / onQuickTrade docstrings) AND
              you're viewing the position's own symbol — onQuickTrade's
              own callback doesn't carry a symbol, so it always applies
              to whatever the order form is already set to; offering it
              while "Pairs" has switched this chart to a different
              instrument would silently draft a trade against the wrong
              one. Own accent color (not the shared corporate-hero pill)
              so it reads as distinct from the annotation tools next to
              it — this one places a real order draft, not a drawing. */}
          {onQuickTrade && isOriginalSymbol && (
            <button
              onClick={togglePositionTool}
              aria-label={drawShape === 'position' ? 'Stop Quick Trade' : 'Quick Trade — drag from entry to stop'}
              title={drawShape === 'position' ? 'Quick Trade — drag from your entry price down (long) or up (short) to your stop; release to review' : 'Quick Trade — drag on the chart to set Entry + Stop, auto-computes Take Profit'}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${drawShape === 'position' ? 'bg-emerald-600 text-white' : chromeMutedCls}`}
            >
              <Zap size={13} /> Quick Trade
            </button>
          )}
          <button
            onClick={() => setDrawShape((v) => (v === 'line' ? null : 'line'))}
            aria-label={drawShape === 'line' ? 'Stop drawing' : 'Draw a trend line'}
            title={drawShape === 'line' ? 'Drawing a line — drag to add one; click again to stop' : 'Draw a trend line'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${drawShape === 'line' ? 'bg-corporate-hero text-white' : chromeMutedCls}`}
          >
            <PenLine size={13} /> Line
          </button>
          <button
            onClick={() => setDrawShape((v) => (v === 'box' ? null : 'box'))}
            aria-label={drawShape === 'box' ? 'Stop drawing' : 'Draw a box'}
            title={drawShape === 'box' ? 'Drawing a box — drag to add one; click again to stop' : 'Draw a box'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${drawShape === 'box' ? 'bg-corporate-hero text-white' : chromeMutedCls}`}
          >
            <Square size={13} /> Box
          </button>
          {drawings.length > 0 && (
            <button onClick={clearDrawings} aria-label="Clear all drawn lines and boxes" title="Clear all drawn lines and boxes" className={`p-1.5 rounded-md ${chromeMutedCls}`}>
              <Eraser size={14} />
            </button>
          )}
        </div>
      )}
      {/* overflow-hidden (was overflow-auto — CandleChart always fills
          `height` exactly, nothing to scroll) + touchAction: 'none' so
          the browser's own native touch-scroll/pinch-zoom never fights
          the pointer handlers above for the same gesture. Cursor hints
          which mode is active: crosshair while drawing, grab otherwise
          (drag to pan). */}
      <div
        ref={chartPaneRef}
        className={`relative flex-1 min-h-0 rounded-lg ${paneCls} p-3 overflow-hidden`}
        style={{ touchAction: 'none', cursor: !candles ? undefined : drawShape ? 'crosshair' : 'grab' }}
      >
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
          <>
            <div ref={chartBoxRef}>
              <CandleChart
                candles={candles} lines={lines} zones={quickTradeZones} overlaySeries={maSeries} drawings={visibleDrawings}
                height={CHART_HEIGHT} dark={localDark} bullColor={localBull} bearColor={localBear} rightMargin={rightMargin}
              />
            </div>
            {/* Right-margin drag handle — by direct request ("provide a
                drag line that can define the limit of the candle
                display to the right so that you can make room and not
                allow items on the right to overlap"). Positioned at the
                exact same boundary CandleChart itself computes between
                real candles and the reserved margin (see this
                component's own rightMargin state comment). w-4 hit
                target (wider than the 1px visual line) so it's easy to
                grab on touch; stopPropagation in the handler keeps a
                drag here from also being read as a pan/draw gesture. */}
            {candles.length > 0 && (() => {
              // Same boundary math as CandleChart's own internal x(candles.length)
              // — the exact pixel line real candles stop and reserved
              // margin begins. Wrapped in the SAME `inset-3` box the
              // crosshair overlay uses (matching chartBoxRef's own
              // padded content area) so this percentage lines up with
              // what's actually rendered, not chartPaneRef's outer
              // padding box.
              const { width: vbWidth, padLeft, padRight } = CHART_LAYOUT;
              const plotWidth = vbWidth - padLeft - padRight;
              const slotWidth = plotWidth / (candles.length + rightMargin);
              const dividerXPct = ((padLeft + slotWidth * candles.length) / vbWidth) * 100;
              return (
                <div className="absolute inset-3 pointer-events-none">
                  <div
                    ref={rightMarginHandleRef}
                    onPointerDown={onRightMarginHandlePointerDown}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize reserved space for price labels"
                    title="Drag to resize the reserved space for Entry/SL/TP labels"
                    className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize group pointer-events-auto"
                    style={{ left: `${dividerXPct}%` }}
                  >
                    <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${localDark ? 'bg-white/15 group-hover:bg-white/50' : 'bg-black/10 group-hover:bg-black/40'}`} />
                  </div>
                </div>
              );
            })()}
            {/* Crosshair guide + OHLC readout — by direct request ("add
                ... other standard charting tools"). Vertical guide at
                the hovered candle; readout pinned top-left so it never
                sits under the reader's own finger on touch. */}
            {hoveredCandle && hoverIndex != null && candles.length > 0 && (
              <div className="absolute inset-3 pointer-events-none">
                <div
                  className={`absolute top-0 bottom-0 w-px ${localDark ? 'bg-white/30' : 'bg-black/25'}`}
                  style={{ left: `${((hoverIndex + 0.5) / candles.length) * 100}%` }}
                />
                <div className={`absolute top-1 left-1 rounded-lg px-2 py-1.5 text-[10px] font-mono leading-relaxed ${localDark ? 'bg-black/80 text-white/90' : 'bg-white/90 text-gray-800'} shadow`}>
                  <div className="flex items-center gap-1 font-sans font-semibold text-[10px] mb-0.5 opacity-70">
                    <Crosshair size={10} />
                    {hoveredCandle.time ? new Date(hoveredCandle.time).toLocaleString() : `Candle ${hoverIndex + 1}`}
                  </div>
                  O <span className="text-inherit">{hoveredCandle.open.toFixed(2)}</span> · H <span className="text-emerald-500">{hoveredCandle.high.toFixed(2)}</span> · L <span className="text-red-500">{hoveredCandle.low.toFixed(2)}</span> · C <span className="font-bold">{hoveredCandle.close.toFixed(2)}</span>
                </div>
              </div>
            )}
            {/* Quick Trade confirm card — appears once a drag has set a
                real (non-zero-risk) Entry/SL, live-updating while still
                dragging. R:R buttons recompute TP only (applyQuickTradeRR);
                "Use in Order Ticket" hands the three prices to the
                caller via onQuickTrade and closes this modal so the
                trader lands back on the now-filled form. */}
            {quickTradeDraft && onQuickTrade && (
              // onPointerDown stopPropagation — this card sits inside
              // chartPaneRef's own pointer-tracked area (same fragment
              // as the chart pane's native drag listeners below), so
              // without this, clicking anything on the card (R:R,
              // Discard, Use in Order Ticket) also bubbles up as a
              // NEW quick-trade drag start on the chart itself —
              // confirmed live: the card's own click could immediately
              // re-arm dragging instead of cleanly confirming/closing.
              <div
                ref={quickTradeCardRef}
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute bottom-4 right-4 z-10 w-32 rounded-xl border p-2 space-y-2 shadow-lg ${popoverCls}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white ${quickTradeDraft.direction === 'long' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    <Zap size={9} /> {quickTradeDraft.direction === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                  <button onClick={() => { setQuickTradeDraft(null); setCustomRRText(''); }} aria-label="Discard this quick trade" className={chromeMutedCls}>
                    <X size={12} />
                  </button>
                </div>
                {/* Label-above-value stacking (not side-by-side) — the
                    only way to fit "Stop Loss" + a full price on a
                    128px-wide card, by direct request ("reduce the
                    width of the quick trade form ... by 1/2"). */}
                <div className={`text-[9px] font-mono space-y-1 ${chromeTextCls}`}>
                  <div><div className="opacity-60 text-[8px]">Entry</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.entryPrice)}</div></div>
                  <div className="text-red-500"><div className="opacity-70 text-[8px]">Stop Loss</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.stopLoss)}</div></div>
                  <div className="text-emerald-500"><div className="opacity-70 text-[8px]">Take Profit</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.takeProfit)}</div></div>
                </div>
                <div className="space-y-1">
                  <span className={`text-[9px] ${chromeMutedCls}`}>R:R</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[1, 1.5, 2, 3, 4, 5].map((rr) => (
                      <button
                        key={rr}
                        onClick={() => { applyQuickTradeRR(rr); setCustomRRText(''); }}
                        className={`rounded-md py-1 text-[9px] font-semibold ${quickTradeRR === rr && !customRRText.trim() ? 'bg-corporate-hero text-white' : `${toggleWrapCls} ${chromeMutedCls}`}`}
                      >
                        {rr}R
                      </button>
                    ))}
                  </div>
                  {/* Custom R:R — any positive value, not just the
                      presets above (e.g. 2.5R, 7R). Applies live as
                      soon as what's typed parses to a real positive
                      number; an in-progress value ("4.", "-", empty)
                      just doesn't touch the draft yet rather than
                      erroring or snapping to 0. */}
                  <div className="space-y-1">
                    <span className={`text-[9px] ${chromeMutedCls}`}>Custom R</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="4.5"
                      value={customRRText}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomRRText(raw);
                        const parsed = Number(raw);
                        if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) applyQuickTradeRR(parsed);
                      }}
                      className={`w-full rounded-md px-1.5 py-1 text-[9px] outline-none border ${localDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-white border-gray-200 placeholder:text-gray-300'}`}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    onQuickTrade({
                      direction: quickTradeDraft.direction,
                      entryPrice: quickTradeDraft.entryPrice,
                      stopLoss: quickTradeDraft.stopLoss,
                      takeProfit: quickTradeDraft.takeProfit,
                    });
                    setQuickTradeDraft(null);
                    setCustomRRText('');
                    setDrawShape(null);
                    onClose();
                  }}
                  className="w-full rounded-lg py-1.5 text-[10px] leading-tight font-bold text-white bg-corporate-hero hover:opacity-90"
                >
                  Use in Order Ticket
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
