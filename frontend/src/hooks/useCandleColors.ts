import { useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CandleColors } from '../components/TradingViewChart';

export const DEFAULT_CANDLE_COLORS: Required<CandleColors> = {
  upColor: '#22c55e', downColor: '#ef4444',
  wickUpColor: '#22c55e', wickDownColor: '#ef4444',
  borderUpColor: '#22c55e', borderDownColor: '#ef4444',
};

/**
 * TradingView widget `style` codes this app offers a picker for —
 * "whichever type hollow candles, lines etc", by direct request.
 * These are the widget's own real series-style ids, not invented
 * ones (Bars=0, Candles=1, Line=2, Area=3, Heikin Ashi=8, Hollow
 * Candles=9, Baseline=10).
 */
export type ChartStyleId = '1' | '9' | '8' | '0' | '2' | '3' | '10';

export const CHART_STYLES: { id: ChartStyleId; label: string }[] = [
  { id: '1', label: 'Candles' },
  { id: '9', label: 'Hollow Candles' },
  { id: '8', label: 'Heikin Ashi' },
  { id: '0', label: 'Bars' },
  { id: '2', label: 'Line' },
  { id: '3', label: 'Area' },
  { id: '10', label: 'Baseline' },
];

export const DEFAULT_CHART_STYLE: ChartStyleId = '1';

interface CandleColorState {
  colors: Required<CandleColors>;
  chartStyle: ChartStyleId;
  setColors: (colors: Required<CandleColors>) => void;
  setUpDown: (upColor: string, downColor: string) => void;
  setChartStyle: (chartStyle: ChartStyleId) => void;
  reset: () => void;
}

/**
 * The GLOBAL candle/chart-style preference — applies to every chart
 * across the whole portal, persisted per-browser via localStorage.
 * This is the "apply to all charts" side of the picker; the "apply to
 * this chart only" side lives in useEffectiveChartColors below and
 * never touches this store.
 */
export const useCandleColorStore = create<CandleColorState>()(
  persist(
    (set) => ({
      colors: DEFAULT_CANDLE_COLORS,
      chartStyle: DEFAULT_CHART_STYLE,
      setColors: (colors) => set({ colors }),
      setUpDown: (upColor, downColor) =>
        set({ colors: { upColor, downColor, wickUpColor: upColor, wickDownColor: downColor, borderUpColor: upColor, borderDownColor: downColor } }),
      setChartStyle: (chartStyle) => set({ chartStyle }),
      reset: () => set({ colors: DEFAULT_CANDLE_COLORS, chartStyle: DEFAULT_CHART_STYLE }),
    }),
    { name: 'petrazim-candle-colors' }
  )
);

/**
 * useEffectiveChartColors — one chart instance's colors/style, with a
 * per-chart override that takes precedence over the global store
 * without ever writing to it. By direct request: "there should be an
 * apply to current chart or global option, so the colour changes for
 * the chart candles ... whichever type hollow candles, lines etc."
 *
 * - applyGlobal writes through to the shared, persisted store — every
 *   chart on the site (that hasn't set its own local override) picks
 *   it up immediately, on this device and this device only (same
 *   per-browser localStorage model as the theme toggle).
 * - applyLocal only updates this hook's own component state — it
 *   affects nothing outside the one chart that called it, and is
 *   never persisted (a page refresh reverts it to whatever the global
 *   preference is).
 */
export function useEffectiveChartColors() {
  const { colors: globalColors, chartStyle: globalStyle, setColors, setChartStyle, reset: resetGlobal } = useCandleColorStore();
  const [localOverride, setLocalOverride] = useState<{ colors: Required<CandleColors>; chartStyle: ChartStyleId } | null>(null);

  return {
    colors: localOverride?.colors ?? globalColors,
    chartStyle: localOverride?.chartStyle ?? globalStyle,
    isLocal: localOverride !== null,
    applyLocal: (colors: Required<CandleColors>, chartStyle: ChartStyleId) => setLocalOverride({ colors, chartStyle }),
    applyGlobal: (colors: Required<CandleColors>, chartStyle: ChartStyleId) => {
      setLocalOverride(null);
      setColors(colors);
      setChartStyle(chartStyle);
    },
    resetLocal: () => setLocalOverride(null),
    resetGlobal: () => {
      setLocalOverride(null);
      resetGlobal();
    },
  };
}
