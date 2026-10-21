import { useEffect, useRef, useState } from 'react';
import { Activity, Play, Pause, RotateCcw, AlertTriangle } from 'lucide-react';
import { curriculumApi } from '../services/api';
import type { BotSimulationResponse } from '../types';
import { CandleChart, type Candle, type ChartZone, type ChartMarker } from './CandleChart';

const STEP_MS = 450;

/**
 * BotSimulationPlayer — SMC Bot Academy plan item 6, the animated
 * "watch it happen" bar-by-bar walkthrough (buzzing-mixing-micali.md,
 * SMC Bot Academy section, plan item 6): calls the already-shipped
 * `GET /curriculum/bots/{bot_id}/simulation` (`curriculumApi.
 * getBotSimulation`, `bot_simulation.py`'s `compute_bot_simulation`)
 * and steps through its real historical candle window on a timer,
 * revealing each zone/marker only once candle playback reaches the
 * step it was FIRST, no-lookahead, detected at (`reveal_bar_index`) —
 * never shown ahead of when the bot's own real detectors would
 * actually have produced it.
 *
 * Direction is a toggle rather than two separate instances (the
 * plan's own "your call on UX, but both directions must be reachable"
 * — simplest option that still reaches both a LONG and a SHORT
 * example per bot without doubling the number of mounted components/
 * API calls on a page that already renders several other panels).
 *
 * Per the plan's own non-negotiable ("no fake live prices ...
 * synthetic examples labeled as such"): `source: 'real_market_
 * fallback'` is surfaced as an explicit amber notice, never silently
 * presented as if it were this bot's own real trade — the backend's
 * own `label` string (already written to say exactly this) is shown
 * verbatim rather than paraphrased.
 */
export function BotSimulationPlayer({ botId, dark = false }: { botId: string; dark?: boolean }) {
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [data, setData] = useState<BotSimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setStep(0);
    curriculumApi.getBotSimulation(botId, direction)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => {
        if (cancelled) return;
        setData(null);
        setError(e?.response?.data?.detail || 'Could not load this simulation right now.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [botId, direction]);

  const lastIndex = data ? data.bars.length - 1 : 0;

  useEffect(() => {
    if (!playing || !data) return;
    intervalRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= lastIndex) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, data, lastIndex]);

  function reset() {
    setPlaying(false);
    setStep(0);
  }

  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  const tabCls = (active: boolean) =>
    `flex-1 text-xs font-semibold py-1.5 rounded-lg ${
      active ? 'bg-corporate-hero text-white' : dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-600'
    }`;

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
        <span className={`text-sm font-semibold ${textCls}`}>Watch it happen — bot simulation</span>
      </div>

      <div className="flex gap-1.5 mb-3">
        <button className={tabCls(direction === 'long')} onClick={() => setDirection('long')}>Long example</button>
        <button className={tabCls(direction === 'short')} onClick={() => setDirection('short')}>Short example</button>
      </div>

      {loading && <p className={`text-xs ${mutedCls}`}>Loading a real candle window to animate…</p>}

      {!loading && error && (
        <p className={`text-xs ${mutedCls}`}>Simulation unavailable: {error}</p>
      )}

      {!loading && !error && data && (
        <>
          {data.source === 'real_market_fallback' ? (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{data.label}</span>
            </div>
          ) : (
            <p className={`text-xs mb-3 ${mutedCls}`}>{data.label}</p>
          )}

          <CandleChart
            candles={data.bars.slice(0, step + 1).map((b): Candle => ({ open: b.open, high: b.high, low: b.low, close: b.close }))}
            zones={data.zones
              .filter((z) => z.reveal_bar_index <= step)
              .map((z): ChartZone => ({
                fromIndex: z.from_index,
                toIndex: Math.min(z.to_index, step),
                priceTop: z.top,
                priceBottom: z.bottom,
                color: z.color,
                label: z.label,
              }))}
            markers={data.markers
              .filter((m) => m.reveal_bar_index <= step)
              .map((m): ChartMarker => ({
                index: m.index,
                price: m.price,
                label: m.label,
                color: m.color,
                side: m.side,
                shape: m.shape,
              }))}
            dark={dark}
            height={240}
          />

          <div className={`h-1.5 rounded-full overflow-hidden mt-3 mb-1 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
            <div
              className="h-full bg-corporate-hero rounded-full transition-all"
              style={{ width: `${lastIndex > 0 ? (step / lastIndex) * 100 : 100}%` }}
            />
          </div>
          <p className={`text-[11px] mb-3 ${mutedCls}`}>
            Step {step + 1} / {lastIndex + 1} · {data.base_timeframe} candles · {data.symbol}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!playing && step >= lastIndex) setStep(0);
                setPlaying((p) => !p);
              }}
              disabled={lastIndex === 0}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white py-2 rounded-xl bg-corporate-hero disabled:opacity-40"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : step >= lastIndex ? 'Replay' : 'Play'}
            </button>
            <button onClick={reset} aria-label="Reset simulation" className={`px-3 rounded-xl ${dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-500'}`}>
              <RotateCcw size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
