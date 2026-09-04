import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradeSpecsPosition = 'under' | 'beside';

interface TradeSpecsLayoutState {
  position: TradeSpecsPosition;
  setPosition: (position: TradeSpecsPosition) => void;
}

/**
 * Per-viewer preference for where the Trade Specs panel sits relative
 * to a chart — under it or beside it — by direct request ("Under card
 * and beside card ... user toggles preference"). Same per-browser
 * persistence model as the theme and candle-color preferences.
 */
export const useTradeSpecsLayoutStore = create<TradeSpecsLayoutState>()(
  persist(
    (set) => ({
      position: 'under',
      setPosition: (position) => set({ position }),
    }),
    { name: 'petrazim-trade-specs-layout' }
  )
);
