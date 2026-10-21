"""
Practice Scenario Set Seed Script — Bot Concept Lessons (BOT{N}-01)
=====================================================================

Phase 2 of the practice-drill-scenario-sets effort (see
seed_practice_scenarios.py's own module docstring for the original bug
report and BOT1-01's seeding there). That file covers one lesson per
promised-material SHAPE; this one covers the next priority tier named
explicitly in that follow-up work: every bot's own BOT{N}-01 "Concept"
lesson, each of which promises "five real bot signal cards (provided
in Practise)" (BOT6-01 promises six) and currently shows that promise
as plain prose with nothing behind it.

Every card's fields below are traced directly against
backend/app/core/bot_strategies.py's BOT_REGISTRY (the single
authoritative bot-number -> strategy-class mapping) and each class's
own analyze()/reasoning f-string — re-verified against the CURRENT
file right before writing this (not copied from the comment on
BOT1_SIGNAL_CARDS in seed_practice_scenarios.py, which pre-dates Bot 6
and Bot 7 being added to BOT_REGISTRY):

    BOT_REGISTRY (bot_strategies.py, ~line 3292):
      bot_1 -> MacroSwingStructureBot   candles_1d, candles_4h                        default_rr=5.0  confidence=0.85  setup_quality=1.2
      bot_2 -> OrderBlockReversalBot    candles_4h, candles_1h, candles_15m           default_rr=3.0  confidence=0.80/0.70 (sweep-dependent)  setup_quality=1.1
      bot_3 -> FVGExpansionBot          candles_1h, candles_15m                       default_rr=4.0  confidence=0.82  setup_quality=1.15
      bot_4 -> VolumeLiquidityBot       candles_4h, candles_1h                        default_rr=3.0  confidence=variable 0.70-0.85 (confluence-count-based)  setup_quality=variable up to 1.5
      bot_5 -> JeafxSMCBot              candles_4h, candles_1h, candles_15m, candles_5m  default_rr=4.0  confidence=0.88  setup_quality=1.3
      bot_6 -> JeafxSMCv2Bot            candles_1h, candles_15m, candles_5m (NO 4H)    default_rr=4.0  confidence=0.88  setup_quality=1.3 (ties Bot 5 — see BOT5-01's own Mini Quiz)
      bot_7 -> FVGExpansionV3Bot        candles_1h, candles_15m                        default_rr=4.0  confidence=0.82  setup_quality=1.15 (ties Bot 3 — by design, see FVGExpansionV3Bot's class docstring)

Note bot_3 and bot_7 share an IDENTICAL timeframe+R:R fingerprint
(1H/15M, 1:4) and bot_5/bot_6 share an identical confidence+setup-
quality fingerprint (0.88/1.3) — real, deliberate facts about this
codebase (Bot 7 is Bot 3 with two narrow fixes; Bot 6 is Bot 5 with
one direction-source change), not oversights here. Every card set
below is built so the field(s) that lesson's own prompt asks the
learner to use are sufficient to pick the right card WITHIN that
specific five/six-card set — never a claim that a value is globally
unique across all 7 bots when it isn't (BOT3-01's explanation says so
explicitly rather than overclaiming).

Run after seed_practice_scenarios.py (shares its _upsert/DB plumbing):
    python -m app.scripts.seed_practice_scenarios_bots
"""

from __future__ import annotations

import asyncio
import sys

from app.database import AsyncSessionLocal
from app.scripts.seed_practice_scenarios import _upsert

