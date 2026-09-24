import { useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Maximize2, Minimize2, Sun, Moon, TrendingUp, X, Zap, Receipt, Target, LineChart, Search } from 'lucide-react';
import { TradingViewChart, type ChartPosition } from './TradingViewChart';
import { CandleColorPicker } from './CandleColorPicker';
import { PositionManager } from './PositionManager';
import { PositionOnChartModal } from './PositionOnChartModal';
import { FoldedCard } from './FoldedCard';
import { useEffectiveChartColors } from '../hooks/useCandleColors';
import { useQuickPrice } from '../hooks/useQuickPrice';
import { pairFromTradeSymbol } from '../hooks/useQuickPairs';
import type { Trade } from '../types';

/** ChartPosition is the lightweight subset PositionOnChartModal draws
 * as lines — derived from the caller's raw Trade rather than asked of
 * the caller directly, so ChartPanel only needs ONE prop (`position`)
 * to power both the management card and the on-chart view. */
export function tradeToChartPosition(trade: Trade): ChartPosition {
  return {
    direction: trade.direction,
    entryPrice: trade.entry_price as number,
    stopLoss: trade.stop_loss,
    takeProfit1: trade.take_profit,
    takeProfit2: trade.take_profit_2,
    takeProfit3: trade.take_profit_3,
    unrealizedPnl: trade.unrealized_pnl,
    pending: trade.status === 'pending',
  };
}

/** Renders `position` plus every entry in `otherSamePairPositions` —
 * by direct request ("Position feature in the charts ... should show
 * all current live positions as individual position cards - similar
 * to the trade management area"). When there's only ever been the one
 * (the overwhelmingly common case), this renders EXACTLY as before —
 * a bare PositionManager, no extra fold wrapper — so nothing about
 * existing single-position pages changes. The per-card folding
 * (default folded, per direct follow-up request) only kicks in once
 * there's genuinely more than one position to tell apart. */
