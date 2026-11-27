import { useCallback, useEffect, useState } from 'react';

/**
 * useDataEra — the shared "Post vs Pre+Post" data-era toggle, by direct
 * request ("I want the dashboard and the bot dashboard to view from
 * just Nov 11 ... a post vs pre+post toggle"). Backs every
 * dashboardApi call's own `era` query param (see services/api.ts and
 * routers/dashboard.py's `_era_cutoff`), which scopes trades to since
 * the Recommended Bots rollout by default — nothing is ever archived
 * or deleted, so "Pre+Post" is always just flipping this one switch
 * back on.
 *
 * Persisted to localStorage so the choice sticks across every
 * dashboard page and a reload, rather than resetting per-page — set it
 * once. Defaults to "post" (fast, matches the Recommended Bots
 * Dashboard's own always-post-rollout "live" view) when nothing is
 * stored yet or storage is unavailable (private browsing, blocked
 * site data) — never crashes, just behaves as if nothing was ever
 * toggled.
 */
export type DataEra = 'post' | 'all';

const STORAGE_KEY = 'petrazim-dashboard-data-era';

function readStoredEra(): DataEra {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'all' ? 'all' : 'post';
  } catch {
    return 'post'; // private-browsing/storage-blocked — always defaults to "post", never crashes
  }
}

export function useDataEra() {
  const [era, setEraState] = useState<DataEra>(readStoredEra);

  const setEra = useCallback((next: DataEra) => {
    setEraState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* in-memory only for this tab's life — still correct */ }
  }, []);

  // Pick up a change made on another open tab (localStorage's own
  // "storage" event fires on every tab except the one that wrote it).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setEraState(e.newValue === 'all' ? 'all' : 'post');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { era, setEra };
}
