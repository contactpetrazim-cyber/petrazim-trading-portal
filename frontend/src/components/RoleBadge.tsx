import { AuthUser } from '../hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  trader: 'Trader',
  fund_manager: 'Fund Manager',
  partner: 'Partner',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

/**
 * RoleBadge — the "role watermark" spec item. Small colored pill shown
 * in the header on every console, using the same badge_color the
 * backend returns (single source of truth — see
 * app/models/user.py: ROLE_BADGE_COLOR) so frontend and backend can
 * never drift out of sync on which color means which role.
 */
export function RoleBadge({ user }: { user: AuthUser }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: `${user.badge_color}1a`, // ~10% opacity fill
        color: user.badge_color,
        border: `1px solid ${user.badge_color}4d`, // ~30% opacity border
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: user.badge_color }} />
      {ROLE_LABELS[user.role] || user.role}
    </span>
  );
}
