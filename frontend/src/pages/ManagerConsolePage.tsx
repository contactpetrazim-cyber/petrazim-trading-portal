import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { TraderOversightPanel } from '../components/TraderOversightPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

/**
 * Fund Manager console — roster + access codes, same as
 * PartnerConsolePage, plus real per-trader oversight
 * (TraderOversightPanel) that Partner doesn't have: this is the
 * "Manager should have everything the investor has and more" ask.
 * Built on the ownership work that made Trade/BotConfig.user_id real
 * (bots.py's ownership gate now also lets a Manager/Partner edit a
 * bot belonging to a Trader on their own roster, not just view it).
 *
 * Nav ("how to get back and select portal of interest") comes from
 * CorporateLayout, which this page is mounted inside (App.tsx) —
 * TopNav's Settings panel already has "Switch Portal", and BottomNav
 * gets you back to any area. Both existed before this file; the gap
 * was this page never being wrapped in that shell at all.
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
          <p className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Manage your Traders, their risk, and corporate access seats.</p>
        </div>
        <RoleBadge user={user} />
      </div>

      <RosterPanel dark={dark} />
      <TraderOversightPanel dark={dark} />
      <AccessCodesPanel dark={dark} />
    </div>
  );
}
