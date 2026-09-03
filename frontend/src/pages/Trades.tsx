
import { useState } from 'react';
import { TradeRow } from '../components/TradeRow';
import { Filter, Search, Download } from 'lucide-react';

const mockTrades = [
  { id: '1', trade_id: 'TRD_001', symbol: 'BTCUSDT', direction: 'long', status: 'closed', entry_price: 42000, stop_loss: 41500, take_profit: 45000, lot_size: 0.05, risk_percent: 1, realized_pnl: 150, bot_id: 'bot_5', strategy_type: 'Jeafx SMC Specialist', created_at: '2024-01-15T10:30:00Z', requires_approval: false },
  { id: '2', trade_id: 'TRD_002', symbol: 'EURUSD', direction: 'short', status: 'active', entry_price: 1.0850, stop_loss: 1.0875, take_profit: 1.0775, lot_size: 0.02, risk_percent: 1, realized_pnl: 0, bot_id: 'bot_2', strategy_type: 'HF Order Block Reversal', created_at: '2024-01-15T14:20:00Z', requires_approval: false },
  { id: '3', trade_id: 'TRD_003', symbol: 'ETHUSDT', direction: 'long', status: 'pending', entry_price: 2500, stop_loss: 2450, take_profit: 2700, lot_size: 0.1, risk_percent: 1, realized_pnl: 0, bot_id: 'bot_3', strategy_type: 'FVG Expansion', created_at: '2024-01-15T16:45:00Z', requires_approval: true },
  { id: '4', trade_id: 'TRD_004', symbol: 'GBPUSD', direction: 'long', status: 'closed', entry_price: 1.2650, stop_loss: 1.2600, take_profit: 1.2800, lot_size: 0.03, risk_percent: 1.5, realized_pnl: -45, bot_id: 'bot_1', strategy_type: 'Pure Macro Swing', created_at: '2024-01-14T09:00:00Z', requires_approval: false },
  { id: '5', trade_id: 'TRD_005', symbol: 'SOLUSDT', direction: 'short', status: 'active', entry_price: 98.50, stop_loss: 102.00, take_profit: 88.00, lot_size: 0.2, risk_percent: 1, realized_pnl: 0, bot_id: 'bot_4', strategy_type: 'Volume & Liquidity Sweep', created_at: '2024-01-15T11:10:00Z', requires_approval: false },
];

export function TradesPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredTrades = mockTrades.filter(trade => {
    if (filter !== 'all' && trade.status !== filter) return false;
    if (search && !trade.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trade Management</h2>
          <p className="text-gray-400 text-sm mt-1">Monitor, approve, and analyze all trades</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-smc-accent/10 text-smc-accent rounded-lg hover:bg-smc-accent/20 transition-colors">
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-smc-card border border-smc-border rounded-lg text-sm focus:outline-none focus:border-smc-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          {['all', 'active', 'pending', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-smc-accent text-white' 
                  : 'bg-smc-card border border-smc-border text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trade List */}
      <div className="space-y-2">
        {filteredTrades.map((trade) => (
          <TradeRow key={trade.id} trade={trade as any} />
        ))}
      </div>

      {filteredTrades.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No trades found matching your criteria.
        </div>
      )}
    </div>
  );
}
