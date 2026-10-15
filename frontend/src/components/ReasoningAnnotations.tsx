import { useState } from 'react';
import { ListOrdered, ChevronDown } from 'lucide-react';

/**
 * Splits a bot's free-form reasoning_log prose into numbered steps —
 * by direct request ("CAN the snapshot chart and the approval charts
 * and on charts be annotated with the items from the reasoning summary
 * labelled 1 to x ... so a user can see visually how the trade
 * opportunity came to be ... with a toggle on or off annotation").
 *
 * reasoning_log (BotSignal.reasoning in bot_strategies.py, e.g.
 * "Macro swing long. 1D trend confirmed. 4H BOS at 83046.40. ...") has
 * no existing numbering convention — it's one period-separated prose
 * string. Trade.technical_snapshot (models/trade.py) exists and would
 * be the right place to store each clause's own chart coordinates, but
 * is never populated anywhere in the backend (confirmed by grep before
 * building this), so there is no real per-concept price/candle data to
 * anchor a label to on the chart itself. Rather than invent fabricated
 * coordinates, this gives the real, honest version of the request: the
 * SAME reasoning text, split into a numbered 1-to-X list instead of one
 * run-on paragraph, so each step of how the signal was built reads as
 * its own labelled item — with a toggle to turn the numbering off and
 * fall back to the original plain paragraph.
 */
export function splitReasoningIntoSteps(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ReasoningAnnotations({
  text, dark, foldable = true,
}: { text: string; dark: boolean; foldable?: boolean }) {
  const [open, setOpen] = useState(!foldable);
  const [numbered, setNumbered] = useState(true);
  const steps = splitReasoningIntoSteps(text);
  if (steps.length === 0) return null;

  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  const body = numbered ? (
    <ol className="space-y-1.5 mt-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
          <span
            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
              dark ? 'bg-corporate-hero/30 text-white' : 'bg-corporate-hero/15 text-corporate-hero'
            }`}
          >
            {i + 1}
          </span>
          <span className={mutedCls}>{s}</span>
        </li>
      ))}
    </ol>
  ) : (
    <p className={`mt-2 text-xs leading-relaxed whitespace-pre-wrap ${mutedCls}`}>{text}</p>
  );

  if (!foldable) {
    return (
      <div>
        <button
          onClick={() => setNumbered((v) => !v)}
          className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
        >
          <ListOrdered size={12} /> {numbered ? 'Numbered annotations on' : 'Numbered annotations off'}
        </button>
        {body}
      </div>
    );
  }

  return (
    <div className={`mt-3 pt-3 border-t border-dashed ${dark ? 'border-white/10' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
        >
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          Reason summary ({steps.length} step{steps.length === 1 ? '' : 's'})
        </button>
        {open && (
          <button
            onClick={() => setNumbered((v) => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-corporate-text-on-bg'}`}
          >
            <ListOrdered size={12} /> {numbered ? 'Numbered' : 'Plain text'}
          </button>
        )}
      </div>
      {open && body}
    </div>
  );
}
