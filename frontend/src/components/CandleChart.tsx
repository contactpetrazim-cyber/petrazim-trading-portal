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
  /** Optional second line, rendered directly under `label` in the same
   * pill — by direct request ("the current entry line is too long -
   * let's break into two lines"). Omit for every other single-line
   * label (SL/TP/etc.) — this only widens the pill vertically when a
   * caller actually needs the extra line. */
  label2?: string;
  color?: string;
  dashed?: boolean;
}

/** A computed line (moving average, etc.) — one point per entry in the
 * `candles` array passed to CandleChart (same index), `null` where
 * there isn't enough history to compute a value yet (e.g. the first
 * 19 candles of an SMA(20) window) — that candle is simply skipped,
 * leaving a real gap rather than a fabricated/flat value. */
export interface OverlaySeries {
  points: (number | null)[];
  color: string;
  label?: string;
}

/** A single drawn shape — a trend line, or (by direct follow-up
 * request, "include a drawing tool for boxes - the box tool") a
 * rectangle spanning the same two dragged corners instead of a line
 * between them. Endpoints are `{index, price}` pairs where `index` is
 * relative to the SAME `candles` array CandleChart was given (i.e.
 * already the currently-visible window) — the CALLER
 * (PositionOnChartModal) is responsible for re-deriving these each
 * render from whatever stable, pan/zoom-independent anchor it keeps
 * the actual drawing data in; CandleChart itself just draws whatever
 * segments it's handed against its own current candles/price range,
 * the same way `lines`/`zones`/`markers` already work. `shape` is
 * optional and defaults to `'line'` so a segment drawn and persisted
 * before this field existed (localStorage, per symbol) still renders
 * exactly as it always did rather than needing a migration. */
export interface DrawnSegment {
  id: string;
  index1: number;
  price1: number;
  index2: number;
  price2: number;
  color?: string;
  shape?: 'line' | 'box';
}

/** The fixed viewBox layout CandleChart's coordinate math uses —
 * exported so a caller doing its OWN pixel math on top of this chart
 * (crosshair readout, drawing a new segment while dragging) uses the
 * exact same numbers rather than a second, hand-copied set that could
 * quietly drift out of sync. */
export const CHART_LAYOUT = { width: 100, padLeft: 8, padRight: 2, padTop: 8, padBottom: 8 } as const;

/** The same price-range computation CandleChart uses internally to
 * decide its y-axis — exported so a caller can convert its own pixel
 * positions to real prices (the crosshair readout, a drawing's price
 * while dragging) using the IDENTICAL range CandleChart is actually
 * drawing against, not an approximation that could visibly disagree
 * with where the candles/lines actually render. */
export function computeChartRange(
  candles: Candle[],
  zones: ChartZone[] = [],
  lines: ChartLine[] = [],
  markers: ChartMarker[] = [],
): { yTop: number; yBottom: number } {
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
  return { yTop: priceMax + priceMargin, yBottom: priceMin - priceMargin };
}

/**
 * CandleChart — a real, hand-rolled SVG candlestick renderer with
 * annotation overlays (zones, point markers, horizontal lines, now
 * also computed overlay series and drawn trend-line segments). Built
 * because the app's only existing chart surface (TradingViewChart) is
 * a free TradingView iframe embed that explicitly can't be annotated
 * (see that component's own docstring) — teaching diagrams, "identify
 * the concept" games, and "what happens next" games all need to draw
 * on TOP of a chart, which needs a chart this app actually owns pixel
 * access to.
 *
 * Deliberately simple (no zoom/pan/crosshair of its OWN — PositionOn
 * ChartModal owns those, built on top of this component rather than
 * inside it, using the exported CHART_LAYOUT/computeChartRange above)
 * — this renders a fixed window of candles for teaching purposes, not
 * a live trading chart (ChartPanel/TradingViewChart remain what a
 * trader actually trades off of).
 *
 * TEXT: every label lives in an HTML overlay `<div>` on top of the
 * SVG, not as SVG `<text>` — by direct bug report, with screenshot
 * ("make the text clear neat and very readable and visible"): the
 * candles/lines/zones intentionally use a fake 100-unit-wide viewBox
 * stretched to the real container width via `preserveAspectRatio=
 * "none"` (so the chart fills whatever width it's given responsively)
 * — that's fine for rects and lines (and, for the same reason, fine
 * for the drawn trend-line segments below — a stretched STRAIGHT LINE
 * is still a straight line, just a different angle, exactly how every
 * real charting tool's trend lines already look on a squished time
 * axis; only GLYPH shapes distort unreadably under this scaling).
 * `<text>` glyphs get stretched by that exact same mismatched
 * transform, turning every label into warped, barely-legible text —
 * which is exactly what the screenshot showed. HTML text sitting in a
 * plain, uniformly-scaled `<div>` overlay (positioned by percentage,
 * which maps correctly regardless of the SVG's own internal
 * distortion) never has this problem, reads with normal font
 * rendering, and gets a small background pill added for contrast
 * against busy candles/wicks underneath — the "neat and very
 * readable" half of the same request.
 */
