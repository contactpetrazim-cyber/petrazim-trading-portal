import { useState, FormEvent } from 'react';
import { MessageCircle, AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { dayTraderSkillChatApi } from '../services/api';
import { useThemeStore } from '../hooks/useTheme';

interface Turn {
  question: string;
  reply?: string;
  error?: string;
}

/**
 * ExploreDayTraderSkillChatPage -- "really my Claude code", surfaced as
 * a page (direct request, with an explicit follow-up to gate it to
 * admin/invited users and confirmation that storing the credential as a
 * Render secret addresses the storage half of that concern).
 *
 * Backed by POST /day-trader-skill-chat/ask (day_trader_skill_chat.py),
 * which is Claude -- same model, grounded in the real Day Trader Skill
 * pack's documented knowledge -- but a single bounded Messages API call
 * per question, no tool/agent access. Server-side gate is
 * require_feature_access("day_trader_skill_chat"): Admin/Super Admin
 * always pass, everyone else needs an invite from the Admin Console's
 * Feature Access panel. A 403 here means "not invited," not a bug.
 */
export function ExploreDayTraderSkillChatPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [gated, setGated] = useState(false);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  function ask(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setQuestion('');
    const turn: Turn = { question: q };
    setTurns((t) => [...t, turn]);
    dayTraderSkillChatApi.ask(q)
      .then((res) => setTurns((t) => t.map((x) => (x === turn ? { ...x, reply: res.reply } : x))))
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 403) setGated(true);
        setTurns((t) => t.map((x) => (x === turn ? { ...x, error: err?.response?.data?.detail || 'Could not get a reply right now.' } : x)));
      })
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <PageHeader
        title="Day Trader Skill Chat"
        subtitle="Ask Claude anything about the Day Trader Skill Pack's logic -- admin/invite-only."
      />

      {gated ? (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            This feature is admin/invite-only -- it's a real, paid Claude call, so access is deliberately limited.
            Ask an admin to grant you access from the Admin Console's Feature Access panel.
          </span>
        </div>
      ) : (
        <p className={`text-xs mb-4 ${mutedCls}`}>
          Grounded in the real Day Trader Skill Pack's documented logic and thresholds -- not a live scan or a
          prediction. For real computed numbers, use Trade Scanner, Time Machine, Congress Trades, or News Monitor
          instead; this is for explaining the "why."
        </p>
      )}

      <div className="space-y-3 mb-4">
        {turns.map((t, i) => (
          <div key={i} className={cardCls}>
            <div className="flex items-start gap-2 mb-2">
              <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>You</span>
            </div>
            <p className={`text-sm mb-3 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.question}</p>
            <div className="flex items-start gap-2 mb-2">
              <Sparkles size={13} className={dark ? 'text-corporate-hero' : 'text-corporate-hero'} />
              <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Claude</span>
            </div>
            {t.error ? (
              <div className={`flex items-start gap-2 text-xs ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{t.error}</span>
              </div>
            ) : t.reply ? (
              <p className={`text-sm whitespace-pre-wrap ${dark ? 'text-white/90' : 'text-corporate-text-on-bg'}`}>{t.reply}</p>
            ) : (
              <p className={`text-xs ${mutedCls}`}>Thinking…</p>
            )}
          </div>
        ))}
        {turns.length === 0 && !gated && (
          <p className={`text-sm ${mutedCls}`}>
            Try: "What counts as a bull flag?" or "Why does the Risk Manager block a trade?" or "How does the Time
            Machine pick which past day to replay?"
          </p>
        )}
      </div>

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder={gated ? 'Access restricted -- ask an admin to invite you' : 'Ask a question about the skill pack...'}
          disabled={gated}
          className={`flex-1 px-3 py-2 rounded-lg text-sm border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'} disabled:opacity-50`}
        />
        <button
          type="submit" disabled={gated || loading || !question.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-corporate-hero disabled:opacity-40 flex items-center gap-1.5"
        >
          <MessageCircle size={14} /> {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
