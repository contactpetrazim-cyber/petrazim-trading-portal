/**
 * Feature Registry — single source of truth for site structure
 * =================================================================
 *
 * Every feature/page in the platform is registered here ONCE, tagged
 * with which of the 7 top-level areas it belongs to. TopNav and
 * GlobalSearchModal both read from this same list, so adding a new
 * feature to the nav and to search is one edit, not two — they can
 * never drift out of sync with each other.
 */

export type FeatureArea = 'learn' | 'practise' | 'trade' | 'insights' | 'tradingview' | 'tools' | 'community' | 'explore';

export interface FeatureEntry {
  id: string;
  label: string;
  area: FeatureArea;
  route: string;
  description: string;
  keywords?: string[];
}

export const FEATURE_AREAS: { id: FeatureArea; label: string; description: string }[] = [
  { id: 'learn', label: 'Learn', description: 'Structured tracks for market structure, each bot’s own methodology, and trading psychology.' },
  { id: 'practise', label: 'Practise', description: 'Scored drills, spaced-recall review, and gamified paper-trading challenges.' },
  { id: 'trade', label: 'Trade', description: 'Your live signal panel, trade approvals, and bot configuration.' },
  { id: 'insights', label: 'Insights', description: 'Monte Carlo forecasts, weekly coach reviews, and the go-live validation gate.' },
  { id: 'tradingview', label: 'TradingView', description: 'Your own TradingView account and charts, embedded in the Petrazim frame.' },
  { id: 'tools', label: 'Tools', description: 'Risk-of-ruin, prop-firm odds, correlation, journal review, and payout tools.' },
  { id: 'community', label: 'Community', description: 'The Telegram community and booking time with a facilitator or manager.' },
  { id: 'explore', label: 'Explore', description: 'The probability coach, strategy marketplace, white-label service, and signal API.' },
];

