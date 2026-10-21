import { useState } from 'react';
import { CandleChart, type Candle, type ChartLine, type ChartMarker } from '../CandleChart';

type Scenario = 'valid-bos' | 'wick-only' | 'choch';

/**
 * BOSCHoCHVisualizer — shared SMC-concept component (SMC Bot Academy
 * plan item 3): emphasizes the universal, verified rule that BOS and
 * CHoCH are both BODY-CLOSE-based everywhere in this codebase, never
 * wick-based.
 *
 * Verified against `MarketStructureDetector.detect_bos`
 * (backend/app/core/smc_algorithms.py): a bullish BOS requires
 * `candle.close > high.price and candle.open < high.price` — the
 * swing level must be crossed by the candle's BODY, not merely
 * touched by its wick. The "wick-only" scenario below is real,
 * verified-against-code INVALID input for every bot on this
 * platform — not a simplification.
 *
 * `detect_choch` is the same body-close confirmation, applied to the
 * most recent INTERNAL (not necessarily swing) level, AGAINST the
 * prevailing trend direction — the "CHoCH" scenario shows that
 * distinction next to BOS for direct comparison.
 */
export function BOSCHoCHVisualizer({ dark = false }: { dark?: boolean }) {
  const [scenario, setScenario] = useState<Scenario>('valid-bos');

  const swingLevel = 106;

  const candlesFor: Record<Scenario, Candle[]> = {
    'valid-bos': [
      { open: 100, high: 102, low: 99, close: 101 },
      { open: 101, high: 106.2, low: 100.5, close: 103 }, // the swing high candle itself
      { open: 103, high: 104.5, low: 102, close: 104 },
      { open: 104, high: 108, low: 103.5, close: 107.5 }, // body close ABOVE swing level -> valid BOS
    ],
    'wick-only': [
      { open: 100, high: 102, low: 99, close: 101 },
      { open: 101, high: 106.2, low: 100.5, close: 103 },
      { open: 103, high: 104.5, low: 102, close: 104 },
      { open: 104, high: 108, low: 103.5, close: 105 }, // wick pokes above, but closes back BELOW -> no BOS
    ],
    choch: [
      { open: 110, high: 111, low: 108, close: 109 }, // prevailing downtrend
      { open: 109, high: 109.5, low: 104, close: 105 },
      { open: 105, high: 106, low: 101, close: 102 },
      { open: 102, high: 108, low: 101.5, close: 107 }, // body close through the internal high -> CHoCH, against the downtrend
    ],
  };

  const candles = candlesFor[scenario];
  const level = scenario === 'choch' ? 106.5 : swingLevel;

  const lines: ChartLine[] = [
    { price: level, label: scenario === 'choch' ? 'Internal high' : 'Swing high', color: '#64748b' },
  ];

  const breakoutCandleIndex = 3;
  const breakoutCandle = candles[breakoutCandleIndex];
  const isValidBreak = breakoutCandle.close > level && breakoutCandle.open < level;

  const markers: ChartMarker[] = isValidBreak
    ? [{ index: breakoutCandleIndex, price: breakoutCandle.close, label: scenario === 'choch' ? 'CHoCH confirmed' : 'BOS confirmed', color: '#22c55e', shape: 'triangle-up' }]
    : [{ index: breakoutCandleIndex, price: breakoutCandle.high, label: 'No BOS — wick only', color: '#ef4444', shape: 'diamond' }];

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  const scenarios: { id: Scenario; label: string }[] = [
    { id: 'valid-bos', label: 'Valid BOS (body close)' },
    { id: 'wick-only', label: 'Wick only (invalid)' },
    { id: 'choch', label: 'CHoCH (against trend)' },
  ];

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={`text-sm font-semibold ${textCls}`}>BOS / CHoCH Visualizer</div>
        <div className="flex gap-1.5 flex-wrap">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                scenario === s.id
                  ? 'bg-corporate-hero text-white border-corporate-hero'
                  : dark
                    ? 'border-corporate-border-dark text-white/70'
                    : 'border-gray-200 text-gray-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <CandleChart candles={candles} lines={lines} markers={markers} dark={dark} height={220} />

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          {scenario === 'wick-only'
            ? 'This candle\'s wick pokes above the swing high, but its BODY closes back below it — real, verified-against-code invalid: detect_bos requires close > level AND open < level, a body close through the level, not a wick touch.'
            : scenario === 'choch'
              ? 'This body close breaks the most recent internal high WHILE the prevailing swing structure is still a downtrend — the defining feature of CHoCH vs. BOS (which breaks WITH the trend).'
              : 'This candle\'s body closes fully above the swing high (open below, close above) — a real, verified BOS per detect_bos\'s exact condition.'}
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          BOS and CHoCH are body-close-based everywhere in this codebase, never wick-based — a
          universal rule, true for all 7 bots, verified in <code>MarketStructureDetector</code>.
        </div>
      </div>
    </div>
  );
}
