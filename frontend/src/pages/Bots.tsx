
import { useEffect, useState } from 'react';
import { Bot, Play, Pause, Settings, TrendingUp, Save, Plus, X } from 'lucide-react';
import { botsApi } from '../services/api';
import { BotConfig, BotPerformance, BotMetricsUpdate } from '../types';
import { useThemeStore } from '../hooks/useTheme';

/**
 * BotsPage — "Bot Configuration". Was 5 hardcoded bots with dead
 * buttons (Start/Pause/Switch mode had no onClick at all) and no way
 * to change a single metric. Now:
 *   - real bots from GET /bots/ (owned by the logged-in Trader; see
 *     routers/bots.py's ownership scoping)
 *   - real per-bot win-rate/trades/profit-factor from GET
 *     /bots/{id}/performance (used to always return zeros — now
 *     computed from actual closed trades)
 *   - Start/Pause and the mode switch actually call the backend
 *   - risk_per_trade, max_daily_trades, max_concurrent_trades,
 *     max_portfolio_exposure, and min_rr_ratio are editable inline and
 *     saved via the new PATCH /bots/{id}/metrics
 *   - a bot can actually be created — every real account starts with
 *     zero bots, and there was no way to add one from this page
 */

const emptyNewBot = { bot_id: '', bot_name: '', bot_type: 'smc', symbols: '' };

// The 5 REAL strategies core/bot_strategies.py actually implements —
// bot_id must be one of these exact 5 values for BotOrchestrator to
// ever dispatch a real signal to it; anything else is a BotConfig row
// with no matching strategy engine, i.e. a bot that will never
// actually trade. This dropdown replaces a free-text "Bot ID" field
// that let someone create exactly that, by direct request to show a
// short summary of the bot's technique/style before picking one.
const BOT_CATALOG = [
  {
    id: 'bot_1_macro_swing', name: 'Pure Macro Swing Structure',
    summary: 'Patient multi-day swing trades on confirmed 1D/4H structure breaks, entered on a pullback — low frequency, high R:R (5:1+).',
  },
  {
    id: 'bot_2_ob_reversal', name: 'HF Order Block Reversal',
    summary: 'Fast reversals inside higher-timeframe order blocks, confirmed by a 15m liquidity sweep + CHoCH — higher frequency, 3:1 target.',
  },
  {
    id: 'bot_3_fvg_expansion', name: 'FVG Expansion & Fill',
    summary: 'Trades unmitigated fair-value-gap retests after strong expansion moves, trailing the stop on new structure breaks — momentum/runner style.',
  },
  {
    id: 'bot_4_volume_liq', name: 'Volume & Liquidity Sweep',
    summary: 'Wyckoff-style spring/upthrust false-breakout patterns confirmed by volume divergence — range accumulation/distribution trades.',
  },
  {
    id: 'bot_5_jeafx', name: 'Jeafx SMC Specialist',
    summary: 'Highly mechanical liquidity-purge and refined supply/demand entries with strict confirmation criteria — highest target R:R (4:1-6:1).',
  },
];

