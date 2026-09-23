import { useCallback, useEffect, useState } from 'react';
import { ChartPanel } from './ChartPanel';
import { PairsPanel } from './PairsPanel';
import { useQuickPairsStore, type QuickPair } from '../hooks/useQuickPairs';
import { useAuth } from '../hooks/useAuth';
import { tradesApi } from '../services/api';
import type { Trade } from '../types';

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
 *
 * Also now polls the trader's own active/pending trades — by direct
 * follow-up bug report, with screenshot: on every one of the pages
 * above, "Position" always showed "No open or pending order" with NO
 * way to reach wherever a real order actually was, even when one
 * existed, because this component never fetched or passed `position`/
 * `otherOpenTrades` to ChartPanel at all — they simply stayed
 * undefined here, on every page, regardless of the trader's actual
 * open positions ("in all charts ... outside the trade chart ...
 * Work this flow to be seamless"). ManualTradingPage.tsx and
 * TradingViewFramePage.tsx already had their own real version of
 * exactly this polling (they need the fetched Trade for their own
 * order forms too) — this is that same, one real implementation, not
 * a third copy, now reachable from every other chart in the app too.
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
  const { token } = useAuth();
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

  // Same shape as ManualTradingPage.tsx's own polling — see this
  // component's own docstring for why it lives here too now rather
  // than only there. An open position takes priority over a pending
  // order on the same symbol (the common case is the same trade:
  // pending until filled, then active).
  const [openPositionTrade, setOpenPositionTrade] = useState<Trade | null>(null);
  const [pendingOrderTrade, setPendingOrderTrade] = useState<Trade | null>(null);
  const [otherOpenTrades, setOtherOpenTrades] = useState<Trade[]>([]);
  // Every OTHER trade on this SAME symbol, beyond the single primary
  // one (openPositionTrade ?? pendingOrderTrade) — by direct request
  // ("Show option to show multiple live trades on the same pair in
  // the 'On Chart' ... Position feature in the charts ... should show
  // all current live positions as individual position cards"). A
  // trader can genuinely hold more than one independent position on
  // the same symbol (two manual entries, or a bot position alongside
  // a manual one) — this used to be silently collapsed to just
  // whichever one `.find()` happened to hit first.
  const [samePairOtherPositions, setSamePairOtherPositions] = useState<Trade[]>([]);
  // True only until this FIRST poll resolves — by direct bug report
  // ("a time lag after position is clicked before the blue button
  // shows"). Since this component is what most chart pages in the app
  // actually render through, this was the single biggest source of
  // that lag: position/otherOpenTrades had no way to say "still
  // checking" apart from "confirmed empty" on every page listed in
  // this component's own docstring. See ChartPanel's own
  // PositionLoadingCard for the fix this feeds.
  const [positionLoading, setPositionLoading] = useState(true);
  const loadOpenPosition = useCallback(() => {
    return Promise.all([
      tradesApi.getActiveTrades(),
      tradesApi.getTrades({ status: 'pending' }),
    ]).then(([active, pending]) => {
      const samePair = [
        ...active.filter((t) => t.symbol === selected.trade && t.entry_price != null),
        ...pending.filter((t) => t.symbol === selected.trade && t.entry_price != null),
      ];
      const primary = samePair[0] ?? null;
      setOpenPositionTrade(active.find((t) => t.symbol === selected.trade && t.entry_price != null) ?? null);
      setPendingOrderTrade(pending.find((t) => t.symbol === selected.trade && t.entry_price != null) ?? null);
      setSamePairOtherPositions(primary ? samePair.filter((t) => t.trade_id !== primary.trade_id) : []);
      const bySymbol = new Map<string, Trade>();
      active.filter((t) => t.symbol !== selected.trade && t.entry_price != null).forEach((t) => bySymbol.set(t.symbol, t));
      pending.filter((t) => t.symbol !== selected.trade && t.entry_price != null).forEach((t) => { if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t); });
      setOtherOpenTrades(Array.from(bySymbol.values()));
    }).catch(() => { setOpenPositionTrade(null); setPendingOrderTrade(null); setOtherOpenTrades([]); setSamePairOtherPositions([]); })
      .finally(() => setPositionLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.trade, token]);
  useEffect(() => {
    if (!token) return;
    loadOpenPosition();
    const t = setInterval(loadOpenPosition, 8000);
    return () => clearInterval(t);
  }, [loadOpenPosition, token]);
  const chartPosition: Trade | null = openPositionTrade ?? pendingOrderTrade;

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
      position={chartPosition}
      onPositionChanged={loadOpenPosition}
      otherOpenTrades={otherOpenTrades}
      otherSamePairPositions={samePairOtherPositions}
      positionLoading={positionLoading}
    />
  );
}
