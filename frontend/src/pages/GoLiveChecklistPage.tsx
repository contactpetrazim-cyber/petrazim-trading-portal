import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import GoLiveChecklistPanel from '../components/GoLiveChecklistPanel';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * GoLiveChecklistPage — the full validation gate (every automated
 * check's own detail text, plus signed attestation submission for the
 * three manual safety checks) that Insights' own "Go-Live Checklist"
 * tile only ever summarized as "N/M passed". See
 * PerformanceForecastPage.tsx's own docstring for why this page
 * exists now (was built, never mounted).
 */
export function GoLiveChecklistPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <Link to="/insights" className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
        <ArrowLeft size={15} /> Back to Insights
      </Link>
      <PageHeader title="Go-Live Checklist" subtitle="Validation gate status before any bot goes autonomous — every check, and sign-off for the ones that need a human." />
      <GoLiveChecklistPanel apiBaseUrl={API_URL} />
    </div>
  );
}
