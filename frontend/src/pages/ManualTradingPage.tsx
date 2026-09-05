import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Radio, Settings2, ArrowLeftRight, Calculator, ChevronDown, Receipt } from 'lucide-react';
import { ChartPanel } from '../components/ChartPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { useQuickPrice } from '../hooks/useQuickPrice';
import { apiFetch } from '../components/AccessExpiredGate';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from '../components/LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SYMBOLS = [
  { label: 'BTC/USDT', tv: 'BINANCE:BTCUSDT', trade: 'BTCUSDT' },
  { label: 'EUR/USD', tv: 'OANDA:EURUSD', trade: 'EURUSD' },
  { label: 'GBP/USD', tv: 'OANDA:GBPUSD', trade: 'GBPUSD' },
  { label: 'XAU/USD', tv: 'OANDA:XAUUSD', trade: 'XAUUSD' },
];

interface Settings {
  use_global_defaults: boolean;
  trading_mode: 'test' | 'live';
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
function DollarInput({ value, onChange, placeholder = '0.00' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const chWidth = Math.max((value || placeholder).length, 1);
  return (
    <span className="inline-flex items-center font-semibold text-gray-700 text-sm">
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
function PercentInput({ value, onChange, placeholder = '0' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const chWidth = Math.max((value || placeholder).length, 1);
  return (
    <span className="inline-flex items-center font-semibold text-gray-700 text-sm">
      <input
        className="font-semibold outline-none bg-transparent p-0 border-none text-sm text-right"
        style={{ width: `${chWidth}ch` }}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      />%
    </span>
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
  const [symbol, setSymbol] = useState(
    SYMBOLS.find((s) => s.trade === preselect) || SYMBOLS[0]
  );
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

  function loadSettings() {
    if (!token) return;
    // Was a plain one-shot apiFetch — on a cold Render free-tier start
    // (see resilientFetch.ts) the single attempt could fail before the
    // backend ever woke up, leaving `settings` null forever and every
    // "Place Order" click showing "your trading settings haven't
    // loaded yet" with no way out short of a manual page refresh, by
    // direct bug report. Now retries through the wake window.
    fetchJsonWithRetry<Settings>(`${API_URL}/manual-trading/settings`, { headers }, setSettingsPhase)
      .then((s) => { if (s) setSettings(s); });
  }

  useEffect(loadSettings, [token]);

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
    if (!settings) {
      setResult({ ok: false, message: 'Your trading settings haven’t loaded yet — retrying…' });
      loadSettings();
      return;
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
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                  isTest ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-500'
                }`}
              >
                {isTest ? <FlaskConical size={13} /> : <Radio size={13} />} {isTest ? 'TEST MODE' : 'LIVE — real orders'}
              </span>
              <button
                onClick={() => updateSettings({ trading_mode: isTest ? 'live' : 'test' })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${dark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-gray-600'}`}
              >
                Switch to {isTest ? 'Live' : 'Test'}
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

        {isTest && (
          <div className={`rounded-xl p-3 mb-4 text-xs font-medium ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
            TEST MODE — orders below are simulated instantly. Nothing reaches a real exchange until you switch to Live.
          </div>
        )}

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
          {SYMBOLS.map((s) => (
            <button
              key={s.trade}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                symbol.trade === s.trade
                  ? 'bg-corporate-hero text-white'
                  : dark ? 'bg-white/5 text-white/50' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          <ChartPanel
            symbol={symbol.tv} height={600} dark={dark}
            specsSymbol={symbol.trade}
            onQuickFill={(price) => setEntryPrice(String(price))}
          />

          <div>
            {/* Matches ChartPanel's own toolbar row height (light/dark
                toggle + Price/Chart-colors/Trade buttons, 41px: a
                33px button row plus its own 8px bottom margin) so this
                row lines up level with the chart's own toolbar — by
                direct request ("triggered by an 'Order' button similar
                to the colour chart next to the price icon or button").
                The toggle button itself matches CandleColorPicker's
                exact interaction: one click opens, a second click on
                the same button hides the whole form again. */}
            <div className="flex justify-end" style={{ height: 41 }}>
              <button
                onClick={() => setOrderFormOpen((o) => !o)}
                aria-label={orderFormOpen ? 'Hide order form' : 'Show order form'}
                className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium h-fit ${
                  orderFormOpen ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 bg-black/5'
                }`}
              >
                <Receipt size={13} /> Order
              </button>
            </div>

            {/* Place Buy/Sell Order — rebuilt to match the exact uploaded
                order-ticket reference: styling is always light, by
                direct request ("use upload exactly same colours and
                style and formatting"), independent of the site's own
                dark/light toggle, same reasoning as StatCard's fix
                earlier this session. Height 600 on the chart above is
                chosen to roughly match this card's own natural height
                ("parallel", by direct request) — an exact pixel match
                isn't feasible without measuring the DOM at runtime, since
                this card's height varies with state (extra targets,
                partial-close panel, result messages).

                Collapsed behind the "Order" toggle above by default —
                everything from here down only mounts once opened. */}
            {!orderFormOpen ? (
              <button
                onClick={() => setOrderFormOpen(true)}
                className="w-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
              >
                <Receipt size={20} className="mx-auto mb-2" />
                Click "Order" above to place a trade
              </button>
            ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 h-fit text-gray-900">
            <div className="text-xs font-semibold mb-3 text-gray-400">{symbol.trade}</div>

            {/* By direct request ("for loading area put the loading
                indicator to help user wait") — settings load in the
                background regardless (the form itself isn't blocked on
                it), this just makes the wait visible instead of silent. */}
            {!settings && (
              <div className="mb-3"><LoadingIndicator phase={settingsPhase} dark={false} /></div>
            )}

            {/* Sell / Buy split header, live reference price on each side */}
            <div className="flex rounded-xl overflow-hidden mb-4 border border-gray-200">
              <button
                onClick={() => setDirection('short')}
                className={`flex-1 py-2.5 text-center transition-colors ${direction === 'short' ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="text-[11px] font-medium text-gray-400">Sell</div>
                <div className={`text-base font-bold ${direction === 'short' ? 'text-red-600' : 'text-gray-700'}`}>{quickPrice != null ? quickPrice : '—'}</div>
              </button>
              <button
                onClick={() => setDirection('long')}
                className={`flex-1 py-2.5 text-center transition-colors border-l border-gray-200 ${direction === 'long' ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="text-[11px] font-medium text-gray-400">Buy</div>
                <div className={`text-base font-bold ${direction === 'long' ? 'text-blue-600' : 'text-gray-700'}`}>{quickPrice != null ? quickPrice : '—'}</div>
              </button>
            </div>

            {/* Market / Limit / Stop */}
            <div className="flex gap-4 mb-3 border-b border-gray-100">
              {(['market', 'limit', 'stop'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`pb-2 text-sm font-semibold capitalize border-b-2 -mb-px ${
                    orderType === t ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-400'
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
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">
                {orderType === 'stop' ? 'Stop price' : orderType === 'market' ? 'Reference price' : 'Price'}
              </span>
              <div className="flex items-center gap-2">
                <input
                  className="text-right text-sm font-semibold w-28 outline-none bg-transparent"
                  value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00"
                />
                <button
                  onClick={() => refreshQuickPrice().then((p) => p != null && setEntryPrice(String(p)))}
                  aria-label="Use current price" title="Use current price"
                  className="text-gray-300 hover:text-gray-500"
                >
                  <ArrowLeftRight size={13} />
                </button>
              </div>
            </div>
            {priceDelta != null && (
              <div className="text-right text-[11px] text-gray-400 mb-1 mt-0.5">
                {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} from current price
              </div>
            )}

            {/* Risk row — the field this whole ticket is built around:
                Risk-in-$ default sizing, swap icon flips to Risk %. */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 mt-1">
              <span className="text-sm text-gray-500">Risk ({riskMode === 'dollar' ? 'USD' : '%'})</span>
              <div className="flex items-center gap-2">
                {riskMode === 'dollar' ? (
                  <DollarInput value={riskAmount} onChange={setRiskAmount} />
                ) : (
                  <PercentInput value={riskPercent} onChange={setRiskPercent} />
                )}
                <button
                  onClick={() => setRiskMode((m) => (m === 'dollar' ? 'percent' : 'dollar'))}
                  aria-label="Switch between Risk $ and Risk %" title="Switch between Risk $ and Risk %"
                  className="text-gray-300 hover:text-gray-500"
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
              <span className="text-gray-400">Trade Value</span>
              <span className="font-semibold text-gray-700">${tradeValuePreview ? tradeValuePreview.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 mb-3">
              <span className="text-sm text-gray-400">Available Margin</span>
              <DollarInput value={accountEquity} onChange={setAccountEquity} />
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
            <div className="text-sm font-bold text-gray-900 mb-1">Exits</div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Take Profit ({tpMode === 'amount' ? 'Amount' : 'Price'})</span>
              <div className="flex items-center gap-2">
                {tpEnabled && (
                  <>
                    {tpMode === 'amount' ? (
                      <DollarInput value={tpAmount} onChange={(v) => { setTpAmount(v); applyDollarAmount('tp', v); }} placeholder="0.00" />
                    ) : (
                      <input
                        className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                        value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="0.00"
                      />
                    )}
                    <button
                      onClick={() => setTpMode((m) => (m === 'price' ? 'amount' : 'price'))}
                      aria-label="Switch take profit between price and $ amount" title="Switch between price and $ amount"
                      className="text-gray-300 hover:text-gray-500"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setTpEnabled((v) => !v)} aria-label="Toggle take profit"
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${tpEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tpEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>
            {tpEnabled && tpMode === 'price' && effectiveEntryForPreview > 0 && (
              <div className="flex justify-end gap-1.5 mb-1 mt-0.5">
                {[1, 2, 3].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTakeProfit(String((priceForPercentOffset(pct, 'tp') ?? 0).toFixed(2)))}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between py-2 mb-2">
              <span className="text-sm text-gray-500">Stop Loss ({slMode === 'amount' ? 'Amount' : 'Price'})</span>
              <div className="flex items-center gap-2">
                {slMode === 'amount' ? (
                  <DollarInput value={slAmount} onChange={(v) => { setSlAmount(v); applyDollarAmount('sl', v); }} placeholder="0.00" />
                ) : (
                  <input
                    className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                    value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00"
                  />
                )}
                <button
                  onClick={toggleSlMode}
                  aria-label="Switch stop loss between price and $ amount" title="Switch between price and $ amount"
                  className="text-gray-300 hover:text-gray-500"
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
              <div className="flex justify-end gap-1.5 mb-2 -mt-1">
                {[0.5, 1, 2].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setStopLoss(String((priceForPercentOffset(pct, 'sl') ?? 0).toFixed(2)))}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    -{pct}%
                  </button>
                ))}
              </div>
            )}

            {!showExtraTargets ? (
              <button onClick={() => setShowExtraTargets(true)} className="text-xs font-medium mb-3 text-gray-400">
                + Add more targets (partial exits)
              </button>
            ) : (
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Take Profit 2 ({tp2Mode === 'amount' ? 'Amount' : 'Price'})</span>
                  <div className="flex items-center gap-2">
                    {tp2Mode === 'amount' ? (
                      <DollarInput value={tp2Amount} onChange={(v) => { setTp2Amount(v); applyDollarAmount('tp2', v); }} placeholder="0.00" />
                    ) : (
                      <input className="text-right text-sm font-semibold w-24 outline-none bg-transparent" value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder="0.00" />
                    )}
                    <button
                      onClick={() => setTp2Mode((m) => (m === 'price' ? 'amount' : 'price'))}
                      aria-label="Switch take profit 2 between price and $ amount" title="Switch between price and $ amount"
                      className="text-gray-300 hover:text-gray-500"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-500">Take Profit 3 ({tp3Mode === 'amount' ? 'Amount' : 'Price'})</span>
                  <div className="flex items-center gap-2">
                    {tp3Mode === 'amount' ? (
                      <DollarInput value={tp3Amount} onChange={(v) => { setTp3Amount(v); applyDollarAmount('tp3', v); }} placeholder="0.00" />
                    ) : (
                      <input className="text-right text-sm font-semibold w-24 outline-none bg-transparent" value={takeProfit3} onChange={(e) => setTakeProfit3(e.target.value)} placeholder="0.00" />
                    )}
                    <button
                      onClick={() => setTp3Mode((m) => (m === 'price' ? 'amount' : 'price'))}
                      aria-label="Switch take profit 3 between price and $ amount" title="Switch between price and $ amount"
                      className="text-gray-300 hover:text-gray-500"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </div>
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
            <div className="rounded-xl border border-gray-200 mb-3 overflow-hidden">
              <button
                onClick={() => setPosCalcOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                  <Calculator size={14} className="text-gray-400" /> Position Calculator
                </span>
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${posCalcOpen ? 'rotate-180' : ''}`} />
              </button>
              {posCalcOpen && (
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Entry (reference) price</span>
                    <span className="font-semibold text-gray-900">{effectiveEntryForPreview > 0 ? effectiveEntryForPreview.toFixed(2) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Stop loss</span>
                    <span className="font-semibold text-gray-900">{stopLoss || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Distance to stop</span>
                    <span className="font-semibold text-gray-900">{perUnitRisk > 0 ? perUnitRisk.toFixed(4) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Risk amount</span>
                    <span className="font-semibold text-gray-900">${riskAmountForPreview.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-100 my-1.5" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Position size</span>
                    <span className="font-bold text-blue-600">{lotSizePreview > 0 ? lotSizePreview.toFixed(4) : '—'} {symbol.trade}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Trade value</span>
                    <span className="font-semibold text-gray-900">${tradeValuePreview ? tradeValuePreview.toFixed(2) : '0.00'}</span>
                  </div>
                  {!(perUnitRisk > 0) && (
                    <p className="text-xs text-gray-400 pt-1">Enter an entry price and a stop loss above to see your position size.</p>
                  )}
                </div>
              )}
            </div>

            {result && (
              <p className={`text-xs mb-3 ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.message}</p>
            )}

            {result?.ok && result.tradeId ? (
              <div className="rounded-lg p-3 mb-3 border border-gray-200">
                <div className="text-xs font-semibold mb-2 text-gray-600">Partial close this position</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="text-xs font-medium block mb-1 text-gray-500">
                    % to close
                    <input className="w-full rounded-lg px-3 py-2 text-sm outline-none border border-gray-200" value={closePercent} onChange={(e) => setClosePercent(e.target.value)} />
                  </label>
                  <label className="text-xs font-medium block mb-1 text-gray-500">
                    Exit price
                    <input className="w-full rounded-lg px-3 py-2 text-sm outline-none border border-gray-200" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} />
                  </label>
                </div>
                <button
                  onClick={submitPartialClose}
                  disabled={closing || !closePrice}
                  className="w-full py-2 rounded-lg text-xs font-bold disabled:opacity-50 bg-gray-100 text-gray-700"
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
                  : `${direction === 'long' ? 'Buy' : 'Sell'} ${lotSizePreview > 0 ? lotSizePreview.toFixed(4) : ''} ${symbol.trade} @ ${entryPrice || quickPrice || '—'} ${orderType.toUpperCase()}${isTest ? ' (Test)' : ''}`}
              </button>
            )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
