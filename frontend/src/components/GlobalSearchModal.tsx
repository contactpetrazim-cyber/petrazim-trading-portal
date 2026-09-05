import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Home, BookMarked } from 'lucide-react';
import { FEATURE_AREAS, searchFeatures } from '../config/featureRegistry';
import { SMC_DIAGRAM_DATA, SMC_DIAGRAM_KEYS } from './SMCDiagram';
import { useThemeStore } from '../hooks/useTheme';

// Not a FEATURE_REGISTRY entry — Home is the dashboard, not one of the
// 8 areas — so it's pinned in here by hand rather than registered,
// added by direct request for a quick way back to it from search.
const HOME_RESULT = { id: 'home', label: 'Home', route: '/home', description: 'Back to the dashboard.' };

/**
 * GlobalSearchModal — searches across ALL 7 feature areas at once
 * (Learn/Practise/Trade/Insights/Tools/Community/Explore), reading
 * from the same FEATURE_REGISTRY the nav uses, plus the pinned Home
 * shortcut above. Opens from the search icon in TopNav, or Cmd/Ctrl+K.
 */
export function GlobalSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(); // parent toggles; simplest is to let TopNav own the open state
      }
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const homeMatches = !q || 'home'.includes(q) || 'dashboard'.includes(q);
  const results = searchFeatures(query);
  const areaLabel = (id: string) => FEATURE_AREAS.find((a) => a.id === id)?.label ?? id;

  // Section 12's Global Search: "returns the stage AND the flashcard
  // glossary term, grouped separately" (EP01) — matched against the
  // same Visual Glossary terms surfaced inline on lessons, static and
  // local so this costs no extra request.
  const glossaryMatches = q
    ? SMC_DIAGRAM_KEYS.filter((k) => SMC_DIAGRAM_DATA[k].title.toLowerCase().includes(q))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <Search size={18} className="text-corporate-hero" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Learn, Practise, Trade, Insights, Tools, Community, Explore…"
            className={`flex-1 outline-none text-sm bg-transparent ${dark ? 'text-white placeholder:text-white/30' : 'text-corporate-text-on-bg placeholder:text-gray-400'}`}
          />
          <button onClick={onClose} aria-label="Close search">
            <X size={18} className={dark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query && results.length === 0 && glossaryMatches.length === 0 && !homeMatches && (
            <p className={`text-sm px-4 py-6 text-center ${dark ? 'text-white/40' : 'text-gray-500'}`}>No matches for "{query}"</p>
          )}
          {homeMatches && (
            <Link
              to={HOME_RESULT.route}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`}
            >
              <Home size={16} className="text-corporate-hero shrink-0" />
              <div>
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{HOME_RESULT.label}</div>
                <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{HOME_RESULT.description}</div>
              </div>
            </Link>
          )}
          {results.map((r) => (
            <Link
              key={r.id}
              to={r.route}
              onClick={onClose}
              className={`flex items-start justify-between gap-3 px-4 py-3 transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`}
            >
              <div>
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{r.label}</div>
                <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{r.description}</div>
              </div>
              <span className="text-xs font-medium text-corporate-accent shrink-0 pt-0.5">
                {areaLabel(r.area)}
              </span>
            </Link>
          ))}
          {glossaryMatches.length > 0 && (
            <div className={`px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-white/30' : 'text-gray-400'}`}>
              Visual Glossary
            </div>
          )}
          {glossaryMatches.map((k) => (
            <Link
              key={k}
              to="/learn/visual-glossary"
              onClick={onClose}
              className={`flex items-start justify-between gap-3 px-4 py-3 transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`}
            >
              <div className="flex items-start gap-2.5">
                <BookMarked size={15} className="text-corporate-hero shrink-0 mt-0.5" />
                <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{SMC_DIAGRAM_DATA[k].title}</div>
              </div>
            </Link>
          ))}
          {!query && (
            <p className={`text-xs px-4 py-4 text-center ${dark ? 'text-white/30' : 'text-gray-400'}`}>
              Start typing to search across every area of the platform.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
