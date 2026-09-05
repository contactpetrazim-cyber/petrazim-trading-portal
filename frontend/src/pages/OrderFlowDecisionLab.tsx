import { PageHeader } from '../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../components/DecisionLabEngine';
import { useThemeStore } from '../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Watching the tape (time & sales) on the Order Flow Chart tool: price approaches a known resistance level and prints a burst of large trades tagged as buyer-aggressor (isBuyerMaker=false — takers hitting the ask).',
    choices: [
      { text: 'Watch delta at that level — does buying pressure actually push price through, or does it stall?', consequence: 'Aggressive buying alone doesn\'t confirm a breakout — whether price actually moves through resistance despite that buying is the real tell (absorption vs. genuine strength).', next: 'afterWatch' },
      { text: 'Buy immediately — aggressive buyers are stepping in', consequence: 'Aggressive buying INTO a known resistance level is exactly where it can get absorbed by resting sell orders — reacting to the print alone, without watching what price does next, skips the actual confirmation.', next: 'afterWatch', rating: 'Worth revisiting — reacted to one print, not the outcome' },
    ],
  },
  afterWatch: {
    id: 'afterWatch',
    prompt: 'Despite the aggressive buying, price stalls right at the level and starts printing large sell-aggressor trades — the buying got absorbed.',
    choices: [
      { text: 'Read this as absorption — resistance likely holds, look for shorts instead', consequence: 'Aggressive buying that fails to move price, followed by aggressive selling at the same level, is the textbook read for absorption — the level held despite real demand showing up.', next: 'end', rating: 'Order flow read correctly' },
      { text: 'Keep expecting the breakout — "the buyers will come back"', consequence: 'What the tape actually showed (absorption, not follow-through) is more informative right now than what might happen later — trading the read you have, not the one you\'re hoping for, is the actual skill here.', next: 'end', rating: 'Worth revisiting — traded a hope, not the tape' },
    ],
  },
};

/**
 * OrderFlowDecisionLab — Decision Lab for Order Flow Trading, grounded
 * in this platform's own real order-flow vocabulary (isBuyerMaker,
 * absorption, delta) — the same real data the Order Flow Chart tool
 * (GET /order-flow/trades) actually shows, not an invented reading.
 */
export function OrderFlowDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Order Flow Trading" subtitle="Walk a real tape-reading scenario at your own pace. No timer, no score." />
      <DecisionLabEngine
        title="Order Flow Trading" framework="reading absorption on the tape"
        startId="start" nodes={NODES} backHref="/learn" dark={dark}
      />
    </div>
  );
}
