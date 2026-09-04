import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CardLogoBand } from '../components/CardLogoBand';
import { PortalSelectionCard, PortalOption } from '../components/PortalSelectionCard';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { HERO_GRADIENT } from '../config/theme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Mode = 'signin' | 'register';

const inputClass =
  'w-full bg-white text-[#141a33] border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm mb-2 outline-none focus:border-[#005FB8]';

/**
 * Unified login/register — one page for all four roles.
 *
 * Card anatomy is still the "important moment" family (Section 4 of
 * the design handover): icon-in-circle, bold centered heading, muted
 * subtext, soft-tinted input box, full-width gradient button. Two
 * deliberate departures from the handover's original spec, both by
 * direct request rather than drift:
 *   1. CardLogoBand replaces the old 32px top-left logo — see that
 *      component for why a full-width white band is safe here.
 *   2. A Sign In / Register segmented control now lives on this same
 *      card (the handover's "Style A," gradient-hero mockup, had this
 *      toggle but was explicitly not chosen; this adopts just the
 *      toggle onto the chosen "Style B" card, not the gradient hero).
 *
 * Register does NOT hand the new account its landing_route directly —
 * it deliberately routes into /onboarding instead, so a fresh signup
 * still goes through the mandatory Pay -> Community steps rather than
 * skipping them. /auth/register itself returns a profile with no
 * token, so registration chains an immediate /auth/login with the
 * same credentials to actually establish a session.
 */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portals, setPortals] = useState<PortalOption[] | null>(null);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handlePostLogin(data: { access_token: string; user: any }) {
    setAuth(data.access_token, data.user);

    const portalsRes = await fetch(`${API_URL}/auth/available-portals`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (portalsRes.ok) {
      const portalsData = await portalsRes.json();
      if (portalsData.needs_selection) {
        setPortals(portalsData.portals);
        return;
      }
    }
    navigate(data.user.landing_route);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Login failed');
      }
      await handlePostLogin(await res.json());
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone: phone || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error('An account with this email already exists — sign in instead.');
        throw new Error(body.detail || 'Registration failed');
      }

      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) throw new Error('Account created — please sign in.');
      const loginData = await loginRes.json();
      setAuth(loginData.access_token, loginData.user);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (portals) {
    return <PortalSelectionCard portals={portals} onSelect={(route) => navigate(route)} />;
  }

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-screen bg-corporate-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <CardLogoBand />

        <div className="flex bg-[#EAEAF4] rounded-full p-1 mb-6">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 py-2 rounded-full text-xs font-bold tracking-wide transition-colors ${
              isSignIn ? 'text-white' : 'text-[#7c839c]'
            }`}
            style={isSignIn ? { background: HERO_GRADIENT } : undefined}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-full text-xs font-bold tracking-wide transition-colors ${
              !isSignIn ? 'text-white' : 'text-[#7c839c]'
            }`}
            style={!isSignIn ? { background: HERO_GRADIENT } : undefined}
          >
            REGISTER
          </button>
        </div>

        <div className="w-16 h-16 rounded-full bg-[#EAEAF4] flex items-center justify-center mx-auto mb-5">
          {isSignIn ? (
            <LogIn size={26} style={{ color: '#005FB8' }} />
          ) : (
            <UserPlus size={26} style={{ color: '#005FB8' }} />
          )}
        </div>

        <h2 className="font-extrabold text-2xl text-[#141a33] mb-2 leading-tight">
          {isSignIn ? 'Welcome Back to Petrazim' : 'Create Your Petrazim Account'}
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {isSignIn
            ? 'Sign in to reach your Trader, Fund Manager, Partner, or Admin console.'
            : 'Register to start your journey — Register, Pay, Join the Community, then Trade.'}
        </p>

        {isSignIn ? (
          <form onSubmit={handleSignIn}>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left mb-5">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={inputClass}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`${inputClass} mb-0`}
              />
            </div>

            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl mb-3 transition-opacity disabled:opacity-60"
              style={{ background: HERO_GRADIENT }}
            >
              <LogIn size={17} /> {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left mb-5">
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={inputClass}
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className={inputClass}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 characters)"
                className={inputClass}
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={`${inputClass} mb-0`}
              />
            </div>

            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl mb-3 transition-opacity disabled:opacity-60"
              style={{ background: HERO_GRADIENT }}
            >
              <UserPlus size={17} /> {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="flex items-center gap-3 mb-3">
          <span className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        <GoogleSignInButton onSuccess={handlePostLogin} onError={setError} />

        <p className="text-xs text-gray-400 mt-4">
          Trader · Fund Manager · Partner · Admin — same login, routed automatically.
        </p>
      </div>
    </div>
  );
}
