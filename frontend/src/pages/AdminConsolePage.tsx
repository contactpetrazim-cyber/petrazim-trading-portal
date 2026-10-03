import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Users, Link2, Percent, ArrowRight, Bot, Wallet, Zap } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { RoleBadge } from '../components/RoleBadge';
import { RosterPanel } from '../components/RosterPanel';
import { AllUsersCard } from '../components/AllUsersCard';
import { AccessCodesPanel } from '../components/AccessCodesPanel';
import { TraderOversightPanel } from '../components/TraderOversightPanel';
import { LearningDashboardPanel } from '../components/LearningDashboardPanel';
import { EverythingIncludedPanel } from '../components/EverythingIncludedPanel';
import { PlatformOverviewPanel } from '../components/PlatformOverviewPanel';
import { RoleAdministrationPanel } from '../components/RoleAdministrationPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { apiFetch } from '../components/AccessExpiredGate';
import { PremiumOverviewCard } from '../components/PremiumOverviewCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  badge_color: string;
}

/**
 * Admin / Super Admin console. User list is visible to both Admin and
 * Super Admin; create/change-role/remove actions only render (and only
 * succeed server-side) for the seeded Super Admin — matches
 * require_super_admin() on the backend, not just require_role(ADMIN).
 *
 * Now follows its own light/dark toggle (useThemeStore's
 * portalThemes.admin, wired via CorporateLayout's portal="admin" prop
 * in App.tsx) instead of the smc-* dark palette being forced
 * unconditionally — by direct request, Admin defaults light like
 * every other portal and can be switched independently of them. Dark
 * mode keeps the exact original smc-* terminal colors unchanged; light
 * mode reuses the same white/corporate-bg palette every other
 * light-mode console already uses. Still mounted inside CorporateLayout
 * in App.tsx (like every other console) purely for the shared logo/nav.
 *
 * "Admin will have everything in Manager and more" — mounts the same
 * RosterPanel/TraderOversightPanel/AccessCodesPanel the Manager
 * console has. No backend changes needed for this: roster.py's
 * get_roster and user_can_manage_trader already give Admin/Super
 * Admin the full, unscoped view (every roster, every trader), the
 * same principle used everywhere else access is role-gated.
 */

/** AdminLinkCard — a navigate-away link styled exactly like FoldedCard
 * (the site's real card template: rounded-2xl border, icon in a tinted
 * circular chip, title + summary), but without the expand/collapse
 * behavior a plain link-out has no use for — a trailing arrow instead
 * of FoldedCard's chevron makes that "this navigates, it doesn't
 * unfold" distinction visible too. By direct request ("put these in
 * separate cards ... follow portal design template"): Trader Exchange
 * Connections and Performance Fees were previously a flat, hand-rolled
 * `flex` row that didn't match any other card on this page. */
