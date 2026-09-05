import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface MasteryTrack {
  id: string;
  emoji: string;
  title: string;
  category: string;
  mastery_level: 'novice' | 'developing' | 'competent' | 'proficient' | 'mastery';
  stages_completed: number;
  total_stages: number;
  avg_quiz_score_pct: number | null;
  last_activity_at: string | null;
  recap_opens: number;
}
interface ActivityDay { date: string; active: boolean }
interface Overview {
  xp: number;
  level: number;
  current_streak_days: number;
  longest_streak_days: number;
  tracks: MasteryTrack[];
  activity_last_30_days: ActivityDay[];
}

const LEVEL_META: Record<MasteryTrack['mastery_level'], { label: string; pct: number; color: string }> = {
  novice: { label: 'Novice', pct: 10, color: '#94a3b8' },
  developing: { label: 'Developing', pct: 32, color: '#f59e0b' },
  competent: { label: 'Competent', pct: 55, color: '#0284C7' },
  proficient: { label: 'Proficient', pct: 78, color: '#00829B' },
  mastery: { label: 'Mastery', pct: 100, color: '#10b981' },
};

/**
 * MasteryOverviewPage — the real page behind the Site Map's "Mastery
 * Overview" link (/learn/mastery), which previously routed nowhere
 * (fell through to the sitemap redirect). "Your mastery level across
 * every track, at a glance" — one row per track with its
 * quiz+practice-derived MasteryLevel (GET /curriculum/mastery), not
 * just stage-completion percentage, which LearnPage's track cards
 * already show.
 */
export function MasteryOverviewPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/curriculum/mastery`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Could not load your mastery overview right now.'));
  }, [token]);

  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <div>
      <PageHeader title="Mastery Overview" subtitle="Your mastery level across every track, at a glance." />

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
        <Link to="/learn/reflections" className={`text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-corporate-hero'}`}>
          My Reflections →
        </Link>
        <Link to="/learn/notes" className={`text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-corporate-hero'}`}>
          My Notes →
        </Link>
        <Link to="/learn/revision" className={`text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-corporate-hero'}`}>
          Revision Planner →
        </Link>
        <Link to="/learn/visual-glossary" className={`text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-corporate-hero'}`}>
          Visual Glossary →
        </Link>
      </div>

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Level', value: data.level },
            { label: 'Experience', value: `${data.xp} XP` },
            { label: 'Current streak', value: `${data.current_streak_days}d` },
            { label: 'Longest streak', value: `${data.longest_streak_days}d` },
          ].map((tile) => (
            <div key={tile.label} className={cardCls}>
              <div className="text-2xl font-bold text-corporate-hero font-display">{tile.value}</div>
              <div className={`text-xs mt-1 ${mutedCls}`}>{tile.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section 15's activity strip — real StageCompletion dates over
          the last 30 days, the same rows every "stages complete" number
          on this page already comes from. */}
      {data && data.activity_last_30_days.length > 0 && (
        <div className="mb-6">
          <div className={`text-xs font-semibold mb-2 ${mutedCls}`}>Last 30 days</div>
          <div className="flex gap-1">
            {data.activity_last_30_days.map((d) => (
              <div
                key={d.date}
                title={`${d.date}${d.active ? ' — active' : ''}`}
                className="flex-1 h-4 rounded-sm"
                style={{ background: d.active ? '#10b981' : dark ? 'rgba(255,255,255,0.08)' : '#eef0f6' }}
              />
            ))}
          </div>
        </div>
      )}

      {!data && !error && <p className={`text-sm ${mutedCls}`}>Loading your mastery overview…</p>}

      {data && data.tracks.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No learning tracks are seeded yet.</p>
      )}

      {data && data.tracks.length > 0 && (
        <div className="space-y-3">
          {data.tracks.map((t) => {
            const meta = LEVEL_META[t.mastery_level];
            const stagePct = t.total_stages > 0 ? Math.round((100 * t.stages_completed) / t.total_stages) : 0;
            return (
              <Link key={t.id} to={`/learn/tracks/${t.id}`} className="block">
                <div className={`${cardCls} hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)] transition-shadow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{t.emoji}</span>
                      <span className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.title}</span>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: meta.color, background: `${meta.color}1a` }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden mb-1 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                    <div className="h-full rounded-full" style={{ width: `${meta.pct}%`, background: meta.color }} />
                  </div>
                  <div className={`text-xs ${mutedCls}`}>
                    {t.stages_completed} of {t.total_stages} stages complete ({stagePct}%)
                    {t.avg_quiz_score_pct !== null && ` · Avg quiz ${t.avg_quiz_score_pct}%`}
                    {t.recap_opens > 0 && ` · Recap opened ${t.recap_opens}×`}
                    {t.last_activity_at && ` · Last active ${new Date(t.last_activity_at).toLocaleDateString()}`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
