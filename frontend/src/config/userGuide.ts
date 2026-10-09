// Day 1 user manual content — single source for the /guide page and the exported document.
export interface GuideStep { title: string; body: string[]; link?: { label: string; to: string } }
export interface GuidePhase { id: string; title: string; summary: string; steps: GuideStep[] }

export const DAY1_GUIDE: GuidePhase[] = [
  {
    id: 'access', title: '1. Access & setup', summary: 'Get signed in and ready in under five minutes.',
    steps: [
      { title: 'Open the portal', body: ['Go to tradefx.petrazim.online on your phone or computer.', 'If the page takes a few seconds the first time, the server is waking up — wait, then refresh.'] },
      { title: 'Sign in', body: ['Enter your email and password, or tap "Continue with Google".', 'Forgot your password? Use the reset link on the sign-in screen.'], link: { label: 'Go to sign in', to: '/login' } },
      { title: 'Complete onboarding', body: ['Answer the short questions about your experience and goals.', 'This tailors your learning path and the bots you see first.'], link: { label: 'Open onboarding', to: '/onboarding' } },
      { title: 'Activate your access pass', body: ['Choose a pass on the Payments page — Naira, US dollars or crypto.', 'Have a promo or access code? Enter it in the code box to redeem it.'], link: { label: 'Open payments', to: '/payments' } },
      { title: 'Install the app (optional)', body: ['Phone: use your browser menu → "Add to Home screen".', 'Computer: click the install icon in the address bar.'] },
    ],
  },
  {
    id: 'orient', title: '2. Find your way around', summary: 'The eight areas, search and theme.',
    steps: [
      { title: 'Use the bottom tabs', body: ['Learn, Practise, Trade, Insights, TradingView, Tools, Community and Explore.', 'Each tab opens a page of folded cards — tap one to open it.'] },
      { title: 'Search anything', body: ['Tap the search icon at the top (or press Ctrl/Cmd + K).', 'Type a word like "risk" or "FVG" to jump straight to it.'] },
      { title: 'Light or dark', body: ['Use the sun/moon toggle at the top to switch theme.'] },
      { title: 'See everything at once', body: ['The Site Map lists every feature grouped by area.'], link: { label: 'Open site map', to: '/sitemap' } },
    ],
  },
  {
    id: 'learn', title: '3. Your first lesson', summary: 'Start learning before you trade.',
    steps: [
      { title: 'Start Trading Basics', body: ['Open Learn → Trading Basics and begin lesson one.', 'Lessons unlock in order, stage by stage.'], link: { label: 'Open Trading Basics', to: '/learn/basics' } },
      { title: 'Take notes and reflect', body: ['Use the notebook and reflection prompts inside each lesson.', 'Find them later under My Notes and My Reflections.'], link: { label: 'My notes', to: '/learn/notes' } },
      { title: 'Answer the quiz', body: ['Each lesson ends with a short quiz — pass it to unlock the next.'] },
      { title: 'Practise', body: ['Try a scored drill or a game to lock in what you learned.'], link: { label: 'Practice drills', to: '/practise/drills' } },
    ],
  },
  {
    id: 'trade', title: '4. Your first look at trading', summary: 'Look, learn, then act — safely.',
    steps: [
      { title: 'Open the dashboard', body: ['See live signals, bot status and your equity curve.'], link: { label: 'Open dashboard', to: '/dashboard' } },
      { title: 'Set your quick pairs', body: ['On any chart tap "Pairs", search a market and save it.', 'Your saved pairs appear on every chart.'], link: { label: 'Open chart', to: '/chart' } },
      { title: 'Check risk first', body: ['Review your risk settings before any order.', 'Start in demo / paper mode until the Go-Live checklist is green.'], link: { label: 'Risk settings', to: '/risk' } },
    ],
  },
  {
    id: 'help', title: '5. Get help', summary: 'You are never on your own.',
    steps: [
      { title: 'Ask Trade AI', body: ['Tap the floating Trade AI bubble on any page and ask a question.'] },
      { title: 'Book a facilitator', body: ['Open Community → Trader Meetings and pick a time slot.'], link: { label: 'Book a session', to: '/meetings' } },
      { title: 'Join the community', body: ['Join the Telegram channel for updates and peer support.'], link: { label: 'Community', to: '/community' } },
    ],
  },
];

