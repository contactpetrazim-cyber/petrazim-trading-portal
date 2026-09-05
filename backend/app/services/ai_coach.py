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
callers get None (generate_text) or an honest fallback message
(get_coach_reply) instead of a 500, so a transient outage or an
exhausted free quota degrades gracefully.

generate_text() is the general-purpose entry point — same provider
rotation, any system prompt — added when the Learning Design Spec's
Recap system and Retrieval Quiz generator needed the exact same
free-tier rotation the Coach already had, per Section 16's own "one AI
provider abstraction... features plug into shared primitives rather
than each building their own." get_coach_reply() is a thin wrapper
kept for FloatingTradeAI's existing call site.

Voice (chat only): reuses COACH_VOICE_RULES from weekly_review_engine.py
— the same coach personality already established for the Weekly Review
and (per FloatingTradeAI's own docstring) TradeCoachPanel/ReasoningPanel
— adapted for a live back-and-forth chat instead of a written report.
"""

from __future__ import annotations

import itertools
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


async def _call_openai_compatible(
    client: httpx.AsyncClient, *, base_url: str, api_key: str, model: str,
    system_prompt: str, message: str, max_tokens: int, extra_headers: Optional[dict] = None,
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
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.4,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


async def _call_groq(client: httpx.AsyncClient, api_key: str, system_prompt: str, message: str, max_tokens: int) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.groq.com/openai/v1/chat/completions",
        api_key=api_key, model="llama-3.3-70b-versatile",
        system_prompt=system_prompt, message=message, max_tokens=max_tokens,
    )


async def _call_cerebras(client: httpx.AsyncClient, api_key: str, system_prompt: str, message: str, max_tokens: int) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.cerebras.ai/v1/chat/completions",
        api_key=api_key, model="llama-3.3-70b",
        system_prompt=system_prompt, message=message, max_tokens=max_tokens,
    )


async def _call_mistral(client: httpx.AsyncClient, api_key: str, system_prompt: str, message: str, max_tokens: int) -> str:
    return await _call_openai_compatible(
        client, base_url="https://api.mistral.ai/v1/chat/completions",
        api_key=api_key, model="mistral-small-latest",
        system_prompt=system_prompt, message=message, max_tokens=max_tokens,
    )


async def _call_openrouter(client: httpx.AsyncClient, api_key: str, system_prompt: str, message: str, max_tokens: int) -> str:
    return await _call_openai_compatible(
        client, base_url="https://openrouter.ai/api/v1/chat/completions",
        api_key=api_key, model="meta-llama/llama-3.3-70b-instruct:free",
        system_prompt=system_prompt, message=message, max_tokens=max_tokens,
        # Non-required but recommended by OpenRouter to identify the caller.
        extra_headers={"HTTP-Referer": "https://petrazim.online", "X-Title": "Petrazim Trading Portal"},
    )


async def _call_gemini(client: httpx.AsyncClient, api_key: str, system_prompt: str, message: str, max_tokens: int) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    resp = await client.post(
        url,
        json={
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.4},
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


async def generate_text(system_prompt: str, message: str, *, max_tokens: int = 500) -> Optional[str]:
    """The shared entry point every AI feature calls through (Coach,
    Recap, Retrieval Quiz generator) — one provider rotation, never a
    direct SDK call from feature code, per Section 16 of the Learning
    Design Spec. Returns None (not a raised exception) if no provider
    is configured or every one fails, so a caller can supply its own
    honest, feature-specific fallback message rather than this module
    guessing one for every use case."""
    providers = _providers()
    if not providers:
        return None

    start = next(_rotation_counter) % len(providers)
    ordered = providers[start:] + providers[:start]

    last_error: Optional[str] = None
    async with httpx.AsyncClient() as client:
        for name, api_key, call_fn in ordered:
            try:
                reply = await call_fn(client, api_key, system_prompt, message, max_tokens)
                if reply:
                    return reply
            except Exception as e:  # noqa: BLE001 — deliberately broad: any provider failure just tries the next one
                last_error = f"{name}: {e}"
                logger.warning("ai_provider_failed", provider=name, error=str(e))
                continue

    logger.error("ai_all_providers_failed", last_error=last_error)
    return None


async def get_coach_reply(message: str) -> str:
    reply = await generate_text(CHAT_SYSTEM_PROMPT, message, max_tokens=500)
    if reply is not None:
        return reply
    if not _providers():
        return (
            "Ask Coach isn't wired to a live AI provider yet — no API key is configured on the backend. "
            "Ask a specific question about a setup or your trade history once it's set up, and I'll answer for real."
        )
    return "Coach is temporarily unavailable — every configured AI provider failed to respond. Try again in a moment."
