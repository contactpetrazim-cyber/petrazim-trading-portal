import { useEffect, useState } from 'react';
import { ClipboardList, PlayCircle, CheckCircle2, XCircle, PauseCircle, AlertTriangle, Info, Eye, CheckSquare, Square, FileText, Download, Trash2, Activity } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { AuditVisualDashboard } from '../components/AuditVisualDashboard';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RunSummary {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  triggered_by: string;
  generated_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface InstrumentRow {
  symbol: string;
  bots: string[];
  total_trades: number;
  wins: number;
  losses: number;
  active: number;
  pending: number;
  errors: number;
}

export interface BotExpectancyRow {
  bot_family: string;
  n: number;
  wins: number;
  losses: number;
  win_rate_pct: number | null;
  total_pnl: number;
  avg_r: number | null;
  expectancy_per_trade: number | null;
}

export interface Finding {
  id: string;
  category: string;
  evidence_level: string;
  severity: string;
  title: string;
  detail: string;
  bot_id: string | null;
  recommended_action: string | null;
  recommendation_status: string;
  applied_at: string | null;
  applied_by: string | null;
}

export interface BacktestValidationRow {
  bot_family: string;
  symbol: string;
  window_days: number;
  total_trades?: number;
  win_rate?: number | null;
  expectancy_r?: number | null;
  max_drawdown_pct?: number | null;
  error?: string;
}

interface RunDetail extends RunSummary {
  summary: {
    instrument_inventory: InstrumentRow[];
    bot_family_expectancy: BotExpectancyRow[];
    backtest_validation?: BacktestValidationRow[] | null;
  };
  findings: Finding[];
  report_markdown: string | null;
}

const EVIDENCE_LABEL: Record<string, string> = {
  verified: 'Verified', strongly_supported: 'Strongly supported', hypothesis: 'Hypothesis', unverified: 'Unverified',
};

// One sidebar row — shared between the real-runs list and the folded
// "Live Check Runs" card so both render identically (select + delete).
function RunRow({
  r, selected, onSelect, onDelete, deleting, dark, cardCls, mutedCls,
}: {
  r: RunSummary; selected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void;
  deleting: boolean; dark: boolean; cardCls: string; mutedCls: string;
}) {
  return (
    <div
      className={`w-full flex items-start gap-1 p-3 rounded-xl border text-xs ${
        selected ? 'border-corporate-hero bg-corporate-hero/5' : cardCls
      }`}
    >
      <button onClick={() => onSelect(r.id)} className="flex-1 min-w-0 text-left">
        <div className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          {new Date(r.generated_at).toLocaleDateString()} ({r.triggered_by})
        </div>
        <div className={mutedCls}>
          {new Date(r.period_start).toLocaleDateString()} – {new Date(r.period_end).toLocaleDateString()} · {r.status}
        </div>
      </button>
      <button
        onClick={() => onDelete(r.id)}
        disabled={deleting}
        title="Delete this audit run"
        className={`shrink-0 p-1 rounded disabled:opacity-40 ${dark ? 'text-white/30 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/**
 * AdminTradingAuditPage — the Monthly Trading Audit engine's Admin UI.
 * By direct request: "I want the Trading portal to be able to do this
 * analyses monthly and review results - provide docs - integrate into
 * the Admin portal ... the Admin then has the choice to use as info
 * only or update or create new bots based on the results."
 *
 * Built directly from the forensic audit methodology run manually this
 * session against real trade history — same instrument inventory,
 * same per-bot-family expectancy, same duplicate/concurrency detection
 * (see engines/trading_audit_engine.py). "Apply" is deliberately
 * narrow: the only automated action is pausing a bot family with
 * reliably negative expectancy (pure risk reduction, fully
 * reversible) — everything else is a real, evidence-graded finding
 * with no one-click fix, exactly how this session's own manual audit
 * treated it.
 */
export function AdminTradingAuditPage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.admin === 'dark';
  const { token } = useAuth();

  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [detailPhase, setDetailPhase] = useState<FetchPhase>('idle');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  // Multi-select apply — by direct request ("it should provide a
  // selection list that can be toggled to apply ... so that a user
  // can select what is to be applied and ignore what they are not
  // interested in"), instead of one Apply button per finding. Only
  // findings with a real pending recommendation are selectable;
  // toggling one ON does not act on it yet — "Apply Selected" below
  // is the one action that actually applies the chosen set, and
  // anything left unselected is simply left alone (no need for an
  // explicit "ignore" action).
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());
  const [applyingSelected, setApplyingSelected] = useState(false);
  // Delete a past run — by direct request ("Provide option to delete
  // items"). Per-row busy state (not a single page-wide flag) so
  // deleting one run doesn't disable the delete button on every other
  // row in the list while its own request is in flight.
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  function loadRuns() {
    if (!token) return;
    fetchJsonWithRetry<RunSummary[]>(
      `${API_URL}/admin/trading-audit/runs`, { headers: { Authorization: `Bearer ${token}` } }, setPhase,
    ).then((r) => {
      if (r) {
        setRuns(r);
        // Default to the most recent REAL run, not a "live_check"
        // probe, even if one happens to be more recent — those are
        // internal verification artifacts, folded away by default
        // (see the sidebar's own comment), so they shouldn't be what
        // a visitor lands on either.
        if (r.length && !selectedRunId) {
          const firstReal = r.find((run) => run.triggered_by !== 'live_check');
          setSelectedRunId((firstReal ?? r[0]).id);
        }
      } else setError('Could not load past audit runs.');
    });
  }

  useEffect(loadRuns, [token]);

  useEffect(() => {
    if (!token || !selectedRunId) return;
    setDetail(null);
    fetchJsonWithRetry<RunDetail>(
      `${API_URL}/admin/trading-audit/runs/${selectedRunId}`, { headers: { Authorization: `Bearer ${token}` } }, setDetailPhase,
    ).then((r) => { if (r) setDetail(r); });
  }, [selectedRunId, token]);

  async function runNow() {
    if (!token) return;
    setRunning(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/admin/trading-audit/run`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const run: RunSummary = await res.json();
      setSelectedRunId(run.id);
      loadRuns();
    } catch {
      setError('Could not start a new audit run.');
    } finally {
      setRunning(false);
    }
  }

  function toggleFindingSelected(findingId: string) {
    setSelectedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) next.delete(findingId); else next.add(findingId);
      return next;
    });
  }

  async function refreshDetail() {
    if (!token || !detail) return;
    const res = await apiFetch(`${API_URL}/admin/trading-audit/runs/${detail.id}`, { headers: { Authorization: `Bearer ${token}` } });
    setDetail(await res.json());
  }

  async function applySelected() {
    if (!token || !detail || selectedFindingIds.size === 0) return;
    setApplyingSelected(true);
    setError(null);
    try {
      for (const findingId of selectedFindingIds) {
        await apiFetch(`${API_URL}/admin/trading-audit/findings/${findingId}/apply`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
      }
      setSelectedFindingIds(new Set());
      await refreshDetail();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not apply the selected recommendations.');
    } finally {
      setApplyingSelected(false);
    }
  }

  async function dismissFinding(findingId: string) {
    if (!token || !detail) return;
    setBusyFindingId(findingId);
    try {
      await apiFetch(`${API_URL}/admin/trading-audit/findings/${findingId}/dismiss`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedFindingIds((prev) => {
        const next = new Set(prev);
        next.delete(findingId);
        return next;
      });
      await refreshDetail();
    } finally {
      setBusyFindingId(null);
    }
  }

  async function deleteRun(runId: string) {
    if (!token) return;
    if (!window.confirm('Delete this audit run permanently? This cannot be undone.')) return;
    setDeletingRunId(runId);
    try {
      await apiFetch(`${API_URL}/admin/trading-audit/runs/${runId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setDetail(null);
      }
      loadRuns();
    } catch {
      setError('Could not delete this audit run.');
    } finally {
      setDeletingRunId(null);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200';
  // Every real value was rendering invisibly in the Instrument
  // Inventory / Bot-Family Expectancy tables below — by direct bug
  // report with screenshots. Root cause: index.css's global `body`
  // rule hardcodes `color: #ffffff` (for the dark trader portal) with
  // nothing overriding it for text that has no explicit Tailwind
  // color class, so on this page's LIGHT admin background any "naked"
  // <td> rendered white-on-white. Cells that already had an explicit
  // color (text-emerald-500/text-red-500/mutedCls) were fine — only
  // the ones with none were actually invisible, matching exactly
  // which columns were missing in the screenshots.
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  const realRuns = runs?.filter((r) => r.triggered_by !== 'live_check') ?? [];
  const liveCheckRuns = runs?.filter((r) => r.triggered_by === 'live_check') ?? [];

  function downloadReport() {
    if (!detail?.report_markdown) return;
    const blob = new Blob([detail.report_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-audit-${detail.period_start.slice(0, 10)}-to-${detail.period_end.slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Monthly Trading Audit"
        subtitle="Real instrument/bot inventory, reconciliation, and per-bot expectancy — recomputed fresh each run, from real trade history only."
      />

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-corporate-hero text-white disabled:opacity-50"
        >
          <PlayCircle size={16} /> {running ? 'Running…' : 'Run Audit Now'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      {!runs && <LoadingIndicator phase={phase} dark={dark} />}
      {runs && runs.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No audit runs yet — click "Run Audit Now" to generate the first one.</p>
      )}

      {runs && runs.length > 0 && (
        <div className="flex gap-4 flex-col lg:flex-row">
          <div className="lg:w-64 shrink-0 space-y-1.5">
            {realRuns.length === 0 && (
              <p className={`text-xs ${mutedCls}`}>No real audit runs yet — only internal "Live Check" probes exist (see below the Visual Dashboard).</p>
            )}
            {realRuns.map((r) => (
              <RunRow key={r.id} r={r} selected={selectedRunId === r.id} onSelect={setSelectedRunId} onDelete={deleteRun} deleting={deletingRunId === r.id} dark={dark} cardCls={cardCls} mutedCls={mutedCls} />
            ))}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            {!detail && <LoadingIndicator phase={detailPhase} dark={dark} />}
            {detail && (
              <>
                {/* "turn the executive report into a dashboard of
                    various charts and diagrams, pie charts, pyramids"
                    — by direct request. Built from the SAME real
                    summary/findings data as the tables below, not a
                    re-parse of the markdown report, so it can never
                    drift from what those tables show. */}
                <AuditVisualDashboard
                  instrumentInventory={detail.summary.instrument_inventory}
                  botFamilyExpectancy={detail.summary.bot_family_expectancy}
                  backtestValidation={detail.summary.backtest_validation}
                  findings={detail.findings}
                  dark={dark}
                />

                {/* "live_check" runs are internal verification probes
                    (full-history period_start/period_end sentinels,
                    e.g. 01/01/2020-01/01/2030, used while this session
                    was live-verifying the backtest validation/
                    forensics work directly against the production DB)
                    — never produced by the real "Run Audit Now" button
                    or the scheduled worker. By direct request ("All
                    live check info should be embedded in a foldable
                    card - default is fold" / "live checks card should
                    come below the visual dashboard"), listed here,
                    folded by default, rather than mixed into the real
                    run-history sidebar on the left. */}
                {liveCheckRuns.length > 0 && (
                  <FoldedCard title={`Live Check Runs (${liveCheckRuns.length})`} summary="Internal verification probes, not real audit history" icon={<Activity size={18} />} dark={dark}>
                    <div className="space-y-1.5">
                      {liveCheckRuns.map((r) => (
                        <RunRow key={r.id} r={r} selected={selectedRunId === r.id} onSelect={setSelectedRunId} onDelete={deleteRun} deleting={deletingRunId === r.id} dark={dark} cardCls={cardCls} mutedCls={mutedCls} />
                      ))}
                    </div>
                  </FoldedCard>
                )}

                {/* The "provide docs" half of the original request — a
                    real, standalone Markdown report generated from
                    this run's own data (executive summary, instrument
                    inventory, bot scorecard, findings), not a
                    duplicate of the tables below — same content,
                    portable/shareable form. */}
                {detail.report_markdown && (
                  <FoldedCard title="Executive Report" icon={<FileText size={18} />} dark={dark}>
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={downloadReport}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-corporate-hero text-white"
                      >
                        <Download size={13} /> Download .md
                      </button>
                    </div>
                    <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed p-3 rounded-lg overflow-x-auto ${dark ? 'bg-black/20 text-white/80' : 'bg-gray-50 text-gray-700'}`}>
                      {detail.report_markdown}
                    </pre>
                  </FoldedCard>
                )}

                <FoldedCard title="Instrument Inventory" icon={<ClipboardList size={18} />} dark={dark} defaultOpen>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className={mutedCls}>
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-left p-2">Bots</th>
                          <th className="text-right p-2">Trades</th>
                          <th className="text-right p-2">Wins</th>
                          <th className="text-right p-2">Losses</th>
                          <th className="text-right p-2">Active</th>
                          <th className="text-right p-2">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.summary.instrument_inventory.map((row) => (
                          <tr key={row.symbol} className={`border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                            <td className={`p-2 font-mono font-semibold ${textCls}`}>{row.symbol}</td>
                            <td className={`p-2 ${mutedCls}`}>{row.bots.length}</td>
                            <td className={`p-2 text-right ${textCls}`}>{row.total_trades}</td>
                            <td className="p-2 text-right text-emerald-500">{row.wins}</td>
                            <td className="p-2 text-right text-red-500">{row.losses}</td>
                            <td className={`p-2 text-right ${textCls}`}>{row.active}</td>
                            <td className={`p-2 text-right ${textCls}`}>{row.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FoldedCard>

                <FoldedCard title="Bot-Family Expectancy" icon={<ClipboardList size={18} />} dark={dark} defaultOpen>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className={mutedCls}>
                          <th className="text-left p-2">Bot family</th>
                          <th className="text-right p-2">N</th>
                          <th className="text-right p-2">Win rate</th>
                          <th className="text-right p-2">Total PnL</th>
                          <th className="text-right p-2">Avg R</th>
                          <th className="text-right p-2">Expectancy/trade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.summary.bot_family_expectancy.map((row) => (
                          <tr key={row.bot_family} className={`border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                            <td className={`p-2 font-mono font-semibold ${textCls}`}>{row.bot_family}</td>
                            <td className={`p-2 text-right ${textCls}`}>{row.n}</td>
                            <td className={`p-2 text-right ${textCls}`}>{row.win_rate_pct ?? '—'}%</td>
                            <td className={`p-2 text-right ${row.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ${row.total_pnl.toFixed(2)}
                            </td>
                            <td className={`p-2 text-right ${textCls}`}>{row.avg_r ?? '—'}</td>
                            <td className={`p-2 text-right ${textCls}`}>${row.expectancy_per_trade?.toFixed(2) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FoldedCard>

                {/* Live Backtest Validation (Stage 9, recomputed every
                    run) — by direct request ("put all live check in a
                    foldable card"). Previously only existed as plain
                    text buried inside the Executive Report's own giant
                    markdown dump; this is the same real data
                    (summary.backtest_validation, already computed
                    server-side by compute_live_backtest_validation)
                    broken out into its own clearly-labeled, foldable
                    structured table — "how does each bot's live-
                    tested edge look as of today," independent of this
                    run's own historical period. Folded by default
                    (not defaultOpen, unlike the tables above) since
                    this is a secondary, real-time cross-check, not
                    the run's own primary historical scorecard. */}
                {detail.summary.backtest_validation && detail.summary.backtest_validation.length > 0 && (
                  <FoldedCard title="Live Backtest Validation (Stage 9)" summary="Recomputed fresh each run, as of today — independent of this run's own historical period" icon={<Activity size={18} />} dark={dark}>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full border-collapse">
                        <thead>
                          <tr className={mutedCls}>
                            <th className="text-left p-2">Bot family</th>
                            <th className="text-left p-2">Symbol</th>
                            <th className="text-right p-2">Window</th>
                            <th className="text-right p-2">N</th>
                            <th className="text-right p-2">Win rate</th>
                            <th className="text-right p-2">Expectancy (R)</th>
                            <th className="text-right p-2">Max DD (R)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.summary.backtest_validation.map((row) => (
                            <tr key={`${row.bot_family}-${row.symbol}`} className={`border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                              <td className={`p-2 font-mono font-semibold ${textCls}`}>{row.bot_family}</td>
                              <td className={`p-2 font-mono ${mutedCls}`}>{row.symbol}</td>
                              <td className={`p-2 text-right ${mutedCls}`}>{row.window_days}d</td>
                              {row.error ? (
                                <td className="p-2 text-right text-red-500" colSpan={4}>{row.error}</td>
                              ) : (
                                <>
                                  <td className={`p-2 text-right ${textCls}`}>{row.total_trades ?? '—'}</td>
                                  {/* row.win_rate is ALREADY a percentage (backend's
                                      _summarize: round(100.0 * wins / total, 2)), not a
                                      fraction — by direct bug report with screenshot
                                      ("10000.0%" for a single winning trade): multiplying
                                      by 100 again here inflated every value 100x. */}
                                  <td className={`p-2 text-right ${textCls}`}>{row.win_rate != null ? `${row.win_rate.toFixed(1)}%` : '—'}</td>
                                  <td className={`p-2 text-right ${row.expectancy_r != null && row.expectancy_r >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {row.expectancy_r != null ? row.expectancy_r.toFixed(3) : '—'}
                                  </td>
                                  {/* max_drawdown_pct is, despite its name, a peak-to-
                                      trough drawdown measured in R-multiples on the
                                      CUMULATIVE R sequence (backend's own comment: "R-
                                      multiple drawdown is the honest equivalent" to a
                                      dollar drawdown, which needs an account-size
                                      assumption this isolated backtest deliberately
                                      avoids) — NOT a percentage of equity. Shown as a
                                      plain R figure, matching the corrected column
                                      header, instead of a misleading "%" suffix. */}
                                  <td className={`p-2 text-right ${textCls}`}>{row.max_drawdown_pct != null ? row.max_drawdown_pct.toFixed(2) : '—'}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </FoldedCard>
                )}

                <FoldedCard title="Findings & Recommendations" icon={<ClipboardList size={18} />} dark={dark} defaultOpen>
                  {/* Select-to-apply list — by direct request: toggle on
                      whichever recommendations should actually be
                      applied, leave the rest unselected (no separate
                      "ignore" action needed), then Apply Selected acts
                      on exactly that set in one batch. Only findings
                      with a real pending recommended_action are
                      selectable — info-only findings never show a
                      checkbox at all. */}
                  {detail.findings.some((f) => f.recommended_action && f.recommendation_status === 'pending') && (
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed border-gray-200 dark:border-white/10">
                      <span className={`text-xs ${mutedCls}`}>{selectedFindingIds.size} selected</span>
                      <button
                        onClick={applySelected}
                        disabled={selectedFindingIds.size === 0 || applyingSelected}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-corporate-hero text-white disabled:opacity-40"
                      >
                        <CheckSquare size={13} /> {applyingSelected ? 'Applying…' : `Apply Selected (${selectedFindingIds.size})`}
                      </button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {detail.findings.length === 0 && <p className={`text-sm ${mutedCls}`}>No findings this run.</p>}
                    {detail.findings.map((f) => {
                      const icon = f.severity === 'action' ? <AlertTriangle size={16} className="text-amber-500" /> : <Info size={16} className="text-corporate-hero" />;
                      const selectable = !!f.recommended_action && f.recommendation_status === 'pending';
                      const selected = selectedFindingIds.has(f.id);
                      return (
                        <div
                          key={f.id}
                          className={`rounded-xl border p-3 ${cardCls} ${selected ? 'ring-2 ring-corporate-hero' : ''}`}
                        >
                          <div className="flex items-start gap-2 mb-1.5">
                            {selectable ? (
                              <button onClick={() => toggleFindingSelected(f.id)} className="shrink-0 mt-0.5" aria-label={selected ? 'Deselect' : 'Select to apply'}>
                                {selected ? <CheckSquare size={16} className="text-corporate-hero" /> : <Square size={16} className={mutedCls} />}
                              </button>
                            ) : icon}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{f.title}</div>
                              <div className={`text-[11px] ${mutedCls}`}>{EVIDENCE_LABEL[f.evidence_level] || f.evidence_level} · {f.category}</div>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed mb-2 ${mutedCls}`}>{f.detail}</p>
                          {selectable && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                                <PauseCircle size={12} className="inline mr-1" /> Would pause {f.bot_id}
                              </span>
                              <button
                                onClick={() => dismissFinding(f.id)}
                                disabled={busyFindingId === f.id}
                                className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${dark ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-600'}`}
                              >
                                <XCircle size={13} /> Info only — dismiss
                              </button>
                            </div>
                          )}
                          {f.recommendation_status === 'applied' && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                              <CheckCircle2 size={13} /> Applied {f.applied_at ? `on ${new Date(f.applied_at).toLocaleString()}` : ''} by {f.applied_by}
                            </div>
                          )}
                          {f.recommendation_status === 'dismissed' && (
                            <div className={`flex items-center gap-1.5 text-xs font-medium ${mutedCls}`}>
                              <Eye size={13} /> Marked info-only
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </FoldedCard>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
