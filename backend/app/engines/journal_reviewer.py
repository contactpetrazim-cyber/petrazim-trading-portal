"""
AI Trade Journal Reviewer — Explore Concept #9
==================================================

Extends the Weekly Review Engine's process-based grading (Phase 5,
core platform) to traders who don't use any of the 5 bots at all —
manual/discretionary traders who just want the same honest,
process-over-outcome review applied to their own journal entries.

Widens the addressable market beyond "people running our bots" to
"anyone who trades and wants a disciplined second opinion" — same
coach voice, same grading philosophy, applied to self-reported trades
instead of bot-logged ones.

REUSES the core grading logic from weekly_review_engine.py rather than
reimplementing it — a manual trade and a bot trade should be graded by
the exact same standard, or "process over outcome" stops meaning
anything consistent across the platform.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Literal, Optional

from app.engines.weekly_review_engine import TakenTrade, WeeklyReviewEngine


@dataclass
class ManualJournalEntry:
    """What a discretionary trader submits — deliberately closer to what
    a human actually has on hand (no bot-generated entry_rationale;
    instead their own free-text notes at the time) than the bot-trade
    shape, though it maps onto the same TakenTrade for grading."""
    trade_id: str
    symbol: str
    direction: Literal["long", "short"]
    entry_price: float
    exit_price: float
    stop_price: float
    entry_time: datetime
    exit_time: datetime
    exit_reason: Literal["target", "stop", "timeout", "manual_close"]
    trader_notes: str = ""              # "why I took this" — their own words, not a bot's
    screenshot_url: Optional[str] = None
    psychology_tag: Optional[str] = None  # optional self-reported mood at entry


def _r_multiple(entry: float, exit_: float, stop: float, direction: str) -> float:
    risk_per_unit = abs(entry - stop)
    if risk_per_unit == 0:
        return 0.0
    if direction == "long":
        return (exit_ - entry) / risk_per_unit
    return (entry - exit_) / risk_per_unit


def _to_taken_trade(entry: ManualJournalEntry) -> TakenTrade:
    return TakenTrade(
        trade_id=entry.trade_id, bot_id="manual", symbol=entry.symbol, direction=entry.direction,
        entry_price=entry.entry_price, exit_price=entry.exit_price, stop_price=entry.stop_price,
        r_multiple=round(_r_multiple(entry.entry_price, entry.exit_price, entry.stop_price, entry.direction), 3),
        entry_time=entry.entry_time, exit_time=entry.exit_time, exit_reason=entry.exit_reason,
        entry_rationale=entry.trader_notes or "(no notes recorded at entry time)",
    )


@dataclass
class JournalReviewSummary:
    n_trades: int
    win_rate: float
    expectancy_r: float
    trade_reviews: List[dict] = field(default_factory=list)   # grade + narrative per trade
    coach_narrative: str = ""
    psychology_flag: Optional[str] = None


class JournalReviewerEngine:
    """Thin adapter: converts manual journal entries into the same shape
    the core Weekly Review Engine grades, runs that engine's existing
    logic, and adds one thing manual trades specifically benefit from —
    a nudge about notes quality, since a discretionary trader's
    entry_rationale is often empty in a way a bot's never is."""

    def __init__(self):
        self._core = WeeklyReviewEngine()

    def review(self, entries: List[ManualJournalEntry]) -> JournalReviewSummary:
        if not entries:
            raise ValueError("Need at least one journal entry to review")

        taken_trades = [_to_taken_trade(e) for e in entries]
        report = self._core.build_report(
            week_start=min(e.entry_time for e in entries),
            week_end=max(e.exit_time for e in entries),
            taken_trades=taken_trades,
        )

        missing_notes = sum(1 for e in entries if not e.trader_notes.strip())
        psychology_flag = None
        if missing_notes >= max(1, len(entries) // 2):
            psychology_flag = (
                f"{missing_notes} of {len(entries)} trades have no notes recorded at entry — "
                "without a stated reason going in, it's hard to tell a good process from a lucky "
                "outcome after the fact. Writing one sentence before every entry is the single "
                "highest-leverage habit for making this review actually useful."
            )

        return JournalReviewSummary(
            n_trades=report.n_trades, win_rate=report.win_rate, expectancy_r=report.expectancy_r,
            trade_reviews=[
                {"trade_id": tr.trade.trade_id, "grade": tr.grade, "what_happened": tr.what_happened,
                 "what_could_differ": tr.what_could_differ}
                for tr in report.taken_trade_reviews
            ],
            coach_narrative=self._core_narrative(report),
            psychology_flag=psychology_flag,
        )

    @staticmethod
    def _core_narrative(report) -> str:
        from app.engines.weekly_review_engine import generate_template_narrative
        return generate_template_narrative(report)
