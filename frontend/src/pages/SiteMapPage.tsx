import { FEATURE_AREAS, FEATURE_REGISTRY, FeatureArea } from '../config/featureRegistry';
import { FoldedCard } from '../components/FoldedCard';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../hooks/useTheme';

/**
 * SiteMapPage — every feature grouped by its area, each area a
 * FoldedCard (collapsed by default per your preference, click to
 * expand). This is the concrete "subdivided and grouped" view of the
 * full site — reads from the same FEATURE_REGISTRY the nav and search
 * already use, so it can never drift out of sync with either.
 *
 * No longer owns its own min-h-screen/background wrapper — that fought
 * CorporateLayout's own background and left this page stuck light even
 * with the site-wide toggle set to dark (found while screenshot-
 * verifying the theme work against petrazim_preview_v13_FINAL.jsx).
 * Now reads the same theme store CorporateLayout does and passes
 * `dark` down to FoldedCard, which already supported it.
 */
export function SiteMapPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const grouped = (area: FeatureArea) => FEATURE_REGISTRY.filter((f) => f.area === area);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Site Map</h1>
      <p className={`text-sm mb-6 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
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
              dark={dark}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.route}
                    className={`block p-3 rounded-lg transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`}
                  >
                    <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{item.label}</div>
                    <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{item.description}</div>
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
