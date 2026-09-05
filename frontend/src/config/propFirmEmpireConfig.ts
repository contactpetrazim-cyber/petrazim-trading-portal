import type { EmpireSimConfig } from '../components/EmpireSimEngine';

/**
 * Prop Firm Growth Challenge — Section 10b's Team Empire Sim, themed
 * to this platform's own real subject matter (funded-account risk
 * management, the same vocabulary as ToolsPage's Payout Optimizer and
 * Prop-Firm Simulator) rather than the reference's generic business
 * pillars. 8 rounds, each a week of a funded-account challenge with a
 * risk posture choice — Conservative/Balanced/Aggressive — each
 * carrying weighted outcomes so a better-aligned choice skews the odds
 * without ever guaranteeing the result (ES03).
 */
export const PROP_FIRM_EMPIRE_CONFIG: EmpireSimConfig = {
  theme: 'Prop Firm Growth Challenge',
  startingMetrics: { equity: 100000, drawdown_pct: 0 },
  metricLabels: {
    equity: { label: 'Equity', format: 'currency' },
    drawdown_pct: { label: 'Drawdown', format: 'percent' },
  },
  primaryMetric: 'equity',
  rounds: [
    {
      id: 'w1', prompt: 'Week 1. The challenge starts calm — light volatility, no strong setups yet.',
      options: [
        { label: 'Conservative — sit out, wait for a real setup', outcomes: [{ label: 'Preserved capital, no progress', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
        { label: 'Balanced — take only your A-grade setups', outcomes: [
          { label: 'A clean 1.5R win', probability: 0.55, metricDeltas: { equity: 1500, drawdown_pct: -0.2 } },
          { label: 'A normal 1R loss', probability: 0.45, metricDeltas: { equity: -1000, drawdown_pct: 1.0 } },
        ] },
        { label: 'Aggressive — force trades to get ahead early', outcomes: [
          { label: 'A lucky 2R win', probability: 0.35, metricDeltas: { equity: 3000, drawdown_pct: 0.5 } },
          { label: 'Two forced losses', probability: 0.65, metricDeltas: { equity: -2400, drawdown_pct: 2.4 } },
        ] },
      ],
    },
    {
      id: 'w2', prompt: 'Week 2. A genuine A+ setup forms right at your key level.',
      options: [
        { label: 'Take it at your normal 1% risk', outcomes: [
          { label: 'Full 2.5R win', probability: 0.6, metricDeltas: { equity: 2500, drawdown_pct: -0.3 } },
          { label: 'Stopped for 1R', probability: 0.4, metricDeltas: { equity: -1000, drawdown_pct: 1.0 } },
        ] },
        { label: 'Size up to 2% — it looks unusually clean', outcomes: [
          { label: 'Full 2.5R win, sized up', probability: 0.6, metricDeltas: { equity: 5000, drawdown_pct: -0.3 } },
          { label: 'Stopped for 1R, sized up', probability: 0.4, metricDeltas: { equity: -2000, drawdown_pct: 2.0 } },
        ] },
        { label: 'Skip it — save risk budget for later', outcomes: [{ label: 'No change', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
      ],
    },
    {
      id: 'w3', prompt: 'Week 3. Two losses in a row put you at -3% drawdown, close to a 5% daily-style limit mindset.',
      options: [
        { label: 'Stop trading this week — protect the account', outcomes: [{ label: 'Drawdown holds, no new progress', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
        { label: 'One careful A-grade trade only', outcomes: [
          { label: 'Recovered with a 1.5R win', probability: 0.5, metricDeltas: { equity: 1500, drawdown_pct: -0.5 } },
          { label: 'A third loss — deeper drawdown', probability: 0.5, metricDeltas: { equity: -1000, drawdown_pct: 1.5 } },
        ] },
        { label: 'Revenge-size to make it back fast', outcomes: [
          { label: 'Recovered big', probability: 0.25, metricDeltas: { equity: 3000, drawdown_pct: -0.2 } },
          { label: 'Breached the drawdown limit', probability: 0.75, metricDeltas: { equity: -5000, drawdown_pct: 5.0 } },
        ] },
      ],
    },
    {
      id: 'w4', prompt: 'Week 4. Markets are trending cleanly in your system\'s favor.',
      options: [
        { label: 'Normal size, take every valid signal', outcomes: [
          { label: 'A strong week, +3R net', probability: 0.65, metricDeltas: { equity: 3000, drawdown_pct: -0.5 } },
          { label: 'Choppy, roughly flat', probability: 0.35, metricDeltas: { equity: -200, drawdown_pct: 0.3 } },
        ] },
        { label: 'Reduce size — "don\'t get greedy" after last week', outcomes: [{ label: 'Small, steady gain', probability: 1, metricDeltas: { equity: 1200, drawdown_pct: -0.2 } }] },
        { label: 'Double size to ride the trend hard', outcomes: [
          { label: 'A very strong week', probability: 0.5, metricDeltas: { equity: 6000, drawdown_pct: -0.5 } },
          { label: 'Trend reversed on you, sized up', probability: 0.5, metricDeltas: { equity: -3500, drawdown_pct: 3.5 } },
        ] },
      ],
    },
    {
      id: 'w5', prompt: 'Week 5. Halfway to target. A correlated cluster of setups appears across 4 pairs at once — all really the same underlying bet.',
      options: [
        { label: 'Treat it as ONE trade\'s worth of risk, split across pairs', outcomes: [
          { label: 'The move worked out', probability: 0.55, metricDeltas: { equity: 2000, drawdown_pct: -0.3 } },
          { label: 'The move failed', probability: 0.45, metricDeltas: { equity: -1200, drawdown_pct: 1.2 } },
        ] },
        { label: 'Full risk on EACH pair — 4x normal exposure', outcomes: [
          { label: 'The move worked out, 4x size', probability: 0.55, metricDeltas: { equity: 8000, drawdown_pct: -0.3 } },
          { label: 'The move failed, 4x size', probability: 0.45, metricDeltas: { equity: -4800, drawdown_pct: 4.8 } },
        ] },
        { label: 'Skip the cluster entirely — too correlated to size confidently', outcomes: [{ label: 'No change', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
      ],
    },
    {
      id: 'w6', prompt: 'Week 6. You\'re ahead of target. A mediocre, B-grade setup appears — nothing special.',
      options: [
        { label: 'Pass — hold the same bar regardless of being ahead', outcomes: [{ label: 'No change, discipline held', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
        { label: 'Take it small, "just in case"', outcomes: [
          { label: 'Worked out anyway', probability: 0.45, metricDeltas: { equity: 800, drawdown_pct: -0.1 } },
          { label: 'A small, avoidable loss', probability: 0.55, metricDeltas: { equity: -500, drawdown_pct: 0.5 } },
        ] },
        { label: 'Take it full size — you can afford the risk now', outcomes: [
          { label: 'Worked out anyway', probability: 0.45, metricDeltas: { equity: 2500, drawdown_pct: -0.1 } },
          { label: 'A real, avoidable loss', probability: 0.55, metricDeltas: { equity: -1600, drawdown_pct: 1.6 } },
        ] },
      ],
    },
    {
      id: 'w7', prompt: 'Week 7. High-impact news event tomorrow — historically very volatile for your instruments.',
      options: [
        { label: 'Flatten positions and sit out the event', outcomes: [{ label: 'No exposure, no change', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
        { label: 'Hold through with a wider stop', outcomes: [
          { label: 'Volatility favored you', probability: 0.4, metricDeltas: { equity: 2800, drawdown_pct: -0.2 } },
          { label: 'Volatility went against you, wide stop', probability: 0.6, metricDeltas: { equity: -2800, drawdown_pct: 2.8 } },
        ] },
        { label: 'Add a fresh position specifically to trade the event', outcomes: [
          { label: 'The gamble paid off', probability: 0.3, metricDeltas: { equity: 5000, drawdown_pct: -0.3 } },
          { label: 'The gamble didn\'t', probability: 0.7, metricDeltas: { equity: -4000, drawdown_pct: 4.0 } },
        ] },
      ],
    },
    {
      id: 'w8', prompt: 'Week 8 — final stretch. Close to (or already past) the profit target.',
      options: [
        { label: 'Stop trading — lock in the result, don\'t risk it', outcomes: [{ label: 'Result locked in', probability: 1, metricDeltas: { equity: 0, drawdown_pct: 0 } }] },
        { label: 'One more A-grade trade only, normal size', outcomes: [
          { label: 'Clean win to finish', probability: 0.55, metricDeltas: { equity: 1800, drawdown_pct: -0.2 } },
          { label: 'A normal loss', probability: 0.45, metricDeltas: { equity: -1000, drawdown_pct: 1.0 } },
        ] },
        { label: 'Push hard for a bigger finish — size up on anything decent', outcomes: [
          { label: 'A big finish', probability: 0.35, metricDeltas: { equity: 4500, drawdown_pct: -0.2 } },
          { label: 'Gave back the cushion late', probability: 0.65, metricDeltas: { equity: -3200, drawdown_pct: 3.2 } },
        ] },
      ],
    },
  ],
};
