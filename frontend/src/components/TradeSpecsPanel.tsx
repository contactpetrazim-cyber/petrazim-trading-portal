import { useEffect, useState } from 'react';
import { RefreshCw, Zap, X, Check } from 'lucide-react';
import { FoldedCard } from './FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface OpenPosition {
  trade_id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: string;
  entry_price: number | null;
  stop_loss: number;
  take_profit: number | null;
  take_profit_2?: number | null;
  take_profit_3?: number | null;
  lot_size: number;
}

interface TradeSpecsPanelProps {
  /** Exchange-format symbol, e.g. "BTCUSDT" — same value passed as ChartPanel's tradeSymbol. */
  symbol: string;
  dark?: boolean;
  /** If the hosting page has its own order form, wire this to fill its entry price field directly. */
  onQuickFill?: (price: number) => void;
}

/**
 * TradeSpecsPanel — the real, honest answer to "trigger a trade from
 * the chart" / "move or edit SL and TP from the charts" / "show
 * current trade position and P&L", given TradingView's free widget
 * has no API to draw on or read from (createOrderLine/
 * createPositionLine were moved to TradingView's paid Trading
 * Platform product — confirmed against their own docs, not a bug on
 * this app's side). This sits right next to the chart instead of
 * inside it: your open position(s) on this symbol, a real "use
 * current price" quick-fill, and real Modify SL/TP + Close actions —
 * folded by default, per direct request.
 */
