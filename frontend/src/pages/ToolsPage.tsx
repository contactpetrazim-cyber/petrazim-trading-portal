import { useEffect, useState } from 'react';
import {
  Gauge, TrendingUp, Grid3x3, NotebookPen, Wallet, Plus, Trash2, LineChart,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { ChartPanel } from '../components/ChartPanel';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOOLS_ACCENT = '#0891b2';   // the one documented exception to HERO_BLUE (Master Handover §6)

function inputCls(dark: boolean) {
  return `w-full rounded-lg px-2.5 py-1.5 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'
  }`;
}

function ResultBox({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <div className={`text-sm rounded-xl p-3 mt-3 whitespace-pre-wrap ${dark ? 'bg-white/5 text-white/80' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
      {children}
    </div>
  );
}

/** A single gauge bar — every Tools metric gets one of these instead of
 * standing alone as plain text, by direct request ("all features on
 * tools and insights must be visual"). */
function GaugeBar({ pct, color, dark, label }: { pct: number; color: string; dark: boolean; label?: string }) {
  return (
    <div className="mb-2">
      {label && <div className={`text-xs mb-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>{label}</div>}
      <div className={`h-2.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

/** A stacked bar for the 4 Prop-Firm outcome probabilities. */
function StackedBar({ segments, dark }: { segments: { pct: number; color: string; label: string }[]; dark: boolean }) {
  return (
    <div>
      <div className={`h-3 rounded-full overflow-hidden flex ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label}: ${s.pct}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segments.map((s, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} /> {s.label}: {s.pct}%
          </div>
        ))}
      </div>
    </div>
  );
}

/** Correlation as an actual colored heat-map grid instead of a text
 * list — diverging blue (negative) to red (positive correlation). */
