import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Reflection {
  id: string;
  track_id: string;
  track_title: string;
  text: string;
  created_at: string;
}

/**
 * MyReflectionsPage — Section 9's "viewable later in 'My Reflections'":
 * chronological (newest first, matching the API's own ordering),
 * filterable by track (RJ02).
 */
export function MyReflectionsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [entries, setEntries] = useState<Reflection[] | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<string>('all');

  useEffect(() => {
    if (!token) return;
    fetchJsonWithRetry<Reflection[]>(
      `${API_URL}/curriculum/reflections`, { headers: { Authorization: `Bearer ${token}` } }, setPhase,
    ).then((r) => {
      if (r) setEntries(r);
      else setError('Could not load your reflections right now.');
    });
  }, [token]);

  const tracks = Array.from(new Map((entries ?? []).map((e) => [e.track_id, e.track_title])).entries());
  const filtered = trackFilter === 'all' ? entries : entries?.filter((e) => e.track_id === trackFilter);

  return (
    <div>
      <PageHeader title="My Reflections" subtitle="What you took away from each track, in your own words." />

      {entries === null && !error && <LoadingIndicator phase={phase} dark={dark} />}
      {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}

      {entries && entries.length === 0 && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          Nothing here yet — complete a track and you'll be prompted to reflect on it.
        </p>
      )}

      {entries && entries.length > 0 && (
        <>
          {tracks.length > 1 && (
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className={`mb-4 rounded-lg px-3 py-2 text-sm outline-none border ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}
            >
              <option value="all">All tracks</option>
              {tracks.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          )}
          <div className="space-y-3">
            {filtered?.map((e) => (
              <div key={e.id} className={`rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <NotebookPen size={13} className={dark ? 'text-white/40' : 'text-gray-400'} />
                  <span className={`text-xs font-semibold ${dark ? 'text-white/60' : 'text-gray-500'}`}>{e.track_title}</span>
                  <span className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>· {new Date(e.created_at).toLocaleDateString()}</span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-line ${dark ? 'text-white/80' : 'text-corporate-text-on-bg'}`}>{e.text || '(no text)'}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
