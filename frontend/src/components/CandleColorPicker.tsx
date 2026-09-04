import { useState } from 'react';
import { Palette, RotateCcw, MonitorSmartphone, Globe2 } from 'lucide-react';
import { CHART_STYLES, type ChartStyleId } from '../hooks/useCandleColors';
import type { CandleColors } from './TradingViewChart';

// A handful of standard schemes real charting platforms ship as quick
// presets, on top of the two custom pickers below — by direct request
// ("provide additional standard colour charts to choose from").
const PRESETS: { label: string; up: string; down: string }[] = [
  { label: 'Classic Green/Red', up: '#22c55e', down: '#ef4444' },
  { label: 'TradingView Blue/Orange', up: '#26a69a', down: '#ef5350' },
  { label: 'Binance Yellow/Black', up: '#f0b90b', down: '#1e2329' },
  { label: 'Monochrome', up: '#e5e7eb', down: '#4b5563' },
  { label: 'Blue/Red', up: '#3b82f6', down: '#ef4444' },
];

function withUpDown(base: Required<CandleColors>, up: string, down: string): Required<CandleColors> {
  return { upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderUpColor: up, borderDownColor: down };
}

interface CandleColorPickerProps {
  dark?: boolean;
  /** This chart instance's currently-effective colors/style (its own
   * local override if it has one, otherwise the global preference). */
  colors: Required<CandleColors>;
  chartStyle: ChartStyleId;
  /** Apply to THIS chart only — never written to the shared store, so
   * no other chart on the site is affected and it won't survive a
   * page refresh. */
  onChangeLocal: (colors: Required<CandleColors>, chartStyle: ChartStyleId) => void;
  /** Apply to EVERY chart across the whole portal — writes through to
   * the persisted, shared preference. */
  onChangeGlobal: (colors: Required<CandleColors>, chartStyle: ChartStyleId) => void;
  onResetLocal: () => void;
  onResetGlobal: () => void;
}

/**
 * CandleColorPicker — matches every exchange's own "Bullish / Bearish"
 * color pair rather than exposing all override keys separately (fill/
 * wick/border move together per side). Now also offers:
 *   - a chart TYPE row (Candles, Hollow Candles, Heikin Ashi, Bars,
 *     Line, Area, Baseline) — "whichever type hollow candles, lines
 *     etc", by direct request
 *   - an "Apply to" scope: This chart only vs All charts (Global), by
 *     direct request ("there should be an apply to current chart or
 *     global option")
 */
export function CandleColorPicker({ dark = false, colors, chartStyle, onChangeLocal, onChangeGlobal, onResetLocal, onResetGlobal }: CandleColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'chart' | 'global'>('chart');

  function apply(nextColors: Required<CandleColors>, nextStyle: ChartStyleId) {
    if (scope === 'global') onChangeGlobal(nextColors, nextStyle);
    else onChangeLocal(nextColors, nextStyle);
  }

  const tabBtn = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors ${
      active
        ? dark ? 'bg-white/20 text-white' : 'bg-white text-corporate-text-on-bg shadow-sm'
        : dark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'
    }`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chart colors and type"
        className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
      >
        <Palette size={13} /> Chart
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 mt-2 z-20 rounded-xl border p-3 w-64 shadow-xl ${dark ? 'bg-[#161b2e] border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
            {/* Apply-to scope — the actual thing this changes: whether
                everything below writes to this one chart, or to the
                shared preference every chart on the site reads. */}
            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Apply to</div>
            <div className={`flex gap-1 p-1 rounded-lg mb-3 ${dark ? 'bg-black/20' : 'bg-gray-100'}`}>
              <button onClick={() => setScope('chart')} className={tabBtn(scope === 'chart')}>
                <MonitorSmartphone size={12} /> This chart
              </button>
              <button onClick={() => setScope('global')} className={tabBtn(scope === 'global')}>
                <Globe2 size={12} /> All charts
              </button>
            </div>
            <p className={`text-[11px] mb-3 ${dark ? 'text-white/30' : 'text-gray-400'}`}>
              {scope === 'chart'
                ? "Only this chart changes — it won't affect any other chart or survive a refresh."
                : 'Every chart across the portal switches to this, and it stays saved on this device.'}
            </p>

            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Chart Type</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {CHART_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => apply(colors, s.id)}
                  className={`text-xs px-2 py-1.5 rounded-lg text-left ${
                    chartStyle === s.id
                      ? dark ? 'bg-white/15 text-white' : 'bg-corporate-bg text-corporate-text-on-bg font-medium'
                      : dark ? 'hover:bg-white/5 text-white/60' : 'hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Presets</div>
            <div className="grid grid-cols-1 gap-1 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => apply(withUpDown(colors, p.up, p.down), chartStyle)}
                  className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-left ${dark ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="flex gap-0.5 shrink-0">
                    <span className="w-3 h-3 rounded-sm" style={{ background: p.up }} />
                    <span className="w-3 h-3 rounded-sm" style={{ background: p.down }} />
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Custom</div>
            <label className={`flex items-center justify-between text-xs mb-2 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
              Bullish / Up
              <input
                type="color" value={colors.upColor}
                onChange={(e) => apply(withUpDown(colors, e.target.value, colors.downColor), chartStyle)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
            </label>
            <label className={`flex items-center justify-between text-xs mb-3 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
              Bearish / Down
              <input
                type="color" value={colors.downColor}
                onChange={(e) => apply(withUpDown(colors, colors.upColor, e.target.value), chartStyle)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
            </label>
            <button
              onClick={() => (scope === 'global' ? onResetGlobal() : onResetLocal())}
              className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg ${dark ? 'text-white/40 hover:text-white/70 bg-white/5' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}
            >
              <RotateCcw size={12} /> Reset {scope === 'global' ? 'global default' : 'this chart'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
