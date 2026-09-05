import { Brain } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#8b5cf6';

const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: '"That setup just cost me 2R. The market owes me — I\'m taking the next thing that looks half-decent, bigger size, to get it back."',
    options: [
      { label: 'Revenge trading', correct: true },
      { label: 'Confirmation bias', correct: false },
      { label: 'FOMO', correct: false },
      { label: 'Overconfidence', correct: false },
    ],
    whatYoudDoDifferently: 'Sizing up specifically to "get back" a loss, on a lower-conviction setup, is the textbook shape of revenge trading — the fix is a mandatory cool-off after a loss, not a bigger next bet.',
  },
  {
    id: '2',
    prompt: '"I already think this pair is going up. Every article I read today somehow confirms it — I\'m ignoring the ones that don\'t."',
    options: [
      { label: 'Confirmation bias', correct: true },
      { label: 'Loss aversion', correct: false },
      { label: 'Recency bias', correct: false },
      { label: 'Sunk cost fallacy', correct: false },
    ],
    whatYoudDoDifferently: 'Selectively noticing information that agrees with a belief already held, while discounting what doesn\'t, is confirmation bias — the fix is deliberately seeking out the disconfirming case before entering.',
  },
  {
    id: '3',
    prompt: '"This trade is down 4R now — way past my stop. But I\'ve already lost this much, so I might as well hold and see if it comes back rather than take the loss now."',
    options: [
      { label: 'Sunk cost fallacy', correct: true },
      { label: 'FOMO', correct: false },
      { label: 'Anchoring', correct: false },
      { label: 'Herding', correct: false },
    ],
    whatYoudDoDifferently: '"I\'ve already lost this much, might as well hold" treats a past loss as a reason to take on MORE risk — the original stop-loss level, not the size of the loss so far, is what should decide the exit.',
  },
  {
    id: '4',
    prompt: '"I missed the first move up by 20 pips. It\'s still climbing. I\'m jumping in now at market, no real plan, before it gets away completely."',
    options: [
      { label: 'FOMO (fear of missing out)', correct: true },
      { label: 'Overconfidence', correct: false },
      { label: 'Confirmation bias', correct: false },
      { label: 'Anchoring', correct: false },
    ],
    whatYoudDoDifferently: 'Entering with no plan purely because a move is "getting away" is FOMO — chasing an extended move without a real setup usually means buying near the top of that leg.',
  },
  {
    id: '5',
    prompt: '"I\'ve won my last 6 trades in a row. I\'m certain the next one works too, so I\'m skipping my usual checklist and doubling my normal size."',
    options: [
      { label: 'Overconfidence (hot-hand fallacy)', correct: true },
      { label: 'Loss aversion', correct: false },
      { label: 'Sunk cost fallacy', correct: false },
      { label: 'Revenge trading', correct: false },
    ],
    whatYoudDoDifferently: 'A winning streak doesn\'t change the odds of the next trade — skipping the checklist and sizing up because of recent wins is overconfidence, and it\'s usually where a streak gives back its gains.',
  },
];

/** BiasCheckGame — Section 10a's game for Trading Psychology. */
export function BiasCheckGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Bias Check" subtitle="Name the psychological trap before the clock runs out." />
      <TriageGameEngine
        gameId="bias-check" title="Bias Check" icon={<Brain size={16} />} accent={ACCENT}
        scenarios={SCENARIOS} secondsPerQuestion={20} baseXp={20} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
