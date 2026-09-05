import { Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * GameResultsScreen — Section 10a's shared results-screen contract,
 * used by every solo game: score + plain-language read-out + "what
 * you'd do differently" (missedItems) + XP + replay (GM01). One
 * component, not reimplemented per game.
 */
export function GameResultsScreen({
  score, total, performanceSummary, missedItems, xpAwarded, onReplay, backHref, dark,
}: {
  score: number;
  total: number;
  performanceSummary: string;
  missedItems: string[];
  xpAwarded: number;
  onReplay: () => void;
  backHref: string;
  dark: boolean;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className={`rounded-2xl p-6 border text-center ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-corporate-hero/10">
        <Trophy size={26} className="text-corporate-hero" />
      </div>
      <div className={`text-4xl font-bold font-display mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
        {score}/{total}
      </div>
      <div className={`text-sm mb-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>{pct}% — {performanceSummary}</div>

      {xpAwarded > 0 && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full mb-4">
          +{xpAwarded} XP
        </div>
      )}

      {missedItems.length > 0 && (
        <div className={`text-left rounded-xl p-4 mb-4 text-sm ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
          <div className={`font-semibold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>What you'd do differently</div>
          <ul className={`space-y-1 list-disc list-outside pl-4 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
            {missedItems.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button
          onClick={onReplay}
          className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero"
        >
          <RotateCcw size={14} /> Replay
        </button>
        <Link
          to={backHref}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </div>
    </div>
  );
}
