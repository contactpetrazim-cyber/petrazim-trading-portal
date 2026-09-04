import { useState } from 'react';
import { useAuth } from './useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * useQuickPrice — the one real "what's it trading at right now" fetch
 * (Binance public ticker, CoinGecko fallback — see
 * routers/manual_trading.py's quick_price), shared by the small quick-
 * price button in ChartPanel's toolbar and TradeSpecsPanel's floating-
 * P&L display, so there's exactly one fetch implementation instead of
 * two drifting copies. Moved out of TradeSpecsPanel itself by direct
 * request — the panel's own "Use current price" section was "taking
 * too much space"; the button now lives up in the chart toolbar next
 * to the candle-colors button instead.
 */
export function useQuickPrice(symbol: string) {
  const { token } = useAuth();
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(opts?: { silent?: boolean }): Promise<number | null> {
    if (!opts?.silent) {
      setBusy(true);
      setError(null);
    }
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiFetch(`${API_URL}/manual-trading/quick-price/${encodeURIComponent(symbol)}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No live price for this symbol.');
      setPrice(data.price);
      return data.price as number;
    } catch (e: any) {
      if (!opts?.silent) setError(e.message || 'Price lookup failed.');
      return null;
    } finally {
      if (!opts?.silent) setBusy(false);
    }
  }

  return { price, error, busy, refresh };
}
