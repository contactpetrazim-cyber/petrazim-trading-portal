import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * ToastStack — a small, dependency-free celebration/notification
 * layer. The trading portal had no toast primitive of any kind before
 * this (checked: no sonner/react-hot-toast, no in-house Toast
 * component either) — every "encourage learning" moment (a badge
 * unlocking, a level-up, a certificate being issued) previously had no
 * way to surface itself except a plain inline text line a trainee
 * might not even be looking at. Deliberately hand-rolled with the same
 * Tailwind-card house style as every other component here rather than
 * pulling in an external toast library this codebase doesn't already
 * use anywhere.
 */
export type ToastVariant = 'badge' | 'level' | 'streak' | 'certificate' | 'info';

export interface ToastInput {
  icon: string;         // emoji, matches the badge/award icon convention used everywhere else
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: number;
}

const VARIANT_RING: Record<ToastVariant, string> = {
  badge: 'ring-amber-400/60',
  level: 'ring-corporate-hero/60',
  streak: 'ring-orange-400/60',
  certificate: 'ring-emerald-400/60',
  info: 'ring-white/10',
};

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // Never throws — a page rendered outside the provider (shouldn't
  // happen since it wraps the whole app in App.tsx, but defensive
  // rather than crashing the page over a missed celebration) just
  // silently drops the toast.
  return ctx ?? (() => {});
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 6000);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl bg-[#0f1424] border border-white/10 ring-2 ${VARIANT_RING[t.variant ?? 'info']} shadow-[0_12px_40px_rgba(0,0,0,0.35)] p-4 animate-[toast-in_0.25s_ease-out]`}
          >
            <span className="text-2xl leading-none shrink-0">{t.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t.title}</div>
              {t.description && <div className="text-xs text-white/60 mt-0.5">{t.description}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-white/30 hover:text-white/70"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
