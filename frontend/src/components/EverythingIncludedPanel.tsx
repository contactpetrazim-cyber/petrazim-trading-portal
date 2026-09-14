import { Link } from 'react-router-dom';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import { AREA_ICONS, FEATURE_AREAS, FEATURE_REGISTRY } from '../config/featureRegistry';
import { PARTNER_TOOLS, FUND_MANAGER_TOOLS, ADMIN_TOOLS, TierTool } from '../config/portalTiers';
import { FoldedCard } from './FoldedCard';
import { HERO_GRADIENT } from '../config/theme';

/**
 * EverythingIncludedPanel — "Everything included at this level",
 * adapted from the reference training portal's own cascading-downward
 * capability panel. `tier` is the console this panel is mounted on;
 * every tier at or below it renders as its own labeled section, so a
 * Fund Manager sees Trader + Partner + Fund Manager tools, and Admin
 * sees all four groups — the same "portal carries every tool from the
 * levels beneath it" idea the reference states in its own copy, made
 * concrete against this app's real, existing feature set rather than
 * restated as a generic claim.
 *
 * Every row is now a real link to the page it names, by direct request
 * ("make every item ... a link that takes us to the page"): Trader
 * areas go to their area page, tier tools go to the route recorded on
 * each TierTool in config/portalTiers.ts.
 */

type ConsoleTier = 'partner' | 'fund_manager' | 'admin';

const TIER_ORDER: ConsoleTier[] = ['partner', 'fund_manager', 'admin'];

// Premium card treatment for this panel specifically — by direct
// request ("Make the cards ... premium looking"), scoped to
// "Everything included at this level" rather than a sweeping
// site-wide FoldedCard restyle (that primitive is shared by dozens of
// unrelated cards across Learn/Tools/Insights/Community/Explore, and
// a blind global change there is a much bigger, separate risk). A
// gradient-filled icon chip (the same HERO_GRADIENT the brand already
// uses for its primary CTAs and the dark-theme toggle, not a new
// color), a soft 1px ring that only appears on hover, and a touch
// more lift than the plain cards elsewhere in the app.
function ToolCardIcon({ Icon }: { Icon: TierTool['icon'] }) {
  return (
    <div
      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm"
      style={{ background: HERO_GRADIENT }}
    >
      <Icon size={15} />
    </div>
  );
}

function ToolGrid({ tools, dark }: { tools: TierTool[]; dark: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.title}
            to={t.route}
            className={`group flex items-start gap-3 rounded-xl p-3 border transition-all hover:-translate-y-0.5 ${
              dark
                ? 'bg-corporate-nav-dark border-white/5 hover:border-corporate-accent/40 hover:bg-white/5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
                : 'bg-corporate-bg border-transparent hover:border-corporate-accent/25 hover:bg-white hover:shadow-[0_8px_24px_rgba(15,45,110,0.10)]'
            }`}
          >
            <ToolCardIcon Icon={Icon} />
            <div className="min-w-0">
              <div className={`text-sm font-semibold flex items-center gap-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                {t.title}
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-70 transition-opacity" />
              </div>
              <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.description}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function EverythingIncludedPanel({
  tier, dark = false, defaultOpen = false,
}: { tier: ConsoleTier; dark?: boolean; defaultOpen?: boolean }) {
  const upTo = TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier) + 1);

  return (
    <FoldedCard
      title="Everything included at this level"
      summary="Access runs downward only: this portal carries every tool from the levels beneath it."
      icon={<LayoutGrid size={19} />}
      dark={dark}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-4">
        <div>
          <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Trader tools</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FEATURE_AREAS.map((area) => {
              const count = FEATURE_REGISTRY.filter((f) => f.area === area.id).length;
              const AreaIcon = AREA_ICONS[area.id];
              return (
                <Link
                  key={area.id}
                  to={`/${area.id}`}
                  className={`group flex items-start gap-3 rounded-xl p-3 border transition-all hover:-translate-y-0.5 ${
                    dark
                      ? 'bg-corporate-nav-dark border-white/5 hover:border-corporate-accent/40 hover:bg-white/5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
                      : 'bg-corporate-bg border-transparent hover:border-corporate-accent/25 hover:bg-white hover:shadow-[0_8px_24px_rgba(15,45,110,0.10)]'
                  }`}
                >
                  <ToolCardIcon Icon={AreaIcon} />
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold flex items-center gap-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                      {area.label}
                      <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-70 transition-opacity" />
                    </div>
                    <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{count} feature{count === 1 ? '' : 's'} — {area.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {upTo.includes('partner') && (
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Partner tools</h4>
            <ToolGrid tools={PARTNER_TOOLS} dark={dark} />
          </div>
        )}
        {upTo.includes('fund_manager') && (
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Fund Manager tools</h4>
            <ToolGrid tools={FUND_MANAGER_TOOLS} dark={dark} />
          </div>
        )}
        {upTo.includes('admin') && (
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Admin tools</h4>
            <ToolGrid tools={ADMIN_TOOLS} dark={dark} />
          </div>
        )}
      </div>
    </FoldedCard>
  );
}
