import { ConnectorCards } from '../components/ConnectorCards';
import { FacilitatorCalendar } from '../components/FacilitatorCalendar';

/**
 * MeetingsPage — /meetings route. userTier should come from the
 * authenticated user's real access-status endpoint in the merged app;
 * hardcoded here as the integration point since this file doesn't own
 * auth state.
 */
export function MeetingsPage({ userTier = null as 'essential' | 'professional' | 'executive' | null }) {
  return (
    <div className="min-h-screen bg-corporate-bg p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-corporate-text-on-bg">Facilitator Sessions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Book time with a facilitator, Fund Manager, or Partner — AM, Afternoon, or Evening,
          up to 2 sessions per day.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Connections</h2>
        <ConnectorCards />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Availability</h2>
        <FacilitatorCalendar userTier={userTier} />
      </div>
    </div>
  );
}
