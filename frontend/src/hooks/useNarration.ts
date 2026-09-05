import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NarrationVoiceSlot = 'voice1' | 'voice2';

interface NarrationState {
  voiceSlot: NarrationVoiceSlot;
  speed: number;   // 0.75 - 1.5, per Section 5 of the Learning Design Spec
  setVoiceSlot: (v: NarrationVoiceSlot) => void;
  setSpeed: (s: number) => void;
}

/**
 * Shared voice/speed preference across every ListenButton instance in
 * the app — "One shared voice/speed/stop control state — switching
 * voice on the Recap panel also applies if the trainee then opens
 * notes, within the same session" (Section 5, VO02/VO03). Persisted
 * the same way theme is, so it also survives a reload.
 *
 * `voiceSlot` is deliberately not literally 'male'/'female': the
 * browser's SpeechSynthesis voice list is whatever the visitor's OS/
 * browser ships (varies wildly, often has zero labeled-gender voices
 * at all) — voice1/voice2 picks the first two voices for the current
 * language and labels them "Voice 1"/"Voice 2" in the UI, which is
 * honest about what this can actually offer rather than promising a
 * male/female choice this API can't reliably deliver everywhere.
 */
export const useNarrationStore = create<NarrationState>()(
  persist(
    (set) => ({
      voiceSlot: 'voice1',
      speed: 1,
      setVoiceSlot: (voiceSlot) => set({ voiceSlot }),
      setSpeed: (speed) => set({ speed: Math.min(1.5, Math.max(0.75, speed)) }),
    }),
    { name: 'petrazim-narration-prefs' },
  ),
);
