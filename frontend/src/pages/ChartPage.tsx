import { ChartWithPairs } from '../components/ChartWithPairs';
import { useThemeStore } from '../hooks/useTheme';

/**
 * ChartPage — live chart with the shared "Pairs" quick-links (folded by
 * default, in the chart toolbar next to Order), replacing the old row
 * of four hardcoded symbol pills above the chart. Any pair you add from
 * the search on any chart shows up here too, and the chart always
 * renders exactly the pair you picked.
 */
export function ChartPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  return (
    <div className={`h-[calc(100vh-5rem)] flex flex-col ${dark ? 'bg-smc-dark' : 'bg-corporate-bg'}`}>
      <div className="flex-1 overflow-y-auto p-3">
        <ChartWithPairs interval="60" height={640} dark={dark} />
      </div>
    </div>
  );
}
