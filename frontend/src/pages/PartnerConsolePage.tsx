import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

/**
 * Partner console — same real content as the Manager console
 * (roster + access codes), since Partners sponsor Traders the same
 * way Fund Managers do. Referral/commission dashboard tied to the
 * payment system's partner_referral code type is still queued.
 *
 * No longer owns its own min-h-screen/bg wrapper — same fix as
 * MeetingsPage/SiteMapPage: fighting CorporateLayout's background left
 * this page (and the logo/nav it never had) stuck outside the shared
 * shell entirely. Now mounted inside CorporateLayout in App.tsx and
 * reads the same theme store, threaded into RosterPanel/AccessCodesPanel.
 */
export function PartnerConsolePage() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Partner Console</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Manage sponsored Traders and your issued access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel dark={dark} />
      <AccessCodesPanel dark={dark} />
    </div>
  );
}
