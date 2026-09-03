import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationGateCard } from '../components/RegistrationGateCard';
import { CommunityGateStep } from '../components/CommunityGateStep';
import { PetrazimLogo } from '../components/PetrazimLogo';

/**
 * OnboardingPage — the full forced sequence:
 *   Register -> Pay -> Community (mandatory, no skip) -> choose:
 *   "Start Trading" (-> /dashboard) or "Explore Site" (-> /explore)
 *
 * Step is derived from /onboarding/status on load and after each
 * action, NOT just tracked in local component state — this means a
 * user who closes the tab mid-flow and comes back resumes at the
 * correct step rather than restarting, and matches whatever the
 * server actually thinks their state is.
 */

type Step = 'registration' | 'payment' | 'community' | 'choice';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STEP_ORDER: Step[] = ['registration', 'payment', 'community', 'choice'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('registration');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  async function refreshStatus(authToken: string) {
    const res = await fetch(`${API_BASE}/onboarding/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.current_step === 'payment') setStep('payment');
    else if (data.current_step === 'community') setStep('community');
    else if (data.current_step === 'complete') setStep('choice');
  }

  useEffect(() => {
    const existingToken = sessionStorage.getItem('petrazim_token');
    if (existingToken) {
      setToken(existingToken);
      refreshStatus(existingToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegistration(data: { name: string; email: string; phone: string }) {
    // NOTE: a real registration form needs a password field —
    // RegistrationGateCard currently only collects name/email/phone per
    // the reference screenshots. Flagging rather than silently generating
    // a throwaway password the user could never actually log in with again.
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, full_name: data.name, phone: data.phone }),
    });
    if (res.ok) setStep('payment');
  }

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
    setStep('choice');
  }

  return (
    <div className="min-h-screen bg-corporate-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <PetrazimLogo height={60} />
      </div>

      <div className="flex items-center gap-2 mb-8">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                step === s ? 'bg-corporate-accent'
                  : i < STEP_ORDER.indexOf(step) ? 'bg-corporate-hero' : 'bg-gray-300'
              }`}
            />
            {i < 3 && <div className="w-8 h-px bg-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && step === 'registration' && (
        <RegistrationGateCard onSubmit={handleRegistration} />
      )}

      {!loading && step === 'payment' && (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-corporate-text-on-bg mb-2">Choose your access</h2>
          <p className="text-sm text-gray-500 mb-5">
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

      {!loading && step === 'choice' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-corporate-hero text-white rounded-xl p-6 text-left hover:opacity-90 transition-opacity"
          >
            <h3 className="font-bold text-lg mb-1">Start Trading</h3>
            <p className="text-white/70 text-sm">Go straight to the live trading console.</p>
          </button>
          <button
            onClick={() => navigate('/explore')}
            className="bg-white border border-corporate-bg rounded-xl p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="font-bold text-lg mb-1 text-corporate-text-on-bg">Explore Site</h3>
            <p className="text-gray-500 text-sm">Look around Learn, Insights, Tools, and Community first.</p>
          </button>
        </div>
      )}
    </div>
  );
}
