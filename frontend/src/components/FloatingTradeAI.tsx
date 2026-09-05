import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useTradeAIStore } from '../hooks/useTradeAI';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * FloatingTradeAI — the floating chat icon requested, always visible
 * bottom-right, opens a lightweight chat panel.
 *
 * `onSend` now defaults to a real call to POST /coach/ask
 * (services/ai_coach.py's free-tier multi-provider rotation) rather
 * than always replying "isn't wired to a live endpoint yet" — this
 * component is only ever mounted once, bare, at the app root
 * (App.tsx), so nothing was ever going to supply an override; the
 * prop stays available for a future caller that wants to (e.g. a
 * page-scoped variant with extra context), but the real backend is
 * now the default rather than nothing.
 *
 * `open` lives in useTradeAIStore rather than local state, so
 * SettingsPanel's "Ask Trading Coach" row can open this same panel
 * instead of being a dead, do-nothing row — by direct bug report ("Ask
 * Coach is not working"). The bubble button below still works exactly
 * as before, just reading/writing the shared store now.
 */
async function defaultOnSend(message: string, token: string | null): Promise<string> {
  if (!token) return 'Sign in to ask Coach a question.';
  try {
    const res = await apiFetch(`${API_URL}/coach/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.detail || "Coach couldn't answer that just now — try again in a moment.";
    }
    const data = await res.json();
    return data.reply;
  } catch {
    return "Coach couldn't answer that just now — try again in a moment.";
  }
}

export function FloatingTradeAI({
  onSend,
}: {
  onSend?: (message: string) => Promise<string>;
}) {
  const { open, setOpen } = useTradeAIStore();
  const { token } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setSending(true);
    try {
      const reply = onSend ? await onSend(userMsg) : await defaultOnSend(userMsg, token);
      setMessages((m) => [...m, { role: 'ai', text: reply }]);
    } finally {
      setSending(false);
    }
  }

  return (
    // bottom-24 (not bottom-6) to clear BottomNav, which is fixed at
    // the very bottom of every CorporateLayout page.
    <div className="fixed bottom-24 right-5 z-40">
      {open && (
        <div className="mb-3 w-80 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 420 }}>
          <div className="bg-corporate-hero text-white px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-sm">Trade AI</span>
            <button onClick={() => setOpen(false)} aria-label="Close Trade AI">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-corporate-bg">
            {messages.length === 0 && (
              <p className="text-xs text-gray-500 text-center mt-8">
                Ask about a setup, a bot's methodology, or your own trade history.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-sm px-3 py-2 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-corporate-accent text-white ml-auto'
                    : 'bg-white text-corporate-text-on-bg'
                }`}
              >
                {m.text}
              </div>
            ))}
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
              disabled={sending}
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
