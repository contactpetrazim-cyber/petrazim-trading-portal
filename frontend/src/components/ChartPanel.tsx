import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, Sun, Moon, TrendingUp, X, PanelBottom, PanelRight } from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';
import { CandleColorPicker } from './CandleColorPicker';
import { TradeSpecsPanel } from './TradeSpecsPanel';
import { useEffectiveChartColors } from '../hooks/useCandleColors';
import { useTradeSpecsLayoutStore } from '../hooks/useTradeSpecsLayout';

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
}: {
  symbol: string;
  interval?: string;
  height?: number;
  /** Pass the exchange-format symbol (e.g. "BTCUSDT") to show the "Trade" button that navigates to Manual Trading. Omit on the Manual Trading page itself, where that button would just point back at the page you're already on. */
  tradeSymbol?: string;
  /** Pass the exchange-format symbol to show the Trade Specs panel (open positions, quick-fill, modify/close) without necessarily showing the Trade button — defaults to tradeSymbol when omitted, so most pages only need to set one of the two. */
  specsSymbol?: string;
  /** The surrounding page's own dark/light state, for the toolbar chrome only — never the chart itself. */
  dark?: boolean;
  /** Forwarded into the embedded Trade Specs panel's "Use current price" quick-fill — wire this to your own order form's entry-price setter (e.g. Manual Trading). Charts with no order form on-page can omit it; the panel still shows the fetched price either way. */
  onQuickFill?: (price: number) => void;
}) {
  const navigate = useNavigate();
  const effectiveSpecsSymbol = specsSymbol ?? tradeSymbol;
  const { colors, chartStyle, applyLocal, applyGlobal, resetLocal, resetGlobal } = useEffectiveChartColors();
  const { position: specsPosition, setPosition: setSpecsPosition } = useTradeSpecsLayoutStore();
  const [chartTheme, setChartTheme] = useState<'light' | 'dark'>('light');
  const [fullscreen, setFullscreen] = useState(false);
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
        {effectiveSpecsSymbol && (
          <div className={`flex items-center gap-1 rounded-lg p-1 ${containerDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <button
              onClick={() => setSpecsPosition('under')}
              aria-label="Trade Specs under the chart"
              title="Trade Specs under the chart"
              className={`p-1.5 rounded-md ${specsPosition === 'under' ? (containerDark ? 'bg-white/20 text-white' : 'bg-black/10 text-corporate-text-on-bg') : containerDark ? 'text-white/40' : 'text-gray-400'}`}
            >
              <PanelBottom size={13} />
            </button>
            <button
              onClick={() => setSpecsPosition('beside')}
              aria-label="Trade Specs beside the chart"
              title="Trade Specs beside the chart"
              className={`p-1.5 rounded-md ${specsPosition === 'beside' ? (containerDark ? 'bg-white/20 text-white' : 'bg-black/10 text-corporate-text-on-bg') : containerDark ? 'text-white/40' : 'text-gray-400'}`}
            >
              <PanelRight size={13} />
            </button>
          </div>
        )}
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

  const specsPanel = effectiveSpecsSymbol && (
    <TradeSpecsPanel symbol={effectiveSpecsSymbol} dark={containerDark} onQuickFill={onQuickFill} />
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
        <div className={`flex-1 min-h-0 flex gap-3 ${specsPosition === 'beside' ? 'flex-row' : 'flex-col'}`}>
          <div className="flex-1 min-w-0 min-h-0 rounded-lg overflow-hidden">
            <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
          </div>
          {specsPanel && (
            <div className={`overflow-y-auto ${specsPosition === 'beside' ? 'w-80 shrink-0' : 'shrink-0 max-h-64'}`}>
              {specsPanel}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <div className={`flex gap-3 ${specsPosition === 'beside' ? 'flex-row items-start' : 'flex-col'}`}>
        <div className={`flex-1 min-w-0 rounded-lg overflow-hidden ${chartDark ? '' : 'border border-gray-200'}`} style={{ height }}>
          <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
        </div>
        {specsPanel && (
          <div className={specsPosition === 'beside' ? 'w-80 shrink-0' : 'w-full'}>
            {specsPanel}
          </div>
        )}
      </div>
    </div>
  );
}
