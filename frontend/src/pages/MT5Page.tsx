import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, LineChart, Palette, TrendingUp, PenLine, Square, Eraser, Target, Receipt, Zap, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { CandleChart, CHART_LAYOUT, computeChartRange, type Candle, type DrawnSegment, type OverlaySeries, type ChartZone } from '../components/CandleChart';
import { PositionManager } from '../components/PositionManager';
import { NoPositionCard, PositionLoadingCard } from '../components/ChartPanel';
import { metatraderApi, tradesApi } from '../services/api';
import { useThemeStore } from '../hooks/useTheme';
import type { Trade } from '../types';

const COLOR_PRESETS: { label: string; up: string; down: string }[] = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'TradingView', up: '#26a69a', down: '#ef5350' },
  { label: 'Binance', up: '#f0b90b', down: '#1e2329' },
  { label: 'Monochrome (light)', up: '#111827', down: '#9ca3af' },
];

const CHART_HEIGHT = 420;

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

/**
 * MT5 — the direct MetaApi-backed counterpart to the Oanda page, by
 * direct request ("For MT5 create it's own MT5 chart like Oanda -
 * name it MT5"). Same feature set (search/pick instrument, drawing
 * tools, MA, Price, Position, Quick Trade), but a genuinely different
 * data-source shape: unlike OANDA/Binance, MT5 has NO free/public data
 * — every call here uses YOUR OWN connected MetaApi account
 * (Settings → Add Exchange), the same one execution_engine.py already
 * routes real orders through. No instrument-list dropdown either
 * (unlike Oanda's /oanda/instruments) — MetaApi's own symbols-list
 * endpoint wasn't verified against live docs in this pass, so this
 * takes a typed symbol directly (standard MT5 naming — EURUSD,
 * XAUUSD, no underscore) rather than guess its shape.
 */
