import type { EmpireSimConfig } from '../components/EmpireSimEngine';

/**
 * Trade Management Desk — fourth Team Empire Sim config (Section 10b:
 * "one shared engine + N configs"), themed to the platform's own
 * Trade Management track rather than a generic business scenario.
 * Every round starts from an already-valid, already-entered trade —
 * this config is deliberately not about whether to take a setup (that
 * ground belongs to Prop Firm/Psychology/Order Flow), but about what
 * you do with a position once you're in it: breakeven timing, partial
 * profit-taking, trailing vs fixed targets, and pyramiding into
 * strength. Tracks equity alongside capture_pct — a running "how much
 * of the trade's eventual move did you actually keep" percentage,
 * since good trade management is explicitly about capturing more of
 * a move that's already working, not just avoiding losers. 8 rounds,
 * same weighted-not-deterministic outcome shape as the other three
 * configs (ES03: a better-aligned choice skews the odds, never
 * guarantees the result).
 */
export const TRADE_MANAGEMENT_EMPIRE_CONFIG: EmpireSimConfig = {
  theme: 'Trade Management Desk',
  startingMetrics: { equity: 60000, capture_pct: 50 },
  metricLabels: {
    equity: { label: 'Equity', format: 'currency' },
    capture_pct: { label: 'Move Captured', format: 'percent' },
  },
  primaryMetric: 'equity',
  rounds: [
    {
      id: 't1', prompt: 'Trade 1. You\'re +1R on a fresh entry — right where you\'d normally consider moving the stop.',
      options: [
        { label: 'Move stop to breakeven now, lock out the risk', outcomes: [
          { label: 'Price ran further, breakeven held the whole way', probability: 0.55, metricDeltas: { equity: 1400, capture_pct: 3 } },
          { label: 'Shaken out at breakeven on a normal pullback', probability: 0.45, metricDeltas: { equity: 0, capture_pct: -6 } },
        ] },
        { label: 'Leave the original stop — give it the room the plan called for', outcomes: [
          { label: 'Pullback held above original stop, trade ran further', probability: 0.6, metricDeltas: { equity: 2200, capture_pct: 5 } },
          { label: 'Reversed hard, full stop hit', probability: 0.4, metricDeltas: { equity: -1000, capture_pct: -3 } },
        ] },
      ],
    },
    {
      id: 't2', prompt: 'Trade 2. A position hits your first target — the level you\'d planned to take partial profit at.',
      options: [
        { label: 'Take the planned partial, trail the rest', outcomes: [
          { label: 'Remainder ran well past target', probability: 0.55, metricDeltas: { equity: 2600, capture_pct: 8 } },
          { label: 'Remainder reversed back to breakeven', probability: 0.45, metricDeltas: { equity: 1200, capture_pct: -2 } },
        ] },
        { label: 'Hold the whole position — "it\'s clearly going further"', outcomes: [
          { label: 'It did go further, full size', probability: 0.4, metricDeltas: { equity: 4000, capture_pct: 10 } },
          { label: 'Reversed from the target, gave the whole thing back', probability: 0.6, metricDeltas: { equity: -500, capture_pct: -10 } },
        ] },
      ],
    },
    {
      id: 't3', prompt: 'Trade 3. Price stalls right below a level you know is a magnet for stops just above it.',
      options: [
        { label: 'Trail the stop tight — protect what\'s already banked', outcomes: [
          { label: 'Stalled further, then reversed — trail saved most of the gain', probability: 0.5, metricDeltas: { equity: 900, capture_pct: 2 } },
          { label: 'Broke through cleanly right after — trailed out early', probability: 0.5, metricDeltas: { equity: 600, capture_pct: -8 } },
        ] },
        { label: 'Give it room to run the stops, keep the original stop', outcomes: [
          { label: 'Ran the stops and kept going', probability: 0.5, metricDeltas: { equity: 2400, capture_pct: 9 } },
          { label: 'Never broke through, gave back the stall', probability: 0.5, metricDeltas: { equity: -300, capture_pct: -4 } },
        ] },
      ],
    },
    {
      id: 't4', prompt: 'Trade 4. You\'re deep in profit and a genuinely fresh, aligned setup forms in the same direction.',
      options: [
        { label: 'Add a small pyramid at reduced size, tighten the combined stop', outcomes: [
          { label: 'The add worked, bigger combined result', probability: 0.5, metricDeltas: { equity: 3200, capture_pct: 6 } },
          { label: 'Reversed, gave back the add and some of the original', probability: 0.5, metricDeltas: { equity: -1400, capture_pct: -5 } },
        ] },
        { label: 'Leave the position alone — one trade, one size, no adds', outcomes: [
          { label: 'Original position kept running', probability: 0.6, metricDeltas: { equity: 1800, capture_pct: 4 } },
          { label: 'Original position reversed on normal noise', probability: 0.4, metricDeltas: { equity: -400, capture_pct: -2 } },
        ] },
      ],
    },
    {
      id: 't5', prompt: 'Trade 5. Two prior trades this week got trailed out for tiny gains right before they ran hard without you.',
      options: [
        { label: 'Widen the trail formula going forward — give trades more room', outcomes: [
          { label: 'Wider trail captured a real move this time', probability: 0.55, metricDeltas: { equity: 2000, capture_pct: 10 } },
          { label: 'Wider trail gave back more on a normal reversal', probability: 0.45, metricDeltas: { equity: -1200, capture_pct: -6 } },
        ] },
        { label: 'Keep the same trail — two bad outcomes isn\'t a broken system', outcomes: [
          { label: 'Trail did its job this time, clean capture', probability: 0.55, metricDeltas: { equity: 1500, capture_pct: 5 } },
          { label: 'A third early trail-out right before a runner', probability: 0.45, metricDeltas: { equity: 700, capture_pct: -7 } },
        ] },
      ],
    },
    {
      id: 't6', prompt: 'Trade 6. A position is underwater but still within its planned stop, on a setup you still believe in.',
      options: [
        { label: 'Do nothing — let the original stop and plan play out', outcomes: [
          { label: 'Recovered and hit target', probability: 0.5, metricDeltas: { equity: 1900, capture_pct: 4 } },
          { label: 'Stopped out as planned', probability: 0.5, metricDeltas: { equity: -900, capture_pct: -1 } },
        ] },
        { label: 'Average in at the worse price to improve cost basis', outcomes: [
          { label: 'Recovered — averaging paid off', probability: 0.4, metricDeltas: { equity: 2800, capture_pct: 3 } },
          { label: 'Kept dropping — averaging doubled the damage', probability: 0.6, metricDeltas: { equity: -2600, capture_pct: -8 } },
        ] },
      ],
    },
    {
      id: 't7', prompt: 'Trade 7. Capture rate is climbing. A textbook trend trade is running cleanly with no signs of exhaustion.',
      options: [
        { label: 'Keep trailing exactly as the plan specifies', outcomes: [
          { label: 'Trail rode it to a strong finish', probability: 0.58, metricDeltas: { equity: 2600, capture_pct: 7 } },
          { label: 'Trail caught a normal-sized pullback exit', probability: 0.42, metricDeltas: { equity: 1000, capture_pct: -2 } },
        ] },
        { label: 'Set a hard target and exit fully there — lock in the number', outcomes: [{ label: 'Hit the target, exited clean', probability: 1, metricDeltas: { equity: 1800, capture_pct: -3 } }] },
      ],
    },
    {
      id: 't8', prompt: 'Trade 8 — final trade. Wherever capture rate and equity sit now is close to the final scoreboard.',
      options: [
        { label: 'Manage it exactly like every prior trade, no changes', outcomes: [
          { label: 'One more well-managed result', probability: 0.58, metricDeltas: { equity: 2000, capture_pct: 5 } },
          { label: 'A normal, accepted give-back on exit', probability: 0.42, metricDeltas: { equity: 400, capture_pct: -3 } },
        ] },
        { label: 'Hold past every planned exit — "let it run for the finale"', outcomes: [
          { label: 'It kept running, big finish', probability: 0.35, metricDeltas: { equity: 4200, capture_pct: 12 } },
          { label: 'Reversed past every exit, gave most of it back', probability: 0.65, metricDeltas: { equity: -1800, capture_pct: -14 } },
        ] },
      ],
    },
  ],
};
