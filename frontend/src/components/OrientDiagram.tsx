/**
 * OrientDiagram — real, rendered SVG diagrams for the "Honest Gap
 * Orientation" track's six `[VISUAL: key — description]` placeholders
 * (ORIENT-01 through ORIENT-06's own real content_body text). Before
 * this, that bracketed text rendered as literal, ugly inline text in
 * the lesson body — by direct bug report ("Make the visuals models
 * show ....can't see"). SMCDiagram (the existing diagram library) is
 * candle-chart-based and covers Smart Money Concepts terms (FVG, order
 * block, etc.); these six are conceptual/epistemic diagrams (a Venn
 * diagram, a funnel, a balance scale...) that don't fit that shape, so
 * they get their own small library of hand-drawn SVGs instead — same
 * "clearly-labeled illustrative schematic" spirit, matched to each
 * lesson's own real, already-authored description rather than
 * reinventing the content.
 */
const LABEL: Record<string, string> = {
  'orient-01-gap-diagram': 'What "Honest Gap" means',
  'orient-02-funnel': 'Signal → Setup → Trade',
  'orient-03-expectancy-scale': 'Why expectancy beats win rate',
  'orient-04-equity-curve': 'A normal drawdown vs. an oversized one',
  'orient-05-three-areas': 'Learn → Practise → Mastery',
  'orient-06-five-lanes': 'Five bots, five market conditions',
};

function Svg({ children, dark, height = 220 }: { children: React.ReactNode; dark: boolean; height?: number }) {
  return (
    <svg viewBox="0 0 480 260" width="100%" height={height} role="img">
      <rect x={0} y={0} width={480} height={260} fill={dark ? '#0f1424' : '#fbfbff'} rx={12} />
      {children}
    </svg>
  );
}

const TEXT_MUTED = (dark: boolean) => (dark ? '#9ca3af' : '#6b7280');
const TEXT_STRONG = (dark: boolean) => (dark ? '#ffffff' : '#141a33');

