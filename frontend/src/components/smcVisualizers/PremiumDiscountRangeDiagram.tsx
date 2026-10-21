import { useState } from 'react';
import { CandleChart, type Candle, type ChartZone, type ChartLine, type ChartMarker } from '../CandleChart';

/**
 * PremiumDiscountRangeDiagram — shared SMC-concept component (SMC Bot
 * Academy plan item 3): the real 0.45/0.55 three-way premium/discount
 * split every bot that checks it actually uses — NOT a hard 50% line.
 *
 * Verified against `ZoneDetector.classify_premium_discount`
 * (backend/app/core/smc_algorithms.py):
 *   fib_level = (zone_center - swing_low) / (swing_high - swing_low)
 *   fib_level < 0.45  -> "discount"
 *   fib_level > 0.55  -> "premium"
 *   otherwise         -> "equilibrium"
 * This is a real, bot-enforced gating condition for 4 of the 7 bots
 * (Bots 1, 2, 5, 6 check it — Bots 3, 4, 7 never check it at all, per
 * this plan's own fidelity map) — the equilibrium band is a genuine
 * "neither" zone, not rounding error either side of 50%.
 *
 * Drag the marker (or use the slider) to move a price through the
 * range and see its real classification update live.
 */
export function PremiumDiscountRangeDiagram({ dark = false }: { dark?: boolean }) {
  const [pct, setPct] = useState(62); // 0-100, position within the range

  const swingLow = 100;
  const swingHigh = 120;
  const range = swingHigh - swingLow;
  const price = swingLow + (pct / 100) * range;
  const fibLevel = pct / 100;

  const classification = fibLevel < 0.45 ? 'discount' : fibLevel > 0.55 ? 'premium' : 'equilibrium';
  const classColor = classification === 'discount' ? '#22c55e' : classification === 'premium' ? '#ef4444' : '#f59e0b';

  // A few flat illustrative candles spanning the full range, purely
  // as a backdrop for the zone bands — not real market data.
  const candles: Candle[] = Array.from({ length: 8 }, (_, i) => {
    const base = swingLow + (i / 7) * range;
    return { open: base, high: base + 1.5, low: base - 1.5, close: base + (i % 2 === 0 ? 0.8 : -0.8) };
  });

  const discountTop = swingLow + 0.45 * range;
  const premiumBottom = swingLow + 0.55 * range;

  const zones: ChartZone[] = [
    { fromIndex: 0, toIndex: 7, priceTop: discountTop, priceBottom: swingLow, color: '#22c55e', label: 'Discount (<0.45)' },
    { fromIndex: 0, toIndex: 7, priceTop: premiumBottom, priceBottom: discountTop, color: '#f59e0b', label: 'Equilibrium (0.45-0.55)' },
    { fromIndex: 0, toIndex: 7, priceTop: swingHigh, priceBottom: premiumBottom, color: '#ef4444', label: 'Premium (>0.55)' },
  ];

  const lines: ChartLine[] = [
    { price: swingHigh, label: 'Swing high (1.0)', dashed: false, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
    { price: swingLow, label: 'Swing low (0.0)', dashed: false, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
  ];

  const markers: ChartMarker[] = [
    { index: 4, price, label: `${fibLevel.toFixed(2)} — ${classification}`, color: classColor, shape: 'diamond' },
  ];

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div className={cardCls}>
      <div className={`text-sm font-semibold mb-3 ${textCls}`}>Premium / Discount Range Diagram</div>

      <CandleChart candles={candles} zones={zones} lines={lines} markers={markers} dark={dark} height={220} />

      <div className="mt-4">
        <div className={`text-[11px] font-semibold mb-1.5 ${mutedCls}`}>
          Price position in range — fib_level {fibLevel.toFixed(2)}
        </div>
        <input
          type="range" min={0} max={100} step={1} value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          Classification:{' '}
          <span className="font-semibold" style={{ color: classColor }}>
            {classification.toUpperCase()}
          </span>
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          Real thresholds from <code>classify_premium_discount</code>:{' '}
          <code>fib_level &lt; 0.45</code> is discount,{' '}
          <code>fib_level &gt; 0.55</code> is premium — anything in
          between is equilibrium, a genuine third outcome. Checked by
          Bots 1, 2, 5, 6; never checked by Bots 3, 4, 7.
        </div>
      </div>
    </div>
  );
}
