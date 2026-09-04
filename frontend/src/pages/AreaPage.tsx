import { Link } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { ChartPanel } from '../components/ChartPanel';
import { FEATURE_AREAS, FEATURE_REGISTRY, AREA_ICONS, FeatureArea } from '../config/featureRegistry';
import { useThemeStore } from '../hooks/useTheme';

/**
 * AreaPage — the shared landing page for 7 of the 8 BottomNav areas
 * (Trade is the exception: it opens straight into the real signal
 * panel at /dashboard, not a hub page). Fixes a real, confirmed gap:
 * BottomNav already links every tab to /${area.id}, but until now
 * only /tradingview actually had a route — the other 6 all fell
 * through App.tsx's catch-all straight to /sitemap. That mismatch
 * predates this pass; MERGE_MANIFEST.md's "still queued" note already
 * flagged these landing pages as unbuilt.
 *
 * Per Section 9 of the design handover ("every other page ... starts
 * with PageHeader ... content below varies per page"), one FoldedCard
 * per feature in that area — the exact same grouped-list pattern
 * SiteMapPage already uses site-wide, just scoped to one area instead
 * of all eight. Each feature still links to its own real `route` from
 * FEATURE_REGISTRY; most of those routes have no page built yet
 * (same "still queued" list) and will fall through to the sitemap
 * fallback until they do — this page doesn't change that, it just
 * gives every BottomNav tab somewhere real to land first.
 *
 * Every FoldedCard in the reference carries an icon badge — this one
 * had none at all (FEATURE_REGISTRY has no per-feature icon), a real,
 * visible drift from Section 4's card anatomy. Reuses the area's own
 * AREA_ICONS entry per card, same as the reference's own Tools page
 * (one Wrench icon repeated across every tool card, only the accent
 * varying) rather than inventing a distinct icon per feature.
 *
 * A free chart (collapsed by default, same FoldedCard as everything
 * else here) now sits above the feature list, by direct request:
 * "introduce a free chart in all the subsections on the nav bar."
 * Trade, Tools, Insights, Learn, TradingView, and Community each have
 * their own dedicated page instead of this generic one and get the
 * same treatment there; this covers whatever's left (Practise,
 * Explore) plus any future area that hasn't earned a bespoke page yet.
 */
export function AreaPage({ area }: { area: FeatureArea }) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const meta = FEATURE_AREAS.find((a) => a.id === area)!;
  const items = FEATURE_REGISTRY.filter((f) => f.area === area);
  const AreaIcon = AREA_ICONS[area];

  return (
    <div>
      <PageHeader title={meta.label} subtitle={meta.description} />

      <div className="mb-3">
        <FoldedCard
          title="Free Chart" summary="A live TradingView chart, right here" icon={<LineChart size={19} />}
          dark={dark} defaultOpen
        >
          <ChartPanel symbol="OANDA:EURUSD" height={420} tradeSymbol="EURUSD" dark={dark} />
        </FoldedCard>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <FoldedCard key={item.id} title={item.label} summary={item.description} icon={<AreaIcon size={19} />} dark={dark}>
            <Link
              to={item.route}
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-white' : 'text-corporate-hero'}`}
            >
              Open {item.label} →
            </Link>
          </FoldedCard>
        ))}
      </div>
    </div>
  );
}
