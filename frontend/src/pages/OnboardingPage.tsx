import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommunityGateStep } from '../components/CommunityGateStep';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

/**
 * OnboardingPage — the forced sequence after login/register:
 *   Pay -> Community (mandatory, no skip) -> Home dashboard.
 *
 * The step used to end on a "Start Trading" (-> /dashboard) vs
 * "Explore Site" (-> /explore) choice screen; by direct request
 * ("make the Home dashboard page the default page to land after ...
 * registration / pay"), completing the flow now lands straight on
 * /home instead — which already surfaces both trading and exploring
 * one tap away (its own area grid + Start Here card), so neither
 * destination is lost, only the extra intermediate screen.
 *
 * Used to have its own "registration" step (RegistrationGateCard) at
 * the front, but that form only ever collected name/email/phone with
 * no password field, while /auth/register requires one — it could
 * never actually succeed. Removed rather than half-fixed: LoginPage's
 * Register tab is the one real registration path now (it collects a
 * real password and logs the new account straight in), and it already
 * lands here with a session already established. So this page now
 * simply requires an existing session — no token means bounce to
 * /login, never a form that was silently broken.
 *
 * Token now comes from the real in-memory auth store (useAuth), not
 * sessionStorage — nothing in the app ever wrote to that key, so the
 * old sessionStorage read was always null and this page could never
 * actually resume a real session or start a real checkout.
 *
 * Step is derived from /onboarding/status on load and after each
 * action, NOT just tracked in local component state — this means a
 * user who closes the tab mid-flow and comes back resumes at the
 * correct step rather than restarting, and matches whatever the
 * server actually thinks their state is.
 */

type Step = 'payment' | 'community';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STEP_ORDER: Step[] = ['payment', 'community'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [step, setStep] = useState<Step>('payment');
  const [loading, setLoading] = useState(true);

  async function refreshStatus(authToken: string) {
    const res = await fetch(`${API_BASE}/onboarding/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.current_step === 'community') setStep('community');
    else if (data.current_step === 'complete') navigate('/home');
    else setStep('payment');
  }

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    refreshStatus(token).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleStartCheckout() {
    if (!token) return;
    const res = await fetch(`${API_BASE}/payments/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currency: 'USD', duration_pass_type: 'one_day' }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.checkout_url;
    }
  }

  function handleCommunityContinue() {
    navigate('/home');
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 ${dark ? 'bg-[#0a0e1a]' : 'bg-corporate-bg'}`}>
      <div className="mb-8">
        <PetrazimLogo height={60} />
      </div>

      <div className="flex items-center gap-2 mb-8">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                step === s ? 'bg-corporate-accent'
                  : i < STEP_ORDER.indexOf(step) ? 'bg-corporate-hero' : dark ? 'bg-white/15' : 'bg-gray-300'
              }`}
            />
            {i < STEP_ORDER.length - 1 && <div className={`w-8 h-px mx-1 ${dark ? 'bg-white/15' : 'bg-gray-300'}`} />}
          </div>
        ))}
      </div>

      {loading && <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</p>}

      {!loading && step === 'payment' && (
        <div className={`rounded-xl shadow-sm p-6 max-w-md w-full ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
          <h2 className={`text-xl font-bold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Choose your access</h2>
          <p className={`text-sm mb-5 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            See full pricing (Essential / Professional / Executive, and duration passes) on the next screen —
            this starts a secure checkout with Stripe or Paystack.
          </p>
          <button
            onClick={handleStartCheckout}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-corporate-accent text-white hover:opacity-90 transition-opacity"
          >
            Continue to payment
          </button>
        </div>
      )}

      {!loading && step === 'community' && (
        <CommunityGateStep apiBaseUrl={API_BASE} channel="individual" onContinue={handleCommunityContinue} />
      )}
    </div>
  );
}
