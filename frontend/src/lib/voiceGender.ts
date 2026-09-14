/**
 * voiceGender — classifies a browser SpeechSynthesisVoice as male or
 * female for ListenButton's voice picker. By direct request ("Can we
 * have a male and female voice option ... instead of two female
 * voices — and label 'Male' or 'Female'") — ListenButton previously
 * labeled its two options "Voice 1"/"Voice 2" specifically because the
 * Web Speech API exposes no `gender` field at all, and simply taking
 * the first two voices for a language can land on two of the same
 * apparent gender (exactly what was reported).
 *
 * There's no reliable API-level signal, so this uses the same
 * practical approach most web TTS gender pickers fall back to: the
 * voice's own `name` string. Some engines label it explicitly
 * ("Google UK English Male"); most just ship a common given name
 * (Microsoft "Zira", macOS "Samantha", etc.) — matched against a
 * curated list of the voice names that actually ship across Chrome/
 * Edge/Safari/Firefox's built-in engines. Returns 'unknown' rather
 * than guessing when neither signal matches, so the caller can fall
 * back to an unlabeled slot instead of mislabeling a voice.
 */
export type VoiceGender = 'male' | 'female' | 'unknown';

const FEMALE_NAMES = [
  'zira', 'hazel', 'susan', 'linda', 'catherine', 'eva', 'helena',
  'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'allison',
  'ava', 'kate', 'kathy', 'serena', 'nicky', 'zoe', 'sara', 'sandy',
  'veena', 'lekha', 'ellen', 'amelie', 'anna', 'ioana', 'joana',
  'kyoko', 'mei-jia', 'sin-ji', 'ting-ting', 'yuna', 'salli', 'joanna',
  'kimberly', 'kendra', 'ivy', 'raveena', 'aditi', 'paulina', 'monica',
  'luciana', 'penelope', 'lucia', 'mia', 'carmit', 'gwyneth',
];
const MALE_NAMES = [
  'david', 'mark', 'guy', 'ryan', 'george', 'james', 'christopher',
  'alex', 'daniel', 'fred', 'tom', 'oliver', 'arthur', 'aaron', 'lee',
  'gordon', 'rocko', 'reed', 'eddy', 'albert', 'bruce', 'diego',
  'jorge', 'juan', 'carlos', 'pablo', 'miguel', 'rishi', 'takumi',
  'yuri', 'matthew', 'justin', 'joey', 'russell', 'brian', 'liam',
  'nathan',
];

export function classifyVoiceGender(voice: SpeechSynthesisVoice): VoiceGender {
  const name = voice.name.toLowerCase();
  if (/\bfemale\b/.test(name)) return 'female';
  if (/\bmale\b/.test(name)) return 'male';
  if (FEMALE_NAMES.some((n) => name.includes(n))) return 'female';
  if (MALE_NAMES.some((n) => name.includes(n))) return 'male';
  return 'unknown';
}
