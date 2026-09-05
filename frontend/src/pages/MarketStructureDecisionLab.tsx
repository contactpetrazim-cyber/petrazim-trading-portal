import { PageHeader } from '../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../components/DecisionLabEngine';
import { useThemeStore } from '../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Price has been making higher highs and higher lows on the 1H for two days — a clean uptrend. It just made a lower low for the first time.',
    choices: [
      { text: 'Note it as a POTENTIAL early shift — wait for a close below the prior higher low before acting', consequence: 'One lower low alone isn\'t confirmation — waiting for a genuine break of the prior HIGHER LOW (a real structure break) avoids reacting to noise inside an intact uptrend.', next: 'afterLowerLow' },
      { text: 'Flip bias to bearish immediately and look for shorts', consequence: 'A single lower low, on its own, is exactly the kind of single data point that can reverse itself just as fast — treating it as a full trend change this early is jumping ahead of what structure has actually confirmed.', next: 'afterLowerLow', rating: 'Worth revisiting — flipped bias on one lower low' },
    ],
  },
  afterLowerLow: {
    id: 'afterLowerLow',
    prompt: 'Price rallies again, but this time fails to make a new high, then breaks below the prior HIGHER LOW with a real close, not just a wick.',
    choices: [
      { text: 'This is a genuine Break of Structure — start treating the trend as bearish (or at least neutral)', consequence: 'A confirmed close below the last higher low, after a failed attempt at a new high, is exactly the two-part confirmation a real structure shift needs.', next: 'end', rating: 'Structure read correctly' },
      { text: 'Still call it an uptrend — "it\'s just a pullback"', consequence: 'At this point the evidence (failed new high + a real close below the prior higher low) has moved past "just a pullback" — holding the old bias here is ignoring what structure is actually showing.', next: 'end', rating: 'Worth revisiting — held old bias past its confirmation' },
      { text: 'Immediately short as large as possible on the break', consequence: 'Reading the structure shift correctly and sizing appropriately are two different skills — confirming the shift doesn\'t by itself justify oversized risk on the first trade after it.', next: 'end', rating: 'Structure read correctly, but risk sizing needs its own discipline' },
    ],
  },
};

/**
 * MarketStructureDecisionLab — Decision Lab for the Market Structure
 * track, grounded in the same real BOS definition (Visual Glossary's
 * own diagram: a genuine CLOSE past the prior swing, not a wick).
 */
export function MarketStructureDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Market Structure" subtitle="Walk a real structure-shift scenario at your own pace. No timer, no score." />
      <DecisionLabEngine
        title="Market Structure" framework="Break of Structure confirmation"
        startId="start" nodes={NODES} backHref="/learn" dark={dark}
      />
    </div>
  );
}
