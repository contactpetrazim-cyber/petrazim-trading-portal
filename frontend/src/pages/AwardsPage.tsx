import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ShieldCheck, Lock, Sparkles, Dumbbell, RotateCcw, BookOpen } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { HERO_GRADIENT } from '../config/theme';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from '../components/LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_detail: string;
  tier: 'bronze' | 'silver' | 'gold' | 'mastery';
  progress: number; // 0-1
}
interface Certificate {
  certificate_number: string;
  track_title: string;
  category: string;
  issued_at: string;
}
interface Awards {
  badges: Badge[];
  certificates: Certificate[];
}
interface Stats { xp: number; level: number }

// Trading-flavored level titles — adapted from the reference training
// portal's "Level N · Title" hero pattern (its own titles are generic
// business ones like "Foundation"; these are renamed for a trading
// context). Highest threshold <= level wins.
const LEVEL_TITLES: [number, string][] = [
  [1, 'Recruit'], [3, 'Apprentice'], [5, 'Analyst'], [10, 'Strategist'],
  [15, 'Specialist'], [20, 'Veteran'], [25, 'Expert'], [35, 'Master'], [50, 'Elite Trader'],
];
function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0][1];
  for (const [threshold, label] of LEVEL_TITLES) {
    if (level >= threshold) title = label;
  }
  return title;
}

const TIER_STYLES: Record<Badge['tier'], { light: string; dark: string }> = {
  bronze: { light: 'bg-[#fdecd8] text-[#b45309]', dark: 'bg-[#b45309]/20 text-[#fbbf6a]' },
  silver: { light: 'bg-[#eef0f6] text-[#64748b]', dark: 'bg-white/10 text-white/70' },
  gold: { light: 'bg-[#fef3c7] text-[#b45309]', dark: 'bg-[#eab308]/20 text-[#facc15]' },
  mastery: { light: '', dark: '' }, // uses HERO_GRADIENT directly, not a flat tint
};
const TIER_LABEL: Record<Badge['tier'], string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', mastery: 'Mastery' };

type Filter = 'all' | 'unlocked' | 'locked';

/**
 * AwardsPage — the real page behind the Site Map's "Awards &
 * Certificates" link (/learn/awards). Badges (GET /curriculum/awards)
 * are computed live from real progress data (streak, level, per-
 * category and full-curriculum completion) — there's no seeded badge
 * catalogue that could drift out of sync with what a learner actually
 * did. Certificates are real stored rows, issued the moment a track's
 * last stage completes (see complete_stage() in curriculum.py) —
 * shown here as an in-app card, not a fabricated downloadable PDF this
 * app has no generation pipeline for.
 *
 * Hero (XP-to-next-level + badges-earned progress bars), tiered badge
 * icon styling, the "closest to unlocking" nudge section, and the
 * Unlocked/Locked/All filter are adapted from the reference training
 * portal's AchievementsView — same shape, backed by this app's own
 * /curriculum/awards + /curriculum/stats data rather than its
 * client-side progress store. New unlock toasts are handled globally
 * by BadgeUnlockWatcher (mounted in App.tsx), not on this page.
 */
