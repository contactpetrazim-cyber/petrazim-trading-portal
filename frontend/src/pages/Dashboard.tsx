
import { useEffect, useState } from 'react';
import { StatCard } from '../components/StatCard';
import { TradeRow } from '../components/TradeRow';
import { useAppStore } from '../hooks/useStore';
import { dashboardApi, tradesApi } from '../services/api';
import { 
  TrendingUp, 
  Activity, 
  AlertCircle, 
  DollarSign, 
  Target,
  Bot,
  Zap
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Mock equity curve data for preview
const mockEquityData = [
  { day: 'Mon', equity: 10000 },
  { day: 'Tue', equity: 10250 },
  { day: 'Wed', equity: 10180 },
  { day: 'Thu', equity: 10420 },
  { day: 'Fri', equity: 10680 },
  { day: 'Sat', equity: 10680 },
  { day: 'Sun', equity: 10890 },
];

const mockSignals = [
  {
    bot_id: 'bot_5',
    bot_name: 'Jeafx SMC Specialist',
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.88,
    entry_price: 43250.50,
    stop_loss: 42800.00,
    take_profit: 45200.00,
    lot_size: 0.05,
    risk_percent: 1.0,
    rr_ratio: 4.5,
    reasoning: '1H fresh zone. 15M buy-side sweep. 5M confirmation + FVG. Entry at 50%. 5R target.',
    requires_approval: true,
    timestamp: new Date().toISOString(),
  },
  {
    bot_id: 'bot_2',
    bot_name: 'HF Order Block Reversal',
    symbol: 'EURUSD',
    direction: 'short',
    confidence: 0.82,
    entry_price: 1.0850,
    stop_loss: 1.0875,
    take_profit: 1.0775,
    lot_size: 0.02,
    risk_percent: 1.0,
    rr_ratio: 3.0,
    reasoning: '4H bearish OB active. 15M CHoCH + sweep. FVG confirmation. Tight SL. 3R target.',
    requires_approval: true,
    timestamp: new Date().toISOString(),
  }
];

export function DashboardPage() {
  const { stats, setStats, pendingTrades, setPendingTrades } = useAppStore();
  const [equityData, setEquityData] = useState(mockEquityData);
  const [signals, setSignals] = useState(mockSignals);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // In production: fetch from API
        // const statsData = await dashboardApi.getStats();
        // setStats(statsData);

        // Mock stats for preview
        setStats({
          total_trades_today: 12,
          active_trades: 3,
          pending_approvals: 2,
          daily_pnl: 245.50,
          win_rate_today: 68.5,
          current_drawdown: 2.1,
          active_bots: 5,
        });

        setLoading(false);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [setStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-smc-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">Real-time SMC Trading Engine Overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-medium">
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Trades"
          value={stats?.total_trades_today || 0}
          subtitle={`${stats?.win_rate_today || 0}% win rate`}
          trend="up"
          trendValue="+3 from yesterday"
          icon={<Activity size={20} />}
          color="blue"
        />
        <StatCard
          title="Daily P&L"
          value={`$${stats?.daily_pnl?.toFixed(2) || '0.00'}`}
          subtitle="Net realized profit"
          trend="up"
          trendValue="+12.5%"
          icon={<DollarSign size={20} />}
          color="green"
        />
        <StatCard
          title="Active Trades"
          value={stats?.active_trades || 0}
          subtitle="Currently in market"
          trend="neutral"
          trendValue="3 long, 0 short"
          icon={<Target size={20} />}
          color="purple"
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pending_approvals || 0}
          subtitle="Human-in-the-Loop"
          trend="up"
          trendValue="Requires action"
          icon={<AlertCircle size={20} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve */}
        <div className="lg:col-span-2 bg-smc-card border border-smc-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Equity Curve</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-smc-accent"></span>
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#equityGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bot Performance */}
        <div className="bg-smc-card border border-smc-border rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Bot Performance</h3>
          <div className="space-y-4">
            {[
              { name: 'Macro Swing', winRate: 72, trades: 45, pnl: 1250 },
              { name: 'OB Reversal', winRate: 65, trades: 78, pnl: 890 },
              { name: 'FVG Expansion', winRate: 58, trades: 62, pnl: 650 },
              { name: 'Volume Sweep', winRate: 61, trades: 34, pnl: 420 },
              { name: 'Jeafx SMC', winRate: 75, trades: 28, pnl: 980 },
            ].map((bot, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{bot.name}</div>
                  <div className="text-xs text-gray-400">{bot.trades} trades</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${bot.winRate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {bot.winRate}%
                  </div>
                  <div className="text-xs text-emerald-400">+${bot.pnl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Signals */}
      <div className="bg-smc-card border border-smc-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap className="text-smc-accent" size={18} />
            Live Signals
          </h3>
          <span className="text-xs text-gray-400">Auto-refresh every 30s</span>
        </div>

        <div className="space-y-3">
          {signals.map((signal, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-transparent hover:border-smc-accent/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  signal.direction === 'long' ? 'bg-smc-long/10 text-smc-long' : 'bg-smc-short/10 text-smc-short'
                }`}>
                  {signal.direction.toUpperCase()}
                </div>
                <div>
                  <div className="font-bold">{signal.symbol}</div>
                  <div className="text-xs text-gray-400">{signal.bot_name}</div>
                </div>
                <div className="hidden md:flex items-center gap-4 text-sm">
                  <div className="font-mono">Entry: {signal.entry_price.toLocaleString()}</div>
                  <div className="font-mono text-red-400">SL: {signal.stop_loss.toLocaleString()}</div>
                  <div className="font-mono text-emerald-400">TP: {signal.take_profit.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold">{signal.confidence * 100}% Confidence</div>
                  <div className="text-xs text-gray-400">{signal.rr_ratio}:1 R:R</div>
                </div>

                {signal.requires_approval ? (
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                      Approve
                    </button>
                    <button className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors">
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium">
                    Auto-Executed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-smc-card border border-smc-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Recent Trades</h3>
        <div className="space-y-2">
          {/* Mock trades for preview */}
          <TradeRow trade={{
            id: '1', trade_id: 'TRD_001', symbol: 'BTCUSDT', direction: 'long',
            status: 'closed', entry_price: 42000, stop_loss: 41500, take_profit: 45000,
            lot_size: 0.05, risk_percent: 1, realized_pnl: 150, bot_id: 'bot_5',
            strategy_type: 'Jeafx SMC Specialist', created_at: new Date().toISOString(),
            requires_approval: false
          } as any} />
          <TradeRow trade={{
            id: '2', trade_id: 'TRD_002', symbol: 'EURUSD', direction: 'short',
            status: 'active', entry_price: 1.0850, stop_loss: 1.0875, take_profit: 1.0775,
            lot_size: 0.02, risk_percent: 1, realized_pnl: 0, bot_id: 'bot_2',
            strategy_type: 'HF Order Block Reversal', created_at: new Date().toISOString(),
            requires_approval: false
          } as any} />
          <TradeRow trade={{
            id: '3', trade_id: 'TRD_003', symbol: 'ETHUSDT', direction: 'long',
            status: 'pending', entry_price: 2500, stop_loss: 2450, take_profit: 2700,
            lot_size: 0.1, risk_percent: 1, realized_pnl: 0, bot_id: 'bot_3',
            strategy_type: 'FVG Expansion', created_at: new Date().toISOString(),
            requires_approval: true
          } as any} />
        </div>
      </div>
    </div>
  );
}
