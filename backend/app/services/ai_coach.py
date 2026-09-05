"""
AI Coach — free-tier-only multi-provider rotation
=====================================================

Backs FloatingTradeAI's "Ask Coach" — previously always replied "Trade
AI isn't wired to a live endpoint yet" because no AI provider existed
anywhere in this codebase. By direct instruction ("use the free tier
and optimise engine - rotate across multiple") this calls out to
whichever of several free-tier LLM providers has a key configured,
round-robin across calls and failing over to the next provider on any
error, rather than depending on one provider's free quota alone.

Providers, in rotation order — every one has a genuine free tier;
xAI/Grok was deliberately left out (no confirmed free tier), per
direct instruction ("use free tier AI only"):
  1. Groq       (llama-3.3-70b-versatile)   — openai-compatible
  2. Cerebras   (llama-3.3-70b)             — openai-compatible
  3. Mistral    (mistral-small-latest)      — openai-compatible
  4. OpenRouter (a :free-suffixed model)    — openai-compatible
  5. Gemini     (gemini-2.0-flash)          — Google's own request shape

Each provider's API key lives in Settings (config.py), read from env
vars only — never hardcoded. A provider with no key set is skipped
entirely. If every configured provider fails (or none are configured),
get_coach_reply returns an honest message instead of raising, so a
transient outage or an exhausted free quota degrades to "try again in
a moment," not a 500.

Voice: reuses COACH_VOICE_RULES from weekly_review_engine.py — the
same coach personality already established for the Weekly Review and
(per FloatingTradeAI's own docstring) TradeCoachPanel/ReasoningPanel —
adapted here for a live back-and-forth chat instead of a written report.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from typing import Callable, List, Optional

import httpx
import structlog

from app.config import get_settings
from app.engines.weekly_review_engine import COACH_VOICE_RULES

logger = structlog.get_logger()

CHAT_SYSTEM_PROMPT = (
    COACH_VOICE_RULES
    + "\n\nThis is a live chat, not a written report — reply in a few short sentences or a short "
    "paragraph, conversationally, not a full essay. If the trader asks something with no real data "
    "behind it (e.g. a numeric analysis of trades you weren't given), say so rather than inventing "
    "numbers."
)

REQUEST_TIMEOUT_SECONDS = 20.0


@dataclass
class ProviderResult:
    name: str
    reply: Optional[str]
    error: Optional[str] = None


async def _call_openai_compatible(
    client: httpx.AsyncClient, *, base_url: str, api_key: str, model: str,
    message: str, extra_headers: Optional[dict] = None,
) -> str:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    resp = await client.post(
        base_url,
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "max_tokens": 500,
            "temperature": 0.4,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


async def _call_groq(client: httpx.AsyncClient, api_key: str, message: str) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.groq.com/openai/v1/chat/completions",
        api_key=api_key, model="llama-3.3-70b-versatile", message=message,
    )


async def _call_cerebras(client: httpx.AsyncClient, api_key: str, message: str) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.cerebras.ai/v1/chat/completions",
        api_key=api_key, model="llama-3.3-70b", message=message,
    )


async def _call_mistral(client: httpx.AsyncClient, api_key: str, message: str) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.mistral.ai/v1/chat/completions",
        api_key=api_key, model="mistral-small-latest", message=message,
    )


async def _call_openrouter(client: httpx.AsyncClient, api_key: str, message: str) -> str:
    return await _call_openai_compatible(
        client, base_url="https://openrouter.ai/api/v1/chat/completions",
        api_key=api_key, model="meta-llama/llama-3.3-70b-instruct:free", message=message,
        # Non-required but recommended by OpenRouter to identify the caller.
        extra_headers={"HTTP-Referer": "https://petrazim.online", "X-Title": "Petrazim Trading Portal"},
    )


async def _call_gemini(client: httpx.AsyncClient, api_key: str, message: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    resp = await client.post(
        url,
        json={
            "system_instruction": {"parts": [{"text": CHAT_SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "generationConfig": {"maxOutputTokens": 500, "temperature": 0.4},
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


def _providers() -> List[tuple[str, str, Callable]]:
    """(name, api_key, call_fn) for every provider that actually has a
    key configured — an unconfigured provider is skipped, not tried
    with an empty key."""
    settings = get_settings()
    candidates = [
        ("groq", settings.GROQ_API_KEY, _call_groq),
        ("cerebras", settings.CEREBRAS_API_KEY, _call_cerebras),
        ("mistral", settings.MISTRAL_API_KEY, _call_mistral),
        ("openrouter", settings.OPENROUTER_API_KEY, _call_openrouter),
        ("gemini", settings.GEMINI_API_KEY, _call_gemini),
    ]
    return [(name, key, fn) for name, key, fn in candidates if key]


# Round-robins the STARTING provider across calls so usage spreads
# across every configured free tier rather than hammering whichever is
# first in the list — module-level counter, fine for this single-
# instance Render deploy (same reasoning as facilitator.py's own
# in-memory OAuth-state dict).
_rotation_counter = itertools.count()


async def get_coach_reply(message: str) -> str:
    providers = _providers()
    if not providers:
        return (
            "Ask Coach isn't wired to a live AI provider yet — no API key is configured on the backend. "
            "Ask a specific question about a setup or your trade history once it's set up, and I'll answer for real."
        )

    start = next(_rotation_counter) % len(providers)
    ordered = providers[start:] + providers[:start]

    last_error: Optional[str] = None
    async with httpx.AsyncClient() as client:
        for name, api_key, call_fn in ordered:
            try:
                reply = await call_fn(client, api_key, message)
                if reply:
                    return reply
            except Exception as e:  # noqa: BLE001 — deliberately broad: any provider failure just tries the next one
                last_error = f"{name}: {e}"
                logger.warning("ai_coach_provider_failed", provider=name, error=str(e))
                continue

    logger.error("ai_coach_all_providers_failed", last_error=last_error)
    return "Coach is temporarily unavailable — every configured AI provider failed to respond. Try again in a moment."
