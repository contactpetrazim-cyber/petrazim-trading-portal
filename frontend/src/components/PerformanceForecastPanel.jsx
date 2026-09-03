import React, { useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

/**
 * PerformanceForecastPanel
 * =========================
 * Dashboard panel for the Monte Carlo Predictive Performance Engine.
 *
 * Lets the user pick a bot, tune simulation parameters (trials, trades
 * per run, risk sizing, resample mode, ruin threshold, target equity),
 * run the simulation, and see:
 *   - a fan chart: percentile equity bands over the simulated trade sequence
 *   - headline stats: probability of ruin / probability of hitting target
 *   - the underlying trade metrics the simulation was built from
 *
 * Matches the existing dark trading-terminal design tokens used across
 * the dashboard (smc-card / smc-border / smc-accent classes).
 *
 * Wire `apiBaseUrl` to your backend; expects POST {apiBaseUrl}/api/monte-carlo/simulate
 */

const DEFAULT_PARAMS = {
  bot_id: '',
  trials: 2000,
  trades_per_trial: 100,
  starting_equity: 10000,
  risk_mode: 'fixed_fractional',
  risk_value: 0.01,
  resample_mode: 'block',
  block_size: 5,
  ruin_threshold_pct: 50,
  target_equity: 15000,
  seed: '',
  include_fan_chart: true,
  fan_chart_trials: 300,
};

const BOT_OPTIONS = [
  { id: '', label: 'All bots (combined history)' },
  { id: 'bot_1', label: 'Bot 1 — Macro Swing Structure' },
  { id: 'bot_2', label: 'Bot 2 — Order Block Reversal' },
  { id: 'bot_3', label: 'Bot 3 — FVG Expansion & Fill' },
  { id: 'bot_4', label: 'Bot 4 — Volume & Liquidity Sweep' },
  { id: 'bot_5', label: 'Bot 5 — Liquidity Purge Specialist' },
];

function fmtCurrency(v) {
  if (v == null) return '—';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-400">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  'bg-smc-bg border border-smc-border rounded-lg px-3 py-2 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-1 focus:ring-smc-accent focus:border-smc-accent';

export default function PerformanceForecastPanel({ apiBaseUrl = '' }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (e) => {
    const raw = e.target.value;
    const numericKeys = [
      'trials', 'trades_per_trial', 'starting_equity', 'risk_value',
      'block_size', 'ruin_threshold_pct', 'target_equity', 'seed', 'fan_chart_trials',
    ];
    setParams((p) => ({
      ...p,
      [key]: numericKeys.includes(key) && raw !== '' ? Number(raw) : raw,
    }));
  };

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...params,
        bot_id: params.bot_id || null,
        seed: params.seed === '' ? null : params.seed,
        target_equity: params.target_equity === '' ? null : params.target_equity,
      };
      const res = await fetch(`${apiBaseUrl}/api/monte-carlo/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Simulation failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong running the simulation.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const fanData = result?.fan_chart ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Performance Forecast</h2>
        <p className="text-gray-400 text-sm mt-1">
          Monte Carlo projection of a future <span className="text-gray-300">set</span> of trades —
          not a prediction of any single trade. Built from resampled historical results.
        </p>
      </div>

      {/* Parameter controls */}
      <div className="bg-smc-card border border-smc-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Bot / history source">
            <select className={inputClass} value={params.bot_id} onChange={update('bot_id')}>
              {BOT_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Trials" hint="number of simulated futures">
            <input type="number" className={inputClass} value={params.trials}
              onChange={update('trials')} min={100} max={20000} step={100} />
          </Field>

          <Field label="Trades per trial" hint="length of each simulated future">
            <input type="number" className={inputClass} value={params.trades_per_trial}
              onChange={update('trades_per_trial')} min={5} max={2000} />
          </Field>

          <Field label="Starting equity">
            <input type="number" className={inputClass} value={params.starting_equity}
              onChange={update('starting_equity')} min={1} />
          </Field>

          <Field label="Risk mode">
            <select className={inputClass} value={params.risk_mode} onChange={update('risk_mode')}>
              <option value="fixed_fractional">Fixed % of equity</option>
              <option value="fixed_dollar">Fixed dollar amount</option>
            </select>
          </Field>

          <Field
            label={params.risk_mode === 'fixed_fractional' ? 'Risk per trade (%)' : 'Risk per trade ($)'}
          >
            <input type="number" className={inputClass}
              value={params.risk_mode === 'fixed_fractional' ? params.risk_value * 100 : params.risk_value}
              onChange={(e) => {
                const v = Number(e.target.value);
                setParams((p) => ({
                  ...p,
                  risk_value: p.risk_mode === 'fixed_fractional' ? v / 100 : v,
                }));
              }}
              step={params.risk_mode === 'fixed_fractional' ? 0.1 : 10} />
          </Field>

          <Field label="Resample mode" hint="'block' preserves win/loss streaks">
            <select className={inputClass} value={params.resample_mode} onChange={update('resample_mode')}>
              <option value="block">Block bootstrap (recommended)</option>
              <option value="iid">Independent bootstrap</option>
            </select>
          </Field>

          {params.resample_mode === 'block' && (
            <Field label="Block size" hint="trades per resampled chunk">
              <input type="number" className={inputClass} value={params.block_size}
                onChange={update('block_size')} min={1} max={50} />
            </Field>
          )}

          <Field label="Ruin threshold (%)" hint="drawdown counted as ruin">
            <input type="number" className={inputClass} value={params.ruin_threshold_pct}
              onChange={update('ruin_threshold_pct')} min={1} max={100} />
          </Field>

          <Field label="Target equity" hint="optional — leave blank to skip">
            <input type="number" className={inputClass} value={params.target_equity}
              onChange={update('target_equity')} min={0} />
          </Field>

          <Field label="Seed" hint="optional — for reproducible runs">
            <input type="number" className={inputClass} value={params.seed}
              onChange={update('seed')} placeholder="random" />
          </Field>
        </div>

        <div className="flex items-center justify-between pt-2">
          {error && <span className="text-sm text-red-400">{error}</span>}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="ml-auto bg-smc-accent text-black font-medium px-5 py-2 rounded-lg text-sm
                       hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running simulation…' : 'Run simulation'}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Median outcome" value={fmtCurrency(result.final_equity_percentiles['50'] ?? result.final_equity_percentiles[50])} />
            <StatCard label="5th–95th percentile"
              value={`${fmtCurrency(result.final_equity_percentiles['5'] ?? result.final_equity_percentiles[5])} – ${fmtCurrency(result.final_equity_percentiles['95'] ?? result.final_equity_percentiles[95])}`} />
            <StatCard label="Probability of ruin" value={`${result.probability_of_ruin}%`}
              tone={result.probability_of_ruin > 10 ? 'warn' : 'ok'} />
            <StatCard label="Probability of target"
              value={result.probability_of_target != null ? `${result.probability_of_target}%` : '—'} />
          </div>

          {/* Fan chart */}
          {fanData.length > 0 && (
            <div className="bg-smc-card border border-smc-border rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                Simulated equity range across {params.fan_chart_trials} paths
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={fanData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                  <XAxis dataKey="step" stroke="#8b93a5" fontSize={12}
                    label={{ value: 'Trade #', position: 'insideBottom', offset: -4, fill: '#8b93a5', fontSize: 12 }} />
                  <YAxis stroke="#8b93a5" fontSize={12}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#12151c', border: '1px solid #2a2f3a', borderRadius: 8 }}
                    formatter={(v) => fmtCurrency(v)}
                    labelFormatter={(l) => `Trade #${l}`}
                  />
                  <ReferenceLine y={params.starting_equity} stroke="#8b93a5" strokeDasharray="4 4" />
                  {params.target_equity ? (
                    <ReferenceLine y={params.target_equity} stroke="#22c55e" strokeDasharray="4 4"
                      label={{ value: 'Target', fill: '#22c55e', fontSize: 11, position: 'right' }} />
                  ) : null}
                  {/* 5th-95th band */}
                  <Area type="monotone" dataKey="p95" stroke="none" fill="#3b82f6" fillOpacity={0.08} />
                  <Area type="monotone" dataKey="p5" stroke="none" fill="#0a0e14" fillOpacity={1} />
                  {/* 25th-75th band */}
                  <Area type="monotone" dataKey="p75" stroke="none" fill="#3b82f6" fillOpacity={0.18} />
                  <Area type="monotone" dataKey="p25" stroke="none" fill="#0a0e14" fillOpacity={1} />
                  <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} name="Median" />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2">
                Shaded band = 5th–95th percentile range. Line = median path. Dashed line = starting equity.
              </p>
            </div>
          )}

          {/* Underlying metrics */}
          <div className="bg-smc-card border border-smc-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Historical basis for this forecast</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <MetricRow label="Trades used" value={result.metrics.n_trades} />
              <MetricRow label="Win rate" value={`${(result.metrics.win_rate * 100).toFixed(1)}%`} />
              <MetricRow label="Avg win" value={`${result.metrics.avg_win_r}R`} />
              <MetricRow label="Avg loss" value={`${result.metrics.avg_loss_r}R`} />
              <MetricRow label="Expectancy" value={`${result.expectancy_r_used}R / trade`} />
              <MetricRow label="Max win streak" value={result.metrics.max_win_streak} />
              <MetricRow label="Max loss streak" value={result.metrics.max_loss_streak} />
            </div>

            {result.notes?.length > 0 && (
              <div className="mt-4 space-y-2">
                {result.notes.map((note, i) => (
                  <p key={i} className="text-xs text-amber-400/90 bg-amber-400/10 rounded-lg px-3 py-2">
                    ⚠ {note}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = tone === 'warn' ? 'text-amber-400' : tone === 'ok' ? 'text-emerald-400' : 'text-gray-100';
  return (
    <div className="bg-smc-card border border-smc-border rounded-xl p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-gray-200 font-medium">{value}</div>
    </div>
  );
}
