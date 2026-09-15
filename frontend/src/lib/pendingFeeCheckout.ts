/**
 * Remembers the last fee-settlement checkout this browser started,
 * across the full-page redirect to Paystack/IvoryPay and back — the
 * only way to offer "verify my payment" on return, since neither
 * client sends this app a callback URL to redirect back to
 * automatically. IvoryPay in particular has no webhook wired here at
 * all (see backend/app/routers/fees.py's own verify_fee_checkout
 * docstring for why — no documented signature scheme to verify
 * against), so this is its ONLY real confirmation path, not just a
 * nice-to-have for Paystack. Shared by TradingFeeGate.tsx (the
 * blocking paywall card) and ConnectExchangePage.tsx (the Performance
 * Fees card's own "Pay now" flow) — one checkout can only be pending
 * from one place at a time, so one shared key is correct, not a bug.
 */

const PENDING_CHECKOUT_KEY = 'petrazim_pending_fee_checkout';

export interface PendingFeeCheckout {
  reference: string;
  provider: string;
}

export function rememberPendingFeeCheckout(reference: string, provider: string): void {
  try {
    localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ reference, provider }));
  } catch {
    /* private window / storage disabled — the trader can still pay, they just won't see the "verify" fallback later */
  }
}

export function readPendingFeeCheckout(): PendingFeeCheckout | null {
  try {
    const raw = localStorage.getItem(PENDING_CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingFeeCheckout(): void {
  try {
    localStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}
