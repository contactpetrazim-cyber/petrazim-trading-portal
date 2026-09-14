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
 *
 * TEXT: every label lives in an HTML overlay `<div>` on top of the
 * SVG, not as SVG `<text>` — by direct bug report, with screenshot
 * ("make the text clear neat and very readable and visible"): the
 * candles/lines/zones intentionally use a fake 100-unit-wide viewBox
 * stretched to the real container width via `preserveAspectRatio=
 * "none"` (so the chart fills whatever width it's given responsively)
 * — that's fine for rects and lines, but it means the SVG's horizontal
 * and vertical scale factors differ hugely (e.g. ~17x wide vs. 1x
 * tall on a full-width modal), and `<text>` glyphs get stretched by
 * that exact same mismatched transform, turning every label into
 * warped, barely-legible text — which is exactly what the screenshot
 * showed. HTML text sitting in a plain, uniformly-scaled `<div>`
 * overlay (positioned by percentage, which maps correctly regardless
 * of the SVG's own internal distortion) never has this problem, reads
 * with normal font rendering, and gets a small background pill added
 * for contrast against busy candles/wicks underneath — the "neat and
 * very readable" half of the same request.
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
  // Percentage helpers — for the HTML label overlay, which sits in a
  // normally-scaled (not stretched) box, so percentages of the SAME
  // width/height units used for the SVG geometry above line up
  // correctly without inheriting the SVG's own horizontal distortion.
  const xPct = (index: number) => (x(index) / width) * 100;
  const yPct = (price: number) => (y(price) / height) * 100;

  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';
  const fmt = (p: number) => (p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(4));

  // Shared "pill" look for every label — small, legible, readable
  // against busy candles/wicks underneath.
  const labelCls = `absolute whitespace-nowrap text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded ${
    dark ? 'bg-black/70' : 'bg-white/85'
  }`;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {/* Horizontal gridlines at price min/mid/max */}
        {[yTop, (yTop + yBottom) / 2, yBottom].map((p, i) => (
          <line key={i} x1={padLeft} x2={width - padRight} y1={y(p)} y2={y(p)} stroke={gridColor} strokeWidth={0.15} />
        ))}

        {/* Zones — drawn first so candles/markers sit above them */}
        {zones.map((z, i) => (
          <rect
            key={i}
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
        ))}

        {/* Horizontal reference lines (e.g. a level, a threshold) */}
        {lines.map((l, i) => (
          <line
            key={i}
            x1={padLeft} x2={width - padRight} y1={y(l.price)} y2={y(l.price)}
            stroke={l.color ?? textColor} strokeWidth={0.25}
            strokeDasharray={l.dashed === false ? undefined : '1.2,1'}
          />
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

        {/* Point markers (dots only — labels live in the HTML overlay below) */}
        {markers.map((m, i) => (
          <circle key={i} cx={x(m.index)} cy={y(m.price)} r={0.9} fill={m.color ?? textColor} />
        ))}
      </svg>

      {/* HTML label overlay — see this component's own docstring for
          why text lives here instead of as SVG <text>. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {zones.map((z, i) => z.label && (
          <div
            key={`zone-${i}`}
            className={labelCls}
            style={{ left: `${xPct(z.fromIndex) - (slotWidth / 2 - 1) / width * 100}%`, top: `${yPct(z.priceTop)}%`, transform: 'translateY(-100%)', color: z.color }}
          >
            {z.label}
          </div>
        ))}
        {lines.map((l, i) => l.label && (
          <div
            key={`line-${i}`}
            className={labelCls}
            style={{ right: `${(padRight / width) * 100}%`, top: `${yPct(l.price)}%`, transform: 'translateY(-100%)', color: l.color ?? textColor }}
          >
            {l.label}
          </div>
        ))}
        {markers.map((m, i) => {
          const above = m.side !== 'below';
          return (
            <div
              key={`marker-${i}`}
              className={labelCls}
              style={{
                left: `${xPct(m.index)}%`, top: `${yPct(m.price)}%`,
                transform: `translate(-50%, ${above ? 'calc(-100% - 4px)' : '4px'})`,
                color: m.color ?? textColor,
              }}
            >
              {m.label}
            </div>
          );
        })}
        {/* Price axis labels (top/bottom) */}
        <div className={labelCls} style={{ right: `${(padRight / width) * 100}%`, top: 0, color: textColor }}>{fmt(yTop)}</div>
        <div className={labelCls} style={{ right: `${(padRight / width) * 100}%`, bottom: 0, color: textColor }}>{fmt(yBottom)}</div>
      </div>
    </div>
  );
}
