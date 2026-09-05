import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Price has been ranging sideways for weeks after a decline, with a series of tests below the range low that keep getting bought up ("springs" — Wyckoff\'s term for a shakeout below support that fails to hold).',
    choices: [
      { text: 'Read it as likely Accumulation — smart money absorbing supply before markup', consequence: 'A range after a decline, with repeated failed breakdowns (springs), is the classic Wyckoff Accumulation signature — this platform\'s own vocabulary calls the same idea a demand zone/liquidity sweep, cross-framework synthesis in practice.', next: 'afterRead' },
      { text: 'Read every new low in the range as confirmation of a continued downtrend', consequence: 'Treating each failed breakdown as bearish confirmation, when they keep failing to hold, ignores exactly the pattern (repeated absorption at the lows) that\'s the real signal here.', next: 'afterRead', rating: 'Worth revisiting — misread repeated absorption as trend continuation' },
    ],
  },
  afterRead: {
    id: 'afterRead',
    prompt: 'Price finally breaks decisively OUT of the top of the range on strong volume — a Sign of Strength.',
    choices: [
      { text: 'Treat this as the Markup phase starting — the accumulation thesis just confirmed', consequence: 'A strong breakout after a well-formed accumulation range, on real volume, is exactly how Wyckoff\'s cycle is supposed to resolve — this platform\'s own BOS concept (Core 2) is describing the same real event in different vocabulary.', next: 'end', rating: 'Cross-framework read correctly — Wyckoff and this platform\'s own SMC vocabulary agree' },
      { text: 'Dismiss it as "just another range test" like the earlier failed breakdowns', consequence: 'Treating a strong, volume-confirmed breakout the same as the earlier low-conviction springs misses the actual distinction Wyckoff draws between a test and a genuine Sign of Strength.', next: 'end', rating: 'Worth revisiting — didn\'t distinguish a real breakout from a range test' },
    ],
  },
};

/** BookKnowledgeDecisionLab — the Book Knowledge track, applying Wyckoff's real accumulation/markup cycle. */
export function BookKnowledgeDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Book Knowledge" subtitle="Walk a real Wyckoff accumulation scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Book Knowledge" framework="Wyckoff's accumulation-to-markup cycle" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
