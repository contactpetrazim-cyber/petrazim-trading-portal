from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.database import get_db
from app.models.broker_credential import BotBrokerCredential
from app.models.user import User, UserRole
from app.services.broker_credentials import encrypt_secret

router = APIRouter(prefix="/bots", tags=["broker-credentials"])

ExchangeName = Literal["bingx", "binance", "bybit", "mexc", "tradelocker"]


class BrokerCredentialCreate(BaseModel):
    exchange: ExchangeName
    api_key: str
    api_secret: str
    account_id: Optional[str] = None  # TradeLocker only
    sub_account_label: Optional[str] = None


class BrokerCredentialResponse(BaseModel):
    id: str
    bot_id: str
    exchange: str
    sub_account_label: Optional[str]
    api_key_preview: str  # last 4 chars only — never the full key
    is_active: bool


def _preview(key: str) -> str:
    return f"...{key[-4:]}" if len(key) > 4 else "...."


@router.post("/{bot_id}/credentials", response_model=BrokerCredentialResponse)
async def add_broker_credential(
    bot_id: str,
    body: BrokerCredentialCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """
    Admin-only: attach a broker credential (one exchange sub-account) to
    a bot. Storing api_key/api_secret encrypted, never plaintext — see
    app/services/broker_credentials.py. This is additive: a bot with no
    credential row here keeps using the shared global-key broker
    (BINANCE_API_KEY etc. in the environment) exactly as before.
    """
    credential = BotBrokerCredential(
        bot_id=bot_id,
        exchange=body.exchange,
        sub_account_label=body.sub_account_label,
        api_key_encrypted=encrypt_secret(body.api_key),
        api_secret_encrypted=encrypt_secret(body.api_secret),
        account_id_encrypted=encrypt_secret(body.account_id) if body.account_id else None,
    )
    db.add(credential)
    await db.commit()
    await db.refresh(credential)

    return BrokerCredentialResponse(
        id=str(credential.id), bot_id=credential.bot_id, exchange=credential.exchange,
        sub_account_label=credential.sub_account_label,
        api_key_preview=_preview(body.api_key), is_active=credential.is_active,
    )


@router.get("/{bot_id}/credentials", response_model=List[BrokerCredentialResponse])
async def list_broker_credentials(
    bot_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Lists this bot's credentials — never the decrypted key/secret,
    only a masked preview, so this is safe to render in an admin UI."""
    result = await db.execute(select(BotBrokerCredential).where(BotBrokerCredential.bot_id == bot_id))
    rows = result.scalars().all()
    # api_key_preview needs the plaintext key, which we deliberately
    # don't decrypt just to list credentials — show the encrypted
    # token's own tail instead, still enough to tell entries apart.
    return [
        BrokerCredentialResponse(
            id=str(r.id), bot_id=r.bot_id, exchange=r.exchange,
            sub_account_label=r.sub_account_label,
            api_key_preview=_preview(r.api_key_encrypted), is_active=r.is_active,
        )
        for r in rows
    ]


@router.delete("/{bot_id}/credentials/{credential_id}")
async def delete_broker_credential(
    bot_id: str,
    credential_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(
        select(BotBrokerCredential).where(
            BotBrokerCredential.id == credential_id, BotBrokerCredential.bot_id == bot_id
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    await db.delete(credential)
    await db.commit()
    return {"success": True, "deleted": credential_id}
