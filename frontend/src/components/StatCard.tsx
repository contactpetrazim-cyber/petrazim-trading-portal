
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color?: string;
  /** Trade-console pages are always dark regardless of the site
   * toggle by default; pass true only where this card renders on a
   * light background (e.g. the Trade portal's own light mode). */
  dark?: boolean;
}

export function StatCard({ title, value, subtitle, trend, trendValue, icon, color = 'blue', dark = true }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-emerald-500/10 border-emerald-500/20',
    red: 'bg-red-500/10 border-red-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  };
  const labelColorMap: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-emerald-400', red: 'text-red-400',
    amber: 'text-amber-400', purple: 'text-purple-400',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${labelColorMap[color]}`}>{title}</p>
          {/* The big number is the one thing on this card that must
           * always be legible at a glance — explicit black/white
           * rather than inheriting the card's own (lighter, harder to
           * read) accent color, by direct request. */}
          <p className={`text-2xl font-bold mt-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${labelColorMap[color]} ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          {trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
          {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
          {trend === 'neutral' && <Minus size={14} className="text-gray-400" />}
          <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
