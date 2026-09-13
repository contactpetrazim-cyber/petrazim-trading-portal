import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, Sun, Moon, TrendingUp, X, Zap, Receipt, CandlestickChart, Target } from 'lucide-react';
import { TradingViewChart, type ChartPosition, formatSignedMoney } from './TradingViewChart';
import { CandleColorPicker } from './CandleColorPicker';
import { useEffectiveChartColors } from '../hooks/useCandleColors';
import { useQuickPrice } from '../hooks/useQuickPrice';

/**
 * PositionSummaryCard — the caller's own open/pending trade on this
 * chart's symbol, shown as a small info card instead of real
 * price-aligned lines drawn ON the chart. See TradingViewChart.tsx's
 * module doc for why: the free public TradingView widget this app
 * embeds has no JS API to draw shapes (that requires TradingView's
 * separately-licensed Charting Library) — so lines drawn "on the
 * chart" were never actually possible here, no matter how `position`
 * was wired down to it. This card is the honest replacement, folded
 * behind its own "Position" toggle (default folded) exactly like the
 * existing Pairs/Order toggles — by direct request ("embedded in a
 * foldable button like Pairs or Order").
 */
function PositionSummaryCard({ position, dark }: { position: ChartPosition; dark: boolean }) {
  const dirLabel = position.direction === 'long' ? 'LONG' : 'SHORT';
  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'Direction', value: dirLabel },
    { label: 'Entry', value: String(position.entryPrice) },
  ];
  if (position.stopLoss != null) rows.push({ label: 'Stop loss', value: String(position.stopLoss), color: '#EF5350' });
  if (position.takeProfit1 != null) rows.push({ label: 'TP1', value: String(position.takeProfit1), color: '#26A69A' });
  if (position.takeProfit2 != null) rows.push({ label: 'TP2', value: String(position.takeProfit2), color: '#26A69A' });
  if (position.takeProfit3 != null) rows.push({ label: 'TP3', value: String(position.takeProfit3), color: '#26A69A' });
  rows.push({
    label: 'Status',
    value: position.pending ? 'Pending — not filled yet' : position.unrealizedPnl != null ? `P/L ${formatSignedMoney(position.unrealizedPnl)}` : '—',
    color: position.pending ? undefined : position.unrealizedPnl != null ? (position.unrealizedPnl >= 0 ? '#26A69A' : '#EF5350') : undefined,
  });

  return (
    <div className={`mb-2 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
      {rows.map((r) => (
        <div key={r.label}>
          <span className={`block text-[10px] uppercase tracking-wide mb-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{r.label}</span>
          <span className="font-semibold" style={r.color ? { color: r.color } : undefined}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * ChartPanel — the one reusable chart embed every page uses (Trade,
 * Learn/Practise/Explore area pages, Insights, Tools, the Trader
 * Dashboard, Manual Trading), by direct request rather than each page
 * hand-rolling its own toolbar:
 *   - Its own light/dark toggle, independent of the site-wide theme —
 *     same reasoning as TradingViewFramePage's local toggle (Section 8
 *     of the design handover: "a trader may want a bright chart while
 *     the rest of the site stays dark"). Defaults to light everywhere,
 *     by direct instruction.
 *   - Fill-screen / return-to-default-size toggle.
 *   - The shared candle-color picker (useCandleColorStore).
 *   - A small "Price" quick-fill button, styled and placed the same
 *     way as the candle-colors button right next to it — by direct
 *     request, replacing the older Trade Specs card, which "isn't
 *     taking too much space" was the opposite of true: it was
 *     disfiguring the chart layout. Clicking it fetches the live
 *     price and either fills your own order form (onQuickFill) or, on
 *     a page with no order form on it, jumps straight to Manual
 *     Trading with that price pre-filled.
 *   - An optional "Trade" button straight into Manual Trading with
 *     this symbol pre-filled — the one real execution surface,
 *     reachable from every chart rather than duplicated per page.
 */
export function ChartPanel({
  symbol,
  interval = '60',
  height = 380,
  tradeSymbol,
  specsSymbol,
  dark: containerDark = false,
  onQuickFill,
  orderFormOpen,
  onToggleOrderForm,
  pairsOpen,
  onTogglePairs,
  pairsPanel,
  position,

}: {
  symbol: string;
  interval?: string;
  height?: number;
  /** Pass the exchange-format symbol (e.g. "BTCUSDT") to show the "Trade" button that navigates to Manual Trading. Omit on the Manual Trading page itself, where that button would just point back at the page you're already on. */
  tradeSymbol?: string;
  /** Pass the exchange-format symbol to show the small "Price" quick-fill button without necessarily showing the Trade button — defaults to tradeSymbol when omitted, so most pages only need to set one of the two. */
  specsSymbol?: string;
  /** The surrounding page's own dark/light state, for the toolbar chrome only — never the chart itself. */
  dark?: boolean;
  /** Wire this to your own order form's entry-price setter (e.g. Manual Trading) — the "Price" button then fills it in place instead of navigating away. Charts with no order form on-page can omit it; the button navigates to Manual Trading with the price pre-filled instead. */
  onQuickFill?: (price: number) => void;
  /** Pass both to show an "Order" toggle button right next to Price —
   * by direct request ("place the order button next to the price
   * icon"). Only Manual Trading passes these; every other page omits
   * them and the button doesn't render. Styled and behaving exactly
   * like CandleColorPicker's own toggle (one click opens, another
   * hides), just living in the shared toolbar instead of a separate
   * row so the chart gets the full column width back when the order
   * form is closed — by direct request ("remove the order card
   * completely to provide more space to the chart"). */
  orderFormOpen?: boolean;
  onToggleOrderForm?: () => void;
  /** Pass both to show a "Pairs" toggle right next to Order — by
   * direct request ("collapse all the quick links pairs and exchanges
   * as a 'Pairs' button next to 'Order' button — same style, format and
   * action, default folded"). Same toggle contract as Order: one click
   * unfolds the instrument quick-links + Exchange rows, another folds
   * them away so the chart keeps the space. */
  pairsOpen?: boolean;
  onTogglePairs?: () => void;
  /** Rendered directly under the toolbar while Pairs is unfolded —
   * normally <PairsPanel /> (see ChartWithPairs). */
  pairsPanel?: ReactNode;
  /** The caller's own open or pending trade on this exact `symbol`, if
   * any — shown as a foldable "Position" info card (default folded)
   * right in this toolbar, next to Pairs/Order. See
   * TradingViewChart.tsx's module doc for why this is a card next to
   * the chart rather than lines drawn on it. Omit entirely on pages
   * with no concept of an open position (Learn, Dashboard). */
  position?: ChartPosition | null;

}) {
  const navigate = useNavigate();
  const effectiveSpecsSymbol = specsSymbol ?? tradeSymbol;
  const { colors, chartStyle, applyLocal, applyGlobal, resetLocal, resetGlobal } = useEffectiveChartColors();
  const { busy: quickPriceBusy, refresh: refreshQuickPrice } = useQuickPrice(effectiveSpecsSymbol || symbol);

  async function handleQuickPrice() {
    const price = await refreshQuickPrice();
    if (price == null) return;
    if (onQuickFill) {
      onQuickFill(price);
    } else if (tradeSymbol) {
      // No order form on this page (e.g. Dashboard/Insights/Tools/Trade) —
      // "trigger and open the Place Buy/Sell Order form" means taking you
      // straight there with the price already filled in.
      navigate(`/trade/manual?symbol=${encodeURIComponent(tradeSymbol)}&price=${price}`);
    }
  }
  const [chartTheme, setChartTheme] = useState<'light' | 'dark'>('light');
  const [fullscreen, setFullscreen] = useState(false);
  // Default folded — same contract as Pairs/Order, by direct request.
  const [positionOpen, setPositionOpen] = useState(false);
  const chartDark = chartTheme === 'dark';

  const toolbar = (
    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
      <div className={`flex items-center gap-1 rounded-lg p-1 ${containerDark ? 'bg-white/5' : 'bg-black/5'}`}>
        <button
          onClick={() => setChartTheme('light')}
          aria-label="Light chart"
          className={`p-1.5 rounded-md ${!chartDark ? (containerDark ? 'bg-white/20 text-white' : 'bg-black/10 text-corporate-text-on-bg') : containerDark ? 'text-white/40' : 'text-gray-400'}`}
        >
          <Sun size={13} />
        </button>
        <button
          onClick={() => setChartTheme('dark')}
          aria-label="Dark chart"
          className={`p-1.5 rounded-md ${chartDark ? (containerDark ? 'bg-white/20 text-white' : 'bg-black/10 text-corporate-text-on-bg') : containerDark ? 'text-white/40' : 'text-gray-400'}`}
        >
          <Moon size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {effectiveSpecsSymbol && (
          <button
            onClick={handleQuickPrice} disabled={quickPriceBusy}
            aria-label="Use current price" title="Use current price — fills the order form"
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 ${containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
          >
            <Zap size={13} /> Price
          </button>
        )}
        {onTogglePairs && (
          <button
            onClick={onTogglePairs}
            aria-label={pairsOpen ? 'Hide pairs and exchanges' : 'Show pairs and exchanges'}
            title={pairsOpen ? 'Hide pairs and exchanges' : 'Pairs and exchanges'}
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
              pairsOpen ? 'bg-blue-600 text-white' : containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
            }`}
          >
            <CandlestickChart size={13} /> Pairs
          </button>
        )}
        {onToggleOrderForm && (
          <button
            onClick={onToggleOrderForm}
            aria-label={orderFormOpen ? 'Hide order form' : 'Show order form'}
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
              orderFormOpen ? 'bg-blue-600 text-white' : containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
            }`}
          >
            <Receipt size={13} /> Order
          </button>
        )}
        {position && (
          <button
            onClick={() => setPositionOpen((o) => !o)}
            aria-label={positionOpen ? 'Hide position details' : 'Show position details'}
            title={positionOpen ? 'Hide position details' : 'Entry/SL/TP for your open order on this symbol'}
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
              positionOpen ? 'bg-blue-600 text-white' : containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
            }`}
          >
            <Target size={13} /> Position
          </button>
        )}
        <CandleColorPicker
          dark={containerDark}
          colors={colors} chartStyle={chartStyle}
          onChangeLocal={applyLocal} onChangeGlobal={applyGlobal}
          onResetLocal={resetLocal} onResetGlobal={resetGlobal}
        />
        <button
          onClick={() => setFullscreen((f) => !f)}
          aria-label={fullscreen ? 'Return to default size' : 'Fill screen'}
          className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        {tradeSymbol && (
          <button
            onClick={() => navigate(`/trade/manual?symbol=${encodeURIComponent(tradeSymbol)}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-corporate-hero"
          >
            <TrendingUp size={13} /> Trade
          </button>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/90 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-semibold">{symbol}</span>
          <button onClick={() => setFullscreen(false)} aria-label="Return to default size" className="text-white/70 hover:text-white flex items-center gap-1.5 text-xs">
            <X size={16} /> Close fullscreen
          </button>
        </div>
        {toolbar}
        {pairsOpen && pairsPanel}
        {positionOpen && position && <PositionSummaryCard position={position} dark />}
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden">

          <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      {pairsOpen && pairsPanel}
      {positionOpen && position && <PositionSummaryCard position={position} dark={containerDark} />}
      <div className={`rounded-lg overflow-hidden ${chartDark ? '' : 'border border-gray-200'}`} style={{ height }}>
        <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
      </div>
    </div>
  );

}
