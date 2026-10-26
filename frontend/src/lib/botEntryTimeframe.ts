// Which timeframe each bot's REAL entry POI (order block / FVG /
// Wyckoff spring-upthrust confirmation candle) is actually detected
// from -- verified directly against each bot's own analyze() method
// in backend/app/core/bot_strategies.py (file:line checked per entry,
// not inferred from a bot's multi-timeframe REQUIREMENT list, since
// several bots read a coarser timeframe only for HTF bias/gating,
// never for the entry zone itself -- e.g. bot_6 requires 1H+15M+5M
// candles but its own entry always comes from 5M).
//
// By direct request ("include information of which timeframe the bot
// actually is trading from ... key info to be displayed portal wide"
// / "match the timeframe to how the trade was actually set up ...
// otherwise you're asking Time Machine a question about a completely
// different trade").
//
// bot_2/bot_11/bot_12 genuinely try BOTH 4H and 1H for the order
// block (4H first, 1H fallback) -- shown as "4H/1H"; `timeMachineValue`
// picks the finer of the two, since Time Machine's own dropdown can
// only represent one choice and the finer timeframe is where the
// trade's actual entry/stop sensitivity lives.
const BOT_ENTRY_TIMEFRAME: Record<string, { label: string; timeMachineValue: string }> = {
  '1': { label: '4H', timeMachineValue: '4h' },      // bot_1_macro_swing -- 4H order block
  '2': { label: '4H/1H', timeMachineValue: '1h' },   // bot_2_ob_reversal -- 4H order block, 1H fallback
  '3': { label: '1H', timeMachineValue: '1h' },      // bot_3_fvg_expansion -- 1H FVG
  '4': { label: '1H', timeMachineValue: '1h' },      // bot_4_volume_liq -- 1H spring/upthrust candle
  '5': { label: '5M', timeMachineValue: '5m' },      // bot_5_jeafx -- 5M FVG / confirmation candle
  '6': { label: '5M', timeMachineValue: '5m' },      // bot_6_smc_v2 -- 5M FVG / confirmation candle
  '7': { label: '1H', timeMachineValue: '1h' },      // bot_7_fvg_expansion_v3 -- 1H FVG
  '8': { label: '5M', timeMachineValue: '5m' },      // bot_8_smc_v2_single_anchor -- 5M FVG / confirmation candle
  '9': { label: '1H', timeMachineValue: '1h' },      // bot_9_volume_liq_wide_range -- 1H spring/upthrust candle
  '10': { label: '1H', timeMachineValue: '1h' },     // bot_10_volume_liq_held_reclaim -- 1H spring/upthrust candle
  '11': { label: '4H/1H', timeMachineValue: '1h' },  // bot_11_ob_reversal_wider_stop -- same as bot_2
  '12': { label: '4H/1H', timeMachineValue: '1h' },  // bot_12_ob_reversal_runner -- reuses bot_2's own class
  '13': { label: '1H', timeMachineValue: '1h' },     // bot_13_fvg_expansion_htf_gated -- same as bot_3
  '14': { label: '5M', timeMachineValue: '5m' },     // bot_14_jeafx_htf_gated -- same as bot_5
  '15': { label: '5M', timeMachineValue: '5m' },     // reuses bot_6's own class
  '16': { label: '5M', timeMachineValue: '5m' },     // reuses bot_8's own class
  '17': { label: '1H', timeMachineValue: '1h' },     // bot_17_fvg_expansion_ob_poi -- 1H order block
  '18': { label: '1H', timeMachineValue: '1h' },     // bot_18_smc_v2_ob_poi -- 1H order block
};

function lookup(botId: string | null | undefined) {
  const m = botId?.match(/^bot_(\d+)_/);
  if (!m) return null;
  return BOT_ENTRY_TIMEFRAME[m[1]] ?? null;
}

/** Human-readable label ("4H", "5M", "4H/1H") for display. Null for a
 * manual trade (no numbered bot_id to look up) or an unrecognized one
 * -- never fabricates a timeframe it can't verify. */
export function getBotEntryTimeframeLabel(botId: string | null | undefined): string | null {
  return lookup(botId)?.label ?? null;
}

/** Same lookup, returning the exact value Time Machine's own
 * exchange/timeframe dropdown expects ('1h', '5m', ...) -- used so
 * "Check odds" replays against the SAME timeframe the bot's entry was
 * actually picked from, not whatever the form last had selected. */
export function getBotEntryTimeMachineTimeframe(botId: string | null | undefined): string | null {
  return lookup(botId)?.timeMachineValue ?? null;
}
