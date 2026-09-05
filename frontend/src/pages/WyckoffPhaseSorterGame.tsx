import { BookMarked } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SequenceGameEngine, type SequenceItem } from '../components/SequenceGameEngine';
import { useThemeStore } from '../hooks/useTheme';

const ACCENT = '#a855f7';

const ORDER: SequenceItem[] = [
  { id: 'accumulation', label: 'Accumulation', detail: 'Smart money quietly builds a position while price ranges sideways after a decline.' },
  { id: 'markup', label: 'Markup', detail: 'Price breaks out of the range and trends upward as demand takes control.' },
  { id: 'distribution', label: 'Distribution', detail: 'Smart money sells into strength while price ranges sideways again, near the highs.' },
  { id: 'markdown', label: 'Markdown', detail: 'Price breaks down out of the range and trends downward as supply takes control.' },
];

/**
 * WyckoffPhaseSorterGame — a genuinely different mechanic (tap-to-order
 * sequencing, SequenceGameEngine) for the Book Knowledge track, which
 * already covers Wyckoff by name (BOOK_KNOWLEDGE.md). Real market-cycle
 * theory, not an invented sequence.
 */
export function WyckoffPhaseSorterGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Wyckoff Phase Sorter" subtitle="Reconstruct the real market-cycle order — no timer." />
      <SequenceGameEngine
        gameId="wyckoff-phase-sorter" title="Wyckoff Phase Sorter" icon={<BookMarked size={16} />} accent={ACCENT}
        correctOrder={ORDER} baseXp={15} backHref="/practise/game" dark={dark}
      />
    </div>
  );
}
