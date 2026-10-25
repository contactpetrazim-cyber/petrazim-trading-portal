"""
Day Trader Skill Chat Router
================================

Exposes app/services/day_trader_skill_chat.py over HTTP. Admin/invite-
gated (require_feature_access) -- see that module's own docstring for
why this is a real per-call cost and deliberately not a full agentic
tool-calling loop.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.feature_access import require_feature_access
from app.models.user import User
from app.services.day_trader_skill_chat import DayTraderSkillChatError, ask_day_trader_skill

FEATURE_KEY = "day_trader_skill_chat"

router = APIRouter(prefix="/day-trader-skill-chat", tags=["day-trader-skill-chat"])


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


@router.post("/ask")
async def ask(req: AskRequest, user: User = Depends(require_feature_access(FEATURE_KEY))):
    try:
        reply = await ask_day_trader_skill(req.question)
        return {"reply": reply}
    except DayTraderSkillChatError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
