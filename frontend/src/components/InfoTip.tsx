import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { GlossaryEntry } from '../config/recommendedDashboardGlossary';

/**
 * InfoTip — a small "i" button that opens an explainer card answering
 * four questions: what it is, why it matters, how it's calculated, how
 * to read it.
 *
 * - Opens on click/tap (touch screens) and on hover/keyboard focus;
 *   closes on Escape, an outside click, scrolling, or moving away
 *   (when it was opened by hover).
 * - The card uses FIXED positioning measured from the button, so it is
 *   never clipped by an overflow-hidden card or a horizontally
 *   scrolling table; it stays inside the viewport and flips above
 *   the icon when there's no room below.
 * - Real <button> with aria-label/aria-expanded/aria-controls; the card
 *   is role="dialog", so screen readers announce it.
 */
const CARD_WIDTH = 320;
const GAP = 6;
const MARGIN = 8;

export function InfoTip({ entry, dark = false }: { entry: GlossaryEntry; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = () => { setOpen(false); setPinned(false); setPos(null); };

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const b = btnRef.current.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - 2 * MARGIN);
    const left = Math.max(MARGIN, Math.min(b.left - 8, window.innerWidth - width - MARGIN));
    const height = cardRef.current?.offsetHeight ?? 0;
    const below = b.bottom + GAP;
    const top = height && below + height > window.innerHeight - MARGIN && b.top - GAP - height > MARGIN
      ? b.top - GAP - height
      : below;
    setPos({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !cardRef.current?.contains(t)) close();
    };
    const onScroll = () => close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const rows: [string, string][] = [
    ['What', entry.what], ['Why', entry.why], ['How', entry.how], ['Reading it', entry.read],
  ];

  return (
    <span
      className="inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) close(); }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={`About: ${entry.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          if (open && pinned) close(); else { setPinned(true); setOpen(true); }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) close(); }}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
          dark ? 'text-gray-500 hover:text-sky-400 focus-visible:text-sky-400' : 'text-gray-400 hover:text-sky-600 focus-visible:text-sky-600'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50`}
      >
        <Info size={13} strokeWidth={2.25} />
      </button>
      {open && (
        <div
          ref={cardRef}
          id={id}
          role="dialog"
          aria-label={entry.title}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? CARD_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
          className={`z-[100] rounded-xl border p-3 text-left shadow-xl normal-case tracking-normal font-normal whitespace-normal ${
            dark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
          }`}
        >
          <div className={`text-sm font-semibold mb-1.5 ${dark ? 'text-white' : 'text-gray-900'}`}>{entry.title}</div>
          {rows.map(([label, text]) => (
            <p key={label} className="text-xs leading-relaxed mb-1.5 last:mb-0">
              <span className={`font-semibold ${dark ? 'text-sky-400' : 'text-sky-700'}`}>{label}: </span>{text}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}
