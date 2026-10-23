import { useEffect, useRef, useState } from 'react';
import { History, Play } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BotConfig, IsolatedBacktestRun } from '../types';
import { backtestsApi } from '../services/api';

/**
 * BotBacktestPanel — "Run Backtest" trigger + progress + results,
 * backed by POST/GET /api/backtests (app/routers/backtests.py).
 * Isolated-mode only (one bot, one symbol) for now — portfolio mode
 * is a later phase of the same approved plan.
 *
 * Same self-contained {bot, dark, onChanged} shape as
 * BotScheduleControl/BotSleepAndSubAuto, rendered inline in the
 * expanded bot card — no modal, matching this page's own convention.
 * onChanged is accepted for consistency with those siblings but isn't
 * actually needed here (a backtest run never mutates the BotConfig
 * row itself).
 */
export function BotBacktestPanel({ bot, dark }: { bot: BotConfig; dark: boolean; onChanged?: () => void }) {
  const [symbol, setSymbol] = useState(bot.symbols?.[0] || '');
  const [days, setDays] = useState(30);
  const [run, setRun] = useState<IsolatedBacktestRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Most recent run for this bot, so reopening the card (or a fresh
  // page load) shows the last result instead of a blank panel.
  useEffect(() => {
    backtestsApi.listRuns(bot.bot_id, 1).then((runs) => { if (runs.length > 0) setRun(runs[0]); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.bot_id]);

  useEffect(() => {
    if (!run || run.status === 'completed' || run.status === 'failed') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await backtestsApi.getRun(run.id);
        setRun(fresh);
      } catch {
        // transient — next tick retries; the interval itself only
        // stops once a terminal status is actually observed.
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [run?.id, run?.status]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      const created = await backtestsApi.createRun({
        bot_id: bot.bot_id, symbol: symbol || undefined,
        start_date: start.toISOString(), end_date: end.toISOString(),
      });
      setRun(created);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not start the backtest.');
    } finally {
      setStarting(false);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const running = run?.status === 'queued' || run?.status === 'running';

  return (
    <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
        <History size={14} className={run ? 'text-indigo-400' : 'text-gray-400'} />
        Backtest
      </div>
      <p className={`text-[11px] mb-2 ${mutedCls}`}>
        Replays this bot's real strategy against real historical candles — not a projection, the actual signal logic running bar-by-bar with no lookahead.
      </p>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {bot.symbols && bot.symbols.length > 1 ? (
          <select
            value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={running}
            className={`px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {bot.symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : null}
        <select
          value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={running}
          className={`px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button
          onClick={start} disabled={starting || running}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white'}`}
        >
          <Play size={12} /> {running ? 'Running…' : 'Run Backtest'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {run && (
        <div className="space-y-2">
          {running && (
            <div>
              <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${run.progress_pct}%` }} />
              </div>
              <p className={`text-[11px] mt-1 ${mutedCls}`}>{run.status === 'queued' ? 'Queued…' : `Running — ${Math.round(run.progress_pct)}%`}</p>
            </div>
          )}

          {run.status === 'failed' && (
            <p className="text-xs text-red-400">Backtest failed: {run.error_message}</p>
          )}

          {run.status === 'completed' && (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat dark={dark} label="Trades" value={String(run.total_trades ?? '—')} />
                <Stat dark={dark} label="Win Rate" value={run.win_rate != null ? `${run.win_rate}%` : '—'} />
                <Stat dark={dark} label="Expectancy" value={run.expectancy_r != null ? `${run.expectancy_r > 0 ? '+' : ''}${run.expectancy_r}R` : '—'}
                  tone={run.expectancy_r != null ? (run.expectancy_r > 0 ? 'good' : 'bad') : 'neutral'} />
                <Stat dark={dark} label="Max DD" value={run.max_drawdown_pct != null ? `${run.max_drawdown_pct}R` : '—'} tone="warn" />
              </div>

              {run.equity_curve && run.equity_curve.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={run.equity_curve}>
                    <defs>
                      <linearGradient id="backtestEquityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#e5e7eb'} />
                    <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={10} tickFormatter={(t) => new Date(t).toLocaleDateString()} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', border: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`, borderRadius: '8px' }}
                      labelStyle={{ color: dark ? '#9ca3af' : '#374151' }}
                      labelFormatter={(t) => new Date(t).toLocaleString()}
                      formatter={(value: number) => [`${value}R`, 'Cumulative']}
                    />
                    <Area type="monotone" dataKey="cum_r" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#backtestEquityGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className={`text-[11px] ${mutedCls}`}>No signals fired in this window.</p>
              )}
              <p className={`text-[10px] ${mutedCls}`}>
                {run.symbol} · {run.base_timeframe} bars · placeholder cost assumptions, not measured broker fees — directionally honest, not precisely calibrated.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Exported so PortfolioBacktestPanel.tsx (the page-level portfolio-mode
// trigger) can reuse the exact same stat-tile look instead of
// duplicating it.
export function Stat({ dark, label, value, tone = 'neutral' }: { dark: boolean; label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const toneCls = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : dark ? 'text-white' : 'text-gray-800';
  return (
    <div>
      <div className={`text-sm font-semibold ${toneCls}`}>{value}</div>
      <div className={`text-[10px] ${dark ? 'text-white/40' : 'text-gray-400'}`}>{label}</div>
    </div>
  );
}
