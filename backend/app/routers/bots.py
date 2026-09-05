
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.bot import BotConfig, BotStatus, ExecutionMode
from app.models.user import User, UserRole
from app.core.access_gate import require_active_access
from app.models.trade import Trade, TradeStatus
from app.services.roster_access import user_can_manage_trader
from app.schemas import BotConfigCreate, BotConfigResponse, BotToggle, BotExchangeUpdate, BotMetricsUpdate, BotRename
import structlog

router = APIRouter(prefix="/bots", tags=["bots"])
logger = structlog.get_logger()

# Admin/Super Admin see every bot (same principle as roster.py's
# get_roster) — everyone else only ever sees or touches their own,
# with one exception: a Fund Manager/Partner may also manage a bot
# belonging to a Trader on their own roster (user_can_manage_trader) —
# this is what actually lets a Manager adjust a Trader's risk settings
# from the Manager console, not just view them.
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


async def _get_owned_bot(bot_id: str, user: User, db: AsyncSession) -> BotConfig:
    """Fetch a bot and enforce ownership — 404s rather than 403s on a
    bot that exists but isn't the caller's (or a roster trader's), so
    this doesn't leak which bot_ids exist to a probing Trader."""
    query = select(BotConfig).where(BotConfig.bot_id == bot_id)
    result = await db.execute(query)
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if bot.user_id != user.id and not await user_can_manage_trader(user, bot.user_id, db):
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot


