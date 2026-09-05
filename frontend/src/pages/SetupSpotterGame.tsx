import { Target } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#0891b2';

const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: 'Price sweeps the previous day\'s low, wicks below it, then closes back above it on the same candle. What is this?',
    options: [
      { label: 'A genuine liquidity sweep — stops run, reversal likely', correct: true },
      { label: 'A confirmed breakdown — continue lower', correct: false },
    ],
    whatYoudDoDifferently: 'A wick through a level that closes back above it is a stop-hunt, not a breakdown — the close is what confirms direction, not the wick.',
  },
  {
    id: '2',
    prompt: 'A 3-candle sequence leaves a gap between candle 1\'s high and candle 3\'s low, with no overlap. Price returns to fill it. Valid FVG entry zone?',
    options: [
      { label: 'Yes — a real imbalance the market is likely to react to', correct: true },
      { label: 'No — gaps only matter on daily charts', correct: false },
    ],
    whatYoudDoDifferently: 'A Fair Value Gap is a real structural imbalance on any timeframe where volume/orders were thin — it isn\'t exclusive to higher timeframes.',
  },
  {
    id: '3',
    prompt: 'Price is trading in the upper 20% of a clearly defined range (premium zone) and a fresh bearish order block just formed there. What\'s the higher-probability read?',
    options: [
      { label: 'Look for shorts — premium + bearish OB aligns', correct: true },
      { label: 'Buy the breakout — premium means momentum is building up', correct: false },
    ],
    whatYoudDoDifferently: 'Premium/discount tells you where price is "expensive" relative to the range — premium favors looking for shorts, not chasing longs into it.',
  },
  {
    id: '4',
    prompt: 'The 15M shows a clean bullish structure, but the 4H and 1D are both in a clear downtrend making lower highs. A 15M long setup appears. Take it?',
    options: [
      { label: 'Skip it, or size down hard — fighting higher-timeframe structure', correct: true },
      { label: 'Take it full size — the 15M setup is clean', correct: false },
    ],
    whatYoudDoDifferently: 'A clean lower-timeframe setup against the higher-timeframe trend is a lower-probability counter-trend trade — multi-timeframe alignment matters more than any single chart looking clean.',
  },
  {
    id: '5',
    prompt: 'An order block formed 6 weeks ago and price is only now, for the first time, returning to test it. Still valid?',
    options: [
      { label: 'Yes, if it hasn\'t been mitigated (tested and broken through) yet', correct: true },
      { label: 'No — order blocks expire after a few days', correct: false },
    ],
    whatYoudDoDifferently: 'An order block stays valid until it\'s actually mitigated (price trades through it), not on a fixed time expiry — age alone doesn\'t invalidate it.',
  },
];

/**
 * SetupSpotterGame — Section 10a's game for Market Structure / Order
 * Flow. Classify a described price scenario as a valid SMC read or a
 * common misread, under a countdown. See TriageGameEngine's own
 * docstring for the honest scope note on how many of the 10 games
 * this pattern currently covers.
 */
export function SetupSpotterGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Setup Spotter" subtitle="Classify each scenario correctly before the clock runs out." />
      <TriageGameEngine
        gameId="setup-spotter" title="Setup Spotter" icon={<Target size={16} />} accent={ACCENT}
        scenarios={SCENARIOS} secondsPerQuestion={20} baseXp={20} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
