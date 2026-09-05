import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Using the platform\'s real five-layer stack (Macro / Direction / Opportunity / Trigger / Execution): your Macro (1D) layer is bullish, your Direction (4H) layer is bullish, but your Opportunity (1H) layer shows price deep in premium, far from any real zone.',
    choices: [
      { text: 'Wait — Macro and Direction agree, but Opportunity hasn\'t presented a real location yet', consequence: 'The five-layer stack exists precisely so a trader doesn\'t force a Trigger (entry) before Opportunity (the actual zone/location) is really there — two of five layers agreeing isn\'t the same as all five being ready.', next: 'afterWait' },
      { text: 'Enter now on the Trigger (15M) timeframe anyway, since the top two layers agree', consequence: 'Skipping the Opportunity layer and jumping straight to a Trigger read means entering with no real zone underneath the trade — exactly the gap the five-layer stack is designed to prevent.', next: 'afterWait', rating: 'Worth revisiting — skipped the Opportunity layer' },
    ],
  },
  afterWait: {
    id: 'afterWait',
    prompt: 'Price pulls back into a real discount zone on the 1H (Opportunity layer now satisfied), and a clean Trigger forms on the 15M.',
    choices: [
      { text: 'All five layers now align — this is a genuinely high-conviction setup', consequence: 'Macro, Direction, Opportunity, Trigger, and Execution all agreeing is exactly the "all five layers stacked" case this framework treats as its highest-conviction read — not a coincidence, the intended outcome of the process.', next: 'end', rating: 'Full stack read correctly' },
      { text: 'Still hesitate — "maybe check one more timeframe"', consequence: 'With all five defined layers already aligned, adding an undefined sixth check is hesitation past the point the framework itself calls sufficient.', next: 'end', rating: 'Worth revisiting — hesitated past a complete, defined process' },
    ],
  },
};

/** MTFDecisionLab — Core 7 (Multi-Timeframe Analysis): the real five-layer stack. */
export function MTFDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Multi-Timeframe Analysis" subtitle="Walk the real five-layer stack at your own pace. No timer, no score." />
      <DecisionLabEngine title="Multi-Timeframe Analysis" framework="the Macro/Direction/Opportunity/Trigger/Execution stack" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
