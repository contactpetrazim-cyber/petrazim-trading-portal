import { Waves } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MatchingGameEngine, type MatchPair } from '../components/MatchingGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#0ea5e9';

const PAIRS: MatchPair[] = [
  { id: 'buy-side', term: 'Buy-side liquidity', definition: 'Resting buy orders/stops above recent highs, often swept before a move down.' },
  { id: 'sell-side', term: 'Sell-side liquidity', definition: 'Resting sell orders/stops below recent lows, often swept before a move up.' },
  { id: 'equal-highs', term: 'Equal highs', definition: 'Two or more swing highs at nearly the same price — a stacked liquidity pool.' },
  { id: 'inducement', term: 'Inducement', definition: 'A smaller, earlier move designed to trap traders before the real move happens.' },
  { id: 'sweep', term: 'Liquidity sweep', definition: 'Price wicks past a level to trigger stops, then closes back on the other side.' },
  { id: 'pool', term: 'Liquidity pool', definition: 'A price area where a cluster of resting orders/stops sit, worth targeting or avoiding.' },
];

/**
 * LiquidityMatchGame — a fifth distinct interaction (MatchingGameEngine)
 * for the Liquidity track, real terms from this platform's own
 * authored curriculum vocabulary.
 */
export function LiquidityMatchGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Liquidity Match" subtitle="Match each term to its real definition — no timer." />
      <MatchingGameEngine
        gameId="liquidity-match" title="Liquidity Match" icon={<Waves size={16} />} accent={ACCENT}
        pairs={PAIRS} baseXp={15} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
