// Trading Time Slots — the shared session/day/half-day scheduling
// vocabulary, by direct request (real forex session hours supplied
// directly, converted to UTC) — "integrate the following ... summarise
// into trading time slots ... integrate as quick filters for the semi
// auto and normal bot setups ... also include for global settings for
// manual trading ... also include an 'All'". Mirrors backend/app/
// services/trading_sessions.py's own TRADING_SESSIONS exactly — same
// keys, same UTC hours — so a selection means the identical window
// everywhere it's used (bot schedules, Sub-Auto, and Manual Trading's
// own Global Settings).
//
// Forex doesn't have a single open/close bell like a stock exchange —
// volume peaks when major global hubs are open AT THE SAME TIME (an
// "overlap"), not on one fixed schedule:
//   CORE (high volume, tightest spreads): the London/New York overlap
//     (the single heaviest window of the day) and the Tokyo/London
//     overlap (a secondary core window).
//   NON-CORE (low volume, wider spreads): the Asian session (liquid
//     mainly for AUD/NZD/JPY, thin for majors) and the Twilight Zone —
//     the gap between the New York close and the Tokyo open, the
//     single lowest-volume window of the day.

export interface TradingSession {
  key: string;
  label: string;
  /** UTC hour range, end-exclusive. */
  startUtc: number;
  endUtc: number;
  tier: 'core' | 'non-core';
}

export const TRADING_SESSIONS: TradingSession[] = [
  { key: 'london_ny_overlap', label: 'London/NY Overlap', startUtc: 13, endUtc: 17, tier: 'core' },
  { key: 'tokyo_london_overlap', label: 'Tokyo/London Overlap', startUtc: 7, endUtc: 9, tier: 'core' },
  { key: 'asian', label: 'Asian Session', startUtc: 0, endUtc: 9, tier: 'non-core' },
  { key: 'twilight', label: 'Twilight Zone', startUtc: 22, endUtc: 24, tier: 'non-core' },
];

export const WEEKDAYS: { key: number; label: string }[] = [
  { key: 0, label: 'Mon' }, { key: 1, label: 'Tue' }, { key: 2, label: 'Wed' },
  { key: 3, label: 'Thu' }, { key: 4, label: 'Fri' }, { key: 5, label: 'Sat' }, { key: 6, label: 'Sun' },
];

export function tradingSessionLabel(key: string): string {
  return TRADING_SESSIONS.find((s) => s.key === key)?.label || key;
}
