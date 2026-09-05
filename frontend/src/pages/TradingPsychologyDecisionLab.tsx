import { PageHeader } from '../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../components/DecisionLabEngine';
import { useThemeStore } from '../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Your last two trades both hit stop for a combined -2R. You\'re frustrated. A new setup just formed on your watchlist — not obviously better or worse than your usual A-grade criteria.',
    choices: [
      { text: 'Walk away for 15-20 minutes before deciding anything', consequence: 'Creating distance between a losing streak and the next decision is exactly what prevents that decision from being made by frustration instead of process.', next: 'afterBreak' },
      { text: 'Take it right away — no point overthinking it', consequence: 'Skipping the pause doesn\'t make the emotion go away, it just means the next decision gets made while still carrying it, whether or not that\'s obvious in the moment.', next: 'afterBreak', rating: 'Worth revisiting — no pause after two losses' },
    ],
  },
  afterBreak: {
    id: 'afterBreak',
    prompt: 'You come back to the setup. On a second look, it\'s genuinely borderline — maybe a B-grade, not the A-grade you usually require.',
    choices: [
      { text: 'Skip it — it doesn\'t meet your normal bar', consequence: 'Holding the same bar regardless of how the last two trades felt is the actual discipline being tested here, not the setup itself.', next: 'end', rating: 'Process held under pressure' },
      { text: 'Take it anyway, sized normally — it\'s close enough', consequence: 'A grade that only looks "close enough" right after two losses is worth being honest about — this is where standards quietly slip.', next: 'end', rating: 'Worth revisiting — standard slipped under pressure' },
      { text: 'Take it at reduced size, treating it explicitly as B-grade', consequence: 'Sizing down to match the setup\'s real quality, rather than pretending it\'s A-grade or skipping entirely, is an honest middle path — as long as it\'s a deliberate choice, not a compromise made to "do something."', next: 'end', rating: 'Reasonable — sized to match true conviction' },
    ],
  },
};

/**
 * TradingPsychologyDecisionLab — second Decision Lab (Section 11),
 * further proving out the DecisionLabEngine template. Grounded in the
 * same discipline questions Bias Check's own scenarios test
 * (revenge trading, standards slipping after a loss), just untimed
 * and reflective rather than timed/scored.
 */
export function TradingPsychologyDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Trading Psychology" subtitle="Walk a real discipline scenario at your own pace. No timer, no score." />
      <DecisionLabEngine
        title="Trading Psychology" framework="process discipline after a losing streak"
        startId="start" nodes={NODES} backHref="/learn" dark={dark}
      />
    </div>
  );
}
