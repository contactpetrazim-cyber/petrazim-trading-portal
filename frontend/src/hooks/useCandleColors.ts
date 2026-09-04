import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CandleColors } from '../components/TradingViewChart';

export const DEFAULT_CANDLE_COLORS: Required<CandleColors> = {
  upColor: '#22c55e', downColor: '#ef4444',
  wickUpColor: '#22c55e', wickDownColor: '#ef4444',
  borderUpColor: '#22c55e', borderDownColor: '#ef4444',
};

interface CandleColorState {
  colors: Required<CandleColors>;
  setUpDown: (upColor: string, downColor: string) => void;
  reset: () => void;
}

/**
 * Shared candle-color preference — one setting for the whole app
 * (Free Chart, My Workspace, Manual Trading, and eventually the Trade
 * dashboard all render the same TradingViewChart component), by
 * direct request: "you can not change the colours of the candles ...
 * please include that optionality." Persisted per-browser via
 * localStorage, same pattern as useTheme's light/dark persistence —
 * this is a per-viewer display preference, not account data, so it
 * doesn't need a backend round-trip.
 */
export const useCandleColorStore = create<CandleColorState>()(
  persist(
    (set) => ({
      colors: DEFAULT_CANDLE_COLORS,
      setUpDown: (upColor, downColor) =>
        set({ colors: { upColor, downColor, wickUpColor: upColor, wickDownColor: downColor, borderUpColor: upColor, borderDownColor: downColor } }),
      reset: () => set({ colors: DEFAULT_CANDLE_COLORS }),
    }),
    { name: 'petrazim-candle-colors' }
  )
);
