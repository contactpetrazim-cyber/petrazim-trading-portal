
import { useEffect, useMemo, useState } from 'react';
import { Shield, Save, AlertTriangle, DollarSign, Calculator, TrendingDown } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { StatCard } from '../components/StatCard';
import { FoldedCard } from '../components/FoldedCard';
import { botsApi, tradesApi } from '../services/api';
import { BotConfig, BotMetricsUpdate, Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';

/**
 * RiskPage — "Risk Management". Previously /risk didn't exist as its
 * own page at all: App.tsx routed it straight to <DashboardPage />
 * (the exact same component /dashboard renders), so clicking it in
 * the sidebar visibly did nothing — the page just looked identical to
 * the one you were already on. This is the real thing: per-bot risk
 * caps (risk per trade, daily/concurrent trade limits, portfolio
 * exposure, min R:R), each shown against real live usage and editable
 * in place via the same PATCH /bots/{id}/metrics Bots.tsx uses.
 *
 * Two additions, by direct request ("include dynamic position sizing
 * and drawdown"):
 *   - Max Drawdown stat card, computed peak-to-trough over the same
 *     real closed-trade cumulative-P&L series already built below for
 *     the "Cumulative P&L" chart — not a second, disconnected number.
 *   - A Position Size Calculator: "dynamic" in the sense that it
 *     recomputes live from account balance + risk % + entry/stop price
 *     as you type, unlike a bot's risk_per_trade cap above (a fixed
 *     setting, not a per-trade sizing tool). No stored "account
 *     balance" exists anywhere in this app (grepped — Tools/Payout
 *     Optimizer's own `balance` field is a funded-account concept, not
 *     a Trader account balance), so this is a self-contained client-
 *     side calculator, seeded from the risk_per_trade of whichever bot
 *     you last edited above when there is one, editable either way.
 */
export function RiskPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const inputCls = `w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${
    dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
  }`;
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [todayTrades, setTodayTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BotMetricsUpdate | null>(null);
  const [saving, setSaving] = useState(false);

  // Position Size Calculator — client-side, "dynamic" (recomputes as
  // you type). Seeded from the first configured bot's own risk_per_trade
  // once bots load, so it starts from a real number rather than an
  // arbitrary default; still freely editable either way.
  const [accountBalance, setAccountBalance] = useState(10000);
  const [sizingRiskPct, setSizingRiskPct] = useState(1);
  const [entryPrice, setEntryPrice] = useState<number | ''>('');
  const [stopPrice, setStopPrice] = useState<number | ''>('');
  const [seededSizing, setSeededSizing] = useState(false);

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
      setAllTrades(all);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      setTodayTrades(all.filter((t) => new Date(t.created_at) >= todayStart));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Seed the calculator's risk % from the first real bot once, the
  // first time bots load — never overwrites a value you've since typed.
  useEffect(() => {
    if (!seededSizing && bots.length > 0) {
      setSizingRiskPct(bots[0].risk_per_trade);
      setSeededSizing(true);
    }
  }, [bots, seededSizing]);

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

  // Risk and P/L together, not risk alone, by direct request ("include
  // P/L in Risk Management so you can see both risk and benefit") —
  // chronological series from the same real trades already fetched.
  const closedTrades = allTrades
    .filter((t) => t.status === 'closed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let running = 0;
  const seriesData = closedTrades.map((t, i) => {
    running += t.realized_pnl || 0;
    return {
      index: i + 1,
      date: new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      risk_percent: t.risk_percent || 0,
      pnl: t.realized_pnl || 0,
      cumulative: running,
    };
  });
  const totalPnl = running;

  // Max Drawdown — peak-to-trough of the same cumulative P&L series
  // above, in $ (this page's own real closed trades have no equity
  // baseline to express it as a %, same honest-unit reasoning as
  // dashboard.py's own intraday drawdown).
  const maxDrawdown = seriesData.reduce(
    (acc, d) => {
      const peak = Math.max(acc.peak, d.cumulative);
      return { peak, maxDd: Math.max(acc.maxDd, peak - d.cumulative) };
    },
    { peak: 0, maxDd: 0 }
  ).maxDd;

  // Dynamic Position Size — riskAmount / stopDistance, recomputed live.
  const sizing = useMemo(() => {
    const riskAmount = accountBalance * (sizingRiskPct / 100);
    const entry = typeof entryPrice === 'number' ? entryPrice : null;
    const stop = typeof stopPrice === 'number' ? stopPrice : null;
    const stopDistance = entry != null && stop != null ? Math.abs(entry - stop) : null;
    const positionSize = stopDistance && stopDistance > 0 ? riskAmount / stopDistance : null;
    return { riskAmount, stopDistance, positionSize };
  }, [accountBalance, sizingRiskPct, entryPrice, stopPrice]);

  const gridColor = dark ? '#1f2937' : '#e5e7eb';
  const axisColor = '#6b7280';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Shield size={22} className={dark ? "text-smc-accent" : "text-corporate-hero"} /> Risk Management</h2>
        <p className="text-gray-400 text-sm mt-1">Live exposure and per-bot risk caps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Open Risk Exposure"
          value={`${exposurePct.toFixed(2)}%`}
          subtitle={`Across ${totalActive} open trade${totalActive === 1 ? '' : 's'}`}
          icon={<Shield size={20} />}
          color={exposurePct > 10 ? 'red' : 'blue'} dark={dark}
        />
        <StatCard
          title="Realized P&L"
          subtitle="Across closed trades shown below"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
          icon={<DollarSign size={20} />}
          color={totalPnl >= 0 ? 'green' : 'red'} dark={dark}
        />
        <StatCard
          title="Max Drawdown"
          subtitle="Peak-to-trough, closed trades below"
          value={`-$${maxDrawdown.toFixed(2)}`}
          icon={<TrendingDown size={20} />}
          color={maxDrawdown > 0 ? 'amber' : 'blue'} dark={dark}
        />
        <StatCard
          title="Trades Today"
          value={`${todayTrades.length} / ${totalDailyCap || '—'}`}
          subtitle="Used vs. combined daily cap across all bots"
          icon={<AlertTriangle size={20} />}
          color={totalDailyCap > 0 && todayTrades.length >= totalDailyCap ? 'amber' : 'blue'} dark={dark}
        />
        <StatCard
          title="Bots at Concurrent Cap"
          value={bots.filter((b) => activeTrades.filter((t) => t.bot_id === b.bot_id).length >= b.max_concurrent_trades).length}
          subtitle={`of ${bots.length} configured`}
          icon={<Shield size={20} />}
          color="purple" dark={dark}
        />
      </div>

      {/* Dynamic Position Size Calculator — by direct request ("include
          dynamic position sizing"). Purely client-side; recomputes live
          as any input changes. */}
      <FoldedCard title="Position Size Calculator" summary="Risk amount and position size, recomputed live" icon={<Calculator size={19} />} dark={dark} defaultOpen>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-400">
            Account balance ($)
            <input type="number" step="1" min="0" value={accountBalance}
              onChange={(e) => setAccountBalance(Number(e.target.value) || 0)}
              className={inputCls} />
          </label>
          <label className="text-xs text-gray-400">
            Risk (%)
            <input type="number" step="0.1" min="0.1" max="100" value={sizingRiskPct}
              onChange={(e) => setSizingRiskPct(Number(e.target.value) || 0)}
              className={inputCls} />
          </label>
          <label className="text-xs text-gray-400">
            Entry price
            <input type="number" step="any" value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 1.0950" className={inputCls} />
          </label>
          <label className="text-xs text-gray-400">
            Stop-loss price
            <input type="number" step="any" value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 1.0920" className={inputCls} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className={`text-center p-3 rounded-lg ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
            <div className="text-sm font-bold">${sizing.riskAmount.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Risk amount</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
            <div className="text-sm font-bold">{sizing.stopDistance != null ? sizing.stopDistance.toFixed(5) : '—'}</div>
            <div className="text-xs text-gray-400">Stop distance</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
            <div className="text-sm font-bold">{sizing.positionSize != null ? sizing.positionSize.toFixed(2) : '—'}</div>
            <div className="text-xs text-gray-400">Position size (units)</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Position size = (account balance × risk%) ÷ |entry − stop|. Units are whatever your entry/stop
          prices are quoted in — for FX pairs convert to lots using your broker's own lot/unit size.
        </p>
      </FoldedCard>

      {/* Risk, P/L, and cumulative profiles over time — "so you can see
          both risk and benefit," by direct request — from the same
          real closed trades, chronological. */}
      {seriesData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FoldedCard title="Risk Profile Over Time" summary="Risk % per closed trade" dark={dark} defaultOpen>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="risk_percent" name="Risk %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </FoldedCard>

          <FoldedCard title="P&L Profile Over Time" summary="Realized P&L per closed trade" dark={dark} defaultOpen>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="pnl" name="P&L">
                  {seriesData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </FoldedCard>

          <FoldedCard title="Cumulative P&L" summary="Running total, closed trades" dark={dark} defaultOpen>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={seriesData}>
                <defs>
                  <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="cumulative" name="Cumulative P&L" stroke="#3b82f6" strokeWidth={2} fill="url(#cumulativeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </FoldedCard>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && bots.length === 0 && (
        <div className={`text-center py-16 text-gray-400 border rounded-xl ${dark ? "bg-smc-card border-smc-border" : "bg-white border-corporate-bg"}`}>
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
            <div key={bot.bot_id} className={`border rounded-xl p-5 ${dark ? "bg-smc-card border-smc-border" : "bg-white border-corporate-bg"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{bot.bot_name}</div>
                  <div className="text-xs text-gray-400">{bot.symbols.join(', ')}</div>
                </div>
                <button
                  onClick={() => startEdit(bot)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg ${dark ? "text-smc-accent bg-smc-accent/10 hover:bg-smc-accent/20" : "text-corporate-hero bg-corporate-hero/10 hover:bg-corporate-hero/20"}`}
                >
                  {editingId === bot.bot_id ? 'Cancel' : 'Edit caps'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-sm font-bold">{bot.risk_per_trade}%</div>
                  <div className="text-xs text-gray-400">Risk/trade</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${atDailyCap ? 'bg-amber-500/10' : dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
                  <div className={`text-sm font-bold ${atDailyCap ? 'text-amber-400' : ''}`}>{botToday}/{bot.max_daily_trades}</div>
                  <div className="text-xs text-gray-400">Today</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${atConcurrentCap ? 'bg-amber-500/10' : dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
                  <div className={`text-sm font-bold ${atConcurrentCap ? 'text-amber-400' : ''}`}>{botActive}/{bot.max_concurrent_trades}</div>
                  <div className="text-xs text-gray-400">Concurrent</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-sm font-bold">{bot.max_portfolio_exposure}%</div>
                  <div className="text-xs text-gray-400">Max exposure</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-sm font-bold">{bot.min_rr_ratio}:1</div>
                  <div className="text-xs text-gray-400">Min R:R</div>
                </div>
              </div>

              {editingId === bot.bot_id && editing && (
                <div className={`mt-4 pt-4 border-t ${dark ? "border-smc-border" : "border-corporate-bg"}`}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <label className="text-xs text-gray-400">
                      Risk/trade (%)
                      <input type="number" step="0.1" min="0.1" max="25" value={editing.risk_per_trade}
                        onChange={(e) => setEditing({ ...editing, risk_per_trade: Number(e.target.value) })}
                        className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max daily trades
                      <input type="number" step="1" min="1" max="200" value={editing.max_daily_trades}
                        onChange={(e) => setEditing({ ...editing, max_daily_trades: Number(e.target.value) })}
                        className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max concurrent
                      <input type="number" step="1" min="1" max="50" value={editing.max_concurrent_trades}
                        onChange={(e) => setEditing({ ...editing, max_concurrent_trades: Number(e.target.value) })}
                        className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-400">
                      Max exposure (%)
                      <input type="number" step="0.5" min="0.1" max="100" value={editing.max_portfolio_exposure}
                        onChange={(e) => setEditing({ ...editing, max_portfolio_exposure: Number(e.target.value) })}
                        className={inputCls} />
                    </label>
                    <label className="text-xs text-gray-400">
                      Min R:R
                      <input type="number" step="0.1" min="0.1" max="20" value={editing.min_rr_ratio}
                        onChange={(e) => setEditing({ ...editing, min_rr_ratio: Number(e.target.value) })}
                        className={inputCls} />
                    </label>
                  </div>
                  <button
                    onClick={() => save(bot.bot_id)}
                    disabled={saving}
                    className={`mt-3 flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${dark ? "bg-smc-accent" : "bg-corporate-hero"}`}
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
