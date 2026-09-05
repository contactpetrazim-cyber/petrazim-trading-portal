import { useEffect, useState } from 'react';
import { PenLine, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Note { id: string; text: string; created_at: string }

/**
 * NotebookWidget — Section 12's inline per-stage popover. Independent
 * of ReflectionEntry (one prompt per track-end) — this is unstructured
 * note-taking on this specific stage, any time, no prompt.
 */
export function NotebookWidget({ stageId, dark }: { stageId: string; dark: boolean }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    if (!token) return;
    apiFetch(`${API_URL}/curriculum/notebook?stage_id=${stageId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotes)
      .catch(() => {});
  }

  useEffect(() => { if (open) load(); }, [open, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!token || !draft.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/curriculum/notebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage_id: stageId, text: draft.trim() }),
      });
      if (res.ok) {
        setDraft('');
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
          dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
        }`}
      >
        <PenLine size={15} /> Notes
      </button>
    );
  }

  return (
    <div className={`rounded-2xl p-4 border w-full sm:w-80 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Notes on this stage</span>
        <button onClick={() => setOpen(false)} aria-label="Close notes" className={dark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600'}>
          <X size={15} />
        </button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className={`text-xs rounded-lg p-2 ${dark ? 'bg-white/5 text-white/70' : 'bg-corporate-bg text-gray-600'}`}>
              {n.text}
              <div className={`mt-1 ${dark ? 'text-white/30' : 'text-gray-400'}`}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Jot something down…"
        className={`w-full rounded-lg px-2.5 py-1.5 text-sm outline-none border resize-none mb-2 ${
          dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'
        }`}
      />
      <button
        onClick={save}
        disabled={saving || !draft.trim()}
        className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-corporate-hero disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save note'}
      </button>
    </div>
  );
}
