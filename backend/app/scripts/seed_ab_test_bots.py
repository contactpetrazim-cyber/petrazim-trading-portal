"""
Seed Bot 8 / Bot 9 / Bot 10 / Bot 11 / Bot 12 — A/B Test Variants
=====================================================

By direct request: "find a way to loosen and still make a winning
strategy ... create a totally new bot with your new guidance and then
use it as a A to B testing over the long run ... original versus
modified ... Do same for bots that have not been taking trades." Then,
after Bot 9's own real result came back a null on the CHoCH issue:
"Can we create a bot 10 to test the CHOCH issue." Then, after real
screenshots of Bot 2 trades stopped out with its own reasoning text
literally saying "Tight SL": "can we test a variant that has the SL
embed the range Order block ... Do both versions with relaxed or
larger SL that is well positioned." Then, after real screenshots
showed trades hitting TP1 for a small gain and then giving the rest
back: "why are these trading not allowing winners to run - the trade
does not seem to reach full potential - can you critically investigate
and find an innovative and creative solution to test as a new bot?"

Bot 8 (JeafxSMCv2SingleAnchorBot), Bot 9 (VolumeLiquidityWideRangeBot),
Bot 10 (VolumeLiquidityHeldReclaimBot), and Bot 11
(OrderBlockReversalWiderStopBot) — see their own class docstrings in
bot_strategies.py for the exact, single, evidence-based variable each
isolates against its parent (Bot 6 for Bot 8; Bot 4 for both Bot 9 and
Bot 10; Bot 2 for Bot 11 — independent, cleanly separated single-
variable tests against each baseline, deliberately kept as separate
bots rather than combined, so a future result can tell WHICH change
actually mattered). This script creates one real BotConfig row per
instance, mirroring its parent's exact symbol/exchange/risk
configuration (dumped directly from the live production BotConfig rows
before writing this — not guessed), so the comparison is genuinely
apples-to-apples: same instruments, same risk per trade, same every
setting except the one variable each variant exists to test.

Bot 12 is different in kind from 8-11: it is NOT a new strategy class
at all — investigation found the real gap was in TRADE MANAGEMENT, not
entry logic. Real data (17 of 80 closed trades, 21%, hit TP1 then gave
back the ENTIRE remaining 70% of the position at a flat breakeven
floor, because trailing only activates at TP2 by default and nothing
protects the gap between TP1 and TP2 — the 39 trades that DID reach
TP2 and got real trailing protection averaged 6.35R, against 0.28R for
the TP1-only group) pointed at the exit mechanism, not the signal.
Bot 12 reuses Bot 2's own entry logic byte-for-byte (strategy_key=
"bot_2" — BotOrchestrator already runs every BotConfig row sharing a
strategy_key through that one shared instance, no new class needed)
with two changed BotConfig fields: trailing activates at TP1 (R=1.0)
instead of TP2 (R=2.0), using the new "step_down" trail width mode
(compute_trailing_stop in smc_algorithms.py) instead of "structure"
(fixed-width in v1) — full original-R width right as trailing
activates, so a normal pullback right after proving the trade at 1R
doesn't instantly stop the runner out, narrowing only as the peak
proves itself further past that.

Idempotent — skips any bot_id that already exists. Run once:
    python -m app.scripts.seed_ab_test_bots
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.bot import BotConfig, BotStatus, ExecutionMode, BotMode, MarginMode, TradingMode

# (bot_id, bot_name, strategy_key, exchange, symbols) — mirrors the
# real live bot_6_smc_v2* / bot_4_volume_liq* rows exactly, confirmed
# against the live database immediately before writing this.
BOT_8_INSTANCES = [
    ("bot_8_smc_v2_single_anchor", "SMC v2 Single-Anchor (A/B) X", "bingx", ["XAUTUSDT.P"]),
    ("bot_8_smc_v2_single_anchor_2", "SMC v2 Single-Anchor (A/B) bot-1", "bingx", ["BTCUSDT.P"]),
    ("bot_8_smc_v2_single_anchor_3", "SMC v2 Single-Anchor (A/B) JPY EU XAUT", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"]),
    ("bot_8_smc_v2_single_anchor_4", "SMC v2 Single-Anchor (A/B) NAS100", "mexc", ["NAS100USDT.P"]),
    ("bot_8_smc_v2_single_anchor_5", "SMC v2 Single-Anchor (A/B) Oil", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"]),
]
BOT_9_INSTANCES = [
    ("bot_9_volume_liq_wide_range", "Volume & Liquidity Wide-Range (A/B) bot-1", None, ["BTCUSDT.P"]),
    ("bot_9_volume_liq_wide_range_2", "Volume & Liquidity Wide-Range (A/B) JPY EU XAUT", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"]),
]
BOT_10_INSTANCES = [
    ("bot_10_volume_liq_held_reclaim", "Volume & Liquidity Held-Reclaim (A/B) bot-1", None, ["BTCUSDT.P"]),
    ("bot_10_volume_liq_held_reclaim_2", "Volume & Liquidity Held-Reclaim (A/B) JPY EU XAUT", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"]),
]
# Mirrors the real live bot_2_ob_reversal* rows exactly, confirmed
# against the live database immediately before writing this.
BOT_11_INSTANCES = [
    ("bot_11_ob_reversal_wider_stop", "HF Order Block Reversal (Wider-Stop A/B) bot-1", None, ["BTCUSDT.P"]),
    ("bot_11_ob_reversal_wider_stop_2", "HF Order Block Reversal (Wider-Stop A/B) JPY EU XAUT", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"]),
    ("bot_11_ob_reversal_wider_stop_3", "HF Order Block Reversal (Wider-Stop A/B) NAS100", "mexc", ["NAS100USDT.P"]),
    ("bot_11_ob_reversal_wider_stop_4", "HF Order Block Reversal (Wider-Stop A/B) OIL", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"]),
]
# Mirrors the real live bot_2_ob_reversal* rows exactly (same ones
# BOT_11_INSTANCES above mirrors) — strategy_key="bot_2" deliberately
# (Bot 12 is a trade-management A/B, not a new strategy).
BOT_12_INSTANCES = [
    ("bot_12_ob_reversal_runner", "HF Order Block Reversal (Runner A/B) bot-1", None, ["BTCUSDT.P"]),
    ("bot_12_ob_reversal_runner_2", "HF Order Block Reversal (Runner A/B) JPY EU XAUT", "mexc", ["JPYUSDT.P", "EURUSDT.P", "XAUTUSDT.P"]),
    ("bot_12_ob_reversal_runner_3", "HF Order Block Reversal (Runner A/B) NAS100", "mexc", ["NAS100USDT.P"]),
    ("bot_12_ob_reversal_runner_4", "HF Order Block Reversal (Runner A/B) OIL", "bingx", ["NCCO1OILBRENT2USDUSDT.P", "NCCO1OILWTI2USDUSDT.P"]),
]

COMMON_FIELDS = dict(
    bot_type="smc",
    status=BotStatus.ACTIVE,
    execution_mode=ExecutionMode.FULLY_AUTONOMOUS,
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
    min_rr_ratio=3.0,
    account_balance_usd=1000.0,
    use_trailing_stop=True,
    # Platform default as of the step_down rollout (see bot.py's
    # trailing_stop_activation/trailing_stop_distance column comments) —
    # was 2.0/"structure" when Bot 12 below first isolated this as an
    # A/B variant; now the baseline every bot here gets, not just Bot 12.
    trailing_stop_activation=1.0,
    trailing_stop_distance="step_down",
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

# Bot 12's own two-field override — see this module's own docstring
# for why only these two fields differ from Bot 2's (and therefore
# Bot 11's) exact settings: trailing activates a full R earlier, at a
# narrowing (not constant) width.
BOT_12_FIELDS = {**COMMON_FIELDS, "trailing_stop_activation": 1.0, "trailing_stop_distance": "step_down"}


async def seed_ab_test_bots():
    async with AsyncSessionLocal() as db:
        existing_ids = set((await db.execute(select(BotConfig.bot_id))).scalars().all())
        created = 0

        all_instances = BOT_8_INSTANCES + BOT_9_INSTANCES + BOT_10_INSTANCES + BOT_11_INSTANCES + BOT_12_INSTANCES
        for bot_id, bot_name, exchange, symbols in all_instances:
            if bot_id in existing_ids:
                print(f"  SKIP — {bot_id} already exists")
                continue
            if bot_id.startswith("bot_8_"):
                strategy_key, fields = "bot_8", COMMON_FIELDS
            elif bot_id.startswith("bot_9_"):
                strategy_key, fields = "bot_9", COMMON_FIELDS
            elif bot_id.startswith("bot_10_"):
                strategy_key, fields = "bot_10", COMMON_FIELDS
            elif bot_id.startswith("bot_11_"):
                strategy_key, fields = "bot_11", COMMON_FIELDS
            else:
                strategy_key, fields = "bot_2", BOT_12_FIELDS
            db.add(BotConfig(
                bot_id=bot_id, bot_name=bot_name, strategy_key=strategy_key,
                exchange=exchange, symbols=symbols, **fields,
            ))
            created += 1
            print(f"  OK — created {bot_id} (exchange={exchange}, symbols={symbols}, strategy_key={strategy_key})")

        await db.commit()
        print(f"\n{created} of {len(all_instances)} A/B test bot rows created.")


if __name__ == "__main__":
    asyncio.run(seed_ab_test_bots())
