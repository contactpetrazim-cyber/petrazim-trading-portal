import { useEffect, useState } from 'react';
import { FlaskConical, Radio, Lock, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Settings {
  trading_mode: 'test' | 'live';
  paper_trading_enabled: boolean;
}

/**
 * TradingModeBadge — a small, always-visible Test/Live + Paper Trading
 * indicator, by direct request ("how do i know when i am in test vs
 * live mode and also paper trading vs live mode ... i need a visible
 * toggle for both ... in each portal"). Sits in the header next to
 * BackendStatusBadge in both TopNav.tsx (every corporate-shell page,
 * including Manager/Partner/Admin) and Layout.tsx (the Trader
 * console) — the same two places that badge already lives, so this
 * shows up everywhere regardless of which portal you're in, without
 * needing its own new nav real estate per page.
 *
 * Doubles as the toggle itself (click to flip either setting) so a
 * trader never has to leave whatever page they're on to check or
 * change it — reads/writes the exact same ManualTradingSettings
 * ManualTradingPage.tsx's own header controls do.
 *
 * When a Super Admin has switched on the platform-wide kill-switch
 * (GET /manual-trading/master-mode), this shows a locked "PAPER —
 * Platform-wide" state instead and the individual toggles are hidden
 * — nothing to toggle locally while an override is active.
 */
export function TradingModeBadge({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [masterEnforced, setMasterEnforced] = useState(false);
  const [open, setOpen] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  function load() {
    if (!token) return;
    apiFetch(`${API_URL}/manual-trading/settings`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSettings(d))
      .catch(() => {});
    apiFetch(`${API_URL}/manual-trading/master-mode`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMasterEnforced(d.paper_enforced))
      .catch(() => {});
  }

  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(body: Partial<Settings>) {
    const res = await apiFetch(`${API_URL}/manual-trading/settings`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) setSettings(await res.json());
  }

  if (!token || !settings) return null;

  const isTest = settings.trading_mode === 'test';
  const isSimulated = masterEnforced || isTest || settings.paper_trading_enabled;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${
          isSimulated ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-500'
        }`}
        title="Test/Live and Paper Trading status — click to change"
      >
        {masterEnforced ? <Lock size={12} /> : isSimulated ? <FlaskConical size={12} /> : <Radio size={12} />}
        {masterEnforced ? 'PAPER (Platform-wide)' : isSimulated ? 'PAPER TRADING' : 'LIVE'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-lg z-50 p-3 space-y-2 ${
            dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'
          }`}
        >
          {masterEnforced ? (
            <p className={`text-xs leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>
              A Super Admin has switched on the platform-wide Paper Trading kill-switch — every account is forced
              into Paper Trading right now, regardless of your own settings below.
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${dark ? 'text-white/60' : 'text-gray-500'}`}>Mode</span>
            <button
              onClick={() => patch({ trading_mode: isTest ? 'live' : 'test' })}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dark ? 'bg-white/10 text-white/80' : 'bg-black/5 text-gray-700'}`}
            >
              {isTest ? 'Test' : 'Live'} — switch to {isTest ? 'Live' : 'Test'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${dark ? 'text-white/60' : 'text-gray-500'}`}>Paper Trading</span>
            <button
              onClick={() => patch({ paper_trading_enabled: !settings.paper_trading_enabled })}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                settings.paper_trading_enabled ? 'bg-amber-500/15 text-amber-600' : dark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-gray-500'
              }`}
            >
              <span className={`relative w-7 h-3.5 rounded-full transition-colors shrink-0 ${settings.paper_trading_enabled ? 'bg-amber-500' : dark ? 'bg-white/20' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${settings.paper_trading_enabled ? 'translate-x-3.5' : ''}`} />
              </span>
              {settings.paper_trading_enabled ? 'On' : 'Off'}
            </button>
          </div>

          <p className={`text-[11px] leading-relaxed pt-1 border-t ${dark ? 'border-white/10 text-white/30' : 'border-gray-100 text-gray-400'}`}>
            Paper Trading stays available in both Test and Live — when on, orders never reach a real broker even in
            Live mode. Full order form: Trade → Manual Trading.
          </p>
        </div>
      )}
    </div>
  );
}
