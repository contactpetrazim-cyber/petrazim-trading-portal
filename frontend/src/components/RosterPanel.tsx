import { useEffect, useState } from 'react';
import { UserPlus, Trash2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * RosterPanel — invite/assign/detach Traders. Mounted on
 * ManagerConsolePage, PartnerConsolePage, and AdminConsolePage — same
 * component, backend scopes the data per the caller's role
 * automatically (see roster.py: Admin sees everyone, Manager/Partner
 * see only their own roster). `dark` follows the same prop-driven
 * pattern as ConnectorCards/FacilitatorCalendar — the invite modal
 * itself stays plain white on purpose, matching every other
 * "decision moment" card in this app (AccessExpiredGate, LoginCardStyleB,
 * PortalSelectionCard, FacilitatorCalendar's booking modal).
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

interface RosterEntry {
  trader_user_id: string;
  full_name: string;
  email: string;
  status: string;
  assigned_at: string;
}

/**
 * RosterPanel — invite/assign/detach Traders. Mounted on
 * ManagerConsolePage, PartnerConsolePage, and AdminConsolePage — same
 * component, backend scopes the data per the caller's role
 * automatically (see roster.py: Admin sees everyone, Manager/Partner
 * see only their own roster).
 */
export function RosterPanel({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteResult, setInviteResult] = useState<{ email: string; temporary_password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRoster() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/roster`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRoster(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoster(); }, []);

  async function submitInvite() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/roster/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invite failed');
      }
      const data = await res.json();
      setInviteResult(data);
      loadRoster();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function detach(traderId: string) {
    await fetch(`${API_BASE}/roster/assign/${traderId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadRoster();
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteEmail('');
    setInviteName('');
    setInviteResult(null);
    setError(null);
  }

  return (
    <div className={`rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Roster</h3>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-corporate-hero px-3 py-1.5 rounded-lg"
        >
          <UserPlus size={14} /> Invite Trader
        </button>
      </div>

      {loading ? (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</p>
      ) : roster.length === 0 ? (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>No traders on your roster yet.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.trader_user_id} className={`flex items-center justify-between p-3 rounded-lg ${dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg'}`}>
              <div>
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{r.full_name}</div>
                <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>{r.email} · {r.status}</div>
              </div>
              <button onClick={() => detach(r.trader_user_id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeInvite}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-corporate-text-on-bg">Invite a Trader</h3>
              <button onClick={closeInvite}><X size={18} className="text-gray-400" /></button>
            </div>

            {!inviteResult ? (
              <>
                <label className="text-xs font-medium text-gray-500 block mb-1">Full name</label>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 text-corporate-text-on-bg outline-none focus:border-corporate-accent" />
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 text-corporate-text-on-bg outline-none focus:border-corporate-accent" />
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <button
                  onClick={submitInvite}
                  disabled={!inviteEmail || !inviteName}
                  className="w-full bg-corporate-accent text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
                >
                  Send invite
                </button>
              </>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Trader account created for <b>{inviteResult.email}</b>. Share this one-time password —
                  it won't be shown again:
                </p>
                <div className="bg-corporate-bg rounded-lg p-3 font-mono text-sm text-center mb-4">
                  {inviteResult.temporary_password}
                </div>
                <button onClick={closeInvite} className="w-full bg-corporate-hero text-white font-medium py-2.5 rounded-lg text-sm">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
