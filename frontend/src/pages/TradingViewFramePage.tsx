import { useState } from 'react';
import { TradingViewChart } from '../components/TradingViewChart';
import { OpenInTradingView } from '../components/OpenInTradingView';
import { PetrazimLogo } from '../components/PetrazimLogo';
import { FoldedCard } from '../components/FoldedCard';

/**
 * TradingViewFramePage — v2, rebuilt after verifying TradingView's
 * actual current documentation (see docs/TRADINGVIEW_BOUNDARY_TABLE.md
 * for the full research). Previous version attempted a raw iframe of
 * tradingview.com/chart and detected if it was blocked. That's been
 * replaced: TradingView's own FAQ confirms their authenticated app
 * cannot be embedded and no product tier syncs a user's real account
 * data — so this no longer guesses, it presents the three things that
 * are ACTUALLY real, inside the Petrazim Trading Frame bezel:
 *
 * 1. Free Widget — CONFIRMED, live now, view-only, no login.
 * 2. Petrazim Workspace — a Petrazim-hosted charting surface with OUR
 *    OWN saved layouts (chart_layouts.py backend, built this round) —
 *    genuinely persistent, genuinely yours, just not synced with
 *    tradingview.com.
 * 3. Open in real TradingView — CONFIRMED, opens their actual account
 *    in a new tab via symbol deep-linking.
 *
 * No option here claims to sync a real TradingView account. That
 * claim is architecturally false regardless of which button a user
 * picks, so it's never made.
 */

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT', deepLink: 'BTCUSDT' },
  { label: 'EUR/USD', value: 'OANDA:EURUSD', deepLink: 'EURUSD' },
  { label: 'GBP/USD', value: 'OANDA:GBPUSD', deepLink: 'GBPUSD' },
  { label: 'XAU/USD', value: 'OANDA:XAUUSD', deepLink: 'XAUUSD' },
];

type Mode = 'widget' | 'workspace' | 'external';

export function TradingViewFramePage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [mode, setMode] = useState<Mode>('widget');

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4 md:p-10">
      <div className="w-full max-w-6xl bg-gradient-to-b from-[#1c1c1e] to-[#0a0a0a] rounded-3xl p-4 md:p-6 shadow-2xl">
        <div className="flex items-center justify-between px-2 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <PetrazimLogo height={32} />
            <span className="text-white/40 text-xs font-medium tracking-wide">PETRAZIM TRADING FRAME</span>
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(['widget', 'workspace', 'external'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === m ? 'bg-corporate-accent text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {m === 'widget' ? 'Free Chart' : m === 'workspace' ? 'My Workspace' : 'Real TradingView'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {SYMBOLS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSymbol(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  symbol.value === s.value ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          {mode === 'widget' && (
            <TradingViewChart symbol={symbol.value} interval="60" theme="dark" />
          )}

          {mode === 'workspace' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
              <div className="max-w-lg bg-corporate-bg rounded-xl p-6 text-center">
                <h3 className="font-bold text-corporate-text-on-bg text-lg mb-2">
                  Your Petrazim Workspace
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  A charting surface hosted by Petrazim, with your own saved layouts and
                  drawings — persisted in your Petrazim account. This is not the same as your
                  tradingview.com account (no product tier of TradingView allows that kind of
                  sync), but it's genuinely yours and genuinely saved.
                </p>
                <p className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                  Backend ready (save/load API built) — the self-hosted Advanced Charts Library
                  itself is the next integration step to make this screen fully interactive.
                </p>
              </div>
            </div>
          )}

          {mode === 'external' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
              <div className="max-w-lg bg-corporate-bg rounded-xl p-6 text-center">
                <h3 className="font-bold text-corporate-text-on-bg text-lg mb-2">
                  Use your actual TradingView account
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  This opens the real tradingview.com in a new tab, with {symbol.label} pre-loaded
                  — your genuine saved drawings, layouts, and watchlist, exactly as you left them.
                </p>
                <OpenInTradingView symbol={symbol.deepLink} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-4">
          <div className="w-32 h-1.5 bg-white/10 rounded-full" />
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
