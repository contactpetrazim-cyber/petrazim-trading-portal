import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { tradesApi } from '../services/api';
import type { Trade } from '../types';
import { TradeSnapshotModal } from './TradeSnapshotModal';

/**
 * ReplayRealSetup — "Replay a real setup" (SMC Academy plan item 5):
 * finds a real, closed, this-bot's-own past trade via the already-
 * shipped `GET /trades` (bot_id + status=closed, most-recent-first)
 * and `GET /trades/{id}/snapshot` endpoints, then opens the existing
 * `TradeSnapshotModal` on it — the exact real historical-candle +
 * entry/SL/TP rendering the live Trades page already uses, reused
 * here rather than rebuilt. No new backend needed for this piece.
 *
 * Per the plan's own non-negotiable ("status labels only shown when
 * backed by a real source, 'Unavailable' otherwise"): if this bot
 * genuinely has no closed trade yet, this says so plainly instead of
 * fabricating a synthetic "replay."
 */
export function ReplayRealSetup({ botId, dark = false }: { botId: string; dark?: boolean }) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tradesApi.getTrades({ bot_id: botId, status: 'closed', limit: 1 })
      .then((trades) => { if (!cancelled) setTrade(trades[0] ?? null); })
      .catch(() => { if (!cancelled) setTrade(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [botId]);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  if (loading) {
    return <p className={`text-xs ${mutedCls}`}>Checking for a real past trade to replay…</p>;
  }

  if (!trade) {
    return (
      <p className={`text-xs ${mutedCls}`}>
        Replay a real setup: Unavailable — this bot has no closed trade yet to replay.
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-corporate-hero text-white"
      >
        <PlayCircle size={16} /> Replay a real {trade.symbol} setup ({trade.direction})
      </button>
      {open && <TradeSnapshotModal tradeId={trade.id} trade={trade} dark={dark} onClose={() => setOpen(false)} />}
    </>
  );
}
