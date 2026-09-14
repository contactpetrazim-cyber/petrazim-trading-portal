import { useState } from 'react';
import { ChartPanel } from './ChartPanel';
import { PairsPanel } from './PairsPanel';
import { useQuickPairsStore, type QuickPair } from '../hooks/useQuickPairs';

/**
 * ChartWithPairs — a ChartPanel that owns its own "Pairs" quick-link
 * selection, so every chart page in the app gets the same folded
 * "Pairs" button next to "Order" (default folded) instead of a row of
 * hardcoded pills above the chart, or — worse — no way to change the
 * symbol at all. The chart symbol is always the selected quick-link's
 * validated TradingView symbol — they cannot drift apart.
 *
 * By direct request ("include 'Pair' as standard on every chart
 * also"), every page that used to render a bare `<ChartPanel
 * symbol="..." .../>` with no Pairs wiring at all (Dashboard,
 * TradePage, PremiumDashboardPage, ToolsPage, AreaPage, InsightsPage —
 * a chart fixed on one symbol forever, no way to switch) now goes
 * through this component instead, the same as ChartPage/Manual
 * Trading/My Workspace already did — one real Pairs implementation
 * everywhere a chart appears, not a fixed symbol on some pages and a
 * real switcher on others.
 */
export function ChartWithPairs({
  interval = '60',
  height = 380,
  dark = false,
  showTradeButton = true,
  onSelect,
  defaultTv,
}: {
  interval?: string;
  height?: number;
  dark?: boolean;
  showTradeButton?: boolean;
  onSelect?: (pair: QuickPair) => void;
  /** Which quick-link this chart opens on, by its TradingView symbol
   * (e.g. "OANDA:EURUSD") — falls back to the first saved quick-link
   * (BTC/USDT by default) when omitted or when no pair matches. Lets a
   * page that's thematically about a specific instrument (a forex
   * explainer page, say) keep opening on that instrument instead of
   * always defaulting to BTC, while still getting the real Pairs
   * switcher on top of it. */
  defaultTv?: string;
}) {
  const { pairs } = useQuickPairsStore();
  const [selectedTv, setSelectedTv] = useState<string>(
    () => (defaultTv && pairs.some((p) => p.tv === defaultTv) ? defaultTv : pairs[0]?.tv),
  );
  const selected = pairs.find((p) => p.tv === selectedTv) ?? pairs[0];
  const [pairsOpen, setPairsOpen] = useState(false);

  function select(pair: QuickPair) {
    setSelectedTv(pair.tv);
    onSelect?.(pair);
  }

  return (
    <ChartPanel
      symbol={selected.tv}
      interval={interval}
      height={height}
      dark={dark}
      tradeSymbol={showTradeButton ? selected.trade : undefined}
      specsSymbol={selected.trade}
      pairsOpen={pairsOpen}
      onTogglePairs={() => setPairsOpen((o) => !o)}
      pairsPanel={<PairsPanel selected={selected} onSelect={select} dark={dark} />}
    />
  );
}
