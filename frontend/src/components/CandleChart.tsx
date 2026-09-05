export interface Candle {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartZone {
  fromIndex: number;
  toIndex: number;
  priceTop: number;
  priceBottom: number;
  color: string;
  label?: string;
  /** Makes the zone itself tappable (Zone Tapper's "select on the chart"
   * mechanic, distinct from choosing from a separate button list). */
  onClick?: () => void;
}

export interface ChartMarker {
  index: number;
  price: number;
  label: string;
  color?: string;
  /** 'above' places the label above the price point, 'below' below it. */
  side?: 'above' | 'below';
}

export interface ChartLine {
  price: number;
  label?: string;
  color?: string;
  dashed?: boolean;
}

/**
 * CandleChart — a real, hand-rolled SVG candlestick renderer with
 * annotation overlays (zones, point markers, horizontal lines). Built
 * because the app's only existing chart surface (TradingViewChart) is
 * a free TradingView iframe embed that explicitly can't be annotated
 * (see that component's own docstring) — teaching diagrams, "identify
 * the concept" games, and "what happens next" games all need to draw
 * on TOP of a chart, which needs a chart this app actually owns pixel
 * access to.
 *
 * Deliberately simple (no zoom/pan/crosshair) — this renders a fixed
 * window of candles for teaching purposes, not a live trading chart
 * (ChartPanel/TradingViewChart remain what a trader actually trades
 * off of).
 */
export function CandleChart({
  candles,
  zones = [],
  markers = [],
  lines = [],
  height = 260,
  dark = false,
  bullColor = '#22c55e',
  bearColor = '#ef4444',
}: {
  candles: Candle[];
  zones?: ChartZone[];
  markers?: ChartMarker[];
  lines?: ChartLine[];
  height?: number;
  dark?: boolean;
  bullColor?: string;
  bearColor?: string;
}) {
  if (candles.length === 0) return null;

  const width = 100; // viewBox units — scales responsively via the wrapping svg width=100%
  const padLeft = 8;
  const padRight = 2;
  const padTop = 8;
  const padBottom = 8;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const allPrices = [
    ...candles.flatMap((c) => [c.high, c.low]),
    ...zones.flatMap((z) => [z.priceTop, z.priceBottom]),
    ...lines.map((l) => l.price),
    ...markers.map((m) => m.price),
  ];
  const priceMax = Math.max(...allPrices);
  const priceMin = Math.min(...allPrices);
  const priceRange = Math.max(priceMax - priceMin, 1e-9);
  const priceMargin = priceRange * 0.08;
  const yTop = priceMax + priceMargin;
  const yBottom = priceMin - priceMargin;
  const yRange = yTop - yBottom;

  const slotWidth = plotWidth / candles.length;
  const bodyWidth = slotWidth * 0.62;

  function x(index: number): number {
    return padLeft + slotWidth * index + slotWidth / 2;
  }
  function y(price: number): number {
    return padTop + ((yTop - price) / yRange) * plotHeight;
  }

  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const fmt = (p: number) => (p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(4));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {/* Horizontal gridlines at price min/mid/max */}
      {[yTop, (yTop + yBottom) / 2, yBottom].map((p, i) => (
        <line key={i} x1={padLeft} x2={width - padRight} y1={y(p)} y2={y(p)} stroke={gridColor} strokeWidth={0.15} />
      ))}

      {/* Zones — drawn first so candles/markers sit above them */}
      {zones.map((z, i) => (
        <g key={i}>
          <rect
            x={x(z.fromIndex) - slotWidth / 2}
            y={y(z.priceTop)}
            width={(z.toIndex - z.fromIndex + 1) * slotWidth}
            height={Math.max(y(z.priceBottom) - y(z.priceTop), 0.5)}
            fill={z.color}
            fillOpacity={0.18}
            stroke={z.color}
            strokeOpacity={0.5}
            strokeWidth={0.2}
            onClick={z.onClick}
            style={z.onClick ? { cursor: 'pointer' } : undefined}
          />
          {z.label && (
            <text
              x={x(z.fromIndex) - slotWidth / 2 + 1}
              y={y(z.priceTop) - 1}
              fontSize={3.2}
              fill={z.color}
              fontWeight={600}
            >
              {z.label}
            </text>
          )}
        </g>
      ))}

      {/* Horizontal reference lines (e.g. a level, a threshold) */}
      {lines.map((l, i) => (
        <g key={i}>
          <line
            x1={padLeft} x2={width - padRight} y1={y(l.price)} y2={y(l.price)}
            stroke={l.color ?? textColor} strokeWidth={0.25}
            strokeDasharray={l.dashed === false ? undefined : '1.2,1'}
          />
          {l.label && (
            <text x={width - padRight} y={y(l.price) - 1} fontSize={3.2} fill={l.color ?? textColor} textAnchor="end">
              {l.label}
            </text>
          )}
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const isUp = c.close >= c.open;
        const color = isUp ? bullColor : bearColor;
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={0.3} />
            <rect
              x={x(i) - bodyWidth / 2} y={bodyTop}
              width={bodyWidth} height={Math.max(bodyBottom - bodyTop, 0.4)}
              fill={color}
            />
          </g>
        );
      })}

      {/* Point markers (arrows/callouts) */}
      {markers.map((m, i) => {
        const above = m.side !== 'below';
        const py = y(m.price);
        const labelY = above ? py - 3 : py + 5.5;
        return (
          <g key={i}>
            <circle cx={x(m.index)} cy={py} r={0.9} fill={m.color ?? textColor} />
            <text x={x(m.index)} y={labelY} fontSize={3.2} fill={m.color ?? textColor} textAnchor="middle" fontWeight={600}>
              {m.label}
            </text>
          </g>
        );
      })}

      {/* Price axis labels (top/bottom) */}
      <text x={width - padRight} y={padTop + 2} fontSize={2.8} fill={textColor} textAnchor="end">{fmt(yTop)}</text>
      <text x={width - padRight} y={height - 2} fontSize={2.8} fill={textColor} textAnchor="end">{fmt(yBottom)}</text>
    </svg>
  );
}
