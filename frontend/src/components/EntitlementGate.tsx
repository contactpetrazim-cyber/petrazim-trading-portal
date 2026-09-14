import { Link } from 'react-router-dom';
import { Lock, Sparkles, Ticket } from 'lucide-react';
import { useEntitlement } from '../hooks/useEntitlement';
import { useThemeStore } from '../hooks/useTheme';
import { HERO_GRADIENT } from '../config/theme';
import { LoadingIndicator } from './LoadingIndicator';

/**
 * EntitlementGate — Phase 3. Wraps a premium screen and, when the
 * backend says this account has no active access, shows the upgrade
 * card instead of the screen.
 *
 * Two deliberate rules:
 *  - Fail OPEN while the answer is unknown (cold start, network
 *    hiccup, or a backend build without the payments router). Locking
 *    a paying trader out of Manual Trading because a wake-up request
 *    timed out would be worse than briefly showing a page the server
 *    will refuse anyway — every underlying request is still gated
 *    server-side, and a 402 raises AccessExpiredGate.
 *  - Staff (Partner, Fund Manager, Admin, Super Admin) always pass:
 *    they need to see exactly what their traders see.
 */
export function EntitlementGate({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const { hasAccess, unknown, loading, phase, isStaff } = useEntitlement();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  if (hasAccess || isStaff || unknown) {
    return (
      <>
        {unknown && loading && (
          <div className="mb-3">
            <LoadingIndicator phase={phase} dark={dark} />
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl p-7 mb-5 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <span className="text-white/60 text-xs font-bold tracking-[0.15em] mb-2 block">PETRAZIM PREMIUM</span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white font-display">{feature} needs active access</h1>
        <p className="text-white/75 text-sm mt-2">
          Your learning progress, notes and settings are all safe. Choose a duration pass or a tier to open this again.
        </p>
      </div>

      <div className={`rounded-2xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-[#dcdce8] text-corporate-text-on-bg'}`}>
        <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
          <Lock size={22} style={{ color: '#005FB8' }} />
        </span>
        <ul className={`space-y-2 text-sm mb-6 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
          <li className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: '#059669' }} /> Live trading workspace, bots and risk controls</li>
          <li className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: '#059669' }} /> Premium dashboard, analytics and market intelligence</li>
          <li className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: '#059669' }} /> Order-flow tools and the full learning library</li>
        </ul>
        <Link
          to="/payments"
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white"
          style={{ background: HERO_GRADIENT }}
        >
          <Ticket size={17} /> See access options
        </Link>
        <p className={`mt-3 text-center text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          Already have a promo, referral or corporate seat code? Redeem it on the same page.
        </p>
      </div>
    </div>
  );
}
