import { useEffect, useState } from 'react';
import { Info, X, Gauge } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from './LoadingIndicator';
import { FoldedCard } from './FoldedCard';
import { money } from './TradeAnalytics';
import type { TradeSource, TestLiveFilter } from './TradeAnalytics';
import { tradesApi } from '../services/api';
import type { EncroachmentResponse } from '../types';

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

/** What's actually being shown and how to read it — by direct request
 * ("Create an 'Info' button or link that explains the metric and how
 * best to interpret or use it ... default should be folded or
 * collapsed"). Lives INSIDE each FoldedCard (itself already folded by
 * default), so this is folded twice over until a trader deliberately
 * opens both — never pushed in front of anyone who didn't ask for it. */
function InfoNote({ text, dark }: { text: string; dark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`flex items-center gap-1 text-[11px] font-medium ${dark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <Info size={12} /> What is this?
      </button>
      {open && <p className={`mt-1.5 text-xs leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>{text}</p>}
    </div>
  );
}

/** A clicked bar/point/cell's own underlying trades — by direct
 * request ("provide a details option that helps to drill down to
 * specific trades to examine ... that way a user can then learn from
 * those specific trades"). ONE shared modal + opener, reused by every
 * chart below rather than a bespoke drill-down surface per chart.
 */
interface DrillDown { title: string; rows: DetailRow[] }

