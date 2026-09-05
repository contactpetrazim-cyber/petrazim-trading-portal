"""A small generic key/value settings table for platform-wide toggles
that need to change at runtime without a redeploy — the first use was
payments.mode (test/live); trading.paper_enforced (below) is the
second, since flipping between test/live processing is exactly the
kind of decision that shouldn't require editing a Render env var and
waiting for a rebuild.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, String

from app.database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


PAYMENTS_MODE_KEY = "payments.mode"

# Super Admin's platform-wide trading kill-switch — by direct request
# ("a master control in the super Admin portal"). "true" forces every
# manual order into Paper Trading regardless of what an individual
# trader's own Test/Live or Paper Trading toggle says — see
# routers/manual_trading.py::place_manual_order's own `paper`
# computation. Defaults to unset/"false" (no override) the same
# fail-safe-not-fail-open way PAYMENTS_MODE_KEY defaults to "test".
TRADING_PAPER_ENFORCED_KEY = "trading.paper_enforced"
