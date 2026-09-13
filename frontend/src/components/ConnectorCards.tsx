import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';
import { formatApiError } from '../lib/apiError';

const API_BASE = import.meta.env.VITE_API_URL || '';

const GOOGLE_CONNECTOR_TYPES = ['google_calendar_individual', 'google_calendar_corporate'];

const GOOGLE_LABELS: Record<string, { label: string; description: string }> = {
  google_calendar_individual: { label: 'Individual', description: 'petrazim.solutions@gmail.com' },
  google_calendar_corporate: { label: 'Corporate', description: 'contact.petrazim@gmail.com' },
};

interface ConnectorStatus {
  connector_type: string;
  is_connected: boolean;
  connected_account_label: string | null;
}

/**
 * ConnectorCards — Fireflies (a small status pill) + one merged
 * "Calendar" control for both Google accounts.
 *
 * By direct request ("merge the individual and corporate calendars
 * since it's one facilitator ... collapse into a button with similar
 * style as 'Order' in the trade ... name it 'Calendar' ... default is
 * folded"): there's one facilitator, so the two separate Google
 * Calendar cards this used to render side by side are now one
 * Order/Pairs-style toggle button (see ChartPanel.tsx for the pattern
 * this copies — active state bg-blue-600, inactive a muted pill,
 * default closed).
 *
 * Folding the UI into one control doesn't merge the underlying
 * accounts into one, though — every booking still mirrors onto BOTH
 * contact.petrazim@gmail.com (Corporate) and petrazim.solutions@
 * gmail.com (Individual) (see facilitator.py's /book), and each is
 * still its own separate Google OAuth consent — a refresh token is
 * only ever valid for the account that granted it, so there's no way
 * to collapse two Google accounts into a single "Connect" click. The
 * unfolded panel therefore still lists both accounts individually to
 * connect/disconnect; only the top-level fold/unfold is one control.
 *
 * Google Calendar Connect/Disconnect are real: Connect fetches a
 * fresh Google consent URL (GET /meetings/connectors/google/{type}/
 * authorize) and navigates the browser there directly — this has to
 * be a real top-level navigation, not a fetch, since Google's own
 * consent screen can't be shown inside a fetch response. The backend
 * redirects back to /meetings?google_connected=... when done, which
 * this component notices on mount, unfolds the panel so the result is
 * actually visible, and re-fetches status.
 *
 * Fireflies has no such flow — it's a stubbed, env-var-only
 * integration (see services/fireflies.py's own docstring: needs
 * FIREFLIES_API_KEY + FIREFLIES_NOTETAKER_EMAIL, no OAuth exists for
 * it) — showing a "Connect" button that does nothing would just be a
 * second dead button, so its pill shows the real configuration
 * requirement as a tooltip instead.
 */
export function ConnectorCards({ dark = false }: { dark?: boolean }) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { token, user } = useAuth();
  // Connect/Disconnect are Super-Admin-only server-side (this affects
  // every trainee's booking, not just the admin's own account) — hide
  // the buttons for everyone else rather than showing an action that
  // would just 403.
  const canManage = user?.role === 'super_admin';

  function loadConnectors() {
    apiFetch(`${API_BASE}/meetings/connectors`)
      .then((r) => r.json())
      .then(setConnectors)
      .catch(() => setConnectors([]));
  }

  useEffect(() => {
    loadConnectors();
    if (new URLSearchParams(window.location.search).has('google_connected')) {
      setCalendarOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function connectGoogle(connectorType: string) {
    if (!token) return;
    setBusy(connectorType);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/meetings/connectors/google/${connectorType}/authorize`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.detail, 'Could not start the Google connection.'));
      window.location.href = data.authorize_url;
    } catch (err: any) {
      setError(err.message || 'Could not start the Google connection.');
      setBusy(null);
    }
  }

  async function disconnectGoogle(connectorType: string) {
    if (!token) return;
    setBusy(connectorType);
    try {
      await apiFetch(`${API_BASE}/meetings/connectors/google/${connectorType}/disconnect`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      loadConnectors();
    } finally {
      setBusy(null);
    }
  }

  const fireflies = connectors.find((c) => c.connector_type === 'fireflies');
  const googleRows = connectors.filter((c) => GOOGLE_CONNECTOR_TYPES.includes(c.connector_type));
  const connectedCount = googleRows.filter((c) => c.is_connected).length;

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCalendarOpen((o) => !o)}
          aria-label={calendarOpen ? 'Hide calendar connections' : 'Show calendar connections'}
          title={calendarOpen ? 'Hide calendar connections' : 'Calendar connections'}
          className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
            calendarOpen ? 'bg-blue-600 text-white' : dark ? 'text-white/50 hover:text-white/80 bg-white/5' : 'text-gray-500 hover:text-gray-700 bg-black/5'
          }`}
        >
          <CalendarIcon size={13} /> Calendar
          {googleRows.length > 0 && (
            <span className={calendarOpen ? 'text-white/80' : connectedCount > 0 ? 'text-emerald-500' : undefined}>
              ({connectedCount}/{googleRows.length})
            </span>
          )}
        </button>

        {fireflies && (
          <div
            title={fireflies.is_connected ? undefined : 'Set FIREFLIES_API_KEY and FIREFLIES_NOTETAKER_EMAIL on the backend to enable.'}
            className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md ${dark ? 'text-white/40 bg-white/5' : 'text-gray-500 bg-black/5'}`}
          >
            {fireflies.is_connected ? (
              <CheckCircle2 size={13} className="text-emerald-500" />
            ) : (
              <Circle size={13} className={dark ? 'text-white/20' : 'text-gray-300'} />
            )}
            Fireflies{fireflies.is_connected ? ` — ${fireflies.connected_account_label}` : ''}
          </div>
        )}
      </div>

      {calendarOpen && (
        <div className="grid md:grid-cols-2 gap-4">
          {googleRows.map((c) => {
            const meta = GOOGLE_LABELS[c.connector_type] || { label: c.connector_type, description: '' };
            return (
              <div key={c.connector_type} className={`rounded-2xl border p-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {c.is_connected ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <Circle size={16} className={dark ? 'text-white/20' : 'text-gray-300'} />
                  )}
                  <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{meta.label}</span>
                </div>
                <p className={`text-xs mb-3 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{meta.description}</p>

                {c.is_connected ? (
                  <>
                    <p className="text-xs text-emerald-500 mb-2">Connected — {c.connected_account_label}</p>
                    {canManage && (
                      <button
                        onClick={() => disconnectGoogle(c.connector_type)}
                        disabled={busy === c.connector_type}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 ${dark ? 'text-white/60 bg-white/5' : 'text-gray-500 bg-gray-100'}`}
                      >
                        {busy === c.connector_type ? '…' : 'Disconnect'}
                      </button>
                    )}
                  </>
                ) : canManage ? (
                  <button
                    onClick={() => connectGoogle(c.connector_type)}
                    disabled={busy === c.connector_type}
                    className="text-xs font-medium text-white bg-corporate-hero px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {busy === c.connector_type ? 'Opening Google…' : 'Connect'}
                  </button>
                ) : (
                  <p className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>Not connected yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
