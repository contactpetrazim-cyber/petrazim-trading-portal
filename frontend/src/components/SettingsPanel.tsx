import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X, Home, CreditCard, GraduationCap, CalendarClock, LayoutGrid,
  HardDriveDownload, Link2, ChevronRight, Sun, Moon, Map, LogOut, Crown, Wallet, ScrollText, Activity,
} from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import type { ThemeName } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useTradeAIStore } from '../hooks/useTradeAI';
import { PortalSelectionCard, PortalOption } from './PortalSelectionCard';
import { BackupOfflinePanel } from './BackupOfflinePanel';
import { EverythingIncludedPanel } from './EverythingIncludedPanel';
import { apiFetch } from './AccessExpiredGate';
import { feesApi } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * SettingsPanel — slide-over from the gear icon in TopNav, per
 * petrazim_preview_v13_FINAL.jsx, plus one addition: a "Home" row at
 * the top, added by direct request for a quick way back to the
 * dashboard from anywhere in the app (the reference's own six items
 * had no such shortcut). Five are functionally real: "Home" (links to
 * /home), the theme toggle (wired to useTheme), "Select Access and
 * Pay" (links to /payments, the real checkout page), "Facilitator
 * Sessions" (links to /meetings), "Switch Portal" (fetches the
 * current user's real GET /auth/available-portals list and opens the
 * real PortalSelectionCard — the reference's hardcoded four-portal
 * demo, backed by data here), and now "Ask Trading Coach" too — it
 * opens the same FloatingTradeAI panel every page already mounts (via
 * the shared useTradeAIStore) instead of doing nothing, per direct bug
 * report ("Ask Coach is not working"). That panel now answers for real
 * too — POST /coach/ask (services/ai_coach.py), a free-tier-only
 * multi-provider rotation, per direct instruction. "Backup and
 * Offline" now opens BackupOfflinePanel too —
 * see that component's own docstring for what it backs up and why,
 * adapted from the reference site's own panel (screenshot supplied
 * directly) to what this app can honestly back up. "Quick Links" is
 * the one remaining informational row, same as the reference — this
 * doesn't invent navigation the design didn't specify.
 */
