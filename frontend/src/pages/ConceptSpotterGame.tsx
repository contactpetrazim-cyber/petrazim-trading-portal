import { useState } from 'react';
import { Eye } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CandleChart } from '../components/CandleChart';
import { SMCDiagram, SMC_DIAGRAM_DATA, SMC_DIAGRAM_KEYS, type SMCDiagramKey } from '../components/SMCDiagram';
import { GameResultsScreen } from '../components/GameResultsScreen';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function shuffledKeys(): SMCDiagramKey[] {
  const arr = [...SMC_DIAGRAM_KEYS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function optionsFor(correct: SMCDiagramKey): SMCDiagramKey[] {
  const others = SMC_DIAGRAM_KEYS.filter((k) => k !== correct);
  const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
  return [...shuffled, correct].sort(() => Math.random() - 0.5);
}

/**
 * ConceptSpotterGame — "chart examples identifying taught content", by
 * direct request: shown an UNLABELED chart (the same real diagram
 * data SMCDiagram renders, just without its zones/labels/caption),
 * name the concept it demonstrates, then the fully annotated version
 * reveals to confirm. Untimed (identifying a pattern calmly is the
 * actual skill here, not speed).
 */
export function ConceptSpotterGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [order] = useState(shuffledKeys);
  const [index, setIndex] = useState(0);
  const [options] = useState(() => order.map(optionsFor));
  const [answered, setAnswered] = useState<SMCDiagramKey | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  const key = order[index];
  const diagram = SMC_DIAGRAM_DATA[key];

  function choose(pick: SMCDiagramKey) {
    if (answered) return;
    setAnswered(pick);
    if (pick === key) {
      setScore((s) => s + 1);
    } else {
      setMissed((m) => [...m, `${SMC_DIAGRAM_DATA[key].title} — you picked ${SMC_DIAGRAM_DATA[pick].title}`]);
    }
  }

  async function next() {
    if (index + 1 < order.length) {
      setIndex((i) => i + 1);
      setAnswered(null);
      return;
    }
    setFinished(true);
    if (!token) return;
    const res = await apiFetch(`${API_URL}/curriculum/games/concept-spotter/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        score, base_xp: 15,
        performance_summary: score === order.length ? 'Every concept, correctly spotted.' : 'Worth another look at the ones you missed.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) setXpAwarded((await res.json()).xp_awarded);
  }

  function replay() {
    setIndex(0);
    setAnswered(null);
    setScore(0);
    setMissed([]);
    setFinished(false);
    setXpAwarded(0);
  }

  if (finished) {
    return (
      <div>
        <PageHeader title="Concept Spotter" subtitle="Name the pattern from the chart alone." />
        <GameResultsScreen
          score={score} total={order.length}
          performanceSummary={score === order.length ? 'Every concept, correctly spotted.' : 'Worth another look at the ones you missed.'}
          missedItems={missed} xpAwarded={xpAwarded} onReplay={replay} backHref="/practise/game" dark={dark}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Concept Spotter" subtitle="Name the pattern from the chart alone — no timer." />
      <div className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-corporate-hero" />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Chart {index + 1} of {order.length}</span>
        </div>

        <CandleChart candles={diagram.candles} dark={dark} height={200} />

        <p className={`text-sm font-medium mt-4 mb-3 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Which concept does this chart show?</p>

        {!answered ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options[index].map((opt) => (
              <button
                key={opt}
                onClick={() => choose(opt)}
                className={`text-sm px-4 py-3 rounded-xl border transition-colors ${dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'}`}
              >
                {SMC_DIAGRAM_DATA[opt].title}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={`rounded-xl p-3 mb-3 text-sm ${answered === key ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
              {answered === key ? 'Correct — ' : 'Not quite — '}this is a {diagram.title}.
            </div>
            <div className="mb-3">
              <SMCDiagram concept={key} dark={dark} />
            </div>
            <button onClick={next} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
              {index + 1 < order.length ? 'Next' : 'See results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
