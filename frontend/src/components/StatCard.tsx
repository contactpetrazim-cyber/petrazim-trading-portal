
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color?: string;
  /** Unused by the card's own colors now (see below) — kept only so
   * existing call sites that pass the surrounding page's dark/light
   * state don't need to change. */
  dark?: boolean;
}

/**
 * StatCard — this went through three requests before landing here:
 * (1) make the value black, (2) make every line of text black, (3)
 * "all texts in the coloured cards should be black" with no theme
 * condition at all. The first two passes kept text color tied to the
 * page's own dark/light toggle (`dark ? white : gray-900`), which is
 * exactly why it kept reading as unfixed — the trader console's
 * default IS dark, so the text kept rendering white again there.
 *
 * Fix: the card itself is now always a solid, light tinted surface
 * (not a translucent overlay on top of whatever's behind it), and
 * every line of text is unconditionally black. That's what makes
 * "always black" actually true regardless of the site's light/dark
 * toggle — a translucent tint over a dark page background would still
 * make black text unreadable, so the fix has to be the card's own
 * background, not just the text color.
 */
export function StatCard({ title, value, subtitle, trend, trendValue, icon, color = 'blue' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-emerald-50 border-emerald-200',
    red: 'bg-red-50 border-red-200',
    amber: 'bg-amber-50 border-amber-200',
    purple: 'bg-purple-50 border-purple-200',
  };
  const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
          {subtitle && <p className="text-xs mt-1 text-gray-900">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${iconColorMap[color]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          {trend === 'up' && <TrendingUp size={14} className="text-emerald-600" />}
          {trend === 'down' && <TrendingDown size={14} className="text-red-600" />}
          {trend === 'neutral' && <Minus size={14} className="text-gray-500" />}
          <span className="text-gray-900">{trendValue}</span>
        </div>
      )}
    </div>
  );
}
