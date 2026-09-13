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
 * `position` — draws the caller's own open trade (Entry/SL/TP1-3) as
 * horizontal lines with live labels, by direct request ("view active
 * trades on the chart in a dynamic way, showing entry, SL and TP with
 * current PL or drawdown"). This is ONE-WAY, same honest boundary as
 * the paragraph above: we WRITE shapes onto the chart via the free
 * widget's public Widget API (`onChartReady` + `chart().createShape`),
 * we never READ anything back. That API ships with the free tv.js
 * embed — no paid Charting/Trading Library needed — but it is NOT the
 * paid Library's `createOrderLine`/`createPositionLine`, so these
 * lines are plain, non-draggable markers, redrawn from fresh backend
 * data on every `position` update rather than live-dragged by the
 * user. Re-drawn (not just re-labelled) on each update because the
 * widget API has no "update shape text in place" call — only
 * create/remove.
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
  /** The caller's own open position on this exact symbol, or omit/null
   * for none — see the `position` doc above. */
  position?: ChartPosition | null;
}

/** Horizontal-line color per line kind — matches the green/red the
 * rest of the app already uses for profit/loss (TradeAnalytics.tsx,
 * PortfolioSummary) rather than inventing a new palette here. */
const ENTRY_COLOR = '#2962FF';
const SL_COLOR = '#EF5350';
const TP_COLOR = '#26A69A';

function formatSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/** Removes this render's previously-drawn shapes, then draws fresh
 * ones for `position` — see the class-level doc for why "remove +
 * recreate" rather than "update in place" (the widget API offers no
 * update call). Wrapped in try/catch per-shape: `chart` can throw if
 * the symbol just changed underneath it mid-draw (widget API objects
 * are not React-safe against a mount/unmount race), and one bad line
 * shouldn't take down the rest — same defensive spirit as this file's
 * existing `cancelled` guard against the BTC-still-showing race. */
function drawPositionOverlay(chart: any, position: ChartPosition | null | undefined, shapeIds: number[]): number[] {
  for (const id of shapeIds) {
    try { chart.removeEntity(id); } catch { /* already gone */ }
  }
  if (!position) return [];

  const drawn: number[] = [];
  const addLine = (price: number | null | undefined, color: string, text: string) => {
    if (price == null) return;
    try {
      const id = chart.createShape(
        { price },
        {
          shape: 'horizontal_line',
          lock: true,
          disableSelection: true,
          disableSave: true,
          disableUndo: true,
          zOrder: 'top',
          text,
          overrides: { linecolor: color, linewidth: 1, linestyle: 2, showLabel: true, textcolor: color, fontsize: 11, bold: true },
        }
      );
      if (typeof id === 'number') drawn.push(id);
    } catch { /* symbol/interval changed mid-draw — next effect run redraws */ }
  };

  const dirLabel = position.direction === 'long' ? 'LONG' : 'SHORT';
  const pnlLabel = position.unrealizedPnl != null ? `  P/L ${formatSignedMoney(position.unrealizedPnl)}` : '';
  addLine(position.entryPrice, ENTRY_COLOR, `Entry ${dirLabel} ${position.entryPrice}${pnlLabel}`);
  addLine(position.stopLoss, SL_COLOR, `SL ${position.stopLoss}`);
  addLine(position.takeProfit1, TP_COLOR, `TP1 ${position.takeProfit1}`);
  addLine(position.takeProfit2, TP_COLOR, `TP2 ${position.takeProfit2}`);
  addLine(position.takeProfit3, TP_COLOR, `TP3 ${position.takeProfit3}`);
  return drawn;
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
  position,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv_chart_${Math.random().toString(36).slice(2)}`);
  const widgetRef = useRef<any>(null);
  const chartReadyRef = useRef(false);
  const shapeIdsRef = useRef<number[]>([]);
  const positionRef = useRef(position);
  positionRef.current = position;

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

    function createWidget() {
      // @ts-expect-error — TradingView attaches this global at runtime, no official types package
      if (cancelled || !window.TradingView || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      containerId.current = `tv_chart_${Math.random().toString(36).slice(2)}`;
      const chartDiv = document.createElement('div');
      chartDiv.id = containerId.current;
      chartDiv.style.height = '100%';
      chartDiv.style.width = '100%';
      containerRef.current.appendChild(chartDiv);

      chartReadyRef.current = false;
      shapeIdsRef.current = [];

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
        allow_symbol_change: true,
        hide_side_toolbar: false,
        hide_top_toolbar: false,
        withdateranges: true,
        container_id: containerId.current,
        overrides: buildOverrides(candleColors, chartStyle),
        studies_overrides: buildStudiesOverrides(candleColors),
      });
      widgetRef.current = widget;
      widget.onChartReady(() => {
        if (cancelled) return;
        chartReadyRef.current = true;
        shapeIdsRef.current = drawPositionOverlay(widget.activeChart(), positionRef.current, []);
      });
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

    return () => { cancelled = true; };
  }, [symbol, interval, theme, chartStyle, JSON.stringify(candleColors)]);

  // Redraws the position overlay on its own — deliberately NOT in the
  // widget-creation effect above, so a live P/L update (polled every
  // few seconds by the caller) just re-labels the lines instead of
  // tearing down and rebuilding the entire TradingView iframe.
  useEffect(() => {
    if (!chartReadyRef.current || !widgetRef.current) return;
    shapeIdsRef.current = drawPositionOverlay(widgetRef.current.activeChart(), position, shapeIdsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(position)]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}

export const TradingViewChart = memo(TradingViewChartBase);
