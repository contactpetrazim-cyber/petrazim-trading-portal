import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'light' | 'dark';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;

  /**
   * Per-portal theme, remembered independently of the shared `theme`
   * above and of each other — by direct request ("per portal...
   * remembered separately... admin should default to light too"; then
   * separately, "put a toggle to the trader portal... default is
   * light"). Only Admin and Trader needed their own slot: Admin is its
   * own route (App.tsx's CorporateLayout wraps it with portal="admin"
   * to read this instead of the shared `theme`), and Trader is the
   * separate dark-terminal shell (components/Layout.tsx) that used to
   * ignore theming altogether. Manager/Partner/Home/Meetings/Learning
   * and everything else still share the single `theme` above
   * unchanged — nobody asked for those to diverge from each other, so
   * they weren't given their own slots.
   *
   * Both start 'light' (Admin's dark default was the original ask,
   * reversed once seen live). The Trade console's own signal
   * panel/TradingView frame (ManualTradingPage) is a separate,
   * deliberate exception that stays dark regardless — untouched here,
   * same as it was untouched by the original shared toggle.
   */
  portalThemes: Record<'admin' | 'trader', ThemeName>;
  setPortalTheme: (portal: 'admin' | 'trader', theme: ThemeName) => void;
  togglePortalTheme: (portal: 'admin' | 'trader') => void;
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

      portalThemes: { admin: 'light', trader: 'light' },
      setPortalTheme: (portal, theme) =>
        set((s) => ({ portalThemes: { ...s.portalThemes, [portal]: theme } })),
      togglePortalTheme: (portal) =>
        set((s) => ({
          portalThemes: { ...s.portalThemes, [portal]: s.portalThemes[portal] === 'dark' ? 'light' : 'dark' },
        })),
    }),
    { name: 'petrazim-theme' }
  )
);