function PositionGroup({
  position, otherSamePairPositions, dark, onPositionChanged, otherOpenTrades,
}: {
  position?: Trade | null;
  otherSamePairPositions?: Trade[];
  dark: boolean;
  onPositionChanged?: () => void;
  otherOpenTrades?: Trade[];
}) {
  const extras = otherSamePairPositions ?? [];
  if (!position) return <NoPositionCard dark={dark} otherTrades={otherOpenTrades} />;
  if (extras.length === 0) return <PositionManager trade={position} dark={dark} onChanged={onPositionChanged} />;

  const all = [position, ...extras];
  return (
    <div className="space-y-2">
      <div className={`text-xs font-semibold px-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
        {all.length} positions on {position.symbol}
      </div>
      {all.map((t, i) => (
        <FoldedCard
          key={t.trade_id}
          title={`${t.direction === 'long' ? 'Long' : 'Short'} — ${t.status === 'pending' ? 'Pending' : 'Active'}`}
          summary={t.entry_price != null ? `Entry ${t.entry_price.toFixed(2)}` : 'No entry price yet'}
          dark={dark}
          defaultOpen={i === 0}
        >
          <PositionManager trade={t} dark={dark} onChanged={onPositionChanged} />
        </FoldedCard>
      ))}
    </div>
  );
}

/** What the folded "Position" card shows when Position/On Chart are
 * open but there's no open or pending order on this symbol right now
 * — by direct request ("make 'Position' and 'On Chart' a permanent
 * feature on all charts ... you can always click on it to review
 * order position"): the toggle buttons no longer hide just because
 * `position` is null, so there needs to be an honest empty state
 * instead of nothing rather than a button here (the "no order" line
 * used to carry its own Goto Chart pointing at `symbolTv` — removed by
 * direct follow-up request, "it's redundant since we are already on
 * that chart": true, this card only ever shows on the chart you're
 * already viewing, so a button back to it did nothing useful).
 *
 * `otherTrades` — by direct bug report, with video: a trader viewing
 * EUR/USD with an actual open BTCUSDT order expected clicking through
 * here to jump to that BTCUSDT order, and had no way to ("the
 * position Goto button from EURUSD does not deploy auto to the
 * correct chart with position trade orders (BTCUSD) chart ... it
 * remains on the EURUSD chart"). One row per OTHER symbol you have an
 * order on (deduped — at most one row per symbol, the caller prefers
 * an active position over a same-symbol pending order, same priority
 * `chartPosition` uses elsewhere), each with its own correctly-
 * resolved "Goto Chart" straight to that symbol.
 *
 * Listed as stacked rows rather than a dropdown — by direct follow-up
 * question ("how will it handle multiple orders from different pairs
 * ... list the Goto button for each pair, or a drop-down"): a trader
 * realistically holds a handful of concurrent positions at once, not
 * dozens, so a scannable list costs one glance and zero extra clicks,
 * where a dropdown would add an open-then-select step for something
 * this short. Matches this app's own existing convention for "several
 * symbols at once" too — PairsPanel already shows saved pairs as a
 * row of pills rather than a picker. Revisit as a dropdown only if
 * real usage shows people routinely holding many concurrent positions
 * at once, which nothing today's usage suggests. */
export function NoPositionCard({ dark, otherTrades }: { dark: boolean; otherTrades?: Trade[] }) {
  const cardCls = `rounded-xl border p-4 space-y-2.5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white/60' : 'bg-white border-gray-200 text-gray-500'}`;
  const rowCls = 'flex items-center justify-between gap-3 flex-wrap';
  const btnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-corporate-hero hover:opacity-90 shrink-0';
  return (
    <div className={cardCls}>
      {/* "No open or pending order on this symbol right now" was
          removed here — by direct request, it's redundant: if there
          WAS one on this symbol, PositionManager renders instead of
          this card at all, so stating that fact added nothing. The
          rows below (if any) already say exactly where a trader's
          real order is. Only the genuinely-nothing-anywhere case still
          gets a line, so the card is never just a blank box. */}
      {(!otherTrades || otherTrades.length === 0) && (
        <div className="text-sm">No open trades anywhere right now.</div>
      )}
      {otherTrades?.map((t, i) => {
        const pair = pairFromTradeSymbol(t.symbol, t.broker_name);
        return (
          // No top border on the first row anymore — it used to
          // separate this list from the redundant "no order on this
          // symbol" line right above, which is gone now.
          <div key={t.trade_id} className={`${rowCls} ${i > 0 ? `pt-2.5 border-t ${dark ? 'border-white/10' : 'border-gray-100'}` : ''}`}>
            <span className="text-sm">You have {t.status === 'pending' ? 'a pending order' : 'an open position'} on {t.symbol} instead.</span>
            {/* "Position Chart" — matches PositionManager's own label
                for this exact same idea (the chart where a real order
                actually is), by direct follow-up request. */}
            <Link to={`/trade/manual?tv=${encodeURIComponent(pair.tv)}`} target="_blank" rel="noopener noreferrer" className={btnCls}>
              <LineChart size={13} /> Position Chart ({pair.tv})
            </Link>
          </div>
        );
      })}
    </div>
  );
}

/** What the folded "Position" card shows for the brief window between
 * opening it and the caller's FIRST position poll actually resolving —
 * by direct bug report: "I observed a time lag after position is
 * clicked before the blue button shows — You have a pending order on
 * BTCUSDT instead." The real cause wasn't the poll itself being slow
 * so much as `position`/`otherOpenTrades` having no way to say "still
 * checking" — before that first poll resolved they looked identical to
 * "confirmed you have nothing," so NoPositionCard rendered that
 * confident-but-wrong empty state for a moment, then visibly flipped
 * to the real answer once data arrived. This neutral state removes
 * that flip: it never claims "no order" until the caller's own poll
 * has actually returned once.
 */
export function PositionLoadingCard({ dark }: { dark: boolean }) {
  const cardCls = `rounded-xl border p-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white/50' : 'bg-white border-gray-200 text-gray-400'}`;
  return (
    <div className={cardCls}>
      <div className="text-sm flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Checking your open positions…
      </div>
    </div>
  );
}

/** Placeholder shown for the brief window before useEffectiveChartColors'
 * `hydrated` flips true — see that hook's own docstring for why
 * TradingViewChart must never mount before then (it would build the
 * widget once with defaults, then again moments later with the real
 * saved colors, and that second near-simultaneous construction is the
 * confirmed root cause of TradingView rendering the wrong symbol on a
 * bare page load). */
function ChartHydratingPlaceholder({ dark }: { dark: boolean }) {
  return (
    <div className={`h-full w-full flex items-center justify-center text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
      <span className="inline-block w-3 h-3 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin" />
      Loading chart…
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
  onPositionChanged,
  otherOpenTrades,
  otherSamePairPositions,
  positionLoading,
  onQuickTrade,

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
   * any — the RAW Trade (not just entry/SL/TP), so the folded
   * "Position" card can do real trade management (edit SL/TP, partial
   * close, cancel pending), not just display numbers — by direct
   * request ("make the position button allow trade management - Edit
   * SL, TP, Partial TP or Partial Close etc"). Reuses PositionManager,
   * the exact same component TradeRow's Manage view and
   * ManualTradingPage's side panel already use — one implementation,
   * not a second read-only one. A second "On Chart" toggle draws the
   * same trade's Entry/SL/TP as real lines on this app's own
   * CandleChart (see PositionOnChartModal.tsx for why that's a
   * separate chart rather than something drawn on the embedded
   * TradingView widget).
   *
   * Position/On Chart are permanent, always-visible buttons — by
   * further direct request ("make 'Position' and 'On Chart' a
   * permanent feature on all charts ... you can always click on it to
   * review order position") — not conditional on `position` being set;
   * `null`/omitted just means NoPositionCard's honest empty state
   * shows instead of PositionManager when opened, still with its own
   * Goto Chart button. */
  position?: Trade | null;
  /** Called after an edit/cancel/partial-close inside the folded
   * Position card succeeds, so the caller can re-poll and pass a fresh
   * `position` down — same contract as PositionManager's own
   * `onChanged`. Optional: omitting it just means the card won't
   * reflect a change until the caller's own poll next runs. */
  onPositionChanged?: () => void;
  /** Every other open/pending trade the caller already knows about, on
   * a DIFFERENT symbol than this chart's own `position` — one per
   * distinct symbol (the caller dedupes). Surfaced in NoPositionCard's
   * empty state as one row each so a trader isn't left thinking they
   * have nothing on anywhere just because this particular symbol is
   * quiet. See NoPositionCard's own docstring for the bug report this
   * fixes and why a list rather than a dropdown. Omit if the caller
   * doesn't track this (the empty state then just doesn't mention it,
   * same as before). */
  otherOpenTrades?: Trade[];
  /** Every OTHER trade on this SAME symbol, beyond `position` itself —
   * by direct request ("Show option to show multiple live trades on
   * the same pair in the 'On Chart' ... Position feature in the
   * charts ... should show all current live positions as individual
   * position cards"). A trader can genuinely hold more than one
   * independent position on the same symbol at once (two manual
   * entries, or a bot position alongside a manual one). Additive and
   * optional: omit it and everything behaves exactly as before
   * (single-position display) — only ChartWithPairs computes and
   * passes it today. Each entry gets its own folded PositionManager
   * card, same as `position` itself, and its own selectable line set
   * inside On Chart (see PositionOnChartModal's own docstring). */
  otherSamePairPositions?: Trade[];
  /** True only until the caller's OWN position poll has resolved for
   * the very first time — see PositionLoadingCard's own docstring for
   * the lag this fixes. Omit if the caller doesn't track this; the
   * card then falls back to its previous behavior (position/
   * otherOpenTrades treated as already-known, even on the very first
   * render). */
  positionLoading?: boolean;
  /** Wire this to your order form's direction/entry/SL/TP setters to
   * enable the "Quick Trade" Long/Short drag tool inside "On Chart" —
   * by direct request ("the quick trade button from the short
   * position or long position tradingview tool ... integrate this
   * with my order position form so that the entry level, SL and TP
   * are automatically populated"). Forwarded straight to
   * PositionOnChartModal's own `onQuickTrade` — see that component's
   * QUICK TRADE docstring for why this can't come from the embedded
   * TradingView widget itself. Omit on a page with no order form
   * (Dashboard, Insights, Tools) and the tool button simply doesn't
   * render there, same convention as onQuickFill/onToggleOrderForm. */
  onQuickTrade?: (trade: { direction: 'long' | 'short'; entryPrice: number; stopLoss: number; takeProfit: number }) => void;

}) {
  const navigate = useNavigate();
  const effectiveSpecsSymbol = specsSymbol ?? tradeSymbol;
  // Plain exchange-format ticker (e.g. "BTCUSDT", never tv-prefixed)
  // for PositionOnChartModal's own `symbol` prop when there's no open
  // position to take it from — order_flow.py's /klines needs exactly
  // this bare format. NOT used for Goto Chart links: those use this
  // component's own top-level `symbol` prop directly (already the
  // real, exact EXCHANGE:TICKER on screen — no guessing needed).
  const resolvedTradeSymbol = position?.symbol ?? effectiveSpecsSymbol;
  const { colors, chartStyle, hydrated: colorsHydrated, applyLocal, applyGlobal, resetLocal, resetGlobal } = useEffectiveChartColors();
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
  const [onChartOpen, setOnChartOpen] = useState(false);
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
            title={pairsOpen ? 'Hide pairs and exchanges' : 'Search instrument pairs'}
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
              pairsOpen ? 'bg-blue-600 text-white' : containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
            }`}
          >
            {/* Search (magnifying glass) — by direct request ("the
                search icon in the chart is missing ... TradingView
                search icon for pairs instrument pairs"): this button
                already opens the real TradingView-backed instrument
                search (PairsPanel's own "+" search, itself backed by
                order_flow.py's chart_symbol_search), it just never
                looked like a search affordance — CandlestickChart read
                as a chart-type toggle instead. */}
            <Search size={13} /> Pairs
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
        <button
          onClick={() => setPositionOpen((o) => !o)}
          aria-label={positionOpen ? 'Hide position management' : 'Review or manage this position'}
          title={position ? 'Edit SL/TP, partial close or cancel this order' : 'No open or pending order on this symbol yet'}
          className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
            positionOpen ? 'bg-blue-600 text-white' : containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
          }`}
        >
          <Target size={13} /> Position
        </button>
        <button
          onClick={() => setOnChartOpen(true)}
          aria-label="Show Entry/SL/TP drawn on a real chart"
          title={position ? 'Open a chart with Entry/SL/TP actually drawn on it' : 'Open a chart for this symbol'}
          className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${containerDark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'}`}
        >
          <LineChart size={13} /> On Chart
        </button>
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
        {positionOpen && (
          <div className="mb-2">
            {positionLoading && !position
              ? <PositionLoadingCard dark />
              : <PositionGroup
                  position={position} otherSamePairPositions={otherSamePairPositions}
                  dark onPositionChanged={onPositionChanged} otherOpenTrades={otherOpenTrades}
                />}
          </div>
        )}
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden">
          {colorsHydrated
            ? <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
            : <ChartHydratingPlaceholder dark />}
        </div>
        {onChartOpen && resolvedTradeSymbol && (
          <PositionOnChartModal
            position={position ? tradeToChartPosition(position) : undefined} trade={position} symbol={resolvedTradeSymbol}
            otherSamePairPositions={otherSamePairPositions}
            bullColor={colors.upColor} bearColor={colors.downColor} initialInterval={interval}
            onClose={() => setOnChartOpen(false)} onChanged={onPositionChanged} onQuickTrade={onQuickTrade}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      {pairsOpen && pairsPanel}
      {positionOpen && (
        <div className="mb-2">
          {positionLoading && !position
            ? <PositionLoadingCard dark={containerDark} />
            : <PositionGroup
                position={position} otherSamePairPositions={otherSamePairPositions}
                dark={containerDark} onPositionChanged={onPositionChanged} otherOpenTrades={otherOpenTrades}
              />}
        </div>
      )}
      <div className={`rounded-lg overflow-hidden ${chartDark ? '' : 'border border-gray-200'}`} style={{ height }}>
        {colorsHydrated
          ? <TradingViewChart symbol={symbol} interval={interval} theme={chartTheme} candleColors={colors} chartStyle={chartStyle} />
          : <ChartHydratingPlaceholder dark={chartDark} />}
      </div>
      {onChartOpen && resolvedTradeSymbol && (
        <PositionOnChartModal
          position={position ? tradeToChartPosition(position) : undefined} trade={position} symbol={resolvedTradeSymbol}
          otherSamePairPositions={otherSamePairPositions}
          bullColor={colors.upColor} bearColor={colors.downColor} initialInterval={interval}
          onClose={() => setOnChartOpen(false)} onChanged={onPositionChanged} onQuickTrade={onQuickTrade}
        />
      )}
    </div>
  );

}
