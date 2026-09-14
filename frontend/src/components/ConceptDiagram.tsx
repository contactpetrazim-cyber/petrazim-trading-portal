/**
 * ConceptDiagram — real, rendered SVG diagrams for every "See diagram:
 * `visuals/xxx.svg` — <description>" Visual Model reference across the
 * curriculum (every track except Honest Gap Orientation, which uses
 * OrientDiagram's exact bespoke set for its own `[VISUAL: ...]`
 * bracket format instead). By direct request ("turn them all to
 * diagrams - the visuals references") — before this, that sentence
 * rendered as literal text naming a `.svg` file that was never
 * generated anywhere.
 *
 * Hand-drawing one bespoke diagram per lesson (~200 of them) isn't a
 * realistic single pass — instead this is a small library of GENERIC,
 * reusable schematic SHAPES (a range with a shaded zone, a sequence of
 * gates, a balance scale, an order-book ladder, ...), picked per
 * lesson by matching its own real Visual Model description text
 * against the same vocabulary SMCDiagram's seven exact, precise
 * diagrams already cover first (fair value gap, order block, etc. —
 * tried before any generic template, since those are genuinely
 * accurate, not just schematic). The lesson's own real description is
 * always shown as the caption underneath — the drawing illustrates the
 * STRUCTURE the description names, the caption carries every
 * lesson-specific detail, so nothing here fabricates content.
 * Unmatched text still gets a clean, boxed "Visual Model" card instead
 * of ever falling back to raw text.
 */
import { SMCDiagram, SMC_DIAGRAM_KEYS, type SMCDiagramKey } from './SMCDiagram';

function Svg({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <svg viewBox="0 0 480 220" width="100%" height={200} role="img">
      <rect x={0} y={0} width={480} height={220} fill={dark ? '#0f1424' : '#fbfbff'} rx={12} />
      {children}
    </svg>
  );
}
const M = (dark: boolean) => (dark ? '#9ca3af' : '#6b7280');
const S = (dark: boolean) => (dark ? '#ffffff' : '#141a33');

function RangeZone({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <rect x={70} y={30} width={340} height={160} rx={8} fill="none" stroke={m} strokeWidth={1.5} strokeDasharray="4 3" />
      <rect x={70} y={30} width={340} height={40} fill="#ef4444" fillOpacity={0.15} />
      <rect x={70} y={150} width={340} height={40} fill="#22c55e" fillOpacity={0.15} />
      <line x1={70} y1={110} x2={410} y2={110} stroke={m} strokeWidth={1} strokeDasharray="3 3" />
      <text x={60} y={35} fontSize={10} fill={s} textAnchor="end">Range top</text>
      <text x={60} y={195} fontSize={10} fill={s} textAnchor="end">Range bottom</text>
      <rect x={190} y={90} width={100} height={40} rx={6} fill="#005FB8" fillOpacity={0.25} stroke="#005FB8" strokeWidth={1.5} />
      <text x={240} y={114} fontSize={10} fontWeight={700} fill="#005FB8" textAnchor="middle">Marked zone</text>
    </Svg>
  );
}

function SwingPoints({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  const pts = [[60, 140], [120, 90], [180, 130], [240, 70], [300, 120], [360, 60], [420, 150]];
  return (
    <Svg dark={dark}>
      <line x1={40} y1={190} x2={440} y2={190} stroke={m} strokeWidth={1} />
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={m} strokeWidth={1.5} strokeDasharray="3 3" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 3 ? 8 : 5} fill={i === 3 ? '#005FB8' : s} fillOpacity={i === 3 ? 0.3 : 0.6} stroke={i === 3 ? '#005FB8' : 'none'} strokeWidth={2} />
      ))}
      <text x={240} y={30} fontSize={10} fill={s} textAnchor="middle">Swing points, one highlighted as the relevant extreme</text>
    </Svg>
  );
}

function GateSequence({ dark, count = 5 }: { dark: boolean; count?: number }) {
  const m = M(dark), s = S(dark);
  const n = Math.min(count, 8);
  const w = 380 / n;
  return (
    <Svg dark={dark}>
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <rect x={50 + i * (w + 4)} y={80} width={w} height={50} rx={6} fill="#005FB8" fillOpacity={0.15 + (i / n) * 0.2} stroke="#005FB8" strokeWidth={1.5} />
          <text x={50 + i * (w + 4) + w / 2} y={109} fontSize={11} fontWeight={700} fill={s} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <text x={240} y={60} fontSize={10} fill={s} textAnchor="middle">Sequential gates — each must pass before the next runs</text>
      <text x={240} y={155} fontSize={9.5} fill={m} textAnchor="middle">Any gate failing returns no signal</text>
    </Svg>
  );
}

