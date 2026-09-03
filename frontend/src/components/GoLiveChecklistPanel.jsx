import React, { useState } from 'react';

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

const inputClass =
  'bg-smc-bg border border-smc-border rounded-lg px-3 py-2 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-1 focus:ring-smc-accent focus:border-smc-accent w-full';

function StatusPill({ status }) {
  const map = {
    pass: { label: 'PASS', cls: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
    fail: { label: 'FAIL', cls: 'bg-red-400/15 text-red-400 border-red-400/30' },
    missing: { label: 'MISSING', cls: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  };
  const cfg = map[status] || map.missing;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function AttestationForm({ botId, checkName, apiBaseUrl, onSubmitted }) {
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
      const res = await fetch(`${apiBaseUrl}/api/validation-gate/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId, check_name: checkName, passed, signed_by: signedBy, notes }),
      });
      if (!res.ok) throw new Error('Failed to submit attestation');
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
    <div className="mt-3 border border-smc-border rounded-lg p-3 space-y-2 bg-smc-bg/40">
      <div className="text-xs text-gray-400">
        This can only be confirmed by someone who actually performed the test —
        record who did it and what happened.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className={inputClass} placeholder="Your name" value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)} />
        <select className={inputClass} value={passed ? 'pass' : 'fail'}
          onChange={(e) => setPassed(e.target.value === 'pass')}>
          <option value="pass">Test passed</option>
          <option value="fail">Test failed</option>
        </select>
        <button onClick={submit} disabled={submitting}
          className="bg-smc-accent text-black text-sm font-medium rounded-lg px-3 py-2 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit sign-off'}
        </button>
      </div>
      <textarea className={inputClass} placeholder="Notes (what you tested, what happened)"
        rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  );
}

export default function GoLiveChecklistPanel({ apiBaseUrl = '' }) {
  const [botId, setBotId] = useState(BOT_OPTIONS[0].id);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAttestation, setOpenAttestation] = useState(null);

  async function runEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/validation-gate/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Evaluation failed (${res.status})`);
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
        <h2 className="text-2xl font-bold text-gray-100">Go-Live Checklist</h2>
        <p className="text-gray-400 text-sm mt-1">
          Nine checks stand between a bot and autonomous mode. Three of them —
          paper-trading reconciliation, kill-switch test, emergency-close test —
          can only be satisfied by someone actually running that test and signing off.
        </p>
      </div>

      <div className="bg-smc-card border border-smc-border rounded-xl p-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm text-gray-400 block mb-1">Bot</label>
          <select className={inputClass} value={botId} onChange={(e) => setBotId(e.target.value)}>
            {BOT_OPTIONS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
        <button onClick={runEvaluation} disabled={loading}
          className="bg-smc-accent text-black font-medium px-5 py-2 rounded-lg text-sm
                     hover:opacity-90 transition disabled:opacity-50">
          {loading ? 'Evaluating…' : 'Run validation gate'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className={`rounded-xl p-5 border text-center font-semibold text-lg ${
            report.overall_pass
              ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
              : 'bg-red-400/10 border-red-400/30 text-red-400'
          }`}>
            {report.overall_pass ? '✓ GO-LIVE APPROVED' : '✕ BLOCKED — autonomous mode not authorized'}
            {!report.overall_pass && report.blocking_failures.length > 0 && (
              <div className="text-xs font-normal text-gray-400 mt-2">
                Blocking: {report.blocking_failures.map((f) => CHECK_LABELS[f] || f).join(', ')}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {report.checks.map((check) => (
              <div key={check.name} className="bg-smc-card border border-smc-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-100">
                      {CHECK_LABELS[check.name] || check.name}
                      {!check.automated && (
                        <span className="ml-2 text-xs text-gray-500">(manual sign-off required)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{check.detail}</div>
                    {check.attestation && (
                      <div className="text-xs text-gray-500 mt-2">
                        Signed by <span className="text-gray-300">{check.attestation.signed_by}</span> on{' '}
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
                        onSubmitted={() => { setOpenAttestation(null); runEvaluation(); }}
                      />
                    ) : (
                      <button
                        onClick={() => setOpenAttestation(check.name)}
                        className="mt-3 text-xs text-smc-accent hover:underline"
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