// Phase 2 — Master Trading, Bots & Charting guide.
export const MASTER_TRADING_GUIDE: GuidePhase[] = [
  {
    id: 'charts', title: '1. Charts & pairs', summary: 'Read the market before you act.',
    steps: [
      { title: 'Open a chart', body: ['Go to Chart (or TradingView) to see live candles.', 'Change timeframe from the toolbar — start with 4H and 1H for direction.'], link: { label: 'Open chart', to: '/chart' } },
      { title: 'Save quick pairs', body: ['Tap "Pairs", search a market (e.g. EURUSD, BTCUSDT) and save it.', 'Up to 8 saved pairs show on every chart; tap one to switch instantly.'] },
      { title: 'Style the chart', body: ['Pick candle colours and chart style in the chart settings.', 'Choices are remembered on this device.'] },
      { title: 'Full TradingView', body: ['Use the TradingView page for drawing tools and indicators.'], link: { label: 'Open TradingView', to: '/tradingview' } },
    ],
  },
  {
    id: 'connect', title: '2. Connect your account', summary: 'Link an exchange or MT5 safely.',
    steps: [
      { title: 'Connect an exchange', body: ['Open Exchange Connections and add your API key.', 'Use trade-only keys — never enable withdrawals.'], link: { label: 'Exchange connections', to: '/exchange-connections' } },
      { title: 'Check balances', body: ['Confirm your funds appear before placing any order.'], link: { label: 'Exchange balances', to: '/exchange-balances' } },
      { title: 'MetaTrader 5 (optional)', body: ['Forex traders can link MT5 from the MT5 page.'], link: { label: 'Open MT5', to: '/mt5' } },
    ],
  },
  {
    id: 'manual', title: '3. Place a manual trade', summary: 'Order, stop, target — every time.',
    steps: [
      { title: 'Open manual trading', body: ['The chart and order panel sit side by side.'], link: { label: 'Manual trading', to: '/trade/manual' } },
      { title: 'Fill the order', body: ['Choose buy or sell, size, stop-loss and take-profit.', 'Never send an order without a stop-loss.'] },
      { title: 'Use the Loss Guard', body: ['Switch on the Trailing Loss Guard to protect open profit automatically.'] },
      { title: 'Manage open positions', body: ['Watch, adjust or close positions from Trades.', 'If an order is slow, wait up to a minute — the server may be waking.'], link: { label: 'Open trades', to: '/trades' } },
    ],
  },
  {
    id: 'bots', title: '4. Trading bots', summary: 'Five strategies that trade by rules.',
    steps: [
      { title: 'Learn each bot first', body: ['Read the bot lessons and try each bot Decision Lab before switching one on.'], link: { label: 'Bot lessons', to: '/learn/bots' } },
      { title: 'Open the Bots page', body: ['See all five bots, their status and recent results.'], link: { label: 'Open bots', to: '/bots' } },
      { title: 'Set schedule & limits', body: ['Choose trading hours, sleep times and risk per trade for each bot.'] },
      { title: 'Start in demo', body: ['Run bots in paper mode first; go live only after the Go-Live checklist is green.'], link: { label: 'Go-Live checklist', to: '/insights/go-live' } },
    ],
  },
  {
    id: 'review', title: '5. Risk & review', summary: 'Protect capital, then improve.',
    steps: [
      { title: 'Set risk rules', body: ['Set max risk per trade and daily loss limit.'], link: { label: 'Risk settings', to: '/risk' } },
      { title: 'Read your analytics', body: ['Edge Scorecard, streaks, P&L by symbol and long-vs-short show what works.'], link: { label: 'Open analytics', to: '/analytics' } },
      { title: 'Weekly review', body: ['Each week, review trades and write one lesson learned.'], link: { label: 'Weekly review', to: '/insights/weekly-review' } },
    ],
  },
];
