import { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { GameResultsScreen } from './GameResultsScreen';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SequenceItem { id: string; label: string; detail: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * SequenceGameEngine — a THIRD distinct interaction (after TriageGameEngine's
 * MCQ-under-a-countdown and ZoneTapperGame's tap-on-chart): reconstruct
 * the correct order by tapping items one at a time, no drag needed
 * (mobile-friendly inherently). Untimed — sequencing correctly is the
 * skill, not speed.
 */
export function SequenceGameEngine({
  gameId, title, icon, accent, correctOrder, baseXp, backHref, dark,
}: {
  gameId: string;
  title: string;
  icon: React.ReactNode;
  accent: string;
  correctOrder: SequenceItem[];
  baseXp: number;
  backHref: string;
  dark: boolean;
}) {
  const { token } = useAuth();
  const [pool, setPool] = useState(() => shuffle(correctOrder));
  const [picked, setPicked] = useState<SequenceItem[]>([]);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  function pick(item: SequenceItem) {
    if (checked) return;
    setPool((p) => p.filter((i) => i.id !== item.id));
    setPicked((p) => [...p, item]);
  }

  function undo() {
    if (checked || picked.length === 0) return;
    const last = picked[picked.length - 1];
    setPicked((p) => p.slice(0, -1));
    setPool((p) => [...p, last]);
  }

  const correctCount = picked.filter((item, i) => correctOrder[i]?.id === item.id).length;

  async function finish() {
    setFinished(true);
    if (!token) return;
    const missed = correctOrder
      .filter((_, i) => picked[i]?.id !== correctOrder[i].id)
      .map((item) => `${item.label} — ${item.detail}`);
    const res = await apiFetch(`${API_URL}/curriculum/games/${gameId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        score: correctCount, base_xp: baseXp,
        performance_summary: correctCount === correctOrder.length ? 'Perfect sequence.' : 'Some steps out of order.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) setXpAwarded((await res.json()).xp_awarded);
  }

  function replay() {
    setPool(shuffle(correctOrder));
    setPicked([]);
    setChecked(false);
    setFinished(false);
    setXpAwarded(0);
  }

  if (finished) {
    return (
      <GameResultsScreen
        score={correctCount} total={correctOrder.length}
        performanceSummary={correctCount === correctOrder.length ? 'Perfect sequence.' : 'Some steps out of order.'}
        missedItems={correctOrder.filter((_, i) => picked[i]?.id !== correctOrder[i].id).map((item) => `${item.label} — ${item.detail}`)}
        xpAwarded={xpAwarded} onReplay={replay} backHref={backHref} dark={dark}
      />
    );
  }

  const cardCls = `rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>{icon}</span>
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{title}</span>
      </div>

      <p className={`text-sm mb-4 ${mutedCls}`}>Tap each step in the correct order.</p>

      <div className={`rounded-xl p-3 mb-4 min-h-[60px] ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        {picked.length === 0 ? (
          <span className={`text-xs ${mutedCls}`}>Your order will build here…</span>
        ) : (
          <ol className="space-y-1.5">
            {picked.map((item, i) => (
              <li key={item.id} className={`text-sm flex items-center gap-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                <span className={`text-xs font-bold w-4 ${mutedCls}`}>{i + 1}.</span>
                {item.label}
                {checked && (correctOrder[i]?.id === item.id
                  ? <span className="text-emerald-500 text-xs font-semibold ml-auto">✓</span>
                  : <span className="text-red-500 text-xs font-semibold ml-auto">✗</span>)}
              </li>
            ))}
          </ol>
        )}
      </div>

      {!checked && pool.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {pool.map((item) => (
            <button
              key={item.id}
              onClick={() => pick(item)}
              className={`text-left text-sm px-4 py-3 rounded-xl border transition-colors ${dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {!checked && picked.length > 0 && (
          <button onClick={undo} className={`text-xs font-medium px-3 py-2 rounded-lg ${dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-500'}`}>
            Undo last
          </button>
        )}
        {!checked && pool.length === 0 && (
          <button onClick={() => setChecked(true)} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
            Check order
          </button>
        )}
        {checked && (
          <button onClick={finish} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
            See results
          </button>
        )}
      </div>

      {checked && (
        <div className="mt-3 space-y-1.5">
          {correctOrder.map((item, i) => (
            <div key={item.id} className={`text-xs ${mutedCls}`}><strong>{i + 1}.</strong> {item.label} — {item.detail}</div>
          ))}
        </div>
      )}
    </div>
  );
}