export function BotsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const inputCls = `w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${
    dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
  }`;
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [performance, setPerformance] = useState<Record<string, BotPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [editing, setEditing] = useState<BotMetricsUpdate | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBot, setNewBot] = useState(emptyNewBot);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadBots() {
    setLoading(true);
    try {
      const data = await botsApi.getBots();
      setBots(data);
      const perfEntries = await Promise.all(
        data.map(async (b) => [b.bot_id, await botsApi.getPerformance(b.bot_id).catch(() => null)] as const)
      );
      const perfMap: Record<string, BotPerformance> = {};
      for (const [id, perf] of perfEntries) if (perf) perfMap[id] = perf;
      setPerformance(perfMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBots(); }, []);

  function openBot(bot: BotConfig) {
    if (selectedBot === bot.bot_id) {
      setSelectedBot(null);
      setEditing(null);
      return;
    }
    setSelectedBot(bot.bot_id);
    setEditing({
      risk_per_trade: bot.risk_per_trade,
      max_daily_trades: bot.max_daily_trades,
      max_concurrent_trades: bot.max_concurrent_trades,
      max_portfolio_exposure: bot.max_portfolio_exposure,
      min_rr_ratio: bot.min_rr_ratio,
      use_trailing_stop: bot.use_trailing_stop,
    });
  }

  async function toggleBot(bot: BotConfig) {
    await botsApi.toggleBot(bot.bot_id, bot.status !== 'active');
    loadBots();
  }

  async function switchMode(bot: BotConfig) {
    const next = bot.execution_mode === 'fully_autonomous' ? 'human_in_loop' : 'fully_autonomous';
    await botsApi.setMode(bot.bot_id, next);
    loadBots();
  }

  async function saveMetrics(botId: string) {
    if (!editing) return;
    setSaving(true);
    try {
      await botsApi.updateMetrics(botId, editing);
      await loadBots();
    } finally {
      setSaving(false);
    }
  }

  async function createBot() {
    setCreateError(null);
    if (!newBot.bot_id || !newBot.bot_name || !newBot.symbols) {
      setCreateError('Bot ID, name, and at least one symbol are required.');
      return;
    }
    try {
      await botsApi.createBot({
        bot_id: newBot.bot_id.trim(),
        bot_name: newBot.bot_name.trim(),
        bot_type: newBot.bot_type,
        symbols: newBot.symbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
      });
      setShowCreate(false);
      setNewBot(emptyNewBot);
      loadBots();
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail || 'Could not create bot.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bot Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">
            {bots.length > 0 ? `Manage your ${bots.length} SMC trading bot${bots.length === 1 ? '' : 's'}` : 'No bots configured yet'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
            dark ? 'bg-smc-accent hover:bg-smc-accent/90' : 'bg-corporate-hero hover:bg-corporate-accent-hover'
          }`}
        >
          <Plus size={16} /> New Bot
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && bots.length === 0 && (
        <div className={`text-center py-16 text-gray-400 border rounded-xl ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}>
          No bots yet — create one to start trading.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bots.map((bot) => {
          const perf = performance[bot.bot_id];
          return (
            <div
              key={bot.bot_id}
              className={`border rounded-xl p-6 transition-all cursor-pointer ${dark ? 'bg-smc-card' : 'bg-white'} ${
                selectedBot === bot.bot_id
                  ? dark ? 'border-smc-accent ring-1 ring-smc-accent/30' : 'border-corporate-hero ring-1 ring-corporate-hero/30'
                  : dark ? 'border-smc-border hover:border-smc-accent/30' : 'border-corporate-bg hover:border-corporate-hero/30'
              }`}
              onClick={() => openBot(bot)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dark ? 'bg-smc-accent/10' : 'bg-corporate-hero/10'}`}>
                    <Bot className={dark ? 'text-smc-accent' : 'text-corporate-hero'} size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">{bot.bot_name}</h3>
                    <p className="text-xs text-gray-400">{bot.bot_type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    bot.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {bot.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    bot.execution_mode === 'fully_autonomous' ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {bot.execution_mode === 'fully_autonomous' ? 'Auto' : 'HITL'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-lg font-bold">{perf ? `${perf.win_rate}%` : '—'}</div>
                  <div className="text-xs text-gray-400">Win Rate</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-lg font-bold">{perf ? perf.total_trades : '—'}</div>
                  <div className="text-xs text-gray-400">Trades</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-lg font-bold">{bot.min_rr_ratio}:1</div>
                  <div className="text-xs text-gray-400">Min R:R</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${dark ? "bg-white/5" : "bg-corporate-bg"}`}>
                  <div className="text-lg font-bold">{bot.risk_per_trade}%</div>
                  <div className="text-xs text-gray-400">Risk</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
                <TrendingUp size={12} />
                <span>{bot.symbols.join(', ')}</span>
              </div>

              {selectedBot === bot.bot_id && editing && (
                <div className={`mt-4 pt-4 border-t space-y-4 ${dark ? "border-smc-border" : "border-corporate-bg"}`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-gray-400" />
                    <span className="text-sm font-medium">Quick Actions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBot(bot)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bot.status === 'active'
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {bot.status === 'active'
                        ? <><Pause size={14} className="inline mr-1" /> Pause</>
                        : <><Play size={14} className="inline mr-1" /> Start</>}
                    </button>
                    <button
                      onClick={() => switchMode(bot)}
                      className="flex-1 px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-colors"
                    >
                      {bot.execution_mode === 'fully_autonomous' ? 'Switch to HITL' : 'Switch to Auto'}
                    </button>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Risk Metrics</div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-gray-400">
                        Risk per trade (%)
                        <input
                          type="number" step="0.1" min="0.1" max="25"
                          value={editing.risk_per_trade}
                          onChange={(e) => setEditing({ ...editing, risk_per_trade: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Min R:R
                        <input
                          type="number" step="0.1" min="0.1" max="20"
                          value={editing.min_rr_ratio}
                          onChange={(e) => setEditing({ ...editing, min_rr_ratio: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Max daily trades
                        <input
                          type="number" step="1" min="1" max="200"
                          value={editing.max_daily_trades}
                          onChange={(e) => setEditing({ ...editing, max_daily_trades: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Max concurrent trades
                        <input
                          type="number" step="1" min="1" max="50"
                          value={editing.max_concurrent_trades}
                          onChange={(e) => setEditing({ ...editing, max_concurrent_trades: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs text-gray-400 col-span-2">
                        Max portfolio exposure (%)
                        <input
                          type="number" step="0.5" min="0.1" max="100"
                          value={editing.max_portfolio_exposure}
                          onChange={(e) => setEditing({ ...editing, max_portfolio_exposure: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-400 col-span-2 mt-1">
                        <input
                          type="checkbox"
                          checked={!!editing.use_trailing_stop}
                          onChange={(e) => setEditing({ ...editing, use_trailing_stop: e.target.checked })}
                        />
                        Use trailing stop
                      </label>
                    </div>
                    <button
                      onClick={() => saveMetrics(bot.bot_id)}
                      disabled={saving}
                      className={`w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${dark ? "bg-smc-accent" : "bg-corporate-hero"}`}
                    >
                      <Save size={14} /> {saving ? 'Saving…' : 'Save metrics'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className={`border rounded-xl p-6 w-full max-w-sm ${dark ? "bg-smc-card border-smc-border" : "bg-white border-corporate-bg"}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">New Bot</h3>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <label className="text-xs text-gray-400 block">
                Strategy
                <select
                  value={newBot.bot_id}
                  onChange={(e) => {
                    const chosen = BOT_CATALOG.find((b) => b.id === e.target.value);
                    setNewBot({ ...newBot, bot_id: e.target.value, bot_name: chosen?.name || '' });
                  }}
                  className={`${inputCls} py-2`}
                >
                  <option value="">Choose a strategy…</option>
                  {BOT_CATALOG.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              {newBot.bot_id && (
                <p className={`text-xs -mt-1.5 leading-relaxed ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                  {BOT_CATALOG.find((b) => b.id === newBot.bot_id)?.summary}
                </p>
              )}
              <label className="text-xs text-gray-400 block">
                Name
                <input value={newBot.bot_name} onChange={(e) => setNewBot({ ...newBot, bot_name: e.target.value })}
                  className={`${inputCls} py-2`} />
              </label>
              <label className="text-xs text-gray-400 block">
                Symbols (comma-separated, e.g. BTCUSDT, EURUSD)
                <input value={newBot.symbols} onChange={(e) => setNewBot({ ...newBot, symbols: e.target.value })}
                  className={`${inputCls} py-2`} />
              </label>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <button onClick={createBot} className={`w-full text-white font-medium py-2.5 rounded-lg text-sm ${dark ? "bg-smc-accent" : "bg-corporate-hero"}`}>
                Create bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
