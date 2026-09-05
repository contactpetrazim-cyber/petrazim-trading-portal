import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { OrderFlowChartTool } from './OrderFlowChartTool';
import { useThemeStore } from '../hooks/useTheme';

/**
 * OrderFlowFullPage — the Order Flow Chart, maximized to its own page
 * instead of a FoldedCard section on ToolsPage constrained to that
 * grid's column width, by direct request ("make the Order flow chart
 * load on a new page so that we can maximise chart area ... whenever
 * triggered open a new page ... with option to return to default card
 * window and close"). Same OrderFlowChartTool component either way —
 * this page doesn't fork the chart, just gives it the whole viewport
 * width and a way back to the folded card on /tools.
 */
export function OrderFlowFullPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Link
          to="/tools"
          className={`flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
        >
          <ArrowLeft size={15} /> Back to Tools
        </Link>
        <Link
          to="/tools"
          aria-label="Close full-page chart"
          title="Close"
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'text-white/40 hover:bg-white/10' : 'text-gray-400 hover:bg-corporate-bg'}`}
        >
          <X size={16} />
        </Link>
      </div>
      <PageHeader title="Order Flow Chart" subtitle="Free — live tape, delta, and order book, from real crypto market data." />
      <OrderFlowChartTool />
    </div>
  );
}
