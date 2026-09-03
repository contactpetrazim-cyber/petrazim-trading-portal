import { useEffect, useRef, memo } from 'react';

/**
 * TradingViewChart — embeds the free TradingView widget (Method 1 from
 * your reference doc). TradingView hosts the chart and streams the
 * data; this app pays no data costs and does zero chart rendering
 * itself.
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
 * If real chart-aware AI analysis becomes a priority later, the
 * reference doc's three real options are: (1) the paid Advanced
 * Charts Library with a JS layer that extracts drawn objects as JSON,
 * (2) a raw market-data WebSocket feed straight into Claude — no
 * TradingView needed for that, Claude reads candles as numbers just
 * fine, or (3) canvas.toDataURL() snapshots sent as images to Claude's
 * vision input. All three are real, separate build decisions — this
 * component is deliberately just the free widget, decided pragmatically
 * for now rather than over-building before it's needed.
 */

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  height?: string | number;
}

function TradingViewChartBase({
  symbol = 'OANDA:EURUSD',
  interval = '60',
  theme = 'dark',
  height = '100%',
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
          container_id: containerId.current,
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
  }, [symbol, interval, theme]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}

export const TradingViewChart = memo(TradingViewChartBase);
