"""
Seed Bot 17 / Bot 18 / Bot 19 — Zone-Type & Timeframe Adaptivity
Data-Gathering Rows
================================================================

Plan step 5 of /root/.claude/plans/buzzing-mixing-micali.md ("Per-pair
zone-type adaptivity (Order Block vs FVG) for bot entry-zone
selection") — activating dormant sibling bots as real TEST-mode
BotConfig rows so genuine comparative data accumulates against their
parents, ahead of the Intelligent-mode zone-type re-evaluation pass
(intelligent_tuning_worker.py's own _tune_zone_variant_for_bot) ever
acting on it. Extended, same reasoning, to the timeframe-swap siblings
(Bot 19) once that hypothesis was built and tested.

bot_17_fvg_expansion_ob_poi (BTCUSDT.P, mirroring the real live
bot_3_fvg_expansion row's own exact settings) already existed in
production as of 2026-10-21 — NOT dormant, contrary to an earlier,
incorrect verification pass this session that found zero BotConfig
rows for it. This script is idempotent and will skip it; it's
documented here for completeness, since Bot 18/19 below are built the
exact same way.

bot_18_smc_v2_ob_poi and bot_19_smc_v2_1h_entry (both NAS100USDT.P,
mirroring the real live bot_6_smc_v2_4 row's own exact settings — the
specific row the trade that originally triggered this whole
investigation came from) are created by this script, giving that one
baseline two independent, directly comparable siblings: bot_18 tests
the zone-type hypothesis (OB vs FVG), bot_19 tests the timeframe
hypothesis (1H vs 5M), each isolating its own single variable. TEST
mode (never reaches a real broker), bot_mode=BASIC (not INTELLIGENT —
flipping that on is a further, separate decision the trader makes
deliberately via the Bots page).

Idempotent — skips any bot_id that already exists. Run once:
    python -m app.scripts.seed_zone_variant_bots
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.bot import BotConfig, BotStatus, ExecutionMode, BotMode, MarginMode, TradingMode

# (bot_id, bot_name, strategy_key, exchange, symbols, user_id, execution_mode,
#  min_rr_ratio, trailing_stop_activation) — mirrors the real live parent row's
#  own exact settings, confirmed against the live database immediately before
#  writing this (not guessed).
INSTANCES = [
    (
        "bot_17_fvg_expansion_ob_poi", "FVG Expansion, OB-POI", "bot_17", None, ["BTCUSDT.P"],
        "f9292abf-063d-484a-ac21-d25a7ed90105", ExecutionMode.FULLY_AUTONOMOUS, 4.0, 2.0,
    ),
    (
        "bot_18_smc_v2_ob_poi", "SMC v2, OB-POI", "bot_18", "mexc", ["NAS100USDT.P"],
        "4d703396-b4e0-4561-a098-a8f6eb97f5b7", ExecutionMode.HUMAN_IN_LOOP, 5.0, 1.0,
    ),
    (
        "bot_19_smc_v2_1h_entry", "SMC v2, 1H Entry", "bot_19", "mexc", ["NAS100USDT.P"],
        "4d703396-b4e0-4561-a098-a8f6eb97f5b7", ExecutionMode.HUMAN_IN_LOOP, 5.0, 1.0,
    ),
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
