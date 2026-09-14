"""
Internal Relay Router — lets one backend (Render) ask the OTHER
backend (the VM) to execute a broker order on its behalf.
=====================================================================

By direct request: "can orders from my trading portal or hub be
broadcast using both fixie and VM IP at the same time so that if fixie
IP limits are reached the exchanges still get the instructions from my
VM IP which is always on?"

NOT a broadcast — a FAILOVER, and deliberately so. Sending one real
order down two independent paths at once risks a genuine duplicate
fill (two real market orders instead of one), which is a real money/
risk bug, not just an engineering inelegance. execution_engine.py's
_execute_broker_order only calls this AFTER its own local attempt has
already failed at the TRANSPORT level (a broken proxy — connection
refused, proxy auth failure, timeout), never after a normal
application-level rejection an exchange sent back (bad signature,
insufficient balance — retrying those elsewhere wouldn't help and
would just be a second pointless attempt). So at most one backend ever
actually reaches the exchange for a given order.

Auth: a shared secret header (X-Internal-Secret), checked against
INTERNAL_RELAY_SECRET — NOT the normal user JWT scheme, since this is
backend-to-backend, not a user request, and a user's own token should
never be able to trigger this. If INTERNAL_RELAY_SECRET isn't
configured, this endpoint refuses every request outright (404) — inert
by default on any deployment that hasn't explicitly opted in (see
config.py's own comment on VM_API_URL/INTERNAL_RELAY_SECRET).

`is_relay=True` is passed straight through to _execute_broker_order so
the RECEIVING backend never itself attempts a further relay — without
that, two backends both configured with the other's VM_API_URL could
in principle ping-pong a single failing order back and forth forever.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
import structlog

from app.config import get_settings
from app.database import AsyncSessionLocal

router = APIRouter(prefix="/internal", tags=["internal"])
logger = structlog.get_logger()
settings = get_settings()


class RelayOrderRequest(BaseModel):
    trade: Dict[str, Any]
    paper: bool = False


def _require_relay_secret(x_internal_secret: Optional[str]) -> None:
    if not settings.INTERNAL_RELAY_SECRET:
        # Not configured on THIS backend — behave as if the route
        # doesn't exist rather than a 403, so an unconfigured
        # deployment gives no hint this capability exists at all.
        raise HTTPException(status_code=404)
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_RELAY_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing internal relay secret.")


@router.post("/execute-broker-order")
async def relay_execute_broker_order(
    req: RelayOrderRequest,
    x_internal_secret: Optional[str] = Header(default=None),
):
    _require_relay_secret(x_internal_secret)

    # Local import — avoids a circular import at module load (same
    # reason execution_engine.py itself imports some models locally).
    from app.services.execution_engine import ExecutionEngine

    logger.warning(
        "internal_relay_order_received", trade_id=req.trade.get("trade_id"),
        symbol=req.trade.get("symbol"), paper=req.paper,
        message="Executing a relayed order — the OTHER backend's own attempt failed at the transport level.",
    )

    engine = ExecutionEngine()
    # A real DB session (this backend has its own, independent
    # connection to the SAME Supabase database — see CLAUDE.md's own
    # dual-failover architecture) so per-bot broker credentials
    # (broker_credentials.py) still resolve correctly for a relayed
    # order, not just the shared global-key client.
    async with AsyncSessionLocal() as db:
        result = await engine._execute_broker_order(req.trade, db=db, paper=req.paper, is_relay=True)
    return result
