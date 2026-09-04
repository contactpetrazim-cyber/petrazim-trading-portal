import { useEffect, useState } from 'react';
import { Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';

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

  useEffect(() => {
    globalSetter = setExpired;
    return () => { globalSetter = null; };
  }, []);

  return (
    <>
      {children}
      {expired && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <CardLogoBand />
            <div className="w-16 h-16 rounded-full bg-[#EAEAF4] flex items-center justify-center mx-auto mb-5">
              <Clock size={28} style={{ color: '#0284C7' }} />
            </div>

            <h2 className="font-extrabold text-2xl text-[#141a33] mb-3 leading-tight">{expired.title}</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{expired.message}</p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-[#141a33]">{expired.progress_label}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{expired.progress_detail}</p>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.01]"
              style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
            >
              <RefreshCw size={17} /> Renew access
            </button>

            <p className="text-xs text-gray-400 mt-4">{expired.promo_hint}</p>
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
