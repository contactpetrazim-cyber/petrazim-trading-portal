import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { FEATURE_AREAS, FEATURE_REGISTRY } from '../config/featureRegistry';
import { PARTNER_TOOLS, FUND_MANAGER_TOOLS, ADMIN_TOOLS, TierTool } from '../config/portalTiers';

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

function ToolGrid({ tools, dark }: { tools: TierTool[]; dark: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.title}
            to={t.route}
            className={`group flex items-start gap-3 rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${dark ? 'bg-corporate-nav-dark hover:bg-white/5' : 'bg-corporate-bg hover:bg-white'}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${dark ? 'bg-corporate-accent/20 text-corporate-accent' : 'bg-corporate-accent/10 text-corporate-accent'}`}>
              <Icon size={15} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-medium flex items-center gap-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                {t.title}
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.description}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function EverythingIncludedPanel({ tier, dark = false }: { tier: ConsoleTier; dark?: boolean }) {
  const upTo = TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier) + 1);
  const cardClass = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div className={cardClass}>
      <h3 className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Everything included at this level</h3>
      <p className={`text-xs mb-4 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
        Access runs downward only: this portal carries every tool from the levels beneath it. Select anything below to open it.
      </p>

      <div className="space-y-4">
        <div>
          <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Trader tools</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FEATURE_AREAS.map((area) => {
              const count = FEATURE_REGISTRY.filter((f) => f.area === area.id).length;
              return (
                <Link
                  key={area.id}
                  to={`/${area.id}`}
                  className={`group rounded-lg p-3 block transition-all hover:-translate-y-0.5 hover:shadow-md ${dark ? 'bg-corporate-nav-dark hover:bg-white/5' : 'bg-corporate-bg hover:bg-white'}`}
                >
                  <div className={`text-sm font-medium flex items-center gap-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                    {area.label}
                    <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                  <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{count} feature{count === 1 ? '' : 's'} — {area.description}</div>
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
    </div>
  );
}
