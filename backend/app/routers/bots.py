
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models.bot import BotConfig, BotStatus, ExecutionMode
from app.models.user import User, UserRole
from app.core.access_gate import require_active_access
from app.core.auth import get_current_user, require_super_admin
from app.models.platform_setting import MARGIN_AUTO_SWITCH_ENABLED_KEY, MARKET_SCANNER_ENABLED_KEY, MASTER_ACCOUNT_BALANCE_KEY, MASTER_LEVERAGE_KEY, PlatformSetting
from app.models.trade import Trade, TradeStatus
from app.services.roster_access import user_can_manage_trader
from app.services.market_scanner import get_market_scanner_runtime_enabled, get_master_account_balance
from app.services.capital_adequacy import get_master_leverage
from app.models.trade import TradingMode
from app.config import get_settings
from app.schemas import BotConfigCreate, BotConfigResponse, BotToggle, BotExchangeUpdate, BotMetricsUpdate, BotRename, BotTradingModeUpdate, BotSleepUpdate, BotSubAutoUpdate, BotScheduleUpdate
import json
import structlog

router = APIRouter(prefix="/bots", tags=["bots"])
logger = structlog.get_logger()

# Shared by GET /bots/exchange-balances (trader-facing, gated — see
# that function's own docstring) and GET /bots/master-exchange-balances (the
# platform-wide Master view, super-admin only) — by direct request
# ("the exchange balance info should be gated based on user ... Create
# a Master Exchange Balance card in the Admin portal that sees all").
# Real bug fixed here, found live: every balance read used to run
# sequentially, and one slow/misconfigured account (confirmed live — a
# MetaApi connection not yet linked to its broker) was enough alone to
# blow past the frontend's own request timeout even though this
# endpoint eventually returned 200. Each read now has its own short
# timeout and all of them run concurrently (asyncio.gather at each
# call site below) — see _read_exchange_balance's own docstring.
_BALANCE_READ_TIMEOUT = 8.0


async def _read_exchange_balance(client) -> dict:
    from app.services.margin_switch_engine import _extract_available_balance
    try:
        raw = await asyncio.wait_for(client.get_balance(), timeout=_BALANCE_READ_TIMEOUT)
    except asyncio.TimeoutError:
        return {"balance": None, "unrecognized_shape": False, "error": f"Timed out after {_BALANCE_READ_TIMEOUT:.0f}s."}
    except Exception as e:
        return {"balance": None, "unrecognized_shape": False, "error": str(e)}
    if isinstance(raw, dict) and raw.get("success") is False:
        return {"balance": None, "unrecognized_shape": False, "error": raw.get("error") or "Balance call failed."}
    balance = _extract_available_balance(raw)
    return {"balance": balance, "unrecognized_shape": balance is None, "error": None}


async def _bot_balance_entry(db: AsyncSession, credential_bot_id: str, display_name: str, credential, used_by: dict) -> dict:
    from app.services.broker_credentials import build_broker_client
    entry = {
        "bot_id": credential_bot_id, "bot_name": display_name, "exchange": credential.exchange,
        "label": credential.sub_account_label,
        "used_by": used_by.get((credential_bot_id, credential.exchange), []),
    }
    try:
        client = await build_broker_client(db, credential_bot_id, credential.exchange)
    except Exception as e:
        entry.update(balance=None, unrecognized_shape=False, error=str(e))
        return entry
    if client is None:
        entry.update(balance=None, unrecognized_shape=False, error="No credential client could be built.")
        return entry
    entry.update(await _read_exchange_balance(client))
    return entry


async def _trader_balance_entry(connection, include_owner: bool = False) -> dict:
    from app.services.trader_broker_connections import build_client_from_connection
    entry = {"connection_id": str(connection.id), "exchange": connection.exchange, "label": connection.label}
    if include_owner:
        entry["user_id"] = str(connection.user_id)
    try:
        client = build_client_from_connection(connection)
    except Exception as e:
        entry.update(balance=None, unrecognized_shape=False, error=str(e))
        return entry
    entry.update(await _read_exchange_balance(client))
    return entry


