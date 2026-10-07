/**
 * Dual-failover backend selection — CLAUDE.md's own stated
 * architecture: ping the PRIMARY backend first; if it errors, instantly
 * fall back to the SECONDARY. Fully generic on which real service is
 * which — PRIMARY_BASE/VM_BASE (kept as the historical variable
 * names) are just roles, resolved entirely from the
 * `VITE_API_URL`/`VITE_VM_API_URL` env vars. Which real backend plays
 * which role is an infrastructure decision, made by what those two env
 * vars are SET TO on each deploy target (Vercel, Lovable) — not by
 * anything in this file.
 *
 * Originally Render as primary / the Nube VM as fallback. Swapped by
 * direct request ("swap the VM backup to primary... fastest, free,
 * lowest-risk fix") after Render's free-tier sleep (cold starts up to
 * ~90s after 15 idle minutes) kept surfacing as the likely cause of
 * several "it's just stuck/broken" reports — the VM is a real,
 * always-on server with no forced sleep at all, so putting it first
 * removes the cold-start window entirely for the common case; Render,
 * now second, still covers a genuine VM outage. Achieved purely by
 * swapping the VALUES of `VITE_API_URL`/`VITE_VM_API_URL` on each
 * deploy target — this file's own logic doesn't care which service is
 * "primary," and every other call site in this app builds its request
 * URL directly from `VITE_API_URL` (api.ts's axios instance, every
 * page's own `const API_URL = import.meta.env.VITE_API_URL`, etc.) —
 * NOT through this module — so swapping logic here instead of the env
 * var values would silently break resolveFailoverUrl's own
 * `url.startsWith(PRIMARY_BASE)` rewrite for every one of those call
 * sites the moment the two didn't agree on which URL is "primary."
 *
 * Requires `VITE_VM_API_URL` (the fallback's own public address) to be
 * set as a build-time env var on every frontend deploy — safe to ship
 * before that's configured: with it unset, every function below is a
 * same-URL no-op and the app behaves exactly as it does today,
 * request-level failover included. No address is hardcoded here or
 * anywhere else in this file on purpose — it's infrastructure, not
 * something that belongs baked into a public JS bundle checked into
 * git.
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
// While on the fallback, how often to quietly check whether the
// primary has come back — the primary stays the canonical/monitored
// backend either way (same database, but only it is actually
// watched/scaled), so this fails BACK automatically instead of
// staying pinned to the fallback for the rest of the session after one
// blip.
const FAILBACK_CHECK_INTERVAL_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

function readStoredBase(): string {
  try {
    const stored = sessionStorage.getItem(ACTIVE_BASE_KEY);
    return stored === VM_BASE ? VM_BASE : PRIMARY_BASE;
  } catch {
    return PRIMARY_BASE; // private-browsing/storage-blocked — falls back to the primary every reload, never crashes
  }
}

let activeBase = VM_BASE ? readStoredBase() : PRIMARY_BASE;
let failbackTimer: number | null = null;

function setActiveBase(base: string) {
  activeBase = base;
  try { sessionStorage.setItem(ACTIVE_BASE_KEY, base); } catch { /* in-memory only for the rest of this tab's life — still correct */ }
}

/** While on the fallback, poll the primary's /health and switch back
 * the moment it answers. Cleared once we're back on the primary. */
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

// Proactive warm-up race — by direct request ("make the [fallback]
// trigger first for the first 2 mins until [the primary] wakes up ...
// then move to auto. Can this make the site more responsive?"). Yes,
// and this does it better than a blind fixed timer: on a fresh page
// load that hasn't already failed over, race a quick primary health
// check with a short timeout — if it doesn't answer well inside it,
// it's very likely mid cold-start (a free-tier host can take up to
// ~90s to wake — see useBackendStatus.ts's own WAKE_TIMEOUT_MS) or
// genuinely down, either way not worth making the FIRST real request
// of the session sit through. Switch to the fallback immediately in
// that case; the existing failback poller below then switches back to
// the primary the moment it actually responds — for exactly as long
// as the cold start really takes, not a guessed 2-minute window that
// either cuts off too early or keeps using the fallback long after the
// primary was already awake. A fast, healthy primary (the common case
// since the VM — no forced sleep at all — took over that role) never
// touches the fallback at all.
// 2s, not the original 4s — by direct follow-up ("4 seconds might be
// long for a trader? What would be the effect? For 2 seconds"). The
// effect, worked through: this only changes the outcome in the narrow
// band where the primary's real response time falls BETWEEN 2s and 4s
// — a warm, healthy primary answers in well under 1s either way (no
// difference), and a genuinely cold/dead one doesn't answer for many
// seconds to minutes either way (also no difference — both correctly
// fail over, 2s just reaches that correct call 2s sooner, so any real
// request the app fires in that same window is exposed to a hanging
// cold primary for 2s less). The actual tradeoff: a primary that's
// merely slow right now (not cold, just poor network/load — e.g. a
// 2.5-3.5s response) now gets treated as "failed" and this
// unnecessarily diverts to the fallback for what would've been a
// fine, if sluggish, primary response. Low-cost false positive,
// though — the fallback serves the identical code/DB, and the
// failback poller below switches back the moment the primary answers
// normally, so it costs a slightly-slower request or two, not a
// broken one.
const WARMUP_CHECK_TIMEOUT_MS = 2_000;
if (VM_BASE && activeBase === PRIMARY_BASE) {
  const controller = new AbortController();
  const warmupTimer = window.setTimeout(() => controller.abort(), WARMUP_CHECK_TIMEOUT_MS);
  fetch(`${PRIMARY_BASE}/health`, { signal: controller.signal })
    .then((res) => { if (!res.ok) tryFailoverToVm(); })
    .catch(() => { tryFailoverToVm(); })
    .finally(() => window.clearTimeout(warmupTimer));
}

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

/** Switches every future request to the fallback. Function name kept
 * as `tryFailoverToVm` (every call site already uses it) even though
 * the fallback role isn't necessarily the VM any more — see this
 * file's own top-of-file comment on the primary/fallback swap.
 * Returns false (nothing to do) when there's no fallback configured or
 * a request already failed over once — the caller uses that to decide
 * whether retrying is worth it, so one dead backend can't retry-loop
 * forever. */
export function tryFailoverToVm(): boolean {
  if (!VM_BASE || activeBase === VM_BASE) return false;
  setActiveBase(VM_BASE);
  scheduleFailbackCheck();
  return true;
}

/** For a small "running on backup" indicator, if a page wants one —
 * not currently called anywhere, kept for whichever page adds one. */
export function isOnVm(): boolean {
  return activeBase === VM_BASE;
}
