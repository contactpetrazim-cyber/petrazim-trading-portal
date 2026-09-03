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
 */
export function FoldedCard({
  title,
  summary,
  icon,
  children,
  defaultOpen = false,
  expandOnHover = false,
}: {
  title: string;
  summary?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  expandOnHover?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovering, setHovering] = useState(false);

  const isOpen = open || (expandOnHover && hovering);

  return (
    <div
      className="bg-white rounded-xl border border-corporate-bg overflow-hidden transition-shadow hover:shadow-md"
      onMouseEnter={() => expandOnHover && setHovering(true)}
      onMouseLeave={() => expandOnHover && setHovering(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={isOpen}
      >
        {icon && <span className="text-corporate-hero shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-corporate-text-on-bg">{title}</div>
          {summary && !isOpen && (
            <div className="text-xs text-gray-500 truncate mt-0.5">{summary}</div>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
