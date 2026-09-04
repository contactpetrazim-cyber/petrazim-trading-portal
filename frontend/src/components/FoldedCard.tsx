import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * FoldedCard — the site-wide card behavior: folded (collapsed) by
 * default, expands on click, and optionally on hover. Meant to become
 * the default card pattern across Learn, Tools, Insights, Community,
 * and Explore — RegistrationGateCard already used a hand-rolled
 * version of this; this is the reusable primitive so every future
 * card gets the same behavior for free instead of re-implementing
 * fold/unfold logic per component.
 *
 * Hover-to-expand is opt-in (expandOnHover) rather than default,
 * since hover-expand on mobile has no equivalent gesture — click
 * always works everywhere, hover is a desktop enhancement layered on
 * top, not a replacement for it.
 *
 * Reconciled against petrazim_preview_v13_FINAL.jsx: `dark` support
 * (this card appears on pages inside the site-wide theme toggle) and
 * the icon rendered in a tinted circular chip rather than bare.
 */
export function FoldedCard({
  title,
  summary,
  icon,
  children,
  defaultOpen = false,
  expandOnHover = false,
  dark = false,
  accent,
}: {
  title: string;
  summary?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  expandOnHover?: boolean;
  dark?: boolean;
  /** Icon badge color, hex — defaults to corporate-hero. The one
   * documented exception is the Tools area, which uses a distinct
   * cyan-teal (#0891b2) for its card icons on purpose (Section 6 of
   * the Master Handover: "the only area that uses an accent color
   * other than HERO_BLUE for its card icons"). */
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovering, setHovering] = useState(false);

  const isOpen = open || (expandOnHover && hovering);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-shadow ${
        dark
          ? 'bg-corporate-surface-dark border-corporate-border-dark'
          : 'bg-white border-[#dcdce8] hover:shadow-[0_8px_30px_rgba(15,45,110,0.08)]'
      }`}
      onMouseEnter={() => expandOnHover && setHovering(true)}
      onMouseLeave={() => expandOnHover && setHovering(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-5 text-left"
        aria-expanded={isOpen}
      >
        {icon && (
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-corporate-hero/10 text-corporate-hero"
            style={accent ? { background: `${accent}1a`, color: accent } : undefined}
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{title}</div>
          {summary && !isOpen && (
            <div className={`text-xs mt-0.5 truncate ${dark ? 'text-white/40' : 'text-[#7c839c]'}`}>{summary}</div>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${dark ? 'text-white/30' : 'text-[#9aa0b8]'}`}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
