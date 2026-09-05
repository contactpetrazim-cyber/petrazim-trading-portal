import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { ListenButton } from './ListenButton';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from './LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Recap {
  lesson_id: string;
  summary: string;
  generated_at: string;
  open_count: number;
}

/**
 * RecapPanel — Section 3 of the Learning Design Spec. Lazy: only
 * fetches once actually opened (a Recap the trainee never opens
 * shouldn't cost an AI call), toggled by "View Recap Summary" in
 * LessonPage. Every real open increments RecapEngagement.open_count
 * server-side (RC01) — fired once per open, not on every re-render.
 */
export function RecapPanel({ lessonId, dark }: { lessonId: string; dark: boolean }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  function handleOpen() {
    setOpen(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };
    fetchJsonWithRetry<Recap>(`${API_URL}/curriculum/lessons/${lessonId}/recap`, { headers }, setPhase, setError)
      .then((r) => {
        if (r) {
          setRecap(r);
          // Fire-and-forget engagement ping — a failure here shouldn't
          // block the trainee from reading the recap they already got.
          fetch(`${API_URL}/curriculum/lessons/${lessonId}/recap/open`, { method: 'POST', headers }).catch(() => {});
        } else {
          setError((prev) => prev ?? 'Could not generate a recap for this lesson right now — try again in a moment.');
        }
      });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
          dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
        }`}
      >
        <FileText size={16} /> View Recap Summary
      </button>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border mt-3 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Recap Summary</span>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close recap" className={dark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600'}>
          <X size={16} />
        </button>
      </div>

      {!recap && !error && <LoadingIndicator phase={phase} dark={dark} />}
      {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}

      {recap && (
        <>
          <div className="mb-3">
            <ListenButton text={recap.summary} dark={dark} />
          </div>
          <p className={`text-sm leading-relaxed whitespace-pre-line ${dark ? 'text-white/70' : 'text-gray-700'}`}>
            {recap.summary}
          </p>
          <p className={`text-xs mt-3 ${dark ? 'text-white/30' : 'text-gray-400'}`}>
            AI-generated from this lesson's own content · opened {recap.open_count} time{recap.open_count === 1 ? '' : 's'}
          </p>
        </>
      )}
    </div>
  );
}
