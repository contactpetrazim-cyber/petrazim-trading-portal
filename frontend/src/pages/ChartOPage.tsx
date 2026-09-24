import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, LineChart, Palette, TrendingUp, PenLine, Square, Eraser } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { CandleChart, CHART_LAYOUT, computeChartRange, type Candle, type DrawnSegment, type OverlaySeries } from '../components/CandleChart';
import { oandaApi, type OandaInstrument } from '../services/api';
import { useThemeStore } from '../hooks/useTheme';

// Same idea as PositionOnChartModal's own COLOR_PRESETS (and the same
// reason it's a small local copy, not the shared CandleColorPicker
// component): CandleColorPicker also offers a chart TYPE row for the
// TradingView widget's own override system, which this page's
// CandleChart has no way to honor — it only ever draws classic filled
// candlesticks. Offering that row here would be a control that
// visibly does nothing when touched.
const COLOR_PRESETS: { label: string; up: string; down: string }[] = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'TradingView', up: '#26a69a', down: '#ef5350' },
  { label: 'Binance', up: '#f0b90b', down: '#1e2329' },
  { label: 'Monochrome (light)', up: '#111827', down: '#9ca3af' },
];

const CHART_HEIGHT = 420;

/**
 * Oanda (was "Chart O") — a genuine, free OANDA-backed chart, the
 * direct counterpart to /tradingview's own TradingView-backed one.
 * Renamed by direct request ("Change the name of 'Chart O' to 'Oanda'
 * everywhere on the platform").
 *
 * Unlike the TradingView embed (an iframe showing TradingView's OWN
 * data), this draws real candles this app fetched itself from
 * routers/oanda.py — the same CandleChart primitive PositionOnChartModal
 * already uses for order_flow.py's Binance-backed klines, reused here
 * for OANDA's forex/index candles instead of built twice.
 *
 * Symbol search is a plain client-side filter over the platform
 * account's own real instrument list (GET /oanda/instruments) — OANDA
 * only has ~120 tradeable instruments total, small enough that a
 * server-side search endpoint (like the TradingView-backed unified
 * Pairs search elsewhere) would be pure overhead here.
 *
 * Drawing tools (Line/Box) + MA, by direct request ("Include drawing
 * tools in the Oanda chart" / "Put all the tools ... into the Chart O
 * - like Chart colour, pairs, position, price etc"). This page has no
 * pan/zoom (unlike PositionOnChartModal's POOL_SIZE+visibleCount+
 * panOffset system) — it always shows the one flat 200-candle window
 * routers/oanda.py's own /candles returns — so the pointer-to-chart
 * math here is simpler than that modal's own (no visibleStart offset
 * to add): candle index IS the array index, always. Honest on scope,
 * same as that modal's own tracking note: Position and Price are not
 * included in this pass — Position needs real OANDA trade-tracking
 * infrastructure that doesn't exist yet (this page isn't tied to any
 * specific trader's connection or trade), and Price would risk hitting
 * an endpoint that doesn't recognize OANDA's own symbol format; the
 * chart's own last-candle close is already visible as its price axis
 * label in the meantime.
 */
const INTERVALS: { label: string; value: string }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: 'D', value: '1d' },
  { label: 'W', value: '1w' },
];

