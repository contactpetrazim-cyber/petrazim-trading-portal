import { useEffect, useState } from 'react';
import { ConnectorCards } from '../components/ConnectorCards';
import { FacilitatorCalendar } from '../components/FacilitatorCalendar';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { fetchJsonWithRetry } from '../lib/resilientFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * MeetingsPage — /meetings route.
 *
 * No longer owns its own min-h-screen/background wrapper — same fix
 * as SiteMapPage's earlier: that fought CorporateLayout's background
 * and left this page stuck light even with the theme toggle set to
 * dark. Now reads the same theme store and passes `dark` down to
 * ConnectorCards and the calendar strip in FacilitatorCalendar (its
 * booking modal stays plain white on purpose — every "decision
 * moment" card in this app does, see AccessExpiredGate/
 * LoginCardStyleB/PortalSelectionCard, so this isn't an oversight).
 *
 * userTier now comes from the real GET /payments/access-status
 * (built alongside the checkout page) instead of a hardcoded null —
 * this was the exact integration point this file's own comment
 * flagged as missing.
 *
 * `tierLoading` — separate from FacilitatorCalendar's own internal
 * `loading` (which only covers the calendar strip fetch): this used a
 * one-shot plain fetch() with a silent catch, so a cold Render
 * free-tier start (or any transient failure) left userTier null
 * forever, and the calendar rendered the "Professional/Executive
 * feature — Upgrade" gate as if that were the real, final answer — by
 * direct bug report, a genuinely Professional/Executive trader saw
 * "not working" instead of the booking calendar. Now retries through a
 * cold start (fetchJsonWithRetry, see resilientFetch.ts) and the
 * calendar withholds the gate entirely until this has actually settled.
 */
export function MeetingsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [userTier, setUserTier] = useState<'essential' | 'professional' | 'executive' | null>(null);
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    if (!token) { setTierLoading(false); return; }
    fetchJsonWithRetry<{ has_active_access: boolean; tier: string }>(
      `${API_URL}/payments/access-status`, { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((s) => {
        if (s?.has_active_access && s.tier !== 'community') setUserTier(s.tier as any);
      })
      .finally(() => setTierLoading(false));
  }, [token]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Facilitator Sessions</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
          Book time with a facilitator, Fund Manager, or Partner — AM, Afternoon, or Evening,
          up to 2 sessions per day.
        </p>
      </div>

      <div>
        <h2 className={`text-sm font-semibold mb-3 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Connections</h2>
        <ConnectorCards dark={dark} />
      </div>

      <div>
        <h2 className={`text-sm font-semibold mb-3 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Availability</h2>
        <FacilitatorCalendar userTier={userTier} tierLoading={tierLoading} token={token} dark={dark} />
      </div>
    </div>
  );
}
