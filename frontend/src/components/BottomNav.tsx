import { Link, useLocation } from 'react-router-dom';
import { FEATURE_AREAS, AREA_ICONS } from '../config/featureRegistry';
import { useThemeStore } from '../hooks/useTheme';

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
      {/* min-w tightened for phone-width screens (8 tabs at 64px each
          overflowed most phones under ~512px, forcing a horizontal
          scroll to reach Tools/Community/Explore) — 48px fits 8 tabs
          on every mainstream phone width without scrolling; sm:
          restores the larger, more comfortable touch target once
          there's room (tablet/desktop). */}
      <div className="max-w-5xl mx-auto px-1 sm:px-2 flex items-center justify-between overflow-x-auto">
        {FEATURE_AREAS.map((area) => {
          const Icon = AREA_ICONS[area.id];
          const isActive = location.pathname.startsWith(`/${area.id}`);
          return (
            <Link
              key={area.id}
              to={`/${area.id}`}
              className="flex-1 min-w-[48px] sm:min-w-[64px] flex flex-col items-center gap-1 py-2 sm:py-2.5 transition-colors"
              style={{ color: isActive ? '#005FB8' : dark ? '#5b6178' : '#9aa0b8' }}
            >
              <Icon size={17} className="sm:hidden" />
              <Icon size={19} className="hidden sm:block" />
              <span className="text-[8.5px] sm:text-[10px] font-medium leading-none">{area.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
