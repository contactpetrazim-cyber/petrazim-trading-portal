import { useEffect, useRef, useState } from 'react';
import { History, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BotConfig, PortfolioBacktestRun } from '../types';
import { backtestsApi } from '../services/api';
import { Stat } from './BotBacktestPanel';

/**
 * PortfolioBacktestPanel — page-level "Run Portfolio Backtest" trigger
 * + progress + results, backed by the SAME POST/GET /api/backtests
 * BotBacktestPanel.tsx already uses for isolated mode, just with
 * scope="portfolio" (see backend/app/routers/backtests.py). Rendered
 * once near the top of the bot list in Bots.tsx — NOT per-card like
 * BotBacktestPanel, since portfolio mode replays every selected bot
 * together against one shared ledger, not one bot in isolation.
 *
 * Reuses BotBacktestPanel's own polling/progress/stat-tile
 * conventions (same {dark} prop, no modal, same 3s poll-until-terminal
 * pattern, same Stat tile component) rather than duplicating them —
 * only the result SHAPE differs (a shared dollar ledger + per-bot
 * breakdown instead of one bot's R-multiple curve), so only the
 * results section below is genuinely new.
 */
export function PortfolioBacktestPanel({ bots, dark }: { bots: BotConfig[]; dark: boolean }) {
  const activeBots = bots.filter((b) => b.status === 'active');
  const [days, setDays] = useState(30);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]); // empty => all ACTIVE, resolved by the backend at run time
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [run, setRun] = useState<PortfolioBacktestRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Most recent portfolio run, so reopening the page shows the last
  // result instead of a blank panel — same idea as BotBacktestPanel's
  // own effect, just scoped to scope==='portfolio' runs.
  useEffect(() => {
    backtestsApi.listPortfolioRuns(1).then((runs) => { if (runs.length > 0) { setRun(runs[0]); setExpanded(true); } }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!run || run.status === 'completed' || run.status === 'failed') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await backtestsApi.getPortfolioRun(run.id);
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
      const created = await backtestsApi.createPortfolioRun({
        bot_ids: selectedBotIds.length > 0 ? selectedBotIds : undefined,
        start_date: start.toISOString(), end_date: end.toISOString(),
      });
      setRun(created);
      setExpanded(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not start the portfolio backtest.');
    } finally {
      setStarting(false);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const selectCls = `px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-700 border-gray-200'}`;
  const running = run?.status === 'queued' || run?.status === 'running';

  const equityData = run?.status === 'completed' && run.equity_curve
    ? run.equity_curve.events.map((e) => ({ timestamp: e.timestamp, balance: e.balance }))
    : [];

  return (
    <div className={`rounded-xl border p-4 ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <History size={16} className={run ? 'text-indigo-400' : 'text-gray-400'} />
          Portfolio Backtest
          <span className={`text-xs font-normal ${mutedCls}`}>— every active bot, one shared ledger</span>
        </div>
        {expanded ? <ChevronUp size={16} className={mutedCls} /> : <ChevronDown size={16} className={mutedCls} />}
      </button>

      {expanded && (
        <div className="mt-3">
          <p className={`text-[11px] mb-2 ${mutedCls}`}>
            Replays every selected bot TOGETHER against one shared, compounding ledger with a real capital-adequacy cap across all simultaneously open positions — not each bot's isolated sizing, actual cross-bot capital contention.
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={running} className={selectCls}>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              type="button" onClick={() => setShowBotPicker((s) => !s)} disabled={running}
              className={`inline-flex items-center gap-1 ${selectCls} disabled:opacity-40`}
            >
              {selectedBotIds.length > 0 ? `${selectedBotIds.length} bot${selectedBotIds.length === 1 ? '' : 's'} selected` : 'All active bots'}
              {showBotPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button
              onClick={start} disabled={starting || running}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white'}`}
            >
              <Play size={12} /> {running ? 'Running…' : 'Run Portfolio Backtest'}
            </button>
          </div>

          {showBotPicker && (
            <div className={`flex flex-wrap gap-1.5 p-2 rounded-lg mb-2 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
              {activeBots.length === 0 && <span className={`text-[11px] ${mutedCls}`}>No active bots.</span>}
              {activeBots.map((b) => {
                const checked = selectedBotIds.includes(b.bot_id);
                return (
                  <label
                    key={b.bot_id}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border cursor-pointer ${
                      checked ? 'border-indigo-400 text-indigo-400' : dark ? 'border-white/10 text-white/70' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox" className="hidden" checked={checked} disabled={running}
                      onChange={() => setSelectedBotIds((ids) => (checked ? ids.filter((id) => id !== b.bot_id) : [...ids, b.bot_id]))}
                    />
                    {b.bot_name || b.bot_id}
                  </label>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

          {run && (
            <div className="space-y-2">
              {running && (
                <div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${run.progress_pct}%` }} />
                  </div>
                  <p className={`text-[11px] mt-1 ${mutedCls}`}>
                    {run.status === 'queued' ? 'Queued…' : `Running — ${Math.round(run.progress_pct)}%`}
                    {run.bot_ids ? ` · ${run.bot_ids.length} bot${run.bot_ids.length === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
              )}

              {run.status === 'failed' && (
                <p className="text-xs text-red-400">Portfolio backtest failed: {run.error_message}</p>
              )}

              {run.status === 'completed' && run.equity_curve && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <Stat dark={dark} label="Bots" value={String(run.bot_ids?.length ?? '—')} />
                    <Stat dark={dark} label="Trades" value={String(run.total_trades ?? '—')} />
                    <Stat dark={dark} label="Win Rate" value={run.win_rate != null ? `${run.win_rate}%` : '—'} />
                    <Stat
                      dark={dark} label="Expectancy"
                      value={run.expectancy_r != null ? `${run.expectancy_r > 0 ? '+' : ''}${run.expectancy_r}R` : '—'}
                      tone={run.expectancy_r != null ? (run.expectancy_r > 0 ? 'good' : 'bad') : 'neutral'}
                    />
                    <Stat dark={dark} label="Max DD" value={run.max_drawdown_pct != null ? `${run.max_drawdown_pct}%` : '—'} tone="warn" />
                  </div>

                  <p className={`text-[11px] ${mutedCls}`}>
                    Shared ledger: ${run.equity_curve.starting_balance.toLocaleString()} → ${run.equity_curve.ending_balance.toLocaleString()}
                    {run.equity_curve.rejected_by_capital_adequacy > 0
                      ? ` · ${run.equity_curve.rejected_by_capital_adequacy} signal${run.equity_curve.rejected_by_capital_adequacy === 1 ? '' : 's'} rejected (insufficient shared capital)`
                      : ''}
                  </p>

                  {equityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={equityData}>
                        <defs>
                          <linearGradient id="portfolioBacktestEquityGradient" x1="0" y1="0" x2="0" y2="1">
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
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                        />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#portfolioBacktestEquityGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className={`text-[11px] ${mutedCls}`}>No signals fired across the selected bots in this window.</p>
                  )}

                  {Object.keys(run.equity_curve.per_bot).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(run.equity_curve.per_bot).map(([botId, s]) => (
                        <div key={botId} className={`rounded-lg px-2 py-1.5 text-[11px] ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <div className="font-medium truncate">{botId}</div>
                          <div className={mutedCls}>{s.trades} trades · {s.win_rate}% · {s.expectancy_r > 0 ? '+' : ''}{s.expectancy_r}R</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.keys(run.equity_curve.errors).length > 0 && (
                    <div className={`text-[11px] space-y-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
                      {Object.entries(run.equity_curve.errors).map(([botId, msg]) => (
                        <div key={botId}>{botId}: {msg}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
