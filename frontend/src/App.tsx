import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TopNav } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { FloatingTradeAI } from './components/FloatingTradeAI';
import { ProgrammeStepsModal } from './components/ProgrammeStepsModal';
import { ToastProvider } from './components/ToastStack';
import { BadgeUnlockWatcher } from './components/BadgeUnlockWatcher';
import { useThemeStore } from './hooks/useTheme';
import { useInstallPromptStore } from './hooks/useInstallPrompt';
const DashboardPage = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.DashboardPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const TradesPage = lazy(() => import('./pages/Trades').then((module) => ({ default: module.TradesPage })));
const BotsPage = lazy(() => import('./pages/Bots').then((module) => ({ default: module.BotsPage })));
const RiskPage = lazy(() => import('./pages/RiskPage').then((module) => ({ default: module.RiskPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ManagerConsolePage = lazy(() => import('./pages/ManagerConsolePage').then((module) => ({ default: module.ManagerConsolePage })));
const PartnerConsolePage = lazy(() => import('./pages/PartnerConsolePage').then((module) => ({ default: module.PartnerConsolePage })));
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage').then((module) => ({ default: module.AdminConsolePage })));
const ConnectExchangePage = lazy(() => import('./pages/ConnectExchangePage').then((module) => ({ default: module.ConnectExchangePage })));
const AdminExchangeConnectionsPage = lazy(() => import('./pages/AdminExchangeConnectionsPage').then((module) => ({ default: module.AdminExchangeConnectionsPage })));
const AdminFeeSettingsPage = lazy(() => import('./pages/AdminFeeSettingsPage').then((module) => ({ default: module.AdminFeeSettingsPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const TradingViewFramePage = lazy(() => import('./pages/TradingViewFramePage').then((module) => ({ default: module.TradingViewFramePage })));
const ChartOPage = lazy(() => import('./pages/ChartOPage').then((module) => ({ default: module.ChartOPage })));
const MT5Page = lazy(() => import('./pages/MT5Page').then((module) => ({ default: module.MT5Page })));
const ChartPage = lazy(() => import('./pages/ChartPage').then((module) => ({ default: module.ChartPage })));
const SiteMapPage = lazy(() => import('./pages/SiteMapPage').then((module) => ({ default: module.SiteMapPage })));
const PoliciesPage = lazy(() => import('./pages/PoliciesPage').then((module) => ({ default: module.PoliciesPage })));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage').then((module) => ({ default: module.MeetingsPage })));
const CorporateHomePage = lazy(() => import('./pages/CorporateHomePage').then((module) => ({ default: module.CorporateHomePage })));
const AreaPage = lazy(() => import('./pages/AreaPage').then((module) => ({ default: module.AreaPage })));
const LearnPage = lazy(() => import('./pages/LearnPage').then((module) => ({ default: module.LearnPage })));
const LearnTrackPage = lazy(() => import('./pages/LearnTrackPage').then((module) => ({ default: module.LearnTrackPage })));
const LessonPage = lazy(() => import('./pages/LessonPage').then((module) => ({ default: module.LessonPage })));
const MasteryOverviewPage = lazy(() => import('./pages/MasteryOverviewPage').then((module) => ({ default: module.MasteryOverviewPage })));
const AwardsPage = lazy(() => import('./pages/AwardsPage').then((module) => ({ default: module.AwardsPage })));
const MyReflectionsPage = lazy(() => import('./pages/MyReflectionsPage').then((module) => ({ default: module.MyReflectionsPage })));
const MyNotesPage = lazy(() => import('./pages/MyNotesPage').then((module) => ({ default: module.MyNotesPage })));
const RevisionPlannerPage = lazy(() => import('./pages/RevisionPlannerPage').then((module) => ({ default: module.RevisionPlannerPage })));
const SetupSpotterGame = lazy(() => import('./pages/SetupSpotterGame').then((module) => ({ default: module.SetupSpotterGame })));
const RiskTriageGame = lazy(() => import('./pages/RiskTriageGame').then((module) => ({ default: module.RiskTriageGame })));
const BiasCheckGame = lazy(() => import('./pages/BiasCheckGame').then((module) => ({ default: module.BiasCheckGame })));
const RiskManagementDecisionLab = lazy(() => import('./pages/RiskManagementDecisionLab').then((module) => ({ default: module.RiskManagementDecisionLab })));
const TradingPsychologyDecisionLab = lazy(() => import('./pages/TradingPsychologyDecisionLab').then((module) => ({ default: module.TradingPsychologyDecisionLab })));
const MarketStructureDecisionLab = lazy(() => import('./pages/MarketStructureDecisionLab').then((module) => ({ default: module.MarketStructureDecisionLab })));
const OrderFlowDecisionLab = lazy(() => import('./pages/OrderFlowDecisionLab').then((module) => ({ default: module.OrderFlowDecisionLab })));
const MarketBasicsDecisionLab = lazy(() => import('./pages/decisionLabs/MarketBasicsDecisionLab').then((module) => ({ default: module.MarketBasicsDecisionLab })));
const LiquidityDecisionLab = lazy(() => import('./pages/decisionLabs/LiquidityDecisionLab').then((module) => ({ default: module.LiquidityDecisionLab })));
const SupplyDemandDecisionLab = lazy(() => import('./pages/decisionLabs/SupplyDemandDecisionLab').then((module) => ({ default: module.SupplyDemandDecisionLab })));
const FVGDecisionLab = lazy(() => import('./pages/decisionLabs/FVGDecisionLab').then((module) => ({ default: module.FVGDecisionLab })));
const PremiumDiscountDecisionLab = lazy(() => import('./pages/decisionLabs/PremiumDiscountDecisionLab').then((module) => ({ default: module.PremiumDiscountDecisionLab })));
const MTFDecisionLab = lazy(() => import('./pages/decisionLabs/MTFDecisionLab').then((module) => ({ default: module.MTFDecisionLab })));
const TradeManagementDecisionLab = lazy(() => import('./pages/decisionLabs/TradeManagementDecisionLab').then((module) => ({ default: module.TradeManagementDecisionLab })));
const BookKnowledgeDecisionLab = lazy(() => import('./pages/decisionLabs/BookKnowledgeDecisionLab').then((module) => ({ default: module.BookKnowledgeDecisionLab })));
const Bot1DecisionLab = lazy(() => import('./pages/decisionLabs/Bot1DecisionLab').then((module) => ({ default: module.Bot1DecisionLab })));
const Bot2DecisionLab = lazy(() => import('./pages/decisionLabs/Bot2DecisionLab').then((module) => ({ default: module.Bot2DecisionLab })));
const Bot3DecisionLab = lazy(() => import('./pages/decisionLabs/Bot3DecisionLab').then((module) => ({ default: module.Bot3DecisionLab })));
const Bot4DecisionLab = lazy(() => import('./pages/decisionLabs/Bot4DecisionLab').then((module) => ({ default: module.Bot4DecisionLab })));
const Bot5DecisionLab = lazy(() => import('./pages/decisionLabs/Bot5DecisionLab').then((module) => ({ default: module.Bot5DecisionLab })));
const VisualGlossaryPage = lazy(() => import('./pages/VisualGlossaryPage').then((module) => ({ default: module.VisualGlossaryPage })));
const WhatHappensNextGame = lazy(() => import('./pages/WhatHappensNextGame').then((module) => ({ default: module.WhatHappensNextGame })));
const ConceptSpotterGame = lazy(() => import('./pages/ConceptSpotterGame').then((module) => ({ default: module.ConceptSpotterGame })));
const CaseStudyWalkthroughPage = lazy(() => import('./pages/CaseStudyWalkthroughPage').then((module) => ({ default: module.CaseStudyWalkthroughPage })));
const ZoneTapperGame = lazy(() => import('./pages/ZoneTapperGame').then((module) => ({ default: module.ZoneTapperGame })));
const TeamEmpireSimPage = lazy(() => import('./pages/TeamEmpireSimPage').then((module) => ({ default: module.TeamEmpireSimPage })));
const MTFAlignmentGame = lazy(() => import('./pages/MTFAlignmentGame').then((module) => ({ default: module.MTFAlignmentGame })));
const TradeManagementGame = lazy(() => import('./pages/TradeManagementGame').then((module) => ({ default: module.TradeManagementGame })));
const WyckoffPhaseSorterGame = lazy(() => import('./pages/WyckoffPhaseSorterGame').then((module) => ({ default: module.WyckoffPhaseSorterGame })));
const LiquidityMatchGame = lazy(() => import('./pages/LiquidityMatchGame').then((module) => ({ default: module.LiquidityMatchGame })));
const PracticeDrillsPage = lazy(() => import('./pages/PracticeDrillsPage').then((module) => ({ default: module.PracticeDrillsPage })));
const RetentionReviewPage = lazy(() => import('./pages/RetentionReviewPage').then((module) => ({ default: module.RetentionReviewPage })));
const TradingGamePage = lazy(() => import('./pages/TradingGamePage').then((module) => ({ default: module.TradingGamePage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })));
const OrderFlowFullPage = lazy(() => import('./pages/OrderFlowFullPage').then((module) => ({ default: module.OrderFlowFullPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })));
const PerformanceForecastPage = lazy(() => import('./pages/PerformanceForecastPage').then((module) => ({ default: module.PerformanceForecastPage })));
const WeeklyReviewPage = lazy(() => import('./pages/WeeklyReviewPage').then((module) => ({ default: module.WeeklyReviewPage })));
const GoLiveChecklistPage = lazy(() => import('./pages/GoLiveChecklistPage').then((module) => ({ default: module.GoLiveChecklistPage })));
const CommunityPage = lazy(() => import('./pages/CommunityPage').then((module) => ({ default: module.CommunityPage })));
const ManualTradingPage = lazy(() => import('./pages/ManualTradingPage').then((module) => ({ default: module.ManualTradingPage })));
const TradePage = lazy(() => import('./pages/TradePage').then((module) => ({ default: module.TradePage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const PremiumDashboardPage = lazy(() => import('./pages/PremiumDashboardPage').then((module) => ({ default: module.PremiumDashboardPage })));
const CheckoutReturnPage = lazy(() => import('./pages/CheckoutReturnPage').then((module) => ({ default: module.CheckoutReturnPage })));
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccessExpiredGate } from './components/AccessExpiredGate';
import { TradingFeeGate } from './components/TradingFeeGate';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { EntitlementGate } from './components/EntitlementGate';
import type { UserRole } from './hooks/useAuth';

// Mirrors the backend's PORTAL_ACCESS hierarchy (services/portal_access.py):
// "fund_manager and partner are treated as PARALLEL specialist roles ...
// Both can drop down to the Trader view (e.g. to see exactly what their
// traders see), but neither can reach the other's console or Admin's."
// The trader console's ProtectedRoute used to allow only 'trader' itself,
// which is why "Switch Portal -> Trader dashboard" from a Manager/Partner/
// Admin session silently bounced back to their own console — the backend
// already allowed the request, the frontend route guard never did.
const TRADER_CONSOLE_ROLES: UserRole[] = ['trader', 'fund_manager', 'partner', 'admin', 'super_admin'];

/**
 * CorporateLayout — wraps the newer "corporate" pages: a slim TopNav
 * ribbon (logo + search + settings), the 8-area BottomNav tab bar, and
 * the floating Trade AI bubble, all shared across every page mounted
 * here rather than each page owning its own copy. Reconciled against
 * petrazim_preview_v13_FINAL.jsx — including the site-wide light/dark
 * toggle (useThemeStore), which this layout is what actually applies
 * to the page background; individual pages opt into dark-aware
 * styling via the same store. The Trader console keeps its own dark
 * Layout (sidebar) below, now with its own separate toggle too (see
 * useTheme.ts's portalThemes).
 *
 * `portal="admin"` switches this layout (and the TopNav it renders)
 * over to useThemeStore's separate `portalThemes.admin` slot instead
 * of the shared `theme` — by direct request, Admin remembers its own
 * light/dark choice independently of every other corporate-shell page
 * rather than sharing one setting with them. Every other route omits
 * this prop and keeps behaving exactly as before, on the shared slot.
 */
function CorporateLayout({ children, portal }: { children: React.ReactNode; portal?: 'admin' }) {
  const { theme, portalThemes } = useThemeStore();
  const dark = (portal === 'admin' ? portalThemes.admin : theme) === 'dark';
  return (
    <div className={`min-h-screen pb-20 transition-colors duration-300 ${dark ? 'bg-smc-dark' : 'bg-corporate-bg'}`}>
      <TopNav portal={portal} />
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
      <BottomNav />
      <FloatingTradeAI />
      <ProgrammeStepsModal />
    </div>
  );
}

function App() {
  const { setEvent, setInstalled } = useInstallPromptStore();

  // Captured once, here at the root, so it's ready whenever
  // BackupOfflinePanel's own "Install app" button asks for it — the
  // browser only ever fires this once and only if nothing has called
  // preventDefault() on it yet.
  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
      setEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [setEvent, setInstalled]);

  return (
    <ToastProvider>
    <BrowserRouter>
      <AccessExpiredGate>
      <TradingFeeGate>
      <AppErrorBoundary>
        {/* Mounted once at the app root, not inside CorporateLayout —
            CorporateLayout is re-instantiated on every corporate-page
            navigation (it's not a React Router layout route with an
            Outlet), so a watcher placed there would remount constantly.
            Here it survives every navigation and keeps celebrating a
            badge or level-up no matter which screen the trainee is on
            when it lands — see BadgeUnlockWatcher's own docstring. */}
        <BadgeUnlockWatcher />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Trader console — existing v2 dashboard, unchanged, now role-gated */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/trades" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><TradesPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/bots" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><BotsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><AnalyticsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/risk" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><RiskPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><BotsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/exchange-connections" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <Layout><ConnectExchangePage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/exchange-connections" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <CorporateLayout portal="admin"><AdminExchangeConnectionsPage /></CorporateLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/fees" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <CorporateLayout portal="admin"><AdminFeeSettingsPage /></CorporateLayout>
          </ProtectedRoute>
        } />

        {/* Role consoles — mounted inside CorporateLayout (like every other
            corporate-shell page) so they get the real logo, the site-wide
            light/dark toggle, and BottomNav/Settings' "Switch Portal" nav.
            They previously rendered bare, with none of that. */}
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['fund_manager']}>
            <CorporateLayout><ManagerConsolePage /></CorporateLayout>
          </ProtectedRoute>
        } />
        <Route path="/partner" element={
          <ProtectedRoute allowedRoles={['partner']}>
            <CorporateLayout><PartnerConsolePage /></CorporateLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <CorporateLayout portal="admin"><AdminConsolePage /></CorporateLayout>
          </ProtectedRoute>
        } />

        {/* Corporate-nav pages (TopNav shell) */}
        <Route path="/home" element={<CorporateLayout><CorporateHomePage /></CorporateLayout>} />
        <Route path="/tradingview" element={<CorporateLayout><TradingViewFramePage /></CorporateLayout>} />
        <Route path="/chart-o" element={<CorporateLayout><ChartOPage /></CorporateLayout>} />
        <Route path="/mt5" element={<CorporateLayout><MT5Page /></CorporateLayout>} />
        <Route path="/chart" element={<CorporateLayout><ChartPage /></CorporateLayout>} />
        <Route path="/sitemap" element={<CorporateLayout><SiteMapPage /></CorporateLayout>} />
        <Route path="/policies" element={<CorporateLayout><PoliciesPage /></CorporateLayout>} />
        <Route path="/meetings" element={<CorporateLayout><MeetingsPage /></CorporateLayout>} />
        <Route path="/payments" element={<CorporateLayout><PaymentsPage /></CorporateLayout>} />
        {/* Phase 3 — where a gateway (or the simulated test checkout)
            returns the buyer; access itself is granted server-side by the
            verified webhook, this page only reports the real outcome. */}
        <Route path="/checkout/return" element={<CheckoutReturnPage />} />

        {/* Phase 4 — premium post-login overview, gated on paid access. */}
        <Route path="/overview" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <CorporateLayout>
              <EntitlementGate feature="Your premium dashboard"><PremiumDashboardPage /></EntitlementGate>
            </CorporateLayout>
          </ProtectedRoute>
        } />

        {/* Learn, Tools, and Insights now have real pages wired to their
            real APIs (curriculum.py / tools.py / monte-carlo+weekly-review+
            validation-gate) rather than falling through to the generic
            FoldedCard link list — see the handover audit for why those
            three specifically were picked first (real, tested backend
            engines with zero frontend before this). */}
        <Route path="/learn" element={<CorporateLayout><LearnPage /></CorporateLayout>} />
        <Route path="/learn/tracks/:trackId" element={<CorporateLayout><LearnTrackPage /></CorporateLayout>} />
        <Route path="/learn/tracks/:trackId/lessons/:lessonId" element={<CorporateLayout><LessonPage /></CorporateLayout>} />

        {/* Site Map's five Learn sub-links — previously all unregistered
            routes that fell through to the sitemap redirect below, so
            clicking any of them just bounced back to the Site Map. */}
        <Route path="/learn/basics" element={<CorporateLayout><LearnPage categoryFilter="basics" /></CorporateLayout>} />
        <Route path="/learn/bots" element={<CorporateLayout><LearnPage categoryFilter="bot_mastery" /></CorporateLayout>} />
        <Route path="/learn/psychology" element={<CorporateLayout><LearnPage categoryFilter="psychology" /></CorporateLayout>} />
        <Route path="/learn/mastery" element={<CorporateLayout><MasteryOverviewPage /></CorporateLayout>} />
        <Route path="/learn/awards" element={<CorporateLayout><AwardsPage /></CorporateLayout>} />
        <Route path="/learn/reflections" element={<CorporateLayout><MyReflectionsPage /></CorporateLayout>} />
        <Route path="/learn/notes" element={<CorporateLayout><MyNotesPage /></CorporateLayout>} />
        <Route path="/learn/revision" element={<CorporateLayout><RevisionPlannerPage /></CorporateLayout>} />
        <Route path="/tools" element={<CorporateLayout><ToolsPage /></CorporateLayout>} />
        <Route path="/tools/order-flow" element={
          <CorporateLayout><EntitlementGate feature="The Order Flow tool"><OrderFlowFullPage /></EntitlementGate></CorporateLayout>
        } />
        <Route path="/insights" element={
          <CorporateLayout><EntitlementGate feature="Market intelligence"><InsightsPage /></EntitlementGate></CorporateLayout>
        } />
        {/* The full interactive version of each Insights summary tile
            — by direct bug report ("some features in Insights are not
            showing"): these were fully built and already had a real,
            working backend, just never mounted onto a route. Routes
            match what featureRegistry.ts already promised (its 3
            "insights-*" entries linked here well before this page
            existed) rather than the registry being changed to match a
            gap. */}
        <Route path="/insights/forecast" element={
          <CorporateLayout><EntitlementGate feature="Market intelligence"><PerformanceForecastPage /></EntitlementGate></CorporateLayout>
        } />
        <Route path="/insights/weekly-review" element={
          <CorporateLayout><EntitlementGate feature="Market intelligence"><WeeklyReviewPage /></EntitlementGate></CorporateLayout>
        } />
        <Route path="/insights/go-live" element={
          <CorporateLayout><EntitlementGate feature="Market intelligence"><GoLiveChecklistPage /></EntitlementGate></CorporateLayout>
        } />
        <Route path="/community" element={<CorporateLayout><CommunityPage /></CorporateLayout>} />
        <Route path="/trade" element={<CorporateLayout><TradePage /></CorporateLayout>} />

        {/* Manual Trading — its own full-bleed exchange-style layout,
            same reasoning as the Trade console's own Layout not using
            CorporateLayout: this needs the screen space a chart +
            order ticket takes, not room reserved for TopNav/BottomNav. */}
        <Route path="/trade/manual" element={
          <ProtectedRoute allowedRoles={TRADER_CONSOLE_ROLES}>
            <EntitlementGate feature="Live manual trading"><ManualTradingPage /></EntitlementGate>
          </ProtectedRoute>
        } />

        {/* The remaining BottomNav area landing pages (Section 9 of the
            design handover — PageHeader + content, per area). TradingView
            already has its own dedicated page above; these previously had
            no route at all, so every BottomNav tab except TradingView fell
            through to the sitemap fallback below. */}
        {(['practise', 'explore'] as const).map((area) => (
          <Route key={area} path={`/${area}`} element={<CorporateLayout><AreaPage area={area} /></CorporateLayout>} />
        ))}

        {/* Practise's three sub-features — previously unregistered routes
            (Site Map linked to them, but they fell through to the sitemap
            redirect below like every other still-queued sub-feature).
            Backed by routers/practise.py, new this pass — real Practice
            Drills, spaced-recall Retention Review, and a quiz-streak
            Trading Simulator Game over authored lesson content. */}
        <Route path="/practise/drills" element={<CorporateLayout><PracticeDrillsPage /></CorporateLayout>} />
        <Route path="/practise/review" element={<CorporateLayout><RetentionReviewPage /></CorporateLayout>} />
        <Route path="/practise/game" element={<CorporateLayout><TradingGamePage /></CorporateLayout>} />
        <Route path="/practise/games/setup-spotter" element={<CorporateLayout><SetupSpotterGame /></CorporateLayout>} />
        <Route path="/practise/games/risk-triage" element={<CorporateLayout><RiskTriageGame /></CorporateLayout>} />
        <Route path="/practise/games/bias-check" element={<CorporateLayout><BiasCheckGame /></CorporateLayout>} />
        <Route path="/learn/decision-lab/risk-management" element={<CorporateLayout><RiskManagementDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/trading-psychology" element={<CorporateLayout><TradingPsychologyDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/market-structure" element={<CorporateLayout><MarketStructureDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/order-flow-trading" element={<CorporateLayout><OrderFlowDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/market-basics" element={<CorporateLayout><MarketBasicsDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/liquidity" element={<CorporateLayout><LiquidityDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/supply-demand" element={<CorporateLayout><SupplyDemandDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/fair-value-gaps" element={<CorporateLayout><FVGDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/premium-discount" element={<CorporateLayout><PremiumDiscountDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/multi-timeframe" element={<CorporateLayout><MTFDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/trade-management" element={<CorporateLayout><TradeManagementDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/book-knowledge" element={<CorporateLayout><BookKnowledgeDecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/bot-1" element={<CorporateLayout><Bot1DecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/bot-2" element={<CorporateLayout><Bot2DecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/bot-3" element={<CorporateLayout><Bot3DecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/bot-4" element={<CorporateLayout><Bot4DecisionLab /></CorporateLayout>} />
        <Route path="/learn/decision-lab/bot-5" element={<CorporateLayout><Bot5DecisionLab /></CorporateLayout>} />
        <Route path="/learn/visual-glossary" element={<CorporateLayout><VisualGlossaryPage /></CorporateLayout>} />
        <Route path="/practise/games/what-happens-next" element={<CorporateLayout><WhatHappensNextGame /></CorporateLayout>} />
        <Route path="/practise/games/concept-spotter" element={<CorporateLayout><ConceptSpotterGame /></CorporateLayout>} />
        <Route path="/learn/case-study" element={<CorporateLayout><CaseStudyWalkthroughPage /></CorporateLayout>} />
        <Route path="/practise/games/zone-tapper" element={<CorporateLayout><ZoneTapperGame /></CorporateLayout>} />
        <Route path="/practise/team-sim" element={<CorporateLayout><TeamEmpireSimPage /></CorporateLayout>} />
        <Route path="/practise/games/mtf-alignment" element={<CorporateLayout><MTFAlignmentGame /></CorporateLayout>} />
        <Route path="/practise/games/trade-management" element={<CorporateLayout><TradeManagementGame /></CorporateLayout>} />
        <Route path="/practise/games/wyckoff-phase-sorter" element={<CorporateLayout><WyckoffPhaseSorterGame /></CorporateLayout>} />
        <Route path="/practise/games/liquidity-match" element={<CorporateLayout><LiquidityMatchGame /></CorporateLayout>} />

        {/* Fallback — most FEATURE_REGISTRY *sub*-features (e.g. /learn/basics,
            /tools/risk-of-ruin) have no page component built yet; see
            MERGE_MANIFEST.md "still queued" notes. Route to the Site Map
            instead of a blank screen until those land. */}
        <Route path="*" element={<Navigate to="/sitemap" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
      </TradingFeeGate>
      </AccessExpiredGate>
    </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
