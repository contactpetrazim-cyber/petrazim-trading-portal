
import { useEffect, useState } from 'react';
import { Bot, Play, Pause, Settings, TrendingUp, Save, Plus, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
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

const emptyNewBot = { bot_id: '', bot_name: '', bot_type: 'smc', symbols: [] as string[], exchange: '' };

// Quick exchange buttons — by direct request ("include the quick
// options for exchange Binance, Bybit, Bingx, Mexc"). These are the 4
// this platform has a real crypto broker integration for
// (execution_engine.py's own self.brokers keys); the form also
// carries a free-text field alongside them ("option to type in
// specific Exchange") for anything else — see BotConfigCreate.exchange's
// own comment for why that's safe to leave open-ended.
const QUICK_EXCHANGES = ['binance', 'bybit', 'bingx', 'mexc'];

interface InstrumentResult { symbol: string; base_asset: string; quote_asset: string }

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
    id: 'bot_5_jeafx', name: 'SMC BOT',
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
  // Exchange + Instrument section — folded (collapsed) by default, by
  // direct request ("allow the bot form to fold back - default is
  // folded closing the quick actions"), so the base form stays as
  // simple as it always was until a trader actually wants to pin an
  // exchange or search for an exact instrument.
  const [showExchangeSection, setShowExchangeSection] = useState(false);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [instrumentResults, setInstrumentResults] = useState<InstrumentResult[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Real, live-searchable instrument list — debounced so typing
  // doesn't fire a request per keystroke. Only runs while the
  // Exchange/Instrument section is actually open.
  useEffect(() => {
    if (!showExchangeSection) return;
    const t = setTimeout(() => {
      botsApi.searchInstruments(instrumentQuery).then(setInstrumentResults).catch(() => setInstrumentResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [instrumentQuery, showExchangeSection]);

  function addSymbol(raw: string) {
    const clean = raw.trim().toUpperCase();
    if (!clean || newBot.symbols.includes(clean)) return;
    setNewBot((b) => ({ ...b, symbols: [...b.symbols, clean] }));
    setInstrumentQuery('');
  }

  function removeSymbol(sym: string) {
    setNewBot((b) => ({ ...b, symbols: b.symbols.filter((s) => s !== sym) }));
  }

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
    if (!newBot.bot_id || !newBot.bot_name || newBot.symbols.length === 0) {
      setCreateError('Bot ID, name, and at least one symbol are required.');
      return;
    }
    try {
      await botsApi.createBot({
        bot_id: newBot.bot_id.trim(),
        bot_name: newBot.bot_name.trim(),
        bot_type: newBot.bot_type,
        symbols: newBot.symbols,
        exchange: newBot.exchange.trim() || null,
      });
      setShowCreate(false);
      setNewBot(emptyNewBot);
      setShowExchangeSection(false);
      setInstrumentQuery('');
      setInstrumentResults([]);
      loadBots();
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail || 'Could not create bot.');
    }
  }

  // Rename/delete — by direct request ("create options to edit bot
  // names and also to delete bots").
  function startRename(bot: BotConfig) {
    setRenamingId(bot.bot_id);
    setRenameValue(bot.bot_name);
  }

  async function saveRename(botId: string) {
    if (!renameValue.trim()) return;
    await botsApi.renameBot(botId, renameValue.trim());
    setRenamingId(null);
    loadBots();
  }

  async function deleteBot(botId: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await botsApi.deleteBot(botId);
      setConfirmDeleteId(null);
      if (selectedBot === botId) { setSelectedBot(null); setEditing(null); }
      loadBots();
    } catch (e: any) {
      setDeleteError(e?.response?.data?.detail || 'Could not delete this bot.');
    } finally {
      setDeleting(false);
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
                    {renamingId === bot.bot_id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(bot.bot_id); if (e.key === 'Escape') setRenamingId(null); }}
                          className={`text-sm font-bold px-1.5 py-0.5 rounded border ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg'}`}
                        />
                        <button onClick={() => saveRename(bot.bot_id)} className="text-emerald-500 hover:text-emerald-400" title="Save name">
                          <Save size={14} />
                        </button>
                        <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-300" title="Cancel">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold">{bot.bot_name}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(bot); }}
                          title="Rename bot" aria-label="Rename bot"
                          className="text-gray-400 hover:text-gray-300"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
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

                  {/* Delete — by direct request ("also to delete
                      bots"). Two-step inline confirm rather than a
                      native browser dialog, matching this page's own
                      custom-UI style everywhere else. */}
                  {confirmDeleteId === bot.bot_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400 flex-1">Delete "{bot.bot_name}" permanently?</span>
                      <button
                        onClick={() => deleteBot(bot.bot_id)} disabled={deleting}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${dark ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-600'}`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDeleteError(null); setConfirmDeleteId(bot.bot_id); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={13} /> Delete bot
                    </button>
                  )}
                  {deleteError && confirmDeleteId === bot.bot_id && (
                    <p className="text-xs text-red-400">{deleteError}</p>
                  )}

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
          <div className={`border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto ${dark ? "bg-smc-card border-smc-border" : "bg-white border-corporate-bg"}`} onClick={(e) => e.stopPropagation()}>
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

              {/* Selected symbols — chips, whether added via search or
                  typed directly (forex etc.) */}
              <div className="text-xs text-gray-400 block">
                Symbols
                {newBot.symbols.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1">
                    {newBot.symbols.map((s) => (
                      <span key={s} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${dark ? 'bg-white/10 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
                        {s}
                        <button onClick={() => removeSymbol(s)} aria-label={`Remove ${s}`} className="text-gray-400 hover:text-red-400">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Exchange & Instrument — folded by default (see its own
                  state comment above). */}
              <div className={`rounded-lg border overflow-hidden ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
                <button
                  onClick={() => setShowExchangeSection((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${dark ? 'bg-white/5 text-white/70' : 'bg-corporate-bg text-gray-600'}`}
                >
                  Exchange &amp; Instrument search
                  <ChevronDown size={14} className={`transition-transform ${showExchangeSection ? 'rotate-180' : ''}`} />
                </button>
                {showExchangeSection && (
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">
                        Exchange (quick options, or type your own)
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {QUICK_EXCHANGES.map((ex) => (
                          <button
                            key={ex}
                            onClick={() => setNewBot({ ...newBot, exchange: ex })}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                              newBot.exchange === ex
                                ? dark ? 'bg-smc-accent text-white' : 'bg-corporate-hero text-white'
                                : dark ? 'bg-white/10 text-white/60' : 'bg-white border border-corporate-bg text-gray-500'
                            }`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                      <input
                        placeholder="Or type a specific exchange…"
                        value={newBot.exchange} onChange={(e) => setNewBot({ ...newBot, exchange: e.target.value })}
                        className={`${inputCls} py-1.5`}
                      />
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">
                        Search instruments — real, live Binance pairs, exactly like the chart's own symbol search (removes typos); press Enter to add a typed symbol directly (e.g. a forex pair with no live search data).
                      </div>
                      <input
                        placeholder="Search e.g. BTC, ETH, EURUSD…"
                        value={instrumentQuery}
                        onChange={(e) => setInstrumentQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && instrumentQuery.trim()) { e.preventDefault(); addSymbol(instrumentQuery); } }}
                        className={`${inputCls} py-1.5`}
                      />
                      {instrumentResults.length > 0 && (
                        <div className={`mt-1.5 max-h-40 overflow-y-auto rounded-lg border ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
                          {instrumentResults.map((i) => (
                            <button
                              key={i.symbol}
                              onClick={() => addSymbol(i.symbol)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left ${dark ? 'hover:bg-white/5 text-white/80' : 'hover:bg-corporate-bg text-corporate-text-on-bg'}`}
                            >
                              <span className="font-semibold">{i.symbol}</span>
                              <span className="text-gray-400">{i.base_asset}/{i.quote_asset}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
