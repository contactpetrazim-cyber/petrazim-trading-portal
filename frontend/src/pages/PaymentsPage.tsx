import { useEffect, useMemo, useState } from 'react';
import { Check, Ticket, Clock, CreditCard, Banknote, Bitcoin, Minus, Plus, Lightbulb } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { apiFetch } from '../components/AccessExpiredGate';
import { formatApiError } from '../lib/apiError';

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

type Method = 'ngn' | 'usd' | 'crypto';
type Selection =
  | { kind: 'pass'; pass: DurationPass }
  | { kind: 'tier'; tier: Tier; corporate: boolean };

const METHODS: { id: Method; label: string; hint: string; icon: typeof Banknote }[] = [
  { id: 'ngn', label: 'Pay in Naira', hint: 'Card, transfer or USSD', icon: Banknote },
  { id: 'usd', label: 'Pay in US Dollars', hint: 'International card', icon: CreditCard },
  { id: 'crypto', label: 'Pay with crypto', hint: 'USDT, BTC and more', icon: Bitcoin },
];

function ngn(n: number) {
  return `₦${n.toLocaleString('en-NG')}`;
}

function usd(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}

/**
 * PaymentsPage — checkout, restyled to match the Petrazim training
 * portal's own checkout page at your instruction: a payment-method
 * chooser at the top, plan cards you select rather than buy blind, an
 * order summary that follows the selection with a seat stepper, a tip
 * panel, and the promo/code box underneath.
 *
 * The money math and every call behind it are unchanged and still real:
 * GET /payments/pricing/duration-passes, /payments/pricing/tiers,
 * /payments/access-status, /payments/mode, POST /payments/checkout and
 * POST /payments/redeem-code.
 *
 * Method maps to what the backend can actually take: Naira and dollars
 * go through Paystack (currency NGN/USD), crypto through IvoryPay.
 * Stripe is left out — its client raises NotImplementedError on every
 * call, so shipping it as a button would ship a guaranteed failure.
 */
