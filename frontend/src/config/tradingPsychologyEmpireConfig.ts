import type { EmpireSimConfig } from '../components/EmpireSimEngine';

/**
 * Trading Psychology Gauntlet — second Team Empire Sim config (Section
 * 10b: "one shared engine + N configs"), themed to the platform's own
 * Trading Psychology track rather than a generic business scenario.
 * Tracks equity (the same currency metric every config uses, so
 * outcomes stay comparable) alongside tilt_pct — a 0-100 "how rattled
 * is this trader right now" gauge that rises on revenge trades, FOMO
 * entries and forced setups, and falls on cool-off/journaling choices.
 * 8 rounds, same weighted-not-deterministic outcome shape as
 * propFirmEmpireConfig (ES03: a well-aligned choice skews odds, never
 * guarantees the result).
 */
export const TRADING_PSYCHOLOGY_EMPIRE_CONFIG: EmpireSimConfig = {
  theme: 'Trading Psychology Gauntlet',
  startingMetrics: { equity: 50000, tilt_pct: 10 },
  metricLabels: {
    equity: { label: 'Equity', format: 'currency' },
    tilt_pct: { label: 'Tilt', format: 'percent' },
  },
  primaryMetric: 'equity',
  rounds: [
    {
      id: 'w1', prompt: 'Week 1. A clean setup you have backtested a hundred times triggers right on schedule.',
      options: [
        { label: 'Take it exactly as planned, no hesitation', outcomes: [
          { label: 'Textbook win', probability: 0.6, metricDeltas: { equity: 1200, tilt_pct: -2 } },
          { label: 'Normal loss, plan still valid', probability: 0.4, metricDeltas: { equity: -800, tilt_pct: 3 } },
        ] },
        { label: 'Hesitate, second-guess it, enter late', outcomes: [
          { label: 'Worse entry, smaller win', probability: 0.5, metricDeltas: { equity: 400, tilt_pct: 4 } },
          { label: 'Worse entry, full loss anyway', probability: 0.5, metricDeltas: { equity: -800, tilt_pct: 6 } },
        ] },
      ],
    },
    {
      id: 'w2', prompt: 'Week 2. You just took a loss on a valid setup. Another A-grade signal appears an hour later.',
      options: [
        { label: 'Journal the loss first, then take the new signal on plan', outcomes: [
          { label: 'Clear head, clean win', probability: 0.58, metricDeltas: { equity: 1400, tilt_pct: -4 } },
          { label: 'Clear head, normal loss', probability: 0.42, metricDeltas: { equity: -800, tilt_pct: -1 } },
        ] },
        { label: 'Jump straight in to "get it back" — no journaling', outcomes: [
          { label: 'Recovered', probability: 0.4, metricDeltas: { equity: 1400, tilt_pct: 5 } },
          { label: 'A second loss, tilt building', probability: 0.6, metricDeltas: { equity: -800, tilt_pct: 12 } },
        ] },
      ],
    },
    {
      id: 'w3', prompt: 'Week 3. Tilt is climbing. A trade you\'re in moves against you slightly — well within your planned stop.',
      options: [
        { label: 'Leave the stop exactly where the plan says', outcomes: [
          { label: 'Price recovers, trade works', probability: 0.5, metricDeltas: { equity: 1000, tilt_pct: -2 } },
          { label: 'Stopped out as planned', probability: 0.5, metricDeltas: { equity: -700, tilt_pct: 1 } },
        ] },
        { label: 'Widen the stop mid-trade "to give it room"', outcomes: [
          { label: 'Price recovers, bigger win', probability: 0.5, metricDeltas: { equity: 1600, tilt_pct: -1 } },
          { label: 'Kept dropping — a much bigger loss than planned', probability: 0.5, metricDeltas: { equity: -2200, tilt_pct: 15 } },
        ] },
      ],
    },
    {
      id: 'w4', prompt: 'Week 4. Tilt is high. You watch a huge move happen on a pair you weren\'t in — pure FOMO kicks in.',
      options: [
        { label: 'Let it go — it wasn\'t your setup', outcomes: [{ label: 'No trade, tilt cools slightly', probability: 1, metricDeltas: { equity: 0, tilt_pct: -6 } }] },
        { label: 'Chase it late, no real entry plan', outcomes: [
          { label: 'Lucky, caught the tail end', probability: 0.3, metricDeltas: { equity: 900, tilt_pct: 4 } },
          { label: 'Chased the top/bottom, reversed on you', probability: 0.7, metricDeltas: { equity: -1500, tilt_pct: 14 } },
        ] },
      ],
    },
    {
      id: 'w5', prompt: 'Week 5. Three losses this week already. Tilt is very high. A genuinely valid A+ setup forms.',
      options: [
        { label: 'Step away from the screen for the rest of the day instead', outcomes: [{ label: 'No trade, but tilt drops meaningfully', probability: 1, metricDeltas: { equity: 0, tilt_pct: -15 } }] },
        { label: 'Take it at normal size — the setup itself is fine', outcomes: [
          { label: 'A genuine, needed win', probability: 0.55, metricDeltas: { equity: 1300, tilt_pct: -8 } },
          { label: 'A fourth loss — hard to stay objective this tilted', probability: 0.45, metricDeltas: { equity: -900, tilt_pct: 10 } },
        ] },
        { label: 'Double size — "one big win fixes the week"', outcomes: [
          { label: 'Recovered the whole week', probability: 0.35, metricDeltas: { equity: 2600, tilt_pct: -5 } },
          { label: 'Blew through the daily loss limit', probability: 0.65, metricDeltas: { equity: -3600, tilt_pct: 25 } },
        ] },
      ],
    },
    {
      id: 'w6', prompt: 'Week 6. A calmer week. Equity is recovering. A mediocre B-grade setup appears out of boredom, not real signal quality.',
      options: [
        { label: 'Pass — the bar doesn\'t move because you\'re bored', outcomes: [{ label: 'No trade, discipline holds', probability: 1, metricDeltas: { equity: 0, tilt_pct: -1 } }] },
        { label: 'Take it small "just to stay active"', outcomes: [
          { label: 'Worked out anyway', probability: 0.45, metricDeltas: { equity: 500, tilt_pct: 0 } },
          { label: 'An avoidable, low-quality loss', probability: 0.55, metricDeltas: { equity: -400, tilt_pct: 3 } },
        ] },
      ],
    },
    {
      id: 'w7', prompt: 'Week 7. A string of wins has equity well ahead of plan. A slightly-oversized position starts looking tempting.',
      options: [
        { label: 'Keep exact same risk per trade regardless of the streak', outcomes: [
          { label: 'Another clean win', probability: 0.58, metricDeltas: { equity: 1500, tilt_pct: -3 } },
          { label: 'Normal loss, streak breaks calmly', probability: 0.42, metricDeltas: { equity: -900, tilt_pct: 2 } },
        ] },
        { label: 'Size up because "I\'m clearly reading the market well right now"', outcomes: [
          { label: 'A big win extends the streak', probability: 0.45, metricDeltas: { equity: 3200, tilt_pct: -2 } },
          { label: 'Overconfidence meets a normal loss, sized up', probability: 0.55, metricDeltas: { equity: -2400, tilt_pct: 9 } },
        ] },
      ],
    },
    {
      id: 'w8', prompt: 'Week 8 — final week. Wherever equity sits now is close to where the gauntlet ends.',
      options: [
        { label: 'Stick to the plan exactly as every prior week', outcomes: [
          { label: 'One more clean, on-plan result', probability: 0.55, metricDeltas: { equity: 1200, tilt_pct: -2 } },
          { label: 'A normal, accepted loss', probability: 0.45, metricDeltas: { equity: -800, tilt_pct: 1 } },
        ] },
        { label: 'Force extra trades to "finish strong"', outcomes: [
          { label: 'Paid off', probability: 0.35, metricDeltas: { equity: 2000, tilt_pct: 3 } },
          { label: 'Gave back ground on forced, low-quality trades', probability: 0.65, metricDeltas: { equity: -1800, tilt_pct: 11 } },
        ] },
      ],
    },
  ],
};
