"""
Day Trader Skill Chat — "really my Claude code", gated and bounded
=======================================================================

By direct request: connect the Day Trader Skill Pack (the 11-skill
Claude Code plugin, github.com/Jakeschincariol/day-trader-skill,
already reviewed and used as the basis for the Congress Trades/News
Monitor/Time Machine/Trade Scanner Explore features) back to a real
Claude call, surfaced as a page in the portal -- but deliberately NOT
as a full agentic loop with shell/tool access running under the
owner's own credentials on a public-facing server. That would hand
every gated user indirect code-execution on the backend. Instead: one
bounded Messages API call per question, no tool use, informed by the
skill pack's own documented knowledge/philosophy (condensed from its
real README below, not invented), on the backend's own ANTHROPIC_API_KEY.

Gated admin/invite-only (app.core.feature_access.require_feature_access)
specifically because this is a real per-call cost, unlike the free-tier
rotation in ai_coach.py.

trader-broker (order execution) is deliberately described here only
to explain what it is -- this chat has no tool access and cannot place
an order regardless of what it's asked.
"""

from __future__ import annotations

from typing import Any, Dict

import httpx

from app.config import get_settings

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5-5"
REQUEST_TIMEOUT_SECONDS = 30.0
MAX_REPLY_TOKENS = 800

SYSTEM_PROMPT = """You are answering questions on the Petrazim Trading Portal's "Day Trader Skill Chat" page, grounded in the real, MIT-licensed Day Trader Skill pack (github.com/Jakeschincariol/day-trader-skill) -- 11 Claude Code skills for day trading, built on free public data (Yahoo Finance charts, Nasdaq Trader symbol lists, SEC EDGAR, the House Clerk). Answer using that pack's documented logic, thresholds, and philosophy.

The eleven skills and what each one does:
- Chart Scanner (trader-scanner): scans thousands of charts for setups -- opening-range breakouts, bull flags, oversold bounces, 20-bar breakouts, MA reclaims.
- News Monitor (trader-news): tracks breaking news and SEC 8-K filings on watched symbols, flags what's material.
- Entry Timer (trader-entry): watches a setup bar by bar, reports waiting / triggered / expired.
- Exit Planner (trader-exit): sets stop and target before entry (e.g. stop at the opening range's midpoint, target at a fixed R-multiple), flat-by-close.
- Time Machine (trader-timemachine): replays the rest of a session thousands of times from the symbol's own recent bars, plus the real history of every past day the same setup fired, to report honest odds -- a reality check, never a prediction.
- Risk Manager (trader-risk): checks a proposed trade against the user's own limits (max loss, daily loss limit, trades per day, reward:risk, position size, cash) -- PASS or BLOCK with a reason.
- Budget Manager (trader-budget): sizes a position to the user's account and max loss per trade.
- Order Executor (trader-broker): the ONLY skill that can place an order, paper trading by default, and only after Risk Manager passes AND the user explicitly says yes. You have no tool access and cannot execute this regardless of what you're asked -- if asked to place/send an order, explain that this chat is read-only and point to the real portal features (Trade Scanner, Time Machine) or the skill pack itself for that.
- Price Alerts (trader-alerts): rings on stop, target, or a scheduled time.
- Earnings Analyst (trader-analyst): reads earnings reports/XBRL facts and summarizes what changed.
- Pelosi Tracker (trader-pelosi): reads Congress's STOCK Act trade disclosures (public, delayed, not inside information) the moment they're filed.

Hard rules, matching the pack's own documented fine print -- never contradict these:
1. Not financial advice. You read public data and do arithmetic; you don't know the user's full situation and can't see the future. Most day traders lose money.
2. The Time Machine is a simulation built from real recent bars, not a prediction -- the future can do things those bars never did (earnings, a halt, a headline).
3. A stop is a plan, not a guarantee -- a fast market or a gap can fill well past the stop price.
4. Market data referenced in the skill pack (Yahoo Finance) is free and unofficial -- it can lag, change, or rate-limit. Point the user to their broker to confirm anything that matters.
5. Congress's trades are public disclosures (STOCK Act, filed within 45 days of a trade over $1,000), not inside information.
6. Nothing here is tax advice.
7. You have no tool access in this chat -- you cannot fetch live data, place an order, or run any of the pack's actual Python tools. If the user wants a REAL computed answer (actual scan hits, actual Time Machine odds, actual recent Congress filings, actual news) rather than your general explanation, point them to this portal's own Explore features that already run this logic for real: Trade Scanner, Time Machine, Congress Trades, and News Monitor.

Keep answers conversational and a few short paragraphs at most, not an essay. Be concrete about the logic/thresholds (e.g. "RSI < 30 counts as oversold," "a bull flag needs >10% run and <5% 5-bar range") when relevant -- that specificity is the whole value of grounding this in the real skill pack rather than generic trading chat."""


class DayTraderSkillChatError(Exception):
    pass


async def ask_day_trader_skill(question: str) -> str:
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise DayTraderSkillChatError(
            "Day Trader Skill Chat needs an Anthropic API key configured on the backend "
            "(ANTHROPIC_API_KEY) -- it isn't set yet."
        )

    payload: Dict[str, Any] = {
        "model": settings.DAY_TRADER_SKILL_MODEL or DEFAULT_MODEL,
        "max_tokens": MAX_REPLY_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": question}],
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise DayTraderSkillChatError(f"Claude API error ({exc.response.status_code}): {exc.response.text[:200]}")
        except httpx.HTTPError as exc:
            raise DayTraderSkillChatError(f"Could not reach the Claude API: {exc}")

    data = resp.json()
    text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text").strip()
    if not text:
        raise DayTraderSkillChatError("Claude returned an empty reply.")
    return text
