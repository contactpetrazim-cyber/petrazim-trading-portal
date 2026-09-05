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

Grounding (Section 4 of the Learning Design Spec): when the trainee is
reading a lesson, FloatingTradeAI passes that lesson's id as
context_lesson_id — every query then gets the lesson's own real
content_body as grounding context, with instructions to answer only
from it (or say so honestly) rather than a bare "answer anything"
call. With no lesson open, it falls back to the general trading-coach
voice (CHAT_SYSTEM_PROMPT) — no crash, no error, just less specific.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.database import get_db
from app.models.curriculum import Lesson
from app.models.user import User
from app.services.ai_coach import CHAT_SYSTEM_PROMPT, generate_text, get_coach_reply

router = APIRouter(prefix="/coach", tags=["coach"])

GROUNDED_SYSTEM_PROMPT_TEMPLATE = (
    CHAT_SYSTEM_PROMPT
    + "\n\nThe trainee is currently reading this lesson — \"{title}\":\n\n{content}\n\n"
    "Answer using ONLY this lesson's own content above as your source of truth for anything "
    "specific to it. If the question is clearly unrelated to this lesson or the curriculum "
    "generally, say so honestly rather than improvising an answer with no real grounding."
)


class AskCoachRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context_lesson_id: Optional[str] = None


class AskCoachResponse(BaseModel):
    reply: str


@router.post("/ask", response_model=AskCoachResponse)
async def ask_coach(
    req: AskCoachRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    if req.context_lesson_id:
        lesson = (await db.execute(
            select(Lesson).where(Lesson.id == req.context_lesson_id)
        )).scalar_one_or_none()
        if lesson is not None and lesson.content_body:
            system_prompt = GROUNDED_SYSTEM_PROMPT_TEMPLATE.format(title=lesson.title, content=lesson.content_body)
            reply = await generate_text(system_prompt, req.message, max_tokens=500)
            if reply is not None:
                return AskCoachResponse(reply=reply)
            # Fall through to the ungrounded path below only if every
            # provider failed — never silently drop the grounding
            # attempt without at least trying the general fallback.

    reply = await get_coach_reply(req.message)
    return AskCoachResponse(reply=reply)
