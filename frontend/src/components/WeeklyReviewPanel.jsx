import React, { useState } from 'react';
import { apiFetch } from './AccessExpiredGate';
import { useAuth } from '../hooks/useAuth';
import { formatApiError } from '../lib/apiError';

/**
 * WeeklyReviewPanel
 * ===================
 * The coach's weekly debrief: taken trades graded on process (not just
 * outcome), missed opportunities with honestly-simulated hypothetical
 * results, and an emotional/psychology correlation review.
 *
 * Restyled to the portal's own corporate design tokens — see
 * PerformanceForecastPanel.jsx's own comment for why (same generic
 * dark-only palette it shipped with, by the same direct bug report:
 * "Use the portals colour theme ... remain consistent to the portal
 * overall colours and design"). Takes a `dark` prop like every other
 * page-level component in this app.
 *
 * Wire `apiBaseUrl` to your backend; expects:
 *   GET {apiBaseUrl}/api/weekly-review/report?week_start=...&week_end=...&bot_id=...
 */

const GRADE_STYLES = {
  planned_win: { label: 'Planned win', cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  risk_managed_loss: { label: 'Risk-managed loss', cls: 'text-corporate-hero bg-corporate-hero/10 border-corporate-hero/30' },
  needs_manual_review: { label: 'Needs review', cls: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
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

function inputCls(dark) {
  return `rounded-lg px-3 py-2 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
}

function cardCls(dark) {
  return `rounded-xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
}

export default function WeeklyReviewPanel({ apiBaseUrl = '', dark = false }) {
  // See PerformanceForecastPanel.jsx's own comment — same missing-auth
  // root cause, same fix.
  const { token } = useAuth();
  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const weekEnd = sundayOf(weekStart);
  const headingCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const subCls = dark ? 'text-white/50' : 'text-gray-500';
  const labelCls = dark ? 'text-white/40' : 'text-gray-400';

  async function loadReview() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ week_start: weekStart, week_end: weekEnd });
      const res = await apiFetch(`${apiBaseUrl}/api/weekly-review/report?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // See PerformanceForecastPanel.jsx's own comment on
        // formatApiError — `body.detail` is an array of objects on a
        // 422, not a string; `new Error(array)` used to stringify to
        // "[object Object],[object Object]", by direct bug report.
        throw new Error(formatApiError(body.detail, `Failed to load review (${res.status})`));
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
        <h2 className={`text-2xl font-bold font-display ${headingCls}`}>Weekly Review</h2>
        <p className={`text-sm mt-1 ${subCls}`}>
          Every trade taken, every rejected signal, honestly re-checked — plus how your
          logged emotional state lined up with what actually happened.
        </p>
      </div>

      <div className={`${cardCls(dark)} flex flex-wrap items-end gap-4`}>
        <div>
          <label className={`text-sm block mb-1 ${subCls}`}>Week starting (Monday)</label>
          <input type="date" className={inputCls(dark)} value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)} />
          <div className={`text-xs mt-1 ${labelCls}`}>through {weekEnd}</div>
        </div>
        <button onClick={loadReview} disabled={loading}
          className="bg-corporate-hero text-white font-semibold px-5 py-2.5 rounded-xl text-sm
                     hover:opacity-90 transition disabled:opacity-50">
          {loading ? 'Loading…' : 'Run weekly review'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard dark={dark} label="Trades" value={report.n_trades} />
            <StatCard dark={dark} label="Win rate" value={`${(report.win_rate * 100).toFixed(1)}%`} />
            <StatCard dark={dark} label="Expectancy" value={`${report.expectancy_r.toFixed(2)}R`} />
            <StatCard dark={dark} label="Total" value={`${report.total_r.toFixed(2)}R`}
              tone={report.total_r >= 0 ? 'ok' : 'warn'} />
          </div>

          {/* Coach debrief */}
          <div className={cardCls(dark)}>
            <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Coach's debrief</h3>
            <p className={`text-sm leading-relaxed ${dark ? 'text-white/80' : 'text-gray-700'}`}>{report.template_narrative}</p>
            <p className={`text-xs mt-3 ${labelCls}`}>
              This is the deterministic summary. Wire `coach_prompt` from this response into your
              LLM coach integration for a fuller narrative in the coach's voice.
            </p>
          </div>

          {/* Key lessons */}
          {report.key_lessons.length > 0 && (
            <div className={cardCls(dark)}>
              <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Key lessons this week</h3>
              <ul className="space-y-2">
                {report.key_lessons.map((lesson, i) => (
                  <li key={i} className={`text-sm flex gap-2 ${dark ? 'text-white/80' : 'text-gray-700'}`}>
                    <span className="text-corporate-hero">•</span>{lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Taken trades */}
          <div>
            <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Taken trades</h3>
            <div className="space-y-3">
              {report.taken_trade_reviews.map((tr) => {
                const grade = GRADE_STYLES[tr.grade] || GRADE_STYLES.needs_manual_review;
                return (
                  <div key={tr.trade_id} className={cardCls(dark).replace('p-6', 'p-4')}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className={`font-medium ${headingCls}`}>
                        {tr.symbol} <span className={`font-normal ${subCls}`}>{tr.direction}</span>
                        <span className={`ml-2 font-semibold ${tr.r_multiple >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {tr.r_multiple >= 0 ? '+' : ''}{tr.r_multiple.toFixed(2)}R
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-md border ${grade.cls}`}>{grade.label}</span>
                    </div>
                    <p className={`text-xs mb-1 ${labelCls}`}>
                      Entry rationale: {tr.entry_rationale || 'not recorded'}
                    </p>
                    <p className={`text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}>{tr.what_happened}</p>
                    <p className={`text-sm mt-1 ${subCls}`}>{tr.what_could_differ}</p>
                  </div>
                );
              })}
              {report.taken_trade_reviews.length === 0 && (
                <p className={`text-sm ${labelCls}`}>No trades taken this week.</p>
              )}
            </div>
          </div>

          {/* Missed opportunities */}
          {report.missed_opportunities.length > 0 && (
            <div>
              <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Missed opportunities</h3>
              <div className="space-y-3">
                {report.missed_opportunities.map((m, i) => (
                  <div key={i} className={cardCls(dark).replace('p-6', 'p-4')}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className={`font-medium ${headingCls}`}>
                        {m.symbol} <span className={`font-normal ${subCls}`}>{m.direction}</span>
                      </div>
                      {m.hypothetical_r_multiple != null && (
                        <span className={`text-sm font-semibold ${m.hypothetical_r_multiple >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          hypothetical {m.hypothetical_r_multiple >= 0 ? '+' : ''}{m.hypothetical_r_multiple.toFixed(2)}R
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mb-1 ${labelCls}`}>Rejected: {m.rejection_reason}</p>
                    <p className={`text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}>{m.lesson}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emotional review */}
          {report.mood_performance.length > 0 && (
            <div className={cardCls(dark)}>
              <h3 className={`text-sm font-medium mb-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>Emotional / psychology review</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {report.mood_performance.map((mp) => (
                  <div key={mp.mood_tag} className={`rounded-lg p-3 border ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
                    <div className={`text-xs capitalize ${labelCls}`}>{mp.mood_tag}</div>
                    <div className={`text-sm mt-1 ${dark ? 'text-white/80' : 'text-gray-700'}`}>{mp.n_trades} trades</div>
                    <div className={`text-sm font-medium ${mp.expectancy_r >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {mp.expectancy_r >= 0 ? '+' : ''}{mp.expectancy_r.toFixed(2)}R
                    </div>
                  </div>
                ))}
              </div>
              {report.flagged_patterns.length > 0 && (
                <div className="mt-4 space-y-2">
                  {report.flagged_patterns.map((p, i) => (
                    <p key={i} className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
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

function StatCard({ label, value, tone, dark }) {
  const toneClass = tone === 'warn' ? 'text-amber-500' : tone === 'ok' ? 'text-emerald-500' : (dark ? 'text-white' : 'text-corporate-text-on-bg');
  return (
    <div className={`rounded-xl border p-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className={`text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
