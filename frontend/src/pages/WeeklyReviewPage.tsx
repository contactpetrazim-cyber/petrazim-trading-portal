import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import WeeklyReviewPanel from '../components/WeeklyReviewPanel';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * WeeklyReviewPage — the full coach debrief (every trade taken that
 * week graded on process, missed opportunities, psychology
 * correlation) that Insights' own "This week" tile only ever
 * summarized as a trade count. See PerformanceForecastPage.tsx's own
 * docstring for why this page exists now (was built, never mounted).
 */
export function WeeklyReviewPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <Link to="/insights" className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
        <ArrowLeft size={15} /> Back to Insights
      </Link>
      <PageHeader title="Weekly Review" subtitle="Coach debrief — trades taken, missed opportunities, and a psychology review, for the week you pick." />
      <WeeklyReviewPanel apiBaseUrl={API_URL} />
    </div>
  );
}
