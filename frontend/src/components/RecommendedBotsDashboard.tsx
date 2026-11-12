import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertOctagon, AlertTriangle, CheckCircle2, Info, Lightbulb, ListChecks, RefreshCw, Table2, Target, TrendingDown, TrendingUp,
} from 'lucide-react';
import { botsApi } from '../services/api';
import { formatApiError } from '../lib/apiError';
import type { RecBotRow, RecStats, RecVerdictLevel, RecommendedDashboard } from '../types';
import { InfoTip } from './InfoTip';
import { GLOSSARY, type GlossaryEntry } from '../config/recommendedDashboardGlossary';

/**
 * RecommendedBotsDashboard — the forward-performance dashboard for the
 * Recommended Bots roster, by direct request ("include the basis of the
 * new recommendations in a new Bot dashboard on the bot page ... a
 * dynamic dashboard with charts and diagrams on the performance of the
 * recommended bots going forward ... a review of key insights and
 * recommendations summary section").
 *
 * Every number comes from GET /bots/recommended-dashboard, recomputed
 * from real trades on each load and auto-refreshed every 60s. The core
 * idea is a running comparison: each bot's LIVE record against the
 * EVIDENCE (its strategy family's pre-rollout record on the same
 * instrument) that put it on the roster.
 *
 * Colour follows the dataviz method, validated on this app's own
 * surfaces (#ffffff light, #111827 dark): blue = live, orange =
 * evidence (only two categorical slots ever on one chart); blue/red is
 * the diverging pair for signed values; status colours always ship
 * with an icon + label, never colour alone; every chart has a table
 * view.
 */

const PALETTE = {
  light: { live: '#2a78d6', evidence: '#eb6834', neg: '#e34948', grid: '#e5e7eb', axis: '#6b7280', track: '#e5e7eb' },
  dark: { live: '#3987e5', evidence: '#d95926', neg: '#e66767', grid: '#1f2937', axis: '#9ca3af', track: '#1f2937' },
};

const LEVEL_META: Record<RecVerdictLevel, { icon: ReactNode; cls: string; label: string }> = {
  good: { icon: <CheckCircle2 size={14} />, cls: 'text-emerald-500', label: 'Good' },
  warning: { icon: <AlertTriangle size={14} />, cls: 'text-amber-500', label: 'Watch' },
  serious: { icon: <TrendingDown size={14} />, cls: 'text-orange-500', label: 'Behind' },
  critical: { icon: <AlertOctagon size={14} />, cls: 'text-red-500', label: 'Review' },
  info: { icon: <Info size={14} />, cls: 'text-gray-400', label: 'Info' },
};

const EXIT_LABELS: Record<string, string> = {
  tp1: 'TP1', tp2: 'TP2', tp3: 'TP3', trailing: 'Trailing stop', stop_loss: 'Stop loss', manual: 'Manual', structure: 'Structure exit', unknown: 'Unknown',
};

const short = (s: string) => s.replace('USDT.P', '').replace('NCCO1OIL', '').replace('2USDUSDT.P', '').replace('2USD', '');
const famLabel = (f: string) => `Bot ${f.replace('bot_', '')}`;
const fmtR = (r: number | null | undefined) => (r === null || r === undefined ? '—' : `${r > 0 ? '+' : ''}${r.toFixed(2)}R`);
const fmtPct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : `${p}%`);
const fmtPF = (pf: RecStats['profit_factor']) => (pf === null ? '—' : typeof pf === 'string' ? pf : pf.toFixed(2));

