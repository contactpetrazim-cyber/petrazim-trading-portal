import { useState } from 'react';
import { TradingViewChart } from '../components/TradingViewChart';
import { useThemeStore } from '../hooks/useTheme';

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT' },
  { label: 'EUR/USD', value: 'OANDA:EURUSD' },
  { label: 'GBP/USD', value: 'OANDA:GBPUSD' },
  { label: 'XAU/USD', value: 'OANDA:XAUUSD' },
];

/**
 * ChartPage — the split-screen layout from your reference: live
 * TradingView frame on the left, Trade AI accessible via the floating
 * icon (per your spec: "just a floating chat icon", not a fixed side
 * panel). FloatingTradeAI itself is mounted once, globally, by
 * CorporateLayout — not per-page — so it doesn't need repeating here.
 */
export function ChartPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [symbol, setSymbol] = useState(SYMBOLS[0].value);

  return (
    <div className={`h-[calc(100vh-5rem)] flex flex-col ${dark ? 'bg-smc-dark' : 'bg-corporate-bg'}`}>
      <div className={`flex items-center gap-2 p-3 border-b ${dark ? 'border-smc-border' : 'border-corporate-bg'}`}>
        {SYMBOLS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSymbol(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              symbol === s.value
                ? dark ? 'bg-smc-accent text-white' : 'bg-corporate-hero text-white'
                : dark ? 'bg-smc-card text-gray-400 hover:text-white' : 'bg-white text-gray-500 hover:text-corporate-text-on-bg'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        <TradingViewChart symbol={symbol} interval="60" theme={theme} />
      </div>
    </div>
  );
}
