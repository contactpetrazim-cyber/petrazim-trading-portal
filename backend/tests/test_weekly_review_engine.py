from datetime import datetime, timedelta

import pytest

from app.engines.backtest_engine import Bar
from app.engines.weekly_review_engine import (
    WeeklyReviewEngine, TakenTrade, RejectedSignal, EmotionalJournalEntry,
    build_weekly_review_prompt, generate_template_narrative,
)

WEEK_START = datetime(2026, 8, 3)
WEEK_END = datetime(2026, 8, 9)


def trade(trade_id, r_multiple, exit_reason, mood=None, symbol="EURUSD"):
    return TakenTrade(
        trade_id=trade_id, bot_id="bot_2", symbol=symbol, direction="long",
        entry_price=1.10, exit_price=1.10 + r_multiple * 0.01, stop_price=1.09,
        r_multiple=r_multiple, entry_time=WEEK_START, exit_time=WEEK_START + timedelta(hours=2),
        exit_reason=exit_reason, entry_rationale="test rationale",
    )


class TestTakenTradeGrading:
    def test_target_exit_graded_planned_win(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", 2.0, "target")])
        assert report.taken_trade_reviews[0].grade == "planned_win"

    def test_stop_exit_with_loss_graded_risk_managed(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", -1.0, "stop")])
        assert report.taken_trade_reviews[0].grade == "risk_managed_loss"

    def test_timeout_exit_flagged_for_manual_review(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", 0.5, "timeout")])
        assert report.taken_trade_reviews[0].grade == "needs_manual_review"

    def test_headline_stats_computed_correctly(self):
        engine = WeeklyReviewEngine()
        trades = [trade("t1", 2.0, "target"), trade("t2", -1.0, "stop"), trade("t3", 1.0, "target")]
        report = engine.build_report(WEEK_START, WEEK_END, trades)
        assert report.n_trades == 3
        assert report.win_rate == pytest.approx(2 / 3)
        assert report.total_r == pytest.approx(2.0)

    def test_empty_week_does_not_crash(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [])
        assert report.n_trades == 0
        assert report.best_trade is None
        assert report.worst_trade is None


class TestMissedOpportunities:
    def test_hypothetical_target_hit(self):
        engine = WeeklyReviewEngine()
        signal = RejectedSignal(
            signal_id="s1", bot_id="bot_3", symbol="EURUSD", direction="long",
            timestamp=WEEK_START, entry_price_at_signal=1.10, stop_price=1.09,
            target_price=1.12, rejection_reason="risk_limit",
        )
        bars = [Bar(timestamp=WEEK_START + timedelta(hours=i), open=1.10 + i * 0.005,
                     high=1.105 + i * 0.005, low=1.095 + i * 0.005, close=1.10 + i * 0.005)
                for i in range(10)]
        report = engine.build_report(
            WEEK_START, WEEK_END, [], rejected_signals=[signal],
            forward_bars_by_symbol={"EURUSD": bars},
        )
        m = report.missed_opportunities[0]
        assert m.hypothetical_r_multiple is not None
        assert m.hypothetical_outcome in ("target", "stop", "timeout")

    def test_no_forward_data_returns_no_data(self):
        engine = WeeklyReviewEngine()
        signal = RejectedSignal(
            signal_id="s1", bot_id="bot_3", symbol="EURUSD", direction="long",
            timestamp=WEEK_START, entry_price_at_signal=1.10, stop_price=1.09,
            target_price=1.12, rejection_reason="risk_limit",
        )
        report = engine.build_report(WEEK_START, WEEK_END, [], rejected_signals=[signal])
        m = report.missed_opportunities[0]
        assert m.hypothetical_r_multiple is None
        assert m.hypothetical_outcome == "no_data"


class TestEmotionalReview:
    def test_flags_negative_mood_when_overall_positive(self):
        engine = WeeklyReviewEngine()
        trades = [
            trade("t1", 2.0, "target"), trade("t2", 1.5, "target"), trade("t3", 1.0, "target"),
            trade("t4", -1.0, "stop"), trade("t5", -0.8, "stop"), trade("t6", -1.1, "stop"),
        ]
        journal = [
            EmotionalJournalEntry(entry_id="j1", date=WEEK_START, trade_id="t1", mood_tag="calm"),
            EmotionalJournalEntry(entry_id="j2", date=WEEK_START, trade_id="t2", mood_tag="calm"),
            EmotionalJournalEntry(entry_id="j3", date=WEEK_START, trade_id="t3", mood_tag="calm"),
            EmotionalJournalEntry(entry_id="j4", date=WEEK_START, trade_id="t4", mood_tag="anxious"),
            EmotionalJournalEntry(entry_id="j5", date=WEEK_START, trade_id="t5", mood_tag="anxious"),
            EmotionalJournalEntry(entry_id="j6", date=WEEK_START, trade_id="t6", mood_tag="anxious"),
        ]
        report = engine.build_report(WEEK_START, WEEK_END, trades, journal_entries=journal)
        assert len(report.emotional_review.flagged_patterns) >= 1
        assert any("anxious" in f for f in report.emotional_review.flagged_patterns)

    def test_no_journal_entries_gives_no_emotional_review(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", 1.0, "target")])
        assert report.emotional_review is None


class TestNarrativeGeneration:
    def test_template_narrative_is_nonempty_string(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", 1.0, "target")])
        narrative = generate_template_narrative(report)
        assert isinstance(narrative, str)
        assert len(narrative) > 20

    def test_prompt_includes_coach_voice_rules_and_trade_data(self):
        engine = WeeklyReviewEngine()
        report = engine.build_report(WEEK_START, WEEK_END, [trade("t1", 1.0, "target")])
        prompt = build_weekly_review_prompt(report)
        assert "No hype" in prompt
        assert "EURUSD" in prompt
