import React, { useState } from 'react';
import { apiFetch } from './AccessExpiredGate';
import { useAuth } from '../hooks/useAuth';
import { formatApiError } from '../lib/apiError';

/**
 * GoLiveChecklistPanel
 * ======================
 * Dashboard panel for the go-live validation gate. Runs the automated
 * checks against a bot's stored backtest results, shows every check
 * (pass/fail/missing) with its detail text, and — for the three
 * safety-critical manual checks — lets a person submit a signed
 * attestation (who, pass/fail, notes) right from the UI.
 *
 * This intentionally does NOT let anyone "just check a box" to pass
 * the manual checks — submitting requires typing a name, and every
 * submission is preserved as an audit record on the backend, visible
 * in the attestation history for that check.
 *
 * Restyled to the portal's own corporate design tokens — see
 * PerformanceForecastPanel.jsx's own comment for why. Takes a `dark`
 * prop like every other page-level component in this app.
 *
 * Wire `apiBaseUrl` to your backend; expects:
 *   POST {apiBaseUrl}/api/validation-gate/evaluate
 *   POST {apiBaseUrl}/api/validation-gate/attest
 */

const BOT_OPTIONS = [
  { id: 'bot_1', label: 'Bot 1 — Macro Swing Structure' },
  { id: 'bot_2', label: 'Bot 2 — Order Block Reversal' },
  { id: 'bot_3', label: 'Bot 3 — FVG Expansion & Fill' },
  { id: 'bot_4', label: 'Bot 4 — Volume & Liquidity Sweep' },
  { id: 'bot_5', label: 'Bot 5 — Liquidity Purge Specialist' },
];

const CHECK_LABELS = {
  min_trade_count: 'Minimum trade count',
  out_of_sample_expectancy: 'Out-of-sample expectancy',
  max_drawdown: 'Max drawdown (Monte Carlo)',
  cost_stress_test: 'Cost stress test',
  parameter_stability: 'Parameter stability',
  paper_trading_reconciliation: 'Paper-trading reconciliation',
  kill_switch_test: 'Kill-switch test',
  manual_emergency_close_test: 'Manual emergency-close test',
};

const MANUAL_CHECKS = ['paper_trading_reconciliation', 'kill_switch_test', 'manual_emergency_close_test'];

function inputCls(dark) {
  return `w-full rounded-lg px-3 py-2 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
}

function cardCls(dark) {
  return `rounded-xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
}

function StatusPill({ status }) {
  const map = {
    pass: { label: 'PASS', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
    fail: { label: 'FAIL', cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
    missing: { label: 'MISSING', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  };
  const cfg = map[status] || map.missing;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function AttestationForm({ botId, checkName, apiBaseUrl, onSubmitted, dark }) {
  // See PerformanceForecastPanel.jsx's own comment — same missing-auth
  // root cause, same fix.
  const { token } = useAuth();
  const [signedBy, setSignedBy] = useState('');
  const [passed, setPassed] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!signedBy.trim()) {
      setErr('Enter the name of the person who ran this test.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/validation-gate/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ bot_id: botId, check_name: checkName, passed, signed_by: signedBy, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(formatApiError(body.detail, 'Failed to submit attestation'));
      }
      setSignedBy('');
      setNotes('');
      onSubmitted();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`mt-3 border rounded-lg p-3 space-y-2 ${dark ? 'border-corporate-border-dark bg-white/5' : 'border-corporate-bg bg-corporate-bg/40'}`}>
      <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>
        This can only be confirmed by someone who actually performed the test —
        record who did it and what happened.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className={inputCls(dark)} placeholder="Your name" value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)} />
        <select className={inputCls(dark)} value={passed ? 'pass' : 'fail'}
          onChange={(e) => setPassed(e.target.value === 'pass')}>
          <option value="pass">Test passed</option>
          <option value="fail">Test failed</option>
        </select>
        <button onClick={submit} disabled={submitting}
          className="bg-corporate-hero text-white text-sm font-semibold rounded-lg px-3 py-2 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit sign-off'}
        </button>
      </div>
      <textarea className={inputCls(dark)} placeholder="Notes (what you tested, what happened)"
        rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <div className="text-xs text-red-500">{err}</div>}
    </div>
  );
}

