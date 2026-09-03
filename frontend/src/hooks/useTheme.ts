import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'light' | 'dark';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

/**
 * Site-wide light/dark toggle for the "corporate" shell (TopNav,
 * BottomNav, SettingsPanel, and pages wrapped in CorporateLayout) —
 * per petrazim_preview_v13_FINAL.jsx, "functionally real, not
 * decorative." Persisted so a visitor's choice survives a reload.
 *
 * Deliberately does NOT touch the Trade console's dark terminal theme
 * (smc-dark/smc-card/etc.) — that stays dark regardless, same
 * reasoning as config/theme.ts: legibility for live P&L, not a
 * branding choice this toggle should override.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'petrazim-theme' }
  )
);
