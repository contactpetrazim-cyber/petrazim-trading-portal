import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { FEATURE_AREAS, searchFeatures } from '../config/featureRegistry';

/**
 * GlobalSearchModal — searches across ALL 7 feature areas at once
 * (Learn/Practise/Trade/Insights/Tools/Community/Explore), reading
 * from the same FEATURE_REGISTRY the nav uses. Opens from the search
 * icon in TopNav, or Cmd/Ctrl+K.
 */
export function GlobalSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const results = searchFeatures(query);
  const areaLabel = (id: string) => FEATURE_AREAS.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-corporate-bg">
          <Search size={18} className="text-corporate-hero/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Learn, Practise, Trade, Insights, Tools, Community, Explore…"
            className="flex-1 outline-none text-sm text-corporate-text-on-bg placeholder:text-gray-400"
          />
          <button onClick={onClose} aria-label="Close search">
            <X size={18} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query && results.length === 0 && (
            <p className="text-sm text-gray-500 px-4 py-6 text-center">No matches for "{query}"</p>
          )}
          {results.map((r) => (
            <Link
              key={r.id}
              to={r.route}
              onClick={onClose}
              className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-corporate-bg transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-corporate-text-on-bg">{r.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>
              </div>
              <span className="text-xs font-medium text-corporate-accent shrink-0 pt-0.5">
                {areaLabel(r.area)}
              </span>
            </Link>
          ))}
          {!query && (
            <p className="text-xs text-gray-400 px-4 py-4 text-center">
              Start typing to search across every area of the platform.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
