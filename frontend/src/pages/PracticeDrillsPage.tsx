import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Drill {
  lesson_id: string;
  lesson_title: string;
  prompt: string;
  attempts: number;
  correct_attempts: number;
}
interface TrackGroup {
  track_id: string;
  track_title: string;
  drills: Drill[];
}

/**
 * PracticeDrillsPage — the real page behind /practise/drills, which
 * previously fell through to the sitemap redirect. Each drill's prompt
 * is the REAL "Practice Drill" text authored into that lesson (see
 * routers/practise.py's own docstring on why this is self-graded
 * rather than auto-graded) — nothing here is generated or fabricated.
 * Marking a drill correct writes the same PracticeAttempt row the
 * Learn dual-gate reads, so practicing here for real counts toward a
 * track's stage-completion requirement too.
 *
 * `?lesson={id}` — arrives from LessonPage's "Practice this lesson"
 * link, by direct request ("connect learn page and practise page").
 * Auto-expands the track group containing that lesson and scrolls to
 * it, rather than landing here with every group folded and no
 * indication which one the reader was sent for.
 */
export function PracticeDrillsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const targetLessonId = searchParams.get('lesson');
  const [groups, setGroups] = useState<TrackGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!targetLessonId || !groups) return;
    document.getElementById(`drill-${targetLessonId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [targetLessonId, groups]);

  const load = () => {
    if (!token) return;
    setError(null);
    apiFetch(`${API_URL}/practise/drills`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setGroups)
      .catch(() => setError('Could not load practice drills right now.'));
  };

  useEffect(load, [token]);

  const submit = async (trackId: string, lessonId: string, correct: boolean) => {
    if (!token) return;
    setBusy(lessonId);
    try {
      await apiFetch(`${API_URL}/practise/drills/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ track_id: trackId, lesson_id: lessonId, correct }),
      });
      setGroups((prev) =>
        prev
          ? prev.map((g) =>
              g.track_id !== trackId
                ? g
                : {
                    ...g,
                    drills: g.drills.map((d) =>
                      d.lesson_id !== lessonId
                        ? d
                        : { ...d, attempts: d.attempts + 1, correct_attempts: d.correct_attempts + (correct ? 1 : 0) }
                    ),
                  }
            )
          : prev
      );
    } finally {
      setBusy(null);
    }
  };

  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <div>
      <PageHeader title="Practice Drills" subtitle="Repeated, scored scenario drills per concept." />

      {/* A failed load used to leave the page blank below the error
          line — by direct bug report ("same for practice - fix you
          can not show"). Always a real "try again" action and a
          default message now, never dead blank space. */}
      {error && (
        <div className={`flex items-center justify-between gap-3 text-sm mb-4 rounded-xl p-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
          <span>{error}</span>
          <button onClick={load} className={`shrink-0 underline font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
            Try again
          </button>
        </div>
      )}
      {!groups && !error && <p className={`text-sm ${mutedCls}`}>Loading drills…</p>}
      {!groups && error && <p className={`text-sm ${mutedCls}`}>Your drills will show here once this loads — hit "Try again" above.</p>}
      {groups && groups.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No practice drills are available yet.</p>
      )}

      <div className="space-y-3">
        {groups?.map((g) => (
          <FoldedCard
            key={g.track_id}
            title={g.track_title}
            summary={`${g.drills.length} drill${g.drills.length === 1 ? '' : 's'}`}
            dark={dark}
            defaultOpen={g.drills.some((d) => d.lesson_id === targetLessonId)}
          >
            <div className="space-y-4">
              {g.drills.map((d) => (
                <div
                  key={d.lesson_id}
                  id={`drill-${d.lesson_id}`}
                  className={`pb-4 last:pb-0 border-b last:border-0 -mx-2 px-2 rounded-lg transition-colors ${dark ? 'border-white/5' : 'border-gray-50'} ${
                    d.lesson_id === targetLessonId ? (dark ? 'bg-corporate-hero/10' : 'bg-corporate-hero/5') : ''
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 ${dark ? 'text-white/70' : 'text-gray-600'}`}>{d.lesson_title}</div>
                  <p className={`text-sm mb-3 leading-relaxed ${dark ? 'text-white/80' : 'text-gray-700'}`}>{d.prompt}</p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy === d.lesson_id}
                      onClick={() => submit(g.track_id, d.lesson_id, true)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      Got it right
                    </button>
                    <button
                      disabled={busy === d.lesson_id}
                      onClick={() => submit(g.track_id, d.lesson_id, false)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Needs more practice
                    </button>
                    <span className={`text-xs ml-auto ${mutedCls}`}>
                      {d.correct_attempts} of {d.attempts} correct
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </FoldedCard>
        ))}
      </div>
    </div>
  );
}