def _credential_owner_of(bot: BotConfig) -> str:
    from app.services.broker_credentials import STRATEGY_CREDENTIAL_OWNER
    strategy_key = bot.strategy_key or "_".join(bot.bot_id.split("_")[:2])
    return STRATEGY_CREDENTIAL_OWNER.get(strategy_key, bot.bot_id)


def _compute_used_by(bots: list[BotConfig]) -> dict[tuple[str, str], list[dict]]:
    """(credential owner, exchange) -> every bot in `bots` CURRENTLY
    preferring that exact pair right now — see get_exchange_balances'
    own docstring for the fixed/auto resolution rule this mirrors
    (exchange_engine.py's own resolve_exchange)."""
    default_exchange = get_settings().MARKET_SCANNER_DEFAULT_EXCHANGE
    used_by: dict[tuple[str, str], list[dict]] = {}
    for bot in bots:
        owner_id = _credential_owner_of(bot)
        mode = bot.exchange_mode or "fixed"
        if mode == "auto":
            preferred_exchange = bot.active_exchange
            reason = bot.active_exchange_reason
        else:
            preferred_exchange = bot.exchange or default_exchange
            reason = None
        if not preferred_exchange:
            continue  # Auto-mode bot that hasn't had its first scan yet — nothing to attribute yet.
        used_by.setdefault((owner_id, preferred_exchange), []).append(
            {"bot_id": bot.bot_id, "bot_name": bot.bot_name, "mode": mode, "reason": reason}
        )
    return used_by


async def _bot_accounts_for(db: AsyncSession, bots: list[BotConfig]) -> list[dict]:
    from app.services.broker_credentials import list_credentials_for_bot
    credential_bot_ids: dict[str, str] = {}
    for bot in bots:
        owner_id = _credential_owner_of(bot)
        if owner_id not in credential_bot_ids:
            owner_bot = next((b for b in bots if b.bot_id == owner_id), None)
            if owner_bot is None:
                owner_bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == owner_id))).scalar_one_or_none()
            credential_bot_ids[owner_id] = owner_bot.bot_name if owner_bot else owner_id
    used_by = _compute_used_by(bots)
    tasks = [
        _bot_balance_entry(db, credential_bot_id, display_name, credential, used_by)
        for credential_bot_id, display_name in sorted(credential_bot_ids.items())
        for credential in await list_credentials_for_bot(db, credential_bot_id)
    ]
    return list(await asyncio.gather(*tasks))

# Admin/Super Admin see every bot (same principle as roster.py's
# get_roster) — everyone else only ever sees or touches their own,
# with one exception: a Fund Manager/Partner may also manage a bot
# belonging to a Trader on their own roster (user_can_manage_trader) —
# this is what actually lets a Manager adjust a Trader's risk settings
# from the Manager console, not just view them.
STAFF_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


class MarketScannerModeResponse(BaseModel):
    # Deploy-level capability — set once via the MARKET_SCANNER_ENABLED
    # env var on Render and the Nube VM backup; read-only here, since
    # changing it needs a redeploy, not a toggle click.
    capability_enabled: bool
    # Admin runtime pause/resume switch — this is what the toggle
    # button in the Admin console actually flips. Only meaningful when
    # capability_enabled is also True.
    runtime_enabled: bool


