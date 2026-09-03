import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen, Dumbbell, LineChart, BarChart3, Tv, Wrench, Users, Compass,
} from 'lucide-react';
import { FEATURE_AREAS, FeatureArea } from '../config/featureRegistry';
import { useThemeStore } from '../hooks/useTheme';

// Same icon-per-area mapping as petrazim_preview_v13_FINAL.jsx's NAV array.
const AREA_ICONS: Record<FeatureArea, typeof BookOpen> = {
  learn: BookOpen,
  practise: Dumbbell,
  trade: LineChart,
  insights: BarChart3,
  tradingview: Tv,
  tools: Wrench,
  community: Users,
  explore: Compass,
};

/**
 * BottomNav — the 8 feature areas as a fixed, mobile-app-style tab
 * bar, per petrazim_preview_v13_FINAL.jsx (previously these lived as
 * inline links in the top ribbon — the reference moves them here).
 * Reads from the same FEATURE_REGISTRY as GlobalSearchModal, so the
 * two can never drift out of sync.
 */
export function BottomNav() {
  const location = useLocation();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="max-w-5xl mx-auto px-2 flex items-center justify-between overflow-x-auto">
        {FEATURE_AREAS.map((area) => {
          const Icon = AREA_ICONS[area.id];
          const isActive = location.pathname.startsWith(`/${area.id}`);
          return (
            <Link
              key={area.id}
              to={`/${area.id}`}
              className="flex-1 min-w-[64px] flex flex-col items-center gap-1 py-2.5 transition-colors"
              style={{ color: isActive ? '#005FB8' : dark ? '#5b6178' : '#9aa0b8' }}
            >
              <Icon size={19} />
              <span className="text-[10px] font-medium">{area.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
