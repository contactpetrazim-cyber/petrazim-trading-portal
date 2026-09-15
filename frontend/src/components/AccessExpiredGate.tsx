import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';
import { useThemeStore } from '../hooks/useTheme';
import { handleUnauthorized } from '../lib/authGuard';
import { isNetworkFailure, resolveFailoverUrl, tryFailoverToVm } from '../lib/backendFailover';
import { triggerFeesOwed } from './TradingFeeGate';

/**
 * AccessExpiredGate — matches the exact card design confirmed working
 * in the Academy build, adapted for the Trading Portal: clock icon,
 * bold two-line heading, closure timestamp + reassurance line, a
 * mint "progress preserved" box with REAL numbers (stages/tracks/XP,
 * sourced from require_active_access()'s payload, not placeholder
 * text), a full-width primary button, and the promo-code hint.
 *
 * Wraps the whole app once (mounted in App.tsx, inside BrowserRouter
 * so its "Renew access" button can navigate). Any apiFetch() call
 * anywhere that hits require_active_access() and gets blocked (402)
 * triggers this automatically — one place, can't be missed by a page
 * that forgot to handle it individually.
 *
 * Was previously exported but never actually mounted anywhere in the
 * app tree — every 402 called triggerAccessExpired(), but the
 * globalSetter it calls was always null since this component's own
 * effect never ran, so the card silently never appeared. Every page
 * fell back to its own (usually much weaker) local error handling
 * instead — the real cause behind both LearnPage's generic "Could not
 * load your Learn progress right now" and TradeAnalytics' permanent
 * "Loading trade analytics…" with no error path at all.
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
  const navigate = useNavigate();

  useEffect(() => {
    globalSetter = setExpired;
    return () => { globalSetter = null; };
  }, []);

  const handleRenew = () => {
    setExpired(null);
    navigate('/payments');
  };

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
              onClick={handleRenew}
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

export async function apiFetch(
  input: RequestInfo,
  init?: RequestInit & { timeoutMs?: number },
  /** Internal — set on the one automatic retry after a failover, so a
   * VM that's ALSO down fails straight through instead of retrying
   * forever. Never pass this from a call site. */
  _failoverRetried = false,
): Promise<Response> {
  const controller = new AbortController();
  // Default 20s, but a caller can ask for longer — order placement does
  // (60s): a free-tier backend waking from sleep regularly needs more
  // than 20s for the FIRST request, and an aborted request surfaces to
  // the trader as a bare "failed to fetch" on the Place Order button.
  const timeout = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 20_000);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });

  // Dual-failover — see lib/backendFailover.ts. Every call site
  // already builds `input` as `${API_URL}/...`; this rewrites it to
  // whichever backend is currently active (a no-op unless a previous
  // request has already failed over this session).
  const url = typeof input === 'string' ? resolveFailoverUrl(input) : input;

  let res: Response;
  try {
    // No `credentials: 'include'` here, deliberately, and this is the
    // real root cause of the reported "failed to fetch": the backend
    // answers cross-origin requests with `Access-Control-Allow-Origin: *`,
    // and every browser refuses a credentialed request against a
    // wildcard origin — so EVERY call from the preview and from
    // trade.petrazim.online was rejected before it left the browser,
    // no matter how healthy the server was. This app authenticates with
    // a Bearer token, never a cookie, so cookies were never needed.
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // A real connection failure against the currently-active backend
    // (not an HTTP error status — that's still a normal, non-throwing
    // Response, handled below) — switch every future request to the
    // VM and retry this exact one immediately, rather than surfacing
    // "failed to fetch" for something the VM could have served.
    if (!_failoverRetried && typeof input === 'string' && isNetworkFailure(err) && tryFailoverToVm()) {
      return apiFetch(input, init, true);
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (res.status === 401) {
    // Verified against /auth/me first — see lib/authGuard.ts for why a
    // bare 401 must not end the session.
    void handleUnauthorized();
  }
  if (res.status === 402) {
    const body = await res.clone().json().catch(() => null);
    if (body?.detail?.error === 'access_expired') {
      triggerAccessExpired(body.detail);
    }
    if (body?.detail?.error === 'trading_fees_owed') {
      triggerFeesOwed(body.detail);
    }
  }
  return res;
}