function DrillDownModal({ drillDown, onClose, dark }: { drillDown: DrillDown; onClose: () => void; dark: boolean }) {
  const sorted = [...drillDown.rows].sort((a, b) => (b.exit_timestamp || '').localeCompare(a.exit_timestamp || ''));
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{drillDown.title}</div>
            <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{sorted.length} trade{sorted.length === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onClose} className={dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {sorted.map((r) => {
            const r_ = rMultiple(r);
            return (
              <div key={r.trade_id} className={`rounded-lg p-3 text-xs ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {r.symbol} <span className={r.direction === 'long' ? 'text-smc-long' : 'text-smc-short'}>{r.direction.toUpperCase()}</span>
                  </span>
                  <span className={`font-bold ${r.realized_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {money(r.realized_pnl)} <span className="font-normal">({r_ >= 0 ? '+' : ''}{r_.toFixed(2)}R)</span>
                  </span>
                </div>
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                  <div>Entry: <span className="font-mono">{r.entry_price?.toFixed(4) ?? '—'}</span></div>
                  <div>SL: <span className="font-mono">{r.stop_loss.toFixed(4)}</span></div>
                  <div>Exit: {EXIT_TYPE_LABELS[r.exit_type || ''] || r.exit_type || '—'}</div>
                  <div>Bot: {r.bot_name || r.strategy_type || r.bot_id}</div>
                  <div className="col-span-2">Opened: {r.entry_timestamp ? new Date(r.entry_timestamp.endsWith('Z') ? r.entry_timestamp : `${r.entry_timestamp}Z`).toLocaleString() : '—'}</div>
                  <div className="col-span-2">Closed: {r.exit_timestamp ? new Date(r.exit_timestamp.endsWith('Z') ? r.exit_timestamp : `${r.exit_timestamp}Z`).toLocaleString() : '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
export function AdvancedTradeAnalytics({ dark, source, botId, testLive }: { dark: boolean; source: TradeSource; botId?: string; testLive?: TestLiveFilter }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<DetailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [retryTick, setRetryTick] = useState(0);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const openDrillDown = (title: string, drillRows: DetailRow[]) => setDrillDown({ title, rows: drillRows });

  useEffect(() => {
    if (!token) return;
    setRows(null);
    setError(null);
    // Bot/Strategy filter — by direct request ("include a strategy or
    // bot filter to ... Advanced Analytics — Trading Edge"). Shares
    // the same `bot_id` param TradeAnalytics passes down as `botId`,
    // already supported server-side by this exact endpoint. Test/Live
    // filter shares `testLive` the same way.
    const qsParams: string[] = [];
    if (source !== 'all') qsParams.push(`source=${source}`);
    if (botId) qsParams.push(`bot_id=${encodeURIComponent(botId)}`);
    if (testLive && testLive !== 'all') qsParams.push(`is_test=${testLive === 'test'}`);
    const qs = qsParams.length ? `?${qsParams.join('&')}` : '';
    fetchJsonWithRetry<DetailRow[]>(`${API_URL}/trades/analytics/detail${qs}`, { headers: { Authorization: `Bearer ${token}` } }, setPhase)
      .then((r) => {
        if (r) setRows(r);
        else setError('Could not load the advanced analytics right now.');
      });
  }, [token, source, botId, testLive, retryTick]);

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

      {/* Every card below now folds/unfolds on click (closed by
          default) — by direct request ("make all the cards in the
          portal fold with one click and unfold with another ... i
          dont want permanently open cards"). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FoldedCard title="Net P&L by Session" summary="Bucketed by each trade's entry hour, UTC." dark={dark}>
          <InfoNote dark={dark} text="Groups every closed trade by which broad market session it was ENTERED in (Asian/London/Overlap/New York/Off-hours), summing realized P&L per session. Use it to spot whether your edge actually lives in a specific session — if one session is consistently red, that's a candidate to stop trading (or trade smaller) rather than a universal time-of-day effect." />
          <SessionChart rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <FoldedCard title="Net P&L by Time of Day" summary="Entry hour, UTC — where your edge (or your leaks) actually happen." dark={dark}>
          <InfoNote dark={dark} text="Same idea as Net P&L by Session but at full hourly resolution (24 bars, UTC) instead of 5 broad buckets — lets you spot a narrower window (e.g. 'the first hour after London open') that a session-level view would average away." />
          <HourHistogram rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <FoldedCard title="Net P&L by Day-of-Week" summary="Mon..Sun, UTC — aggregated across every week, not tied to any specific date." dark={dark}>
          <InfoNote dark={dark} text="Groups every closed trade by which weekday it was ENTERED on (Monday through Sunday, UTC), summing realized P&L per weekday across your whole history. Different from the Calendar view below it, which shows individual dates — this answers 'is Tuesday just bad for me' rather than 'what happened on March 4th.'" />
          <DayOfWeekChart rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <div className="lg:col-span-2">
          <FoldedCard title="Net P&L by Day — Calendar" summary="Green = net profit that day, red = net loss, grey = no closed trades." dark={dark}>
            <InfoNote dark={dark} text="A calendar view of net realized P&L per day — darker shading means a bigger move (win or loss) that day. Click any day to see exactly which trades closed on it. Useful for spotting a cluster of bad days tied to a specific event or a run of overtrading." />
            <CalendarHeatmap rows={chrono} dark={dark} onDrillDown={openDrillDown} />
          </FoldedCard>
        </div>

        <FoldedCard title="Net P&L by Strategy / Setup" summary='Grouped by bot (or "Manual" for your own manual trades).' dark={dark}>
          <InfoNote dark={dark} text="Which bot (or your own manual trading) is actually making you money vs quietly losing it. A bot with a negative bar here is a real candidate to pause or re-tune, regardless of how its individual trades 'felt' in the moment." />
          <StrategyChart rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <FoldedCard title="Risk : Reward Map" summary="Each trade's actual R-multiple (PnL ÷ risk), in order closed." dark={dark}>
          <InfoNote dark={dark} text="Every closed trade's REALIZED R-multiple (how many multiples of the amount you risked you actually made or lost), plotted in the order it closed. A healthy edge shows more/bigger dots above the line than below it, even with a sub-50% win rate — that's what 'cutting losses, letting winners run' actually looks like in your own data." />
          <RiskRewardScatter rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <div className="lg:col-span-2">
          <FoldedCard title="Max Drawdown Over Time" summary="Cumulative realized P&L (equity) and drawdown from its running peak." dark={dark}>
            <InfoNote dark={dark} text="Top line: your running equity curve (cumulative realized P&L) across every closed trade in order. Bottom (red): how far below the running PEAK that equity curve has fallen at each point — your actual drawdown, not a theoretical one. The worst number shown is the largest real drawdown your account has lived through." />
            <DrawdownChart rows={chrono} dark={dark} />
          </FoldedCard>
        </div>

        <div className="lg:col-span-2">
          <FoldedCard title="Trade-by-Trade P&L" summary="Every closed trade, in order — your actual trade sequence, not smoothed." dark={dark}>
            <InfoNote dark={dark} text="One bar per closed trade, in the exact order they closed — the raw, un-smoothed sequence. Useful for seeing streakiness (a run of green or red bars in a row) that an aggregate win-rate number hides entirely. Click any bar for that trade's full detail." />
            <TradeSequenceBars rows={chrono} dark={dark} onDrillDown={openDrillDown} />
          </FoldedCard>
        </div>

        <FoldedCard title="SL Map — Distance vs Outcome" summary="Initial stop distance (% of entry price) vs realized P&L." dark={dark}>
          <InfoNote dark={dark} text="Each dot is one trade: how far (in % of entry price) its ORIGINAL stop-loss sat from entry, against what it actually realized. If losing trades cluster at a wider stop distance than winners, that's a concrete signal your stops may be too loose for this strategy — see the Drawdown Encroachment metric below for the other half of that question (how much of the stop distance price actually used before reversing)." />
          <SlDistanceScatter rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <div className="lg:col-span-2">
          <FoldedCard title="Drawdown & Target Encroachment" summary="How much of your SL (and TP) distance price actually used before the trade closed." icon={<Gauge size={16} />} dark={dark}>
            <InfoNote dark={dark} text="For each trade, fetches the REAL candles between entry and exit and measures how far price moved against you (as a % of your original stop distance) and in your favor (as a % of the distance to TP1) before it closed. 100% SL encroachment means price actually touched the stop; a WINNING trade with high SL encroachment survived a real scare first. The 'What if I tightened my SL?' table directly answers 'can I afford to reduce my usual SL by 25% or 50%' — it shows how many of your actual WINNERS would instead have been stopped out early at each tighter threshold, using your own real trade data. Capped to a limited number of recent trades per analysis since each one is a real exchange API call." />
            <EncroachmentCard dark={dark} source={source} botId={botId} testLive={testLive} />
          </FoldedCard>
        </div>

        <FoldedCard title="Exit Reason Breakdown" summary="How your closed trades actually ended." dark={dark}>
          <InfoNote dark={dark} text="What actually closed each trade — hit TP1/TP2/TP3, hit stop-loss, closed manually, trailing stop, or a structure-based exit. A portfolio dominated by 'Stop Loss' with few TP hits is a different problem (entries/targets) than one dominated by manual closes (discipline/process)." />
          <ExitTypeBreakdown rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <FoldedCard title="Multiple TP vs Single TP" summary="Trades with TP2/TP3 set vs a single target — by direct request." dark={dark}>
          <InfoNote dark={dark} text="Side-by-side comparison: trades where you scaled out across multiple targets (TP1/TP2/TP3) vs trades that only ever had one target. Compares win rate, average R and total P&L so you can see which approach has actually worked better in YOUR data, not in theory." />
          <ComparisonPair
            dark={dark}
            leftLabel="Single TP" left={chrono.filter((r) => r.tp_count <= 1)}
            rightLabel="Multiple TP" right={chrono.filter((r) => r.tp_count > 1)}
            onDrillDown={openDrillDown}
          />
        </FoldedCard>

        <FoldedCard title="Dynamic SL Shift vs Fixed SL" summary="Trades where you ever moved the stop after opening vs never touched it." dark={dark}>
          <InfoNote dark={dark} text="Trades where the stop-loss was ever moved after the position opened (e.g. trailing to breakeven) vs trades where it was left exactly where it started. Lets you check whether actively managing the stop has actually improved your outcomes or just given you something to do mid-trade." />
          <ComparisonPair
            dark={dark}
            leftLabel="SL never shifted" left={chrono.filter((r) => !r.sl_shifted)}
            rightLabel="SL shifted" right={chrono.filter((r) => r.sl_shifted)}
            onDrillDown={openDrillDown}
          />
        </FoldedCard>

        {/* Added by direct request ("add more features to trader
            analytics") — all four read the same closed-trade rows the
            cards above do, no new endpoint. */}
        <div className="lg:col-span-2">
          <FoldedCard title="Edge Scorecard" summary="Expectancy, profit factor, payoff ratio and average R — the headline numbers of your edge." dark={dark}>
            <InfoNote dark={dark} text="The headline numbers of a real trading edge: Expectancy (average $ you make per trade, long-run), Average R (same thing in risk-multiples), Profit Factor (gross profit ÷ gross loss — above 1 means profitable, above 1.5 is generally considered solid), Payoff Ratio (average win size ÷ average loss size), and Win Rate. A profitable edge does NOT require a win rate above 50% if the payoff ratio is high enough — these numbers together tell you which kind of edge you actually have. Click Best/Worst trade to see that trade." />
            <EdgeScorecard rows={chrono} dark={dark} onDrillDown={openDrillDown} />
          </FoldedCard>
        </div>

        <FoldedCard title="Streaks & Consistency" summary="Longest win/loss runs, current streak and how many days closed green." dark={dark}>
          <InfoNote dark={dark} text="Your longest actual winning and losing streaks (back to back trades), your current streak right now, and what fraction of trading days closed net positive. Useful for calibrating expectations — if your longest losing streak is 6, seeing 4 losses in a row isn't yet unusual for your own system." />
          <StreaksCard rows={chrono} dark={dark} />
        </FoldedCard>

        <FoldedCard title="Net P&L by Instrument" summary="Which symbols actually pay you, and which quietly cost you." dark={dark}>
          <InfoNote dark={dark} text="Net realized P&L grouped by traded symbol. A symbol that's consistently in the red regardless of which bot or direction traded it is a candidate to drop from your symbol list entirely." />
          <SymbolChart rows={chrono} dark={dark} onDrillDown={openDrillDown} />
        </FoldedCard>

        <div className="lg:col-span-2">
          <FoldedCard title="Long vs Short" summary="Whether your edge is directional — same stats, split by trade direction." dark={dark}>
            <InfoNote dark={dark} text="The same win rate / avg R / total P&L comparison as the other pairs above, split by LONG vs SHORT instead. If one direction is carrying all the P&L, that's worth knowing before assuming your edge works equally well both ways." />
            <ComparisonPair
              dark={dark}
              leftLabel="Long" left={chrono.filter((r) => r.direction === 'long')}
              rightLabel="Short" right={chrono.filter((r) => r.direction === 'short')}
              onDrillDown={openDrillDown}
            />
          </FoldedCard>
        </div>
      </div>

      {drillDown && <DrillDownModal drillDown={drillDown} onClose={() => setDrillDown(null)} dark={dark} />}

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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function entryDayOfWeekUtc(r: DetailRow): string | null {
  if (!r.entry_timestamp) return null;
  const d = new Date(r.entry_timestamp.endsWith('Z') ? r.entry_timestamp : `${r.entry_timestamp}Z`);
  return isNaN(d.getTime()) ? null : DAY_NAMES[d.getUTCDay()];
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

interface Bucket { label: string; pnl: number; trades: number; wins: number; rows: DetailRow[] }

function bucketRows(rows: DetailRow[], keyFn: (r: DetailRow) => string | null, order?: string[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = keyFn(r);
    if (key === null) continue;
    const b = map.get(key) || { label: key, pnl: 0, trades: 0, wins: 0, rows: [] };
    b.pnl += r.realized_pnl;
    b.trades += 1;
    if (r.realized_pnl > 0) b.wins += 1;
    b.rows.push(r);
    map.set(key, b);
  }
  const list = Array.from(map.values());
  if (order) {
    list.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }
  return list;
}

/** Horizontal P&L bars, generic across session/strategy/etc. — same
 * visual language as TradeAnalytics.tsx's own SymbolBars. Clickable
 * when onDrillDown is given — opens the trades behind that one bar. */
function PnlBarList({ buckets, dark, onDrillDown }: { buckets: Bucket[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.pnl)));
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const pct = (Math.abs(b.pnl) / max) * 100;
        const positive = b.pnl >= 0;
        const winRate = b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0;
        return (
          <div
            key={b.label}
            className={onDrillDown ? 'cursor-pointer' : undefined}
            onClick={() => onDrillDown?.(b.label, b.rows)}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'} ${onDrillDown ? 'hover:underline' : ''}`}>
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

function SessionChart({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const buckets = bucketRows(rows, (r) => { const h = entryHourUtc(r); return h === null ? null : sessionOf(h); },
    ['Asian', 'London', 'London/NY Overlap', 'New York', 'Late/Off-hours']);
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} onDrillDown={onDrillDown} /> : <NoData dark={dark} />;
}

// Net P&L by Day-of-Week — Mon..Sun aggregate (as distinct from the
// Calendar heatmap below, which buckets by actual calendar DATE, not
// which weekday it fell on). Same bucketing/rendering as SessionChart,
// just a different key function and a Mon-first order (ISO weekday
// convention) instead of DAY_NAMES's own Sun-first array order.
function DayOfWeekChart({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const buckets = bucketRows(rows, entryDayOfWeekUtc, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} onDrillDown={onDrillDown} /> : <NoData dark={dark} />;
}

function StrategyChart({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const buckets = bucketRows(rows, (r) => r.bot_name || r.strategy_type || r.bot_id)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} onDrillDown={onDrillDown} /> : <NoData dark={dark} />;
}

function NoData({ dark }: { dark: boolean }) {
  return <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Not enough data yet.</p>;
}

/** 24-bar histogram, hour 0–23 UTC, bar height = |PnL|, colored by sign. */
function HourHistogram({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const byHour = new Map<number, { pnl: number; rows: DetailRow[] }>();
  for (const r of rows) {
    const h = entryHourUtc(r);
    if (h === null) continue;
    const e = byHour.get(h) || { pnl: 0, rows: [] };
    e.pnl += r.realized_pnl;
    e.rows.push(r);
    byHour.set(h, e);
  }
  const hours = Array.from({ length: 24 }, (_, h) => byHour.get(h) || { pnl: 0, rows: [] });
  const max = Math.max(1, ...hours.map((v) => Math.abs(v.pnl)));
  const barW = 10, gap = 2, chartH = 90, midY = chartH / 2;
  const width = 24 * (barW + gap);
  return (
    <svg viewBox={`0 0 ${width} ${chartH + 16}`} className="w-full" style={{ height: 120 }}>
      <line x1={0} y1={midY} x2={width} y2={midY} stroke={dark ? '#ffffff22' : '#e5e7eb'} strokeWidth={1} />
      {hours.map((v, h) => {
        const barH = (Math.abs(v.pnl) / max) * (midY - 4);
        const x = h * (barW + gap);
        const y = v.pnl >= 0 ? midY - barH : midY;
        return (
          <g key={h}>
            <rect
              x={x} y={y} width={barW} height={Math.max(barH, v.pnl === 0 ? 0 : 1)} fill={v.pnl >= 0 ? GREEN : RED} rx={1.5}
              className={onDrillDown && v.rows.length ? 'cursor-pointer' : undefined}
              onClick={() => v.rows.length && onDrillDown?.(`${h}:00 UTC`, v.rows)}
            >
              <title>{h}:00 UTC — {money(v.pnl)}</title>
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
function CalendarHeatmap({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const byDay = new Map<string, { pnl: number; trades: number; rows: DetailRow[] }>();
  for (const r of rows) {
    const d = entryDateUtc(r);
    if (!d) continue;
    const e = byDay.get(d) || { pnl: 0, trades: 0, rows: [] };
    e.pnl += r.realized_pnl;
    e.trades += 1;
    e.rows.push(r);
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
              className={`aspect-square rounded flex flex-col items-center justify-center ${entry && onDrillDown ? 'cursor-pointer' : ''}`}
              style={{ background: bg }}
              title={entry ? `${key}: ${money(entry.pnl)} across ${entry.trades} trade${entry.trades === 1 ? '' : 's'}` : key}
              onClick={() => entry && onDrillDown?.(key, entry.rows)}
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
function RiskRewardScatter({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
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
          <circle
            key={i} cx={x} cy={y} r={1.6} fill={v >= 0 ? GREEN : RED} opacity={0.85}
            className={onDrillDown ? 'cursor-pointer' : undefined}
            onClick={() => onDrillDown?.(`${rows[i].symbol} — Trade ${i + 1}`, [rows[i]])}
          >
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
function TradeSequenceBars({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
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
          <rect
            key={r.trade_id} x={x} y={y} width={barW} height={Math.max(barH, 0.5)} fill={r.realized_pnl >= 0 ? GREEN : RED}
            className={onDrillDown ? 'cursor-pointer' : undefined}
            onClick={() => onDrillDown?.(`${r.symbol} — Trade ${i + 1}`, [r])}
          >
            <title>Trade {i + 1} — {r.symbol}: {money(r.realized_pnl)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Initial SL distance (% of entry price) vs realized P&L — a rough
 * "does a tighter or wider stop actually work for you" read. */
function SlDistanceScatter({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const points = rows
    .filter((r) => r.entry_price && r.initial_stop_loss)
    .map((r) => ({
      distPct: Math.abs((r.entry_price! - r.initial_stop_loss!) / r.entry_price!) * 100,
      pnl: r.realized_pnl, symbol: r.symbol, row: r,
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
          <circle
            key={i} cx={x} cy={y} r={1.8} fill={p.pnl >= 0 ? GREEN : RED} opacity={0.8}
            className={onDrillDown ? 'cursor-pointer' : undefined}
            onClick={() => onDrillDown?.(`${p.symbol} — ${p.distPct.toFixed(2)}% stop distance`, [p.row])}
          >
            <title>{p.symbol}: {p.distPct.toFixed(2)}% stop distance, {money(p.pnl)}</title>
          </circle>
        );
      })}
      <text x={w} y={h - 1} textAnchor="end" fontSize="4.5" fill={dark ? '#ffffff66' : '#9ca3af'}>→ wider stop</text>
    </svg>
  );
}

const ENCROACHMENT_LIMIT_OPTIONS = [10, 20, 30];

/** Drawdown & Target Encroachment — by direct request. Unlike every
 * other card on this page, this does NOT read off the already-fetched
 * `rows`/`chrono` dataset — it's backed by its own endpoint
 * (GET /trades/analytics/encroachment) that makes one REAL exchange
 * API call per trade analyzed, so it only ever fetches on an explicit
 * "Analyze" click (never on mount, never automatically on filter
 * change), with its own small "how many trades" control to bound that
 * cost up front. */
function EncroachmentCard({ dark, source, botId, testLive }: { dark: boolean; source: TradeSource; botId?: string; testLive?: TestLiveFilter }) {
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<EncroachmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function analyze() {
    setLoading(true);
    setError(null);
    tradesApi.getEncroachment({
      bot_id: botId || undefined,
      source: source !== 'all' ? source : undefined,
      is_test: testLive && testLive !== 'all' ? testLive === 'test' : undefined,
      limit,
    }).then(setResult).catch((e) => setError(e?.response?.data?.detail || 'Could not analyze encroachment right now.')).finally(() => setLoading(false));
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select
          value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
        >
          {ENCROACHMENT_LIMIT_OPTIONS.map((n) => <option key={n} value={n}>Analyze last {n} trades</option>)}
        </select>
        <button
          onClick={analyze} disabled={loading}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 ${dark ? 'bg-smc-accent' : 'bg-corporate-hero'}`}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {loading && <span className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>Fetching real candles per trade — this can take a few seconds…</span>}
      </div>

      {error && <p className={`text-sm ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      {!result && !loading && !error && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Click Analyze to compute real drawdown/target encroachment from your actual trade history.</p>
      )}

      {result && (
        <div className="space-y-4">
          <p className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            Analyzed {result.trades_analyzed} of {result.trades_requested} requested trades
            {result.trades_analyzed < result.trades_requested ? ' (the rest had no candle data available, e.g. a non-crypto broker)' : ''}.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-lg p-2.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${dark ? 'text-white/40' : 'text-gray-400'}`}>Avg SL Encroachment</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: RED }}>{result.avg_sl_encroachment_pct}%</div>
            </div>
            <div className={`rounded-lg p-2.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${dark ? 'text-white/40' : 'text-gray-400'}`}>Avg TP1 Encroachment</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: GREEN }}>{result.avg_tp_encroachment_pct}%</div>
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${dark ? 'text-white' : 'text-gray-900'}`}>What if I tightened my SL?</div>
            <div className="space-y-1">
              {result.what_if_tighter_sl.map((w) => (
                <div key={w.tighten_pct} className="flex items-center justify-between text-xs">
                  <span className={dark ? 'text-white/60' : 'text-gray-600'}>{w.tighten_pct}% tighter stop</span>
                  <span className={`font-semibold ${w.winners_would_be_stopped_pct > 25 ? 'text-red-500' : dark ? 'text-white' : 'text-gray-900'}`}>
                    {w.winners_would_be_stopped} of {w.winners_total} winners ({w.winners_would_be_stopped_pct}%) would have been stopped out
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.rows.length > 0 && (
            <div>
              <div className={`text-xs font-semibold mb-1.5 ${dark ? 'text-white' : 'text-gray-900'}`}>Per-trade SL encroachment</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.rows.map((r) => (
                  <div key={r.trade_id} className="flex items-center gap-2 text-xs">
                    <span className={`w-20 shrink-0 truncate ${dark ? 'text-white/60' : 'text-gray-600'}`}>{r.symbol}</span>
                    <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full" style={{ width: `${r.sl_encroachment_pct}%`, background: r.outcome === 'win' ? GREEN : r.outcome === 'loss' ? RED : AMBER }} />
                    </div>
                    <span className={`w-10 shrink-0 text-right font-mono ${dark ? 'text-white/50' : 'text-gray-500'}`}>{r.sl_encroachment_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EXIT_TYPE_LABELS: Record<string, string> = {
  tp1: 'TP1 Hit', tp2: 'TP2 Hit', tp3: 'TP3 Hit', stop_loss: 'Stop Loss',
  manual: 'Manual Close', trailing: 'Trailing Stop', structure: 'Structure Exit',
};
const EXIT_TYPE_COLORS: Record<string, string> = {
  tp1: GREEN, tp2: GREEN, tp3: GREEN, stop_loss: RED, manual: '#64748b', trailing: AMBER, structure: '#7c3aed',
};

function ExitTypeBreakdown({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const byType = new Map<string, DetailRow[]>();
  for (const r of rows) {
    const key = r.exit_type || 'unknown';
    const list = byType.get(key) || [];
    list.push(r);
    byType.set(key, list);
  }
  const total = rows.length;
  const entries = Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="space-y-2">
      {entries.map(([type, typeRows]) => {
        const count = typeRows.length;
        const pct = (count / total) * 100;
        return (
          <div key={type} className={onDrillDown ? 'cursor-pointer' : undefined} onClick={() => onDrillDown?.(EXIT_TYPE_LABELS[type] || type, typeRows)}>
            <div className="flex items-baseline justify-between mb-1 text-xs">
              <span className={`${dark ? 'text-white/70' : 'text-gray-600'} ${onDrillDown ? 'hover:underline' : ''}`}>{EXIT_TYPE_LABELS[type] || type}</span>
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
  dark, leftLabel, left, rightLabel, right, onDrillDown,
}: { dark: boolean; leftLabel: string; left: DetailRow[]; rightLabel: string; right: DetailRow[]; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
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
        <div
          className={`text-xs font-semibold text-center py-1 rounded ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'} ${onDrillDown ? 'cursor-pointer hover:underline' : ''}`}
          onClick={() => onDrillDown?.(leftLabel, left)}
        >
          {leftLabel}
        </div>
        <div
          className={`text-xs font-semibold text-center py-1 rounded ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'} ${onDrillDown ? 'cursor-pointer hover:underline' : ''}`}
          onClick={() => onDrillDown?.(rightLabel, right)}
        >
          {rightLabel}
        </div>
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

// ---------------------------------------------------------------------------
// Added analytics — all derived from the same closed-trade rows.
// ---------------------------------------------------------------------------

/** Headline edge stats: expectancy per trade (in R and in currency),
 *  profit factor, payoff ratio, win rate, best/worst trade. */
function EdgeScorecard({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  if (rows.length === 0) return <NoData dark={dark} />;
  const wins = rows.filter((r) => r.realized_pnl > 0);
  const losses = rows.filter((r) => r.realized_pnl < 0);
  const grossWin = wins.reduce((s, r) => s + r.realized_pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r.realized_pnl, 0));
  const winRate = (wins.length / rows.length) * 100;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const rs = rows.map(rMultiple).filter((v) => v !== 0);
  const avgR = rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : 0;
  const expectancy = rows.reduce((s, r) => s + r.realized_pnl, 0) / rows.length;
  const bestRow = rows.reduce((a, b) => (a.realized_pnl >= b.realized_pnl ? a : b));
  const worstRow = rows.reduce((a, b) => (a.realized_pnl <= b.realized_pnl ? a : b));

  const stats: { label: string; value: string; good?: boolean; rows?: DetailRow[] }[] = [
    { label: 'Expectancy / trade', value: `${expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}`, good: expectancy >= 0 },
    { label: 'Average R', value: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`, good: avgR >= 0 },
    { label: 'Profit factor', value: grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞', good: grossWin >= grossLoss },
    { label: 'Payoff ratio', value: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '∞', good: avgWin >= avgLoss },
    { label: 'Win rate', value: `${winRate.toFixed(1)}%`, good: winRate >= 50 },
    { label: 'Closed trades', value: String(rows.length), rows },
    { label: 'Best trade', value: `+${bestRow.realized_pnl.toFixed(2)}`, good: true, rows: [bestRow] },
    { label: 'Worst trade', value: worstRow.realized_pnl.toFixed(2), good: false, rows: [worstRow] },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-lg p-2.5 ${dark ? 'bg-white/5' : 'bg-gray-50'} ${s.rows && onDrillDown ? 'cursor-pointer' : ''}`}
          onClick={() => s.rows && onDrillDown?.(s.label, s.rows)}
        >
          <div className={`text-[10px] uppercase tracking-wide ${dark ? 'text-white/40' : 'text-gray-400'}`}>{s.label}</div>
          <div
            className="text-sm font-bold mt-0.5"
            style={{ color: s.good === undefined ? (dark ? '#e5e7eb' : '#111827') : s.good ? GREEN : RED }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Longest win/loss runs, current run, and daily green/red consistency. */
function StreaksCard({ rows, dark }: { rows: DetailRow[]; dark: boolean }) {
  if (rows.length === 0) return <NoData dark={dark} />;
  let bestWin = 0, bestLoss = 0, run = 0, runSign = 0;
  for (const r of rows) {
    const sign = r.realized_pnl >= 0 ? 1 : -1;
    run = sign === runSign ? run + 1 : 1;
    runSign = sign;
    if (sign > 0) bestWin = Math.max(bestWin, run);
    else bestLoss = Math.max(bestLoss, run);
  }
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = entryDateUtc(r);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + r.realized_pnl);
  }
  const days = [...byDay.values()];
  const greenDays = days.filter((v) => v > 0).length;

  const stats = [
    { label: 'Longest win streak', value: `${bestWin} trades`, good: true },
    { label: 'Longest losing streak', value: `${bestLoss} trades`, good: false },
    { label: 'Current streak', value: `${run} ${runSign > 0 ? 'win' : 'loss'}${run === 1 ? '' : 'es'}`, good: runSign > 0 },
    { label: 'Green days', value: days.length ? `${greenDays}/${days.length} (${((greenDays / days.length) * 100).toFixed(0)}%)` : '—', good: greenDays * 2 >= days.length },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className={`rounded-lg p-2.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className={`text-[10px] uppercase tracking-wide ${dark ? 'text-white/40' : 'text-gray-400'}`}>{s.label}</div>
          <div className="text-sm font-bold mt-0.5" style={{ color: s.good ? GREEN : RED }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Net P&L grouped by instrument. */
function SymbolChart({ rows, dark, onDrillDown }: { rows: DetailRow[]; dark: boolean; onDrillDown?: (title: string, rows: DetailRow[]) => void }) {
  const buckets = bucketRows(rows, (r) => r.symbol || null);
  return buckets.length ? <PnlBarList buckets={buckets} dark={dark} onDrillDown={onDrillDown} /> : <NoData dark={dark} />;
}