function AnnotatedPoint({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <line x1={40} y1={110} x2={440} y2={110} stroke={m} strokeWidth={1} strokeDasharray="3 3" />
      <rect x={220} y={70} width={16} height={60} fill="#22c55e" fillOpacity={0.4} stroke="#22c55e" strokeWidth={1.5} />
      <line x1={228} y1={55} x2={228} y2={70} stroke="#22c55e" strokeWidth={1.5} />
      <line x1={228} y1={130} x2={228} y2={145} stroke="#22c55e" strokeWidth={1.5} />
      <line x1={236} y1={80} x2={330} y2={60} stroke={s} strokeWidth={1} />
      <circle cx={330} cy={60} r={3} fill={s} />
      <text x={334} y={63} fontSize={10} fontWeight={700} fill={s}>marked here</text>
      <text x={240} y={190} fontSize={10} fill={m} textAnchor="middle">One specific candle/price, annotated</text>
    </Svg>
  );
}

function Funnel({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <polygon points="60,30 420,30 340,100 140,100" fill="#005FB8" fillOpacity={0.18} stroke="#005FB8" strokeWidth={2} />
      <polygon points="140,110 340,110 275,165 205,165" fill="#f59e0b" fillOpacity={0.2} stroke="#f59e0b" strokeWidth={2} />
      <polygon points="205,175 275,175 255,205 225,205" fill="#22c55e" fillOpacity={0.25} stroke="#22c55e" strokeWidth={2} />
      <text x={240} y={60} fontSize={11} fontWeight={700} fill={s} textAnchor="middle">Wide input</text>
      <text x={240} y={135} fontSize={10} fontWeight={700} fill={s} textAnchor="middle">Filtered</text>
      <text x={240} y={195} fontSize={9} fontWeight={700} fill={s} textAnchor="middle">Result</text>
    </Svg>
  );
}

function Scale({ dark }: { dark: boolean }) {
  const s = S(dark), m = M(dark);
  return (
    <Svg dark={dark}>
      <line x1={240} y1={35} x2={240} y2={160} stroke={s} strokeWidth={4} strokeLinecap="round" />
      <line x1={120} y1={90} x2={360} y2={90} stroke={s} strokeWidth={3} strokeLinecap="round" />
      <polygon points="240,160 220,182 260,182" fill={s} />
      <rect x={100} y={95} width={40} height={35} fill="#22c55e" fillOpacity={0.3} stroke="#22c55e" strokeWidth={1.5} rx={4} />
      <rect x={340} y={95} width={40} height={35} fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" strokeWidth={1.5} rx={4} />
      <text x={120} y={148} fontSize={9.5} fontWeight={700} fill="#15803d" textAnchor="middle">Side A</text>
      <text x={360} y={148} fontSize={9.5} fontWeight={700} fill="#b91c1c" textAnchor="middle">Side B</text>
      <text x={240} y={195} fontSize={10} fill={m} textAnchor="middle">Weighs one factor against the other</text>
    </Svg>
  );
}

function Curve({ dark }: { dark: boolean }) {
  const m = M(dark), grid = dark ? '#1f2937' : '#e5e7eb';
  return (
    <Svg dark={dark}>
      {[60, 100, 140].map((y) => <line key={y} x1={40} y1={y} x2={440} y2={y} stroke={grid} strokeWidth={1} />)}
      <path d="M 40 150 L 90 110 L 140 130 L 190 80 L 240 105 L 280 170 L 320 120 L 370 90 L 440 60"
        fill="none" stroke="#22c55e" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={280} cy={170} r={5} fill="#22c55e" />
      <text x={240} y={30} fontSize={10} fill={m} textAnchor="middle">A trending line with a visible dip along the way</text>
    </Svg>
  );
}

function FlowPath({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  const boxes = [{ x: 30, label: 'Start' }, { x: 190, label: 'Then' }, { x: 350, label: 'Result' }];
  const roomFill = dark ? '#161b2e' : '#ffffff', roomStroke = dark ? '#2a3150' : '#dcdce8';
  return (
    <Svg dark={dark}>
      {boxes.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={60} width={100} height={90} rx={10} fill={roomFill} stroke={roomStroke} strokeWidth={2} />
          <text x={b.x + 50} y={112} fontSize={11} fontWeight={700} fill={s} textAnchor="middle">{b.label}</text>
        </g>
      ))}
      <path d="M 130 105 L 188 105" stroke={s} strokeWidth={2} markerEnd="url(#fp-arrow)" />
      <path d="M 290 105 L 348 105" stroke={s} strokeWidth={2} markerEnd="url(#fp-arrow)" />
      <defs><marker id="fp-arrow" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={s} /></marker></defs>
      <text x={240} y={180} fontSize={10} fill={m} textAnchor="middle">A sequence of connected steps, each unlocking the next</text>
    </Svg>
  );
}

