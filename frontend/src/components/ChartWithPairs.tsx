import { useState } from 'react';
import { ChartPanel } from './ChartPanel';
import { PairsPanel } from './PairsPanel';
import { useQuickPairsStore, type QuickPair } from '../hooks/useQuickPairs';

/**
 * ChartWithPairs — a ChartPanel that owns its own "Pairs" quick-link
 * selection, so every chart page in the app gets the same folded
 * "Pairs" button next to "Order" (default folded) instead of a row of
 * hardcoded pills above the chart. The chart symbol is always the
 * selected quick-link's validated TradingView symbol — they cannot
 * drift apart.
 */
export function ChartWithPairs({
  interval = '60',
  height = 380,
  dark = false,
  showTradeButton = true,
  onSelect,
}: {
  interval?: string;
  height?: number;
  dark?: boolean;
  showTradeButton?: boolean;
  onSelect?: (pair: QuickPair) => void;
}) {
  const { pairs } = useQuickPairsStore();
  const [selectedTv, setSelectedTv] = useState<string>(pairs[0]?.tv);
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
