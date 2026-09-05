import { apiFetch } from '../components/AccessExpiredGate';

/**
 * Shared cold-start-aware fetch helper.
 *
 * Root cause of "Learn/Practice/Analytics/Insights/Order Flow are not
 * loading" (direct bug report): the backend runs on Render's free tier,
 * which sleeps after ~15 minutes idle and takes up to ~90s to wake on
 * the next request (see useBackendStatus's own WAKE_TIMEOUT_MS). Every
 * page above made exactly ONE fetch attempt — during a cold start that
 * request times out or the connection resets before the server ever
 * wakes, and the page had no way to distinguish "genuinely broken" from
 * "just needs another few seconds", so it showed a dead error
 * immediately instead of quietly retrying through the wake window.
 *
 * `phase` mirrors BackendStatusBadge's own colour language so a page
 * using this can drive the same grey/red/orange/green indicator the
 * NAV wake icon uses, by direct request ("use the colour indicator to
 * show loading progress ... moving from grey to red to orange to
 * green"): idle (grey, not started) -> loading (orange, first attempt)
 * -> stalled (red, still retrying — this is taking a while) -> ready
 * (green) | failed (every retry exhausted).
 */
export type FetchPhase = 'idle' | 'loading' | 'stalled' | 'ready' | 'failed';

// Total window sums to a little over Render's own WAKE_TIMEOUT_MS
// (~90s) — long enough to ride out a real cold start, short enough
// that a genuinely-down backend still fails in reasonable time.
const RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 15000, 20000, 20000];
// Once this many attempts have failed, flip the indicator to "stalled"
// (red) rather than staying "loading" (orange) — a hint to the user
// this is taking longer than a normal fetch, not that it's broken yet.
const STALLED_AFTER_ATTEMPT = 2;

export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  onPhase?: (phase: FetchPhase, attempt: number) => void,
): Promise<T | null> {
  onPhase?.('loading', 0);
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await apiFetch(url, init);
      if (res.ok) {
        onPhase?.('ready', attempt);
        return (await res.json()) as T;
      }
      // A real 4xx (401/402/404/...) is a definitive answer, not a
      // transient cold-start symptom — retrying it changes nothing, so
      // stop immediately instead of burning the whole retry window.
      // apiFetch has already surfaced a 402 via AccessExpiredGate.
      if (res.status >= 400 && res.status < 500) {
        onPhase?.('failed', attempt);
        return null;
      }
    } catch {
      // Network error / aborted connection — exactly what a Render
      // cold start looks like from the browser's side. Fall through
      // to retry.
    }
    onPhase?.(attempt >= STALLED_AFTER_ATTEMPT ? 'stalled' : 'loading', attempt);
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  onPhase?.('failed', RETRY_DELAYS_MS.length);
  return null;
}
