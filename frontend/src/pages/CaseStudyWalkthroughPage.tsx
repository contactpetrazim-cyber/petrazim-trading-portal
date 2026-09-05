import { useEffect, useState } from 'react';
import { BookOpenCheck, ArrowRight, ArrowLeft, Shuffle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CandleChart, type Candle, type ChartMarker, type ChartLine } from '../components/CandleChart';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

interface WindowData {
  symbol: string;
  candles: Candle[];
  swingHighIdx: number;
  swingLowIdx: number;
  impulseStartIdx: number;
  impulseEndIdx: number;
  impulseDirection: 'up' | 'down';
}

function analyzeWindow(symbol: string, candles: Candle[]): WindowData {
  let swingHighIdx = 0, swingLowIdx = 0;
  candles.forEach((c, i) => {
    if (c.high > candles[swingHighIdx].high) swingHighIdx = i;
    if (c.low < candles[swingLowIdx].low) swingLowIdx = i;
  });
  // The single candle with the largest real range — an honest, purely
  // computed stand-in for "the impulsive move", not a claimed SMC
  // judgment call (order block / FVG) this app can't verify
  // algorithmically with confidence on noisy real data.
  let impulseIdx = 0;
  candles.forEach((c, i) => {
    if ((c.high - c.low) > (candles[impulseIdx].high - candles[impulseIdx].low)) impulseIdx = i;
  });
  return {
    symbol, candles, swingHighIdx, swingLowIdx,
    impulseStartIdx: Math.max(0, impulseIdx - 1), impulseEndIdx: impulseIdx,
    impulseDirection: candles[impulseIdx].close >= candles[impulseIdx].open ? 'up' : 'down',
  };
}

/**
 * CaseStudyWalkthroughPage — "past price simulation cases ... live
 * price bias or entry or liquidity or demand etc", by direct request.
 * A real historical price window (GET /order-flow/klines), stepped
 * through calmly: range/bias, the real swing highs/lows (classic
 * liquidity resting points), the single largest real move in the
 * window, then the full picture. Every claim below is tied to an
 * actually-computed value from the real data (swing extremes, the
 * biggest real range) rather than an asserted SMC judgment (order
 * block / FVG / valid sweep) this app can't reliably verify on noisy,
 * unlabeled real charts — see analyzeWindow's own comment.
 */
export function CaseStudyWalkthroughPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [data, setData] = useState<WindowData | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  async function load() {
    setData(null);
    setError(null);
    setStep(0);
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const result = await fetchJsonWithRetry<{ candles: Candle[] }>(
      `${API_URL}/order-flow/klines?symbol=${symbol}&interval=4h&limit=40`,
      { headers: { Authorization: `Bearer ${token}` } },
      setPhase,
    );
    if (!result || result.candles.length < 20) {
      setError('Could not load a real price window right now — try again in a moment.');
      return;
    }
    setData(analyzeWindow(symbol, result.candles));
  }

  useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <div>
        <PageHeader title="Case Study Walkthrough" subtitle="Step through a real historical price window." />
        {!error && <LoadingIndicator phase={phase} dark={dark} />}
        {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
      </div>
    );
  }

  const startPrice = data.candles[0].open;
  const endPrice = data.candles[data.candles.length - 1].close;
  const pctChange = ((endPrice - startPrice) / startPrice) * 100;

  const STEPS: { title: string; cutIndex: number; markers: ChartMarker[]; lines: ChartLine[]; text: string }[] = [
    {
      title: '1. Range & bias',
      cutIndex: Math.min(data.swingHighIdx, data.swingLowIdx, 10),
      markers: [], lines: [],
      text: `The first part of this ${data.symbol} 4H window. Before reacting to any single candle, the first read is always the range: where has price actually traded, and is it trending or rotating?`,
    },
    {
      title: '2. Liquidity — the real swing extremes',
      cutIndex: Math.max(data.swingHighIdx, data.swingLowIdx) + 1,
      markers: [
        { index: data.swingHighIdx, price: data.candles[data.swingHighIdx].high, label: 'swing high', color: '#ef4444', side: 'above' },
        { index: data.swingLowIdx, price: data.candles[data.swingLowIdx].low, label: 'swing low', color: '#22c55e', side: 'below' },
      ],
      lines: [],
      text: `The genuine swing high and swing low of the window so far — real resting-liquidity points (stops tend to cluster just beyond them). Whether either gets swept before the next real move is exactly what OF-02/OF-05 (tape + DOM) exist to help read live.`,
    },
    {
      title: '3. The largest real move',
      cutIndex: data.candles.length,
      markers: [
        { index: data.impulseEndIdx, price: data.impulseDirection === 'up' ? data.candles[data.impulseEndIdx].high : data.candles[data.impulseEndIdx].low, label: `biggest range candle (${data.impulseDirection})`, color: '#8b5cf6', side: data.impulseDirection === 'up' ? 'above' : 'below' },
      ],
      lines: [],
      text: `The single largest-range candle in this window, computed directly from the real data — the most decisive real move price made here. A move like this is exactly the kind of candle Setup Spotter and the Visual Glossary's Order Block/FVG diagrams describe conceptually.`,
    },
    {
      title: '4. Outcome',
      cutIndex: data.candles.length,
      markers: [],
      lines: [{ price: startPrice, label: 'start', dashed: true }],
      text: `From ${startPrice.toFixed(startPrice >= 100 ? 0 : 2)} to ${endPrice.toFixed(endPrice >= 100 ? 0 : 2)} — a real ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% over this window. This is what actually happened, already settled — the point of a case study isn't "this proves the strategy," it's practicing reading real structure calmly, after the fact.`,
    },
  ];

  const s = STEPS[step];
  const visible = data.candles.slice(0, s.cutIndex || data.candles.length);

  return (
    <div>
      <PageHeader title="Case Study Walkthrough" subtitle="Step through a real historical price window, one read at a time." />
      <div className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpenCheck size={16} className="text-corporate-hero" />
            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{s.title}</span>
          </div>
          <span className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>{data.symbol} · 4H · real data</span>
        </div>

        <CandleChart candles={visible} markers={step >= 1 ? s.markers : []} lines={step >= 3 ? s.lines : []} dark={dark} height={220} />

        <p className={`text-sm leading-relaxed mt-4 mb-4 ${dark ? 'text-white/70' : 'text-gray-700'}`}>{s.text}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((n) => Math.max(0, n - 1))}
            disabled={step === 0}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl disabled:opacity-30 ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === step ? '#0891b2' : dark ? 'rgba(255,255,255,0.15)' : '#e5e7eb' }} />
            ))}
          </div>
          {step + 1 < STEPS.length ? (
            <button onClick={() => setStep((n) => n + 1)} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero">
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={load} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero">
              <Shuffle size={14} /> New case
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