@router.get("/market-scanner-mode", response_model=MarketScannerModeResponse)
async def get_market_scanner_mode(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Any authenticated user can read this — same "everyone sees the
    resolved state, only Super Admin changes it" shape as
    manual_trading.py's own master-mode endpoint."""
    return MarketScannerModeResponse(
        capability_enabled=get_settings().MARKET_SCANNER_ENABLED,
        runtime_enabled=await get_market_scanner_runtime_enabled(db),
    )


class SetMarketScannerModeRequest(BaseModel):
    runtime_enabled: bool


@router.patch("/market-scanner-mode", response_model=MarketScannerModeResponse)
async def set_market_scanner_mode(
    req: SetMarketScannerModeRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin),
):
    """Super Admin only — by direct request ("provide a switch in the
    admin toggle on and off"). Pauses/resumes the already-running
    scanner loop without a redeploy; see MARKET_SCANNER_ENABLED_KEY's
    own comment for why this is separate from the env var."""
    value = "true" if req.runtime_enabled else "false"
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MARKET_SCANNER_ENABLED_KEY)
    )).scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=MARKET_SCANNER_ENABLED_KEY, value=value))
    await db.commit()
    return MarketScannerModeResponse(
        capability_enabled=get_settings().MARKET_SCANNER_ENABLED,
        runtime_enabled=req.runtime_enabled,
    )


class MasterAccountBalanceResponse(BaseModel):
    enabled: bool
    value: float
    # config.py's own static default — shown so the Admin console can
    # display "currently resolving to $X" even while the override is
    # off, same honesty as GlobalRiskDefaultsResponse's own is_override.
    platform_default: float


@router.get("/master-account-balance", response_model=MasterAccountBalanceResponse)
async def get_master_account_balance_route(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Any authenticated user can read this — the Bots page shows it so
    a Trader can see when their own Starting Reference Capital is being
    overridden, same "everyone sees the resolved state, only Super
    Admin changes it" shape as /master-mode."""
    enabled, value = await get_master_account_balance(db)
    return MasterAccountBalanceResponse(enabled=enabled, value=value, platform_default=get_settings().MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE)


class SetMasterAccountBalanceRequest(BaseModel):
    enabled: bool
    value: float = Field(gt=0)


@router.patch("/master-account-balance", response_model=MasterAccountBalanceResponse)
async def set_master_account_balance(
    req: SetMasterAccountBalanceRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin),
):
    """Super Admin only — "put master in Admin portal to supersede
    all." Turning this on forces EVERY bot's signal sizing to use this
    ONE balance, platform-wide, regardless of what any individual
    bot's own Starting Reference Capital says — a genuine kill-switch,
    not a per-bot default (see get_effective_account_balance's own
    comment for the precedence order)."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MASTER_ACCOUNT_BALANCE_KEY)
    )).scalar_one_or_none()
    value = json.dumps({"enabled": req.enabled, "value": req.value})
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=MASTER_ACCOUNT_BALANCE_KEY, value=value))
    await db.commit()
    return MasterAccountBalanceResponse(enabled=req.enabled, value=req.value, platform_default=get_settings().MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE)


class MasterLeverageResponse(BaseModel):
    enabled: bool
    value: float
    # config.py's own static default — same honesty as
    # MasterAccountBalanceResponse's own platform_default.
    platform_default: float


@router.get("/master-leverage", response_model=MasterLeverageResponse)
async def get_master_leverage_route(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Any authenticated user can read this — both the Bots page and
    the Manual Trading Risk Settings card show it, same "everyone sees
    the resolved state, only Super Admin changes it" shape as every
    other master switch here."""
    enabled, value = await get_master_leverage(db)
    return MasterLeverageResponse(enabled=enabled, value=value, platform_default=get_settings().MAX_NOTIONAL_LEVERAGE)


class SetMasterLeverageRequest(BaseModel):
    enabled: bool
    value: float = Field(gt=0, le=125)


