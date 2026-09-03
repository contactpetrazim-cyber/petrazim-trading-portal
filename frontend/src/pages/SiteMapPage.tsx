import { FEATURE_AREAS, FEATURE_REGISTRY, FeatureArea } from '../config/featureRegistry';
import { FoldedCard } from '../components/FoldedCard';
import { Link } from 'react-router-dom';

/**
 * SiteMapPage — every feature grouped by its area, each area a
 * FoldedCard (collapsed by default per your preference, click to
 * expand). This is the concrete "subdivided and grouped" view of the
 * full site — reads from the same FEATURE_REGISTRY the nav and search
 * already use, so it can never drift out of sync with either.
 */
export function SiteMapPage() {
  const grouped = (area: FeatureArea) => FEATURE_REGISTRY.filter((f) => f.area === area);

  return (
    <div className="min-h-screen bg-corporate-bg p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-corporate-text-on-bg mb-2">Site Map</h1>
      <p className="text-sm text-gray-500 mb-6">
        Every feature, grouped by area. Tap a section to expand it.
      </p>

      <div className="space-y-3">
        {FEATURE_AREAS.map((area) => {
          const items = grouped(area.id);
          return (
            <FoldedCard
              key={area.id}
              title={area.label}
              summary={`${items.length} feature${items.length === 1 ? '' : 's'}`}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.route}
                    className="block p-3 rounded-lg hover:bg-corporate-bg transition-colors"
                  >
                    <div className="text-sm font-medium text-corporate-text-on-bg">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                  </Link>
                ))}
              </div>
            </FoldedCard>
          );
        })}
      </div>
    </div>
  );
}
