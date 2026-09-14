import { Settings2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { CandleChart } from '../components/CandleChart';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#14b8a6';

// Scenario 3 (a news-event timing decision) has no price shape to
// draw, so it's left as text — every other scenario here describes a
// concrete position/price state and gets a chart.
const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: 'Your long is up 1R and still has room to your target. Price hasn\'t hit any major level yet.',
    options: [
      { label: 'Move stop to break-even, let the rest run to target', correct: true },
      { label: 'Close the whole position now to bank the 1R', correct: false },
      { label: 'Widen the stop "just in case" it pulls back', correct: false },
    ],
    whatYoudDoDifferently: 'Moving to break-even at 1R (a common, disciplined rule) removes the risk of the trade turning into a loser while still leaving room for the full target — closing everything early gives up the reason you took the trade.',
    chart: (dark) => (
      <CandleChart
        dark={dark} height={160}
        candles={[
          { open: 100, high: 102, low: 99, close: 101 },
          { open: 101, high: 104, low: 100, close: 103 },
          { open: 103, high: 106, low: 102, close: 105 },
          { open: 105, high: 108, low: 104, close: 107 },
        ]}
        lines={[{ price: 110, label: 'target', color: '#22c55e', dashed: true }]}
        markers={[
          { index: 0, price: 99, label: 'entry', color: '#6b7280', side: 'below' },
          { index: 3, price: 108, label: '+1R now', color: '#22c55e', side: 'above' },
        ]}
      />
    ),
  },
  {
    id: '2',
    prompt: 'Price is approaching your take-profit level, which sits right at a well-known resistance zone.',
    options: [
      { label: 'Take partial profit there, trail the remainder', correct: true },
      { label: 'Hold the full position through it, no plan for what happens after', correct: false },
    ],
    whatYoudDoDifferently: 'A known resistance level is exactly where price is statistically more likely to react — banking part of the position there while giving the rest room to run is the standard way to handle it, not holding blind.',
    chart: (dark) => (
      <CandleChart
        dark={dark} height={160}
        candles={[
          { open: 100, high: 102, low: 99, close: 101 },
          { open: 101, high: 104, low: 100, close: 103 },
          { open: 103, high: 106, low: 102, close: 105 },
          { open: 105, high: 109, low: 104, close: 108 },
        ]}
        zones={[{ fromIndex: 0, toIndex: 3, priceTop: 112, priceBottom: 108, color: '#ef4444', label: 'resistance / TP' }]}
      />
    ),
  },
  {
    id: '3',
    prompt: 'Your trade is at breakeven+, and a high-impact news release is 10 minutes away.',
    options: [
      { label: 'Reduce size or close ahead of the event — protect what you have', correct: true },
      { label: 'Add to the position right before the news for a bigger move', correct: false },
    ],
    whatYoudDoDifferently: 'Adding risk right before a known volatility spike, on a trade that\'s already working, risks turning a good outcome into a bad one for no real edge — reducing exposure into known volatility is the safer default.',
  },
  {
    id: '4',
    prompt: 'Your trade has been open for your system\'s normal max hold time with no real movement either way — dead, sideways price action.',
    options: [
      { label: 'Consider closing it — capital and focus tied up for no progress', correct: true },
      { label: 'Leave it open indefinitely, no time-based plan', correct: false },
    ],
    whatYoudDoDifferently: 'A trade that stops behaving the way its setup expected (going nowhere well past a normal hold time) is itself information — a time-based exit rule exists for exactly this, not just a price-based stop.',
    chart: (dark) => (
      <CandleChart
        dark={dark} height={160}
        candles={[
          { open: 100, high: 102, low: 98, close: 101 },
          { open: 101, high: 103, low: 99, close: 100 },
          { open: 100, high: 102, low: 98, close: 101 },
          { open: 101, high: 103, low: 99, close: 100 },
          { open: 100, high: 102, low: 98, close: 101 },
          { open: 101, high: 103, low: 99, close: 100 },
        ]}
        lines={[{ price: 100.5, label: 'no net progress', color: '#6b7280', dashed: true }]}
      />
    ),
  },
  {
    id: '5',
    prompt: 'Price hits your stop loss exactly. It was a clean, valid setup that simply didn\'t work out.',
    options: [
      { label: 'Take the loss as planned, log it, move on', correct: true },
      { label: 'Move the stop further out to avoid taking the loss', correct: false },
    ],
    whatYoudDoDifferently: 'Moving a stop after price already reaches it turns a planned, sized risk into an unplanned, unsized one — the stop\'s entire job is to be honored exactly when it\'s uncomfortable to do so.',
    chart: (dark) => (
      <CandleChart
        dark={dark} height={160}
        candles={[
          { open: 108, high: 109, low: 105, close: 106 },
          { open: 106, high: 107, low: 102, close: 103 },
          { open: 103, high: 104, low: 99, close: 100 },
          { open: 100, high: 101, low: 97, close: 98 },
        ]}
        lines={[{ price: 97, label: 'stop loss', color: '#ef4444', dashed: true }]}
        markers={[{ index: 3, price: 97, label: 'stop hit — take the loss', color: '#ef4444', side: 'below' }]}
      />
    ),
  },
];

/** TradeManagementGame — Section 10a's game for Trade Management. */
export function TradeManagementGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Trade Management" subtitle="Manage the open position correctly before the clock runs out." />
      <TriageGameEngine
        gameId="trade-management" title="Trade Management" icon={<Settings2 size={16} />} accent={ACCENT}
        scenarios={SCENARIOS} secondsPerQuestion={22} baseXp={20} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
