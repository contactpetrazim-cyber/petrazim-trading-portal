import { useState, useMemo } from 'react';
import { CandleChart, type Candle, type ChartMarker } from '../CandleChart';

/**
 * SwingStructureVisualizer — shared SMC-concept component (SMC Bot
 * Academy plan item 3): a swing/market-structure visualizer
 * parametrized by the real left_bars/right_bars fractal setting each
 * bot actually uses, rather than a single fixed example.
 *
 * Verified against `MarketStructureDetector.detect_swing_highs/lows`
 * (backend/app/core/smc_algorithms.py): a swing high/low is a
 * fractal — the current candle's high/low must be the most extreme
 * among `left_bars` candles to its left AND `right_bars` candles to
 * its right. Different bots use different left/right settings on
 * different timeframes (e.g. Bot 1's 1D structure vs. Bot 5/6's 15M
 * structure) — the slider below recomputes the SAME fixed candle
 * sequence's real swing points under whatever setting is chosen, so
 * the effect of a tighter vs. wider fractal window is visible
 * directly rather than asserted.
 */
export function SwingStructureVisualizer({ dark = false }: { dark?: boolean }) {
  const [bars, setBars] = useState(2);

  // A hand-authored, clearly-illustrative candle sequence with a mix
  // of a genuine larger swing and smaller internal wiggles, so a
  // tighter (1-bar) vs. wider (3-bar) fractal setting visibly
  // disagrees on which points qualify.
  const candles: Candle[] = useMemo(
    () => [
      { open: 100, high: 101, low: 99, close: 100.5 },
      { open: 100.5, high: 103, low: 100, close: 102.5 },
      { open: 102.5, high: 105, low: 102, close: 104.5 },
      { open: 104.5, high: 106, low: 104, close: 105 }, // local high candidate
      { open: 105, high: 105.5, low: 103, close: 103.5 },
      { open: 103.5, high: 104, low: 101, close: 101.5 }, // local low candidate
      { open: 101.5, high: 103, low: 101, close: 102.5 },
      { open: 102.5, high: 107, low: 102, close: 106.5 }, // the genuine swing high
      { open: 106.5, high: 107, low: 104, close: 104.5 },
      { open: 104.5, high: 105, low: 100, close: 100.5 }, // the genuine swing low
      { open: 100.5, high: 102, low: 100, close: 101.5 },
    ],
    [],
  );

  // Same fractal test as detect_swing_highs/lows, run client-side
  // against the SAME fixed candles for whatever `bars` is selected.
  const markers = useMemo<ChartMarker[]>(() => {
    const result: ChartMarker[] = [];
    for (let i = bars; i < candles.length - bars; i++) {
      const current = candles[i];
      const left = candles.slice(i - bars, i);
      const right = candles.slice(i + 1, i + 1 + bars);
      const isHigh = left.every((c) => current.high >= c.high) && right.every((c) => current.high >= c.high);
      const isLow = left.every((c) => current.low <= c.low) && right.every((c) => current.low <= c.low);
      if (isHigh) result.push({ index: i, price: current.high, label: 'Swing high', color: '#ef4444', side: 'above' });
      if (isLow) result.push({ index: i, price: current.low, label: 'Swing low', color: '#22c55e', side: 'below' });
    }
    return result;
  }, [candles, bars]);

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div className={cardCls}>
      <div className={`text-sm font-semibold mb-3 ${textCls}`}>Swing / Market-Structure Visualizer</div>

      <CandleChart candles={candles} markers={markers} dark={dark} height={220} />

      <div className="mt-4">
        <div className={`text-[11px] font-semibold mb-1.5 ${mutedCls}`}>
          Fractal window — left_bars = right_bars = {bars}
        </div>
        <input
          type="range" min={1} max={4} step={1} value={bars}
          onChange={(e) => setBars(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          {markers.length} swing point{markers.length === 1 ? '' : 's'} qualify at this setting.
          A tighter window (1) catches smaller internal wiggles; a wider window (3-4) only keeps
          the genuinely dominant highs/lows of the sequence.
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          Same fractal test as <code>detect_swing_highs</code>/<code>detect_swing_lows</code> —
          different bots/timeframes use different real left_bars/right_bars settings, so there's
          no single universal "correct" swing point independent of the setting chosen.
        </div>
      </div>
    </div>
  );
}
