import { useEffect, useRef, memo } from 'react';
import type { Trade } from '../types';

/**
 * TradingViewChart — embeds the free TradingView widget (Method 1 from
 * your reference doc). TradingView hosts the chart and streams the
 * data; this app pays no data costs and does zero chart rendering
 * itself.
 *
 * Full drawing tools and indicators are already part of this free
 * widget by default (its own side + top toolbars — trend lines,
 * Fibonacci, shapes, the Indicators picker, etc.) — nothing extra to
 * build there; `hide_side_toolbar`/`hide_top_toolbar` are explicitly
 * set to false below so a container-sizing issue can't accidentally
 * hide them. The one thing this free widget genuinely can't do is
 * SAVE what's drawn back to our own backend (see the module docstring
 * below on why) — every page using this component should show the
 * same full toolset either way; only persistence differs by page.
 *
 * candleColors lets a page (My Workspace, Manual Trading, Free Chart)
 * offer a color picker for the candle up/down/wick/border colors —
 * passed straight through as the widget's own `overrides`, a real
 * TradingView widget option, not a custom re-implementation.
 *
 * HONEST LIMITATION, matching the reference doc exactly: because the
 * chart lives inside TradingView's own iframe, Claude/Trade AI cannot
 * read what's drawn on it automatically. If a user wants the coach's
 * take on their own markings, they type the details into Trade AI or
 * upload a screenshot — there is no code path that lets this
 * component silently hand chart pixels to an LLM. Don't build a
 * feature that implies otherwise; it would be lying to the user about
 * what the AI can see.
 *
 * Saving: the free widget exposes no public API to read back what a
 * user has drawn (no save/load hook) — that requires TradingView's
 * paid Advanced Charts Library, which this app doesn't have a license
 * for. So "My Workspace can save, Free Chart can't" (see
 * TradingViewFramePage.tsx) is real at the symbol+interval+color-
 * preference level — what chart_layouts.py's API actually persists —
 * not at the drawn-trendline level, which no mode of this component
 * can read back regardless of page.
 *
 * `ChartPosition` — the caller's own open trade (Entry/SL/TP1-3), by
 * direct request ("view active trades on the chart in a dynamic way,
 * showing entry, SL and TP with current PL or drawdown"). This type is
 * still defined and exported here, but this component itself no
 * longer draws anything with it — see the correction below.
 *
 * CORRECTION (confirmed against TradingView's own docs, by direct bug
 * report — "the pending and executed orders are still not showing
 * with thin horizontal lines on the chart"): an earlier version of
 * this file called `widget.onChartReady()` + `chart().createShape()`
 * to draw real price-aligned horizontal lines, believing that API
 * shipped with the free public `tv.js` embed used here. It does not —
 * `onChartReady`/`chart()`/`createShape()`/`removeEntity()` are part
 * of TradingView's separately-licensed, self-hosted "Charting
 * Library" (manual approval + NDA required), not the hosted Advanced
 * Chart widget this app actually embeds. Those calls were silently
 * no-op'ing (or throwing and being swallowed by the try/catch around
 * each shape) the entire time — no amount of fixing how `position` was
 * wired down to this component could ever have made lines appear,
 * because the widget object here simply doesn't have that method.
 * Rather than keep dead code that implies a capability this embed
 * doesn't have, the caller-visible position info now lives in
 * ChartPanel's own foldable "Position" overlay card, rendered outside
 * the TradingView iframe entirely — see ChartPanel.tsx.
 */

/** The subset of a live position TradingViewChart needs to overlay —
 * a caller passes only the ACTIVE trade whose `symbol` already
 * matches what's on screen (matching is the caller's job, same as
 * `tradeSymbol`/`specsSymbol` above; this component trusts what it's
 * given and draws it unconditionally). */
export interface ChartPosition {
  direction: Trade['direction'];
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit1?: number | null;
  takeProfit2?: number | null;
  takeProfit3?: number | null;
  unrealizedPnl?: number | null;
  /** True for a PENDING (not yet filled) limit/stop order — same
   * Entry/SL/TP lines are drawn, but the Entry label shows "Pending"
   * instead of a live P/L, since a position that isn't open yet has
   * none. By direct request ("show same for pending trades also ...
   * with comment pending instead of the dynamic PL"). */
  pending?: boolean;
}

