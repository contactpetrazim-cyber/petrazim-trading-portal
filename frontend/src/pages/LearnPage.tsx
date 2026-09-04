import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Stats {
  overall_mastery_pct: number;
  xp: number;
  level: number;
  current_streak_days: number;
}

interface TrackSummary {
  id: string;
  emoji: string;
  title: string;
  description: string;
  category: string;
  stages_completed: number;
  total_stages: number;
  locked: boolean;
}

/**
 * LearnPage — the real Learn area, replacing the generic AreaPage link
 * list this route fell through to before. Per Section 4 of the
 * Learning System Handover: LearningStatsBar (4-stat row) -> grid of
 * TrackCards, each with an emoji, a progress bar, and a lock icon if
 * not yet unlocked. Both the stats and the tracks come from the real
 * /curriculum/* endpoints, which didn't exist at all before this —
 * the data model and progression engine were real and tested, but
 * nothing had ever exposed either over HTTP.
 *
 * Uses apiFetch (not plain fetch) so an access-expired 402 actually
 * surfaces the AccessExpiredGate card — most of the app still calls
 * plain fetch() and never wired that up, a separate, wider gap this
 * page doesn't fix on its own.
 *
 * `categoryFilter` backs the Site Map's three specific Learn sub-links
 * (Trading Basics / Bot Mastery Tracks / Trading Psychology) — those
 * routed to /learn/basics, /learn/bots, /learn/psychology, none of
 * which existed as real routes, so they always fell through to the
 * sitemap redirect. There's no dedicated per-category endpoint, so
 * this filters the same /curriculum/tracks response LearnPage always
 * fetched, client-side, by TrackCategory. "Mastery Overview" and
 * "Awards & Certificates" have no backing feature at all yet (no
 * badges/certificates model exists) — those two route to the
 * unfiltered page instead of a dead end.
 */
export function LearnPage({ categoryFilter }: { categoryFilter?: 'basics' | 'bot_mastery' | 'psychology' } = {}) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiFetch(`${API_URL}/curriculum/stats`, { headers }).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API_URL}/curriculum/tracks`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, t]) => {
        setStats(s);
        setTracks(t);
        if (!s || !t) setError('Could not load your Learn progress right now.');
      })
      .catch(() => setError('Could not load your Learn progress right now.'));
  }, [token]);

  const statTiles = stats
    ? [
        { label: 'Overall mastery', value: `${stats.overall_mastery_pct}%` },
        { label: 'Experience', value: `${stats.xp} XP` },
        { label: 'Level', value: stats.level },
        { label: 'Learning streak', value: `${stats.current_streak_days}d` },
      ]
    : [];

  const filteredTracks = categoryFilter ? tracks?.filter((t) => t.category === categoryFilter) ?? null : tracks;
  const headerCopy = {
    basics: { title: 'Trading Basics', subtitle: 'Start from zero — market structure, order types, and risk fundamentals.' },
    bot_mastery: { title: 'Bot Mastery Tracks', subtitle: "Novice-to-mastery path for each of the 5 bots' own methodology — locked sequence, stage by stage." },
    psychology: { title: 'Trading Psychology', subtitle: 'Discipline, emotional control, and process-over-outcome thinking.' },
  } as const;
  const { title, subtitle } = categoryFilter
    ? headerCopy[categoryFilter]
    : { title: 'Learn', subtitle: 'Structured tracks for market structure, each bot’s own methodology, and trading psychology.' };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className={`rounded-xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}
            >
              <div className="text-2xl font-bold text-corporate-hero font-display">{tile.value}</div>
              <div className={`text-xs mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{tile.label}</div>
            </div>
          ))}
        </div>
      )}

      {filteredTracks === null && !error && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading your tracks…</p>
      )}

      {filteredTracks && filteredTracks.length === 0 && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          {tracks && tracks.length > 0
            ? 'No tracks in this category yet.'
            : 'No learning tracks are seeded yet — an admin needs to run the curriculum seed script first.'}
        </p>
      )}

      {filteredTracks && filteredTracks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTracks.map((t) => {
            const pct = t.total_stages > 0 ? Math.round((100 * t.stages_completed) / t.total_stages) : 0;
            const Card = (
              <div
                className={`rounded-2xl border p-5 transition-shadow ${t.locked ? 'opacity-60' : 'hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)]'} ${
                  dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-3xl">{t.emoji}</span>
                  {t.locked && <Lock size={16} className={dark ? 'text-white/30' : 'text-gray-300'} />}
                </div>
                <div className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.title}</div>
                <p className={`text-xs mb-3 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.description}</p>
                <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                  <div className="h-full bg-corporate-hero rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className={`text-xs mt-1.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                  {t.stages_completed} of {t.total_stages} stages complete
                </div>
              </div>
            );
            return t.locked ? (
              <div key={t.id}>{Card}</div>
            ) : (
              <Link key={t.id} to={`/learn/tracks/${t.id}`}>{Card}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
