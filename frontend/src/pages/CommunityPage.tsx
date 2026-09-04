import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Sparkles, Trophy, HelpCircle, CalendarClock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Public channel links — not secrets, already named in the Master
// Handover (Part A §7). Joining goes through Telegram's own "request
// to join" flow; the backend webhook auto-approves it (see
// services/telegram.py) once someone taps one of these.
const TELEGRAM_LINKS = {
  individual: 'https://t.me/petrazim_tradefx',
  corporate: 'https://t.me/petrazim_tradefx_corp',
};

interface Preview {
  daily_tip: string | null;
  leaderboard: string | null;
  weekly_quiz_question: string;
  weekly_quiz_source: string;
}

/**
 * CommunityPage — the real Community area, replacing the generic
 * FoldedCard link list. Per Master Handover Part A §7: a Telegram
 * connection card, plus (new, this pass) a preview of what the
 * channels actually receive — the daily learning tip, the streak
 * leaderboard, and this week's quiz question — pulled from the real
 * community_broadcast.py builders via GET /community/broadcast/preview,
 * not decorative copy. "Trader Meetings" still routes to /meetings
 * (Facilitator Sessions), unchanged.
 */
export function CommunityPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [tier, setTier] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    apiFetch(`${API_URL}/payments/access-status`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s?.has_active_access && setTier(s.granted_via))
      .catch(() => {});
    apiFetch(`${API_URL}/community/broadcast/preview`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then(setPreview)
      .catch(() => {});
  }, [token]);

  const joinUrl = tier === 'corporate_seat' ? TELEGRAM_LINKS.corporate : TELEGRAM_LINKS.individual;
  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div>
      <PageHeader title="Community" subtitle="The Telegram community and booking time with a facilitator or manager." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.57 8.16-1.86 8.77c-.14.63-.5.78-1.02.49l-2.82-2.08-1.36 1.31c-.15.15-.28.28-.57.28l.2-2.87 5.23-4.72c.23-.2-.05-.31-.35-.11L9 12.4l-2.8-.87c-.61-.19-.62-.61.13-.9l10.94-4.22c.51-.19.96.12.8.9Z"/></svg>
            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Telegram Community</span>
          </div>
          <p className={`text-sm mb-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Connected automatically on join request — no manual approval wait. Daily tips, a streak
            leaderboard, and a weekly quiz post here (see the previews below).
          </p>
          <a
            href={joinUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-[#229ED9]"
          >
            <ExternalLink size={15} /> Join on Telegram
          </a>
        </div>

        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={18} className="text-corporate-hero" />
            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Trader Meetings</span>
          </div>
          <p className={`text-sm mb-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Book time with a facilitator, Fund Manager, or Partner — open-topic 1:1 sessions,
            Professional/Executive tier.
          </p>
          <Link to="/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-corporate-hero">
            Book a session
          </Link>
        </div>
      </div>

      <h2 className={`text-lg font-bold mb-3 font-display ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
        What's Posting to the Channels
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FoldedCard title="Today's Tip" icon={<Sparkles size={19} />} dark={dark} defaultOpen>
          <p className={`text-sm whitespace-pre-line ${dark ? 'text-white/70' : 'text-gray-600'}`}>
            {preview?.daily_tip ?? 'No authored lesson content to draw from yet.'}
          </p>
        </FoldedCard>
        <FoldedCard title="Leaderboard" icon={<Trophy size={19} />} dark={dark} defaultOpen>
          <p className={`text-sm whitespace-pre-line ${dark ? 'text-white/70' : 'text-gray-600'}`}>
            {preview?.leaderboard ?? 'No XP earned by anyone yet — the board fills in as Learn stages are completed.'}
          </p>
        </FoldedCard>
        <FoldedCard title="This Week's Quiz" icon={<HelpCircle size={19} />} dark={dark} defaultOpen>
          <p className={`text-sm mb-1 ${dark ? 'text-white/70' : 'text-gray-600'}`}>{preview?.weekly_quiz_question}</p>
          {preview?.weekly_quiz_source && (
            <p className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>From: {preview.weekly_quiz_source}</p>
          )}
        </FoldedCard>
      </div>
    </div>
  );
}
