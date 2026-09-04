import { useEffect, useRef, memo } from 'react';

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
 */

export interface CandleColors {
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
}

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  height?: string | number;
  candleColors?: CandleColors;
}

function buildOverrides(colors?: CandleColors): Record<string, string> {
  if (!colors) return {};
  const map: Record<string, keyof CandleColors> = {
    'mainSeriesProperties.candleStyle.upColor': 'upColor',
    'mainSeriesProperties.candleStyle.downColor': 'downColor',
    'mainSeriesProperties.candleStyle.wickUpColor': 'wickUpColor',
    'mainSeriesProperties.candleStyle.wickDownColor': 'wickDownColor',
    'mainSeriesProperties.candleStyle.borderUpColor': 'borderUpColor',
    'mainSeriesProperties.candleStyle.borderDownColor': 'borderDownColor',
  };
  const overrides: Record<string, string> = {};
  for (const [key, prop] of Object.entries(map)) {
    const value = colors[prop];
    if (value) overrides[key] = value;
  }
  return overrides;
}

function TradingViewChartBase({
  symbol = 'OANDA:EURUSD',
  interval = '60',
  theme = 'dark',
  height = '100%',
  candleColors,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv_chart_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!containerRef.current) return;

    function createWidget() {
      // @ts-expect-error — TradingView attaches this global at runtime, no official types package
      if (window.TradingView && containerRef.current) {
        containerRef.current.innerHTML = '';
        const chartDiv = document.createElement('div');
        chartDiv.id = containerId.current;
        chartDiv.style.height = '100%';
        chartDiv.style.width = '100%';
        containerRef.current.appendChild(chartDiv);

        // @ts-expect-error — see above
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: 'Etc/UTC',
          theme,
          style: '1',
          locale: 'en',
          enable_publishing: false,
          allow_symbol_change: true,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          container_id: containerId.current,
          overrides: buildOverrides(candleColors),
        });
      }
    }

    const existingScript = document.getElementById('tradingview-widget-script');
    if (existingScript) {
      createWidget();
    } else {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.body.appendChild(script);
    }
  }, [symbol, interval, theme, JSON.stringify(candleColors)]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}

export const TradingViewChart = memo(TradingViewChartBase);
