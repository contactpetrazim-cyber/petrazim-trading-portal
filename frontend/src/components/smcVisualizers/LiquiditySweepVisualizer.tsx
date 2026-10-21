import { useState } from 'react';
import { CandleChart, type Candle, type ChartLine, type ChartMarker } from '../CandleChart';

/**
 * LiquiditySweepVisualizer — shared SMC-concept component (SMC Bot
 * Academy plan item 3): a buy-side/sell-side liquidity sweep, with
 * the direction-vs-timing distinction called out explicitly.
 *
 * Verified against `LiquidityDetector.detect_liquidity_sweeps`
 * (backend/app/core/smc_algorithms.py): a buy-side sweep is
 * `candle.low < pool.price_level and candle.close > pool.price_level`
 * — wick below the level (taking out resting sell-stops under
 * equal lows), body close back above it. Sell-side mirrors this
 * above an equal-highs level.
 *
 * The important, codebase-specific correction this visualizer
 * exists to teach: for Bot 5 (`JeafxSMCBot`) and Bot 6
 * (`JeafxSMCv2Bot`), the sweep's own side does NOT set trade
 * direction — direction comes from the HTF BOS, decided BEFORE the
 * sweep is even checked. The sweep only gates ENTRY TIMING (is the
 * zone ready to trade yet). This directly contradicts the standard
 * "sweep -> reversal direction" textbook framing, and the codebase's
 * own comments record the strategy being found backwards vs. ICT
 * convention, then fixed — this is this platform's own documented
 * correction, not a simplification.
 */
export function LiquiditySweepVisualizer({ dark = false }: { dark?: boolean }) {
  const [mode, setMode] = useState<'direction' | 'timing'>('timing');

  const poolLevel = 100;

  // A buy-side sweep: wick dips below the equal-lows level, body
  // closes back above it.
  const candles: Candle[] = [
    { open: 103, high: 104, low: 101.5, close: 102 },
    { open: 102, high: 102.5, low: 100.2, close: 100.8 }, // first touch of the level (equal low #1)
    { open: 100.8, high: 101.5, low: 100.1, close: 101 }, // second touch (equal low #2 — the pool)
    { open: 101, high: 102, low: 98.5, close: 101.5 }, // the sweep candle: wick below, close back above
    { open: 101.5, high: 104, low: 101, close: 103.5 },
  ];

  const sweepIndex = 3;
  const lines: ChartLine[] = [{ price: poolLevel, label: 'Equal-lows pool (buy-side)', color: '#64748b' }];
  const markers: ChartMarker[] = [
    { index: sweepIndex, price: candles[sweepIndex].low, label: 'Sweep (wick)', color: '#ef4444', shape: 'diamond' },
    { index: sweepIndex, price: candles[sweepIndex].close, label: 'Close back above', color: '#22c55e', shape: 'triangle-up' },
  ];

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={`text-sm font-semibold ${textCls}`}>Liquidity Sweep Visualizer</div>
        <div className="flex gap-1.5">
          {(['timing', 'direction'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                mode === m
                  ? 'bg-corporate-hero text-white border-corporate-hero'
                  : dark
                    ? 'border-corporate-border-dark text-white/70'
                    : 'border-gray-200 text-gray-600'
              }`}
            >
              {m === 'timing' ? 'Bot 5/6: timing only' : 'Textbook: sets direction'}
            </button>
          ))}
        </div>
      </div>

      <CandleChart candles={candles} lines={lines} markers={markers} dark={dark} height={220} />

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        {mode === 'timing' ? (
          <div className={textCls}>
            Bot 5/Bot 6's real logic: HTF BOS already decided direction (long) BEFORE this sweep
            was even checked. This buy-side sweep's only job here is to confirm the zone is READY
            — entry TIMING — not to tell the bot which way to trade. This is a real, documented
            fix: the code comments record the strategy being found backwards vs. standard ICT
            framing, then corrected.
          </div>
        ) : (
          <div className={textCls}>
            The standard "sweep -&gt; reversal direction" textbook framing: a buy-side sweep
            (stops below equal lows taken out) is read as itself signaling a long reversal. This
            is the assumption Bot 5/Bot 6 explicitly do NOT use — direction already came from the
            HTF BOS, independent of this sweep's side.
          </div>
        )}
        <div className={`mt-1 ${mutedCls}`}>
          Verified against <code>detect_liquidity_sweeps</code>'s wick-below/close-above
          confirmation and Bot 5/6's real gating order in <code>bot_strategies.py</code>.
        </div>
      </div>
    </div>
  );
}
