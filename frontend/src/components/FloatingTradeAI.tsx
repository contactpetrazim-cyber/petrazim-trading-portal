import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

/**
 * FloatingTradeAI — the floating chat icon requested, always visible
 * bottom-right, opens a lightweight chat panel. This scaffolds the UI
 * shell and the panel; wiring `onSend` to an actual coach LLM
 * endpoint is the integration point (same coach voice/prompt rules
 * already established for TradeCoachPanel/ReasoningPanel and the
 * Weekly Review's build_weekly_review_prompt — reuse that, don't
 * invent a second coach personality here).
 */
export function FloatingTradeAI({
  onSend,
}: {
  onSend?: (message: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
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
      const reply = onSend ? await onSend(userMsg) : "Trade AI isn't wired to a live endpoint yet.";
      setMessages((m) => [...m, { role: 'ai', text: reply }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
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
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-corporate-accent"
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
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Trade AI"
        className="w-14 h-14 rounded-full bg-corporate-accent text-white shadow-xl flex items-center justify-center hover:opacity-90 transition"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  );
}
