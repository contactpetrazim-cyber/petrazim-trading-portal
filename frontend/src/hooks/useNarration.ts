import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NarrationVoiceSlot = 'male' | 'female';

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
 * `voiceSlot` picks between a male- and female-classified browser
 * voice (see lib/voiceGender.ts) — by direct request ("Can we have a
 * male and female voice option ... instead of two female voices — and
 * label 'Male' or 'Female'"). Earlier this picked the first two voices
 * for the visitor's language and labeled them generically "Voice 1"/
 * "Voice 2" specifically because the Web Speech API has no gender
 * field to read; ListenButton now classifies the actual voice list by
 * name instead and falls back to that generic pairing only if it
 * can't find one of each gender, so a stored 'male'/'female'
 * preference is best-effort, not a guarantee every browser can honor.
 */
export const useNarrationStore = create<NarrationState>()(
  persist(
    (set) => ({
      voiceSlot: 'female',
      speed: 1,
      setVoiceSlot: (voiceSlot) => set({ voiceSlot }),
      setSpeed: (speed) => set({ speed: Math.min(1.5, Math.max(0.75, speed)) }),
    }),
    { name: 'petrazim-narration-prefs' },
  ),
);
