import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RosterEntry {
  trader_user_id: string;
  full_name: string;
  email: string;
  status: string;
  assigned_at: string;
}

/**
 * AllUsersCard — a plain, read-only "All Users" list for the Manager
 * and Partner consoles, by direct request ("Add 'All Users' Card to
 * the Admin, MGR Portal, for the Partner and others - all users
 * specific to them"). Admin's own AdminConsolePage already has this
 * exact card (fetches every user); Manager/Partner had no equivalent
 * — RosterPanel covers the same underlying data but is an invite/
 * assign/detach TOOL, not a quick browse-all view, by direct
 * follow-up clarification ("a simple read-only user list/table,
 * separate from RosterPanel").
 *
 * Deliberately reuses GET /roster rather than a new endpoint — it's
 * already scoped correctly server-side (a Manager/Partner only ever
 * gets their own assigned Traders back, same as RosterPanel's own
 * fetch), so "all users specific to them" is already exactly what
 * this returns with zero backend changes needed. Every row here is a
 * Trader (the only role a roster ever contains) — no role badge
 * needed the way Admin's version has one, since there's nothing to
 * distinguish.
 */
export function AllUsersCard({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/roster`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load users'))))
      .then(setRoster)
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <FoldedCard title="All Users" icon={<Users size={19} />} dark={dark}>
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && (
        <div className="space-y-2">
          {roster.map((u) => (
            <div
              key={u.trader_user_id}
              className={`flex items-center justify-between p-3 border rounded-lg ${dark ? 'bg-smc-dark border-smc-border' : 'bg-gray-50 border-corporate-bg'}`}
            >
              <div>
                <div className={`font-medium text-sm ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{u.full_name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <span className="text-xs text-gray-500">{u.status}</span>
            </div>
          ))}
          {roster.length === 0 && (
            <p className="text-gray-500 text-sm">No users on your roster yet.</p>
          )}
        </div>
      )}
    </FoldedCard>
  );
}