function Lanes({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  const colors = ['#005FB8', '#8b5cf6', '#0891b2', '#f59e0b', '#ef4444'];
  return (
    <Svg dark={dark}>
      {colors.map((c, i) => (
        <rect key={i} x={30 + i * 86} y={40} width={74} height={140} rx={8} fill={c} fillOpacity={0.14} stroke={c} strokeWidth={1.5} />
      ))}
      <text x={240} y={195} fontSize={10} fill={m} textAnchor="middle">Parallel, independent lanes side by side</text>
      <text x={240} y={25} fontSize={10} fontWeight={700} fill={s} textAnchor="middle">Each lane activates under its own condition</text>
    </Svg>
  );
}

function Venn({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <circle cx={190} cy={110} r={80} fill="#005FB8" fillOpacity={0.18} stroke="#005FB8" strokeWidth={2} />
      <circle cx={290} cy={110} r={80} fill="#ef4444" fillOpacity={0.16} stroke="#ef4444" strokeWidth={2} />
      <text x={140} y={60} fontSize={10.5} fontWeight={700} fill={s}>Side A</text>
      <text x={340} y={60} fontSize={10.5} fontWeight={700} fill={s} textAnchor="end">Side B</text>
      <text x={240} y={114} fontSize={9.5} fontWeight={700} fill={s} textAnchor="middle">Overlap</text>
      <text x={240} y={195} fontSize={9.5} fill={m} textAnchor="middle">Two ideas, and what's genuinely shared between them</text>
    </Svg>
  );
}

function DecisionTree({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <circle cx={240} cy={40} r={22} fill="#005FB8" fillOpacity={0.25} stroke="#005FB8" strokeWidth={1.5} />
      <text x={240} y={44} fontSize={9} fontWeight={700} fill={s} textAnchor="middle">Check</text>
      <line x1={225} y1={58} x2={130} y2={100} stroke={m} strokeWidth={1.5} />
      <line x1={255} y1={58} x2={350} y2={100} stroke={m} strokeWidth={1.5} />
      <rect x={80} y={100} width={100} height={44} rx={8} fill="#22c55e" fillOpacity={0.2} stroke="#22c55e" strokeWidth={1.5} />
      <text x={130} y={126} fontSize={9.5} fontWeight={700} fill="#15803d" textAnchor="middle">If yes</text>
      <rect x={300} y={100} width={100} height={44} rx={8} fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={1.5} />
      <text x={350} y={126} fontSize={9.5} fontWeight={700} fill="#b91c1c" textAnchor="middle">If no</text>
      <text x={240} y={190} fontSize={10} fill={m} textAnchor="middle">One condition branches to two different outcomes</text>
    </Svg>
  );
}

function Cycle({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  const pts: [number, number][] = [[240, 55], [340, 130], [240, 175], [140, 130]];
  return (
    <Svg dark={dark}>
      <circle cx={240} cy={115} r={70} fill="none" stroke={m} strokeWidth={1.5} strokeDasharray="4 4" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={18} fill="#005FB8" fillOpacity={0.22} stroke="#005FB8" strokeWidth={1.5} />
          <text x={x} y={y + 4} fontSize={10} fontWeight={700} fill={s} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <text x={240} y={205} fontSize={10} fill={m} textAnchor="middle">A repeating cycle — the last step feeds back into the first</text>
    </Svg>
  );
}

function ComparisonTable({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <rect x={50} y={30} width={170} height={150} rx={10} fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeWidth={1.5} />
      <text x={135} y={55} fontSize={12} fontWeight={700} fill="#15803d" textAnchor="middle">Good</text>
      {[80, 105, 130, 155].map((y, i) => <text key={i} x={70} y={y} fontSize={9} fill={s}>✓ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎</text>)}
      <rect x={260} y={30} width={170} height={150} rx={10} fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeWidth={1.5} />
      <text x={345} y={55} fontSize={12} fontWeight={700} fill="#b91c1c" textAnchor="middle">Bad</text>
      {[80, 105, 130, 155].map((y, i) => <text key={i} x={280} y={y} fontSize={9} fill={s}>✗ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎</text>)}
      <text x={240} y={200} fontSize={10} fill={m} textAnchor="middle">Two approaches, placed side by side</text>
    </Svg>
  );
}

function Ladder({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  const rows = 6;
  return (
    <Svg dark={dark}>
      <text x={140} y={28} fontSize={10} fontWeight={700} fill="#ef4444" textAnchor="middle">Ask (sell)</text>
      <text x={340} y={28} fontSize={10} fontWeight={700} fill="#22c55e" textAnchor="middle">Bid (buy)</text>
      {Array.from({ length: rows }).map((_, i) => (
        <g key={i}>
          <rect x={60} y={38 + i * 22} width={80 + (rows - i) * 8} height={16} fill="#ef4444" fillOpacity={0.18} />
          <rect x={260} y={38 + i * 22} width={80 + i * 8} height={16} fill="#22c55e" fillOpacity={0.18} />
        </g>
      ))}
      <line x1={240} y1={30} x2={240} y2={190} stroke={m} strokeWidth={1} strokeDasharray="3 3" />
      <text x={240} y={205} fontSize={10} fill={s} textAnchor="middle">Resting orders stacked by price, bid side vs. ask side</text>
    </Svg>
  );
}

function BellCurve({ dark }: { dark: boolean }) {
  const m = M(dark), s = S(dark);
  return (
    <Svg dark={dark}>
      <path d="M 60 170 C 120 170 140 40 240 40 C 340 40 360 170 420 170" fill="#005FB8" fillOpacity={0.15} stroke="#005FB8" strokeWidth={2} />
      <line x1={240} y1={40} x2={240} y2={185} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
      <text x={240} y={30} fontSize={10} fontWeight={700} fill="#b45309" textAnchor="middle">Point of Control</text>
      <text x={240} y={205} fontSize={10} fill={m} textAnchor="middle">Where trading activity concentrates most</text>
    </Svg>
  );
}

function LayerStack({ dark }: { dark: boolean }) {
  const s = S(dark), m = M(dark);
  const colors = ['#005FB8', '#0891b2', '#22c55e', '#f59e0b', '#ef4444'];
  return (
    <Svg dark={dark}>
      {colors.map((c, i) => (
        <rect key={i} x={60} y={30 + i * 32} width={360} height={24} rx={6} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.5} />
      ))}
      <text x={240} y={198} fontSize={10} fill={m} textAnchor="middle">Slower timeframes at top, faster at the bottom — each layer sets context for the next</text>
      <text x={70} y={22} fontSize={9} fontWeight={700} fill={s}>Higher timeframe</text>
    </Svg>
  );
}

function Checklist({ dark }: { dark: boolean }) {
  const s = S(dark), m = M(dark);
  return (
    <Svg dark={dark}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={90} y={30 + i * 38} width={22} height={22} rx={5} fill="#22c55e" fillOpacity={0.25} stroke="#22c55e" strokeWidth={1.5} />
          <path d={`M ${95} ${41 + i * 38} l 5 5 l 9 -9`} stroke="#15803d" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x={130} y={36 + i * 38} width={260} height={10} rx={5} fill={m} fillOpacity={0.25} />
        </g>
      ))}
      <text x={240} y={200} fontSize={10} fill={s} textAnchor="middle">Every condition checked off before a signal counts</text>
    </Svg>
  );
}

