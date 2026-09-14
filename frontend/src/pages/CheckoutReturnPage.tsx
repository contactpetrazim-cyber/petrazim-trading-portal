import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { CardLogoBand } from '../components/CardLogoBand';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { HERO_GRADIENT } from '../config/theme';

type Outcome = 'confirming' | 'granted' | 'not_yet';

/**
 * CheckoutReturnPage — where a trader lands after paying (real gateway
 * callback or the simulated test-checkout page). Access is granted by
 * the gateway's verified webhook server-side, never by this screen, so
 * the only honest thing to do here is poll the account's real
 * GET /payments/access-status until it flips — and say plainly when it
 * hasn't yet rather than claiming success.
 */
export function CheckoutReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { refresh, hasAccess, tier, expiresAt, phase } = useEntitlement({ auto: false });

  const [outcome, setOutcome] = useState<Outcome>('confirming');
  const [attempts, setAttempts] = useState(0);

  const reference = params.get('reference') ?? params.get('trxref') ?? null;

  const poll = useCallback(async () => {
    // Webhooks land within seconds, but a sleeping free-tier backend can
    // take longer — six spaced checks rather than one hopeful read.
    for (let i = 0; i < 6; i++) {
      setAttempts(i + 1);
      const status = await refresh();
      if (status?.has_active_access) { setOutcome('granted'); return; }
      await new Promise((r) => setTimeout(r, 2500 + i * 1500));
    }
    setOutcome('not_yet');
  }, [refresh]);

  useEffect(() => {
    if (!token) {
      navigate('/login?returnTo=/checkout/return', { replace: true });
      return;
    }
    void poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const card = `rounded-3xl p-8 max-w-md w-full text-center shadow-xl ${dark ? 'bg-corporate-surface-dark text-white' : 'bg-white text-[#141a33]'}`;

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 ${dark ? 'bg-smc-dark' : 'bg-corporate-bg'}`}>
      <section className={card}>
        <CardLogoBand dark={dark} />

        {outcome === 'confirming' && (
          <>
            <span className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
              <Clock size={28} style={{ color: '#0284C7' }} />
            </span>
            <h1 className="mb-3 font-display text-2xl font-extrabold">Confirming your payment</h1>
            <p className={`mb-5 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
              We are waiting for the payment provider to confirm. This usually takes a few seconds — check {attempts} of 6.
            </p>
            <div className="flex justify-center"><LoadingIndicator phase={phase === 'idle' ? 'loading' : phase} dark={dark} /></div>
          </>
        )}

        {outcome === 'granted' && (
          <>
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </span>
            <h1 className="mb-3 font-display text-2xl font-extrabold">You're in</h1>
            <p className={`mb-6 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
              {tier ? `${tier} access is active` : 'Your access is active'}
              {expiresAt ? ` until ${expiresAt.toLocaleString()}.` : '.'}
            </p>
            <Link to="/overview" className="block w-full rounded-xl py-3.5 font-semibold text-white" style={{ background: HERO_GRADIENT }}>
              Go to my dashboard
            </Link>
          </>
        )}

        {outcome === 'not_yet' && (
          <>
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <XCircle size={28} className="text-amber-500" />
            </span>
            <h1 className="mb-3 font-display text-2xl font-extrabold">Not confirmed yet</h1>
            <p className={`mb-6 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
              No access has been added to your account yet. If the payment went through, it can take a little longer to confirm — check again below.
              {reference && <> Keep this reference for support: <span className="font-mono">{reference}</span>.</>}
            </p>
            <button
              type="button"
              onClick={() => { setOutcome('confirming'); void poll(); }}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white"
              style={{ background: HERO_GRADIENT }}
            >
              <RefreshCw size={17} /> Check again
            </button>
            <Link to="/payments" className={`text-sm font-semibold ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>Back to access options</Link>
          </>
        )}

        {hasAccess && outcome === 'confirming' && null}
      </section>
    </main>
  );
}