export function RecommendedBotsDashboard({ dark = false }: { dark?: boolean }) {
  const c = dark ? PALETTE.dark : PALETTE.light;
  const [data, setData] = useState<RecommendedDashboard | null>(null);
  const [focus, setFocus] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([
        botsApi.getRecommendedDashboard(),
        botsApi.getInstrumentSelection().catch(() => null),
      ]);
      setData(d);
      setFocus(f ? f.effective_symbols : null);
      setError(null);
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not load the Recommended Bots dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const surface = dark ? 'bg-smc-dark/40 border-smc-border' : 'bg-gray-50 border-gray-200';
  const tooltipStyle = {
    background: dark ? '#111827' : '#ffffff', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
    borderRadius: 8, fontSize: 12, color: dark ? '#f3f4f6' : '#111827',
  };

  const compareRows = useMemo(() => (data?.bots ?? []).map((b) => ({
    name: `${famLabel(b.family)} · ${short(b.symbol)}`,
    live: b.live.avg_r ?? 0,
    evidence: b.baseline.avg_r ?? 0,
    liveN: b.live.n,
    evidenceN: b.baseline.n,
  })), [data]);

  if (error && !data) return <p className="text-sm text-smc-danger">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Loading the Recommended Bots dashboard…</p>;
  if (!data.bots.length) {
    return <p className="text-sm text-gray-400">No Recommended Bots yet — this dashboard appears once the recommended roster exists.</p>;
  }

  const target = data.confidence_target ?? 21;
  const t = data.totals!;
  const bt = data.baseline_totals!;
  const hasLive = t.n > 0;
  const rolloutDate = data.rollout_at ? new Date(data.rollout_at.endsWith('Z') ? data.rollout_at : `${data.rollout_at}Z`) : null;

  return (
    <div className="space-y-6 text-sm">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <InfoTip entry={GLOSSARY.dashboard} dark={dark} />
          <span>
            Live since {rolloutDate ? rolloutDate.toUTCString().slice(5, 16) : '—'} · day {data.days_live ?? 0} ·
            {' '}{t.active_bot_count}/{t.bot_count} bots active · refreshes every minute
          </span>
          <span className="inline-flex items-center gap-1">· Live vs evidence <InfoTip entry={GLOSSARY.live_vs_evidence_concept} dark={dark} /></span>
          <span className="inline-flex items-center gap-1">· What is R? <InfoTip entry={GLOSSARY.r_unit} dark={dark} /></span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTables((v) => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300">
            <Table2 size={13} /> {tables ? 'Show charts' : 'Show as tables'}
          </button>
          <InfoTip entry={GLOSSARY.view_toggle} dark={dark} />
          <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI tiles: live, with the evidence alongside */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_trades} label="Closed trades" value={String(t.n)} sub={`${t.open_trades} open now`} />
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_win_rate} label="Win rate" value={fmtPct(t.win_rate_pct)} sub={`evidence ${fmtPct(bt.win_rate_pct)}`} />
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_avg_r} label="Average R" value={fmtR(t.avg_r)} sub={`evidence ${fmtR(bt.avg_r)}`}
          trend={hasLive && t.avg_r !== null && bt.avg_r !== null ? (t.avg_r >= bt.avg_r * 0.5 ? 'up' : 'down') : undefined} />
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_net_r} label="Net R" value={fmtR(t.total_r)} sub={`$${t.total_pnl.toFixed(2)} P&L`} />
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_profit_factor} label="Profit factor" value={fmtPF(t.profit_factor)} sub={`evidence ${fmtPF(bt.profit_factor)}`} />
        <Kpi surface={surface} dark={dark} info={GLOSSARY.kpi_drawdown} label="Max drawdown" value={`${t.max_drawdown_r.toFixed(2)}R`} sub="peak-to-trough, cumulative R" />
      </div>

      {/* Roster diagram: instrument -> its bots, focus + verdict */}
      <Section dark={dark} info={GLOSSARY.roster_map} title="Roster map" icon={<Target size={15} />} note="Each instrument with its recommended bots. Highlighted instruments are inside your current Instrument Focus and can open new trades.">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {data.instruments.map((inst) => {
            const inFocus = focus === null || focus.includes(inst.symbol);
            const bots = data.bots.filter((b) => b.symbol === inst.symbol);
            return (
              <div key={inst.symbol} className={`rounded-xl border p-3 ${inFocus
                ? (dark ? 'border-smc-accent/60 bg-smc-accent/5' : 'border-corporate-hero/50 bg-corporate-hero/5')
                : surface + ' opacity-70'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{short(inst.symbol)}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${inFocus ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {inFocus ? '● trading' : '○ standby'}<InfoTip entry={GLOSSARY.trading_status} dark={dark} />
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  live {inst.live.n ? `${fmtR(inst.live.avg_r)} · n=${inst.live.n}` : 'no trades yet'} · evidence {fmtR(inst.baseline.avg_r)}
                </div>
                <div className="mt-2 space-y-1.5">
                  {bots.map((b) => <BotChip key={b.bot_id} b={b} track={c.track} live={c.live} target={target} />)}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Equity curve */}
      <Section dark={dark} info={GLOSSARY.equity_curve} title="Cumulative R — the roster's equity curve" icon={<Activity size={15} />}
        note="Every closed recommended-bot trade in order, summed in R (risk units), so instruments with different prices compare fairly.">
        {!hasLive ? <Empty text="The curve starts with the first closed trade." /> : tables ? (
          <SimpleTable head={['Closed', 'Bot', 'Instrument', 'R', 'Cumulative R']}
            rows={data.equity.map((p) => [p.t.slice(0, 16).replace('T', ' '), p.bot_id, short(p.symbol), fmtR(p.r), fmtR(p.cum_r)])} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.equity.map((p, i) => ({ ...p, idx: i + 1 }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="recEq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.live} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={c.live} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="idx" stroke={c.axis} fontSize={10} tickLine={false} label={{ value: 'trade #', position: 'insideBottomRight', fill: c.axis, fontSize: 10 }} />
              <YAxis stroke={c.axis} fontSize={10} tickLine={false} unit="R" width={44} />
              <ReferenceLine y={0} stroke={c.axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }}
                formatter={(v: number, k: string) => [fmtR(v), k === 'cum_r' ? 'Cumulative' : k]}
                labelFormatter={(_l, p) => (p?.[0] ? `${p[0].payload.bot_id} · ${short(p[0].payload.symbol)} · this trade ${fmtR(p[0].payload.r)}` : '')} />
              <Area type="monotone" dataKey="cum_r" stroke={c.live} strokeWidth={2} fill="url(#recEq)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Live vs evidence */}
        <Section dark={dark} info={GLOSSARY.live_vs_evidence_chart} title="Live vs evidence — average R per bot" icon={<TrendingUp size={15} />}
          note="Blue is what each bot is doing now; orange is the pre-rollout record that earned its place. Bots under 5 live trades show their live bar near zero — read the confidence meters first.">
          {tables ? (
            <SimpleTable head={['Bot', 'Live avg R', 'Live n', 'Evidence avg R', 'Evidence n']}
              rows={compareRows.map((r) => [r.name, fmtR(r.live), String(r.liveN), fmtR(r.evidence), String(r.evidenceN)])} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, compareRows.length * 30)}>
              <BarChart data={compareRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke={c.grid} horizontal={false} />
                <XAxis type="number" stroke={c.axis} fontSize={10} unit="R" tickLine={false} />
                <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={10} width={110} tickLine={false} />
                <ReferenceLine x={0} stroke={c.axis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k: string, p: any) => [`${fmtR(v)} (n=${k === 'live' ? p.payload.liveN : p.payload.evidenceN})`, k === 'live' ? 'Live' : 'Evidence']} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'live' ? 'Live' : 'Evidence')} />
                <Bar dataKey="live" fill={c.live} radius={[0, 4, 4, 0]} barSize={9} />
                <Bar dataKey="evidence" fill={c.evidence} radius={[0, 4, 4, 0]} barSize={9} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Confidence meters */}
        <Section dark={dark} info={GLOSSARY.confidence} title="Confidence meters — progress to a reliable record" icon={<ListChecks size={15} />}
          note="A bot's live numbers are treated as reliable at 21 closed trades — the Basic-mode baseline. Until then, the verdict says so instead of guessing.">
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            What do the verdict labels mean? <InfoTip entry={GLOSSARY.verdicts} dark={dark} />
          </div>
          <div className="space-y-2">
            {data.bots.map((b) => {
              const meta = LEVEL_META[b.verdict.level];
              return (
                <div key={b.bot_id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{famLabel(b.family)} · {short(b.symbol)}</span>
                    <span className={`flex items-center gap-1 ${meta.cls}`}>{meta.icon}<span>{b.verdict.label}</span></span>
                  </div>
                  <div className="h-2 rounded-full mt-1" style={{ background: c.track }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(2, b.confidence_pct)}%`, background: c.live }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{b.live.n}/{target} trades · {b.open_trades} open{b.last_trade_at ? ` · last closed ${b.last_trade_at.slice(0, 10)}` : ''}</div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section dark={dark} info={GLOSSARY.r_distribution} title="R distribution" icon={<Activity size={15} />} note="Wins are counted above the zero line, losses below it. A healthy trend-following roster has a long tail of wins to the right.">
          {!hasLive ? <Empty text="Fills in as trades close." /> : tables ? (
            <SimpleTable head={['Outcome', 'Trades']} rows={data.r_distribution.map((b) => [b.bin, String(b.count)])} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.r_distribution.map((b, i) => ({ ...b, signed: i < 2 ? -b.count : b.count }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="bin" stroke={c.axis} fontSize={9} tickLine={false} interval={0} angle={-20} height={44} textAnchor="end" />
                <YAxis stroke={c.axis} fontSize={10} allowDecimals={false} tickLine={false} tickFormatter={(v: number) => String(Math.abs(v))} />
                <ReferenceLine y={0} stroke={c.axis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [Math.abs(v), v < 0 ? 'Losing trades' : 'Winning / flat trades']} />
                <Bar dataKey="signed" radius={[4, 4, 0, 0]}>
                  {data.r_distribution.map((b, i) => <Cell key={b.bin} fill={i < 2 ? c.neg : c.live} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section dark={dark} info={GLOSSARY.daily_pnl} title="Daily P&L" icon={<Activity size={15} />} note="Blue days made money, red days lost it.">
          {!hasLive ? <Empty text="Fills in as trades close." /> : tables ? (
            <SimpleTable head={['Day', 'Trades', 'R', 'P&L']} rows={data.daily.map((d) => [d.day, String(d.n), fmtR(d.r), `$${d.pnl.toFixed(2)}`])} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.daily} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="day" stroke={c.axis} fontSize={9} tickLine={false} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis stroke={c.axis} fontSize={10} tickLine={false} unit="$" />
                <ReferenceLine y={0} stroke={c.axis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _k, p: any) => [`$${v.toFixed(2)} · ${fmtR(p.payload.r)} · ${p.payload.n} trades`, 'P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {data.daily.map((d) => <Cell key={d.day} fill={d.pnl >= 0 ? c.live : c.neg} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section dark={dark} info={GLOSSARY.exits} title="How trades end" icon={<Activity size={15} />} note="Exit mix. Many stop-outs with few trailing exits means runners are being cut short.">
          {!data.exits.length ? <Empty text="Fills in as trades close." /> : (
            <div className="space-y-1.5">
              {data.exits.map((e) => {
                const pct = Math.round((100 * e.count) / t.n);
                return (
                  <div key={e.exit_type}>
                    <div className="flex justify-between text-xs"><span>{EXIT_LABELS[e.exit_type] ?? e.exit_type}</span><span className="tabular-nums">{e.count} · {pct}%</span></div>
                    <div className="h-1.5 rounded-full mt-0.5" style={{ background: c.track }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: e.exit_type === 'stop_loss' ? c.neg : c.live }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Key insights + recommendations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section dark={dark} info={GLOSSARY.insights} title="Key insights" icon={<Lightbulb size={15} />} note="Generated from the live data on every refresh, with sample-size guards so small streaks are never presented as verdicts.">
          <ul className="space-y-2">
            {data.insights.map((ins, i) => {
              const meta = LEVEL_META[ins.level];
              return (
                <li key={i} className={`rounded-lg border p-2.5 ${surface}`}>
                  <div className={`flex items-center gap-1.5 font-semibold ${meta.cls}`}>
                    {meta.icon}<span className="text-[10px] uppercase tracking-wide">{meta.label}</span>
                    <span className={dark ? 'text-white' : 'text-gray-900'}>{ins.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{ins.detail}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section dark={dark} info={GLOSSARY.recommendations} title="Recommendations summary" icon={<ListChecks size={15} />} note="Prioritised actions, highest first. They update as the live record grows.">
          <ol className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className={`rounded-lg border p-2.5 ${surface}`}>
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center text-white`} style={{ background: r.priority === 1 ? c.neg : c.live }}>
                    P{r.priority}
                  </span>
                  <div>
                    <div className="font-semibold">{r.action}</div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.why}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Basis of the recommendations */}
      <Section dark={dark} info={GLOSSARY.basis} title="Basis of the recommendations" icon={<Info size={15} />}
        note="The evidence each bot was selected on: its strategy's closed trades on that instrument, from every other bot, before the roster went live. It is frozen — nothing can be added to a past date — so this is exactly what the selection saw.">
        <div className={`rounded-lg border p-3 mb-3 text-xs space-y-1 ${surface}`}>
          <div className="flex items-start gap-1"><InfoTip entry={GLOSSARY.evidence_score} dark={dark} /><span><span className="font-semibold">Ranking:</span> {data.selection_rule.score}</span></div>
          <div className="flex items-start gap-1"><InfoTip entry={GLOSSARY.eligibility} dark={dark} /><span><span className="font-semibold">Eligible:</span> {data.selection_rule.eligibility}</span></div>
          <div className="flex items-start gap-1"><InfoTip entry={GLOSSARY.pick_rule} dark={dark} /><span><span className="font-semibold">Pick:</span> {data.selection_rule.pick}</span></div>
          <div className="flex items-start gap-1"><InfoTip entry={GLOSSARY.build_rule} dark={dark} /><span><span className="font-semibold">Build:</span> {data.selection_rule.source}</span></div>
          <div className="flex items-start gap-1"><InfoTip entry={GLOSSARY.confidence_floor} dark={dark} /><span><span className="font-semibold">Confidence:</span> {data.selection_rule.confidence_floor}</span></div>
        </div>
        <SimpleTable
          head={['Instrument', 'Bot',
            <span key="en" className="inline-flex items-center gap-1">Evidence n<InfoTip entry={GLOSSARY.col_evidence_n} dark={dark} /></span>,
            <span key="wr" className="inline-flex items-center gap-1">Win %<InfoTip entry={GLOSSARY.kpi_win_rate} dark={dark} /></span>,
            <span key="ar" className="inline-flex items-center gap-1">Avg R<InfoTip entry={GLOSSARY.kpi_avg_r} dark={dark} /></span>,
            <span key="pf" className="inline-flex items-center gap-1">Profit factor<InfoTip entry={GLOSSARY.kpi_profit_factor} dark={dark} /></span>,
            <span key="es" className="inline-flex items-center gap-1">Evidence score<InfoTip entry={GLOSSARY.evidence_score} dark={dark} /></span>,
            <span key="ln" className="inline-flex items-center gap-1">Live n<InfoTip entry={GLOSSARY.col_live_n} dark={dark} /></span>,
            <span key="la" className="inline-flex items-center gap-1">Live avg R<InfoTip entry={GLOSSARY.kpi_avg_r} dark={dark} /></span>,
            <span key="vd" className="inline-flex items-center gap-1">Verdict<InfoTip entry={GLOSSARY.verdicts} dark={dark} /></span>]}
          rows={data.bots.map((b) => [
            short(b.symbol), famLabel(b.family), String(b.baseline.n), fmtPct(b.baseline.win_rate_pct), fmtR(b.baseline.avg_r),
            fmtPF(b.baseline.profit_factor), b.baseline.evidence_score.toFixed(2), String(b.live.n), fmtR(b.live.avg_r),
            b.verdict.label,
          ])}
        />
      </Section>

      {error && <p className="text-xs text-smc-danger">{error} (showing the last good data)</p>}
    </div>
  );
}

function Kpi({ label, value, sub, surface, trend, info, dark }: { label: string; value: string; sub: string; surface: string; trend?: 'up' | 'down'; info: GlossaryEntry; dark: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${surface}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">{label}<InfoTip entry={info} dark={dark} /></div>
      <div className="flex items-center gap-1.5 text-xl font-bold mt-0.5">
        {value}
        {trend === 'up' && <TrendingUp size={15} className="text-emerald-500" aria-label="holding its evidence edge" />}
        {trend === 'down' && <TrendingDown size={15} className="text-red-500" aria-label="below half its evidence edge" />}
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ title, icon, note, children, info, dark }: { title: string; icon: ReactNode; note?: string; children: ReactNode; info: GlossaryEntry; dark: boolean }) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 font-semibold">{icon}{title}<InfoTip entry={info} dark={dark} /></h4>
      {note && <p className="text-xs text-gray-400 mt-0.5 mb-2">{note}</p>}
      {children}
    </section>
  );
}

function BotChip({ b, track, live, target }: { b: RecBotRow; track: string; live: string; target: number }) {
  const meta = LEVEL_META[b.verdict.level];
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{famLabel(b.family)}</span>
        <span className={`flex items-center gap-1 ${meta.cls}`} title={b.verdict.label}>{meta.icon}<span>{meta.label}</span></span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="flex-1 h-1 rounded-full" style={{ background: track }}>
          <div className="h-1 rounded-full" style={{ width: `${Math.max(3, b.confidence_pct)}%`, background: live }} />
        </div>
        <span className="text-[10px] text-gray-400 tabular-nums">{b.live.n}/{target} · {fmtR(b.live.avg_r)}</span>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 py-6 text-center">{text}</p>;
}

function SimpleTable({ head, rows }: { head: ReactNode[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-400">{head.map((h, i) => <th key={i} className="py-1.5 pr-3 font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-500/15">{r.map((cell, j) => <td key={j} className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
