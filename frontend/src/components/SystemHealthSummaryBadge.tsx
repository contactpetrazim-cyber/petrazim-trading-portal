import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { botsApi } from '../services/api';
import { SystemHealthSummaryResponse } from '../types';

/**
 * SystemHealthSummaryBadge — the trader-facing "indicator signal", by
 * direct answer ("Put in all" — Dashboard AND the Bots/Settings page).
 * Trimmed counterpart to the Super-Admin-only SystemHealthCard: just a
 * traffic-light pill + one sentence, no raw host numbers. Cheap
 * (DB-and-/proc-only, no live exchange calls) so this loads on mount
 * rather than lazily like the balance cards.
 */
export function SystemHealthSummaryBadge({ dark }: { dark: boolean }) {
  const [data, setData] = useState<SystemHealthSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    botsApi.getSystemHealthSummary().then((d) => { if (!cancelled) setData(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!data || data.zone === 'ok') return null; // quiet by default — only surface when there's something to say

  const meta: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
    warn: { color: dark ? 'text-amber-400' : 'text-amber-600', bg: dark ? 'bg-amber-500/10' : 'bg-amber-50', icon: <AlertTriangle size={14} /> },
    critical: { color: dark ? 'text-red-400' : 'text-red-600', bg: dark ? 'bg-red-500/10' : 'bg-red-50', icon: <AlertOctagon size={14} /> },
    unknown: { color: dark ? 'text-white/50' : 'text-gray-500', bg: dark ? 'bg-white/5' : 'bg-gray-50', icon: <CheckCircle2 size={14} /> },
  };
  const m = meta[data.zone] ?? meta.unknown;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${m.bg} ${m.color}`}>
      {m.icon} {data.message}
    </div>
  );
}
