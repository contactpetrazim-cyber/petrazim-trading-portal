// User manual content — single source for the /guide page and exported documents.
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

export const PORTAL_REFERENCE_GUIDE: GuidePhase[] = [
  {
    id: 'decision-labs', title: '1. Decision Labs', summary: 'Practise reasoning before risking money.',
    steps: [
      { title: 'Choose a topic', body: ['Open Learn and choose a Decision Lab that matches the subject you are studying: risk, psychology, market structure, order flow or a bot strategy.', 'Start with Risk Management if you are new.'], link: { label: 'Risk Management Decision Lab', to: '/learn/decision-lab/risk-management' } },
      { title: 'Read the scenario and decide', body: ['Read the situation, then select the action you would take.', 'There is no timer. Consider the risk and the evidence before choosing.'] },
      { title: 'Read the consequence', body: ['Read the explanation of your choice before continuing to the next decision.', 'The lab gives feedback on decision quality rather than a pass-or-fail score.'] },
      { title: 'Review and repeat', body: ['At the end, review your choices. Restart the scenario to compare a different approach.', 'Write down one rule you will apply next time. A lab is practice, not a recommendation to place a real trade.'], link: { label: 'My notes', to: '/learn/notes' } },
    ],
  },
  {
    id: 'practice', title: '2. Drills & games', summary: 'Turn lessons into repeatable skills.',
    steps: [
      { title: 'Open practice drills', body: ['Choose a drill related to a lesson you have completed.', 'Read the prompt, submit your answer and review the feedback before moving on. Sign in to save your learning attempts.'], link: { label: 'Practice drills', to: '/practise/drills' } },
      { title: 'Try Setup Spotter', body: ['Read the challenge and classify the setup using the available choices.', 'Watch the countdown, then review your result and retry the concepts you missed.'], link: { label: 'Setup Spotter', to: '/practise/games/setup-spotter' } },
      { title: 'Practise risk decisions', body: ['Open Risk Triage and choose the appropriate response to each risk situation.', 'Use feedback to improve your reasoning, not just your speed.'], link: { label: 'Risk Triage', to: '/practise/games/risk-triage' } },
      { title: 'Revisit what you learned', body: ['Use Retention Review to revisit earlier material.', 'Return to the lesson when an answer is unclear rather than guessing repeatedly.'], link: { label: 'Retention Review', to: '/practise/review' } },
    ],
  },
  {
    id: 'study-tools', title: '3. Visual learning & revision', summary: 'Definitions, worked examples and saved learning.',
    steps: [
      { title: 'Look up a concept', body: ['Open the Visual Glossary and find the trading concept you want to understand.', 'Compare the diagram and explanation with the lesson before applying it to a chart.'], link: { label: 'Visual Glossary', to: '/learn/visual-glossary' } },
      { title: 'Follow a worked example', body: ['Open the Case Study Walkthrough and read the situation in sequence.', 'Compare your own interpretation with the explanation at each stage.'], link: { label: 'Case Study Walkthrough', to: '/learn/case-study' } },
      { title: 'Plan your revision', body: ['Open the Revision Planner and review the topics shown for your learning.', 'Revisit the associated lessons and practise the areas that need attention.'], link: { label: 'Revision Planner', to: '/learn/revision' } },
      { title: 'Return to your reflections', body: ['Use My Reflections to revisit what you recorded during lessons.', 'Compare earlier decisions with what you understand now.'], link: { label: 'My Reflections', to: '/learn/reflections' } },
    ],
  },
  {
    id: 'calculators', title: '4. Tools & simulations', summary: 'Test assumptions without placing orders.',
    steps: [
      { title: 'Choose a tool', body: ['Open Tools and expand the calculator or simulator you need.', 'Read its input labels and check that amounts, percentages and trade counts use the intended units.'], link: { label: 'Open Tools', to: '/tools' } },
      { title: 'Enter realistic assumptions', body: ['For Risk-of-Ruin, enter assumptions drawn from your trading record rather than your best winning streak.', 'Where offered, use Import from Recent Trades and confirm the selected Live or Test data is appropriate.'] },
      { title: 'Compare scenarios', body: ['Run the simulation, read the results, then change one assumption at a time.', 'Use the Prop-Firm Simulator to compare challenge outcomes under different risk assumptions.'] },
      { title: 'Keep the limitations in mind', body: ['Simulated outcomes are estimates, not guarantees or orders.', 'Check your firm’s current rules separately and return to Risk settings before changing actual trading limits.'], link: { label: 'Risk settings', to: '/risk' } },
    ],
  },
  {
    id: 'trader-console', title: '5. Trader console', summary: 'Your trading workspace and shared features.',
    steps: [
      { title: 'Sign in and open the dashboard', body: ['The Trader dashboard is available to signed-in Trader, Partner, Fund Manager and Admin accounts.', 'Check the account, mode and connection status before interpreting trading figures.'], link: { label: 'Trader dashboard', to: '/dashboard' } },
      { title: 'Review before acting', body: ['Review the equity curve, signals and bot activity.', 'If a signal is awaiting approval, check its details and your risk rules before approving or rejecting it.'] },
      { title: 'Open the premium overview', body: ['Use Premium overview for the combined trading and learning view.', 'Some features require an active access pass; follow the access message if one appears.'], link: { label: 'Premium overview', to: '/overview' } },
      { title: 'Explore included features', body: ['Expand Everything included at this level when shown on your console.', 'Select a named item to open its page. A listed feature does not override account permissions.'] },
    ],
  },
  {
    id: 'partner-console', title: '6. Partner console', summary: 'Sponsored traders, seats and facilitator sessions.',
    steps: [
      { title: 'Open your assigned console', body: ['Sign in with an account assigned the Partner role and open the Partner console.', 'If access is refused, ask a platform administrator to check your assigned role; buying a pass does not grant a staff role.'], link: { label: 'Partner console', to: '/partner' } },
      { title: 'Manage your roster', body: ['Expand Roster & Cohort Assignment.', 'Invite a trader, assign a cohort or detach a sponsored trader using the available controls. Check the displayed roster after the action.'] },
      { title: 'Manage access codes and seats', body: ['Expand Access Codes & Seats to issue corporate access within your available allocation.', 'Review the code status before sharing it. Use Hold or Resume only on codes you issued.'] },
      { title: 'Review learning and sessions', body: ['Use Learning Dashboard to review roster progress.', 'Open Facilitator Sessions to review booked sessions and set topics where your account permits.'], link: { label: 'Facilitator sessions', to: '/meetings' } },
    ],
  },
  {
    id: 'manager-console', title: '7. Fund Manager console', summary: 'Roster oversight and trader risk controls.',
    steps: [
      { title: 'Open the manager workspace', body: ['Sign in with the Fund Manager role and open the Fund Manager console.', 'The specialist console is role-restricted even though shared Trader features remain available.'], link: { label: 'Fund Manager console', to: '/manager' } },
      { title: 'Select a roster trader', body: ['Expand Trader Risk Oversight and choose the trader you need to review.', 'Confirm the trader’s identity before changing any settings.'] },
      { title: 'Review and update risk', body: ['Review the trader’s current bot risk settings.', 'Change only the intended values, save with the available control and check the displayed result. These are actual trading settings, not a simulation.'] },
      { title: 'Use shared features', body: ['Use Everything included at this level to open shared learning and trading pages.', 'Specialist Partner and Admin pages still require their own assigned roles.'] },
    ],
  },
  {
    id: 'admin-console', title: '8. Admin & Super Admin consoles', summary: 'Platform visibility and restricted administration.',
    steps: [
      { title: 'Open the Admin console', body: ['Sign in as Admin or Super Admin.', 'Check Platform Overview and Full User Directory before taking an account-specific action.'], link: { label: 'Admin console', to: '/admin' } },
      { title: 'Check the intended account', body: ['Locate the correct user and verify the email and current role.', 'A roster only lists sponsored traders; the full directory covers platform accounts.'] },
      { title: 'Change a role — Super Admin only', body: ['Open Role Administration, enter the account email and choose the intended role.', 'Submit the change and check the reported result. An ordinary Admin cannot promote or demote accounts.'] },
      { title: 'Use platform controls cautiously', body: ['Payments Mode and Paper-Trading Master Control are restricted to Super Admin.', 'Confirm whether Test or Live is intended before changing a platform-wide setting. Read the resulting status; do not assume a failed action took effect.'] },
      { title: 'Review platform connections', body: ['Open Admin Exchange Connections when you need to review platform exchange setup.', 'Never share private exchange keys, passwords or account tokens in messages or screenshots.'], link: { label: 'Admin Exchange Connections', to: '/admin/exchange-connections' } },
    ],
  },
];

