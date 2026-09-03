import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, TrendingUp, Award, Flame, LineChart } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import { FEATURE_AREAS } from '../config/featureRegistry';
import { StartHereCard } from '../components/StartHereCard';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * CorporateHomePage — the reference's actual DashboardPage (Section 9
 * of the design handover): welcome-back hero above Start Here, then a
 * stats grid, then a grid linking every BottomNav area. Lives at
 * /home rather than /dashboard on purpose — /dashboard is the real,
 * already-live Trade console (Layout + the dark signal panel), and
 * redirecting every Trader's post-login landing_route there is a
 * backend-driven decision (ROLE_LANDING_ROUTE) with real production
 * consequences for every existing account, not something to silently
 * repoint in a design-reconciliation pass. TopNav's logo links here
 * when already inside the corporate shell instead, matching the
 * reference's own "logo click -> dashboard view" behavior.
 *
 * The welcome hero and Start Here now share one HERO_GRADIENT card
 * (per your request) instead of two stacked ones — StartHereCard's
 * `embedded` prop drops its own background/padding/radial-glow chrome
 * so only the text and button underneath are reused, unchanged.
 *
 * Stats grid: real numbers, not the reference's illustrative
 * placeholders — every field genuinely defaults to 0 when there's no
 * data yet, per your instruction, and grows on its own as it
 * actually happens:
 * - Active bots: GET /bots/ (no auth required — bot configs are
 *   platform-wide, not per-user), live on this Render deploy today
 *   (currently 0 — none configured in production yet).
 * - Mastery / XP / streak: GET /auth/learning-stats, backed by real
 *   columns (UserLearningStats, StageCompletion) that already existed
 *   with no endpoint reading them — every one is 0 until the (still
 *   queued) Learn progression engine writes to them, at which point
 *   these numbers update on their own, no frontend change needed.
 *   Skipped entirely for a signed-out visitor, since there's no user
 *   to fetch stats for.
 */
export function CorporateHomePage() {
  const { user, token } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const firstName = user?.full_name?.split(' ')[0];

  const [botStats, setBotStats] = useState({ active: 0, total: 0 });
  const [learningStats, setLearningStats] = useState({ xp: 0, streak: 0, masteryPct: 0 });

  useEffect(() => {
    fetch(`${API_URL}/bots/`)
      .then((r) => (r.ok ? r.json() : []))
      .then((bots: { status: string }[]) => {
        setBotStats({ active: bots.filter((b) => b.status === 'active').length, total: bots.length });
      })
      .catch(() => setBotStats({ active: 0, total: 0 }));
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/auth/learning-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        setLearningStats({
          xp: s.xp,
          streak: s.current_streak_days,
          masteryPct: s.stages_total > 0 ? Math.round((s.stages_complete / s.stages_total) * 100) : 0,
        });
      })
      .catch(() => {});
  }, [token]);

  const stats = [
    { label: 'Overall mastery', value: `${learningStats.masteryPct}%`, icon: TrendingUp },
    { label: 'Experience', value: `${learningStats.xp} XP`, icon: Award },
    { label: 'Learning streak', value: `${learningStats.streak} days`, icon: Flame },
    { label: 'Active bots', value: `${botStats.active} / ${botStats.total}`, icon: LineChart },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-8 md:p-10 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <div className="relative z-10 max-w-2xl">
          <span className="text-white/60 text-xs font-bold tracking-[0.15em] mb-3 block">PROFESSIONAL TRADING PLATFORM</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 font-display">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome to Petrazim.'}
          </h1>
          <p className="text-white/80 text-[15px] leading-relaxed mb-6 max-w-xl">
            Five tested SMC trading bots, Monte Carlo-backed forecasting, and live facilitator coaching —
            with real risk controls and honest performance tracking built in.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              to="/learn"
              className="flex items-center gap-2 bg-white text-[#0f2547] font-semibold text-sm px-5 py-3 rounded-xl transition-transform hover:scale-[1.02]"
            >
              Continue Learning →
            </Link>
            <a
              href="#start-here"
              className="flex items-center gap-2 border border-white/30 text-white font-semibold text-sm px-5 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Compass size={16} /> Start Here
            </a>
          </div>

          <div className="pt-6 border-t border-white/15">
            <StartHereCard embedded />
          </div>
        </div>
        <div className="absolute -right-10 -bottom-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`}>
              <div className={`flex items-center gap-2 text-xs font-medium mb-1.5 ${dark ? 'text-white/40' : 'text-[#7c839c]'}`}>
                <Icon size={13} /> {s.label}
              </div>
              <div className="text-2xl font-extrabold font-display" style={{ color: dark ? '#fff' : '#005FB8' }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {FEATURE_AREAS.map((area) => (
          <Link
            key={area.id}
            to={`/${area.id}`}
            className={`rounded-2xl p-4 text-center text-sm font-semibold transition-all active:translate-y-0.5 active:shadow-none ${dark ? 'bg-corporate-surface-dark text-white' : 'bg-white text-corporate-text-on-bg'}`}
            style={{
              boxShadow: dark
                ? '0 4px 0 0 rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.3)'
                : '0 4px 0 0 #d5d9ea, 0 6px 14px rgba(15,45,110,0.10)',
            }}
          >
            {area.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
