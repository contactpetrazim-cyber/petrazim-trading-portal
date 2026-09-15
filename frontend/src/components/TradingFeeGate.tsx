import { useEffect, useState } from 'react';
import { Wallet, CreditCard, Coins, RefreshCw } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';
import { useThemeStore } from '../hooks/useTheme';
import { feesApi } from '../services/api';
import type { FeeCheckoutProvider } from '../types';
import { rememberPendingFeeCheckout, readPendingFeeCheckout, clearPendingFeeCheckout } from '../lib/pendingFeeCheckout';

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
  const [busy, setBusy] = useState<FeeCheckoutProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState(readPendingFeeCheckout());
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  useEffect(() => {
    globalSetter = setOwed;
    return () => { globalSetter = null; };
  }, []);

  async function handlePayNow(provider: FeeCheckoutProvider) {
    setBusy(provider);
    setError(null);
    try {
      const session = await feesApi.checkout(provider);
      rememberPendingFeeCheckout(session.reference, session.provider);
      window.location.href = session.checkout_url;
    } catch (err: any) {
      setError(err?.response?.data?.detail?.detail || err?.response?.data?.detail || 'Could not start checkout — try again in a moment.');
      setBusy(null);
    }
  }

  // The trader came back after paying (or gave up) — re-check that
  // pending checkout against the real gateway. Works for both
  // providers; it's the ONLY confirmation IvoryPay has (no webhook —
  // see routers/fees.py's own verify_fee_checkout docstring), and a
  // useful backup for Paystack too if its webhook secret isn't
  // configured or hasn't landed yet.
  async function handleVerify() {
    if (!pending) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await feesApi.verifyCheckout(pending.reference);
      if (result.status === 'succeeded') {
        clearPendingFeeCheckout();
        setPending(null);
        const status = await feesApi.gateStatus();
        if (!status.gated) setOwed(null);
      } else if (result.status === 'failed') {
        clearPendingFeeCheckout();
        setPending(null);
        setError('That payment did not succeed — start a new one below.');
      } else {
        setError("Not confirmed yet — if you just paid, this can take a moment. Try again shortly.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not verify that payment right now — try again in a moment.');
    } finally {
      setVerifying(false);
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

            {pending && (
              <div className={`rounded-xl p-3 mb-4 text-left border ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs ${dark ? 'text-white/60' : 'text-gray-600'}`}>
                  Already paid via {pending.provider === 'ivorypay' ? 'IvoryPay' : 'Paystack'}?
                </p>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50"
                >
                  <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} /> {verifying ? 'Checking…' : 'Verify my payment'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => handlePayNow('paystack')}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.01] disabled:opacity-60"
                style={{ background: 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)' }}
              >
                <CreditCard size={17} /> {busy === 'paystack' ? 'Starting checkout…' : 'Pay now with Paystack'}
              </button>
              <button
                onClick={() => handlePayNow('ivorypay')}
                disabled={busy !== null}
                className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl border transition-colors disabled:opacity-60 ${
                  dark ? 'border-white/15 text-white hover:bg-white/5' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Coins size={17} /> {busy === 'ivorypay' ? 'Starting checkout…' : 'Pay with crypto (IvoryPay)'}
              </button>
            </div>

            <p className={`text-xs mt-4 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              Managing or closing any trade you already have open is never affected — only new trades are paused.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