@router.patch("/master-leverage", response_model=MasterLeverageResponse)
async def set_master_leverage(
    req: SetMasterLeverageRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin),
):
    """Super Admin only — by direct request ("put a form to set
    leverage for Bot and manual - separately on the trader dashboard
    ... with a global override form in the Admin"). Turning this on
    forces EVERY bot's AND every trader's manual-trading leverage to
    this ONE value, platform-wide, regardless of any individual
    bot's/trader's own setting — a genuine kill-switch, not a soft
    default (see get_effective_leverage's own comment for the
    precedence order)."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MASTER_LEVERAGE_KEY)
    )).scalar_one_or_none()
    value = json.dumps({"enabled": req.enabled, "value": req.value})
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=MASTER_LEVERAGE_KEY, value=value))
    await db.commit()
    return MasterLeverageResponse(enabled=req.enabled, value=req.value, platform_default=get_settings().MAX_NOTIONAL_LEVERAGE)


class MarginAutoSwitchModeResponse(BaseModel):
    enabled: bool


@router.get("/margin-auto-switch-mode", response_model=MarginAutoSwitchModeResponse)
async def get_margin_auto_switch_mode(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Any authenticated user can read this — same "everyone sees the
    resolved state, only Super Admin changes it" shape as every other
    master switch here. Even when this is on, a given bot/connection
    still needs its OWN margin_mode set to AUTO_SWITCH to actually
    use it — see app/models/bot.py's MarginMode."""
    from app.services.margin_switch_engine import get_margin_auto_switch_enabled
    return MarginAutoSwitchModeResponse(enabled=await get_margin_auto_switch_enabled(db))


class SetMarginAutoSwitchModeRequest(BaseModel):
    enabled: bool


