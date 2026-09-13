import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import PerformanceForecastPanel from '../components/PerformanceForecastPanel';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * PerformanceForecastPage — the full interactive Monte Carlo simulator
 * (pick a bot, tune trials/risk/resample mode, run it, see the fan
 * chart) that Insights' own "Performance Forecast" tile only ever
 * summarized in one number. PerformanceForecastPanel.jsx was fully
 * built and wired to a real, working backend
 * (routers/monte_carlo.py) but never mounted onto any route — by
 * direct bug report ("some features in Insights are not showing").
 */
export function PerformanceForecastPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <Link to="/insights" className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
        <ArrowLeft size={15} /> Back to Insights
      </Link>
      <PageHeader title="Performance Forecast" subtitle="Monte Carlo projection of a future set of trades, run against your own real trade history." />
      <PerformanceForecastPanel apiBaseUrl={API_URL} />
    </div>
  );
}
