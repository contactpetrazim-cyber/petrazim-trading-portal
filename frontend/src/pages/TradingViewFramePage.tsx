import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Save, Trash2, FolderOpen, X, TrendingUp } from 'lucide-react';
import { TradingViewChart } from '../components/TradingViewChart';
import { CandleColorPicker } from '../components/CandleColorPicker';
import { useCandleColorStore } from '../hooks/useCandleColors';
import { OpenInTradingView } from '../components/OpenInTradingView';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { FoldedCard } from '../components/FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * TradingViewFramePage — v4.
 *
 * Fixed: "My Workspace" wasn't showing a chart at all before this —
 * it replaced the chart entirely with the saved-views card, so it
 * looked broken/undeployed. Now the real chart renders underneath in
 * both Free Chart and My Workspace mode (same component, same full
 * toolset — see TradingViewChart's own docstring on why both get
 * identical drawing tools/indicators and only persistence differs);
 * Saved Views is a toggleable drawer over it instead of a
 * replacement.
 *
 * Candle colors are now editable (CandleColorPicker), shared across
 * every chart in the app via useCandleColorStore.
 *
 * "Trade" navigates to the real Manual Trading page with this
 * symbol pre-filled, rather than embedding a second order-entry
 * surface here — one real execution path, reachable from everywhere
 * a chart appears, not a copy of the order form on every page that
 * shows a chart.
 */

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT', deepLink: 'BTCUSDT', tradeSymbol: 'BTCUSDT' },
  { label: 'EUR/USD', value: 'OANDA:EURUSD', deepLink: 'EURUSD', tradeSymbol: 'EURUSD' },
  { label: 'GBP/USD', value: 'OANDA:GBPUSD', deepLink: 'GBPUSD', tradeSymbol: 'GBPUSD' },
  { label: 'XAU/USD', value: 'OANDA:XAUUSD', deepLink: 'XAUUSD', tradeSymbol: 'XAUUSD' },
];

const INTERVALS = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: 'D', value: 'D' },
];

type Mode = 'widget' | 'workspace' | 'external';
type FrameTheme = 'light' | 'dark';

interface LayoutSummary {
  id: string;
  name: string;
  symbol: string | null;
  updated_at: string;
}

