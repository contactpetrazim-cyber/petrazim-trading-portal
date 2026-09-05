import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, RotateCcw } from 'lucide-react';

export interface DecisionChoice { text: string; consequence: string; next: string | 'end'; rating?: string }
export interface DecisionNode { id: string; prompt: string; choices: DecisionChoice[] }

/**
 * DecisionLabEngine — Section 11: untimed, 2-3 decision points, ends
 * with a quality rating (not pass/fail) — deliberately calm and
 * distinct from the timed, scored Games above (no timer/score/
 * competition framing, per DL02). One shared engine, per-scenario
 * config — the spec is explicit Decision Labs are "one per pillar" but
 * doesn't forbid a shared engine the way solo games' Section 10a does;
 * this app currently ships one real scenario (Risk Management) as the
 * template for adding more.
 */
export function DecisionLabEngine({
  title, framework, startId, nodes, backHref, dark,
}: {
  title: string;
  framework: string;
  startId: string;
  nodes: Record<string, DecisionNode>;
  backHref: string;
  dark: boolean;
}) {
  const [path, setPath] = useState<{ nodeId: string; choice: DecisionChoice }[]>([]);
  const [currentId, setCurrentId] = useState(startId);
  const [ended, setEnded] = useState(false);

  const node = nodes[currentId];

  function choose(choice: DecisionChoice) {
    setPath((p) => [...p, { nodeId: currentId, choice }]);
    if (choice.next === 'end') {
      setEnded(true);
    } else {
      setCurrentId(choice.next);
    }
  }

  function restart() {
    setPath([]);
    setCurrentId(startId);
    setEnded(false);
  }

  const cardCls = `rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  if (ended) {
    const lastRating = [...path].reverse().find((p) => p.choice.rating)?.choice.rating ?? 'Reviewed';
    return (
      <div className={`${cardCls} text-center`}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-corporate-hero/10">
          <Compass size={22} className="text-corporate-hero" />
        </div>
        <div className={`text-lg font-bold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{lastRating}</div>
        <p className={`text-sm mb-4 ${mutedCls}`}>Tied back to {framework} — no score, no timer. Here's the path you took:</p>
        <div className="text-left space-y-2 mb-5">
          {path.map((p, i) => (
            <div key={i} className={`text-sm rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
              <div className={`font-medium mb-0.5 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{p.choice.text}</div>
              <div className={mutedCls}>{p.choice.consequence}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={restart} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
            <RotateCcw size={14} /> Try a different path
          </button>
          <Link to={backHref} className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${mutedCls}`}>{title} · Decision {path.length + 1}</div>
      <p className={`text-base font-medium mb-5 leading-relaxed ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{node.prompt}</p>
      <div className="space-y-2">
        {node.choices.map((c, i) => (
          <button
            key={i}
            onClick={() => choose(c)}
            className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-colors ${
              dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'
            }`}
          >
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}
