import { useEffect, useState } from 'react';
import { Award, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from '../components/LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_detail: string;
}
interface Certificate {
  certificate_number: string;
  track_title: string;
  category: string;
  issued_at: string;
}
interface Awards {
  badges: Badge[];
  certificates: Certificate[];
}

/**
 * AwardsPage — the real page behind the Site Map's "Awards &
 * Certificates" link (/learn/awards), which previously routed nowhere.
 * Badges (GET /curriculum/awards) are computed live from real progress
 * data (streak, level, per-category and full-curriculum completion) —
 * there's no seeded badge catalogue that could drift out of sync with
 * what a learner actually did. Certificates are real stored rows,
 * issued the moment a track's last stage completes (see
 * complete_stage() in curriculum.py) — shown here as an in-app card,
 * not a fabricated downloadable PDF this app has no generation
 * pipeline for.
 */
export function AwardsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [data, setData] = useState<Awards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  // Was a plain one-shot apiFetch with no retry — on a cold Render
  // free-tier start the single attempt could fail before the backend
  // ever woke up, leaving this stuck on "Could not load your awards
  // right now" (same bug already fixed elsewhere — see
  // resilientFetch.ts).
  useEffect(() => {
    if (!token) return;
    fetchJsonWithRetry<Awards>(`${API_URL}/curriculum/awards`, { headers: { Authorization: `Bearer ${token}` } }, setPhase)
      .then((d) => {
        if (d) setData(d);
        else setError('Could not load your awards right now.');
      });
  }, [token]);

  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';
  const titleCls = `text-xs font-semibold uppercase tracking-wide mb-4 ${mutedCls}`;

  return (
    <div>
      <PageHeader title="Awards & Certificates" subtitle="Badges earned and certificates issued on track completion." />

      {error && <p className={`text-sm mb-4 ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}
      {!data && !error && (
        (phase === 'loading' || phase === 'stalled')
          ? <div className="mb-4"><LoadingIndicator phase={phase} dark={dark} /></div>
          : <p className={`text-sm ${mutedCls}`}>Loading your awards…</p>
      )}

      {data && (
        <>
          <div className={titleCls}>Badges ({data.badges.filter((b) => b.earned).length} of {data.badges.length} unlocked)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {data.badges.map((b) => (
              <div key={b.id} className={`${cardCls} text-center ${b.earned ? '' : 'opacity-50'}`}>
                <div className="text-4xl mb-2">{b.icon}</div>
                <div className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{b.title}</div>
                <p className={`text-xs mb-2 ${mutedCls}`}>{b.description}</p>
                <div className={`text-xs font-medium ${b.earned ? 'text-emerald-500' : mutedCls}`}>{b.earned_detail}</div>
              </div>
            ))}
          </div>

          <div className={titleCls}>Certificates ({data.certificates.length} issued)</div>
          {data.certificates.length === 0 ? (
            <p className={`text-sm ${mutedCls}`}>
              None yet — a certificate is issued the moment you complete every stage in a track.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.certificates.map((c) => (
                <div key={c.certificate_number} className={cardCls}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
                      <Award size={20} style={{ color: '#0284C7' }} />
                    </div>
                    <ShieldCheck size={16} className="text-emerald-500" />
                  </div>
                  <div className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{c.track_title}</div>
                  <div className={`text-xs mb-3 ${mutedCls}`}>
                    Issued {new Date(c.issued_at).toLocaleDateString()}
                  </div>
                  <div className={`text-[11px] font-mono px-2 py-1 rounded ${dark ? 'bg-white/5 text-white/50' : 'bg-corporate-bg text-gray-500'}`}>
                    {c.certificate_number}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
