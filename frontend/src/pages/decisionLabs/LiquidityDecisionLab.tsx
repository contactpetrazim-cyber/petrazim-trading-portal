import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Price sweeps below a well-defined prior low (real sell-side liquidity), wicking through it, then immediately shows a sharp displacement move back up.',
    choices: [
      { text: 'Read this as sweep -> displacement — the first two-thirds of a real reversal sequence, wait for CHoCH next', consequence: 'A sweep followed by real displacement is exactly the first stage of the sweep-displacement-CHoCH sequence this platform\'s own framework teaches — recognizing the pattern in progress, not just after the fact, is the actual skill.', next: 'afterSweep' },
      { text: 'Enter long immediately on the wick alone, no confirmation', consequence: 'The wick and the displacement are two of three real confirmations — entering on the wick alone, before displacement even shows, is trading a hope that the sweep will turn into the full sequence.', next: 'afterSweep', rating: 'Worth revisiting — entered before real confirmation' },
    ],
  },
  afterSweep: {
    id: 'afterSweep',
    prompt: 'Displacement continues, and price makes a genuine Change of Character — the first real higher high after the sweep.',
    choices: [
      { text: 'This completes the sequence — a real, confirmed basis to look for longs', consequence: 'Sweep, displacement, and a genuine CHoCH are the full three-part confirmation — this is the disciplined version of "the liquidity grab worked out," not a guess.', next: 'end', rating: 'Sequence read correctly, start to finish' },
      { text: 'Still wait for more confirmation — "it could still fail"', consequence: 'At some point real evidence has to be actionable — having already seen sweep, displacement, AND a genuine CHoCH, waiting for a fourth signal is hesitation past the point the framework itself calls confirmed.', next: 'end', rating: 'Worth revisiting — over-waited past real confirmation' },
    ],
  },
};

/** LiquidityDecisionLab — Core 3 (Liquidity): the sweep-displacement-CHoCH sequence. */
export function LiquidityDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Liquidity" subtitle="Walk a real sweep-displacement-CHoCH scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Liquidity" framework="the sweep-displacement-CHoCH sequence" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
