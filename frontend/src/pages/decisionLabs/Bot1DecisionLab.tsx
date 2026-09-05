import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 1 (Macro Swing Structure) trades confirmed higher-timeframe structural transitions using 1D and 4H candles — continuation, not reversal. A Bot 1 signal fires, but the 15M chart looks choppy and directionless right now.',
    choices: [
      { text: 'Trust the signal — Bot 1 was never built to read the 15M in the first place', consequence: 'Judging a Bot 1 signal by how the 15M looks is applying the wrong bot\'s lens — Bot 1\'s whole philosophy is higher-timeframe structure, and 15M noise is exactly what it\'s designed to ignore.', next: 'afterTrust' },
      { text: 'Distrust the signal because the 15M looks messy', consequence: 'This is the exact misapplication this bot\'s own curriculum flags — treating Bot 1 like a lower-timeframe bot and judging it by a chart it was never built to read.', next: 'afterTrust', rating: 'Worth revisiting — judged a macro bot by a micro timeframe' },
    ],
  },
  afterTrust: {
    id: 'afterTrust',
    prompt: 'The position works out over several days, in line with Bot 1\'s continuation philosophy — a genuinely longer hold than a reversal bot would expect.',
    choices: [
      { text: 'That\'s expected — Bot 1\'s edge plays out over a longer structural hold, not a quick scalp', consequence: 'Holding a Bot 1 position the way its own philosophy expects — trading confirmed HTF structure through to its natural resolution — is applying the bot correctly, not just getting lucky.', next: 'end', rating: 'Bot 1\'s continuation philosophy applied correctly' },
      { text: 'Get impatient and close early because "it should have moved faster"', consequence: 'Expecting a macro-swing, continuation-philosophy bot to move at a reversal bot\'s pace is holding it to the wrong bot\'s standard.', next: 'end', rating: 'Worth revisiting — expected the wrong bot\'s pace' },
    ],
  },
};

/** Bot1DecisionLab — Bot 1 (Macro Swing Structure): applying its own real HTF/continuation philosophy correctly. */
export function Bot1DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 1: Macro Swing Structure" subtitle="Walk a real HTF-continuation scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Bot 1 — Macro Swing Structure" framework="trading confirmed HTF structure, not LTF noise" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
