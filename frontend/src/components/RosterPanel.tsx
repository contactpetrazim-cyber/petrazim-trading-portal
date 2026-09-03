import { useEffect, useState } from 'react';
import { UserPlus, Trash2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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
 * ManagerConsolePage and PartnerConsolePage — same component, backend
 * scopes the data per the caller's role automatically (see roster.py:
 * Admin sees everyone, Manager/Partner see only their own roster).
 *
 * Styled to the trader dashboard's own smc-* palette, not a
 * corporate-dark lookalike — both consoles now mount inside the same
 * Layout the Trader console uses (see App.tsx), so this needed to
 * match it exactly, not just approximate it. The invite modal stays
 * plain white on purpose — every "decision moment" card in this app
 * does (AccessExpiredGate, LoginCardStyleB, PortalSelectionCard,
 * FacilitatorCalendar's booking modal).
 */
export function RosterPanel() {
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
    <div className="bg-smc-card border border-smc-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Roster</h3>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-smc-accent px-3 py-1.5 rounded-lg hover:bg-smc-accent/90 transition-colors"
        >
          <UserPlus size={14} /> Invite Trader
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-gray-400">No traders on your roster yet.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.trader_user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <div className="text-sm font-medium">{r.full_name}</div>
                <div className="text-xs text-gray-400">{r.email} · {r.status}</div>
              </div>
              <button onClick={() => detach(r.trader_user_id)} className="text-gray-400 hover:text-smc-danger transition-colors">
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 text-corporate-text-on-bg outline-none focus:border-smc-accent" />
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 text-corporate-text-on-bg outline-none focus:border-smc-accent" />
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <button
                  onClick={submitInvite}
                  disabled={!inviteEmail || !inviteName}
                  className="w-full bg-smc-accent text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
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
                <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm text-center mb-4">
                  {inviteResult.temporary_password}
                </div>
                <button onClick={closeInvite} className="w-full bg-smc-accent text-white font-medium py-2.5 rounded-lg text-sm">
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