function Gauge({ dark }: { dark: boolean }) {
  const s = S(dark), m = M(dark);
  return (
    <Svg dark={dark}>
      <path d="M 90 160 A 150 150 0 0 1 390 160" fill="none" stroke={dark ? '#1f2937' : '#e5e7eb'} strokeWidth={22} />
      <path d="M 90 160 A 150 150 0 0 1 260 22" fill="none" stroke="#22c55e" strokeWidth={22} />
      <path d="M 260 22 A 150 150 0 0 1 390 160" fill="none" stroke="#ef4444" strokeWidth={22} />
      <line x1={240} y1={160} x2={310} y2={70} stroke={s} strokeWidth={3} strokeLinecap="round" />
      <circle cx={240} cy={160} r={7} fill={s} />
      <text x={240} y={200} fontSize={10} fill={m} textAnchor="middle">A limit that stops activity once the needle reaches it</text>
    </Svg>
  );
}

type TemplateKey =
  | 'range-zone' | 'swing-points' | 'gate-sequence' | 'annotated-point' | 'funnel' | 'scale' | 'curve'
  | 'flow-path' | 'lanes' | 'venn' | 'decision-tree' | 'cycle' | 'comparison-table' | 'ladder'
  | 'bell-curve' | 'layer-stack' | 'checklist' | 'gauge';

