import type { EmpireSimConfig } from '../components/EmpireSimEngine';

/**
 * Order Flow Trading Desk — third Team Empire Sim config (Section
 * 10b: "one shared engine + N configs"), themed to the platform's own
 * Order Flow Trading track (tape reading, delta, absorption, stop
 * hunts, iceberg orders) rather than a generic business scenario.
 * Tracks equity alongside read_accuracy_pct — a running "how often is
 * this desk's tape-reading call actually right" percentage, since
 * order flow is explicitly about interpreting what the flow is really
 * doing, not just risking size on it. 8 rounds, same weighted-not-
 * deterministic outcome shape as the other two configs.
 */
export const ORDER_FLOW_EMPIRE_CONFIG: EmpireSimConfig = {
  theme: 'Order Flow Trading Desk',
  startingMetrics: { equity: 75000, read_accuracy_pct: 50 },
  metricLabels: {
    equity: { label: 'Equity', format: 'currency' },
    read_accuracy_pct: { label: 'Read Accuracy', format: 'percent' },
  },
  primaryMetric: 'equity',
  rounds: [
    {
      id: 'd1', prompt: 'Session 1. Price approaches a key level with heavy resting size showing on the book.',
      options: [
        { label: 'Wait to see if the size actually absorbs the move or gets pulled', outcomes: [
          { label: 'Absorption confirmed, faded the level correctly', probability: 0.55, metricDeltas: { equity: 1500, read_accuracy_pct: 4 } },
          { label: 'Size got pulled, level broke — sat out, no loss', probability: 0.45, metricDeltas: { equity: 0, read_accuracy_pct: -1 } },
        ] },
        { label: 'Assume the size will hold and fade it immediately', outcomes: [
          { label: 'It held — clean fade', probability: 0.5, metricDeltas: { equity: 1800, read_accuracy_pct: 3 } },
          { label: 'Iceberg — size kept refreshing, level broke through you', probability: 0.5, metricDeltas: { equity: -1600, read_accuracy_pct: -6 } },
        ] },
      ],
    },
    {
      id: 'd2', prompt: 'Session 2. Delta is strongly positive but price isn\'t moving up — a classic absorption signature.',
      options: [
        { label: 'Read it as absorption, position for the reversal', outcomes: [
          { label: 'Reversal played out', probability: 0.55, metricDeltas: { equity: 1600, read_accuracy_pct: 5 } },
          { label: 'Was genuine buying pressure, not absorption — continued up', probability: 0.45, metricDeltas: { equity: -1100, read_accuracy_pct: -5 } },
        ] },
        { label: 'Trust the positive delta at face value, go with it', outcomes: [
          { label: 'Delta led correctly, continued up', probability: 0.45, metricDeltas: { equity: 1400, read_accuracy_pct: 3 } },
          { label: 'It really was absorption — reversed against the delta read', probability: 0.55, metricDeltas: { equity: -1300, read_accuracy_pct: -4 } },
        ] },
      ],
    },
    {
      id: 'd3', prompt: 'Session 3. A sudden spike sweeps obvious stops below a swing low, then snaps back fast.',
      options: [
        { label: 'Treat it as a stop hunt, look for the reversal entry', outcomes: [
          { label: 'Reversal confirmed, clean trade', probability: 0.58, metricDeltas: { equity: 1700, read_accuracy_pct: 5 } },
          { label: 'Kept dropping — it wasn\'t a hunt, it was real selling', probability: 0.42, metricDeltas: { equity: -1200, read_accuracy_pct: -5 } },
        ] },
        { label: 'Treat the spike as the start of a real breakdown, sell it', outcomes: [
          { label: 'It really was a breakdown', probability: 0.4, metricDeltas: { equity: 1500, read_accuracy_pct: 3 } },
          { label: 'Snapped back hard — got run over by the reversal', probability: 0.6, metricDeltas: { equity: -1800, read_accuracy_pct: -6 } },
        ] },
      ],
    },
    {
      id: 'd4', prompt: 'Session 4. Volume profile shows a thin, low-volume gap directly above current price.',
      options: [
        { label: 'Expect price to move through the thin area quickly if it breaks', outcomes: [
          { label: 'Broke and ran fast through the gap as expected', probability: 0.5, metricDeltas: { equity: 1900, read_accuracy_pct: 4 } },
          { label: 'Rejected before even reaching the thin area', probability: 0.5, metricDeltas: { equity: 0, read_accuracy_pct: -2 } },
        ] },
        { label: 'Ignore the profile, size up on a normal breakout entry regardless', outcomes: [
          { label: 'Worked out fine', probability: 0.5, metricDeltas: { equity: 1600, read_accuracy_pct: 1 } },
          { label: 'Got chopped in the thin zone, no clean read', probability: 0.5, metricDeltas: { equity: -1400, read_accuracy_pct: -3 } },
        ] },
      ],
    },
    {
      id: 'd5', prompt: 'Session 5. Two consecutive misreads have accuracy sliding. A clear, high-conviction tape signal appears.',
      options: [
        { label: 'Step back, review the last two misreads before acting', outcomes: [{ label: 'Sat this one out, sharper for the next', probability: 1, metricDeltas: { equity: 0, read_accuracy_pct: 6 } }] },
        { label: 'Trade it immediately to prove the read is still good', outcomes: [
          { label: 'Read was right, confidence restored', probability: 0.5, metricDeltas: { equity: 1800, read_accuracy_pct: 6 } },
          { label: 'A third misread in a row', probability: 0.5, metricDeltas: { equity: -1500, read_accuracy_pct: -8 } },
        ] },
      ],
    },
    {
      id: 'd6', prompt: 'Session 6. A large iceberg order keeps refreshing at one price, quietly working a huge size.',
      options: [
        { label: 'Trade with the iceberg\'s implied direction, not against it', outcomes: [
          { label: 'The iceberg won out, direction confirmed', probability: 0.6, metricDeltas: { equity: 2000, read_accuracy_pct: 5 } },
          { label: 'Iceberg finally exhausted, direction flipped', probability: 0.4, metricDeltas: { equity: -1300, read_accuracy_pct: -3 } },
        ] },
        { label: 'Fade it, betting the size finally runs out now', outcomes: [
          { label: 'It did exhaust right there', probability: 0.4, metricDeltas: { equity: 1700, read_accuracy_pct: 3 } },
          { label: 'It kept refreshing, ran straight over the fade', probability: 0.6, metricDeltas: { equity: -1900, read_accuracy_pct: -6 } },
        ] },
      ],
    },
    {
      id: 'd7', prompt: 'Session 7. Accuracy is climbing. A setup appears that matches every criterion from this week\'s best reads.',
      options: [
        { label: 'Take it at normal size, same process as every prior read', outcomes: [
          { label: 'Another accurate read', probability: 0.6, metricDeltas: { equity: 1900, read_accuracy_pct: 5 } },
          { label: 'The one that breaks the streak', probability: 0.4, metricDeltas: { equity: -1200, read_accuracy_pct: -3 } },
        ] },
        { label: 'Size up hard — the desk is clearly "in the zone" this week', outcomes: [
          { label: 'The streak continues, bigger', probability: 0.45, metricDeltas: { equity: 3800, read_accuracy_pct: 4 } },
          { label: 'Overconfidence meets a normal miss, sized up', probability: 0.55, metricDeltas: { equity: -3000, read_accuracy_pct: -5 } },
        ] },
      ],
    },
    {
      id: 'd8', prompt: 'Session 8 — final session. Wherever the desk\'s numbers sit now is close to the final scoreboard.',
      options: [
        { label: 'Hold the exact same process, no changes for the finale', outcomes: [
          { label: 'One more accurate, on-process read', probability: 0.58, metricDeltas: { equity: 1800, read_accuracy_pct: 5 } },
          { label: 'A normal, accepted miss', probability: 0.42, metricDeltas: { equity: -1000, read_accuracy_pct: -2 } },
        ] },
        { label: 'Force extra trades on marginal reads to finish bigger', outcomes: [
          { label: 'Paid off', probability: 0.35, metricDeltas: { equity: 2600, read_accuracy_pct: 1 } },
          { label: 'Marginal reads were marginal for a reason', probability: 0.65, metricDeltas: { equity: -2200, read_accuracy_pct: -7 } },
        ] },
      ],
    },
  ],
};