export interface CandleColors {
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
}

/** TradingView's own real series-style ids — see useCandleColors.ts's CHART_STYLES. */
export type ChartStyleId = '1' | '9' | '8' | '0' | '2' | '3' | '10';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  height?: string | number;
  candleColors?: CandleColors;
  /** Which series style to render — Candles, Hollow Candles, Heikin
   * Ashi, Bars, Line, Area, Baseline. Defaults to plain Candles. */
  chartStyle?: ChartStyleId;
}

/** Shared with ChartPanel's PositionSummaryCard, so the sign styling
 * of a live P/L figure is identical wherever it's shown. */
export function formatSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/**
 * Each TradingView series style has its OWN override namespace — a
 * Line chart has no "candleStyle", a Baseline chart has no single
 * "upColor" concept, etc. This maps candleColors' up/down pair onto
 * whichever namespace the current chartStyle actually uses, rather
 * than always writing candleStyle overrides that a non-candle style
 * would just silently ignore.
 */
function buildOverrides(colors: CandleColors | undefined, chartStyle: ChartStyleId): Record<string, string> {
  if (!colors) return {};
  const { upColor, downColor, wickUpColor, wickDownColor, borderUpColor, borderDownColor } = colors;
  switch (chartStyle) {
    // Hollow Candles and Heikin Ashi actually DO expose separate
    // wickUpColor/wickDownColor keys, same as plain Candles — the prior
    // comment here claiming only a single shared `wickColor` existed
    // was wrong (re-confirmed against TradingView's own
    // ChartPropertiesOverrides reference). Setting only the generic
    // `wickColor` left the real wickUpColor/wickDownColor at their
    // library defaults (green/red), which take precedence over it, so
    // selecting e.g. Monochrome still showed red/green wicks on Hollow
    // Candles — by direct bug report. Now both direction-specific keys
    // are set (mirroring the Candles case below), with `wickColor` kept
    // too as a same-value fallback for any older widget build that only
    // understands the unified key.
    case '9': // Hollow Candles
      return {
        ...(upColor && { 'mainSeriesProperties.hollowCandleStyle.upColor': upColor }),
        ...(downColor && { 'mainSeriesProperties.hollowCandleStyle.downColor': downColor }),
        ...(borderUpColor && { 'mainSeriesProperties.hollowCandleStyle.borderUpColor': borderUpColor }),
        ...(borderDownColor && { 'mainSeriesProperties.hollowCandleStyle.borderDownColor': borderDownColor }),
        ...(wickUpColor && { 'mainSeriesProperties.hollowCandleStyle.wickUpColor': wickUpColor }),
        ...(wickDownColor && { 'mainSeriesProperties.hollowCandleStyle.wickDownColor': wickDownColor }),
        ...((wickUpColor || upColor) && { 'mainSeriesProperties.hollowCandleStyle.wickColor': wickUpColor || upColor }),
      };
    case '8': // Heikin Ashi
      return {
        ...(upColor && { 'mainSeriesProperties.haStyle.upColor': upColor }),
        ...(downColor && { 'mainSeriesProperties.haStyle.downColor': downColor }),
        ...(borderUpColor && { 'mainSeriesProperties.haStyle.borderUpColor': borderUpColor }),
        ...(borderDownColor && { 'mainSeriesProperties.haStyle.borderDownColor': borderDownColor }),
        ...(wickUpColor && { 'mainSeriesProperties.haStyle.wickUpColor': wickUpColor }),
        ...(wickDownColor && { 'mainSeriesProperties.haStyle.wickDownColor': wickDownColor }),
        ...((wickUpColor || upColor) && { 'mainSeriesProperties.haStyle.wickColor': wickUpColor || upColor }),
      };
    case '0': // Bars
      return {
        ...(upColor && { 'mainSeriesProperties.barStyle.upColor': upColor }),
        ...(downColor && { 'mainSeriesProperties.barStyle.downColor': downColor }),
      };
    case '2': // Line — one line, so "up" is the line color
      return { ...(upColor && { 'mainSeriesProperties.lineStyle.color': upColor }) };
    case '3': // Area — one line + fill, same idea
      return {
        ...(upColor && { 'mainSeriesProperties.areaStyle.linecolor': upColor }),
        ...(upColor && { 'mainSeriesProperties.areaStyle.color1': upColor }),
        ...(upColor && { 'mainSeriesProperties.areaStyle.color2': upColor }),
      };
    case '10': // Baseline — genuinely has an up (top) and down (bottom) line
      return {
        ...(upColor && { 'mainSeriesProperties.baselineStyle.topLineColor': upColor }),
        ...(downColor && { 'mainSeriesProperties.baselineStyle.bottomLineColor': downColor }),
      };
    case '1': // Candles
    default:
      return {
        ...(upColor && { 'mainSeriesProperties.candleStyle.upColor': upColor }),
        ...(downColor && { 'mainSeriesProperties.candleStyle.downColor': downColor }),
        ...(wickUpColor && { 'mainSeriesProperties.candleStyle.wickUpColor': wickUpColor }),
        ...(wickDownColor && { 'mainSeriesProperties.candleStyle.wickDownColor': wickDownColor }),
        ...(borderUpColor && { 'mainSeriesProperties.candleStyle.borderUpColor': borderUpColor }),
        ...(borderDownColor && { 'mainSeriesProperties.candleStyle.borderDownColor': borderDownColor }),
      };
  }
}

