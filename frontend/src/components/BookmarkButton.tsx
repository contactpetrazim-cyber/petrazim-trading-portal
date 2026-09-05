import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * BookmarkButton — Section 12's dashboard "Bookmarked" section.
 * Explicitly independent of stage completion (EP02) — this only ever
 * reads/writes BookmarkedStage, never StageCompletion.
 */
export function BookmarkButton({ stageId, dark }: { stageId: string; dark: boolean }) {
  const { token } = useAuth();
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/curriculum/bookmarks`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { stage_id: string }[]) => setSaved(list.some((b) => b.stage_id === stageId)))
      .catch(() => setSaved(false));
  }, [token, stageId]);

  async function toggle() {
    if (!token || saved === null) return;
    setSaved(!saved); // optimistic
    const url = `${API_URL}/curriculum/bookmarks/${stageId}`;
    const headers = { Authorization: `Bearer ${token}` };
    await apiFetch(url, { method: saved ? 'DELETE' : 'POST', headers }).catch(() => setSaved(saved));
  }

  return (
    <button
      onClick={toggle}
      disabled={saved === null}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark this stage'}
      title={saved ? 'Bookmarked — click to remove' : 'Bookmark this stage'}
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-40 ${
        saved
          ? 'bg-amber-500/15 text-amber-600'
          : dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
      }`}
    >
      {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {saved ? 'Bookmarked' : 'Bookmark'}
    </button>
  );
}