function GapDiagram({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  const strong = TEXT_STRONG(dark);
  return (
    <Svg dark={dark}>
      <circle cx={185} cy={130} r={90} fill="#005FB8" fillOpacity={0.18} stroke="#005FB8" strokeWidth={2} />
      <circle cx={295} cy={130} r={90} fill="#ef4444" fillOpacity={0.16} stroke="#ef4444" strokeWidth={2} />
      <text x={115} y={70} fontSize={12} fontWeight={700} fill={strong}>What the chart</text>
      <text x={115} y={85} fontSize={12} fontWeight={700} fill={strong}>shows</text>
      <text x={100} y={105} fontSize={9.5} fill={muted}>swing high</text>
      <text x={100} y={120} fontSize={9.5} fill={muted}>rejection wick</text>
      <text x={100} y={135} fontSize={9.5} fill={muted}>price gap</text>
      <text x={335} y={70} fontSize={12} fontWeight={700} fill={strong} textAnchor="end">What actually</text>
      <text x={335} y={85} fontSize={12} fontWeight={700} fill={strong} textAnchor="end">happened</text>
      <text x={345} y={105} fontSize={9.5} fill={muted} textAnchor="end">real buyers/sellers</text>
      <text x={345} y={120} fontSize={9.5} fill={muted} textAnchor="end">unknown motivations</text>
      <text x={345} y={135} fontSize={9.5} fill={muted} textAnchor="end">unknown intentions</text>
      <text x={240} y={132} fontSize={10.5} fontWeight={700} fill={strong} textAnchor="middle">What we can</text>
      <text x={240} y={146} fontSize={10.5} fontWeight={700} fill={strong} textAnchor="middle">actually test</text>
      <text x={240} y={160} fontSize={10.5} fontWeight={700} fill={strong} textAnchor="middle">and know</text>
      <text x={295} y={228} fontSize={11.5} fontWeight={700} fill="#ef4444" textAnchor="middle">Unproven interpretation — the Honest Gap</text>
    </Svg>
  );
}

function FunnelDiagram({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  return (
    <Svg dark={dark}>
      <polygon points="70,30 410,30 340,110 140,110" fill="#005FB8" fillOpacity={0.22} stroke="#005FB8" strokeWidth={2} />
      <text x={240} y={65} fontSize={15} fontWeight={700} fill="#005FB8" textAnchor="middle">Signals</text>
      <text x={240} y={83} fontSize={9.5} fill={muted} textAnchor="middle">BOS · FVG · sweep — many, flowing in</text>

      <polygon points="140,120 340,120 285,180 195,180" fill="#f59e0b" fillOpacity={0.22} stroke="#f59e0b" strokeWidth={2} />
      <text x={240} y={148} fontSize={13} fontWeight={700} fill="#b45309" textAnchor="middle">Setups</text>
      <text x={240} y={165} fontSize={9.5} fill={muted} textAnchor="middle">only signals meeting ALL of a</text>
      <text x={240} y={177} fontSize={9.5} fill={muted} textAnchor="middle">bot's confirmation conditions pass</text>

      <polygon points="195,190 285,190 260,235 220,235" fill="#22c55e" fillOpacity={0.25} stroke="#22c55e" strokeWidth={2} />
      <text x={240} y={210} fontSize={11.5} fontWeight={700} fill="#15803d" textAnchor="middle">Trades</text>
      <text x={240} y={247} fontSize={9.5} fill={muted} textAnchor="middle">final gate: Risk Engine Approval — not every setup clears it</text>
    </Svg>
  );
}

function ExpectancyScale({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  const strong = TEXT_STRONG(dark);
  return (
    <Svg dark={dark}>
      <line x1={240} y1={40} x2={240} y2={190} stroke={strong} strokeWidth={4} strokeLinecap="round" />
      <line x1={110} y1={100} x2={370} y2={100} stroke={strong} strokeWidth={3} strokeLinecap="round" />
      <polygon points="240,190 220,215 260,215" fill={strong} />

      <line x1={110} y1={100} x2={110} y2={140} stroke="#22c55e" strokeWidth={2} />
      {[0, 1, 2].map((i) => <rect key={i} x={90 + i * 14} y={140 - i * 12} width={12} height={12 + i * 12} fill="#22c55e" rx={2} />)}
      <text x={110} y={165} fontSize={10} fontWeight={700} fill="#15803d" textAnchor="middle">Win Rate ×</text>
      <text x={110} y={178} fontSize={10} fontWeight={700} fill="#15803d" textAnchor="middle">Avg Win</text>

      <line x1={370} y1={100} x2={370} y2={132} stroke="#ef4444" strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={345 + i * 13} y={130 - i * 7} width={11} height={8 + i * 7} fill="#ef4444" rx={2} />)}
      <text x={370} y={165} fontSize={10} fontWeight={700} fill="#b91c1c" textAnchor="middle">Loss Rate ×</text>
      <text x={370} y={178} fontSize={10} fontWeight={700} fill="#b91c1c" textAnchor="middle">Avg Loss</text>

      <circle cx={240} cy={100} r={7} fill={strong} />
      <text x={240} y={36} fontSize={12.5} fontWeight={700} fill="#005FB8" textAnchor="middle">Expectancy</text>
      <text x={240} y={232} fontSize={9.5} fill={muted} textAnchor="middle">
        Can still tip positive with fewer, larger wins than losses
      </text>
    </Svg>
  );
}

function EquityCurve({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  const grid = dark ? '#1f2937' : '#e5e7eb';
  return (
    <Svg dark={dark}>
      {[60, 100, 140, 180].map((y) => <line key={y} x1={40} y1={y} x2={440} y2={y} stroke={grid} strokeWidth={1} />)}
      <path
        d="M 40 150 L 80 120 L 120 135 L 160 90 L 200 110 L 230 180 L 260 130 L 300 100 L 340 115 L 380 70 L 440 55"
        fill="none" stroke="#22c55e" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx={230} cy={180} r={5} fill="#22c55e" />
      <text x={230} y={200} fontSize={9} fontWeight={700} fill="#15803d" textAnchor="middle">Still a winning system —</text>
      <text x={230} y={212} fontSize={9} fontWeight={700} fill="#15803d" textAnchor="middle">expected, not a failure</text>

      <path
        d="M 40 150 L 80 120 L 120 145 L 160 60 L 200 100 L 230 240"
        fill="none" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round"
      />
      <text x={60} y={35} fontSize={10} fill={muted}>1% risk per trade (green) vs. 5% risk, same losing streak (red)</text>
    </Svg>
  );
}

function ThreeAreas({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  const strong = TEXT_STRONG(dark);
  const roomFill = dark ? '#161b2e' : '#ffffff';
  const roomStroke = dark ? '#2a3150' : '#dcdce8';
  const rooms = [
    { x: 20, label: 'Learn', sub: 'reading a lesson', color: '#005FB8' },
    { x: 190, label: 'Practise', sub: 'live chart drills', color: '#f59e0b' },
    { x: 360, label: 'Mastery', sub: 'unlocked', color: '#22c55e' },
  ];
  return (
    <Svg dark={dark}>
      {rooms.map((r) => (
        <g key={r.label}>
          <rect x={r.x} y={70} width={110} height={110} rx={10} fill={roomFill} stroke={roomStroke} strokeWidth={2} />
          <rect x={r.x + 20} y={95} width={70} height={8} rx={4} fill={r.color} fillOpacity={0.35} />
          <rect x={r.x + 20} y={112} width={45} height={8} rx={4} fill={r.color} fillOpacity={0.2} />
          <text x={r.x + 55} y={150} fontSize={12} fontWeight={700} fill={strong} textAnchor="middle">{r.label}</text>
          <text x={r.x + 55} y={165} fontSize={8.5} fill={muted} textAnchor="middle">{r.sub}</text>
        </g>
      ))}
      <path d="M 130 125 L 188 125" stroke={strong} strokeWidth={2} markerEnd="url(#arrow)" />
      <path d="M 300 125 L 358 125" stroke={strong} strokeWidth={2} markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={strong} />
        </marker>
      </defs>
      <text x={159} y={112} fontSize={8} fill={muted} textAnchor="middle">quiz</text>
      <text x={159} y={122} fontSize={8} fill={muted} textAnchor="middle">passed</text>
      <text x={329} y={108} fontSize={8} fill={muted} textAnchor="middle">enough reps +</text>
      <text x={329} y={118} fontSize={8} fill={muted} textAnchor="middle">quiz score</text>
    </Svg>
  );
}

function FiveLanes({ dark }: { dark: boolean }) {
  const muted = TEXT_MUTED(dark);
  const strong = TEXT_STRONG(dark);
  const lanes = [
    { label: 'Bot 1', sub: 'trend line', color: '#005FB8' },
    { label: 'Bot 2', sub: 'order block', color: '#8b5cf6' },
    { label: 'Bot 3', sub: 'expanding gap', color: '#0891b2' },
    { label: 'Bot 4', sub: 'volume bars', color: '#f59e0b' },
    { label: 'Bot 5', sub: 'sweep + reverse', color: '#ef4444' },
  ];
  return (
    <Svg dark={dark}>
      <rect x={30} y={22} width={420} height={34} rx={8} fill={dark ? '#1f2937' : '#eef0f6'} />
      <text x={240} y={44} fontSize={11} fontWeight={700} fill={strong} textAnchor="middle">
        Market conditions — trending · ranging · volatile · quiet
      </text>
      {lanes.map((l, i) => {
        const x = 30 + i * 84;
        return (
          <g key={l.label}>
            <line x1={x + 42} y1={56} x2={x + 42} y2={90} stroke={muted} strokeWidth={1.5} strokeDasharray="3 3" />
            <rect x={x} y={90} width={74} height={120} rx={8} fill={l.color} fillOpacity={0.14} stroke={l.color} strokeWidth={1.5} />
            <circle cx={x + 37} cy={120} r={12} fill={l.color} fillOpacity={0.3} stroke={l.color} strokeWidth={1.5} />
            <text x={x + 37} y={160} fontSize={11} fontWeight={700} fill={strong} textAnchor="middle">{l.label}</text>
            <text x={x + 37} y={175} fontSize={7.5} fill={muted} textAnchor="middle">{l.sub}</text>
          </g>
        );
      })}
      <text x={240} y={232} fontSize={9.5} fill={muted} textAnchor="middle">Each bot activates most under its own matching market condition</text>
    </Svg>
  );
}

const RENDERERS: Record<string, (props: { dark: boolean }) => JSX.Element> = {
  'orient-01-gap-diagram': GapDiagram,
  'orient-02-funnel': FunnelDiagram,
  'orient-03-expectancy-scale': ExpectancyScale,
  'orient-04-equity-curve': EquityCurve,
  'orient-05-three-areas': ThreeAreas,
  'orient-06-five-lanes': FiveLanes,
};

export const ORIENT_DIAGRAM_KEYS = Object.keys(RENDERERS);

export function OrientDiagram({ diagramKey, description, dark }: { diagramKey: string; description: string; dark: boolean }) {
  const Renderer = RENDERERS[diagramKey];
  const cardCls = `rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-bold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`;

  // A future-authored `[VISUAL: ...]` key with no matching renderer
  // yet still gets a clean, readable card instead of raw bracket text
  // — the same "never show broken markup" fix this component exists
  // for, just without a custom drawing behind it.
  if (!Renderer) {
    return (
      <div className={cardCls}>
        <div className={titleCls}>Visual model</div>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/70' : 'text-gray-700'}`}>{description}</p>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className={titleCls}>{LABEL[diagramKey] ?? 'Visual model'}</div>
      <Renderer dark={dark} />
      <p className={`text-xs mt-3 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-600'}`}>{description}</p>
    </div>
  );
}
