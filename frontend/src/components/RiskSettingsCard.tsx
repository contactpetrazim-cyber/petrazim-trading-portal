import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Settings {
  use_global_defaults: boolean;
  risk_per_trade: number;
  max_daily_trades: number;
  max_concurrent_trades: number;
  max_portfolio_exposure: number;
  min_rr_ratio: number;
  effective_risk_per_trade: number;
  effective_max_daily_trades: number;
  effective_max_concurrent_trades: number;
  effective_max_portfolio_exposure: number;
  effective_min_rr_ratio: number;
}

/**
 * RiskSettingsCard — a Trader Dashboard-native way to adjust risk
 * limits, by direct request ("Provide an option to adjust the global
 * risk settings in the trader Dashboard - Risk settings areas ...
 * with a global risk settings override in the Admin portal"). The
 * Admin-override half lives in AdminConsolePage.tsx's own "Global
 * Risk Defaults" card (routers/manual_trading.py's new
 * /global-risk-defaults); this is the Trader-facing half.
 *
 * Deliberately reuses GET/PATCH /manual-trading/settings — the exact
 * same endpoint (and the exact same `effective_*` fields, which
 * already resolve either the platform's global defaults or this
 * trader's own custom ones) ManualTradingPage.tsx's own Risk Settings
 * panel already talks to — one real settings row, not a second
 * parallel copy that could drift out of sync with the order form's
 * own toggle.
 */
export function RiskSettingsCard({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch(`${API_URL}/manual-trading/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load risk settings'))))
      .then(setSettings)
      .catch(() => setError('Could not load risk settings.'));
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateSettings(patch: Partial<Settings>) {
    const res = await apiFetch(`${API_URL}/manual-trading/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }

  const inputCls = `w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${
    dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'
  }`;
  const labelCls = 'text-xs text-gray-400';

  return (
    <FoldedCard title="Risk Settings" icon={<ShieldAlert size={19} />} dark={dark}>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!error && !settings && <p className="text-gray-500 text-sm">Loading…</p>}
      {settings && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => updateSettings({ use_global_defaults: true })}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${settings.use_global_defaults ? 'bg-corporate-hero text-white' : dark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-gray-500'}`}
            >
              Global defaults
            </button>
            <button
              onClick={() => updateSettings({ use_global_defaults: false })}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${!settings.use_global_defaults ? 'bg-corporate-hero text-white' : dark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-gray-500'}`}
            >
              My own settings
            </button>
          </div>
          {settings.use_global_defaults ? (
            <p className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              Using the platform defaults: {settings.effective_risk_per_trade}% risk/trade,{' '}
              {settings.effective_max_daily_trades} trades/day, {settings.effective_max_concurrent_trades} concurrent,{' '}
              {settings.effective_max_portfolio_exposure}% max exposure, {settings.effective_min_rr_ratio}:1 min R:R.
              {/* Admin can change these platform-wide defaults from
                  their own console — surfaced here so a trader on
                  Global defaults knows these numbers can move without
                  them touching anything. */}
              {' '}An Admin can update these platform-wide defaults at any time.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {([
                ['risk_per_trade', 'Risk/trade %'], ['max_daily_trades', 'Max/day'],
                ['max_concurrent_trades', 'Max concurrent'], ['max_portfolio_exposure', 'Max exposure %'],
                ['min_rr_ratio', 'Min R:R'],
              ] as const).map(([field, label]) => (
                <label key={field} className={labelCls}>
                  {label}
                  <input
                    type="number" className={inputCls} defaultValue={settings[field]}
                    onBlur={(e) => updateSettings({ [field]: Number(e.target.value) } as Partial<Settings>)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </FoldedCard>
  );
}
