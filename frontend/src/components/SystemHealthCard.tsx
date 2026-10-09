import { useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react';
import { botsApi } from '../services/api';
import { SystemHealthResponse } from '../types';

/**
 * SystemHealthCard — the "memory audit / indicator signal" by direct
 * request ("give a memory audit or indicator signal ... what number
 * of Bots running is safe ... auto engine that manages memory ... so
 * a crash is avoided"). Reads GET /bots/system-health, which itself
 * reuses memory_watchdog.py's own live thresholds — this card shows
 * exactly what the backend's own auto-throttle is acting on, not a
 * second guess. Lazy-loaded, same pattern as MasterExchangeBalanceCard
 * — a deliberate choice even though this endpoint is cheap (no live
 * exchange calls), for UI consistency on this page.
 */
export function SystemHealthCard({ dark }: { dark: boolean }) {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await botsApi.getSystemHealth());
      setLoadedOnce(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not load system health.');
    } finally {
      setLoading(false);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  const zoneMeta: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
    ok: { label: 'Healthy', color: dark ? 'text-emerald-400' : 'text-emerald-600', bg: dark ? 'bg-emerald-500/10' : 'bg-emerald-50', icon: <CheckCircle2 size={16} /> },
    warn: { label: 'Elevated', color: dark ? 'text-amber-400' : 'text-amber-600', bg: dark ? 'bg-amber-500/10' : 'bg-amber-50', icon: <AlertTriangle size={16} /> },
    critical: { label: 'Critical', color: dark ? 'text-red-400' : 'text-red-600', bg: dark ? 'bg-red-500/10' : 'bg-red-50', icon: <AlertOctagon size={16} /> },
    unknown: { label: 'Unknown', color: mutedCls, bg: dark ? 'bg-white/5' : 'bg-gray-50', icon: <AlertTriangle size={16} /> },
  };

  function Stat({ label, value }: { label: string; value: string | number | null }) {
    return (
      <div className="min-w-0">
        <div className={`text-[11px] ${mutedCls}`}>{label}</div>
        <div className="text-sm font-semibold truncate">{value === null || value === undefined ? '—' : value}</div>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {!loadedOnce && !loading && (
        <button
          onClick={load}
          className={`px-3 py-2 rounded-lg text-sm font-medium ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Check system health
        </button>
      )}
      {loading && <p className={`text-sm ${mutedCls}`}>Reading live memory/activity state…</p>}
      {error && (
        <div className={`rounded-lg px-3 py-2 text-xs ${dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error} <button onClick={load} className="underline">Retry</button>
        </div>
      )}
      {loadedOnce && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-semibold ${zoneMeta[data.zone].bg} ${zoneMeta[data.zone].color}`}>
              {zoneMeta[data.zone].icon} {zoneMeta[data.zone].label}
            </div>
            <button
              onClick={load} disabled={loading}
              className={`flex items-center gap-1 text-xs font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {data.note && <p className={`text-xs ${mutedCls}`}>{data.note}</p>}

          {data.scanner_degraded && (
            <div className={`rounded-lg px-3 py-2 text-xs ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
              Auto-throttle is currently active — the market scanner is running at a reduced
              frequency until memory pressure clears. Open positions and pending orders are
              unaffected; only new-signal scanning is slowed.
            </div>
          )}

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${mutedCls}`}>This Process</div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="RSS" value={data.process_rss_mb !== null ? `${data.process_rss_mb} MB` : null} />
              <Stat label="Limit" value={`${data.process_limit_mb} MB`} />
              <Stat label="Ratio" value={data.process_ratio !== null ? `${Math.round(data.process_ratio * 100)}%` : null} />
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${mutedCls}`}>Host (shared VM)</div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={data.host_mem_total_mb !== null ? `${data.host_mem_total_mb} MB` : null} />
              <Stat label="Available" value={data.host_mem_available_mb !== null ? `${data.host_mem_available_mb} MB` : null} />
              <Stat label="Swap used" value={data.host_swap_used_mb !== null ? `${data.host_swap_used_mb} MB` : null} />
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${mutedCls}`}>Scan Load (the real bot-count proxy)</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Active bots" value={data.active_bot_count} />
              <Stat
                label="Distinct (exchange, symbol) groups"
                value={data.scan_group_count !== null ? `${data.scan_group_count}${data.scan_group_warn_count ? ` / ${data.scan_group_warn_count}` : ''}` : null}
              />
            </div>
            <p className={`text-[11px] mt-1.5 ${mutedCls}`}>
              Bot count alone isn't the real cost — bots sharing an existing (exchange, symbol) pair add
              almost no extra load. A new, never-before-scanned pair is what actually costs a scan cycle.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
