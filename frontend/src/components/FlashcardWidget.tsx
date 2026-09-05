import { useState } from 'react';
import { Layers, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from './LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Card { index: number; term: string; definition: string }

/**
 * FlashcardWidget — Section 13. Auto-extracted from this lesson's own
 * real content (extraction, not new content). "still_learning" feeds
 * the same spaced-review queue as a missed assessment/retrieval
 * question — the backend schedules that, this just shows the honest
 * confirmation when it happens.
 */
export function FlashcardWidget({ lessonId, dark }: { lessonId: string; dark: boolean }) {
  const { token } = useAuth();
  const [started, setStarted] = useState(false);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  function handleStart() {
    setStarted(true);
    setError(null);
    fetchJsonWithRetry<Card[]>(
      `${API_URL}/curriculum/lessons/${lessonId}/flashcards`,
      { headers: { Authorization: `Bearer ${token}` } },
      setPhase,
    ).then((r) => {
      if (r && r.length) setCards(r);
      else setError('No flashcards available for this lesson right now.');
    });
  }

  async function rate(rating: 'got_it' | 'still_learning') {
    if (!cards) return;
    const card = cards[index];
    apiFetch(`${API_URL}/curriculum/lessons/${lessonId}/flashcards/${card.index}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ self_rating: rating }),
    }).catch(() => {});
    setDone((d) => d + 1);
    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setCards(null);
    }
  }

  if (!started) {
    return (
      <button
        onClick={handleStart}
        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
          dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
        }`}
      >
        <Layers size={16} /> Flashcards
      </button>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border mt-3 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Layers size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Flashcards</span>
      </div>

      {!cards && !error && done === 0 && <LoadingIndicator phase={phase} dark={dark} />}
      {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
      {!cards && done > 0 && (
        <p className={`text-sm ${dark ? 'text-white/60' : 'text-gray-600'}`}>Done — {done} card{done === 1 ? '' : 's'} reviewed.</p>
      )}

      {cards && cards[index] && (
        <div>
          <p className={`text-xs mb-2 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Card {index + 1} of {cards.length}</p>
          <button
            onClick={() => setFlipped((f) => !f)}
            className={`w-full text-left rounded-xl p-5 mb-3 min-h-[100px] flex items-center transition-colors ${
              dark ? 'bg-white/5 hover:bg-white/10' : 'bg-corporate-bg hover:bg-corporate-hero/5'
            }`}
          >
            {!flipped ? (
              <span className={`text-base font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{cards[index].term}</span>
            ) : (
              <span className={`text-sm ${dark ? 'text-white/80' : 'text-gray-700'}`}>{cards[index].definition}</span>
            )}
          </button>

          {!flipped ? (
            <button
              onClick={() => setFlipped(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero"
            >
              Reveal definition <ChevronRight size={14} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => rate('got_it')} className="flex-1 text-xs font-semibold py-2 rounded-lg bg-emerald-500/15 text-emerald-600">Got it</button>
              <button onClick={() => rate('still_learning')} className="flex-1 text-xs font-semibold py-2 rounded-lg bg-amber-500/15 text-amber-600">Still learning</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
