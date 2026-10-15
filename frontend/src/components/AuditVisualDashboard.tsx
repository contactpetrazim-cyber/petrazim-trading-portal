import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { LayoutDashboard } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import type { InstrumentRow, BotExpectancyRow, BacktestValidationRow, Finding } from '../pages/AdminTradingAuditPage';

const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#9ca3af';

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  action: { label: 'Action', color: RED },
  watch: { label: 'Watch', color: AMBER },
  info: { label: 'Info', color: BLUE },
};

const CATEGORY_LABEL: Record<string, string> = {
  duplicate_concurrency: 'Duplicate / Concurrency',
  bot_performance: 'Bot Performance',
  execution_errors: 'Execution Errors',
  silent_bot: 'Silent Bot',
};

// Rigor order (weakest to strongest), matching the classic evidence-
// pyramid convention (narrow, rare, rigorous at the top; wide, common,
// less-rigorous at the base) — same evidence grading this audit
// methodology already uses throughout (EVIDENCE_LABEL on the page
// this mounts in).
const EVIDENCE_META: { key: string; label: string; color: string }[] = [
  { key: 'unverified', label: 'Unverified', color: GRAY },
  { key: 'hypothesis', label: 'Hypothesis', color: AMBER },
  { key: 'strongly_supported', label: 'Strongly Supported', color: BLUE },
  { key: 'verified', label: 'Verified', color: GREEN },
];

/**
 * AuditVisualDashboard — "turn the executive report into a dashboard
 * of various charts and diagrams, pie charts, pyramids - all kinds of
 * visuals" by direct request. Built directly from the SAME real,
 * already-fetched structured data (summary.*, findings) the tables
 * and the Executive Report's own markdown dump already render from —
 * not a re-parse of that markdown text, so this can never drift from
 * what the tables themselves show.
 */
export function AuditVisualDashboard({
  instrumentInventory, botFamilyExpectancy, backtestValidation, findings, dark,
}: {
  instrumentInventory: InstrumentRow[];
  botFamilyExpectancy: BotExpectancyRow[];
  backtestValidation?: BacktestValidationRow[] | null;
  findings: Finding[];
  dark: boolean;
}) {
  const gridColor = dark ? '#1f2937' : '#e5e7eb';
  const axisColor = '#6b7280';
  const tooltipStyle = { backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 };
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const chartTitleCls = `text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`;

  if (botFamilyExpectancy.length === 0 && instrumentInventory.length === 0 && findings.length === 0) return null;

  const pnlData = botFamilyExpectancy.map((r) => ({ name: r.bot_family, pnl: r.total_pnl }));
  const expectancyData = botFamilyExpectancy.map((r) => ({ name: r.bot_family, avg_r: r.avg_r ?? 0 }));
  const instrumentData = instrumentInventory.map((r) => ({ name: r.symbol, wins: r.wins, losses: r.losses }));
  const validationData = (backtestValidation ?? [])
    .filter((r) => !r.error && r.expectancy_r != null)
    .map((r) => ({ name: r.bot_family, expectancy_r: r.expectancy_r as number }));

  const severityCounts: Record<string, number> = {};
  findings.forEach((f) => { severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1; });
  const severityData = Object.entries(SEVERITY_META)
    .map(([key, meta]) => ({ key, name: meta.label, value: severityCounts[key] ?? 0, color: meta.color }))
    .filter((d) => d.value > 0);

  const categoryCounts: Record<string, number> = {};
  findings.forEach((f) => { categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1; });
  const categoryData = Object.entries(categoryCounts).map(([key, count]) => ({ name: CATEGORY_LABEL[key] ?? key, count }));

  const evidenceCounts: Record<string, number> = {};
  findings.forEach((f) => { evidenceCounts[f.evidence_level] = (evidenceCounts[f.evidence_level] ?? 0) + 1; });
  const evidenceData = EVIDENCE_META
    .filter((m) => evidenceCounts[m.key])
    .map((m) => ({ name: m.label, value: evidenceCounts[m.key], fill: m.color }));

  return (
    <FoldedCard title="Visual Dashboard" summary="The same real data as the tables below, charted" icon={<LayoutDashboard size={18} />} dark={dark} defaultOpen>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8">
        {pnlData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Bot-Family Net PnL</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={pnlData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                <YAxis stroke={axisColor} fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'PnL']} contentStyle={tooltipStyle} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {pnlData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {expectancyData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Bot-Family Avg R-Multiple</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={expectancyData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                <YAxis stroke={axisColor} fontSize={11} unit="R" />
                <Tooltip formatter={(v: number) => [`${v.toFixed(3)}R`, 'Avg R']} contentStyle={tooltipStyle} />
                <Bar dataKey="avg_r" radius={[3, 3, 0, 0]}>
                  {expectancyData.map((d, i) => <Cell key={i} fill={d.avg_r >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {instrumentData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Wins vs Losses by Instrument</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={instrumentData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={10} angle={-20} textAnchor="end" height={50} />
                <YAxis stroke={axisColor} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="wins" name="Wins" stackId="w" fill={GREEN} radius={[0, 0, 0, 0]} />
                <Bar dataKey="losses" name="Losses" stackId="w" fill={RED} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {validationData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Live Backtest Expectancy (Stage 9)</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={validationData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                <YAxis stroke={axisColor} fontSize={11} unit="R" />
                <Tooltip formatter={(v: number) => [`${v.toFixed(3)}R`, 'Expectancy']} contentStyle={tooltipStyle} />
                <Bar dataKey="expectancy_r" radius={[3, 3, 0, 0]}>
                  {validationData.map((d, i) => <Cell key={i} fill={d.expectancy_r >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {severityData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Findings by Severity</div>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {severityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {categoryData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Findings by Category</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" stroke={axisColor} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={axisColor} fontSize={11} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={BLUE} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {evidenceData.length > 0 && (
          <div className="lg:col-span-2">
            <div className={chartTitleCls}>Findings by Evidence Strength</div>
            <p className={`text-[11px] mb-2 ${mutedCls}`}>
              Same evidence grading used throughout this audit — narrower, rarer bands at the top are the most rigorously confirmed findings.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Funnel data={evidenceData} dataKey="value" nameKey="name" isAnimationActive lastShapeType="rectangle">
                  <LabelList position="right" dataKey="name" fill={dark ? '#fff' : '#111827'} stroke="none" fontSize={12} />
                  <LabelList position="left" dataKey="value" fill={dark ? '#fff' : '#111827'} stroke="none" fontSize={12} />
                  {evidenceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </FoldedCard>
  );
}
