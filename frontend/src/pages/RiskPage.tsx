
import { useEffect, useState } from 'react';
import { Shield, Save, AlertTriangle } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { botsApi, tradesApi } from '../services/api';
import { BotConfig, BotMetricsUpdate, Trade } from '../types';

/**
 * RiskPage — "Risk Management". Previously /risk didn't exist as its
 * own page at all: App.tsx routed it straight to <DashboardPage />
 * (the exact same component /dashboard renders), so clicking it in
 * the sidebar visibly did nothing — the page just looked identical to
 * the one you were already on. This is the real thing: per-bot risk
 * caps (risk per trade, daily/concurrent trade limits, portfolio
 * exposure, min R:R), each shown against real live usage and editable
 * in place via the same PATCH /bots/{id}/metrics Bots.tsx uses.
 */
export function RiskPage() {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [todayTrades, setTodayTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BotMetricsUpdate | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [botList, active, all] = await Promise.all([
        botsApi.getBots(),
        tradesApi.getActiveTrades(),
        tradesApi.getTrades({ limit: 200 }),
      ]);
      setBots(botList);
      setActiveTrades(active);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      setTodayTrades(all.filter((t) => new Date(t.created_at) >= todayStart));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(bot: BotConfig) {
    if (editingId === bot.bot_id) {
      setEditingId(null);
      setEditing(null);
      return;
    }
    setEditingId(bot.bot_id);
    setEditing({
      risk_per_trade: bot.risk_per_trade,
      max_daily_trades: bot.max_daily_trades,
      max_concurrent_trades: bot.max_concurrent_trades,
      max_portfolio_exposure: bot.max_portfolio_exposure,
      min_rr_ratio: bot.min_rr_ratio,
    });
  }

  async function save(botId: string) {
    if (!editing) return;
    setSaving(true);
    try {
      await botsApi.updateMetrics(botId, editing);
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const totalActive = activeTrades.length;
  const totalDailyCap = bots.reduce((s, b) => s + b.max_daily_trades, 0);
  // Live exposure estimate: sum of each active trade's own risk% —
  // real numbers from real open positions, not a modeled VaR figure.
  const exposurePct = activeTrades.reduce((s, t) => s + (t.risk_percent || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Shield size={22} className="text-smc-accent" /> Risk Management</h2>
        <p className="text-gray-400 text-sm mt-1">Live exposure and per-bot risk caps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Open Risk Exposure"
          value={`${exposurePct.toFixed(2)}%`}
          subtitle={`Across ${totalActive} open trade${totalActive === 1 ? '' : 's'}`}
          icon={<Shield size={20} />}
          color={exposurePct > 10 ? 'red' : 'blue'}
        />
        <StatCard
          title="Trades Today"
          value={`${todayTrades.length} / ${totalDailyCap || '—'}`}
          subtitle="Used vs. combined daily cap across all bots"
          icon={<AlertTriangle size={20} />}
          color={totalDailyCap > 0 && todayTrades.length >= totalDailyCap ? 'amber' : 'blue'}
        />
        <StatCard
          title="Bots at Concurrent Cap"
          value={bots.filter((b) => activeTrades.filter((t) => t.bot_id === b.bot_id).length >= b.max_concurrent_trades).length}
          subtitle={`of ${bots.length} configured`}
          icon={<Shield size={20} />}
          color="purple"
        />
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && bots.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-smc-card border border-smc-border rounded-xl">
          No bots configured yet — risk caps apply per bot once you create one.
        </div>
      )}

      <div className="space-y-3">
        {bots.map((bot) => {
          const botActive = activeTrades.filter((t) => t.bot_id === bot.bot_id).length;
          const botToday = todayTrades.filter((t) => t.bot_id === bot.bot_id).length;
          const atConcurrentCap = botActive >= bot.max_concurrent_trades;
          const atDailyCap = botToday >= bot.max_daily_trades;

          return (
            <div key={bot.bot_id} className="bg-smc-card border border-smc-border rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{bot.bot_name}</div>
                  <div className="text-xs text-gray-400">{bot.symbols.join(', ')}</div>
                </div>
                <button
                  onClick={() => startEdit(bot)}
                  className="text-xs font-medium text-smc-accent px-3 py-1.5 rounded-lg bg-smc-accent/10 hover:bg-smc-accent/20"
                >
                  {editingId === bot.bot_id ? 'Cancel' : 'Edit caps'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <div className="text-center p-2 bg-white/5 rounded-lg">
                  <div className="text-sm font-bold">{bot.risk_per_trade}%</div>
                  <div className="text-xs text-gray-400">Risk/trade</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${atDailyCap ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                  <div className={`text-sm font-bold ${atDailyCap ? 'text-amber-400' : ''}`}>{botToday}/{bot.max_daily_trades}</div>
                  <div className="text-xs text-gray-400">Today</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${atConcurrentCap ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                  <div className={`text-sm font-bold ${atConcurrentCap ? 'text-amber-400' : ''}`}>{botActive}/{bot.max_concurrent_trades}</div>
                  <div className="text-xs text-gray-400">Concurrent</div>
                </div>
                <div className="text-center p-2 bg-white/5 rounded-lg">
                  <div className="text-sm font-bold">{bot.max_portfolio_exposure}%</div>
                  <div className="text-xs text-gray-400">Max exposure</div>
                </div>
                <div className="text-center p-2 bg-white/5 rounded-lg">
                  <div className="text-sm font-bold">{bot.min_rr_ratio}:1</div>
                  <div className="text-xs text-gray-400">Min R:R</div>
                </div>
              </div>

              {editingId === bot.bot_id && editing && (
                <div className="mt-4 pt-4 border-t border-smc-border">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <label className="text-xs text-gray-400">
                      Risk/trade (%)
                      <input type="number" step="0.1" min="0.1" max="25" value={editing.risk_per_trade}
                        onChange={(e) => setEditing({ ...editing, risk_per_trade: Number(e.target.value) })}
                        className="w-full mt-1 bg-smc-bg border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max daily trades
                      <input type="number" step="1" min="1" max="200" value={editing.max_daily_trades}
                        onChange={(e) => setEditing({ ...editing, max_daily_trades: Number(e.target.value) })}
                        className="w-full mt-1 bg-smc-bg border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max concurrent
                      <input type="number" step="1" min="1" max="50" value={editing.max_concurrent_trades}
                        onChange={(e) => setEditing({ ...editing, max_concurrent_trades: Number(e.target.value) })}
                        className="w-full mt-1 bg-smc-bg border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max exposure (%)
                      <input type="number" step="0.5" min="0.1" max="100" value={editing.max_portfolio_exposure}
                        onChange={(e) => setEditing({ ...editing, max_portfolio_exposure: Number(e.target.value) })}
                        className="w-full mt-1 bg-smc-bg border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Min R:R
                      <input type="number" step="0.1" min="0.1" max="20" value={editing.min_rr_ratio}
                        onChange={(e) => setEditing({ ...editing, min_rr_ratio: Number(e.target.value) })}
                        className="w-full mt-1 bg-smc-bg border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                  </div>
                  <button
                    onClick={() => save(bot.bot_id)}
                    disabled={saving}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-smc-accent text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Save size={14} /> {saving ? 'Saving…' : 'Save caps'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
