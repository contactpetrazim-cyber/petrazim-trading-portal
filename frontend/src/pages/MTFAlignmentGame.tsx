import { Layers3 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#0ea5e9';

const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: 'Daily: strong uptrend. 4H: pulling back into a discount zone. 15M: a clean bullish reversal candle forms right at that zone. What\'s the read?',
    options: [
      { label: 'High-probability long — all 3 timeframes agree', correct: true },
      { label: 'Ignore it — the 15M is too small to matter', correct: false },
    ],
    whatYoudDoDifferently: 'This is the textbook alignment: Daily gives direction, 4H gives the zone, 15M gives the trigger — all three agreeing is exactly what multi-timeframe confluence looks like.',
  },
  {
    id: '2',
    prompt: 'Daily: ranging, no clear direction. 4H: also ranging. 15M: a sharp breakout candle. Trade it full size?',
    options: [
      { label: 'No, or size down hard — no higher-timeframe direction to lean on', correct: true },
      { label: 'Yes, full size — the 15M breakout is what matters most', correct: false },
    ],
    whatYoudDoDifferently: 'With both higher timeframes ranging, a lower-timeframe breakout has no real backing — it\'s just as likely to be a fakeout inside the range as a genuine move.',
  },
  {
    id: '3',
    prompt: '1D is bullish. 4H just broke structure to the downside (a real close below the prior swing low). 15M shows a bullish setup. What now?',
    options: [
      { label: 'Treat the 4H BOS as the more current, more relevant read — be cautious on longs', correct: true },
      { label: 'Trust the Daily blindly and take the 15M long anyway', correct: false },
    ],
    whatYoudDoDifferently: 'A genuine structure break on a CLOSER timeframe (4H) is a real update to the picture, not something to override just because a slower timeframe (Daily) hasn\'t caught up yet.',
  },
  {
    id: '4',
    prompt: 'You want to enter with the 1H trend. Where should your ENTRY trigger normally come from?',
    options: [
      { label: 'A lower timeframe (5M/15M) — for a tighter, more precise entry', correct: true },
      { label: 'The same 1H chart — no need to zoom in', correct: false },
    ],
    whatYoudDoDifferently: 'The standard top-down approach uses a higher timeframe for BIAS and a lower one for the actual TRIGGER — entering on the same chart you got direction from usually means a worse entry price and a wider stop than necessary.',
  },
  {
    id: '5',
    prompt: 'You\'re already in a long, holding for the 4H target. The 15M chart is choppy and keeps almost stopping you out.',
    options: [
      { label: 'Stop watching the 15M — it\'s noise relative to your actual (4H) trade thesis', correct: true },
      { label: 'Exit early because the 15M looks bad', correct: false },
    ],
    whatYoudDoDifferently: 'A trade taken on a higher-timeframe thesis shouldn\'t be managed off a much lower timeframe\'s noise — that mismatch is a common way to exit a genuinely good trade too early.',
  },
];

/** MTFAlignmentGame — Section 10a's game for Multi-Timeframe Analysis. */
export function MTFAlignmentGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="MTF Alignment" subtitle="Read the higher-timeframe picture correctly before the clock runs out." />
      <TriageGameEngine
        gameId="mtf-alignment" title="MTF Alignment" icon={<Layers3 size={16} />} accent={ACCENT}
        scenarios={SCENARIOS} secondsPerQuestion={22} baseXp={20} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
