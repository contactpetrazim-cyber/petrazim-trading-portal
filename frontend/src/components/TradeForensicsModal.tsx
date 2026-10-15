import { useEffect, useMemo, useState } from 'react';
import { X, Microscope, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff } from 'lucide-react';
import { tradesApi } from '../services/api';
import type { TradeForensics, SnapshotTimeframe } from '../types';
import { CandleChart, computeChartRange, type Candle, type ChartZone, type ChartMarker, type ChartLine } from './CandleChart';
import { nearestCandleIndex } from '../lib/positionChartOverlay';
import { useYAxisZoom, applyYZoom } from '../hooks/useYAxisZoom';

const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const PURPLE = '#8b5cf6';

// Forensics structure keys ("4H"/"1H"/"15M"/...) -> the matching
// SnapshotTimeframe the existing /trades/{id}/snapshot endpoint
// already serves real candles for. Reusing that endpoint (rather than
// adding a second candle fetch path) means the chart underneath these
// annotations is the SAME real exchange data compute_trade_forensics
// itself detected swing points/OBs/FVGs/sweeps against.
const STRUCTURE_TO_SNAPSHOT_TF: Record<string, SnapshotTimeframe> = {
  '1D': '1d', '4H': '4h', '1H': '1h', '15M': '15m', '5M': '5m',
};
// Coarse -> fine, same convention as the backend's own TF_ORDER
// (engines/strategy_adapter.py).
const TF_ORDER = ['1D', '4H', '1H', '15M', '5M'];

const OB_COLOR: Record<string, string> = { premium: RED, discount: GREEN, equilibrium: AMBER };

/**
 * TradeForensicsModal — Part 10 ("TradingView and Historical Chart
 * Analysis") rendered as a real annotated chart: the SMC structure
 * GET /trades/{id}/forensics reconstructed (swing points, BOS/CHoCH,
 * order blocks, FVGs, liquidity sweeps) drawn as zones/markers on top
 * of the real candles for whichever required timeframe is selected,
 * plus the real price-path stats (MFE/MAE, which TP levels were
 * actually reached) and the plain-English narrative underneath.
 *
 * The forensics endpoint itself returns structural data (prices +
 * real formation timestamps), not a candle array — this fetches the
 * candles separately via the existing trade_snapshot endpoint (same
 * real data source, already wired to CandleChart elsewhere) and places
 * each zone/marker by matching its own real timestamp to the nearest
 * candle, via the SAME floor-match nearestCandleIndex every other
 * chart in the portal already uses.
 */
