import { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CONNECTOR_LABELS: Record<string, { label: string; description: string }> = {
  fireflies: { label: 'Fireflies', description: 'Auto-transcribes and summarizes booked sessions' },
  google_calendar_individual: { label: 'Google Calendar — Individual', description: 'Personal facilitator calendar' },
  google_calendar_corporate: { label: 'Google Calendar — Corporate', description: 'Shared team calendar for corporate bookings' },
};

const GOOGLE_TYPES = new Set(['google_calendar_individual', 'google_calendar_corporate']);

interface ConnectorStatus {
  connector_type: string;
  is_connected: boolean;
  connected_account_label: string | null;
}

/**
 * ConnectorCards — Fireflies + both Google Calendars.
 *
 * Google Calendar Connect/Disconnect are now real: Connect fetches a
 * fresh Google consent URL (GET /meetings/connectors/google/{type}/
 * authorize) and navigates the browser there directly — this has to
 * be a real top-level navigation, not a fetch, since Google's own
 * consent screen can't be shown inside a fetch response. The backend
 * redirects back to /meetings?google_connected=... when done, which
 * this component notices on mount and re-fetches status.
 *
 * Fireflies has no such flow — it's a stubbed, env-var-only
 * integration (see services/fireflies.py's own docstring: needs
 * FIREFLIES_API_KEY + FIREFLIES_NOTETAKER_EMAIL, no OAuth exists for
 * it) — showing a "Connect" button that does nothing would just be a
 * second dead button, so this card shows its real configuration
 * requirement as text instead.
 */
export function ConnectorCards({ dark = false }: { dark?: boolean }) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth();
  // Connect/Disconnect are Super-Admin-only server-side (this affects
  // every trainee's booking, not just the admin's own account) — hide
  // the buttons for everyone else rather than showing an action that
  // would just 403.
  const canManage = user?.role === 'super_admin';

  function loadConnectors() {
    fetch(`${API_BASE}/meetings/connectors`)
      .then((r) => r.json())
      .then(setConnectors)
      .catch(() => setConnectors([]));
  }

  useEffect(() => {
    loadConnectors();
    if (new URLSearchParams(window.location.search).has('google_connected')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function connectGoogle(connectorType: string) {
    if (!token) return;
    setBusy(connectorType);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/meetings/connectors/google/${connectorType}/authorize`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not start the Google connection.');
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
      await fetch(`${API_BASE}/meetings/connectors/google/${connectorType}/disconnect`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      loadConnectors();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {error && <p className="text-xs text-red-500 md:col-span-3">{error}</p>}
      {connectors.map((c) => {
        const meta = CONNECTOR_LABELS[c.connector_type] || { label: c.connector_type, description: '' };
        const isGoogle = GOOGLE_TYPES.has(c.connector_type);
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
                {isGoogle && canManage && (
                  <button
                    onClick={() => disconnectGoogle(c.connector_type)}
                    disabled={busy === c.connector_type}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 ${dark ? 'text-white/60 bg-white/5' : 'text-gray-500 bg-gray-100'}`}
                  >
                    {busy === c.connector_type ? '…' : 'Disconnect'}
                  </button>
                )}
              </>
            ) : isGoogle && canManage ? (
              <button
                onClick={() => connectGoogle(c.connector_type)}
                disabled={busy === c.connector_type}
                className="text-xs font-medium text-white bg-corporate-hero px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {busy === c.connector_type ? 'Opening Google…' : 'Connect'}
              </button>
            ) : isGoogle ? (
              <p className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>Not connected yet.</p>
            ) : (
              <p className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                Set FIREFLIES_API_KEY and FIREFLIES_NOTETAKER_EMAIL on the backend to enable.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