export function MT5Page() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [symbolInput, setSymbolInput] = useState('EURUSD');
  const [symbol, setSymbol] = useState('EURUSD');
  const [interval, setInterval_] = useState('1h');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [bullColor, setBullColor] = useState(COLOR_PRESETS[0].up);
  const [bearColor, setBearColor] = useState(COLOR_PRESETS[0].down);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const [showMA, setShowMA] = useState(false);
  const [drawShape, setDrawShape] = useState<'line' | 'box' | 'position' | null>(null);
  const [drawings, setDrawings] = useState<DrawnSegment[]>([]);
  const [inProgressDraw, setInProgressDraw] = useState<DrawnSegment | null>(null);
  const chartPaneRef = useRef<HTMLDivElement>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const quickTradeAnchorRef = useRef<{ index: number; price: number } | null>(null);

  const [quickTradeDraft, setQuickTradeDraft] = useState<{ entryIndex: number; entryPrice: number; stopLoss: number; takeProfit: number; direction: 'long' | 'short' } | null>(null);
  const [quickTradeRR, setQuickTradeRR] = useState(2);
  const [customRRText, setCustomRRText] = useState('');
  function computeQuickTradeDraft(entryIndex: number, entryPrice: number, dragPrice: number, rr: number) {
    const direction: 'long' | 'short' = dragPrice < entryPrice ? 'long' : 'short';
    const stopLoss = dragPrice;
    const risk = Math.abs(entryPrice - stopLoss);
    const takeProfit = direction === 'long' ? entryPrice + risk * rr : entryPrice - risk * rr;
    return { entryIndex, entryPrice, stopLoss, takeProfit, direction };
  }
  function applyQuickTradeRR(rr: number) {
    setQuickTradeRR(rr);
    setQuickTradeDraft((d) => (d ? computeQuickTradeDraft(d.entryIndex, d.entryPrice, d.stopLoss, rr) : d));
  }
  function formatQuickTradePrice(p: number): string {
    return p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(4);
  }
  function toggleQuickTrade() {
    setDrawShape((v) => (v === 'position' ? null : 'position'));
    setQuickTradeDraft(null);
    setCustomRRText('');
  }

  // Position — same Trade lookup + PositionManager/NoPositionCard
  // pattern the Oanda page uses, filtered to broker_name === 'metatrader'.
  const [positionOpen, setPositionOpen] = useState(false);
  const [positionLoading, setPositionLoading] = useState(true);
  const [openPositionTrade, setOpenPositionTrade] = useState<Trade | null>(null);
  const [pendingOrderTrade, setPendingOrderTrade] = useState<Trade | null>(null);
  const [otherOpenTrades, setOtherOpenTrades] = useState<Trade[]>([]);
  const position: Trade | null = openPositionTrade ?? pendingOrderTrade;

  const loadPosition = useCallback(() => {
    return Promise.all([
      tradesApi.getActiveTrades(),
      tradesApi.getTrades({ status: 'pending' }),
    ]).then(([active, pending]) => {
      const isThisOne = (t: Trade) => t.symbol === symbol && t.broker_name === 'metatrader';
      setOpenPositionTrade(active.find((t) => isThisOne(t) && t.entry_price != null) ?? null);
      setPendingOrderTrade(pending.find((t) => isThisOne(t) && t.entry_price != null) ?? null);
      const bySymbol = new Map<string, Trade>();
      active.filter((t) => !isThisOne(t) && t.broker_name === 'metatrader' && t.entry_price != null).forEach((t) => bySymbol.set(t.symbol, t));
      pending.filter((t) => !isThisOne(t) && t.broker_name === 'metatrader' && t.entry_price != null).forEach((t) => { if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t); });
      setOtherOpenTrades(Array.from(bySymbol.values()));
    }).catch(() => { setOpenPositionTrade(null); setPendingOrderTrade(null); setOtherOpenTrades([]); })
      .finally(() => setPositionLoading(false));
  }, [symbol]);
  useEffect(() => { setPositionLoading(true); loadPosition(); }, [loadPosition]);

  const [priceOpen, setPriceOpen] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  useEffect(() => {
    if (!priceOpen) return;
    let cancelled = false;
    function refresh() {
      metatraderApi.price(symbol)
        .then((r) => { if (!cancelled) { setLivePrice(r.price); setPriceError(null); } })
        .catch((err) => { if (!cancelled) setPriceError(err?.response?.data?.detail || 'No live price right now.'); });
    }
    refresh();
    const t = window.setInterval(refresh, 15_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [priceOpen, symbol]);

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    setError(null);
    setNotConnected(false);
    setDrawings([]);
    setInProgressDraw(null);
    metatraderApi.candles(symbol, interval, 200)
      .then((bars) => {
        if (cancelled) return;
        setCandles(bars.map((b) => ({ time: b.time_ms, open: b.open, high: b.high, low: b.low, close: b.close })));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 503) setNotConnected(true);
        setError(err?.response?.data?.detail || `Could not load MT5 candles for ${symbol}.`);
      });
    return () => { cancelled = true; };
  }, [symbol, interval]);

  // Pointer -> chart-space conversion, identical to the Oanda page's
  // own (no pan/zoom here either — always the one flat 200-candle
  // window /metatrader/candles returns).
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
      const { yTop, yBottom } = computeChartRange(candles);
      const price = yTop - priceFrac * (yTop - yBottom);
      return { index, price };
    }

    function onPointerDown(e: PointerEvent) {
      el!.setPointerCapture(e.pointerId);
      const pt = pixelToChart(e.clientX, e.clientY);
      if (!pt) return;
      if (drawShape === 'position') {
        quickTradeAnchorRef.current = { index: pt.index, price: pt.price };
        setQuickTradeDraft(null);
        setCustomRRText('');
        return;
      }
      setInProgressDraw({ id: 'preview', index1: pt.index, price1: pt.price, index2: pt.index, price2: pt.price, shape: drawShape! });
    }
    function onPointerMove(e: PointerEvent) {
      const pt = pixelToChart(e.clientX, e.clientY);
      if (!pt) return;
      if (drawShape === 'position') {
        if (!quickTradeAnchorRef.current) return;
        setQuickTradeDraft(computeQuickTradeDraft(quickTradeAnchorRef.current.index, quickTradeAnchorRef.current.price, pt.price, quickTradeRR));
        return;
      }
      setInProgressDraw((prev) => (prev ? { ...prev, index2: pt.index, price2: pt.price } : prev));
    }
    function onPointerUp() {
      if (drawShape === 'position') {
        quickTradeAnchorRef.current = null;
        setQuickTradeDraft((d) => (d && d.stopLoss !== d.entryPrice ? d : null));
        return;
      }
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

  const quickTradeZones: ChartZone[] = useMemo(() => {
    if (!quickTradeDraft || !candles || candles.length === 0) return [];
    const rightEdge = candles.length - 1;
    if (quickTradeDraft.entryIndex > rightEdge) return [];
    const fromIndex = Math.max(0, quickTradeDraft.entryIndex);
    return [
      { fromIndex, toIndex: rightEdge, priceTop: Math.max(quickTradeDraft.entryPrice, quickTradeDraft.stopLoss), priceBottom: Math.min(quickTradeDraft.entryPrice, quickTradeDraft.stopLoss), color: '#ef4444' },
      { fromIndex, toIndex: rightEdge, priceTop: Math.max(quickTradeDraft.entryPrice, quickTradeDraft.takeProfit), priceBottom: Math.min(quickTradeDraft.entryPrice, quickTradeDraft.takeProfit), color: '#22c55e' },
    ];
  }, [quickTradeDraft, candles]);

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

  const inputCls = `w-full pl-8 pr-3 py-2 text-sm rounded-lg border uppercase ${
    dark ? 'bg-smc-dark border-smc-border text-white placeholder:text-white/30' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
  }`;
  const toolBtnCls = (active: boolean) =>
    `flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
      active ? 'bg-corporate-hero text-white' : dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
    }`;

  return (
    <div>
      <PageHeader title="MT5" subtitle="Your own connected MT4/MT5 account's real chart — deploy it in Settings first." />

      <FoldedCard title="MT5" summary={symbol} icon={<LineChart size={19} />} dark={dark} defaultOpen>
        <form
          onSubmit={(e) => { e.preventDefault(); if (symbolInput.trim()) setSymbol(symbolInput.trim().toUpperCase()); }}
          className="relative mb-3"
        >
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-gray-400'}`} />
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="Type a symbol — EURUSD, XAUUSD, GBPJPY..."
            className={inputCls}
          />
        </form>

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

        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setPriceOpen((o) => !o)} aria-label={priceOpen ? 'Hide live price' : 'Show live price'} className={toolBtnCls(priceOpen)}>
            <Zap size={13} /> Price
          </button>
          <button onClick={() => setPositionOpen((o) => !o)} aria-label={positionOpen ? 'Hide position management' : 'Review or manage this position'} className={toolBtnCls(positionOpen)}>
            <Target size={13} /> Position
          </button>
          <Link to={`/trade/manual?tv=OANDA:${encodeURIComponent(symbol)}`} className={toolBtnCls(false)}>
            <Receipt size={13} /> Order
          </Link>
          {priceOpen && (
            livePrice != null
              ? <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{livePrice}</span>
              : priceError
                ? <span className="text-xs text-red-600">{priceError}</span>
                : <span className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>Loading…</span>
          )}
        </div>

        {positionOpen && !notConnected && (
          <div className="mb-3">
            {positionLoading && !position
              ? <PositionLoadingCard dark={dark} />
              : position
                ? <PositionManager trade={position} dark={dark} onChanged={loadPosition} />
                : <NoPositionCard dark={dark} otherTrades={otherOpenTrades} />}
          </div>
        )}

        {candles && (
          <div className={`flex items-center gap-1 mb-2 rounded-lg p-1 w-fit ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
            <button onClick={() => setShowMA((v) => !v)} aria-label={showMA ? 'Hide moving averages' : 'Show moving averages (SMA 20 / SMA 50)'} title="SMA 20 / SMA 50" className={toolBtnCls(showMA)}>
              <TrendingUp size={13} /> MA
            </button>
            <button onClick={toggleQuickTrade} aria-label={drawShape === 'position' ? 'Stop Quick Trade' : 'Quick Trade — drag from entry to stop'} title={drawShape === 'position' ? 'Quick Trade — drag from your entry price down (long) or up (short) to your stop; release to review' : 'Quick Trade — drag on the chart to set Entry + Stop, auto-computes Take Profit'} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${drawShape === 'position' ? 'bg-emerald-600 text-white' : dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}>
              <Zap size={13} /> Quick Trade
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

        {notConnected && (
          <div className={`text-sm py-6 text-center space-y-2 ${dark ? 'text-white/60' : 'text-gray-500'}`}>
            <p>Connect your MT4/MT5 account first — MetaApi has no free public data, so this chart uses your own connection.</p>
            <Link to="/exchange-connections" className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg bg-corporate-hero text-white">
              Settings → Add Exchange
            </Link>
          </div>
        )}
        {!notConnected && error && <p className="text-sm text-red-600 py-4">{error}</p>}
        {!notConnected && !error && !candles && <p className={`text-sm py-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Loading…</p>}
        {!error && candles && (
          <div ref={chartPaneRef} className="relative" style={{ touchAction: 'none', cursor: drawShape ? 'crosshair' : undefined }}>
            <div ref={chartBoxRef}>
              <CandleChart candles={candles} height={CHART_HEIGHT} dark={dark} bullColor={bullColor} bearColor={bearColor} overlaySeries={maSeries} drawings={visibleDrawings} zones={quickTradeZones} />
            </div>
            {quickTradeDraft && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute bottom-4 right-4 z-10 w-32 rounded-xl border p-2 space-y-2 shadow-lg ${dark ? 'bg-[#161b2e] border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white ${quickTradeDraft.direction === 'long' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    <Zap size={9} /> {quickTradeDraft.direction === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                  <button onClick={() => { setQuickTradeDraft(null); setCustomRRText(''); }} aria-label="Discard this quick trade" className={dark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'}>
                    <X size={12} />
                  </button>
                </div>
                <div className="text-[9px] font-mono space-y-1">
                  <div><div className="opacity-60 text-[8px]">Entry</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.entryPrice)}</div></div>
                  <div className="text-red-500"><div className="opacity-70 text-[8px]">Stop Loss</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.stopLoss)}</div></div>
                  <div className="text-emerald-500"><div className="opacity-70 text-[8px]">Take Profit</div><div className="font-semibold">{formatQuickTradePrice(quickTradeDraft.takeProfit)}</div></div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] opacity-60">R:R</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[1, 1.5, 2, 3, 4, 5].map((rr) => (
                      <button
                        key={rr}
                        onClick={() => { applyQuickTradeRR(rr); setCustomRRText(''); }}
                        className={`rounded-md py-1 text-[9px] font-semibold ${quickTradeRR === rr && !customRRText.trim() ? 'bg-corporate-hero text-white' : dark ? 'bg-white/5 text-white/70' : 'bg-black/5 text-gray-600'}`}
                      >
                        {rr}R
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] opacity-60">Custom R</span>
                    <input
                      type="text" inputMode="decimal" placeholder="4.5" value={customRRText}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomRRText(raw);
                        const parsed = Number(raw);
                        if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) applyQuickTradeRR(parsed);
                      }}
                      className={`w-full rounded-md px-1.5 py-1 text-[9px] outline-none border ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-white border-gray-200 text-corporate-text-on-bg placeholder:text-gray-300'}`}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      tv: `OANDA:${symbol}`,
                      qtDirection: quickTradeDraft.direction,
                      qtEntry: String(quickTradeDraft.entryPrice),
                      qtStop: String(quickTradeDraft.stopLoss),
                      qtTarget: String(quickTradeDraft.takeProfit),
                    });
                    navigate(`/trade/manual?${params.toString()}`);
                  }}
                  className="w-full rounded-lg py-1.5 text-[10px] leading-tight font-bold text-white bg-corporate-hero hover:opacity-90"
                >
                  Use in Order Ticket
                </button>
              </div>
            )}
          </div>
        )}
      </FoldedCard>
    </div>
  );
}
