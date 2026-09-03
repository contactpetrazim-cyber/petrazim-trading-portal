import { Zap, Moon, Loader2 } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';

/**
 * Sleeping / Waking / Ready indicator for a backend hosted on a
 * free tier that sleeps when idle (e.g. Render). A sleeping backend
 * doesn't mean anything is broken — it just needs a wake-up request,
 * which this badge's button sends, then polls /health until it's back.
 */
export function BackendStatusBadge({ dark = true }: { dark?: boolean }) {
  const { status, wake } = useBackendStatus();

  const textMuted = dark ? 'text-gray-400' : 'text-gray-500';

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-smc-success animate-pulse" />
        <span className={textMuted}>Ready</span>
      </div>
    );
  }

  if (status === 'waking') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 size={14} className="animate-spin text-smc-warning" />
        <span className={textMuted}>Waking up… (usually under a minute)</span>
      </div>
    );
  }

  if (status === 'sleeping') {
    return (
      <button
        onClick={wake}
        className="flex items-center gap-2 text-sm bg-smc-warning/10 hover:bg-smc-warning/20 text-smc-warning px-3 py-1.5 rounded-lg transition-colors"
        title="The backend's free tier sleeps after 15 minutes idle — click to wake it"
      >
        <Moon size={14} />
        <span>Sleeping — Wake up</span>
      </button>
    );
  }

  // "checking"
  return (
    <div className="flex items-center gap-2 text-sm">
      <Zap size={14} className={textMuted} />
      <span className={textMuted}>Checking…</span>
    </div>
  );
}
