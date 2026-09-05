import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Bookmark } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DueItem { check_id: string; lesson_id: string; lesson_title: string; track_title: string; due_at: string }
interface Bookmarked { stage_id: string; stage_title: string; pillar_id: string; pillar_title: string; saved_at: string }

/**
 * RevisionPlannerPage — Section 12: "read-only composite view over
 * spaced-review due items (Section 7) + bookmarks — no new data of
 * its own." Reuses /practise/retention/due (already real, already
 * powers ReviewSession/RetentionReviewPage) and /curriculum/bookmarks
 * side by side rather than inventing a third data source.
 */
export function RevisionPlannerPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [due, setDue] = useState<DueItem[] | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmarked[] | null>(null);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    apiFetch(`${API_URL}/practise/retention/due`, { headers }).then((r) => (r.ok ? r.json() : [])).then(setDue).catch(() => setDue([]));
    apiFetch(`${API_URL}/curriculum/bookmarks`, { headers }).then((r) => (r.ok ? r.json() : [])).then(setBookmarks).catch(() => setBookmarks([]));
  }, [token]);

  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';
  const cardCls = `rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div>
      <PageHeader title="Revision Planner" subtitle="What's due for review, and what you've bookmarked to come back to." />

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Due for review</span>
        </div>
        {due === null && <p className={`text-sm ${mutedCls}`}>Loading…</p>}
        {due && due.length === 0 && <p className={`text-sm ${mutedCls}`}>Nothing due right now — check back later.</p>}
        {due && due.length > 0 && (
          <div className="space-y-2">
            {due.map((d) => (
              <Link key={d.check_id} to="/practise/review" className={`${cardCls} block hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]`}>
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{d.lesson_title}</div>
                <div className={`text-xs mt-0.5 ${mutedCls}`}>{d.track_title} · due {new Date(d.due_at).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Bookmarked stages</span>
        </div>
        {bookmarks === null && <p className={`text-sm ${mutedCls}`}>Loading…</p>}
        {bookmarks && bookmarks.length === 0 && <p className={`text-sm ${mutedCls}`}>Nothing bookmarked yet.</p>}
        {bookmarks && bookmarks.length > 0 && (
          <div className="space-y-2">
            {bookmarks.map((b) => (
              <Link key={b.stage_id} to={`/learn/tracks/${b.pillar_id}`} className={`${cardCls} block hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]`}>
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{b.stage_title}</div>
                <div className={`text-xs mt-0.5 ${mutedCls}`}>{b.pillar_title}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {due?.length === 0 && bookmarks?.length === 0 && (
        <p className={`text-sm mt-4 ${mutedCls}`}>Nothing to plan yet — this fills in as you learn.</p>
      )}
    </div>
  );
}
