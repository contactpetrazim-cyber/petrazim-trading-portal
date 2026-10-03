"""
Capital Adequacy Gate
======================

By critical audit request, after a real production trade was found
sized at 419.35 BTC (~$35M notional) against a $130 "risk" — the stop-
loss distance was a calc bug (see smc_algorithms.py's own
calculate_stop_loss "structure_swing" fix), and the existing fixed-
fractional sizing formula (risk_amount / stop_loss_distance, no upper
bound) turned that tiny distance into an enormous, unexecutable
quantity. Nothing anywhere in this codebase previously checked whether
a position's actual NOTIONAL VALUE (quantity x price) was something
the account could plausibly margin.

This is NOT the same question as manual_trading.py's own
_check_risk_limits, which sums RISK PERCENT across open positions (how
much you'd lose if every open stop were hit at once) — a trade can
have a tiny risk_percent (because its stop is absurdly tight) while
still requiring far more capital than the account has to actually open
the position at all. This gate checks THAT question: the ceiling on
TOTAL notional value, summed across every OTHER currently open/pending
trade for the same account ("considering other trades" — direct
request, computed fresh at check time, never cached), is the account's
own effective balance times the effective LEVERAGE — see
get_effective_leverage below for how that's resolved (per-bot/per-
trader override, Admin master override, or config.py's static
MAX_NOTIONAL_LEVERAGE default).

Called from execution_engine.py right before a trade would actually
hit a broker — both the fully-autonomous path (process_signal) and the
Human-in-the-Loop approval path (approve_trade) — so a trade can be
DRAFTED without passing this (nothing executes yet, no capital is
actually at risk from a draft), but cannot EXECUTE without it.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

settings = get_settings()


async def get_master_leverage(db: AsyncSession) -> tuple[bool, float]:
    """The Admin's platform-wide MASTER leverage override — see
    MASTER_LEVERAGE_KEY's own comment. Returns (enabled, value); same
    fail-safe-not-fail-open shape as market_scanner.py's own
    get_master_account_balance."""
    from app.models.platform_setting import MASTER_LEVERAGE_KEY, PlatformSetting

    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == MASTER_LEVERAGE_KEY)
    )).scalar_one_or_none()
    if not row:
        return False, 0.0
    try:
        data = json.loads(row.value)
        return bool(data.get("enabled", False)), float(data.get("value", 0.0))
    except (ValueError, TypeError, KeyError):
        return False, 0.0


async def get_effective_leverage(
    db: AsyncSession, bot_id: Optional[str] = None, manual_leverage: Optional[float] = None,
) -> float:
    """The REAL leverage a trade is actually sized/executed against —
    by direct request ("put a form to set leverage for Bot and manual
    - separately on the trader dashboard ... with a global override
    form in the Admin"). Precedence: the Admin master override (when
    enabled) ALWAYS wins; otherwise the bot's own BotConfig.leverage
    (for a bot-driven trade) or the trader's own
    ManualTradingSettings.leverage (`manual_leverage`, for a manual
    order — the caller resolves and passes this directly since there's
    no bot row to read it from); otherwise config.py's static
    MAX_NOTIONAL_LEVERAGE, the same default every trade silently used
    before either override existed."""
    from app.models.bot import BotConfig

    master_enabled, master_value = await get_master_leverage(db)
    if master_enabled:
        return master_value
    if bot_id:
        bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
        if bot is not None and bot.leverage is not None:
            return bot.leverage
    elif manual_leverage is not None:
        return manual_leverage
    return settings.MAX_NOTIONAL_LEVERAGE


@dataclass
class CapitalCheckResult:
    ok: bool
    reason: Optional[str] = None
    existing_notional: float = 0.0
    new_notional: float = 0.0
    available_notional: float = 0.0
    effective_leverage: float = 0.0


async def check_capital_adequacy(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    bot_id: Optional[str],
    lot_size: float,
    entry_price: float,
    exclude_trade_id: Optional[str] = None,
    effective_balance_override: Optional[float] = None,
    manual_leverage: Optional[float] = None,
) -> CapitalCheckResult:
    """`exclude_trade_id` matters for the approval path: the trade
    being approved is ALREADY a PENDING row in the table (drafted at
    process_signal time), so it must be excluded from "existing
    notional" or it would be double-counted against itself.

    `effective_balance_override` is for manual_trading.py's own
    caller: a manual order already carries the trader's own stated
    account_equity (a real input on the order ticket, not a bot
    config) — use that directly instead of resolving a bot's effective
    balance, which wouldn't apply (there is no bot). `manual_leverage`
    is that same caller's own ManualTradingSettings.leverage, forwarded
    to get_effective_leverage — see that function's own docstring."""
    from app.models.bot import BotConfig
    from app.models.trade import Trade, TradeStatus
    from app.services.market_scanner import get_effective_account_balance

    new_notional = abs(lot_size or 0) * abs(entry_price or 0)
    if new_notional <= 0:
        return CapitalCheckResult(ok=True)

    # Same owner scope as every other per-account cap in this codebase
    # (manual_trading.py's own open_exposure query): a trade with no
    # owner (pre-ownership bot row) has no per-user capital to check
    # against, and is left to the platform's own shared-key exposure
    # instead — unscoped here, same as it always was before this gate.
    if user_id is None:
        return CapitalCheckResult(ok=True)

    query = select(Trade.lot_size, Trade.entry_price).where(
        Trade.status.in_([TradeStatus.PENDING, TradeStatus.ACTIVE]),
        Trade.user_id == user_id,
    )
    if exclude_trade_id:
        query = query.where(Trade.trade_id != exclude_trade_id)
    rows = (await db.execute(query)).all()
    existing_notional = sum(abs(r.lot_size or 0) * abs(r.entry_price or 0) for r in rows)

    if effective_balance_override is not None:
        effective_balance = effective_balance_override
    else:
        effective_balance = settings.MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE
        if bot_id:
            bot = (await db.execute(select(BotConfig).where(BotConfig.bot_id == bot_id))).scalar_one_or_none()
            if bot is not None:
                effective_balance = await get_effective_account_balance(db, bot)

    effective_leverage = await get_effective_leverage(db, bot_id=bot_id, manual_leverage=manual_leverage)
    available_notional = effective_balance * effective_leverage

    if existing_notional + new_notional > available_notional:
        return CapitalCheckResult(
            ok=False,
            reason=(
                f"Insufficient capital — this trade's notional (${new_notional:,.2f}) plus "
                f"${existing_notional:,.2f} already committed to other open/pending trades "
                f"would exceed the ${available_notional:,.2f} available "
                f"(${effective_balance:,.2f} balance x {effective_leverage:g}x leverage)."
            ),
            existing_notional=existing_notional, new_notional=new_notional,
            available_notional=available_notional, effective_leverage=effective_leverage,
        )
    return CapitalCheckResult(
        ok=True, existing_notional=existing_notional, new_notional=new_notional,
        available_notional=available_notional, effective_leverage=effective_leverage,
    )
