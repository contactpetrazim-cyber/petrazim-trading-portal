
import { useAppStore } from '../hooks/useStore';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Bot, 
  Settings, 
  Bell, 
  Menu,
  X,
  Activity,
  Shield,
  Zap
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/trades', label: 'Trades', icon: TrendingUp },
  { path: '/bots', label: 'Bots', icon: Bot },
  { path: '/analytics', label: 'Analytics', icon: Activity },
  { path: '/risk', label: 'Risk Management', icon: Shield },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar, wsConnected, stats } = useAppStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-smc-dark text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-smc-card border-b border-smc-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="p-2 hover:bg-smc-border rounded-lg transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Zap className="text-smc-accent" size={24} />
            <h1 className="text-lg font-bold tracking-tight">
              SMC <span className="text-smc-accent">Trading Engine</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
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

          <div className="text-sm text-gray-400">
            v1.0.0
          </div>
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

        {/* Bot Status Summary */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-smc-border">
          <div className="text-xs text-gray-500 mb-2">Active Bots</div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-6 h-6 rounded-full bg-smc-accent/20 border border-smc-accent/50 flex items-center justify-center text-xs text-smc-accent">
                  B{i}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-400">5/5 Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
