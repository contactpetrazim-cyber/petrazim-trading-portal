import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'A trade you planned carefully hits your take-profit and closes as a full winner — textbook execution start to finish.',
    choices: [
      { text: 'Still do a post-trade review — judge the PROCESS, not just the outcome', consequence: 'A winning outcome doesn\'t confirm the process was actually sound (it might have been a lucky bad process) — Core 9\'s own point is judging process separately from outcome, in both directions.', next: 'afterReview' },
      { text: 'Skip the review — it worked, nothing to learn', consequence: 'Skipping review on winners means only ever examining losses, which quietly teaches "review = something went wrong" — half the real signal (what a GOOD process looks like) never gets reinforced.', next: 'afterReview', rating: 'Worth revisiting — reviewed outcome, not process' },
    ],
  },
  afterReview: {
    id: 'afterReview',
    prompt: 'On review, you realize the entry itself was actually late and off-plan — you got in 20 pips worse than your original trigger, but the trade still won.',
    choices: [
      { text: 'Flag the entry as a process error despite the win — fix it before it costs a trade next time', consequence: 'This is exactly "judging process separately from outcome" in practice: a bad process that happened to win is still a bad process, and the next one might not be as forgiving.', next: 'end', rating: 'Process judged honestly, independent of the win' },
      { text: 'Let it go — "it worked out, so it wasn\'t really wrong"', consequence: 'Outcome bias — using a good result to retroactively excuse a real process error is exactly the trap the full-lifecycle review (pre-trade through post-trade) exists to catch.', next: 'end', rating: 'Worth revisiting — let outcome excuse a real process error' },
    ],
  },
};

/** TradeManagementDecisionLab — Core 9 (Trade Management): judging process separately from outcome. */
export function TradeManagementDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Trade Management" subtitle="Walk a real post-trade review scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Trade Management" framework="judging process separately from outcome" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
