import { useEffect, useState } from 'react';
import { PenLine, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Note { id: string; stage_title: string; pillar_title: string; text: string; created_at: string }

/** MyNotesPage — Section 12's consolidated "My Notes" list, across every stage. */
export function MyNotesPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [notes, setNotes] = useState<Note[] | null>(null);

  function load() {
    if (!token) return;
    apiFetch(`${API_URL}/curriculum/notebook`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotes)
      .catch(() => setNotes([]));
  }

  useEffect(load, [token]);

  async function remove(id: string) {
    if (!token) return;
    await apiFetch(`${API_URL}/curriculum/notebook/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <div>
      <PageHeader title="My Notes" subtitle="Everything you've jotted down, across every lesson." />

      {notes === null && <p className={`text-sm ${mutedCls}`}>Loading…</p>}
      {notes && notes.length === 0 && (
        <p className={`text-sm ${mutedCls}`}>No notes yet — the Notes button on any lesson lets you jot something down.</p>
      )}
      {notes && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className={`rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <PenLine size={13} className={mutedCls} />
                  <span className={`text-xs font-semibold ${dark ? 'text-white/60' : 'text-gray-500'}`}>{n.stage_title}</span>
                  <span className={`text-xs ${mutedCls}`}>· {n.pillar_title} · {new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <button onClick={() => remove(n.id)} aria-label="Delete note" className={`shrink-0 ${dark ? 'text-white/30 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}>
                  <Trash2 size={14} />
                </button>
              </div>
              <p className={`text-sm leading-relaxed whitespace-pre-line ${dark ? 'text-white/80' : 'text-corporate-text-on-bg'}`}>{n.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
