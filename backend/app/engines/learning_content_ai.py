"""
Learning Content AI — Recap summaries + Retrieval Quiz generation
=====================================================================

Both features from the Learning Design Spec (Sections 3 and 6) need
short, AI-produced content GROUNDED ONLY in one real, already-authored
lesson's own content_body — never an open "write something about
trading" call, and never touching the lesson's own stored text (content
lock: Slide.body / Lesson.content_body is never rewritten by any
feature). Both go through ai_coach.generate_text(), the one shared
free-tier provider rotation every AI feature in this app uses — no
direct SDK calls here.

Caching lives in the router (LessonRecap / RetrievalQuizCache, keyed by
a hash of the source content_body) — this module only knows how to
generate, not how to persist.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import List, Optional

from app.services.ai_coach import generate_text

RECAP_SYSTEM_PROMPT = (
    "You are writing a study recap for a trading-education platform. Given one lesson's real "
    "content below, produce a condensed plain-English summary a trader can re-read in under two "
    "minutes to refresh what the lesson covered. Rules: cover every major point, don't invent "
    "anything not in the source text, no markdown formatting (no #, *, |, or numbered-list "
    "syntax — plain sentences and short paragraphs only, since this text is also read aloud by a "
    "narrator), no meta-commentary like 'here is a summary'. Just the summary itself."
)

RETRIEVAL_QUIZ_SYSTEM_PROMPT = (
    "You write short retrieval-practice questions for a trading-education platform, grounded "
    "STRICTLY in the one lesson's real content given below — never introduce a fact, number, or "
    "rule not present in that text. Produce exactly 4 questions that test recall of the lesson's "
    "own key points. Reply with ONLY a JSON array, no other text, no markdown fences, in this "
    'exact shape: [{"prompt": "...", "type": "knowledge", "correct_answer": "..."}, ...]. '
    '"type" is either "knowledge" (recall a fact/definition from the text) or "scenario" (apply '
    "the lesson's own rule to a short hypothetical). correct_answer must be a short, specific "
    "phrase or sentence, not a restatement of the whole question."
)


async def generate_recap(lesson_title: str, content_body: str) -> Optional[str]:
    message = f"Lesson: {lesson_title}\n\n{content_body}"
    return await generate_text(RECAP_SYSTEM_PROMPT, message, max_tokens=900)


@dataclass
class RetrievalQuestionDraft:
    prompt: str
    type: str
    correct_answer: str


def _parse_retrieval_questions(raw: str) -> List[RetrievalQuestionDraft]:
    # Models occasionally wrap JSON in ```json fences despite being told
    # not to — strip those before parsing rather than failing on them.
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    data = json.loads(cleaned)
    out: List[RetrievalQuestionDraft] = []
    for item in data:
        prompt = str(item.get("prompt", "")).strip()
        answer = str(item.get("correct_answer", "")).strip()
        qtype = item.get("type") if item.get("type") in ("knowledge", "scenario") else "knowledge"
        if prompt and answer:
            out.append(RetrievalQuestionDraft(prompt=prompt, type=qtype, correct_answer=answer))
    return out


async def generate_retrieval_questions(lesson_title: str, content_body: str) -> List[RetrievalQuestionDraft]:
    message = f"Lesson: {lesson_title}\n\n{content_body}"
    raw = await generate_text(RETRIEVAL_QUIZ_SYSTEM_PROMPT, message, max_tokens=700)
    if raw is None:
        return []
    try:
        return _parse_retrieval_questions(raw)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return []
