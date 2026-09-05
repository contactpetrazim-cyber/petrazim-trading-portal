import { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CandleChart, type ChartZone } from '../components/CandleChart';
import { SMC_DIAGRAM_DATA } from '../components/SMCDiagram';
import { GameResultsScreen } from '../components/GameResultsScreen';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CONCEPTS: ('fair-value-gap' | 'order-block')[] = [
  'fair-value-gap', 'order-block', 'fair-value-gap', 'order-block', 'fair-value-gap',
];
const DECOY_COLOR = '#9ca3af';
const LABELS = ['A', 'B', 'C'];

interface Round { concept: 'fair-value-gap' | 'order-block'; zones: (ChartZone & { isCorrect: boolean })[] }

function buildRound(concept: 'fair-value-gap' | 'order-block'): Round {
  const diagram = SMC_DIAGRAM_DATA[concept];
  const real = diagram.zones![0];
  const span = real.toIndex - real.fromIndex;
  const priceSpan = real.priceTop - real.priceBottom;

  // Two decoys at different index/price offsets within the same chart
  // — plausible-looking but not the actual gap/order-block by
  // construction (this diagram's own real definition), so there's
  // always exactly one honest correct answer.
  const decoys: ChartZone[] = [
    { fromIndex: Math.max(0, real.fromIndex - 2), toIndex: Math.max(0, real.fromIndex - 2) + span, priceTop: real.priceTop - priceSpan * 1.4, priceBottom: real.priceBottom - priceSpan * 1.4, color: DECOY_COLOR },
    { fromIndex: real.fromIndex, toIndex: real.toIndex, priceTop: real.priceTop + priceSpan * 1.6, priceBottom: real.priceBottom + priceSpan * 0.6, color: DECOY_COLOR },
  ];

  const all = [{ ...real, isCorrect: true }, ...decoys.map((d) => ({ ...d, isCorrect: false }))];
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return { concept, zones: shuffled.map((z, i) => ({ ...z, label: LABELS[i] })) };
}

/**
 * ZoneTapperGame — a deliberately DIFFERENT interaction from every
 * other game so far: tap directly on the chart zone itself (three
 * candidates overlaid on one real diagram), not a separate text
 * button list. Untimed — spatial identification, not speed.
 */
export function ZoneTapperGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<Round>(() => buildRound(CONCEPTS[0]));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  function pick(zone: ChartZone & { isCorrect: boolean }) {
    if (picked) return;
    setPicked(zone.label!);
    if (zone.isCorrect) {
      setScore((s) => s + 1);
    } else {
      setMissed((m) => [...m, `${SMC_DIAGRAM_DATA[round.concept].title} — tapped the wrong zone`]);
    }
  }

  async function next() {
    if (index + 1 < CONCEPTS.length) {
      setIndex((i) => i + 1);
      setRound(buildRound(CONCEPTS[index + 1]));
      setPicked(null);
      return;
    }
    setFinished(true);
    if (!token) return;
    const res = await apiFetch(`${API_URL}/curriculum/games/zone-tapper/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        score, base_xp: 15,
        performance_summary: score === CONCEPTS.length ? 'Every zone, tapped correctly.' : 'Worth another pass on the misses.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) setXpAwarded((await res.json()).xp_awarded);
  }

  function replay() {
    setIndex(0);
    setRound(buildRound(CONCEPTS[0]));
    setPicked(null);
    setScore(0);
    setMissed([]);
    setFinished(false);
    setXpAwarded(0);
  }

  if (finished) {
    return (
      <div>
        <PageHeader title="Zone Tapper" subtitle="Tap the real zone on the chart." />
        <GameResultsScreen
          score={score} total={CONCEPTS.length}
          performanceSummary={score === CONCEPTS.length ? 'Every zone, tapped correctly.' : 'Worth another pass on the misses.'}
          missedItems={missed} xpAwarded={xpAwarded} onReplay={replay} backHref="/practise/game" dark={dark}
        />
      </div>
    );
  }

  const diagram = SMC_DIAGRAM_DATA[round.concept];
  const correctZone = round.zones.find((z) => z.isCorrect)!;

  return (
    <div>
      <PageHeader title="Zone Tapper" subtitle="Tap directly on the chart — no button list." />
      <div className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair size={16} className="text-corporate-hero" />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Round {index + 1} of {CONCEPTS.length}</span>
        </div>

        <p className={`text-sm font-medium mb-3 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          Tap zone A, B, or C — which one is the real {diagram.title}?
        </p>

        <CandleChart
          candles={diagram.candles}
          zones={round.zones.map((z) => ({
            ...z,
            color: picked ? (z.isCorrect ? '#22c55e' : z.label === picked ? '#ef4444' : DECOY_COLOR) : z.color,
            onClick: picked ? undefined : () => pick(z),
          }))}
          dark={dark}
          height={220}
        />

        {!picked ? (
          <p className={`text-xs mt-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Tap directly on one of the three shaded zones above.</p>
        ) : (
          <>
            <div className={`rounded-xl p-3 mt-3 mb-3 text-sm ${picked === correctZone.label ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
              {picked === correctZone.label ? 'Correct — ' : 'Not quite — '}zone {correctZone.label} is the real {diagram.title}.
            </div>
            <button onClick={next} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
              {index + 1 < CONCEPTS.length ? 'Next' : 'See results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
