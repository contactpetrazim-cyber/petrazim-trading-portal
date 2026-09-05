import { create } from 'zustand';

interface TradeAIState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * useTradeAIStore — lets anything in the app (not just FloatingTradeAI's
 * own bubble button) open the Trade AI panel. Added so SettingsPanel's
 * "Ask Trading Coach" row actually does something: it used to be a
 * plain informational row with no onClick at all, so clicking it was a
 * no-op — by direct bug report ("Ask Coach is not working"). Not
 * persisted — like the panel's own open/closed state before this, it
 * should always start closed on a fresh page load.
 */
export const useTradeAIStore = create<TradeAIState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
