import { useState } from 'react';
import { NotebookPen, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * ReflectionPrompt — Section 9 of the Learning Design Spec: one
 * free-text prompt per track/module end ("What's one thing from this
 * module you'll apply this week?"). Shown once a track is fully
 * complete. Deliberately low-complexity, by the spec's own words: no
 * AI grading, no required length — submitting an empty reflection is
 * allowed (RJ01), it just isn't very useful.
 */
export function ReflectionPrompt({ trackId, dark }: { trackId: string; dark: boolean }) {
  const { token } = useAuth();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/curriculum/reflections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ track_id: trackId, text }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className={`rounded-2xl p-5 border mt-4 flex items-center gap-2 text-sm ${dark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
        <Check size={16} /> Saved to My Reflections.
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border mt-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center gap-2 mb-2">
        <NotebookPen size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Track complete — one last thing</span>
      </div>
      <p className={`text-sm mb-3 ${dark ? 'text-white/50' : 'text-gray-500'}`}>What's one thing from this track you'll apply this week?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Optional — write as much or as little as you want."
        className={`w-full rounded-lg px-3 py-2 text-sm outline-none border resize-none mb-3 ${
          dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'
        }`}
      />
      <button
        onClick={submit}
        disabled={busy}
        className="text-xs font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save reflection'}
      </button>
    </div>
  );
}
