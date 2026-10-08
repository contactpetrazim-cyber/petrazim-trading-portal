import type { Candle, ChartLine, ChartMarker } from '../components/CandleChart';
import { formatSignedMoney } from '../components/TradingViewChart';
import type { Trade } from '../types';

// Shared Entry/SL/TP/Exit reference lines + entry/exit triangle
// markers for a real Trade, on a FLAT (non-panned) candle array — by
// direct request ("No entry and exit triangle fix ... implement on
// all charts portal wide ... same positioning style and snapshot for
// triangles"). Ported from PositionOnChartModal.tsx's own
// positionLines/markers (the On Chart tool, which already had this)
// for ChartOPage.tsx (OANDA) and MT5Page.tsx (MetaTrader), neither of
// which ever got it. Both show a flat, un-panned ~200-candle window
// (no visibleStart offset to account for, unlike PositionOnChartModal's
// own pannable candle pool — see that modal's own comment: "no
// visibleStart offset"), so this is a simpler, index-straight-into-
// `candles` version rather than sharing that modal's pan-aware one.

const ENTRY_LINE_COLOR = '#2563eb';
const SL_LINE_COLOR = '#ef4444';
const TP_LINE_COLOR = '#22c55e';
const EXIT_LINE_COLOR = '#f59e0b';

export function fmtPrice(p: number): string {
  return p.toFixed(2);
}

/** Floor-match on candle OPEN time — the candle a timestamp actually
 * fell DURING, not whichever one is numerically closest (same fix,
 * same reason as PositionOnChartModal/TradeSnapshotModal's own
 * identical nearestCandleIndex: "nearest" silently pointed one candle
 * too late roughly half the time). `candles` must be sorted ascending
 * by time, same as every other chart in the portal. */
export function nearestCandleIndex(candles: Candle[], iso: string | null | undefined): number | null {
  if (!iso || candles.length === 0) return null;
  const target = new Date(iso).getTime();
  let idx = 0;
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time ?? 0;
    if (t <= target) idx = i;
    else break;
  }
  return idx;
}

/** One position's own Entry/SL/TP1-3/Exit dashed reference lines —
 * `tag` (" #2" etc.) only needed once more than one position shares
 * this chart. */
export function positionOverlayLines(t: Trade, tag: string = ''): ChartLine[] {
  const isLong = t.direction === 'long';
  const pending = t.status === 'pending';
  const dirLabel = isLong ? 'LONG' : 'SHORT';
  const entryStatusLabel = `${dirLabel} (${pending ? 'Pending' : 'Live'})${tag}`;
  const entryPnlSuffix = !pending && t.unrealized_pnl != null
    ? { text: formatSignedMoney(t.unrealized_pnl), color: t.unrealized_pnl >= 0 ? '#22c55e' : '#ef4444' }
    : undefined;
  const out: ChartLine[] = [];
  if (t.entry_price != null) out.push({ price: t.entry_price, color: ENTRY_LINE_COLOR, dashed: true, label: fmtPrice(t.entry_price), label2: entryStatusLabel, label2Suffix: entryPnlSuffix });
  if (t.stop_loss != null) out.push({ price: t.stop_loss, color: SL_LINE_COLOR, dashed: true, label: `SL${tag} ${fmtPrice(t.stop_loss)}` });
  if (t.take_profit != null) out.push({ price: t.take_profit, color: TP_LINE_COLOR, dashed: true, label: `TP1${tag} ${fmtPrice(t.take_profit)}` });
  if (t.take_profit_2 != null) out.push({ price: t.take_profit_2, color: TP_LINE_COLOR, dashed: true, label: `TP2${tag} ${fmtPrice(t.take_profit_2)}` });
  if (t.take_profit_3 != null) out.push({ price: t.take_profit_3, color: TP_LINE_COLOR, dashed: true, label: `TP3${tag} ${fmtPrice(t.take_profit_3)}` });
  if (t.exit_price != null) out.push({ price: t.exit_price, color: EXIT_LINE_COLOR, dashed: true, label: `Exit${tag} ${fmtPrice(t.exit_price)}` });
  return out;
}

/** Entry (triangle-up)/Exit (triangle-down) candle markers for a flat
 * candle array — indices straight into `candles`, no visibleStart
 * offset. Drops a marker whose timestamp predates every fetched
 * candle's own time (nearestCandleIndex would otherwise clamp it to
 * index 0, a misleading "entry was on the very first visible candle"
 * rather than "entry isn't in this window at all") instead of
 * rendering something wrong. */
export function positionOverlayMarkers(trades: Trade[], candles: Candle[]): ChartMarker[] {
  if (candles.length === 0) return [];
  const firstTime = candles[0].time ?? 0;
  const out: ChartMarker[] = [];
  for (const t of trades) {
    if (t.entry_price != null && t.entry_timestamp) {
      const target = new Date(t.entry_timestamp).getTime();
      if (target >= firstTime) {
        const idx = nearestCandleIndex(candles, t.entry_timestamp);
        if (idx != null) out.push({ index: idx, price: t.entry_price, label: '', color: ENTRY_LINE_COLOR, shape: 'triangle-up' });
      }
    }
    if (t.exit_price != null && t.exit_timestamp) {
      const target = new Date(t.exit_timestamp).getTime();
      if (target >= firstTime) {
        const idx = nearestCandleIndex(candles, t.exit_timestamp);
        if (idx != null) out.push({ index: idx, price: t.exit_price, label: '', color: EXIT_LINE_COLOR, shape: 'triangle-down' });
      }
    }
  }
  return out;
}
