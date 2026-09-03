
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
 * Layout — the Trader console's dark terminal shell. Now the shared
 * shell for every portal (Trader/Manager/Partner/Admin), not just the
 * Trader's: "let every portal follow the style and formatting and
 * colour theme of the trader dashboard" means literally this
 * component, not a lookalike. `navItems` lets each portal supply its
 * own (Trader's five-item sidebar stays the default, so this page
 * needed zero changes at its own three call sites).
 *
 * Also fixes a real, separate gap while unifying this: the header
 * was still the pre-launch "SMC Trading Engine" placeholder branding
 * (a lightning icon + text), never swapped for the real Petrazim
 * logo like TopNav's corporate-shell header already was — "use the
 * correct Petrazim logo on all portals, copy the trader portal" only
 * half-worked as an instruction while the trader portal itself hadn't
 * been fixed either.
 *
 * The settings gear (new) opens the same SettingsPanel the corporate
 * shell uses, forced dark — this is what gives every portal mounted
 * here the "Switch Portal" nav ("how to get back and select portal of
 * interest"), consistently, rather than each portal inventing its own.
 */
export function Layout({ children, navItems = TRADER_NAV_ITEMS }: { children: React.ReactNode; navItems?: NavItem[] }) {
  const { sidebarOpen, toggleSidebar, wsConnected, stats } = useAppStore();
  const location = useLocation();
  const { theme, setTheme } = useThemeStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-smc-dark text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-smc-card border-b border-smc-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="p-2 hover:bg-smc-border rounded-lg transition-colors">
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
            <span className="text-gray-400">{wsConnected ? 'Live' : 'Offline'}</span>
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
            className="w-9 h-9 rounded-lg flex items-center justify-center text-smc-accent hover:bg-white/5 transition-colors"
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-0 bg-smc-card border-r border-smc-border transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`}>
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
                    ? 'bg-smc-accent/10 text-smc-accent border border-smc-accent/20'
                    : 'text-gray-400 hover:bg-smc-border hover:text-white'
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

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} setTheme={setTheme} dark />
    </div>
  );
}