export function TradeSpecsPanel({ symbol, dark = false, onQuickFill }: TradeSpecsPanelProps) {
  const { token } = useAuth();
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickPrice, setQuickPrice] = useState<number | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSl, setEditSl] = useState('');
  const [editTp, setEditTp] = useState('');
  const [editTp2, setEditTp2] = useState('');
  const [editTp3, setEditTp3] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  async function loadPositions() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/trades/?status=active&symbol=${encodeURIComponent(symbol)}`, { headers });
      if (res.ok) setPositions(await res.json());
    } finally {
      setLoading(false);
    }
  }

  // Silent refresh — updates the reference price used for each open
  // position's live-ish floating P&L, without touching any order
  // form (only the explicit button below does that). Only polls while
  // there's actually a position open, since it's otherwise unused.
  async function refreshPriceSilently() {
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/quick-price/${encodeURIComponent(symbol)}`, { headers });
      if (res.ok) setQuickPrice((await res.json()).price);
    } catch {
      /* silent — the button path below surfaces the real error message */
    }
  }

  useEffect(() => {
    loadPositions();
    const t = setInterval(loadPositions, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, token]);

  useEffect(() => {
    if (positions.length === 0) return;
    refreshPriceSilently();
    const t = setInterval(refreshPriceSilently, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, positions.length]);

  async function fetchQuickPrice() {
    setQuickBusy(true);
    setQuickError(null);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/quick-price/${encodeURIComponent(symbol)}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No live price for this symbol.');
      setQuickPrice(data.price);
      onQuickFill?.(data.price);
    } catch (e: any) {
      setQuickError(e.message || 'Price lookup failed.');
    } finally {
      setQuickBusy(false);
    }
  }

  function floatingPnl(p: OpenPosition): number | null {
    if (quickPrice == null || p.entry_price == null) return null;
    const sign = p.direction === 'long' ? 1 : -1;
    return sign * (quickPrice - p.entry_price) * p.lot_size;
  }

  function startEdit(p: OpenPosition) {
    setEditingId(p.trade_id);
    setEditSl(String(p.stop_loss ?? ''));
    setEditTp(p.take_profit != null ? String(p.take_profit) : '');
    setEditTp2(p.take_profit_2 != null ? String(p.take_profit_2) : '');
    setEditTp3(p.take_profit_3 != null ? String(p.take_profit_3) : '');
  }

  async function saveEdit(tradeId: string) {
    setSavingEdit(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/${tradeId}/modify-targets`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          stop_loss: editSl ? Number(editSl) : null,
          take_profit: editTp ? Number(editTp) : null,
          take_profit_2: editTp2 ? Number(editTp2) : null,
          take_profit_3: editTp3 ? Number(editTp3) : null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadPositions();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function closePosition(tradeId: string) {
    if (!closePrice) return;
    setCloseBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/${tradeId}/partial-close`, {
        method: 'POST', headers,
        body: JSON.stringify({ percent: 100, exit_price: Number(closePrice) }),
      });
      if (res.ok) {
        setClosingId(null);
        setClosePrice('');
        await loadPositions();
      }
    } finally {
      setCloseBusy(false);
    }
  }

  const inputCls = `rounded-md px-2 py-1 text-xs outline-none border w-20 ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'}`;
  const muted = dark ? 'text-white/40' : 'text-gray-400';

  return (
    <FoldedCard title="Trade Specs" summary={`${positions.length} open on ${symbol}`} icon={<Zap size={16} />} dark={dark}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button
          onClick={fetchQuickPrice} disabled={quickBusy}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white bg-corporate-hero disabled:opacity-50"
        >
          <Zap size={12} /> {quickBusy ? 'Fetching…' : 'Use current price'}
        </button>
        <div className="flex items-center gap-2">
          {quickPrice != null && <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{quickPrice}</span>}
          <button onClick={loadPositions} aria-label="Refresh positions" className={muted}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {quickError && <p className="text-xs text-amber-500 mb-2">{quickError}</p>}

      {positions.length === 0 ? (
        <p className={`text-xs ${muted}`}>No open positions on {symbol} right now.</p>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={p.trade_id} className={`rounded-lg p-2.5 border text-xs ${dark ? 'border-corporate-border-dark bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-bold ${p.direction === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{p.direction.toUpperCase()}</span>
                <span className={dark ? 'text-white/50' : 'text-gray-500'}>{p.lot_size} lots @ {p.entry_price ?? '—'}</span>
              </div>
              {(() => {
                const pnl = floatingPnl(p);
                return pnl != null ? (
                  <div className={`text-right font-semibold mb-1.5 ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} floating P&L @ {quickPrice}
                  </div>
                ) : null;
              })()}

              {editingId === p.trade_id ? (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    <label className="flex flex-col gap-0.5"><span className={muted}>SL</span><input className={inputCls} value={editSl} onChange={(e) => setEditSl(e.target.value)} /></label>
                    <label className="flex flex-col gap-0.5"><span className={muted}>TP1</span><input className={inputCls} value={editTp} onChange={(e) => setEditTp(e.target.value)} /></label>
                    <label className="flex flex-col gap-0.5"><span className={muted}>TP2</span><input className={inputCls} value={editTp2} onChange={(e) => setEditTp2(e.target.value)} /></label>
                    <label className="flex flex-col gap-0.5"><span className={muted}>TP3</span><input className={inputCls} value={editTp3} onChange={(e) => setEditTp3(e.target.value)} /></label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(p.trade_id)} disabled={savingEdit} className="flex items-center gap-1 text-white bg-emerald-600 px-2 py-1 rounded-md disabled:opacity-50">
                      <Check size={11} /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} className={muted}><X size={11} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className={dark ? 'text-white/60' : 'text-gray-600'}>
                    SL {p.stop_loss} · TP {p.take_profit ?? '—'}{p.take_profit_2 ? ` / ${p.take_profit_2}` : ''}{p.take_profit_3 ? ` / ${p.take_profit_3}` : ''}
                  </span>
                  <button onClick={() => startEdit(p)} className="text-corporate-hero font-semibold">Modify</button>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-2">
                <input
                  placeholder="Exit price" className={inputCls}
                  value={closingId === p.trade_id ? closePrice : ''}
                  onChange={(e) => { setClosingId(p.trade_id); setClosePrice(e.target.value); }}
                />
                <button
                  onClick={() => closePosition(p.trade_id)}
                  disabled={!(closingId === p.trade_id && closePrice) || closeBusy}
                  className="text-xs font-semibold text-white bg-red-500 px-2 py-1 rounded-md disabled:opacity-40"
                >
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </FoldedCard>
  );
}
