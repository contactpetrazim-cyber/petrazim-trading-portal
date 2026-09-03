import { useEffect, useState } from 'react';
import { RoleBadge } from '../components/RoleBadge';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  badge_color: string;
}

/**
 * Admin / Super Admin console. User list is visible to both Admin and
 * Super Admin; create/change-role/remove actions only render (and only
 * succeed server-side) for the seeded Super Admin — matches
 * require_super_admin() on the backend, not just require_role(ADMIN).
 */
export function AdminConsolePage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load users');
        setUsers(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-smc-dark text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isSuperAdmin ? 'Super Admin' : 'Admin'} Console
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Full account management — add, change role, or remove any user.'
              : 'Read-only user directory. Account changes require Super Admin.'}
          </p>
        </div>
        <RoleBadge user={user} />
      </div>

      <div className="bg-smc-card border border-smc-border rounded-xl p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">All Users</h2>

        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-smc-dark border border-smc-border rounded-lg"
              >
                <div>
                  <div className="font-medium text-sm">{u.full_name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: `${u.badge_color}1a`,
                      color: u.badge_color,
                      border: `1px solid ${u.badge_color}4d`,
                    }}
                  >
                    {u.role.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">{u.status}</span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-gray-500 text-sm">No users yet.</p>
            )}
          </div>
        )}

        {!isSuperAdmin && (
          <p className="text-xs text-amber-400/90 bg-amber-400/10 rounded-lg px-3 py-2 mt-4">
            Adding, changing, or removing accounts is limited to the Super
            Admin — this console shows the directory only.
          </p>
        )}
      </div>
    </div>
  );
}