const TEMPLATES: Record<TemplateKey, (p: { dark: boolean }) => JSX.Element> = {
  'range-zone': RangeZone, 'swing-points': SwingPoints, 'gate-sequence': GateSequence,
  'annotated-point': AnnotatedPoint, funnel: Funnel, scale: Scale, curve: Curve,
  'flow-path': FlowPath, lanes: Lanes, venn: Venn, 'decision-tree': DecisionTree, cycle: Cycle,
  'comparison-table': ComparisonTable, ladder: Ladder, 'bell-curve': BellCurve,
  'layer-stack': LayerStack, checklist: Checklist, gauge: Gauge,
};

const RULES: [RegExp, TemplateKey][] = [
  [/overlapping circles|venn diagram/i, 'venn'],
  [/funnel|narrowing (stages|band)/i, 'funnel'],
  [/balance scale|weigh(s|ing)?.{0,10}against|fulcrum/i, 'scale'],
  [/equity curve|drawdown|jagged.{0,10}(curve|line)/i, 'curve'],
  [/connected rooms|floor-plan|room \d|journey/i, 'flow-path'],
  [/parallel lanes|highway lanes/i, 'lanes'],
  [/decision tree|branch(es|ing)? (to|into)/i, 'decision-tree'],
  [/loop|cycle|repeat(s|ing)? (back|into)/i, 'cycle'],
  [/good\/bad|side[- ]by[- ]side|two[- ]column|before.{0,10}after/i, 'comparison-table'],
  [/order book|\bdom\b|bid\/ask|ladder/i, 'ladder'],
  [/volume profile|bell curve|distribution|\bpoc\b/i, 'bell-curve'],
  [/timeframe stack|5-layer|multi-timeframe|mtf stack|stacked layers/i, 'layer-stack'],
  [/checklist|checkmarks?/i, 'checklist'],
  [/thermometer|gauge|semi-circular|needle/i, 'gauge'],
  [/relative length|sequential gates?|gate list|seven-step|five-step|bars? at true relative/i, 'gate-sequence'],
  [/swing high|swing low|circled/i, 'swing-points'],
  [/shaded.{0,15}(band|zone)|range.{0,20}(zone|extreme)/i, 'range-zone'],
  [/candle.{0,25}(marked|closed|close price|extreme)/i, 'annotated-point'],
];

function pickTemplate(description: string): TemplateKey | null {
  for (const [re, key] of RULES) if (re.test(description)) return key;
  return null;
}

/** Same seven-concept keyword list LessonPage's SMCDiagram matching
 * already uses, tried first since those diagrams are exact, not
 * schematic. */
const SMC_RULES: [RegExp, SMCDiagramKey][] = [
  [/fair value gap|\bfvg\b/i, 'fair-value-gap'],
  [/order block/i, 'order-block'],
  [/liquidity sweep|stop hunt|liquidity grab/i, 'liquidity-sweep'],
  [/premium.{0,3}discount|premium\/discount|equilibrium/i, 'premium-discount'],
  [/break of structure|\bbos\b|change of character|\bchoch\b/i, 'break-of-structure'],
  [/demand zone|supply zone|supply.{0,3}demand/i, 'supply-demand-zone'],
  [/equal highs|equal lows|liquidity pool/i, 'equal-highs-lows'],
];

function prettifyKey(fileSlug: string): string {
  // "bot4-01-spring-upthrust" -> "Spring Upthrust"; strips the leading
  // lesson-code prefix, title-cases the rest.
  const words = fileSlug.replace(/^[a-z]+\d*-\d+-/i, '').split(/[-_]/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function ConceptDiagram({ fileSlug, description, dark }: { fileSlug: string; description: string; dark: boolean }) {
  const cardCls = `rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-bold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`;

  for (const [re, smcKey] of SMC_RULES) {
    if (re.test(description) && SMC_DIAGRAM_KEYS.includes(smcKey)) {
      return <SMCDiagram concept={smcKey} dark={dark} />;
    }
  }

  const gateCountMatch = description.match(/\b(two|three|four|five|six|seven|eight)[- ](step|gate)/i);
  const gateCountWords: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const count = gateCountMatch ? gateCountWords[gateCountMatch[1].toLowerCase()] : 5;

  const templateKey = pickTemplate(description);
  if (templateKey) {
    const Template = TEMPLATES[templateKey];
    return (
      <div className={cardCls}>
        <div className={titleCls}>{prettifyKey(fileSlug)}</div>
        {templateKey === 'gate-sequence' ? <GateSequence dark={dark} count={count} /> : <Template dark={dark} />}
        <p className={`text-xs mt-3 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-600'}`}>{description}</p>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className={titleCls}>Visual model</div>
      <p className={`text-sm leading-relaxed ${dark ? 'text-white/70' : 'text-gray-700'}`}>{description}</p>
    </div>
  );
}
