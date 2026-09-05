import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'The real Scenario Challenge from Bot 2\'s own curriculum: a trader holds a Bot 2 position for a week the way they would a Bot 1 signal, reasoning "they\'re both SMC bots."',
    choices: [
      { text: 'That\'s a real risk-parameter mismatch — Bot 2 is a reversal specialist (4H/1H/15M), Bot 1 is continuation (1D/4H)', consequence: 'Bot 2 trades price returning INSIDE an HTF order block expecting a turn there — a fundamentally different, typically shorter-horizon trade than Bot 1\'s longer HTF-continuation hold, even though both are genuinely SMC bots.', next: 'afterRead' },
      { text: '"They\'re both SMC bots" is close enough reasoning — treat them the same', consequence: 'This is the exact misapplication the curriculum\'s own Scenario Challenge is testing — "same category" doesn\'t mean "same risk parameters, same hold time, same expected behavior."', next: 'afterRead', rating: 'Worth revisiting — treated two different bot philosophies as interchangeable' },
    ],
  },
  afterRead: {
    id: 'afterRead',
    prompt: 'Bot 2 is configured with a default reward-to-risk of 3.0 for its target calculation. A trade is 1.5R in profit and still short of its 3R target, but has stalled for two days.',
    choices: [
      { text: 'Respect Bot 2\'s own shorter, reversal-trade horizon — consider managing it actively rather than assuming a Bot 1-style long hold', consequence: 'Knowing Bot 2\'s real configured behavior (reversal, not continuation) means a stall reads differently than it would on a Bot 1 position — active management fits its actual philosophy better than passive holding.', next: 'end', rating: 'Correctly applied Bot 2\'s own real configuration' },
      { text: 'Leave it exactly as-is indefinitely, assuming it\'ll behave like a Bot 1 continuation trade eventually', consequence: 'This repeats the original mismatch — expecting Bot 2 to behave like Bot 1 despite them having genuinely different real risk parameters and philosophies.', next: 'end', rating: 'Worth revisiting — repeated the Bot 1/Bot 2 mismatch' },
    ],
  },
};

/** Bot2DecisionLab — Bot 2 (Order Block Reversal), adapted from its own real Scenario Challenge. */
export function Bot2DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 2: Order Block Reversal" subtitle="Walk the real Bot 1 vs Bot 2 mismatch scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Bot 2 — Order Block Reversal" framework="Bot 2's own reversal philosophy vs. Bot 1's continuation philosophy" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
