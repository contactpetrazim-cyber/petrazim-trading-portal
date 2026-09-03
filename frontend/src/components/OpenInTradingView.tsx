import { ExternalLink } from 'lucide-react';

/**
 * OpenInTradingView — Alternative C from the boundary table: CONFIRMED
 * working. TradingView supports symbol-in-URL linking, so this opens
 * the user's REAL tradingview.com account, in a new tab, with the
 * right symbol pre-loaded — genuinely their real drawings, real
 * watchlists, real everything. It's just not embedded inside our
 * frame, because that part is the one TradingView doesn't allow.
 *
 * This is the honest, always-available fallback for anyone who wants
 * their actual TradingView experience rather than the free widget or
 * a Petrazim-hosted Advanced Charts layout.
 */
export function OpenInTradingView({ symbol = 'EURUSD' }: { symbol?: string }) {
  const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-corporate-hero text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
    >
      <ExternalLink size={16} />
      Open {symbol} in my real TradingView account
    </a>
  );
}
