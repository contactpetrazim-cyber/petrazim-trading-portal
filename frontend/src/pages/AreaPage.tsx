import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { FEATURE_AREAS, FEATURE_REGISTRY, FeatureArea } from '../config/featureRegistry';
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
 */
export function AreaPage({ area }: { area: FeatureArea }) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const meta = FEATURE_AREAS.find((a) => a.id === area)!;
  const items = FEATURE_REGISTRY.filter((f) => f.area === area);

  return (
    <div>
      <PageHeader title={meta.label} subtitle={meta.description} />

      <div className="space-y-3">
        {items.map((item) => (
          <FoldedCard key={item.id} title={item.label} summary={item.description} dark={dark}>
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
