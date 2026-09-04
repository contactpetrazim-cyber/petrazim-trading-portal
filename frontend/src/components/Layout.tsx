
import { useState } from 'react';
import { useAppStore } from '../hooks/useStore';
import {
  LayoutDashboard,
  TrendingUp,
  Bot,
  Settings as SettingsIcon,
  Bell,
  Menu,
  X,
  Activity,
  Shield,
  LucideIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { BackendStatusBadge } from './BackendStatusBadge';
import { PetrazimLogo } from './PetrazimLogo';
import { SettingsPanel } from './SettingsPanel';
import { useThemeStore } from '../hooks/useTheme';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const TRADER_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/trades', label: 'Trades', icon: TrendingUp },
  { path: '/bots', label: 'Bots', icon: Bot },
  { path: '/analytics', label: 'Analytics', icon: Activity },
  { path: '/risk', label: 'Risk Management', icon: Shield },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

/**
 * Layout — the dark terminal shell for the Trader console's own five
 * pages (Dashboard/Trades/Bots/Analytics-Risk-Settings). This is the
 * "existing v2 dashboard" App.tsx's own comment refers to — it
 * predates, and isn't part of, the v13 design system (TopNav/
 * BottomNav/HERO_GRADIENT/PageHeader) that Manager/Partner/Admin and
 * every other page in the app follow; per the UI design handover's
 * own "Deliberate Exception" section, it's the Trade signal panel and
 * TradingView frame specifically that stay dark on purpose, not a
 * whole separate console shell. Manager/Partner/Admin
 * mount inside CorporateLayout (App.tsx), not here — an earlier pass
 * this session moved them here by mistake, reading "the trader
 * dashboard" as this legacy sidebar rather than the v13 corporate
 * theme's own Dashboard; reverted once the actual v13 source file and
 * handover doc confirmed which one "the trader dashboard" means.
 *
 * `navItems` (only the Trader nav today) exists so this doesn't need
 * to be Trader-specific at the type level, in case a future page
 * genuinely needs this same dark-terminal treatment — not a signal
 * that other consoles should mount here.
 *
 * Two real, narrow fixes kept from that reverted pass: the header was
 * still the pre-launch "SMC Trading Engine" placeholder (a lightning
 * icon + text) — swapped for the real PetrazimLogo, which every v13
 * page already had and this one, oddly, never did. And a settings
 * gear was added so this legacy console also reaches SettingsPanel's
 * "Switch Portal" — it had no way back to the rest of the app at all
 * before this.
 *
 * Follows the site-wide light/dark toggle now too, by direct
 * instruction — every other portal already did (Manager/Partner/Admin
 * via CorporateLayout); this was the one console still forced dark
 * regardless of the toggle. Dark keeps the exact original smc-* dark-
 * terminal palette unchanged. Light does NOT invent a new "light
 * terminal" look — it reuses the same white/corporate-bg/corporate-
 * hero palette every other light-mode page already uses, so toggling
 * light here looks like the rest of the site, not a third theme.
 */
export function Layout({ children, navItems = TRADER_NAV_ITEMS }: { children: React.ReactNode; navItems?: NavItem[] }) {
  const { sidebarOpen, toggleSidebar, wsConnected, stats } = useAppStore();
  const location = useLocation();
  const { theme, setTheme } = useThemeStore();
  const dark = theme === 'dark';
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={`min-h-screen font-sans ${dark ? 'bg-smc-dark text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 h-16 border-b z-50 flex items-center justify-between px-4 ${
        dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'
      }`}>
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-smc-border' : 'hover:bg-corporate-bg'}`}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/home" className="flex items-center">
            <PetrazimLogo height={34} />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Backend sleep/wake status — separate from the WS connection
              below: the backend can be reachable but the socket dropped,
              or vice versa while it's waking up. */}
          <BackendStatusBadge />

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-smc-success animate-pulse' : 'bg-smc-danger'}`} />
            <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{wsConnected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Pending Approvals Badge */}
          {stats && stats.pending_approvals > 0 && (
            <div className="relative">
              <Bell className="text-smc-warning" size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-smc-danger rounded-full text-xs flex items-center justify-center">
                {stats.pending_approvals}
              </span>
            </div>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              dark ? 'text-smc-accent hover:bg-white/5' : 'text-corporate-hero hover:bg-corporate-bg'
            }`}
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-0 border-r transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
      } ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? dark
                      ? 'bg-smc-accent/10 text-smc-accent border border-smc-accent/20'
                      : 'bg-corporate-hero/10 text-corporate-hero border border-corporate-hero/20'
                    : dark
                      ? 'text-gray-400 hover:bg-smc-border hover:text-white'
                      : 'text-gray-500 hover:bg-corporate-bg hover:text-corporate-text-on-bg'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium">{item.label}</span>
                {item.label === 'Trades' && stats && stats.pending_approvals > 0 && (
                  <span className="ml-auto bg-smc-danger text-white text-xs px-2 py-0.5 rounded-full">
                    {stats.pending_approvals}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <div className="p-6">
          {children}
        </div>
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} setTheme={setTheme} dark={dark} />
    </div>
  );
}
