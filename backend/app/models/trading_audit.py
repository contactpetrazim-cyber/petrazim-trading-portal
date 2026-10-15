"""
Monthly Trading Audit — data model
=======================================

Persists the output of trading_audit_engine.py's forensic audit (real
instrument/bot inventory, reconciliation checks, per-bot-family
expectancy, duplicate/concurrency pattern detection) as a real,
queryable record instead of a one-off report that only ever existed in
chat. By direct request: "I want the Trading portal to be able to do
this analyses monthly and review results - provide docs - integrate
into the Admin portal ... the Admin then has the choice to use as info
only or update or create new bots based on the results."

Every finding is graded with the SAME evidence classification used
throughout the manual audit this model's engine was built from
(Verified / Strongly supported / Hypothesis / Unverified) — see
TradingAuditFinding.evidence_level. Only a small, deliberately safe
set of finding categories carry a real `recommended_action` an admin
can actually Apply (currently: pausing a bot family whose expectancy
is reliably negative over the audited period) — see
trading_audit_engine.py's own module docstring for why "apply" is
scoped this narrowly rather than auto-mutating strategy logic.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AuditRunStatus(enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AuditFindingSeverity(enum.Enum):
    INFO = "info"        # "what's working" / leverageable patterns
    WATCH = "watch"       # worth monitoring, not yet actionable
    ACTION = "action"      # a real, evidenced problem — may carry a recommended_action


class AuditRecommendationStatus(enum.Enum):
    NONE = "none"            # this finding has no actionable recommendation at all
    PENDING = "pending"
    APPLIED = "applied"
    DISMISSED = "dismissed"


class TradingAuditRun(Base):
    """One row per audit run (monthly scheduled, or manually triggered
    from the Admin portal). `summary_json` holds the structured
    instrument inventory + per-bot-family expectancy table — the two
    things every run recomputes fresh so trends are comparable run over
    run, not just this run's own findings list."""
    __tablename__ = "trading_audit_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    status = Column(Enum(AuditRunStatus), nullable=False, default=AuditRunStatus.RUNNING)
    # "scheduled" (the monthly worker) or "manual" (an admin clicked
    # Run Now) — surfaced in the UI so a manual spot-check run is never
    # confused with the real monthly cadence.
    triggered_by = Column(String(20), nullable=False, default="scheduled")
    summary_json = Column(Text, nullable=False, default="{}")
    # The "provide docs" half of the original request — a real,
    # standalone Markdown executive report (instrument inventory, bot
    # scorecard, findings register) generated from this run's own
    # data, not a separate manual write-up. Nullable: populated once
    # run_audit() finishes computing everything else.
    report_markdown = Column(Text, nullable=True)
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)


class TradingAuditFinding(Base):
    """One row per individual finding within a run. `recommended_action`
    is only ever set for the small, pre-approved-safe set of actions
    the engine knows how to apply (see trading_audit_engine.py) —
    everything else is a real finding with real evidence, just without
    a one-click fix, exactly matching the "some problems may originate
    from software defects... not always the trading strategy" caution
    in the audit's own operating rules."""
    __tablename__ = "trading_audit_findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("trading_audit_runs.id"), nullable=False, index=True)

    category = Column(String(50), nullable=False)
    evidence_level = Column(String(30), nullable=False)
    severity = Column(Enum(AuditFindingSeverity), nullable=False, default=AuditFindingSeverity.INFO)
    title = Column(String(255), nullable=False)
    detail = Column(Text, nullable=False)
    bot_id = Column(String(50), nullable=True)

    recommended_action = Column(String(50), nullable=True)
    recommendation_status = Column(Enum(AuditRecommendationStatus), nullable=False, default=AuditRecommendationStatus.NONE)
    applied_at = Column(DateTime, nullable=True)
    applied_by = Column(String(100), nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
