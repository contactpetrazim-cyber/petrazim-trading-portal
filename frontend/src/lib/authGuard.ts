import { useAuthStore } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * One shared 401 handler for both request layers (apiFetch and the
 * axios client in services/api.ts).
 *
 * Why it isn't just "401 -> logout": the reported perpetual sign-in
 * loop came from exactly that. A single protected endpoint answering
 * 401 for its own reasons (a route the account's role can't touch, a
 * payments/roster router the deployed backend doesn't expose) tore down
 * a perfectly valid session and hard-navigated to /login — which, with
 * a memory-only token, also wiped it. Now the token itself is checked
 * once against /auth/me: only a token the auth server actually rejects
 * signs anyone out, and everything else is left alone for the calling
 * screen to report.
 */
let verifying: Promise<boolean> | null = null;

async function tokenStillValid(token: string): Promise<boolean> {
  if (!verifying) {
    verifying = fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok)
      // A network failure is NOT proof of a bad token — keep the session.
      .catch(() => true)
      .finally(() => { setTimeout(() => { verifying = null; }, 2_000); });
  }
  return verifying;
}

export async function handleUnauthorized(): Promise<void> {
  const token = useAuthStore.getState().token;
  if (!token) return;
  if (await tokenStillValid(token)) return;

  useAuthStore.getState().logout();
  if (window.location.pathname !== '/login') {
    const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(destination)}`);
  }
}
