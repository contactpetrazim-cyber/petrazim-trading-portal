import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'You mark a clear dealing range\'s external leg and find equilibrium (the true midpoint). A bullish setup forms, but it\'s sitting in the upper 30% of the range — premium territory.',
    choices: [
      { text: 'Treat it as lower quality — a long from premium fights the trade location, even if the setup itself looks clean', consequence: 'Trade location (Core 6\'s own subject) is a real, independent filter — a technically clean setup in the wrong half of the range is still working against itself.', next: 'afterLocation' },
      { text: 'Take it full size — the setup itself is what matters, not where it sits in the range', consequence: 'Ignoring trade location skips exactly the judgment Core 6 exists to teach — the same setup, at a better location (discount), would be a meaningfully stronger trade.', next: 'afterLocation', rating: 'Worth revisiting — ignored trade location entirely' },
    ],
  },
  afterLocation: {
    id: 'afterLocation',
    prompt: 'Price pulls back further and reaches genuine discount territory (lower third of the range) with the same bullish structure still intact.',
    choices: [
      { text: 'Now it\'s a meaningfully better long — same structure, better location', consequence: 'This is the whole point of premium/discount: the SAME underlying bullish read is a stronger trade from discount than from premium — location is a real filter, not decoration.', next: 'end', rating: 'Trade location read correctly, start to finish' },
      { text: 'No different from before — location doesn\'t actually change anything', consequence: 'If location genuinely didn\'t matter, equilibrium/premium/discount wouldn\'t be worth defining at all — the framework exists because it does change trade quality.', next: 'end', rating: 'Worth revisiting — dismissed the concept\'s own premise' },
    ],
  },
};

/** PremiumDiscountDecisionLab — Core 6 (Premium/Discount): trade location within a range. */
export function PremiumDiscountDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Premium / Discount" subtitle="Walk a real trade-location scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Premium / Discount" framework="trade location within the dealing range" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
