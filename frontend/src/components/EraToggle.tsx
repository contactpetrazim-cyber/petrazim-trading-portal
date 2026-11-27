import { History, Zap } from 'lucide-react';
import type { DataEra } from '../hooks/useDataEra';

/**
 * EraToggle — the shared "Post vs Pre+Post" pill, by direct request.
 * Same two-state-pill visual language as TodayTradeBreakdownPills'
 * period selector, dropped into every dashboard page that reads
 * dashboardApi (Dashboard, AnalyticsPage, PremiumDashboardPage) plus
 * the Recommended Bots Dashboard, all driven by one shared
 * useDataEra() so the choice is set once and holds everywhere.
 */
export function EraToggle({ era, setEra, dark = false }: { era: DataEra; setEra: (e: DataEra) => void; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-0.5 ${dark ? 'bg-white/5' : 'bg-black/5'}`} title="Which trades the dashboards below are computed from">
      <button
        type="button"
        onClick={() => setEra('post')}
        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
          era === 'post' ? (dark ? 'bg-smc-accent text-white' : 'bg-gray-900 text-white') : (dark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-black/10')
        }`}
      >
        <Zap size={11} /> Since rollout (Nov 11)
      </button>
      <button
        type="button"
        onClick={() => setEra('all')}
        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
          era === 'all' ? (dark ? 'bg-smc-accent text-white' : 'bg-gray-900 text-white') : (dark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-black/10')
        }`}
      >
        <History size={11} /> All-time incl. testing phase
      </button>
    </div>
  );
}
