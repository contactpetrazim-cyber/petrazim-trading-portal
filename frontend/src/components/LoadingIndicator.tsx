import type { FetchPhase } from '../lib/resilientFetch';

/**
 * Shared grey -> orange -> red -> green progress dot, by direct request
 * ("use the colour indicator to show loading progress ... that way the
 * user can wait patiently"). Same colour language as BackendStatusBadge
 * (this app's other loading signal) so the whole app reads consistently:
 *   idle    - grey   - nothing requested yet
 *   loading - orange - first attempt in flight
 *   stalled - red    - still retrying — longer than a normal fetch,
 *                       usually the free-tier backend waking from sleep
 *   ready   - green  - loaded
 *   failed  - grey   - every retry exhausted (paired with a real error
 *                       message + retry button by the caller, not shown
 *                       as part of this dot alone)
 */
const PHASE_STYLE: Record<FetchPhase, { color: string; pulse: boolean; label: string }> = {
  idle: { color: '#9ca3af', pulse: false, label: 'Waiting to load' },
  loading: { color: '#f59e0b', pulse: true, label: 'Loading…' },
  stalled: { color: '#ef4444', pulse: true, label: 'Still loading — the server may be waking up' },
  ready: { color: '#22c55e', pulse: false, label: 'Loaded' },
  failed: { color: '#9ca3af', pulse: false, label: 'Could not load' },
};

export function LoadingIndicator({
  phase, dark, showLabel = true,
}: { phase: FetchPhase; dark?: boolean; showLabel?: boolean }) {
  const { color, pulse, label } = PHASE_STYLE[phase];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
        )}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
      </span>
      {showLabel && <span className={dark ? 'text-white/50' : 'text-gray-500'}>{label}</span>}
    </div>
  );
}
