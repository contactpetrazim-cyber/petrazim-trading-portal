import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'A real 3-candle FVG forms during a strong impulsive move. Price has already returned and fully filled it once, then continued in the original direction.',
    choices: [
      { text: 'Treat it as already mitigated — a filled FVG has done its job', consequence: 'An FVG\'s whole premise is an imbalance the market wants to rebalance — once price has actually traded back through the full gap, that imbalance is resolved, not still "pending."', next: 'afterFilled' },
      { text: 'Expect price to react there again the same way', consequence: 'Expecting a SECOND reaction from a gap that already fully filled once treats the FVG as a permanent support/resistance level, which isn\'t what the concept actually claims — the imbalance it represented is already gone.', next: 'afterFilled', rating: 'Worth revisiting — treated a filled FVG as still "live"' },
    ],
  },
  afterFilled: {
    id: 'afterFilled',
    prompt: 'A second, brand-new FVG forms later, but it\'s tiny — barely a few pips wide, on a low-volatility session.',
    choices: [
      { text: 'Question whether it\'s worth trading — size and context matter, not just the pattern existing', consequence: 'This platform\'s own content flags exactly this: "when an imbalance isn\'t worth trading" is part of the real lesson, not every technically-valid FVG is a tradeable one.', next: 'end', rating: 'Correctly judged FVG quality, not just presence' },
      { text: 'Trade every FVG the same way regardless of size or context', consequence: 'Treating a tiny, low-volatility gap the same as a large impulsive one skips real judgment the framework explicitly asks for — not every FVG carries the same weight.', next: 'end', rating: 'Worth revisiting — treated all FVGs as equal' },
    ],
  },
};

/** FVGDecisionLab — Core 5 (Fair Value Gaps): mitigation status and gap quality. */
export function FVGDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Fair Value Gaps" subtitle="Walk a real FVG mitigation scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Fair Value Gaps & Imbalance" framework="FVG mitigation and gap quality" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
