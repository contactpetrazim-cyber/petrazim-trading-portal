/**
 * Glossary behind every "i" icon on the Recommended Bots Dashboard —
 * by direct request ("add an information icon 'i' for every item to
 * comprehensively explain the terms, what, why, how and the
 * interpretation"). One place, one shape (what / why / how / read), so
 * every explanation answers the same four questions and wording stays
 * consistent with the backend (services/recommended_dashboard.py).
 */

export interface GlossaryEntry {
  title: string;
  /** What it is. */
  what: string;
  /** Why it matters. */
  why: string;
  /** How it's calculated. */
  how: string;
  /** How to read it. */
  read: string;
}

const R_NOTE = '"R" is one unit of risk: the amount a trade stood to lose if its stop-loss was hit. +2R means the trade made twice what it risked; −1R means a full stop-out.';

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Header ──────────────────────────────────────────────────────────
  dashboard: {
    title: 'Recommended Bots Dashboard',
    what: 'The live scorecard for the recommended bot roster: the bots chosen as the top performers per instrument when the testing phase ended.',
    why: 'A bot is picked on its past results. This dashboard checks, trade by trade, whether that edge is carrying forward with real trades.',
    how: 'Recomputed from the trades table every time it loads, and refreshed every 60 seconds. Nothing on it is a stored snapshot.',
    read: 'Read it as "live versus evidence". Blue is what the bots are doing now; orange is the record that got them picked. Judge each bot once its confidence meter is full (21 trades), not before.',
  },
  live_vs_evidence_concept: {
    title: 'Live vs evidence',
    what: 'Live = the recommended bot\'s own closed trades since the roster went live. Evidence = the same strategy\'s closed trades on the same instrument, from all other bots, before the roster went live.',
    why: 'The evidence is the reason the bot was chosen. Comparing against it tells you whether the reason still holds.',
    how: 'Evidence only includes trades created before the rollout date, so it can never change: it is exactly what the selection saw.',
    read: 'Live results usually come in below evidence, because selection favours whatever was luckiest in the past. Holding half or more of the evidence edge is a healthy result.',
  },
  r_unit: {
    title: 'R (risk unit)',
    what: R_NOTE,
    why: 'Instruments have very different prices and position sizes. Measuring in R makes a BTC trade and a EUR trade directly comparable.',
    how: 'R multiple = profit or loss ÷ the amount risked at entry (entry-to-stop distance × position size).',
    read: 'Above 0 is profitable. For a trend-following strategy, a few big winners (+3R and above) usually pay for many −1R losers.',
  },
  view_toggle: {
    title: 'Show as tables',
    what: 'Switches every chart to a plain table of the same numbers.',
    why: 'Exact values are easier to read in a table, and tables work with screen readers and copy-paste.',
    how: 'Same data, different presentation. Nothing is recalculated.',
    read: 'Use the charts to spot patterns and the tables to quote exact figures.',
  },

  // ── KPI tiles ───────────────────────────────────────────────────────
  kpi_trades: {
    title: 'Closed trades',
    what: 'How many trades the recommended bots have opened and fully closed since the roster went live. "Open now" counts trades still running.',
    why: 'Sample size decides how much every other number can be trusted. Ten trades is mostly noise; 100 tells a story.',
    how: 'Count of the recommended bots\' trades with status CLOSED. Open trades are counted separately and aren\'t in any result yet.',
    read: 'Under about 30 roster-wide, treat every other tile as provisional. The per-bot confidence meters show each bot\'s own progress.',
  },
  kpi_win_rate: {
    title: 'Win rate',
    what: 'The share of closed trades that made money.',
    why: 'It shows how often the strategy is right, but not by how much. It only means something alongside average R.',
    how: 'Trades with profit > 0 ÷ all closed trades. The evidence figure underneath uses the same formula on the evidence trades.',
    read: 'A 40% win rate can be very profitable when winners are 3R+ and losers are −1R. Compare with the evidence figure: a big drop with many trades is a warning sign.',
  },
  kpi_avg_r: {
    title: 'Average R (expectancy)',
    what: `The average result per trade, in R. ${R_NOTE}`,
    why: 'This is the single best measure of edge: what one trade is worth on average.',
    how: 'Sum of every closed trade\'s R multiple ÷ number of trades. The arrow compares it with the evidence: up means at least half the evidence edge is being kept; down means less.',
    read: 'Above 0 = the roster makes money per trade. +0.3R or more is solid. A negative figure after 30+ trades means the edge has not carried forward.',
  },
  kpi_net_r: {
    title: 'Net R',
    what: 'Total profit or loss of all closed trades, added up in R, with the dollar P&L underneath.',
    why: 'It shows the overall result independent of account size; the dollar figure shows the real money.',
    how: 'Sum of the R multiples of all closed trades. P&L is the sum of realized profit and loss in dollars.',
    read: 'Rising over time is the goal. At 1% risk per trade, +10R is roughly +10% on the reference balance.',
  },
  kpi_profit_factor: {
    title: 'Profit factor',
    what: 'Gross profit divided by gross loss.',
    why: 'It measures how much is won for every dollar lost, which captures both win rate and win size.',
    how: 'Sum of all winning trades\' profit ÷ sum of all losing trades\' losses. Shows "∞" when there are wins and no losses yet.',
    read: 'Below 1.0 = losing money. 1.0–1.5 = thin edge. 1.5–2.0 = good. Above 2.0 = strong. Very high values on few trades are usually luck.',
  },
  kpi_drawdown: {
    title: 'Max drawdown',
    what: 'The largest peak-to-trough fall in cumulative R: the worst losing stretch so far.',
    why: 'It shows how painful the strategy is to hold, and sizes the buffer the account needs.',
    how: 'Follow the cumulative R line trade by trade; record the biggest drop from any high point to a later low point.',
    read: 'Compare it with net R. A drawdown bigger than total gains means the roster hasn\'t yet earned back its worst stretch. Above about 5R per bot is large at 1% risk.',
  },

  // ── Sections ────────────────────────────────────────────────────────
  roster_map: {
    title: 'Roster map',
    what: 'One tile per instrument, listing its recommended bots, each with a confidence bar and a verdict.',
    why: 'It shows at a glance where each bot is deployed, which instruments are actually trading, and which bots need attention.',
    how: '"Trading" = the instrument is inside your current Instrument Focus (max 3), so its bots can open new trades. "Standby" = outside the focus: its bots keep managing open trades but won\'t open new ones.',
    read: 'Look for red Review badges first, then standby instruments with strong evidence that you may want to rotate into the focus.',
  },
  trading_status: {
    title: 'Trading / Standby',
    what: 'Whether bots on this instrument may open new trades right now.',
    why: 'The Instrument Focus engine caps bots at 3 instruments at a time, to concentrate capital and reduce system load.',
    how: 'Read live from your Instrument Focus setting (Bots page → Instrument Focus card).',
    read: 'Change the focus to rotate instruments in and out. Open trades are always managed to the end, whatever the status.',
  },
  equity_curve: {
    title: 'Cumulative R: equity curve',
    what: 'Running total of R across every closed recommended-bot trade, in the order they closed.',
    why: 'It is the clearest picture of whether the roster is making progress, and how bumpy the ride is.',
    how: 'Start at 0 and add each closed trade\'s R multiple. Hover any point to see which bot and instrument produced that trade.',
    read: 'A line rising from bottom-left to top-right is the goal. Long flat or falling stretches are drawdowns. Steady climbs beat a few big jumps.',
  },
  live_vs_evidence_chart: {
    title: 'Live vs evidence: average R per bot',
    what: 'For each recommended bot, the average R of its live trades (blue) beside its evidence (orange).',
    why: 'It shows which bots are living up to the record that got them selected.',
    how: 'Blue = the bot\'s own closed trades since rollout. Orange = the evidence trades (see "Live vs evidence" in the header). Hover a bar for its trade count.',
    read: 'Blue near or above orange = performing as expected. Blue far below orange, or negative, with 10+ trades = a candidate for review. Ignore blue bars on fewer than 5 trades.',
  },
  confidence: {
    title: 'Confidence meters',
    what: 'Each bot\'s progress toward 21 closed trades, plus its current verdict.',
    why: 'Results on a handful of trades swing wildly. The meter stops you reacting to noise.',
    how: 'Fill = live closed trades ÷ 21. Verdicts are withheld below 5 trades. "Review" needs 10+ trades averaging −0.3R or worse.',
    read: 'Only treat a verdict as reliable once the bar is full. Under 5 trades the label says "Too early" on purpose.',
  },
  verdicts: {
    title: 'Verdict labels',
    what: 'A plain-language status per bot, with an icon so it never relies on colour alone.',
    why: 'It turns the numbers into what to do next.',
    how: 'Too early: under 5 trades. Good: at or above the evidence, or keeping at least half of it. Watch: positive but under half the evidence. Behind: negative so far. Review: 10+ trades averaging −0.3R or worse.',
    read: 'Good → leave it. Watch → keep an eye on it. Behind → check again at 21 trades. Review → pause it and re-run its backtest (it also appears in the recommendations).',
  },
  r_distribution: {
    title: 'R distribution',
    what: 'How many trades ended in each result band, from full losses (≤ −0.75R) to big wins (≥ 3R).',
    why: 'Two rosters with the same average can behave very differently. This shows the shape of the wins and losses.',
    how: 'Each closed trade is placed in a band by its R multiple. Red bars are losses; blue bars are breakeven and wins.',
    read: 'Healthy trend-following: a tall red bar at −1R (cut losses) and a long blue tail to the right (let winners run). Many trades near 0R mean exits are too early.',
  },
  daily_pnl: {
    title: 'Daily P&L',
    what: 'Realized profit or loss for each day, in dollars.',
    why: 'It shows consistency and whether losses are clustering on particular days.',
    how: 'Sum of realized P&L of trades closed that day (UTC). Hover for the day\'s R and trade count.',
    read: 'Mostly blue with small red days is ideal. Red days in a row can mean a market regime change; the stop-trading guard may already be pausing bots.',
  },
  exits: {
    title: 'How trades end',
    what: 'The share of closed trades ending at each exit type: stop loss, take-profit 1/2/3, trailing stop, manual or structure.',
    why: 'Exit behaviour shows whether winners are allowed to run or are cut short.',
    how: 'Count of closed trades by their recorded exit type ÷ all closed trades.',
    read: 'Stop-loss share around or below 50% with a healthy trailing-stop share is good. Stop-loss far above half with few trailing exits means runners are being cut short or entries are poor.',
  },
  insights: {
    title: 'Key insights',
    what: 'Automatically written observations about the roster, ordered most urgent first.',
    why: 'It spells out what changed and what matters, so you don\'t have to read every chart.',
    how: 'Rule-based reads of the live and evidence numbers, recomputed every refresh, with sample-size guards so a short streak is never called a verdict. Each carries a level: Review, Behind, Watch, Good or Info.',
    read: 'Act on Review and Behind first. Info items explain context, such as how many bots are still too early to judge.',
  },
  recommendations: {
    title: 'Recommendations summary',
    what: 'A prioritized action list generated from the same live data.',
    why: 'It turns the insights into concrete next steps.',
    how: 'P1 = act now (e.g. a bot losing steadily). P2 = adjust soon (instrument focus, overlapping bots). P3 = treat with caution (thin evidence). P4 = scheduled reviews.',
    read: 'Work top-down. Items update automatically as results come in, so a recommendation disappears once its condition clears.',
  },
  basis: {
    title: 'Basis of the recommendations',
    what: 'The exact evidence and rule each recommended bot was selected on, side by side with its live record.',
    why: 'Transparency: you can audit every pick and see whether the rule was sound.',
    how: 'Evidence = that strategy\'s closed trades on that instrument, from all other bots, before the rollout. Because it\'s cut off at a past date, it can never change.',
    read: 'A high evidence score with a weak live record is the key thing to watch: the selection may have picked a lucky streak.',
  },

  // ── Selection rule + basis columns ──────────────────────────────────
  evidence_score: {
    title: 'Evidence score',
    what: 'The ranking number used to pick bots: average R × √(number of trades).',
    why: 'It rewards an edge that is both positive and proven over many trades, so a lucky 3-trade streak can\'t outrank a solid 50-trade record.',
    how: 'avg R × square root of closed trades. Losing strategies score 0. Example: +1R over 25 trades scores 5.0; +3R over 1 trade scores only 3.0.',
    read: 'Higher is stronger evidence. Compare within the same instrument: it decided which two bots were picked.',
  },
  eligibility: {
    title: 'Eligibility rule',
    what: 'The minimum bar a strategy had to clear on an instrument before it could be recommended.',
    why: 'It keeps out strategies with too little history, or that lost money overall.',
    how: 'At least 5 closed trades, positive total P&L, and profit factor above 1.',
    read: 'An instrument where nothing qualified gets fewer than two bots. Brent got one, rather than adding a losing bot just to fill the slot.',
  },
  pick_rule: {
    title: 'Pick rule',
    what: 'How many bots each instrument receives, and which.',
    why: 'Two different strategies per instrument spread risk without spreading capital too thin.',
    how: 'The top two eligible strategies by evidence score, per instrument.',
    read: 'Two bots of very similar strategies on one instrument (e.g. Bot 3 and Bot 7) can enter the same move together; the recommendations flag this.',
  },
  build_rule: {
    title: 'How each bot was built',
    what: 'Each recommended bot is a copy of the exact bot that produced its evidence, limited to one instrument.',
    why: 'The live bot runs the same configuration that earned the evidence, so the comparison is fair.',
    how: 'Settings copied verbatim: strategy, risk, reward-to-risk, trailing, exchange and mode. New bot id ending in "_rec_<instrument>"; the original stays paused.',
    read: 'If a recommended bot underperforms, its settings, not a copying error, are what to investigate.',
  },
  confidence_floor: {
    title: 'Confidence floor',
    what: 'The number of live trades before a bot\'s live record is treated as reliable: 21.',
    why: 'It is the Basic-mode baseline: every recommended bot runs on fixed settings until it has 21 trades, so the selection can be judged cleanly before Intelligent (self-tuning) mode is considered.',
    how: 'Fixed at 21 closed trades. Verdicts begin at 5 trades but are provisional until 21.',
    read: 'Plan formal reviews for when each bot reaches 21. Busy bots get there in about two weeks; slow ones can take two months or more.',
  },
  col_evidence_n: {
    title: 'Evidence n',
    what: 'How many evidence trades the pick was based on.',
    why: 'More trades = more trustworthy evidence.',
    how: 'Count of the strategy\'s closed trades on this instrument, from other bots, before the rollout.',
    read: 'Under 5 means probationary (only Brent today). 15+ is solid.',
  },
  col_live_n: {
    title: 'Live n',
    what: 'How many trades this recommended bot has closed since it went live.',
    why: 'It tells you how much weight to give its live average R.',
    how: 'Count of this bot\'s own closed trades.',
    read: 'Under 5: ignore the live numbers. 5–20: provisional. 21+: reliable.',
  },
};
