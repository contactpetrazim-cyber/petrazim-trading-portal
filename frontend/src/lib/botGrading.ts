// Shared between BotOptimizationMatrixPage (the table) and
// BotOptimizationVisualDashboard (the pyramid/charts) — pulled out of
// the page into its own module specifically so the dashboard
// component can import the real grading function without creating a
// page <-> component circular import.

export interface ExpectancyRow {
  bot_family?: string;
  bot_id?: string;
  n: number;
  wins: number;
  losses: number;
  win_rate_pct: number | null;
  total_pnl: number;
  avg_r: number | null;
  expectancy_per_trade: number | null;
}

// Minimum trade count before an expectancy number is trusted enough
// to grade — same "don't act on n<15" threshold the audit engine's
// own MIN_TRADES_FOR_ACTIONABLE_EXPECTANCY already uses.
const MIN_TRADES_FOR_GRADE = 15;

// `tier` is a stable key for anything that needs to group/color by
// grade programmatically (e.g. the visual dashboard's pyramid) without
// re-matching against `label`'s own human-readable text, which is
// free to change independently.
export type GradeTier = 'insufficient' | 'performing' | 'promising' | 'underperforming';

export function gradeFamily(row: ExpectancyRow): { label: string; cls: string; tier: GradeTier } {
  if (row.n < MIN_TRADES_FOR_GRADE) return { label: `Insufficient evidence (n=${row.n})`, cls: 'text-gray-400', tier: 'insufficient' };
  const r = row.avg_r ?? 0;
  if (row.total_pnl > 0 && r > 0) return { label: 'Performing well', cls: 'text-emerald-500', tier: 'performing' };
  if (row.total_pnl > 0 || r > 0) return { label: 'Promising — needs more validation', cls: 'text-amber-500', tier: 'promising' };
  return { label: 'Underperforming — needs optimisation', cls: 'text-red-500', tier: 'underperforming' };
}

// ── Gradational groups for the Bots page ─────────────────────────────
// By direct request ("group the bots into gradational groups based on
// performance ... open cards for each group and move the bots into
// each"). Graded per INSTANCE (one BotConfig row = one card), from the
// same /bots/optimization-matrix rows the Optimization Matrix uses.
// Thresholds: A needs a real sample (n>=15) AND >=0.5R average; B is
// positive on both PnL and R with n>=15; C is positive but still on a
// small sample (5-14) or mixed on a large one; D is non-positive on
// both with n>=5; E is everything with fewer than 5 closed trades.
export type InstanceGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export const INSTANCE_GRADES: { grade: InstanceGrade; title: string; summary: string; accent: string }[] = [
  { grade: 'A', title: 'Grade A — Top performers', summary: '15+ trades, profitable, averaging 0.5R or better', accent: '#10b981' },
  { grade: 'B', title: 'Grade B — Performing', summary: '15+ trades, profitable with positive average R', accent: '#22c55e' },
  { grade: 'C', title: 'Grade C — Promising', summary: 'Positive so far but on a small sample, or mixed on a large one', accent: '#f59e0b' },
  { grade: 'D', title: 'Grade D — Underperforming', summary: 'Losing on both P&L and average R — needs optimisation', accent: '#ef4444' },
  { grade: 'E', title: 'Grade E — Insufficient evidence', summary: 'Fewer than 5 closed trades — too early to judge', accent: '#9ca3af' },
];

export function gradeInstance(row: ExpectancyRow | undefined): InstanceGrade {
  if (!row || row.n < 5) return 'E';
  const r = row.avg_r ?? 0;
  const pnl = row.total_pnl;
  if (row.n >= 15 && pnl > 0 && r >= 0.5) return 'A';
  if (row.n >= 15 && pnl > 0 && r > 0) return 'B';
  if (pnl > 0 || r > 0) return 'C';
  return 'D';
}

/** Recommended Bots are identified by a "_rec_" segment in bot_id —
 * the naming convention the 2026-11 recommended-bot rollout uses
 * (e.g. "bot_3_rec_btcusdt"). Kept in one place so the Bots page and
 * anything else that needs to spot them agree. */
export function isRecommendedBot(botId: string): boolean {
  return /^bot_\d+_rec_/.test(botId);
}