export function CandleChart({
  candles,
  zones = [],
  markers = [],
  lines = [],
  overlaySeries = [],
  drawings = [],
  height = 260,
  dark = false,
  bullColor = '#22c55e',
  bearColor = '#ef4444',
  rightMargin = 0,
}: {
  candles: Candle[];
  zones?: ChartZone[];
  markers?: ChartMarker[];
  lines?: ChartLine[];
  /** Computed lines (moving averages, etc.) — see OverlaySeries. */
  overlaySeries?: OverlaySeries[];
  /** User-drawn trend-line segments — see DrawnSegment. */
  drawings?: DrawnSegment[];
  height?: number;
  dark?: boolean;
  bullColor?: string;
  bearColor?: string;
  /** Reserved empty space on the right, sized in candle-slot units (0
   * = candles fill the full width, the old behavior — every existing
   * caller keeps that unless it opts in). By direct bug report/request
   * ("make about 10 candles on the right side free space to allow for
   * the text boxes and entry, SL, TP boxes ... not allow items on the
   * right to overlap"): `lines`' own labels are always right-anchored
   * (see the label overlay below), so a level near the current price —
   * exactly where price action usually sits, at the right edge — had
   * nothing but real candles to render its label over. Computed as
   * EXTRA slots added to the denominator, not a wider padRight, so
   * real candles keep their existing width/spacing; they just stop
   * short of the right edge instead of being squeezed thinner. */
  rightMargin?: number;
}) {
  if (candles.length === 0) return null;

  const { width, padLeft, padRight, padTop } = CHART_LAYOUT;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - CHART_LAYOUT.padBottom;

  const { yTop, yBottom } = computeChartRange(candles, zones, lines, markers);
  const yRange = yTop - yBottom;

  const slotWidth = plotWidth / (candles.length + Math.max(0, rightMargin));
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

        {/* Computed overlay series (moving averages, etc.) — a
            connected polyline per series, real gaps where a point is
            null rather than bridging over missing history. */}
        {overlaySeries.map((s, si) => {
          const segments: string[] = [];
          let current: string[] = [];
          s.points.forEach((p, i) => {
            if (p == null) {
              if (current.length > 1) segments.push(current.join(' '));
              current = [];
              return;
            }
            current.push(`${x(i)},${y(p)}`);
          });
          if (current.length > 1) segments.push(current.join(' '));
          return (
            <g key={`series-${si}`}>
              {segments.map((pts, pi) => (
                <polyline key={pi} points={pts} fill="none" stroke={s.color} strokeWidth={0.35} />
              ))}
            </g>
          );
        })}

        {/* User-drawn shapes — trend lines, and boxes spanning the
            same two corners (Math.min/max since either dragged corner
            could be top-left depending on drag direction). */}
        {drawings.map((d) => d.shape === 'box' ? (
          <rect
            key={d.id}
            x={Math.min(x(d.index1), x(d.index2))} y={Math.min(y(d.price1), y(d.price2))}
            width={Math.abs(x(d.index2) - x(d.index1))} height={Math.abs(y(d.price2) - y(d.price1))}
            fill={d.color ?? '#2563eb'} fillOpacity={0.12}
            stroke={d.color ?? '#2563eb'} strokeWidth={0.35}
          />
        ) : (
          <line
            key={d.id}
            x1={x(d.index1)} y1={y(d.price1)} x2={x(d.index2)} y2={y(d.price2)}
            stroke={d.color ?? '#2563eb'} strokeWidth={0.4} strokeLinecap="round"
          />
        ))}

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
            className={`${labelCls}${l.label2 ? ' leading-tight' : ''}`}
            style={{ right: `${(padRight / width) * 100}%`, top: `${yPct(l.price)}%`, transform: 'translateY(-100%)', color: l.color ?? textColor }}
          >
            <div>{l.label}</div>
            {l.label2 && <div>{l.label2}</div>}
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
