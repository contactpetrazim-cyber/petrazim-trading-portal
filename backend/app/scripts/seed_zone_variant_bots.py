"""
Seed Bots 17-22 — Zone-Type & Timeframe Adaptivity Data-Gathering Rows
=======================================================================

Plan step 5 of /root/.claude/plans/buzzing-mixing-micali.md ("Per-pair
zone-type adaptivity (Order Block vs FVG) for bot entry-zone
selection") — activating every dormant sibling bot as a real TEST-mode
BotConfig row, ONE PER REAL PARENT ROW (full symbol parity, by direct
request: "Activate on all symbols"), so genuine comparative data
accumulates against every parent on every symbol it actually trades.
Ahead of the Intelligent-mode zone-type re-evaluation pass
(intelligent_tuning_worker.py's own _tune_zone_variant_for_bot) ever
acting on any of it.

Six sibling families, each isolating ONE single variable against its
real, untouched parent:
- Bot 17 (zone-type: OB vs FVG) vs Bot 3 — 4 rows, mirroring Bot 3's
  own 4 real rows (BTCUSDT.P; JPY/EUR/XAUT; NAS100; Oil).
- Bot 18 (zone-type) vs Bot 6 — 5 rows, mirroring Bot 6's own 5 real
  symbol-group rows (XAUT; BTC; JPY/EUR/XAUT; NAS100; Oil). Bot 6's
  OWN "early-trail" A/B reuse row (bot_15, same strategy_key, same
  XAUT symbol, a trade-management test, not a symbol group) is
  deliberately NOT mirrored here — out of scope for a zone-type/
  timeframe test.
- Bot 19 (timeframe: 1H vs 5M) vs Bot 6 — same 5 rows/symbols as Bot
  18, so that one parent has two independent, directly comparable
  siblings testing two different variables at once.
- Bot 20 (timeframe) vs Bot 5 — 4 rows, mirroring Bot 5's own 4 real
  rows (BTCUSDT.P; NAS100; Oil; and a literal duplicate Oil row,
  bot_5_jeafx_3_copy, which exists in production as-is and is
  mirrored faithfully, not treated as an error).
- Bot 21 (timeframe) vs Bot 8 — 5 rows, mirroring Bot 8's own 5 real
  rows (XAUT; BTC; JPY/EUR/XAUT; NAS100; Oil — all `user_id=null` in
  production, a pre-ownership bot family; mirrored as-is). Bot 8's own
  "early-trail" reuse row (bot_16, BTCUSDT.P) is likewise out of scope.
- Bot 22 (timeframe) vs Bot 14 — 1 row, mirroring Bot 14's only real
  row (BTCUSDT.P).

bot_17_fvg_expansion_ob_poi (the base BTCUSDT.P row) already existed in
production as of 2026-10-21 — NOT dormant, contrary to an earlier,
incorrect verification pass this session that found zero BotConfig
rows for it; this script is idempotent and will skip it.

All TEST mode (never reaches a real broker), bot_mode=BASIC (not
INTELLIGENT — flipping that on is a further, separate decision the
trader makes deliberately via the Bots page).

Idempotent — skips any bot_id that already exists. Run once:
    python -m app.scripts.seed_zone_variant_bots
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.bot import BotConfig, BotStatus, ExecutionMode, BotMode, MarginMode, TradingMode

# (bot_id, bot_name, strategy_key, exchange, symbols, user_id, execution_mode,
#  min_rr_ratio, trailing_stop_activation) — mirrors each real live parent
#  row's own exact settings, confirmed against the live database immediately
#  before writing this (not guessed). user_id=None matches a real production
#  row with no owner (a pre-ownership bot) -- not a placeholder.
_PETRAZIM = "4d703396-b4e0-4561-a098-a8f6eb97f5b7"
_F92 = "f9292abf-063d-484a-ac21-d25a7ed90105"

INSTANCES = [
    # --- Bot 17 (zone-type) vs Bot 3's 4 real rows ---
    ("bot_17_fvg_expansion_ob_poi", "FVG Expansion, OB-POI", "bot_17", None, ["BTCUSDT.P"],
     _F92, ExecutionMode.FULLY_AUTONOMOUS, 4.0, 2.0),
    ("bot_17_fvg_expansion_ob_poi_2", "FVG Expansion, OB-POI", "bot_17", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 4.0, 2.0),
    ("bot_17_fvg_expansion_ob_poi_3", "FVG Expansion, OB-POI", "bot_17", "mexc", ["NAS100USDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 4.0, 2.0),
    ("bot_17_fvg_expansion_ob_poi_4", "FVG Expansion, OB-POI", "bot_17", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 4.0, 2.0),

    # --- Bot 18 (zone-type) vs Bot 6's 5 real symbol-group rows ---
    ("bot_18_smc_v2_ob_poi", "SMC v2, OB-POI", "bot_18", "mexc", ["NAS100USDT.P"],
     _PETRAZIM, ExecutionMode.HUMAN_IN_LOOP, 5.0, 1.0),
    ("bot_18_smc_v2_ob_poi_2", "SMC v2, OB-POI", "bot_18", "bingx", ["XAUTUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 3.0, 2.0),
    ("bot_18_smc_v2_ob_poi_3", "SMC v2, OB-POI", "bot_18", "bingx", ["BTCUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 3.0, 2.0),
    ("bot_18_smc_v2_ob_poi_4", "SMC v2, OB-POI", "bot_18", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_18_smc_v2_ob_poi_5", "SMC v2, OB-POI", "bot_18", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),

    # --- Bot 19 (timeframe) vs the SAME 5 Bot 6 rows Bot 18 mirrors ---
    ("bot_19_smc_v2_1h_entry", "SMC v2, 1H Entry", "bot_19", "mexc", ["NAS100USDT.P"],
     _PETRAZIM, ExecutionMode.HUMAN_IN_LOOP, 5.0, 1.0),
    ("bot_19_smc_v2_1h_entry_2", "SMC v2, 1H Entry", "bot_19", "bingx", ["XAUTUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 3.0, 2.0),
    ("bot_19_smc_v2_1h_entry_3", "SMC v2, 1H Entry", "bot_19", "bingx", ["BTCUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 3.0, 2.0),
    ("bot_19_smc_v2_1h_entry_4", "SMC v2, 1H Entry", "bot_19", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_19_smc_v2_1h_entry_5", "SMC v2, 1H Entry", "bot_19", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),

    # --- Bot 20 (timeframe) vs Bot 5's 4 real rows (incl. a literal duplicate) ---
    ("bot_20_jeafx_1h_entry", "SMC BOT, 1H Entry", "bot_20", None, ["BTCUSDT.P"],
     _F92, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 2.0),
    ("bot_20_jeafx_1h_entry_2", "SMC BOT, 1H Entry", "bot_20", "mexc", ["NAS100USDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 2.0),
    ("bot_20_jeafx_1h_entry_3", "SMC BOT, 1H Entry", "bot_20", "mexc", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 2.0),
    ("bot_20_jeafx_1h_entry_3_copy", "SMC BOT, 1H Entry", "bot_20", "mexc", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     _PETRAZIM, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 2.0),

    # --- Bot 21 (timeframe) vs Bot 8's 5 real rows (user_id=None, as-is) ---
    ("bot_21_smc_v2_single_anchor_1h_entry", "SMC v2 Single-Anchor, 1H Entry", "bot_21", "bingx", ["XAUTUSDT.P"],
     None, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_21_smc_v2_single_anchor_1h_entry_2", "SMC v2 Single-Anchor, 1H Entry", "bot_21", "bingx", ["BTCUSDT.P"],
     None, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_21_smc_v2_single_anchor_1h_entry_3", "SMC v2 Single-Anchor, 1H Entry", "bot_21", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"],
     None, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_21_smc_v2_single_anchor_1h_entry_4", "SMC v2 Single-Anchor, 1H Entry", "bot_21", "mexc", ["NAS100USDT.P"],
     None, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),
    ("bot_21_smc_v2_single_anchor_1h_entry_5", "SMC v2 Single-Anchor, 1H Entry", "bot_21", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"],
     None, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 1.0),

    # --- Bot 22 (timeframe) vs Bot 14's only real row ---
    ("bot_22_jeafx_htf_gated_1h_entry", "SMC BOT HTF-Gated, 1H Entry", "bot_22", None, ["BTCUSDT.P"],
     _F92, ExecutionMode.FULLY_AUTONOMOUS, 5.0, 2.0),
]

COMMON_FIELDS = dict(
    bot_type="smc",
    status=BotStatus.ACTIVE,
    bot_mode=BotMode.BASIC,
    margin_mode=MarginMode.DEDICATED,
    trading_mode=TradingMode.TEST,
    paper_trading_enabled=False,
    timeframes=["1D", "4H", "1H", "15M"],
    exchange_mode="fixed",
    risk_per_trade=1.0,
    max_daily_trades=10,
    max_concurrent_trades=5,
    max_portfolio_exposure=5.0,
    account_balance_usd=1000.0,
    use_trailing_stop=True,
    trailing_stop_distance="structure",
    tp1_percent=30.0,
    tp2_percent=40.0,
    tp3_percent=30.0,
    require_mtf_alignment=True,
    require_liquidity_sweep=True,
    require_fvg_confirmation=False,
    require_order_block=False,
    batch_size=1,
    batch_allocation="equal",
)


async def seed_zone_variant_bots():
    async with AsyncSessionLocal() as db:
        existing_ids = set((await db.execute(select(BotConfig.bot_id))).scalars().all())
        created = 0

        for bot_id, bot_name, strategy_key, exchange, symbols, user_id, execution_mode, min_rr_ratio, trailing_activation in INSTANCES:
            if bot_id in existing_ids:
                print(f"  SKIP — {bot_id} already exists")
                continue
            db.add(BotConfig(
                bot_id=bot_id, bot_name=bot_name, strategy_key=strategy_key,
                exchange=exchange, symbols=symbols, user_id=user_id,
                execution_mode=execution_mode, min_rr_ratio=min_rr_ratio,
                trailing_stop_activation=trailing_activation,
                **COMMON_FIELDS,
            ))
            created += 1
            print(f"  OK — created {bot_id} (exchange={exchange}, symbols={symbols}, strategy_key={strategy_key})")

        await db.commit()
        print(f"\n{created} of {len(INSTANCES)} zone-variant bot rows created.")


if __name__ == "__main__":
    asyncio.run(seed_zone_variant_bots())
