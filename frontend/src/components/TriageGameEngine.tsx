import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { GameResultsScreen } from './GameResultsScreen';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface TriageOption { label: string; correct: boolean }
export interface TriageScenario { id: string; prompt: string; options: TriageOption[]; whatYoudDoDifferently: string }

/**
 * TriageGameEngine — shared "read a scenario, choose under a countdown"
 * harness, playable in well under 5 minutes (GM04). Three of the
 * spec's 10 solo pillar games (Setup Spotter / Risk Triage / Bias
 * Check) currently sit on this ONE engine with different content —
 * an honest simplification given real build-time constraints, not the
 * full "10 separate mechanics" from Section 10a. Each is tap-based
 * (no drag), so the mobile-fallback requirement (GM02) is inherent
 * rather than a separate fallback path. Later additions should favor
 * genuinely different interaction patterns (drag/sort, pipeline
 * allocation, branching) over a fourth reskin of this one.
 */
export function TriageGameEngine({
  gameId, trackId, title, icon, accent, scenarios, secondsPerQuestion, baseXp, backHref, dark,
}: {
  gameId: string;
  trackId?: string;
  title: string;
  icon: ReactNode;
  accent: string;
  scenarios: TriageScenario[];
  secondsPerQuestion: number;
  baseXp: number;
  backHref: string;
  dark: boolean;
}) {
  const { token } = useAuth();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);
  const [answered, setAnswered] = useState<TriageOption | null>(null);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [runKey, setRunKey] = useState(0);

  const scenario = scenarios[index];

  useEffect(() => {
    if (finished || answered) return;
    if (timeLeft <= 0) {
      handleAnswer(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, answered, finished]);

  function handleAnswer(option: TriageOption | null) {
    setAnswered(option ?? { label: '(ran out of time)', correct: false });
    if (option?.correct) {
      setScore((s) => s + 1);
    } else {
      setMissed((m) => [...m, scenario.whatYoudDoDifferently]);
    }
  }

  async function next() {
    if (index + 1 < scenarios.length) {
      setIndex((i) => i + 1);
      setAnswered(null);
      setTimeLeft(secondsPerQuestion);
      return;
    }
    setFinished(true);
    if (!token) return;
    // `score` here already reflects this round's handleAnswer() update —
    // that setScore has flushed and re-rendered by the time this button
    // exists at all (it only appears once `answered` is set).
    const res = await apiFetch(`${API_URL}/curriculum/games/${gameId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        track_id: trackId, score, base_xp: baseXp,
        performance_summary: score === scenarios.length ? 'Perfect run.' : score >= scenarios.length * 0.7 ? 'Solid — a couple to review.' : 'Worth another pass.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setXpAwarded(data.xp_awarded);
    }
  }

  function replay() {
    setIndex(0);
    setScore(0);
    setMissed([]);
    setAnswered(null);
    setTimeLeft(secondsPerQuestion);
    setFinished(false);
    setXpAwarded(0);
    setRunKey((k) => k + 1);
  }

  if (finished) {
    return (
      <GameResultsScreen
        score={score} total={scenarios.length}
        performanceSummary={score === scenarios.length ? 'Perfect run.' : score >= scenarios.length * 0.7 ? 'Solid — a couple to review.' : 'Worth another pass.'}
        missedItems={missed} xpAwarded={xpAwarded} onReplay={replay} backHref={backHref} dark={dark}
      />
    );
  }

  return (
    <div key={runKey} className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>{icon}</span>
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{title}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 3 ? 'text-red-500' : dark ? 'text-white/60' : 'text-gray-500'}`}>
          <Clock size={14} /> {timeLeft}s
        </div>
      </div>

      <div className={`text-xs mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Scenario {index + 1} of {scenarios.length}</div>
      <p className={`text-base font-medium mb-5 leading-relaxed ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{scenario.prompt}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {scenario.options.map((opt, i) => {
          const isAnswered = answered !== null;
          const state = !isAnswered ? 'idle' : opt.correct ? 'correct' : answered.label === opt.label ? 'wrong' : 'idle';
          return (
            <button
              key={i}
              onClick={() => !isAnswered && handleAnswer(opt)}
              disabled={isAnswered}
              className={`text-left text-sm px-4 py-3 rounded-xl border transition-colors ${
                state === 'correct' ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700' :
                state === 'wrong' ? 'bg-red-500/15 border-red-500 text-red-700' :
                dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <button onClick={next} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
          {index + 1 < scenarios.length ? 'Next' : 'See results'}
        </button>
      )}
    </div>
  );
}
