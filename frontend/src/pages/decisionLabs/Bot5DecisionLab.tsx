import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 5 (Jeafx Liquidity Purge Specialist) requires a strict liquidity-purge-then-confirmation sequence — a real sweep of a defined level, THEN a real confirmation signal, in that order. Price sweeps a level, but no confirmation has appeared yet.',
    choices: [
      { text: 'Wait for the confirmation step — the purge alone is only half of Bot 5\'s own requirement', consequence: 'Bot 5\'s philosophy is specifically "mechanical zone refinement PLUS a strict purge-then-confirmation sequence" — the purge without confirmation is an incomplete signal by its own defined rules.', next: 'afterPurge' },
      { text: 'Enter on the purge alone — it\'s the same idea as a liquidity sweep, close enough', consequence: 'Bot 5 is deliberately stricter than a general liquidity-sweep read — skipping its own confirmation requirement means trading half of its defined sequence, not the mechanism it was actually built around.', next: 'afterPurge', rating: 'Worth revisiting — skipped Bot 5\'s own confirmation requirement' },
    ],
  },
  afterPurge: {
    id: 'afterPurge',
    prompt: 'A genuine confirmation signal appears shortly after the purge, completing Bot 5\'s full sequence.',
    choices: [
      { text: 'Now the full sequence is satisfied — this is a real Bot 5 signal', consequence: 'Purge, then confirmation, in the correct order, is exactly Bot 5\'s own strict, mechanical requirement — satisfied in full, not partially.', next: 'end', rating: 'Bot 5\'s strict purge-then-confirmation sequence applied correctly' },
      { text: 'Second-guess it — "maybe wait for a second confirmation too, just in case"', consequence: 'Bot 5\'s own rule is already strict and specific — adding an undefined extra step past what the mechanism actually requires is hesitation, not added rigor.', next: 'end', rating: 'Worth revisiting — added an undefined step past the real requirement' },
    ],
  },
};

/** Bot5DecisionLab — Bot 5 (Jeafx Liquidity Purge Specialist): the strict purge-then-confirmation sequence. */
export function Bot5DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 5: Liquidity Purge Specialist" subtitle="Walk the real purge-then-confirmation scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Bot 5 — Liquidity Purge Specialist" framework="the strict liquidity-purge-then-confirmation sequence" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
