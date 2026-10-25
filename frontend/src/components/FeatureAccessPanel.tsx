import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { adminFeatureAccessApi } from '../services/api';
import type { FeatureAccessGrantItem } from '../types';
import { FoldedCard } from './FoldedCard';

// Fixed to the one gated feature that exists today (the Day Trader
// Skill Chat) -- adminFeatureAccessApi/the backend's own endpoints are
// already generic per feature_key, so a second gated feature just adds
// another entry here rather than needing new plumbing.
const FEATURE_KEY = 'day_trader_skill_chat';
const FEATURE_LABEL = 'Day Trader Skill Chat';

/**
 * FeatureAccessPanel -- "Admin or invitee (set up in the Admin portal)"
 * gate, by direct request for the Day Trader Skill live-Claude page.
 * Mirrors RoleAdministrationPanel's own "email + action" shape, backed
 * by admin.py's feature-access endpoints (app.core.feature_access.
 * require_feature_access is the server-side half of this gate --
 * Admin/Super Admin always pass it regardless of what's granted here).
 */
export function FeatureAccessPanel({ dark = true }: { dark?: boolean }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [grants, setGrants] = useState<FeatureAccessGrantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    setLoading(true);
    adminFeatureAccessApi.list(FEATURE_KEY)
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function grant() {
    setStatus(null);
    setSubmitting(true);
    try {
      await adminFeatureAccessApi.grant(email, FEATURE_KEY);
      setStatus(`${email} can now use ${FEATURE_LABEL}.`);
      setEmail('');
      refresh();
    } catch (e: any) {
      setStatus(e?.response?.data?.detail || 'Could not grant access.');
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(grantId: string, grantEmail: string) {
    try {
      await adminFeatureAccessApi.revoke(grantId);
      setStatus(`Revoked ${grantEmail}'s access to ${FEATURE_LABEL}.`);
      refresh();
    } catch (e: any) {
      setStatus(e?.response?.data?.detail || 'Could not revoke access.');
    }
  }

  const inputClass = dark
    ? 'bg-smc-dark border-smc-border text-white placeholder:text-gray-600'
    : 'border-gray-200 text-corporate-text-on-bg';

  return (
    <FoldedCard title="Feature Access" icon={<KeyRound size={19} />} dark={dark}>
      <p className={`text-xs mb-3 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
        Admins and Super Admin always have access to every gated feature. Everyone else needs an explicit invite here.
        Currently gating: <strong>{FEATURE_LABEL}</strong> (a real, paid Claude call -- invited on purpose, not opt-in).
      </p>

      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="flex-1">
          <label className={`text-xs font-medium block mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Member email</label>
          <input
            value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="person@company.com"
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-corporate-accent ${inputClass}`}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={grant}
            disabled={!isSuperAdmin || !email || submitting}
            title={!isSuperAdmin ? 'Only the Super Admin can grant feature access' : undefined}
            className="bg-corporate-hero text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      </div>

      {status && <p className={`text-xs mb-3 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{status}</p>}

      {loading ? (
        <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Loading…</p>
      ) : grants.length === 0 ? (
        <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>No invited users yet -- only Admins/Super Admin can use this feature right now.</p>
      ) : (
        <div className="space-y-1.5">
          {grants.map((g) => (
            <div key={g.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${dark ? 'bg-smc-dark' : 'bg-gray-50'}`}>
              <span className={dark ? 'text-white' : 'text-corporate-text-on-bg'}>{g.email}</span>
              <button
                onClick={() => revoke(g.id, g.email)}
                disabled={!isSuperAdmin}
                title={!isSuperAdmin ? 'Only the Super Admin can revoke' : 'Revoke access'}
                className="text-gray-400 hover:text-red-400 disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </FoldedCard>
  );
}
