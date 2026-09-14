import { useEffect, useState } from 'react';
import { Building2, Users, Send, CalendarCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FoldedCard } from './FoldedCard';
import { apiFetch } from './AccessExpiredGate';

/**
 * PlatformOverviewPanel — Admin/Super Admin's own extra tier of
 * counters on top of LearningDashboardPanel, backed by real GET
 * /admin/platform-overview (admin.py). Adapted from the reference
 * training portal's Platform Overview panel — see that endpoint's own
 * docstring for how each number was re-derived (this app has no
 * separate Organization entity, for one) rather than copied as-is.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PlatformOverview {
  organisations: number;
  staff_accounts: number;
  daily_sends: number;
  live_bookings: number;
}

export function PlatformOverviewPanel({ dark = true }: { dark?: boolean }) {
  const { token } = useAuth();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch(`${API_BASE}/admin/platform-overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const cardClass = dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg';
  const mutedText = dark ? 'text-gray-500' : 'text-gray-500';
  const bodyText = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const tileClass = dark ? 'bg-smc-dark' : 'bg-corporate-bg';

  const tiles = [
    { icon: <Building2 size={14} />, label: 'Organisations', value: data?.organisations, sub: 'Sponsoring corporate seats' },
    { icon: <Users size={14} />, label: 'Staff accounts', value: data?.staff_accounts, sub: 'Trainer and above' },
    { icon: <Send size={14} />, label: 'Daily sends', value: data?.daily_sends, sub: 'Telegram dispatches today' },
    { icon: <CalendarCheck size={14} />, label: 'Live bookings', value: data?.live_bookings, sub: 'Facilitator seats held' },
  ];

  return (
    // Folds/unfolds on click, closed by default — by direct request
    // ("make all the cards in the portal fold with one click and
    // unfold with another ... i dont want permanently open cards").
    <FoldedCard title="Platform Overview" dark={dark}>
      {loading ? (
        <p className={`text-sm ${mutedText}`}>Loading…</p>
      ) : error ? (
        <p className="text-sm text-smc-danger">Platform totals are unavailable right now.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-lg p-4 ${tileClass}`}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 ${mutedText}`}>
                {t.icon} {t.label}
              </div>
              <div className={`text-2xl font-bold ${bodyText}`}>{t.value ?? '—'}</div>
              <div className={`text-xs mt-0.5 ${mutedText}`}>{t.sub}</div>
            </div>
          ))}
        </div>
      )}
    </FoldedCard>
  );
}
