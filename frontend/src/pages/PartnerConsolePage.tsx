import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Partner console — same real content as the Manager console
 * (roster + access codes), since Partners sponsor Traders the same
 * way Fund Managers do. Referral/commission dashboard tied to the
 * payment system's partner_referral code type is still queued.
 *
 * Mounted inside the same dark Layout (App.tsx) the Trader console
 * itself uses, with the same heading formatting DashboardPage.tsx
 * uses — "let every portal follow the style and formatting and
 * colour theme of the trader dashboard" means literally this shell,
 * not a from-scratch lookalike.
 */
export function PartnerConsolePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Partner Console</h2>
          <p className="text-gray-400 text-sm mt-1">Manage sponsored Traders and your issued access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel />
      <AccessCodesPanel />
    </div>
  );
}
