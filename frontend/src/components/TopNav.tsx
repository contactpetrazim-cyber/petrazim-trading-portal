import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { FEATURE_AREAS } from '../config/featureRegistry';
import { PetrazimLogo } from './PetrazimLogo';
import { GlobalSearchModal } from './GlobalSearchModal';

/**
 * TopNav — the 7 tabs (Learn / Practise / Trade / Insights / Tools /
 * Community / Explore), logo, and search trigger. Corporate palette
 * (hero navy background, orange active-tab indicator). Each tab links
 * to that area's landing page — individual features within an area
 * are reached via that area's own page or via search.
 */
export function TopNav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav className="bg-corporate-hero sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center">
            <PetrazimLogo height={60} />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {FEATURE_AREAS.map((area) => {
              const isActive = location.pathname.startsWith(`/${area.id}`);
              return (
                <Link
                  key={area.id}
                  to={`/${area.id}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-corporate-accent text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {area.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search all features"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Mobile tab row */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3 -mt-1">
          {FEATURE_AREAS.map((area) => {
            const isActive = location.pathname.startsWith(`/${area.id}`);
            return (
              <Link
                key={area.id}
                to={`/${area.id}`}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? 'bg-corporate-accent text-white' : 'bg-white/10 text-white/80'
                }`}
              >
                {area.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