export const GUIDE_PHASES = [
  { id: 'phase-1', title: 'Phase 1', summary: 'Access & setup · Finding your way around · First lesson · First trade · Help', sections: DAY1_GUIDE },
  { id: 'phase-2', title: 'Phase 2', summary: 'Charts & pairs · Account connections · Manual trading · Bots · Risk & review', sections: MASTER_TRADING_GUIDE },
  { id: 'phase-3', title: 'Phase 3', summary: 'Decision Labs · Drills & games · Learning tools · Simulations · Role consoles', sections: PORTAL_REFERENCE_GUIDE },
  { id: 'phase-4', title: 'Phase 4', summary: 'Annotated screen illustrations · Also shown inside Phases 1–3', sections: [] },
  { id: 'phase-5', title: 'Phase 5', summary: 'Planned: Walkthrough slideshow or video & final compilation', sections: [] },
];

// Phase 4 — annotated illustrations keyed by section id.
import type { DiagramSpec } from '../components/GuideDiagram';
export const GUIDE_DIAGRAMS: Record<string, DiagramSpec> = {
  orient: { title: 'Portal layout', layout: 'nav', callouts: ['Top bar: search, theme toggle, account', 'Page area: folded cards — tap to open', 'Bottom tabs: the eight areas'] },
  learn: { title: 'Lesson screen', layout: 'cards', callouts: ['Lesson content', 'Notebook & reflection', 'Quiz to unlock the next lesson'] },
  charts: { title: 'Chart screen', layout: 'chart', callouts: ['Toolbar: timeframe, Order, Pairs', 'Live candles', 'Saved quick pairs'] },
  manual: { title: 'Manual trading', layout: 'order', callouts: ['Chart', 'Order: buy/sell & size', 'Stop-loss, take-profit & Loss Guard'] },
  bots: { title: 'Bots page', layout: 'cards', callouts: ['Bot card: status & results', 'Schedule & risk limits', 'Demo / live mode'] },
  'decision-labs': { title: 'Decision Lab', layout: 'cards', callouts: ['Scenario', 'Your choices', 'Consequence & explanation'] },
  'admin-console': { title: 'Role console', layout: 'console', callouts: ['Role badge & overview', 'User directory / roster', 'Restricted controls'] },
};
