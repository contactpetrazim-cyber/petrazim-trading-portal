
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.bot import BotConfig, BotStatus, ExecutionMode
from app.models.user import User, UserRole
from app.core.auth import get_current_user
from app.schemas import BotConfigCreate, BotConfigResponse, BotToggle, BotExchangeUpdate
import structlog

router = APIRouter(prefix="/bots", tags=["bots"])
logger = structlog.get_logger()

# Admin/Super Admin see every bot (same principle as roster.py's
# get_roster) — everyone else only ever sees or touches their own.
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


async def _get_owned_bot(bot_id: str, user: User, db: AsyncSession) -> BotConfig:
    """Fetch a bot and enforce ownership — 404s rather than 403s on a
    bot that exists but isn't the caller's, so this doesn't leak which
    bot_ids exist to a probing Trader."""
    query = select(BotConfig).where(BotConfig.bot_id == bot_id)
    result = await db.execute(query)
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if bot.user_id != user.id and user.role not in STAFF_ROLES:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot


@router.get("/", response_model=List[BotConfigResponse])
async def list_bots(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """List the caller's own configured trading bots (Admin/Super Admin see all)."""
    query = select(BotConfig).order_by(BotConfig.created_at.desc())
    if user.role not in STAFF_ROLES:
        query = query.where(BotConfig.user_id == user.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=BotConfigResponse)
async def create_bot(
    config: BotConfigCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
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
        exchange=config.exchange,
        user_id=user.id,
    )

    db.add(bot)
    await db.commit()
    await db.refresh(bot)

    logger.info("bot_created", bot_id=config.bot_id, name=config.bot_name, user_id=str(user.id))
    return bot

@router.get("/{bot_id}", response_model=BotConfigResponse)
async def get_bot(bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get bot configuration details — must be the caller's own bot (or Admin/Super Admin)."""
    return await _get_owned_bot(bot_id, user, db)

@router.patch("/{bot_id}/toggle")
async def toggle_bot(
    bot_id: str, toggle: BotToggle, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
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
    bot.exchange = update.exchange
    await db.commit()

    return {"success": True, "bot_id": bot_id, "exchange": update.exchange}

@router.get("/{bot_id}/performance")
async def bot_performance(
    bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Get performance metrics for a specific bot."""
    await _get_owned_bot(bot_id, user, db)
    # In production: query analytics tables
    return {
        "bot_id": bot_id,
        "total_trades": 0,
        "win_rate": 0.0,
        "profit_factor": 0.0,
        "average_r": 0.0
    }
