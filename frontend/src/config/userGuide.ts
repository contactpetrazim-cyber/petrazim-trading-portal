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
      { title: 'Take notes and reflect', body: ['Use the notebook and reflection prompts inside each lesson.', 'Find them later under My Notes and My Reflections.'], link: { label: 'My notes', to: '/my-notes' } },
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
