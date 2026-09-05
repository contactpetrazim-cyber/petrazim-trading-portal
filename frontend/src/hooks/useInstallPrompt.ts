import { create } from 'zustand';

interface InstallPromptState {
  event: any | null;
  installed: boolean;
  setEvent: (e: any) => void;
  setInstalled: (v: boolean) => void;
}

/**
 * useInstallPromptStore — captures the browser's `beforeinstallprompt`
 * event once, at app root (App.tsx), so BackupOfflinePanel's own
 * "Install app" button can trigger it later — the event only ever
 * fires once per page load and must be captured before anything asks
 * for it, not lazily inside the panel that might mount after it fired.
 * Not persisted: this is a live browser event object, meaningless
 * across a reload.
 */
export const useInstallPromptStore = create<InstallPromptState>((set) => ({
  event: null,
  installed: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  setEvent: (event) => set({ event }),
  setInstalled: (installed) => set({ installed }),
}));
