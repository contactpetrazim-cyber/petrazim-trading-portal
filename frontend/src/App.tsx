import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TopNav } from './components/TopNav';
import { DashboardPage } from './pages/Dashboard';
import { TradesPage } from './pages/Trades';
import { BotsPage } from './pages/Bots';
import { LoginPage } from './pages/LoginPage';
import { ManagerConsolePage } from './pages/ManagerConsolePage';
import { PartnerConsolePage } from './pages/PartnerConsolePage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TradingViewFramePage } from './pages/TradingViewFramePage';
import { ChartPage } from './pages/ChartPage';
import { SiteMapPage } from './pages/SiteMapPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { ProtectedRoute } from './components/ProtectedRoute';

/**
 * CorporateLayout — wraps the newer "corporate" pages (TopNav's 7-tab
 * nav + light theme) that were built as standalone components but
 * never mounted under a shared shell. The Trader console keeps its
 * own dark Layout (sidebar) unchanged below.
 */
function CorporateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-corporate-bg">
      <TopNav />
      {children}
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
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/trades" element={
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><TradesPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/bots" element={
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><BotsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/risk" element={
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['trader']}>
            <Layout><BotsPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Role consoles */}
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['fund_manager']}>
            <ManagerConsolePage />
          </ProtectedRoute>
        } />
        <Route path="/partner" element={
          <ProtectedRoute allowedRoles={['partner']}>
            <PartnerConsolePage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminConsolePage />
          </ProtectedRoute>
        } />

        {/* Corporate-nav pages (TopNav shell) */}
        <Route path="/tradingview" element={<CorporateLayout><TradingViewFramePage /></CorporateLayout>} />
        <Route path="/chart" element={<CorporateLayout><ChartPage /></CorporateLayout>} />
        <Route path="/sitemap" element={<CorporateLayout><SiteMapPage /></CorporateLayout>} />
        <Route path="/meetings" element={<CorporateLayout><MeetingsPage /></CorporateLayout>} />

        {/* Fallback — most FEATURE_REGISTRY areas (Learn/Practise/Insights/Tools/
            Explore landing pages) have no page component built yet; see
            MERGE_MANIFEST.md "still queued" notes. Route to the Site Map
            instead of a blank screen until those land. */}
        <Route path="*" element={<Navigate to="/sitemap" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