export function ChartOPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  const [instruments, setInstruments] = useState<OandaInstrument[]>([]);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [symbol, setSymbol] = useState('NAS100_USD');
  const [interval, setInterval_] = useState('1h');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bullColor, setBullColor] = useState(COLOR_PRESETS[0].up);
  const [bearColor, setBearColor] = useState(COLOR_PRESETS[0].down);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const [showMA, setShowMA] = useState(false);
  const [drawShape, setDrawShape] = useState<'line' | 'box' | null>(null);
  const [drawings, setDrawings] = useState<DrawnSegment[]>([]);
  const [inProgressDraw, setInProgressDraw] = useState<DrawnSegment | null>(null);
  const chartPaneRef = useRef<HTMLDivElement>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    oandaApi.instruments()
      .then(setInstruments)
      .catch((err) => setInstrumentsError(err?.response?.data?.detail || 'Could not load the OANDA instrument list.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    setError(null);
    setDrawings([]);
    setInProgressDraw(null);
    oandaApi.candles(symbol, interval, 200)
      .then((bars) => {
        if (cancelled) return;
        setCandles(bars.map((b) => ({ time: b.time_ms, open: b.open, high: b.high, low: b.low, close: b.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.detail || `Could not load OANDA candles for ${symbol}.`);
      });
    return () => { cancelled = true; };
  }, [symbol, interval]);

  // Pointer -> chart-space conversion, and the drag-to-draw handlers
  // themselves — the same technique PositionOnChartModal's own
  // pixelToChartLive uses, simplified: no visibleStart/panOffset to
  // add, since this page never pans or zooms.
  useEffect(() => {
    const el = chartPaneRef.current;
    if (!el || !candles || !drawShape) return;

    function pixelToChart(clientX: number, clientY: number): { index: number; price: number } | null {
      const box = chartBoxRef.current;
      if (!box || !candles || candles.length === 0) return null;
      const rect = box.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const { padLeft, padRight, padTop, padBottom, width } = CHART_LAYOUT;
      const plotWidth = width - padLeft - padRight;
      const plotHeight = CHART_HEIGHT - padTop - padBottom;
      const relX = ((clientX - rect.left) / rect.width) * width;
      const slotWidth = plotWidth / candles.length;
      const idx = (relX - padLeft) / slotWidth - 0.5;
      const index = Math.round(Math.max(0, Math.min(candles.length - 1, idx)));
      const relY = ((clientY - rect.top) / rect.height) * CHART_HEIGHT;
      const priceFrac = (relY - padTop) / plotHeight;
      // Must match CandleChart's own computeChartRange exactly (it
      // adds an 8% price margin) — a hand-rolled min/max here would
      // silently misalign every drawn line/box from where you actually
      // dragged.
      const { yTop, yBottom } = computeChartRange(candles);
      const price = yTop - priceFrac * (yTop - yBottom);
      return { index, price };
    }

    function onPointerDown(e: PointerEvent) {
      el!.setPointerCapture(e.pointerId);
      const pt = pixelToChart(e.clientX, e.clientY);
      if (pt) setInProgressDraw({ id: 'preview', index1: pt.index, price1: pt.price, index2: pt.index, price2: pt.price, shape: drawShape! });
    }
    function onPointerMove(e: PointerEvent) {
      const pt = pixelToChart(e.clientX, e.clientY);
      if (pt) setInProgressDraw((prev) => (prev ? { ...prev, index2: pt.index, price2: pt.price } : prev));
    }
    function onPointerUp() {
      setInProgressDraw((prev) => {
        if (prev && (prev.index1 !== prev.index2 || prev.price1 !== prev.price2)) {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setDrawings((ds) => [...ds, { ...prev, id }]);
        }
        return null;
      });
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
    };
  }, [candles, drawShape]);

  const visibleDrawings: DrawnSegment[] = useMemo(() => {
    const list = [...drawings];
    if (inProgressDraw) list.push({ ...inProgressDraw, color: '#2563eb', id: 'preview' });
    return list;
  }, [drawings, inProgressDraw]);

  /** Simple moving average(s) — by direct request ("Include drawing
   * tools"), same SMA(20)/SMA(50) pair PositionOnChartModal's own MA
   * button computes, one point per candle (no slicing needed here,
   * since there's no visible-window concept distinct from `candles`
   * itself). */
  const maSeries: OverlaySeries[] = useMemo(() => {
    if (!showMA || !candles || candles.length === 0) return [];
    const closes = candles.map((c) => c.close);
    function sma(period: number): (number | null)[] {
      return closes.map((_, i) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let k = i - period + 1; k <= i; k++) sum += closes[k];
        return sum / period;
      });
    }
    return [
      { points: sma(20), color: '#a855f7', label: 'SMA 20' },
      { points: sma(50), color: '#f97316', label: 'SMA 50' },
    ];
  }, [showMA, candles]);

  const results = useMemo(() => {
    if (!query.trim()) return instruments.slice(0, 20);
    const q = query.trim().toUpperCase();
    return instruments.filter((i) => i.name.includes(q) || i.display_name.toUpperCase().includes(q)).slice(0, 20);
  }, [instruments, query]);

  // The bug: light mode never set an explicit text color, so the
  // typed/placeholder text inherited whatever ambient default applied
  // and read as invisible — by direct bug report ("The search is not
  // showing the instrument pairs - invisible"). Every other input in
  // this codebase (e.g. ConnectExchangePage.tsx's own inputCls)
  // explicitly sets text-corporate-text-on-bg for light mode; this one
  // just never did.
  const inputCls = `w-full pl-8 pr-3 py-2 text-sm rounded-lg border ${
    dark ? 'bg-smc-dark border-smc-border text-white placeholder:text-white/30' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
  }`;
  const toolBtnCls = (active: boolean) =>
    `flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
      active ? 'bg-corporate-hero text-white' : dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
    }`;

  return (
    <div>
      <PageHeader title="Oanda" subtitle="A real, free OANDA chart — forex majors, NAS100, and other indices, fetched live." />

      <FoldedCard title="Oanda" summary={symbol} icon={<LineChart size={19} />} dark={dark} defaultOpen>
        <div className="relative mb-3">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-gray-400'}`} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
            placeholder="Search instruments — EUR_USD, NAS100_USD, XAU_USD..."
            className={inputCls}
          />
          {showResults && results.length > 0 && (
            <div className={`absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border shadow-lg ${dark ? 'bg-smc-dark border-smc-border' : 'bg-white border-corporate-bg'}`}>
              {results.map((i) => (
                <button
                  key={i.name}
                  onMouseDown={() => { setSymbol(i.name); setQuery(''); setShowResults(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${dark ? 'hover:bg-white/5 text-white' : 'hover:bg-black/5'}`}
                >
                  <span className="font-medium">{i.display_name}</span>
                  <span className={`text-[11px] ${dark ? 'text-white/40' : 'text-gray-400'}`}>{i.type}</span>
                </button>
              ))}
            </div>
          )}
          {instrumentsError && <p className="text-xs text-red-600 mt-1.5">{instrumentsError}</p>}
        </div>

        <div className="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {INTERVALS.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setInterval_(tf.value)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  interval === tf.value
                    ? 'bg-corporate-hero text-white'
                    : dark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-gray-500'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {/* Candle colors — renamed to "Candle" site-wide (see
              CandleColorPicker.tsx), so this matches that same name
              rather than reintroducing the "Chart" ambiguity here. */}
          <div className="relative">
            <button
              onClick={() => setColorPickerOpen((o) => !o)}
              aria-label="Candle colors"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${colorPickerOpen ? 'bg-corporate-hero text-white' : dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
            >
              <Palette size={13} /> Candle
            </button>
            {colorPickerOpen && (
              <div className={`absolute right-0 top-full mt-2 z-10 w-64 rounded-xl border p-3 space-y-2.5 shadow-lg ${dark ? 'bg-[#161b2e] border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setBullColor(p.up); setBearColor(p.down); }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium ${dark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-gray-700'}`}
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
                  <label className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-white/60' : 'text-gray-500'}`}>
                    <input type="color" value={bullColor} onChange={(e) => setBullColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                    Up
                  </label>
                  <label className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-white/60' : 'text-gray-500'}`}>
                    <input type="color" value={bearColor} onChange={(e) => setBearColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                    Down
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drawing tools — MA overlay, trend Line, Box, and Clear —
            by direct request ("Include drawing tools in the Oanda
            chart"). Same scope note as PositionOnChartModal's own:
            classic candlesticks + lines/boxes only, no Fibonacci/text/
            per-shape selection. */}
        {candles && (
          <div className={`flex items-center gap-1 mb-2 rounded-lg p-1 w-fit ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
            <button onClick={() => setShowMA((v) => !v)} aria-label={showMA ? 'Hide moving averages' : 'Show moving averages (SMA 20 / SMA 50)'} title="SMA 20 / SMA 50" className={toolBtnCls(showMA)}>
              <TrendingUp size={13} /> MA
            </button>
            <button onClick={() => setDrawShape((v) => (v === 'line' ? null : 'line'))} aria-label={drawShape === 'line' ? 'Stop drawing' : 'Draw a trend line'} title={drawShape === 'line' ? 'Drawing a line — drag to add one; click again to stop' : 'Draw a trend line'} className={toolBtnCls(drawShape === 'line')}>
              <PenLine size={13} /> Line
            </button>
            <button onClick={() => setDrawShape((v) => (v === 'box' ? null : 'box'))} aria-label={drawShape === 'box' ? 'Stop drawing' : 'Draw a box'} title={drawShape === 'box' ? 'Drawing a box — drag to add one; click again to stop' : 'Draw a box'} className={toolBtnCls(drawShape === 'box')}>
              <Square size={13} /> Box
            </button>
            {drawings.length > 0 && (
              <button onClick={() => setDrawings([])} aria-label="Clear all drawn lines and boxes" title="Clear all drawn lines and boxes" className={`p-1.5 rounded-md ${dark ? 'text-white/50 hover:text-white/80' : 'text-gray-500 hover:text-gray-700'}`}>
                <Eraser size={14} />
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 py-4">{error}</p>}
        {!error && !candles && <p className={`text-sm py-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Loading…</p>}
        {!error && candles && (
          <div ref={chartPaneRef} style={{ touchAction: 'none', cursor: drawShape ? 'crosshair' : undefined }}>
            <div ref={chartBoxRef}>
              <CandleChart candles={candles} height={CHART_HEIGHT} dark={dark} bullColor={bullColor} bearColor={bearColor} overlaySeries={maSeries} drawings={visibleDrawings} />
            </div>
          </div>
        )}
      </FoldedCard>
    </div>
  );
}