export function AwardsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [data, setData] = useState<Awards | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetchJsonWithRetry<Awards>(`${API_URL}/curriculum/awards`, { headers }, setPhase)
      .then((d) => {
        if (d) setData(d);
        else setError('Could not load your awards right now.');
      });
    fetchJsonWithRetry<Stats>(`${API_URL}/curriculum/stats`, { headers }).then((s) => { if (s) setStats(s); });
  }, [token]);

  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-4 ${mutedCls}`;

  const unlocked = data ? data.badges.filter((b) => b.earned) : [];
  const visibleBadges = data
    ? data.badges.filter((b) => (filter === 'all' ? true : filter === 'unlocked' ? b.earned : !b.earned))
    : [];
  const closestToUnlock = data
    ? data.badges.filter((b) => !b.earned && b.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, 3)
    : [];
  const level = stats?.level ?? 1;
  const xpIntoLevel = stats ? stats.xp % 100 : 0;
  const badgePct = data && data.badges.length > 0 ? Math.round((unlocked.length / data.badges.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Awards & Certificates" subtitle="Badges earned and certificates issued on track completion." />

      {/* Hero progress strip — XP-to-next-level and badges-earned, the
          same two bars the reference training portal opens its
          Achievements view with, so "how close am I" is visible before
          scrolling to a single badge. */}
      {stats && data && (
        <div className="rounded-3xl p-6 mb-6 text-white" style={{ background: HERO_GRADIENT }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-75">Progress & Motivation</p>
          <h2 className="mt-1.5 text-xl md:text-2xl font-extrabold font-display">
            Level {level} · {levelTitle(level)}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold opacity-90 mb-1.5">
                <span>Experience to Level {level + 1}</span>
                <span>{xpIntoLevel} / 100 XP</span>
              </div>
              <div className="h-2 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${xpIntoLevel}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-semibold opacity-90 mb-1.5">
                <span>Badges earned</span>
                <span>{unlocked.length} / {data.badges.length}</span>
              </div>
              <div className="h-2 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${badgePct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-links into the rest of the learning loop — Practise
          Drills and Retention Review live under the separate Practise
          area (its own bottom-nav tab), by deliberate IA choice; these
          shortcuts keep them one click from Awards instead of requiring
          a trip through the Site Map, closing the "encourage learning"
          loop this page is part of. */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to="/learn/mastery" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'}`}>
          <BookOpen size={13} /> Mastery Overview
        </Link>
        <Link to="/practise/drills" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'}`}>
          <Dumbbell size={13} /> Practice Drills
        </Link>
        <Link to="/practise/review" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'}`}>
          <RotateCcw size={13} /> Retention Review
        </Link>
      </div>

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}
      {!data && !error && (
        (phase === 'loading' || phase === 'stalled')
          ? <div className="mb-4"><LoadingIndicator phase={phase} dark={dark} /></div>
          : <p className={`text-sm ${mutedCls}`}>Loading your awards…</p>
      )}

      {data && (
        <>
          {closestToUnlock.length > 0 && (
            <>
              <div className={titleCls}>Closest to unlocking</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {closestToUnlock.map((b) => (
                  <div key={b.id} className={`${cardCls} border-corporate-hero/30`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl">{b.icon}</span>
                      <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{b.title}</span>
                    </div>
                    <p className={`text-xs mb-2 ${mutedCls}`}>{b.description}</p>
                    <div className={`h-1.5 rounded-full overflow-hidden mb-1 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                      <div className="h-full rounded-full bg-corporate-hero" style={{ width: `${Math.round(b.progress * 100)}%` }} />
                    </div>
                    <p className={`text-[11px] font-semibold ${mutedCls}`}>{Math.round(b.progress * 100)}% there</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div className={titleCls.replace('mb-4', 'mb-0')}>Badges ({unlocked.length} of {data.badges.length} unlocked)</div>
            <div className={`inline-flex items-center gap-1 rounded-full border p-1 ${dark ? 'border-white/10 bg-white/5' : 'border-[#dcdce8] bg-white'}`}>
              {(['unlocked', 'locked', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${
                    filter === f
                      ? 'bg-corporate-hero text-white'
                      : dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {visibleBadges.map((b) => {
              const tierCls = b.tier === 'mastery' ? '' : (dark ? TIER_STYLES[b.tier].dark : TIER_STYLES[b.tier].light);
              return (
                <div key={b.id} className={`${cardCls} text-center ${b.earned ? '' : 'opacity-70'}`}>
                  <div
                    className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-2xl mb-2 ${b.earned ? tierCls : (dark ? 'bg-white/5 text-white/30' : 'bg-corporate-bg text-gray-300')}`}
                    style={b.earned && b.tier === 'mastery' ? { background: HERO_GRADIENT } : undefined}
                  >
                    {b.earned ? b.icon : <Lock size={16} />}
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${mutedCls}`}>{TIER_LABEL[b.tier]}</p>
                  <div className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{b.title}</div>
                  <p className={`text-xs mb-2 ${mutedCls}`}>{b.description}</p>
                  {b.earned ? (
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                      <Sparkles size={12} /> Earned
                    </div>
                  ) : (
                    <>
                      <div className={`h-1.5 rounded-full overflow-hidden mb-1 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                        <div className="h-full rounded-full bg-corporate-hero" style={{ width: `${Math.round(b.progress * 100)}%` }} />
                      </div>
                      <div className={`text-xs font-medium ${mutedCls}`}>{b.earned_detail}</div>
                    </>
                  )}
                </div>
              );
            })}
            {visibleBadges.length === 0 && (
              <p className={`text-sm col-span-full ${mutedCls}`}>No badges in this filter yet.</p>
            )}
          </div>

          <div className={titleCls}>Certificates ({data.certificates.length} issued)</div>
          {data.certificates.length === 0 ? (
            <p className={`text-sm ${mutedCls}`}>
              None yet — a certificate is issued the moment you complete every stage in a track.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.certificates.map((c) => (
                <div key={c.certificate_number} className={cardCls}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
                      <Award size={20} style={{ color: '#0284C7' }} />
                    </div>
                    <ShieldCheck size={16} className="text-emerald-500" />
                  </div>
                  <div className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{c.track_title}</div>
                  <div className={`text-xs mb-3 ${mutedCls}`}>
                    Issued {new Date(c.issued_at).toLocaleDateString()}
                  </div>
                  <div className={`text-[11px] font-mono px-2 py-1 rounded ${dark ? 'bg-white/5 text-white/50' : 'bg-corporate-bg text-gray-500'}`}>
                    {c.certificate_number}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
