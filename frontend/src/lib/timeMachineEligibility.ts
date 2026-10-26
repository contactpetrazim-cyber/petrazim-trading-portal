import type { Trade } from '../types';

// The same five exchanges Time Machine's own dropdown offers -- a
// trade filled on anything else (forex/MT broker_name values like
// "metatrader"/"tradelocker") has no real candle history this feature
// could replay against.
export const TIME_MACHINE_EXCHANGES = ['okx', 'binance', 'bybit', 'bingx', 'mexc'];

// The trade's ORIGINAL plan, not its live/mutated columns -- a bot
// trade that's already run past TP1 gets its stop_loss ratcheted
// toward (or past) entry_price to lock in profit (position_monitor.py's
// breakeven/trailing mechanic), which can leave the LIVE stop_loss
// equal to or on the wrong side of entry_price. That's correct, real
// data, not a broken trade -- but it fails the plain entry/stop/
// target ordering check below if checked against the live columns.
// initial_stop_loss/initial_take_profit_1 are immutable snapshots
// taken at order creation (see Trade.initial_stop_loss's own backend
// comment), always consistent with entry_price by construction.
// Falls back to the live columns only for a trade that predates the
// snapshot (initial_* still null).
export function originalPlan(t: Trade): { stop: number; target: number | null } {
  return {
    stop: t.initial_stop_loss ?? t.stop_loss,
    target: t.initial_take_profit_1 ?? t.take_profit,
  };
}

/**
 * Whether Time Machine could actually replay this trade's plan: a
 * real entry price, a real target, a valid long/short price ordering
 * (checked against the ORIGINAL plan via originalPlan above, not the
 * live/ratcheted one), and a ccxt exchange Time Machine can fetch
 * real candles for. Shared by the "Add from" picker and every
 * "Check odds" link so a trade Time Machine genuinely can't replay
 * never offers a link that just leads to an error.
 */
export function isTimeMachineEligible(t: Trade): boolean {
  const exch = (t.broker_name || '').toLowerCase();
  if (!TIME_MACHINE_EXCHANGES.includes(exch)) return false;
  if (t.entry_price == null) return false;
  const { stop, target } = originalPlan(t);
  if (target == null) return false;
  if (t.direction === 'long') return stop < t.entry_price && t.entry_price < target;
  return target < t.entry_price && t.entry_price < stop;
}
