"""A small generic key/value settings table for platform-wide toggles
that need to change at runtime without a redeploy — the first (and
currently only) use is payments.mode (test/live), since flipping
between test and live payment processing is exactly the kind of
decision that shouldn't require editing a Render env var and waiting
for a rebuild.
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
