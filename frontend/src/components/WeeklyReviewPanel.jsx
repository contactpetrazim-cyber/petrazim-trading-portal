import React, { useState } from 'react';

/**
 * WeeklyReviewPanel
 * ===================
 * The coach's weekly debrief: taken trades graded on process (not just
 * outcome), missed opportunities with honestly-simulated hypothetical
 * results, and an emotional/psychology correlation review.
 *
 * Wire `apiBaseUrl` to your backend; expects:
 *   GET {apiBaseUrl}/api/weekly-review/report?week_start=...&week_end=...&bot_id=...
 */

const GRADE_STYLES = {
  planned_win: { label: 'Planned win', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  risk_managed_loss: { label: 'Risk-managed loss', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  needs_manual_review: { label: 'Needs review', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
};

function mondayOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function sundayOf(mondayIso) {
  const d = new Date(mondayIso);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  'bg-smc-bg border border-smc-border rounded-lg px-3 py-2 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-1 focus:ring-smc-accent focus:border-smc-accent';

export default function WeeklyReviewPanel({ apiBaseUrl = '' }) {
  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const weekEnd = sundayOf(weekStart);

  async function loadReview() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ week_start: weekStart, week_end: weekEnd });
      const res = await fetch(`${apiBaseUrl}/api/weekly-review/report?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to load review (${res.status})`);
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
        <h2 className="text-2xl font-bold text-gray-100">Weekly Review</h2>
        <p className="text-gray-400 text-sm mt-1">
          Every trade taken, every rejected signal, honestly re-checked — plus how your
          logged emotional state lined up with what actually happened.
        </p>
      </div>

      <div className="bg-smc-card border border-smc-border rounded-xl p-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Week starting (Monday)</label>
          <input type="date" className={inputClass} value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)} />
          <div className="text-xs text-gray-500 mt-1">through {weekEnd}</div>
        </div>
        <button onClick={loadReview} disabled={loading}
          className="bg-smc-accent text-black font-medium px-5 py-2 rounded-lg text-sm
                     hover:opacity-90 transition disabled:opacity-50">
          {loading ? 'Loading…' : 'Run weekly review'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Trades" value={report.n_trades} />
            <StatCard label="Win rate" value={`${(report.win_rate * 100).toFixed(1)}%`} />
            <StatCard label="Expectancy" value={`${report.expectancy_r.toFixed(2)}R`} />
            <StatCard label="Total" value={`${report.total_r.toFixed(2)}R`}
              tone={report.total_r >= 0 ? 'ok' : 'warn'} />
          </div>

          {/* Coach debrief */}
          <div className="bg-smc-card border border-smc-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Coach's debrief</h3>
            <p className="text-gray-200 text-sm leading-relaxed">{report.template_narrative}</p>
            <p className="text-xs text-gray-500 mt-3">
              This is the deterministic summary. Wire `coach_prompt` from this response into your
              LLM coach integration for a fuller narrative in the coach's voice.
            </p>
          </div>

          {/* Key lessons */}
          {report.key_lessons.length > 0 && (
            <div className="bg-smc-card border border-smc-border rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Key lessons this week</h3>
              <ul className="space-y-2">
                {report.key_lessons.map((lesson, i) => (
                  <li key={i} className="text-sm text-gray-200 flex gap-2">
                    <span className="text-smc-accent">•</span>{lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Taken trades */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Taken trades</h3>
            <div className="space-y-3">
              {report.taken_trade_reviews.map((tr) => {
                const grade = GRADE_STYLES[tr.grade] || GRADE_STYLES.needs_manual_review;
                return (
                  <div key={tr.trade_id} className="bg-smc-card border border-smc-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="font-medium text-gray-100">
                        {tr.symbol} <span className="text-gray-400 font-normal">{tr.direction}</span>
                        <span className={`ml-2 font-semibold ${tr.r_multiple >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tr.r_multiple >= 0 ? '+' : ''}{tr.r_multiple.toFixed(2)}R
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-md border ${grade.cls}`}>{grade.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Entry rationale: {tr.entry_rationale || 'not recorded'}
                    </p>
                    <p className="text-sm text-gray-300">{tr.what_happened}</p>
                    <p className="text-sm text-gray-400 mt-1">{tr.what_could_differ}</p>
                  </div>
                );
              })}
              {report.taken_trade_reviews.length === 0 && (
                <p className="text-sm text-gray-500">No trades taken this week.</p>
              )}
            </div>
          </div>

          {/* Missed opportunities */}
          {report.missed_opportunities.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Missed opportunities</h3>
              <div className="space-y-3">
                {report.missed_opportunities.map((m, i) => (
                  <div key={i} className="bg-smc-card border border-smc-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="font-medium text-gray-100">
                        {m.symbol} <span className="text-gray-400 font-normal">{m.direction}</span>
                      </div>
                      {m.hypothetical_r_multiple != null && (
                        <span className={`text-sm font-semibold ${m.hypothetical_r_multiple >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          hypothetical {m.hypothetical_r_multiple >= 0 ? '+' : ''}{m.hypothetical_r_multiple.toFixed(2)}R
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">Rejected: {m.rejection_reason}</p>
                    <p className="text-sm text-gray-300">{m.lesson}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emotional review */}
          {report.mood_performance.length > 0 && (
            <div className="bg-smc-card border border-smc-border rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Emotional / psychology review</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {report.mood_performance.map((mp) => (
                  <div key={mp.mood_tag} className="border border-smc-border rounded-lg p-3">
                    <div className="text-xs text-gray-400 capitalize">{mp.mood_tag}</div>
                    <div className="text-sm text-gray-200 mt-1">{mp.n_trades} trades</div>
                    <div className={`text-sm font-medium ${mp.expectancy_r >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {mp.expectancy_r >= 0 ? '+' : ''}{mp.expectancy_r.toFixed(2)}R
                    </div>
                  </div>
                ))}
              </div>
              {report.flagged_patterns.length > 0 && (
                <div className="mt-4 space-y-2">
                  {report.flagged_patterns.map((p, i) => (
                    <p key={i} className="text-xs text-amber-400/90 bg-amber-400/10 rounded-lg px-3 py-2">
                      ⚠ {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
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
