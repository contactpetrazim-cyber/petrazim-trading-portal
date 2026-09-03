import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import { FEATURE_AREAS } from '../config/featureRegistry';
import { StartHereCard } from '../components/StartHereCard';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

/**
 * CorporateHomePage — the reference's actual DashboardPage (Section 9
 * of the design handover): welcome-back hero above Start Here, then a
 * grid linking every BottomNav area. Lives at /home rather than
 * /dashboard on purpose — /dashboard is the real, already-live Trade
 * console (Layout + the dark signal panel), and redirecting every
 * Trader's post-login landing_route there is a backend-driven
 * decision (ROLE_LANDING_ROUTE) with real production consequences for
 * every existing account, not something to silently repoint in a
 * design-reconciliation pass. TopNav's logo links here when already
 * inside the corporate shell instead, matching the reference's own
 * "logo click -> dashboard view" behavior.
 *
 * Two deliberate departures from the literal reference, both in the
 * design handover's own spirit of not shipping fake affordances:
 * - No stats grid (mastery %, XP, streak) — the reference's numbers
 *   are illustrative placeholders; this app has no backend-tracked
 *   learner stats yet (Learn is a "still queued" area per
 *   MERGE_MANIFEST.md), and showing invented numbers as if they were
 *   this user's real progress would be dishonest UI, not a design
 *   variance.
 * - No separate "Explore ->" button — the nav grid immediately below
 *   already serves that exact purpose in this app, so a second button
 *   whose only job is scrolling to it is a decorative affordance the
 *   handover's Section 9 note about removing demo-only buttons argues
 *   against adding, not for.
 */
export function CorporateHomePage() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const firstName = user?.full_name?.split(' ')[0];

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

          <div className="flex flex-wrap gap-3">
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
        </div>
        <div className="absolute -right-10 -bottom-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
      </div>

      <StartHereCard />

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
