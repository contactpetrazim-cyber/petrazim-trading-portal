import { CandleChart, type Candle, type ChartZone, type ChartMarker, type ChartLine } from './CandleChart';

export interface TimeframePanel {
  label: string;
  candles: Candle[];
  zones?: ChartZone[];
  markers?: ChartMarker[];
  lines?: ChartLine[];
}

/**
 * TimeframePanels — small side-by-side CandleChart panels, one per
 * timeframe, for scenarios that describe more than one chart at once
 * ("Daily is bullish, 4H is pulling back into a zone, 15M shows a
 * reversal candle right there"). MTF Alignment's whole premise is
 * reading several timeframes together, which is exactly the case
 * words alone struggle to convey — this turns each of those
 * descriptions into what it would actually look like stacked side by
 * side. Reuses CandleChart per panel rather than inventing a second
 * renderer, same idealized/illustrative-not-real-data approach as
 * SMCDiagram.tsx (see that file's own docstring on why).
 */
export function TimeframePanels({ panels, dark = false, height = 110 }: { panels: TimeframePanel[]; dark?: boolean; height?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}>
      {panels.map((p, i) => (
        <div key={i} className={`rounded-xl p-2 border ${dark ? 'border-white/10 bg-white/5' : 'border-[#dcdce8] bg-corporate-bg'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 text-center ${dark ? 'text-white/50' : 'text-gray-500'}`}>{p.label}</div>
          <CandleChart candles={p.candles} zones={p.zones} markers={p.markers} lines={p.lines} dark={dark} height={height} />
        </div>
      ))}
    </div>
  );
}
