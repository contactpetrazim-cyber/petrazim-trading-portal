import { useEffect, useState } from 'react';
import { Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';
import { useThemeStore } from '../hooks/useTheme';

/**
 * AccessExpiredGate — matches the exact card design confirmed working
 * in the Academy build, adapted for the Trading Portal: clock icon,
 * bold two-line heading, closure timestamp + reassurance line, a
 * mint "progress preserved" box with REAL numbers (stages/tracks/XP,
 * sourced from require_active_access()'s payload, not placeholder
 * text), a full-width primary button, and the promo-code hint.
 *
 * Wraps the whole app once. Any apiFetch() call anywhere that hits
 * require_active_access() and gets blocked (402) triggers this
 * automatically — one place, can't be missed by a page that forgot
 * to handle it individually.
 */

interface ExpiredDetail {
  title: string;
  message: string;
  progress_label: string;
  progress_detail: string;
  promo_hint: string;
}

let globalSetter: ((detail: ExpiredDetail | null) => void) | null = null;

export function triggerAccessExpired(detail: ExpiredDetail) {
  globalSetter?.(detail);
}

export function AccessExpiredGate({ children }: { children: React.ReactNode }) {
  const [expired, setExpired] = useState<ExpiredDetail | null>(null);
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  useEffect(() => {
    globalSetter = setExpired;
    return () => { globalSetter = null; };
  }, []);

  return (
    <>
      {children}
      {expired && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className={`rounded-3xl p-8 max-w-md w-full text-center shadow-2xl ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
            <CardLogoBand dark={dark} />
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
              <Clock size={28} style={{ color: '#0284C7' }} />
            </div>

            <h2 className={`font-extrabold text-2xl mb-3 leading-tight ${dark ? 'text-white' : 'text-[#141a33]'}`}>{expired.title}</h2>
            <p className={`text-sm mb-6 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>{expired.message}</p>

            <div className={`rounded-2xl p-4 text-left mb-6 border ${dark ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck size={16} className={dark ? 'text-emerald-400' : 'text-emerald-600'} />
                <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-[#141a33]'}`}>{expired.progress_label}</span>
              </div>
              <p className={`text-xs leading-relaxed ${dark ? 'text-white/50' : 'text-gray-600'}`}>{expired.progress_detail}</p>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.01]"
              style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
            >
              <RefreshCw size={17} /> Renew access
            </button>

            <p className={`text-xs mt-4 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{expired.promo_hint}</p>
          </div>
        </div>
      )}
    </>
  );
}

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 402) {
    const body = await res.clone().json().catch(() => null);
    if (body?.detail?.error === 'access_expired') {
      triggerAccessExpired(body.detail);
    }
  }
  return res;
}
