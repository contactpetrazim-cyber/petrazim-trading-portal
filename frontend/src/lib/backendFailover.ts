/**
 * Dual-failover backend selection — CLAUDE.md's own stated
 * architecture: "The frontends contain logic to dynamically ping the
 * Render URL first; if it returns an error, they instantly fallback
 * to the Nube VM's public IP address." That logic didn't actually
 * exist anywhere in this frontend until now — there was nothing to
 * fail over TO until the VM backend was deployed (via Coolify) and
 * confirmed reachable, healthy, and running the same code against the
 * same Supabase database as Render.
 *
 * Requires `VITE_VM_API_URL` (the VM's own public address, e.g.
 * `http://<vm-ip>:8000`) to be set as a build-time env var on every
 * frontend deploy (Vercel, Lovable) — safe to ship before that's
 * configured: with it unset, every function below is a same-URL
 * no-op and the app behaves exactly as it does today, request-level
 * failover included. No VM address is hardcoded here or anywhere else
 * in this file on purpose — it's infrastructure, not something that
 * belongs baked into a public JS bundle checked into git.
 *
 * Every existing network call in this app already builds its URL as
 * `${API_URL}/...` (services/api.ts's axios instance, or a raw
 * `apiFetch` call) — this module doesn't touch any of those call
 * sites. Instead, `apiFetch` (components/AccessExpiredGate.tsx) and
 * the axios client (services/api.ts) each resolve the ACTIVE base
 * through here immediately before the real request, so switching
 * happens in exactly two places and every one of this app's dozens of
 * call sites gets it for free.
 */

const PRIMARY_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const VM_BASE = (import.meta.env.VITE_VM_API_URL || '').replace(/\/$/, '');

const ACTIVE_BASE_KEY = 'petrazim-active-backend-base';
// While running on the VM, how often to quietly check whether Render
// has come back — Render stays the canonical/monitored backend either
// way (same database, but only Render is actually watched/scaled), so
// this fails BACK automatically instead of staying pinned to the VM
// for the rest of the session after one blip.
const FAILBACK_CHECK_INTERVAL_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

function readStoredBase(): string {
  try {
    const stored = sessionStorage.getItem(ACTIVE_BASE_KEY);
    return stored === VM_BASE ? VM_BASE : PRIMARY_BASE;
  } catch {
    return PRIMARY_BASE; // private-browsing/storage-blocked — falls back to Render every reload, never crashes
  }
}

let activeBase = VM_BASE ? readStoredBase() : PRIMARY_BASE;
let failbackTimer: number | null = null;

function setActiveBase(base: string) {
  activeBase = base;
  try { sessionStorage.setItem(ACTIVE_BASE_KEY, base); } catch { /* in-memory only for the rest of this tab's life — still correct */ }
}

/** While on the VM, poll Render's /health and switch back the moment
 * it answers. Cleared once we're back on Render. */
function scheduleFailbackCheck() {
  if (failbackTimer != null) return;
  failbackTimer = window.setInterval(() => {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    fetch(`${PRIMARY_BASE}/health`, { signal: controller.signal })
      .then((res) => { if (res.ok) switchToPrimary(); })
      .catch(() => { /* still down — keep checking on the next interval */ })
      .finally(() => window.clearTimeout(t));
  }, FAILBACK_CHECK_INTERVAL_MS);
}

function switchToPrimary() {
  if (activeBase === PRIMARY_BASE) return;
  setActiveBase(PRIMARY_BASE);
  if (failbackTimer != null) { window.clearInterval(failbackTimer); failbackTimer = null; }
}

if (activeBase === VM_BASE) scheduleFailbackCheck(); // page loaded mid-session already failed over (sessionStorage carried it forward)

/** The base URL every request should use right now. */
export function getActiveBase(): string {
  return activeBase;
}

/** Rewrites a URL built against PRIMARY_BASE (every call site's own
 * `${API_URL}/...` pattern) to whichever base is currently active. */
export function resolveFailoverUrl(url: string): string {
  if (activeBase === PRIMARY_BASE || !url.startsWith(PRIMARY_BASE)) return url;
  return activeBase + url.slice(PRIMARY_BASE.length);
}

/** True for a genuine connection failure — DNS, refused, timed out,
 * offline — as opposed to the request reaching the server and it
 * answering with an HTTP error status (a completely different
 * situation: the backend IS up, and failing over would be wrong).
 * `fetch()` itself only ever throws for the former; an HTTP error
 * status is still a normal, non-throwing Response. */
export function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError');
}

/** Switches every future request to the VM. Returns false (nothing to
 * do) when there's no VM configured or a request already failed over
 * once — the caller uses that to decide whether retrying is worth it,
 * so one dead backend can't retry-loop forever. */
export function tryFailoverToVm(): boolean {
  if (!VM_BASE || activeBase === VM_BASE) return false;
  setActiveBase(VM_BASE);
  scheduleFailbackCheck();
  return true;
}

/** For a small "running on backup" indicator, if a page wants one. */
export function isOnVm(): boolean {
  return activeBase === VM_BASE;
}
