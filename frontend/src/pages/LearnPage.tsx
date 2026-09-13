import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Timer as TimerIcon, Trophy, BarChart3, Dumbbell, RotateCcw, Gamepad2, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { FocusTimer } from '../components/FocusTimer';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';

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

interface Badge { id: string; title: string; description: string; icon: string; earned: boolean; progress: number }
interface Awards { badges: Badge[] }

// The rest of the learning loop, one click from the Learn hub — by
// direct request ("copy awards and mastery and practice and review
// and add them to the Learn section"). Practice Drills, Retention
// Review, and the Trading Simulator Game live under the separate
// Practise area (its own bottom-nav tab, a deliberate IA choice —
// see featureRegistry.ts) rather than being physically moved under
// /learn; this strip is what actually ties them into the Learn hub a
// trainee lands on, instead of requiring a trip through the Site Map.
const QUICK_LINKS = [
  { to: '/learn/mastery', label: 'Mastery Overview', icon: BarChart3 },
  { to: '/learn/awards', label: 'Awards & Certificates', icon: Trophy },
  { to: '/practise/drills', label: 'Practice Drills', icon: Dumbbell },
  { to: '/practise/review', label: 'Retention Review', icon: RotateCcw },
  { to: '/practise/game', label: 'Trading Simulator Game', icon: Gamepad2 },
] as const;

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
// Shown instead of blank space whenever real stats haven't loaded (yet,
// or at all) — zeroed, not fabricated, and clearly a placeholder via
// the page's own "Loading…"/error messaging around it.
const DEFAULT_STATS: Stats = { overall_mastery_pct: 0, xp: 0, level: 1, current_streak_days: 0 };

export function LearnPage({ categoryFilter }: { categoryFilter?: 'basics' | 'bot_mastery' | 'psychology' } = {}) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [awards, setAwards] = useState<Awards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [retryTick, setRetryTick] = useState(0);
  const [timerOpen, setTimerOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };
    // Retries through a cold Render free-tier start (up to ~90s) instead
    // of giving up on the first failed attempt — see resilientFetch.ts
    // for why that was the actual cause of "can't load Learn progress".
    Promise.all([
      fetchJsonWithRetry<Stats>(`${API_URL}/curriculum/stats`, { headers }, setPhase),
      fetchJsonWithRetry<TrackSummary[]>(`${API_URL}/curriculum/tracks`, { headers }),
    ]).then(([s, t]) => {
      setStats(s);
      setTracks(t);
      if (!s || !t) setError('Could not load your Learn progress right now — showing defaults below.');
    });
    // Best-effort, no shared error state — the awards summary card
    // below simply doesn't render if this fails, it never blocks the
    // rest of the page the way the stats/tracks failure above does.
    fetchJsonWithRetry<Awards>(`${API_URL}/curriculum/awards`, { headers }).then((a) => { if (a) setAwards(a); });
  }, [token, retryTick]);

  // A failed load used to leave the whole page blank below the error
  // line (stats/tracks both stayed null, and every render branch below
  // required one of them to be non-null) — by direct bug report ("fix
  // can not load learn progress ... you should be able to show default
  // template"). The template below now always has something to render:
  // zeroed stat tiles instead of none at all, and a real retry action
  // instead of a dead end. Likely cause in practice: this backend runs
  // on Render's free tier (see BackendStatusBadge's own sleep/wake
  // handling) — a cold-start request can outrun this page's first
  // fetch before the "Try again" retry ever fires.
  const effectiveStats = stats ?? (error ? DEFAULT_STATS : null);
  const statTiles = effectiveStats
    ? [
        { label: 'Overall mastery', value: `${effectiveStats.overall_mastery_pct}%` },
        { label: 'Experience', value: `${effectiveStats.xp} XP` },
        { label: 'Level', value: effectiveStats.level },
        { label: 'Learning streak', value: `${effectiveStats.current_streak_days}d` },
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

      {!categoryFilter && (
        <div className="mb-4">
          <button
            onClick={() => setTimerOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
              dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
            }`}
          >
            <TimerIcon size={15} /> Focus Timer
          </button>
          {timerOpen && <div className="mt-3 max-w-xs"><FocusTimer dark={dark} /></div>}
        </div>
      )}

      {(phase === 'loading' || phase === 'stalled') && !stats && (
        <div className="mb-4">
          <LoadingIndicator phase={phase} dark={dark} />
        </div>
      )}

      {error && (
        <div className={`flex items-center justify-between gap-3 text-sm mb-4 rounded-xl p-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
          <span>{error}</span>
          <button
            onClick={() => { setPhase('idle'); setRetryTick((n) => n + 1); }}
            className={`shrink-0 underline font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
          >
            Try again
          </button>
        </div>
      )}

      {effectiveStats && (
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

      {/* Quick links into the rest of the learning loop — Mastery,
          Awards, Practice, Review, and the Simulator Game — surfaced
          right on the Learn hub instead of only reachable via the Site
          Map. Only on the unfiltered page; a category-filtered view
          (e.g. /learn/bots) keeps its narrower focus. */}
      {!categoryFilter && (
        <div className="flex flex-wrap gap-2 mb-6">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
              }`}
            >
              <Icon size={13} /> {label}
            </Link>
          ))}
        </div>
      )}

      {/* Awards summary card — adapted from the reference training
          portal's "X of Y badges earned — Next up: ..." card, backed
          by this app's real GET /curriculum/awards data rather than a
          client-side progress store. Silently absent if awards hasn't
          loaded yet (best-effort fetch above) rather than blocking the
          page on a third endpoint. */}
      {!categoryFilter && awards && awards.badges.length > 0 && (() => {
        const earnedCount = awards.badges.filter((b) => b.earned).length;
        const nextUp = awards.badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)[0];
        return (
          <Link
            to="/learn/awards"
            className={`block rounded-2xl border p-5 mb-6 transition-shadow hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)] ${
              dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                🏆
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                  {earnedCount} of {awards.badges.length} badges earned
                </div>
                {nextUp && (
                  <p className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                    Next up: {nextUp.title} — {Math.round(nextUp.progress * 100)}% there. {nextUp.description}
                  </p>
                )}
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-hero'}`}>
                View awards <ArrowRight size={13} />
              </span>
            </div>
          </Link>
        );
      })()}

      {filteredTracks === null && !error && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading your tracks…</p>
      )}

      {filteredTracks === null && error && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          Your tracks will show here once this loads — hit "Try again" above.
        </p>
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
