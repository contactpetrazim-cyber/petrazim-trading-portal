import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 4 (Volume & Liquidity Sweep) trades Auction Market Theory\'s accumulation/distribution model — a Spring (a brief undercut of support that fails and reverses) forms at the bottom of a range.',
    choices: [
      { text: 'Read it as a real Spring — a shakeout, not a breakdown, and a bullish signal in AMT terms', consequence: 'A Spring is specifically a failed breakdown that quickly reclaims the range — Bot 4\'s own Auction Market Theory lens reads that exact pattern as accumulation completing, not weakness.', next: 'afterSpring' },
      { text: 'Read any undercut of support as bearish, regardless of what happens after', consequence: 'Treating every undercut the same way ignores the actual AMT distinction Bot 4 is built on — a Spring is defined by failing to hold below support, which is the opposite of a genuine breakdown.', next: 'afterSpring', rating: 'Worth revisiting — didn\'t distinguish a Spring from a real breakdown' },
    ],
  },
  afterSpring: {
    id: 'afterSpring',
    prompt: 'Later, at the top of a different range, price briefly pushes above resistance then fails and drops back inside — the mirror pattern (an Upthrust).',
    choices: [
      { text: 'Read it as an Upthrust — a failed breakout, bearish in AMT terms, the mirror of the earlier Spring', consequence: 'Recognizing the Upthrust as the Spring\'s mirror image (a failed push above resistance rather than below support) shows the AMT model applied consistently in both directions, not just the bullish case.', next: 'end', rating: 'AMT model applied correctly in both directions' },
      { text: 'Treat it as a genuine bullish breakout since price initially pushed above resistance', consequence: 'Reacting to the initial push through resistance while ignoring that it failed and dropped back inside misses the actual Upthrust pattern Bot 4\'s AMT lens is built to catch.', next: 'end', rating: 'Worth revisiting — reacted to the failed breakout, not its failure' },
    ],
  },
};

/** Bot4DecisionLab — Bot 4 (Volume & Liquidity Sweep): Auction Market Theory's Spring/Upthrust. */
export function Bot4DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 4: Volume & Liquidity Sweep" subtitle="Walk a real Spring/Upthrust scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Bot 4 — Volume & Liquidity Sweep" framework="Auction Market Theory's Spring and Upthrust" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
