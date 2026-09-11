/**
 * Instrument catalogue — the searchable inventory the Manual Trading
 * symbol search shows.
 *
 * Why this file exists: the search used to call TradingView's own
 * undocumented symbol-search endpoint straight from the browser, and
 * that endpoint now answers 403 to requests that aren't its own widget
 * (verified against the live endpoint). So the panel showed
 * "Searching…" and then nothing — no inventory at all, by direct bug
 * report. This is a real, hand-checked list of `EXCHANGE:TICKER` pairs
 * that TradingView definitely carries, so a pick always lands on a
 * chart that actually loads. Live Binance results from the backend
 * proxy are merged on top of it when a query matches something not
 * listed here.
 */

export interface CatalogueInstrument {
  /** Exchange-format symbol used for ORDER placement. */
  symbol: string;
  /** TradingView exchange prefix — the chart symbol is `exchange:symbol`. */
  exchange: string;
  description: string;
  type: 'crypto' | 'forex' | 'index' | 'stock' | 'commodity';
}

export const INSTRUMENT_CATALOGUE: CatalogueInstrument[] = [
  // Crypto (Binance spot — real TradingView tickers)
  { symbol: 'BTCUSDT', exchange: 'BINANCE', description: 'Bitcoin / TetherUS', type: 'crypto' },
  { symbol: 'ETHUSDT', exchange: 'BINANCE', description: 'Ethereum / TetherUS', type: 'crypto' },
  { symbol: 'SOLUSDT', exchange: 'BINANCE', description: 'Solana / TetherUS', type: 'crypto' },
  { symbol: 'XRPUSDT', exchange: 'BINANCE', description: 'XRP / TetherUS', type: 'crypto' },
  { symbol: 'BNBUSDT', exchange: 'BINANCE', description: 'BNB / TetherUS', type: 'crypto' },
  { symbol: 'ADAUSDT', exchange: 'BINANCE', description: 'Cardano / TetherUS', type: 'crypto' },
  { symbol: 'DOGEUSDT', exchange: 'BINANCE', description: 'Dogecoin / TetherUS', type: 'crypto' },
  { symbol: 'AVAXUSDT', exchange: 'BINANCE', description: 'Avalanche / TetherUS', type: 'crypto' },
  { symbol: 'LINKUSDT', exchange: 'BINANCE', description: 'Chainlink / TetherUS', type: 'crypto' },
  { symbol: 'BTCUSDT.P', exchange: 'BINANCE', description: 'Bitcoin Perpetual', type: 'crypto' },
  { symbol: 'ETHUSDT.P', exchange: 'BINANCE', description: 'Ethereum Perpetual', type: 'crypto' },

  // Forex majors (OANDA feed — free on TradingView)
  { symbol: 'EURUSD', exchange: 'OANDA', description: 'Euro / US Dollar', type: 'forex' },
  { symbol: 'GBPUSD', exchange: 'OANDA', description: 'British Pound / US Dollar', type: 'forex' },
  { symbol: 'USDJPY', exchange: 'OANDA', description: 'US Dollar / Japanese Yen', type: 'forex' },
  { symbol: 'AUDUSD', exchange: 'OANDA', description: 'Australian Dollar / US Dollar', type: 'forex' },
  { symbol: 'USDCAD', exchange: 'OANDA', description: 'US Dollar / Canadian Dollar', type: 'forex' },
  { symbol: 'USDCHF', exchange: 'OANDA', description: 'US Dollar / Swiss Franc', type: 'forex' },
  { symbol: 'NZDUSD', exchange: 'OANDA', description: 'New Zealand Dollar / US Dollar', type: 'forex' },
  { symbol: 'EURJPY', exchange: 'OANDA', description: 'Euro / Japanese Yen', type: 'forex' },
  { symbol: 'GBPJPY', exchange: 'OANDA', description: 'British Pound / Japanese Yen', type: 'forex' },

  // Metals & energy
  { symbol: 'XAUUSD', exchange: 'OANDA', description: 'Gold / US Dollar', type: 'commodity' },
  { symbol: 'XAGUSD', exchange: 'OANDA', description: 'Silver / US Dollar', type: 'commodity' },
  { symbol: 'WTICOUSD', exchange: 'OANDA', description: 'Crude Oil WTI', type: 'commodity' },
  { symbol: 'BCOUSD', exchange: 'OANDA', description: 'Brent Crude Oil', type: 'commodity' },

  // Indices
  { symbol: 'NAS100USD', exchange: 'OANDA', description: 'Nasdaq 100', type: 'index' },
  { symbol: 'SPX500USD', exchange: 'OANDA', description: 'S&P 500', type: 'index' },
  { symbol: 'US30USD', exchange: 'OANDA', description: 'Dow Jones 30', type: 'index' },
  { symbol: 'DE30EUR', exchange: 'OANDA', description: 'Germany 40 (DAX)', type: 'index' },
  { symbol: 'UK100GBP', exchange: 'OANDA', description: 'FTSE 100', type: 'index' },
  { symbol: 'JP225USD', exchange: 'OANDA', description: 'Nikkei 225', type: 'index' },

  // Stocks
  { symbol: 'AAPL', exchange: 'NASDAQ', description: 'Apple Inc.', type: 'stock' },
  { symbol: 'MSFT', exchange: 'NASDAQ', description: 'Microsoft Corp.', type: 'stock' },
  { symbol: 'NVDA', exchange: 'NASDAQ', description: 'NVIDIA Corp.', type: 'stock' },
  { symbol: 'TSLA', exchange: 'NASDAQ', description: 'Tesla Inc.', type: 'stock' },
  { symbol: 'AMZN', exchange: 'NASDAQ', description: 'Amazon.com Inc.', type: 'stock' },
  { symbol: 'GOOGL', exchange: 'NASDAQ', description: 'Alphabet Inc.', type: 'stock' },
  { symbol: 'META', exchange: 'NASDAQ', description: 'Meta Platforms Inc.', type: 'stock' },
  { symbol: 'AMD', exchange: 'NASDAQ', description: 'Advanced Micro Devices', type: 'stock' },
  { symbol: 'COIN', exchange: 'NASDAQ', description: 'Coinbase Global Inc.', type: 'stock' },
  { symbol: 'SPY', exchange: 'AMEX', description: 'SPDR S&P 500 ETF', type: 'stock' },
];

