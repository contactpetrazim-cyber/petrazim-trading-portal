import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from './LoadingIndicator';
import { money } from './TradeAnalytics';
import type { TradeSource } from './TradeAnalytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DetailRow {
  trade_id: string;
  symbol: string;
  bot_id: string;
  bot_name: string | null;
  strategy_type: string;
  direction: 'long' | 'short';
  entry_timestamp: string | null;
  exit_timestamp: string | null;
  entry_price: number | null;
  initial_stop_loss: number | null;
  stop_loss: number;
  initial_take_profit_1: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  realized_pnl: number;
  risk_amount: number;
  lot_size: number;
  exit_type: string | null;
  modification_count: number;
  sl_shifted: boolean;
  tp_count: number;
}

const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

/**
 * AdvancedTradeAnalytics — the deeper analytics suite, by direct
 * request ("create more analytics like Net P&L by Session, Net P&L or
 * Trade Outcome by Day (Calendar), by Time, by Trading Strategy/Setup,
 * Risk to Reward Map, by Trade Map, SL Map, Max Drawdown Map over time
 * ... develop useful metrics that will help understand the trading
 * edge, profitability ... and other unique characteristics ... TP or
 * SL changes per trade over time ... effects of multiple TP trades vs
 * single TP ... dynamic SL management shift vs trades without
 * shifting SL").
 *
 * Backed by ONE real dataset — GET /trades/analytics/detail
 * (routers/trades.py) — an enriched row per closed trade. Every chart
 * below is a different client-side slice of those SAME real rows
 * (grouped by session/hour/day/strategy, or read as a sequence), not a
 * separate fabricated data source per chart. Session/hour bucketing
 * uses each trade's own entry_timestamp in UTC — labeled as such,
 * since this app has no per-trader timezone setting to convert against.
 */