export function TradeForensicsModal({ tradeId, dark, onClose }: { tradeId: string; dark: boolean; onClose: () => void }) {
  const [forensics, setForensics] = useState<TradeForensics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    tradesApi.getTradeForensics(tradeId)
      .then((f) => {
        setForensics(f);
        const keys = Object.keys(f.structure);
        // Default to the FINEST available required timeframe — the
        // one closest to this bot's own actual entry/exit granularity.
        const finest = [...keys].sort((a, b) => TF_ORDER.indexOf(b) - TF_ORDER.indexOf(a))[0] ?? null;
        setTimeframe(finest);
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Could not reconstruct this trade right now.'))
      .finally(() => setLoading(false));
  }, [tradeId]);

  const availableTfs = useMemo(
    () => (forensics ? Object.keys(forensics.structure).sort((a, b) => TF_ORDER.indexOf(a) - TF_ORDER.indexOf(b)) : []),
    [forensics],
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Microscope size={16} className={dark ? 'text-white/50' : 'text-gray-400'} />
            <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
              {forensics?.symbol || '…'} — Trade Forensics
            </span>
          </div>
          <div className="flex items-center gap-2">
            {availableTfs.length > 0 && (
              <div className={`inline-flex items-center gap-0.5 rounded-md p-0.5 ${dark ? 'bg-white/5' : 'bg-gray-100'}`}>
                {availableTfs.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      timeframe === tf ? (dark ? 'bg-white/20 text-white' : 'bg-white text-corporate-text-on-bg shadow-sm') : dark ? 'text-white/40' : 'text-gray-500'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} className={dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
              <X size={18} />
            </button>
          </div>
        </div>

        {loading && <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Reconstructing real SMC structure around this trade's entry…</p>}
        {!loading && error && <p className={`text-sm ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}
        {!loading && !error && forensics && timeframe && (
          <ForensicsBody forensics={forensics} timeframe={timeframe} tradeId={tradeId} dark={dark} />
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, shape = 'dot' }: { color: string; label: string; shape?: 'dot' | 'diamond' }) {
  return (
    <span className="flex items-center gap-1">
      {shape === 'diamond' ? (
        <span className="inline-block w-2 h-2 rotate-45" style={{ background: color }} />
      ) : (
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

const OUTCOME_BADGE_CLS: Record<string, string> = {
  win: 'bg-emerald-500/15 text-emerald-500',
  loss: 'bg-red-500/15 text-red-500',
  breakeven: 'bg-amber-500/15 text-amber-500',
  unresolved: 'bg-gray-500/15 text-gray-500',
};

// X-axis zoom bounds — same spirit as PositionOnChartModal's own
// zoomIn/zoomOut (0.7x/1.4x per step), but far simpler: this is a
// read-only diagnostic chart (no pan gestures, no drawing tools), so
// zoom just shrinks/grows how many of the fetched candles are shown,
// re-centered on the entry candle each time rather than tracking a
// separate pan offset.
const MIN_VISIBLE_CANDLES = 8;

function ForensicsBody({ forensics, timeframe, tradeId, dark }: { forensics: TradeForensics; timeframe: string; tradeId: string; dark: boolean }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesError, setCandlesError] = useState<string | null>(null);
  const [candlesLoading, setCandlesLoading] = useState(true);
  // X-axis zoom — by direct request ("Add x axis and y axis zoom").
  // null = unzoomed (show every fetched candle, the original
  // behavior); reset on every timeframe/candle-fetch change so
  // switching tabs doesn't carry over a zoom level sized for a
  // different candle count.
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const { yZoom, zoomInY, zoomOutY, resetY } = useYAxisZoom();
  // Annotation toggle — by direct request ("as many annotations
  // 'sweep' cover the reading of the price charts"): a trade with a
  // lot of real liquidity-sweep/BOS/CHoCH activity can produce enough
  // overlapping labels to obscure the candles themselves. Off hides
  // the SMC structure zones/markers but keeps the Entry/SL/TP1/Exit
  // reference lines — those aren't the clutter being complained
  // about, and are the one thing you'd still want visible either way.
  const [annotationsOn, setAnnotationsOn] = useState(true);

  useEffect(() => {
    const snapTf = STRUCTURE_TO_SNAPSHOT_TF[timeframe];
    if (!snapTf) {
      setCandles([]);
      setCandlesLoading(false);
      return;
    }
    setCandlesLoading(true);
    setCandlesError(null);
    setVisibleCount(null);
    resetY();
    tradesApi.getTradeSnapshot(tradeId, snapTf)
      .then((s) => setCandles(s.candles.map((c) => ({ time: new Date(c.timestamp).getTime(), open: c.open, high: c.high, low: c.low, close: c.close }))))
      .catch((e) => setCandlesError(e?.response?.data?.detail || 'Could not load real candles for this timeframe.'))
      .finally(() => setCandlesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId, timeframe]);

  const struct = forensics.structure[timeframe];

  // The visible slice of `candles`, re-centered on the entry candle
  // whenever zoomed in (visibleCount < full length) so zooming in
  // actually shows the trade's own setup rather than whatever happens
  // to be at the end of the fetched window.
  const visibleCandles = useMemo(() => {
    if (visibleCount == null || visibleCount >= candles.length) return candles;
    const entryIdx = nearestCandleIndex(candles, forensics.entry_timestamp) ?? candles.length - 1;
    let start = entryIdx - Math.floor(visibleCount / 2);
    start = Math.max(0, Math.min(start, candles.length - visibleCount));
    return candles.slice(start, start + visibleCount);
  }, [candles, visibleCount, forensics.entry_timestamp]);

  function zoomInX() { setVisibleCount((v) => Math.max(MIN_VISIBLE_CANDLES, Math.round((v ?? candles.length) * 0.7))); }
  function zoomOutX() { setVisibleCount((v) => (v == null ? null : Math.min(candles.length, Math.round(v * 1.4)) >= candles.length ? null : Math.round(v * 1.4))); }
  function resetX() { setVisibleCount(null); }

  const { zones, markers, lines } = useMemo(() => {
    if (!struct || visibleCandles.length === 0) return { zones: [] as ChartZone[], markers: [] as ChartMarker[], lines: [] as ChartLine[] };
    const lastIdx = visibleCandles.length - 1;

    // Zones (order blocks, FVGs) have a real formation timestamp but
    // no "tested until" timestamp, so each is drawn from its own
    // formation candle through to the right edge — a zone that formed
    // before this chart's own visible window (the forensics structure
    // fetch looks back 40 real days; the snapshot's own candle window
    // is much shorter) clamps to index 0 rather than being dropped, so
    // it still shows as real and active, just pinned to the left edge.
    // Indices are computed against visibleCandles (the current X-zoom
    // slice), not the full fetched set, so they stay correct at every
    // zoom level without a separate offset to track.
    const zones: ChartZone[] = [];
    if (annotationsOn) {
      (struct.order_blocks ?? []).forEach((ob) => {
        const fromIdx = ob.formed_at != null ? nearestCandleIndex(visibleCandles, ob.formed_at) ?? 0 : 0;
        zones.push({
          fromIndex: fromIdx, toIndex: lastIdx,
          priceTop: ob.top, priceBottom: ob.bottom,
          color: OB_COLOR[ob.classification ?? ''] ?? PURPLE,
          label: `OB${ob.classification ? ` (${ob.classification})` : ''}`,
        });
      });
      (struct.fvgs ?? []).forEach((f) => {
        const fromIdx = f.formed_at != null ? nearestCandleIndex(visibleCandles, f.formed_at) ?? 0 : 0;
        zones.push({
          fromIndex: fromIdx, toIndex: lastIdx,
          priceTop: f.top, priceBottom: f.bottom,
          color: f.gap_type === 'bullish' ? GREEN : RED,
          label: `FVG ${Math.round(f.mitigated_percent * 100)}%`,
        });
      });
    }

    const markers: ChartMarker[] = [];
    if (annotationsOn) {
      (struct.swing_points ?? []).forEach((s) => {
        const idx = nearestCandleIndex(visibleCandles, s.timestamp);
        if (idx == null) return;
        const isHigh = s.type === 'SWING_HIGH';
        markers.push({ index: idx, price: s.price, label: isHigh ? 'SH' : 'SL', color: isHigh ? RED : GREEN, side: isHigh ? 'above' : 'below' });
      });
      (struct.bos_events ?? []).forEach((b) => {
        const idx = nearestCandleIndex(visibleCandles, b.timestamp);
        if (idx == null || b.structure_level == null) return;
        markers.push({ index: idx, price: b.structure_level, label: 'BOS', color: BLUE, shape: 'diamond' });
      });
      (struct.choch_events ?? []).forEach((c) => {
        const idx = nearestCandleIndex(visibleCandles, c.timestamp);
        if (idx == null || c.structure_level == null) return;
        markers.push({ index: idx, price: c.structure_level, label: 'CHoCH', color: AMBER, shape: 'diamond' });
      });
      (struct.liquidity_sweeps ?? []).forEach((sw) => {
        const idx = nearestCandleIndex(visibleCandles, sw.timestamp);
        if (idx == null) return;
        markers.push({ index: idx, price: sw.sweep_price, label: 'Sweep', color: PURPLE, shape: 'diamond' });
      });
    }

    const lines: ChartLine[] = [];
    if (forensics.entry_price != null) lines.push({ price: forensics.entry_price, label: 'Entry', color: dark ? '#60a5fa' : '#005FB8', dashed: true });
    if (forensics.stop_loss != null) lines.push({ price: forensics.stop_loss, label: 'SL', color: RED, dashed: true });
    if (forensics.take_profit_1 != null) lines.push({ price: forensics.take_profit_1, label: 'TP1', color: GREEN, dashed: true });
    if (forensics.exit_price != null) lines.push({ price: forensics.exit_price, label: 'Exit', color: AMBER, dashed: true });

    return { zones, markers, lines };
  }, [struct, visibleCandles, forensics, dark, annotationsOn]);

  const priceRange = useMemo(() => {
    if (visibleCandles.length === 0) return undefined;
    const auto = computeChartRange(visibleCandles, zones, lines, markers);
    return applyYZoom(auto.yTop, auto.yBottom, yZoom);
  }, [visibleCandles, zones, lines, markers, yZoom]);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const { mfe_r, mae_r, reached, would_have_reached_post_exit, note } = forensics.price_path;
  const feasibleLevels = would_have_reached_post_exit
    ? (['tp1', 'tp2', 'tp3'] as const).filter((lvl) => !reached[lvl] && would_have_reached_post_exit[lvl])
    : [];

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-3 text-xs">
        <span className={`px-2 py-0.5 rounded-full font-semibold ${OUTCOME_BADGE_CLS[forensics.outcome] ?? OUTCOME_BADGE_CLS.unresolved}`}>
          {forensics.outcome.toUpperCase()}{forensics.r_multiple != null ? ` (${forensics.r_multiple.toFixed(2)}R)` : ''}
        </span>
        <span className={mutedCls}>{forensics.direction.toUpperCase()} · {forensics.bot_id}</span>
        <span className={mutedCls}>
          HTF bias ({forensics.htf_timeframe}): <strong className={dark ? 'text-white' : 'text-gray-800'}>{forensics.htf_bias}</strong>
        </span>
      </div>

      {!candlesLoading && !candlesError && candles.length > 0 && (
        <div className={`flex items-center gap-1 mb-2 rounded-lg p-1 w-fit ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
          <span className={`text-[10px] font-semibold px-0.5 ${mutedCls}`}>X</span>
          <button onClick={zoomOutX} disabled={visibleCount == null} aria-label="Zoom out time axis" title="Zoom out time axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <ZoomOut size={14} />
          </button>
          <button onClick={zoomInX} disabled={visibleCount != null && visibleCount <= MIN_VISIBLE_CANDLES} aria-label="Zoom in time axis" title="Zoom in time axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <ZoomIn size={14} />
          </button>
          <span className={`text-[10px] font-semibold px-1 ${mutedCls}`}>Y</span>
          <button onClick={zoomOutY} disabled={yZoom <= 0.25} aria-label="Zoom out price axis" title="Zoom out price axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <ZoomOut size={14} />
          </button>
          <button onClick={zoomInY} disabled={yZoom >= 6} aria-label="Zoom in price axis" title="Zoom in price axis" className={`p-1.5 rounded-md disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => { resetX(); resetY(); }}
            disabled={visibleCount == null && yZoom === 1}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-30 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Maximize2 size={12} /> Reset
          </button>
          <button
            onClick={() => setAnnotationsOn((a) => !a)}
            title={annotationsOn ? 'Hide SMC structure annotations' : 'Show SMC structure annotations'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ml-1 border-l ${dark ? 'border-white/10 text-white/50 hover:text-white' : 'border-black/10 text-gray-500 hover:text-gray-700'}`}
          >
            {annotationsOn ? <Eye size={12} /> : <EyeOff size={12} />} Annotations {annotationsOn ? 'On' : 'Off'}
          </button>
        </div>
      )}

      {candlesLoading && <p className={`text-sm ${mutedCls}`}>Loading real {timeframe} candles…</p>}
      {!candlesLoading && candlesError && <p className={`text-sm ${dark ? 'text-red-400' : 'text-red-500'}`}>{candlesError}</p>}
      {!candlesLoading && !candlesError && visibleCandles.length > 0 && (
        <CandleChart candles={visibleCandles} zones={zones} markers={markers} lines={lines} dark={dark} height={300} rightMargin={6} priceRangeOverride={priceRange} />
      )}
      {!candlesLoading && !candlesError && candles.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No real candles available for this timeframe's window.</p>
      )}
      {struct?.note && <p className={`text-xs mt-2 ${mutedCls}`}>{struct.note}</p>}

      <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed ${dark ? 'bg-white/5 text-white/70' : 'bg-gray-50 text-gray-600'}`}>
        {forensics.narrative}
      </div>

      <div className="flex items-center gap-4 flex-wrap mt-3 text-xs">
        {mfe_r != null && <span className={mutedCls}>MFE: <strong style={{ color: GREEN }}>{mfe_r.toFixed(2)}R</strong></span>}
        {mae_r != null && <span className={mutedCls}>MAE: <strong style={{ color: RED }}>{mae_r.toFixed(2)}R</strong></span>}
        {(['tp1', 'tp2', 'tp3'] as const).map((lvl) => (
          <span key={lvl} className={mutedCls}>
            {lvl.toUpperCase()}: {reached[lvl] ? <span style={{ color: GREEN }}>reached</span> : <span>not reached</span>}
          </span>
        ))}
        {note && <span className={dark ? 'text-amber-400' : 'text-amber-600'}>{note}</span>}
      </div>
      {feasibleLevels.length > 0 && (
        <p className={`text-xs mt-1 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
          Target feasibility: {feasibleLevels.map((l) => l.toUpperCase()).join(', ')} would have been reached within 6h after exit had the stop not closed the trade first.
        </p>
      )}

      <div className={`flex items-center gap-3 flex-wrap mt-3 text-[11px] ${mutedCls}`}>
        <Legend color={RED} label="Premium OB / Bear FVG" />
        <Legend color={GREEN} label="Discount OB / Bull FVG" />
        <Legend color={AMBER} label="Equilibrium OB" />
        <Legend color={BLUE} label="BOS" shape="diamond" />
        <Legend color={AMBER} label="CHoCH" shape="diamond" />
        <Legend color={PURPLE} label="Liquidity sweep" shape="diamond" />
      </div>
    </div>
  );
}
