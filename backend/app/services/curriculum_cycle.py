"""
Weekly Curriculum Cycle Engine
==================================

Adapts the Academy's weekly training schedule to the Trading Portal's
own curriculum: 12 facilitator-led modules run Monday-Saturday, 2 per
day (AM + Afternoon), the same 12-module sequence repeating every
week as a new "cycle." A trainee gets live access to their current
cycle plus one backup cycle (two chances at each module — this
week's live session and next week's repeat), can additionally book up
to 2 standalone modules outside their normal sequence, and any cycle
beyond those two requires a manual request.

MODULE MAPPING — an explicit adaptation choice, not given in the
brief (which used "Pillar 1-12" for the Academy's business curriculum):
mapped onto the Trading Portal's own Learn curriculum map
(00_MASTER_CONTENT_MAP.md) so the facilitator's live teaching schedule
lines up with the self-paced Learn tracks a trainee is already working
through. Correct this list if a different 12-module set is wanted —
it's a config array, not load-bearing logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List

MODULES = [
    "Market Basics & Structure",
    "Liquidity & Zones",
    "Fair Value Gaps & Premium/Discount",
    "Multi-Timeframe Analysis",
    "Risk Management",
    "Trade Management & Psychology",
    "Bot 1 — Macro Swing Structure",
    "Bot 2 — Order Block Reversal",
    "Bot 3 — Imbalance Expansion",
    "Bot 4 — Volume & Liquidity Sweep",
    "Bot 5 — Liquidity Purge Specialist",
    "Capstone & Portfolio Review",
]

MODULE_SCHEDULE = [
    (0, "am", 0), (0, "afternoon", 1),
    (1, "am", 2), (1, "afternoon", 3),
    (2, "am", 4), (2, "afternoon", 5),
    (3, "am", 6), (3, "afternoon", 7),
    (4, "am", 8), (4, "afternoon", 9),
    (5, "am", 10), (5, "afternoon", 11),
]

MAX_STANDALONE_BOOKINGS = 2
DEFAULT_CYCLES_INCLUDED = 2


def _next_monday_on_or_after(d: date) -> date:
    days_ahead = (0 - d.weekday()) % 7
    return d + timedelta(days=days_ahead)


@dataclass
class SessionSpec:
    module_index: int
    module_name: str
    session_date: str
    band: str


def generate_cycle_sessions(cycle_start_monday: date) -> List[SessionSpec]:
    """cycle_start_monday MUST be a Monday — validated, not silently
    corrected, since silently shifting a caller's intended date to the
    nearest Monday could book the wrong week without them noticing."""
    if cycle_start_monday.weekday() != 0:
        raise ValueError(f"cycle_start_monday must be a Monday, got {cycle_start_monday} (weekday {cycle_start_monday.weekday()})")

    sessions = []
    for weekday_offset, band, module_index in MODULE_SCHEDULE:
        session_date = cycle_start_monday + timedelta(days=weekday_offset)
        sessions.append(SessionSpec(
            module_index=module_index, module_name=MODULES[module_index],
            session_date=session_date.isoformat(), band=band,
        ))
    return sessions


def find_next_occurrences(module_index: int, after_date: date, count: int = 2) -> List[str]:
    """For an out-of-sequence request: 'I want Module 7 now, not on my
    normal week' — returns the next `count` upcoming dates that module
    actually runs on (it's always the same weekday, so this is a
    simple weekly-recurrence lookup, not a search)."""
    if not (0 <= module_index < len(MODULES)):
        raise ValueError(f"module_index {module_index} out of range (0-{len(MODULES)-1})")

    target_weekday = next(wd for wd, band, mi in MODULE_SCHEDULE if mi == module_index)

    occurrences = []
    candidate = after_date + timedelta(days=1)
    while len(occurrences) < count:
        if candidate.weekday() == target_weekday:
            occurrences.append(candidate.isoformat())
            candidate += timedelta(days=7)
        else:
            candidate += timedelta(days=1)
    return occurrences


@dataclass
class CycleEnrollmentPlan:
    primary_cycle_start: str
    backup_cycle_start: str


def default_enrollment_plan(enrollment_date: date) -> CycleEnrollmentPlan:
    """Primary cycle = the next upcoming Monday (today counts if today
    IS Monday); backup cycle = the Monday after that."""
    primary = _next_monday_on_or_after(enrollment_date)
    backup = primary + timedelta(days=7)
    return CycleEnrollmentPlan(primary_cycle_start=primary.isoformat(), backup_cycle_start=backup.isoformat())


def is_date_within_enrolled_cycles(session_date: str, plan: CycleEnrollmentPlan) -> bool:
    """A session date is covered by the trainee's cycle access if it
    falls within either the primary or backup cycle's Mon-Sat week."""
    d = date.fromisoformat(session_date)
    for cycle_start_str in (plan.primary_cycle_start, plan.backup_cycle_start):
        cycle_start = date.fromisoformat(cycle_start_str)
        cycle_end = cycle_start + timedelta(days=5)
        if cycle_start <= d <= cycle_end:
            return True
    return False


@dataclass
class StandaloneBookingCheck:
    allowed: bool
    reason: str = ""


def check_standalone_booking_allowed(existing_standalone_count: int) -> StandaloneBookingCheck:
    if existing_standalone_count >= MAX_STANDALONE_BOOKINGS:
        return StandaloneBookingCheck(
            allowed=False,
            reason=f"Maximum of {MAX_STANDALONE_BOOKINGS} standalone module bookings reached "
                   f"— cancel an existing one to book a different module.",
        )
    return StandaloneBookingCheck(allowed=True)
