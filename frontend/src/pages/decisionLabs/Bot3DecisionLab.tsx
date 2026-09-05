import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 3 (Imbalance Expansion) trades a partial retracement into an UNMITIGATED 1H FVG. A fresh 1H FVG forms, but price has already traded back through the full gap once already this session.',
    choices: [
      { text: 'This gap no longer qualifies — Bot 3 specifically needs it unmitigated', consequence: 'Bot 3\'s entire edge is built on an imbalance that hasn\'t been resolved yet — once price has already fully filled it, that specific setup condition is gone, even if the gap is technically still visible on the chart.', next: 'afterCheck' },
      { text: 'It still counts — a gap is a gap regardless of whether price has already filled it', consequence: 'Ignoring the "unmitigated" requirement is dropping the exact condition Bot 3\'s own philosophy depends on — this isn\'t a minor detail, it\'s the whole setup criterion.', next: 'afterCheck', rating: 'Worth revisiting — ignored Bot 3\'s specific unmitigated requirement' },
    ],
  },
  afterCheck: {
    id: 'afterCheck',
    prompt: 'A second, genuinely fresh 1H FVG forms later — never yet traded through — and price begins a partial retracement into it.',
    choices: [
      { text: 'This matches Bot 3\'s real setup criteria — a valid partial retracement into an unmitigated imbalance', consequence: 'This is Bot 3\'s philosophy applied correctly: fresh, unmitigated, and a genuine partial (not full) retracement into it.', next: 'end', rating: 'Bot 3\'s setup criteria correctly verified' },
      { text: 'Wait for price to fully fill the gap first, "to be extra sure"', consequence: 'Waiting for a FULL fill contradicts Bot 3\'s own "partial retracement" premise — a full fill is closer to the condition that just disqualified the earlier gap.', next: 'end', rating: 'Worth revisiting — waited for the wrong condition (full fill, not partial)' },
    ],
  },
};

/** Bot3DecisionLab — Bot 3 (Imbalance Expansion): the unmitigated-1H-FVG requirement. */
export function Bot3DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 3: Imbalance Expansion" subtitle="Walk a real unmitigated-FVG scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Bot 3 — Imbalance Expansion" framework="a partial retracement into an unmitigated 1H FVG" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
