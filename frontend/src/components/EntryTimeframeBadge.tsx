import { getBotEntryTimeframeLabel } from '../lib/botEntryTimeframe';

/**
 * EntryTimeframeBadge -- "which timeframe the bot actually is trading
 * from ... key info to be displayed portal wide" (direct request).
 * The real timeframe that bot's own entry POI (order block / FVG /
 * Wyckoff confirmation candle) was detected from, verified directly
 * against each bot's own analyze() method (see botEntryTimeframe.ts),
 * not inferred from its multi-timeframe REQUIREMENT list -- several
 * bots read a coarser timeframe only for HTF bias/gating, never for
 * the entry zone itself. Renders nothing for a manual trade or an
 * unrecognized bot_id -- never fabricates a timeframe it can't verify.
 */
export function EntryTimeframeBadge({ botId, dark, className }: { botId?: string | null; dark?: boolean; className?: string }) {
  const label = getBotEntryTimeframeLabel(botId);
  if (!label) return null;
  return (
    <span
      className={className ?? `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${dark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}
      title="The real timeframe this bot's entry zone (order block / FVG / confirmation candle) was detected from"
    >
      Entry TF: {label}
    </span>
  );
}
