import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Rocket, X } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface StepDef {
  title: string;
  description: string;
  /** Where "Go" sends you when this is the current step. */
  goTo: string;
}

// Petrazim's own real four steps — Register -> Pay -> Community -> Trade,
// the same sequence LoginPage/OnboardingPage/onboarding.py already
// enforce server-side (see OnboardingStatusResponse.current_step) —
// not a re-ordering of the reference screenshot's own steps (which had
// Community before Pay; Petrazim's real flow pays first).
const STEPS: StepDef[] = [
  {
    title: 'Register your details',
    description: 'Name, email, and a password — the account your progress and access are tied to.',
    goTo: '/login?mode=register',
  },
  {
    title: 'Select access & pay',
    description: 'Choose a tier or duration pass — secure checkout with Stripe or Paystack.',
    goTo: '/onboarding',
  },
  {
    title: 'Join the community',
    description: 'Telegram, where daily prompts and facilitator notes land.',
    goTo: '/onboarding',
  },
  {
    title: 'Begin trading & learning',
    description: 'Your Home dashboard, Learn tracks, and live signals — all unlocked.',
    goTo: '/learn',
  },
];

/**
 * ProgrammeStepsModal — "How the programme works," adapted from the
 * reference site's own step-wise onboarding overview (screenshot
 * supplied directly), by direct request: "adapt to Petrazim trading -
 * this loads after Start Here is clicked and leads you step wise ...
 * so you are not lost." Opens from StartHereCard instead of jumping
 * straight to /onboarding, so a first-time visitor sees the whole
 * sequence and exactly where they stand in it before committing to a
 * step, matching the reference's own checkmarks-so-far + a single
 * highlighted "Go" on whichever step is next.
 *
 * Progress is real, not illustrative: an anonymous visitor (no token)
 * always starts at step 1. A logged-in visitor's real progress comes
 * from GET /onboarding/status (has_paid_access / community_joined),
 * the exact same state OnboardingPage itself polls — this modal never
 * invents a step the backend doesn't actually think you're on.
 *
 * Self-contained global trigger (same pattern as AccessExpiredGate's
 * triggerAccessExpired): mounted once (CorporateLayout, alongside
 * FloatingTradeAI) so any entry point can open the exact same instance
 * instead of each caller owning its own open/close state and its own
 * <ProgrammeStepsModal>. By direct request ("Let the Start Here button
 * on the Home dashboard also trigger the How the programme works
 * [modal]") — the Home hero's own "Start Here" quick-link used to only
 * scroll to the StartHereCard section below; it now also opens this,
 * same as StartHereCard's "Begin registration" button already did.
 */
let globalSetOpen: ((open: boolean) => void) | null = null;
export function openProgrammeSteps() {
  globalSetOpen?.(true);
}

export function ProgrammeStepsModal() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    globalSetOpen = setOpen;
    return () => { globalSetOpen = null; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (!token) {
      setCurrentStep(0);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/onboarding/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) { setCurrentStep(0); return; }
        if (!s.has_paid_access) setCurrentStep(1);
        else if (!s.community_joined) setCurrentStep(2);
        else setCurrentStep(3);
      })
      .catch(() => setCurrentStep(0))
      .finally(() => setLoading(false));
  }, [open, token]);

  if (!open) return null;

  const onClose = () => setOpen(false);

  function handleGo() {
    const dest = STEPS[currentStep].goTo;
    onClose();
    navigate(dest);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-extrabold font-display text-corporate-text-on-bg mb-2">How the programme works</h2>
        <p className="text-sm text-gray-500 mb-6">
          Four steps from sign-up to live trading — access included at every tier.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading your progress…</p>
        ) : (
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <div
                  key={step.title}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                    done
                      ? 'bg-emerald-50 border-emerald-200'
                      : isCurrent
                        ? 'bg-blue-50 border-corporate-hero/40'
                        : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{ background: done ? '#059669' : isCurrent ? HERO_GRADIENT : '#c8cce0' }}
                  >
                    {done ? <Check size={20} /> : isCurrent ? <Rocket size={18} /> : <span className="text-sm font-bold">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-corporate-text-on-bg">
                      {i + 1}. {step.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
                  </div>
                  {isCurrent && (
                    <button
                      onClick={handleGo}
                      className="shrink-0 flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
                      style={{ background: HERO_GRADIENT }}
                    >
                      Go →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
