import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * CoinFlipSimulator — the tool ORIENT-04's own Practice Drill prompt
 * promises: "Using a 40% win-rate coin-flip simulator (provided in
 * Practise), run 100 simulated trades at 1% risk per trade and again
 * at 5% risk per trade with identical outcomes. Compare the two equity
 * curves and the depth of their worst drawdowns." By direct bug
 * report, this tool never existed anywhere in the frontend — the
 * prompt text showed, the simulator it referred to didn't.
 *
 * Win rate is fixed at 40% (the prompt's own number). Reward is fixed
 * at 2R per win, risk 1R per loss — a deliberately positive-expectancy
 * system at 40% (E = 0.4×2 − 0.6×1 = +0.2R) matching this lesson's own
 * Mini Quiz point ("a 35% win rate CAN still be profitable, if average
 * wins are large enough relative to average losses") — the drill's
 * point isn't that 40% is unprofitable, it's that identical underlying
 * edge can still produce very different drawdown depths depending on
 * risk-per-trade, which is exactly what "identical outcomes" (same
 * win/loss sequence fed into both risk settings) is designed to
 * isolate.
 */
const WIN_RATE = 0.4;
const REWARD_R = 2;
const RISK_PCTS = [0.01, 0.05] as const;
const STARTING_BALANCE = 10000;
const TRADE_COUNT = 100;

function runSequence(): boolean[] {
  return Array.from({ length: TRADE_COUNT }, () => Math.random() < WIN_RATE);
}

function equityCurve(outcomes: boolean[], riskPct: number): number[] {
  const curve = [STARTING_BALANCE];
  let balance = STARTING_BALANCE;
  for (const won of outcomes) {
    balance *= 1 + riskPct * (won ? REWARD_R : -1);
    curve.push(balance);
  }
  return curve;
}

function maxDrawdownPct(curve: number[]): number {
  let peak = curve[0], worst = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    worst = Math.max(worst, (peak - v) / peak);
  }
  return worst * 100;
}

export function CoinFlipSimulator({ dark }: { dark: boolean }) {
  const [outcomes, setOutcomes] = useState<boolean[] | null>(null);
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  const curves = outcomes ? RISK_PCTS.map((r) => ({ risk: r, curve: equityCurve(outcomes, r) })) : null;
  const wins = outcomes ? outcomes.filter(Boolean).length : 0;

  const w = 320, h = 140;
  const allValues = curves ? curves.flatMap((c) => c.curve) : [];
  const maxV = allValues.length ? Math.max(...allValues) : STARTING_BALANCE;
  const minV = allValues.length ? Math.min(...allValues, 0) : 0;
  const toX = (i: number) => (i / TRADE_COUNT) * w;
  const toY = (v: number) => h - ((v - minV) / (maxV - minV || 1)) * h;
  const colors = ['#005FB8', '#f59e0b'];

  return (
    <div>
      <div className={`text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
        Coin-Flip Simulator — 40% win rate, 2R reward / 1R loss
      </div>
      <button
        onClick={() => setOutcomes(runSequence())}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-corporate-hero text-white mb-3"
      >
        <RefreshCw size={13} /> {outcomes ? 'Run again (new sequence)' : 'Run 100 Trades'}
      </button>

      {outcomes && curves && (
        <div>
          <p className={`text-xs mb-2 ${mutedCls}`}>
            {wins} wins / {TRADE_COUNT - wins} losses ({(wins / TRADE_COUNT * 100).toFixed(0)}% win rate this run) —
            the SAME sequence of wins/losses is used for both risk settings below.
          </p>
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block mb-2">
            <line x1={0} y1={toY(STARTING_BALANCE)} x2={w} y2={toY(STARTING_BALANCE)} stroke={dark ? '#6b7280' : '#9ca3af'} strokeDasharray="3 3" strokeWidth={1} />
            {curves.map(({ curve }, ci) => (
              <path
                key={ci}
                d={curve.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')}
                fill="none"
                stroke={colors[ci]}
                strokeWidth={1.75}
              />
            ))}
          </svg>
          <div className="space-y-1.5">
            {curves.map(({ risk, curve }, ci) => {
              const final = curve[curve.length - 1];
              const dd = maxDrawdownPct(curve);
              return (
                <div key={ci} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-0.5" style={{ background: colors[ci] }} />
                  <span className={dark ? 'text-white' : 'text-corporate-text-on-bg'}>
                    {(risk * 100).toFixed(0)}% risk/trade:
                  </span>
                  <span className={mutedCls}>
                    final ${final.toFixed(0)} · worst drawdown {dd.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className={`text-xs mt-3 leading-relaxed ${mutedCls}`}>
            Both curves share the identical edge (40% win rate, same win/loss sequence) — the only thing that
            changed is risk-per-trade. Higher risk per trade doesn't change whether the system is profitable;
            it changes how deep the drawdowns get along the way, and how much a losing streak can cost you
            before the edge has a chance to play out.
          </p>
        </div>
      )}
    </div>
  );
}
