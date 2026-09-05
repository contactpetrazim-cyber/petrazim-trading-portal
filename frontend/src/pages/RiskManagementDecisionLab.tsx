import { PageHeader } from '../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../components/DecisionLabEngine';
import { useThemeStore } from '../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'You\'re trading a $10,000 funded account with a 5% daily loss limit and a 10% total drawdown limit. It\'s Tuesday, you\'re flat for the week, and a clean setup just formed on your main pair.',
    choices: [
      { text: 'Risk 1% (your normal size) and take it', consequence: 'A disciplined, repeatable size — the trade\'s outcome doesn\'t change whether this was the right call.', next: 'afterEntry' },
      { text: 'Risk 3% — it looks unusually clean, worth sizing up', consequence: 'Sizing up on a "feeling" rather than a rule is exactly how a normal loss becomes a limit-threatening one.', next: 'afterEntry', rating: 'Worth revisiting — sizing followed a feeling, not a rule' },
    ],
  },
  afterEntry: {
    id: 'afterEntry',
    prompt: 'The trade goes against you and hits your stop for a loss. Combined with an earlier small loss, you\'re now down 3.5% for the day.',
    choices: [
      { text: 'Stop trading for the day — you\'re close to the 5% limit', consequence: 'With 1.5% of headroom left, one more normal-sized loss could end the day badly. Stopping preserves the account and the mental capital to trade well tomorrow.', next: 'end', rating: 'Sound risk management' },
      { text: 'Take one more trade at your normal size — there\'s still room', consequence: 'Technically true, but "still room" isn\'t the same as "still a good idea" — trading tired or frustrated after two losses often produces a third.', next: 'stillTrading' },
      { text: 'Take a bigger trade to make the day back to breakeven', consequence: 'This directly increases the odds of breaching the 5% limit on a single trade — the exact failure mode daily limits exist to prevent.', next: 'end', rating: 'High risk — sizing up to recover a loss' },
    ],
  },
  stillTrading: {
    id: 'stillTrading',
    prompt: 'You take one more trade at normal size. It also loses — you\'re now at 4.4% for the day, 0.6% from the limit.',
    choices: [
      { text: 'Stop now — headroom is nearly gone', consequence: 'Stopping here, even later than ideal, still protects the account from the worst outcome (a full limit breach).', next: 'end', rating: 'Recovered late, but recovered — stop earlier next time' },
      { text: 'One more — third time\'s the charm', consequence: 'Chasing three losses in a row with almost no room left to the daily limit is close to a guaranteed way to breach it.', next: 'end', rating: 'High risk — chased losses into the limit' },
    ],
  },
};

/**
 * RiskManagementDecisionLab — Section 11's first real Decision Lab
 * (untimed, 2-3 decision points, quality rating not pass/fail),
 * grounded in this platform's own real funded-account risk rules
 * (daily loss limit, total drawdown limit — the same numbers
 * FacilitatorCalendar/ToolsPage's Payout Optimizer already use), not
 * an invented business case study. Template for adding one per track.
 */
export function RiskManagementDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Risk Management" subtitle="Walk a real risk scenario at your own pace. No timer, no score — just a quality read on your choices." />
      <DecisionLabEngine
        title="Risk Management" framework="the daily-loss-limit discipline"
        startId="start" nodes={NODES} backHref="/learn" dark={dark}
      />
    </div>
  );
}