@router.patch("/margin-auto-switch-mode", response_model=MarginAutoSwitchModeResponse)
async def set_margin_auto_switch_mode(
    req: SetMarginAutoSwitchModeRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin),
):
    """Super Admin only — the master switch half of "there should be a
    dedicated Vs Auto margin account setting for bots and manual and
    also a master switch in the Admin portal." Off (the default) means
    no bot/trader can ever trigger a fallback regardless of their own
    margin_mode; see services/margin_switch_engine.py's own docstring
    for the full resolution order."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MARGIN_AUTO_SWITCH_ENABLED_KEY)
    )).scalar_one_or_none()
    value = "true" if req.enabled else "false"
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=MARGIN_AUTO_SWITCH_ENABLED_KEY, value=value))
    await db.commit()
    return MarginAutoSwitchModeResponse(enabled=req.enabled)


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

@router.get("/exchange-balances")
async def get_exchange_balances(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    """Live trading-capital/margin balance per real exchange account —
    by direct request ("Can we retrieve exchange account trading
    capital or margin capital balance and create a exchange balance
    page to check such balances"), gated by direct follow-up request
    ("the exchange balance info should be gated based on user"). Two
    groups:

      - `bot_accounts`: every DEDICATED platform sub-account
        (BotBrokerCredential) — ADMIN/SUPER ADMIN ONLY. This is the
        platform's own money, on its own sub-accounts, not any one
        trader's to see just because they own a BotConfig row that
        happens to trade through it — a regular trader always gets an
        empty list here with `bot_accounts_restricted: true`, so the
        page can say exactly why rather than implying no accounts
        exist. See GET /bots/master-exchange-balances below for the real,
        platform-wide Admin view this was split out of.
      - `trader_accounts`: the CALLER's own connected exchange accounts
        (TraderBrokerConnection) only — never another trader's, at any
        role, since another trader's personal exchange balance is
        their own, never shown to anyone browsing their own copy of
        this page.

    Reuses exactly the same get_balance()/_extract_available_balance
    call exchange_engine.py's own candidate-ranking already makes, so
    a balance shown here is the SAME number (and the SAME "unrecognized
    shape" caveat for a broker like BingX whose get_balance() isn't
    normalized yet — see margin_switch_engine.py's own comment) the
    Exchange Engine itself is actually deciding against, not a second,
    possibly-divergent read.

    Each `bot_accounts` entry also carries `used_by` — every bot
    CURRENTLY preferring that exact (credential owner, exchange) pair
    right now, by direct request ("exchange balance page should
    somehow integrate with the preferred exchange and auto"): a
    "fixed"-mode bot matches its own `exchange` (or the scanner default
    when unset, same fallback exchange_engine.py's own resolve_exchange
    always receives); an "auto"-mode bot matches its live
    `active_exchange` (empty until its first scan actually picks one)
    — so this page answers not just "what's the balance" but "which
    bot is this balance actually backing, and why" in one place."""
    from app.services.trader_broker_connections import list_connections_for_trader

    trader_connections = await list_connections_for_trader(db, user.id)
    trader_accounts = list(await asyncio.gather(*[_trader_balance_entry(c) for c in trader_connections]))

    if user.role not in STAFF_ROLES:
        return {"bot_accounts": [], "bot_accounts_restricted": True, "trader_accounts": trader_accounts}

    bots = (await db.execute(select(BotConfig).order_by(BotConfig.bot_id))).scalars().all()
    bot_accounts = await _bot_accounts_for(db, bots)
    return {"bot_accounts": bot_accounts, "bot_accounts_restricted": False, "trader_accounts": trader_accounts}


@router.get("/master-exchange-balances")
async def get_master_exchange_balances(db: AsyncSession = Depends(get_db), admin: User = Depends(require_super_admin)):
    """The Master Exchange Balance view — by direct request ("Create a
    Master Exchange Balance card in the Admin portal that sees all").
    Super Admin only (same gate as every other platform-wide MASTER
    override in this router — Master Leverage, Master Account Balance,
    the Margin Auto-Switch master switch): unlike GET /bots/exchange-
    balances above (gated to the caller's own trader_accounts, and to
    bot_accounts for staff only), this endpoint has NO ownership
    scoping at all on either side —
      - `bot_accounts`: every platform bot sub-account, platform-wide
        (same dedup-by-credential-owner and `used_by` attribution as
        the trader-facing endpoint, just computed over EVERY BotConfig
        row that exists, not just the caller's own visible ones).
      - `trader_accounts`: every TRADER's own connected exchange
        account, platform-wide, each tagged with whose it is
        (`user_id`/`user_name`/`user_email`) — the one place this
        platform-wide aggregation is appropriate, since a Super Admin
        overseeing real capital across every trader is exactly what
        this card exists for."""
    from sqlalchemy import select as _select
    from app.models.trader_broker_connection import TraderBrokerConnection

    all_bots = (await db.execute(select(BotConfig).order_by(BotConfig.bot_id))).scalars().all()
    bot_accounts = await _bot_accounts_for(db, all_bots)

    connections = (await db.execute(_select(TraderBrokerConnection).order_by(TraderBrokerConnection.exchange))).scalars().all()
    owner_ids = {c.user_id for c in connections}
    owners = {}
    if owner_ids:
        owner_rows = (await db.execute(_select(User).where(User.id.in_(owner_ids)))).scalars().all()
        owners = {o.id: o for o in owner_rows}

    async def _owned_trader_entry(connection) -> dict:
        entry = await _trader_balance_entry(connection, include_owner=True)
        owner = owners.get(connection.user_id)
        entry["user_name"] = owner.full_name if owner else None
        entry["user_email"] = owner.email if owner else None
        return entry

    trader_accounts = list(await asyncio.gather(*[_owned_trader_entry(c) for c in connections]))
    return {"bot_accounts": bot_accounts, "trader_accounts": trader_accounts}

@router.post("/", response_model=BotConfigResponse)
async def create_bot(
    config: BotConfigCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    """Create a new bot configuration, owned by the authenticated caller.

    bot_id must be globally unique (BotConfig.bot_id's own unique
    constraint) — checked explicitly here, with a clear message, by
    direct bug report ("I cant seem to be able to create more than 5
    bots even though I don't mind repeating the bot strategy"): picking
    the same strategy twice in the frontend's "New Bot" form used to
    send the SAME fixed bot_id both times, failing with a bare DB
    integrity error the frontend could only show as "Could not create
    bot." The frontend now generates a unique bot_id itself (an
    incrementing suffix) when the chosen strategy is already taken, so
    this collision shouldn't actually happen in normal use any more —
    this check stays as a clear, honest error for the rare case it
    still does (e.g. two tabs creating a bot at once), instead of a
    confusing generic one.
    """
    existing = (await db.execute(select(BotConfig).where(BotConfig.bot_id == config.bot_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"A bot with id '{config.bot_id}' already exists — try again (this is auto-generated, so a fresh attempt picks a new one).")

    bot = BotConfig(
        bot_id=config.bot_id,
        bot_name=config.bot_name,
        bot_type=config.bot_type,
        strategy_key=config.strategy_key,
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

@router.patch("/{bot_id}/trading-mode", response_model=BotConfigResponse)
async def set_bot_trading_mode(
    bot_id: str, update: BotTradingModeUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """The same Test/Live + Paper Trading pair ManualTradingPage's
    header already gives a manual trader, now per-bot — by direct
    request ("do the same and do paper trading for bot trading ... so
    we can use paper trading in test mode ... with an additional
    option to toggle paper trading in live mode"). Both fields are
    independent, exactly like the manual-trading pair: trading_mode
    TEST never reaches a real broker for this bot; paper_trading_enabled
    is a second, separate switch that keeps diverting the final fill
    even once trading_mode is LIVE. See execution_engine.py's own
    process_signal for where this actually gets read and turned into
    Trade.is_test on this bot's next signal — takes effect immediately,
    no restart needed, same as every other per-bot setting here."""
    bot = await _get_owned_bot(bot_id, user, db)
    if update.trading_mode is not None:
        bot.trading_mode = TradingMode(update.trading_mode)
    if update.paper_trading_enabled is not None:
        bot.paper_trading_enabled = update.paper_trading_enabled
    await db.commit()
    await db.refresh(bot)
    return bot

@router.patch("/{bot_id}/exchange", response_model=BotConfigResponse)
async def set_bot_exchange(
    bot_id: str,
    update: BotExchangeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """
    Pin which exchange this bot executes on (and which live ticker the
    cross-exchange price-deviation guard checks against — see
    execution_engine.py::_check_price_deviation), and/or switch its
    Exchange Engine mode (see BotConfig.exchange_mode's own comment).
    Both fields are optional and independent — send either, or both.
    Changeable anytime: read straight from the DB on every incoming
    signal for this bot, so this takes effect on the very next trade,
    no restart or redeploy needed.

    Switching `mode` to "fixed" clears the Auto engine's own live pick
    (active_exchange/active_exchange_reason/active_exchange_picked_at)
    — a stale Auto pick sitting around after a trader deliberately
    switched back to Fixed would be confusing, dead state, not a real
    decision anymore. Sending `mode: "auto"` ALWAYS clears
    active_exchange_picked_at (even when the bot is already in Auto
    mode) — exchange_engine.py's own sticky cooldown treats a null
    picked_at as "never picked," so this is also the real "re-check
    now" action the Bots page exposes: re-sending the same mode forces
    an immediate re-evaluation on this bot's very next scan instead of
    waiting out the cooldown.
    """
    bot = await _get_owned_bot(bot_id, user, db)
    if update.exchange is not None:
        bot.exchange = update.exchange.strip().lower()
    if update.mode is not None:
        bot.exchange_mode = update.mode
        if update.mode == "fixed":
            bot.active_exchange = None
            bot.active_exchange_reason = None
            bot.active_exchange_picked_at = None
        elif update.mode == "auto":
            bot.active_exchange_picked_at = None
    await db.commit()
    await db.refresh(bot)
    return bot

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

@router.patch("/{bot_id}/sleep", response_model=BotConfigResponse)
async def set_bot_sleep(
    bot_id: str, update: BotSleepUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Pause this bot's scanning for a set window (or wake it up right
    now — the "Reset" action) — by direct request. See
    BotConfig.sleep_until's own comment for why nothing else about the
    bot's settings is ever touched: it always resumes to exactly what
    it was already set to."""
    bot = await _get_owned_bot(bot_id, user, db)
    bot.sleep_until = (datetime.utcnow() + timedelta(hours=update.hours)) if update.hours else None
    await db.commit()
    await db.refresh(bot)
    return bot

@router.patch("/{bot_id}/sub-auto", response_model=BotConfigResponse)
async def set_bot_sub_auto(
    bot_id: str, update: BotSubAutoUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Engage or reset Sub-Auto Mode — pre-approved autonomous
    execution up to a total AND a daily trade cap, by direct request.
    See BotConfig.sub_auto_active's own comment for the full
    enforcement (execution_engine.py's process_signal) and how it
    auto-reverts once the total cap is reached. Reset (enabled=False)
    can also interrupt an engagement early, at any point — same
    "restore whatever this bot was actually set to before" behavior
    either way."""
    bot = await _get_owned_bot(bot_id, user, db)
    if update.enabled:
        if not update.total_cap or not update.daily_cap:
            raise HTTPException(status_code=400, detail="total_cap and daily_cap are both required to engage Sub-Auto Mode.")
        if not bot.sub_auto_active:
            # Only snapshot/reset on a fresh False→True engage — real
            # compliance bug, found via direct audit request ("why are
            # some bots having 14 trades when the max set was 10 ...
            # and why are some with just 1 trade reset when the max set
            # is 10"). sub_auto_risk_amount/min_rr_ratio edits apply
            # "regardless of enabled/disabled" (see below), and
            # total_cap/daily_cap are REQUIRED whenever enabled=True —
            # meaning a trader adjusting even one Sub-Auto setting while
            # already engaged had to resubmit enabled=True, which used
            # to unconditionally zero sub_auto_trades_executed/
            # sub_auto_daily_count/sub_auto_daily_date every single
            # time, exactly like this method already protected
            # pre_sub_auto_execution_mode from. A bot genuinely at, say,
            # 9 of a 10-trade total allotment got its progress silently
            # erased back to 0 on the next settings tweak, letting it
            # execute a full fresh batch of up to total_cap trades all
            # over again — and again, and again — with no real ceiling
            # on lifetime Sub-Auto executions despite the stated cap.
            # Conversely a bot the trader had JUST reset this way shows
            # a low sub_auto_trades_executed (1, matching the one trade
            # that landed right after the reset) while its REAL
            # lifetime trade count is far higher — same bug, same
            # symptom from the other side. Now ONLY a genuine
            # False→True engage resets progress; editing caps or risk
            # settings on an already-active engagement preserves
            # whatever progress toward the cap has actually been made,
            # live trades and paper trades alike (this bookkeeping has
            # no is_test branch anywhere in execution_engine.py's own
            # increment — it already applied uniformly to both).
            bot.pre_sub_auto_execution_mode = bot.execution_mode
            bot.sub_auto_trades_executed = 0
            bot.sub_auto_daily_count = 0
            bot.sub_auto_daily_date = None
        bot.sub_auto_active = True
        bot.sub_auto_total_cap = update.total_cap
        bot.sub_auto_daily_cap = update.daily_cap
        bot.execution_mode = ExecutionMode.FULLY_AUTONOMOUS
    else:
        bot.sub_auto_active = False
        bot.execution_mode = bot.pre_sub_auto_execution_mode or bot.execution_mode
        bot.pre_sub_auto_execution_mode = None
    # Risk Amount (USD) / RR overrides — by direct request. Applied
    # regardless of enabled/disabled above (a trader can tighten/loosen
    # an already-active engagement, or pre-set one before ever
    # engaging) and left untouched when omitted — see
    # BotSubAutoUpdate's own comment for why these aren't cleared by a
    # plain Reset (enabled=False) either.
    if update.risk_amount is not None:
        bot.sub_auto_risk_amount = update.risk_amount
    if update.min_rr_ratio is not None:
        bot.sub_auto_min_rr_ratio = update.min_rr_ratio
    await db.commit()
    await db.refresh(bot)
    return bot


@router.patch("/{bot_id}/schedule", response_model=BotConfigResponse)
async def set_bot_schedule(
    bot_id: str, update: BotScheduleUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """Trading Schedule — by direct request ("integrate as quick
    filters for the semi auto and normal bot setups"), a BOT-LEVEL
    setting (not Sub-Auto-specific — see BotConfig.schedule_sessions'
    own comment for the full enforcement story: applies to every
    signal this bot produces, any mode, any source). Same "field
    omitted == leave untouched" convention as every other partial-
    update endpoint in this router, except an explicitly-sent empty
    list (`[]` for sessions/days) or `"all"` (for half_day) is itself
    a real, meaningful value: "All" — by direct request ("also include
    an 'All'")."""
    bot = await _get_owned_bot(bot_id, user, db)
    if update.sessions is not None:
        bot.schedule_sessions = update.sessions
    if update.days is not None:
        bot.schedule_days = update.days
    if update.half_day is not None:
        bot.schedule_half_day = None if update.half_day == "all" else update.half_day
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
        if field == "margin_mode":
            # Not nullable (defaults to DEDICATED, never "no override")
            # — a null here is a no-op rather than a constraint error.
            if value is not None:
                from app.models.bot import MarginMode
                bot.margin_mode = MarginMode(value)
            continue
        setattr(bot, field, value)

    await db.commit()
    await db.refresh(bot)
    return bot

@router.get("/{bot_id}/performance")
async def bot_performance(
    bot_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    """Get real performance metrics for a specific bot, computed from
    its own trade history — this used to be a stub that always
    returned zeros regardless of actual trade history.

    `total_trades` — real compliance bug, found via direct audit
    request ("resolve the bot summary trade 2 Vs the semi auto trades
    3/10 ... why the disparity ... does the bot count closed or active
    trades ... does the semi auto count closed or active ... make
    consistent across"). This used to count ONLY status == CLOSED,
    while the Sub-Auto card right next to it on the same Bots page
    (BotConfig.sub_auto_trades_executed, incremented in
    execution_engine.py's process_signal the moment a trade actually
    EXECUTES, regardless of whether it's closed yet) counts every
    placed trade that isn't cancelled/errored — a genuinely different,
    and for a SAFETY CAP, the only correct scope: a cap meant to limit
    how many trades a bot is allowed to PLACE autonomously has to be
    enforced at execution time, not wait for a trade to close, or a
    bot could have an unbounded number of trades open simultaneously
    before any of them ever closed. Rather than weaken that cap's own
    counting to match, `total_trades` here now counts the SAME scope
    (CLOSED + ACTIVE + PENDING, excluding CANCELLED/ERROR and deleted)
    so the two numbers agree for every bot. win_rate/profit_factor/
    average_r are still computed from the CLOSED subset only — an
    open position has no realized outcome yet, so including it in
    those would be meaningless, not just inconsistent."""
    await _get_owned_bot(bot_id, user, db)

    query = select(Trade).where(
        Trade.bot_id == bot_id,
        Trade.status.notin_([TradeStatus.CANCELLED, TradeStatus.ERROR]),
        Trade.is_deleted == False,  # noqa: E712
    )
    result = await db.execute(query)
    trades = result.scalars().all()

    total = len(trades)
    closed = [t for t in trades if t.status == TradeStatus.CLOSED]
    if not closed:
        return {"bot_id": bot_id, "total_trades": total, "win_rate": 0.0, "profit_factor": 0.0, "average_r": 0.0}

    wins = [t for t in closed if (t.realized_pnl or 0) > 0]
    losses = [t for t in closed if (t.realized_pnl or 0) < 0]
    gross_profit = sum(t.realized_pnl or 0 for t in wins)
    gross_loss = abs(sum(t.realized_pnl or 0 for t in losses))
    r_multiples = [t.r_multiple for t in closed if t.r_multiple is not None]

    return {
        "bot_id": bot_id,
        "total_trades": total,
        "win_rate": round(len(wins) / len(closed) * 100, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0.0,
        "average_r": round(sum(r_multiples) / len(r_multiples), 2) if r_multiples else 0.0,
    }
