import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DailyRow { date: string; trades: number; realized_pnl: number }
interface MonthRow { month: string; realized_pnl: number }
interface SymbolRow { symbol: string; trades: number; realized_pnl: number }
interface TradeAnalysis {
  win_rate: number; avg_win: number; avg_loss: number;
  best_trade: number; worst_trade: number; profit_factor: number | null;
}
interface Summary {
  total_closed_trades: number;
  daily_summary: DailyRow[];
  monthly_pnl: MonthRow[];
  by_symbol: SymbolRow[];
  trade_analysis: TradeAnalysis;
}

// A small, fixed categorical order for the Most Traded Pairs donut —
// deliberately NOT reusing this app's own emerald/red (already
// carries "profit/loss" meaning everywhere else on this page) so a
// symbol's slice color can't be misread as a PnL signal. Anything past
// the 5th symbol folds into "Other" rather than generating a 6th hue.
const DONUT_COLORS = ['#005FB8', '#f59e0b', '#00829B', '#7c3aed', '#64748b'];
const PAGE_SIZE = 5;

function money(n: number): string {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function Pager({ page, pageCount, onChange, dark }: { page: number; pageCount: number; onChange: (p: number) => void; dark: boolean }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1 mt-2">
      <button
        onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0}
        className={`px-2 py-1 rounded text-xs disabled:opacity-30 ${dark ? 'text-white/50 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        ‹
      </button>
      <span className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{page + 1} / {pageCount}</span>
      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))} disabled={page === pageCount - 1}
        className={`px-2 py-1 rounded text-xs disabled:opacity-30 ${dark ? 'text-white/50 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        ›
      </button>
    </div>
  );
}

/** Win-rate ring — a single-series donut, so per the color rules a
 * legend box isn't needed; the center label names it directly. */
function WinRateRing({ pct, dark }: { pct: number; dark: boolean }) {
  const r = 42, c = 2 * Math.PI * r;
  const good = pct >= 50;
  const stroke = good ? '#10b981' : '#ef4444';
  const track = dark ? '#ffffff1a' : '#e5e7eb';
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 50 50)"
      >
        <title>Win rate: {pct.toFixed(1)}%</title>
      </circle>
      <text x="50" y="47" textAnchor="middle" className={`text-[18px] font-extrabold font-display ${dark ? 'fill-white' : 'fill-corporate-text-on-bg'}`}>
        {pct.toFixed(0)}%
      </text>
      <text x="50" y="62" textAnchor="middle" className={`text-[8px] ${dark ? 'fill-white/40' : 'fill-gray-400'}`}>
        Win Rate
      </text>
    </svg>
  );
}

/** Avg Win vs Avg Loss — one bar, two magnitudes, split at their
 * relative share so the reader compares sizes directly rather than
 * reading two disconnected numbers. */
