import { useEffect, useRef, useState } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';

const PRESETS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '5 min', seconds: 5 * 60 },
];

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * FocusTimer — Section 12 of the Learning Design Spec: "standalone
 * Pomodoro widget, session-only, no persistence." Pure client-side by
 * design (the spec's own words) — no backend, no store, resets on
 * refresh/navigation away, exactly as spec'd.
 */
export function FocusTimer({ dark = false }: { dark?: boolean }) {
  const [total, setTotal] = useState(PRESETS[0].seconds);
  const [remaining, setRemaining] = useState(PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function selectPreset(seconds: number) {
    setRunning(false);
    setTotal(seconds);
    setRemaining(seconds);
  }

  function reset() {
    setRunning(false);
    setRemaining(total);
  }

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  return (
    <div className={`rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Timer size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Focus Timer</span>
      </div>

      <div className="text-center mb-3">
        <div className={`text-4xl font-bold font-display ${remaining === 0 ? 'text-emerald-500' : dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          {remaining === 0 ? 'Done' : fmt(remaining)}
        </div>
      </div>

      <div className={`h-1.5 rounded-full overflow-hidden mb-4 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div className="h-full bg-corporate-hero rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.seconds}
            onClick={() => selectPreset(p.seconds)}
            className={`flex-1 text-xs py-1.5 rounded-lg ${
              total === p.seconds ? 'bg-corporate-hero text-white' : dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white py-2 rounded-xl bg-corporate-hero disabled:opacity-40"
        >
          {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={reset} aria-label="Reset timer" className={`px-3 rounded-xl ${dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-500'}`}>
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
