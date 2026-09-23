import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Save, Trash2, FolderOpen, X, TrendingUp, Target, LineChart, Search } from 'lucide-react';
import { TradingViewChart } from '../components/TradingViewChart';
import { CandleColorPicker } from '../components/CandleColorPicker';
import { PositionManager } from '../components/PositionManager';
import { PositionOnChartModal } from '../components/PositionOnChartModal';
import { tradeToChartPosition, NoPositionCard, PositionLoadingCard } from '../components/ChartPanel';
import { useEffectiveChartColors } from '../hooks/useCandleColors';
import { OpenInTradingView } from '../components/OpenInTradingView';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { FoldedCard } from '../components/FoldedCard';
import { PairsPanel } from '../components/PairsPanel';
import { useQuickPairsStore } from '../hooks/useQuickPairs';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';
import { tradesApi } from '../services/api';
import type { Trade } from '../types';

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

// Symbols come from the shared quick-links store (useQuickPairs) now —
// the old hardcoded four-pill row is gone, by direct request: pairs are
// picked from the search and saved as quick-links, and the same folded
// "Pairs" button appears on every chart in the app.



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
  const { colors, chartStyle, hydrated: colorsHydrated, applyLocal, applyGlobal, resetLocal, resetGlobal } = useEffectiveChartColors();
  const { pairs } = useQuickPairsStore();
  const [selectedTv, setSelectedTv] = useState<string>(pairs[0]?.tv);
  const selectedPair = pairs.find((p) => p.tv === selectedTv) ?? pairs[0];
  const symbol = {
    label: selectedPair.label,
    value: selectedPair.tv,
    deepLink: selectedPair.trade,
    tradeSymbol: selectedPair.trade,
  };
  const [pairsOpen, setPairsOpen] = useState(false);

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

  // Position management + on-chart view for whatever open position or
  // pending order the trader already has on the symbol currently
  // shown — by direct request ("can this be done on my workspace
  // charts too ... make the position chart markers show on my
  // workstation charts"). Same pattern ChartPanel.tsx uses (folded
  // "Position"/"On Chart" toggles, PositionManager for real edit/
  // cancel/partial-close, PositionOnChartModal for real lines drawn on
  // this app's own CandleChart) — this page renders TradingViewChart
  // directly rather than through ChartPanel, so it needs its own copy
  // of the same toggles. Same polling shape as ManualTradingPage.tsx
  // (an open position takes priority over a pending order on the same
  // symbol).
  const [openPositionTrade, setOpenPositionTrade] = useState<Trade | null>(null);
  const [pendingOrderTrade, setPendingOrderTrade] = useState<Trade | null>(null);
  // Same "you have an order elsewhere" hint ChartPanel/ManualTradingPage
  // now surface, one row per other symbol (not just the first found) —
  // see NoPositionCard's own docstring for the bug report this fixes
  // ("Goto button from EURUSD does not deploy auto to the correct
  // chart with position trade orders (BTCUSD)") and why a list rather
  // than a dropdown.
  const [otherOpenTrades, setOtherOpenTrades] = useState<Trade[]>([]);
  // True only until this FIRST poll resolves — by direct bug report
  // ("a time lag after position is clicked before the blue button
  // shows — You have a pending order on BTCUSDT instead"). Before that
  // first poll resolved, position/otherOpenTrades were indistinguishable
  // from "confirmed empty," so the panel below rendered a confident
  // "no order" that then visibly flipped once the real answer arrived.
  const [positionLoading, setPositionLoading] = useState(true);
  const [positionOpen, setPositionOpen] = useState(false);
  const [onChartOpen, setOnChartOpen] = useState(false);
  const loadOpenPosition = useCallback(() => {
    return Promise.all([
      tradesApi.getActiveTrades(),
      tradesApi.getTrades({ status: 'pending' }),
    ]).then(([active, pending]) => {
      setOpenPositionTrade(active.find((t) => t.symbol === symbol.tradeSymbol && t.entry_price != null) ?? null);
      setPendingOrderTrade(pending.find((t) => t.symbol === symbol.tradeSymbol && t.entry_price != null) ?? null);
      const bySymbol = new Map<string, Trade>();
      active.filter((t) => t.symbol !== symbol.tradeSymbol && t.entry_price != null).forEach((t) => bySymbol.set(t.symbol, t));
      pending.filter((t) => t.symbol !== symbol.tradeSymbol && t.entry_price != null).forEach((t) => { if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t); });
      setOtherOpenTrades(Array.from(bySymbol.values()));
    }).catch(() => { setOpenPositionTrade(null); setPendingOrderTrade(null); setOtherOpenTrades([]); })
      .finally(() => setPositionLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol.tradeSymbol, token]);
  useEffect(() => {
    if (!token) return;
    loadOpenPosition();
    const t = setInterval(loadOpenPosition, 8000);
    return () => clearInterval(t);
  }, [loadOpenPosition, token]);

  const position: Trade | null = openPositionTrade ?? pendingOrderTrade;

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
      const foundPair = pairs.find((p) => p.tv === parsed.symbol);
      const foundInterval = INTERVALS.find((i) => i.value === parsed.interval);
      if (foundPair) setSelectedTv(foundPair.tv);
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
                {m === 'widget' ? 'Chart' : m === 'workspace' ? 'My Workspace' : 'Real TradingView'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* "Pairs" — same folded button pattern as every other chart
                in the app (default folded), instead of a fixed row of
                symbol pills. */}
            <button
              onClick={() => setPairsOpen((o) => !o)}
              aria-label={pairsOpen ? 'Hide pairs' : 'Show pairs'}
              title="Search instrument pairs"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${
                pairsOpen ? 'bg-corporate-accent text-white' : frameDark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-[#141a33]/60 hover:text-[#141a33]'
              }`}
            >
              <Search size={13} /> Pairs
            </button>


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

            {mode !== 'external' && (
              <CandleColorPicker
                dark={frameDark}
                colors={colors} chartStyle={chartStyle}
                onChangeLocal={applyLocal} onChangeGlobal={applyGlobal}
                onResetLocal={resetLocal} onResetGlobal={resetGlobal}
              />
            )}

            {mode === 'workspace' && (
              <button
                onClick={() => setSavedViewsOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${frameDark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-[#141a33]/60 hover:text-[#141a33]'}`}
              >
                <FolderOpen size={13} /> Saved Views
              </button>
            )}

            {/* Permanent — by direct request ("make 'Position' and 'On
                Chart' a permanent feature on all charts ... you can
                always click on it to review order position"), not
                conditional on `position` any more. */}
            {mode !== 'external' && (
              <button
                onClick={() => setPositionOpen((o) => !o)}
                aria-label={positionOpen ? 'Hide position management' : 'Review or manage this position'}
                title={position ? 'Edit SL/TP, partial close or cancel this order' : 'No open or pending order on this symbol yet'}
                className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${
                  positionOpen ? 'bg-blue-600 text-white' : frameDark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-[#141a33]/60 hover:text-[#141a33]'
                }`}
              >
                <Target size={13} /> Position
              </button>
            )}
            {mode !== 'external' && (
              <button
                onClick={() => setOnChartOpen(true)}
                aria-label="Show Entry/SL/TP drawn on a real chart"
                title={position ? 'Open a chart with Entry/SL/TP actually drawn on it' : 'Open a chart for this symbol'}
                className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium ${frameDark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-black/5 text-[#141a33]/60 hover:text-[#141a33]'}`}
              >
                <LineChart size={13} /> On Chart
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

        {pairsOpen && (
          <div className="px-2">
            <PairsPanel selected={selectedPair} onSelect={(p) => setSelectedTv(p.tv)} dark={frameDark} />
          </div>
        )}

        {positionOpen && (
          <div className="px-2 mb-2">
            {positionLoading && !position
              ? <PositionLoadingCard dark={frameDark} />
              : position
                ? <PositionManager trade={position} dark={frameDark} onChanged={loadOpenPosition} />
                : <NoPositionCard dark={frameDark} otherTrades={otherOpenTrades} />}
          </div>
        )}

        <div
          className={`relative rounded-xl overflow-hidden ${frameDark ? 'bg-black' : 'bg-white border border-[#e0e2ec]'}`}
          style={{ aspectRatio: '16/9' }}
        >
          {(mode === 'widget' || mode === 'workspace') && (
            colorsHydrated
              ? <TradingViewChart symbol={symbol.value} interval={interval.value} theme={frameTheme} candleColors={colors} chartStyle={chartStyle} />
              : (
                <div className={`absolute inset-0 flex items-center justify-center text-sm ${frameDark ? 'text-white/40' : 'text-gray-400'}`}>
                  <span className="inline-block w-3 h-3 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Loading chart…
                </div>
              )
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

      {onChartOpen && (
        <PositionOnChartModal
          position={position ? tradeToChartPosition(position) : undefined} trade={position} symbol={position?.symbol ?? symbol.tradeSymbol}
          bullColor={colors.upColor} bearColor={colors.downColor} initialInterval={interval.value}
          onClose={() => setOnChartOpen(false)} onChanged={loadOpenPosition}
        />
      )}

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
