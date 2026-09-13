import React, { useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { apiFetch } from './AccessExpiredGate';
import { useAuth } from '../hooks/useAuth';
import { formatApiError } from '../lib/apiError';

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
 * Restyled to the portal's own corporate design tokens — by direct bug
 * report ("Use the portals colour theme for the performance forcast
 * page - you used a different design and theme"). This was built
 * generic against a dark-only trading-terminal palette (smc-card /
 * smc-border / smc-accent, hardcoded hex chart colors) and never
 * adapted, the same gap its missing-auth headers had before. Now takes
 * a `dark` prop like every other page-level component in this app
 * (see InsightsPage.tsx) and reads corporate-hero/corporate-surface-dark/
 * corporate-bg the same way, light mode included — the chart's own
 * grid/axis/tooltip colors are computed from `dark` too, not hardcoded.
 *
 * Wire `apiBaseUrl` to your backend; expects POST {apiBaseUrl}/api/monte-carlo/simulate
 */

const DEFAULT_PARAMS = {
  bot_id: '',
  // 'all' (default)/'bots'/'manual' — by direct request ("create
  // option for manual trade and strategies to be analysed by the
  // 'performance forecast' tool"): previously bot trades and a
  // trader's own manual trades were always forecast together with no
  // way to isolate "if I keep trading manually the way I have been,
  // where does that lead" from the bots' own track record.
  source: 'all',
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

const SOURCE_OPTIONS = [
  { id: 'all', label: 'Everything (bots + manual)' },
  { id: 'bots', label: 'Bot-placed trades only' },
  { id: 'manual', label: 'My manual trades only' },
];

function fmtCurrency(v) {
  if (v == null) return '—';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Field({ label, children, hint, dark }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={dark ? 'text-white/50' : 'text-gray-500'}>{label}</span>
      {children}
      {hint && <span className={dark ? 'text-white/30' : 'text-gray-400'}>{hint}</span>}
    </label>
  );
}

function inputCls(dark) {
  return `rounded-lg px-3 py-2 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
}

function cardCls(dark) {
  return `rounded-xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
}

export default function PerformanceForecastPanel({ apiBaseUrl = '', dark = false }) {
  // Was built generic ("wire apiBaseUrl to your backend") and never
  // actually adapted to this app's own auth — every route it calls
  // requires require_active_access() server-side, so with no
  // Authorization header every request here 401'd, by direct bug
  // report ("some features in Insights are not showing"). This is
  // the same Bearer-token pattern every other component in this app
  // uses (useAuth() from the zustand auth store).
  const { token } = useAuth();
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
      const res = await apiFetch(`${apiBaseUrl}/api/monte-carlo/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Was `throw new Error(body.detail || ...)` — a FastAPI 422
        // validation error (a bad param, e.g. trials out of range)
        // sends `detail` as an ARRAY of {loc,msg,type} objects, not a
        // string; `new Error(array)` silently stringified it to
        // "[object Object],[object Object]" instead of a real
        // message, by direct bug report.
        throw new Error(formatApiError(body.detail, `Simulation failed (${res.status})`));
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

  // Chart colors computed from `dark` rather than hardcoded — the
  // fan-chart bands need a real background-matching fill to visually
  // "mask" the area below each lower percentile line (recharts has no
  // native band-fill primitive; two stacked Areas with the ABOVE
  // line's percentile filled transparent-blue and the BELOW line's
  // percentile filled solid-background is the standard trick), and
  // that background color is white in light mode, not nearly-black.
  const gridStroke = dark ? '#2a2f3a' : '#e5e7eb';
  const axisStroke = dark ? '#8b93a5' : '#6b7280';
  const maskFill = dark ? '#151a24' : '#ffffff'; // matches corporate-surface-dark / white card bg
  const bandFill = '#005FB8'; // corporate-hero
  const tooltipBg = dark ? '#151a24' : '#ffffff';
  const tooltipBorder = dark ? '#2a2f3a' : '#e5e7eb';
  const tooltipText = dark ? '#ffffff' : '#111827';

  const headingCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const subCls = dark ? 'text-white/50' : 'text-gray-500';
  const labelCls = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold font-display ${headingCls}`}>Performance Forecast</h2>
        <p className={`text-sm mt-1 ${subCls}`}>
          Monte Carlo projection of a future set of trades — not a prediction of any single trade.
          Built from resampled historical results.
        </p>
      </div>

      {/* Parameter controls */}
      <div className={`${cardCls(dark)} space-y-4`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Trade source" hint="what to analyse" dark={dark}>
            <select className={inputCls(dark)} value={params.source}
              onChange={(e) => setParams((p) => ({ ...p, source: e.target.value, bot_id: e.target.value === 'manual' ? '' : p.bot_id }))}>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>

          {/* A specific bot only means something for bot-placed
              trades — manual trades have no "which bot" to narrow by,
              so this hides entirely rather than showing a picker that
              can't do anything in that mode. */}
          {params.source !== 'manual' && (
            <Field label="Bot" dark={dark}>
              <select className={inputCls(dark)} value={params.bot_id} onChange={update('bot_id')}>
                {BOT_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Trials" hint="number of simulated futures" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.trials}
              onChange={update('trials')} min={100} max={20000} step={100} />
          </Field>

          <Field label="Trades per trial" hint="length of each simulated future" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.trades_per_trial}
              onChange={update('trades_per_trial')} min={5} max={2000} />
          </Field>

          <Field label="Starting equity" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.starting_equity}
              onChange={update('starting_equity')} min={1} />
          </Field>

          <Field label="Risk mode" dark={dark}>
            <select className={inputCls(dark)} value={params.risk_mode} onChange={update('risk_mode')}>
              <option value="fixed_fractional">Fixed % of equity</option>
              <option value="fixed_dollar">Fixed dollar amount</option>
            </select>
          </Field>

          <Field
            label={params.risk_mode === 'fixed_fractional' ? 'Risk per trade (%)' : 'Risk per trade ($)'}
            dark={dark}
          >
            <input type="number" className={inputCls(dark)}
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

          <Field label="Resample mode" hint="'block' preserves win/loss streaks" dark={dark}>
            <select className={inputCls(dark)} value={params.resample_mode} onChange={update('resample_mode')}>
              <option value="block">Block bootstrap (recommended)</option>
              <option value="iid">Independent bootstrap</option>
            </select>
          </Field>

          {params.resample_mode === 'block' && (
            <Field label="Block size" hint="trades per resampled chunk" dark={dark}>
              <input type="number" className={inputCls(dark)} value={params.block_size}
                onChange={update('block_size')} min={1} max={50} />
            </Field>
          )}

          <Field label="Ruin threshold (%)" hint="drawdown counted as ruin" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.ruin_threshold_pct}
              onChange={update('ruin_threshold_pct')} min={1} max={100} />
          </Field>

          <Field label="Target equity" hint="optional — leave blank to skip" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.target_equity}
              onChange={update('target_equity')} min={0} />
          </Field>

          <Field label="Seed" hint="optional — for reproducible runs" dark={dark}>
            <input type="number" className={inputCls(dark)} value={params.seed}
              onChange={update('seed')} placeholder="random" />
          </Field>
        </div>

        <div className="flex items-center justify-between pt-2">
          {error && <span className="text-sm text-red-500">{error}</span>}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="ml-auto bg-corporate-hero text-white font-semibold px-5 py-2.5 rounded-xl text-sm
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
            <StatCard dark={dark} label="Median outcome" value={fmtCurrency(result.final_equity_percentiles['50'] ?? result.final_equity_percentiles[50])} />
            <StatCard dark={dark} label="5th–95th percentile"
              value={`${fmtCurrency(result.final_equity_percentiles['5'] ?? result.final_equity_percentiles[5])} – ${fmtCurrency(result.final_equity_percentiles['95'] ?? result.final_equity_percentiles[95])}`} />
            <StatCard dark={dark} label="Probability of ruin" value={`${result.probability_of_ruin}%`}
              tone={result.probability_of_ruin > 10 ? 'warn' : 'ok'} />
            <StatCard dark={dark} label="Probability of target"
              value={result.probability_of_target != null ? `${result.probability_of_target}%` : '—'} />
          </div>

          {/* Fan chart — the percentile bands: shaded 5th-95th and a
              darker 25th-75th band inside it, median line through the
              middle. Bands render regardless of theme; only the
              colors that make them readable change with it. */}
          {fanData.length > 0 && (
            <div className={cardCls(dark)}>
              <h3 className={`text-sm font-medium mb-1 ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                Simulated equity range across {params.fan_chart_trials} paths
              </h3>
              {/* Plain-English framing above the chart itself — by
                  direct request ("make chart clear and interesting,
                  easy to understand"). A raw fan chart with no framing
                  reads as decoration to anyone who doesn't already
                  know what a percentile band is; this says in one
                  sentence what the trader is actually looking at. */}
              <p className={`text-xs mb-4 ${labelCls}`}>
                {params.trials.toLocaleString()} simulated versions of your next {params.trades_per_trial} trades, all built from
                {params.source === 'manual' ? ' your own manually-placed trades' : params.source === 'bots' ? ' your bots\' own trade history' : ' your real trade history'}.
                Most land inside the shaded area — the wider the shading, the less predictable the outcome.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={fanData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="step" stroke={axisStroke} fontSize={12}
                    label={{ value: 'Trade #', position: 'insideBottom', offset: -4, fill: axisStroke, fontSize: 12 }} />
                  <YAxis stroke={axisStroke} fontSize={12}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText }}
                    labelStyle={{ color: tooltipText }}
                    formatter={(v) => fmtCurrency(v)}
                    labelFormatter={(l) => `Trade #${l}`}
                  />
                  <ReferenceLine y={params.starting_equity} stroke={axisStroke} strokeDasharray="4 4" />
                  {params.target_equity ? (
                    <ReferenceLine y={params.target_equity} stroke="#26a69a" strokeDasharray="4 4"
                      label={{ value: 'Target', fill: '#26a69a', fontSize: 11, position: 'right' }} />
                  ) : null}
                  {/* 5th-95th band */}
                  <Area type="monotone" dataKey="p95" stroke="none" fill={bandFill} fillOpacity={0.1} />
                  <Area type="monotone" dataKey="p5" stroke="none" fill={maskFill} fillOpacity={1} />
                  {/* 25th-75th band */}
                  <Area type="monotone" dataKey="p75" stroke="none" fill={bandFill} fillOpacity={0.22} />
                  <Area type="monotone" dataKey="p25" stroke="none" fill={maskFill} fillOpacity={1} />
                  <Line type="monotone" dataKey="p50" stroke={bandFill} strokeWidth={2} dot={false} name="Median" />
                </ComposedChart>
              </ResponsiveContainer>
              {/* A real legend (color swatch + label), not just a
                  caption sentence — by direct request ("make chart
                  clear and interesting, easy to understand"). */}
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs ${labelCls}`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full" style={{ background: bandFill }} /> Median path
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm" style={{ background: bandFill, opacity: 0.22 }} /> Typical range (25th–75th)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm" style={{ background: bandFill, opacity: 0.1 }} /> Wide range (5th–95th)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full border-t border-dashed" style={{ borderColor: axisStroke }} /> Starting equity
                </span>
                {params.target_equity ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed" style={{ borderColor: '#26a69a' }} /> Target
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Underlying metrics */}
          <div className={cardCls(dark)}>
            <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Historical basis for this forecast</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <MetricRow dark={dark} label="Trades used" value={result.metrics.n_trades} />
              <MetricRow dark={dark} label="Win rate" value={`${(result.metrics.win_rate * 100).toFixed(1)}%`} />
              <MetricRow dark={dark} label="Avg win" value={`${result.metrics.avg_win_r}R`} />
              <MetricRow dark={dark} label="Avg loss" value={`${result.metrics.avg_loss_r}R`} />
              <MetricRow dark={dark} label="Expectancy" value={`${result.expectancy_r_used}R / trade`} />
              <MetricRow dark={dark} label="Max win streak" value={result.metrics.max_win_streak} />
              <MetricRow dark={dark} label="Max loss streak" value={result.metrics.max_loss_streak} />
            </div>

            {result.notes?.length > 0 && (
              <div className="mt-4 space-y-2">
                {result.notes.map((note, i) => (
                  <p key={i} className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
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

function StatCard({ label, value, tone, dark }) {
  const toneClass = tone === 'warn' ? 'text-amber-500' : tone === 'ok' ? 'text-emerald-500' : (dark ? 'text-white' : 'text-corporate-text-on-bg');
  return (
    <div className={`rounded-xl border p-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function MetricRow({ label, value, dark }) {
  return (
    <div>
      <div className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>{label}</div>
      <div className={`font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}
