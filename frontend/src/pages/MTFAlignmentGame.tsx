import { Layers3 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { TimeframePanels } from '../components/TimeframePanels';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#0ea5e9';

// MTF Alignment's whole premise — reading several timeframes at once —
// is the single hardest thing to just picture from words, since each
// scenario describes 2-3 separate charts simultaneously. Every
// scenario gets a TimeframePanels chart for that reason.
const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: 'Daily: strong uptrend. 4H: pulling back into a discount zone. 15M: a clean bullish reversal candle forms right at that zone. What\'s the read?',
    options: [
      { label: 'High-probability long — all 3 timeframes agree', correct: true },
      { label: 'Ignore it — the 15M is too small to matter', correct: false },
    ],
    whatYoudDoDifferently: 'This is the textbook alignment: Daily gives direction, 4H gives the zone, 15M gives the trigger — all three agreeing is exactly what multi-timeframe confluence looks like.',
    chart: (dark) => (
      <TimeframePanels
        dark={dark}
        panels={[
          { label: 'Daily — strong uptrend', candles: [
            { open: 100, high: 102, low: 99, close: 101 },
            { open: 101, high: 104, low: 100, close: 103 },
            { open: 103, high: 107, low: 102, close: 106 },
            { open: 106, high: 110, low: 105, close: 109 },
            { open: 109, high: 114, low: 108, close: 113 },
            { open: 113, high: 118, low: 112, close: 117 },
          ] },
          { label: '4H — pulling into discount', candles: [
            { open: 100, high: 103, low: 99, close: 102 },
            { open: 102, high: 106, low: 101, close: 105 },
            { open: 105, high: 109, low: 104, close: 108 },
            { open: 108, high: 109, low: 103, close: 104 },
            { open: 104, high: 105, low: 99, close: 100 },
            { open: 100, high: 101, low: 96, close: 97 },
          ], zones: [{ fromIndex: 3, toIndex: 5, priceTop: 104, priceBottom: 96, color: '#22c55e', label: 'discount' }] },
          { label: '15M — bullish reversal candle', candles: [
            { open: 100, high: 101, low: 98, close: 99 },
            { open: 99, high: 100, low: 96, close: 97 },
            { open: 97, high: 98, low: 94, close: 95 },
            { open: 95, high: 96, low: 92, close: 93 },
            { open: 93, high: 101, low: 91, close: 100 },
          ], markers: [{ index: 4, price: 91, label: 'reversal candle', color: '#22c55e', side: 'below' }] },
        ]}
      />
    ),
  },
  {
    id: '2',
    prompt: 'Daily: ranging, no clear direction. 4H: also ranging. 15M: a sharp breakout candle. Trade it full size?',
    options: [
      { label: 'No, or size down hard — no higher-timeframe direction to lean on', correct: true },
      { label: 'Yes, full size — the 15M breakout is what matters most', correct: false },
    ],
    whatYoudDoDifferently: 'With both higher timeframes ranging, a lower-timeframe breakout has no real backing — it\'s just as likely to be a fakeout inside the range as a genuine move.',
    chart: (dark) => (
      <TimeframePanels
        dark={dark}
        panels={[
          { label: 'Daily — ranging', candles: [
            { open: 103, high: 105, low: 102, close: 104 },
            { open: 104, high: 105, low: 102, close: 103 },
            { open: 103, high: 105, low: 102, close: 104 },
            { open: 104, high: 105, low: 102, close: 103 },
            { open: 103, high: 105, low: 102, close: 104 },
            { open: 104, high: 105, low: 102, close: 103 },
          ] },
          { label: '4H — ranging', candles: [
            { open: 100, high: 102, low: 99, close: 101 },
            { open: 101, high: 102, low: 99, close: 100 },
            { open: 100, high: 102, low: 99, close: 101 },
            { open: 101, high: 102, low: 99, close: 100 },
            { open: 100, high: 102, low: 99, close: 101 },
            { open: 101, high: 102, low: 99, close: 100 },
          ] },
          { label: '15M — sharp breakout', candles: [
            { open: 100, high: 101, low: 98, close: 99 },
            { open: 99, high: 101, low: 97, close: 100 },
            { open: 100, high: 101, low: 98, close: 99 },
            { open: 99, high: 108, low: 98, close: 107 },
          ], markers: [{ index: 3, price: 108, label: 'breakout candle', color: '#0ea5e9', side: 'above' }] },
        ]}
      />
    ),
  },
  {
    id: '3',
    prompt: '1D is bullish. 4H just broke structure to the downside (a real close below the prior swing low). 15M shows a bullish setup. What now?',
    options: [
      { label: 'Treat the 4H BOS as the more current, more relevant read — be cautious on longs', correct: true },
      { label: 'Trust the Daily blindly and take the 15M long anyway', correct: false },
    ],
    whatYoudDoDifferently: 'A genuine structure break on a CLOSER timeframe (4H) is a real update to the picture, not something to override just because a slower timeframe (Daily) hasn\'t caught up yet.',
    chart: (dark) => (
      <TimeframePanels
        dark={dark}
        panels={[
          { label: '1D — bullish', candles: [
            { open: 100, high: 103, low: 99, close: 102 },
            { open: 102, high: 105, low: 101, close: 104 },
            { open: 104, high: 108, low: 103, close: 107 },
            { open: 107, high: 111, low: 106, close: 110 },
            { open: 110, high: 114, low: 109, close: 113 },
          ] },
          { label: '4H — BOS down', candles: [
            { open: 100, high: 104, low: 99, close: 103 },
            { open: 103, high: 106, low: 102, close: 105 },
            { open: 105, high: 106, low: 99, close: 100 },
            { open: 100, high: 101, low: 95, close: 96 },
          ], lines: [{ price: 99, label: 'prior swing low', color: '#ef4444', dashed: true }],
            markers: [{ index: 3, price: 96, label: 'closes below', color: '#ef4444', side: 'below' }] },
          { label: '15M — bullish setup', candles: [
            { open: 95, high: 97, low: 93, close: 94 },
            { open: 94, high: 96, low: 92, close: 93 },
            { open: 93, high: 99, low: 92, close: 98 },
          ], markers: [{ index: 2, price: 99, label: 'bullish setup', color: '#22c55e', side: 'above' }] },
        ]}
      />
    ),
  },
  {
    id: '4',
    prompt: 'You want to enter with the 1H trend. Where should your ENTRY trigger normally come from?',
    options: [
      { label: 'A lower timeframe (5M/15M) — for a tighter, more precise entry', correct: true },
      { label: 'The same 1H chart — no need to zoom in', correct: false },
    ],
    whatYoudDoDifferently: 'The standard top-down approach uses a higher timeframe for BIAS and a lower one for the actual TRIGGER — entering on the same chart you got direction from usually means a worse entry price and a wider stop than necessary.',
    chart: (dark) => (
      <TimeframePanels
        dark={dark}
        panels={[
          { label: '1H — bias (uptrend)', candles: [
            { open: 100, high: 103, low: 99, close: 102 },
            { open: 102, high: 105, low: 101, close: 104 },
            { open: 104, high: 108, low: 103, close: 107 },
            { open: 107, high: 111, low: 106, close: 110 },
            { open: 110, high: 114, low: 109, close: 113 },
          ] },
          { label: '5M/15M — trigger', candles: [
            { open: 110, high: 111, low: 107, close: 108 },
            { open: 108, high: 109, low: 104, close: 105 },
            { open: 105, high: 111, low: 103, close: 110 },
          ], markers: [{ index: 2, price: 103, label: 'tighter entry here', color: '#22c55e', side: 'below' }] },
        ]}
      />
    ),
  },
  {
    id: '5',
    prompt: 'You\'re already in a long, holding for the 4H target. The 15M chart is choppy and keeps almost stopping you out.',
    options: [
      { label: 'Stop watching the 15M — it\'s noise relative to your actual (4H) trade thesis', correct: true },
      { label: 'Exit early because the 15M looks bad', correct: false },
    ],
    whatYoudDoDifferently: 'A trade taken on a higher-timeframe thesis shouldn\'t be managed off a much lower timeframe\'s noise — that mismatch is a common way to exit a genuinely good trade too early.',
    chart: (dark) => (
      <TimeframePanels
        dark={dark}
        panels={[
          { label: '4H — clean trade thesis', candles: [
            { open: 100, high: 103, low: 99, close: 102 },
            { open: 102, high: 105, low: 101, close: 104 },
            { open: 104, high: 108, low: 103, close: 107 },
            { open: 107, high: 111, low: 106, close: 110 },
            { open: 110, high: 114, low: 109, close: 113 },
          ] },
          { label: '15M — choppy noise', candles: [
            { open: 112, high: 113, low: 109, close: 110 },
            { open: 110, high: 112, low: 108, close: 111 },
            { open: 111, high: 113, low: 107, close: 108 },
            { open: 108, high: 110, low: 105, close: 106 },
            { open: 106, high: 109, low: 105, close: 108 },
          ], lines: [{ price: 105, label: 'your stop', color: '#ef4444', dashed: true }] },
        ]}
      />
    ),
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
