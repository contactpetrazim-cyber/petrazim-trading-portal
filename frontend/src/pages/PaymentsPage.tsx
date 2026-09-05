import { useEffect, useState } from 'react';
import { Check, Ticket, Clock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { HERO_GRADIENT } from '../config/theme';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DurationPass {
  type: string;
  label: string;
  hours: number;
  ngn: number;
  usd: number;
}

interface Tier {
  tier: string;
  label: string;
  duration_hours: number | null;
  individual_ngn: number;
  individual_usd: number | null;
  corporate_ngn_per_seat: number | null;
  corporate_flat_fee_ngn: number | null;
  corporate_min_seats: number | null;
  features: string[];
}

interface AccessStatus {
  has_active_access: boolean;
  tier?: string;
  expires_at?: string;
  granted_via?: string;
}

function ngn(n: number) {
  return `₦${n.toLocaleString('en-NG')}`;
}

/**
 * PaymentsPage — real checkout, adapted from the live training
 * portal's own checkout page (10m.training.petrazim.online/checkout)
 * at your instruction to copy its format, style, and features:
 * duration passes, the Community/Essential/Professional/Executive
 * tier cards (individual + corporate pricing, seat count, running
 * total), and a promo/referral code redemption box. All three call
 * the real backend (GET /payments/pricing/*, POST /payments/checkout,
 * POST /payments/redeem-code) — nothing here is decorative.
 *
 * Only Paystack and IvoryPay are offered as providers — the only two
 * with a real, working client in services/payments.py. Stripe exists
 * as a stub that raises NotImplementedError on every call, so it's
 * left out of this page rather than shipped as a button that fails;
 * this also matches reality, since every tier's real pricing is
 * NGN-only anyway (Community's $2 is the one exception).
 *
 * require_active_access is NOT wired into any route yet — this page
 * makes the payment flow real, but doesn't itself turn the paywall on
 * anywhere. That's a separate, explicit decision, flagged back to you
 * rather than silently flipped on.
 */
export function PaymentsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [passes, setPasses] = useState<DurationPass[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [corporateMode, setCorporateMode] = useState<Record<string, boolean>>({});
  const [code, setCode] = useState('');
  const [codeResult, setCodeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentsMode, setPaymentsMode] = useState<'test' | 'live' | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/payments/pricing/duration-passes`).then((r) => r.json()).then(setPasses).catch(() => {});
    fetch(`${API_URL}/payments/pricing/tiers`).then((r) => r.json()).then(setTiers).catch(() => {});
    if (token) {
      fetch(`${API_URL}/payments/access-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {});
      // Test mode routes checkout through a simulated page instead of a
      // real gateway — see routers/payments.py's GET/PATCH /payments/mode
      // and TestPaymentClient. This banner is the only thing telling a
      // Trader "no real card will be charged here."
      fetch(`${API_URL}/payments/mode`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setPaymentsMode(d.mode)).catch(() => {});
    }
  }, [token]);

  async function checkout(body: Record<string, unknown>, key: string) {
    if (!token) {
      setError('Sign in first to purchase access.');
      return;
    }
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currency: 'NGN', ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Checkout failed');
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setBusy(null);
    }
  }

  async function redeemCode(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Sign in first to redeem a code.');
      return;
    }
    setCodeResult(null);
    try {
      const res = await fetch(`${API_URL}/payments/redeem-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Code not recognized');
      setCodeResult({ ok: true, message: data.message });
      setCode('');
      fetch(`${API_URL}/payments/access-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then(setStatus).catch(() => {});
    } catch (err: any) {
      setCodeResult({ ok: false, message: err.message || 'Code not recognized' });
    }
  }

  const cardCls = `rounded-2xl border p-6 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-[#7c839c]';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';

  return (
    <div>
      <PageHeader title="Select Access and Pay" subtitle="Duration passes for a quick session, or a full tier for ongoing access — same pricing as the training portal." />

      {paymentsMode === 'test' && (
        <div className={`rounded-2xl p-4 mb-6 border ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
            TEST MODE — checkout below opens a simulated payment page. No real gateway or card is involved; you'll be able to choose Success or Failure there to test what happens either way.
          </p>
        </div>
      )}

      {status?.has_active_access && (
        <div className={`rounded-2xl p-4 mb-6 border ${dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-sm font-medium ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            Active — {status.tier} access until {status.expires_at ? new Date(status.expires_at).toLocaleString() : ''}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-500 mb-6">{error}</p>}

      {/* Duration passes */}
      <h2 className={`text-lg font-bold mb-3 font-display ${textCls}`}>Duration Passes</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {passes.map((p) => (
          <div key={p.type} className={cardCls}>
            <div className={`flex items-center gap-1.5 text-xs mb-2 ${mutedCls}`}>
              <Clock size={12} /> {p.hours}h
            </div>
            <div className={`font-semibold mb-1 ${textCls}`}>{p.label}</div>
            <div className="text-xl font-extrabold font-display mb-3" style={{ color: '#005FB8' }}>{ngn(p.ngn)}</div>
            <button
              onClick={() => checkout({ duration_pass_type: p.type }, p.type)}
              disabled={busy === p.type}
              className="w-full text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-60"
              style={{ background: HERO_GRADIENT }}
            >
              {busy === p.type ? 'Starting…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>

      {/* Tiers */}
      <h2 className={`text-lg font-bold mb-3 font-display ${textCls}`}>Access Tiers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {tiers.map((t) => {
          const isCorp = !!corporateMode[t.tier];
          const seats = seatCounts[t.tier] ?? (isCorp ? t.corporate_min_seats ?? 1 : 1);
          // Effective seats for money math and checkout — clamped to the
          // minimum even if the field is mid-edit below it (e.g. Pay
          // clicked before a blur has run); the input itself still shows
          // the raw `seats` value so typing isn't fought.
          const effectiveSeats = isCorp ? Math.max(t.corporate_min_seats ?? 1, seats) : seats;
          const total = isCorp && t.corporate_ngn_per_seat != null && t.corporate_flat_fee_ngn != null
            ? t.corporate_ngn_per_seat * effectiveSeats + t.corporate_flat_fee_ngn
            : t.individual_ngn * effectiveSeats;

          return (
            <div key={t.tier} className={cardCls}>
              <div className="flex items-baseline justify-between mb-1">
                <div className={`font-bold text-lg font-display ${textCls}`}>{t.label}</div>
                {t.duration_hours != null && (
                  <div className={`text-xs ${mutedCls}`}>{Math.round(t.duration_hours / 24)} day access</div>
                )}
              </div>
              <div className="text-2xl font-extrabold font-display mb-3" style={{ color: '#005FB8' }}>
                {t.individual_usd != null && t.individual_ngn === 1000 ? `${ngn(t.individual_ngn)} / $${t.individual_usd}` : ngn(t.individual_ngn)}
                <span className={`text-sm font-normal ml-1 ${mutedCls}`}>/person</span>
              </div>

              <ul className="space-y-1.5 mb-4">
                {t.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${mutedCls}`}>
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#059669' }} /> {f}
                  </li>
                ))}
              </ul>

              {t.corporate_min_seats != null && (
                <div className="mb-3">
                  <label className={`flex items-center gap-2 text-xs mb-2 ${mutedCls}`}>
                    <input
                      type="checkbox"
                      checked={isCorp}
                      onChange={(e) => setCorporateMode((s) => ({ ...s, [t.tier]: e.target.checked }))}
                    />
                    Corporate rate ({ngn(t.corporate_ngn_per_seat!)}/seat + {ngn(t.corporate_flat_fee_ngn!)} — min {t.corporate_min_seats} seats)
                  </label>
                  {isCorp && (
                    <input
                      type="number"
                      min={t.corporate_min_seats}
                      value={seats}
                      // Clamping to the minimum inside onChange (on every
                      // keystroke) fought typing a bigger number: typing
                      // "20" over a min of 10 hit "2" first, got snapped
                      // straight back to "10", then the "0" landed after
                      // it as "100" instead — from the outside this just
                      // looked like "seats can't be edited, always jumps
                      // back to the minimum." Only the raw value is kept
                      // while typing now; the minimum is enforced once,
                      // on blur, so mid-edit keystrokes are never
                      // overridden.
                      onChange={(e) => setSeatCounts((s) => ({ ...s, [t.tier]: Number(e.target.value) || 0 }))}
                      onBlur={() => setSeatCounts((s) => ({ ...s, [t.tier]: Math.max(t.corporate_min_seats!, s[t.tier] ?? t.corporate_min_seats!) }))}
                      className={`w-24 text-sm px-2 py-1.5 rounded-lg border ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-[#dcdce8] text-corporate-text-on-bg'}`}
                    />
                  )}
                </div>
              )}

              <div className={`text-sm mb-3 ${textCls}`}>Total: <span className="font-bold">{ngn(total)}</span></div>

              <button
                onClick={() => checkout({ tier: t.tier, is_corporate: isCorp, seat_count: effectiveSeats }, t.tier)}
                disabled={busy === t.tier}
                className="w-full text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60"
                style={{ background: HERO_GRADIENT }}
              >
                {busy === t.tier ? 'Starting…' : `Pay ${ngn(total)}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Redeem code */}
      <h2 className={`text-lg font-bold mb-3 font-display ${textCls}`}>Have a Code?</h2>
      <form onSubmit={redeemCode} className={`${cardCls} flex items-center gap-3 max-w-md`}>
        <Ticket size={18} className={mutedCls} />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Promo, referral, or corporate seat code"
          className={`flex-1 text-sm outline-none bg-transparent ${textCls}`}
        />
        <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: '#005FB8' }}>
          Apply
        </button>
      </form>
      {codeResult && (
        <p className={`text-sm mt-2 ${codeResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>{codeResult.message}</p>
      )}
    </div>
  );
}
