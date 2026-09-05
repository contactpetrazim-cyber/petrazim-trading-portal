import { Zap, Moon, Loader2 } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';

/**
 * Compact wake-up icon for the NAV icon cluster, beside Search — by
 * direct request ("Integrate a wake icon to trigger system wake ...
 * place next to the search button on NAV"). BackendStatusBadge already
 * covers this (same useBackendStatus hook) but is text-only and hidden
 * below the `lg` breakpoint (TopNav's `hidden lg:block`), so it was
 * invisible on the size screen most people actually use this on — this
 * is the same wake mechanism as an icon-only button that's always
 * visible, not a second wake system.
 *
 * Same grey/red/orange/green colour language as LoadingIndicator:
 * checking=grey, sleeping=red (needs a wake), waking=orange (in
 * progress), ready=green.
 */
export function WakeBackendButton({ dark = true }: { dark?: boolean }) {
  const { status, wake } = useBackendStatus();

  const color =
    status === 'ready' ? '#22c55e' :
    status === 'waking' ? '#f59e0b' :
    status === 'sleeping' ? '#ef4444' :
    '#9ca3af'; // checking

  const label =
    status === 'ready' ? 'Backend is awake and ready' :
    status === 'waking' ? 'Waking up the backend… usually under a minute' :
    status === 'sleeping' ? 'Backend is asleep (free-tier idle timeout) — click to wake it' :
    'Checking backend status…';

  const Icon = status === 'waking' ? Loader2 : status === 'sleeping' ? Moon : Zap;

  return (
    <button
      onClick={wake}
      disabled={status === 'ready' || status === 'waking'}
      aria-label={label}
      title={label}
      className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-corporate-hero ${
        dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'
      } ${status === 'ready' || status === 'waking' ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <Icon size={17} className={status === 'waking' ? 'animate-spin' : undefined} />
      <span
        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}
