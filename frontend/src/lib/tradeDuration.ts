/**
 * Shared trade-duration formatter — entry to exit for a closed trade,
 * entry to now for one still open. By direct request ("add the
 * duration of each trade from entry to exit as an info on the trade
 * card ... also add as info in position, approval, and on chart chart
 * cards, snapshot and forensic cards"). Both timestamps already exist
 * on every Trade (entry_timestamp/exit_timestamp, backend
 * app/models/trade.py) — this is purely a display computation, no new
 * data needed.
 */
export function formatTradeDuration(entryIso: string | null | undefined, exitIso?: string | null): string | null {
  if (!entryIso) return null;
  const start = new Date(entryIso).getTime();
  const end = exitIso ? new Date(exitIso).getTime() : Date.now();
  const ms = end - start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || ms < 0) return null;

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}
