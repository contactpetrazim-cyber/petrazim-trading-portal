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
 */

type ConsoleTier = 'partner' | 'fund_manager' | 'admin';

const TIER_ORDER: ConsoleTier[] = ['partner', 'fund_manager', 'admin'];

function ToolGrid({ tools, dark }: { tools: TierTool[]; dark: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.title} className={`flex items-start gap-3 rounded-lg p-3 ${dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${dark ? 'bg-corporate-accent/20 text-corporate-accent' : 'bg-corporate-accent/10 text-corporate-accent'}`}>
              <Icon size={15} />
            </div>
            <div>
              <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.title}</div>
              <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{t.description}</div>
            </div>
          </div>
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
        Access runs downward only: this portal carries every tool from the levels beneath it.
      </p>

      <div className="space-y-4">
        <div>
          <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Trader tools</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FEATURE_AREAS.map((area) => {
              const count = FEATURE_REGISTRY.filter((f) => f.area === area.id).length;
              return (
                <div key={area.id} className={`rounded-lg p-3 ${dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg'}`}>
                  <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{area.label}</div>
                  <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{count} feature{count === 1 ? '' : 's'} — {area.description}</div>
                </div>
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
