import { Link } from 'react-router-dom';
import { ArrowUpRight, Gauge, LineChart, Sparkles } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';

/**
 * PremiumOverviewCard — the "Premium overview" entry point, now on
 * every console (Partner, Fund Manager, Admin) rather than only the
 * Trader dashboard, by direct request. It's one card, not a copy of
 * the dashboard: /overview already reads today's trades, profit,
 * drawdown, active trades, configured risk, the 30-day equity curve, a
 * live chart, approvals waiting, bots and learning progress from the
 * same live sources the existing pages use — and TRADER_CONSOLE_ROLES
 * in App.tsx already admits every console role to that route, so no
 * portal needs its own duplicate.
 */
export function PremiumOverviewCard({ subtitle }: { subtitle?: string }) {
  return (
    <Link
      to="/overview"
      className="group block rounded-2xl p-5 text-white shadow-lg transition-transform hover:-translate-y-0.5"
      style={{ background: HERO_GRADIENT }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            <Sparkles size={13} /> Premium
          </div>
          <h3 className="text-lg font-bold mt-1.5">Premium overview</h3>
          <p className="text-sm text-white/70 mt-1 max-w-xl">
            {subtitle ?? "Today's trades, profit, drawdown, active trades and configured risk, a 30-day equity curve, a live chart, trades waiting on approval, bots and learning progress — every figure from the same live sources as your existing pages."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-white/80">
            {['Live P&L', 'Equity curve', 'Approvals', 'Bots', 'Learning'].map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2.5 py-1">{t}</span>
            ))}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-center gap-2 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><Gauge size={20} /></div>
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><LineChart size={20} /></div>
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
        Open premium overview
        <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}
