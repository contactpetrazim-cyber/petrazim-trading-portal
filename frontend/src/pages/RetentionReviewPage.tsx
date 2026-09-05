import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DueCheck {
  check_id: string;
  lesson_id: string;
  lesson_title: string;
  track_title: string;
  due_at: string;
  question: string;
  answer: string;
}

/**
 * RetentionReviewPage — the real page behind /practise/review, which
 * previously fell through to the sitemap redirect. Backed by the
 * spaced-recall RetentionCheck model + schedule_next_retention_check()
 * (progression_engine.py) — both real and already tested, but nothing
 * had ever created the first check for a lesson before this pass (see
 * complete_stage() in curriculum.py). A check is scheduled 1 day after
 * a stage's lesson is completed; passing here reschedules further out
 * (1/3/7/14/30 days), failing resets to day 1 — standard spaced-
 * repetition, not a novel algorithm.
 */
export function RetentionReviewPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [due, setDue] = useState<DueCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setError(null);
    apiFetch(`${API_URL}/practise/retention/due`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setDue)
      .catch(() => setError('Could not load your retention review right now.'));
  };

  useEffect(load, [token]);

  const complete = async (checkId: string, passed: boolean) => {
    if (!token) return;
    setBusy(checkId);
    try {
      const r = await apiFetch(`${API_URL}/practise/retention/${checkId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ passed }),
      });
      const body = r.ok ? await r.json() : null;
      setDue((prev) => (prev ? prev.filter((d) => d.check_id !== checkId) : prev));
      setLastResult(
        body
          ? `${passed ? 'Nice — ' : 'Noted — '}next review in ${body.next_interval_days} day${body.next_interval_days === 1 ? '' : 's'}.`
          : null
      );
    } finally {
      setBusy(null);
    }
  };

  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <div>
      <PageHeader title="Retention Review" subtitle="Spaced-recall check-ins so what you learned actually sticks." />

      {error && (
        <div className={`flex items-center justify-between gap-3 text-sm mb-4 rounded-xl p-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
          <span>{error}</span>
          <button onClick={load} className={`shrink-0 underline font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
            Try again
          </button>
        </div>
      )}
      {lastResult && (
        <p className={`text-sm mb-4 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>{lastResult}</p>
      )}
      {!due && !error && <p className={`text-sm ${mutedCls}`}>Loading due reviews…</p>}
      {!due && error && <p className={`text-sm ${mutedCls}`}>Your due reviews will show here once this loads — hit "Try again" above.</p>}

      {due && due.length === 0 && (
        <div className={`${cardCls} text-center py-10`}>
          <Brain size={28} className={`mx-auto mb-3 ${mutedCls}`} />
          <p className={`text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}>Nothing due right now.</p>
          <p className={`text-xs mt-1 ${mutedCls}`}>
            Completing a lesson schedules its first review 1 day later — check back then.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {due?.map((d) => (
          <div key={d.check_id} className={cardCls}>
            <div className={`text-xs font-semibold mb-0.5 ${dark ? 'text-white/50' : 'text-gray-500'}`}>{d.track_title}</div>
            <div className={`text-xs mb-3 ${mutedCls}`}>{d.lesson_title}</div>
            <p className={`text-sm mb-4 leading-relaxed ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{d.question}</p>

            {!revealed[d.check_id] ? (
              <button
                onClick={() => setRevealed((r) => ({ ...r, [d.check_id]: true }))}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-corporate-bg text-corporate-hero hover:bg-[#dcdce8]'}`}
              >
                Reveal answer
              </button>
            ) : (
              <>
                <p className={`text-sm mb-4 p-3 rounded-lg leading-relaxed ${dark ? 'bg-white/5 text-white/70' : 'bg-corporate-bg text-gray-600'}`}>
                  {d.answer}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy === d.check_id}
                    onClick={() => complete(d.check_id, true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    I remembered it
                  </button>
                  <button
                    disabled={busy === d.check_id}
                    onClick={() => complete(d.check_id, false)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    I need to review this
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
