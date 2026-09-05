import { CandleChart, type Candle, type ChartZone, type ChartMarker, type ChartLine } from './CandleChart';

interface DiagramConfig {
  title: string;
  candles: Candle[];
  zones?: ChartZone[];
  markers?: ChartMarker[];
  lines?: ChartLine[];
  caption: string;
}

/**
 * SMCDiagram — a small library of hand-authored, clearly-labeled
 * ILLUSTRATIVE schematics (not real market data) for the core Smart
 * Money Concepts terms this curriculum's own authored lessons already
 * use (Fair Value Gap, Order Block, Liquidity Sweep, Premium/Discount,
 * Break of Structure). Deliberately idealized/clean rather than a
 * messy real chart — the same reason a textbook draws a clean example
 * before showing a real, ambiguous one: a first encounter with a
 * concept is clearer without real-chart noise. GET /order-flow/klines
 * (real historical candles) backs the separate "What Happens Next?"
 * and case-study features instead, where realism matters more than
 * clarity.
 */
const DIAGRAMS: Record<string, DiagramConfig> = {
  'fair-value-gap': {
    title: 'Fair Value Gap (FVG)',
    candles: [
      { open: 100, high: 102, low: 99, close: 101 },
      { open: 101, high: 103, low: 100, close: 102 },
      { open: 102, high: 110, low: 101.5, close: 109 },
      { open: 109, high: 112, low: 107, close: 111 },
      { open: 111, high: 113, low: 108, close: 109 },
      { open: 109, high: 110, low: 104, close: 106 },
      { open: 106, high: 109, low: 105, close: 108 },
    ],
    zones: [{ fromIndex: 1, toIndex: 3, priceTop: 107, priceBottom: 103, color: '#0891b2', label: 'FVG' }],
    caption:
      'Candle 2\'s big move leaves a gap between candle 1\'s high (103) and candle 3\'s low (107) — no trading occurred in that range. Price often returns to "fill" this imbalance before continuing, as it does here in candles 5-6.',
  },
  'order-block': {
    title: 'Order Block',
    candles: [
      { open: 100, high: 101, low: 98, close: 99 },
      { open: 99, high: 100, low: 96, close: 97 },
      { open: 97, high: 98, low: 94, close: 95 },
      { open: 95, high: 112, low: 94.5, close: 110 },
      { open: 110, high: 114, low: 108, close: 112 },
      { open: 112, high: 113, low: 100, close: 102 },
      { open: 102, high: 106, low: 100, close: 105 },
    ],
    zones: [{ fromIndex: 2, toIndex: 2, priceTop: 98, priceBottom: 94, color: '#8b5cf6', label: 'OB' }],
    markers: [{ index: 3, price: 112, label: 'impulse', color: '#8b5cf6', side: 'above' }],
    caption:
      'The last down-candle (candle 3) right before a strong impulsive move up is the "order block" — the last place institutional orders were likely resting before price left. Price sweeping back into that same candle\'s range (candles 6) is a common reaction zone.',
  },
  'liquidity-sweep': {
    title: 'Liquidity Sweep',
    candles: [
      { open: 105, high: 106, low: 103, close: 104 },
      { open: 104, high: 105, low: 102, close: 103 },
      { open: 103, high: 104, low: 100, close: 102 },
      { open: 102, high: 103, low: 100.2, close: 101.5 },
      { open: 101.5, high: 102, low: 97, close: 101.8 },
      { open: 101.8, high: 105, low: 101, close: 104 },
      { open: 104, high: 108, low: 103.5, close: 107 },
    ],
    lines: [{ price: 100, label: 'prior swing low', color: '#ef4444', dashed: true }],
    markers: [{ index: 4, price: 97, label: 'sweep + close back above', color: '#ef4444', side: 'below' }],
    caption:
      'Price wicks below the prior swing low (100) — triggering resting stop-loss orders below it — then closes back ABOVE that level on the same candle. The wick is the stop-hunt; the close is what confirms it was a sweep, not a genuine breakdown.',
  },
  'premium-discount': {
    title: 'Premium / Discount',
    candles: [
      { open: 100, high: 101, low: 99, close: 100.5 },
      { open: 100.5, high: 108, low: 100, close: 107 },
      { open: 107, high: 110, low: 106, close: 108 },
      { open: 108, high: 109, low: 105, close: 106 },
      { open: 106, high: 107, low: 102, close: 103 },
      { open: 103, high: 104, low: 100.5, close: 101.5 },
    ],
    zones: [
      { fromIndex: 0, toIndex: 5, priceTop: 110, priceBottom: 105, color: '#ef4444', label: 'Premium (expensive)' },
      { fromIndex: 0, toIndex: 5, priceTop: 105, priceBottom: 100, color: '#22c55e', label: 'Discount (cheap)' },
    ],
    lines: [{ price: 105, label: 'equilibrium (50%)', color: '#6b7280', dashed: true }],
    caption:
      'Split any clear range at its midpoint (equilibrium). The upper half is "premium" — favor looking for shorts there. The lower half is "discount" — favor looking for longs. It\'s relative positioning within the range, not a price prediction.',
  },
  'break-of-structure': {
    title: 'Break of Structure (BOS)',
    candles: [
      { open: 100, high: 104, low: 99, close: 103 },
      { open: 103, high: 105, low: 101, close: 102 },
      { open: 102, high: 103, low: 98, close: 99 },
      { open: 99, high: 106, low: 98.5, close: 105 },
      { open: 105, high: 109, low: 104, close: 108 },
      { open: 108, high: 111, low: 106, close: 110 },
    ],
    lines: [{ price: 105, label: 'prior swing high', color: '#22c55e', dashed: true }],
    markers: [{ index: 4, price: 109, label: 'BOS — closes above prior high', color: '#22c55e', side: 'above' }],
    caption:
      'A prior swing high (105) gets taken out with a genuine CLOSE above it (candle 4), not just a wick — that\'s a Break of Structure, confirming the trend has (or is resuming) an upward bias. The same logic applies downward for a bearish BOS.',
  },
};

export type SMCDiagramKey = keyof typeof DIAGRAMS;
export const SMC_DIAGRAM_KEYS = Object.keys(DIAGRAMS) as SMCDiagramKey[];
// Exposed so ConceptSpotterGame can show the same real diagram data
// unannotated (candles only, no zone/label overlay) and ask the
// trainee to name the concept themselves before the labeled version
// (this SMCDiagram component) reveals it.
export const SMC_DIAGRAM_DATA = DIAGRAMS;

export function SMCDiagram({ concept, dark = false }: { concept: keyof typeof DIAGRAMS; dark?: boolean }) {
  const d = DIAGRAMS[concept];
  if (!d) return null;
  return (
    <div className={`rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>{d.title} — illustrative</div>
      <CandleChart candles={d.candles} zones={d.zones} markers={d.markers} lines={d.lines} dark={dark} height={200} />
      <p className={`text-xs mt-3 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-600'}`}>{d.caption}</p>
    </div>
  );
}
