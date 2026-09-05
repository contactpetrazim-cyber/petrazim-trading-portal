import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CandleChart, type Candle } from '../components/CandleChart';
import { GameResultsScreen } from '../components/GameResultsScreen';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const INTERVALS = ['15m', '1h', '4h'];
const REVEAL_COUNT = 5;
const TOTAL_ROUNDS = 5;

type Outcome = 'new_high' | 'new_low' | 'range';

interface RoundData {
  symbol: string;
  interval: string;
  history: Candle[];
  future: Candle[];
  correct: Outcome;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  new_high: 'Makes a new high above the visible range',
  new_low: 'Makes a new low below the visible range',
  range: 'Stays within the visible range',
};

function classify(history: Candle[], future: Candle[]): Outcome {
  const rangeHigh = Math.max(...history.map((c) => c.high));
  const rangeLow = Math.min(...history.map((c) => c.low));
  const futureHigh = Math.max(...future.map((c) => c.high));
  const futureLow = Math.min(...future.map((c) => c.low));
  const madeHigh = futureHigh > rangeHigh;
  const madeLow = futureLow < rangeLow;
  if (madeHigh && !madeLow) return 'new_high';
  if (madeLow && !madeHigh) return 'new_low';
  if (madeHigh && madeLow) {
    // Both happened — whichever extreme is proportionally larger wins,
    // an honest tiebreak rather than picking one arbitrarily.
    return (futureHigh - rangeHigh) >= (rangeLow - futureLow) ? 'new_high' : 'new_low';
  }
  return 'range';
}

/**
 * WhatHappensNextGame — "add games with price charts what will happen
 * next", by direct request. Real historical candles (GET
 * /order-flow/klines, same Binance proxy as the Order Flow tool) —
 * genuinely settled, unseen-by-the-trainee price action, not an
 * authored scenario with a made-up answer. The question is
 * deliberately a simple, objectively-checkable read (new high / new
 * low / stayed in range) rather than a subjective "was this a valid
 * setup" call, which real, noisy market data can't honestly guarantee
 * an unambiguous answer to.
 */
export function WhatHappensNextGame() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [round, setRound] = useState(0);
  const [data, setData] = useState<RoundData | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  async function loadRound() {
    setData(null);
    setError(null);
    setGuess(null);
    setRevealed(false);
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const interval = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
    const limit = 60;
    const result = await fetchJsonWithRetry<{ candles: Candle[] }>(
      `${API_URL}/order-flow/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
      setPhase,
    );
    if (!result || result.candles.length < 40) {
      setError('Could not load a live price window right now — try again in a moment.');
      return;
    }
    const cut = 30 + Math.floor(Math.random() * (result.candles.length - 30 - REVEAL_COUNT));
    const history = result.candles.slice(cut - 30, cut);
    const future = result.candles.slice(cut, cut + REVEAL_COUNT);
    setData({ symbol, interval, history, future, correct: classify(history, future) });
  }

  useEffect(() => { if (token) loadRound(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseGuess(o: Outcome) {
    if (!data || revealed) return;
    setGuess(o);
    setRevealed(true);
    if (o === data.correct) {
      setScore((s) => s + 1);
    } else {
      setMissed((m) => [...m, `${data.symbol} (${data.interval}): actually "${OUTCOME_LABEL[data.correct]}"`]);
    }
  }

  async function nextRound() {
    if (round + 1 < TOTAL_ROUNDS) {
      setRound((r) => r + 1);
      loadRound();
      return;
    }
    setFinished(true);
    if (!token) return;
    const res = await apiFetch(`${API_URL}/curriculum/games/what-happens-next/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        score, base_xp: 20,
        performance_summary: score === TOTAL_ROUNDS ? 'Perfect read on every window.' : score >= TOTAL_ROUNDS * 0.6 ? 'Solid instinct for where price was headed.' : 'Real markets are noisy — keep at it.',
        missed_items: missed,
      }),
    }).catch(() => null);
    if (res?.ok) setXpAwarded((await res.json()).xp_awarded);
  }

  function replay() {
    setRound(0);
    setScore(0);
    setMissed([]);
    setFinished(false);
    setXpAwarded(0);
    loadRound();
  }

  if (finished) {
    return (
      <div>
        <PageHeader title="What Happens Next?" subtitle="Real historical price windows — was your read right?" />
        <GameResultsScreen
          score={score} total={TOTAL_ROUNDS}
          performanceSummary={score === TOTAL_ROUNDS ? 'Perfect read on every window.' : score >= TOTAL_ROUNDS * 0.6 ? 'Solid instinct for where price was headed.' : 'Real markets are noisy — keep at it.'}
          missedItems={missed} xpAwarded={xpAwarded} onReplay={replay} backHref="/practise/game" dark={dark}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="What Happens Next?" subtitle="Real historical price — predict what the next candles do." />

      <div className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-corporate-hero" />
            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              Round {round + 1} of {TOTAL_ROUNDS}
            </span>
          </div>
          {data && <span className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{data.symbol} · {data.interval}</span>}
        </div>

        {!data && !error && <LoadingIndicator phase={phase} dark={dark} />}
        {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}

        {data && (
          <>
            <CandleChart
              candles={revealed ? [...data.history, ...data.future] : data.history}
              lines={[
                { price: Math.max(...data.history.map((c) => c.high)), label: 'range high', color: dark ? '#9ca3af' : '#6b7280' },
                { price: Math.min(...data.history.map((c) => c.low)), label: 'range low', color: dark ? '#9ca3af' : '#6b7280' },
              ]}
              dark={dark}
              height={220}
            />

            <p className={`text-sm font-medium mt-4 mb-3 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              Over the next {REVEAL_COUNT} candles, what happens?
            </p>

            {!revealed ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => chooseGuess(o)}
                    className={`text-sm px-4 py-3 rounded-xl border transition-colors ${dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'}`}
                  >
                    {OUTCOME_LABEL[o]}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className={`rounded-xl p-3 mb-3 text-sm ${guess === data.correct ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                  {guess === data.correct ? 'Correct — ' : 'Not quite — '}
                  actually: {OUTCOME_LABEL[data.correct]}
                </div>
                <button onClick={nextRound} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
                  {round + 1 < TOTAL_ROUNDS ? 'Next round' : 'See results'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
