import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';
import { FoldedCard } from './FoldedCard';

/**
 * RoleAdministrationPanel — promote/demote by email, adapted from the
 * reference training portal's own "Member email + New level + Apply"
 * flow. Backed by PATCH /admin/users/by-email/role (admin.py), which
 * enforces Super-Admin-only server-side (same require_super_admin +
 * seeded-account protection change_role already had) — this component
 * still renders for a plain Admin (read-only directory parity with the
 * existing "All Users" list below it on AdminConsolePage) but disables
 * the Apply button and says why, rather than letting a plain Admin
 * submit a request the backend will 403 anyway.
 *
 * "Strictly downward" copy below is descriptive, not a client-side
 * rule: this app's portal-hierarchy-superset design already guarantees
 * it structurally (see admin.py's own docstring on change_role_by_email).
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'trader', label: 'trader' },
  { value: 'partner', label: 'partner' },
  { value: 'fund_manager', label: 'fund_manager' },
  { value: 'admin', label: 'admin' },
  { value: 'super_admin', label: 'super_admin' },
];

export function RoleAdministrationPanel({ dark = true }: { dark?: boolean }) {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('partner');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function apply() {
    setStatus(null);
    setSubmitting(true);
    try {
      // 60s, not apiFetch's 20s default — same reasoning as
      // ManualTradingPage's order placement: a free-tier backend
      // waking from sleep regularly needs more than 20s for the FIRST
      // request, and this was aborting client-side before Render's
      // container even finished starting (confirmed directly: zero
      // server-side log entry for the request at all, not even a
      // failed one — it never arrived). Surfaced to the trader as a
      // bare "Failed to fetch" on Apply, same bug class the comment on
      // apiFetch itself already documents for other pages.
      const res = await apiFetch(`${API_BASE}/admin/users/by-email/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, new_role: newRole }),
        timeoutMs: 60_000,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not change that account\'s role');
      setStatus(`${body.email} is now ${body.role}.`);
      setEmail('');
    } catch (e: any) {
      setStatus(
        e.name === 'AbortError' || e.message === 'Failed to fetch'
          ? 'The server is waking up from sleep — this can take up to a minute on the first request. Please try Apply again.'
          : e.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = dark
    ? 'bg-smc-dark border-smc-border text-white placeholder:text-gray-600'
    : 'border-gray-200 text-corporate-text-on-bg';

  return (
    <FoldedCard title="Role Administration" icon={<UserCog size={19} />} dark={dark}>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <label className={`text-xs font-medium block mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Member email</label>
          <input
            value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="person@company.com"
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-corporate-accent ${inputClass}`}
          />
        </div>
        <div>
          <label className={`text-xs font-medium block mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>New level</label>
          <select
            value={newRole} onChange={(e) => setNewRole(e.target.value)}
            className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-corporate-accent ${inputClass}`}
          >
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={apply}
            disabled={!isSuperAdmin || !email || submitting}
            title={!isSuperAdmin ? 'Only the Super Admin can change roles' : undefined}
            className="bg-corporate-hero text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
      {status && <p className={`text-xs mt-3 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{status}</p>}
      <p className={`text-xs mt-3 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
        Levels are strictly downward: a promoted member gains their own workspace plus everything beneath it, never anything above.
        {!isSuperAdmin && ' Changing a role requires the Super Admin.'}
      </p>
    </FoldedCard>
  );
}