export const FEATURE_REGISTRY: FeatureEntry[] = [
  // --- Learn ---
  { id: 'learn-basics', label: 'Trading Basics', area: 'learn', route: '/learn/basics',
    description: 'Start from zero — market structure, order types, risk fundamentals.' },
  { id: 'learn-bot-mastery', label: 'Bot Mastery Tracks', area: 'learn', route: '/learn/bots',
    description: 'Novice-to-mastery path for each of the 5 bots\' own methodology — locked sequence, stage by stage.',
    keywords: ['liquidity purge', 'order block', 'fvg', 'smc', 'modules'] },
  { id: 'learn-psychology', label: 'Trading Psychology', area: 'learn', route: '/learn/psychology',
    description: 'Discipline, emotional control, and process-over-outcome thinking.' },
  { id: 'learn-mastery', label: 'Mastery Overview', area: 'learn', route: '/learn/mastery',
    description: 'Your mastery level across every track, at a glance.',
    keywords: ['skills'] },
  { id: 'learn-awards', label: 'Awards & Certificates', area: 'learn', route: '/learn/awards',
    description: 'Badges earned and certificates issued on track completion.',
    keywords: ['achievements', 'certificates'] },

  // --- Practise ---
  { id: 'practise-drills', label: 'Practice Drills', area: 'practise', route: '/practise/drills',
    description: 'Repeated, scored scenario drills per concept.' },
  { id: 'practise-review', label: 'Retention Review', area: 'practise', route: '/practise/review',
    description: 'Spaced-recall check-ins so what you learned actually sticks.' },
  { id: 'practise-game', label: 'Trading Simulator Game', area: 'practise', route: '/practise/game',
    description: 'Gamified paper-trading challenges with streaks and leaderboards.',
    keywords: ['games'] },

  // --- Trade ---
  { id: 'trade-dashboard', label: 'Trading Dashboard', area: 'trade', route: '/dashboard',
    description: 'Live signals, bot panel, equity curve.' },
  { id: 'trade-trades', label: 'Trade Management', area: 'trade', route: '/trades',
    description: 'Approve, reject, and review individual trades.' },
  { id: 'trade-bots', label: 'Bot Configuration', area: 'trade', route: '/bots',
    description: 'Enable/disable bots, switch modes, tune risk.' },

  // --- TradingView ---
  { id: 'tv-frame', label: 'Full TradingView', area: 'tradingview', route: '/tradingview',
    description: 'Your own TradingView account, charts, and drawings — embedded in the Petrazim frame.',
    keywords: ['chart', 'drawings', 'layouts', 'indicators'] },
  { id: 'tv-tracking', label: 'Chart Session Tracking', area: 'tradingview', route: '/tradingview/tracking',
    description: 'Which symbols and timeframes you actually spend time on.' },
  { id: 'tv-metrics', label: 'TradingView Usage Metrics', area: 'tradingview', route: '/tradingview/metrics',
    description: 'Session count, average session length, most-viewed symbols.' },

  // --- Insights ---
  { id: 'insights-forecast', label: 'Performance Forecast', area: 'insights', route: '/insights/forecast',
    description: 'Monte Carlo projection of a future set of trades.' },
  { id: 'insights-weekly-review', label: 'Weekly Review', area: 'insights', route: '/insights/weekly-review',
    description: 'Coach debrief — trades taken, missed opportunities, psychology review.' },
  { id: 'insights-golive', label: 'Go-Live Checklist', area: 'insights', route: '/insights/go-live',
    description: 'Validation gate status before any bot goes autonomous.' },

  // --- Tools ---
  { id: 'tools-risk-of-ruin', label: 'Risk-of-Ruin Calculator', area: 'tools', route: '/tools/risk-of-ruin',
    description: 'Free — estimate risk of ruin from your own stats.' },
  { id: 'tools-prop-firm', label: 'Prop-Firm Challenge Simulator', area: 'tools', route: '/tools/prop-firm',
    description: 'Estimate your odds of passing a funded-account challenge.' },
  { id: 'tools-correlation', label: 'Correlation Heat Map', area: 'tools', route: '/tools/correlation',
    description: 'See which of your positions are secretly the same bet.' },
  { id: 'tools-journal-reviewer', label: 'AI Trade Journal Reviewer', area: 'tools', route: '/tools/journal-reviewer',
    description: 'Upload manual trades for the same process-based coach review.' },
  { id: 'tools-payout-optimizer', label: 'Funded-Account Payout Optimizer', area: 'tools', route: '/tools/payout-optimizer',
    description: 'Balance risk across multiple funded accounts.' },

  // --- Community ---
  { id: 'community-telegram', label: 'Telegram Community', area: 'community', route: '/community/telegram',
    description: 'Join the individual or corporate Telegram channel.' },
  { id: 'community-meetings', label: 'Trader Meetings', area: 'community', route: '/community/meetings',
    description: 'Book time with a facilitator, Fund Manager, or Partner.' },

  // --- Explore ---
  { id: 'explore-coach', label: 'Standalone Probability Coach', area: 'explore', route: '/explore/coach',
    description: 'Upload any trade history, get a Monte Carlo + coach read.' },
  { id: 'explore-marketplace', label: 'Strategy Marketplace', area: 'explore', route: '/explore/marketplace',
    description: 'License Gate-Approved bot strategies.' },
  { id: 'explore-white-label', label: 'White-Label Bot Service', area: 'explore', route: '/explore/white-label',
    description: 'Fund Managers/Partners: run a branded bot for your own clients.' },
  { id: 'explore-signal-api', label: 'Signal Confidence API', area: 'explore', route: '/explore/signal-api',
    description: 'Pay-per-call API access to MTF/coach confidence scoring.' },
];

export function searchFeatures(query: string): FeatureEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FEATURE_REGISTRY.filter((f) =>
    f.label.toLowerCase().includes(q) ||
    f.description.toLowerCase().includes(q) ||
    f.keywords?.some((k) => k.toLowerCase().includes(q))
  );
}
