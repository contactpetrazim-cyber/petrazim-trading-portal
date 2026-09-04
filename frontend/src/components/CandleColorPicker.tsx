import { useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { useCandleColorStore, DEFAULT_CANDLE_COLORS } from '../hooks/useCandleColors';

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

/**
 * CandleColorPicker — a small popover, matches every exchange's own
 * "Bullish / Bearish" color pair rather than exposing all 6 widget
 * override keys separately (fill/wick/border move together per side,
 * same as changing candle colors on Binance/TradingView itself).
 */
export function CandleColorPicker({ dark = false }: { dark?: boolean }) {
  const { colors, setUpDown, reset } = useCandleColorStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Candle colors"
        className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
      >
        <Palette size={13} /> Candles
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 mt-2 z-20 rounded-xl border p-3 w-60 shadow-xl ${dark ? 'bg-[#161b2e] border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Presets</div>
            <div className="grid grid-cols-1 gap-1 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setUpDown(p.up, p.down)}
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
              Bullish (up)
              <input
                type="color" value={colors.upColor}
                onChange={(e) => setUpDown(e.target.value, colors.downColor)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
            </label>
            <label className={`flex items-center justify-between text-xs mb-3 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
              Bearish (down)
              <input
                type="color" value={colors.downColor}
                onChange={(e) => setUpDown(colors.upColor, e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
            </label>
            <button
              onClick={() => reset()}
              className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg ${dark ? 'text-white/40 hover:text-white/70 bg-white/5' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}
            >
              <RotateCcw size={12} /> Reset to default
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { DEFAULT_CANDLE_COLORS };
