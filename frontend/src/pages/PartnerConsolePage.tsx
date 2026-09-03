import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Partner console — same real content as the Manager console
 * (roster + access codes), since Partners sponsor Traders the same
 * way Fund Managers do. Referral/commission dashboard tied to the
 * payment system's partner_referral code type is still queued.
 */
export function PartnerConsolePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-corporate-bg p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-text-on-bg">Partner Console</h1>
          <p className="text-sm text-gray-500 mt-1">Manage sponsored Traders and your issued access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel />
      <AccessCodesPanel />
    </div>
  );
}
