import { useEffect, useState } from 'react';
import { ShieldAlert, Clock3, TrendingUp, Snowflake } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';
import { botsApi } from '../services/api';
import { TRADING_SESSIONS, WEEKDAYS, tradingSessionLabel } from '../config/tradingSessions';

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
  // Manual trading's own leverage override — by direct request ("put
  // a form to set leverage for Bot and manual - separately on the
  // trader dashboard ... with a global override form in the Admin").
  // Independent of use_global_defaults above (always editable, same
  // shape as Bots.tsx's own Starting Reference Capital/Leverage
  // fields) — null means "use the platform default/Admin master."
  leverage: number | null;
  effective_leverage: number;
  // Trading Schedule — the same global schedule concept bots now use,
  // as manual trading's own GLOBAL setting — by direct request ("also
  // include for global settings for manual trading"). Empty/null on
  // any of these means "All" (no restriction).
  schedule_sessions?: string[] | null;
  schedule_days?: number[] | null;
  schedule_half_day?: string | null;
  // Trailing exit — manual trading's own global counterpart to a
  // bot's own trailing settings, by direct request ("Provide a toggle
  // in the bots and manual settings and order form"). null on
  // trailing_activation_r means "inherit the platform default" (2.0,
  // after TP2) — effective_trailing_activation_r already resolves
  // that, same shape as effective_leverage above.
  use_trailing_stop: boolean;
  trailing_activation_r: number | null;
  effective_trailing_activation_r: number;
  // Trailing Loss Guard — manual trading's own on/off switch, by
  // direct request ("Can we apply similar and adapt to manual trading
  // with an on or off guard toggle"). See backend
  // ManualTradingSettings.use_loss_guard's own comment for the full
  // bot-wide + pair-wide mechanism this gates.
  use_loss_guard: boolean;
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
function Chip({ active, dark, onClick, children }: { active: boolean; dark: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
        active
          ? 'bg-indigo-500 text-white border-transparent'
          : dark ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function scheduleLabel(sessions?: string[] | null, days?: number[] | null, halfDay?: string | null): string {
  const sessionsLabel = sessions && sessions.length > 0 ? sessions.map(tradingSessionLabel).join(', ') : 'All';
  const daysLabel = days && days.length > 0
    ? days.map((d) => WEEKDAYS.find((x) => x.key === d)?.label || d).join(', ')
    : 'All';
  const halfDayLabel = halfDay === 'am' ? 'AM' : halfDay === 'pm' ? 'PM' : 'All';
  return `Sessions: ${sessionsLabel} · Days: ${daysLabel} · Half-day: ${halfDayLabel}`;
}

export function RiskSettingsCard({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Trading Schedule — see Settings.schedule_sessions' own comment
  // above. Empty Set / 'all' both mean "All" (no restriction), same
  // default every trader starts from.
  const [selSessions, setSelSessions] = useState<Set<string>>(new Set());
  const [selDays, setSelDays] = useState<Set<number>>(new Set());
  const [selHalfDay, setSelHalfDay] = useState<'all' | 'am' | 'pm'>('all');
  const [savingSchedule, setSavingSchedule] = useState(false);
  // Only the `enabled` flag is actually needed here — settings.
  // effective_leverage (from /manual-trading/settings) already
  // resolves the master override's VALUE; this just tells the input
  // below whether to disable itself and explain why, same UX as
  // Bots.tsx's own Leverage field.
  const [masterLeverageEnabled, setMasterLeverageEnabled] = useState(false);
  useEffect(() => { botsApi.getMasterLeverage().then((d) => setMasterLeverageEnabled(d.enabled)).catch(() => {}); }, []);

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

  function toggleSession(key: string) {
    setSelSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleDay(key: number) {
    setSelDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      await updateSettings({
        schedule_sessions: Array.from(selSessions), schedule_days: Array.from(selDays), schedule_half_day: selHalfDay,
      });
    } finally {
      setSavingSchedule(false);
    }
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
          {/* Leverage — by direct request ("put a form to set leverage
              for Bot and manual - separately on the trader dashboard
              ... with a global override form in the Admin"). Always
              shown (independent of the Global defaults/My own settings
              toggle above, same as Bots.tsx's own Leverage field is
              independent of its other risk fields) since leverage
              isn't part of GLOBAL_RISK_DEFAULTS_KEY's own soft
              fallback set. */}
          <div className={`mt-3 pt-3 border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
            <label className={labelCls}>
              Leverage (x)
              {masterLeverageEnabled ? (
                <div className={`mt-1 px-3 py-2 rounded-lg text-xs ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  Overridden by the Admin's master control — fixed at {settings.effective_leverage}x right now.
                </div>
              ) : (
                <input
                  type="number" step="1" min="1" max="125" className={`${inputCls} max-w-[140px]`}
                  defaultValue={settings.leverage ?? settings.effective_leverage}
                  onBlur={(e) => updateSettings({ leverage: Number(e.target.value) })}
                />
              )}
            </label>
          </div>
          {/* Trading Schedule — the same bot-level schedule concept,
              now manual trading's own GLOBAL setting — by direct
              request ("also include for global settings for manual
              trading"). Outside the saved window, a NEW manual order
              is rejected outright (never blocks managing/closing a
              position already open). */}
          <div className={`mt-3 pt-3 border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
              <Clock3 size={13} className={dark ? 'text-white/50' : 'text-gray-500'} />
              Trading Schedule
            </div>
            <p className={`text-[11px] mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              Outside this window, a new manual order is rejected — never affects a position already open.
            </p>
            <div className="text-[11px] text-gray-500 mb-2">
              Currently: {scheduleLabel(settings.schedule_sessions, settings.schedule_days, settings.schedule_half_day)}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip active={selSessions.size === 0} dark={dark} onClick={() => setSelSessions(new Set())}>All Sessions</Chip>
                {TRADING_SESSIONS.map((s) => (
                  <Chip key={s.key} active={selSessions.has(s.key)} dark={dark} onClick={() => toggleSession(s.key)}>
                    {s.label} {s.tier === 'core' ? '· core' : '· non-core'}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip active={selDays.size === 0} dark={dark} onClick={() => setSelDays(new Set())}>All Days</Chip>
                {WEEKDAYS.map((d) => (
                  <Chip key={d.key} active={selDays.has(d.key)} dark={dark} onClick={() => toggleDay(d.key)}>{d.label}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip active={selHalfDay === 'all'} dark={dark} onClick={() => setSelHalfDay('all')}>All Day</Chip>
                <Chip active={selHalfDay === 'am'} dark={dark} onClick={() => setSelHalfDay('am')}>AM</Chip>
                <Chip active={selHalfDay === 'pm'} dark={dark} onClick={() => setSelHalfDay('pm')}>PM</Chip>
                <button
                  onClick={saveSchedule}
                  disabled={savingSchedule}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  {savingSchedule ? 'Saving…' : 'Set Schedule'}
                </button>
              </div>
            </div>
          </div>
          {/* Trailing Exit — "let winners run" without loosening
              losers, by direct request ("Provide a toggle in the bots
              and manual settings and order form ... so that it can be
              switched in a dynamic way ... default is TP2"). Once the
              final TP leg's activation point fires, it trails instead
              of closing at a fixed price — see Trade.
              trailing_activation_r's own backend comment. */}
          <div className={`mt-3 pt-3 border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
              <TrendingUp size={13} className={dark ? 'text-white/50' : 'text-gray-500'} />
              Trailing Exit
            </div>
            <p className={`text-[11px] mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              Lets the final take-profit leg run with a trailing stop instead of closing at a fixed price.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={settings.use_trailing_stop} dark={dark} onClick={() => updateSettings({ use_trailing_stop: true })}>On</Chip>
              <Chip active={!settings.use_trailing_stop} dark={dark} onClick={() => updateSettings({ use_trailing_stop: false })}>Off</Chip>
              {settings.use_trailing_stop && (
                <>
                  <Chip active={settings.effective_trailing_activation_r === 1} dark={dark} onClick={() => updateSettings({ trailing_activation_r: 1 })}>After TP1 (1R)</Chip>
                  <Chip active={settings.effective_trailing_activation_r === 2} dark={dark} onClick={() => updateSettings({ trailing_activation_r: 2 })}>After TP2 (2R) · default</Chip>
                </>
              )}
            </div>
          </div>
          {/* Trailing Loss Guard — manual trading's own on/off switch,
              by direct request ("Can we apply similar and adapt to
              manual trading with an on or off guard toggle"). Blocks
              a NEW manual order (never an existing position) while
              your own manual trading, or the pair you're about to
              trade across every bot, is on a cold streak — see
              services/trailing_loss_guard.py's own module docstring
              for the full mechanism. On by default. */}
          <div className={`mt-3 pt-3 border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
              <Snowflake size={13} className={dark ? 'text-white/50' : 'text-gray-500'} />
              Trailing Loss Guard
            </div>
            <p className={`text-[11px] mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
              Pauses new manual orders while your own trading, or the pair you're about to trade, is on a real cold streak (3 losses in a row, or a heavy loss within the last 4 hours).
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={settings.use_loss_guard} dark={dark} onClick={() => updateSettings({ use_loss_guard: true })}>On · default</Chip>
              <Chip active={!settings.use_loss_guard} dark={dark} onClick={() => updateSettings({ use_loss_guard: false })}>Off</Chip>
            </div>
          </div>
        </div>
      )}
    </FoldedCard>
  );
}
