import { useEffect, useState } from 'react';
import { ClipboardList, Info } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { BotOptimizationVisualDashboard } from '../components/BotOptimizationVisualDashboard';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { gradeFamily, type ExpectancyRow } from '../lib/botGrading';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface MatrixResponse {
  bot_family_expectancy: ExpectancyRow[];
  bot_instance_expectancy: ExpectancyRow[];
}

// Static reference content — authored this session from reading each
// bot's real code, not pulled from a dataset (qualitative description
// of methodology, not a numeric figure the backend computes). Mirrors
// the same content published as a Claude Artifact earlier in this
// session's Stage 8 work; kept here too so it's visible in-portal
// without needing a separate link out.
const BOT_REFERENCE: Array<{
  fam: string; name: string; instr: string; entry: string; sl: string; tp: string; rel: string; note: string; rec: string;
}> = [
  { fam: 'bot_1', name: 'Bot 1 — Macro Swing Structure', instr: 'BTC',
    entry: 'Zone mean/aggressive', sl: 'structure_swing (floored 0.15%, embeds zone)', tp: '3R, 30/40/30 ladder, trail @2R',
    rel: '—', note: 'No A/B variant, no known open issue.', rec: 'Leave as-is; too little data to act on.' },
  { fam: 'bot_2', name: 'Bot 2 — HF Order Block Reversal', instr: 'BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'OB mean (if swept) / aggressive', sl: 'sweep_extreme or structure_swing, embed OB +10%, floored 0.15% (fixed this session)', tp: '3R, 30/40/30, trail @2R',
    rel: 'A/B vs Bot 11 (same logic, 30% embed + 0.35% floor)',
    note: 'Real 60-day out-of-sample backtest: Bot 2 beats Bot 11 on 3 of 4 real instruments (JPY, XAUT, and the pooled distribution) — the wider stop does not pay for itself. A second hypothesis (always enter at the OB\'s own extreme instead of mean-if-swept) was built, real-backtested across all 7 symbols, and refuted: worse win rate on every symbol, pooled avg R flipping from +0.08 to -0.12 across 100+ trades — removed rather than shipped.',
    rec: 'Keep Bot 2\'s current (now-floored) stop and mean-if-swept entry as the default; Bot 11 stays as a monitored A/B, not a replacement.' },
  { fam: 'bot_3', name: 'Bot 3 — FVG Expansion & Fill', instr: 'BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'FVG mean, depth-selected', sl: 'FVG-width based, floored 0.15% (PR #286)', tp: '3R, 30/40/30, trail @2R',
    rel: 'Deliberately left without OB/premium-discount checks — the A/B baseline for Bot 7',
    note: 'Strongest real sample this session: n=61, 82% win rate, real positive expectancy.', rec: 'Performing well on real evidence. No change indicated.' },
  { fam: 'bot_4', name: 'Bot 4 — Volume & Liquidity Sweep', instr: 'BTC · JPY/EUR/XAUT',
    entry: 'Spring/upthrust close', sl: 'spring/upthrust extreme, embed POI zone, floored 0.15% (fixed this session)', tp: '3R (confluence-scored), capped at range',
    rel: 'A/B vs Bot 9 (25% near-extreme band) and Bot 10 (held-the-test confirmation)',
    note: 'Structurally over-restrictive: real replay found its mandatory CHoCH confirmation rejects 91.5% of genuine spring/upthrust events — close to mutually exclusive with its own range-bound precondition by construction. Confirmed across its full real symbol set (BTC + JPY/EUR/XAUT, 60-day backtest): just 1 real trade total across 4 real symbols.',
    rec: 'Bot 9/10 are the live test of two fixes to this exact gate; let them accumulate real trades before touching Bot 4 itself.' },
  { fam: 'bot_5', name: 'Bot 5 — Jeafx SMC Style', instr: 'BTC',
    entry: 'OB mean / 15M FVG depth-selected', sl: 'jeafx_purge_extreme, embed aligned zone, floored 0.15% (fixed this session)', tp: 'Code default 4-6R — but platform-wide min_rr_ratio=3.0 overrides it down to 3R live, same as every other bot',
    rel: 'A/B vs Bot 6 (adds LTF-agreement gate) and Bot 8 (Bot 6 minus that gate)',
    note: 'Decent real expectancy despite a sub-50% win rate — the R:R carries it. Real 35-day backtest (after fixing a 5M data-retention bug, see Bot 8): 4 trades, 75% win rate, +0.862R — promising but still a very small sample.',
    rec: 'Real config gap: Bot 5 was designed as the "high R:R specialist" but a uniform min_rr_ratio flattens it to the same target as every other bot. Worth a deliberate per-bot override once a larger backtest sample shows whether 4-6R actually improves on 3R.' },
  { fam: 'bot_6', name: 'Bot 6 — SMC v2', instr: 'XAUT · BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'OB mean / 15M FVG depth-selected', sl: 'jeafx_purge_extreme, embed aligned zone, floored 0.15% (fixed this session)', tp: 'Same min_rr_ratio=3.0 override as Bot 5',
    rel: 'A/B baseline for Bot 8 (removes its LTF-agreement gate)',
    note: 'Negative real live-trade expectancy — but 23 of 24 of those trades predate the 2026-10-14 mandatory-1H-BOS revision, so this number is mostly measuring already-superseded logic. Real backtest across its full 7-symbol coverage (35-day window): n=48, avg -0.028R — roughly breakeven, and still the better of the two once Bot 8 is compared on the same full symbol set.',
    rec: 'Do not pause or "fix" Bot 6 off this number alone — it\'s stale by construction. Bot 8 re-tests the current logic cleanly.' },
  { fam: 'bot_7', name: 'Bot 7 — FVG Expansion v3', instr: 'BTC',
    entry: 'FVG mean, depth-selected', sl: 'FVG-width based, floored 0.15% (PR #286)', tp: '3R, 30/40/30, trail @2R',
    rel: 'A/B vs Bot 3 — depth-based vs recency-based FVG selection, otherwise identical',
    note: 'Real sample still too small to read anything into.', rec: 'Let it accumulate trades; revisit once n crosses 15.' },
  { fam: 'bot_8', name: 'Bot 8 — SMC v2 Single-Anchor', instr: 'XAUT · BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'Same as Bot 6', sl: 'Same as Bot 6 (floored 0.15%)', tp: 'Same min_rr_ratio=3.0 override',
    rel: 'A/B vs Bot 6 — isolates the LTF-agreement gate (Bot 8 = Bot 6 minus that one gate)',
    note: 'Was silently unbacktestable until a registry gap was fixed this session. Its own first real backtest then looked like a 0-signal null — a separate real bug (a flat 5M lookback padding exceeding bingx\'s real 5M retention window, fixed this session). Re-run over its full 7-symbol coverage (35-day window): n=196, avg -0.069R, firing 4x more often than Bot 6 on identical windows (196 vs 48 trades) — decisively confirms the LTF-agreement gate is the dominant restrictor, but produces a slightly worse real expectancy than Bot 6, not better.',
    rec: 'Solves the silent-bot problem, not the edge — Bot 6 remains the slightly better performer per trade. Keep both as a monitored A/B, not grounds to drop the gate.' },
  { fam: 'bot_9', name: 'Bot 9 — Volume & Liquidity Wide-Range', instr: 'BTC · JPY/EUR/XAUT',
    entry: 'Same as Bot 4', sl: 'Same as Bot 4 (floored 0.15%)', tp: '3R, capped at range',
    rel: 'A/B vs Bot 4 — widens the near-extreme band 15%→25%, isolates only that one variable',
    note: 'Real backtest across its full symbol set (BTC + JPY/EUR/XAUT): essentially identical to Bot 4 (n=1, the exact same single trade) — the near-extreme band is confirmed NOT the binding constraint on real data.',
    rec: 'Let it accumulate a real sample across more market conditions before judging it.' },
  { fam: 'bot_10', name: 'Bot 10 — Volume & Liquidity Held-Reclaim', instr: 'BTC · JPY/EUR/XAUT',
    entry: 'Same as Bot 4', sl: 'Same as Bot 4 (floored 0.15%)', tp: '3R, capped at range',
    rel: 'A/B vs Bot 4 — replaces the mandatory CHoCH confirmation with a Wyckoff "held the test" check (confirmed 16/47 vs CHoCH\'s 0/47 on the same real events)',
    note: 'Its EURUSDT.P instance silently failed to log a single trade since creation (a database column was too narrow for its own trade_id) — fixed this session. Real backtest across its full symbol set: n=13, avg -0.24R — genuinely solves Bot 4\'s near-silence (13 vs 1-2 trades) but hasn\'t yet shown a positive real edge.',
    rec: 'Worth continued monitoring on real accumulating data; not yet a confirmed win.' },
  { fam: 'bot_11', name: 'Bot 11 — HF OB Reversal, Wider-Stop', instr: 'BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'Same as Bot 2', sl: 'Same as Bot 2, but 30% embed buffer + 0.35% floor (vs Bot 2\'s 10%/0.15%)', tp: '3R, 30/40/30, trail @2R',
    rel: 'A/B vs Bot 2 — the direct answer to "is the SL too tight"',
    note: 'Real 60-day backtest: loses to Bot 2 on win rate, expectancy, AND drawdown across almost every real instrument and percentile band tested — the wider stop does not earn its keep.',
    rec: 'Keep as a monitored A/B only; do not widen Bot 2\'s own stop based on this result.' },
  { fam: 'bot_12', name: 'Bot 12 — HF OB Reversal, Runner', instr: 'BTC · JPY/EUR/XAUT · NAS100 · Oil',
    entry: 'Identical to Bot 2', sl: 'Identical to Bot 2 — this variant changes trade MANAGEMENT, not entry/SL', tp: 'Trailing activates at TP1 (R=1.0) not TP2 (R=2.0), using a new narrowing "step_down" trail instead of a constant width',
    rel: 'A/B vs Bot 2 — reuses Bot 2\'s entry logic byte-for-byte (strategy_key=bot_2, no new strategy class)',
    note: 'Built from a real finding: 17 of 80 closed trades (21%) hit TP1 then gave back the ENTIRE remaining 70% of the position at a flat breakeven floor, because trailing previously only activated at TP2 and nothing protected the gap between TP1 and TP2. Trades that DID reach TP2 averaged 6.35R vs 0.28R for the TP1-only group.',
    rec: 'Compare Bot 2 vs Bot 12 once both accumulate real trades post-change; this tests whether activating trailing a full R earlier (with a width that narrows rather than staying constant) captures more of that 6.35R-vs-0.28R gap.' },
  { fam: 'bot_13', name: 'Bot 13 — FVG Expansion, HTF-Gated', instr: 'BTC',
    entry: 'Identical to Bot 3', sl: 'Identical to Bot 3 — this variant changes only the entry GATE', tp: '4R, identical to Bot 3',
    rel: 'A/B vs Bot 3 — adds a real 1D HTF-alignment gate (reject unless the 1D bias is clear AND agrees with the trade\'s own direction); nothing else differs',
    note: 'Built from a real finding: 153 of 158 real closed bot trades, re-analyzed through the forensics engine for their real 1D HTF bias at entry, showed direction-aligned trades meaningfully outperforming both unclear-bias and counter-trend trades (33.3% loss rate / +2.38R avg vs 41.8%/+1.20R and 43.5%/+1.92R) — but ONLY for continuation-style bots (Bot 3: 8% loss clear vs 28% unclear; Bot 5: 40% vs 62%). Reversal-style bots (Bot 2, Bot 6) showed the OPPOSITE pattern, so this gate is deliberately scoped to Bot 3 only. A same-day sanity backtest of Bot 3 itself returned an implausibly low 3.7% win rate, wildly inconsistent with its real ~82% live win rate — a separate, real backtest-engine fidelity question worth its own investigation, not yet resolved.',
    rec: 'Let real trades accumulate and compare against Bot 3\'s own real history directly — this engine\'s own backtest replay is not currently trustworthy for this bot family.' },
];

/**
 * BotOptimizationMatrixPage — Stage 8 of the SMC Forensic Audit,
 * in-portal. By direct request ("add the bot optimisation dashboard
 * to the portal - bot page in the trader dashboard and also in admin
 * portal"). One shared component, mounted at both /bot-optimization
 * (trader, Layout) and /admin/bot-optimization (Admin, CorporateLayout)
 * — each page passes its own `dark` so this component never has to
 * guess which portal's theme it's rendering under.
 *
 * Read-only: no "run"/"apply" actions like the Monthly Trading Audit
 * page has. The live numbers come from GET /bots/optimization-matrix,
 * which applies the exact same per-trader ownership scoping
 * routers/bots.py's own list_bots does — a non-staff trader only ever
 * sees expectancy computed from bots they themselves own.
 *
 * `portal` picks which of useThemeStore's independent light/dark
 * slots to follow (same pattern BotsPage/AdminTradingAuditPage each
 * already use themselves) — "trader" for the /bot-optimization route,
 * "admin" for /admin/bot-optimization.
 */
export function BotOptimizationMatrixPage({ portal }: { portal: 'trader' | 'admin' }) {
  const { token } = useAuth();
  const { portalThemes } = useThemeStore();
  const dark = portalThemes[portal] === 'dark';
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  useEffect(() => {
    if (!token) return;
    fetchJsonWithRetry<MatrixResponse>(
      `${API_URL}/bots/optimization-matrix`, { headers: { Authorization: `Bearer ${token}` } }, setPhase,
    ).then((r) => { if (r) setData(r); });
  }, [token]);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200';

  return (
    <div>
      <PageHeader
        title="Bot Optimization Matrix"
        subtitle="Per-bot, per-instrument entry/SL/TP mechanics cross-referenced with real trade history and this session's own A/B findings."
      />

      {!data && <LoadingIndicator phase={phase} dark={dark} />}

      {data && (
        <div className="space-y-4">
          {/* "Can we also have a visual specific dashboard for Bot
              Optimization Matrix also same and similar" — by direct
              request. Mirrors AuditVisualDashboard's own chart set
              (bar charts, a pie, a pyramid), built from this page's
              own real family/instance expectancy data and its real
              gradeFamily() grading (lib/botGrading.ts) — imported
              directly, not re-derived, so it can never grade a bot
              differently from the table right below it. This
              component is shared between the trader route
              (/bot-optimization) and the admin route
              (/admin/bot-optimization), so mounting it here puts it
              in both places at once. */}
          <BotOptimizationVisualDashboard familyRows={data.bot_family_expectancy} instanceRows={data.bot_instance_expectancy} dark={dark} />

          <FoldedCard title="Per-Family Trade History" icon={<ClipboardList size={18} />} dark={dark} defaultOpen>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className={mutedCls}>
                    <th className="text-left p-2">Family</th>
                    <th className="text-right p-2">Trades</th>
                    <th className="text-right p-2">Win rate</th>
                    <th className="text-right p-2">Total P&amp;L</th>
                    <th className="text-right p-2">Avg R</th>
                    <th className="text-left p-2">Evidence grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bot_family_expectancy.map((row) => {
                    const grade = gradeFamily(row);
                    return (
                      <tr key={row.bot_family} className={`border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                        <td className="p-2 font-mono font-semibold">{row.bot_family}</td>
                        <td className="p-2 text-right">{row.n}</td>
                        <td className="p-2 text-right">{row.win_rate_pct ?? '—'}%</td>
                        <td className={`p-2 text-right ${row.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${row.total_pnl.toFixed(2)}
                        </td>
                        <td className="p-2 text-right">{row.avg_r ?? '—'}</td>
                        <td className={`p-2 font-semibold ${grade.cls}`}>{grade.label}</td>
                      </tr>
                    );
                  })}
                  {data.bot_family_expectancy.length === 0 && (
                    <tr><td colSpan={6} className={`p-2 ${mutedCls}`}>No closed trades yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className={`text-[11px] mt-2 flex items-start gap-1.5 ${mutedCls}`}>
              <Info size={13} className="shrink-0 mt-0.5" />
              Evidence grade follows the same "don't rank by win rate alone, don't act on n&lt;15" discipline the Monthly Trading Audit uses.
            </p>
          </FoldedCard>

          <FoldedCard title="Per-Instance Detail" icon={<ClipboardList size={18} />} dark={dark}>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className={mutedCls}>
                    <th className="text-left p-2">Bot ID</th>
                    <th className="text-right p-2">Trades</th>
                    <th className="text-right p-2">Wins</th>
                    <th className="text-right p-2">Losses</th>
                    <th className="text-right p-2">Total P&amp;L</th>
                    <th className="text-right p-2">Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bot_instance_expectancy.map((row) => (
                    <tr key={row.bot_id} className={`border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                      <td className="p-2 font-mono">{row.bot_id}</td>
                      <td className="p-2 text-right">{row.n}</td>
                      <td className="p-2 text-right text-emerald-500">{row.wins}</td>
                      <td className="p-2 text-right text-red-500">{row.losses}</td>
                      <td className={`p-2 text-right ${row.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${row.total_pnl.toFixed(2)}
                      </td>
                      <td className="p-2 text-right">{row.avg_r ?? '—'}</td>
                    </tr>
                  ))}
                  {data.bot_instance_expectancy.length === 0 && (
                    <tr><td colSpan={6} className={`p-2 ${mutedCls}`}>No closed trades yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </FoldedCard>

          <FoldedCard title="Per-Bot Mechanics, Findings & Next Step" icon={<ClipboardList size={18} />} dark={dark}>
            <div className="grid gap-3 sm:grid-cols-2">
              {BOT_REFERENCE.map((c) => (
                <div key={c.fam} className={`rounded-xl border p-3.5 ${cardCls}`}>
                  <div className={`text-sm font-semibold mb-0.5 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{c.name}</div>
                  <div className={`text-[11px] mb-2 ${mutedCls}`}>{c.instr}</div>
                  <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <dt className={mutedCls}>Entry</dt><dd>{c.entry}</dd>
                    <dt className={mutedCls}>Stop loss</dt><dd>{c.sl}</dd>
                    <dt className={mutedCls}>Targets</dt><dd>{c.tp}</dd>
                    <dt className={mutedCls}>A/B relationship</dt><dd>{c.rel}</dd>
                  </dl>
                  <p className={`text-xs mt-2 pt-2 border-t ${dark ? 'border-white/10' : 'border-gray-100'} ${mutedCls}`}>{c.note}</p>
                  <p className={`text-xs mt-1.5 italic ${mutedCls}`}>→ {c.rec}</p>
                </div>
              ))}
            </div>
          </FoldedCard>
        </div>
      )}
    </div>
  );
}
