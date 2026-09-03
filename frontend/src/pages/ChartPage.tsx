import { useState } from 'react';
import { TradingViewChart } from '../components/TradingViewChart';
import { FloatingTradeAI } from '../components/FloatingTradeAI';

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
 * panel — reusing FloatingTradeAI rather than building a second,
 * competing chat surface).
 */
export function ChartPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0].value);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-smc-dark">
      <div className="flex items-center gap-2 p-3 border-b border-smc-border">
        {SYMBOLS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSymbol(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              symbol === s.value ? 'bg-smc-accent text-white' : 'bg-smc-card text-gray-400 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        <TradingViewChart symbol={symbol} interval="60" theme="dark" />
      </div>

      <FloatingTradeAI />
    </div>
  );
}
