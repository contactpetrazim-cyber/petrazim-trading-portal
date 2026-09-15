import { useEffect, useState } from 'react';
import { Wallet, CreditCard } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';
import { useThemeStore } from '../hooks/useTheme';
import { feesApi } from '../services/api';

/**
 * TradingFeeGate — the Paystack payment-gate card for the performance-
 * fee system, by direct request: "introduce a Paystack payment gate
 * that pays for previous day fees before access to a new day... checks
 * payment and grants access to bot trading or manual trading or
 * automated trades." Same "important moment, full-screen blocking
 * card" anatomy as AccessExpiredGate — logo band, icon, heading,
 * message, a full-width primary action — but a genuinely separate gate
 * from that one: a trader can owe performance fees independently of
 * whether their Academy access is active, so this listens for its own
 * distinct 402 error code ("trading_fees_owed") instead of reusing
 * access_expired.
 *
 * Mounted once in App.tsx, same place AccessExpiredGate is — any
 * request anywhere that hits core/fee_gate.py's gate and gets blocked
 * triggers this automatically, whether that request came through the
 * axios `api` client (services/api.ts) or the plain apiFetch()
 * (AccessExpiredGate.tsx) — both call triggerFeesOwed on a 402 with
 * this error code.
 */

interface FeesOwedDetail {
  title: string;
  message: string;
  owed_amount: number;
  currency: string;
}

let globalSetter: ((detail: FeesOwedDetail | null) => void) | null = null;

export function triggerFeesOwed(detail: FeesOwedDetail) {
  globalSetter?.(detail);
}

export function TradingFeeGate({ children }: { children: React.ReactNode }) {
  const [owed, setOwed] = useState<FeesOwedDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  useEffect(() => {
    globalSetter = setOwed;
    return () => { globalSetter = null; };
  }, []);

  async function handlePayNow() {
    setBusy(true);
    setError(null);
    try {
      const session = await feesApi.checkout();
      window.location.href = session.checkout_url;
    } catch (err: any) {
      setError(err?.response?.data?.detail?.detail || err?.response?.data?.detail || 'Could not start checkout — try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      {owed && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className={`rounded-3xl p-8 max-w-md w-full text-center shadow-2xl ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
            <CardLogoBand dark={dark} />
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${dark ? 'bg-white/10' : 'bg-[#EAEAF4]'}`}>
              <Wallet size={28} style={{ color: '#D97706' }} />
            </div>

            <h2 className={`font-extrabold text-2xl mb-3 leading-tight ${dark ? 'text-white' : 'text-[#141a33]'}`}>{owed.title}</h2>
            <p className={`text-sm mb-6 leading-relaxed ${dark ? 'text-white/60' : 'text-gray-500'}`}>{owed.message}</p>

            <div className={`rounded-2xl p-4 text-center mb-6 border ${dark ? 'bg-amber-400/10 border-amber-400/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`text-xs font-semibold mb-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Amount owed</div>
              <div className={`text-2xl font-extrabold ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                {owed.currency} {owed.owed_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 mb-4 text-left">{error}</div>}

            <button
              onClick={handlePayNow}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.01] disabled:opacity-60"
              style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
            >
              <CreditCard size={17} /> {busy ? 'Starting checkout…' : 'Pay now with Paystack'}
            </button>

            <p className={`text-xs mt-4 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              Managing or closing any trade you already have open is never affected — only new trades are paused.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
