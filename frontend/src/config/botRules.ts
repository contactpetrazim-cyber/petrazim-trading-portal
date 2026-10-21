/**
 * botRules — real per-bot invalidation-gate lists for the "N rules"
 * slide summary (SMC Bot Academy plan item 7). Each list is the
 * ALREADY-VERIFIED gate enumeration from that bot's own curriculum
 * lesson (BOTx-05/06 "Invalidation" lessons in curriculum/*.md,
 * themselves verified line-by-line against each bot's real
 * `analyze()` in `bot_strategies.py`) — presented at its REAL count,
 * never padded or trimmed to a fixed "7 rules" framing. Bot 3 and
 * Bot 7 genuinely have as few as two and four gates; Bot 4 genuinely
 * has eleven. Forcing every bot to the same count would recreate the
 * exact fidelity problem this whole plan exists to fix.
 */
export interface BotRule {
  title: string;
  detail: string;
}

export interface BotRuleSet {
  botId: string;
  botName: string;
  lessonRef: string;
  rules: BotRule[];
}

export const BOT_RULES: Record<string, BotRuleSet> = {
  bot_1: {
    botId: 'bot_1',
    botName: 'Bot 1 — Macro Swing Structure',
    lessonRef: 'BOT1-05',
    rules: [
      { title: '1D swing count', detail: 'At least 4 total 1D swing points exist — fewer than that and there is nothing to read a trend off of.' },
      { title: '1D trend clarity', detail: 'The 1D highs and lows must agree on ONE trend direction (both higher, or both lower) — disagreement returns no signal.' },
      { title: '4H BOS alignment', detail: 'A 4H Break of Structure must exist, and its direction must match the 1D trend.' },
      { title: '4H zone availability', detail: 'An ACTIVE, direction-matching 4H order block must exist among the detected zones.' },
      { title: 'Discount/premium side', detail: "The selected order block must sit on the correct side of the 4H range — discount for a long, premium for a short." },
    ],
  },
  bot_2: {
    botId: 'bot_2',
    botName: 'Bot 2 — Order Block Reversal',
    lessonRef: 'BOT2-05',
    rules: [
      { title: 'Order block exists', detail: 'An ACTIVE order block exists on either the 4H timeframe or the 1H fallback.' },
      { title: 'Price inside zone', detail: 'The current 15M price is actually inside one of the active zones found — not merely nearby.' },
      { title: '15M CHoCH detected', detail: 'A 15M Change of Character is detected, with a recognized bullish/bearish type.' },
    ],
  },
  bot_3: {
    botId: 'bot_3',
    botName: 'Bot 3 — Imbalance Expansion (FVG)',
    lessonRef: 'BOT3-05',
    rules: [
      { title: 'Eligible 1H FVG', detail: 'An ACTIVE 1H Fair Value Gap exists with mitigated_percent between 0.3 and 0.7 — the real 30-70% window, not "any gap that\'s been touched."' },
      { title: 'Matching 15M BOS', detail: 'A 15M Break of Structure exists and its type matches the selected FVG\'s gap type — checked SECOND, after the FVG is already chosen.' },
    ],
  },
  bot_4: {
    botId: 'bot_4',
    botName: 'Bot 4 — Volume & Liquidity Sweep',
    lessonRef: 'BOT4-05',
    rules: [
      { title: '4H swing count', detail: 'At least 6 total 4H swing points exist.' },
      { title: 'Recent swing counts', detail: 'At least 3 recent swing highs AND at least 3 recent swing lows exist.' },
      { title: 'Non-degenerate range', detail: 'The detected range has real, non-zero size.' },
      { title: 'Price near range extreme', detail: 'Current price sits within 15% of either range extreme.' },
      { title: '4H point-of-interest', detail: 'That range extreme actually sits inside a real, ACTIVE 4H order-block zone.' },
      { title: 'Spring or Upthrust found', detail: 'A Wyckoff Spring or Upthrust pattern is found against the 3-swing range.' },
      { title: '1H CHoCH detected', detail: 'A 1H Change of Character is detected at all.' },
      { title: 'Pattern/CHoCH agreement', detail: 'The found Spring/Upthrust pattern and the CHoCH type actually agree in direction.' },
      { title: 'FVG after CHoCH', detail: 'A same-direction 1H FVG exists that formed strictly AFTER the CHoCH\'s own timestamp.' },
      { title: '4H BOS exists', detail: 'A 4H Break of Structure has formed at all.' },
      { title: '4H BOS direction agrees', detail: 'The 4H BOS\'s direction agrees with the Spring/Upthrust + CHoCH direction.' },
    ],
  },
  bot_5: {
    botId: 'bot_5',
    botName: 'Bot 5 — Liquidity Purge Specialist',
    lessonRef: 'BOT5-05',
    rules: [
      { title: 'Refined 1H zone', detail: 'An ACTIVE, test_count<=1 ("fresh") 1H zone exists.' },
      { title: '4H BOS exists', detail: 'A 4H Break of Structure has formed at all — this is where direction now comes from.' },
      { title: '4H BOS type recognized', detail: 'The last 4H BOS\'s type is recognized as bullish or bearish (defensive catch-all).' },
      { title: '15M liquidity sweep', detail: 'A 15M liquidity sweep is detected at all — timing/alignment only, it does NOT set direction.' },
      { title: 'Zone/sweep alignment', detail: 'One of the refined zones aligns with the sweep\'s own price.' },
      { title: '5M confirmation candle', detail: 'A 5M candle satisfies both the momentum and re-entry conditions.' },
    ],
  },
  bot_6: {
    botId: 'bot_6',
    botName: 'Bot 6 — SMC v2',
    lessonRef: 'BOT6-06',
    rules: [
      { title: 'Refined 1H zone', detail: 'An ACTIVE, test_count<=1 ("fresh") 1H zone exists — identical to Bot 5.' },
      { title: '15M liquidity sweep', detail: 'A 15M liquidity sweep is detected at all — timing/alignment only, same correction as Bot 5.' },
      { title: 'Zone/sweep alignment', detail: 'One of the refined zones aligns with the sweep\'s own price.' },
      { title: '5M confirmation candle', detail: 'A 5M candle satisfies both the momentum and re-entry conditions.' },
      { title: 'No direction disagreement', detail: 'Bot 2\'s CHoCH call and Bot 3\'s FVG+BOS call, if both fired, must not genuinely disagree.' },
      { title: 'At least one call fired', detail: 'At least one of those two calls (Bot 2-style CHoCH, Bot 3-style FVG+BOS) must have fired at all.' },
    ],
  },
  bot_7: {
    botId: 'bot_7',
    botName: 'Bot 7 — FVG Expansion v3',
    lessonRef: 'BOT7-05',
    rules: [
      { title: 'Eligible 1H FVG', detail: 'An ACTIVE 1H FVG exists in the same real 30-70% window as Bot 3.' },
      { title: '15M BOS exists', detail: 'A 15M Break of Structure exists at all, after significant-swing filtering — checked FIRST, before FVG selection (reversed from Bot 3).' },
      { title: 'BOS type recognized', detail: 'The confirming BOS is recognized as bullish or bearish (defensive catch-all, unreachable in practice).' },
      { title: 'Direction-matching FVG', detail: 'An eligible FVG matches the already-confirmed direction — selected by DEPTH (most room to react from), not recency.' },
    ],
  },
};
