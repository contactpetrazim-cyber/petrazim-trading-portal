import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChartPanel } from '../components/ChartPanel';
import { OrderFlowChartTool } from './OrderFlowChartTool';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { tradesApi } from '../services/api';
import type { Trade } from '../types';

/**
 * OrderFlowFullPage — the Order Flow Chart, maximized to its own page
 * instead of a FoldedCard section on ToolsPage constrained to that
 * grid's column width, by direct request ("make the Order flow chart
 * load on a new page so that we can maximise chart area ... whenever
 * triggered open a new page ... with option to return to default card
 * window and close").
 *
 * "Use all existing chart formats and tools and trade formats" — this
 * page now also carries a real ChartPanel (the same one every other
 * chart surface in the app uses: light/dark toggle, the candle-color
 * picker with Hollow/Heikin-Ashi styles, fullscreen, the "Price"
 * quick-fill, and a straight "Trade" button into Manual Trading) above
 * the order-flow-specific tape/footprint/DOM panels, rather than
 * leaving this page as order-flow data alone with no price-chart
 * context. Both panels track the SAME instrument — OrderFlowChartTool's
 * symbol is lifted here and passed to both (see its own `symbol`/
 * `onSymbolChange` props), so switching the pair in one updates the
 * other.
 */
export function OrderFlowFullPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [symbol, setSymbol] = useState('BTCUSDT');
  const { token } = useAuth();

  // This page's own ChartPanel had NO position/otherOpenTrades wiring
  // at all — the "Position" button always rendered the empty state
  // regardless of what a trader actually held, by direct bug report
  // ("on chart in the tools ... a time lag after position is clicked
  // before the blue button shows — You have a pending order on
  // BTCUSDT instead"). Same polling shape as ManualTradingPage.tsx/
  // TradingViewFramePage.tsx — an open position takes priority over a
  // pending order on the same symbol, one row per OTHER symbol.
  const [openPositionTrade, setOpenPositionTrade] = useState<Trade | null>(null);
  const [pendingOrderTrade, setPendingOrderTrade] = useState<Trade | null>(null);
  const [otherOpenTrades, setOtherOpenTrades] = useState<Trade[]>([]);
  const [positionLoading, setPositionLoading] = useState(true);
  const loadOpenPosition = useCallback(() => {
    return Promise.all([
      tradesApi.getActiveTrades(),
      tradesApi.getTrades({ status: 'pending' }),
    ]).then(([active, pending]) => {
      setOpenPositionTrade(active.find((t) => t.symbol === symbol && t.entry_price != null) ?? null);
      setPendingOrderTrade(pending.find((t) => t.symbol === symbol && t.entry_price != null) ?? null);
      const bySymbol = new Map<string, Trade>();
      active.filter((t) => t.symbol !== symbol && t.entry_price != null).forEach((t) => bySymbol.set(t.symbol, t));
      pending.filter((t) => t.symbol !== symbol && t.entry_price != null).forEach((t) => { if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t); });
      setOtherOpenTrades(Array.from(bySymbol.values()));
    }).catch(() => { setOpenPositionTrade(null); setPendingOrderTrade(null); setOtherOpenTrades([]); })
      .finally(() => setPositionLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, token]);
  useEffect(() => {
    if (!token) return;
    loadOpenPosition();
    const t = setInterval(loadOpenPosition, 8000);
    return () => clearInterval(t);
  }, [loadOpenPosition, token]);
  const position: Trade | null = openPositionTrade ?? pendingOrderTrade;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Link
          to="/tools"
          className={`flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
        >
          <ArrowLeft size={15} /> Back to Tools
        </Link>
        <Link
          to="/tools"
          aria-label="Close full-page chart"
          title="Close"
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'text-white/40 hover:bg-white/10' : 'text-gray-400 hover:bg-corporate-bg'}`}
        >
          <X size={16} />
        </Link>
      </div>
      <PageHeader title="Order Flow Chart" subtitle="Free — live tape, delta, and order book, from real crypto market data." />

      <div className="mb-4">
        <ChartPanel
          symbol={`BINANCE:${symbol}`}
          tradeSymbol={symbol}
          dark={dark}
          height={420}
          position={position}
          onPositionChanged={loadOpenPosition}
          otherOpenTrades={otherOpenTrades}
          positionLoading={positionLoading}
        />
      </div>

      <OrderFlowChartTool symbol={symbol} onSymbolChange={setSymbol} />
    </div>
  );
}
