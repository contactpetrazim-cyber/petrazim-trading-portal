import { useState } from 'react';
import { CandleChart, type Candle, type ChartLine } from '../CandleChart';

/**
 * RRSimulator — shared SMC-concept component (SMC Bot Academy plan
 * item 3): a standalone entry/stop/target -> risk-distance / R:R
 * ratio / illustrative $ loss-or-gain simulator.
 *
 * Deliberately NOT a prediction or recommendation tool — it only
 * does the same arithmetic `EntryExitEngine.calculate_lot_size` and
 * `calculate_targets` do on real numbers a user types in here. No
 * live price feed, no order-placement capability, and an explicit
 * caveat that this platform's real P&L (confirmed elsewhere this
 * session) has zero fee/slippage/spread modeling today either —
 * this simulator inherits that same gap rather than hiding it behind
 * a falsely precise number.
 */
export function RRSimulator({ dark = false }: { dark?: boolean }) {
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(98);
  const [target, setTarget] = useState(106);
  const [accountBalance, setAccountBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);

  const isLong = target > entry;
  const riskDistance = Math.abs(entry - stop);
  const rewardDistance = Math.abs(target - entry);
  const rrRatio = riskDistance > 0 ? rewardDistance / riskDistance : 0;

  const riskDollars = accountBalance * (riskPercent / 100);
  const rewardDollars = riskDollars * rrRatio;

  const directionValid = isLong ? stop < entry && target > entry : stop > entry && target < entry;

  const candles: Candle[] = [
    { open: entry - riskDistance * 0.3, high: entry + riskDistance * 0.2, low: entry - riskDistance * 0.4, close: entry },
    { open: entry, high: entry + riskDistance * 0.1, low: entry - riskDistance * 0.1, close: entry },
  ];

  const lines: ChartLine[] = [
    { price: entry, label: `Entry ${entry.toFixed(2)}`, color: '#2563eb' },
    { price: stop, label: `Stop ${stop.toFixed(2)}`, color: '#ef4444' },
    { price: target, label: `Target ${target.toFixed(2)}`, color: '#22c55e' },
  ];

  const cardCls = `rounded-2xl p-5 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const inputCls = `w-full text-sm rounded-lg px-3 py-2 border ${
    dark ? 'bg-white/5 border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
  const labelCls = `text-[11px] font-semibold mb-1 block ${mutedCls}`;

  return (
    <div className={cardCls}>
      <div className={`text-sm font-semibold mb-3 ${textCls}`}>R:R / R-Multiple Simulator</div>

      <CandleChart candles={candles} lines={lines} dark={dark} height={200} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <div>
          <label className={labelCls}>Entry price</label>
          <input type="number" className={inputCls} value={entry} onChange={(e) => setEntry(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Stop price</label>
          <input type="number" className={inputCls} value={stop} onChange={(e) => setStop(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Target price</label>
          <input type="number" className={inputCls} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Account balance ($)</label>
          <input type="number" className={inputCls} value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Risk per trade (%)</label>
          <input type="number" step={0.1} className={inputCls} value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} />
        </div>
      </div>

      {!directionValid && (
        <div className="mt-3 text-xs rounded-lg p-3 bg-amber-500/15 text-amber-600">
          These three prices aren't a coherent {isLong ? 'long' : 'short'} setup — stop and target
          should sit on opposite sides of entry, in the direction implied by target vs. entry.
        </div>
      )}

      <div className={`mt-3 text-xs rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
        <div className={textCls}>
          Risk distance: <span className="font-semibold">{riskDistance.toFixed(2)}</span> · Reward
          distance: <span className="font-semibold">{rewardDistance.toFixed(2)}</span> · R:R ratio:{' '}
          <span className="font-semibold">{rrRatio.toFixed(2)}:1</span>
        </div>
        <div className={textCls}>
          Illustrative risk: <span className="font-semibold text-red-500">-${riskDollars.toFixed(2)}</span>
          {' · '}
          Illustrative reward: <span className="font-semibold text-green-500">+${rewardDollars.toFixed(2)}</span>
        </div>
        <div className={`mt-1 ${mutedCls}`}>
          Illustrative only — NOT a guaranteed return and not a trade
          recommendation. This simulator has no fee, slippage, or
          spread modeling, matching this platform's own real live
          P&L path today (confirmed to have none either); real
          results will differ from this arithmetic. No order can be
          placed from this component.
        </div>
      </div>
    </div>
  );
}
