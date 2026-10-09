"""
Trading Time Slots — the shared session/day/half-day scheduling
vocabulary, by direct request (real forex session hours supplied
directly, converted to UTC here) — "integrate the following ...
summarise into trading time slots ... integrate as quick filters for
the semi auto and normal bot setups ... also include for global
settings for manual trading ... also include an 'All'".

Forex doesn't have an official open/close bell like a stock exchange —
volume peaks when major global hubs are open AT THE SAME TIME (an
"overlap"), not on a fixed single-market schedule. Four named windows,
matching the real session structure supplied directly:

  CORE (high volume, tightest spreads):
    - London/New York Overlap — the single heaviest volume window of
      the day, ~8:00 AM-12:00 PM EST.
    - Tokyo/London Overlap — a secondary core window, ~2:00-4:00 AM EST.
  NON-CORE (low volume, wider spreads):
    - Asian Session (Tokyo) — liquid mainly for AUD/NZD/JPY, thin for
      majors like EUR/USD; range-bound/consolidating price action.
    - Twilight Zone (Off-Peak) — the gap between the New York close
      and the Tokyo open, ~5:00-7:00 PM EST, the single lowest-volume
      window of the day as major desks hand over regional operations.

EST -> UTC conversion used throughout: EST = UTC-5 (this module always
reasons in UTC — see schedule_allows's own `now` parameter).

Shared by EVERY scheduling surface in the app, so "All" and the exact
session hours mean the identical thing everywhere a trader or bot
touches this concept:
  - BotConfig.schedule_sessions/schedule_days/schedule_half_day — a
    bot's own trading window, enforced in execution_engine.py's
    process_signal for EVERY signal that bot produces, regardless of
    its execution_mode or whether Sub-Auto is engaged (a normal bot
    and a Sub-Auto bot share the exact same schedule mechanism now —
    by direct request, "quick filters for the semi auto AND normal
    bot setups").
  - ManualTradingSettings.schedule_sessions/schedule_days/
    schedule_half_day — a trader's own global manual-trading window,
    enforced in manual_trading.py's place_manual_order.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

# key -> (label, start_hour_utc, end_hour_utc, tier). end is exclusive
# and may read as 24 (meaning "through 23:59") — every range here is
# a plain same-day UTC window, none of them actually wrap past
# midnight once converted (Twilight Zone's 5-7PM EST lands at 22-24
# UTC, not an overnight wrap).
TRADING_SESSIONS: dict[str, dict] = {
    "london_ny_overlap": {"label": "London/New York Overlap", "start": 13, "end": 17, "tier": "core"},
    "tokyo_london_overlap": {"label": "Tokyo/London Overlap", "start": 7, "end": 9, "tier": "core"},
    "asian": {"label": "Asian Session", "start": 0, "end": 9, "tier": "non-core"},
    "twilight": {"label": "Twilight Zone", "start": 22, "end": 24, "tier": "non-core"},
}

# ISO weekday index (datetime.weekday(): Monday=0..Sunday=6) -> label.
WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def schedule_allows(
    sessions: Optional[list[str]],
    days: Optional[list[int]],
    half_day: Optional[str],
    now: Optional[datetime] = None,
) -> bool:
    """True iff `now` (UTC) satisfies every ONE of the three configured
    dimensions. Each is independent; empty/None means "All" for that
    dimension — by direct request ("also include an 'All'") — and
    never blocks on its own. A configured dimension must pass for the
    overall result to stay True (plain AND across dimensions, same as
    this exact rule already proven out for Sub-Auto's own schedule)."""
    now = now or datetime.utcnow()
    if days:
        if now.weekday() not in days:
            return False
    if half_day:
        is_am = now.hour < 12
        if half_day == "am" and not is_am:
            return False
        if half_day == "pm" and is_am:
            return False
    if sessions:
        hour = now.hour
        if not any(
            TRADING_SESSIONS[s]["start"] <= hour < TRADING_SESSIONS[s]["end"]
            for s in sessions
            if s in TRADING_SESSIONS
        ):
            return False
    return True
