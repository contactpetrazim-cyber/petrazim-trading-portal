import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useTradeAIStore } from '../hooks/useTradeAI';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';
import { supabase } from '../integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type ChatMessage = { role: 'user' | 'ai'; text: string };

/**
 * FloatingTradeAI — the floating chat icon, always visible bottom-right.
 *
 * Reported as "Trade AI not working": every question came back as
 * "Coach couldn't answer that just now". Two real causes, both fixed
 * here:
 *   1. The portal backend's own /coach/ask depends on external free-tier
 *      AI providers that are regularly unconfigured or rate-limited, and
 *      there was no second route — one failed provider meant a dead
 *      assistant. It now falls back to our own trade-ai function (Lovable
 *      AI), so an answer still arrives.
 *   2. A cold backend start or any single network blip was swallowed into
 *      the same generic sentence, with no retry and nothing to click.
 *      The fallback covers that too, and a real failure now says so and
 *      keeps the question in the box.
 */
// Both of ai_coach.py's own degraded-fallback strings — matched here so
// the real fallback below (Lovable) actually gets a turn. The backend
// returns these as an ordinary 200 OK reply (a booking/session succeeding
// even when the AI behind it didn't feels like the right call there), but
// that meant this function returned them as if they were real answers and
// askFallback() never ran — the exact bug behind "Coach is temporarily
// unavailable" being shown instead of a real reply, even though Lovable's
// own model was perfectly reachable the whole time.
const BACKEND_DEGRADED_MARKERS = ['temporarily unavailable', "isn't wired to a live AI provider"];

async function askBackendCoach(message: string, token: string | null, contextLessonId: string | null) {
  if (!token) return null;
  const res = await apiFetch(`${API_URL}/coach/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, context_lesson_id: contextLessonId }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  if (!reply) return null;
  if (BACKEND_DEGRADED_MARKERS.some((marker) => reply.includes(marker))) return null;
  return reply;
}

async function askFallback(message: string, history: ChatMessage[]) {
  const { data, error } = await supabase.functions.invoke('trade-ai', {
    body: {
      message,
      history: history.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
    },
  });
  if (error) throw error;
  if (typeof data?.reply === 'string' && data.reply.trim()) return data.reply.trim() as string;
  throw new Error(data?.error || 'No reply');
}

export function FloatingTradeAI({
  onSend,
}: {
  onSend?: (message: string) => Promise<string>;
}) {
  const { open, setOpen } = useTradeAIStore();
  const { token } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Section 4 of the Learning Design Spec — "every query is answered
  // using only the current pillar/stage's actual content as context."
  const lessonMatch = location.pathname.match(/^\/learn\/tracks\/[^/]+\/lessons\/([^/]+)/);
  const contextLessonId = lessonMatch ? lessonMatch[1] : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend() {
    const userMsg = input.trim();
    if (!userMsg || sending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setSending(true);
    setFailed(null);
    try {
      let reply: string | null = null;
      if (onSend) {
        reply = await onSend(userMsg);
      } else {
        // The portal's own coach first (it can ground answers in the
        // lesson being read), then our own model as the safety net.
        reply = await askBackendCoach(userMsg, token, contextLessonId).catch(() => null);
        if (!reply) reply = await askFallback(userMsg, history);
      }
      setMessages((m) => [...m, { role: 'ai', text: reply! }]);
    } catch {
      setFailed('Trade AI is unreachable right now. Check your connection and send it again.');
      setInput(userMsg);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    // bottom-24 (not bottom-6) to clear BottomNav, which is fixed at
    // the very bottom of every CorporateLayout page.
    <div className="fixed bottom-24 right-5 z-40">
      {open && (
        <div className="mb-3 w-80 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 440 }}>
          <div className="bg-corporate-hero text-white px-4 py-3 flex items-center justify-between">
            <div>
              <span className="font-medium text-sm block">Trade AI</span>
              <span className="text-[10px] text-white/70">
                {contextLessonId ? "Grounded in the lesson you're reading" : 'Setups, risk, psychology, your journal'}
              </span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close Trade AI">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-corporate-bg">
            {messages.length === 0 && (
              <div className="text-center mt-6 px-2">
                <Sparkles size={20} className="mx-auto text-corporate-accent mb-2" />
                <p className="text-xs text-gray-500">
                  Ask about a setup, a bot's methodology, risk sizing, or your own trade history.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    'How do I size a trade risking 1%?',
                    'Explain a bullish order block simply.',
                    'What should I journal after a loss?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-white text-corporate-text-on-bg hover:bg-corporate-accent/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-sm px-3 py-2 rounded-lg whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-corporate-accent text-white ml-auto'
                    : 'bg-white text-corporate-text-on-bg'
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] text-sm px-3 py-2 rounded-lg bg-white text-gray-400">Thinking…</div>
            )}
            {failed && <p className="text-[11px] text-red-500 px-1">{failed}</p>}
          </div>

          <div className="p-3 border-t border-corporate-bg flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Trade AI…"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 text-corporate-text-on-bg outline-none focus:border-corporate-accent"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="bg-corporate-accent text-white p-2 rounded-lg disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        aria-label="Open Trade AI"
        className="w-14 h-14 rounded-full bg-corporate-accent text-white shadow-xl flex items-center justify-center hover:opacity-90 transition"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  );
}
