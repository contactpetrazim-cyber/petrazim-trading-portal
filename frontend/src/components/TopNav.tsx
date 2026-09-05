import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Settings } from 'lucide-react';
import { PetrazimLogo } from './PetrazimLogo';
import { GlobalSearchModal } from './GlobalSearchModal';
import { SettingsPanel } from './SettingsPanel';
import { BackendStatusBadge } from './BackendStatusBadge';
import { TradingModeBadge } from './TradingModeBadge';
import { WakeBackendButton } from './WakeBackendButton';
import { GoHomeButton } from './GoHomeButton';
import { useThemeStore } from '../hooks/useTheme';

/**
 * TopNav — slim ribbon: logo, Home shortcut, search, settings gear.
 * Reconciled against petrazim_preview_v13_FINAL.jsx: the 8 area tabs
 * moved OUT of the top bar and into BottomNav (a mobile-app-style tab
 * bar) — the top ribbon is logo + utility icons only now, not inline
 * nav links. White in light mode, matching the logo's own background;
 * dark navy in dark mode.
 *
 * GoHomeButton sits in the right-side icon cluster, beside Search —
 * it used to float fixed over the top-left corner, which obstructed
 * the logo also living there; relocated by direct follow-up request.
 *
 * The logo links to /home (CorporateHomePage) rather than /dashboard
 * — the reference's own "click the logo -> the dashboard view"
 * behavior, but /dashboard in this real app is the separate, already-
 * live Trader console (a different page entirely from the corporate
 * shell TopNav lives in), so pointing here at the corporate home is
 * the faithful equivalent rather than a literal path match.
 */
export function TopNav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useThemeStore();
  const dark = theme === 'dark';

  return (
    <>
      <nav className={`sticky top-0 z-40 border-b ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark' : 'bg-white border-[#e8e8f0]'}`}>
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between" style={{ height: 84 }}>
          <Link to="/home" className="flex items-center">
            <PetrazimLogo height={60} />
          </Link>

          <div className="hidden lg:flex items-center gap-3">
            <BackendStatusBadge dark={dark} />
            <TradingModeBadge dark={dark} />
          </div>

          <div className="flex items-center gap-2">
            <GoHomeButton dark={dark} />
            <WakeBackendButton dark={dark} />
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search all features"
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-corporate-hero ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'}`}
            >
              <Search size={17} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-corporate-hero ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'}`}
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
      </nav>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} setTheme={setTheme} dark={dark} />
    </>
  );
}
