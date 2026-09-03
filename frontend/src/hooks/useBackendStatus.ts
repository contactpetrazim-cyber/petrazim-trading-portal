import { useCallback, useEffect, useRef, useState } from 'react';

export type BackendStatus = 'checking' | 'ready' | 'sleeping' | 'waking';

const API_BASE = import.meta.env.VITE_API_URL || '';
const POLL_INTERVAL_MS = 20_000;   // background check while idle
const WAKE_POLL_MS = 3_000;        // faster retry once the user hits "Wake up"
const WAKE_TIMEOUT_MS = 90_000;    // Render's free tier typically wakes in under a minute
const HEALTH_TIMEOUT_MS = 5_000;

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tracks whether the backend is reachable — meaningful on a free hosting
 * tier (e.g. Render) that sleeps after ~15 minutes idle and takes up to a
 * minute or so to wake on the next request. `wake()` is a manual trigger:
 * it fires a request immediately (which itself starts the wake-up) and
 * polls /health every few seconds until it responds or WAKE_TIMEOUT_MS
 * passes, rather than making the user guess and refresh.
 */
export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const wakingRef = useRef(false);

  const checkOnce = useCallback(async () => {
    const ok = await pingHealth();
    setStatus((prev) => (wakingRef.current ? prev : ok ? 'ready' : 'sleeping'));
    return ok;
  }, []);

  const wake = useCallback(async () => {
    if (wakingRef.current) return;
    wakingRef.current = true;
    setStatus('waking');

    const startedAt = Date.now();
    // Fire-and-poll: the first request is itself what wakes a sleeping
    // Render service, subsequent ones just check whether it's up yet.
    while (Date.now() - startedAt < WAKE_TIMEOUT_MS) {
      const ok = await pingHealth();
      if (ok) {
        wakingRef.current = false;
        setStatus('ready');
        return;
      }
      await new Promise((r) => setTimeout(r, WAKE_POLL_MS));
    }
    wakingRef.current = false;
    setStatus('sleeping');
  }, []);

  useEffect(() => {
    checkOnce();
    const interval = setInterval(() => {
      if (!wakingRef.current) checkOnce();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkOnce]);

  return { status, wake, refresh: checkOnce };
}
