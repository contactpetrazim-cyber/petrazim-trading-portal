import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Radio, Settings2 } from 'lucide-react';
import { TradingViewChart } from '../components/TradingViewChart';
import { CandleColorPicker } from '../components/CandleColorPicker';
import { useCandleColorStore } from '../hooks/useCandleColors';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../hooks/useTheme';
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
  const { colors } = useCandleColorStore();

  const preselect = params.get('symbol');
  const [symbol, setSymbol] = useState(
    SYMBOLS.find((s) => s.trade === preselect) || SYMBOLS[0]
  );
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [accountEquity, setAccountEquity] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
    if (!token || !settings) return;
    setResult(null);
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/manual-trading/order`, {
        method: 'POST', headers,
        body: JSON.stringify({
          symbol: symbol.trade, direction,
          entry_price: Number(entryPrice), stop_loss: Number(stopLoss),
          take_profit: takeProfit ? Number(takeProfit) : null,
          account_equity: Number(accountEquity), risk_percent: Number(riskPercent),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Order failed.');
      setResult({ ok: true, message: data.message });
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Order failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  const isTest = settings?.trading_mode === 'test';
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm outline-none border ${
    dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'bg-white border-gray-200 text-corporate-text-on-bg'
  }`;
  const labelCls = `text-xs font-medium block mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`;

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
              <div className="ml-auto"><CandleColorPicker dark={dark} /></div>
            </div>
            <div className={`rounded-xl overflow-hidden border ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`} style={{ height: '520px' }}>
              <TradingViewChart symbol={symbol.tv} interval="60" theme={theme} candleColors={colors} />
            </div>
          </div>

          <div className={`rounded-xl border p-4 h-fit ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-gray-200'}`}>
            <div className="flex rounded-lg overflow-hidden mb-4">
              <button
                onClick={() => setDirection('long')}
                className={`flex-1 py-2.5 text-sm font-bold ${direction === 'long' ? 'bg-emerald-500 text-white' : dark ? 'bg-white/5 text-white/40' : 'bg-gray-50 text-gray-400'}`}
              >
                BUY / LONG
              </button>
              <button
                onClick={() => setDirection('short')}
                className={`flex-1 py-2.5 text-sm font-bold ${direction === 'short' ? 'bg-red-500 text-white' : dark ? 'bg-white/5 text-white/40' : 'bg-gray-50 text-gray-400'}`}
              >
                SELL / SHORT
              </button>
            </div>

            <label className={labelCls}>Entry price</label>
            <input className={`${inputCls} mb-3`} value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" />

            <label className={labelCls}>Stop loss</label>
            <input className={`${inputCls} mb-3`} value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00" />

            <label className={labelCls}>Take profit (optional)</label>
            <input className={`${inputCls} mb-3`} value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="0.00" />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className={labelCls}>
                Account equity
                <input className={inputCls} value={accountEquity} onChange={(e) => setAccountEquity(e.target.value)} />
              </label>
              <label className={labelCls}>
                Risk %
                <input className={inputCls} value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />
              </label>
            </div>

            {result && (
              <p className={`text-xs mb-3 ${result.ok ? 'text-emerald-500' : 'text-red-500'}`}>{result.message}</p>
            )}

            <button
              onClick={submitOrder}
              disabled={submitting || !entryPrice || !stopLoss}
              className={`w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${direction === 'long' ? 'bg-emerald-500' : 'bg-red-500'}`}
            >
              {submitting ? 'Placing…' : `${isTest ? 'Simulate' : 'Place'} ${direction === 'long' ? 'Buy' : 'Sell'} Order`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
