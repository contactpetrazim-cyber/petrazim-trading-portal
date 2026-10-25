import { useState, FormEvent } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { timeMachineApi } from '../services/api';
import type { TimeMachineResponse, TimeMachineRequest } from '../types';
import { useThemeStore } from '../hooks/useTheme';

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