export function SettingsPanel({
  open,
  onClose,
  theme,
  setTheme,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  dark: boolean;
}) {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { setOpen: setTradeAIOpen } = useTradeAIStore();
  const [switchPortals, setSwitchPortals] = useState<PortalOption[] | null>(null);
  const [backupOfflineOpen, setBackupOfflineOpen] = useState(false);
  const [premiumOverviewOpen, setPremiumOverviewOpen] = useState(false);

  // EverythingIncludedPanel only knows 'partner' | 'fund_manager' |
  // 'admin' (it renders that tier's own tools plus every tier
  // beneath it — see its own docstring); a Trader has no tier beneath
  // it to show, so the row below is simply omitted for Trader users,
  // matching that no console page renders this panel for Trader
  // either. super_admin reuses 'admin' — a Super Admin's access is a
  // strict superset of Admin's, never less.
  const premiumTier = user?.role === 'admin' || user?.role === 'super_admin' ? 'admin'
    : user?.role === 'fund_manager' ? 'fund_manager'
    : user?.role === 'partner' ? 'partner'
    : null;

  // Real fee balance, Trader only — the same performance-fee/Paystack-
  // gate system as Connect Your Exchange's own "Performance Fees" card,
  // reachable from here too now: "the user fee payment page... is
  // missing... embed in Add Exchange and settings Icon and Admin
  // portals" (Add Exchange and Admin already had it — this was the one
  // genuine gap). Fetched only on open, matching every other real item
  // in this panel (Switch Portal's own available-portals call, etc.) —
  // not on every render.
  const [feesOwed, setFeesOwed] = useState<{ amount: number; currency: string } | null>(null);
  useEffect(() => {
    if (!open || user?.role !== 'trader') return;
    feesApi.gateStatus()
      .then((s) => setFeesOwed({ amount: s.total_owed, currency: s.currency }))
      .catch(() => {});
  }, [open, user?.role]);

  if (!open) return null;

  function handleLogOut() {
    logout();
    onClose();
    navigate('/login');
  }

  async function openSwitchPortal() {
    if (!token) return;
    const res = await apiFetch(`${API_URL}/auth/available-portals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setSwitchPortals(data.portals);
  }

  function openTradeAI() {
    setTradeAIOpen(true);
    onClose();
  }

  const items: { icon: typeof CreditCard; label: string; detail: string; to?: string; onClick?: () => void }[] = [
    { icon: Home, label: 'Home', detail: 'Back to the dashboard', to: '/home' },
    { icon: CreditCard, label: 'Select Access and Pay', detail: 'Choose a tier or duration pass', to: '/payments' },
    // Embedded here too, by direct request ("Add and embed 'Traders
    // Dashboard' link to the settings icon") — Home (above) goes to
    // the main site's CorporateHomePage; this is the actual Trader
    // Console (stats, equity curve, pending approvals) at /dashboard.
    // Ordered after Select Access and Pay by direct follow-up request
    // ("Trader Dashboard would come after Select and Pay in
    // arrangement in the Settings icon").
    { icon: Activity, label: 'Traders Dashboard', detail: 'Your trading console — stats, equity curve, pending approvals', to: '/dashboard' },
    { icon: GraduationCap, label: 'Ask Trading Coach', detail: 'Open Trade AI', onClick: openTradeAI },
    { icon: CalendarClock, label: 'Facilitator Sessions', detail: 'Book time with a Manager or Partner (Tier 2/3)', to: '/meetings' },
    // Connect a real exchange account — embedded here too (by direct
    // request, "Embed within settings icon on the site") alongside
    // Layout.tsx's own trader-console nav entry, since the gear icon
    // is reachable from every page while that sidebar only covers the
    // Trader console's own five pages.
    { icon: Link2, label: 'Add Exchange', detail: 'Connect your own exchange account for manual or bot trading', to: '/exchange-connections' },
    ...(user?.role === 'trader' && feesOwed ? [{
      icon: Wallet, label: 'Trading Fees',
      detail: feesOwed.amount > 0
        ? `${feesOwed.currency} ${feesOwed.amount.toFixed(2)} owed — pay with Paystack or crypto`
        : 'No performance fees currently owed',
      to: '/exchange-connections',
    }] : []),
    { icon: LayoutGrid, label: 'Switch Portal', detail: 'Trader / Fund Manager / Partner / Admin — jump to a console you have access to', onClick: openSwitchPortal },
    // "Everything included at this level" — embedded here too, by
    // direct request, so it's reachable from wherever you are in the
    // app instead of only on the console dashboard it's already
    // mounted on. Omitted entirely for Trader (see premiumTier above).
    ...(premiumTier ? [{ icon: Crown, label: 'Everything Included', detail: 'Every tool and feature at your level, one overview', onClick: () => setPremiumOverviewOpen(true) }] : []),
    { icon: Map, label: 'Site Map', detail: 'Every page in the app, one list', to: '/sitemap' },
    { icon: ScrollText, label: 'Policies', detail: 'Risk disclosure, terms, privacy, and refund policy', to: '/policies' },
    { icon: HardDriveDownload, label: 'Backup and Offline', detail: 'Manage local data and sync', onClick: () => setBackupOfflineOpen(true) },
    { icon: Link2, label: 'Quick Links', detail: 'Shortcuts to frequent pages' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className={`w-full max-w-sm h-full shadow-2xl overflow-y-auto ${dark ? 'bg-corporate-nav-dark' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <span className={`font-bold font-display ${dark ? 'text-white' : 'text-[#141a33]'}`}>Settings</span>
          <button onClick={onClose} aria-label="Close settings">
            <X size={20} className={dark ? 'text-white/50' : 'text-[#9aa0b8]'} />
          </button>
        </div>

        {/* Theme toggle — functionally real */}
        <div className={`p-5 border-b ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <div className={`text-xs font-semibold mb-3 ${dark ? 'text-white/40' : 'text-[#9aa0b8]'}`}>APPEARANCE</div>
          <div className={`flex rounded-xl p-1 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
            <button
              onClick={() => setTheme('light')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={theme === 'light' ? { background: '#fff', color: '#005FB8', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: dark ? 'rgba(255,255,255,0.5)' : '#7c839c' }}
            >
              <Sun size={15} /> Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={theme === 'dark' ? { background: HERO_GRADIENT, color: '#fff' } : { color: dark ? 'rgba(255,255,255,0.5)' : '#7c839c' }}
            >
              <Moon size={15} /> Dark
            </button>
          </div>
        </div>

        <div className="p-3">
          {items.map((it, i) => {
            const Icon = it.icon;
            const content = (
              <>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-corporate-hero/10 text-corporate-hero">
                  <Icon size={16} />
                </span>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-[#141a33]'}`}>{it.label}</div>
                  <div className={`text-xs ${dark ? 'text-white/40' : 'text-[#7c839c]'}`}>{it.detail}</div>
                </div>
                <ChevronRight size={16} className={dark ? 'text-white/20' : 'text-[#c8cce0]'} />
              </>
            );
            const className = `w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`;
            return it.to ? (
              <Link key={i} to={it.to} onClick={onClose} className={className}>{content}</Link>
            ) : (
              <button key={i} onClick={it.onClick} className={className}>{content}</button>
            );
          })}
        </div>

        {/* Log Out — separated from the regular nav rows above by its
            own border and red styling, by direct request ("include a
            log out button in settings embedded in settings icon").
            Same gear-icon slide-over every portal already shares, so
            this covers Trader, Manager, Partner, and Admin alike. */}
        <div className={`p-3 border-t ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <button
            onClick={handleLogOut}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-red-500 ${dark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10">
              <LogOut size={16} />
            </span>
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </div>

      {switchPortals && (
        <PortalSelectionCard
          portals={switchPortals}
          onClose={() => setSwitchPortals(null)}
          onSelect={(route) => {
            setSwitchPortals(null);
            onClose();
            navigate(route);
          }}
        />
      )}

      {backupOfflineOpen && <BackupOfflinePanel onClose={() => setBackupOfflineOpen(false)} />}

      {premiumOverviewOpen && premiumTier && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setPremiumOverviewOpen(false)}>
          <div
            className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}
            onClick={(e) => {
              e.stopPropagation();
              // EverythingIncludedPanel's own rows are plain <Link>s with
              // no onClick of their own (it's shared with 3 other,
              // non-modal call sites where there's nothing to close) —
              // by direct bug report ("the links ... does not work or
              // trigger the corresponding page"): they WERE navigating
              // fine, just invisibly, underneath this still-open
              // full-screen popup AND the settings drawer behind it,
              // which looked identical to nothing happening at all.
              // Close both whenever the click that bubbled up here
              // landed on (or inside) a link.
              if ((e.target as HTMLElement).closest('a')) {
                setPremiumOverviewOpen(false);
                onClose();
              }
            }}
          >
            <div className="p-5 rounded-t-3xl flex items-center justify-between" style={{ background: HERO_GRADIENT }}>
              <div className="flex items-center gap-2.5 text-white">
                <Crown size={20} />
                <span className="font-bold font-display">Everything Included</span>
              </div>
              <button onClick={() => setPremiumOverviewOpen(false)} aria-label="Close">
                <X size={20} className="text-white/80" />
              </button>
            </div>
            <div className="p-5">
              <EverythingIncludedPanel tier={premiumTier} dark={dark} defaultOpen />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