export function PaymentsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();

  const [passes, setPasses] = useState<DurationPass[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [method, setMethod] = useState<Method>('ngn');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [seats, setSeats] = useState(1);
  const [code, setCode] = useState('');
  const [codeResult, setCodeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentsMode, setPaymentsMode] = useState<'test' | 'live' | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/payments/pricing/duration-passes`).then((r) => r.json()).then(setPasses).catch(() => {});
    apiFetch(`${API_URL}/payments/pricing/tiers`).then((r) => r.json()).then(setTiers).catch(() => {});
    if (token) {
      apiFetch(`${API_URL}/payments/access-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {});
      apiFetch(`${API_URL}/payments/mode`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setPaymentsMode(d.mode)).catch(() => {});
    }
  }, [token]);

  const currency: 'NGN' | 'USD' = method === 'usd' ? 'USD' : 'NGN';

  // Only Naira has a price on every plan; a dollar price exists on the
  // Community tier and the duration passes alone, so the dollar view
  // falls back to Naira rather than inventing a conversion.
  function priceOf(sel: Selection, seatCount: number) {
    if (sel.kind === 'pass') {
      return currency === 'USD' && sel.pass.usd
        ? { amount: sel.pass.usd, text: usd(sel.pass.usd) }
        : { amount: sel.pass.ngn, text: ngn(sel.pass.ngn) };
    }
    const t = sel.tier;
    if (sel.corporate && t.corporate_ngn_per_seat != null && t.corporate_flat_fee_ngn != null) {
      const total = t.corporate_ngn_per_seat * seatCount + t.corporate_flat_fee_ngn;
      return { amount: total, text: ngn(total) };
    }
    if (currency === 'USD' && t.individual_usd != null) {
      return { amount: t.individual_usd * seatCount, text: usd(t.individual_usd * seatCount) };
    }
    return { amount: t.individual_ngn * seatCount, text: ngn(t.individual_ngn * seatCount) };
  }

  const minSeats =
    selection?.kind === 'tier' && selection.corporate ? selection.tier.corporate_min_seats ?? 1 : 1;
  const effectiveSeats = Math.max(minSeats, seats);
  const summary = useMemo(
    () => (selection ? priceOf(selection, effectiveSeats) : null),
    [selection, effectiveSeats, method],
  );

  function select(sel: Selection) {
    setSelection(sel);
    setError(null);
    setSeats(sel.kind === 'tier' && sel.corporate ? sel.tier.corporate_min_seats ?? 1 : 1);
  }

  const isSelected = (sel: Selection) =>
    selection != null &&
    ((sel.kind === 'pass' && selection.kind === 'pass' && selection.pass.type === sel.pass.type) ||
      (sel.kind === 'tier' &&
        selection.kind === 'tier' &&
        selection.tier.tier === sel.tier.tier &&
        selection.corporate === sel.corporate));

  async function pay() {
    if (!selection) return;
    if (!token) {
      setError('Sign in first to purchase access.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        currency,
        provider_override: method === 'crypto' ? 'ivorypay' : 'paystack',
      };
      if (selection.kind === 'pass') body.duration_pass_type = selection.pass.type;
      else {
        body.tier = selection.tier.tier;
        body.is_corporate = selection.corporate;
        body.seat_count = effectiveSeats;
      }
      const res = await apiFetch(`${API_URL}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.detail, 'Checkout failed'));
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setBusy(false);
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
      const res = await apiFetch(`${API_URL}/payments/redeem-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.detail, 'Code not recognized'));
      setCodeResult({ ok: true, message: data.message });
      setCode('');
      apiFetch(`${API_URL}/payments/access-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then(setStatus).catch(() => {});
    } catch (err: any) {
      setCodeResult({ ok: false, message: err.message || 'Code not recognized' });
    }
  }

  const card = `rounded-2xl border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`;
  const muted = dark ? 'text-white/50' : 'text-[#7c839c]';
  const text = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const optionCls = (active: boolean) =>
    `w-full text-left rounded-xl border-2 p-4 transition ${
      active
        ? 'border-corporate-accent ' + (dark ? 'bg-corporate-accent/10' : 'bg-corporate-accent/5')
        : dark
        ? 'border-corporate-border-dark hover:border-corporate-accent/50'
        : 'border-[#e4e4ef] hover:border-corporate-accent/50'
    }`;

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className={`text-3xl md:text-4xl font-extrabold font-display mb-2 ${text}`}>
          Choose your trading access
        </h1>
        <p className={`text-sm md:text-base max-w-2xl ${muted}`}>
          Pick a duration pass for a single session, or a tier for ongoing access to the workspace, bots,
          analytics, tools and Learn. Same pricing as the training portal.
        </p>
      </div>

      {paymentsMode === 'test' && (
        <div className={`rounded-2xl p-4 mb-6 border ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
            Test mode — checkout opens a simulated payment page. No card is charged; you can choose success
            or failure there to see what happens either way.
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

      {/* Payment method */}
      <h2 className={`text-lg font-bold font-display mb-3 ${text}`}>1. How would you like to pay?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = method === m.id;
          return (
            <button key={m.id} onClick={() => setMethod(m.id)} className={optionCls(active)}>
              <div className="flex items-center gap-3">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    active ? 'bg-corporate-accent text-white' : dark ? 'bg-white/5 text-white/60' : 'bg-[#eef2fa] text-corporate-accent'
                  }`}
                >
                  <Icon size={17} />
                </span>
                <span>
                  <span className={`block text-sm font-semibold ${text}`}>{m.label}</span>
                  <span className={`block text-xs ${muted}`}>{m.hint}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
          {/* Duration passes */}
          <h2 className={`text-lg font-bold font-display mb-3 ${text}`}>2. Duration passes</h2>
          <div className={`${card} p-5 mb-8`}>
            <p className={`text-sm mb-4 ${muted}`}>Short, timed access — ideal for a single trading session.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {passes.map((p) => (
                <button key={p.type} onClick={() => select({ kind: 'pass', pass: p })} className={optionCls(isSelected({ kind: 'pass', pass: p }))}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${text}`}>{p.label}</span>
                    <span className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-full ${dark ? 'bg-white/5 text-white/60' : 'bg-[#eef2fa] text-corporate-accent'}`}>
                      <Clock size={11} /> {p.hours}h
                    </span>
                  </div>
                  <div className="text-lg font-extrabold font-display text-corporate-accent">
                    {method === 'usd' && p.usd ? usd(p.usd) : ngn(p.ngn)}
                  </div>
                </button>
              ))}
              {passes.length === 0 && <p className={`text-sm ${muted}`}>Loading passes…</p>}
            </div>
          </div>

          {/* Tiers */}
          <h2 className={`text-lg font-bold font-display mb-3 ${text}`}>3. Access tiers</h2>
          <div className="space-y-4">
            {tiers.map((t) => (
              <div key={t.tier} className={`${card} p-5`}>
                <div className="flex items-baseline justify-between mb-3 gap-3">
                  <h3 className={`font-bold text-lg font-display ${text}`}>{t.label}</h3>
                  {t.duration_hours != null && (
                    <span className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${dark ? 'bg-white/5 text-white/60' : 'bg-[#eef2fa] text-corporate-accent'}`}>
                      {Math.round(t.duration_hours / 24)} day access
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5 mb-4">
                  {t.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${muted}`}>
                      <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#059669' }} /> {f}
                    </li>
                  ))}
                </ul>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => select({ kind: 'tier', tier: t, corporate: false })} className={optionCls(isSelected({ kind: 'tier', tier: t, corporate: false }))}>
                    <span className={`block text-xs font-semibold uppercase tracking-wide mb-1 ${muted}`}>Individual</span>
                    <span className="block text-lg font-extrabold font-display text-corporate-accent">
                      {method === 'usd' && t.individual_usd != null ? usd(t.individual_usd) : ngn(t.individual_ngn)}
                      <span className={`text-xs font-normal ml-1 ${muted}`}>/person</span>
                    </span>
                  </button>

                  {t.corporate_min_seats != null && t.corporate_ngn_per_seat != null && (
                    <button onClick={() => select({ kind: 'tier', tier: t, corporate: true })} className={optionCls(isSelected({ kind: 'tier', tier: t, corporate: true }))}>
                      <span className={`block text-xs font-semibold uppercase tracking-wide mb-1 ${muted}`}>Corporate</span>
                      <span className="block text-lg font-extrabold font-display text-corporate-accent">
                        {ngn(t.corporate_ngn_per_seat)}
                        <span className={`text-xs font-normal ml-1 ${muted}`}>/seat</span>
                      </span>
                      <span className={`block text-[11px] mt-1 ${muted}`}>
                        + {ngn(t.corporate_flat_fee_ngn ?? 0)} setup — min {t.corporate_min_seats} seats
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {tiers.length === 0 && <p className={`text-sm ${muted}`}>Loading tiers…</p>}
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className={`${card} p-5`}>
            <h2 className={`text-base font-bold font-display mb-4 ${text}`}>Your order</h2>

            {!selection && <p className={`text-sm ${muted}`}>Select a duration pass or a tier to continue.</p>}

            {selection && (
              <>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className={`text-sm font-semibold ${text}`}>
                      {selection.kind === 'pass' ? selection.pass.label : selection.tier.label}
                    </p>
                    <p className={`text-xs ${muted}`}>
                      {selection.kind === 'pass'
                        ? `${selection.pass.hours} hour access`
                        : selection.corporate
                        ? 'Corporate rate'
                        : 'Individual rate'}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${text}`}>{summary?.text}</p>
                </div>

                {selection.kind === 'tier' && (
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-sm ${muted}`}>Seats</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSeats((s) => Math.max(minSeats, s - 1))}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center ${dark ? 'border-corporate-border-dark text-white' : 'border-[#dcdce8] text-corporate-text-on-bg'}`}
                        aria-label="Fewer seats"
                      >
                        <Minus size={14} />
                      </button>
                      <span className={`w-8 text-center text-sm font-semibold ${text}`}>{effectiveSeats}</span>
                      <button
                        onClick={() => setSeats((s) => Math.max(minSeats, s) + 1)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center ${dark ? 'border-corporate-border-dark text-white' : 'border-[#dcdce8] text-corporate-text-on-bg'}`}
                        aria-label="More seats"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <div className={`border-t pt-3 mb-4 flex items-baseline justify-between ${dark ? 'border-corporate-border-dark' : 'border-[#e4e4ef]'}`}>
                  <span className={`text-sm ${muted}`}>Total</span>
                  <span className="text-2xl font-extrabold font-display text-corporate-accent">{summary?.text}</span>
                </div>

                <button
                  onClick={pay}
                  disabled={busy}
                  className="w-full bg-corporate-accent hover:bg-corporate-accent-hover text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-60 transition"
                >
                  {busy ? 'Starting…' : `Pay ${summary?.text}`}
                </button>
                <p className={`text-[11px] mt-2 text-center ${muted}`}>
                  {method === 'crypto' ? 'Secured by IvoryPay' : 'Secured by Paystack'} — you'll be returned here
                  once payment completes.
                </p>
              </>
            )}

            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
          </div>

          <div className={`rounded-2xl p-4 border ${dark ? 'bg-corporate-accent/10 border-corporate-accent/30' : 'bg-[#eef4fc] border-[#cddffa]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb size={15} className="text-corporate-accent" />
              <p className={`text-sm font-semibold ${text}`}>Trading tip</p>
            </div>
            <p className={`text-xs ${muted}`}>
              Longer tiers unlock the journal, bot approvals and facilitator sessions — the parts that turn
              practice into a repeatable edge.
            </p>
          </div>

          <form onSubmit={redeemCode} className={`${card} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Ticket size={15} className="text-corporate-accent" />
              <p className={`text-sm font-semibold ${text}`}>Promo or access code</p>
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                className={`flex-1 text-sm px-3 py-2 rounded-lg border outline-none focus:border-corporate-accent ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-[#dcdce8] text-corporate-text-on-bg'}`}
              />
              <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-lg text-white bg-corporate-accent hover:bg-corporate-accent-hover">
                Apply
              </button>
            </div>
            {codeResult && (
              <p className={`text-xs mt-2 ${codeResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>{codeResult.message}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