export function TradingViewFramePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { colors } = useCandleColorStore();
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [interval, setIntervalValue] = useState(INTERVALS[1]);
  const [mode, setMode] = useState<Mode>('widget');
  const [frameTheme, setFrameTheme] = useState<FrameTheme>('light');
  const [layouts, setLayouts] = useState<LayoutSummary[]>([]);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const frameDark = frameTheme === 'dark';
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  async function loadLayouts() {
    if (!token) return;
    const res = await apiFetch(`${API_URL}/tradingview/charts/layouts`, { headers: authHeaders });
    if (res.ok) setLayouts(await res.json());
  }

  useEffect(() => {
    if (mode === 'workspace') loadLayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);

  async function saveCurrentView() {
    if (!saveName.trim() || !token) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/tradingview/charts/layouts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: saveName.trim(), symbol: symbol.value,
          content: JSON.stringify({ symbol: symbol.value, interval: interval.value }),
        }),
      });
      if (res.ok) {
        setSaveName('');
        await loadLayouts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function openLayout(id: string) {
    const res = await apiFetch(`${API_URL}/tradingview/charts/layouts/${id}`, { headers: authHeaders });
    if (!res.ok) return;
    const detail = await res.json();
    try {
      const parsed = JSON.parse(detail.content);
      const foundSymbol = SYMBOLS.find((s) => s.value === parsed.symbol);
      const foundInterval = INTERVALS.find((i) => i.value === parsed.interval);
      if (foundSymbol) setSymbol(foundSymbol);
      if (foundInterval) setIntervalValue(foundInterval);
    } catch {
      /* malformed content — ignore, keep current symbol/interval */
    }
    setSavedViewsOpen(false);
  }

  async function deleteLayout(id: string) {
    await apiFetch(`${API_URL}/tradingview/charts/layouts/${id}`, { method: 'DELETE', headers: authHeaders });
    loadLayouts();
  }

  const bezelBg = frameDark
    ? 'linear-gradient(to bottom, #1c1c1e, #0a0a0a)'
    : 'linear-gradient(to bottom, #f4f5f9, #e8eaf2)';

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 md:p-10 ${frameDark ? 'bg-[#0a0a0a]' : 'bg-[#e8eaf2]'}`}>
      <div className="w-full max-w-6xl rounded-3xl p-4 md:p-6 shadow-2xl" style={{ background: bezelBg }}>
        <div className="flex items-center justify-between px-2 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <PetrazimLogo height={32} />
            <span className={`text-xs font-medium tracking-wide ${frameDark ? 'text-white/40' : 'text-[#141a33]/50'}`}>
              PETRAZIM TRADING FRAME
            </span>
          </div>

          <div className={`flex items-center gap-1 rounded-lg p-1 ${frameDark ? 'bg-white/5' : 'bg-black/5'}`}>
            {(['widget', 'workspace', 'external'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === m
                    ? 'bg-corporate-accent text-white'
                    : frameDark ? 'text-white/50 hover:text-white' : 'text-[#141a33]/50 hover:text-[#141a33]'
                }`}
              >
                {m === 'widget' ? 'Free Chart' : m === 'workspace' ? 'My Workspace' : 'Real TradingView'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {SYMBOLS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSymbol(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                    symbol.value === s.value
                      ? frameDark ? 'bg-white/20 text-white' : 'bg-black/10 text-[#141a33]'
                      : frameDark ? 'text-white/40 hover:text-white/70' : 'text-[#141a33]/40 hover:text-[#141a33]/70'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {mode !== 'external' && (
              <div className={`flex items-center gap-1 rounded-lg p-1 ${frameDark ? 'bg-white/5' : 'bg-black/5'}`}>
                {INTERVALS.map((i) => (
                  <button
                    key={i.value}
                    onClick={() => setIntervalValue(i)}
                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                      interval.value === i.value
                        ? frameDark ? 'bg-white/20 text-white' : 'bg-black/10 text-[#141a33]'
                        : frameDark ? 'text-white/40 hover:text-white/70' : 'text-[#141a33]/40 hover:text-[#141a33]/70'
                    }`}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            )}

            {mode !== 'external' && <CandleColorPicker dark={frameDark} />}

            {mode === 'workspace' && (
              <button
                onClick={() => setSavedViewsOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${frameDark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-[#141a33]/60 hover:text-[#141a33]'}`}
              >
                <FolderOpen size={13} /> Saved Views
              </button>
            )}

            {mode !== 'external' && (
              <button
                onClick={() => navigate(`/trade/manual?symbol=${encodeURIComponent(symbol.tradeSymbol)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-corporate-hero"
              >
                <TrendingUp size={13} /> Trade {symbol.label}
              </button>
            )}

            {/* Frame's own light/dark toggle — independent of the site-wide theme */}
            <div className={`flex items-center gap-1 rounded-lg p-1 ${frameDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <button
                onClick={() => setFrameTheme('light')}
                aria-label="Light frame"
                className={`p-1.5 rounded-md ${!frameDark ? 'bg-black/10 text-[#141a33]' : 'text-white/40 hover:text-white/70'}`}
              >
                <Sun size={13} />
              </button>
              <button
                onClick={() => setFrameTheme('dark')}
                aria-label="Dark frame"
                className={`p-1.5 rounded-md ${frameDark ? 'bg-white/20 text-white' : 'text-[#141a33]/40 hover:text-[#141a33]/70'}`}
              >
                <Moon size={13} />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`relative rounded-xl overflow-hidden ${frameDark ? 'bg-black' : 'bg-white border border-[#e0e2ec]'}`}
          style={{ aspectRatio: '16/9' }}
        >
          {(mode === 'widget' || mode === 'workspace') && (
            <TradingViewChart symbol={symbol.value} interval={interval.value} theme={frameTheme} candleColors={colors} />
          )}

          {mode === 'workspace' && savedViewsOpen && (
            <div className="absolute inset-0 flex items-start justify-end p-4" onClick={() => setSavedViewsOpen(false)}>
              <div
                className={`w-72 max-h-full overflow-y-auto rounded-xl p-4 shadow-2xl ${frameDark ? 'bg-[#141821] text-white' : 'bg-white text-corporate-text-on-bg'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">Saved Views</h3>
                  <button onClick={() => setSavedViewsOpen(false)} aria-label="Close">
                    <X size={16} className={frameDark ? 'text-white/40' : 'text-gray-400'} />
                  </button>
                </div>
                <p className={`text-xs mb-3 ${frameDark ? 'text-white/50' : 'text-gray-500'}`}>
                  Saves your symbol + timeframe, not drawn lines — no product tier of TradingView allows
                  syncing real drawings outside their own paid library, so this is an honest "view," not a
                  synced tradingview.com account.
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={`"${symbol.label} · ${interval.label}"`}
                    className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none border ${
                      frameDark ? 'bg-black/30 border-white/10 text-white placeholder:text-white/30' : 'bg-white border-gray-200'
                    }`}
                  />
                  <button
                    onClick={saveCurrentView}
                    disabled={saving || !saveName.trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-corporate-accent text-white rounded-lg text-xs font-medium disabled:opacity-50 shrink-0"
                  >
                    <Save size={12} /> Save
                  </button>
                </div>

                {layouts.length === 0 ? (
                  <p className={`text-xs text-center py-4 ${frameDark ? 'text-white/30' : 'text-gray-400'}`}>
                    No saved views yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {layouts.map((l) => (
                      <div
                        key={l.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${frameDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                      >
                        <button onClick={() => openLayout(l.id)} className="flex items-center gap-1.5 text-left flex-1 min-w-0">
                          <FolderOpen size={12} className="text-corporate-hero shrink-0" />
                          <span className="text-xs font-medium truncate">{l.name}</span>
                        </button>
                        <button onClick={() => deleteLayout(l.id)} aria-label="Delete view">
                          <Trash2 size={12} className={frameDark ? 'text-white/30 hover:text-red-400' : 'text-gray-300 hover:text-red-500'} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'external' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
              <div className={`max-w-lg rounded-xl p-6 text-center ${frameDark ? 'bg-[#141821] text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
                <h3 className="font-bold text-lg mb-2">Use your actual TradingView account</h3>
                <p className={`text-sm mb-4 ${frameDark ? 'text-white/60' : 'text-gray-600'}`}>
                  This opens the real tradingview.com in a new tab, with {symbol.label} pre-loaded
                  — your genuine saved drawings, layouts, and watchlist, exactly as you left them.
                </p>
                <OpenInTradingView symbol={symbol.deepLink} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-4">
          <div className={`w-32 h-1.5 rounded-full ${frameDark ? 'bg-white/10' : 'bg-black/10'}`} />
        </div>
      </div>

      <div className="w-full max-w-6xl mt-6">
        <FoldedCard title="Why three modes instead of one embedded TradingView?" summary="Worth reading once">
          <p className="text-sm text-gray-600">
            TradingView's own documentation confirms their self-hosted charting products
            "run independently on your servers, ensuring there is no interaction with
            TradingView on user data" — true even on paid tiers. That means no version of
            an embedded chart can show your real tradingview.com drawings or watchlist. These
            three modes are the actual, honest options: a free live chart, your own saved
            workspace inside Petrazim, or a one-tap link to your real account in its own tab.
          </p>
        </FoldedCard>
      </div>
    </div>
  );
}
