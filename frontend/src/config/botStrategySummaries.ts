// Strategy summaries — by direct request ("Add the bot strategy
// summary under a 'Strategy' link similar to the Reasoning style in
// the individual Bot cards - portal wide"). One concise summary per
// real strategy (strategy_key "bot_1".."bot_6"), each transcribed
// directly from that strategy's own class docstring in
// backend/app/core/bot_strategies.py — not paraphrased from memory —
// so this stays a faithful, verified description of what each bot's
// real `analyze()` actually does, the same standard the curriculum
// docs in /curriculum hold themselves to.
export const BOT_STRATEGY_SUMMARIES: Record<string, string> = {
  bot_1:
    "Pure Macro Swing Structure (Damir/Brooks style). Trades major " +
    "structural transitions on 1D/4H, waiting for a confirmed BOS " +
    "(not CHoCH) before entering on a retracement to the 50% level " +
    "of the expansion or prior structure. Stop sits beyond the swing " +
    "point that defined the structure; target is at least 3:1, often " +
    "higher for swing holds spanning multiple days.",
  bot_2:
    "HF Order Block Reversal (ICT Core Mentorship style). Trades " +
    "reversals inside a 4H/1H Order Block once price returns to it " +
    "(discount for longs, premium for shorts), waiting for an " +
    "internal 15M liquidity sweep followed by a CHoCH + FVG in the " +
    "higher-timeframe bias direction. Stop sits tight, just beyond " +
    "the sweep's own extreme; target is 3:1, often scaled out at 2R.",
  bot_3:
    "Imbalance Expansion & FVG Fill (Photon/Phantom style). Trades " +
    "unmitigated 1H/4H Fair Value Gaps once price returns and " +
    "partially fills them (30-70%), entering on a 15M BOS confirming " +
    "the FVG's own direction. Stop sits beyond the FVG's extreme or " +
    "recent structure, then trails by each new BOS; target is the " +
    "next liquidity pool or 4R+.",
  bot_4:
    "Volume & Liquidity Sweep Specialist (Dalton/Weis/Wyckoff " +
    "style). Trades Wyckoff Spring/Upthrust false breaks of a 4H " +
    "range, requiring genuine volume divergence on the breaking " +
    "candle plus a confirming 1H CHoCH. A full confluence checklist " +
    "layers on top — the range extreme must sit inside a real 4H " +
    "point of interest, a same-direction FVG must form after the " +
    "CHoCH, and the 4H trend's own BOS must agree — before a stop " +
    "(beyond the pattern's extreme) and a single flat target " +
    "(opposite side of the range) are set.",
  bot_5:
    "Liquidity Purge Specialist (Jeafx style). Trades a refined " +
    "(barely-tested) 1H supply/demand zone, with direction set by " +
    "the last 4H break of structure, then waits for a tight-" +
    "tolerance 15M liquidity purge aligning with that zone and a " +
    "strong 5M momentum confirmation candle. Entry comes from a " +
    "matching FVG or the confirmation candle's own midpoint; stop " +
    "sits tight beyond the purge extreme, targeting a 4-6R ladder.",
  bot_6:
    "SMC v2. The same refined-zone, purge, and confirmation-candle " +
    "pipeline as Bot 5, with one difference — direction comes from " +
    "Bot 2's own 15M CHoCH call OR Bot 3's own 1H-FVG+15M-BOS call " +
    "(either sufficient; a genuine disagreement between the two " +
    "blocks the trade), rather than a 4H BOS. Built as a second, " +
    "independent fix for the same \"often misses the price's " +
    "direction\" issue Bot 5's own 4H-BOS fix addressed.",
};

/** Mirrors market_scanner.py's own fallback for a bot row with no
 * `strategy_key` set: the bot_id's first two underscore-separated
 * segments (e.g. "bot_6_smc_v2" -> "bot_6"). Only relevant for the
 * handful of pre-migration rows still missing the real column. */
function fallbackStrategyKey(botId: string): string {
  return botId.split('_').slice(0, 2).join('_');
}

export function getStrategySummary(botId: string, strategyKey?: string | null): string | undefined {
  const key = strategyKey || fallbackStrategyKey(botId);
  return BOT_STRATEGY_SUMMARIES[key];
}
