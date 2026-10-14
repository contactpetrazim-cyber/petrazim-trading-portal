// Strategy summaries — by direct request ("Add the bot strategy
// summary under a 'Strategy' link similar to the Reasoning style in
// the individual Bot cards - portal wide"). One concise summary per
// real strategy (strategy_key "bot_1".."bot_7"), each transcribed
// directly from that strategy's own class docstring in
// backend/app/core/bot_strategies.py — not paraphrased from memory —
// so this stays a faithful, verified description of what each bot's
// real `analyze()` actually does, the same standard the curriculum
// docs in /curriculum hold themselves to. Updated after the SMC
// methodology audit (direct request) that added discount/premium
// checks, order-block-embedded stops, depth-based FVG selection, and
// reworked Bot 5/6's direction bias — see each bot's own class
// docstring in bot_strategies.py for the full reasoning.
export const BOT_STRATEGY_SUMMARIES: Record<string, string> = {
  bot_1:
    "Pure Macro Swing Structure (Damir/Brooks style). Trades major " +
    "structural transitions on 1D/4H, waiting for a confirmed BOS " +
    "(the leg's own significant swing, not a micro fractal) before " +
    "entering on a retracement to the 50% level of a fresh order " +
    "block — rejected if that block sits on the wrong side of the " +
    "range (premium for a long, discount for a short). Stop sits " +
    "beyond both the swing point and the order block itself, " +
    "whichever is further; target is at least 3:1, often higher for " +
    "swing holds spanning multiple days.",
  bot_2:
    "HF Order Block Reversal (ICT Core Mentorship style). Trades " +
    "reversals inside a fresh (barely-tested) 4H/1H Order Block once " +
    "price returns to it (rejected if it's on the wrong side of the " +
    "range), waiting for an internal 15M CHoCH followed by an " +
    "optional liquidity sweep + FVG. Stop sits just beyond the " +
    "sweep/swing extreme, extended to clear the order block itself; " +
    "target is 3:1, often scaled out at 2R.",
  bot_3:
    "Imbalance Expansion & FVG Fill (Photon/Phantom style). Trades " +
    "unmitigated 1H Fair Value Gaps once price returns and partially " +
    "fills them (30-70%), entering on a 15M BOS confirming the FVG's " +
    "own direction. Stop sits beyond the FVG's extreme, then trails " +
    "by each new BOS; target is 4R+. Left deliberately unchanged by " +
    "the SMC audit — it's been genuinely successful without an " +
    "order-block or discount/premium reference, so that track record " +
    "is being preserved and A/B'd against Bot 7 instead of altered.",
  bot_4:
    "Volume & Liquidity Sweep Specialist (Dalton/Weis/Wyckoff " +
    "style), redesigned after its prior version went fully silent " +
    "from stacking 7 mandatory gates at once. Trades a Wyckoff " +
    "Spring/Upthrust false break of a 4H range, confirmed by a 1H " +
    "CHoCH occurring at or after the sweep itself (not a stale, " +
    "unrelated one) — the two genuinely mandatory primitives. Needs " +
    "at least 2 of 4 scored confluences (a real 4H point of " +
    "interest, volume divergence, a post-CHoCH FVG, 4H trend " +
    "agreement) rather than all 4. Stop sits beyond the pattern's " +
    "extreme (embedding the POI zone when one was found); target is " +
    "now the normal 1R/2R/3R ladder, capped at the range's far side.",
  bot_5:
    "Liquidity Purge Specialist (Jeafx style). Trades a refined " +
    "(barely-tested) 1H supply/demand zone — rejected if it's on the " +
    "wrong side of the range — with direction set by the last 4H " +
    "break of structure (skipped if a 15M/1H signal is actively " +
    "fighting that trend), then waits for a tight-tolerance 15M " +
    "liquidity purge aligning with that zone and a strong 5M " +
    "momentum confirmation candle. Entry comes from the deepest/" +
    "highest qualifying FVG or the confirmation candle's own " +
    "midpoint; stop sits beyond both the purge extreme and the zone " +
    "itself, targeting a 4-6R ladder.",
  bot_6:
    "SMC v2. The same refined-zone, purge, and confirmation-candle " +
    "pipeline as Bot 5, with its own 1H BOS (not Bot 5's 4H) setting " +
    "the mandatory direction — Bot 2's own 15M CHoCH call or Bot 3's " +
    "own 1H-FVG+15M-BOS call must now AGREE with that bias (at least " +
    "one of the two), rather than either one alone deciding " +
    "direction with no higher-timeframe anchor.",
  bot_7:
    "FVG Expansion v3 — an A/B test against Bot 3, which is left " +
    "unchanged. Same FVG-retest setup, but direction comes from the " +
    "15M break of structure FIRST (the leg's own significant swing), " +
    "then the fair-value gap is picked by depth among whichever " +
    "candidates already match — deepest for a long, highest for a " +
    "short — instead of picking a gap first and checking BOS " +
    "agreement after the fact. No order-block or discount/premium " +
    "reference added, to isolate exactly what's being tested.",
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