export function AdvancedTradeAnalytics({ dark, source }: { dark: boolean; source: TradeSource }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<DetailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    setRows(null);
    setError(null);
    const qs = source === 'all' ? '' : `?source=${source}`;
    fetchJsonWithRetry<DetailRow[]>(`${API_URL}/trades/analytics/detail${qs}`, { headers: { Authorization: `Bearer ${token}` } }, setPhase)
      .then((r) => {
        if (r) setRows(r);
        else setError('Could not load the advanced analytics right now.');
      });
  }, [token, source, retryTick]);

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`;
  const capCls = `text-[11px] mb-4 ${dark ? 'text-white/30' : 'text-gray-400'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  if (error) {
    return (
      <div className="mt-4 text-sm">
        <span className={dark ? 'text-red-400' : 'text-red-500'}>{error}</span>{' '}
        <button
          onClick={() => { setPhase('idle'); setRetryTick((n) => n + 1); }}
          className={`underline font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
        >
          Try again
        </button>
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className="mt-4">
        {(phase === 'loading' || phase === 'stalled') ? <LoadingIndicator phase={phase} dark={dark} /> : <p className={`text-sm ${mutedCls}`}>Loading advanced analytics…</p>}
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className={`text-sm mt-4 ${mutedCls}`}>No closed trades yet for this filter — the advanced analytics fill in once you have some trade history.</p>;
  }

  // Chronological order — every time-based view (drawdown, trade
  // sequence, R:R map) reads off this once.
  const chrono = [...rows].sort((a, b) => {
    const ta = a.exit_timestamp || a.entry_timestamp || '';
    const tb = b.exit_timestamp || b.entry_timestamp || '';
    return ta.localeCompare(tb);
  });

  return (
    <div className="mt-4 space-y-4">
      <div className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Advanced Analytics — Trading Edge</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <div className={titleCls}>Net P&amp;L by Session</div>
          <div className={capCls}>Bucketed by each trade's entry hour, UTC.</div>
          <SessionChart rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Net P&amp;L by Time of Day</div>
          <div className={capCls}>Entry hour, UTC — where your edge (or your leaks) actually happen.</div>
          <HourHistogram rows={chrono} dark={dark} />
        </div>

        <div className={`${cardCls} lg:col-span-2`}>
          <div className={titleCls}>Net P&amp;L by Day — Calendar</div>
          <div className={capCls}>Green = net profit that day, red = net loss, grey = no closed trades.</div>
          <CalendarHeatmap rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Net P&amp;L by Strategy / Setup</div>
          <div className={capCls}>Grouped by bot (or "Manual" for your own manual trades).</div>
          <StrategyChart rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Risk : Reward Map</div>
          <div className={capCls}>Each trade's actual R-multiple (PnL ÷ risk), in order closed.</div>
          <RiskRewardScatter rows={chrono} dark={dark} />
        </div>

        <div className={`${cardCls} lg:col-span-2`}>
          <div className={titleCls}>Max Drawdown Over Time</div>
          <div className={capCls}>Cumulative realized P&amp;L (equity) and drawdown from its running peak.</div>
          <DrawdownChart rows={chrono} dark={dark} />
        </div>

        <div className={`${cardCls} lg:col-span-2`}>
          <div className={titleCls}>Trade-by-Trade P&amp;L</div>
          <div className={capCls}>Every closed trade, in order — your actual trade sequence, not smoothed.</div>
          <TradeSequenceBars rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>SL Map — Distance vs Outcome</div>
          <div className={capCls}>Initial stop distance (% of entry price) vs realized P&amp;L.</div>
          <SlDistanceScatter rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Exit Reason Breakdown</div>
          <div className={capCls}>How your closed trades actually ended.</div>
          <ExitTypeBreakdown rows={chrono} dark={dark} />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Multiple TP vs Single TP</div>
          <div className={capCls}>Trades with TP2/TP3 set vs a single target — by direct request.</div>
          <ComparisonPair
            dark={dark}
            leftLabel="Single TP" left={chrono.filter((r) => r.tp_count <= 1)}
            rightLabel="Multiple TP" right={chrono.filter((r) => r.tp_count > 1)}
          />
        </div>

        <div className={cardCls}>
          <div className={titleCls}>Dynamic SL Shift vs Fixed SL</div>
          <div className={capCls}>Trades where you ever moved the stop after opening vs never touched it.</div>
          <ComparisonPair
            dark={dark}
            leftLabel="SL never shifted" left={chrono.filter((r) => !r.sl_shifted)}
            rightLabel="SL shifted" right={chrono.filter((r) => r.sl_shifted)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function rMultiple(r: DetailRow): number {
  return r.risk_amount > 0 ? r.realized_pnl / r.risk_amount : 0;
}

function entryHourUtc(r: DetailRow): number | null {
  if (!r.entry_timestamp) return null;
  const d = new Date(r.entry_timestamp.endsWith('Z') ? r.entry_timestamp : `${r.entry_timestamp}Z`);
  return isNaN(d.getTime()) ? null : d.getUTCHours();
}

function entryDateUtc(r: DetailRow): string | null {
  if (!r.entry_timestamp) return null;
  const d = new Date(r.entry_timestamp.endsWith('Z') ? r.entry_timestamp : `${r.entry_timestamp}Z`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Non-overlapping UTC-hour buckets — approximate, labeled as such
// rather than claiming precise session-open/close times, since those
// genuinely do overlap in reality (e.g. London/NY).
function sessionOf(hour: number): string {
  if (hour < 7) return 'Asian';
  if (hour < 12) return 'London';
  if (hour < 16) return 'London/NY Overlap';
  if (hour < 21) return 'New York';
  return 'Late/Off-hours';
}

interface Bucket { label: string; pnl: number; trades: number; wins: number }

function bucketRows(rows: DetailRow[], keyFn: (r: DetailRow) => string | null, order?: string[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = keyFn(r);
    if (key === null) continue;
    const b = map.get(key) || { label: key, pnl: 0, trades: 0, wins: 0 };
    b.pnl += r.realized_pnl;
    b.trades += 1;
    if (r.realized_pnl > 0) b.wins += 1;
    map.set(key, b);
  }
  const list = Array.from(map.values());
  if (order) {
    list.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }
  return list;
}

/** Horizontal P&L bars, generic across session/strategy/etc. — same
 * visual language as TradeAnalytics.tsx's own SymbolBars. */
function PnlBarList({ buckets, dark }: { buckets: Bucket[]; dark: boolean }) {
  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.pnl)));
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const pct = (Math.abs(b.pnl) / max) * 100;
        const positive = b.pnl >= 0;
        const winRate = b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0;
        return (
          <div key={b.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {b.label} <span className={`text-xs font-normal ${dark ? 'text-white/40' : 'text-gray-400'}`}>{b.trades} trade{b.trades === 1 ? '' : 's'} · {winRate}% win</span>
              </span>
              <span className={`text-sm font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>{money(b.pnl)}</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
              <div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SessionChart({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const buckets = bucketRows(rows, (r) => { const h = entryHourUtc(r); return h === null ? null : sessionOf(h); },
    ['Asian', 'London', 'London/NY Overlap', 'New York', 'Late/Off-hours']);
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} /> : <NoData dark={dark} />;
}

function StrategyChart({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const buckets = bucketRows(rows, (r) => r.bot_name || r.strategy_type || r.bot_id)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} /> : <NoData dark={dark} />;
}

function NoData({ dark }: { dark: boolean }) {
  return <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Not enough data yet.</p>;
}

/** 24-bar histogram, hour 0–23 UTC, bar height = |PnL|, colored by sign. */
function HourHistogram({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const byHour = new Map<number, number>();
  for (const r of rows) {
    const h = entryHourUtc(r);
    if (h === null) continue;
    byHour.set(h, (byHour.get(h) || 0) + r.realized_pnl);
  }
  const hours = Array.from({ length: 24 }, (_, h) => byHour.get(h) || 0);
  const max = Math.max(1, ...hours.map((v) => Math.abs(v)));
  const barW = 10, gap = 2, chartH = 90, midY = chartH / 2;
  const width = 24 * (barW + gap);
  return (
    <svg viewBox={`0 0 ${width} ${chartH + 16}`} className="w-full" style={{ height: 120 }}>
      <line x1={0} y1={midY} x2={width} y2={midY} stroke={dark ? '#ffffff22' : '#e5e7eb'} strokeWidth={1} />
      {hours.map((v, h) => {
        const barH = (Math.abs(v) / max) * (midY - 4);
        const x = h * (barW + gap);
        const y = v >= 0 ? midY - barH : midY;
        return (
          <g key={h}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, v === 0 ? 0 : 1)} fill={v >= 0 ? GREEN : RED} rx={1.5}>
              <title>{h}:00 UTC — {money(v)}</title>
            </rect>
            {h % 3 === 0 && (
              <text x={x + barW / 2} y={chartH + 12} textAnchor="middle" fontSize="7" fill={dark ? '#ffffff66' : '#9ca3af'}>{h}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Month-grid calendar — current month, day cells shaded by net P&L
 * sign/intensity, with prev/next navigation. */
function CalendarHeatmap({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const byDay = new Map<string, { pnl: number; trades: number }>();
  for (const r of rows) {
    const d = entryDateUtc(r);
    if (!d) continue;
    const e = byDay.get(d) || { pnl: 0, trades: 0 };
    e.pnl += r.realized_pnl;
    e.trades += 1;
    byDay.set(d, e);
  }
  const allDates = Array.from(byDay.keys()).sort();
  const [monthOffset, setMonthOffset] = useState(0);
  const latest = allDates.length ? new Date(`${allDates[allDates.length - 1]}T00:00:00Z`) : new Date();
  const viewDate = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + monthOffset, 1));
  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const maxAbs = Math.max(1, ...Array.from(byDay.values()).map((v) => Math.abs(v.pnl)));

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonthOffset((m) => m - 1)} className={`text-xs px-2 py-1 rounded ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>‹ Prev</button>
        <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
          {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <button onClick={() => setMonthOffset((m) => m + 1)} className={`text-xs px-2 py-1 rounded ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>Next ›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className={`text-[10px] font-medium ${dark ? 'text-white/30' : 'text-gray-400'}`}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entry = byDay.get(key);
          const intensity = entry ? Math.min(1, Math.abs(entry.pnl) / maxAbs) * 0.75 + 0.15 : 0;
          const bg = !entry
            ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
            : entry.pnl >= 0 ? `rgba(16,185,129,${intensity})` : `rgba(239,68,68,${intensity})`;
          return (
            <div
              key={i}
              className="aspect-square rounded flex flex-col items-center justify-center"
              style={{ background: bg }}
              title={entry ? `${key}: ${money(entry.pnl)} across ${entry.trades} trade${entry.trades === 1 ? '' : 's'}` : key}
            >
              <span className={`text-[10px] ${entry ? (dark ? 'text-white' : 'text-gray-900') : dark ? 'text-white/30' : 'text-gray-400'}`}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Each closed trade's R-multiple, plotted in the order it closed. */
function RiskRewardScatter({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  if (rows.length === 0) return <NoData dark={dark} />;
  const values = rows.map(rMultiple);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const w = 100, h = 60, midY = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 140 }} preserveAspectRatio="none">
      <line x1={0} y1={midY} x2={w} y2={midY} stroke={dark ? '#ffffff33' : '#d1d5db'} strokeWidth={0.5} />
      {values.map((v, i) => {
        const x = values.length > 1 ? (i / (values.length - 1)) * w : w / 2;
        const y = midY - (v / maxAbs) * (midY - 4);
        return (
          <circle key={i} cx={x} cy={y} r={1.6} fill={v >= 0 ? GREEN : RED} opacity={0.85}>
            <title>Trade {i + 1} ({rows[i].symbol}): {v.toFixed(2)}R, {money(rows[i].realized_pnl)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** Cumulative equity + drawdown-from-peak, over the trade sequence. */
function DrawdownChart({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  if (rows.length === 0) return <NoData dark={dark} />;
  let equity = 0, peak = 0;
  const equityPts: number[] = [];
  const ddPts: number[] = [];
  for (const r of rows) {
    equity += r.realized_pnl;
    peak = Math.max(peak, equity);
    equityPts.push(equity);
    ddPts.push(equity - peak);
  }
  const maxEquity = Math.max(1, ...equityPts.map(Math.abs));
  const maxDd = Math.max(1, ...ddPts.map((v) => Math.abs(v)));
  const worstDd = Math.min(...ddPts);
  const w = 200, hEq = 60, hDd = 30, gap = 6;
  const totalH = hEq + gap + hDd;
  const toXY = (i: number, v: number, height: number, max: number, baselineTop: boolean) => {
    const x = rows.length > 1 ? (i / (rows.length - 1)) * w : w / 2;
    const y = baselineTop ? height - (v / max) * height : (v / max) * height;
    return [x, y] as const;
  };
  const eqPath = equityPts.map((v, i) => { const [x, y] = toXY(i, v, hEq, maxEquity, true); return `${i === 0 ? 'M' : 'L'} ${x} ${y}`; }).join(' ');
  const ddPath = ddPts.map((v, i) => { const [x, y] = toXY(i, -v, hDd, maxDd, false); return `${i === 0 ? 'M' : 'L'} ${x} ${y}`; }).join(' ');
  const ddArea = `${ddPath} L ${w} 0 L 0 0 Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${totalH}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none">
        <path d={eqPath} fill="none" stroke={dark ? '#60a5fa' : '#005FB8'} strokeWidth={1.2} />
        <g transform={`translate(0, ${hEq + gap})`}>
          <path d={ddArea} fill={RED} opacity={0.18} />
          <path d={ddPath} fill="none" stroke={RED} strokeWidth={1} />
        </g>
      </svg>
      <div className="flex items-center justify-between mt-1 text-xs">
        <span className={dark ? 'text-white/50' : 'text-gray-500'}>Equity curve (top) · Drawdown from peak (bottom)</span>
        <span className="font-semibold text-red-500">Worst drawdown: {money(worstDd)}</span>
      </div>
    </div>
  );
}

/** Every closed trade in order, as a green/red bar — the real trade
 * sequence, "by Trade Map." */
function TradeSequenceBars({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  if (rows.length === 0) return <NoData dark={dark} />;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.realized_pnl)));
  const barW = Math.max(2, Math.min(10, 400 / rows.length));
  const gap = 1;
  const w = rows.length * (barW + gap);
  const h = 70, midY = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 140 }} preserveAspectRatio="none">
      <line x1={0} y1={midY} x2={w} y2={midY} stroke={dark ? '#ffffff22' : '#e5e7eb'} strokeWidth={0.5} />
      {rows.map((r, i) => {
        const barH = (Math.abs(r.realized_pnl) / max) * (midY - 2);
        const x = i * (barW + gap);
        const y = r.realized_pnl >= 0 ? midY - barH : midY;
        return (
          <rect key={r.trade_id} x={x} y={y} width={barW} height={Math.max(barH, 0.5)} fill={r.realized_pnl >= 0 ? GREEN : RED}>
            <title>Trade {i + 1} — {r.symbol}: {money(r.realized_pnl)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Initial SL distance (% of entry price) vs realized P&L — a rough
 * "does a tighter or wider stop actually work for you" read. */
function SlDistanceScatter({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const points = rows
    .filter((r) => r.entry_price && r.initial_stop_loss)
    .map((r) => ({
      distPct: Math.abs((r.entry_price! - r.initial_stop_loss!) / r.entry_price!) * 100,
      pnl: r.realized_pnl, symbol: r.symbol,
    }));
  if (points.length === 0) return <NoData dark={dark} />;
  const maxDist = Math.max(1e-6, ...points.map((p) => p.distPct));
  const maxPnl = Math.max(1, ...points.map((p) => Math.abs(p.pnl)));
  const w = 100, h = 70, midY = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 150 }} preserveAspectRatio="none">
      <line x1={0} y1={midY} x2={w} y2={midY} stroke={dark ? '#ffffff33' : '#d1d5db'} strokeWidth={0.5} />
      {points.map((p, i) => {
        const x = (p.distPct / maxDist) * (w - 4) + 2;
        const y = midY - (p.pnl / maxPnl) * (midY - 4);
        return (
          <circle key={i} cx={x} cy={y} r={1.8} fill={p.pnl >= 0 ? GREEN : RED} opacity={0.8}>
            <title>{p.symbol}: {p.distPct.toFixed(2)}% stop distance, {money(p.pnl)}</title>
          </circle>
        );
      })}
      <text x={w} y={h - 1} textAnchor="end" fontSize="4.5" fill={dark ? '#ffffff66' : '#9ca3af'}>→ wider stop</text>
    </svg>
  );
}

const EXIT_TYPE_LABELS: Record<string, string> = {
  tp1: 'TP1 Hit', tp2: 'TP2 Hit', tp3: 'TP3 Hit', stop_loss: 'Stop Loss',
  manual: 'Manual Close', trailing: 'Trailing Stop', structure: 'Structure Exit',
};
const EXIT_TYPE_COLORS: Record<string, string> = {
  tp1: GREEN, tp2: GREEN, tp3: GREEN, stop_loss: RED, manual: '#64748b', trailing: AMBER, structure: '#7c3aed',
};

function ExitTypeBreakdown({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.exit_type || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = rows.length;
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      {entries.map(([type, count]) => {
        const pct = (count / total) * 100;
        return (
          <div key={type}>
            <div className="flex items-baseline justify-between mb-1 text-xs">
              <span className={dark ? 'text-white/70' : 'text-gray-600'}>{EXIT_TYPE_LABELS[type] || type}</span>
              <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{count} ({pct.toFixed(0)}%)</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: EXIT_TYPE_COLORS[type] || '#94a3b8' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Side-by-side comparison of two trade groups — win rate, avg R,
 * total P&L, trade count. Backs both the multi-TP-vs-single-TP and
 * SL-shifted-vs-not comparisons. */
function ComparisonPair({
  dark, leftLabel, left, rightLabel, right,
}: { dark: boolean; leftLabel: string; left: DetailRow[]; rightLabel: string; right: DetailRow[] }) {
  function stats(rows: DetailRow[]) {
    const trades = rows.length;
    const wins = rows.filter((r) => r.realized_pnl > 0).length;
    const totalPnl = rows.reduce((s, r) => s + r.realized_pnl, 0);
    const avgR = trades > 0 ? rows.reduce((s, r) => s + rMultiple(r), 0) / trades : 0;
    return { trades, winRate: trades > 0 ? (wins / trades) * 100 : 0, totalPnl, avgR };
  }
  const l = stats(left), r = stats(right);
  const rows2: { metric: string; l: string; r: string; lGood?: boolean; rGood?: boolean }[] = [
    { metric: 'Trades', l: String(l.trades), r: String(r.trades) },
    { metric: 'Win rate', l: `${l.winRate.toFixed(0)}%`, r: `${r.winRate.toFixed(0)}%`, lGood: l.winRate >= r.winRate, rGood: r.winRate >= l.winRate },
    { metric: 'Avg R-multiple', l: l.avgR.toFixed(2), r: r.avgR.toFixed(2), lGood: l.avgR >= r.avgR, rGood: r.avgR >= l.avgR },
    { metric: 'Total P&L', l: money(l.totalPnl), r: money(r.totalPnl), lGood: l.totalPnl >= r.totalPnl, rGood: r.totalPnl >= l.totalPnl },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className={`text-xs font-semibold text-center py-1 rounded ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>{leftLabel}</div>
        <div className={`text-xs font-semibold text-center py-1 rounded ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>{rightLabel}</div>
      </div>
      <div className="space-y-1.5">
        {rows2.map((row) => (
          <div key={row.metric} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs py-1 border-b last:border-0 ${dark ? 'border-white/5' : 'border-gray-50'}`}>
            <span className={`text-right font-semibold ${row.lGood ? 'text-emerald-500' : dark ? 'text-white/70' : 'text-gray-700'}`}>{row.l}</span>
            <span className={`text-center ${dark ? 'text-white/30' : 'text-gray-400'}`}>{row.metric}</span>
            <span className={`text-left font-semibold ${row.rGood ? 'text-emerald-500' : dark ? 'text-white/70' : 'text-gray-700'}`}>{row.r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
