import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'trader' | 'fund_manager' | 'partner' | 'admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  badge_color: string;
  landing_route: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

/**
 * Auth state, now PERSISTED (localStorage) rather than memory-only.
 *
 * Memory-only was the real cause of the reported "signs in, then gets
 * logged out again in a perpetual cycle": any full page load — a
 * refresh, a hard navigation, or apiFetch's own 401 handler doing
 * window.location.assign('/login') — threw the token away, so the very
 * next protected page bounced straight back to the sign-in screen and
 * the loop repeated. Persisting the session is what every trading
 * dashboard does; the backend token still expires on its own schedule,
 * and an invalid token is now verified against /auth/me before anything
 * signs the user out (see lib/authGuard.ts).
 *
 * storage is wrapped, not raw `localStorage`, because of a separate
 * reported bug: the whole app rendering as a blank page with nothing in
 * the console-less fallback (no AppErrorBoundary card, nothing). This
 * store is created at module scope, so persist's rehydration reads
 * localStorage synchronously the moment this file is imported — before
 * main.tsx's ReactDOM.createRoot(...).render() runs, which is also
 * before AppErrorBoundary exists to catch anything. localStorage.getItem
 * throws (not returns null) in a handful of real environments — Safari
 * private-mode's old quota-zero behavior, an iframe embed missing
 * allow-same-origin, some in-app WebViews with site data disabled — and
 * an uncaught throw here aborts the entire module graph, so the render
 * call on line 14 of main.tsx never runs at all: a genuinely blank
 * page, matching exactly what was reported. Swallowing read/write
 * failures here just means that one visit starts logged-out instead of
 * crashing before mount; every normal browser is unaffected.
 */
const safeLocalStorage = {
  getItem: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* best-effort */ }
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(key); } catch { /* best-effort */ }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'petrazim.auth',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

export function useAuth() {
  const { token, user, setAuth, logout } = useAuthStore();
  return { token, user, setAuth, logout, isAuthenticated: !!token };
}
