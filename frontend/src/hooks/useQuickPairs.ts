import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * useQuickPairs — the ONE shared list of chart quick-links ("Pairs")
 * used by every chart in the app.
 *
 * Why a shared store: quick-links used to be a per-page list, and the
 * chart symbol was partly GUESSED from a separate "Exchange" pill
 * (e.g. "BYBIT:XAUTUSDT.P"). Guessed tickers TradingView doesn't carry
 * make the widget silently fall back to its own default chart — which
 * is exactly the reported "whatever I click, the chart still shows
 * BTC". Now a quick-link can only ever be created from a real search
 * result, stores the validated `EXCHANGE:TICKER` symbol verbatim, and
 * the chart renders that string with nothing in between. Pick a pair
 * from the search on any chart and it is saved as a quick-link for
 * every chart, for next time.
 */

export interface QuickPair {
  /** Short display label on the pill. */
  label: string;
  /** Exchange-format symbol used for ORDER placement (e.g. BTCUSDT). */
  trade: string;
  /** Real, validated TradingView symbol — `EXCHANGE:TICKER`. */
  tv: string;
  /** Set only when the pair's exchange is one this app can route a live order to. */
  brokerId?: string;
}

export const MAX_QUICK_PAIRS = 8;

export const DEFAULT_QUICK_PAIRS: QuickPair[] = [
  { label: 'BTC/USDT', trade: 'BTCUSDT', tv: 'BINANCE:BTCUSDT', brokerId: 'binance' },
  { label: 'Gold', trade: 'XAUUSD', tv: 'OANDA:XAUUSD' },
  { label: 'EUR/USD', trade: 'EURUSD', tv: 'OANDA:EURUSD' },
  { label: 'Nasdaq 100', trade: 'NAS100USD', tv: 'OANDA:NAS100USD' },
];

interface QuickPairsState {
  pairs: QuickPair[];
  addPair: (pair: QuickPair) => void;
  removePair: (tv: string) => void;
}

export const useQuickPairsStore = create<QuickPairsState>()(
  persist(
    (set) => ({
      pairs: DEFAULT_QUICK_PAIRS,
      addPair: (pair) =>
        set((s) => {
          if (s.pairs.some((p) => p.tv === pair.tv) || s.pairs.length >= MAX_QUICK_PAIRS) return s;
          return { pairs: [...s.pairs, pair] };
        }),
      removePair: (tv) =>
        set((s) => {
          const next = s.pairs.filter((p) => p.tv !== tv);
          return { pairs: next.length ? next : DEFAULT_QUICK_PAIRS };
        }),
    }),
    {
      name: 'petrazim.quickPairs',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ pairs: s.pairs }),
    },
  ),
);

/** Builds a QuickPair from any search result (catalogue or backend). */
export function pairFromResult(
  result: { symbol: string; exchange: string; description?: string },
  brokerPrefixes: { id: string; tvPrefix: string }[] = [],
): QuickPair | null {
  const trade = result.symbol.trim().toUpperCase();
  const exch = result.exchange.trim().toUpperCase();
  if (!trade || !exch) return null;
  const broker = brokerPrefixes.find((b) => b.tvPrefix.toUpperCase() === exch);
  const desc = (result.description || '').trim();
  return {
    label: desc && desc.length <= 16 ? desc : trade,
    trade,
    tv: `${exch}:${trade}`,
    brokerId: broker?.id,
  };
}
