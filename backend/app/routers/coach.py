"""
Ask Coach Router
====================

The real endpoint behind FloatingTradeAI's chat panel — previously
onSend was never passed anywhere (App.tsx mounted <FloatingTradeAI />
bare), so every message got the component's own hardcoded "isn't wired
to a live endpoint yet" fallback. See services/ai_coach.py for the
actual multi-provider free-tier rotation this calls into.

Gated on require_active_access, same as every other coaching/analysis
feature (Insights' Monte Carlo, Weekly Review, the validation gate) —
Ask Coach is a paid-tier value-add, not a public endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.access_gate import require_active_access
from app.models.user import User
from app.services.ai_coach import get_coach_reply

router = APIRouter(prefix="/coach", tags=["coach"])


class AskCoachRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AskCoachResponse(BaseModel):
    reply: str


@router.post("/ask", response_model=AskCoachResponse)
async def ask_coach(req: AskCoachRequest, user: User = Depends(require_active_access)):
    reply = await get_coach_reply(req.message)
    return AskCoachResponse(reply=reply)
