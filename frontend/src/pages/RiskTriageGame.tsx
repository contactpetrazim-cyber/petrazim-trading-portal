import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TriageGameEngine, type TriageScenario } from '../components/TriageGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#f59e0b';

const SCENARIOS: TriageScenario[] = [
  {
    id: '1',
    prompt: 'You\'re down 3% for the day (your daily loss limit is 3%). A textbook A+ setup just appeared.',
    options: [
      { label: 'Stop for the day — the limit exists for exactly this moment', correct: true },
      { label: 'Take it anyway — it\'s too good to pass up', correct: false },
      { label: 'Take it at 3x size to recover the loss', correct: false },
      { label: 'Move the daily limit to 5% just this once', correct: false },
    ],
    whatYoudDoDifferently: 'A daily loss limit that bends whenever a setup "looks good enough" isn\'t a limit — the whole point is it holds especially when a trade looks tempting.',
  },
  {
    id: '2',
    prompt: 'A trade just hit your stop loss for a full 1R loss, right before the market reversed in your original direction.',
    options: [
      { label: 'Log it, move on — the stop did its job on the information available then', correct: true },
      { label: 'Widen stops on future trades so this doesn\'t happen again', correct: false },
      { label: 'Re-enter immediately, doubled size, to make it back', correct: false },
      { label: 'Stop using stop losses on this setup type', correct: false },
    ],
    whatYoudDoDifferently: 'A stop getting hit right before a reversal is normal variance, not proof the stop was wrong — widening stops or chasing the loss both increase risk based on one outcome, not a real pattern.',
  },
  {
    id: '3',
    prompt: 'Your position is up 2R. Price is approaching a major resistance level you identified before entering.',
    options: [
      { label: 'Take partial profit and/or trail the stop to lock in gains', correct: true },
      { label: 'Add to the position — it\'s working', correct: false },
      { label: 'Remove the stop loss since it\'s in profit now', correct: false },
      { label: 'Hold with no plan and see what happens', correct: false },
    ],
    whatYoudDoDifferently: 'A known resistance level approaching is exactly when a pre-planned exit (partial or trail) protects the gain you already have — adding size or removing the stop both increase exposure right where it\'s least justified.',
  },
  {
    id: '4',
    prompt: 'You\'re running 5 open positions, each risking 1%, all in the same currency/asset direction (e.g., all long USD pairs).',
    options: [
      { label: 'Treat this as correlated risk — closer to 5% total exposure, not 1%', correct: true },
      { label: 'It\'s fine — each one only risks 1% individually', correct: false },
      { label: 'Add a 6th correlated position since risk-per-trade is still 1%', correct: false },
      { label: 'No action needed, correlation doesn\'t matter for spot forex', correct: false },
    ],
    whatYoudDoDifferently: 'Five 1%-risk trades that are all really the same underlying bet can all lose together — real risk exposure is closer to 5%, not 1%, and needs sizing down accordingly.',
  },
  {
    id: '5',
    prompt: 'A funded-account challenge has a 4% daily loss limit. You\'re at -3.6% for the day with 2 hours left in your session.',
    options: [
      { label: 'Stop trading — 0.4% of headroom left isn\'t worth the account', correct: true },
      { label: 'Take one more trade at normal size, there\'s still room', correct: false },
      { label: 'Take a bigger trade to make it back before the day ends', correct: false },
      { label: 'Ignore the limit since it\'s a demo/challenge account', correct: false },
    ],
    whatYoudDoDifferently: 'With almost no headroom left to a hard daily limit, one normal-sized loss ends the challenge — the math only works if you stop before that happens, not after.',
  },
];

/** RiskTriageGame — Section 10a's game for Risk Management. */
export function RiskTriageGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Risk Triage" subtitle="Pick the disciplined action before the clock runs out." />
      <TriageGameEngine
        gameId="risk-triage" title="Risk Triage" icon={<ShieldAlert size={16} />} accent={ACCENT}
        scenarios={SCENARIOS} secondsPerQuestion={25} baseXp={20} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
