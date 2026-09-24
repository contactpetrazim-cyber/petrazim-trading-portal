import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AllUsersCard } from '../components/AllUsersCard';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { TraderOversightPanel } from '../components/TraderOversightPanel';
import { LearningDashboardPanel } from '../components/LearningDashboardPanel';
import { EverythingIncludedPanel } from '../components/EverythingIncludedPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { PremiumOverviewCard } from '../components/PremiumOverviewCard';
import { HERO_GRADIENT } from '../config/theme';

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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl p-6 text-white shadow-lg" style={{ background: HERO_GRADIENT }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Petrazim Fund Manager Portal</div>
            <h1 className="text-2xl font-bold mt-1">Fund Manager Console</h1>
            <p className="text-sm text-white/70 mt-1">Manage your Traders, their risk, and corporate access seats.</p>
          </div>
          <RoleBadge user={user} />
        </div>
      </div>

      <PremiumOverviewCard />

      <LearningDashboardPanel dark={dark} />
      <RosterPanel dark={dark} />
      <AllUsersCard dark={dark} />
      <TraderOversightPanel dark={dark} />
      <AccessCodesPanel dark={dark} />
      <EverythingIncludedPanel tier="fund_manager" dark={dark} />
    </div>
  );
}