# ---------------------------------------------------------------------------
# Shared 5-card pool reused by BOT2-01 and BOT3-01 — IDENTICAL to
# BOT1_SIGNAL_CARDS in seed_practice_scenarios.py (same underlying
# fingerprints, re-verified above), so a learner who already did
# BOT1-01 sees a familiar card format, just a different question.
# ---------------------------------------------------------------------------
TF_RR_CARDS = [
    {"symbol": "ETHUSDT.P", "timeframes": "4H, 1H, 15M", "rr": "1 : 3", "label": "Card 1"},
    {"symbol": "BTCUSDT.P", "timeframes": "1D, 4H", "rr": "1 : 5", "label": "Card 2"},
    {"symbol": "XAUUSDT.P", "timeframes": "4H, 1H", "rr": "1 : 3", "label": "Card 3"},
    {"symbol": "SOLUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4", "label": "Card 4"},
    {"symbol": "NCCO1OILWTI2USDUSDT.P", "timeframes": "4H, 1H, 15M, 5M", "rr": "1 : 4", "label": "Card 5"},
]

# ---------------------------------------------------------------------------
# BOT2-01 — "Given five real bot signal cards (provided in Practise),
# correctly identify the Bot 2 signal using only its timeframe inputs
# and risk/target parameters." Card 1 is the only one of the five with
# THREE timeframes at a 1:3 R:R — OrderBlockReversalBot's exact
# analyze(candles_4h, candles_1h, candles_15m) + EntryExitEngine(default_rr=3.0).
# ---------------------------------------------------------------------------
BOT2_01_TITLE = "Concept: High-Frequency Order Block Reversal"
BOT2_01_ITEMS = [{
    "prompt": "Which card came from Bot 2 (OrderBlockReversalBot)?",
    "cards": TF_RR_CARDS,
    "correct_index": 0,
    "explanation": (
        "Card 1 is the only one of the five with THREE timeframes (4H, 1H, 15M) at a 1:3 reward-to-risk — "
        "exactly OrderBlockReversalBot.analyze()'s own three-candle-series signature and "
        "EntryExitEngine(default_rr=3.0). Card 3 also shows a 1:3 R:R but with only two timeframes "
        "(Bot 4's fingerprint, not Bot 2's)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT3-01 — "Given five real bot signal cards (provided in Practise),
# identify the Bot 3 signal using only its timeframe pair and target
# R:R." Card 4 is the only one of the five with FVGExpansionBot's exact
# analyze(candles_1h, candles_15m) + EntryExitEngine(default_rr=4.0).
# Honest caveat: this exact fingerprint is NOT globally unique across
# all 7 real bots — Bot 7 (FVGExpansionV3Bot, BOT7-01) shares it by
# design — but no other card in THIS five-card set does.
# ---------------------------------------------------------------------------
BOT3_01_TITLE = "Concept: Imbalance Expansion & FVG Fill"
BOT3_01_ITEMS = [{
    "prompt": "Which card came from Bot 3 (FVGExpansionBot)?",
    "cards": TF_RR_CARDS,
    "correct_index": 3,
    "explanation": (
        "Card 4 is the only one of the five with FVGExpansionBot's exact timeframe pair (1H, 15M) at its "
        "EntryExitEngine(default_rr=4.0). Worth flagging honestly: this fingerprint isn't unique across "
        "ALL 7 real bots — Bot 7 (FVGExpansionV3Bot) shares it exactly, by design (see BOT7-01) — but no "
        "other card in this five-card set does, so it's still the one correct pick here."
    ),
}]

# ---------------------------------------------------------------------------
# BOT4-01 — "Given five real bot signal cards (provided in Practise),
# identify the Bot 4 signal using only its reference to volume
# divergence and range structure." VolumeLiquidityBot is the ONLY one
# of the 7 real bots whose analyze() ever references candle volume
# (confluences["volume_divergence"], bot_strategies.py ~line 1505) or
# produces a "Wyckoff {pattern}" reasoning string (pattern =
# "spring"/"upthrust", ~lines 183/189) — every other real bot's
# analyze() never touches volume at all, matching this lesson's own
# Mini Quiz Q1 ("Bot 4 is the only bot ... whose logic reads candle
# volume data. Answer: True").
# ---------------------------------------------------------------------------
BOT4_01_TITLE = "Concept: Volume & Liquidity Sweep Specialist"
BOT4_SIGNAL_CARDS = [
    {"symbol": "BTCUSDT.P", "timeframes": "1D, 4H", "rr": "1 : 5", "label": "Card 1",
     "pattern": "—", "volume_divergence": "N/A — analyze() never reads candle volume"},
    {"symbol": "ETHUSDT.P", "timeframes": "4H, 1H, 15M", "rr": "1 : 3", "label": "Card 2",
     "pattern": "—", "volume_divergence": "N/A — analyze() never reads candle volume"},
    {"symbol": "XAUUSDT.P", "timeframes": "4H, 1H", "rr": "1 : 3", "label": "Card 3",
     "pattern": "Spring", "volume_divergence": "Yes — confluence present (candle volume < 80% of 1H average)"},
    {"symbol": "SOLUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4", "label": "Card 4",
     "pattern": "—", "volume_divergence": "N/A — analyze() never reads candle volume"},
    {"symbol": "NCCO1OILWTI2USDUSDT.P", "timeframes": "4H, 1H, 15M, 5M", "rr": "1 : 4", "label": "Card 5",
     "pattern": "—", "volume_divergence": "N/A — analyze() never reads candle volume"},
]
BOT4_01_ITEMS = [{
    "prompt": "Which card came from Bot 4 (VolumeLiquidityBot)?",
    "cards": BOT4_SIGNAL_CARDS,
    "correct_index": 2,
    "explanation": (
        "Card 3 is the only card referencing a Wyckoff pattern (Spring/Upthrust) or a volume-divergence "
        "confluence at all. VolumeLiquidityBot.analyze() is the only one of the 7 real bots whose reasoning "
        "ever contains 'Wyckoff {pattern}' or checks confluences['volume_divergence'] — every other real "
        "bot's analyze() never references candle volume data (this lesson's own Mini Quiz Q1)."
    ),
}]

# ---------------------------------------------------------------------------
# BOT5-01 — "Given five real bot signal cards (provided in Practise),
# identify the Bot 5 signal using only its timeframe inputs and its
# confidence/setup-quality values." JeafxSMCBot is the only bot in
# THIS five-card set reporting confidence=0.88 / setup_quality=1.3 —
# the highest fixed values of any bot in the curriculum (tied only by
# Bot 6, not shown here; see this lesson's own Mini Quiz Q1, which
# flags that tie honestly rather than hiding it).
# ---------------------------------------------------------------------------
BOT5_01_TITLE = "Concept: The Jeafx Liquidity Purge Specialist"
BOT5_SIGNAL_CARDS = [
    {"symbol": "BTCUSDT.P", "timeframes": "1D, 4H", "rr": "1 : 5", "label": "Card 1",
     "confidence": 0.85, "setup_quality": 1.2},
    {"symbol": "ETHUSDT.P", "timeframes": "4H, 1H, 15M", "rr": "1 : 3", "label": "Card 2",
     "confidence": 0.70, "setup_quality": 1.1},
    {"symbol": "XAUUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4", "label": "Card 3",
     "confidence": 0.82, "setup_quality": 1.15},
    {"symbol": "NCCO1OILWTI2USDUSDT.P", "timeframes": "4H, 1H, 15M, 5M", "rr": "1 : 4", "label": "Card 4",
     "confidence": 0.88, "setup_quality": 1.3},
    {"symbol": "SOLUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4", "label": "Card 5",
     "confidence": 0.82, "setup_quality": 1.15},
]
BOT5_01_ITEMS = [{
    "prompt": "Which card came from Bot 5 (JeafxSMCBot)?",
    "cards": BOT5_SIGNAL_CARDS,
    "correct_index": 3,
    "explanation": (
        "Card 4 is the only one of the five with BOTH JeafxSMCBot's exact 4-timeframe input "
        "(4H, 1H, 15M, 5M) AND its fixed confidence=0.88 / setup_quality=1.3 — the highest fixed values "
        "of any bot in this curriculum. (Bot 6 ties this exact confidence/quality pair but reads only 3 "
        "timeframes, no 4H — see BOT6-01 — so it couldn't produce this card.)"
    ),
}]

# ---------------------------------------------------------------------------
# BOT6-01 — "Given six real bot signal cards (provided in Practise, one
# per bot in this curriculum), identify the Bot 6 signal using only its
# reasoning text's reference to Bot 2's CHoCH and Bot 3's FVG/BOS
# results." Every snippet's fixed phrasing is copied verbatim from each
# bot's own reasoning=f"..." string in bot_strategies.py (direction/
# numeric placeholders filled with one illustrative example each,
# exactly as that f-string would render them at runtime — never
# reworded). Only JeafxSMCv2Bot's reasoning string (~line 2296)
# literally contains "Bot2 CHoCH=" and "Bot3 FVG/BOS=" — confirmed by
# grepping reasoning=f" across the whole file; no other bot's string
# mentions either.
# ---------------------------------------------------------------------------
BOT6_01_TITLE = "Concept: SMC v2 — Bot 5's Pipeline, a New Direction Source"
BOT6_SIGNAL_CARDS = [
    {"symbol": "BTCUSDT.P", "timeframes": "1D, 4H", "rr": "1 : 5", "label": "Bot 1 card",
     "reasoning_snippet": "Macro swing long. 1D trend confirmed. 4H BOS at 1.08500. Entry at 4H OB mean. SL beyond swing 1.08200. Target 5R."},
    {"symbol": "ETHUSDT.P", "timeframes": "4H, 1H, 15M", "rr": "1 : 3", "label": "Bot 2 card",
     "reasoning_snippet": "ICT OB Reversal short. HTF OB active. 15M CHoCH + sweep. FVG confirmation: 2 active. SL beyond sweep/swing, embedded OB. 3R target."},
    {"symbol": "XAUUSDT.P", "timeframes": "1H, 15M", "rr": "1 : 4", "label": "Bot 3 card",
     "reasoning_snippet": "FVG Expansion long. 1H FVG bullish 45% mitigated. 15M BOS confirms. Entry at FVG 50%. SL beyond FVG extreme. 4R target with BOS trailing."},
    {"symbol": "SOLUSDT.P", "timeframes": "4H, 1H", "rr": "1 : 3", "label": "Bot 4 card",
     "reasoning_snippet": "Wyckoff spring long. Range 1.08000-1.08500. CHoCH confirms, at/after the sweep. Confluences (3/4): POI=True, vol divergence=True, post-CHoCH FVG=True, 4H trend agrees=False. SL beyond spring extreme + embedded POI zone. 3R ladder, TP3 capped at range."},
    {"symbol": "NCCO1OILWTI2USDUSDT.P", "timeframes": "4H, 1H, 15M, 5M", "rr": "1 : 4", "label": "Bot 5 card",
     "reasoning_snippet": "SMC BOT long. 4H BOS confirms trend. 1H fresh zone. 15M buy_side_sweep (timing gate). 5M confirmation candle + FVG: True. Entry at 50%. Strict SL beyond purge. 5R target."},
    {"symbol": "XAGUSDT.P", "timeframes": "1H, 15M, 5M", "rr": "1 : 4", "label": "Bot 6 card",
     "reasoning_snippet": "SMC v2 long. 1H BOS bias confirmed by: Bot2 CHoCH=long, Bot3 FVG/BOS=— (at least one agrees). 1H fresh zone, discount/premium checked. 15M purge (timing/zone gate). 5M confirmation candle + depth-selected FVG: True. Entry at 50%. Strict SL beyond purge, embedded zone. 5R target."},
]
BOT6_01_ITEMS = [{
    "prompt": "Which card came from Bot 6 (JeafxSMCv2Bot)?",
    "cards": BOT6_SIGNAL_CARDS,
    "correct_index": 5,
    "explanation": (
        "The \"Bot 6 card\" is the only one of the six whose reasoning text literally says \"Bot2 CHoCH=\" "
        "and \"Bot3 FVG/BOS=\" — JeafxSMCv2Bot.analyze() is the only real bot whose reasoning f-string "
        "references another bot's own confirmation signals by name, because its 1H BOS bias must be "
        "agreed with by at least one of Bot 2's 15M CHoCH or Bot 3's 1H-FVG+15M-BOS. It also has no 4H "
        "input at all (1H/15M/5M only) — the other tell this lesson's Mini Quiz Q1 asks about."
    ),
}]


# ---------------------------------------------------------------------------
# BOT7-01 — "Given five paired code snippets (provided in Practise) —
# one from FVGExpansionBot, one from FVGExpansionV3Bot — for each pair,
# state whether the snippet represents shared (identical) logic or one
# of the two real differences." Every snippet below is copied verbatim
# from bot_strategies.py (Bot 3's analyze(), lines ~765-816; Bot 7's
# analyze(), lines ~907-958 — both re-read in full immediately before
# writing this), confirming the class docstring's claim of exactly two
# real differences: (1) direction comes from the 15M BOS FIRST in Bot
# 7, fed through filter_significant_swings, vs. Bot 3 picking an FVG
# first and checking BOS agreement after; (2) Bot 7 selects among
# qualifying FVGs by DEPTH (select_fvg_by_depth) vs. Bot 3 just taking
# partial_fvgs[-1] (the last one in whatever order detect_fvg
# returned). Everything else quoted (the 30-70%-mitigation filter,
# the FVG-midpoint entry, the FVG-extreme-%10-buffer stop) is
# byte-for-byte identical between the two classes.
# ---------------------------------------------------------------------------
BOT7_01_TITLE = "Concept: FVG Expansion v3 (Bot 3, with Two Fixes Applied)"
_CLASSIFY_OPTIONS = [
    "Shared (identical) logic",
    "Real difference #1: direction-determination order",
    "Real difference #2: FVG-selection criterion",
]
BOT7_01_ITEMS = [
    {
        "prompt": "Shared logic, or one of the two real differences?",
        "snippets": [
            {"label": "Bot 3 (FVGExpansionBot)",
             "code": "fvgs = fvg_detector.detect_fvg(candles_1h)\nfvgs = fvg_detector.track_mitigation(fvgs, candles_1h)\npartial_fvgs = [f for f in fvgs if 0.3 <= f.mitigated_percent <= 0.7\n                and f.status.name == \"ACTIVE\"]\nif not partial_fvgs:\n    return None"},
            {"label": "Bot 7 (FVGExpansionV3Bot)",
             "code": "fvgs = fvg_detector.detect_fvg(candles_1h)\nfvgs = fvg_detector.track_mitigation(fvgs, candles_1h)\npartial_fvgs = [f for f in fvgs if 0.3 <= f.mitigated_percent <= 0.7\n                and f.status.name == \"ACTIVE\"]\nif not partial_fvgs:\n    return None"},
        ],
        "options": _CLASSIFY_OPTIONS,
        "correct_index": 0,
        "explanation": "Byte-for-byte identical in both classes — the unmitigated/30-70%-mitigated 1H FVG filter is untouched by either real difference.",
    },
    {
        "prompt": "Shared logic, or one of the two real differences?",
        "snippets": [
            {"label": "Bot 3 (FVGExpansionBot)",
             "code": "target_fvg = partial_fvgs[-1]\n# ... 15M BOS computed next, THEN checked against target_fvg.gap_type:\nif target_fvg.gap_type == \"bullish\" and last_bos[\"type\"] != \"bullish_bos\":\n    return None\ndirection = \"long\" if target_fvg.gap_type == \"bullish\" else \"short\""},
            {"label": "Bot 7 (FVGExpansionV3Bot)",
             "code": "bos_15m = self.structure_detector.detect_bos(\n    candles_15m, self.structure_detector.filter_significant_swings(swings_15m))\nif last_bos[\"type\"] == \"bullish_bos\":\n    direction = \"long\"\nelif last_bos[\"type\"] == \"bearish_bos\":\n    direction = \"short\"\nelse:\n    return None\n# ... FVG is selected AFTER this, only from candidates matching `direction`"},
        ],
        "options": _CLASSIFY_OPTIONS,
        "correct_index": 1,
        "explanation": "Bot 3 picks its FVG first, then checks the 15M BOS agrees with THAT FVG's gap_type. Bot 7 decides direction from the 15M BOS first (through filter_significant_swings — the 'entire leg, not micro swing points' fix) and only then selects an FVG matching it — real difference #1.",
    },
    {
        "prompt": "Shared logic, or one of the two real differences?",
        "snippets": [
            {"label": "Bot 3 (FVGExpansionBot)",
             "code": "target_fvg = partial_fvgs[-1]\n# the last FVG in whatever order detect_fvg() returned the list"},
            {"label": "Bot 7 (FVGExpansionV3Bot)",
             "code": "candidate_fvgs = [f for f in partial_fvgs if (f.gap_type == \"bullish\" and direction == \"long\")\n                  or (f.gap_type == \"bearish\" and direction == \"short\")]\ntarget_fvg = select_fvg_by_depth(candidate_fvgs, direction)\nif target_fvg is None:\n    return None"},
        ],
        "options": _CLASSIFY_OPTIONS,
        "correct_index": 2,
        "explanation": "Bot 3 just takes partial_fvgs[-1] — the last one in list order, nothing to do with depth. Bot 7 filters to FVGs matching the confirmed direction, then calls select_fvg_by_depth — deepest for a long, highest for a short — real difference #2.",
    },
    {
        "prompt": "Shared logic, or one of the two real differences?",
        "snippets": [
            {"label": "Bot 3 (FVGExpansionBot)", "code": "entry_price = (target_fvg.top + target_fvg.bottom) / 2"},
            {"label": "Bot 7 (FVGExpansionV3Bot)", "code": "entry_price = (target_fvg.top + target_fvg.bottom) / 2"},
        ],
        "options": _CLASSIFY_OPTIONS,
        "correct_index": 0,
        "explanation": "Identical one-liner in both classes — entry is always the FVG's own midpoint, in both bots.",
    },
    {
        "prompt": "Shared logic, or one of the two real differences?",
        "snippets": [
            {"label": "Bot 3 (FVGExpansionBot)",
             "code": "if direction == \"long\":\n    sl_price = target_fvg.bottom - (target_fvg.top - target_fvg.bottom) * 0.1\nelse:\n    sl_price = target_fvg.top + (target_fvg.top - target_fvg.bottom) * 0.1"},
            {"label": "Bot 7 (FVGExpansionV3Bot)",
             "code": "if direction == \"long\":\n    sl_price = target_fvg.bottom - (target_fvg.top - target_fvg.bottom) * 0.1\nelse:\n    sl_price = target_fvg.top + (target_fvg.top - target_fvg.bottom) * 0.1"},
        ],
        "options": _CLASSIFY_OPTIONS,
        "correct_index": 0,
        "explanation": "Identical stop-placement formula in both — 10% beyond the FVG's own extreme, in the FVG's own direction. Neither of Bot 7's two real differences touches stop placement at all.",
    },
]


async def seed_bot_concept_scenarios():
    async with AsyncSessionLocal() as db:
        count = 0
        count += await _upsert(db, BOT2_01_TITLE, "signal_cards", BOT2_01_ITEMS)
        count += await _upsert(db, BOT3_01_TITLE, "signal_cards", BOT3_01_ITEMS)
        count += await _upsert(db, BOT4_01_TITLE, "signal_cards", BOT4_01_ITEMS)
        count += await _upsert(db, BOT5_01_TITLE, "signal_cards", BOT5_01_ITEMS)
        count += await _upsert(db, BOT6_01_TITLE, "signal_cards", BOT6_01_ITEMS)
        count += await _upsert(db, BOT7_01_TITLE, "classify", BOT7_01_ITEMS)
        await db.commit()
        print(f"\n{count} of 6 bot-concept scenario sets seeded/updated.")


if __name__ == "__main__":
    asyncio.run(seed_bot_concept_scenarios())
    sys.exit(0)