function CorrelationHeatMap({ labels, matrix, dark }: { labels: string[]; matrix: number[][]; dark: boolean }) {
  function cellColor(v: number) {
    const a = Math.min(1, Math.abs(v));
    return v >= 0 ? `rgba(239,68,68,${a * 0.85})` : `rgba(59,130,246,${a * 0.85})`;
  }
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {labels.map((l) => (
              <th key={l} className={`p-1.5 font-medium ${dark ? 'text-white/50' : 'text-gray-500'}`}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className={`p-1.5 font-medium whitespace-nowrap ${dark ? 'text-white/50' : 'text-gray-500'}`}>{labels[i]}</td>
              {row.map((v, j) => (
                <td key={j} className="p-0">
                  <div
                    className="w-14 h-10 flex items-center justify-center font-semibold"
                    style={{ background: cellColor(v), color: Math.abs(v) > 0.5 ? '#fff' : dark ? '#fff' : '#111' }}
                  >
                    {v.toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ToolsPage — real UI for all 5 Tools engines, none of which had any
 * frontend before (or any API endpoint, until routers/tools.py). Kept
 * deliberately lean — plain number/text inputs rather than a
 * polished form builder — since the point of this pass is making the
 * already-tested engine math reachable at all, not a full redesign.
 * accent=#0891b2 throughout, the one area besides HERO_BLUE, per
 * Section 6 of the Master Handover.
 */
export function ToolsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // --- Risk of Ruin (open, no auth) ---
  const [ror, setRor] = useState({ win_rate: '55', avg_win_r: '2', avg_loss_r: '1', risk_per_trade_pct: '1' });
  const [rorResult, setRorResult] = useState<any>(null);
  const [rorBusy, setRorBusy] = useState(false);

  async function runRiskOfRuin() {
    setRorBusy(true);
    try {
      const res = await fetch(`${API_URL}/tools/risk-of-ruin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          win_rate: Number(ror.win_rate) / 100,
          avg_win_r: Number(ror.avg_win_r),
          avg_loss_r: Number(ror.avg_loss_r),
          risk_per_trade_pct: Number(ror.risk_per_trade_pct) / 100,
        }),
      });
      const data = await res.json();
      setRorResult(res.ok ? data : { error: data.detail || 'Could not calculate.' });
    } finally {
      setRorBusy(false);
    }
  }

  // --- Prop-Firm Simulator ---
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [preset, setPreset] = useState('generic_10_5_10');
  const [propResult, setPropResult] = useState<any>(null);
  const [propBusy, setPropBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/tools/prop-firm/presets`).then((r) => r.json()).then(setPresets).catch(() => {});
  }, []);

  async function runPropFirm() {
    setPropBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/tools/prop-firm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ preset }),
      });
      const data = await res.json();
      setPropResult(res.ok ? data : { error: data.detail || 'Could not simulate — need at least 10 closed trades.' });
    } finally {
      setPropBusy(false);
    }
  }

  // --- Correlation ---
  const [series, setSeries] = useState([{ label: 'Bot 1', returns: '1,-0.5,2,0.8,-1' }, { label: 'Bot 2', returns: '0.9,-0.4,1.8,0.7,-1.1' }]);
  const [corrResult, setCorrResult] = useState<any>(null);
  const [corrBusy, setCorrBusy] = useState(false);

  async function runCorrelation() {
    setCorrBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/tools/correlation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          series: series.map((s) => ({ label: s.label, returns: s.returns.split(',').map((n) => Number(n.trim())) })),
        }),
      });
      const data = await res.json();
      setCorrResult(res.ok ? data : { error: data.detail || 'Could not compute correlation.' });
    } finally {
      setCorrBusy(false);
    }
  }

  // --- Journal Reviewer ---
  const emptyEntry = { trade_id: '', symbol: '', direction: 'long', entry_price: '', exit_price: '', stop_price: '', entry_time: '', exit_time: '', exit_reason: 'target', trader_notes: '' };
  const [entries, setEntries] = useState([{ ...emptyEntry }]);
  const [journalResult, setJournalResult] = useState<any>(null);
  const [journalBusy, setJournalBusy] = useState(false);

  function updateEntry(i: number, field: string, value: string) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  async function runJournalReview() {
    setJournalBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/tools/journal-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          entries: entries.map((e) => ({
            ...e,
            entry_price: Number(e.entry_price), exit_price: Number(e.exit_price), stop_price: Number(e.stop_price),
          })),
        }),
      });
      const data = await res.json();
      setJournalResult(res.ok ? data : { error: data.detail || 'Could not review — check every field is filled in.' });
    } finally {
      setJournalBusy(false);
    }
  }

  // --- Payout Optimizer ---
  const emptyAccount = { account_id: '', firm_name: '', balance: '100000', daily_loss_limit_pct: '5', total_drawdown_limit_pct: '10', current_daily_loss_pct: '0', current_total_drawdown_pct: '0' };
  const [accounts, setAccounts] = useState([{ ...emptyAccount, account_id: 'ACC-1' }]);
  const [payoutResult, setPayoutResult] = useState<any>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);

  function updateAccount(i: number, field: string, value: string) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  async function runPayoutOptimizer() {
    setPayoutBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/tools/payout-optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          accounts: accounts.map((a) => ({
            ...a,
            balance: Number(a.balance), daily_loss_limit_pct: Number(a.daily_loss_limit_pct),
            total_drawdown_limit_pct: Number(a.total_drawdown_limit_pct),
            current_daily_loss_pct: Number(a.current_daily_loss_pct),
            current_total_drawdown_pct: Number(a.current_total_drawdown_pct),
          })),
        }),
      });
      const data = await res.json();
      setPayoutResult(res.ok ? data : { error: data.detail || 'Could not optimize.' });
    } finally {
      setPayoutBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Tools" subtitle="Risk-of-ruin, prop-firm odds, correlation, journal review, and payout tools." />

      <div className="mb-4">
        <FoldedCard title="Free Chart" summary="A live TradingView chart, right here" icon={<LineChart size={19} />} dark={dark} accent={TOOLS_ACCENT} defaultOpen>
          <ChartPanel symbol="BINANCE:BTCUSDT" height={380} tradeSymbol="BTCUSDT" dark={dark} />
        </FoldedCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FoldedCard title="Risk-of-Ruin Calculator" summary="Free — estimate risk of ruin from your own stats." icon={<Gauge size={19} />} dark={dark} accent={TOOLS_ACCENT}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-xs">
              <span className={dark ? 'text-white/40' : 'text-gray-500'}>Win rate %</span>
              <input className={inputCls(dark)} value={ror.win_rate} onChange={(e) => setRor({ ...ror, win_rate: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className={dark ? 'text-white/40' : 'text-gray-500'}>Risk/trade %</span>
              <input className={inputCls(dark)} value={ror.risk_per_trade_pct} onChange={(e) => setRor({ ...ror, risk_per_trade_pct: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className={dark ? 'text-white/40' : 'text-gray-500'}>Avg win (R)</span>
              <input className={inputCls(dark)} value={ror.avg_win_r} onChange={(e) => setRor({ ...ror, avg_win_r: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className={dark ? 'text-white/40' : 'text-gray-500'}>Avg loss (R)</span>
              <input className={inputCls(dark)} value={ror.avg_loss_r} onChange={(e) => setRor({ ...ror, avg_loss_r: e.target.value })} />
            </label>
          </div>
          <button onClick={runRiskOfRuin} disabled={rorBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: TOOLS_ACCENT }}>
            {rorBusy ? 'Calculating…' : 'Calculate'}
          </button>
          {rorResult && (
            rorResult.error ? <ResultBox dark={dark}>{rorResult.error}</ResultBox> : (
              <div className="mt-3">
                <GaugeBar
                  pct={rorResult.probability_of_ruin} dark={dark}
                  color={rorResult.probability_of_ruin > 20 ? '#ef4444' : rorResult.probability_of_ruin > 5 ? '#f59e0b' : '#22c55e'}
                  label={`Probability of ruin — ${rorResult.probability_of_ruin}%`}
                />
                <ResultBox dark={dark}>Expectancy: {rorResult.expectancy_r}R{'\n'}{rorResult.verdict}</ResultBox>
              </div>
            )
          )}
        </FoldedCard>

        <FoldedCard title="Prop-Firm Challenge Simulator" summary="Estimate your odds of passing a funded-account challenge." icon={<TrendingUp size={19} />} dark={dark} accent={TOOLS_ACCENT}>
          <label className="text-xs block mb-2">
            <span className={dark ? 'text-white/40' : 'text-gray-500'}>Challenge rules</span>
            <select className={inputCls(dark)} value={preset} onChange={(e) => setPreset(e.target.value)}>
              {Object.entries(presets).map(([key, rules]: [string, any]) => (
                <option key={key} value={key}>{rules.name}</option>
              ))}
            </select>
          </label>
          <p className={`text-xs mb-2 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Uses your own real closed trades — needs at least 10.</p>
          <button onClick={runPropFirm} disabled={propBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: TOOLS_ACCENT }}>
            {propBusy ? 'Simulating…' : 'Simulate'}
          </button>
          {propResult && (
            propResult.error ? <ResultBox dark={dark}>{propResult.error}</ResultBox> : (
              <div className="mt-3">
                <StackedBar
                  dark={dark}
                  segments={[
                    { pct: propResult.probability_of_pass, color: '#22c55e', label: 'Pass' },
                    { pct: propResult.probability_of_fail_daily_loss, color: '#f59e0b', label: 'Fail (daily loss)' },
                    { pct: propResult.probability_of_fail_total_drawdown, color: '#ef4444', label: 'Fail (total DD)' },
                    { pct: propResult.probability_of_fail_time_limit, color: dark ? '#4b5563' : '#9ca3af', label: 'Ran out of time' },
                  ]}
                />
              </div>
            )
          )}
        </FoldedCard>

        <FoldedCard title="Correlation Heat Map" summary="See which of your positions are secretly the same bet." icon={<Grid3x3 size={19} />} dark={dark} accent={TOOLS_ACCENT}>
          {series.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={`${inputCls(dark)} w-24`} placeholder="Label" value={s.label} onChange={(e) => setSeries((p) => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
              <input className={inputCls(dark)} placeholder="Returns, comma-separated" value={s.returns} onChange={(e) => setSeries((p) => p.map((x, idx) => idx === i ? { ...x, returns: e.target.value } : x))} />
            </div>
          ))}
          <div className="flex gap-2 mb-2">
            <button onClick={() => setSeries((p) => [...p, { label: `Series ${p.length + 1}`, returns: '' }])} className={`text-xs flex items-center gap-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              <Plus size={13} /> Add series
            </button>
          </div>
          <button onClick={runCorrelation} disabled={corrBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: TOOLS_ACCENT }}>
            {corrBusy ? 'Computing…' : 'Compute correlation'}
          </button>
          {corrResult && (
            corrResult.error ? <ResultBox dark={dark}>{corrResult.error}</ResultBox> : (
              <div className="mt-3">
                <CorrelationHeatMap labels={corrResult.labels} matrix={corrResult.matrix} dark={dark} />
                {corrResult.flags.length > 0 && (
                  <ResultBox dark={dark}>
                    {corrResult.flags.map((f: any, i: number) => (
                      <div key={i}>{f.label_a} × {f.label_b}: {f.correlation} ({f.severity})</div>
                    ))}
                  </ResultBox>
                )}
              </div>
            )
          )}
        </FoldedCard>

        <FoldedCard title="AI Trade Journal Reviewer" summary="Upload manual trades for the same process-based coach review." icon={<NotebookPen size={19} />} dark={dark} accent={TOOLS_ACCENT}>
          {entries.map((e, i) => (
            <div key={i} className={`rounded-lg p-2 mb-2 border ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`}>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <input className={inputCls(dark)} placeholder="Symbol" value={e.symbol} onChange={(ev) => updateEntry(i, 'symbol', ev.target.value)} />
                <select className={inputCls(dark)} value={e.direction} onChange={(ev) => updateEntry(i, 'direction', ev.target.value)}>
                  <option value="long">Long</option><option value="short">Short</option>
                </select>
                <input className={inputCls(dark)} placeholder="Entry price" value={e.entry_price} onChange={(ev) => updateEntry(i, 'entry_price', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Exit price" value={e.exit_price} onChange={(ev) => updateEntry(i, 'exit_price', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Stop price" value={e.stop_price} onChange={(ev) => updateEntry(i, 'stop_price', ev.target.value)} />
                <select className={inputCls(dark)} value={e.exit_reason} onChange={(ev) => updateEntry(i, 'exit_reason', ev.target.value)}>
                  <option value="target">Target</option><option value="stop">Stop</option><option value="timeout">Timeout</option><option value="manual_close">Manual close</option>
                </select>
                <input type="datetime-local" className={inputCls(dark)} value={e.entry_time} onChange={(ev) => updateEntry(i, 'entry_time', ev.target.value)} />
                <input type="datetime-local" className={inputCls(dark)} value={e.exit_time} onChange={(ev) => updateEntry(i, 'exit_time', ev.target.value)} />
              </div>
              <input className={inputCls(dark)} placeholder="Why you took this trade…" value={e.trader_notes} onChange={(ev) => updateEntry(i, 'trader_notes', ev.target.value)} />
              {entries.length > 1 && (
                <button onClick={() => setEntries((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-red-400 mt-1 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
              )}
            </div>
          ))}
          <div className="flex gap-3 mb-2">
            <button onClick={() => setEntries((p) => [...p, { ...emptyEntry, trade_id: `t${p.length + 1}` }])} className={`text-xs flex items-center gap-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              <Plus size={13} /> Add trade
            </button>
          </div>
          <button onClick={runJournalReview} disabled={journalBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: TOOLS_ACCENT }}>
            {journalBusy ? 'Reviewing…' : 'Review'}
          </button>
          {journalResult && (
            journalResult.error ? <ResultBox dark={dark}>{journalResult.error}</ResultBox> : (
              <div className="mt-3">
                <GaugeBar
                  pct={journalResult.win_rate} dark={dark}
                  color={journalResult.win_rate >= 50 ? '#22c55e' : '#f59e0b'}
                  label={`Win rate — ${journalResult.win_rate}% (Expectancy: ${journalResult.expectancy_r}R)`}
                />
                <ResultBox dark={dark}>{journalResult.psychology_flag ? `${journalResult.psychology_flag}\n\n` : ''}{journalResult.coach_narrative}</ResultBox>
              </div>
            )
          )}
        </FoldedCard>

        <FoldedCard title="Funded-Account Payout Optimizer" summary="Balance risk across multiple funded accounts." icon={<Wallet size={19} />} dark={dark} accent={TOOLS_ACCENT}>
          {accounts.map((a, i) => (
            <div key={i} className={`rounded-lg p-2 mb-2 border ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`}>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <input className={inputCls(dark)} placeholder="Account ID" value={a.account_id} onChange={(ev) => updateAccount(i, 'account_id', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Firm name" value={a.firm_name} onChange={(ev) => updateAccount(i, 'firm_name', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Balance" value={a.balance} onChange={(ev) => updateAccount(i, 'balance', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Daily loss limit %" value={a.daily_loss_limit_pct} onChange={(ev) => updateAccount(i, 'daily_loss_limit_pct', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Total DD limit %" value={a.total_drawdown_limit_pct} onChange={(ev) => updateAccount(i, 'total_drawdown_limit_pct', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Daily loss used %" value={a.current_daily_loss_pct} onChange={(ev) => updateAccount(i, 'current_daily_loss_pct', ev.target.value)} />
                <input className={inputCls(dark)} placeholder="Total DD used %" value={a.current_total_drawdown_pct} onChange={(ev) => updateAccount(i, 'current_total_drawdown_pct', ev.target.value)} />
              </div>
              {accounts.length > 1 && (
                <button onClick={() => setAccounts((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-red-400 mt-1 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
              )}
            </div>
          ))}
          <div className="flex gap-3 mb-2">
            <button onClick={() => setAccounts((p) => [...p, { ...emptyAccount, account_id: `ACC-${p.length + 1}` }])} className={`text-xs flex items-center gap-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              <Plus size={13} /> Add account
            </button>
          </div>
          <button onClick={runPayoutOptimizer} disabled={payoutBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: TOOLS_ACCENT }}>
            {payoutBusy ? 'Optimizing…' : 'Optimize'}
          </button>
          {payoutResult && (
            payoutResult.error ? <ResultBox dark={dark}>{payoutResult.error}</ResultBox> : (
              <div className="mt-3 space-y-2">
                {payoutResult.allocations.map((a: any, i: number) => (
                  a.excluded ? (
                    <div key={i} className={`text-xs rounded-lg p-2 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
                      {a.account_id}: {a.exclusion_reason}
                    </div>
                  ) : (
                    <GaugeBar key={i} pct={(a.risk_pct_allocated / 2) * 100} color="#0891b2" dark={dark} label={`${a.account_id} — ${a.risk_pct_allocated}% risk allocated`} />
                  )
                ))}
              </div>
            )
          )}
        </FoldedCard>
      </div>
    </div>
  );
}
