import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Settings2, ArrowLeftRight, Calculator, ChevronDown } from 'lucide-react';
import { ChartPanel } from '../components/ChartPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { useQuickPrice } from '../hooks/useQuickPrice';
import { apiFetch } from '../components/AccessExpiredGate';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from '../components/LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Standard quick %-offset choices for every TP/SL field (TP1/2/3 and
// SL all share the same list now) — by direct request ("increase
// standard percentages ... 0.5%, 1%, 2%, 3%, 4%, 5% for both TP and
// SL").
const QUICK_PCTS = [0.5, 1, 2, 3, 4, 5];

// Exchange selector — by direct request ("with a Exchange selection,
// Binance, Bybit, Bingx, Mexc"). Drives BOTH the chart symbol's prefix
// for a crypto perpetual (below) AND, for real, which exchange an
// order actually routes to: `id` matches execution_engine.py's own
// broker keys (self.brokers = {"bingx", "binance", "bybit", "mexc",
// ...}) exactly, so selecting one here and placing a Live order sends
// `preferred_broker` straight through to the real broker-routing logic
// instead of that field sitting unused.
const EXCHANGES = [
  { id: 'binance', label: 'Binance', tvPrefix: 'BINANCE' },
  { id: 'bybit', label: 'Bybit', tvPrefix: 'BYBIT' },
  { id: 'bingx', label: 'BingX', tvPrefix: 'BINGX' },
  { id: 'mexc', label: 'MEXC', tvPrefix: 'MEXC' },
] as const;

// Quick-link symbols — replaced the old BTC/USDT + EUR/USD + GBP/USD +
// XAU/USD list, by direct bug report ("the quick links ... do not
// work"). Two kinds:
//   - `perp`: a real crypto perpetual-futures ticker, listed the same
//     way on every one of the 4 exchanges above (TradingView really
//     does use the ".P" suffix for a perpetual chart, distinct from
//     the plain spot pair) — its chart symbol is built from whichever
//     exchange is currently selected, so it's never wrong the way a
//     single hardcoded exchange prefix could be for the others.
//   - `fixedTv`: a real forex pair / stock index that none of these 4
//     crypto exchanges actually lists (Binance/Bybit/BingX/MEXC don't
//     offer USD/JPY or Nasdaq 100 perpetuals) — rather than fabricate
//     a "BINANCE:NAS100" symbol that wouldn't resolve on TradingView
//     (repeating the exact bug being fixed here), these keep their own
//     correct real feed regardless of the exchange selector.
// `trade` is always the clean ticker used for quick-price + order
// execution — Binance's public API (services/live_price.py) has no
// live feed for USDJPY/NAS100, same honest limitation the old EUR/USD
// etc. already had; the entry-price field stays manually editable for
// those, exactly as it already does today.
interface QuickSymbol {
  label: string;
  trade: string;
  perp?: string;
  fixedTv?: string;
}
const QUICK_SYMBOLS: QuickSymbol[] = [
  { label: 'BTC Perp', trade: 'BTCUSDT', perp: 'BTCUSDT.P' },
  { label: 'Gold Perp', trade: 'XAUTUSDT', perp: 'XAUTUSDT.P' },
  { label: 'USD/JPY', trade: 'USDJPY', fixedTv: 'OANDA:USDJPY' },
  { label: 'Nasdaq 100', trade: 'NAS100', fixedTv: 'OANDA:NAS100USD' },
];

interface Settings {
  use_global_defaults: boolean;
  trading_mode: 'test' | 'live';
  paper_trading_enabled: boolean;
  risk_per_trade: number;
  max_daily_trades: number;
  max_concurrent_trades: number;
  max_portfolio_exposure: number;
  min_rr_ratio: number;
  effective_risk_per_trade: number;
  effective_max_daily_trades: number;
  effective_max_concurrent_trades: number;
  effective_max_portfolio_exposure: number;
  effective_min_rr_ratio: number;
}

/** A '$' fused directly against the number with NO gap between them —
 * matching Trade Value's own non-editable "$1234.56" format exactly
 * (a fixed-width right-aligned input, tried first, left a "hanging $"
 * floating away from short numbers — by direct request, fixed by
 * sizing the input to its own content in `ch` units instead, so the
 * digits sit flush against the sign the same way plain text would). */
function DollarInput({ value, onChange, placeholder = '0.00', dark = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; dark?: boolean;
}) {
  const chWidth = Math.max((value || placeholder).length, 1);
  return (
    <span className={`inline-flex items-center font-semibold text-sm ${dark ? 'text-white/80' : 'text-gray-700'}`}>
      $<input
        className="font-semibold outline-none bg-transparent p-0 border-none text-sm"
        style={{ width: `${chWidth}ch` }}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      />
    </span>
  );
}

/** Same idea for a percent figure — the number sits flush against a
 * trailing '%' instead. */
function PercentInput({ value, onChange, placeholder = '0', dark = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; dark?: boolean;
}) {
  const chWidth = Math.max((value || placeholder).length, 1);
  return (
    <span className={`inline-flex items-center font-semibold text-sm ${dark ? 'text-white/80' : 'text-gray-700'}`}>
      <input
        className="font-semibold outline-none bg-transparent p-0 border-none text-sm text-right"
        style={{ width: `${chWidth}ch` }}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      />%
    </span>
  );
}