function AdminLinkCard({
  to, icon, title, summary, dark,
}: { to: string; icon: ReactNode; title: string; summary: string; dark: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-5 rounded-2xl border transition-shadow ${
        dark
          ? 'bg-corporate-surface-dark border-corporate-border-dark hover:bg-smc-card/80'
          : 'bg-white border-[#dcdce8] hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)]'
      }`}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-corporate-hero/10 text-corporate-hero">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{title}</div>
        <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-[#7c839c]'}`}>{summary}</div>
      </div>
      <ArrowRight size={18} className={`shrink-0 ${dark ? 'text-white/30' : 'text-[#9aa0b8]'}`} />
    </Link>
  );
}
export function AdminConsolePage() {
  const { user, token } = useAuth();
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.admin === 'dark';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentsMode, setPaymentsMode] = useState<'test' | 'live' | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [paperEnforced, setPaperEnforced] = useState<boolean | null>(null);
  const [switchingPaper, setSwitchingPaper] = useState(false);
  const [firefliesEnabled, setFirefliesEnabled] = useState<boolean | null>(null);
  const [switchingFireflies, setSwitchingFireflies] = useState(false);
  const [scannerCapabilityEnabled, setScannerCapabilityEnabled] = useState<boolean | null>(null);
  const [scannerRuntimeEnabled, setScannerRuntimeEnabled] = useState<boolean | null>(null);
  const [switchingScanner, setSwitchingScanner] = useState(false);
  // Global Risk Defaults — by direct request ("with a global risk
  // settings override in the Admin portal"). Edited in a draft object
  // (not saved on every keystroke) so a Super Admin can change all 4
  // fields, then commit them together with one Save — see
  // routers/manual_trading.py's own PATCH /global-risk-defaults for
  // why these are written atomically as one JSON blob.
  const [riskDefaults, setRiskDefaults] = useState<{
    risk_per_trade: number; max_daily_trades: number; max_portfolio_exposure: number; min_rr_ratio: number; is_override: boolean;
  } | null>(null);
  const [riskDraft, setRiskDraft] = useState<{ risk_per_trade: number; max_daily_trades: number; max_portfolio_exposure: number; min_rr_ratio: number } | null>(null);
  const [savingRiskDefaults, setSavingRiskDefaults] = useState(false);

  // Master Bot Control — the platform-wide override of every bot's own
  // Starting Reference Capital/Balance, by direct request ("Create a
  // master bot control for bot starting reference capital and balance
  // ... put master in Admin portal to supersede all"). Same draft/Save
  // shape as Global Risk Defaults above — edited locally, committed
  // together with one PATCH — but it's a hard kill-switch (see
  // get_effective_account_balance's own backend comment), not a soft
  // fallback, so toggling it ON gets the same confirm() guard as
  // Paper Trading Master Control below.
  const [masterBalance, setMasterBalance] = useState<{ enabled: boolean; value: number; platform_default: number } | null>(null);
  const [masterBalanceDraft, setMasterBalanceDraft] = useState<{ enabled: boolean; value: number } | null>(null);
  const [masterBalanceError, setMasterBalanceError] = useState(false);
  const [savingMasterBalance, setSavingMasterBalance] = useState(false);
  function loadMasterBalance() {
    setMasterBalanceError(false);
    apiFetch(`${API_URL}/bots/master-account-balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('master-account-balance failed'))))
      .then((d) => { setMasterBalance(d); setMasterBalanceDraft({ enabled: d.enabled, value: d.value }); })
      .catch(() => setMasterBalanceError(true));
  }

  // Master Leverage Control — same hard-override shape as Master Bot
  // Control above, for leverage instead of balance — by direct request
  // ("put a form to set leverage for Bot and manual - separately on
  // the trader dashboard ... with a global override form in the
  // Admin"). Overrides every bot's AND every manual trader's own
  // leverage setting at once.
  const [masterLeverage, setMasterLeverage] = useState<{ enabled: boolean; value: number; platform_default: number } | null>(null);
  const [masterLeverageDraft, setMasterLeverageDraft] = useState<{ enabled: boolean; value: number } | null>(null);
  const [masterLeverageError, setMasterLeverageError] = useState(false);
  const [savingMasterLeverage, setSavingMasterLeverage] = useState(false);
  function loadMasterLeverage() {
    setMasterLeverageError(false);
    apiFetch(`${API_URL}/bots/master-leverage`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('master-leverage failed'))))
      .then((d) => { setMasterLeverage(d); setMasterLeverageDraft({ enabled: d.enabled, value: d.value }); })
      .catch(() => setMasterLeverageError(true));
  }

  const isSuperAdmin = user?.role === 'super_admin';

  // By direct bug report, with screenshot ("Fix the continuous loading
  // issue for the above uploaded pic - fix - important"): the Bot
  // Market Scanner card (and, identically, Payments Mode/Trading
  // Master Control/Fireflies above it) could get stuck on "Loading…"
  // forever. Root cause: each of these four GETs ended in a bare
  // `.catch(() => {})` — a genuine failure (a cold Render free-tier
  // start taking longer than apiFetch's own 20s timeout, a dropped
  // connection, ...) was silently swallowed, and since the swallowed
  // branch never sets the toggle's own state away from its initial
  // `null`, the card had no way to ever leave "Loading…" short of a
  // full page refresh landing on a healthy backend. Now tracked with
  // one shared error flag and a real "Try again" affordance, pulled
  // into its own function (loadAdminToggles) so a retry only re-runs
  // these four fetches, not the separate users-list load above.
  const [togglesError, setTogglesError] = useState(false);
  function loadAdminToggles() {
    setTogglesError(false);
    Promise.all([
      apiFetch(`${API_URL}/payments/mode`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('payments/mode failed')))).then((d) => setPaymentsMode(d.mode)),
      apiFetch(`${API_URL}/manual-trading/master-mode`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('master-mode failed')))).then((d) => setPaperEnforced(d.paper_enforced)),
      apiFetch(`${API_URL}/meetings/fireflies-setting`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fireflies-setting failed')))).then((d) => setFirefliesEnabled(d.enabled)),
      apiFetch(`${API_URL}/bots/market-scanner-mode`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('market-scanner-mode failed'))))
        .then((d) => { setScannerCapabilityEnabled(d.capability_enabled); setScannerRuntimeEnabled(d.runtime_enabled); }),
    ]).catch(() => setTogglesError(true));
  }

  // Global Risk Defaults had the exact same "stuck on Loading… forever"
  // gap as the four toggles above (a bare `.catch(() => {})` swallowing
  // a genuine failure with nothing to ever move riskDefaults off its
  // initial `null`) — this card just hadn't been folded into
  // loadAdminToggles/togglesError yet. Same shape, kept separate since
  // this card's own retry shouldn't re-run the unrelated toggle fetches
  // above it (or vice versa).
  const [riskError, setRiskError] = useState(false);
  function loadRiskDefaults() {
    setRiskError(false);
    apiFetch(`${API_URL}/manual-trading/global-risk-defaults`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('global-risk-defaults failed'))))
      .then((d) => { setRiskDefaults(d); setRiskDraft(d); })
      .catch(() => setRiskError(true));
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load users');
        setUsers(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    loadAdminToggles();
    loadRiskDefaults();
    loadMasterBalance();
    loadMasterLeverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveMasterBalance() {
    if (!masterBalanceDraft) return;
    if (masterBalanceDraft.enabled && !window.confirm(
      `Turn ON the Master Bot Control override? Every bot's signal sizing will immediately use $${masterBalanceDraft.value.toFixed(2)} as its account balance, platform-wide, regardless of what any bot's own Starting Reference Capital says.`
    )) return;
    setSavingMasterBalance(true);
    try {
      const res = await apiFetch(`${API_URL}/bots/master-account-balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(masterBalanceDraft),
        timeoutMs: 60_000,
      });
      if (res.ok) {
        const d = await res.json();
        setMasterBalance(d);
        setMasterBalanceDraft({ enabled: d.enabled, value: d.value });
      }
    } finally {
      setSavingMasterBalance(false);
    }
  }

  async function saveMasterLeverage() {
    if (!masterLeverageDraft) return;
    if (masterLeverageDraft.enabled && !window.confirm(
      `Turn ON the Master Leverage override? Every bot's AND every manual trader's own leverage will immediately become ${masterLeverageDraft.value}x, platform-wide, regardless of what any bot's/trader's own setting says.`
    )) return;
    setSavingMasterLeverage(true);
    try {
      const res = await apiFetch(`${API_URL}/bots/master-leverage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(masterLeverageDraft),
        timeoutMs: 60_000,
      });
      if (res.ok) {
        const d = await res.json();
        setMasterLeverage(d);
        setMasterLeverageDraft({ enabled: d.enabled, value: d.value });
      }
    } finally {
      setSavingMasterLeverage(false);
    }
  }

  async function saveRiskDefaults() {
    if (!riskDraft) return;
    setSavingRiskDefaults(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/global-risk-defaults`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(riskDraft),
        timeoutMs: 60_000,
      });
      if (res.ok) {
        const d = await res.json();
        setRiskDefaults(d);
        setRiskDraft(d);
      }
    } finally {
      setSavingRiskDefaults(false);
    }
  }

  async function setMode(mode: 'test' | 'live') {
    if (mode === paymentsMode) return;
    if (mode === 'live' && !window.confirm(
      'Switch payments to LIVE mode? Every checkout from now on will hit a real payment gateway with real cards. This is not reversible for payments already in flight.'
    )) return;
    setSwitchingMode(true);
    try {
      // 60s — same cold-start reasoning as RoleAdministrationPanel's
      // own Apply button: these platform-wide toggles are exactly the
      // kind of one-off action a Super Admin takes right after opening
      // the console, which is precisely when a free-tier backend is
      // most likely still asleep.
      const res = await apiFetch(`${API_URL}/payments/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode }),
        timeoutMs: 60_000,
      });
      if (res.ok) setPaymentsMode((await res.json()).mode);
    } finally {
      setSwitchingMode(false);
    }
  }

  async function setPaperEnforcement(next: boolean) {
    if (next === paperEnforced) return;
    if (!next && !window.confirm(
      'Turn OFF the platform-wide Paper Trading override? Every trader’s own Test/Live and Paper Trading settings take effect again immediately — anyone already in Live with Paper Trading off will start placing real orders.'
    )) return;
    setSwitchingPaper(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/master-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paper_enforced: next }),
        timeoutMs: 60_000,
      });
      if (res.ok) setPaperEnforced((await res.json()).paper_enforced);
    } finally {
      setSwitchingPaper(false);
    }
  }

  async function setFireflies(next: boolean) {
    if (next === firefliesEnabled) return;
    setSwitchingFireflies(true);
    try {
      const res = await apiFetch(`${API_URL}/meetings/fireflies-setting`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: next }),
        timeoutMs: 60_000,
      });
      if (res.ok) setFirefliesEnabled((await res.json()).enabled);
    } finally {
      setSwitchingFireflies(false);
    }
  }

  async function setScannerRuntime(next: boolean) {
    if (next === scannerRuntimeEnabled) return;
    setSwitchingScanner(true);
    try {
      const res = await apiFetch(`${API_URL}/bots/market-scanner-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ runtime_enabled: next }),
        timeoutMs: 60_000,
      });
      if (res.ok) setScannerRuntimeEnabled((await res.json()).runtime_enabled);
    } finally {
      setSwitchingScanner(false);
    }
  }

  if (!user) return null;

  return (
    <div className={`rounded-2xl p-6 -mx-5 md:mx-0 ${dark ? 'bg-smc-dark text-white' : 'bg-white text-corporate-text-on-bg'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isSuperAdmin ? 'Super Admin' : 'Admin'} Console
          </h1>
          <p className={`text-sm mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {isSuperAdmin
              ? 'Full account management — add, change role, or remove any user.'
              : 'Read-only user directory. Account changes require Super Admin.'}
          </p>
        </div>
        <RoleBadge user={user} />
      </div>

      <div className="mb-4">
        <PremiumOverviewCard subtitle="The same live premium dashboard the Trader console opens — today's trades, profit, drawdown, active trades, configured risk, 30-day equity curve, live chart, pending approvals, bots and learning progress." />
      </div>

      <div className="mb-4">
        <PlatformOverviewPanel dark={dark} />
      </div>

      {/* Trader exchange-onboarding management and the performance-fee
          system — by direct request ("Put the onboarding controls and
          management in the admin portal", "introduce a fee base ...
          Create a fee vs free toggle ... include in Admin portal").
          Two separate AdminLinkCards (see that component's own
          docstring), not one merged block — by direct follow-up
          request ("put these in separate cards ... follow portal
          design template"). */}
      <div className="space-y-3 mb-4">
        <AdminLinkCard
          to="/admin/exchange-connections" icon={<Link2 size={18} />} dark={dark}
          title="Trader Exchange Connections"
          summary="Manage every trader's connected exchange account"
        />
        <AdminLinkCard
          to="/admin/fees" icon={<Percent size={18} />} dark={dark}
          title="Performance Fees"
          summary="Fee toggle, percentage, payout destination, and the owed/paid ledger"
        />
      </div>

      <div className="space-y-3 mb-4">
      {isSuperAdmin && (
        <FoldedCard
          title="Payments Mode"
          summary={paymentsMode === null ? 'Loading…' : paymentsMode === 'test' ? 'Test — no real gateway' : 'LIVE — real money'}
          icon={<ShieldAlert size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className={`text-xs mb-3 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
            Test: checkout opens a simulated page — choose Success or Failure yourself, no real gateway or card involved.
            Live: real Stripe/Paystack/IvoryPay checkout, real money.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('test')}
              disabled={switchingMode}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                paymentsMode === 'test'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Test
            </button>
            <button
              onClick={() => setMode('live')}
              disabled={switchingMode}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                paymentsMode === 'live'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Live
            </button>
            {paymentsMode === null && (togglesError
              ? <button type="button" onClick={loadAdminToggles} className="text-xs text-red-500 underline">Could not load — try again</button>
              : <span className="text-xs text-gray-500">Loading…</span>)}
          </div>
        </FoldedCard>
      )}

      {/* Trading Master Control — by direct request ("a master control
          in the super Admin portal"), same pattern as Payments Mode
          right above it. */}
      {isSuperAdmin && (
        <FoldedCard
          title="Trading Master Control"
          summary={paperEnforced === null ? 'Loading…' : paperEnforced ? 'ON — every trader forced to Paper Trading' : 'Off — individual settings respected'}
          icon={<ShieldAlert size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            On: forces EVERY trader's account into Paper Trading platform-wide, overriding each individual trader's
            own Test/Live and Paper Trading toggle — a real kill-switch, not a default. Off: every trader's own
            settings (visible and changeable from the badge in every portal's header) take effect as normal.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaperEnforcement(true)}
              disabled={switchingPaper}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                paperEnforced === true
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Force Paper Trading — On
            </button>
            <button
              onClick={() => setPaperEnforcement(false)}
              disabled={switchingPaper}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                paperEnforced === false
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Off — respect individual settings
            </button>
            {paperEnforced === null && (togglesError
              ? <button type="button" onClick={loadAdminToggles} className="text-xs text-red-500 underline">Could not load — try again</button>
              : <span className="text-xs text-gray-500">Loading…</span>)}
          </div>
        </FoldedCard>
      )}

      {/* Fireflies Master Control — same pattern as Trading Master
          Control above, by direct request ("Remove fireflies button
          from facilitator session section and put a Fireflies toggle
          on vs off in the portals follow hierarchy"): one Super
          Admin-set switch, every portal's Meetings page beneath it
          just shows the resolved state (FacilitatorCalendar.tsx). */}
      {isSuperAdmin && (
        <FoldedCard
          title="Fireflies Master Control"
          summary={firefliesEnabled === null ? 'Loading…' : firefliesEnabled ? 'On' : 'Off'}
          icon={<ShieldAlert size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            On: the Fireflies notetaker is invited to every facilitator session booked platform-wide, across every
            portal. Off: no session anywhere gets a notetaker invite, regardless of who books it.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFireflies(true)}
              disabled={switchingFireflies}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                firefliesEnabled === true
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              On
            </button>
            <button
              onClick={() => setFireflies(false)}
              disabled={switchingFireflies}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                firefliesEnabled === false
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Off
            </button>
            {firefliesEnabled === null && (togglesError
              ? <button type="button" onClick={loadAdminToggles} className="text-xs text-red-500 underline">Could not load — try again</button>
              : <span className="text-xs text-gray-500">Loading…</span>)}
          </div>
        </FoldedCard>
      )}

      {/* Bot Market Scanner — by direct request ("provide a switch in
          the admin toggle on and off"), same pattern as Fireflies
          Master Control above. capability_enabled (the
          MARKET_SCANNER_ENABLED env var, deployed on Render + the VM
          backup) is read-only here — it needs a redeploy, not a
          click; runtime_enabled is the actual pause/resume switch,
          checked once per scan cycle with no restart needed. */}
      {isSuperAdmin && (
        <FoldedCard
          title="Bot Market Scanner"
          summary={
            scannerCapabilityEnabled === null ? 'Loading…'
              : !scannerCapabilityEnabled ? 'Not deployed'
              : scannerRuntimeEnabled ? 'On — scanning every 3 min' : 'Paused'
          }
          icon={<Bot size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            On: every active bot's strategy runs against live market candles every few minutes. A bot in
            Human-in-the-Loop mode only creates a pending approval — nothing executes until you approve it.
            A bot in Fully Autonomous mode executes immediately. Off: bots stay idle and only react to a
            manual TradingView alert, same as before this was turned on.
          </p>
          {scannerCapabilityEnabled === false && (
            <p className="text-xs text-amber-500 mb-3">
              Not deployed on this backend yet — the MARKET_SCANNER_ENABLED environment variable needs to be
              set on Render (and the Nube VM backup) before this switch does anything.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScannerRuntime(true)}
              disabled={switchingScanner || !scannerCapabilityEnabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                scannerRuntimeEnabled === true
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              On
            </button>
            <button
              onClick={() => setScannerRuntime(false)}
              disabled={switchingScanner || !scannerCapabilityEnabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
                scannerRuntimeEnabled === false
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
              }`}
            >
              Off
            </button>
            {scannerRuntimeEnabled === null && (togglesError
              ? <button type="button" onClick={loadAdminToggles} className="text-xs text-red-500 underline">Could not load — try again</button>
              : <span className="text-xs text-gray-500">Loading…</span>)}
          </div>
        </FoldedCard>
      )}

      {/* Global Risk Defaults — by direct request ("Provide an option
          to adjust the global risk settings in the trader Dashboard -
          Risk settings areas ... with a global risk settings override
          in the Admin portal"). These are the numbers every trader on
          "Global defaults" (their own Risk Settings toggle, on the
          Trader Dashboard or Manual Trading) actually resolves to —
          used to be config.py's own static DEFAULT_RISK_PERCENT etc.,
          only changeable by editing an env var and redeploying. */}
      {isSuperAdmin && (
        <FoldedCard
          title="Global Risk Defaults"
          summary={riskDefaults === null ? (riskError ? 'Could not load' : 'Loading…') : riskDefaults.is_override ? 'Customized' : 'Platform defaults (not customized)'}
          icon={<ShieldAlert size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            Every trader whose own Risk Settings are set to "Global defaults" resolves to these 4 numbers — changing
            them here takes effect immediately, platform-wide, with no redeploy.
          </p>
          {!riskDraft && (riskError
            ? <button type="button" onClick={loadRiskDefaults} className="text-xs text-red-500 underline">Could not load — try again</button>
            : <span className="text-xs text-gray-500">Loading…</span>)}
          {riskDraft && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ['risk_per_trade', 'Risk/trade %'], ['max_daily_trades', 'Max trades/day'],
                ['max_portfolio_exposure', 'Max exposure %'], ['min_rr_ratio', 'Min R:R'],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-xs text-gray-400">
                  {label}
                  <input
                    type="number"
                    value={riskDraft[field]}
                    onChange={(e) => setRiskDraft({ ...riskDraft, [field]: Number(e.target.value) })}
                    className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
                  />
                </label>
              ))}
            </div>
          )}
          <button
            onClick={saveRiskDefaults}
            disabled={savingRiskDefaults || !riskDraft}
            className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${dark ? 'bg-smc-accent' : 'bg-corporate-hero'}`}
          >
            {savingRiskDefaults ? 'Saving…' : 'Save global defaults'}
          </button>
        </FoldedCard>
      )}

      {/* Master Bot Control — by direct request ("Create a master bot
          control for bot starting reference capital and balance ...
          put master in Admin portal to supersede all"). Each bot's own
          Starting Reference Capital lives on its own Bots page card
          (BotConfig.account_balance_usd); this is the ONE switch that,
          when on, overrides every single one of them at once — the
          same real balance every bot's live signal sizing (and Risk
          Amount USD display) is actually computed against. */}
      {isSuperAdmin && (
        <FoldedCard
          title="Master Bot Control"
          summary={
            masterBalance === null ? (masterBalanceError ? 'Could not load' : 'Loading…')
              : masterBalance.enabled ? `Override ON — $${masterBalance.value.toFixed(2)} for every bot` : 'Off — each bot uses its own setting'
          }
          icon={<Wallet size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            Starting Reference Capital/Balance is the real account size every bot's own signal sizing (and its
            Risk Amount USD figure) is computed against. On: this ONE number supersedes every bot's own setting,
            platform-wide. Off: each bot resolves to its own Starting Reference Capital, or the platform default
            (${masterBalance?.platform_default.toFixed(2) ?? '—'}) when it hasn't set one.
          </p>
          {!masterBalanceDraft && (masterBalanceError
            ? <button type="button" onClick={loadMasterBalance} className="text-xs text-red-500 underline">Could not load — try again</button>
            : <span className="text-xs text-gray-500">Loading…</span>)}
          {masterBalanceDraft && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMasterBalanceDraft({ ...masterBalanceDraft, enabled: true })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    masterBalanceDraft.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
                  }`}
                >
                  On
                </button>
                <button
                  onClick={() => setMasterBalanceDraft({ ...masterBalanceDraft, enabled: false })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    !masterBalanceDraft.enabled
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
                  }`}
                >
                  Off
                </button>
              </div>
              <label className="text-xs text-gray-400">
                Override value (USD)
                <input
                  type="number" step="100" min="1"
                  value={masterBalanceDraft.value}
                  onChange={(e) => setMasterBalanceDraft({ ...masterBalanceDraft, value: Number(e.target.value) })}
                  className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
                />
              </label>
              <button
                onClick={saveMasterBalance}
                disabled={savingMasterBalance}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${dark ? 'bg-smc-accent' : 'bg-corporate-hero'}`}
              >
                {savingMasterBalance ? 'Saving…' : 'Save master control'}
              </button>
            </div>
          )}
        </FoldedCard>
      )}

      {/* Master Leverage Control — by direct request ("put a form to
          set leverage for Bot and manual - separately on the trader
          dashboard ... with a global override form in the Admin").
          Each bot's own Leverage lives on its own Bots page card, and
          each trader's own Manual Trading leverage lives on their Risk
          Settings card; this is the ONE switch that, when on,
          overrides every single one of them at once. */}
      {isSuperAdmin && (
        <FoldedCard
          title="Master Leverage Control"
          summary={
            masterLeverage === null ? (masterLeverageError ? 'Could not load' : 'Loading…')
              : masterLeverage.enabled ? `Override ON — ${masterLeverage.value}x for every bot and trader` : "Off — each bot/trader uses its own setting"
          }
          icon={<Zap size={18} />} accent="#f59e0b" dark={dark} defaultOpen
        >
          <p className="text-xs text-gray-500 mb-3">
            Leverage used when sizing/executing both bot-driven and manual trades. On: this ONE number supersedes
            every bot's own Leverage AND every trader's own Manual Trading leverage, platform-wide. Off: each
            resolves to its own setting, or the platform default ({masterLeverage?.platform_default ?? '—'}x) when
            it hasn't set one.
          </p>
          {!masterLeverageDraft && (masterLeverageError
            ? <button type="button" onClick={loadMasterLeverage} className="text-xs text-red-500 underline">Could not load — try again</button>
            : <span className="text-xs text-gray-500">Loading…</span>)}
          {masterLeverageDraft && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMasterLeverageDraft({ ...masterLeverageDraft, enabled: true })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    masterLeverageDraft.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
                  }`}
                >
                  On
                </button>
                <button
                  onClick={() => setMasterLeverageDraft({ ...masterLeverageDraft, enabled: false })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    !masterLeverageDraft.enabled
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : dark ? 'bg-smc-dark text-gray-400 border-smc-border hover:text-white' : 'bg-gray-50 text-gray-500 border-corporate-bg hover:text-corporate-text-on-bg'
                  }`}
                >
                  Off
                </button>
              </div>
              <label className="text-xs text-gray-400">
                Override value (x)
                <input
                  type="number" step="1" min="1" max="125"
                  value={masterLeverageDraft.value}
                  onChange={(e) => setMasterLeverageDraft({ ...masterLeverageDraft, value: Number(e.target.value) })}
                  className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
                />
              </label>
              <button
                onClick={saveMasterLeverage}
                disabled={savingMasterLeverage}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${dark ? 'bg-smc-accent' : 'bg-corporate-hero'}`}
              >
                {savingMasterLeverage ? 'Saving…' : 'Save master control'}
              </button>
            </div>
          )}
        </FoldedCard>
      )}
      </div>

      <div className="space-y-4 mb-4">
        <LearningDashboardPanel dark={dark} />
        <RosterPanel dark={dark} />
        <AllUsersCard dark={dark} />
        <TraderOversightPanel dark={dark} />
        <AccessCodesPanel dark={dark} />
        <EverythingIncludedPanel tier="admin" dark={dark} />
      </div>

      <div className="mb-4">
        <RoleAdministrationPanel dark={dark} />
      </div>

      {/* All Users — folded closed by default too, by direct request
          ("make a collapsible Role Administration and users... default
          is closed"), same FoldedCard primitive as everything above it. */}
      <FoldedCard title="All Users" icon={<Users size={19} />} dark={dark}>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${dark ? 'bg-smc-dark border-smc-border' : 'bg-gray-50 border-corporate-bg'}`}
              >
                <div>
                  <div className={`font-medium text-sm ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{u.full_name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: `${u.badge_color}1a`,
                      color: u.badge_color,
                      border: `1px solid ${u.badge_color}4d`,
                    }}
                  >
                    {u.role.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">{u.status}</span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-gray-500 text-sm">No users yet.</p>
            )}
          </div>
        )}

        {!isSuperAdmin && (
          <p className="text-xs text-amber-400/90 bg-amber-400/10 rounded-lg px-3 py-2 mt-4">
            Adding, changing, or removing accounts is limited to the Super
            Admin — this console shows the directory only.
          </p>
        )}
      </FoldedCard>
    </div>
  );
}
