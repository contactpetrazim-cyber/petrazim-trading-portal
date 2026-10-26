import { useState, useEffect, FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Import, Bot, User } from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { timeMachineApi, tradesApi } from '../services/api';
import type { TimeMachineResponse, TimeMachineRequest, Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';

// The same five exchanges Time Machine's own dropdown offers -- a
// trade filled on anything else (forex/MT broker_name values like
// "metatrader"/"tradelocker") has no real candle history this feature
// could replay against.
const TIME_MACHINE_EXCHANGES = ['okx', 'binance', 'bybit', 'bingx', 'mexc'];

// The trade's ORIGINAL plan, not its live/mutated columns -- a bot
// trade that's already run past TP1 gets its stop_loss ratcheted
// toward (or past) entry_price to lock in profit (position_monitor.py's
// breakeven/trailing mechanic), which can leave the LIVE stop_loss
// equal to or on the wrong side of entry_price. That's correct, real
// data, not a broken trade -- but it fails the plain entry/stop/target
// ordering check and got misreported as "missing a full entry/stop/
// target" (direct report: "all bot trades have entry, stop and
// target"). initial_stop_loss/initial_take_profit_1 are immutable
// snapshots taken at order creation (see Trade.initial_stop_loss's own
// backend comment) -- always consistent with entry_price by
// construction, so preferring them here recovers every one of those
// trades. Falls back to the live columns only for a trade that predates
// the snapshot (initial_* still null).
function originalPlan(t: Trade): { stop: number; target: number | null } {
  return {
    stop: t.initial_stop_loss ?? t.stop_loss,
    target: t.initial_take_profit_1 ?? t.take_profit,
  };
}

/**
 * AddFromTradePicker -- "Add from Manual trade / Bot trade" (direct
 * request). Time Machine's own single-pick counterpart to ToolsPage's
 * multi-select "Add from Recent Trades": lists the caller's own
 * PENDING/ACTIVE/CLOSED trades (check a recommendation before
 * approving it, sanity-check a position already open, or see what the
 * real odds actually were on one already closed), split by source
 * since this only ever needs ONE entry/stop/target, not a batch. Only
 * trades with a full entry/stop/target, a valid long/short price
 * ordering, and a ccxt exchange Time Machine can actually fetch real
 * candles for are offered -- anything else would just fail the run.
 */
function AddFromTradePicker({ dark, onPick }: { dark: boolean; onPick: (trade: Trade) => void }) {
  const [source, setSource] = useState<'manual' | 'bots' | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    if (!source) return;
    setLoading(true);
    setTrades(null);
    Promise.all([
      tradesApi.getTrades({ source, status: 'pending', limit: 10 }),
      tradesApi.getTrades({ source, status: 'active', limit: 10 }),
      tradesApi.getTrades({ source, status: 'closed', limit: 10 }),
    ]).then((lists) => {
      const merged = lists.flat();
      const usable = merged.filter((t) => {
        const exch = (t.broker_name || '').toLowerCase();
        if (!TIME_MACHINE_EXCHANGES.includes(exch)) return false;
        if (t.entry_price == null) return false;
        const { stop, target } = originalPlan(t);
        if (target == null) return false;
        if (t.direction === 'long') return stop < t.entry_price && t.entry_price < target;
        return target < t.entry_price && t.entry_price < stop;
      }).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 15);
      setSkipped(merged.length - usable.length);
      setTrades(usable);
    }).catch(() => setTrades([])).finally(() => setLoading(false));
  }, [source]);

  function pick(t: Trade) {
    onPick(t);
    setSource(null);
    setTrades(null);
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? 'text-white/70' : 'text-gray-600'}`}>
          <Import size={13} /> Add from
        </span>
        <button
          type="button"
          onClick={() => setSource((s) => (s === 'manual' ? null : 'manual'))}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
            source === 'manual' ? 'text-white bg-corporate-hero' : dark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <User size={12} /> Manual trade
        </button>
        <button
          type="button"
          onClick={() => setSource((s) => (s === 'bots' ? null : 'bots'))}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
            source === 'bots' ? 'text-white bg-corporate-hero' : dark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Bot size={12} /> Bot trade
        </button>
      </div>
      {source && (
        <div className={`mt-2 rounded-lg border p-2.5 ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          {loading && <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</div>}
          {!loading && trades && trades.length === 0 && (
            <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              No {source === 'manual' ? 'manual' : 'bot'} trades with a full entry/stop/target on a supported exchange yet.
            </div>
          )}
          {!loading && trades && trades.length > 0 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {trades.map((t) => (
                <button
                  type="button"
                  key={t.trade_id}
                  onClick={() => pick(t)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 rounded-md text-xs ${dark ? 'hover:bg-white/10' : 'hover:bg-white'}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={t.direction === 'long' ? 'text-smc-long' : 'text-smc-short'}>{t.direction === 'long' ? '▲' : '▼'}</span>
                    <span className={`font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{t.symbol}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${dark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                      {/* A PENDING trade that still needs a human decision
                          reads as "Pending Approval" here, not the bare
                          "pending" every other status shows -- same
                          requires_approval check PendingApprovalsPage/
                          TradeRow already use to distinguish it from a
                          resting order nobody needs to act on. */}
                      {t.status === 'pending' && t.requires_approval ? 'Pending Approval' : t.status}
                    </span>
                  </span>
                  <span className={`shrink-0 font-mono ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                    {t.entry_price?.toFixed(4) ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!loading && skipped > 0 && (
            <div className={`mt-1.5 text-[11px] ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              {skipped} trade{skipped === 1 ? '' : 's'} left out -- missing a full entry/stop/target, an invalid price order, or on an exchange Time Machine can't replay (forex/MT).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ dark, label, value, tone = 'neutral' }: { dark: boolean; label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const toneCls = tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-500' : dark ? 'text-white' : 'text-gray-800';
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${dark ? 'text-white/50' : 'text-gray-500'}`}>{label}</div>
      <div className={`text-sm font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

/**
 * ExploreTimeMachinePage -- "the portal version of trader-timemachine"
 * (direct request). Takes a proposed entry/stop/target and replays it
 * thousands of times against real resampled price history for the symbol
 * (GET-free: POST /time-machine/run, backend/app/services/time_machine.py)
 * to answer "given how this symbol actually moves, what are the real odds
 * this plan hits target before stop?" -- not a guarantee, a historical odds
 * check.
 */
export function ExploreTimeMachinePage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    exchange: 'okx', symbol: 'BTC/USDT', timeframe: '5m',
    entry: '', stop: '', target: '', direction: 'long' as 'long' | 'short',
    horizon_bars: 48, replays: 10000, lookback_days: 60,
  });
  const [data, setData] = useState<TimeMachineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const inputCls = `px-3 py-2 rounded-lg text-sm border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`;

  function applyTradePick(t: Trade) {
    setError(null);
    setData(null);
    const { stop, target } = originalPlan(t);
    setForm((f) => ({
      ...f,
      exchange: (t.broker_name || f.exchange).toLowerCase(),
      symbol: t.symbol,
      direction: t.direction,
      entry: String(t.entry_price),
      stop: String(stop),
      target: String(target),
    }));
  }

  // Arrived here from the Pending Approvals page's "Check odds →" link
  // (direct request: "add the pending approval trades to the time
  // machine") -- check a recommendation's real historical odds BEFORE
  // approving/rejecting it, not after. Builds the request straight off
  // the trade rather than going through `run()`/`form` (whose state
  // update from applyTradePick above wouldn't have landed yet on this
  // same tick), and runs it immediately so the odds are there the
  // instant the page opens instead of one more manual "Run Time
  // Machine" click.
  function applyAndRun(t: Trade) {
    applyTradePick(t);
    const { stop, target } = originalPlan(t);
    if (t.entry_price == null || target == null) return;
    setLoading(true);
    setError(null);
    setData(null);
    const req: TimeMachineRequest = {
      exchange: (t.broker_name || form.exchange).toLowerCase(),
      symbol: t.symbol, timeframe: form.timeframe,
      entry: t.entry_price, stop, target, direction: t.direction,
      horizon_bars: form.horizon_bars, replays: form.replays, lookback_days: form.lookback_days,
    };
    timeMachineApi.run(req)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || 'Could not run the replay for this plan right now.'))
      .finally(() => setLoading(false));
  }

  // Runs once per navigation-in: PendingApprovalsPage's link passes the
  // trade via router state (same `navigate(path, { state })` pattern
  // LoginPage/OnboardingPage already use), not a URL param, since a
  // full Trade object doesn't belong in the address bar. Cleared
  // immediately via a replace-navigate so reloading or going Back to
  // this page doesn't silently re-run the same trade again.
  useEffect(() => {
    const incoming = (location.state as { prefillTrade?: Trade } | null)?.prefillTrade;
    if (incoming) {
      applyAndRun(incoming);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(e?: FormEvent) {
    e?.preventDefault();
    const entry = parseFloat(form.entry), stop = parseFloat(form.stop), target = parseFloat(form.target);
    if (!form.symbol.trim() || !Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) {
      setError('Enter a symbol and numeric entry, stop, and target.');
      return;
    }
    setLoading(true);
    setError(null);
    const req: TimeMachineRequest = {
      exchange: form.exchange, symbol: form.symbol.trim(), timeframe: form.timeframe,
      entry, stop, target, direction: form.direction,
      horizon_bars: form.horizon_bars, replays: form.replays, lookback_days: form.lookback_days,
    };
    timeMachineApi.run(req)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || 'Could not run the replay for this plan right now.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <PageHeader
        title="Time Machine"
        subtitle="Replay a proposed trade thousands of times against real price history for the symbol."
      />

      <AddFromTradePicker dark={dark} onPick={applyTradePick} />

      <form onSubmit={run} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <input value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
          placeholder="Symbol, e.g. BTC/USDT" className={`${inputCls} col-span-2`} />
        <select value={form.exchange} onChange={(e) => setForm((f) => ({ ...f, exchange: e.target.value }))} className={inputCls}>
          <option value="okx">OKX</option>
          <option value="binance">Binance</option>
          <option value="bybit">Bybit</option>
          <option value="bingx">BingX</option>
          <option value="mexc">MEXC</option>
        </select>
        <select value={form.timeframe} onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))} className={inputCls}>
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
        </select>

        <input value={form.entry} onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))} placeholder="Entry" className={inputCls} />
        <input value={form.stop} onChange={(e) => setForm((f) => ({ ...f, stop: e.target.value }))} placeholder="Stop" className={inputCls} />
        <input value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="Target" className={inputCls} />
        <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as 'long' | 'short' }))} className={inputCls}>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        <button type="submit" disabled={loading} className="col-span-2 sm:col-span-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-corporate-hero disabled:opacity-40">
          {loading ? 'Replaying…' : 'Run Time Machine'}
        </button>
      </form>

      {!data && !loading && !error && (
        <p className={`text-sm ${mutedCls}`}>A historical odds check against real past price action -- not a prediction, not advice, and not a guarantee of future behavior.</p>
      )}

      {!loading && error && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
            <span className="text-sm font-semibold">{data.symbol} · {data.direction.toUpperCase()} · {data.target_r}R target</span>
            <span className={`text-xs ${mutedCls}`}>{data.sessions_used} real sessions · {data.replays.toLocaleString()} replays</span>
          </div>

          <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{data.verdict}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat dark={dark} label="Target First" value={`${data.odds.target_first_pct}%`} tone="good" />
            <Stat dark={dark} label="Stop First" value={`${data.odds.stop_first_pct}%`} tone="bad" />
            <Stat dark={dark} label="Neither (open)" value={`${data.odds.neither_pct}%`} tone="warn" />
            <Stat dark={dark} label="Green at Horizon" value={`${data.odds.green_pct}%`} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat dark={dark} label="Mean R" value={`${data.r_multiple.mean > 0 ? '+' : ''}${data.r_multiple.mean}R`} tone={data.r_multiple.mean > 0 ? 'good' : data.r_multiple.mean < 0 ? 'bad' : 'neutral'} />
            <Stat dark={dark} label="P5" value={`${data.r_multiple.p5}R`} />
            <Stat dark={dark} label="P25" value={`${data.r_multiple.p25}R`} />
            <Stat dark={dark} label="P50 (median)" value={`${data.r_multiple.p50}R`} />
            <Stat dark={dark} label="P95" value={`${data.r_multiple.p95}R`} />
          </div>

          {data.fan_chart.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data.fan_chart}>
                <defs>
                  <linearGradient id="timeMachineFanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#e5e7eb'} />
                <XAxis dataKey="step" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', border: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`, borderRadius: '8px' }}
                  labelStyle={{ color: dark ? '#9ca3af' : '#374151' }}
                  labelFormatter={(step) => `Bar ${step}`}
                />
                <Area type="monotone" dataKey="p95" stroke="none" fill="url(#timeMachineFanGradient)" />
                <Area type="monotone" dataKey="p5" stroke="none" fill={dark ? '#111827' : '#ffffff'} fillOpacity={1} />
                <Line type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2} dot={false} name="Median path" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <p className={`text-[11px] ${mutedCls}`}>Shaded band is the 5th-95th percentile of {data.replays.toLocaleString()} resampled replays; the line is the median. Against the {data.history.sessions} real past sessions of this length: target first {data.history.target_first}, stop first {data.history.stop_first}, neither {data.history.neither}, mean {data.history.mean_r}R.</p>
        </div>
      )}
    </div>
  );
}
