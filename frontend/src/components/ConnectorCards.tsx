import { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CONNECTOR_LABELS: Record<string, { label: string; description: string }> = {
  fireflies: { label: 'Fireflies', description: 'Auto-transcribes and summarizes booked sessions' },
  google_calendar_individual: { label: 'Google Calendar — Individual', description: 'Personal facilitator calendar' },
  google_calendar_corporate: { label: 'Google Calendar — Corporate', description: 'Shared team calendar for corporate bookings' },
};

interface ConnectorStatus {
  connector_type: string;
  is_connected: boolean;
  connected_account_label: string | null;
}

/**
 * ConnectorCards — Fireflies + both Google Calendars. These are
 * status/connect cards, not a working OAuth flow — no real
 * credentials exist yet for any of the three. Clicking "Connect" here
 * is the UI entry point; the actual OAuth handshake is a separate
 * backend piece to build once real API credentials are available.
 */
export function ConnectorCards() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/meetings/connectors`)
      .then((r) => r.json())
      .then(setConnectors)
      .catch(() => setConnectors([]));
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {connectors.map((c) => {
        const meta = CONNECTOR_LABELS[c.connector_type] || { label: c.connector_type, description: '' };
        return (
          <div key={c.connector_type} className="bg-white rounded-2xl border border-corporate-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              {c.is_connected ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <Circle size={16} className="text-gray-300" />
              )}
              <span className="text-sm font-semibold text-corporate-text-on-bg">{meta.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{meta.description}</p>
            {c.is_connected ? (
              <p className="text-xs text-emerald-600">Connected — {c.connected_account_label}</p>
            ) : (
              <button className="text-xs font-medium text-white bg-corporate-hero px-3 py-1.5 rounded-lg">
                Connect
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