function AvgWinLossBar({ avgWin, avgLoss, dark }: { avgWin: number; avgLoss: number; dark: boolean }) {
  const w = Math.abs(avgWin), l = Math.abs(avgLoss);
  const total = w + l;
  const winPct = total > 0 ? (w / total) * 100 : 50;
  return (
    <div>
      <div className={`flex h-3 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        {winPct > 0 && <div className="h-full bg-emerald-500" style={{ width: `${winPct}%` }} />}
        {100 - winPct > 0 && <div className="h-full bg-red-500" style={{ width: `${100 - winPct}%` }} />}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className={dark ? 'text-white/50' : 'text-gray-500'}>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
          Avg Win <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{money(w)}</span>
        </span>
        <span className={dark ? 'text-white/50' : 'text-gray-500'}>
          Avg Loss <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{money(-l)}</span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1.5" />
        </span>
      </div>
    </div>
  );
}

function SymbolBars({ rows, dark }: { rows: SymbolRow[]; dark: boolean }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.realized_pnl)));
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = (Math.abs(r.realized_pnl) / max) * 100;
        const positive = r.realized_pnl >= 0;
        return (
          <div key={r.symbol}>
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {r.symbol} <span className={`text-xs font-normal ${dark ? 'text-white/40' : 'text-gray-400'}`}>{r.trades} trade{r.trades === 1 ? '' : 's'}</span>
              </span>
              <span className={`text-sm font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>{money(r.realized_pnl)}</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
              <div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }}>
                <title>{r.symbol}: {money(r.realized_pnl)} across {r.trades} trade{r.trades === 1 ? '' : 's'}</title>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Most Traded Pairs — categorical by symbol identity (trade count),
 * so color follows the symbol, not the PnL sign. <=5 slices: every
 * one gets a direct label in the legend, per the categorical rule for
 * small series counts (no color-only identity). */
function TradedPairsDonut({ rows, dark }: { rows: SymbolRow[]; dark: boolean }) {
  const sorted = [...rows].sort((a, b) => b.trades - a.trades);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4);
  const otherTrades = rest.reduce((s, r) => s + r.trades, 0);
  const slices = otherTrades > 0 ? [...top, { symbol: 'Other', trades: otherTrades, realized_pnl: 0 }] : top;
  const total = slices.reduce((s, r) => s + r.trades, 0) || 1;

  const r = 40, cx = 50, cy = 50;
  let angle = -90;
  const arcs = slices.map((s, i) => {
    const frac = s.trades / total;
    const start = angle;
    angle += frac * 360;
    // A single 100% slice needs its end angle nudged just short of a
    // full turn — SVG's arc command can't draw a circle when the
    // start and end points are identical (a real edge case here: one
    // symbol traded so far), it just renders nothing.
    const end = angle - start >= 360 ? start + 359.99 : angle;
    const large = end - start > 180 ? 1 : 0;
    const toXY = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
    const [x1, y1] = toXY(start);
    const [x2, y2] = toXY(end);
    return { symbol: s.symbol, trades: s.trades, frac, color: DONUT_COLORS[i % DONUT_COLORS.length], path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        {arcs.map((a) => (
          <path key={a.symbol} d={a.path} fill={a.color} stroke={dark ? '#161b2e' : '#fff'} strokeWidth="2">
            <title>{a.symbol}: {a.trades} trade{a.trades === 1 ? '' : 's'} ({(a.frac * 100).toFixed(0)}%)</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r="22" className={dark ? 'fill-corporate-surface-dark' : 'fill-white'} />
        <text x={cx} y={cy - 2} textAnchor="middle" className={`text-[9px] ${dark ? 'fill-white/40' : 'fill-gray-400'}`}>Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className={`text-[14px] font-extrabold font-display ${dark ? 'fill-white' : 'fill-corporate-text-on-bg'}`}>{total}</text>
      </svg>
      <div className="space-y-1.5">
        {arcs.map((a) => (
          <div key={a.symbol} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
            <span className={dark ? 'text-white/70' : 'text-gray-600'}>{a.symbol}</span>
            <span className={dark ? 'text-white/40' : 'text-gray-400'}>: {a.trades}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function profitFactorLabel(pf: number | null): { text: string; cls: string } {
  if (pf === null) return { text: 'No losses yet', cls: 'text-emerald-500' };
  if (pf >= 2) return { text: 'Strong', cls: 'text-emerald-500' };
  if (pf >= 1) return { text: 'Profitable', cls: 'text-amber-500' };
  return { text: 'Losing overall', cls: 'text-red-500' };
}

/**
 * TradeAnalytics — real per-account trading analytics, styled after
 * the reference dashboard (a prop-firm challenge app) but scoped to
 * what THIS app can honestly back with real numbers. The reference
 * also shows a running account Balance/Equity, an Equity Stability
 * Score, and pass/fail Trading Rules (Max Loss, Daily Loss, Profit
 * Target) against a configured challenge — none of that exists here:
 * this app has no persisted account-balance concept and no configured
 * challenge rules, so building those would mean inventing numbers
 * with nothing real behind them. What's shown below (win rate, avg
 * win/loss, best/worst trade, profit factor, performance by symbol,
 * most traded pairs, daily/monthly realized PnL) is entirely computed
 * from the caller's own closed trades — see
 * routers/trades.py::analytics_summary.
 */
export function TradeAnalytics({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyPage, setDailyPage] = useState(0);
  const [monthPage, setMonthPage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    setError(null);
    apiFetch(`${API_URL}/trades/analytics/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        // A 402 (access expired) is already surfaced by the global
        // AccessExpiredGate — apiFetch triggers that card itself, so
        // this component just needs to stop claiming to be "loading."
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSummary)
      .catch(() => setError('Could not load trade analytics right now.'));
  }, [token, retryTick]);

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-4 ${dark ? 'text-white/40' : 'text-gray-400'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  if (error) {
    return (
      <div className={`text-sm ${dark ? 'text-red-400' : 'text-red-500'}`}>
        {error}{' '}
        <button
          onClick={() => setRetryTick((n) => n + 1)}
          className={`underline font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
        >
          Try again
        </button>
      </div>
    );
  }
  if (summary === null) {
    return <p className={`text-sm ${mutedCls}`}>Loading trade analytics…</p>;
  }
  if (summary.total_closed_trades === 0) {
    return <p className={`text-sm ${mutedCls}`}>No closed trades yet — analytics fill in once you have some trade history.</p>;
  }

  const ta = summary.trade_analysis;
  const pf = profitFactorLabel(ta.profit_factor);
  const dailyPageCount = Math.max(1, Math.ceil(summary.daily_summary.length / PAGE_SIZE));
  const monthPageCount = Math.max(1, Math.ceil(summary.monthly_pnl.length / PAGE_SIZE));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={cardCls}>
        <div className={titleCls}>Trade Analysis</div>
        <div className="flex items-center gap-6 mb-4">
          <WinRateRing pct={ta.win_rate} dark={dark} />
          <div>
            <div className={`text-xs mb-0.5 ${mutedCls}`}>Profit Factor</div>
            <div className={`text-2xl font-extrabold font-display ${dark ? 'text-white' : 'text-gray-900'}`}>
              {ta.profit_factor === null ? '—' : ta.profit_factor.toFixed(2)}
            </div>
            <div className={`text-xs font-medium ${pf.cls}`}>{pf.text}</div>
          </div>
        </div>
        <AvgWinLossBar avgWin={ta.avg_win} avgLoss={ta.avg_loss} dark={dark} />
        <div className={`flex items-center justify-between mt-4 pt-4 border-t ${dark ? 'border-white/10' : 'border-gray-100'}`}>
          <div>
            <div className={`text-xs ${mutedCls}`}>Best Trade</div>
            <div className="text-sm font-bold text-emerald-500">{money(ta.best_trade)}</div>
          </div>
          <div className="text-right">
            <div className={`text-xs ${mutedCls}`}>Worst Trade</div>
            <div className="text-sm font-bold text-red-500">{money(ta.worst_trade)}</div>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <div className={titleCls}>Most Traded Pairs</div>
        <TradedPairsDonut rows={summary.by_symbol} dark={dark} />
      </div>

      <div className={cardCls}>
        <div className={titleCls}>Performance by Symbol</div>
        {summary.by_symbol.length === 0 ? (
          <p className={`text-sm ${mutedCls}`}>Nothing to show yet.</p>
        ) : (
          <SymbolBars rows={summary.by_symbol} dark={dark} />
        )}
      </div>

      <div className={cardCls}>
        <div className={titleCls}>Monthly Realized PnL</div>
        <div className="space-y-1">
          {summary.monthly_pnl.slice(monthPage * PAGE_SIZE, monthPage * PAGE_SIZE + PAGE_SIZE).map((m) => (
            <div key={m.month} className={`flex items-center justify-between py-1.5 text-sm border-b last:border-0 ${dark ? 'border-white/5' : 'border-gray-50'}`}>
              <span className={dark ? 'text-white/60' : 'text-gray-600'}>{m.month}</span>
              <span className={`font-semibold ${m.realized_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{money(m.realized_pnl)}</span>
            </div>
          ))}
        </div>
        <Pager page={monthPage} pageCount={monthPageCount} onChange={setMonthPage} dark={dark} />
      </div>

      <div className={`${cardCls} lg:col-span-2`}>
        <div className={titleCls}>Daily Summary</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left text-xs ${mutedCls}`}>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Trades</th>
                <th className="pb-2 font-medium">Realized PnL</th>
              </tr>
            </thead>
            <tbody>
              {summary.daily_summary.slice(dailyPage * PAGE_SIZE, dailyPage * PAGE_SIZE + PAGE_SIZE).map((d) => (
                <tr key={d.date} className={`border-t ${dark ? 'border-white/5' : 'border-gray-50'}`}>
                  <td className={`py-2 ${dark ? 'text-white/70' : 'text-gray-700'}`}>{d.date}</td>
                  <td className={dark ? 'text-white/50' : 'text-gray-500'}>{d.trades}</td>
                  <td className={`font-semibold ${d.realized_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{money(d.realized_pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`text-xs mt-1 ${mutedCls}`}>
          {summary.daily_summary.length === 0
            ? 'No days with closed trades yet.'
            : `${dailyPage * PAGE_SIZE + 1}-${Math.min((dailyPage + 1) * PAGE_SIZE, summary.daily_summary.length)} of ${summary.daily_summary.length}`}
        </div>
        <Pager page={dailyPage} pageCount={dailyPageCount} onChange={setDailyPage} dark={dark} />
      </div>
    </div>
  );
}
