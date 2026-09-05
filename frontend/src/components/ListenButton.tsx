import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Settings2 } from 'lucide-react';
import { useNarrationStore } from '../hooks/useNarration';

/**
 * ListenButton — ONE shared narration component used on every surface
 * that reads text aloud (Section 5 of the Learning Design Spec): the
 * main lesson body and the Recap panel here, plus any future surface —
 * never a separate narration implementation per feature.
 *
 * Uses the browser's built-in SpeechSynthesis API — free, no backend
 * call, no API key, works entirely client-side (this platform's AI
 * features are already free-tier-only by direct instruction; a paid
 * TTS API would be the wrong default when a genuinely free one exists
 * and does the job).
 *
 * Behavior matches the spec's test cases:
 * - VO01: markdown/table syntax is stripped before narration so
 *   "asterisk asterisk" / "pipe pipe" is never read aloud.
 * - Long text is split into sentence-level chunks and played back-to-
 *   back via SpeechSynthesis's own onend chaining — avoids the utterance
 *   length limits some browsers silently truncate at.
 * - VO02: changing voice or speed mid-playback restarts the CURRENT
 *   chunk in the new voice/speed rather than restarting from the top.
 */

function stripMarkdown(text: string): string {
  return text
    .replace(/^\|.*\|$/gm, '')                 // table rows
    .replace(/^#{1,6}\s+/gm, '')                // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // bold
    .replace(/`([^`]+)`/g, '$1')                // inline code
    .replace(/\*([^*\n]+)\*/g, '$1')            // italic
    .replace(/^[-*]\s+/gm, '')                  // list markers
    .replace(/^\d+\.\s+/gm, '')                 // numbered list markers
    .replace(/[-=]{3,}/g, '')                   // horizontal rules
    .trim();
}

function splitSentences(text: string): string[] {
  return stripMarkdown(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  const lang = (navigator.language || 'en-US').split('-')[0];
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return (matching.length >= 2 ? matching : all).slice(0, 2);
}

export function ListenButton({ text, dark = false }: { text: string; dark?: boolean }) {
  const { voiceSlot, speed, setVoiceSlot, setSpeed } = useNarrationStore();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const chunksRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(pickVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  function speakFrom(index: number) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    indexRef.current = index;
    const chunk = chunksRef.current[index];
    if (chunk === undefined) { setPlaying(false); setPaused(false); return; }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = speed;
    const voice = voiceSlot === 'voice1' ? voices[0] : voices[1] ?? voices[0];
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (indexRef.current + 1 < chunksRef.current.length) {
        speakFrom(indexRef.current + 1);
      } else {
        setPlaying(false);
        setPaused(false);
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  function handlePlayPause() {
    if (!supported) return;
    if (playing && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      return;
    }
    if (playing && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }
    chunksRef.current = splitSentences(text);
    setPlaying(true);
    setPaused(false);
    speakFrom(0);
  }

  function handleStop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
  }

  // VO02 — a voice/speed change mid-playback restarts the CURRENT
  // chunk (not the whole passage) in the new voice/speed.
  function changeVoice(slot: 'voice1' | 'voice2') {
    setVoiceSlot(slot);
    if (playing) setTimeout(() => speakFrom(indexRef.current), 0);
  }
  function changeSpeed(next: number) {
    setSpeed(next);
    if (playing) setTimeout(() => speakFrom(indexRef.current), 0);
  }

  if (!supported) return null;

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const btnCls = `flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
    dark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-corporate-bg hover:bg-corporate-hero/10 text-corporate-hero'
  }`;

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1.5">
        <button onClick={handlePlayPause} className={btnCls} aria-label={playing && !paused ? 'Pause narration' : 'Listen'}>
          {playing && !paused ? <Pause size={13} /> : <Play size={13} />}
          {playing ? (paused ? 'Paused' : 'Listening…') : 'Listen'}
        </button>
        {playing && (
          <button onClick={handleStop} aria-label="Stop narration" className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'} ${mutedCls}`}>
            <Square size={12} />
          </button>
        )}
        <button onClick={() => setShowSettings((v) => !v)} aria-label="Narration settings" className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'} ${mutedCls}`}>
          <Settings2 size={12} />
        </button>
      </div>

      {showSettings && (
        <div className={`absolute z-20 mt-2 p-3 rounded-xl border shadow-lg w-48 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
          <div className={`text-[11px] font-semibold mb-1.5 ${mutedCls}`}>Voice</div>
          <div className="flex gap-1.5 mb-3">
            {(['voice1', 'voice2'] as const).map((slot, i) => (
              <button
                key={slot}
                onClick={() => changeVoice(slot)}
                disabled={!voices[i]}
                className={`flex-1 text-xs py-1.5 rounded-lg disabled:opacity-30 ${
                  voiceSlot === slot ? 'bg-corporate-hero text-white' : dark ? 'bg-white/5 text-white/70' : 'bg-corporate-bg text-gray-600'
                }`}
              >
                Voice {i + 1}
              </button>
            ))}
          </div>
          <div className={`text-[11px] font-semibold mb-1.5 ${mutedCls}`}>Speed — {speed.toFixed(2)}x</div>
          <input
            type="range" min={0.75} max={1.5} step={0.05} value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