/** Common shorthands traders type that aren't the TradingView ticker. */
const ALIASES: Record<string, string> = {
  GOLD: 'XAUUSD', SILVER: 'XAGUSD', NAS100: 'NAS100USD', US100: 'NAS100USD',
  SPX: 'SPX500USD', SP500: 'SPX500USD', US500: 'SPX500USD', DOW: 'US30USD',
  US30: 'US30USD', DAX: 'DE30EUR', FTSE: 'UK100GBP', NIKKEI: 'JP225USD',
  OIL: 'WTICOUSD', WTI: 'WTICOUSD', BRENT: 'BCOUSD', BTC: 'BTCUSDT', ETH: 'ETHUSDT',
};

export function searchCatalogue(query: string, limit = 25): CatalogueInstrument[] {
  const q = query.trim().toUpperCase();
  if (!q) return INSTRUMENT_CATALOGUE.slice(0, limit);
  const alias = ALIASES[q];
  const scored = INSTRUMENT_CATALOGUE.map((i) => {
    const sym = i.symbol.toUpperCase();
    let score = -1;
    if (alias && sym === alias) score = 0;
    else if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (sym.includes(q)) score = 2;
    else if (i.description.toUpperCase().includes(q)) score = 3;
    else if (i.exchange.toUpperCase().startsWith(q)) score = 4;
    return { i, score };
  }).filter((s) => s.score >= 0).sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.i);
}
