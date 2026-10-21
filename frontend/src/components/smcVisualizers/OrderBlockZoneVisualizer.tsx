import { useState } from 'react';
import { CandleChart, type Candle, type ChartZone } from '../CandleChart';

/**
 * OrderBlockZoneVisualizer — shared SMC-concept component (SMC Bot
 * Academy plan item 3): an order-block zone with a fresh-vs-any
 * toggle, reflecting the real per-bot "freshness" convention.
 *
 * Verified against `bot_strategies.py`: "fresh" (`test_count <= 1`)
 * is a PER-BOT convention, not a universal rule — Bots 2, 5, 6 filter
 * on it (`active_obs = [z for z in obs if z.status.name == "ACTIVE"
 * and z.test_count <= 1]`), Bot 1 does not (it only requires ACTIVE +
 * direction-matching, no freshness test at all). `test_count` itself
 * is incremented once per retest by `ZoneDetector.check_mitigation` —
 * a zone that's been tapped and held 2+ times is "ACTIVE but stale"
 * under the fresh-only bots' own real logic, not invalid outright.
 *
 * The toggle below filters the SAME zone pool by the freshness rule,
 * so the effect of that one-line difference is visible directly.
 */
export function OrderBlockZoneVisualizer({ dark = false }: { dark?: boolean }) {
  const [freshOnly, setFreshOnly] = useState(true);

  const candles: Candle[] = [
    { open: 100, high: 101, low: 98, close: 98.5 },
    { open: 98.5, high: 105, low: 98, close: 104.5 },
    { open: 104.5, high: 108, low: 103, close: 107 },
    { open: 107, high: 107.5, low: 101, close: 102 }, // retest #1 of the zone
    { open: 102, high: 106, low: 101.5, close: 105 },
    { open: 105, high: 108, low: 102, close: 103 }, // retest #2 — zone now test_count=2
    { open: 103, high: 107, low: 102.5, close: 106 },
  ];

  // Bullish OB: top = origin candle's open, bottom = origin candle's
  // low — the origin candle is the last down-candle before the
  // expansion (candle 0 here), per detect_order_blocks exactly.
  const obTop = candles[0].open;
  const obBottom = candles[0].low;
  const testCount = 2; // this zone has been retested twice in the illustration above

  const isFresh = testCount <= 1;
  const show = !freshOnly || isFresh;

  const zones: ChartZone[] = show
    ? [
        {
          fromIndex: 0, toIndex: 6, priceTop: obTop, priceBottom: obBottom,
          color: isFresh ? '#22c55e' : '#f59e0b',
          label: `Bullish OB — test_count=${testCount}${isFresh ? ' (fresh)' : ' (stale)'}`,
        },
      ]
    : [];

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={`text-sm font-semibold ${textCls}`}>Order-Block Zone Visualizer</div>
        <button
          onClick={() => setFreshOnly((v) => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            freshOnly
              ? 'bg-corporate-hero text-white border-corporate-hero'
              : dark
                ? 'border-corporate-border-dark text-white/70'
                : 'border-gray-200 text-gray-600'
          }`}
        >
          {freshOnly ? 'Fresh-only filter: ON (Bot 2/5/6 rule)' : 'Fresh-only filter: OFF (Bot 1 rule)'}
        </button>
      </div>

      <CandleChart candles={candles} zones={zones} dark={dark} height={220} />

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          {freshOnly
            ? show
              ? 'Zone shown — ACTIVE and test_count <= 1.'
              : `Zone hidden — this one has test_count=${testCount} (already retested twice), which fails Bot 2/5/6's fresh-only filter even though it's still ACTIVE.`
            : 'Zone shown regardless of test_count — matches Bot 1\'s real logic, which never checks freshness at all, only ACTIVE + direction.'}
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          "Fresh" (<code>test_count &lt;= 1</code>) is a per-bot
          convention, not a universal SMC rule — toggle above to see
          the exact same zone pool evaluated under each bot family's
          real filter.
        </div>
      </div>
    </div>
  );
}
