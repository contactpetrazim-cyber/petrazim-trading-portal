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
 */
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
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

export function useAuth() {
  const { token, user, setAuth, logout } = useAuthStore();
  return { token, user, setAuth, logout, isAuthenticated: !!token };
}
