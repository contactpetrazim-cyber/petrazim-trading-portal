import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { PortalSelectionCard, PortalOption } from '../components/PortalSelectionCard';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { HERO_GRADIENT } from '../config/theme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Unified login — one page for all four roles, rebuilt to match
 * LoginCardStyleB from petrazim_preview_v13_FINAL.jsx (Section 12 of
 * the design handover names this "CHOSEN — this is the real login
 * card"; the previous version of this page predated that reference
 * and used the Trade console's dark smc-* theme instead, which never
 * matched). Same card anatomy as AccessExpiredGate: logo top-left
 * 32px, icon-in-circle, bold centered heading (Section 4 of the
 * handover) — full-page rather than an overlay, since this is a real
 * route, not a stacked demo card, so there's nothing beneath it to
 * dim.
 *
 * "Continue with Google" is now real (POST /auth/google, backend
 * verifies the ID token and finds-or-creates the user) rather than
 * the decorative button this page shipped without at first — see
 * GoogleSignInButton for how it stays invisible until a Client ID is
 * actually configured, instead of showing a button that would fail.
 *
 * Both login paths funnel through handlePostLogin: calls
 * GET /auth/available-portals — a role with more than one console
 * (Fund Manager, Partner, Admin, Super Admin) sees the real
 * PortalSelectionCard next; a Trader — who only ever has one option —
 * skips straight to their dashboard, same as the backend's own
 * needs_portal_selection() logic intends.
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portals, setPortals] = useState<PortalOption[] | null>(null);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

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

  async function handleSubmit(e: React.FormEvent) {
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

  if (portals) {
    return <PortalSelectionCard portals={portals} onSelect={(route) => navigate(route)} />;
  }

  return (
    <div className="min-h-screen bg-corporate-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="flex justify-start mb-6">
          <PetrazimLogo height={32} />
        </div>
        <div className="w-16 h-16 rounded-full bg-[#EAEAF4] flex items-center justify-center mx-auto mb-5">
          <LogIn size={26} style={{ color: '#005FB8' }} />
        </div>
        <h2 className="font-extrabold text-2xl text-[#141a33] mb-2 leading-tight">Welcome Back to Petrazim</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Sign in to reach your Trader, Fund Manager, Partner, or Admin console.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left mb-5">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-white text-[#141a33] border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm mb-2 outline-none focus:border-[#005FB8]"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white text-[#141a33] border border-blue-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#005FB8]"
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

        <GoogleSignInButton onSuccess={handlePostLogin} onError={setError} />

        <p className="text-xs text-gray-400 mt-4">
          Trader · Fund Manager · Partner · Admin — same login, routed automatically.
        </p>
      </div>
    </div>
  );
}
