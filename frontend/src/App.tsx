import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TopNav } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { FloatingTradeAI } from './components/FloatingTradeAI';
import { useThemeStore } from './hooks/useTheme';
import { DashboardPage } from './pages/Dashboard';
import { TradesPage } from './pages/Trades';
import { BotsPage } from './pages/Bots';
import { RiskPage } from './pages/RiskPage';
import { LoginPage } from './pages/LoginPage';
import { ManagerConsolePage } from './pages/ManagerConsolePage';
import { PartnerConsolePage } from './pages/PartnerConsolePage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TradingViewFramePage } from './pages/TradingViewFramePage';
import { ChartPage } from './pages/ChartPage';
import { SiteMapPage } from './pages/SiteMapPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { CorporateHomePage } from './pages/CorporateHomePage';
import { AreaPage } from './pages/AreaPage';
import { LearnPage } from './pages/LearnPage';
import { LearnTrackPage } from './pages/LearnTrackPage';
import { ToolsPage } from './pages/ToolsPage';
import { InsightsPage } from './pages/InsightsPage';
import { CommunityPage } from './pages/CommunityPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
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
 * Layout (sidebar) unchanged below — deliberately untouched by this
 * toggle, see config/theme.ts.
 */
function CorporateLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div className={`min-h-screen pb-20 transition-colors duration-300 ${dark ? 'bg-smc-dark' : 'bg-corporate-bg'}`}>
      <TopNav />
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
      <BottomNav />
      <FloatingTradeAI />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
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
            <Layout><DashboardPage /></Layout>
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
            <CorporateLayout><AdminConsolePage /></CorporateLayout>
          </ProtectedRoute>
        } />

        {/* Corporate-nav pages (TopNav shell) */}
        <Route path="/home" element={<CorporateLayout><CorporateHomePage /></CorporateLayout>} />
        <Route path="/tradingview" element={<CorporateLayout><TradingViewFramePage /></CorporateLayout>} />
        <Route path="/chart" element={<CorporateLayout><ChartPage /></CorporateLayout>} />
        <Route path="/sitemap" element={<CorporateLayout><SiteMapPage /></CorporateLayout>} />
        <Route path="/meetings" element={<CorporateLayout><MeetingsPage /></CorporateLayout>} />
        <Route path="/payments" element={<CorporateLayout><PaymentsPage /></CorporateLayout>} />

        {/* Learn, Tools, and Insights now have real pages wired to their
            real APIs (curriculum.py / tools.py / monte-carlo+weekly-review+
            validation-gate) rather than falling through to the generic
            FoldedCard link list — see the handover audit for why those
            three specifically were picked first (real, tested backend
            engines with zero frontend before this). */}
        <Route path="/learn" element={<CorporateLayout><LearnPage /></CorporateLayout>} />
        <Route path="/learn/tracks/:trackId" element={<CorporateLayout><LearnTrackPage /></CorporateLayout>} />
        <Route path="/tools" element={<CorporateLayout><ToolsPage /></CorporateLayout>} />
        <Route path="/insights" element={<CorporateLayout><InsightsPage /></CorporateLayout>} />
        <Route path="/community" element={<CorporateLayout><CommunityPage /></CorporateLayout>} />

        {/* The remaining BottomNav area landing pages (Section 9 of the
            design handover — PageHeader + content, per area). TradingView
            already has its own dedicated page above; these previously had
            no route at all, so every BottomNav tab except TradingView fell
            through to the sitemap fallback below. */}
        {(['practise', 'trade', 'explore'] as const).map((area) => (
          <Route key={area} path={`/${area}`} element={<CorporateLayout><AreaPage area={area} /></CorporateLayout>} />
        ))}

        {/* Fallback — most FEATURE_REGISTRY *sub*-features (e.g. /learn/basics,
            /tools/risk-of-ruin) have no page component built yet; see
            MERGE_MANIFEST.md "still queued" notes. Route to the Site Map
            instead of a blank screen until those land. */}
        <Route path="*" element={<Navigate to="/sitemap" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
