"""
Weekly Review Router
======================

Exposes the Weekly Review Engine for the dashboard's coach debrief view.

Mount in main.py:

    from app.routers import weekly_review
    app.include_router(weekly_review.router, prefix="/api/weekly-review", tags=["weekly-review"])

DATA SOURCES: load_taken_trades now reads the real `trades` table (see
db/repository.py). load_rejected_signals and load_journal_entries still
read empty side-tables — there's no signal-rejection log or trade-
journaling UI anywhere in the app yet to ever populate them, so those
two stay real-but-empty until that input surface exists as its own
feature, not a placeholder-swap like the trade history was.

Auth: gated on require_active_access, same as every other content route.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access, STAFF_ROLES
from app.db.repository import load_journal_entries, load_rejected_signals, load_taken_trades
from app.db.session import get_db
from app.models.user import User
from app.engines.weekly_review_engine import (
    WeeklyReviewEngine, TakenTrade, RejectedSignal, EmotionalJournalEntry,
    build_weekly_review_prompt, generate_template_narrative,
)

router = APIRouter()


# --------------------------------------------------------------------------
# Response models
# --------------------------------------------------------------------------

class TakenTradeReviewResponse(BaseModel):
    trade_id: str
    symbol: str
    direction: str
    r_multiple: float
    exit_reason: str
    entry_rationale: str
    grade: str
    what_happened: str
    what_could_differ: str


class MissedOpportunityResponse(BaseModel):
    symbol: str
    direction: str
    rejection_reason: str
    rationale_at_signal: str
    hypothetical_r_multiple: Optional[float]
    hypothetical_outcome: str
    lesson: str


class MoodPerformanceResponse(BaseModel):
    mood_tag: str
    n_trades: int
    win_rate: float
    expectancy_r: float


class WeeklyReviewResponse(BaseModel):
    week_start: str
    week_end: str
    n_trades: int
    win_rate: float
    expectancy_r: float
    total_r: float
    taken_trade_reviews: List[TakenTradeReviewResponse]
    missed_opportunities: List[MissedOpportunityResponse]
    mood_performance: List[MoodPerformanceResponse]
    flagged_patterns: List[str]
    key_lessons: List[str]
    template_narrative: str
    coach_prompt: str   # send this to your LLM coach integration for full prose


# --------------------------------------------------------------------------
# Data sources — REPLACE with real queries
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Trade/signal/journal data — now backed by the real database. Forward
# price data (for missed-opportunity simulation) is intentionally left
# as a placeholder below: it needs a market data provider, not just a
# database table, so it can't be wired the same generic way.
# --------------------------------------------------------------------------

def _load_forward_bars(symbols: List[str], week_start: datetime, week_end: datetime) -> dict:
    """Needs your market data provider (broker/exchange API or a stored
    price history), not the trades database — kept separate on purpose.
    Returning {} here is safe: missed-opportunity entries will just show
    as 'no_data' rather than breaking the rest of the review."""
    return {}


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@router.get("/report", response_model=WeeklyReviewResponse)
async def get_weekly_review(
    week_start: str, week_end: str, bot_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access),
):
    """
    week_start / week_end: ISO date strings, e.g. "2026-08-03".
    bot_id: optional — filter the review to a single bot.
    """
    try:
        start = datetime.fromisoformat(week_start)
        end = datetime.fromisoformat(week_end)
    except ValueError:
        raise HTTPException(status_code=400, detail="week_start/week_end must be ISO dates")

    user_id = None if user.role in STAFF_ROLES else str(user.id)
    taken = await load_taken_trades(db, start, end, bot_id, user_id=user_id)
    rejected = await load_rejected_signals(db, start, end, bot_id)
    journal = await load_journal_entries(db, start, end)

    symbols = list({t.symbol for t in taken} | {s.symbol for s in rejected})
    forward_bars = _load_forward_bars(symbols, start, end) if symbols else {}

    engine = WeeklyReviewEngine()
    report = engine.build_report(
        week_start=start, week_end=end,
        taken_trades=taken, rejected_signals=rejected,
        journal_entries=journal, forward_bars_by_symbol=forward_bars,
    )

    return WeeklyReviewResponse(
        week_start=report.week_start.isoformat(),
        week_end=report.week_end.isoformat(),
        n_trades=report.n_trades,
        win_rate=report.win_rate,
        expectancy_r=report.expectancy_r,
        total_r=report.total_r,
        taken_trade_reviews=[
            TakenTradeReviewResponse(
                trade_id=tr.trade.trade_id, symbol=tr.trade.symbol, direction=tr.trade.direction,
                r_multiple=tr.trade.r_multiple, exit_reason=tr.trade.exit_reason,
                entry_rationale=tr.trade.entry_rationale, grade=tr.grade,
                what_happened=tr.what_happened, what_could_differ=tr.what_could_differ,
            ) for tr in report.taken_trade_reviews
        ],
        missed_opportunities=[
            MissedOpportunityResponse(
                symbol=m.signal.symbol, direction=m.signal.direction,
                rejection_reason=m.signal.rejection_reason,
                rationale_at_signal=m.signal.rationale_at_signal,
                hypothetical_r_multiple=m.hypothetical_r_multiple,
                hypothetical_outcome=m.hypothetical_outcome, lesson=m.lesson,
            ) for m in report.missed_opportunities
        ],
        mood_performance=[
            MoodPerformanceResponse(mood_tag=mp.mood_tag, n_trades=mp.n_trades,
                                     win_rate=mp.win_rate, expectancy_r=mp.expectancy_r)
            for mp in (report.emotional_review.mood_performance if report.emotional_review else [])
        ],
        flagged_patterns=(report.emotional_review.flagged_patterns if report.emotional_review else []),
        key_lessons=report.key_lessons,
        template_narrative=generate_template_narrative(report),
        coach_prompt=build_weekly_review_prompt(report),
    )
