import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { GameResultsScreen } from './GameResultsScreen';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface MatchPair { id: string; term: string; definition: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MatchingGameEngine — a FOURTH distinct interaction: tap a term, then
 * tap the definition that matches it (memory-pairs style), tracking
 * wrong attempts as the real "missed" signal rather than a countdown.
 * Untimed, mobile-friendly by construction (tap only).
 */
export function MatchingGameEngine({
  gameId, title, icon, accent, pairs, baseXp, backHref, dark,
}: {
  gameId: string;
  title: string;
  icon: React.ReactNode;
  accent: string;
  pairs: MatchPair[];
  baseXp: number;
  backHref: string;
  dark: boolean;
}) {
  const { token } = useAuth();
  const [terms] = useState(() => shuffle(pairs));
  const [defs] = useState(() => shuffle(pairs));
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ term: string; def: string } | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  function tryMatch(termId: string, defId: string) {
    if (termId === defId) {
      setMatched((m) => new Set(m).add(termId));
      setSelectedTerm(null);
      setSelectedDef(null);
    } else {
      setWrongFlash({ term: termId, def: defId });
      setWrongAttempts((w) => ({ ...w, [termId]: (w[termId] ?? 0) + 1 }));
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedTerm(null);
        setSelectedDef(null);
      }, 600);
    }
  }

  function clickTerm(id: string) {
    if (matched.has(id) || wrongFlash) return;
    setSelectedTerm(id);
    if (selectedDef) tryMatch(id, selectedDef);
  }
  function clickDef(id: string) {
    if (matched.has(id) || wrongFlash) return;
    setSelectedDef(id);
    if (selectedTerm) tryMatch(selectedTerm, id);
  }

  const allMatched = matched.size === pairs.length;
  const perfectPairs = pairs.filter((p) => !wrongAttempts[p.id]).length;

  async function finish() {
    setFinished(true);
    if (!token) return;
    const missed = pairs.filter((p) => wrongAttempts[p.id]).map((p) => `${p.term} — ${p.definition}`);
    const res = await apiFetch(`${API_URL}/curriculum/games/${gameId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        score: perfectPairs, base_xp: baseXp,
        performance_summary: perfectPairs === pairs.length ? 'Every pair matched first try.' : 'A few pairs took more than one try.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) setXpAwarded((await res.json()).xp_awarded);
  }

  function replay() {
    setSelectedTerm(null);
    setSelectedDef(null);
    setMatched(new Set());
    setWrongFlash(null);
    setWrongAttempts({});
    setFinished(false);
    setXpAwarded(0);
    window.location.reload(); // simplest reliable reshuffle of both fixed-shuffled columns
  }

  if (finished) {
    return (
      <GameResultsScreen
        score={perfectPairs} total={pairs.length}
        performanceSummary={perfectPairs === pairs.length ? 'Every pair matched first try.' : 'A few pairs took more than one try.'}
        missedItems={pairs.filter((p) => wrongAttempts[p.id]).map((p) => `${p.term} — ${p.definition}`)}
        xpAwarded={xpAwarded} onReplay={replay} backHref={backHref} dark={dark}
      />
    );
  }

  const cardCls = `rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>{icon}</span>
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{title}</span>
      </div>
      <p className={`text-sm mb-4 ${mutedCls}`}>Tap a term, then tap the definition that matches it.</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-2">
          {terms.map((p) => {
            const isMatched = matched.has(p.id);
            const isSelected = selectedTerm === p.id;
            const isWrong = wrongFlash?.term === p.id;
            return (
              <button
                key={p.id}
                onClick={() => clickTerm(p.id)}
                disabled={isMatched}
                className={`w-full text-left text-xs sm:text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                  isMatched ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600' :
                  isWrong ? 'bg-red-500/15 border-red-500 text-red-600' :
                  isSelected ? 'border-corporate-hero bg-corporate-hero/10' :
                  dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'
                }`}
              >
                {p.term}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defs.map((p) => {
            const isMatched = matched.has(p.id);
            const isSelected = selectedDef === p.id;
            const isWrong = wrongFlash?.def === p.id;
            return (
              <button
                key={p.id}
                onClick={() => clickDef(p.id)}
                disabled={isMatched}
                className={`w-full text-left text-xs sm:text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                  isMatched ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600' :
                  isWrong ? 'bg-red-500/15 border-red-500 text-red-600' :
                  isSelected ? 'border-corporate-hero bg-corporate-hero/10' :
                  dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'
                }`}
              >
                {p.definition}
              </button>
            );
          })}
        </div>
      </div>

      {allMatched && (
        <button onClick={finish} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
          <Shuffle size={14} /> See results
        </button>
      )}
    </div>
  );
}