/** Quick %-offset buttons for a TP/SL field, plus a manual %-input as
 * an additional option alongside them — by direct request ("provide
 * additional option for manual input for %SL and %TP in addition to
 * the standard percentages" / "additional TP should have the same
 * quick % options as the first TP"). Shared by TP, TP2, TP3 and SL so
 * all four read and behave identically. `onApply` receives the raw
 * percentage (positive number) — direction (up for TP, down for SL)
 * is already baked into the caller's own priceForPercentOffset. */
function PercentOffsetRow({
  sign, onApply, dark,
}: { sign: '+' | '-'; onApply: (pct: number) => void; dark: boolean }) {
  const [custom, setCustom] = useState('');
  const applyCustom = () => {
    const n = Number(custom);
    if (custom && !isNaN(n) && n > 0) onApply(n);
  };
  const btnCls = `text-[11px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 mb-1.5 mt-0.5">
      {QUICK_PCTS.map((pct) => (
        <button key={pct} onClick={() => onApply(pct)} className={btnCls}>
          {sign}{pct}%
        </button>
      ))}
      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <input
          type="number" inputMode="decimal" value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
          placeholder="custom %" title="Manual %"
          className={`w-14 text-[11px] bg-transparent outline-none ${dark ? 'text-white/70 placeholder:text-white/30' : 'text-gray-600 placeholder:text-gray-300'}`}
        />
        <button onClick={applyCustom} className={`text-[11px] font-semibold ${dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          Set
        </button>
      </span>
    </div>
  );
}

/**
 * ManualTradingPage — the real "manual trading" experience, exchange-
 * style: chart left/center, order ticket right, same anatomy as
 * Binance/Bybit's own trade page. The one deliberate departure from a
 * real exchange: order execution reuses execution_engine.py's exact
 * broker path (routers/manual_trading.py) rather than a parallel one,
 * and is gated behind the Test/Live toggle below — Test never reaches
 * a real broker.
 *
 * This is also the ONE place a "Trade" button anywhere in the app
 * (TradingViewFramePage's Free Chart / My Workspace, eventually the
 * Trade dashboard) actually lands — one real execution surface,
 * reachable from everywhere a chart appears, rather than a copy of
 * this order form embedded on every chart page. `?symbol=` pre-fills
 * which instrument to trade.
 */
