import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

/**
 * Fund Manager console — roster + access codes are real. Per-trader
 * oversight (emotions, risk, trade amounts) is still queued — it
 * needs Trade/BotConfig to carry a user_id first (they currently
 * don't; dashboard/trades/bots have no per-user scoping at all), so
 * "which trader placed this trade" isn't answerable yet. Not
 * something to bolt on here without that foundation underneath it.
 *
 * No longer owns its own min-h-screen/bg wrapper — same fix as
 * PartnerConsolePage/MeetingsPage/SiteMapPage: fighting
 * CorporateLayout's background left this page (and the logo/nav it
 * never had) stuck outside the shared shell entirely. Now mounted
 * inside CorporateLayout in App.tsx and reads the same theme store,
 * threaded into RosterPanel/AccessCodesPanel.
 */
export function ManagerConsolePage() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Fund Manager Console</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Manage your Traders and corporate access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel dark={dark} />
      <AccessCodesPanel dark={dark} />
    </div>
  );
}
