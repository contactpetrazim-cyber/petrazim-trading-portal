import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { CardLogoBand } from '../components/CardLogoBand';
import { PortalSelectionCard, PortalOption } from '../components/PortalSelectionCard';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { HERO_GRADIENT } from '../config/theme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Mode = 'signin' | 'register';

function inputClass(dark: boolean) {
  return `w-full rounded-xl px-3.5 py-2.5 text-sm mb-2 outline-none transition-colors ${
    dark
      ? 'bg-corporate-surface-dark border border-corporate-border-dark text-white placeholder:text-white/40 focus:border-[#005FB8]'
      : 'bg-white border border-blue-100 text-[#141a33] placeholder:text-gray-400 focus:border-[#005FB8]'
  }`;
}

/**
 * Unified login/register — one page for all four roles.
 *
 * Card anatomy is still the "important moment" family (Section 4 of
 * the design handover): icon-in-circle, bold centered heading, muted
 * subtext, soft-tinted input box, full-width gradient button. Three
 * deliberate departures from the handover's original spec, all by
 * direct request rather than drift:
 *   1. CardLogoBand replaces the old 32px top-left logo — see that
 *      component for why a full-width white band is safe here.
 *   2. A Sign In / Register segmented control now lives on this same
 *      card (the handover's "Style A," gradient-hero mockup, had this
 *      toggle but was explicitly not chosen; this adopts just the
 *      toggle onto the chosen "Style B" card, not the gradient hero).
 *   3. Follows the site-wide light/dark toggle (useThemeStore) — the
 *      handover's card family was always plain white regardless of
 *      theme; that's now a superseded default here, default remaining
 *      light. AccessExpiredGate and PortalSelectionCard get the same
 *      treatment for the same reason: they share this exact anatomy.
 *
 * Register does NOT hand the new account its landing_route directly —
 * it deliberately routes into /onboarding instead, so a fresh signup
 * still goes through the mandatory Pay -> Community steps rather than
 * skipping them. /auth/register itself returns a profile with no
 * token, so registration chains an immediate /auth/login with the
 * same credentials to actually establish a session.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  // ?mode=register — ProgrammeStepsModal's step-1 "Go" lands straight
  // on the Register tab instead of Sign In, by direct request.
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'register' ? 'register' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portals, setPortals] = useState<PortalOption[] | null>(null);
  const { setAuth } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
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
    <div className={`min-h-screen flex items-center justify-center p-4 ${dark ? 'bg-[#0a0e1a]' : 'bg-corporate-bg'}`}>
      <div
        className={`rounded-3xl p-8 max-w-md w-full text-center shadow-2xl ${
          dark ? 'bg-corporate-surface-dark' : 'bg-white'
        }`}
      >
        <CardLogoBand dark={dark} />

        <div className={`flex rounded-full p-1 mb-6 ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 py-2 rounded-full text-xs font-bold tracking-wide transition-colors ${
              isSignIn ? 'text-white' : dark ? 'text-white/50' : 'text-[#7c839c]'
            }`}
            style={isSignIn ? { background: HERO_GRADIENT } : undefined}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-full text-xs font-bold tracking-wide transition-colors ${
              !isSignIn ? 'text-white' : dark ? 'text-white/50' : 'text-[#7c839c]'
            }`}
            style={!isSignIn ? { background: HERO_GRADIENT } : undefined}
          >
            REGISTER
          </button>
        </div>

        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            dark ? 'bg-white/10' : 'bg-[#EAEAF4]'
          }`}
        >
          {isSignIn ? (
            <LogIn size={26} style={{ color: '#005FB8' }} />
          ) : (
            <UserPlus size={26} style={{ color: '#005FB8' }} />
          )}
        </div>

        <h2 className={`font-extrabold text-2xl mb-2 leading-tight ${dark ? 'text-white' : 'text-[#141a33]'}`}>
          {isSignIn ? 'Welcome Back to Petrazim' : 'Create Your Petrazim Account'}
        </h2>
        <p className={`text-sm mb-6 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          {isSignIn
            ? 'Sign in to reach your Trader, Fund Manager, Partner, or Admin console.'
            : 'Register to start your journey — Register, Pay, Join the Community, then Trade.'}
        </p>

        {isSignIn ? (
          <form onSubmit={handleSignIn}>
            <div
              className={`rounded-2xl p-4 text-left mb-5 border ${
                dark ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'
              }`}
            >
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={inputClass(dark)}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`${inputClass(dark)} mb-0`}
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
            <div
              className={`rounded-2xl p-4 text-left mb-5 border ${
                dark ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'
              }`}
            >
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className={inputClass(dark)}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={inputClass(dark)}
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                className={inputClass(dark)}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 characters)"
                className={inputClass(dark)}
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={`${inputClass(dark)} mb-0`}
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
          <span className={`flex-1 h-px ${dark ? 'bg-white/10' : 'bg-gray-200'}`} />
          <span className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>or</span>
          <span className={`flex-1 h-px ${dark ? 'bg-white/10' : 'bg-gray-200'}`} />
        </div>

        <GoogleSignInButton onSuccess={handlePostLogin} onError={setError} dark={dark} />

        <p className={`text-xs mt-4 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          Trader · Fund Manager · Partner · Admin — same login, routed automatically.
        </p>
      </div>
    </div>
  );
}
