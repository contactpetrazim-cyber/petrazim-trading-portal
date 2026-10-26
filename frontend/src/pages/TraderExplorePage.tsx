import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { FEATURE_REGISTRY } from '../config/featureRegistry';
import { useThemeStore } from '../hooks/useTheme';

// Same 6 real, already-built Explore-area tools /explore itself lists
// (AreaPage.tsx filtering FEATURE_REGISTRY by area==='explore'), minus
// the 4 still-queued placeholder entries (coach/marketplace/white-
// label/signal-api) that have no real page behind them yet — by
// direct request, reordered so Time Machine/Trade Scanner/Day Trader
// Skill Chat (the three genuinely interactive tools) come first,
// ahead of the three read-only/reference ones (Congressional Trades/
// News Monitor/Day Trader Skill Pack).
const EXPLORE_HUB_ORDER = [
  'explore-time-machine',
  'explore-trade-scanner',
  'explore-day-trader-skill-chat',
  'explore-congress-trades',
  'explore-news-monitor',
  'explore-day-trader-skill',
];

/**
 * TraderExplorePage — "Explore" entry in the Trader console's own
 * dark-terminal sidebar (Layout.tsx), by direct request ("ADD THE
 * Following to a new 'Explore' page in the Trader Dashboard"). The
 * underlying 6 tools already exist and are already reachable at
 * /explore (AreaPage.tsx, area='explore') — this is a SEPARATE page,
 * not a route alias to that one, because /explore mounts inside
 * CorporateLayout (the site-wide v13 light/dark shell) while the
 * Trader console lives inside Layout.tsx's own distinct dark-terminal
 * shell; swapping shells mid-navigation for the exact same content
 * would be jarring. Same FoldedCard-per-feature pattern AreaPage
 * already uses, just reordered and scoped to the 6 real entries (the
 * 4 still-queued Explore placeholders have no page to link to yet and
 * are deliberately left off this console-specific list).
 */
export function TraderExplorePage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.trader === 'dark';
  const items = EXPLORE_HUB_ORDER
    .map((id) => FEATURE_REGISTRY.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => f != null);

  return (
    <div>
      <h2 className={`text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Explore</h2>
      <p className={`text-sm mb-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
        Extra tools and data sources beyond the core trading console.
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <FoldedCard key={item.id} title={item.label} summary={item.description} icon={<Compass size={19} />} dark={dark}>
            <Link
              to={item.route}
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-smc-accent' : 'text-corporate-hero'}`}
            >
              Open {item.label} →
            </Link>
          </FoldedCard>
        ))}
      </div>
    </div>
  );
}
