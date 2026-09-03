import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Fund Manager console — now with real content. The scaffold from
 * Phase 1 said "coming in a later phase" for managed accounts and
 * reporting; roster management and access codes are that phase,
 * landing now. Performance reporting per client is still queued.
 */
export function ManagerConsolePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-corporate-bg p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-text-on-bg">Fund Manager Console</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your Traders and corporate access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel />
      <AccessCodesPanel />
    </div>
  );
}