export function ManualTradingPage() {
  const [params] = useSearchParams();
  const { token } = useAuth();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  const preselect = params.get('symbol');
  const preselectPrice = params.get('price');
  const [quickSymbol, setQuickSymbol] = useState<QuickSymbol>(
    QUICK_SYMBOLS.find((s) => s.trade === preselect) || QUICK_SYMBOLS[0]
  );
  const [exchange, setExchange] = useState<typeof EXCHANGES[number]>(EXCHANGES[0]);
  // `symbol` keeps the same {label, tv, trade} shape every downstream
  // read below already expects — only how it's built changed. A
  // fixed-feed instrument (USD/JPY, Nasdaq 100) ignores the exchange
  // selector entirely (see QUICK_SYMBOLS' own comment on why); a
  // crypto perpetual's chart symbol is built from whichever exchange
  // is currently selected.
  const symbol = {
    label: quickSymbol.label,
    trade: quickSymbol.trade,
    tv: quickSymbol.perp ? `${exchange.tvPrefix}:${quickSymbol.perp}` : quickSymbol.fixedTv!,
  };
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [entryPrice, setEntryPrice] = useState(preselectPrice || '');
  const [stopLoss, setStopLoss] = useState('');
  // Position Calculator card — collapsed by default ("default is
  // closed"), by direct request: "Market / Exits / Position
  // Calculator" as the ticket's third section.
  const [posCalcOpen, setPosCalcOpen] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [takeProfit2, setTakeProfit2] = useState('');
  const [takeProfit3, setTakeProfit3] = useState('');
  const [tpEnabled, setTpEnabled] = useState(true);
  const [showExtraTargets, setShowExtraTargets] = useState(false);
  const [accountEquity, setAccountEquity] = useState('10000');
  const [riskMode, setRiskMode] = useState<'dollar' | 'percent'>('dollar');
  const [riskAmount, setRiskAmount] = useState('100');
  const [riskPercent, setRiskPercent] = useState('1');
  // Each exit field can be driven by a typed PRICE (default) or a
  // typed $ amount that back-calculates the price — see
  // priceForDollarTarget below.
  const [slMode, setSlMode] = useState<'price' | 'amount'>('price');
  const [slAmount, setSlAmount] = useState('');
  // Frozen lot-size basis for Stop Loss "amount" mode — see
  // toggleSlMode below for why this can't just read the live preview.
  const [slLotSizeBasis, setSlLotSizeBasis] = useState(0);
  const [tpMode, setTpMode] = useState<'price' | 'amount'>('price');
  const [tpAmount, setTpAmount] = useState('');
  const [tp2Mode, setTp2Mode] = useState<'price' | 'amount'>('price');
  const [tp2Amount, setTp2Amount] = useState('');
  const [tp3Mode, setTp3Mode] = useState<'price' | 'amount'>('price');
  const [tp3Amount, setTp3Amount] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const { price: quickPrice, refresh: refreshQuickPrice } = useQuickPrice(symbol.trade);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Order form default-closed, toggled by an "Order" button working
  // exactly like ChartPanel's own Chart-colors button (CandleColorPicker)
  // — one click opens, another click hides the whole form — by direct
  // request.
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; tradeId?: string } | null>(null);
  const [closePercent, setClosePercent] = useState('100');
  const [closePrice, setClosePrice] = useState('');
  const [closing, setClosing] = useState(false);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const [settingsPhase, setSettingsPhase] = useState<FetchPhase>('idle');

  // Returns the loaded Settings (or null on genuine failure) instead of
  // firing-and-forgetting — by direct bug report ("still ... trade
  // Orders are still not executed - error 'your trading settings
  // haven't loaded yet - retrying' ... please fix this"). The retry
  // this triggered used to only reload settings into state; a trader
  // who'd already clicked "Place Order" still had to notice the retry
  // finished and click AGAIN to actually submit. submitOrder below now
  // awaits this and continues automatically the moment settings come
  // back, so one click is enough even through a cold Render start.
  function loadSettings(): Promise<Settings | null> {
    if (!token) return Promise.resolve(null);
    // Was a plain one-shot apiFetch — on a cold Render free-tier start
    // (see resilientFetch.ts) the single attempt could fail before the
    // backend ever woke up, leaving `settings` null forever and every
    // "Place Order" click showing "your trading settings haven't
    // loaded yet" with no way out short of a manual page refresh, by
    // direct bug report. Now retries through the wake window.
    return fetchJsonWithRetry<Settings>(`${API_URL}/manual-trading/settings`, { headers }, setSettingsPhase)
      .then((s) => { if (s) setSettings(s); return s; });
  }

  useEffect(() => { loadSettings(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateSettings(patch: Partial<Settings>) {
    if (!token) return;
    const res = await apiFetch(`${API_URL}/manual-trading/settings`, {
      method: 'PATCH', headers, body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }

  async function submitOrder() {
    // Used to silently no-op here if settings hadn't loaded yet (or
    // failed to, e.g. the settings-endpoint paywall bug) — clicking
    // Place Order did nothing with zero feedback, which is exactly
    // what "the place order is not working" looks like from outside.
    if (!token) {
      setResult({ ok: false, message: 'You need to be signed in to place an order.' });
      return;
    }
    // Was a dead end: this bailed out with "haven't loaded yet —
    // retrying…" and kicked off a background reload, but never
    // actually retried the ORDER itself — a trader had to notice
    // settings finished loading and click Place Order a SECOND time,
    // which from outside just looks like "trade orders are still not
    // executed," by direct bug report. Now it awaits the exact same
    // retry-through-cold-start load and continues automatically the
    // moment settings come back, so one click is enough.
    let effectiveSettings = settings;
    if (!effectiveSettings) {
      setResult({ ok: false, message: 'Your trading settings haven’t loaded yet — retrying…' });
      effectiveSettings = await loadSettings();
      if (!effectiveSettings) {
        setResult({ ok: false, message: 'Still couldn’t load your trading settings — check your connection and try again.' });
        return;
      }
      setResult(null);
    }
    // A Market order on a symbol with a live reference price (crypto,
    // via quick-price) no longer shows its own price field — the
    // whole point of "Market" — but the backend still needs SOME
    // entry_price (reference for the risk-distance math, gt=0
    // required). Use the live price automatically in that case;
    // otherwise (forex/metals, no free feed — see quick-price's own
    // docstring) the field stays visible and this falls back to
    // whatever the trader typed in.
    const effectiveEntryPrice = orderType === 'market' && quickPrice != null ? quickPrice : Number(entryPrice);
    if (!effectiveEntryPrice) {
      setResult({ ok: false, message: 'Enter a price — no live reference price is available for this symbol.' });
      return;
    }

    setResult(null);
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/order`, {
        method: 'POST', headers,
        body: JSON.stringify({
          symbol: symbol.trade, direction, order_type: orderType,
          entry_price: effectiveEntryPrice, stop_loss: Number(stopLoss),
          take_profit: tpEnabled && takeProfit ? Number(takeProfit) : null,
          take_profit_2: tpEnabled && takeProfit2 ? Number(takeProfit2) : null,
          take_profit_3: tpEnabled && takeProfit3 ? Number(takeProfit3) : null,
          account_equity: Number(accountEquity), risk_mode: riskMode,
          risk_amount: riskMode === 'dollar' ? Number(riskAmount) : null,
          risk_percent: riskMode === 'percent' ? Number(riskPercent) : null,
          // Wires the Exchange selector through to real broker
          // routing (execution_engine.py's own preferred_broker pin)
          // — only for a crypto perpetual; the two fixed-feed
          // instruments (USD/JPY, Nasdaq 100) aren't listed on any of
          // these 4 crypto exchanges, so this deliberately leaves
          // preferred_broker unset for them and lets the backend's
          // own symbol-based routing decide instead.
          preferred_broker: quickSymbol.perp ? exchange.id : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Order failed.');
      setResult({ ok: true, message: data.message, tradeId: data.trade_id });
      setClosePrice(String(effectiveEntryPrice));
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Order failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPartialClose() {
    if (!token || !result?.tradeId) return;
    setClosing(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/${result.tradeId}/partial-close`, {
        method: 'POST', headers,
        body: JSON.stringify({ percent: Number(closePercent), exit_price: Number(closePrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Close failed.');
      setResult({
        ok: true, tradeId: data.status === 'closed' ? undefined : result.tradeId,
        message: data.status === 'closed'
          ? `Closed fully. Realized P&L this close: ${data.realized_pnl_this_close}.`
          : `Closed ${closePercent}%. Remaining size: ${data.remaining_lot_size}. Realized P&L this close: ${data.realized_pnl_this_close}.`,
      });
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Close failed.', tradeId: result.tradeId });
    } finally {
      setClosing(false);
    }
  }

  const isTest = settings?.trading_mode === 'test';
  // Paper Trading is its own, permanent toggle, independent of Test/
  // Live — by direct request ("provide a test vs live toggle and
  // also while in live mode still provide a paper trading toggle ...
  // so the paper trading is a permanent toggle both for test mode and
  // live mode"). `isSimulated` mirrors the backend's own `paper`
  // local (routers/manual_trading.py) — true whenever no real broker
  // call will happen, whether that's because Test mode always
  // simulates or because Paper Trading is left on while in Live.
  const paperTradingEnabled = settings?.paper_trading_enabled ?? true;
  const isSimulated = isTest || paperTradingEnabled;
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
  const labelCls = `text-xs font-medium block mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`;

  // Silent — keeps the Sell/Buy header's live-ish reference price
  // fresh (crypto only; see quick-price's own honest scope). The
  // symbol-change fetch also seeds entryPrice as a starting value —
  // never overwrites anything already typed or quick-filled (checked
  // via the functional setEntryPrice update, so this doesn't need
  // entryPrice in the dependency array and can't clobber it mid-type).
  useEffect(() => {
    refreshQuickPrice({ silent: true }).then((p) => {
      if (p != null) setEntryPrice((prev) => prev || String(p));
    });
    const t = setInterval(() => refreshQuickPrice({ silent: true }), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol.trade]);

  // Same fixed-fractional formula services/manual_trading.py's
  // compute_lot_size uses server-side — a live preview only, the real
  // number always comes back from the actual order response.
  const effectiveEntryForPreview = Number(entryPrice) || quickPrice || 0;
  const riskAmountForPreview = riskMode === 'dollar'
    ? Number(riskAmount) || 0
    : (Number(accountEquity) || 0) * (Number(riskPercent) || 0) / 100;
  const perUnitRisk = Math.abs(effectiveEntryForPreview - Number(stopLoss));
  const lotSizePreview = perUnitRisk > 0 ? riskAmountForPreview / perUnitRisk : 0;
  const tradeValuePreview = lotSizePreview * effectiveEntryForPreview;
  const priceDelta = quickPrice != null && entryPrice ? Number(entryPrice) - quickPrice : null;

  // Back-calculates a PRICE from a desired dollar amount at a given
  // lot size. For Take Profit, `lotSizePreview` (the ticket's live
  // Risk-USD ÷ stop distance) is the right basis — TP never feeds
  // into sizing, so there's no circularity reading it live. Stop Loss
  // is genuinely different: lot size is ITSELF derived from Risk-USD
  // ÷ SL distance, so reading the live lotSizePreview while solving
  // for a NEW SL distance is circular — it mathematically forces the
  // result back toward whatever Risk-USD already says, or (worse)
  // produces a nonsense/negative price when SL hadn't been set yet
  // (previously: perUnitRisk fell back to the raw entry price itself
  // as the "distance," an enormous, wrong basis). Fixed by freezing a
  // lot-size snapshot the moment SL amount-mode is entered (see
  // toggleSlMode) and passing THAT in explicitly instead.
  function priceForDollarTarget(amountDollars: number, kind: 'tp' | 'sl', lotSizeBasis: number): number | null {
    if (!(lotSizeBasis > 0) || !effectiveEntryForPreview) return null;
    const distance = amountDollars / lotSizeBasis;
    const goingUp = (direction === 'long') === (kind === 'tp');
    return effectiveEntryForPreview + (goingUp ? distance : -distance);
  }

  function applyDollarAmount(field: 'sl' | 'tp' | 'tp2' | 'tp3', value: string) {
    const n = Number(value);
    if (!value || isNaN(n) || n <= 0) return;
    const lotSizeBasis = field === 'sl' ? slLotSizeBasis : lotSizePreview;
    const price = priceForDollarTarget(n, field === 'sl' ? 'sl' : 'tp', lotSizeBasis);
    if (price == null || price <= 0) return;
    const priceStr = price.toFixed(2);
    if (field === 'sl') setStopLoss(priceStr);
    else if (field === 'tp') setTakeProfit(priceStr);
    else if (field === 'tp2') setTakeProfit2(priceStr);
    else setTakeProfit3(priceStr);
  }

  // Quick %-of-entry offset — the actual "price picker" this app can
  // build without chart click access (see the Exits section's own
  // comment for why not). goingUp mirrors priceForDollarTarget's own
  // long/short + tp/sl direction logic.
  function priceForPercentOffset(pct: number, kind: 'tp' | 'sl'): number | null {
    if (!effectiveEntryForPreview) return null;
    const goingUp = (direction === 'long') === (kind === 'tp');
    const delta = effectiveEntryForPreview * (pct / 100);
    return effectiveEntryForPreview + (goingUp ? delta : -delta);
  }

  // Switches Stop Loss into/out of $-amount mode. Entering it snapshots
  // a lot-size basis to solve against: the live preview lot size when
  // one already exists (a SL price was already entered), otherwise a
  // default 1%-of-entry stop distance — a reasonable starting point,
  // not a real recommendation — so the very first amount typed still
  // produces a sane, nearby price instead of the old broken fallback.
  function toggleSlMode() {
    setSlMode((m) => {
      const next = m === 'price' ? 'amount' : 'price';
      if (next === 'amount') {
        const fallbackDistance = effectiveEntryForPreview * 0.01;
        const basis = lotSizePreview > 0
          ? lotSizePreview
          : (fallbackDistance > 0 ? riskAmountForPreview / fallbackDistance : 0);
        setSlLotSizeBasis(basis);
      }
      return next;
    });
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#0a0e1a] text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <Link to="/trade" className={`inline-flex items-center gap-1.5 text-sm ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
            <ArrowLeft size={15} /> Back to Trade
          </Link>
          {settings && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Test / Live — the account-level mode. */}
              <button
                onClick={() => updateSettings({ trading_mode: isTest ? 'live' : 'test' })}
                title="Test vs Live"
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${dark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-gray-600'}`}
              >
                Mode: {isTest ? 'Test' : 'Live'} — switch to {isTest ? 'Live' : 'Test'}
              </button>

              {/* Paper Trading — its own, PERMANENT toggle, independent
                  of Test/Live and visible in both, by direct request
                  ("while in live mode still provide a paper trading
                  toggle ... so the paper trading is a permanent toggle
                  both for test mode and live mode"). Just the toggle,
                  no separate summary badge/banner alongside it — by
                  direct request ("remove the Paper Trading summary —
                  just show a Paper Trading toggle"). In Test mode this
                  is a no-op (Test always simulates regardless), but it
                  stays visible and interactive rather than disappearing
                  — the whole point of "permanent." */}
              <button
                onClick={() => updateSettings({ paper_trading_enabled: !paperTradingEnabled })}
                title="Paper Trading stays available in both Test and Live — when on, orders never reach a real broker, even in Live mode, but still run the real broker-selection and price checks a live order would face."
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                  paperTradingEnabled ? 'bg-amber-500/15 text-amber-600' : dark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-gray-500'
                }`}
              >
                <span className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${paperTradingEnabled ? 'bg-amber-500' : dark ? 'bg-white/20' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${paperTradingEnabled ? 'translate-x-4' : ''}`} />
                </span>
                Paper Trading: {paperTradingEnabled ? 'On' : 'Off'}
              </button>

              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${dark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-gray-600'}`}
              >
                <Settings2 size={13} /> Risk settings
              </button>
            </div>
          )}
        </div>

        {settingsOpen && settings && (
          <div className={`rounded-xl border p-4 mb-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => updateSettings({ use_global_defaults: true })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${settings.use_global_defaults ? 'bg-corporate-hero text-white' : dark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-gray-500'}`}
              >
                Global defaults
              </button>
              <button
                onClick={() => updateSettings({ use_global_defaults: false })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${!settings.use_global_defaults ? 'bg-corporate-hero text-white' : dark ? 'bg-white/10 text-white/50' : 'bg-black/5 text-gray-500'}`}
              >
                Manual settings
              </button>
            </div>
            {settings.use_global_defaults ? (
              <p className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                Using the platform defaults: {settings.effective_risk_per_trade}% risk/trade,{' '}
                {settings.effective_max_daily_trades} trades/day, {settings.effective_max_concurrent_trades} concurrent,{' '}
                {settings.effective_max_portfolio_exposure}% max exposure, {settings.effective_min_rr_ratio}:1 min R:R.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {([
                  ['risk_per_trade', 'Risk/trade %'], ['max_daily_trades', 'Max/day'],
                  ['max_concurrent_trades', 'Max concurrent'], ['max_portfolio_exposure', 'Max exposure %'],
                  ['min_rr_ratio', 'Min R:R'],
                ] as const).map(([field, label]) => (
                  <label key={field} className={labelCls}>
                    {label}
                    <input
                      type="number" className={inputCls} defaultValue={settings[field]}
                      onBlur={(e) => updateSettings({ [field]: Number(e.target.value) } as Partial<Settings>)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Symbol picker lives OUTSIDE the two-column layout below, so
            both the chart and the order ticket start at the exact same
            top edge — it used to sit only above the chart, pushing the
            chart's own top down below the order form's. */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s.trade}
              onClick={() => setQuickSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                quickSymbol.trade === s.trade
                  ? 'bg-corporate-hero text-white'
                  : dark ? 'bg-white/5 text-white/50' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}

          {/* Exchange — by direct request ("with a Exchange selection,
              Binance, Bybit, Bingx, Mexc"). Only actually changes
              anything for a crypto perpetual (see QUICK_SYMBOLS'
              own comment); shown regardless so it stays a single,
              predictable control rather than appearing/disappearing
              as the symbol changes. */}
          <div className={`flex items-center gap-1 rounded-lg p-1 ml-1 ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
            {EXCHANGES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setExchange(ex)}
                title={quickSymbol.perp ? `Chart + order routing: ${ex.label}` : `${ex.label} — only affects a crypto perpetual, not ${quickSymbol.label}`}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  exchange.id === ex.id
                    ? dark ? 'bg-white/20 text-white' : 'bg-white text-corporate-text-on-bg shadow-sm'
                    : dark ? 'text-white/40' : 'text-gray-500'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visible confirmation of exactly which chart symbol is being
            requested — by direct bug report ("the quick link
            instrument does not change for each selection and exchange
            ... always defaults to BTC binance"). This label reflects
            this page's own state the instant you click a quick-link or
            exchange button; if it updates but the chart itself still
            doesn't, that's TradingView's own data feed not carrying
            that exchange's perpetual under this symbol (a real
            limitation on their end, not this app silently ignoring the
            click) — if the label itself never changes, that's a real
            bug here to keep chasing. */}
        <div className={`text-[11px] mb-3 font-mono ${dark ? 'text-white/30' : 'text-gray-400'}`}>
          Chart symbol: {symbol.tv}
        </div>

        {/* Order card is fully unmounted (not just hidden) when closed —
            by direct request ("remove the order card completely to
            provide more space to the chart") — so the grid collapses
            to a single full-width column and the chart actually gets
            the space back, rather than reserving 340px for a
            placeholder. The "Order" toggle itself now lives in
            ChartPanel's own toolbar, right next to "Price" — by direct
            request ("place the order button next to the price icon") —
            instead of a separate row above the ticket. */}
        <div className={`grid grid-cols-1 ${orderFormOpen ? 'lg:grid-cols-[1fr_340px]' : ''} gap-4 items-start`}>
          <ChartPanel
            key={symbol.tv}
            symbol={symbol.tv} height={600} dark={dark}
            specsSymbol={symbol.trade}
            onQuickFill={(price) => setEntryPrice(String(price))}
            orderFormOpen={orderFormOpen}
            onToggleOrderForm={() => setOrderFormOpen((o) => !o)}
          />

          {orderFormOpen && (
          <div>
            {/* Place Buy/Sell Order — rebuilt to match the exact uploaded
                order-ticket reference. Used to stay always-light
                regardless of the site's own dark/light toggle, by
                direct request; reversed by a later direct request
                ("let the dark or light mode also cover the order
                form") — every surface below now reads `dark` the same
                way the rest of this page already does. Height 600 on
                the chart above is chosen to roughly match this card's
                own natural height ("parallel", by direct request) — an
                exact pixel match isn't feasible without measuring the
                DOM at runtime, since this card's height varies with
                state (extra targets, partial-close panel, result
                messages). */}
            <div className={`rounded-2xl border p-4 h-fit ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <div className={`text-xs font-semibold mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{symbol.trade}</div>

            {/* By direct request ("for loading area put the loading
                indicator to help user wait") — settings load in the
                background regardless (the form itself isn't blocked on
                it), this just makes the wait visible instead of silent. */}
            {!settings && (
              <div className="mb-3"><LoadingIndicator phase={settingsPhase} dark={dark} /></div>
            )}

            {/* Sell / Buy split header, live reference price on each side */}
            <div className={`flex rounded-xl overflow-hidden mb-4 border ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`}>
              <button
                onClick={() => setDirection('short')}
                className={`flex-1 py-2.5 text-center transition-colors ${
                  direction === 'short' ? (dark ? 'bg-red-500/10' : 'bg-red-50') : dark ? 'bg-transparent hover:bg-white/5' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`text-[11px] font-medium ${dark ? 'text-white/40' : 'text-gray-400'}`}>Sell</div>
                <div className={`text-base font-bold ${direction === 'short' ? 'text-red-500' : dark ? 'text-white/70' : 'text-gray-700'}`}>{quickPrice != null ? quickPrice : '—'}</div>
              </button>
              <button
                onClick={() => setDirection('long')}
                className={`flex-1 py-2.5 text-center transition-colors border-l ${dark ? 'border-corporate-border-dark' : 'border-gray-200'} ${
                  direction === 'long' ? (dark ? 'bg-blue-500/10' : 'bg-blue-50') : dark ? 'bg-transparent hover:bg-white/5' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`text-[11px] font-medium ${dark ? 'text-white/40' : 'text-gray-400'}`}>Buy</div>
                <div className={`text-base font-bold ${direction === 'long' ? 'text-blue-500' : dark ? 'text-white/70' : 'text-gray-700'}`}>{quickPrice != null ? quickPrice : '—'}</div>
              </button>
            </div>

            {/* Market / Limit / Stop */}
            <div className={`flex gap-4 mb-3 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              {(['market', 'limit', 'stop'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`pb-2 text-sm font-semibold capitalize border-b-2 -mb-px ${
                    orderType === t ? `border-blue-600 ${dark ? 'text-white' : 'text-gray-900'}` : `border-transparent ${dark ? 'text-white/30' : 'text-gray-400'}`
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Always visible now — it used to hide itself for Market
                orders whenever a live quick-price existed, on the
                theory the live price alone was reference enough. That
                silently broke two things: forex/metals (no live feed)
                fell back to a 0 entry price with no way to fix it, and
                the chart's own "Price" quick-fill button had nowhere
                visible to land when clicked, since the field it was
                filling wasn't on screen. Now it's always shown, seeded
                from the live price on symbol change (see the
                symbol.trade effect above) but never overwritten by
                that seed once you've typed or quick-filled something. */}
            <div className={`flex items-center justify-between py-2 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                {orderType === 'stop' ? 'Stop price' : orderType === 'market' ? 'Reference price' : 'Price'}
              </span>
              <div className="flex items-center gap-2">
                {/* '$' fused against the number, same as Risk (USD) and
                    Trade Value — by direct request. */}
                <DollarInput value={entryPrice} onChange={setEntryPrice} dark={dark} />
                <button
                  onClick={() => refreshQuickPrice().then((p) => p != null && setEntryPrice(String(p)))}
                  aria-label="Use current price" title="Use current price"
                  className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                >
                  <ArrowLeftRight size={13} />
                </button>
              </div>
            </div>
            {priceDelta != null && (
              <div className={`text-right text-[11px] mb-1 mt-0.5 ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} from current price
              </div>
            )}

            {/* Risk row — the field this whole ticket is built around:
                Risk-in-$ default sizing, swap icon flips to Risk %. */}
            <div className={`flex items-center justify-between py-2 border-b mt-1 ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>Risk ({riskMode === 'dollar' ? 'USD' : '%'})</span>
              <div className="flex items-center gap-2">
                {riskMode === 'dollar' ? (
                  <DollarInput value={riskAmount} onChange={setRiskAmount} dark={dark} />
                ) : (
                  <PercentInput value={riskPercent} onChange={setRiskPercent} dark={dark} />
                )}
                <button
                  onClick={() => setRiskMode((m) => (m === 'dollar' ? 'percent' : 'dollar'))}
                  aria-label="Switch between Risk $ and Risk %" title="Switch between Risk $ and Risk %"
                  className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                >
                  <ArrowLeftRight size={13} />
                </button>
              </div>
            </div>

            {/* Trade value / Available margin — Available margin
                doubles as the account-equity input this app's risk
                sizing needs (this app has no live broker margin feed
                to read a real number from, unlike a real exchange). */}
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className={dark ? 'text-white/40' : 'text-gray-400'}>Trade Value</span>
              <span className={`font-semibold ${dark ? 'text-white/80' : 'text-gray-700'}`}>${tradeValuePreview ? tradeValuePreview.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 mb-3">
              <span className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Available Margin</span>
              <DollarInput value={accountEquity} onChange={setAccountEquity} dark={dark} />
            </div>

            {/* Exits — each price field has a small toggle next to it to
                switch to typing a $ amount instead, which back-
                calculates and fills the price (priceForDollarTarget
                above). By direct request ("allow option for a take
                profit amount and stop loss amount to back calculate
                and auto populate price"). Below each: quick %-offset
                buttons — the practical answer to "a price picker so we
                don't have to type price all the time": the free
                TradingView widget lives in its own iframe (see
                TradingViewChart.tsx's own honest-limitation note), so
                this app has no way to read a click or the crosshair
                price off the chart itself; that would need TradingView's
                paid Advanced Charts Library. These buttons are the
                real, buildable substitute — one click, no typing. */}
            <div className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Exits</div>
            <div className={`flex items-center justify-between py-2 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>Take Profit ({tpMode === 'amount' ? 'Amount' : 'Price'})</span>
              <div className="flex items-center gap-2">
                {tpEnabled && (
                  <>
                    {tpMode === 'amount' ? (
                      <DollarInput value={tpAmount} onChange={(v) => { setTpAmount(v); applyDollarAmount('tp', v); }} placeholder="0.00" dark={dark} />
                    ) : (
                      <input
                        className={`text-right text-sm font-semibold w-24 outline-none bg-transparent ${dark ? 'text-white' : ''}`}
                        value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="0.00"
                      />
                    )}
                    <button
                      onClick={() => setTpMode((m) => (m === 'price' ? 'amount' : 'price'))}
                      aria-label="Switch take profit between price and $ amount" title="Switch between price and $ amount"
                      className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setTpEnabled((v) => !v)} aria-label="Toggle take profit"
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${tpEnabled ? 'bg-blue-600' : dark ? 'bg-white/10' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tpEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>
            {tpEnabled && tpMode === 'price' && effectiveEntryForPreview > 0 && (
              <PercentOffsetRow sign="+" dark={dark} onApply={(pct) => setTakeProfit(String((priceForPercentOffset(pct, 'tp') ?? 0).toFixed(2)))} />
            )}
            <div className={`flex items-center justify-between py-2 mb-2`}>
              <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>Stop Loss ({slMode === 'amount' ? 'Amount' : 'Price'})</span>
              <div className="flex items-center gap-2">
                {slMode === 'amount' ? (
                  <DollarInput value={slAmount} onChange={(v) => { setSlAmount(v); applyDollarAmount('sl', v); }} placeholder="0.00" dark={dark} />
                ) : (
                  <input
                    className={`text-right text-sm font-semibold w-24 outline-none bg-transparent ${dark ? 'text-white' : ''}`}
                    value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00"
                  />
                )}
                <button
                  onClick={toggleSlMode}
                  aria-label="Switch stop loss between price and $ amount" title="Switch between price and $ amount"
                  className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                >
                  <ArrowLeftRight size={13} />
                </button>
                {/* Always on — required for risk-based position sizing,
                    unlike a real exchange's optional protective stop. */}
                <span className="relative w-9 h-5 rounded-full bg-blue-600 shrink-0" title="Stop loss is required to size this trade">
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white translate-x-4" />
                </span>
              </div>
            </div>
            {slMode === 'price' && effectiveEntryForPreview > 0 && (
              <PercentOffsetRow sign="-" dark={dark} onApply={(pct) => setStopLoss(String((priceForPercentOffset(pct, 'sl') ?? 0).toFixed(2)))} />
            )}

            {!showExtraTargets ? (
              <button onClick={() => setShowExtraTargets(true)} className={`text-xs font-medium mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                + Add more targets (partial exits)
              </button>
            ) : (
              <div className="mb-3 space-y-2">
                <div className={`py-1.5 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>Take Profit 2 ({tp2Mode === 'amount' ? 'Amount' : 'Price'})</span>
                    <div className="flex items-center gap-2">
                      {tp2Mode === 'amount' ? (
                        <DollarInput value={tp2Amount} onChange={(v) => { setTp2Amount(v); applyDollarAmount('tp2', v); }} placeholder="0.00" dark={dark} />
                      ) : (
                        <input className={`text-right text-sm font-semibold w-24 outline-none bg-transparent ${dark ? 'text-white' : ''}`} value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder="0.00" />
                      )}
                      <button
                        onClick={() => setTp2Mode((m) => (m === 'price' ? 'amount' : 'price'))}
                        aria-label="Switch take profit 2 between price and $ amount" title="Switch between price and $ amount"
                        className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                    </div>
                  </div>
                  {/* Same quick % options as the first Take Profit — by
                      direct request ("additional TP should have the
                      same quick % options as the first TP"). */}
                  {tp2Mode === 'price' && effectiveEntryForPreview > 0 && (
                    <PercentOffsetRow sign="+" dark={dark} onApply={(pct) => setTakeProfit2(String((priceForPercentOffset(pct, 'tp') ?? 0).toFixed(2)))} />
                  )}
                </div>
                <div className="py-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>Take Profit 3 ({tp3Mode === 'amount' ? 'Amount' : 'Price'})</span>
                    <div className="flex items-center gap-2">
                      {tp3Mode === 'amount' ? (
                        <DollarInput value={tp3Amount} onChange={(v) => { setTp3Amount(v); applyDollarAmount('tp3', v); }} placeholder="0.00" dark={dark} />
                      ) : (
                        <input className={`text-right text-sm font-semibold w-24 outline-none bg-transparent ${dark ? 'text-white' : ''}`} value={takeProfit3} onChange={(e) => setTakeProfit3(e.target.value)} placeholder="0.00" />
                      )}
                      <button
                        onClick={() => setTp3Mode((m) => (m === 'price' ? 'amount' : 'price'))}
                        aria-label="Switch take profit 3 between price and $ amount" title="Switch between price and $ amount"
                        className={dark ? 'text-white/30 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                    </div>
                  </div>
                  {tp3Mode === 'price' && effectiveEntryForPreview > 0 && (
                    <PercentOffsetRow sign="+" dark={dark} onApply={(pct) => setTakeProfit3(String((priceForPercentOffset(pct, 'tp') ?? 0).toFixed(2)))} />
                  )}
                </div>
              </div>
            )}

            {/* Position Calculator — third ticket section after Market/Exits,
                collapsed by default, by direct request. Not a second
                calculation: lotSizePreview/tradeValuePreview/perUnitRisk are
                the exact same live numbers this ticket already computes from
                entry price + stop loss + risk above (and already drive the
                submit button's own label) — this just surfaces them as their
                own explicit, auto-updating breakdown instead of leaving the
                math implicit. */}
            <div className={`rounded-xl border mb-3 overflow-hidden ${dark ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => setPosCalcOpen((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}
              >
                <span className={`flex items-center gap-1.5 text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                  <Calculator size={14} className={dark ? 'text-white/40' : 'text-gray-400'} /> Position Calculator
                </span>
                <ChevronDown size={15} className={`transition-transform ${dark ? 'text-white/40' : 'text-gray-400'} ${posCalcOpen ? 'rotate-180' : ''}`} />
              </button>
              {posCalcOpen && (
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Entry (reference) price</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{effectiveEntryForPreview > 0 ? effectiveEntryForPreview.toFixed(2) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Stop loss</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{stopLoss || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Distance to stop</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{perUnitRisk > 0 ? perUnitRisk.toFixed(4) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Risk amount</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>${riskAmountForPreview.toFixed(2)}</span>
                  </div>
                  <div className={`border-t my-1.5 ${dark ? 'border-white/10' : 'border-gray-100'}`} />
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Position size</span>
                    <span className="font-bold text-blue-500">{lotSizePreview > 0 ? lotSizePreview.toFixed(4) : '—'} {symbol.trade}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={dark ? 'text-white/50' : 'text-gray-500'}>Trade value</span>
                    <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>${tradeValuePreview ? tradeValuePreview.toFixed(2) : '0.00'}</span>
                  </div>
                  {!(perUnitRisk > 0) && (
                    <p className={`text-xs pt-1 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Enter an entry price and a stop loss above to see your position size.</p>
                  )}
                </div>
              )}
            </div>

            {result && (
              <p className={`text-xs mb-3 ${result.ok ? 'text-emerald-500' : 'text-red-500'}`}>{result.message}</p>
            )}

            {result?.ok && result.tradeId ? (
              <div className={`rounded-lg p-3 mb-3 border ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                <div className={`text-xs font-semibold mb-2 ${dark ? 'text-white/60' : 'text-gray-600'}`}>Partial close this position</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className={`text-xs font-medium block mb-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                    % to close
                    <input className={inputCls} value={closePercent} onChange={(e) => setClosePercent(e.target.value)} />
                  </label>
                  <label className={`text-xs font-medium block mb-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                    Exit price
                    <input className={inputCls} value={closePrice} onChange={(e) => setClosePrice(e.target.value)} />
                  </label>
                </div>
                <button
                  onClick={submitPartialClose}
                  disabled={closing || !closePrice}
                  className={`w-full py-2 rounded-lg text-xs font-bold disabled:opacity-50 ${dark ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700'}`}
                >
                  {closing ? 'Closing…' : 'Close position'}
                </button>
              </div>
            ) : (
              <button
                onClick={submitOrder}
                disabled={submitting || (!entryPrice && quickPrice == null) || !stopLoss}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {submitting
                  ? 'Placing…'
                  : `${direction === 'long' ? 'Buy' : 'Sell'} ${lotSizePreview > 0 ? lotSizePreview.toFixed(4) : ''} ${symbol.trade} @ ${entryPrice || quickPrice || '—'} ${orderType.toUpperCase()}${isSimulated ? ' (Paper)' : ''}`}
              </button>
            )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
