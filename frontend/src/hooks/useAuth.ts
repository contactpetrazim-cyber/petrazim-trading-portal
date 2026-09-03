import { create } from 'zustand';

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
 * Auth state, kept in memory only (no localStorage) — matches the
 * platform's browser-storage restriction for artifacts, and is the
 * right default for a system that also handles payments and fund
 * access: a token that survives a full app reload without re-auth is
 * a bigger attack surface than a login prompt on refresh.
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
}));

export function useAuth() {
  const { token, user, setAuth, logout } = useAuthStore();
  return { token, user, setAuth, logout, isAuthenticated: !!token };
}
