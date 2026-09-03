"""
Weekly Review Engine — Coach Debrief
=====================================

PURPOSE
-------
At the end of each week, this engine builds a structured review of:

  1. TAKEN TRADES — every trade actually executed, with the original
     entry reasoning (captured at signal time) next to what actually
     happened, graded on PROCESS not outcome.
  2. MISSED OPPORTUNITIES — signals your bots generated that were
     rejected (risk limit, human declined, bot disabled) or setups
     that existed but weren't caught, with a hypothetical outcome
     computed the same honest way a backtest computes one: forward
     bar-by-bar simulation, no lookahead, no cherry-picking.
  3. EMOTIONAL / PSYCHOLOGY REVIEW — correlates journaled emotional
     state at trade time with actual outcomes, to surface patterns
     like "trades tagged anxious lost more often than trades tagged calm."

PROCESS OVER OUTCOME — WHY GRADING WORKS THIS WAY
---------------------------------------------------
A losing trade that hit its planned stop is not a mistake — it's risk
management working exactly as designed. A winning trade that closed on
a timeout with no clear plan followed is not necessarily a success —
it's a result the process didn't actually produce on purpose. Grading
here is based on what the DATA can actually show (exit_reason,
r_multiple vs plan), not on inferring psychology the data can't prove.
Where the data isn't enough to say more, the review says so rather than
guessing.

WHAT THIS ENGINE DOES NOT DO
------------------------------
It does not call an LLM directly. It produces structured analysis and
a ready-to-send prompt (`build_weekly_review_prompt`) for your existing
coach LLM integration to turn into natural-language coaching prose —
plus a deterministic template narrative (`generate_template_narrative`)
that works with zero LLM wiring, so the feature is usable immediately.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Literal, Optional

from app.engines.backtest_engine import Bar, BacktestEngine


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class TakenTrade:
    trade_id: str
    bot_id: str
    symbol: str
    direction: Literal["long", "short"]
    entry_price: float
    exit_price: float
    stop_price: float
    r_multiple: float
    entry_time: datetime
    exit_time: datetime
    exit_reason: Literal["target", "stop", "timeout", "manual_close"]
    entry_rationale: str = ""    # the coach's stated reasoning when the signal fired


@dataclass
class RejectedSignal:
    signal_id: str
    bot_id: str
    symbol: str
    direction: Literal["long", "short"]
    timestamp: datetime
    entry_price_at_signal: float
    stop_price: float
    target_price: float
    rejection_reason: str        # e.g. "risk_engine_daily_loss_limit", "human_declined", "bot_disabled"
    rationale_at_signal: str = ""


@dataclass
class EmotionalJournalEntry:
    entry_id: str
    date: datetime
    mood_tag: str                # e.g. "calm", "anxious", "confident", "fomo", "revenge", "tilted"
    trade_id: Optional[str] = None
    notes: str = ""


@dataclass
class TakenTradeReview:
    trade: TakenTrade
    grade: Literal["planned_win", "risk_managed_loss", "needs_manual_review"]
    what_happened: str
    what_could_differ: str


@dataclass
class MissedOpportunityReview:
    signal: RejectedSignal
    hypothetical_r_multiple: Optional[float]
    hypothetical_outcome: str        # "target" / "stop" / "timeout" / "no_data"
    lesson: str


@dataclass
class MoodPerformance:
    mood_tag: str
    n_trades: int
    win_rate: float
    expectancy_r: float


@dataclass
class EmotionalReview:
    mood_performance: List[MoodPerformance]
    flagged_patterns: List[str]


@dataclass
class WeeklyReviewReport:
    week_start: datetime
    week_end: datetime
    n_trades: int
    win_rate: float
    expectancy_r: float
    total_r: float
    best_trade: Optional[TakenTradeReview]
    worst_trade: Optional[TakenTradeReview]
    taken_trade_reviews: List[TakenTradeReview] = field(default_factory=list)
    missed_opportunities: List[MissedOpportunityReview] = field(default_factory=list)
    emotional_review: Optional[EmotionalReview] = None
    key_lessons: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class WeeklyReviewEngine:

    def build_report(
        self,
        week_start: datetime,
        week_end: datetime,
        taken_trades: List[TakenTrade],
        rejected_signals: Optional[List[RejectedSignal]] = None,
        journal_entries: Optional[List[EmotionalJournalEntry]] = None,
        forward_bars_by_symbol: Optional[Dict[str, List[Bar]]] = None,
    ) -> WeeklyReviewReport:
        rejected_signals = rejected_signals or []
        journal_entries = journal_entries or []
        forward_bars_by_symbol = forward_bars_by_symbol or {}

        trade_reviews = [self._review_taken_trade(t) for t in taken_trades]
        r_values = [t.r_multiple for t in taken_trades]

        win_rate = (sum(1 for r in r_values if r > 0) / len(r_values)) if r_values else 0.0
        expectancy = statistics.mean(r_values) if r_values else 0.0
        total_r = sum(r_values)

        best = max(trade_reviews, key=lambda tr: tr.trade.r_multiple) if trade_reviews else None
        worst = min(trade_reviews, key=lambda tr: tr.trade.r_multiple) if trade_reviews else None

        missed = [
            self._review_missed_opportunity(sig, forward_bars_by_symbol.get(sig.symbol, []))
            for sig in rejected_signals
        ]

        emotional_review = (
            self._build_emotional_review(taken_trades, journal_entries) if journal_entries else None
        )

        lessons = self._derive_key_lessons(trade_reviews, missed, emotional_review, expectancy)

        return WeeklyReviewReport(
            week_start=week_start, week_end=week_end,
            n_trades=len(taken_trades), win_rate=round(win_rate, 4),
            expectancy_r=round(expectancy, 3), total_r=round(total_r, 3),
            best_trade=best, worst_trade=worst,
            taken_trade_reviews=trade_reviews,
            missed_opportunities=missed,
            emotional_review=emotional_review,
            key_lessons=lessons,
        )

    # ---------------- taken trades ----------------

    def _review_taken_trade(self, trade: TakenTrade) -> TakenTradeReview:
        if trade.exit_reason == "stop":
            grade = "risk_managed_loss" if trade.r_multiple < 0 else "planned_win"
            what_happened = (
                f"Stopped out for {trade.r_multiple:+.2f}R. The stop was respected exactly as "
                f"planned — this is risk management functioning correctly, not a mistake, "
                f"even though the outcome was a loss."
            )
            what_could_differ = (
                "Nothing about the exit process needs to change here. Worth asking only whether "
                "the original entry thesis (see rationale) still held at the time of the stop, "
                "or whether the setup was marginal going in."
            )
        elif trade.exit_reason == "target":
            grade = "planned_win"
            what_happened = f"Hit target for {trade.r_multiple:+.2f}R, as planned."
            what_could_differ = (
                "Trade played out as designed. If this setup type consistently reaches target "
                "with room to spare, it may be worth reviewing whether the target is conservative."
            )
        else:  # timeout / manual_close
            grade = "needs_manual_review"
            what_happened = (
                f"Closed by {trade.exit_reason} for {trade.r_multiple:+.2f}R — neither the stop "
                f"nor the target was hit before the position was closed."
            )
            what_could_differ = (
                "This exit wasn't produced by the original plan (stop or target), so it's worth "
                "a manual look: was there a reason to close early that isn't captured in this data, "
                "or should the max-hold rule or target distance be reconsidered for this setup?"
            )

        return TakenTradeReview(
            trade=trade, grade=grade,
            what_happened=what_happened, what_could_differ=what_could_differ,
        )

    # ---------------- missed opportunities ----------------

    def _review_missed_opportunity(
        self, signal: RejectedSignal, forward_bars: List[Bar]
    ) -> MissedOpportunityReview:
        r, outcome = self._simulate_hypothetical(signal, forward_bars)

        if r is None:
            lesson = "No forward price data available to evaluate this signal — logged for the record only."
        elif r > 0:
            lesson = (
                f"This setup would have returned {r:+.2f}R ({outcome}). Rejected for: "
                f"{signal.rejection_reason}. Worth reviewing whether that rejection rule is "
                f"too conservative for this setup type, or whether this was one good outcome "
                f"among many the rule correctly prevents — one instance isn't enough to change a rule."
            )
        else:
            lesson = (
                f"This setup would have lost {r:+.2f}R ({outcome}). Rejected for: "
                f"{signal.rejection_reason}. The rejection worked in your favor this time."
            )

        return MissedOpportunityReview(
            signal=signal, hypothetical_r_multiple=r, hypothetical_outcome=outcome, lesson=lesson,
        )

    @staticmethod
    def _simulate_hypothetical(signal: RejectedSignal, forward_bars: List[Bar]):
        """Reuses the backtest engine's own exit-check logic, so a missed-opportunity
        estimate is held to the exact same no-lookahead, pessimistic-fill standard as
        every other backtest number in this system — no special-casing for a nicer story."""
        if not forward_bars:
            return None, "no_data"

        open_pos = {
            "direction": signal.direction,
            "entry_price": signal.entry_price_at_signal,
            "stop_price": signal.stop_price,
            "target_price": signal.target_price,
        }
        for bar in forward_bars:
            exit_price, reason = BacktestEngine._check_exit(open_pos, bar)
            if exit_price is not None:
                r = BacktestEngine._r_multiple(open_pos, exit_price)
                return round(r, 3), reason

        r = BacktestEngine._r_multiple(open_pos, forward_bars[-1].close)
        return round(r, 3), "timeout"

    # ---------------- emotional / psychology review ----------------

    def _build_emotional_review(
        self, trades: List[TakenTrade], journal_entries: List[EmotionalJournalEntry]
    ) -> EmotionalReview:
        by_trade_id = {e.trade_id: e for e in journal_entries if e.trade_id}
        r_by_mood: Dict[str, List[float]] = defaultdict(list)

        for t in trades:
            entry = by_trade_id.get(t.trade_id)
            if entry:
                r_by_mood[entry.mood_tag].append(t.r_multiple)

        overall_expectancy = statistics.mean([t.r_multiple for t in trades]) if trades else 0.0

        mood_perf = []
        flags = []
        for mood, r_values in r_by_mood.items():
            win_rate = sum(1 for r in r_values if r > 0) / len(r_values)
            expectancy = statistics.mean(r_values)
            mood_perf.append(MoodPerformance(
                mood_tag=mood, n_trades=len(r_values),
                win_rate=round(win_rate, 3), expectancy_r=round(expectancy, 3),
            ))
            if len(r_values) >= 3 and expectancy < 0 and overall_expectancy >= 0:
                flags.append(
                    f"Trades logged as '{mood}' averaged {expectancy:+.2f}R across {len(r_values)} "
                    f"trades, versus {overall_expectancy:+.2f}R overall. Worth a hard look at whether "
                    f"'{mood}' should be a no-trade condition."
                )

        mood_perf.sort(key=lambda m: m.expectancy_r)
        return EmotionalReview(mood_performance=mood_perf, flagged_patterns=flags)

    # ---------------- lessons + narrative ----------------

    def _derive_key_lessons(
        self,
        trade_reviews: List[TakenTradeReview],
        missed: List[MissedOpportunityReview],
        emotional_review: Optional[EmotionalReview],
        expectancy: float,
    ) -> List[str]:
        lessons: List[str] = []

        needs_review = [tr for tr in trade_reviews if tr.grade == "needs_manual_review"]
        if needs_review:
            lessons.append(
                f"{len(needs_review)} trade(s) this week closed by timeout/manual close rather than "
                "the original plan — review these individually before next week."
            )

        good_missed = [m for m in missed if m.hypothetical_r_multiple and m.hypothetical_r_multiple > 0]
        if len(good_missed) >= 3:
            lessons.append(
                f"{len(good_missed)} rejected signals this week would have been profitable. If they "
                "share a common rejection reason, that rule may be worth revisiting — but don't change "
                "risk rules off a single week's sample."
            )

        if emotional_review:
            lessons.extend(emotional_review.flagged_patterns)

        if not lessons:
            lessons.append(
                "No major process breaks flagged this week. Consistency itself is worth noting — "
                "it's the boring weeks that compound."
            )
        return lessons


# ---------------------------------------------------------------------------
# Coach narrative — LLM prompt builder + deterministic fallback
# ---------------------------------------------------------------------------

COACH_VOICE_RULES = """
You are a disciplined trading coach reviewing this trader's week. Rules:
- No hype, no certainty language, no profit guarantees.
- Grade process, not outcome — a stopped-out trade that followed the plan is not a failure.
- Treat trading as probabilistic. Never imply next week's results are predictable from this data.
- Be specific: reference actual numbers (R-multiples, win rate, mood tags) from the data given.
- Where the data doesn't support a conclusion, say so rather than speculating.
- End with 2-3 concrete, specific things to carry into next week — not generic advice.
""".strip()


def build_weekly_review_prompt(report: WeeklyReviewReport) -> str:
    """Builds a ready-to-send prompt for your existing coach LLM integration.
    Keeps the LLM call itself out of this engine — plug this string into
    whatever client your TradeCoachPanel already uses."""
    lines = [COACH_VOICE_RULES, "", f"WEEK: {report.week_start.date()} to {report.week_end.date()}", ""]
    lines.append(f"Headline: {report.n_trades} trades, {report.win_rate*100:.1f}% win rate, "
                 f"{report.expectancy_r:+.2f}R expectancy, {report.total_r:+.2f}R total.")
    lines.append("")
    lines.append("TAKEN TRADES:")
    for tr in report.taken_trade_reviews:
        lines.append(
            f"- {tr.trade.symbol} {tr.trade.direction} | {tr.trade.r_multiple:+.2f}R | "
            f"grade={tr.grade} | exit={tr.trade.exit_reason} | "
            f"entry rationale: {tr.trade.entry_rationale or 'not recorded'}"
        )
    if report.missed_opportunities:
        lines.append("")
        lines.append("MISSED OPPORTUNITIES (hypothetical, forward-simulated):")
        for m in report.missed_opportunities:
            lines.append(
                f"- {m.signal.symbol} {m.signal.direction} | rejected for: {m.signal.rejection_reason} | "
                f"hypothetical: {m.hypothetical_r_multiple}R ({m.hypothetical_outcome})"
            )
    if report.emotional_review and report.emotional_review.mood_performance:
        lines.append("")
        lines.append("EMOTIONAL / PSYCHOLOGY DATA:")
        for mp in report.emotional_review.mood_performance:
            lines.append(f"- mood '{mp.mood_tag}': {mp.n_trades} trades, "
                         f"{mp.win_rate*100:.0f}% win rate, {mp.expectancy_r:+.2f}R expectancy")
    lines.append("")
    lines.append("Write the weekly debrief now, in your voice as coach.")
    return "\n".join(lines)


def generate_template_narrative(report: WeeklyReviewReport) -> str:
    """Deterministic fallback narrative — no LLM required. Usable immediately,
    and useful as a sanity baseline to compare an LLM-generated version against."""
    parts = [
        f"Week of {report.week_start.date()} to {report.week_end.date()}: "
        f"{report.n_trades} trades, {report.win_rate*100:.1f}% win rate, "
        f"{report.expectancy_r:+.2f}R average, {report.total_r:+.2f}R total.",
    ]

    if report.best_trade:
        parts.append(
            f"Best trade: {report.best_trade.trade.symbol} at "
            f"{report.best_trade.trade.r_multiple:+.2f}R ({report.best_trade.grade})."
        )
    if report.worst_trade:
        parts.append(
            f"Worst trade: {report.worst_trade.trade.symbol} at "
            f"{report.worst_trade.trade.r_multiple:+.2f}R ({report.worst_trade.grade})."
        )

    review_flags = [tr for tr in report.taken_trade_reviews if tr.grade == "needs_manual_review"]
    if review_flags:
        parts.append(f"{len(review_flags)} trade(s) need a manual look — closed outside the original plan.")

    if report.emotional_review and report.emotional_review.flagged_patterns:
        parts.append("Psychology: " + " ".join(report.emotional_review.flagged_patterns))

    parts.append("Lessons: " + " ".join(report.key_lessons))
    return " ".join(parts)
