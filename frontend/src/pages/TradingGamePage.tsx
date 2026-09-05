import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Trophy } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RoundItem {
  lesson_id: string;
  track_title: string;
  question: string;
  answer: string;
}
interface LeaderboardEntry {
  full_name: string;
  best_quiz_streak: number;
  level: number;
}

/**
 * TradingGamePage — the real page behind /practise/game, which
 * previously fell through to the sitemap redirect. This is a rapid-
 * fire streak challenge over REAL Mini Quiz questions pulled from
 * across every authored lesson (routers/practise.py) — deliberately
 * NOT a fabricated live paper-trading price simulator (see that
 * router's own docstring on why). "Gamified" here means the streak
 * counter, XP-style level display, and leaderboard the reference site
 * pattern calls for, applied to real curriculum content instead of
 * invented price data.
 */
export function TradingGamePage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [round, setRound] = useState<RoundItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestThisRound, setBestThisRound] = useState(0);
  const [finished, setFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = () => {
    if (!token) return;
    apiFetch(`${API_URL}/practise/game/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  };

  useEffect(loadLeaderboard, [token]);

  const startRound = async () => {
    if (!token) return;
    setError(null);
    setFinished(false);
    setIndex(0);
    setRevealed(false);
    setStreak(0);
    setBestThisRound(0);
    try {
      const r = await apiFetch(`${API_URL}/practise/game/round?count=10`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const items: RoundItem[] = await r.json();
      if (items.length === 0) throw new Error('empty');
      setRound(items);
    } catch {
      setError('Could not start a round right now.');
    }
  };

  const endRound = async (finalBest: number) => {
    setFinished(true);
    if (!token) return;
    await apiFetch(`${API_URL}/practise/game/streak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ streak: finalBest }),
    });
    loadLeaderboard();
  };

  const answer = (correct: boolean) => {
    const newStreak = correct ? streak + 1 : 0;
    const newBest = Math.max(bestThisRound, newStreak);
    setStreak(newStreak);
    setBestThisRound(newBest);
    setRevealed(false);
    if (round && index + 1 < round.length) {
      setIndex(index + 1);
    } else {
      endRound(newBest);
    }
  };

  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';
  const current = round?.[index];

  return (
    <div>
      <PageHeader title="Trading Simulator Game" subtitle="Gamified paper-trading challenges with streaks and leaderboards." />

      {/* Section 10a's per-pillar solo games — "🎮 Practice" entry
          point, reachable from every module page. See TriageGameEngine's
          docstring for the honest scope note. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { to: '/practise/games/setup-spotter', title: 'Setup Spotter', desc: 'Market structure & order flow', color: '#0891b2' },
          { to: '/practise/games/risk-triage', title: 'Risk Triage', desc: 'Risk management under pressure', color: '#f59e0b' },
          { to: '/practise/games/bias-check', title: 'Bias Check', desc: 'Trading psychology', color: '#8b5cf6' },
          { to: '/practise/games/what-happens-next', title: 'What Happens Next?', desc: 'Predict real historical price', color: '#22c55e' },
          { to: '/practise/games/concept-spotter', title: 'Concept Spotter', desc: 'Name the pattern from the chart', color: '#0ea5e9' },
          { to: '/learn/case-study', title: 'Case Study Walkthrough', desc: 'Step through a real price window', color: '#ec4899' },
          { to: '/practise/games/zone-tapper', title: 'Zone Tapper', desc: 'Tap the real zone on the chart', color: '#f97316' },
        ].map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className={`rounded-xl p-4 border transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}
          >
            <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{g.title}</div>
            <div className={`text-xs mt-1 ${mutedCls}`}>{g.desc}</div>
          </Link>
        ))}
      </div>

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}

      {!round && (
        <div className={`${cardCls} text-center py-10 mb-6`}>
          <Flame size={28} className="mx-auto mb-3 text-amber-500" />
          <p className={`text-sm mb-4 ${dark ? 'text-white/70' : 'text-gray-600'}`}>
            10 rapid-fire questions pulled from everything you've studied. Answer honestly — this is a
            self-check, not an auto-grader.
          </p>
          <button
            onClick={startRound}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
            style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
          >
            Start round
          </button>
        </div>
      )}

      {round && !finished && current && (
        <div className={`${cardCls} mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs ${mutedCls}`}>Question {index + 1} of {round.length} · {current.track_title}</span>
            <span className="text-xs font-semibold flex items-center gap-1 text-amber-500">
              <Flame size={13} /> Streak {streak}
            </span>
          </div>
          <p className={`text-sm mb-4 leading-relaxed ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{current.question}</p>

          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-corporate-bg text-corporate-hero hover:bg-[#dcdce8]'}`}
            >
              Reveal answer
            </button>
          ) : (
            <>
              <p className={`text-sm mb-4 p-3 rounded-lg leading-relaxed ${dark ? 'bg-white/5 text-white/70' : 'bg-corporate-bg text-gray-600'}`}>
                {current.answer}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => answer(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                >
                  I got it right
                </button>
                <button
                  onClick={() => answer(false)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  I got it wrong
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {round && finished && (
        <div className={`${cardCls} text-center py-8 mb-6`}>
          <Trophy size={28} className="mx-auto mb-3 text-amber-500" />
          <div className={`text-2xl font-extrabold font-display mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
            Best streak: {bestThisRound}
          </div>
          <p className={`text-xs mb-4 ${mutedCls}`}>Round complete — {round.length} questions answered.</p>
          <button
            onClick={startRound}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
            style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
          >
            Play again
          </button>
        </div>
      )}

      <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${mutedCls}`}>Leaderboard — Best Streaks</div>
      {leaderboard === null && <p className={`text-sm ${mutedCls}`}>Loading leaderboard…</p>}
      {leaderboard && leaderboard.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No streaks recorded yet — be the first.</p>
      )}
      {leaderboard && leaderboard.length > 0 && (
        <div className={cardCls}>
          {leaderboard.map((e, i) => (
            <div key={`${e.full_name}-${i}`} className={`flex items-center justify-between py-2 text-sm ${i > 0 ? `border-t ${dark ? 'border-white/5' : 'border-gray-50'}` : ''}`}>
              <span className={dark ? 'text-white/70' : 'text-gray-700'}>
                <span className={`inline-block w-5 ${mutedCls}`}>{i + 1}.</span> {e.full_name}
              </span>
              <span className="flex items-center gap-3">
                <span className={`text-xs ${mutedCls}`}>Level {e.level}</span>
                <span className="text-xs font-semibold flex items-center gap-1 text-amber-500">
                  <Flame size={12} /> {e.best_quiz_streak}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
