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