export default function GoLiveChecklistPanel({ apiBaseUrl = '', dark = false }) {
  // See PerformanceForecastPanel.jsx's own comment — same missing-auth
  // root cause, same fix.
  const { token } = useAuth();
  const [botId, setBotId] = useState(BOT_OPTIONS[0].id);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAttestation, setOpenAttestation] = useState(null);

  const headingCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const subCls = dark ? 'text-white/50' : 'text-gray-500';
  const labelCls = dark ? 'text-white/40' : 'text-gray-400';

  async function runEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/validation-gate/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // See PerformanceForecastPanel.jsx's own comment on
        // formatApiError — same 422-array-of-objects bug, by direct
        // bug report ("Fix error -- object Object],[object Object]").
        throw new Error(formatApiError(body.detail, `Evaluation failed (${res.status})`));
      }
      setReport(await res.json());
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold font-display ${headingCls}`}>Go-Live Checklist</h2>
        <p className={`text-sm mt-1 ${subCls}`}>
          Nine checks stand between a bot and autonomous mode. Three of them —
          paper-trading reconciliation, kill-switch test, emergency-close test —
          can only be satisfied by someone actually running that test and signing off.
        </p>
      </div>

      <div className={`${cardCls(dark)} flex flex-wrap items-end gap-4`}>
        <div className="flex-1 min-w-[220px]">
          <label className={`text-sm block mb-1 ${subCls}`}>Bot</label>
          <select className={inputCls(dark)} value={botId} onChange={(e) => setBotId(e.target.value)}>
            {BOT_OPTIONS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
        <button onClick={runEvaluation} disabled={loading}
          className="bg-corporate-hero text-white font-semibold px-5 py-2.5 rounded-xl text-sm
                     hover:opacity-90 transition disabled:opacity-50">
          {loading ? 'Evaluating…' : 'Run validation gate'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className={`rounded-xl p-5 border text-center font-semibold text-lg ${
            report.overall_pass
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/10 border-red-500/30 text-red-500'
          }`}>
            {report.overall_pass ? '✓ GO-LIVE APPROVED' : '✕ BLOCKED — autonomous mode not authorized'}
            {!report.overall_pass && report.blocking_failures.length > 0 && (
              <div className={`text-xs font-normal mt-2 ${labelCls}`}>
                Blocking: {report.blocking_failures.map((f) => CHECK_LABELS[f] || f).join(', ')}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {report.checks.map((check) => (
              <div key={check.name} className={cardCls(dark).replace('p-6', 'p-4')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={`font-medium ${headingCls}`}>
                      {CHECK_LABELS[check.name] || check.name}
                      {!check.automated && (
                        <span className={`ml-2 text-xs ${labelCls}`}>(manual sign-off required)</span>
                      )}
                    </div>
                    <div className={`text-sm mt-1 ${subCls}`}>{check.detail}</div>
                    {check.attestation && (
                      <div className={`text-xs mt-2 ${labelCls}`}>
                        Signed by <span className={dark ? 'text-white/70' : 'text-gray-600'}>{check.attestation.signed_by}</span> on{' '}
                        {new Date(check.attestation.signed_at).toLocaleString()}
                        {check.attestation.notes && ` — "${check.attestation.notes}"`}
                      </div>
                    )}
                  </div>
                  <StatusPill status={check.status} />
                </div>

                {MANUAL_CHECKS.includes(check.name) && (
                  <>
                    {openAttestation === check.name ? (
                      <AttestationForm
                        botId={botId}
                        checkName={check.name}
                        apiBaseUrl={apiBaseUrl}
                        dark={dark}
                        onSubmitted={() => { setOpenAttestation(null); runEvaluation(); }}
                      />
                    ) : (
                      <button
                        onClick={() => setOpenAttestation(check.name)}
                        className="mt-3 text-xs text-corporate-hero hover:underline"
                      >
                        {check.status === 'missing' ? 'Record sign-off →' : 'Re-attest →'}
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