/** Volume's own up/down bars follow the same up/down colors chosen for
 * the candles — by direct request ("let the volume also follow the
 * chart colour selected"). The widget already shows its own Volume
 * pane by default on every symbol — explicitly adding
 * "Volume@tv-basicstudies" via `studies` (an earlier version of this
 * fix) stacked a SECOND, duplicate volume track underneath the
 * built-in one instead of styling it, by direct bug report ("all
 * charts now shown two volumes tracks by mistake"). `studies_overrides`
 * alone (a distinct namespace from the candle `overrides` above) is
 * the widget's real option for the ALREADY-present default volume
 * study's own plot colors — no separate `studies` entry needed. */
function buildStudiesOverrides(colors: CandleColors | undefined): Record<string, string | number> {
  const upColor = colors?.upColor || '#26a69a';
  const downColor = colors?.downColor || '#ef5350';
  return {
    'volume.volume.color.0': downColor,
    'volume.volume.color.1': upColor,
    'volume.volume.transparency': 50,
  };
}

function TradingViewChartBase({
  symbol = 'OANDA:EURUSD',
  interval = '60',
  theme = 'light',
  height = '100%',
  candleColors,
  chartStyle = '1',
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv_chart_${Math.random().toString(36).slice(2)}`);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // `cancelled` matters: the widget script can still be loading when
    // the symbol changes, and TWO pending createWidget callbacks racing
    // into the same container is exactly how a chart ends up showing the
    // FIRST (usually default BTC) symbol after you picked another one —
    // the reported "the chart still shows BTC whatever I click". Each run
    // also mounts into a freshly-named div, so a widget from a previous
    // run can never re-attach to the current one.
    let cancelled = false;

    function destroyPreviousWidget() {
      // CONFIRMED, still-live bug (by repeat report, with video proof:
      // even the widget's OWN internal symbol-search box never updates
      // — not just our candles — ruling out every caching layer, since
      // it reproduces in a fresh Incognito session too). Root cause:
      // `widgetRef.current` was only ever discarded by wiping its DOM
      // container (`innerHTML = ''`) — the widget object itself, and
      // whatever internal state TradingView's tv.js keeps for it (this
      // free embed widget is documented to persist "last symbol shown"
      // across instances on the same page when `allow_symbol_change` is
      // on), was never actually torn down. TradingView's own widget
      // constructor exposes a real `remove()` method for exactly this —
      // call it before building the next widget so nothing carries
      // forward. Guarded: `remove()` can itself throw if the widget
      // never finished initializing (e.g. torn down mid-load), which
      // must never block building the next, correct widget.
      const prev = widgetRef.current;
      widgetRef.current = null;
      if (prev && typeof prev.remove === 'function') {
        try { prev.remove(); } catch { /* already gone — nothing to clean up */ }
      }
    }

    function createWidget() {
      // @ts-expect-error — TradingView attaches this global at runtime, no official types package
      if (cancelled || !window.TradingView || !containerRef.current) return;
      // Whether this run is REPLACING a live widget (a symbol/interval/
      // theme/etc change) vs. the very first mount — see the deferred
      // mountWidget() call below for why this matters.
      const hadPreviousWidget = widgetRef.current != null;
      destroyPreviousWidget();
      containerRef.current.innerHTML = '';
      containerId.current = `tv_chart_${Math.random().toString(36).slice(2)}`;
      const chartDiv = document.createElement('div');
      chartDiv.id = containerId.current;
      chartDiv.style.height = '100%';
      chartDiv.style.width = '100%';
      containerRef.current.appendChild(chartDiv);

      function mountWidget() {
        // @ts-expect-error — see above
        if (cancelled || !window.TradingView) return;
        // @ts-expect-error — see above
        const widget = new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: 'Etc/UTC',
          theme,
          style: chartStyle,
          locale: 'en',
          enable_publishing: false,
          // STILL BROKEN with `true`, confirmed by direct re-report
          // after the .remove()/timing fixes above (still not fixed on
          // the trade chart, only the backend-driven On Chart view
          // which isn't this widget at all). Both those fixes assumed a
          // JS-side race; this app has zero programmatic control over
          // what's actually wrong inside TradingView's own free
          // widget, but `allow_symbol_change` is TradingView's own
          // documented trigger for it to remember and restore the last
          // MANUALLY-searched symbol across re-initializations — which
          // fights directly against this app's own `symbol` prop the
          // moment a trader has ever typed into the widget's own
          // internal search box once. Turned off: every page that
          // embeds this component already has its own app-level
          // symbol picker (PairsPanel, with its own real
          // TradingView-backed search) that does the same job without
          // that persistence, so the widget's own redundant search
          // isn't a capability actually lost.
          allow_symbol_change: false,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          container_id: containerId.current,
          overrides: buildOverrides(candleColors, chartStyle),
          studies_overrides: buildStudiesOverrides(candleColors),
        });
        widgetRef.current = widget;
      }

      // CONFIRMED, still-recurring after the .remove()/fresh-container
      // fix above (by direct bug report, with video: picking a
      // different pair froze the chart on the OLD symbol's candles AND
      // price feed — the "Chart symbol:" label and TradingView's own
      // quote line both updated, but the actual chart pane never did).
      // A replacement widget constructed in the SAME tick its
      // predecessor's `.remove()` ran can race TradingView's own
      // cross-origin iframe teardown / postMessage handshake — `.remove()`
      // returning doesn't guarantee that handshake has actually finished
      // before the next `new TradingView.widget()` call starts its own.
      // One tick's grace before constructing the replacement is a
      // standard, low-risk defensive pattern for exactly this class of
      // "destroy+recreate too fast" third-party iframe bug. Only applied
      // when actually replacing a widget — first mount (nothing to race
      // against) still creates immediately, so initial chart load isn't
      // delayed.
      if (hadPreviousWidget) {
        window.setTimeout(mountWidget, 60);
      } else {
        mountWidget();
      }
    }

    const existingScript = document.getElementById('tradingview-widget-script');
    // @ts-expect-error — runtime global
    if (existingScript && window.TradingView) {
      createWidget();
    } else if (existingScript) {
      existingScript.addEventListener('load', createWidget);
    } else {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      destroyPreviousWidget();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, theme, chartStyle, JSON.stringify(candleColors)]);

  // `key={symbol}` forces React itself to throw away and rebuild this
  // exact DOM node (not just its children) on every symbol change, on
  // top of destroyPreviousWidget()/innerHTML above — belt-and-suspenders
  // against a third-party widget's own internal state ever surviving
  // into the next instance, given how load-bearing "the chart actually
  // updates" is and how this exact bug has already recurred once.
  return <div key={symbol} ref={containerRef} style={{ height, width: '100%' }} />;
}

export const TradingViewChart = memo(TradingViewChartBase);
