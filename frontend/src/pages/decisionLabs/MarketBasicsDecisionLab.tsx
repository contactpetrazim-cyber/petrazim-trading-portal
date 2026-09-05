import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'You\'re about to place a trade. The pair quotes bid 1.0842 / ask 1.0845 — a 3-pip spread, wider than this pair\'s usual 0.8-pip spread.',
    choices: [
      { text: 'Check why — this often means low liquidity or a news event approaching', consequence: 'A spread suddenly widening well past normal is real information about current liquidity conditions, not just a cost to shrug off.', next: 'afterCheck' },
      { text: 'Ignore it — a spread is just a small fixed cost', consequence: 'Treating an abnormally wide spread as routine skips exactly the signal it\'s giving you: liquidity has thinned, which changes how reliable price action is right now.', next: 'afterCheck', rating: 'Worth revisiting — missed what the wide spread was signaling' },
    ],
  },
  afterCheck: {
    id: 'afterCheck',
    prompt: 'You find a high-impact news release for this currency is due in 4 minutes.',
    choices: [
      { text: 'Wait until after the release and spread normalizes before entering', consequence: 'Entering into a known volatility spike, at a widened spread, stacks two real disadvantages onto the trade at once — waiting removes both.', next: 'end', rating: 'Sound read of market conditions' },
      { text: 'Enter now anyway — the setup still looks good', consequence: 'The setup\'s quality doesn\'t change the fact that entering right into a news spike, at 3x normal spread, is a materially worse execution than the same setup minutes later.', next: 'end', rating: 'Worth revisiting — setup quality isn\'t the only variable' },
    ],
  },
};

/** MarketBasicsDecisionLab — Core 1 (Market Basics): reading spread as real information. */
export function MarketBasicsDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Market Basics" subtitle="Walk a real spread-and-liquidity scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Market Basics" framework="reading spread as a liquidity signal" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
