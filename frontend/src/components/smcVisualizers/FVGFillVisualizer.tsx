import { useState } from 'react';
import { CandleChart, type Candle, type ChartZone, type ChartLine } from '../CandleChart';

/**
 * FVGFillVisualizer — shared SMC-concept component (SMC Bot Academy
 * plan item 3): an interactive 0-100% Fair Value Gap fill slider.
 *
 * The fill math here is the REAL formula from
 * `FVGDetector.track_mitigation` (backend/app/core/smc_algorithms.py):
 * for a bullish FVG, `mitigated_percent = (fvg.top - max(close,
 * fvg.bottom)) / gap_size` — the gap fills from its TOP edge downward
 * toward its bottom (price dropping back INTO the gap from above). A
 * bearish FVG mirrors this: it fills from its BOTTOM edge upward. At
 * 100%, `candle.close` has traded fully through the far edge and the
 * zone's real status flips from ACTIVE to MITIGATED
 * (`fvg.status = MitigationStatus.MITIGATED`) — this is a real status
 * transition in the code, not a cosmetic label.
 *
 * The shaded 30%-70% band is Bot 3's (`FVGExpansionBot`) and Bot 7's
 * (`FVGExpansionV3Bot`) real, verified qualifying window —
 * `partial_fvgs = [f for f in fvgs if 0.3 <= f.mitigated_percent <=
 * 0.7 and f.status.name == "ACTIVE"]` — not an illustrative
 * approximation. A gap outside this window (too fresh, under 30%, or
 * nearly filled, over 70%) is real, verified-against-code ineligible
 * for either bot, exactly as this visualizer reports below the chart.
 *
 * The candles themselves are a hand-authored, clearly-labeled
 * illustrative schematic (same convention as `SMCDiagram.tsx`), not
 * real market data — only the fill-percentage math and the 30/70
 * thresholds are drawn from the real, verified formulas above.
 */
export function FVGFillVisualizer({ dark = false }: { dark?: boolean }) {
  const [fillPct, setFillPct] = useState(45);
  const [direction, setDirection] = useState<'bullish' | 'bearish'>('bullish');

  const isBullish = direction === 'bullish';

  // A clean, idealized 3-candle FVG setup plus a few candles of
  // "price returns to test the gap" room, same spirit as
  // SMCDiagram's own schematics.
  const candles: Candle[] = isBullish
    ? [
        { open: 100, high: 102, low: 99, close: 101 },
        { open: 101, high: 109, low: 100.5, close: 108 },
        { open: 108, high: 110, low: 107.5, close: 109 },
        { open: 109, high: 111, low: 106, close: 107 },
        { open: 107, high: 108, low: 103, close: 104 },
        { open: 104, high: 106, low: 101, close: 102 },
      ]
    : [
        { open: 112, high: 113, low: 110, close: 111 },
        { open: 111, high: 111.5, low: 103, close: 104 },
        { open: 104, high: 104.5, low: 102.5, close: 103 },
        { open: 103, high: 107, low: 102, close: 106 },
        { open: 106, high: 110, low: 105, close: 109 },
        { open: 109, high: 112, low: 108, close: 111 },
      ];

  // Real gap edges: bullish gap = [c1.high, c3.low]; bearish gap =
  // [c3.high, c1.low] — matching FVGDetector.detect_fvg exactly.
  const gapBottom = isBullish ? candles[0].high : candles[2].high;
  const gapTop = isBullish ? candles[2].low : candles[0].low;
  const gapSize = gapTop - gapBottom;

  // Boundary price at the current fill% — bullish fills top-down,
  // bearish fills bottom-up, per track_mitigation's real math.
  const boundary = isBullish
    ? gapTop - (fillPct / 100) * gapSize
    : gapBottom + (fillPct / 100) * gapSize;

  const fromIndex = 1;
  const toIndex = candles.length - 1;

  const filledZone: ChartZone = isBullish
    ? { fromIndex, toIndex, priceTop: gapTop, priceBottom: boundary, color: '#94a3b8', label: 'Filled' }
    : { fromIndex, toIndex, priceTop: boundary, priceBottom: gapBottom, color: '#94a3b8', label: 'Filled' };

  const remainingZone: ChartZone = isBullish
    ? { fromIndex, toIndex, priceTop: boundary, priceBottom: gapBottom, color: '#0891b2', label: `FVG — ${fillPct}% filled` }
    : { fromIndex, toIndex, priceTop: gapTop, priceBottom: boundary, color: '#0891b2', label: `FVG — ${fillPct}% filled` };

  const price30 = isBullish ? gapTop - 0.3 * gapSize : gapBottom + 0.3 * gapSize;
  const price70 = isBullish ? gapTop - 0.7 * gapSize : gapBottom + 0.7 * gapSize;

  const lines: ChartLine[] = [
    { price: price30, label: '30%', color: '#16a34a', dashed: true },
    { price: price70, label: '70%', color: '#16a34a', dashed: true },
  ];

  const isMitigated = fillPct >= 100;
  const eligible = !isMitigated && fillPct >= 30 && fillPct <= 70;

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={`text-sm font-semibold ${textCls}`}>FVG Fill Visualizer</div>
        <div className="flex gap-1.5">
          {(['bullish', 'bearish'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                direction === d
                  ? 'bg-corporate-hero text-white border-corporate-hero'
                  : dark
                    ? 'border-corporate-border-dark text-white/70'
                    : 'border-gray-200 text-gray-600'
              }`}
            >
              {d === 'bullish' ? 'Bullish gap' : 'Bearish gap'}
            </button>
          ))}
        </div>
      </div>

      <CandleChart candles={candles} zones={[filledZone, remainingZone]} lines={lines} dark={dark} height={220} />

      <div className="mt-4">
        <div className={`text-[11px] font-semibold mb-1.5 ${mutedCls}`}>Mitigation — {fillPct}% filled</div>
        <input
          type="range" min={0} max={100} step={1} value={fillPct}
          onChange={(e) => setFillPct(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          Status: <span className="font-semibold">{isMitigated ? 'MITIGATED' : 'ACTIVE'}</span>
          {' — '}
          Bot 3 / Bot 7 entry window (30-70%, ACTIVE):{' '}
          <span className={`font-semibold ${eligible ? 'text-green-500' : 'text-amber-500'}`}>
            {eligible ? 'ELIGIBLE' : 'not eligible'}
          </span>
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          Verified against <code>FVGDetector.track_mitigation</code>'s real{' '}
          <code>mitigated_percent</code> formula and{' '}
          <code>FVGExpansionBot</code>/<code>FVGExpansionV3Bot</code>'s real{' '}
          <code>0.3 &lt;= mitigated_percent &lt;= 0.7</code> eligibility test
          (<code>bot_strategies.py</code>) — candles are an illustrative
          schematic, not real market data.
        </div>
      </div>
    </div>
  );
}
