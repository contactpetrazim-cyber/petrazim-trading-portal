import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { TraderOversightPanel } from '../components/TraderOversightPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Fund Manager console — roster + access codes, same as
 * PartnerConsolePage, plus real per-trader oversight
 * (TraderOversightPanel) that Partner doesn't have: this is the
 * "Manager should have everything the investor has and more" ask.
 * Built on the ownership work that made Trade/BotConfig.user_id real
 * (bots.py's ownership gate now also lets a Manager/Partner edit a
 * bot belonging to a Trader on their own roster, not just view it).
 *
 * Mounted inside the same dark Layout (App.tsx) the Trader console
 * itself uses, with the same heading formatting DashboardPage.tsx
 * uses — "let every portal follow the style and formatting and
 * colour theme of the trader dashboard" means literally this shell.
 * Nav ("how to get back and select portal of interest") comes from
 * Layout's own settings gear, which opens the same SettingsPanel
 * (Switch Portal, etc.) the corporate shell uses.
 */
export function ManagerConsolePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fund Manager Console</h2>
          <p className="text-gray-400 text-sm mt-1">Manage your Traders, their risk, and corporate access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel />
      <TraderOversightPanel />
      <AccessCodesPanel />
    </div>
  );
}
