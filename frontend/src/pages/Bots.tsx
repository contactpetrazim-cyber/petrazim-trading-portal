
import { useState } from 'react';
import { Bot, Play, Pause, Settings, TrendingUp, Shield, AlertTriangle } from 'lucide-react';

const botConfigs = [
  {
    id: 'bot_1',
    name: 'Pure Macro Swing',
    style: 'Damir/Brooks',
    status: 'active',
    mode: 'human_in_loop',
    symbols: ['EURUSD', 'GBPUSD', 'XAUUSD'],
    timeframes: ['1D', '4H'],
    risk: 1.5,
    rr: 5.0,
    trades: 45,
    winRate: 72,
    description: 'Major structural transitions, trend continuity, multi-week trend breaks.',
  },
  {
    id: 'bot_2',
    name: 'HF Order Block Reversal',
    style: 'ICT Core Mentorship',
    status: 'active',
    mode: 'fully_autonomous',
    symbols: ['EURUSD', 'USDJPY', 'BTCUSDT'],
    timeframes: ['4H', '1H', '15M'],
    risk: 1.0,
    rr: 3.0,
    trades: 78,
    winRate: 65,
    description: 'Internal liquidity sweeps, rapid premium/discount adjustments, early CHoCH entries.',
  },
  {
    id: 'bot_3',
    name: 'FVG Expansion & Fill',
    style: 'Photon/Phantom',
    status: 'active',
    mode: 'human_in_loop',
    symbols: ['ETHUSDT', 'BTCUSDT', 'SOLUSDT'],
    timeframes: ['1H', '15M'],
    risk: 1.0,
    rr: 4.0,
    trades: 62,
    winRate: 58,
    description: 'High-momentum plays targeting unmitigated institutional imbalances.',
  },
  {
    id: 'bot_4',
    name: 'Volume & Liquidity Sweep',
    style: 'Dalton/Weis/Wyckoff',
    status: 'active',
    mode: 'fully_autonomous',
    symbols: ['XAUUSD', 'USOIL', 'SPX500'],
    timeframes: ['4H', '1H'],
    risk: 1.0,
    rr: 3.0,
    trades: 34,
    winRate: 61,
    description: 'Auction Market Theory, accumulation/distribution, Spring/Upthrust patterns.',
  },
  {
    id: 'bot_5',
    name: 'Jeafx SMC Specialist',
    style: 'Jeafx',
    status: 'active',
    mode: 'human_in_loop',
    symbols: ['BTCUSDT', 'ETHUSDT', 'EURUSD'],
    timeframes: ['1H', '15M', '5M'],
    risk: 1.0,
    rr: 5.0,
    trades: 28,
    winRate: 75,
    description: 'Mechanical supply/demand, rapid liquidity purges, explosive structural breaks.',
  },
];

export function BotsPage() {
  const [selectedBot, setSelectedBot] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bot Configuration</h2>
        <p className="text-gray-400 text-sm mt-1">Manage your 5 SMC trading bots</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {botConfigs.map((bot) => (
          <div 
            key={bot.id}
            className={`bg-smc-card border rounded-xl p-6 transition-all cursor-pointer ${
              selectedBot === bot.id 
                ? 'border-smc-accent ring-1 ring-smc-accent/30' 
                : 'border-smc-border hover:border-smc-accent/30'
            }`}
            onClick={() => setSelectedBot(selectedBot === bot.id ? null : bot.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-smc-accent/10 flex items-center justify-center">
                  <Bot className="text-smc-accent" size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{bot.name}</h3>
                  <p className="text-xs text-gray-400">{bot.style} Style</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  bot.status === 'active' 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-gray-500/10 text-gray-400'
                }`}>
                  {bot.status === 'active' ? 'Active' : 'Paused'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  bot.mode === 'fully_autonomous'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {bot.mode === 'fully_autonomous' ? 'Auto' : 'HITL'}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-400 mt-3">{bot.description}</p>

            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center p-2 bg-white/5 rounded-lg">
                <div className="text-lg font-bold">{bot.winRate}%</div>
                <div className="text-xs text-gray-400">Win Rate</div>
              </div>
              <div className="text-center p-2 bg-white/5 rounded-lg">
                <div className="text-lg font-bold">{bot.trades}</div>
                <div className="text-xs text-gray-400">Trades</div>
              </div>
              <div className="text-center p-2 bg-white/5 rounded-lg">
                <div className="text-lg font-bold">{bot.rr}:1</div>
                <div className="text-xs text-gray-400">R:R</div>
              </div>
              <div className="text-center p-2 bg-white/5 rounded-lg">
                <div className="text-lg font-bold">{bot.risk}%</div>
                <div className="text-xs text-gray-400">Risk</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
              <TrendingUp size={12} />
              <span>{bot.symbols.join(', ')}</span>
            </div>

            {selectedBot === bot.id && (
              <div className="mt-4 pt-4 border-t border-smc-border space-y-3">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">Quick Actions</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex-1 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors">
                    <Play size={14} className="inline mr-1" /> Start
                  </button>
                  <button className="flex-1 px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors">
                    <Pause size={14} className="inline mr-1" /> Pause
                  </button>
                  <button className="flex-1 px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-colors">
                    {bot.mode === 'fully_autonomous' ? 'Switch to HITL' : 'Switch to Auto'}
                  </button>
                </div>

                <div className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-xs text-amber-400">Changing bot settings requires strategy restart</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
