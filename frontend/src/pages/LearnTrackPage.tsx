import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Lock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ReflectionPrompt } from '../components/ReflectionPrompt';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  lesson_id: string | null;
  min_quiz_score_pct: number;
  min_practice_reps: number;
  xp_reward: number;
  completed: boolean;
  can_attempt: boolean;
  lock_reason: string;
}

interface TrackDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  mastery_level: string;
  stages: Stage[];
}

/**
 * LearnTrackPage — one track's stage list, applying the real locked-
 * sequence rule (§3a of the Learning System Handover) rather than
 * just showing every stage as clickable. "Complete stage" runs the
 * real dual gate server-side (POST /curriculum/stages/complete) — a
 * high quiz score alone is deliberately not enough without the
 * practice-rep minimum too, so a stage can report exactly why it
 * won't complete yet instead of silently failing.
 *
 * "Read lesson" links to LessonPage — the actual authored content —
 * whenever a stage has a lesson and is either already unlocked or
 * already completed; GET /curriculum/lessons/{id} enforces the same
 * gate server-side, so this check is a convenience, not the real
 * access control.
 */
export function LearnTrackPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!token || !trackId) return;
    const res = await apiFetch(`${API_URL}/curriculum/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTrack(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, trackId]);

  async function completeStage(stageId: string) {
    if (!token) return;
    setBusyStage(stageId);
    setMessage(null);
    try {
      const res = await apiFetch(`${API_URL}/curriculum/stages/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage_id: stageId }),
      });
      const data = await res.json();
      if (data.completed) {
        setMessage(`Stage complete — +${data.xp_awarded} XP.`);
        await load();
      } else {
        setMessage(data.reason || 'Not ready to complete yet.');
      }
    } finally {
      setBusyStage(null);
    }
  }

  if (!track) {
    return (
      <div>
        <Link to="/learn" className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
          <ArrowLeft size={15} /> Back to Learn
        </Link>
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/learn" className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
        <ArrowLeft size={15} /> Back to Learn
      </Link>
      <PageHeader title={track.title} subtitle={track.description} />

      <div className={`text-xs font-semibold uppercase tracking-wide mb-4 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
        Mastery level: <span className="text-corporate-hero">{track.mastery_level}</span>
      </div>

      {/* Section 11's Decision Lab — currently seeded for Risk
          Management only, matched by title (see RiskManagementDecisionLab's
          own docstring on why this is a template, not all 18 tracks). */}
      {track.title.includes('Risk Management') && (
        <Link
          to="/learn/decision-lab/risk-management"
          className={`inline-flex items-center gap-1.5 text-sm font-medium mb-4 px-3 py-2 rounded-xl ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'}`}
        >
          🧭 Decision Lab — untimed, no score
        </Link>
      )}

      {message && (
        <div className={`text-sm rounded-xl p-3 mb-4 ${dark ? 'bg-white/5 text-white/80' : 'bg-blue-50 text-corporate-text-on-bg'}`}>
          {message}
        </div>
      )}

      <div className="space-y-2">
        {track.stages.map((s) => (
          <div
            key={s.id}
            className={`rounded-xl border p-4 flex items-center gap-3 ${!s.can_attempt && !s.completed ? 'opacity-60' : ''} ${
              dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'
            }`}
          >
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                s.completed ? 'bg-emerald-500/15 text-emerald-500' : dark ? 'bg-white/10 text-white/50' : 'bg-corporate-bg text-gray-500'
              }`}
            >
              {s.completed ? <CheckCircle2 size={16} /> : s.stage_number}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{s.title}</div>
              <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                {s.completed
                  ? `Completed · +${s.xp_reward} XP`
                  : s.can_attempt
                  ? `Needs ${s.min_quiz_score_pct}%+ quiz score and ${s.min_practice_reps} practice reps`
                  : s.lock_reason}
              </div>
            </div>
            {s.lesson_id && (s.can_attempt || s.completed) && (
              <Link
                to={`/learn/tracks/${trackId}/lessons/${s.lesson_id}`}
                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  dark ? 'border-white/15 text-white/80 hover:bg-white/5' : 'border-corporate-bg text-corporate-text-on-bg hover:bg-corporate-bg'
                }`}
              >
                <BookOpen size={13} /> Read lesson
              </Link>
            )}
            {!s.completed && s.can_attempt && (
              <button
                onClick={() => completeStage(s.id)}
                disabled={busyStage === s.id}
                title="Tip: read the lesson's Recap Summary first — a soft nudge, not required to mark this complete"
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-corporate-accent text-white disabled:opacity-50"
              >
                {busyStage === s.id ? '…' : 'Mark complete'}
              </button>
            )}
            {!s.can_attempt && !s.completed && <Lock size={16} className={dark ? 'text-white/20' : 'text-gray-300'} />}
          </div>
        ))}
      </div>

      {track.stages.length > 0 && track.stages.every((s) => s.completed) && (
        <ReflectionPrompt trackId={track.id} dark={dark} />
      )}
    </div>
  );
}