@router.get("/", response_model=List[BotConfigResponse])
async def list_bots(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """List the caller's own configured trading bots (Admin/Super Admin see all)."""
    query = select(BotConfig).order_by(BotConfig.created_at.desc())
    if user.role not in STAFF_ROLES:
        query = query.where(BotConfig.user_id == user.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=BotConfigResponse)
async def create_bot(
    config: BotConfigCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    """Create a new bot configuration, owned by the authenticated caller."""
    bot = BotConfig(
        bot_id=config.bot_id,
        bot_name=config.bot_name,
        bot_type=config.bot_type,
        symbols=config.symbols,
        timeframes=config.timeframes,
        risk_per_trade=config.risk_per_trade,
        max_daily_trades=config.max_daily_trades,
        max_concurrent_trades=config.max_concurrent_trades,
        min_rr_ratio=config.min_rr_ratio,
        execution_mode=ExecutionMode(config.execution_mode),
        use_trailing_stop=config.use_trailing_stop,
        strategy_params=config.strategy_params or {},
        # Lowercased/trimmed — execution_engine.py's own broker map
        # ("bingx", "binance", "bybit", "mexc", ...) is a lowercase
        # dict key lookup, and this field now accepts genuinely
        # free-typed text (see BotConfigCreate.exchange's own comment),
        # so a manually typed "Binance" would otherwise silently never
        # match and fall through to paper mode with no signal why.
        exchange=config.exchange.strip().lower() if config.exchange else None,
        user_id=user.id,
    )

    db.add(bot)
    await db.commit()
    await db.refresh(bot)

    logger.info("bot_created", bot_id=config.bot_id, name=config.bot_name, user_id=str(user.id))
    return bot

@router.get("/{bot_id}", response_model=BotConfigResponse)
async def get_bot(bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Get bot configuration details — must be the caller's own bot (or Admin/Super Admin)."""
    return await _get_owned_bot(bot_id, user, db)

@router.patch("/{bot_id}/toggle")
async def toggle_bot(
    bot_id: str, toggle: BotToggle, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    """Activate or deactivate a bot."""
    bot = await _get_owned_bot(bot_id, user, db)
    bot.status = BotStatus.ACTIVE if toggle.active else BotStatus.PAUSED
    await db.commit()

    return {"success": True, "bot_id": bot_id, "status": bot.status.value}

@router.patch("/{bot_id}/mode")
async def set_execution_mode(
    bot_id: str,
    mode: str,  # human_in_loop or fully_autonomous
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Switch bot execution mode."""
    bot = await _get_owned_bot(bot_id, user, db)

    if mode not in ["human_in_loop", "fully_autonomous"]:
        raise HTTPException(status_code=400, detail="Invalid mode")

    bot.execution_mode = ExecutionMode(mode)
    await db.commit()

    return {"success": True, "bot_id": bot_id, "mode": mode}

@router.patch("/{bot_id}/exchange")
async def set_bot_exchange(
    bot_id: str,
    update: BotExchangeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """
    Pin which exchange this bot executes on (and which live ticker the
    cross-exchange price-deviation guard checks against — see
    execution_engine.py::_check_price_deviation). Changeable anytime:
    it's read straight from the DB on every incoming signal for this
    bot, so this takes effect on the very next trade, no restart or
    redeploy needed.
    """
    bot = await _get_owned_bot(bot_id, user, db)
    bot.exchange = update.exchange.strip().lower()
    await db.commit()

    return {"success": True, "bot_id": bot_id, "exchange": bot.exchange}

@router.patch("/{bot_id}/name", response_model=BotConfigResponse)
async def rename_bot(
    bot_id: str, rename: BotRename, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Rename a bot — by direct request ("create options to edit bot
    names"). Only the display name changes; bot_id (the stable
    identifier trades/webhooks reference) is untouched."""
    bot = await _get_owned_bot(bot_id, user, db)
    bot.bot_name = rename.bot_name.strip()
    await db.commit()
    await db.refresh(bot)
    return bot

@router.delete("/{bot_id}")
async def delete_bot(
    bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Delete a bot configuration — by direct request ("also to delete
    bots"). Trade.bot_id is a plain string column, not a foreign key
    (see models/trade.py), so this never touches — and can never orphan
    — that bot's trade history; its past trades simply keep existing
    under a bot_id that no longer has a live config, the same as they
    would for a bot that was renamed or reconfigured. A bot with any
    PENDING or ACTIVE trade is refused rather than silently deleted out
    from under a live position — pause/close it first."""
    bot = await _get_owned_bot(bot_id, user, db)

    open_count = (await db.execute(
        select(Trade.id).where(
            Trade.bot_id == bot_id, Trade.status.in_([TradeStatus.PENDING, TradeStatus.ACTIVE]),
        ).limit(1)
    )).scalar_one_or_none()
    if open_count is not None:
        raise HTTPException(
            status_code=409,
            detail="This bot has a pending or active trade — pause it and close/cancel that trade before deleting.",
        )

    await db.delete(bot)
    await db.commit()
    logger.info("bot_deleted", bot_id=bot_id, user_id=str(user.id))
    return {"success": True, "bot_id": bot_id}

@router.patch("/{bot_id}/metrics", response_model=BotConfigResponse)
async def update_bot_metrics(
    bot_id: str,
    update: BotMetricsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Edit a bot's risk/entry metrics — risk per trade, daily/
    concurrent trade caps, portfolio exposure cap, min R:R, trailing
    stop, symbols, timeframes. The gap this closes: only toggle/mode/
    exchange had their own PATCH before; every other BotConfig field
    was set once at creation and never editable again."""
    bot = await _get_owned_bot(bot_id, user, db)

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(bot, field, value)

    await db.commit()
    await db.refresh(bot)
    return bot

@router.get("/{bot_id}/performance")
async def bot_performance(
    bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    """Get real performance metrics for a specific bot, computed from
    its own closed trades — this used to be a stub that always
    returned zeros regardless of actual trade history."""
    await _get_owned_bot(bot_id, user, db)

    query = select(Trade).where(Trade.bot_id == bot_id, Trade.status == TradeStatus.CLOSED)
    result = await db.execute(query)
    trades = result.scalars().all()

    total = len(trades)
    if total == 0:
        return {"bot_id": bot_id, "total_trades": 0, "win_rate": 0.0, "profit_factor": 0.0, "average_r": 0.0}

    wins = [t for t in trades if (t.realized_pnl or 0) > 0]
    losses = [t for t in trades if (t.realized_pnl or 0) < 0]
    gross_profit = sum(t.realized_pnl or 0 for t in wins)
    gross_loss = abs(sum(t.realized_pnl or 0 for t in losses))
    r_multiples = [t.r_multiple for t in trades if t.r_multiple is not None]

    return {
        "bot_id": bot_id,
        "total_trades": total,
        "win_rate": round(len(wins) / total * 100, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0.0,
        "average_r": round(sum(r_multiples) / len(r_multiples), 2) if r_multiples else 0.0,
    }
