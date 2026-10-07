
import { useEffect, useState } from 'react';
import { Bot, Play, Pause, Settings, TrendingUp, Save, Plus, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { botsApi } from '../services/api';
import { BotSleepAndSubAuto } from '../components/BotSleepAndSubAuto';
import { BotConfig, BotPerformance, BotMetricsUpdate } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { formatApiError } from '../lib/apiError';


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

interface InstrumentResult { symbol: string; base_asset: string; quote_asset: string; market: 'spot' | 'futures' }

// The 5 REAL strategies core/bot_strategies.py actually implements —
// bot_id must be one of these exact 5 values for BotOrchestrator to
// ever dispatch a real signal to it; anything else is a BotConfig row
// with no matching strategy engine, i.e. a bot that will never
// actually trade. This dropdown replaces a free-text "Bot ID" field
// that let someone create exactly that, by direct request to show a
// short summary of the bot's technique/style before picking one.
// `key` — which of the 5 fixed algorithms this catalog entry runs
// (BotOrchestrator.bots' own keys, app/core/bot_strategies.py) — by
// direct request ("I don't mind repeating the bot strategy ... we
// should always be able to update or add bots ... from now for the
// future"). Sent as strategy_key on create; `id` here is just the
// FIRST bot's own bot_id for that strategy, still used as the base a
// unique id is generated from — see createBot's own comment for why
// it can no longer be sent as the real bot_id unconditionally.
const BOT_CATALOG = [
  {
    id: 'bot_1_macro_swing', key: 'bot_1', name: 'Pure Macro Swing Structure',
    summary: 'Patient multi-day swing trades on confirmed 1D/4H structure breaks, entered on a pullback — low frequency, high R:R (5:1+).',
  },
  {
    id: 'bot_2_ob_reversal', key: 'bot_2', name: 'HF Order Block Reversal',
    summary: 'Fast reversals inside higher-timeframe order blocks, confirmed by a 15m liquidity sweep + CHoCH — higher frequency, 3:1 target.',
  },
  {
    id: 'bot_3_fvg_expansion', key: 'bot_3', name: 'FVG Expansion & Fill',
    summary: 'Trades unmitigated fair-value-gap retests after strong expansion moves, trailing the stop on new structure breaks — momentum/runner style.',
  },
  {
    id: 'bot_4_volume_liq', key: 'bot_4', name: 'Volume & Liquidity Sweep',
    summary: 'Wyckoff-style spring/upthrust false-breakout patterns confirmed by volume divergence — range accumulation/distribution trades.',
  },
  {
    id: 'bot_5_jeafx', key: 'bot_5', name: 'SMC BOT',
    summary: 'Highly mechanical liquidity-purge and refined supply/demand entries with strict confirmation criteria — highest target R:R (4:1-6:1).',
  },
  {
    id: 'bot_6_smc_v2', key: 'bot_6', name: 'SMC v2',
    summary: 'Same zone/purge/confirmation setup as SMC BOT, but direction comes from HF Order Block Reversal + FVG Expansion’s own calls agreeing — by direct request, after the original’s sweep-based direction was found to miss more often.',
  },
];

export function BotsPage() {
  const { portalThemes } = useThemeStore();
  const theme = portalThemes.trader;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Master Bot Control — the Admin's platform-wide override of every
  // bot's own Starting Reference Capital, by direct request ("Create a
  // master bot control for bot starting reference capital and balance
  // ... put master in Admin portal to supersede all"). Fetched once
  // here (not per-bot) so effectiveBalance below can resolve the SAME
  // precedence the backend actually enforces (master, else the bot's
  // own account_balance_usd, else the platform default).
  const [masterBalance, setMasterBalance] = useState<{ enabled: boolean; value: number; platform_default: number } | null>(null);
  useEffect(() => { botsApi.getMasterAccountBalance().then(setMasterBalance).catch(() => {}); }, []);
  // Same pattern as Master Bot Control above, for leverage — by direct
  // request ("put a form to set leverage for Bot and manual -
  // separately on the trader dashboard ... with a global override
  // form in the Admin").
  const [masterLeverage, setMasterLeverage] = useState<{ enabled: boolean; value: number; platform_default: number } | null>(null);
  useEffect(() => { botsApi.getMasterLeverage().then(setMasterLeverage).catch(() => {}); }, []);
  function effectiveLeverage(bot: BotConfig): number {
    if (masterLeverage?.enabled) return masterLeverage.value;
    if (bot.leverage != null) return bot.leverage;
    return masterLeverage?.platform_default ?? 50;
  }
  function effectiveBalance(bot: BotConfig): number {
    if (masterBalance?.enabled) return masterBalance.value;
    if (bot.account_balance_usd != null) return bot.account_balance_usd;
    return masterBalance?.platform_default ?? 10_000;
  }

  async function loadBots() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await botsApi.getBots();
      setBots(data);
      const perfEntries = await Promise.all(
        data.map(async (b) => [b.bot_id, await botsApi.getPerformance(b.bot_id).catch(() => null)] as const)
      );
      const perfMap: Record<string, BotPerformance> = {};
      for (const [id, perf] of perfEntries) if (perf) perfMap[id] = perf;
      setPerformance(perfMap);
    } catch {
      setLoadError('Could not load your bots.');
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

  // Same instrument-search pattern as the "New Bot" form above, with
  // its own local state (rather than sharing instrumentQuery/Results)
  // so the two search boxes — this one and the New Bot modal's, which
  // could technically both be mounted at once — never cross-talk.
  const [editSymbolQuery, setEditSymbolQuery] = useState('');
  const [editSymbolResults, setEditSymbolResults] = useState<InstrumentResult[]>([]);
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => {
      botsApi.searchInstruments(editSymbolQuery).then(setEditSymbolResults).catch(() => setEditSymbolResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [editSymbolQuery, editing]);

  function addEditSymbol(raw: string) {
    const clean = raw.trim().toUpperCase();
    if (!clean || !editing || editing.symbols?.includes(clean)) return;
    setEditing({ ...editing, symbols: [...(editing.symbols ?? []), clean] });
    setEditSymbolQuery('');
  }

  function removeEditSymbol(sym: string) {
    if (!editing) return;
    setEditing({ ...editing, symbols: (editing.symbols ?? []).filter((s) => s !== sym) });
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
      account_balance_usd: bot.account_balance_usd,
      leverage: bot.leverage,
      // Editable instrument pairs — by direct request ("create an
      // option to edit the instrument pairs of each bot"). The
      // backend's own PATCH /bots/{id}/metrics already accepted
      // `symbols` (BotMetricsUpdate.symbols, applied via
      // exclude_unset=True same as every other field here) — this was
      // never actually populated/editable from this form, only from
      // the separate "New Bot" creation form.
      symbols: [...bot.symbols],
    });
    setEditSymbolQuery('');
    setEditSymbolResults([]);
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

  // Same Test/Live + Paper Trading pair Manual Trading already has,
  // now per-bot — by direct request ("do the same and do paper
  // trading for bot trading ... with a test/paper trading toggle ...
  // so we can use paper trading in test mode ... with an additional
  // option to toggle paper trading in live mode"). Both independent,
  // exactly like the manual pair: switching trading_mode never touches
  // paper_trading_enabled and vice versa.
  async function switchTradingMode(bot: BotConfig) {
    const next = bot.trading_mode === 'live' ? 'test' : 'live';
    await botsApi.setTradingMode(bot.bot_id, { trading_mode: next });
    loadBots();
  }

  async function togglePaperTrading(bot: BotConfig) {
    await botsApi.setTradingMode(bot.bot_id, { paper_trading_enabled: !bot.paper_trading_enabled });
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
    // `newBot.bot_id` here is still the Strategy dropdown's own fixed
    // catalog id (e.g. "bot_3_fvg_expansion") — picking a strategy
    // already in use used to send that SAME id again, which
    // BotConfig.bot_id's own unique constraint correctly rejected
    // ("Could not create bot.", by direct bug report: "I cant seem to
    // be able to create more than 5 bots even though I don't mind
    // repeating the bot strategy"). Now generates a fresh, unique id
    // off that same base (bot_3_fvg_expansion -> _2 -> _3 -> ...) by
    // checking against the trader's own already-loaded bots, while
    // strategy_key (the catalog entry's own fixed key) tells the
    // backend's dispatch engine which of the 5 algorithms to actually
    // run for it — see BotOrchestrator.run_all's own comment.
    const catalogEntry = BOT_CATALOG.find((b) => b.id === newBot.bot_id);
    const base = newBot.bot_id.trim();
    const existingIds = new Set(bots.map((b) => b.bot_id));
    let uniqueId = base;
    for (let n = 2; existingIds.has(uniqueId); n++) uniqueId = `${base}_${n}`;
    try {
      await botsApi.createBot({
        bot_id: uniqueId,
        strategy_key: (catalogEntry?.key ?? base) as 'bot_1' | 'bot_2' | 'bot_3' | 'bot_4' | 'bot_5' | 'bot_6',
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
      setCreateError(formatApiError(e?.response?.data?.detail, 'Could not create bot.'));
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
      setDeleteError(formatApiError(e?.response?.data?.detail, 'Could not delete this bot.'));
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

      {!loading && loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-smc-danger/30 bg-smc-danger/10 p-3 text-sm text-smc-danger">
          <span>{loadError}</span>
          <button type="button" onClick={loadBots} className="font-semibold underline">Try again</button>
        </div>
      )}

      {!loading && !loadError && bots.length === 0 && (
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
                  {/* Test/Live + Paper Trading — same visible-badge
                      principle TradingModeBadge already established
                      elsewhere, now per-bot so it's obvious at a glance
                      whether THIS bot's next signal can touch a real
                      broker. */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    bot.trading_mode === 'live' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {bot.trading_mode === 'live' ? 'Live' : 'Test'}
                  </span>
                  {bot.paper_trading_enabled && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                      Paper
                    </span>
                  )}
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
                  <div className="text-xs text-gray-400">
                    Risk — ${((bot.risk_per_trade / 100) * effectiveBalance(bot)).toFixed(2)}
                  </div>
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

                  {/* Test/Live + Paper Trading — independent toggles,
                      same pair as Manual Trading's own header. Mode:
                      Test never reaches a real broker for this bot's
                      signals; Paper Trading stays available even once
                      Live, diverting only the final fill. */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => switchTradingMode(bot)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bot.trading_mode === 'live'
                          ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                          : dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Mode: {bot.trading_mode === 'live' ? 'Live' : 'Test'} — switch to {bot.trading_mode === 'live' ? 'Test' : 'Live'}
                    </button>
                    <button
                      onClick={() => togglePaperTrading(bot)}
                      title="Paper Trading stays available in both Test and Live — when on, this bot's orders never reach a real broker, even in Live mode, but still run the real broker-selection and price checks a live order would face."
                      className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bot.paper_trading_enabled ? 'bg-amber-500/15 text-amber-600' : dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${bot.paper_trading_enabled ? 'bg-amber-500' : dark ? 'bg-white/20' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${bot.paper_trading_enabled ? 'translate-x-4' : ''}`} />
                      </span>
                      Paper Trading: {bot.paper_trading_enabled ? 'On' : 'Off'}
                    </button>
                  </div>

                  {/* Sleep / Sub-Auto Mode — by direct request. */}
                  <BotSleepAndSubAuto bot={bot} dark={dark} onChanged={loadBots} />

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
                      {/* Same value as Risk per trade (%) above, just in
                          dollars — against the real reference balance
                          every bot's own signal sizing is actually
                          computed with (effectiveBalance — master
                          override, else this bot's own Starting
                          Reference Capital right below, else the
                          platform default). Editing either field
                          updates risk_per_trade to match; only
                          risk_per_trade is ever actually saved — this
                          is purely a $ view of the same number, by
                          direct request ("add risk amount to the bot
                          Risk Amount (USD)"). */}
                      <label className="text-xs text-gray-400">
                        Risk Amount (USD)
                        <input
                          type="number" step="1" min="0"
                          value={(((editing.risk_per_trade ?? 0) / 100) * (editing.account_balance_usd ?? effectiveBalance(bot))).toFixed(2)}
                          onChange={(e) => {
                            const usd = Number(e.target.value);
                            const base = editing.account_balance_usd ?? effectiveBalance(bot);
                            setEditing({ ...editing, risk_per_trade: Math.round((usd / base) * 100 * 100) / 100 });
                          }}
                          className={inputCls}
                        />
                      </label>
                      {/* Starting Reference Capital/Balance — by direct
                          request ("Create a master bot control for bot
                          starting reference capital and balance").
                          This IS the real balance the bot's own signal
                          sizing is computed against (see BotConfig.
                          account_balance_usd's own backend comment) —
                          disabled and explained when the Admin master
                          override is on, since it would have no effect
                          while that's superseding every bot. */}
                      <label className="text-xs text-gray-400 col-span-2">
                        Starting Reference Capital (USD)
                        {masterBalance?.enabled ? (
                          <div className={`mt-1 px-3 py-2 rounded-lg text-xs ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                            Overridden by the Admin's master control — fixed at ${masterBalance.value.toFixed(2)} for every bot right now.
                          </div>
                        ) : (
                          <input
                            type="number" step="100" min="1"
                            value={editing.account_balance_usd ?? effectiveBalance(bot)}
                            onChange={(e) => setEditing({ ...editing, account_balance_usd: Number(e.target.value) })}
                            className={inputCls}
                          />
                        )}
                      </label>
                      {/* Leverage — by direct request ("put a form to
                          set leverage for Bot and manual - separately
                          on the trader dashboard ... with a global
                          override form in the Admin"). Same disabled-
                          and-explained treatment as Starting Reference
                          Capital above when the Admin master override
                          is on. */}
                      <label className="text-xs text-gray-400 col-span-2">
                        Leverage (x)
                        {masterLeverage?.enabled ? (
                          <div className={`mt-1 px-3 py-2 rounded-lg text-xs ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                            Overridden by the Admin's master control — fixed at {masterLeverage.value}x for every bot right now.
                          </div>
                        ) : (
                          <input
                            type="number" step="1" min="1" max="125"
                            value={editing.leverage ?? effectiveLeverage(bot)}
                            onChange={(e) => setEditing({ ...editing, leverage: Number(e.target.value) })}
                            className={inputCls}
                          />
                        )}
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

                    {/* Instrument pairs — by direct request ("create an
                        option to edit the instrument pairs of each
                        bot"). Same search-and-add pattern as the New
                        Bot form above (botsApi.searchInstruments), own
                        local query/results state so the two search
                        boxes never cross-talk if both happen to be
                        mounted. */}
                    <div className="mt-3">
                      <div className="text-xs text-gray-400 mb-1.5">Instrument pairs</div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {(editing.symbols ?? []).map((s) => (
                          <span key={s} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${dark ? 'bg-white/10 text-white/80' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
                            {s}
                            <button onClick={() => removeEditSymbol(s)} aria-label={`Remove ${s}`} className="text-gray-400 hover:text-red-400">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        {(editing.symbols ?? []).length === 0 && (
                          <span className="text-xs text-gray-400">No pairs — a bot with none never scans anything.</span>
                        )}
                      </div>
                      <input
                        placeholder="Search e.g. BTC, ETH, XAUT… (Enter to add a typed symbol)"
                        value={editSymbolQuery}
                        onChange={(e) => setEditSymbolQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && editSymbolQuery.trim()) { e.preventDefault(); addEditSymbol(editSymbolQuery); } }}
                        className={`${inputCls} py-1.5`}
                      />
                      {editSymbolResults.length > 0 && (
                        <div className={`mt-1.5 max-h-40 overflow-y-auto rounded-lg border ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
                          {editSymbolResults.map((i) => (
                            <button
                              key={i.symbol}
                              onClick={() => addEditSymbol(i.symbol)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left ${dark ? 'hover:bg-white/5 text-white/80' : 'hover:bg-corporate-bg text-corporate-text-on-bg'}`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold">{i.symbol}</span>
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${i.market === 'futures' ? 'bg-violet-500/15 text-violet-400' : 'bg-sky-500/15 text-sky-500'}`}>
                                  {i.market === 'futures' ? 'PERP' : 'SPOT'}
                                </span>
                              </span>
                              <span className="text-gray-400">{i.base_asset}/{i.quote_asset}</span>
                            </button>
                          ))}
                        </div>
                      )}
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
                        Search instruments — real, live Binance spot AND perpetual-futures pairs (futures results carry the
                        ".P" suffix every bot actually needs), exactly like the chart's own symbol search (removes typos);
                        press Enter to add a typed symbol directly (e.g. a forex pair with no live search data).
                      </div>
                      <input
                        placeholder="Search e.g. BTC, ETH, XAUT…"
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
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold">{i.symbol}</span>
                                {/* Spot vs perpetual-futures badge — by direct
                                    request ("more the flexibility to select
                                    the correct instrument of interest"): a
                                    query like "XAUT" now returns both
                                    XAUTUSDT (spot) and XAUTUSDT.P (futures),
                                    so this is the only thing telling them
                                    apart at a glance. */}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  i.market === 'futures'
                                    ? 'bg-purple-500/15 text-purple-500'
                                    : 'bg-blue-500/15 text-blue-500'
                                }`}>
                                  {i.market === 'futures' ? 'PERP' : 'SPOT'}
                                </span>
                              </span>
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
