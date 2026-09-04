import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Radio, Settings2, ArrowLeftRight } from 'lucide-react';
import { ChartPanel } from '../components/ChartPanel';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
import { useQuickPrice } from '../hooks/useQuickPrice';
import { apiFetch } from '../components/AccessExpiredGate';

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
  const [tpMode, setTpMode] = useState<'price' | 'amount'>('price');
  const [tpAmount, setTpAmount] = useState('');
  const [tp2Mode, setTp2Mode] = useState<'price' | 'amount'>('price');
  const [tp2Amount, setTp2Amount] = useState('');
  const [tp3Mode, setTp3Mode] = useState<'price' | 'amount'>('price');
  const [tp3Amount, setTp3Amount] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const { price: quickPrice, refresh: refreshQuickPrice } = useQuickPrice(symbol.trade);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; tradeId?: string } | null>(null);
  const [closePercent, setClosePercent] = useState('100');
  const [closePrice, setClosePrice] = useState('');
  const [closing, setClosing] = useState(false);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  function loadSettings() {
    if (!token) return;
    apiFetch(`${API_URL}/manual-trading/settings`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettings)
      .catch(() => {});
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
  // fresh (crypto only; see quick-price's own honest scope). Never
  // overwrites anything the trader has typed.
  useEffect(() => {
    refreshQuickPrice({ silent: true });
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

  // Back-calculates a PRICE from a desired dollar amount, using the
  // ticket's own currently-implied lot size (Risk-USD ÷ stop
  // distance, i.e. lotSizePreview above) as the basis. For Take
  // Profit this is a fully independent, well-defined convenience — TP
  // never feeds into sizing. For Stop Loss it's honestly a
  // best-effort one-way calculator rather than a second independent
  // risk figure: lot size is itself derived from Risk-USD ÷ SL
  // distance, so the dollar loss AT the resulting lot size is
  // mathematically forced back toward the Risk-USD figure above —
  // typing a SL $ amount changes the SL price (and so, indirectly,
  // the next-computed lot size), it doesn't coexist as a second
  // independent number. The Risk-USD row above stays the authoritative
  // one for sizing.
  function priceForDollarTarget(amountDollars: number, kind: 'tp' | 'sl'): number | null {
    if (!(lotSizePreview > 0) || !effectiveEntryForPreview) return null;
    const distance = amountDollars / lotSizePreview;
    const goingUp = (direction === 'long') === (kind === 'tp');
    return effectiveEntryForPreview + (goingUp ? distance : -distance);
  }

  function applyDollarAmount(field: 'sl' | 'tp' | 'tp2' | 'tp3', value: string) {
    const n = Number(value);
    if (!value || isNaN(n) || n <= 0) return;
    const price = priceForDollarTarget(n, field === 'sl' ? 'sl' : 'tp');
    if (price == null || price <= 0) return;
    const priceStr = price.toFixed(2);
    if (field === 'sl') setStopLoss(priceStr);
    else if (field === 'tp') setTakeProfit(priceStr);
    else if (field === 'tp2') setTakeProfit2(priceStr);
    else setTakeProfit3(priceStr);
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div>
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
            <ChartPanel
              symbol={symbol.tv} height={520} dark={dark}
              specsSymbol={symbol.trade}
              onQuickFill={(price) => setEntryPrice(String(price))}
            />
          </div>

          {/* Place Buy/Sell Order — rebuilt to match the exact uploaded
              order-ticket reference: styling is always light, by
              direct request ("use upload exactly same colours and
              style and formatting"), independent of the site's own
              dark/light toggle, same reasoning as StatCard's fix
              earlier this session. */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 h-fit text-gray-900">
            <div className="text-xs font-semibold mb-3 text-gray-400">{symbol.trade}</div>

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

            {/* Market orders hide this field ONLY when there's actually a
                live reference price to fall back on (crypto, via
                quick-price) — the whole point of "Market". On forex/
                metals (no free feed — see quick-price's own docstring)
                there is no live price to fall back on, so the field
                has to stay visible even in Market mode, or every
                calculation below silently uses 0 as the entry price. */}
            {(orderType !== 'market' || quickPrice == null) && (
              <>
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
              </>
            )}

            {/* Risk row — the field this whole ticket is built around:
                Risk-in-$ default sizing, swap icon flips to Risk %. */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 mt-1">
              <span className="text-sm text-gray-500">Risk, {riskMode === 'dollar' ? 'USD' : '%'}</span>
              <div className="flex items-center gap-2">
                <input
                  className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                  value={riskMode === 'dollar' ? riskAmount : riskPercent}
                  onChange={(e) => (riskMode === 'dollar' ? setRiskAmount(e.target.value) : setRiskPercent(e.target.value))}
                />
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
              <span className="text-gray-400">Trade value</span>
              <span className="font-semibold text-gray-700">${tradeValuePreview ? tradeValuePreview.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 mb-3">
              <span className="text-sm text-gray-400">Available margin</span>
              <div className="flex items-center font-semibold text-gray-700">
                <span className="text-sm">$</span>
                <input
                  className="text-right text-sm font-semibold w-20 outline-none bg-transparent p-0"
                  value={accountEquity} onChange={(e) => setAccountEquity(e.target.value)}
                />
              </div>
            </div>

            {/* Exits — each price field has a small toggle next to it to
                switch to typing a $ amount instead, which back-
                calculates and fills the price (priceForDollarTarget
                above). By direct request ("allow option for a take
                profit amount and stop loss amount to back calculate
                and auto populate price"). */}
            <div className="text-sm font-bold text-gray-900 mb-1">Exits</div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Take profit, {tpMode === 'amount' ? 'amount ($)' : 'price'}</span>
              <div className="flex items-center gap-2">
                {tpEnabled && (
                  <>
                    {tpMode === 'amount' ? (
                      <input
                        className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                        value={tpAmount} onChange={(e) => { setTpAmount(e.target.value); applyDollarAmount('tp', e.target.value); }} placeholder="$0.00"
                      />
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
            <div className="flex items-center justify-between py-2 mb-2">
              <span className="text-sm text-gray-500">Stop loss, {slMode === 'amount' ? 'amount ($)' : 'price'}</span>
              <div className="flex items-center gap-2">
                {slMode === 'amount' ? (
                  <input
                    className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                    value={slAmount} onChange={(e) => { setSlAmount(e.target.value); applyDollarAmount('sl', e.target.value); }} placeholder="$0.00"
                  />
                ) : (
                  <input
                    className="text-right text-sm font-semibold w-24 outline-none bg-transparent"
                    value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00"
                  />
                )}
                <button
                  onClick={() => setSlMode((m) => (m === 'price' ? 'amount' : 'price'))}
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

            {!showExtraTargets ? (
              <button onClick={() => setShowExtraTargets(true)} className="text-xs font-medium mb-3 text-gray-400">
                + Add more targets (partial exits)
              </button>
            ) : (
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Take profit 2, {tp2Mode === 'amount' ? 'amount ($)' : 'price'} (optional)</span>
                  <div className="flex items-center gap-2">
                    {tp2Mode === 'amount' ? (
                      <input className="text-right text-sm font-semibold w-24 outline-none bg-transparent" value={tp2Amount} onChange={(e) => { setTp2Amount(e.target.value); applyDollarAmount('tp2', e.target.value); }} placeholder="$0.00" />
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
                  <span className="text-sm text-gray-500">Take profit 3, {tp3Mode === 'amount' ? 'amount ($)' : 'price'} (optional)</span>
                  <div className="flex items-center gap-2">
                    {tp3Mode === 'amount' ? (
                      <input className="text-right text-sm font-semibold w-24 outline-none bg-transparent" value={tp3Amount} onChange={(e) => { setTp3Amount(e.target.value); applyDollarAmount('tp3', e.target.value); }} placeholder="$0.00" />
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
        </div>
      </div>
    </div>
  );
}
