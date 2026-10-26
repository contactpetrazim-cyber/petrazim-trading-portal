import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { LayoutDashboard } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import { gradeFamily, type ExpectancyRow, type GradeTier } from '../lib/botGrading';

const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#9ca3af';

// Rarest/strongest at the top, most common/least-confirmed at the
// base — the same evidence-pyramid convention
// AuditVisualDashboard's own Findings-by-Evidence-Strength funnel
// already uses, applied here to gradeFamily's real grading instead of
// a finding's evidence_level.
const TIER_META: { key: GradeTier; label: string; color: string }[] = [
  { key: 'insufficient', label: 'Insufficient Evidence', color: GRAY },
  { key: 'underperforming', label: 'Underperforming', color: RED },
  { key: 'promising', label: 'Promising', color: AMBER },
  { key: 'performing', label: 'Performing Well', color: GREEN },
];

/**
 * BotOptimizationVisualDashboard — "Can we also have a visual
 * specific dashboard for Bot Optimization Matrix also same and
 * similar" by direct request, mirroring AuditVisualDashboard's own
 * chart set (bar charts, a pie, a pyramid) applied to this page's own
 * real family/instance expectancy data and its real gradeFamily()
 * grading — not a re-derivation, imported directly so this can never
 * grade a bot differently from the table right below it.
 */
export function BotOptimizationVisualDashboard({
  familyRows, instanceRows, dark,
}: {
  familyRows: ExpectancyRow[];
  instanceRows: ExpectancyRow[];
  dark: boolean;
}) {
  const gridColor = dark ? '#1f2937' : '#e5e7eb';
  const axisColor = '#6b7280';
  const tooltipStyle = { backgroundColor: dark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 };
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const chartTitleCls = `text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`;

  if (familyRows.length === 0 && instanceRows.length === 0) return null;

  const pnlData = familyRows.map((r) => ({ name: r.bot_family ?? '', pnl: r.total_pnl }));
  const expectancyData = familyRows.map((r) => ({ name: r.bot_family ?? '', avg_r: r.avg_r ?? 0 }));
  const winLossData = familyRows.map((r) => ({ name: r.bot_family ?? '', wins: r.wins, losses: r.losses }));

  const volumeData = instanceRows
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((r, i) => ({ name: r.bot_id ?? '', value: r.n, fill: PIE_PALETTE[i % PIE_PALETTE.length] }));

  const tierCounts: Record<GradeTier, number> = { insufficient: 0, underperforming: 0, promising: 0, performing: 0 };
  familyRows.forEach((r) => { tierCounts[gradeFamily(r).tier] += 1; });
  const tierData = TIER_META.filter((t) => tierCounts[t.key] > 0).map((t) => ({ name: t.label, value: tierCounts[t.key], fill: t.color }));

  return (
    <FoldedCard title="Visual Dashboard" summary="The same real expectancy data as the tables below, charted" icon={<LayoutDashboard size={18} />} dark={dark} defaultOpen>
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

        {winLossData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Wins vs Losses by Bot Family</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={winLossData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                <YAxis stroke={axisColor} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="wins" name="Wins" stackId="w" fill={GREEN} radius={[0, 0, 0, 0]} />
                <Bar dataKey="losses" name="Losses" stackId="w" fill={RED} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {volumeData.length > 0 && (
          <div>
            <div className={chartTitleCls}>Trade Volume Share by Instance</div>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie data={volumeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {volumeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Recharts' own <Legend> was rendered as an unbounded
                wrapping block that, with 30+ instances, grew tall
                enough to sit on top of the donut itself. Folded by
                default so the chart is never obscured; the instance
                names are still a click away. */}
            <FoldedCard title="Legend" summary={`${volumeData.length} instances`} dark={dark}>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {volumeData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className={dark ? 'text-white/70' : 'text-corporate-text-on-bg'}>{d.name}</span>
                  </div>
                ))}
              </div>
            </FoldedCard>
          </div>
        )}

        {tierData.length > 0 && (
          <div className="lg:col-span-2">
            <div className={chartTitleCls}>Bot Families by Evidence Grade</div>
            <p className={`text-[11px] mb-2 ${mutedCls}`}>
              Same "don't rank by win rate alone, don't act on n&lt;15" grading as the table below — narrower, rarer bands at the top are the most confidently confirmed performers.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <FunnelChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Funnel data={tierData} dataKey="value" nameKey="name" isAnimationActive lastShapeType="rectangle">
                  <LabelList position="right" dataKey="name" fill={dark ? '#fff' : '#111827'} stroke="none" fontSize={12} />
                  <LabelList position="left" dataKey="value" fill={dark ? '#fff' : '#111827'} stroke="none" fontSize={12} />
                  {tierData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </FoldedCard>
  );
}

const PIE_PALETTE = [BLUE, GREEN, AMBER, RED, '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', GRAY];
