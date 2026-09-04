import { Link } from 'react-router-dom';
import { Bot, Hand, LayoutDashboard, ListChecks, Settings2, Shield } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { TradingViewChart } from '../components/TradingViewChart';
import { useCandleColorStore } from '../hooks/useCandleColors';
import { useThemeStore } from '../hooks/useTheme';

/**
 * TradePage — the real /trade area landing page, replacing the
 * generic FoldedCard link list. Per direct request: a free chart,
 * a clear Bot Trading vs. Manual Trading choice (two large cards,
 * exchange-style), and the existing Dashboard/Trade Management/Bot
 * Configuration/Risk Management pages arranged as a secondary group
 * below rather than a flat list.
 */
export function TradePage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { colors } = useCandleColorStore();

  const cardCls = `rounded-2xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const linkTiles = [
    { label: 'Trading Dashboard', desc: 'Live signals, equity curve, bot performance', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Trade Management', desc: 'Approve, reject, and review individual trades', to: '/trades', icon: ListChecks },
    { label: 'Bot Configuration', desc: 'Enable/disable bots, switch modes, tune risk', to: '/bots', icon: Settings2 },
    { label: 'Risk Management', desc: 'Live exposure and per-bot risk caps', to: '/risk', icon: Shield },
  ];

  return (
    <div>
      <PageHeader title="Trade" subtitle="Your live signal panel, trade approvals, bot configuration, and manual trading." />

      <FoldedCard title="Free Chart" summary="A live TradingView chart, right here" icon={<LayoutDashboard size={19} />} dark={dark} defaultOpen>
        <div className="rounded-lg overflow-hidden mb-2" style={{ height: 360 }}>
          <TradingViewChart symbol="BINANCE:BTCUSDT" interval="60" theme={theme} candleColors={colors} />
        </div>
        <Link to="/tradingview" className={`text-xs font-medium ${dark ? 'text-white/50' : 'text-corporate-hero'}`}>
          Open the full Trading Frame (more symbols, My Workspace, drawing tools) →
        </Link>
      </FoldedCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <Link to="/dashboard" className={`${cardCls} hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)] transition-shadow`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${dark ? 'bg-corporate-hero/15' : 'bg-corporate-hero/10'}`}>
            <Bot size={22} className="text-corporate-hero" />
          </div>
          <div className={`font-bold text-lg mb-1 font-display ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Bot Trading</div>
          <p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Your 5 SMC bots run their own strategies — configure risk caps, switch autonomous/human-in-the-loop mode, and approve trades from the dashboard.
          </p>
        </Link>

        <Link to="/trade/manual" className={`${cardCls} hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)] transition-shadow`}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/10">
            <Hand size={22} className="text-emerald-500" />
          </div>
          <div className={`font-bold text-lg mb-1 font-display ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Manual Trading</div>
          <p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            A real chart and order ticket, exchange-style — place your own trades, Test mode to rehearse risk-free, Live to send a real order.
          </p>
        </Link>
      </div>

      <div className="space-y-3">
        {linkTiles.map((t) => (
          <FoldedCard key={t.to} title={t.label} summary={t.desc} icon={<t.icon size={19} />} dark={dark}>
            <Link to={t.to} className={`inline-flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-white' : 'text-corporate-hero'}`}>
              Open {t.label} →
            </Link>
          </FoldedCard>
        ))}
      </div>
    </div>
  );
}
