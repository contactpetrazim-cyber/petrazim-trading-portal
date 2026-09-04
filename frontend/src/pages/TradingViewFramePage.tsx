import { useEffect, useState } from 'react';
import { Sun, Moon, Save, Trash2, FolderOpen } from 'lucide-react';
import { TradingViewChart } from '../components/TradingViewChart';
import { OpenInTradingView } from '../components/OpenInTradingView';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { FoldedCard } from '../components/FoldedCard';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * TradingViewFramePage — v3. Two real additions on top of v2's three
 * honest modes:
 *
 * 1. The frame's own local light/dark toggle (Sun/Moon), independent
 *    of the site-wide theme — Section 8 of the UI Design Handover
 *    specifies this exactly ("a trader may want a bright chart while
 *    the rest of the site stays dark, or vice versa") but it was never
 *    actually built; the bezel was hardcoded dark always.
 * 2. "My Workspace" is now a real saved-view feature, not a static
 *    placeholder — GET/POST/DELETE /tradingview/charts/layouts
 *    (chart_layouts.py) already existed with zero frontend. A saved
 *    layout stores {symbol, interval} as its `content` (JSON string) —
 *    genuinely useful and genuinely real, but NOT the same thing as
 *    the paid Advanced Charts Library's own save/load contract this
 *    endpoint shape was built to mirror: that library extracts real
 *    drawn trendlines/studies as its content, which requires a signed
 *    TradingView Advanced Charts license this app doesn't have. This
 *    saves symbol+interval "views," not drawings — still an honest,
 *    working feature, just a narrower one than the full library gives.
 */

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT', deepLink: 'BTCUSDT' },
  { label: 'EUR/USD', value: 'OANDA:EURUSD', deepLink: 'EURUSD' },
  { label: 'GBP/USD', value: 'OANDA:GBPUSD', deepLink: 'GBPUSD' },
  { label: 'XAU/USD', value: 'OANDA:XAUUSD', deepLink: 'XAUUSD' },
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
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [interval, setIntervalValue] = useState(INTERVALS[1]);
  const [mode, setMode] = useState<Mode>('widget');
  const [frameTheme, setFrameTheme] = useState<FrameTheme>('dark');
  const [layouts, setLayouts] = useState<LayoutSummary[]>([]);
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
    setMode('widget');
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

          <div className="flex items-center gap-3">
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

            {mode === 'widget' && (
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
          {mode === 'widget' && (
            <TradingViewChart symbol={symbol.value} interval={interval.value} theme={frameTheme} />
          )}

          {mode === 'workspace' && (
            <div className="absolute inset-0 overflow-y-auto p-6 md:p-10">
              <div className={`max-w-lg mx-auto rounded-xl p-6 ${frameDark ? 'bg-[#141821] text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
                <h3 className="font-bold text-lg mb-2">Your Petrazim Workspace</h3>
                <p className={`text-sm mb-4 ${frameDark ? 'text-white/60' : 'text-gray-600'}`}>
                  Save your current symbol + timeframe as a named view, and jump straight back to it later.
                  This is a Petrazim-hosted saved view, not a synced tradingview.com account — no product
                  tier of TradingView allows that kind of sync — but it's genuinely yours and genuinely saved.
                </p>

                <div className="flex gap-2 mb-5">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={`Save "${symbol.label} · ${interval.label}" as…`}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none border ${
                      frameDark ? 'bg-black/30 border-white/10 text-white placeholder:text-white/30' : 'bg-white border-gray-200'
                    }`}
                  />
                  <button
                    onClick={saveCurrentView}
                    disabled={saving || !saveName.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-corporate-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>

                {layouts.length === 0 ? (
                  <p className={`text-xs text-center py-4 ${frameDark ? 'text-white/30' : 'text-gray-400'}`}>
                    No saved views yet — save your first one above.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {layouts.map((l) => (
                      <div
                        key={l.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${frameDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                      >
                        <button onClick={() => openLayout(l.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                          <FolderOpen size={14} className="text-corporate-hero shrink-0" />
                          <span className="text-sm font-medium truncate">{l.name}</span>
                          {l.symbol && <span className={`text-xs shrink-0 ${frameDark ? 'text-white/30' : 'text-gray-400'}`}>{l.symbol}</span>}
                        </button>
                        <button onClick={() => deleteLayout(l.id)} aria-label="Delete view">
                          <Trash2 size={13} className={frameDark ? 'text-white/30 hover:text-red-400' : 'text-gray-300 hover:text-red-500'} />
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
